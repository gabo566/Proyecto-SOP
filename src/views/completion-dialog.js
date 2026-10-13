const FIELDS = [
  { name: "serial", label: "N° de serie", placeholder: "Serial del nodo", group: "equipment" },
  { name: "nodePartNumber", label: "N° de parte (PN)", placeholder: "Número de parte", group: "equipment" },
  { name: "name", label: "Nombre del operador", placeholder: "Nombre completo", autocomplete: "name", group: "operator" },
  { name: "employeeNumber", label: "N° de empleado", placeholder: "Número de empleado", group: "operator" },
  { name: "position", label: "Puesto", placeholder: "Puesto del operador", group: "operator" },
  { name: "signature", label: "Firma del operador", placeholder: "Escribe tu nombre completo", autocomplete: "name", group: "operator", full: true },
];

function createEmptyForm() {
  return { name: "", employeeNumber: "", position: "", nodeNumber: "", serial: "", nodePartNumber: SOP_DOCUMENT.nodePartNumber, signature: "", declaration: false };
}

function renderField(field, form, error = "") {
  const signatureError = field.name === "signature" && error.includes("firma");
  const fullWidth = field.full ? " validation-field--full" : "";
  return `<label class="validation-field${fullWidth}">${field.label}<input name="${field.name}" data-form-field="${field.name}" data-focus-key="form-${field.name}"
    value="${escapeHtml(form[field.name] ?? "")}" placeholder="${field.placeholder}" ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ""}
    ${signatureError ? 'aria-invalid="true" aria-describedby="completion-form-error"' : ""} required /></label>`;
}

function renderValidationSteps(procedure, state) {
  return procedure.steps.map((step) => {
    const checked = state.completedSteps.includes(step.number);
    return `<div class="validation-step ${checked ? "validation-step--checked" : ""}">
      <input id="validation-step-${escapeHtml(step.number)}" type="checkbox" data-step="${escapeHtml(step.number)}" data-focus-key="step-${escapeHtml(step.number)}" aria-label="Confirmo que realicé el paso ${escapeHtml(step.number)}" ${checked ? "checked" : ""} />
      <span class="validation-step-number" aria-hidden="true">${escapeHtml(step.number)}</span><span class="validation-step-copy" aria-label="Instrucción completa del paso ${escapeHtml(step.number)}">${escapeHtml(step.text)}</span>
    </div>`;
  }).join("");
}

function renderOperatorValidationPanel(procedure, state) {
  const errorHidden = state.formError ? "" : "hidden";
  const declarationError = state.formError.includes("Confirma") ? 'aria-describedby="completion-form-error" aria-invalid="true"' : "";
  const equipmentFields = FIELDS.filter((field) => field.group === "equipment");
  const operatorFields = FIELDS.filter((field) => field.group === "operator");
  const checkedCount = state.completedSteps.length;

  return `<section class="validation-panel" aria-labelledby="validation-heading">
    <div class="validation-panel-heading"><span class="heading-icon material-symbols-rounded" aria-hidden="true">how_to_reg</span>
      <div><p class="eyebrow">Captura y declaración</p><h2 id="validation-heading">Validación del operador</h2></div>
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
        <div class="validation-operator-grid">${operatorFields.map((field) => renderField(field, state.form, state.formError)).join("")}</div>
        <label class="declaration-check"><input type="checkbox" name="declaration" data-form-field="declaration" ${state.form.declaration ? "checked" : ""} ${declarationError} />
          <span>Confirmo que realicé los pasos indicados en esta hoja de SOP conforme al procedimiento establecido.</span>
        </label>
      </section>
      <p class="form-error" id="completion-form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
      <button class="button button--primary validation-submit" type="submit"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Registrar validación</button>
      <p class="validation-note">El registro conserva la declaración del operador y los datos del nodo en este navegador.</p>
    </form>
  </section>`;
}
