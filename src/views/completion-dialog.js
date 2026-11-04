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
  return { name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", nodeNumber: "", serial: "", nodePartNumber: "", repairType: "", componentPartNumber: "", componentSerial: "", stationAssignment: "MFG:TDR", sopVersionId: "", disassemblySheets: [], declaration: false };
}

function renderComponentFields(form, workDraft = null) {
  const repairType = workDraft?.repairType ?? form.repairType;
  const partNumber = workDraft?.componentPartNumber ?? form.componentPartNumber;
  const serial = workDraft?.componentSerial ?? form.componentSerial;
  return `<label class="validation-field">Tipo de reparación · opcional<select name="repairType" ${workDraft ? "data-work-draft-field=\"repairType\"" : "data-form-field=\"repairType\""}><option value="">${workDraft ? "Por definir" : "No aplica"}</option>${REPAIR_TYPES.map((value) => `<option value="${escapeHtml(value)}" ${repairType === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
    <label class="validation-field">N° de parte del componente · opcional<input name="componentPartNumber" ${workDraft ? "data-work-draft-field=\"componentPartNumber\"" : "data-form-field=\"componentPartNumber\""} value="${escapeHtml(partNumber ?? "")}" placeholder="PN del componente" /></label>
    <label class="validation-field">N° de serie del componente · opcional<input name="componentSerial" ${workDraft ? "data-work-draft-field=\"componentSerial\"" : "data-form-field=\"componentSerial\""} value="${escapeHtml(serial ?? "")}" placeholder="Serial del componente" /></label>`;
}

function renderGuidedValidationSteps(procedure, state, disabled = false, showReferenceImages = true) {
  return procedure.steps.map((step) => {
    const checked = getGuidedSopCheckedSteps(state.sopRun, procedure.id).includes(String(step.number));
    const audit = getLatestLocalStepEvent(procedure.id, step.number);
    const auditLabel = checked && audit ? `<small class="step-audit-label">Marcó ${escapeHtml(audit.actor.name)} · ${escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(audit.at)))}</small>` : "";
    return `<div class="guided-check-item ${checked ? "guided-check-item--checked" : ""}">
      <input id="validation-step-${escapeHtml(step.number)}" type="checkbox" data-step="${escapeHtml(step.number)}" data-focus-key="step-${escapeHtml(step.number)}" aria-label="Realicé el paso ${escapeHtml(step.number)}: ${escapeHtml(step.text)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
      <div class="guided-check-details"><label for="validation-step-${escapeHtml(step.number)}" class="guided-check-copy"><strong>Paso ${escapeHtml(step.number)}</strong><span>${escapeHtml(step.text)}</span>${step.sourceNote ? `<small class="validation-source-note">${escapeHtml(step.sourceNote)}</small>` : ""}${auditLabel}</label>${showReferenceImages && step.images?.length ? renderStepImages(step, procedure.sheet) : ""}</div>
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

function renderGuidedFinalConfirmation(procedure, state) {
  const run = state.sopRun;
  const document = run?.document ?? SOP_DOCUMENT;
  const nodePartNumber = String(state.form.nodePartNumber ?? "").trim() || "pendiente";
  const nodeSerial = String(state.form.serial ?? "").trim() || "pendiente";
  const cardPartNumber = String(state.form.componentPartNumber ?? "").trim() || "pendiente";
  const cardSerial = String(state.form.componentSerial ?? "").trim() || "pendiente";
  const operation = document.title || procedure.title || "procedimiento SOP";
  const station = formatWorkStationAssignment(state.form.stationAssignment) || "Sin estación";
  const accepted = Boolean(state.form.declaration);
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const progress = getGuidedSopProgress(run, SOP_SHEETS);
  const originalOperator = run.startedBy ?? state.form;
  const currentOperator = run.currentOperator ?? state.form;
  const operatorChanged = originalOperator.employeeNumber !== currentOperator.employeeNumber;
  return `<section class="guided-final-confirmation" aria-labelledby="guided-confirmation-heading">
    <p class="eyebrow">Revisión final · ${escapeHtml(document.id)}</p>
    <h3 id="guided-confirmation-heading" data-focus-key="guided-confirmation-heading" tabindex="-1">Confirma el procedimiento realizado</h3>
    <p class="guided-confirmation-copy">¿Confirmas que <strong>${escapeHtml(operation)}</strong>, revisión <strong>${escapeHtml(document.revision)}</strong>, se realizó de acuerdo con los procedimientos establecidos por la empresa para el nodo y la tarjeta identificados abajo?</p>
    <p class="guided-confirmation-warning">Cualquier daño, desviación o situación fuera de lo esperado debe reportarse para recibir la retroalimentación correspondiente.</p>
    ${activeWork?.workKind === "rework" ? renderReworkEvidenceSection(activeWork, state) : ""}
    <div class="guided-confirmation-summary">
      <div><span>Estación</span><strong>${escapeHtml(station)}</strong></div>
      <div><span>SOP y revisión</span><strong>${escapeHtml(operation)}</strong><small>${escapeHtml(document.id)} · Rev. ${escapeHtml(document.revision)}</small></div>
      <div class="guided-confirmation-asset"><span>Nodo</span><strong>PN ${escapeHtml(nodePartNumber)}</strong><small>Serie ${escapeHtml(nodeSerial)}</small></div>
      <div class="guided-confirmation-asset"><span>Tarjeta</span><strong>PN ${escapeHtml(cardPartNumber)}</strong><small>Serie ${escapeHtml(cardSerial)}</small></div>
      <div><span>Avance validado</span><strong>${run.procedureIds.length} hojas</strong><small>${progress.complete} pasos</small></div>
      <div><span>${operatorChanged ? "Operadores" : "Operador responsable"}</span><strong>${escapeHtml(originalOperator.name)} · ${escapeHtml(originalOperator.employeeNumber)}</strong><small>${operatorChanged ? `Continúa y finaliza: ${escapeHtml(currentOperator.name)} · ${escapeHtml(currentOperator.employeeNumber)}` : escapeHtml(currentOperator.position || "Técnico de FA")}</small></div>
    </div>
    <label class="declaration-check guided-final-declaration"><input type="checkbox" name="declaration" data-form-field="declaration" ${accepted ? "checked" : ""} ${state.formError.includes("Confirm") ? 'aria-describedby="completion-form-error" aria-invalid="true"' : ""} />
      <span>Confirmo que realicé todos los pasos de esta SOP para el nodo y la tarjeta identificados, y que reportaré cualquier daño o desviación para recibir la retroalimentación correspondiente.</span>
    </label>
    <div class="guided-final-actions"><button class="button button--secondary" type="button" data-action="previous-sop-sheet"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Volver a la última hoja</button><button class="button button--primary validation-submit" type="submit" ${accepted ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Finalizar y guardar registro</button></div>
    <p class="validation-note">El registro conservará los datos del nodo y la tarjeta, la SOP y revisión, los pasos confirmados, operadores y fecha.</p>
  </section>`;
}

function renderOperatorValidationPanel(procedure, state) {
  const errorHidden = state.formError ? "" : "hidden";
  return `<section class="validation-panel guided-confirmation-panel" aria-labelledby="validation-heading">
    <div class="validation-panel-heading"><span class="heading-icon material-symbols-rounded" aria-hidden="true">task_alt</span>
      <div><p class="eyebrow">Recorrido completado · ${escapeHtml(state.sopRun.procedureIds.length)} hojas con pasos</p><h2 id="validation-heading">Confirmación del registro</h2></div>
      <button class="icon-button validation-dialog-close" type="button" data-action="close-validation-dialog" aria-label="Volver al seguimiento SOP"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
    </div>
    <form id="completion-form" novalidate>
      ${renderGuidedFinalConfirmation(procedure, state)}
      <p class="form-error" id="completion-form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
    </form>
  </section>`;
}

function renderOperatorValidationDialog(procedure, state) {
  const confirmation = state.sopRun?.stage === "confirmation";
  return `<dialog class="validation-dialog" id="validation-dialog" aria-labelledby="validation-heading">${confirmation ? renderOperatorValidationPanel(procedure, state) : ""}</dialog>`;
}

function renderOperatorHandoffDialog(state) {
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const currentOperator = state.sopRun?.currentOperator ?? state.sopRun?.startedBy ?? getActiveLocalUser();
  const procedure = getGuidedSopProcedure(state.sopRun, PROCEDURES);
  const progress = getGuidedSopProgress(state.sopRun, PROCEDURES);
  const error = state.operatorHandoffError ?? "";
  return `<dialog class="app-dialog operator-handoff-dialog" id="operator-handoff-dialog" aria-labelledby="operator-handoff-title">
    <form id="operator-handoff-form" novalidate>
      <div class="dialog-header"><div><p class="eyebrow">Entrega de SOP · ${escapeHtml(activeWork?.serial ?? state.form.serial)}</p><h2 id="operator-handoff-title">Cambiar operador</h2></div><button class="icon-button" type="button" data-action="close-operator-handoff" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      <p class="operator-handoff-intro">Guardaremos el avance actual de la SOP y los datos del trabajo. La persona que continúa debe confirmar su identidad con su número de empleado y contraseña.</p>
      <div class="operator-handoff-context"><span class="material-symbols-rounded" aria-hidden="true">swap_horiz</span><span><small>Entrega</small><strong>${escapeHtml(currentOperator.name)} · ${escapeHtml(currentOperator.employeeNumber)}</strong><small>Hoja ${escapeHtml(procedure?.sheet ?? activeWork?.sheet ?? "—")} · ${progress.complete} de ${progress.total} pasos marcados</small></span></div>
      <div class="operator-handoff-fields"><label>Número de empleado<input name="operatorUsername" required maxlength="40" autocomplete="username" inputmode="numeric" /></label><label>Contraseña<input name="operatorPassword" type="password" required maxlength="80" autocomplete="current-password" /></label></div>
      <p class="form-error operator-handoff-error" id="operator-handoff-error" role="alert" aria-live="polite" ${error ? "" : "hidden"}>${escapeHtml(error)}</p>
      <div class="work-dialog-actions"><button class="button button--secondary" type="button" data-action="close-operator-handoff">Cancelar</button><button class="button button--primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">verified_user</span>Guardar avance y cambiar operador</button></div>
    </form>
  </dialog>`;
}
