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
  if (state.form?.disassemblyType && !getStationDisassemblyChoice(state).selected) state.form.disassemblyType = "";
  return state.form?.stationAssignment ?? "";
}

const DISASSEMBLY_FULL_ID = "__full__";

function getDisassemblyOptions(version) {
  const procedures = (version?.procedures ?? []).filter((procedure) => Array.isArray(procedure.steps) && procedure.steps.length);
  const categories = [...new Set(procedures.map((procedure) => String(procedure.category ?? "").trim()).filter(Boolean))];
  if (categories.length < 2) return [];
  const summarize = (list) => ({ procedureIds: list.map((procedure) => procedure.id), sheets: list.length, steps: list.reduce((total, procedure) => total + procedure.steps.length, 0) });
  return [
    { id: DISASSEMBLY_FULL_ID, label: "Desensamble completo del nodo", ...summarize(procedures) },
    ...categories.map((category) => ({ id: `cat:${category}`, label: category, ...summarize(procedures.filter((procedure) => procedure.category === category)) })),
  ];
}

function getStationDisassemblyChoice(state) {
  const assignment = getWorkStationAssignment(state.form?.stationAssignment);
  if (assignment?.type !== "RWK") return { options: [], selected: null };
  const version = findSopVersionForStation(state, assignment.value, state.form?.sopVersionId);
  const options = getDisassemblyOptions(version);
  return { options, selected: options.find((option) => option.id === state.form?.disassemblyType) ?? null };
}

function isStationIntakeReady(state) {
  const choice = getStationDisassemblyChoice(state);
  return isStationIntakeComplete(state.form)
    && Boolean(findSopVersionForStation(state, state.form.stationAssignment, state.form.sopVersionId))
    && (!choice.options.length || Boolean(choice.selected));
}

function isStationIntakeComplete(form = {}) {
  return Boolean(form.nodePartNumber?.trim()
    && form.serial?.trim()
    && form.componentPartNumber?.trim()
    && form.componentSerial?.trim());
}

function getStationIntakeStatus(state) {
  const disassemblyChoice = getStationDisassemblyChoice(state);
  const needsDisassembly = disassemblyChoice.options.length > 0 && !disassemblyChoice.selected;
  if (needsDisassembly || !isStationIntakeComplete(state.form)) {
    const form = state.form ?? {};
    const missing = [
      ...(needsDisassembly ? [["Tipo de desensamble", ""]] : []),
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
