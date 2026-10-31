const WORK_STATION_ASSIGNMENTS = [
  { value: "MFG:TDR", type: "MFG", typeLabel: "Manufactura", code: "TDR", label: "TDR" },
  { value: "MFG:SYS_ASSY_1", type: "MFG", typeLabel: "Manufactura", code: "SYS_ASSY_1", label: "SYS_ASSY_1" },
  { value: "MFG:SYS_ASSY_2", type: "MFG", typeLabel: "Manufactura", code: "SYS_ASSY_2", label: "SYS_ASSY_2" },
  { value: "RWK:RWK", type: "RWK", typeLabel: "Retrabajo", code: "RWK", label: "RWK" },
];

function getWorkStationAssignment(value) {
  return WORK_STATION_ASSIGNMENTS.find((assignment) => assignment.value === value) ?? null;
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
  return WORK_STATION_ASSIGNMENTS.filter((assignment) => (!type || assignment.type === type)
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
  return state.form?.stationAssignment ?? "";
}

function isStationIntakeComplete(form = {}) {
  return Boolean(form.nodePartNumber?.trim()
    && form.serial?.trim()
    && form.componentPartNumber?.trim()
    && form.componentSerial?.trim());
}

function getStationIntakeStatus(state) {
  if (!isStationIntakeComplete(state.form)) return "Completa los cuatro datos obligatorios para continuar.";
  if (!findSopVersionForStation(state, state.form.stationAssignment, state.form.sopVersionId)) {
    const assignment = getWorkStationAssignment(state.form.stationAssignment);
    return assignment
      ? `No hay SOP habilitada para ${assignment.type} · ${assignment.label}.`
      : "No hay una SOP habilitada para esta estación.";
  }
  return "Información completa. Puedes abrir la SOP seleccionada.";
}
