function snapshotStationIntake(state) {
  return !state.operatorFlowReady && !state.activeWorkId ? { ...state.form } : null;
}

function restoreStationIntake(state, snapshot) {
  if (snapshot) state.form = { ...createEmptyForm(), ...snapshot };
}

async function prepareStationSop(state) {
  const assignment = getWorkStationAssignment(state.form.stationAssignment);
  if (!assignment) return { ok: false, message: "Selecciona una estación de trabajo." };
  const disassemblyChoice = getStationDisassemblyChoice(state);
  if (disassemblyChoice.options.length && !disassemblyChoice.selected.length) return { ok: false, message: "Selecciona al menos una hoja del desensamble." };
  if (!isStationIntakeComplete(state.form)) return { ok: false, message: "Completa el PN y serie del nodo y de la tarjeta." };
  const version = findSopVersionForStation(state, assignment.value, state.form.sopVersionId);
  if (!version) {
    return {
      ok: false,
      message: `No hay una SOP habilitada para ${assignment.type} · ${assignment.label}.`,
    };
  }
  const savedForm = { ...state.form, stationAssignment: assignment.value, sopVersionId: version.id };
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
  const steps = ["Elegir estación", "Validar SOP asignada", "Confirmar y guardar"];
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
  const activeVersion = findSopVersionForStation(state, assignment?.value, state.form.sopVersionId);
  const canContinue = isStationIntakeReady(state);
  const button = form.querySelector(".station-intake-continue");
  const status = form.querySelector("#station-intake-status");
  const error = form.querySelector("#station-intake-error");
  const sopSummary = form.querySelector(".station-summary-sop");
  if (button) button.disabled = !canContinue;
  if (status) {
    const statusText = status.querySelector("span:last-child");
    const statusIcon = status.querySelector(".material-symbols-rounded");
    if (statusText) statusText.textContent = getStationIntakeStatus(state);
    if (statusIcon) statusIcon.textContent = canContinue ? "check_circle" : "info";
    status.classList.toggle("station-intake-status--ready", canContinue);
  }
  if (sopSummary) {
    const small = sopSummary.querySelectorAll("small");
    const strong = sopSummary.querySelector("strong");
    if (small[0]) small[0].textContent = `SOP seleccionada · ${assignment?.type ?? ""} · ${assignment?.label ?? ""}`;
    if (strong) strong.textContent = activeVersion?.document?.title ?? "No hay una SOP habilitada";
    if (small[1]) small[1].textContent = activeVersion
      ? `${activeVersion.document.id} · Rev. ${activeVersion.document.revision}`
      : "Administración debe asignar y habilitar una SOP.";
  }
  if (!state.formError) error?.remove();
  for (const card of form.querySelectorAll(".station-choice")) {
    const radio = card.querySelector("[data-station-type]");
    card.classList.toggle("station-choice--selected", Boolean(radio?.checked));
  }
}
