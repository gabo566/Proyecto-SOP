import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { REPAIR_TYPES: ["Reemplazo de BMC", "Reemplazo de Coldplate 0", "Reemplazo de FIO Board"] };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../../public/src/card-session.js", import.meta.url), "utf8"), context);

const card = (extra = {}) => ({ ...context.newCard("BMC"), partNumber: "BMC-1", serial: "SN-1", sheets: ["8"], ...extra });

test("los tipos de tarjeta salen de los tipos de reparación", () => {
  assert.deepEqual(context.getCardTypes(), ["BMC", "Coldplate 0", "FIO Board"]);
});

test("agregar y quitar tarjetas, también del mismo tipo", () => {
  let cards = context.addCard([], "BMC");
  cards = context.addCard(cards, "BMC");
  assert.equal(context.countCardsOfType(cards, "BMC"), 2);
  cards = context.removeCard(cards, cards[0].id);
  assert.equal(cards.length, 1);
});

test("la unión de hojas no repite y conserva el orden", () => {
  const cards = [card({ sheets: ["8", "9"] }), card({ sheets: ["9", "10"] })];
  assert.deepEqual([...context.unionSheets(cards)], ["8", "9", "10"]);
});

test("sin tarjetas no se puede abrir la SOP", () => {
  assert.equal(context.validateCards([], "validation").ok, false);
});

test("cada tarjeta necesita PN, serie y hojas", () => {
  const result = context.validateCards([card({ partNumber: "", sheets: [] })], "validation");
  assert.equal(result.ok, false);
  assert.deepEqual([...result.missing], ["PN de BMC", "hojas de BMC"]);
});

test("en reemplazo la serie retirada es obligatoria", () => {
  assert.equal(context.validateCards([card()], "validation").ok, true);
  const result = context.validateCards([card()], "replacement");
  assert.deepEqual([...result.missing], ["serie retirada de BMC"]);
  assert.equal(context.validateCards([card({ removedSerial: "SN-0" })], "replacement").ok, true);
});

test("la primera tarjeta alimenta los campos de siempre del registro", () => {
  const fields = context.legacyCardFields([card(), card({ type: "FIO Board", serial: "SN-2" })], "replacement");
  assert.deepEqual({ ...fields }, { componentPartNumber: "BMC-1", componentSerial: "SN-1", repairType: "Reemplazo de BMC" });
  assert.equal(context.legacyCardFields([card()], "validation").repairType, "");
});

test("los eventos del lote llevan resultado en validación y serie retirada en reemplazo", () => {
  const node = { serial: "1934526000155", nodePartNumber: "675", nodeNumber: "", stationAssignment: "RWK:RWK" };
  const validations = context.buildCardEvents([card({ result: "damage", damageNote: "conector doblado" })], "validation", node);
  assert.equal(validations[0].type, "validation");
  assert.equal(validations[0].result, "damage");
  assert.equal(validations[0].note, "conector doblado");
  const replacements = context.buildCardEvents([card({ removedSerial: "SN-0", validationId: 7 })], "replacement", node);
  assert.equal(replacements[0].reason, "damage");
  assert.equal(replacements[0].removedSerial, "SN-0");
  assert.equal(replacements[0].validationId, 7);
});
