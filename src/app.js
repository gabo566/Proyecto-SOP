const STORAGE_KEY = "sop-operador-validation-demo-records-v1";
const app = document.querySelector("#app");
const storedWorkItems = readWorkItems();
const activeDemoUser = getActiveLocalUser();
const restorableWork = storedWorkItems
  .filter((item) => ["En proceso", "Retrabajo en proceso"].includes(item.status))
  .sort((a, b) => b.updatedAt - a.updatedAt)[0];
const state = {
  selectedId: restorableWork?.procedureId ?? PROCEDURES[0].id,
  operatorFlowReady: false,
  sopPageZoom: 100,
  sopRunContextOpen: false,
  completedSteps: restorableWork?.completedSteps ?? [],
  sopRun: restorableWork?.sopRun ?? null,
  savedRecords: readSavedRecords(),
  workItems: storedWorkItems,
  activeWorkId: restorableWork?.id ?? "",
  workDialogOpen: false,
  validationDialogOpen: false,
  workDraft: { type: "pause", failedStep: "", note: "" },
  validationEvidenceFiles: [],
  workError: "",
  evidenceError: "",
  evidenceBusy: false,
  evidenceReviewDialogOpen: false,
  reviewItem: null,
  reviewSubmission: null,
  reviewEvidence: [],
  reviewReadOnly: false,
  evidenceManageMode: false,
  reviewObservation: "",
  evidenceImageDialogOpen: false,
  zoomedEvidence: null,
  reviewError: "",
  reviewNote: "",
  recordsDialogOpen: false,
  helpDialogOpen: false,
  activeSection: "overview",
  includeDemoData: false,
  reportFilters: { dateFrom: "", dateTo: "", shift: "all", category: "all", employeeNumber: "all" },
  reportPage: 1,
  traceabilityFilters: { query: "", dateFrom: "", dateTo: "", shift: "all", category: "all", employeeNumber: "all" },
  traceabilityPage: 1,
  sopPdfUrl: "",
  sopPdfName: "",
  sopPdfUpdatedAt: "",
  sopPdfUpdating: false,
  sopVersionMeta: { id: BUILT_IN_SOP_VERSION_ID, revision: SOP_DOCUMENT.revision, builtIn: true },
  sopVersionHistory: [],
  sopDraft: null,
  sopDraftError: "",
  sopVersionBusy: false,
  navOpen: false,
  loginError: "",
  loginUsername: "",
  toast: null,
  serialQuery: "",
  recordsQuery: "",
  form: {
    ...createEmptyForm(),
    ...(restorableWork?.form ?? {}),
    name: restorableWork?.form?.name ?? activeDemoUser.name,
    employeeNumber: restorableWork?.form?.employeeNumber ?? activeDemoUser.employeeNumber,
    position: restorableWork?.form?.position ?? activeDemoUser.position ?? "Técnico de FA",
  },
  auditSessionId: localStorage.getItem("sop-operador-audit-session-v1") || `session-${crypto.randomUUID()}`,
  formError: "",
  dialogTriggerFocusKey: "",
};

let toastTimeout = 0;

function readSavedRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSavedRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function getRecords() {
  return [...state.savedRecords, ...DEMO_RECORDS];
}

function getProcedure() {
  const guidedProcedure = state.sopRun && getGuidedSopProcedure(state.sopRun, PROCEDURES);
  return guidedProcedure ?? SOP_SHEETS.find((item) => item.id === state.selectedId) ?? SOP_SHEETS[0];
}

function ensureGuidedSopRun() {
  if (!state.operatorFlowReady) return;
  if (!state.sopRun) {
    const user = getActiveLocalUser();
    const existingForm = { ...state.form };
    state.sopRun = createGuidedSopRun(PROCEDURES, SOP_DOCUMENT, state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID, user);
    state.selectedId = state.sopRun.procedureIds[0];
    state.completedSteps = getGuidedSopCheckedSteps(state.sopRun, state.selectedId);
    if (!state.activeWorkId) {
      state.form = { ...createEmptyForm(), ...existingForm, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", nodePartNumber: existingForm.nodePartNumber || SOP_DOCUMENT.nodePartNumber || "" };
    }
  }
  const currentProcedure = getGuidedSopProcedure(state.sopRun, PROCEDURES);
  if (currentProcedure) {
    state.selectedId = currentProcedure.id;
    state.completedSteps = getGuidedSopCheckedSteps(state.sopRun, currentProcedure.id);
  }
}

function canOperateGuidedSopRun() {
  const owner = state.sopRun?.startedBy?.employeeNumber;
  return state.sopRun?.versionId === (state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID)
    && (!owner || owner === getActiveLocalUser().employeeNumber);
}

function restoreOperatorFlowForSession() {
  const user = getAuthenticatedLocalUser();
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  if (!user || !activeWork) return;
  if (activeWork.form?.employeeNumber !== user.employeeNumber) {
    state.activeWorkId = "";
    state.completedSteps = [];
    state.sopRun = null;
    state.form = { ...createEmptyForm(), name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA" };
    state.operatorFlowReady = false;
    return;
  }
  state.form = { ...createEmptyForm(), ...activeWork.form };
  state.operatorFlowReady = isStationIntakeComplete(state.form)
    && Boolean(findSopVersionForStation(state, state.form.stationAssignment));
}

function render({ focusKey, focusDialog = false, initial = false } = {}) {
  if (!getAuthenticatedLocalUser()) {
    app.innerHTML = renderLoginView({ error: state.loginError, username: state.loginUsername });
    document.querySelector(state.loginError ? "#login-password" : "#login-username")?.focus();
    return;
  }
  if (!state.operatorFlowReady && !(state.activeSection === "sop-admin" && canManageSopVersions())) {
    app.innerHTML = renderStationIntake(state);
    return;
  }
  ensureGuidedSopRun();
  if (state.activeSection === "sop-admin" && !canManageSopVersions()) state.activeSection = "overview";
  const previousFocus = focusKey === undefined ? getFocusState() : { key: focusKey, start: null, end: null };
  const allRecords = getRecords();
  const records = filterDemoRecords(allRecords, state.activeSection === "traceability" && state.includeDemoData);
  const operationalRecords = filterDemoRecords(allRecords, false);
  const todayKey = getLocalDateKey();
  const todayRecords = operationalRecords.filter((record) => record.date === todayKey);
  const dashboard = state.activeSection === "overview"
    ? `<div class="production-layout production-layout--sheet" id="production">${renderProcedurePanel(getProcedure(), state)}</div>`
    : state.activeSection === "production"
    ? renderProductionView(todayRecords, state)
    : state.activeSection === "traceability"
    ? renderTraceabilityView(records, state.workItems, state)
    : state.activeSection === "reports"
    ? renderReportsView(allRecords, state, state.workItems)
    : state.activeSection === "users"
    ? renderLocalUsersPanel()
    : state.activeSection === "sop-admin"
    ? renderSopVersionManager(state)
    : renderSummaryMetrics(todayRecords, state);
  app.innerHTML = `${renderSidebar(state)}<main class="main-area" id="main-content">
    ${renderTopbar(state)}<div class="dashboard-content">${dashboard}${renderFooter()}</div></main>
    ${renderOperatorValidationDialog(getProcedure(), state)}${renderRecordsDialog(records, state.recordsQuery, state.workItems)}${renderWorkItemDialog(state)}${renderEvidenceReviewDialog(state)}${renderEvidenceImageDialog(state)}${renderStepImageDialog()}${renderHelpDialog()}
    ${renderToast()}`;

  renderSopPagePreview();

  const recordsDialog = document.querySelector("#records-dialog");
  recordsDialog.addEventListener("close", () => handleNativeDialogClose("recordsDialogOpen"));
  const validationDialog = document.querySelector("#validation-dialog");
  validationDialog.addEventListener("close", () => handleNativeDialogClose("validationDialogOpen"));
  const workDialog = document.querySelector("#work-item-dialog");
  workDialog.addEventListener("close", () => handleNativeDialogClose("workDialogOpen"));
  const evidenceReviewDialog = document.querySelector("#evidence-review-dialog");
  evidenceReviewDialog.addEventListener("close", workflow.handleReviewDialogClose);
  const evidenceImageDialog = document.querySelector("#evidence-image-dialog");
  evidenceImageDialog.addEventListener("close", () => {
    state.evidenceImageDialogOpen = false;
    state.zoomedEvidence = null;
  });
  const helpDialog = document.querySelector("#help-dialog");
  helpDialog.addEventListener("close", () => handleNativeDialogClose("helpDialogOpen"));

  if (state.recordsDialogOpen) recordsDialog.showModal();
  if (state.validationDialogOpen) validationDialog.showModal();
  if (state.workDialogOpen) workDialog.showModal();
  if (state.evidenceReviewDialogOpen) evidenceReviewDialog.showModal();
  if (state.evidenceImageDialogOpen) evidenceImageDialog.showModal();
  if (state.helpDialogOpen) helpDialog.showModal();
  restoreFocus(previousFocus, { focusDialog, initial }, state);
  const reportRecords = state.activeSection === "reports"
    ? getReportRecords(allRecords, state.reportFilters, state.includeDemoData)
    : todayRecords;
  drawCompletionChart(document.querySelector("#completion-chart"), reportRecords);
  if (!localStorage.getItem("sop-operador-audit-session-v1")) localStorage.setItem("sop-operador-audit-session-v1", state.auditSessionId);
}

async function handleStationIntakeSubmit() {
  const result = await prepareStationSop(state);
  if (!result.ok) {
    state.formError = result.message;
    render();
    const firstMissing = !state.form.nodePartNumber?.trim() ? "intake-node-part"
      : !state.form.serial?.trim() ? "intake-node-serial"
        : !state.form.componentPartNumber?.trim() ? "intake-card-part"
          : !state.form.componentSerial?.trim() ? "intake-card-serial" : "station-MFG";
    document.querySelector(`[data-focus-key="${firstMissing}"]`)?.focus();
    return;
  }
  ensureGuidedSopRun();
  if (!workflow.persistProgress()) {
    state.operatorFlowReady = false;
    state.formError = "No se pudieron guardar los datos de inicio en este navegador. Verifica el almacenamiento y vuelve a intentar.";
    render();
    return;
  }
  render({ focusKey: `step-${getProcedure()?.steps?.[0]?.number ?? ""}` });
}

function renderToast() {
  if (!state.toast) return "";
  const icon = state.toast.kind === "warning" ? "warning" : "check_circle";
  return `<div class="toast toast--${state.toast.kind}" role="status"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span>
    ${escapeHtml(state.toast.message)}<button type="button" data-action="close-toast" aria-label="Cerrar aviso"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>`;
}

function handleNativeDialogClose(stateKey) {
  if (!state[stateKey]) return;
  state[stateKey] = false;
  render({ focusKey: state.dialogTriggerFocusKey });
  state.dialogTriggerFocusKey = "";
}

function showToast(message, kind = "success") {
  state.toast = { message, kind };
  window.clearTimeout(toastTimeout);
  render();
  toastTimeout = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 4200);
}

function selectProcedure(id) {
  if (state.sopRun) {
    showToast("Termina o reanuda la validación guiada activa antes de cambiar de hoja.", "warning");
    return;
  }
  if (state.activeWorkId && id !== state.selectedId) {
    showToast("Guarda o finaliza el trabajo activo antes de cambiar de procedimiento.", "warning");
    return;
  }
  state.selectedId = id;
  state.completedSteps = [];
  state.formError = "";
  render();
  document.querySelector("#production")?.scrollIntoView({ block: "start" });
}

const workflow = createWorkItemWorkflow(state, { getProcedure, createEmptyForm, render, showToast, persistSavedRecords });

function moveProcedure(direction) {
  const currentIndex = SOP_SHEETS.findIndex((item) => item.id === getProcedure().id);
  const nextIndex = (currentIndex + direction + SOP_SHEETS.length) % SOP_SHEETS.length;
  selectProcedure(SOP_SHEETS[nextIndex].id);
}

function openRecords(triggerKey) {
  state.recordsQuery = "";
  state.recordsDialogOpen = true;
  state.dialogTriggerFocusKey = triggerKey;
  render({ focusDialog: true });
}

function continueGuidedSopSheet() {
  if (!canOperateGuidedSopRun()) {
    showToast("Solo la persona que inició este recorrido puede continuar y conservar la autoría del registro.", "warning");
    return;
  }
  const procedure = getProcedure();
  const uncheckedStep = procedure.steps.find((step) => !getGuidedSopCheckedSteps(state.sopRun, procedure.id).includes(String(step.number)));
  if (uncheckedStep || !isGuidedSopProcedureComplete(state.sopRun, procedure)) {
    state.formError = `Marca el paso ${uncheckedStep?.number ?? "actual"} antes de continuar.`;
    render();
    document.querySelector(`[data-step="${CSS.escape(String(uncheckedStep?.number ?? ""))}"]`)?.focus();
    return;
  }
  if (state.sopRun.currentIndex === state.sopRun.procedureIds.length - 1) {
    const missingNodeField = !state.form.serial.trim()
      ? document.querySelector('[data-form-field="serial"]')
      : null;
    if (missingNodeField) {
      state.formError = "Captura el número de serie del nodo para preparar la confirmación final.";
      state.sopRunContextOpen = true;
      render({ focusKey: `form-${missingNodeField.name}` });
      return;
    }
  }
  if (state.sopRun.stage === "confirmation") {
    state.validationDialogOpen = true;
    render({ focusDialog: true });
    return;
  }
  if (!advanceGuidedSopRun(state.sopRun, PROCEDURES)) return;
  state.formError = "";
  state.form.declaration = false;
  if (state.sopRun.stage === "steps") {
    const nextProcedure = getGuidedSopProcedure(state.sopRun, PROCEDURES);
    state.selectedId = nextProcedure.id;
    state.completedSteps = getGuidedSopCheckedSteps(state.sopRun, nextProcedure.id);
    state.dialogTriggerFocusKey = `step-${nextProcedure.steps[0].number}`;
  } else {
    state.dialogTriggerFocusKey = "guided-confirmation-heading";
    state.validationDialogOpen = true;
  }
  workflow.persistProgress();
  render({ focusKey: state.dialogTriggerFocusKey, focusDialog: state.validationDialogOpen });
}

function previousGuidedSopSheet() {
  if (!canOperateGuidedSopRun()) return;
  state.validationDialogOpen = false;
  document.querySelector("#validation-dialog")?.close();
  if (!returnGuidedSopRunToSteps(state.sopRun)) return;
  const previousProcedure = getGuidedSopProcedure(state.sopRun, PROCEDURES);
  state.selectedId = previousProcedure.id;
  state.completedSteps = getGuidedSopCheckedSteps(state.sopRun, previousProcedure.id);
  state.form.declaration = false;
  state.formError = "";
  state.dialogTriggerFocusKey = `step-${previousProcedure.steps.at(-1).number}`;
  workflow.persistProgress();
  render({ focusKey: state.dialogTriggerFocusKey });
}

function closeDialog(stateKey) {
  state[stateKey] = false;
  const dialog = document.getElementById("records-dialog");
  if (dialog?.open) dialog.close();
  render({ focusKey: state.dialogTriggerFocusKey });
  state.dialogTriggerFocusKey = "";
}

function handleCompletionSubmit(event) {
  event.preventDefault();
  const procedure = getProcedure();
  if (!state.sopRun || state.sopRun.stage !== "confirmation" || !isGuidedSopRunComplete(state.sopRun, PROCEDURES)) {
    const uncheckedProcedure = state.sopRun?.procedureIds.map((id) => PROCEDURES.find((item) => item.id === id)).find((item) => !isGuidedSopProcedureComplete(state.sopRun, item));
    const uncheckedStep = uncheckedProcedure?.steps.find((step) => !getGuidedSopCheckedSteps(state.sopRun, uncheckedProcedure.id).includes(String(step.number)));
    showFormError("Completa y confirma todos los pasos de la SOP antes de finalizar.", uncheckedStep ? document.querySelector(`[data-step="${CSS.escape(String(uncheckedStep.number))}"]`) : null);
    return;
  }
  const formElement = event.currentTarget;
  if (!state.form.serial?.trim()) {
    showFormError("Captura el número de serie del nodo.", formElement.querySelector('[name="serial"]'));
    return;
  }
  const incompleteField = formElement.querySelector(".validation-field input[required]:invalid");
  if (incompleteField) {
    const fieldLabel = incompleteField.closest(".validation-field")?.firstChild?.textContent.trim() || "obligatorio";
    showFormError(`Completa el campo ${fieldLabel} para registrar el desensamble.`, incompleteField);
    return;
  }
  if (!state.form.declaration) {
    showFormError("Confirma la declaración del operador para continuar.", formElement.querySelector('[name="declaration"]'));
    return;
  }
  if (workflow.requiresEvidence() && !workflow.hasEvidence()) {
    state.evidenceError = "Adjunta al menos una foto del retrabajo antes de enviarlo a revisión.";
    document.querySelector("[data-evidence-input]")?.focus();
    return;
  }
  saveCompletion();
}

function showFormError(message, target = null) {
  state.formError = message;
  const error = document.querySelector("#completion-form-error");
  error.textContent = message;
  error.hidden = false;
  const fallbackTarget = document.querySelector('[name="declaration"]');
  const invalidTarget = target ?? fallbackTarget;
  invalidTarget?.setAttribute("aria-invalid", "true");
  invalidTarget?.setAttribute("aria-describedby", "completion-form-error");
  invalidTarget?.focus();
}

function saveCompletion() {
  const procedure = getProcedure();
  const run = state.sopRun;
  const runProcedures = run.procedureIds.map((id) => PROCEDURES.find((item) => item.id === id)).filter(Boolean);
  const allSteps = runProcedures.flatMap((item) => item.steps.map((step) => ({
    procedureId: item.id,
    category: item.category,
    procedureTitle: item.title,
    sheet: item.sheet,
    number: String(step.number),
    text: step.text,
    completed: getGuidedSopCheckedSteps(run, item.id).includes(String(step.number)),
  })));
  const firstProcedure = runProcedures[0] ?? procedure;
  const lastProcedure = runProcedures.at(-1) ?? procedure;
  const user = getActiveLocalUser();
  const now = new Date();
  const time = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const record = {
    id: `local-${now.getTime()}`,
    category: run.document.title || procedure.category,
    procedureId: firstProcedure.id,
    procedureTitle: run.document.title,
    sopDocumentId: run.document.id,
    sopVersionId: run.versionId,
    sopRevision: run.document.revision,
    operation: run.document.title,
    sheet: `${firstProcedure.sheet}–${lastProcedure.sheet}`,
    stepRange: allSteps.length ? `${allSteps[0].number}–${allSteps.at(-1).number}` : "",
    validatedSheets: runProcedures.map((item) => ({ id: item.id, sheet: item.sheet, pdfPage: item.pdfPage ?? item.sheet, category: item.category, title: item.title, stepRange: item.stepRange, steps: item.steps.map((step) => ({ number: String(step.number), text: step.text })) })),
    validatedSteps: allSteps,
    validatedStepCount: allSteps.length,
    declarationText: `Confirmo que el procedimiento ${run.document.title}, revisión ${run.document.revision}, para el nodo con P/N ${state.form.nodePartNumber.trim()} y serie ${state.form.serial.trim()}, se realizó de acuerdo con los procedimientos establecidos por la empresa. Reportaré cualquier daño o desviación para recibir la retroalimentación correspondiente.`,
    declaredAt: now.toISOString(),
    nodeNumber: state.form.nodeNumber?.trim() ?? "",
    serial: state.form.serial.trim(),
    nodePartNumber: state.form.nodePartNumber.trim(),
    componentPartNumber: state.form.componentPartNumber.trim(),
    componentSerial: state.form.componentSerial.trim(),
    operator: user.name,
    employeeNumber: user.employeeNumber,
    actor: { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", role: user.role },
    sessionId: state.auditSessionId,
    auditEventIds: readLocalAuditTrail().filter((event) => event.sessionId === state.auditSessionId && run.procedureIds.includes(event.procedureId)).map((event) => event.id),
    position: user.position || "Técnico de FA",
    repairType: state.form.repairType,
    stationAssignment: state.form.stationAssignment,
    source: "local",
    date: getLocalDateKey(now),
    displayDate: getLocalDateLabel(now),
    time,
    shift: getShiftForTime(time),
    status: "Completado",
    recordType: "Validación del operador",
    declared: true,
    evidenceFiles: [...state.validationEvidenceFiles],
    evidenceCount: state.validationEvidenceFiles.length,
  };
  workflow.prepareCompletionRecord(record);
  const next = [record, ...state.savedRecords];
  if (!persistSavedRecords(next)) {
    showToast("No se pudo guardar en el almacenamiento local.", "warning");
    return;
  }
  state.savedRecords = next;
  const auditEvent = recordLocalAuditEvent("validation_submitted", {
    serial: record.serial,
    nodeNumber: record.nodeNumber,
    procedureId: firstProcedure.id,
    procedureTitle: run.document.title,
    sheet: record.sheet,
    sopVersionId: record.sopVersionId,
    sopRevision: record.sopRevision,
    validatedSheets: run.procedureIds.length,
    validatedSteps: allSteps.length,
    sessionId: state.auditSessionId,
  });
  if (auditEvent) {
    record.auditEventIds = [...record.auditEventIds, auditEvent.id];
    persistSavedRecords(next);
  }
  const completion = state.activeWorkId
    ? workflow.completeActiveWork(record.id, user.name)
    : { saved: true, needsReview: false };
  state.completedSteps = [];
  state.sopRun = null;
  state.sopRunContextOpen = false;
  state.operatorFlowReady = false;
  state.validationDialogOpen = false;
  document.querySelector("#validation-dialog")?.close();
  state.form = createEmptyForm();
  state.validationEvidenceFiles = [];
  state.auditSessionId = `session-${crypto.randomUUID()}`;
  localStorage.setItem("sop-operador-audit-session-v1", state.auditSessionId);
  state.formError = "";
  const successMessage = completion.needsReview
    ? "Retrabajo enviado; queda pendiente de aprobación del supervisor."
    : "Declaración y datos guardados en este navegador.";
  showToast(completion.saved ? successMessage : "Validación guardada; no se pudo actualizar el historial del trabajo.", completion.saved ? "success" : "warning");
}

bindInteractions(app, {
  state,
  navItems: NAV_ITEMS,
  getRecords: () => filterDemoRecords(getRecords(), state.activeSection === "traceability" && state.includeDemoData),
  getProcedure,
  render,
  showToast,
  selectProcedure,
  moveProcedure,
  openRecords,
  closeDialog,
  handleCompletionSubmit,
  continueGuidedSopSheet,
  continueStationIntake: handleStationIntakeSubmit,
  previousGuidedSopSheet,
  openWorkItemDialog: workflow.openDialog,
  closeWorkItemDialog: workflow.closeDialog,
  handleWorkItemSubmit: workflow.submit,
  resumeWorkItem: workflow.resume,
  persistWorkState: workflow.persistProgress,
  authenticateLocalUser,
  endLocalUserSession: () => {
    if (state.evidenceBusy) {
      showToast("Espera a que termine el guardado de evidencia antes de cerrar sesión.", "warning");
      return;
    }
    endLocalUserSession();
    state.loginError = "";
    state.loginUsername = "";
    state.activeSection = "overview";
    state.formError = "";
    if (!state.activeWorkId) {
      state.form = createEmptyForm();
      state.sopRun = null;
      state.operatorFlowReady = false;
    }
    state.validationEvidenceFiles = [];
    state.workDialogOpen = false;
    state.recordsDialogOpen = false;
    state.helpDialogOpen = false;
    state.evidenceReviewDialogOpen = false;
    state.evidenceImageDialogOpen = false;
    state.zoomedEvidence = null;
    render();
  },
  createLocalUser: (formData) => {
    const result = addLocalUser({
      name: String(formData.get("userName") ?? ""),
      employeeNumber: String(formData.get("employeeNumber") ?? ""),
      position: String(formData.get("userPosition") ?? ""),
      email: "",
      role: String(formData.get("userRole") ?? ""),
      password: String(formData.get("userPassword") ?? ""),
    });
    if (result === "ok") showToast("Usuario agregado a esta demostración.", "warning");
    else showToast(result === "employee" ? "Ese número de empleado ya está registrado." : result === "password" ? "La contraseña debe tener al menos 4 caracteres." : "No se pudo crear el perfil.", "warning");
    render();
  },
  changeLocalUserPassword: (formData) => {
    const result = changeLocalUserPassword(
      String(formData.get("passwordUserId") ?? ""),
      String(formData.get("newPassword") ?? ""),
    );
    if (result === "ok") showToast("Contraseña actualizada en este navegador.", "success");
    else showToast(result === "password" ? "La contraseña debe tener al menos 4 caracteres." : "No se pudo cambiar la contraseña.", "warning");
    render();
  },
  toggleLocalUser: (id, active) => {
    const result = setLocalUserActive(id, active);
    showToast(result === "ok" ? `Acceso ${active ? "reactivado" : "desactivado"}.` : result === "last-admin" ? "Debe quedar al menos un administrador activo." : result === "active-user" ? "No puedes desactivar la cuenta con la que tienes la sesión abierta." : result === "forbidden" ? "Solo un administrador puede cambiar el acceso de los usuarios." : "No se encontró esa cuenta.", "warning");
    render();
  },
  addEvidence: workflow.addEvidence,
  removeEvidence: workflow.removeEvidence,
  openEvidenceReview: workflow.openEvidenceReview,
  closeEvidenceReview: workflow.closeEvidenceReview,
  decideEvidenceReview: workflow.decideEvidenceReview,
  addEvidenceToRecord: workflow.addEvidenceToRecord,
  addValidationEvidence: workflow.addValidationEvidence,
  removeValidationEvidence: workflow.removeValidationEvidence,
  addDraftEvidence: workflow.addDraftEvidence,
  removeDraftEvidence: workflow.removeDraftEvidence,
  openRecordEvidence: workflow.openRecordEvidence,
});

bindReportInteractions(app, {
  state,
  getAllRecords: getRecords,
  render,
  showToast,
});

bindSopVersionInteractions(app, { state, render, showToast });

startCurrentShiftClock();
render({ initial: true });
restoreCurrentSopVersion(state).then(async () => {
  if (state.sopVersionMeta?.builtIn) {
    await restoreStoredSopSource(state);
  }
  restoreOperatorFlowForSession();
  render();
}).catch((error) => {
  console.error("No se pudo restaurar la versión local de la SOP.", error);
});
