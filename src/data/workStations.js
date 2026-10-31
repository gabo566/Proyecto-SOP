const WORK_STATION_ASSIGNMENTS = [
  { value: "MFG:TDR", type: "MFG", typeLabel: "Manufactura", code: "TDR", label: "TDR" },
  { value: "RWK:RWK", type: "RWK", typeLabel: "Retrabajo", code: "RWK", label: "Retrabajo" },
];

function getWorkStationAssignment(value) {
  return WORK_STATION_ASSIGNMENTS.find((assignment) => assignment.value === value) ?? null;
}

function findSopVersionCandidateForStation(state, assignmentValue) {
  if (!assignmentValue) return null;
  const activeId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID;
  const activeVersion = state.sopVersionHistory?.find((version) => version.id === activeId) ?? BUILT_IN_SOP_VERSION;
  if (activeVersion?.document?.stationAssignment === assignmentValue) return activeVersion;

  const latestSavedVersion = [...(state.sopVersionHistory ?? [])]
    .filter((version) => version.document?.stationAssignment === assignmentValue)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
  if (latestSavedVersion) return latestSavedVersion;

  return BUILT_IN_SOP_VERSION.document?.stationAssignment === assignmentValue
    ? BUILT_IN_SOP_VERSION
    : null;
}

function findSopVersionForStation(state, assignmentValue) {
  if (!assignmentValue || state.stationAssignmentsLoaded === false) return null;
  const stationConfig = state.stationSopAssignments?.[assignmentValue];
  if (stationConfig) {
    if (!stationConfig.enabled || !stationConfig.versionId) return null;
    const version = state.sopVersionHistory?.find((item) => item.id === stationConfig.versionId)
      ?? (BUILT_IN_SOP_VERSION.id === stationConfig.versionId ? BUILT_IN_SOP_VERSION : null);
    return version?.document?.stationAssignment === assignmentValue ? version : null;
  }
  return findSopVersionCandidateForStation(state, assignmentValue);
}

function getEnabledWorkStationAssignments(state) {
  return WORK_STATION_ASSIGNMENTS.filter((assignment) => Boolean(findSopVersionForStation(state, assignment.value)));
}

function normalizeStationIntakeAssignment(state) {
  const current = state.form?.stationAssignment;
  if (findSopVersionForStation(state, current)) return current;
  const fallback = getEnabledWorkStationAssignments(state)[0];
  if (fallback) state.form.stationAssignment = fallback.value;
  return state.form?.stationAssignment ?? "";
}

function isStationIntakeComplete(form = {}) {
  return Boolean(form.nodePartNumber?.trim()
    && form.serial?.trim()
    && form.componentPartNumber?.trim()
    && form.componentSerial?.trim());
}
function getStationIntakeStatus(state) {
  const assignment = getWorkStationAssignment(state.form.stationAssignment);
  const stationConfig = state.stationSopAssignments?.[assignment?.value];
  if (stationConfig && !stationConfig.enabled) return `La estación ${assignment?.type} · ${assignment?.label} está deshabilitada por Administración.`;
  if (!isStationIntakeComplete(state.form)) return "Completa los cuatro datos obligatorios para continuar.";
  if (!findSopVersionForStation(state, state.form.stationAssignment)) return "No hay una revisión de SOP asignada a esta estación.";
  return "Información completa. Puedes abrir la SOP correspondiente.";
}
