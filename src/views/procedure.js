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

function renderStationSopContext(state, procedure) {
  const assignment = getWorkStationAssignment(state.form.stationAssignment);
  const user = getActiveLocalUser();
  const document = state.sopRun?.document ?? SOP_DOCUMENT;
  const stationLabel = assignment ? `${assignment.type} · ${assignment.label}` : "Estación sin asignar";
  return `<section class="station-sop-context" aria-label="Datos registrados para esta validación">
    <div class="station-context-tile station-context-tile--station"><span class="material-symbols-rounded" aria-hidden="true">factory</span><span><small>Estación</small><strong>${escapeHtml(stationLabel)}</strong></span></div>
    <div class="station-context-tile station-context-tile--node"><span class="material-symbols-rounded" aria-hidden="true">dns</span><span><small>Nodo</small><strong>PN ${escapeHtml(state.form.nodePartNumber || "—")}</strong><small>Serie ${escapeHtml(state.form.serial || "—")}</small></span></div>
    <div class="station-context-tile station-context-tile--card"><span class="material-symbols-rounded" aria-hidden="true">memory</span><span><small>Tarjeta</small><strong>PN ${escapeHtml(state.form.componentPartNumber || "—")}</strong><small>Serie ${escapeHtml(state.form.componentSerial || "—")}</small></span></div>
    <div class="station-context-tile station-context-tile--sop"><span class="material-symbols-rounded" aria-hidden="true">description</span><span><small>SOP utilizada · ${escapeHtml(user.name)}</small><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(document.id)} · Rev. ${escapeHtml(document.revision)} · Hoja ${escapeHtml(procedure.sheet)}</small></span></div>
  </section>`;
}

function renderProcedurePanel(procedure, state) {
  const user = getActiveLocalUser();
  const run = state.sopRun;
  const progress = getGuidedSopProgress(run, PROCEDURES);
  const checkedSteps = new Set(getGuidedSopCheckedSteps(run, procedure.id));
  const checkedCount = procedure.steps.filter((step) => checkedSteps.has(String(step.number))).length;
  const pageNumber = procedure.pdfPage ?? procedure.sheet;
  const totalSheets = Number(SOP_DOCUMENT.totalSheets) || 46;
  const pageZoom = Math.max(50, Math.min(150, Number(state.sopPageZoom) || 100));
  const pdfSource = state.sopPdfUrl || SOP_DOCUMENT.pdfPath || "";
  const isComplete = isGuidedSopProcedureComplete(run, procedure);
  const isFirstPage = (run?.currentIndex ?? 0) === 0;
  const isLastPage = (run?.currentIndex ?? 0) >= (run?.procedureIds.length ?? 1) - 1;
  const canOperate = canOperateGuidedSopRun();
  const sourceUrl = pdfSource ? `${pdfSource}#page=${pageNumber}` : "";
  const ownerMessage = !canOperate
    ? `<aside class="sop-owner-lock" role="status"><span class="material-symbols-rounded" aria-hidden="true">lock</span>Este recorrido pertenece a ${escapeHtml(run.startedBy?.name ?? "otro operador")} (${escapeHtml(run.startedBy?.employeeNumber ?? "sin número")}). Inicia sesión con esa cuenta para continuar.</aside>`
    : "";
  const completedPercent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
  const nextAction = run.stage === "confirmation" ? "open-final-confirmation" : "continue-sop-sheet";
  const nextProcedure = !isLastPage ? PROCEDURES.find((item) => item.id === run.procedureIds[run.currentIndex + 1]) : null;
  const nextLabel = run.stage === "confirmation" ? "Reabrir confirmación final" : isLastPage ? "Ir a confirmación final" : `Continuar a hoja ${nextProcedure?.sheet ?? "siguiente"}`;
  const sheetPercent = procedure.steps.length ? Math.round(checkedCount / procedure.steps.length * 100) : 0;
  const serialSummary = state.form.serial?.trim() ? `Serie ${escapeHtml(state.form.serial.trim())}` : "Serie pendiente";

  return `<section class="procedure-panel sop-execution-panel" aria-label="Seguimiento y validación de la SOP">
    ${renderOperatorFlowProgress(run.stage === "confirmation" ? 3 : 2)}
    ${renderStationSopContext(state, procedure)}
    ${renderActiveSopVersionSelector(state, procedure)}
    ${ownerMessage}
    <div class="guided-page-layout sop-page-checklist-layout">
      <section class="guided-sop-page" aria-label="Hoja completa ${escapeHtml(procedure.sheet)} de la SOP">
        <div class="guided-page-toolbar">
          <div class="guided-page-heading"><span class="material-symbols-rounded" aria-hidden="true">description</span><strong>Hoja ${escapeHtml(procedure.sheet)} <small>de ${escapeHtml(totalSheets)}</small></strong></div>
          <div class="sop-page-zoom-controls" role="group" aria-label="Tamaño de la hoja SOP">
            <button class="icon-button" type="button" data-action="sop-page-zoom-out" aria-label="Reducir hoja SOP" ${pageZoom <= 50 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>
            <output id="sop-page-zoom-level" aria-live="polite">${pageZoom}%</output>
            <button class="icon-button" type="button" data-action="sop-page-zoom-in" aria-label="Ampliar hoja SOP" ${pageZoom >= 150 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
            <button class="text-button" type="button" data-action="sop-page-zoom-reset" aria-label="Ajustar hoja completa">Ajustar</button>
          </div>
          ${sourceUrl ? `<a class="guided-page-open-pdf" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer" aria-label="Abrir PDF en página ${escapeHtml(pageNumber)}"><span class="material-symbols-rounded" aria-hidden="true">open_in_new</span></a>` : ""}
        </div>
        <div class="guided-pdf-viewport" id="sop-page-preview" data-pdf-source="${escapeHtml(pdfSource)}" data-pdf-page="${escapeHtml(pageNumber)}" data-zoom="${pageZoom}" role="group" aria-label="Vista completa del PDF, página ${escapeHtml(pageNumber)}">
          <canvas aria-label="Página ${escapeHtml(pageNumber)} completa de ${escapeHtml(SOP_DOCUMENT.title)}"></canvas>
          <iframe title="Hoja ${escapeHtml(procedure.sheet)} completa de la SOP" hidden></iframe>
          <p class="guided-pdf-status" role="status" aria-live="polite">Cargando hoja completa…</p>
        </div>
        <footer class="guided-page-footer"><span>${escapeHtml(SOP_DOCUMENT.id)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</span><span>${escapeHtml(procedure.category)} · ${procedure.steps.length} pasos</span></footer>
      </section>
      <section class="guided-checklist-panel" aria-label="Validación de hoja ${escapeHtml(procedure.sheet)}">
        <header class="guided-checklist-titlebar"><div><p class="eyebrow">Validación de hoja</p><h2>Hoja ${escapeHtml(procedure.sheet)} <small>de ${escapeHtml(totalSheets)}</small></h2></div><span class="guided-checklist-heading-count">${checkedCount} de ${procedure.steps.length} pasos</span></header>
        <p class="guided-checklist-intro">Marca cada paso conforme lo completes en la estación.</p>
        <div class="sop-run-progress" role="group" aria-label="Progreso de esta hoja"><div class="sop-run-progress-track"><span style="width:${sheetPercent}%"></span></div><strong>${checkedCount} de ${procedure.steps.length} pasos · ${sheetPercent}%</strong></div>
        <div class="guided-checklist-list sop-sheet-step-list" role="group" aria-label="Pasos de la hoja ${escapeHtml(procedure.sheet)}">${renderGuidedValidationSteps(procedure, state, !canOperate, false)}</div>
        <p class="form-error sop-run-error" id="sop-run-error" role="alert" aria-live="polite" ${state.formError ? "" : "hidden"}>${escapeHtml(state.formError)}</p>
        <aside class="guided-checklist-note-box"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Verifica físicamente cada paso antes de marcarlo como realizado.</span></aside>
        <div class="guided-checklist-footer">
          <small class="guided-checklist-note">${isComplete ? "Hoja completa. Ya puedes continuar." : `Completa los ${procedure.steps.length - checkedCount} pasos pendientes para avanzar.`}</small>
          <div class="guided-sheet-actions">
            ${!isFirstPage ? `<button class="button button--secondary guided-previous-button" type="button" data-action="previous-sop-sheet" data-focus-key="previous-sop-sheet" ${canOperate ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Anterior</button>` : ""}
            <button class="button button--primary guided-continue-button" type="button" data-action="${nextAction}" data-focus-key="continue-sop-sheet" ${!canOperate || run.stage !== "confirmation" && !isComplete ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${run.stage === "confirmation" ? "fact_check" : "arrow_forward"}</span>${nextLabel}</button>
          </div>
        </div>
        <div class="guided-checklist-operator"><span class="profile-avatar">${escapeHtml(user.name.slice(0, 2).toLocaleUpperCase("es-MX"))}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || "Técnico de FA")}</small></span><span class="guided-progress-copy">${progress.complete} / ${progress.total} SOP</span></div>
      </section>
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
