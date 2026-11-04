function renderStepImages(step, sheet) {
  if (!step.images?.length) return '<span class="step-image-empty">Referencia visual no disponible</span>';
  const imageLayout = step.images.length > 1 ? "step-visuals--scrollable" : "step-visuals--single";
  return `<div class="step-visuals ${imageLayout}" role="group" tabindex="0" aria-label="Imágenes de referencia del paso ${escapeHtml(step.number)}. Desplaza horizontalmente para ver las imágenes adicionales.">
    ${step.images.map((image) => `<button class="step-image-button" type="button" data-action="zoom-step-image"
      data-image-src="${escapeHtml(image.src)}" data-image-alt="${escapeHtml(image.alt)}"
      data-step-text="${escapeHtml(step.text)}"
      data-step-number="${escapeHtml(step.number)}" data-sheet="${sheet}"
      aria-label="Ampliar la imagen del paso ${escapeHtml(step.number)}">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async" />
      <span class="step-image-zoom"><span class="material-symbols-rounded" aria-hidden="true">zoom_in</span>Ampliar</span>
    </button>`).join("")}
  </div>`;
}

function renderProcedureSteps(procedure, state, hasMoreSteps) {
  const steps = procedure.steps.map((step) => `<article class="procedure-step-item">
    <span class="step-number" aria-hidden="true">${escapeHtml(step.number)}</span>
    <div class="step-content"><small>Paso ${escapeHtml(step.number)}</small><span>${escapeHtml(step.text)}</span>${step.sourceNote ? `<small class="step-source-note"><span class="material-symbols-rounded" aria-hidden="true">warning</span>${escapeHtml(step.sourceNote)}</small>` : ""}</div>
    ${renderStepImages(step, procedure.sheet)}
  </article>`).join("");

  return `<div class="procedure-steps-heading"><div><p class="eyebrow">Secuencia ${escapeHtml(procedure.stepRange)}</p><h3>Pasos del procedimiento</h3>${hasMoreSteps ? '<small class="procedure-scroll-hint">Desplaza horizontalmente para ver los demás pasos.</small>' : ""}</div><span>${procedure.steps.length} pasos</span></div>
    <div class="procedure-step-list procedure-step-list--scroll" role="region" tabindex="0" aria-label="Pasos del procedimiento${hasMoreSteps ? ". Desplaza horizontalmente para ver el resto" : ""}.">${steps}</div>
    <div class="step-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Revisa cada instrucción y su referencia visual. Marca su validación en el panel del operador.</span></div>`;
}

function renderContextSheets(state, procedure) {
  const run = state.sopRun;
  const choice = getStationDisassemblyChoice(state);
  const describe = (item) => choice.options.find((option) => option.id === item.id)?.description || item.title || "";
  const sheets = (run?.procedureIds ?? []).map((id) => PROCEDURES.find((item) => item.id === id)).filter(Boolean);
  const isDisassembly = Boolean(run?.disassembly?.sheets?.length);
  const listed = isDisassembly && sheets.length <= 6 ? sheets : [procedure];
  const title = isDisassembly ? `${sheets.length === 1 ? "Hoja" : "Hojas"} del desensamble` : "Hoja en validación";
  const summary = isDisassembly && sheets.length > 6 ? `<strong class="station-context-sheet-summary">${escapeHtml(run.disassembly.label)} · ${sheets.length} hojas</strong>` : "";
  return `<div class="station-context-tile station-context-tile--sheets"><span class="material-symbols-rounded" aria-hidden="true">${isDisassembly ? "build_circle" : "description"}</span><span><small>${title}</small>${summary}<ul class="station-context-sheet-list">${listed.map((item) => `<li class="${item.id === procedure.id ? "is-current" : ""}"><b>Hoja ${escapeHtml(item.sheet)}</b>${describe(item) && describe(item) !== `Hoja ${item.sheet}` ? `<span>${escapeHtml(describe(item))}</span>` : ""}</li>`).join("")}</ul></span></div>`;
}

function renderStationSopContext(state, procedure) {
  return `<section class="station-sop-context" aria-label="Datos registrados para esta validación">
    <div class="station-context-tile station-context-tile--node"><span class="material-symbols-rounded" aria-hidden="true">dns</span><span><small>Nodo</small><strong>PN ${escapeHtml(state.form.nodePartNumber || "—")}</strong><small>Serie ${escapeHtml(state.form.serial || "—")}</small></span></div>
    <div class="station-context-tile station-context-tile--card"><span class="material-symbols-rounded" aria-hidden="true">memory</span><span><small>Tarjeta</small><strong>PN ${escapeHtml(state.form.componentPartNumber || "—")}</strong><small>Serie ${escapeHtml(state.form.componentSerial || "—")}</small></span></div>
    ${renderContextSheets(state, procedure)}
  </section>`;
}

function renderProcedurePanel(procedure, state) {
  const user = getActiveLocalUser();
  const run = state.sopRun;
  const progress = getGuidedSopProgress(run, PROCEDURES);
  const checkedSteps = new Set(getGuidedSopCheckedSteps(run, procedure.id));
  const checkedCount = procedure.steps.filter((step) => checkedSteps.has(String(step.number))).length;
  const canOperate = canOperateGuidedSopRun();
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const hasHandoffTarget = !activeWork || isActiveHandoffWorkItem(activeWork);
  const canHandoffOperator = state.sopStorageReady && Boolean(run) && state.operatorFlowReady && hasHandoffTarget && canOperate;
  const pageNumber = procedure.pdfPage ?? procedure.sheet;
  const totalSheets = Number(SOP_DOCUMENT.totalSheets) || 46;
  const restricted = Boolean(run?.disassembly?.sheets?.length);
  const sheetOfLabel = restricted ? `${(run.currentIndex ?? 0) + 1} de ${run.procedureIds.length} elegidas` : `de ${escapeHtml(totalSheets)}`;
  const pageZoom = Math.max(50, Math.min(500, Number(state.sopPageZoom) || 110));
  const pdfSource = state.sopPdfUrl || SOP_DOCUMENT.pdfPath || "";
  const isComplete = isGuidedSopProcedureComplete(run, procedure);
  const isFirstPage = (run?.currentIndex ?? 0) === 0;
  const isLastPage = (run?.currentIndex ?? 0) >= (run?.procedureIds.length ?? 1) - 1;
  const sourceUrl = pdfSource && !restricted ? `${pdfSource}#page=${pageNumber}` : "";
  const currentOperator = getGuidedSopCurrentOperator(run);
  const ownerMessage = !canOperate
    ? `<aside class="sop-owner-lock" role="status"><span class="material-symbols-rounded" aria-hidden="true">lock</span>Este recorrido está asignado a ${escapeHtml(currentOperator?.name ?? "otro operador")} (${escapeHtml(currentOperator?.employeeNumber ?? "sin número")}). Inicia sesión con esa cuenta para continuar.</aside>`
    : "";
  const completedPercent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
  const nextAction = run.stage === "confirmation" ? "open-final-confirmation" : "continue-sop-sheet";
  const nextProcedure = !isLastPage ? PROCEDURES.find((item) => item.id === run.procedureIds[run.currentIndex + 1]) : null;
  const nextLabel = run.stage === "confirmation" ? "Reabrir confirmación final" : isLastPage ? "Ir a confirmación final" : `Continuar a hoja ${nextProcedure?.sheet ?? "siguiente"}`;
  const sheetPercent = procedure.steps.length ? Math.round(checkedCount / procedure.steps.length * 100) : 0;
  const serialSummary = state.form.serial?.trim() ? `Serie ${escapeHtml(state.form.serial.trim())}` : "Serie pendiente";

  const sopDocument = run.document ?? SOP_DOCUMENT;
  const sopPercent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
  const sheetBadge = restricted ? `HOJA ${escapeHtml(procedure.sheet)} · ${(run.currentIndex ?? 0) + 1} DE ${run.procedureIds.length}` : `HOJA ${escapeHtml(procedure.sheet)} DE ${escapeHtml(totalSheets)}`;
  const currentStepNumber = Math.min(checkedCount + 1, procedure.steps.length);
  const confirmLabel = isComplete ? "¡Hoja completa!" : `Confirmar paso (${currentStepNumber}/${procedure.steps.length})`;
  const safetyNote = procedure.steps.find((step) => step.sourceNote)?.sourceNote
    || "Verifica el P/N y la serie escaneados antes de intervenir el equipo y consulta a tu supervisor ante cualquier duda.";
  const sheetsChips = (run.procedureIds ?? []).map((id) => PROCEDURES.find((item) => item.id === id)).filter(Boolean)
    .map((item) => `<li class="${item.id === procedure.id ? "is-current" : ""}">Hoja ${escapeHtml(item.sheet)}</li>`).join("");
  const stepSummary = procedure.steps.map((step, index) => `<li><span aria-hidden="true">${index + 1}</span>${escapeHtml(step.text)}</li>`).join("");
  const recordDate = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(",", "");
  const evidenceFile = (state.validationEvidenceFiles ?? [])[0];
  const evidenceCell = evidenceFile
    ? `<span class="sop-record-evidence"><span class="material-symbols-rounded" aria-hidden="true">image</span><span class="sop-record-file" title="${escapeHtml(evidenceFile.name)}">${escapeHtml(evidenceFile.name)}</span><span class="material-symbols-rounded sop-record-ok" aria-hidden="true">check_circle</span></span>`
    : '<span class="sop-record-empty">Sin evidencia adjunta</span>';
  const observationValue = state.sheetObservations?.[procedure.id] ?? "";

  return `<section class="procedure-panel sop-execution-panel" aria-label="Seguimiento y validación de la SOP">
    <header class="sop-run-header">
      <div class="sop-run-title"><h2>SOP: ${escapeHtml(sopDocument.title)}</h2><div class="sop-run-meta"><span class="sop-run-version">${escapeHtml(sopDocument.id)} · Versión ${escapeHtml(sopDocument.revision)}</span><span class="sop-run-unit"><span class="material-symbols-rounded" aria-hidden="true">dns</span>Nodo PN ${escapeHtml(state.form.nodePartNumber || "—")} · ${escapeHtml(state.form.serial || "—")}</span><span class="sop-run-unit"><span class="material-symbols-rounded" aria-hidden="true">memory</span>Tarjeta PN ${escapeHtml(state.form.componentPartNumber || "—")} · ${escapeHtml(state.form.componentSerial || "—")}</span></div></div>
      <span class="sop-sheet-badge"><span class="material-symbols-rounded" aria-hidden="true">layers</span>${sheetBadge}</span>
      <div class="sop-total-progress" role="group" aria-label="Progreso de la SOP"><span>Progreso de la SOP</span><div class="sop-total-progress-track"><span data-sop-progress-bar style="width:${sopPercent}%"></span></div><strong data-sop-progress-pct>${sopPercent}%</strong></div>
    </header>
    ${ownerMessage}
    <div class="guided-page-layout sop-page-checklist-layout" data-page-zoom="${pageZoom}">
      <section class="guided-sop-page" aria-label="Hoja completa ${escapeHtml(procedure.sheet)} de la SOP">
        <div class="guided-page-toolbar">
          <div class="guided-page-heading"><span class="material-symbols-rounded" aria-hidden="true">search</span><strong><span class="guided-page-sheet">Hoja ${escapeHtml(procedure.sheet)}</span><span class="guided-page-title">${escapeHtml(procedure.title)}</span></strong></div>
          <div class="sop-page-zoom-controls" role="group" aria-label="Tamaño de la hoja SOP">
            <button class="icon-button" type="button" data-action="sop-page-zoom-out" aria-label="Reducir hoja SOP" ${pageZoom <= 50 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>
            <output id="sop-page-zoom-level" aria-live="polite">${pageZoom}%</output>
            <button class="icon-button" type="button" data-action="sop-page-zoom-in" aria-label="Ampliar hoja SOP" ${pageZoom >= 500 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
            <button class="icon-button" type="button" data-action="sop-page-zoom-reset" aria-label="Ajustar hoja completa" title="Ajustar a la pantalla"><span class="material-symbols-rounded" aria-hidden="true">fit_screen</span></button>
            <button class="button button--outlined guided-focus-zoom-button" type="button" data-action="sop-page-toggle-focused-zoom" aria-pressed="${Boolean(state.sopFocusedZoom)}" aria-describedby="sop-page-focus-zoom-hint"><span class="material-symbols-rounded" aria-hidden="true">center_focus_strong</span>Acercar a una zona</button>
          </div>
          ${sourceUrl ? `<a class="guided-page-open-pdf" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer" aria-label="Abrir PDF en página ${escapeHtml(pageNumber)}"><span class="material-symbols-rounded" aria-hidden="true">open_in_new</span></a>` : ""}
        </div>
        <div class="guided-pdf-viewport" id="sop-page-preview" data-pdf-source="${escapeHtml(pdfSource)}" data-pdf-page="${escapeHtml(pageNumber)}" data-restricted="${restricted}" data-zoom="${pageZoom}" data-focus-zoom="${Boolean(state.sopFocusedZoom)}" role="group" aria-label="Vista completa del PDF, página ${escapeHtml(pageNumber)}">
          <div class="guided-pdf-canvas-wrap"><canvas aria-label="Página ${escapeHtml(pageNumber)} completa de ${escapeHtml(SOP_DOCUMENT.title)}"></canvas>${renderSopAnnotationOverlay(procedure.annotations ?? [], false, procedure.pageAspect)}<svg class="guided-zoom-selection-overlay" data-sop-zoom-selection-overlay viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" hidden><rect data-sop-zoom-selection-box x="0" y="0" width="0" height="0" /></svg></div>
          <iframe title="Hoja ${escapeHtml(procedure.sheet)} completa de la SOP" hidden></iframe>
          <span class="guided-focus-zoom-hint" id="sop-page-focus-zoom-hint" role="status" ${state.sopFocusedZoom ? "" : "hidden"}>Dibuja un recuadro sobre la hoja para acercar esa zona.</span>
          <p class="guided-pdf-status" role="status" aria-live="polite">Cargando hoja completa…</p>
        </div>
      </section>
      <section class="guided-checklist-panel" aria-label="Validación de hoja ${escapeHtml(procedure.sheet)}">
        <header class="guided-checklist-titlebar"><div><p class="eyebrow">Hoja ${escapeHtml(procedure.sheet)}</p><h2>${procedure.steps.length === 1 ? "1 paso" : `${procedure.steps.length} pasos`} por validar</h2></div><span class="guided-checklist-heading-count" title="Pasos completados">${checkedCount}/${procedure.steps.length}</span></header>
        <div class="sop-run-progress" role="group" aria-label="Progreso de esta hoja"><div class="sop-run-progress-track"><span style="width:${sheetPercent}%"></span></div><strong>${sheetPercent}%</strong></div>
        <div class="guided-checklist-list sop-sheet-step-list" role="group" aria-label="Pasos de la hoja ${escapeHtml(procedure.sheet)}">${renderGuidedValidationSteps(procedure, state, !canOperate, false)}</div>
        <p class="form-error sop-run-error" id="sop-run-error" role="alert" aria-live="polite" ${state.formError ? "" : "hidden"}>${escapeHtml(state.formError)}</p>
      </section>
    </div>
    <div class="sop-info-row">
      <section class="sop-info-card sop-summary-card" aria-label="Resumen del procedimiento">
        <span class="sop-info-icon"><span class="material-symbols-rounded" aria-hidden="true">format_list_bulleted</span></span>
        <div class="sop-summary-title"><h3>Procedimiento</h3><span>(Hoja ${escapeHtml(procedure.sheet)})</span>${sheetsChips ? `<ul class="sop-sheet-chips" aria-label="Hojas elegidas">${sheetsChips}</ul>` : ""}</div>
        <ol class="sop-summary-list">${stepSummary}</ol>
      </section>
      <aside class="sop-safety-note" role="note"><span class="sop-safety-icon material-symbols-rounded" aria-hidden="true">warning</span><div><strong>Nota de seguridad</strong><p>${escapeHtml(safetyNote)}</p></div></aside>
    </div>
    <div class="sop-info-row">
      <section class="sop-info-card sop-observations-card" aria-label="Observaciones de la hoja">
        <label for="sheet-observation"><span class="material-symbols-rounded" aria-hidden="true">chat_bubble</span>Observaciones</label>
        <textarea id="sheet-observation" data-sheet-observation="${escapeHtml(procedure.id)}" rows="1" maxlength="500" placeholder="Escribe observaciones de la Hoja ${escapeHtml(procedure.sheet)}…" ${canOperate ? "" : "disabled"}>${escapeHtml(observationValue)}</textarea>
      </section>
      <section class="sop-info-card sop-record-card" aria-label="Registro de trazabilidad">
        <h3><span class="material-symbols-rounded" aria-hidden="true">assignment</span>Registro (trazabilidad)</h3>
        <dl>
          <div><dt>Fecha:</dt><dd>${escapeHtml(recordDate)}</dd></div>
          <div><dt>Operador:</dt><dd>${escapeHtml(user.name)}</dd></div>
          <div class="sop-record-evidence-field"><dt>Evidencia:</dt><dd>${evidenceCell}</dd></div>
        </dl>
      </section>
    </div>
    <div class="sop-action-bar">
      <div class="sop-action-side sop-action-side--left">
        ${!isFirstPage ? `<button class="button sop-action-previous guided-previous-button" type="button" data-action="previous-sop-sheet" data-focus-key="previous-sop-sheet" ${canOperate ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Anterior</button>` : ""}
        <button class="button sop-action-return guided-return-selection" type="button" data-action="return-to-sop-selection" ${canOperate ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Regresar a selección de SOP</button>
        ${canHandoffOperator ? `<button class="button sop-action-handoff guided-handoff-button" type="button" data-action="open-operator-handoff" data-focus-key="change-operator" ${state.evidenceBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.evidenceBusy ? "hourglass_top" : "swap_horiz"}</span>${state.evidenceBusy ? "Guardando avance…" : "Cambiar operador"}</button>` : ""}
      </div>
      <div class="sop-action-side sop-action-side--right">
        <button class="button sop-action-confirm" type="button" data-action="confirm-current-step" data-focus-key="confirm-current-step" data-complete="${isComplete}" ${!canOperate || isComplete ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">check_circle</span><span data-confirm-label>${confirmLabel}</span></button>
        <button class="button sop-action-next guided-continue-button" type="button" data-action="${nextAction}" data-focus-key="continue-sop-sheet" ${!canOperate || run.stage !== "confirmation" && !isComplete ? "disabled" : ""}>${nextLabel}<span class="material-symbols-rounded" aria-hidden="true">${run.stage === "confirmation" ? "fact_check" : "arrow_forward"}</span></button>
      </div>
    </div>
  </section>`;
}

function renderSopSourceNotice(state) {
  if (!state.sopVersionMeta?.builtIn) {
    const author = state.sopVersionMeta?.createdBy ? ` Cargada por ${escapeHtml(state.sopVersionMeta.createdBy)}.` : "";
    return `<aside class="sop-source-notice" role="note"><span class="material-symbols-rounded" aria-hidden="true">verified</span><span><strong>SOP local activa · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}.</strong> ${author} El PDF y sus pasos están guardados en este navegador; aquí los demás usuarios ven la misma revisión activa. Solo la cuenta 140784 puede cargar o activar otra versión.</span></aside>`;
  }
  const discrepancyCount = PROCEDURES.reduce((count, procedure) => count + procedure.steps.filter((step) => step.sourceNote).length, 0);
  const savedSource = state.sopPdfName
    ? `<strong>PDF local:</strong> ${escapeHtml(state.sopPdfName)}.`
    : "Selecciona un PDF controlado para actualizar la referencia local.";
  return `<aside class="sop-source-notice" role="note"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span><span><strong>SOP incluida en el proyecto · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}.</strong> ${discrepancyCount} pasos tienen discrepancias de P/N anotadas. ${savedSource}</span></aside>`;
}

function renderStepImageDialog() {
  return `<dialog class="step-image-dialog" id="step-image-dialog" aria-labelledby="step-image-dialog-title">
    <div class="step-image-dialog-content"><div class="step-image-dialog-header"><div><p class="eyebrow">Imagen de referencia del paso</p><h2 id="step-image-dialog-title">Paso</h2></div>
      <div class="step-image-dialog-tools" aria-label="Controles de zoom">
        <button class="icon-button" type="button" data-action="step-image-zoom-out" aria-label="Reducir zoom"><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>
        <output id="step-image-zoom-level" aria-live="polite">100%</output>
        <button class="icon-button" type="button" data-action="step-image-zoom-in" aria-label="Aumentar zoom"><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
        <button class="icon-button" type="button" data-action="step-image-zoom-reset" aria-label="Restablecer zoom"><span class="material-symbols-rounded" aria-hidden="true">fit_screen</span></button>
      </div>
      <button class="icon-button" type="button" data-action="close-step-image" aria-label="Cerrar imagen ampliada"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
    </div><div class="step-image-dialog-viewport"><img id="step-image-preview" alt="" /></div>
      <p class="step-image-dialog-caption" id="step-image-caption"></p></div>
  </dialog>`;
}
