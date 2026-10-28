const STORAGE_KEY = "sop-operador-validation-demo-records-v1";
const app = document.querySelector("#app");
const storedWorkItems = readWorkItems();
const activeDemoUser = getActiveLocalUser();
const restorableWork = storedWorkItems
  .filter((item) => ["En proceso", "Retrabajo en proceso"].includes(item.status))
  .sort((a, b) => b.updatedAt - a.updatedAt)[0];
const state = {
  selectedId: restorableWork?.procedureId ?? PROCEDURES[0].id,
  sopPageZoom: 100,
  completedSteps: restorableWork?.completedSteps ?? [],
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
  activeSection: "overview",
  navOpen: false,
  loginError: "",
  loginUsername: "",
  toast: null,
  serialQuery: "",
  recordsQuery: "",
  form: { ...createEmptyForm(), ...(restorableWork?.form ?? {}), name: activeDemoUser.name, employeeNumber: activeDemoUser.employeeNumber, position: activeDemoUser.position || "Técnico de FA" },
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
  return SOP_SHEETS.find((item) => item.id === state.selectedId) ?? SOP_SHEETS[0];
}

function getFocusState() {
  const active = document.activeElement;
  return {
    key: active?.dataset?.focusKey ?? "",
    start: typeof active?.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active?.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function render({ focusKey, focusDialog = false, initial = false } = {}) {
  if (!getAuthenticatedLocalUser()) {
    app.innerHTML = renderLoginView({ error: state.loginError, username: state.loginUsername });
    document.querySelector(state.loginError ? "#login-password" : "#login-username")?.focus();
    return;
  }
  const previousFocus = focusKey === undefined ? getFocusState() : { key: focusKey, start: null, end: null };
  const records = getRecords();
  const todayRecords = records.filter((record) => record.date === TODAY_DATE_KEY);
  const dashboard = state.activeSection === "traceability"
    ? renderActivityPanel(todayRecords)
    : state.activeSection === "reports"
    ? `${renderWorkItemsPanel(state.workItems, state.activeWorkId)}${renderSerialTable(records, state.serialQuery, state.workItems)}`
    : state.activeSection === "users"
    ? renderLocalUsersPanel()
    : `${renderSummaryMetrics(todayRecords, state)}
      <div class="production-layout production-layout--sheet" id="production">
        ${renderProcedurePanel(getProcedure(), state)}
      </div>
      ${renderWorkItemsPanel(state.workItems, state.activeWorkId)}
      ${renderSerialTable(records, state.serialQuery, state.workItems)}
      ${renderActivityPanel(todayRecords)}`;
  app.innerHTML = `${renderSidebar(state)}<main class="main-area" id="main-content">
    ${renderTopbar()}<div class="dashboard-content">${dashboard}${renderFooter()}</div></main>
    ${renderOperatorValidationDialog(getProcedure(), state)}${renderRecordsDialog(records, state.recordsQuery, state.workItems)}${renderWorkItemDialog(state)}${renderEvidenceReviewDialog(state)}${renderEvidenceImageDialog(state)}${renderStepImageDialog()}
    ${renderToast()}`;

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

  if (state.recordsDialogOpen) recordsDialog.showModal();
  if (state.validationDialogOpen) validationDialog.showModal();
  if (state.workDialogOpen) workDialog.showModal();
  if (state.evidenceReviewDialogOpen) evidenceReviewDialog.showModal();
  if (state.evidenceImageDialogOpen) evidenceImageDialog.showModal();
  restoreFocus(previousFocus, { focusDialog, initial });
  drawCompletionChart(document.querySelector("#completion-chart"), todayRecords);
  if (!localStorage.getItem("sop-operador-audit-session-v1")) localStorage.setItem("sop-operador-audit-session-v1", state.auditSessionId);
}

function renderToast() {
  if (!state.toast) return "";
  const icon = state.toast.kind === "warning" ? "warning" : "check_circle";
  return `<div class="toast toast--${state.toast.kind}" role="status"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span>
    ${escapeHtml(state.toast.message)}<button type="button" data-action="close-toast" aria-label="Cerrar aviso"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>`;
}

function restoreFocus(previousFocus, { focusDialog, initial }) {
  if (focusDialog && state.recordsDialogOpen) {
    document.querySelector('[data-focus-key="records-search"]')?.focus();
    return;
  }
  if (focusDialog && state.validationDialogOpen) {
    (document.querySelector("#completion-form [data-step]:not(:checked)") ?? document.querySelector('#completion-form [name="serial"]'))?.focus();
    return;
  }
  if (!previousFocus.key) {
    if (!initial && !state.recordsDialogOpen && state.dialogTriggerFocusKey) {
      document.querySelector(`[data-focus-key="${CSS.escape(state.dialogTriggerFocusKey)}"]`)?.focus();
      state.dialogTriggerFocusKey = "";
    }
    return;
  }
  const element = document.querySelector(`[data-focus-key="${CSS.escape(previousFocus.key)}"]`);
  if (!element) return;
  element.focus();
  if (previousFocus.start !== null && typeof element.setSelectionRange === "function") {
    element.setSelectionRange(previousFocus.start, previousFocus.end);
  }
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
  if (!procedure.steps.length) {
    showToast("Esta hoja es informativa y no tiene pasos para validar.", "warning");
    return;
  }
  const allChecked = procedure.steps.every((step) => state.completedSteps.includes(step.number));
  if (!allChecked) {
    const uncheckedStep = procedure.steps.find((step) => !state.completedSteps.includes(step.number));
    showFormError("Confirma todos los pasos antes de registrar la validación.", document.querySelector(`[data-step="${CSS.escape(String(uncheckedStep?.number ?? ""))}"]`));
    return;
  }
  const formElement = event.currentTarget;
  if (!state.form.repairType) {
    showFormError("Selecciona el tipo de reparación.", formElement.querySelector('[name="repairType"]'));
    return;
  }
  if (!state.form.componentPartNumber?.trim()) {
    showFormError("Captura el número de parte del componente.", formElement.querySelector('[name="componentPartNumber"]'));
    return;
  }
  if (!state.form.componentSerial?.trim()) {
    showFormError("Captura el número de serie del componente.", formElement.querySelector('[name="componentSerial"]'));
    return;
  }
  const incompleteField = formElement.querySelector(".validation-field input[required]:invalid");
  if (incompleteField) {
    const fieldLabel = incompleteField.closest(".validation-field")?.firstChild?.textContent.trim() || "obligatorio";
    showFormError(`Completa el campo ${fieldLabel} para registrar la validación.`, incompleteField);
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
  const user = getActiveLocalUser();
  const now = new Date();
  const record = {
    id: `local-${now.getTime()}`,
    category: procedure.category,
    procedureId: procedure.id,
    operation: procedure.title,
    sheet: procedure.sheet,
    stepRange: procedure.stepRange,
    nodeNumber: state.form.nodeNumber.trim(),
    serial: state.form.serial.trim(),
    nodePartNumber: state.form.nodePartNumber.trim(),
    componentPartNumber: state.form.componentPartNumber.trim(),
    componentSerial: state.form.componentSerial.trim(),
    operator: user.name,
    employeeNumber: user.employeeNumber,
    actor: { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", role: user.role },
    sessionId: state.auditSessionId,
    auditEventIds: readLocalAuditTrail().filter((event) => event.sessionId === state.auditSessionId && event.procedureId === procedure.id).map((event) => event.id),
    position: user.position || "Técnico de FA",
    repairType: state.form.repairType,
    date: TODAY_DATE_KEY,
    displayDate: TODAY_DATE_LABEL,
    time: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
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
    procedureId: procedure.id,
    procedureTitle: procedure.title,
    sheet: procedure.sheet,
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
  getRecords,
  getProcedure,
  render,
  showToast,
  selectProcedure,
  moveProcedure,
  openRecords,
  closeDialog,
  handleCompletionSubmit,
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
    state.form = createEmptyForm();
    state.validationEvidenceFiles = [];
    state.workDialogOpen = false;
    state.recordsDialogOpen = false;
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

startCurrentShiftClock();
render({ initial: true });
