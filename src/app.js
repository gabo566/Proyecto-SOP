const STORAGE_KEY = "sop-operador-validation-demo-records-v1";
const app = document.querySelector("#app");
const state = {
  selectedId: PROCEDURES[0].id,
  completedSteps: [],
  savedRecords: readSavedRecords(),
  recordsDialogOpen: false,
  activeSection: "overview",
  navOpen: false,
  toast: null,
  serialQuery: "",
  recordsQuery: "",
  form: createEmptyForm(),
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
  app.innerHTML = `${renderSidebar(state)}<main class="main-area" id="main-content">
    ${renderTopbar()}<div class="dashboard-content">
      ${renderSummaryMetrics(todayRecords, state)}
      <div class="production-layout" id="production">
        ${renderProcedurePanel(getProcedure(), state)}${renderOperatorValidationPanel(getProcedure(), state)}
      </div>
      ${renderSerialTable(records, state.serialQuery)}
      ${renderActivityPanel(todayRecords)}${renderFooter()}
    </div></main>
    ${renderRecordsDialog(records, state.recordsQuery)}${renderStepImageDialog()}
    ${renderToast()}`;

  const recordsDialog = document.querySelector("#records-dialog");
  recordsDialog.addEventListener("close", () => handleNativeDialogClose("recordsDialogOpen"));

  if (state.recordsDialogOpen) recordsDialog.showModal();
  restoreFocus(previousFocus, { focusDialog, initial });
  drawCompletionChart(document.querySelector("#completion-chart"), todayRecords);
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
  state.selectedId = id;
  state.completedSteps = [];
  state.formError = "";
  render();
}

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
  const procedure = getProcedure();
  const allChecked = procedure.steps.every((step) => state.completedSteps.includes(step.number));
  if (!allChecked) {
    showToast("Completa todos los pasos antes de registrar la declaración.", "warning");
    return;
  }
  const formElement = event.currentTarget;
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
  if (state.form.signature.trim().toLocaleLowerCase("es-MX") !== state.form.name.trim().toLocaleLowerCase("es-MX")) {
    showFormError("La firma escrita debe coincidir con el nombre del operador.");
    return;
  }
  saveCompletion();
}

function showFormError(message, target = null) {
  state.formError = message;
  const error = document.querySelector("#completion-form-error");
  error.textContent = message;
  error.hidden = false;
  const fallbackTarget = message.toLocaleLowerCase("es-MX").includes("firma")
    ? document.querySelector('[name="signature"]')
    : document.querySelector('[name="declaration"]');
  const invalidTarget = target ?? fallbackTarget;
  invalidTarget?.setAttribute("aria-invalid", "true");
  invalidTarget?.setAttribute("aria-describedby", "completion-form-error");
  invalidTarget?.focus();
}

function saveCompletion() {
  const procedure = getProcedure();
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
    componentPartNumber: procedure.partNumber,
    operator: state.form.name.trim(),
    employeeNumber: state.form.employeeNumber.trim(),
    position: state.form.position.trim(),
    signature: state.form.signature.trim(),
    date: TODAY_DATE_KEY,
    displayDate: TODAY_DATE_LABEL,
    time: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    status: "Completado",
    recordType: "Declaración local del operador",
    declared: true,
  };
  const next = [record, ...state.savedRecords];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    showToast("No se pudo guardar en el almacenamiento local.", "warning");
    return;
  }
  state.savedRecords = next;
  state.completedSteps = [];
  state.form = createEmptyForm();
  state.formError = "";
  showToast("Declaración y datos guardados en este navegador.");
}

bindInteractions(app, {
  state,
  navItems: NAV_ITEMS,
  getRecords,
  render,
  showToast,
  selectProcedure,
  moveProcedure,
  openRecords,
  closeDialog,
  handleCompletionSubmit,
});

render({ initial: true });
