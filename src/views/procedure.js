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

function renderProcedurePanel(procedure, state) {
  const user = getActiveLocalUser();
  const run = state.sopRun;
  const totalPages = run?.procedureIds.length ?? 0;
  const currentPage = (run?.currentIndex ?? 0) + 1;
  const progress = getGuidedSopProgress(run, PROCEDURES);
  const checkedCount = procedure.steps.filter((step) => getGuidedSopCheckedSteps(run, procedure.id).includes(String(step.number))).length;
  const isComplete = isGuidedSopProcedureComplete(run, procedure);
  const isLastPage = currentPage === totalPages;
  const canOperate = canOperateGuidedSopRun();
  const pdfPath = state.sopPdfUrl || SOP_DOCUMENT.pdfPath;
  const sourceUrl = pdfPath ? `${pdfPath}#page=${procedure.pdfPage ?? procedure.sheet}` : "";
  const ownerMessage = !canOperate
    ? `<aside class="sop-owner-lock" role="status"><span class="material-symbols-rounded" aria-hidden="true">lock</span>Este recorrido pertenece a ${escapeHtml(run.startedBy?.name ?? "otro operador")} (${escapeHtml(run.startedBy?.employeeNumber ?? "sin número")}). Inicia sesión con esa cuenta para continuar.</aside>`
    : "";
  const completedPercent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
  const nextAction = run.stage === "confirmation" ? "open-final-confirmation" : "continue-sop-sheet";
  const nextLabel = run.stage === "confirmation" ? "Abrir confirmación final" : isLastPage ? "Finalizar recorrido" : "Siguiente hoja";

  return `<section class="procedure-panel sop-execution-panel" aria-label="Seguimiento y validación de la SOP">
    <div class="sop-workspace-toolbar">
      <div class="sop-workspace-document"><span class="material-symbols-rounded" aria-hidden="true">verified</span><span><strong>${escapeHtml(SOP_DOCUMENT.id)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</strong><small>${escapeHtml(SOP_DOCUMENT.title)}</small></span></div>
      <div class="sop-workspace-actions">${sourceUrl ? `<a class="text-button source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>PDF fuente</a>` : ""}
        ${canManageSopVersions(user) ? `<button class="text-button sop-update-button" type="button" data-action="navigate" data-nav-id="sop-admin" data-focus-key="nav-sop-admin"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Modificar SOP</button>` : ""}
        <button class="button button--secondary procedure-stop-button" type="button" data-action="open-work-item-dialog" ${canOperate ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">report_problem</span>Reportar incidencia</button>
      </div>
    </div>
    ${renderSopSourceNotice(state)}
    ${ownerMessage}
    <section class="sop-run-context" aria-label="Datos del nodo y operador">
      <div class="sop-run-context-heading"><div><p class="eyebrow">Registro de ejecución</p><h2>Identificación del equipo</h2></div><div class="procedure-identity-chip"><span class="material-symbols-rounded" aria-hidden="true">person</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div></div>
      <div class="sop-run-fields">
        <label class="sop-run-field">Número de nodo <span>Requerido</span><input name="nodeNumber" data-form-field="nodeNumber" data-focus-key="form-nodeNumber" value="${escapeHtml(state.form.nodeNumber ?? "")}" placeholder="Ej. NVD-000123" required ${canOperate ? "" : "disabled"} /></label>
        <label class="sop-run-field">Número de serie del nodo <span>Requerido</span><input name="serial" data-form-field="serial" data-focus-key="form-serial" value="${escapeHtml(state.form.serial ?? "")}" placeholder="Captura el serial" required ${canOperate ? "" : "disabled"} /></label>
        <label class="sop-run-field sop-run-field--optional">Número de parte del nodo <span>Opcional</span><input name="nodePartNumber" data-form-field="nodePartNumber" data-focus-key="form-nodePartNumber" value="${escapeHtml(state.form.nodePartNumber ?? "")}" placeholder="${escapeHtml(SOP_DOCUMENT.nodePartNumber ?? "Número de parte")}" ${canOperate ? "" : "disabled"} /></label>
      </div>
      <details class="sop-extra-fields"><summary>Datos de reparación y componente <span>Opcional</span></summary><div class="guided-run-components">${renderComponentFields(state.form)}</div></details>
    </section>
    <article class="sop-digital-sheet" aria-label="Hoja ${escapeHtml(procedure.sheet)} de la SOP">
      <header class="sop-digital-sheet-masthead"><div class="sop-sheet-brand"><span class="sop-sheet-brand-mark">I</span><span><strong>INGRASYS</strong><small>PROCEDIMIENTO OPERATIVO ESTÁNDAR</small></span></div><div class="sop-sheet-control"><span>Documento controlado</span><strong>${escapeHtml(SOP_DOCUMENT.id)}</strong><small>Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</small></div></header>
      <div class="sop-sheet-rule"></div>
      <div class="sop-sheet-title-row"><div><p class="eyebrow">${escapeHtml(procedure.category)} · hoja de trabajo ${currentPage} de ${totalPages}</p><h2>${escapeHtml(procedure.title)}</h2><p class="sop-sheet-subtitle">Hoja original ${escapeHtml(procedure.sheet)} · pasos ${escapeHtml(procedure.stepRange)}</p></div><span class="sop-sheet-page-number">${String(currentPage).padStart(2,"0")}<small>/ ${String(totalPages).padStart(2,"0")}</small></span></div>
      <div class="sop-run-progress" role="group" aria-label="Avance de la SOP"><div class="sop-run-progress-copy"><span>Avance del procedimiento</span><strong class="guided-progress-copy">${progress.complete} de ${progress.total} pasos · ${completedPercent}%</strong></div><div class="sop-run-progress-track"><span style="width:${completedPercent}%"></span></div></div>
      <div class="guided-checklist-heading sop-sheet-checklist-heading"><div><p class="eyebrow">Validación de esta hoja</p><h3>Confirma cada actividad antes de continuar</h3></div><span>${checkedCount} de ${procedure.steps.length}</span></div>
      <div class="guided-checklist-list sop-sheet-step-list" role="group" aria-label="Pasos de la hoja ${escapeHtml(procedure.sheet)}">${renderGuidedValidationSteps(procedure, state, !canOperate)}</div>
      <p class="form-error sop-run-error" id="sop-run-error" role="alert" aria-live="polite" ${state.formError ? "" : "hidden"}>${escapeHtml(state.formError)}</p>
      <footer class="sop-sheet-footer"><div><div class="sop-footer-operator"><span class="material-symbols-rounded" aria-hidden="true">badge</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div><small class="guided-checklist-note">${isComplete ? "Hoja completa. Puedes avanzar." : `Marca los ${procedure.steps.length - checkedCount} pasos restantes para habilitar el avance.`}</small></div><div class="guided-sheet-actions"><button class="button button--secondary" type="button" data-action="previous-sop-sheet" data-focus-key="previous-sop-sheet" ${currentPage === 1 || !canOperate ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Hoja anterior</button><button class="button button--primary" type="button" data-action="${nextAction}" data-focus-key="continue-sop-sheet" ${run.stage === "steps" && (!isComplete || !canOperate) || run.stage === "confirmation" && !canOperate ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${run.stage === "confirmation" ? "fact_check" : isLastPage ? "task_alt" : "arrow_forward"}</span>${nextLabel}</button></div></footer>
    </article>
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
