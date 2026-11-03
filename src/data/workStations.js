const WORK_STATION_ASSIGNMENTS = [
  { value: "MFG:TDR", type: "MFG", typeLabel: "Manufactura", code: "TDR", label: "TDR" },
  { value: "MFG:SYS_ASSY_1", type: "MFG", typeLabel: "Manufactura", code: "SYS_ASSY_1", label: "SYS_ASSY_1" },
  { value: "MFG:SYS_ASSY_2", type: "MFG", typeLabel: "Manufactura", code: "SYS_ASSY_2", label: "SYS_ASSY_2" },
  { value: "RWK:RWK", type: "RWK", typeLabel: "Retrabajo", code: "RWK", label: "RWK" },
];

const NODE_PART_NUMBER_OPTIONS = [
  "675-24975-2000-000",
  "675-24975-3000-000",
  "675-24975-3100-000",
  "675-24975-0000-000",
  "675-24059-3000-000",
];

function createCustomWorkStationAssignment(type, label) {
  const normalizedType = String(type ?? "").trim().toUpperCase();
  const normalizedLabel = String(label ?? "").trim();
  if (!["MFG", "RWK"].includes(normalizedType) || !normalizedLabel || normalizedLabel.length > 80) return "";
  return `CUSTOM:${normalizedType}:${encodeURIComponent(normalizedLabel)}`;
}

function getWorkStationAssignment(value) {
  const preset = WORK_STATION_ASSIGNMENTS.find((assignment) => assignment.value === value);
  if (preset) return preset;
  const match = String(value ?? "").match(/^CUSTOM:(MFG|RWK):(.+)$/);
  if (!match) return null;
  let label = "";
  try {
    label = decodeURIComponent(match[2]).trim();
  } catch {
    return null;
  }
  if (!label) return null;
  return {
    value: String(value),
    type: match[1],
    typeLabel: match[1] === "MFG" ? "Manufactura" : "Retrabajo",
    code: label,
    label,
    custom: true,
  };
}

function getWorkStationAssignments(state = null) {
  const assignments = new Map(WORK_STATION_ASSIGNMENTS.map((assignment) => [assignment.value, assignment]));
  if (!state) return [...assignments.values()];
  for (const version of getAllSopVersions(state)) {
    const value = getSopVersionStationAssignment(state, version);
    const assignment = getWorkStationAssignment(value);
    if (assignment) assignments.set(assignment.value, assignment);
  }
  return [...assignments.values()];
}

function formatWorkStationAssignment(value) {
  const assignment = getWorkStationAssignment(value);
  return assignment ? `${assignment.type} · ${assignment.label}` : String(value ?? "");
}

function getSopVersionStationAssignment(state, version) {
  if (!version?.id) return "";
  return state.sopVersionCatalog?.[version.id]?.stationAssignment
    ?? version.document?.stationAssignment
    ?? "";
}

function getAllSopVersions(state) {
  const versions = [...(state.sopVersionHistory ?? []), BUILT_IN_SOP_VERSION];
  return versions.filter((version, index, list) => list.findIndex((entry) => entry.id === version.id) === index);
}

function isSopVersionEnabled(state, version) {
  if (!version?.id || state.sopCatalogLoaded === false) return false;
  const config = state.sopVersionCatalog?.[version.id];
  return Boolean(config?.enabled && getWorkStationAssignment(config.stationAssignment));
}

function getEnabledSopVersionsForStation(state, assignmentValue) {
  if (!assignmentValue || state.sopCatalogLoaded === false) return [];
  return getAllSopVersions(state)
    .filter((version) => isSopVersionEnabled(state, version)
      && getSopVersionStationAssignment(state, version) === assignmentValue)
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));
}

function findSopVersionForStation(state, assignmentValue, versionId = state.form?.sopVersionId) {
  const versions = getEnabledSopVersionsForStation(state, assignmentValue);
  if (versionId) return versions.find((version) => version.id === versionId) ?? null;
  return versions[0] ?? null;
}

function getEnabledWorkStationAssignments(state, type = "") {
  return getWorkStationAssignments(state).filter((assignment) => (!type || assignment.type === type)
    && getEnabledSopVersionsForStation(state, assignment.value).length > 0);
}

function normalizeStationIntakeAssignment(state) {
  if (state.sopCatalogLoaded === false) return state.form?.stationAssignment ?? "";
  const current = state.form?.stationAssignment;
  const enabledAssignments = getEnabledWorkStationAssignments(state);
  const assignment = enabledAssignments.find((entry) => entry.value === current) ?? enabledAssignments[0];
  if (assignment) state.form.stationAssignment = assignment.value;
  const versions = getEnabledSopVersionsForStation(state, state.form?.stationAssignment);
  if (!versions.some((version) => version.id === state.form?.sopVersionId)) {
    state.form.sopVersionId = versions[0]?.id ?? "";
  }
  if (state.form?.disassemblySheets?.length && !getStationDisassemblyChoice(state).options.length) state.form.disassemblySheets = [];
  return state.form?.stationAssignment ?? "";
}

const DISASSEMBLY_SHEET_NOTES = {
  5: "Apertura de unidad y retirado de handles",
  6: "Retirado de Brackets central, trasero y desconexión de cable busbar",
  7: "Desconexión de cable busbar y desmontado de ventiladores",
  8: "Desmontaje de la Tarjeta BMC y desconexión de cables MCIO 1 y 2 de la tarjeta Interpose y de HMC",
  9: "Desconexión de Mangueras de Agua Caliente y fría, además del desmontaje de Manifold derecho e izquierdo",
  10: "Desconexión de Cables “2PManagement” (B2B) y “CLink MCIO” de la Bahía Izquierda y Derecha",
  11: "Desconexión de cable PCIE riser R y 1G NIC MCIO",
  12: "Desconexión de cable PCIE riser L y Cable Front Panel IO",
  13: "Desmontado de tarjeta M2, Tarjeta TPM, y Tarjeta HMC",
  14: "Desatornillado del cover de la Cx7 con ayuda del Fixture",
  15: "Desmontaje del cover CX7 y retirado de cables Ultrapass con fixture",
  16: "Desconexión de cables BF3 NCSI, PDB Sideband, OSFP Sideband L y OSFP sideband R",
  17: "Desconexión de cable Front Panel IO y 12VSTBY (J3 en PDB)",
  18: "Desconexión de cables Multi-End Power L (J4 en PDB), PDB sideband y Multi-End Power Cable, Middle (J5 en PDB)",
  19: "Desconexión de cable Multi-End Power R (J6 en PDB) y cables E1.S en las bahías Derecha, central e Izquierda",
  20: "Desconexión de sensores de humedad",
  21: "Desmontado de Inner de plástico y de ambos Inner busbar",
  22: "Desmontado de Inner con el fixture",
  23: "Instalación de bracket de cold plate y retirado de bianca de chasis",
};

function normalizeDisassemblySearch(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getDisassemblyOptions(version) {
  const procedures = (version?.procedures ?? []).filter((procedure) => Array.isArray(procedure.steps) && procedure.steps.length);
  if (procedures.length < 2) return [];
  const useNotes = String(version?.document?.id ?? "") === String(typeof BUILT_IN_SOP_VERSION === "undefined" ? "" : BUILT_IN_SOP_VERSION.document?.id ?? "");
  return procedures.map((procedure) => ({
    id: procedure.id,
    sheet: procedure.sheet,
    label: `Hoja ${procedure.sheet}`,
    description: (useNotes && DISASSEMBLY_SHEET_NOTES[procedure.sheet]) || procedure.title || "",
    steps: procedure.steps.length,
  }));
}

function getStationDisassemblyChoice(state) {
  const assignment = getWorkStationAssignment(state.form?.stationAssignment);
  if (assignment?.type !== "RWK") return { options: [], selected: [] };
  const version = findSopVersionForStation(state, assignment.value, state.form?.sopVersionId);
  const options = getDisassemblyOptions(version);
  const ids = Array.isArray(state.form?.disassemblySheets) ? state.form.disassemblySheets : [];
  return { options, selected: options.filter((option) => ids.includes(option.id)) };
}

function describeDisassemblySelection(choice) {
  if (!choice.selected.length) return "";
  if (choice.selected.length === choice.options.length) return "Desensamble completo del nodo";
  const sheets = choice.selected.map((option) => Number(option.sheet)).sort((a, b) => a - b);
  const ranges = [];
  for (const sheet of sheets) {
    const last = ranges.at(-1);
    if (last && sheet === last.to + 1) last.to = sheet;
    else ranges.push({ from: sheet, to: sheet });
  }
  return `${sheets.length === 1 ? "Hoja" : "Hojas"} ${ranges.map((range) => range.from === range.to ? range.from : `${range.from}\u2013${range.to}`).join(", ")}`;
}

function isStationIntakeReady(state) {
  const choice = getStationDisassemblyChoice(state);
  return isStationIntakeComplete(state.form)
    && Boolean(findSopVersionForStation(state, state.form.stationAssignment, state.form.sopVersionId))
    && (!choice.options.length || choice.selected.length > 0);
}

function isStationIntakeComplete(form = {}) {
  return Boolean(form.nodePartNumber?.trim()
    && form.serial?.trim()
    && form.componentPartNumber?.trim()
    && form.componentSerial?.trim());
}

function getStationIntakeStatus(state) {
  const disassemblyChoice = getStationDisassemblyChoice(state);
  const needsDisassembly = disassemblyChoice.options.length > 0 && disassemblyChoice.selected.length === 0;
  if (needsDisassembly || !isStationIntakeComplete(state.form)) {
    const form = state.form ?? {};
    const missing = [
      ...(needsDisassembly ? [["Hojas del desensamble", ""]] : []),
      ["PN del nodo", form.nodePartNumber],
      ["Serie del nodo", form.serial],
      ["PN de la tarjeta", form.componentPartNumber],
      ["Serie de la tarjeta", form.componentSerial],
    ].filter(([, value]) => !value?.trim()).map(([label]) => label);
    return `Falta capturar: ${missing.join(", ")}.`;
  }
  if (!findSopVersionForStation(state, state.form.stationAssignment, state.form.sopVersionId)) {
    const assignment = getWorkStationAssignment(state.form.stationAssignment);
    return assignment
      ? `No hay SOP habilitada para ${assignment.type} · ${assignment.label}.`
      : "No hay una SOP habilitada para esta estación.";
  }
  return "Información completa. Puedes abrir la SOP seleccionada.";
}
