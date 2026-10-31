const FIELDS = [
  { name: "nodeNumber", label: "N° de nodo", placeholder: "Número de nodo", group: "equipment", required: true },
  { name: "serial", label: "N° de serie del nodo", placeholder: "Serial del nodo", group: "equipment", required: true },
  { name: "nodePartNumber", label: "N° de parte del nodo · opcional", placeholder: "Número de parte", group: "equipment" },
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
  return `<label class="validation-field">Tipo de reparación · opcional<select name="repairType" ${workDraft ? "data-work-draft-field=\"repairType\"" : "data-form-field=\"repairType\""}><option value="">${workDraft ? "Por definir" : "No aplica"}</option>${REPAIR_TYPES.map((value) => `<option value="${escapeHtml(value)}" ${repairType === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
    <label class="validation-field">N° de parte del componente · opcional<input name="componentPartNumber" ${workDraft ? "data-work-draft-field=\"componentPartNumber\"" : "data-form-field=\"componentPartNumber\""} value="${escapeHtml(partNumber ?? "")}" placeholder="PN del componente" /></label>
    <label class="validation-field">N° de serie del componente · opcional<input name="componentSerial" ${workDraft ? "data-work-draft-field=\"componentSerial\"" : "data-form-field=\"componentSerial\""} value="${escapeHtml(serial ?? "")}" placeholder="Serial del componente" /></label>`;
}

function renderField(field, form, error = "") {
  const fullWidth = field.full ? " validation-field--full" : "";
  const required = field.required ? "required" : "";
  return `<label class="validation-field${fullWidth}">${field.label}<input name="${field.name}" data-form-field="${field.name}" data-focus-key="form-${field.name}"
    value="${escapeHtml(form[field.name] ?? "")}" placeholder="${field.placeholder}" ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ""}
    ${required} /></label>`;
}

function renderGuidedValidationSteps(procedure, state) {
  return procedure.steps.map((step) => {
    const checked = getGuidedSopCheckedSteps(state.sopRun, procedure.id).includes(String(step.number));
    const audit = getLatestLocalStepEvent(procedure.id, step.number);
    const auditLabel = checked && audit ? `<small class="step-audit-label">Marcó ${escapeHtml(audit.actor.name)} · ${escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(audit.at)))}</small>` : "";
    return `<div class="guided-check-item ${checked ? "guided-check-item--checked" : ""}">
      <input id="validation-step-${escapeHtml(step.number)}" type="checkbox" data-step="${escapeHtml(step.number)}" data-focus-key="step-${escapeHtml(step.number)}" aria-label="Realicé el paso ${escapeHtml(step.number)}: ${escapeHtml(step.text)}" ${checked ? "checked" : ""} />
      <div class="guided-check-details"><label for="validation-step-${escapeHtml(step.number)}" class="guided-check-copy"><strong>Realicé el paso ${escapeHtml(step.number)}</strong><span>${escapeHtml(step.text)}</span>${step.sourceNote ? `<small class="validation-source-note">${escapeHtml(step.sourceNote)}</small>` : ""}${auditLabel}</label>${step.images?.length ? renderStepImages(step, procedure.sheet) : ""}</div>
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

function renderGuidedDocumentPage(procedure, state) {
  const pdfUrl = state.sopPdfUrl || SOP_DOCUMENT.pdfPath;
  return pdfUrl
    ? `<div class="guided-pdf-viewport"><canvas id="guided-sop-canvas" aria-label="PDF original · hoja ${escapeHtml(procedure.sheet)}"></canvas><p class="guided-pdf-status" role="status">Cargando hoja del PDF…</p></div>`
    : `<div class="guided-sop-no-pdf"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span><p>El PDF original no está disponible en este navegador. Puedes revisar y validar los pasos detectados.</p></div>`;
}

let guidedPdfSource = "";
let guidedPdfLoadingTask = null;
let guidedPdfDocumentPromise = null;
let guidedPdfRenderTask = null;
let guidedPdfRenderGeneration = 0;

async function renderGuidedSopDocument(procedure, state) {
  const canvas = document.querySelector("#guided-sop-canvas");
  const status = document.querySelector(".guided-pdf-status");
  if (!canvas || !status) return;
  const source = state.sopPdfUrl || SOP_DOCUMENT.pdfPath;
  const previousRenderTask = guidedPdfRenderTask;
  guidedPdfRenderTask = null;
  try { previousRenderTask?.cancel?.(); } catch {}
  const generation = ++guidedPdfRenderGeneration;
  try {
    const pdfjs = await loadSopPdfJs();
    if (generation !== guidedPdfRenderGeneration) return;
    if (source !== guidedPdfSource || !guidedPdfDocumentPromise) {
      guidedPdfRenderTask?.cancel?.();
      guidedPdfLoadingTask?.destroy?.();
      guidedPdfSource = source;
      const assetRoot = new URL("./public/vendor/pdfjs/", document.baseURI).href;
      guidedPdfLoadingTask = pdfjs.getDocument({
        url: new URL(source, document.baseURI).href,
        standardFontDataUrl: `${assetRoot}standard_fonts/`,
        cMapUrl: `${assetRoot}cmaps/`,
        cMapPacked: true,
        verbosity: pdfjs.VerbosityLevel?.ERROR,
      });
      guidedPdfDocumentPromise = guidedPdfLoadingTask.promise;
    }
    const pdf = await guidedPdfDocumentPromise;
    if (generation !== guidedPdfRenderGeneration) return;
    const page = await pdf.getPage(procedure.pdfPage ?? procedure.sheet);
    if (generation !== guidedPdfRenderGeneration) return;
    const baseViewport = page.getViewport({ scale: 1 });
    const width = Math.max(240, canvas.parentElement?.clientWidth ?? 720);
    const fitScale = width / baseViewport.width;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const viewport = page.getViewport({ scale: fitScale * pixelRatio });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.ceil(baseViewport.width * fitScale)}px`;
    canvas.style.height = `${Math.ceil(baseViewport.height * fitScale)}px`;
    canvas.hidden = false;
    status.hidden = false;
    status.textContent = "Dibujando hoja del PDF…";
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const renderTask = page.render({ canvasContext: context, viewport });
    guidedPdfRenderTask = renderTask;
    await renderTask.promise;
    if (generation !== guidedPdfRenderGeneration) return;
    if (guidedPdfRenderTask === renderTask) guidedPdfRenderTask = null;
    canvas.dataset.renderedPage = String(procedure.pdfPage ?? procedure.sheet);
    status.hidden = true;
  } catch (error) {
    if (generation !== guidedPdfRenderGeneration) return;
    canvas.hidden = true;
    status.hidden = false;
    status.textContent = "No se pudo mostrar el PDF original. Revisa las instrucciones detectadas o vuelve a cargar el archivo.";
    console.warn("No se pudo dibujar la hoja de la SOP en el visor.", error);
  }
}

function renderGuidedFinalConfirmation(procedure, state) {
  const run = state.sopRun;
  const document = run?.document ?? SOP_DOCUMENT;
  const name = String(state.form.nodeNumber ?? "").trim() || "nodo sin número";
  const serial = String(state.form.serial ?? "").trim() || "serie sin capturar";
  const operation = document.title || procedure.title || "procedimiento SOP";
  const accepted = Boolean(state.form.declaration);
  return `<section class="guided-final-confirmation" aria-labelledby="guided-confirmation-heading">
    <p class="eyebrow">Revisión final · ${escapeHtml(document.id)}</p>
    <h3 id="guided-confirmation-heading" data-focus-key="guided-confirmation-heading">Confirma el procedimiento realizado</h3>
    <p class="guided-confirmation-copy">¿Confirmas que el procedimiento <strong>${escapeHtml(operation)}</strong>, revisión <strong>${escapeHtml(document.revision)}</strong>, para el nodo <strong id="guided-confirmation-node">${escapeHtml(name)}</strong> (serie <strong id="guided-confirmation-serial">${escapeHtml(serial)}</strong>), se realizó de acuerdo con los procedimientos establecidos por la empresa?</p>
    <p class="guided-confirmation-warning">Cualquier daño, desviación o situación fuera de lo esperado debe reportarse para recibir la retroalimentación correspondiente.</p>
    <div class="guided-confirmation-summary"><div><span>SOP utilizada</span><strong>${escapeHtml(operation)}</strong></div><div><span>Revisión</span><strong>${escapeHtml(document.revision)}</strong></div><div><span>Hojas validadas</span><strong>${run.procedureIds.length}</strong></div><div><span>Pasos validados</span><strong>${getGuidedSopProgress(run, SOP_SHEETS).complete}</strong></div><div><span>Operador responsable</span><strong>${escapeHtml(state.form.name)} · ${escapeHtml(state.form.employeeNumber)}</strong></div></div>
    <label class="declaration-check guided-final-declaration"><input type="checkbox" name="declaration" data-form-field="declaration" ${accepted ? "checked" : ""} ${state.formError.includes("Confirm") ? 'aria-describedby="completion-form-error" aria-invalid="true"' : ""} />
      <span>Confirmo que realicé todos los pasos de esta SOP y que reportaré cualquier daño o desviación para recibir la retroalimentación correspondiente.</span>
    </label>
    <div class="guided-final-actions"><button class="button button--secondary" type="button" data-action="previous-sop-sheet"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Revisar última hoja</button><button class="button button--primary validation-submit" type="submit" ${accepted ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Confirmar y guardar desensamble</button></div>
    <p class="validation-note">El registro guardará el nodo, la SOP y revisión utilizadas, los pasos confirmados, la fecha y el usuario conectado.</p>
  </section>`;
}

function renderOperatorValidationPanel(procedure, state) {
  const errorHidden = state.formError ? "" : "hidden";
  const equipmentFields = FIELDS.filter((field) => field.group === "equipment");
  const checkedCount = procedure.steps.filter((step) => getGuidedSopCheckedSteps(state.sopRun, procedure.id).includes(String(step.number))).length;
  const runProgress = getGuidedSopProgress(state.sopRun, SOP_SHEETS);
  const isComplete = isGuidedSopProcedureComplete(state.sopRun, procedure);
  const isLastProcedure = state.sopRun.currentIndex === state.sopRun.procedureIds.length - 1;
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const page = state.sopRun.currentIndex + 1;
  const runDetails = `<section class="guided-run-details" aria-label="Datos del nodo y del operador">
    <div class="validation-asset-grid">${equipmentFields.map((field) => renderField(field, state.form, state.formError)).join("")}</div>
    <div class="guided-run-detail-row"><div class="guided-run-operator"><span class="material-symbols-rounded" aria-hidden="true">person</span><span><strong>${escapeHtml(state.form.name)}</strong><small>${escapeHtml(state.form.employeeNumber)} · ${escapeHtml(state.form.position)}</small></span></div>
      <div class="guided-run-components">${renderComponentFields(state.form)}${activeWork?.workKind === "rework" ? renderReworkEvidenceSection(activeWork, state) : ""}</div></div>
  </section>`;
  const guidedPage = `<div class="guided-page-layout">
    <section class="guided-sop-page" aria-label="Documento original, hoja ${escapeHtml(procedure.sheet)}"><div class="guided-page-heading"><div><p class="eyebrow">${escapeHtml(procedure.category)} · hoja ${escapeHtml(procedure.sheet)} de ${escapeHtml(SOP_DOCUMENT.totalSheets)}</p><h3>${escapeHtml(procedure.title)}</h3></div><span>${escapeHtml(procedure.stepRange)}</span></div>${renderGuidedDocumentPage(procedure, state)}</section>
    <section class="guided-checklist-panel" aria-labelledby="guided-checklist-heading"><div class="guided-checklist-heading"><div><p class="eyebrow">Hoja ${page} de ${state.sopRun.procedureIds.length}</p><h3 id="guided-checklist-heading">Checklist de validación</h3></div><span>${checkedCount} de ${procedure.steps.length}</span></div>
      <p class="guided-progress-copy">${runProgress.complete} de ${runProgress.total} pasos confirmados en toda la SOP.</p>
      <div class="guided-checklist-list" role="group" aria-label="Confirma cada paso de la hoja ${escapeHtml(procedure.sheet)}">${renderGuidedValidationSteps(procedure, state)}</div>
      <p class="form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
      <div class="guided-sheet-actions"><button class="button button--secondary" type="button" data-action="previous-sop-sheet" ${state.sopRun.currentIndex === 0 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Anterior</button><button class="button button--primary" type="button" data-action="continue-sop-sheet" ${isComplete ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">${isLastProcedure ? "fact_check" : "arrow_forward"}</span>${isLastProcedure ? "Revisar confirmación" : "Continuar"}</button></div>
      <small class="guided-checklist-note">Marca todos los pasos de esta hoja para habilitar Continuar.</small>
    </section>
  </div>`;

  return `<section class="validation-panel" aria-labelledby="validation-heading">
    <div class="validation-panel-heading"><span class="heading-icon material-symbols-rounded" aria-hidden="true">how_to_reg</span>
      <div><p class="eyebrow">Validación guiada · ${page} de ${state.sopRun.procedureIds.length} hojas con pasos</p><h2 id="validation-heading">${escapeHtml(SOP_DOCUMENT.title)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</h2></div>
      <button class="icon-button validation-dialog-close" type="button" data-action="close-validation-dialog" aria-label="Cerrar registro"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
    </div>
    <form id="completion-form" novalidate>
      ${runDetails}
      ${state.sopRun.stage === "confirmation" ? renderGuidedFinalConfirmation(procedure, state) : guidedPage}
      <p class="form-error" id="completion-form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.formError)}</p>
      ${state.sopRun.stage === "confirmation" ? "" : `<p class="validation-note">El registro final queda vinculado a ${escapeHtml(state.form.name)} · ${escapeHtml(state.form.employeeNumber)}.</p>`}
    </form>
  </section>`;
}

function renderOperatorValidationDialog(procedure, state) {
  return `<dialog class="validation-dialog" id="validation-dialog" aria-labelledby="validation-heading">${state.sopRun ? renderOperatorValidationPanel(procedure, state) : ""}</dialog>`;
}
