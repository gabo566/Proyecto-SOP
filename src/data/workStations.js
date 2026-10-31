const WORK_STATION_ASSIGNMENTS = [
  { value: "MFG:TDR", type: "MFG", typeLabel: "Manufactura", code: "TDR", label: "TDR" },
  { value: "RWK:RWK", type: "RWK", typeLabel: "Retrabajo", code: "RWK", label: "Retrabajo" },
];

function getWorkStationAssignment(value) {
  return WORK_STATION_ASSIGNMENTS.find((assignment) => assignment.value === value) ?? null;
}

function findSopVersionForStation(state, assignmentValue) {
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

function isStationIntakeComplete(form = {}) {
  return Boolean(form.nodePartNumber?.trim()
    && form.serial?.trim()
    && form.componentPartNumber?.trim()
    && form.componentSerial?.trim());
}
function getStationIntakeStatus(state) {
  if (!isStationIntakeComplete(state.form)) return "Completa los cuatro datos obligatorios para continuar.";
  if (!findSopVersionForStation(state, state.form.stationAssignment)) {
    const assignment = getWorkStationAssignment(state.form.stationAssignment);
    return assignment?.value === "MFG:TDR"
      ? "La SOP TDR está pendiente de cargar y asignar por Administración."
      : "No hay una SOP asignada a esta estación.";
  }
  return "Información completa. Puedes abrir la SOP correspondiente.";
}
