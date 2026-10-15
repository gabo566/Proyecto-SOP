const FIELDS = [
  { name: "serial", label: "N° de serie", placeholder: "Serial del nodo", group: "equipment" },
  { name: "nodePartNumber", label: "N° de parte (PN)", placeholder: "Número de parte", group: "equipment" },
  { name: "name", label: "Nombre del operador", placeholder: "Nombre completo", autocomplete: "name", group: "operator" },
  { name: "employeeNumber", label: "N° de empleado", placeholder: "Número de empleado", group: "operator" },
  { name: "position", label: "Puesto", placeholder: "Puesto del operador", group: "operator" },
];

function createEmptyForm() {
  return { name: "", employeeNumber: "", position: "", nodeNumber: "", serial: "", nodePartNumber: SOP_DOCUMENT.nodePartNumber, declaration: false };
}

function renderField(field, form, error = "") {
  const fullWidth = field.full ? " validation-field--full" : "";
  return `<label class="validation-field${fullWidth}">${field.label}<input name="${field.name}" data-form-field="${field.name}" data-focus-key="form-${field.name}"
    value="${escapeHtml(form[field.name] ?? "")}" placeholder="${field.placeholder}" ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ""}
    required /></label>`;
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

function renderReworkEvidenceSection(workItem, state) {
  if (workItem?.workKind !== "rework") return "";
  const evidenceFiles = workItem.evidenceFiles ?? [];
  const files = evidenceFiles.length
    ? `<ul class="evidence-file-list">${evidenceFiles.map((file) => `<li><span class="material-symbols-rounded" aria-hidden="true">image</span><span>${escapeHtml(file.name)}<small>${(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button class="icon-button" type="button" data-action="remove-evidence" data-evidence-id="${escapeHtml(file.id)}" aria-label="Quitar evidencia ${escapeHtml(file.name)}"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button></li>`).join("")}</ul>`
    : '<p class="evidence-empty">Adjunta al menos una foto del área corregida. El supervisor la revisará antes de cerrar el retrabajo.</p>';
  const errorHidden = state.evidenceError ? "" : "hidden";
  return `<section class="rework-evidence-section" aria-labelledby="rework-evidence-heading"><div class="rework-evidence-heading"><span class="material-symbols-rounded" aria-hidden="true">add_a_photo</span><div><h3 id="rework-evidence-heading">Evidencia del retrabajo <small>Requerida</small></h3><p>Sube fotos claras del componente o zona después de la corrección.</p></div></div>
    <button class="button button--outlined evidence-upload-button" type="button" data-action="choose-evidence-file" ${state.evidenceBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">upload</span>${state.evidenceBusy ? "Guardando evidencia…" : "Subir evidencia"}</button><input class="evidence-upload-input" type="file" data-evidence-input hidden accept="${EVIDENCE_FILE_ACCEPT}" multiple capture="environment" aria-label="Seleccionar fotos de evidencia" aria-describedby="rework-evidence-help${state.evidenceError ? " evidence-error" : ""}" ${state.evidenceError ? 'aria-invalid="true"' : ""} ${state.evidenceBusy ? "disabled" : ""} />
    <small id="rework-evidence-help" class="evidence-help">JPG, PNG o WebP · hasta ${MAX_EVIDENCE_FILES} fotos de ${MAX_EVIDENCE_FILE_MB} MB cada una.</small>${files}<label class="validation-field evidence-observation-field">Observaciones<textarea data-evidence-observation rows="2" maxlength="500" placeholder="Describe el resultado o detalle de la corrección">${escapeHtml(workItem.evidenceObservation ?? "")}</textarea></label><p class="form-error" id="evidence-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.evidenceError)}</p>
  </section>`;
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
        ${renderReworkEvidenceSection(activeWork, state)}
        <label class="declaration-check"><input type="checkbox" name="declaration" data-form-field="declaration" ${state.form.declaration ? "checked" : ""} ${declarationError} />
          <span>Confirmo que realicé los pasos indicados y que la información registrada es correcta.</span>
        </label>
      </section>
      <p class="form-error" id="completion-form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
      <button class="button button--secondary validation-pause" type="button" data-action="open-work-item-dialog"><span class="material-symbols-rounded" aria-hidden="true">pause_circle</span>Detener / registrar retrabajo</button>
      <button class="button button--primary validation-submit" type="submit"><span class="material-symbols-rounded" aria-hidden="true">${isRework ? "fact_check" : "task_alt"}</span>${isRework ? "Enviar retrabajo a revisión" : "Registrar validación"}</button>
      <p class="validation-note">${isRework ? "El cierre requiere aprobación del supervisor." : "La declaración se vincula al nombre y número de empleado."}</p>
    </form>
  </section>`;
}
