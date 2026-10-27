const STORAGE_KEY = "sop-operador-validation-demo-records-v1";
const app = document.querySelector("#app");
const storedWorkItems = readWorkItems();
const activeDemoUser = getActiveLocalUser();
const restorableWork = storedWorkItems
  .filter((item) => ["En proceso", "Retrabajo en proceso"].includes(item.status))
  .sort((a, b) => b.updatedAt - a.updatedAt)[0];
const state = {
  selectedId: restorableWork?.procedureId ?? PROCEDURES[0].id,
  completedSteps: restorableWork?.completedSteps ?? [],
  savedRecords: readSavedRecords(),
  workItems: storedWorkItems,
  activeWorkId: restorableWork?.id ?? "",
  workDialogOpen: false,
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
  toast: null,
  serialQuery: "",
  recordsQuery: "",
  form: { ...createEmptyForm(), ...(restorableWork?.form ?? {}), name: activeDemoUser.name, employeeNumber: activeDemoUser.employeeNumber, position: "Técnico de FA" },
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
  return PROCEDURES.find((item) => item.id === state.selectedId) ?? PROCEDURES[0];
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
  const previousFocus = focusKey === undefined ? getFocusState() : { key: focusKey, start: null, end: null };
  const records = getRecords();
  const todayRecords = records.filter((record) => record.date === TODAY_DATE_KEY);
  const dashboard = state.activeSection === "traceability"
    ? renderActivityPanel(todayRecords)
    : state.activeSection === "reports"
    ? `${renderWorkItemsPanel(state.workItems, state.activeWorkId)}${renderSerialTable(records, state.serialQuery, state.workItems)}`
    : state.activeSection === "users"
    ? renderLocalUsersPanel()
    : getActiveLocalUser().role === "supervisor"
    ? `${renderSummaryMetrics(todayRecords, state)}${renderWorkItemsPanel(state.workItems, state.activeWorkId)}${renderSerialTable(records, state.serialQuery, state.workItems)}${renderActivityPanel(todayRecords)}`
    : `${renderSummaryMetrics(todayRecords, state)}
      <div class="production-layout" id="production">
        ${renderProcedurePanel(getProcedure(), state)}${renderOperatorValidationPanel(getProcedure(), state)}
      </div>
      ${renderWorkItemsPanel(state.workItems, state.activeWorkId)}
      ${renderSerialTable(records, state.serialQuery, state.workItems)}
      ${renderActivityPanel(todayRecords)}`;
  app.innerHTML = `${renderSidebar(state)}<main class="main-area" id="main-content">
    ${renderTopbar()}<div class="dashboard-content">${dashboard}${renderFooter()}</div></main>
    ${renderRecordsDialog(records, state.recordsQuery, state.workItems)}${renderWorkItemDialog(state)}${renderEvidenceReviewDialog(state)}${renderEvidenceImageDialog(state)}${renderStepImageDialog()}
    ${renderToast()}`;

  const recordsDialog = document.querySelector("#records-dialog");
  recordsDialog.addEventListener("close", () => handleNativeDialogClose("recordsDialogOpen"));
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
  if (!["operator", "admin"].includes(getActiveLocalUser().role)) {
    showToast("El rol de supervisor puede consultar registros, pero no ejecutar pasos.", "warning");
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
}

const workflow = createWorkItemWorkflow(state, { getProcedure, createEmptyForm, render, showToast, persistSavedRecords });

function moveProcedure(direction) {
  const currentIndex = PROCEDURES.findIndex((item) => item.id === state.selectedId);
  const nextIndex = (currentIndex + direction + PROCEDURES.length) % PROCEDURES.length;
  selectProcedure(PROCEDURES[nextIndex].id);
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
  if (!["operator", "admin"].includes(getActiveLocalUser().role)) {
    showToast("Solo un operador puede registrar una validación.", "warning");
    return;
  }
  const procedure = getProcedure();
  const allChecked = procedure.steps.every((step) => state.completedSteps.includes(step.number));
  if (!allChecked) {
    showToast("Completa todos los pasos antes de registrar la declaración.", "warning");
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
    actor: { id: user.id, name: user.name, employeeNumber: user.employeeNumber, role: user.role },
    sessionId: state.auditSessionId,
    auditEventIds: readLocalAuditTrail().filter((event) => event.sessionId === state.auditSessionId && event.procedureId === procedure.id).map((event) => event.id),
    position: state.form.position.trim(),
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
    ? workflow.completeActiveWork(record.id, state.form.name.trim())
    : { saved: true, needsReview: false };
  state.completedSteps = [];
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
  switchLocalUser: (id) => {
    if (state.evidenceBusy) {
      showToast("Espera a que termine el guardado de evidencia para cambiar el perfil.", "warning");
      return;
    }
    if (!setActiveLocalUser(id)) return;
    const user = getActiveLocalUser();
    state.form.name = user.name;
    state.form.employeeNumber = user.employeeNumber;
    state.form.position = "Técnico de FA";
    if ((state.activeSection === "users" && user.role !== "admin")
      || (state.activeSection === "production" && !["operator", "admin"].includes(user.role))
      || (state.activeSection === "reports" && !["supervisor", "admin"].includes(user.role))) state.activeSection = "overview";
    render();
    showToast(`Perfil de demostración: ${user.name} · ${LOCAL_USER_ROLES[user.role]}`, "warning");
  },
  createLocalUser: (formData) => {
    const result = addLocalUser({
      name: String(formData.get("userName") ?? ""),
      employeeNumber: String(formData.get("employeeNumber") ?? ""),
      email: String(formData.get("userEmail") ?? ""),
      role: String(formData.get("userRole") ?? ""),
    });
    if (result === "ok") showToast("Usuario agregado a esta demostración.", "warning");
    else showToast(result === "email" ? "Ese correo ya existe." : result === "employee" ? "Ese número de empleado ya existe." : "No se pudo crear el perfil.", "warning");
    render();
  },
  toggleLocalUser: (id, active) => {
    const result = setLocalUserActive(id, active);
    showToast(result === "ok" ? `Usuario ${active ? "activado" : "desactivado"} en esta demostración.` : result === "last-admin" ? "Debe quedar al menos un administrador activo." : result === "active-user" ? "Cambia el perfil activo antes de desactivarlo." : "Las cuentas de ejemplo no se pueden cambiar.", "warning");
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

render({ initial: true });
