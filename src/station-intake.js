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

function snapshotStationIntake(state) {
  return !state.operatorFlowReady && !state.activeWorkId ? { ...state.form } : null;
}

function restoreStationIntake(state, snapshot) {
  if (snapshot) state.form = { ...createEmptyForm(), ...snapshot };
}

async function prepareStationSop(state) {
  const assignment = getWorkStationAssignment(state.form.stationAssignment);
  if (!assignment) return { ok: false, message: "Selecciona una estación de trabajo." };
  if (!isStationIntakeComplete(state.form)) return { ok: false, message: "Completa el PN y serie del nodo y de la tarjeta." };
  const version = findSopVersionForStation(state, assignment.value);
  if (!version) {
    return {
      ok: false,
      message: assignment.value === "MFG:TDR"
        ? "La SOP TDR todavía no está cargada. Cuando Administración la cargue y asigne a MFG · TDR, podrás continuar."
        : "No hay una SOP asignada a esta estación.",
    };
  }

  const savedForm = { ...state.form, stationAssignment: assignment.value };
  const currentVersionId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID;
  if (version.id !== currentVersionId) {
    const previousVersionId = currentVersionId;
    const pausedWork = pauseIncompatibleSopWork(state, version.id);
    if (!pausedWork.saved) return { ok: false, message: "No se pudieron guardar los trabajos detenidos; la SOP activa no cambió." };
    try {
      await setActiveSopVersionId(version.id);
      if (version.id === BUILT_IN_SOP_VERSION_ID) applyBuiltInSopVersion(state);
      else applySopVersion(version, state);
    } catch (error) {
      pausedWork.rollback();
      await setActiveSopVersionId(previousVersionId).catch(() => {});
      return { ok: false, message: error?.message || "No se pudo activar la SOP asignada a la estación." };
    }
  }

  const user = getActiveLocalUser();
  state.form = { ...createEmptyForm(), ...savedForm, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA" };
  state.operatorFlowReady = true;
  state.activeSection = "overview";
  if (!state.activeWorkId) {
    state.sopRun = null;
    state.completedSteps = [];
  }
  state.formError = "";
  return { ok: true };
}

function renderOperatorFlowProgress(activeStep) {
  const steps = ["Registrar validación", "Cargar SOP", "Confirmar y guardar"];
  return `<nav class="operator-flow-progress" aria-label="Progreso del registro">${steps.map((label, index) => {
    const number = index + 1;
    const status = number < activeStep ? "operator-flow-step--complete" : number === activeStep ? "operator-flow-step--active" : "";
    return `${index ? "<i aria-hidden=\"true\"></i>" : ""}<div class="operator-flow-step ${status}" ${number === activeStep ? 'aria-current="step"' : ""}><span>${number < activeStep ? '<span class="material-symbols-rounded" aria-hidden="true">check</span>' : number}</span><strong>${label}</strong></div>`;
  }).join("")}</nav>`;
}

function updateStationIntakeUI(state) {
  const form = document.querySelector("#station-intake-form");
  if (!form) return;
  const assignment = getWorkStationAssignment(state.form.stationAssignment);
  const activeVersion = findSopVersionForStation(state, assignment?.value);
  const canContinue = isStationIntakeComplete(state.form) && Boolean(activeVersion);
  const button = form.querySelector(".station-intake-continue");
  const status = form.querySelector("#station-intake-status");
  const error = form.querySelector("#station-intake-error");
  const sopName = form.querySelector(".station-summary-sop strong");
  const sopRevision = form.querySelector(".station-summary-sop small:last-child");
  const stationName = form.querySelector(".station-summary-location strong");
  if (button) button.disabled = !canContinue;
  if (status) {
    status.textContent = getStationIntakeStatus(state);
    status.classList.toggle("station-intake-status--ready", canContinue);
  }
  if (sopName) sopName.textContent = activeVersion?.document?.title ?? "SOP TDR";
  if (sopRevision) sopRevision.textContent = activeVersion ? `Rev. ${activeVersion.document.revision}` : "Pendiente de cargar";
  if (stationName && assignment) stationName.textContent = `${assignment.type} · ${assignment.label}`;
  if (!state.formError) error?.remove();
  for (const card of form.querySelectorAll(".station-choice")) {
    const radio = card.querySelector("[data-station-type]");
    card.classList.toggle("station-choice--selected", Boolean(radio?.checked));
  }
}
