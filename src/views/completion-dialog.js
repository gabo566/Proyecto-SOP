const FIELDS = [
  { name: "serial", label: "N° de serie", placeholder: "Serial del nodo", group: "equipment" },
  { name: "nodePartNumber", label: "N° de parte (PN)", placeholder: "Número de parte", group: "equipment" },
  { name: "name", label: "Nombre del operador", placeholder: "Nombre completo", autocomplete: "name", group: "operator" },
  { name: "employeeNumber", label: "N° de empleado", placeholder: "Número de empleado", group: "operator" },
  { name: "position", label: "Puesto", placeholder: "Puesto del operador", group: "operator" },
];
const REPAIR_TYPES = [
  "Reemplazo de BMC",
  "Reemplazo de HMC",
  "Reemplazo de Coldplate 0",
  "Reemplazo de Coldplate 1",
  "Reemplazo de Bianca 0",
  "Reemplazo de Bianca 1",
  "Reemplazo de IPEX 0",
  "Reemplazo de IPEX 1",
  "Reemplazo de 2F PWR 0",
  "Reemplazo de 2F PWR 1",
  "Reemplazo de E1S Backplane 0",
  "Reemplazo de E1S Backplane 1",
  "Reemplazo de FIO Board",
  "Reemplazo de OSPF Board",
];
function createEmptyForm() {
  const user = getActiveLocalUser();
  return { name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", nodeNumber: "", serial: "", nodePartNumber: SOP_DOCUMENT.nodePartNumber, repairType: "", componentPartNumber: "", componentSerial: "", declaration: false };
}

function renderComponentFields(form, workDraft = null) {
  const repairType = workDraft?.repairType ?? form.repairType;
  const partNumber = workDraft?.componentPartNumber ?? form.componentPartNumber;
  const serial = workDraft?.componentSerial ?? form.componentSerial;
  return `<label class="validation-field">Tipo de reparación<select name="repairType" ${workDraft ? "data-work-draft-field=\"repairType\"" : "data-form-field=\"repairType\""} ${workDraft ? "" : "required"}><option value="">${workDraft ? "Por definir" : "Selecciona la reparación"}</option>${REPAIR_TYPES.map((value) => `<option value="${escapeHtml(value)}" ${repairType === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
    <label class="validation-field">N° de parte del componente<input name="componentPartNumber" ${workDraft ? "data-work-draft-field=\"componentPartNumber\"" : "data-form-field=\"componentPartNumber\""} value="${escapeHtml(partNumber ?? "")}" placeholder="PN del componente" ${workDraft ? "" : "required"} /></label>
    <label class="validation-field">N° de serie del componente<input name="componentSerial" ${workDraft ? "data-work-draft-field=\"componentSerial\"" : "data-form-field=\"componentSerial\""} value="${escapeHtml(serial ?? "")}" placeholder="Serial del componente" ${workDraft ? "" : "required"} /></label>`;
}

function renderField(field, form, error = "") {
  const fullWidth = field.full ? " validation-field--full" : "";
  const identityLock = ["name", "employeeNumber", "position"].includes(field.name) ? "readonly aria-readonly=\"true\"" : "";
  return `<label class="validation-field${fullWidth}">${field.label}<input name="${field.name}" data-form-field="${field.name}" data-focus-key="form-${field.name}"
    value="${escapeHtml(form[field.name] ?? "")}" placeholder="${field.placeholder}" ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ""}
    ${identityLock} required /></label>`;
}

function renderValidationSteps(procedure, state) {
  return procedure.steps.map((step) => {
    const checked = state.completedSteps.includes(step.number);
    const audit = getLatestLocalStepEvent(procedure.id, step.number);
    const auditLabel = checked && audit ? `<small class="step-audit-label">Marcó ${escapeHtml(audit.actor.name)} · ${escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(audit.at)))}</small>` : "";
    return `<div class="validation-step ${checked ? "validation-step--checked" : ""}">
      <input id="validation-step-${escapeHtml(step.number)}" type="checkbox" data-step="${escapeHtml(step.number)}" data-focus-key="step-${escapeHtml(step.number)}" aria-label="Confirmo que realicé el paso ${escapeHtml(step.number)}" ${checked ? "checked" : ""} />
      <span class="validation-step-number" aria-hidden="true">${escapeHtml(step.number)}</span><span class="validation-step-copy" aria-label="Instrucción completa del paso ${escapeHtml(step.number)}">${escapeHtml(step.text)}${step.sourceNote ? `<small class="validation-source-note">${escapeHtml(step.sourceNote)}</small>` : ""}${auditLabel}</span>
    </div>`;
  }).join("");
}

function renderReworkEvidenceSection(workItem, state) {
  const isRework = workItem?.workKind === "rework";
  const evidenceFiles = isRework ? workItem.evidenceFiles ?? [] : state.validationEvidenceFiles ?? [];
  const files = evidenceFiles.map((file) => `<span class="evidence-inline-file" title="${escapeHtml(file.name)}"><span class="material-symbols-rounded" aria-hidden="true">image</span>${escapeHtml(file.name)}<button type="button" data-action="${isRework ? 'remove-evidence' : 'remove-validation-evidence'}" data-evidence-id="${escapeHtml(file.id)}" aria-label="Quitar evidencia ${escapeHtml(file.name)}">×</button></span>`).join("");
  const inputAttrs = isRework ? 'data-evidence-input' : 'data-validation-evidence-input';
  const action = isRework ? 'choose-evidence-file' : 'choose-validation-evidence';
  const note = isRework ? `Requerida · ${evidenceFiles.length}/${MAX_EVIDENCE_FILES}` : evidenceFiles.length ? `${evidenceFiles.length} adjunta(s)` : "Opcional";
  return `<div class="evidence-inline"><button class="evidence-inline-button" type="button" data-action="${action}" aria-label="Subir evidencia${isRework ? ' requerida' : ''}" title="Subir evidencia" ${state.evidenceBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.evidenceBusy ? "hourglass_top" : "add_a_photo"}</span><span>Evidencia</span></button><small class="evidence-inline-note">${note}</small><input class="evidence-upload-input" type="file" ${inputAttrs} hidden accept="${EVIDENCE_FILE_ACCEPT}" multiple capture="environment" aria-label="Seleccionar fotos de evidencia" ${state.evidenceBusy ? "disabled" : ""} />${files}${state.evidenceError ? `<small class="evidence-inline-error" role="alert">${escapeHtml(state.evidenceError)}</small>` : ""}</div>`;
}

function renderOperatorValidationPanel(procedure, state) {
  const errorHidden = state.formError ? "" : "hidden";
  const declarationError = state.formError.includes("Confirma") ? 'aria-describedby="completion-form-error" aria-invalid="true"' : "";
  const equipmentFields = FIELDS.filter((field) => field.group === "equipment");
  const operatorFields = FIELDS.filter((field) => field.group === "operator");
  const checkedCount = state.completedSteps.length;
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const isRework = activeWork?.workKind === "rework";

  return `<section class="validation-panel" aria-labelledby="validation-heading">
    <div class="validation-panel-heading"><span class="heading-icon material-symbols-rounded" aria-hidden="true">how_to_reg</span>
      <div><p class="eyebrow">Captura y declaración</p><h2 id="validation-heading">Registrar validación</h2></div>
      <button class="icon-button validation-dialog-close" type="button" data-action="close-validation-dialog" aria-label="Cerrar registro"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
    </div>
    <form id="completion-form" novalidate>
      <div class="validation-asset-grid">${equipmentFields.map((field) => renderField(field, state.form, state.formError)).join("")}</div>
      <div class="validation-sop-meta"><div><span>SOP</span><strong>${escapeHtml(SOP_DOCUMENT.id)}</strong></div>
        <div><span>Revisión</span><strong>${escapeHtml(SOP_DOCUMENT.revision)}</strong></div>
        <div><span>Hoja</span><strong>${procedure.sheet} de ${SOP_DOCUMENT.totalSheets}</strong></div>
      </div>
      <section class="validation-steps-section" aria-labelledby="validation-steps-heading">
        <div class="validation-steps-heading"><div><h3 id="validation-steps-heading">Pasos a validar</h3></div><span>${checkedCount} de ${procedure.steps.length}</span></div>
        <div class="validation-step-list">${renderValidationSteps(procedure, state)}</div>
      </section>
      <section class="validation-operator-section" aria-labelledby="operator-details-heading">
        <div class="validation-subheading"><span class="material-symbols-rounded" aria-hidden="true">person</span><h3 id="operator-details-heading">Declaración del operador</h3></div>
        <div class="validation-operator-grid">${operatorFields.map((field) => renderField(field, state.form, state.formError)).join("")}${renderComponentFields(state.form)}${renderReworkEvidenceSection(activeWork, state)}</div>
        <label class="declaration-check"><input type="checkbox" name="declaration" data-form-field="declaration" ${state.form.declaration ? "checked" : ""} ${declarationError} />
          <span>Confirmo que realicé los pasos indicados y que la información registrada es correcta.</span>
        </label>
      </section>
      <p class="form-error" id="completion-form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
      <button class="button button--primary validation-submit" type="submit"><span class="material-symbols-rounded" aria-hidden="true">${isRework ? "fact_check" : "task_alt"}</span>${isRework ? "Enviar retrabajo a revisión" : "Registrar validación"}</button>
      <p class="validation-note">${isRework ? "El cierre requiere aprobación del supervisor." : "La declaración se vincula al nombre y número de empleado."}</p>
    </form>
  </section>`;
}

function renderOperatorValidationDialog(procedure, state) {
  return `<dialog class="validation-dialog" id="validation-dialog" aria-labelledby="validation-heading">${renderOperatorValidationPanel(procedure, state)}</dialog>`;
}
