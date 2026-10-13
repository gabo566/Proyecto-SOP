function renderStepImages(step, sheet) {
  if (!step.images?.length) return '<span class="step-image-empty">Referencia visual no disponible</span>';
  const imageLayout = step.images.length > 1 ? "step-visuals--scrollable" : "step-visuals--single";
  return `<div class="step-visuals ${imageLayout}" role="group" tabindex="0" aria-label="Imágenes de referencia del paso ${escapeHtml(step.number)}. Desplaza horizontalmente para ver las imágenes adicionales.">
    ${step.images.map((image) => `<button class="step-image-button" type="button" data-action="zoom-step-image"
      data-image-src="${escapeHtml(image.src)}" data-image-alt="${escapeHtml(image.alt)}"
      data-step-number="${escapeHtml(step.number)}" data-sheet="${sheet}"
      aria-label="Ampliar imagen del paso ${escapeHtml(step.number)}">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async" />
      <span class="step-image-zoom"><span class="material-symbols-rounded" aria-hidden="true">zoom_in</span>Ampliar</span>
    </button>`).join("")}
  </div>`;
}

function renderProcedurePanel(procedure, state) {
  const steps = procedure.steps.map((step) => {
    return `<article class="procedure-step-item">
      <span class="step-number" aria-hidden="true">${escapeHtml(step.number)}</span>
      <div class="step-content"><small>Paso ${escapeHtml(step.number)}</small><span>${escapeHtml(step.text)}</span></div>
      ${renderStepImages(step, procedure.sheet)}
    </article>`;
  }).join("");
  const currentStatus = state.completedSteps.length ? "EN PROCESO" : "PENDIENTE";

  return `<section class="procedure-panel" aria-labelledby="procedure-heading">
    <div class="section-heading procedure-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">format_list_bulleted</span>
      <div><p class="eyebrow">${escapeHtml(SOP_DOCUMENT.id)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</p><h2 id="procedure-heading">SOP en proceso</h2><p class="procedure-current-title">${escapeHtml(procedure.title)}</p></div>
    </div><div class="procedure-controls"><span class="status-chip status-chip--${state.completedSteps.length ? "progress" : "pending"}">${currentStatus}</span><span class="sheet-chip">Hoja ${procedure.sheet} de ${SOP_DOCUMENT.totalSheets}</span>
      <button class="icon-button" type="button" aria-label="Procedimiento anterior" data-action="previous-procedure" data-focus-key="previous-procedure"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button>
      <button class="icon-button" type="button" aria-label="Procedimiento siguiente" data-action="next-procedure" data-focus-key="next-procedure"><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
    </div></div>
    ${renderSopSelector(procedure.id)}
    <div class="procedure-meta"><div><span>SOP</span><strong>${escapeHtml(SOP_DOCUMENT.id)}</strong></div><div><span>Revisión</span><strong>${escapeHtml(SOP_DOCUMENT.revision)}</strong></div>
      <div><span>Cliente</span><strong>${escapeHtml(SOP_DOCUMENT.customer)}</strong></div><div><span>Familia</span><strong>${escapeHtml(SOP_DOCUMENT.family)}</strong></div><div><span>Estación</span><strong>${escapeHtml(SOP_DOCUMENT.station)}</strong></div>
    </div>
    <div class="procedure-steps-heading"><div><p class="eyebrow">Secuencia ${escapeHtml(procedure.stepRange)}</p><h3>Pasos del procedimiento</h3><small class="procedure-scroll-hint">Desplaza horizontalmente para ver más pasos.</small></div><span>${procedure.steps.length} pasos</span></div>
    <div class="procedure-step-list" role="region" tabindex="0" aria-label="Pasos del procedimiento. Desplaza horizontalmente para ver el resto.">${steps}</div>
    <div class="step-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Revisa cada instrucción y su referencia visual. Marca su validación en el panel del operador.</span></div>
  </section>`;
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
