// Sesión de tarjetas de Retrabajo: un nodo con una o varias tarjetas a validar o reemplazar.
// Funciones puras; la pantalla las usa para armar los renglones y validar antes de abrir la SOP.

// Tipos de tarjeta: se derivan de REPAIR_TYPES ("Reemplazo de BMC" → "BMC").
function getCardTypes() {
  const source = typeof REPAIR_TYPES !== "undefined" ? REPAIR_TYPES : [];
  return source.map((label) => String(label).replace(/^Reemplazo de /, "").trim()).filter(Boolean);
}

function newCard(type = "") {
  return {
    id: `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    partNumber: "",
    serial: "",
    removedSerial: "",
    sheets: [],
    result: "ok",
    damageNote: "",
  };
}

function addCard(cards, type = "") {
  return [...cards, newCard(type)];
}

function removeCard(cards, id) {
  return cards.filter((card) => card.id !== id);
}

function countCardsOfType(cards, type) {
  return cards.filter((card) => card.type === type).length;
}

// Hojas de toda la sesión: la SOP corre sobre la unión de las hojas de cada tarjeta, sin repetir.
function unionSheets(cards) {
  const seen = new Set();
  for (const card of cards) for (const sheet of card.sheets ?? []) seen.add(String(sheet));
  return [...seen];
}

// Qué falta antes de abrir la SOP. En reemplazo la serie retirada es obligatoria.
function validateCards(cards, actionType = "validation") {
  const missing = [];
  if (!cards.length) return { ok: false, missing: ["al menos una tarjeta"] };
  cards.forEach((card, index) => {
    const label = card.type || `tarjeta ${index + 1}`;
    if (!card.type) missing.push(`tipo de la tarjeta ${index + 1}`);
    if (!String(card.partNumber ?? "").trim()) missing.push(`PN de ${label}`);
    if (!String(card.serial ?? "").trim()) missing.push(`serie de ${label}`);
    if (actionType === "replacement" && !String(card.removedSerial ?? "").trim()) missing.push(`serie retirada de ${label}`);
    if (!(card.sheets ?? []).length) missing.push(`hojas de ${label}`);
  });
  return { ok: missing.length === 0, missing };
}

// La primera tarjeta alimenta los campos de siempre del registro (Reportes y Trazabilidad los leen).
function legacyCardFields(cards, actionType = "validation") {
  const first = cards[0];
  if (!first) return { componentPartNumber: "", componentSerial: "", repairType: "" };
  return {
    componentPartNumber: String(first.partNumber ?? "").trim(),
    componentSerial: String(first.serial ?? "").trim(),
    repairType: actionType === "replacement" && first.type ? `Reemplazo de ${first.type}` : "",
  };
}

// Eventos que se envían al servidor, uno por tarjeta, listos para el endpoint en lote.
function buildCardEvents(cards, actionType, node) {
  const isReplacement = actionType === "replacement";
  return cards.map((card) => ({
    type: isReplacement ? "replacement" : "validation",
    nodeSerial: node.serial,
    nodePartNumber: node.nodePartNumber,
    nodeNumber: node.nodeNumber,
    stationAssignment: node.stationAssignment,
    cardType: card.type,
    cardPartNumber: String(card.partNumber).trim(),
    cardSerial: String(card.serial).trim(),
    result: isReplacement ? undefined : (card.result === "damage" ? "damage" : "ok"),
    note: !isReplacement && card.result === "damage" ? String(card.damageNote ?? "").trim() : undefined,
    reason: isReplacement ? (card.validationId ? "damage" : "direct") : undefined,
    removedSerial: isReplacement ? String(card.removedSerial).trim() : undefined,
    validationId: isReplacement && card.validationId ? Number(card.validationId) : undefined,
    sheets: (card.sheets ?? []).map(String),
  }));
}
