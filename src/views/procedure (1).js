function renderReference(reference, procedure) {
  const content = reference.images
    ? `<div class="reference-image-grid">${reference.images.map((image) => `
      <span class="reference-image ${image.wide ? "reference-image--wide" : ""}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" /><small>${escapeHtml(image.caption)}</small></span>`).join("")}</div>`
    : `<img src="${escapeHtml(reference.image)}" alt="Referencia visual: ${escapeHtml(reference.label)}" />`;
  const tabs = procedure.referenceImages?.length > 1
    ? `<div class="reference-tabs" role="tablist" aria-label="Imágenes de referencia por paso">${procedure.referenceImages.map((item, index) => `
      <button type="button" role="tab" aria-selected="${item.step === reference.step}" class="reference-tab ${item.step === reference.step ? "reference-tab--active" : ""}" data-action="select-reference" data-reference-index="${index}">Paso ${item.step}</button>`).join("")}</div>`
    : "";
  const pageUrl = `./public/documents/SOP-NVD-GB200-141.pdf#page=${procedure.sheet}`;

  return `<figure class="sop-reference">
    <figcaption><span>${escapeHtml(reference.label)} · hoja ${procedure.sheet}</span><a href="${pageUrl}" target="_blank" rel="noreferrer">Abrir página completa <span class="material-symbols-rounded" aria-hidden="true">open_in_new</span></a></figcaption>
    ${tabs}<a class="reference-open" href="${pageUrl}" target="_blank" rel="noreferrer" aria-label="Abrir hoja ${procedure.sheet} del PDF SOP">${content}</a>
  </figure>`;
}

function renderProcedurePanel(procedure, state) {
  const references = procedure.referenceImages ?? [{ step: procedure.sheet, image: procedure.image, label: `Hoja ${procedure.sheet}` }];
  const index = Math.min(state.referenceIndex, references.length - 1);
  const reference = references[index] ?? references[0];
  const allChecked = procedure.steps.every((step) => state.completedSteps.includes(step.number));
  const steps = procedure.steps.map((step) => {
    const checked = state.completedSteps.includes(step.number);
    return `<label class="step-item ${checked ? "step-item--checked" : ""}" for="step-${step.number}">
      <input id="step-${step.number}" type="checkbox" data-step="${step.number}" data-focus-key="step-${step.number}" ${checked ? "checked" : ""} aria-label="Confirmo el paso ${step.number}" />
      <span class="step-number">${step.number}</span><span class="step-content"><small>Paso ${step.number}</small><span>${escapeHtml(step.text)}</span></span>
      <span class="material-symbols-rounded step-check" aria-hidden="true">${checked ? "check_circle" : "radio_button_unchecked"}</span>
    </label>`;
  }).join("");

  return `<section class="procedure-panel" id="procedure" aria-labelledby="procedure-heading">
    <div class="section-heading procedure-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">description</span>
      <div><p class="eyebrow">${escapeHtml(SOP_DOCUMENT.id)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</p><h2 id="procedure-heading">${escapeHtml(procedure.title)}</h2></div>
    </div><div class="procedure-controls"><span class="sheet-chip">Hoja ${procedure.sheet} de ${SOP_DOCUMENT.totalSheets}</span>
      <button class="icon-button" type="button" aria-label="Procedimiento anterior" data-action="previous-procedure" data-focus-key="previous-procedure"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button>
      <button class="icon-button" type="button" aria-label="Procedimiento siguiente" data-action="next-procedure" data-focus-key="next-procedure"><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
    </div></div>
    <div class="procedure-meta"><div><span>Cliente</span><strong>${escapeHtml(SOP_DOCUMENT.customer)}</strong></div><div><span>Familia</span><strong>${escapeHtml(SOP_DOCUMENT.family)}</strong></div>
      <div><span>P/N del nodo</span><strong>${escapeHtml(SOP_DOCUMENT.nodePartNumber)}</strong></div><div><span>Estación</span><strong>${escapeHtml(SOP_DOCUMENT.station)}</strong></div><div><span>Pasos</span><strong>${escapeHtml(procedure.stepRange)}</strong></div>
    </div>
    <div class="procedure-body"><div class="step-list">${steps}
      <div class="step-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Marca cada paso después de realizarlo. La validación representa la declaración del operador.</span></div>
    </div>${renderReference(reference, procedure)}</div>
    <div class="attestation-row"><div class="attestation-copy"><span class="attestation-icon material-symbols-rounded" aria-hidden="true">how_to_reg</span>
      <div><strong>Declaración del operador</strong><p>Confirmo que realicé los pasos indicados de acuerdo con el procedimiento establecido.</p></div>
    </div><div class="attestation-actions"><span class="step-progress">${state.completedSteps.length} de ${procedure.steps.length} pasos</span>
      <button class="button button--primary" type="button" data-action="start-completion" data-focus-key="completion-open"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Registrar cumplimiento</button>
    </div></div>
  </section>`;
}
