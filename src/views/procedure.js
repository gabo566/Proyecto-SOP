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

function renderProcedurePanel(procedure) {
  const user = getActiveLocalUser();
  const pageImageUrl = `./public/assets/sop-pages/sop-page-${String(procedure.sheet).padStart(2, "0")}.jpg?resolution=200dpi`;

  return `<section class="procedure-panel" aria-label="SOP seleccionada">
    ${renderSopSelector(procedure.id)}
    <div class="sop-page-preview" id="sop-page-preview"><img src="${pageImageUrl}" alt="${escapeHtml(SOP_DOCUMENT.title)} · hoja ${procedure.sheet} completa" loading="eager" decoding="async" /></div>
    ${procedure.steps.length ? `<div class="procedure-action-bar">
      <div class="procedure-identity-chip"><span class="material-symbols-rounded" aria-hidden="true">person</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
      <div class="procedure-action-buttons">
        <button class="button button--primary procedure-register-button" type="button" data-action="open-validation-dialog" data-focus-key="register-validation"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Registrar validación</button>
        <button class="button button--secondary procedure-stop-button" type="button" data-action="open-work-item-dialog"><span class="material-symbols-rounded" aria-hidden="true">pause_circle</span>Detener / registrar retrabajo</button>
      </div>
    </div>` : ""}
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
