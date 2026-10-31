const WORK_ITEMS_STORAGE_KEY = "sop-operador-work-items-v1";

function readWorkItems() {
  try {
    const items = JSON.parse(localStorage.getItem(WORK_ITEMS_STORAGE_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function persistWorkItems(items) {
  try {
    localStorage.setItem(WORK_ITEMS_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function workItemStatusClass(status) {
  if (status === "Pendiente de revisión") return "work-status--review";
  if (status === "Retrabajo requerido") return "work-status--rework";
  if (status === "Retrabajo en proceso" || status === "En proceso") return "work-status--progress";
  if (status === "Completado") return "work-status--complete";
  return "work-status--paused";
}

function renderWorkItem(item, activeWorkId) {
  const isActive = item.id === activeWorkId;
  const action = item.status === "Detenida"
    ? `<button class="button button--secondary work-item-action" type="button" data-action="resume-work" data-work-id="${escapeHtml(item.id)}"><span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>Reanudar</button>`
    : item.status === "Retrabajo requerido"
      ? `<button class="button button--primary work-item-action" type="button" data-action="resume-work" data-work-id="${escapeHtml(item.id)}"><span class="material-symbols-rounded" aria-hidden="true">build</span>Iniciar retrabajo</button>`
      : item.status === "Pendiente de revisión"
        ? `<button class="button button--primary work-item-action" type="button" data-action="review-evidence" data-work-id="${escapeHtml(item.id)}"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span>Revisar evidencia</button>`
      : item.status === "Completado" && item.workKind === "rework" && item.evidenceHistory?.length
        ? `<button class="button button--secondary work-item-action" type="button" data-action="review-evidence" data-work-id="${escapeHtml(item.id)}"><span class="material-symbols-rounded" aria-hidden="true">image</span>Ver evidencia</button>`
      : isActive
        ? '<span class="work-item-active"><span class="material-symbols-rounded" aria-hidden="true">play_circle</span>Trabajo activo</span>'
        : ["En proceso", "Retrabajo en proceso"].includes(item.status)
          ? `<button class="button button--secondary work-item-action" type="button" data-action="resume-work" data-work-id="${escapeHtml(item.id)}"><span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>Continuar</button>`
        : "";
  const events = item.history.map((event) => `<li><time>${escapeHtml(event.date)} · ${escapeHtml(event.time)}</time><span><strong>${escapeHtml(event.status)}</strong>${event.note ? ` · ${escapeHtml(event.note)}` : ""}</span></li>`).join("");
  const stepLabel = item.failedStep
    ? `Paso con falla ${item.failedStep} · avance ${item.completedSteps.length} de ${item.totalSteps}`
    : `Avance ${item.completedSteps.length} de ${item.totalSteps} pasos`;
  const stopEvidenceCount = item.stopEvidence?.length ?? 0;
  const latestEvidence = item.evidenceHistory?.at(-1)?.files?.length ?? item.evidenceFiles?.length ?? stopEvidenceCount;
  const evidenceAction = stopEvidenceCount
    ? `<button class="icon-button evidence-eye-button" type="button" data-action="view-stop-evidence" data-work-id="${escapeHtml(item.id)}" aria-label="Ver evidencia al detener el trabajo"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>`
    : item.workKind === "rework" && latestEvidence && item.status !== "Pendiente de revisión"
    ? `<button class="icon-button evidence-eye-button" type="button" data-action="view-work-evidence" data-work-id="${escapeHtml(item.id)}" aria-label="Ver evidencia del retrabajo, ${latestEvidence} fotos"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>`
    : "";

  return `<article class="work-item-card ${isActive ? "work-item-card--active" : ""}">
    <div class="work-item-main"><div class="work-item-title"><div><strong>${escapeHtml(item.serial || "Serial pendiente")}</strong><small>${escapeHtml(item.nodeNumber || "Nodo sin capturar")} · ${escapeHtml(item.procedureTitle)} · hoja ${escapeHtml(item.sheet)}</small></div><span class="work-status ${workItemStatusClass(item.status)}">${escapeHtml(item.status)}</span></div>
      ${item.reasonLabel || item.reason ? `<p class="work-item-reason"><strong>${escapeHtml(item.reasonLabel)}:</strong> ${escapeHtml(item.reason)}</p>` : ""}
      <div class="work-item-meta"><span>${escapeHtml(stepLabel)}</span>${item.repairType ? `<span>Reparación: ${escapeHtml(item.repairType)}</span>` : ""}${item.componentPartNumber ? `<span>PN componente: ${escapeHtml(item.componentPartNumber)}</span>` : ""}${item.componentSerial ? `<span>Serie componente: ${escapeHtml(item.componentSerial)}</span>` : ""}${item.workKind === "rework" && latestEvidence ? `<span>${latestEvidence} fotos de evidencia</span>` : ""}<span>Operador: ${escapeHtml(item.form.name || "Sin asignar")}</span>${item.form.position ? `<span>Puesto: ${escapeHtml(item.form.position)}</span>` : ""}<span>Actualizado: ${escapeHtml(item.updatedLabel)}</span></div>
    </div><div class="work-item-controls">${evidenceAction}${action}<details class="work-item-history"><summary>Historial (${item.history.length})</summary><ol>${events}</ol></details></div>
  </article>`;
}

function renderWorkItemsPanel(workItems, activeWorkId) {
  const openItems = [...workItems].filter((item) => item.status !== "Completado").sort((a, b) => b.updatedAt - a.updatedAt);
  const recentClosed = [...workItems].filter((item) => item.status === "Completado").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const pausedCount = openItems.filter((item) => item.status === "Detenida").length;
  const reworkCount = openItems.filter((item) => ["Retrabajo requerido", "Retrabajo en proceso"].includes(item.status)).length;
  const reviewCount = openItems.filter((item) => item.status === "Pendiente de revisión").length;
  const body = openItems.length
    ? openItems.map((item) => renderWorkItem(item, activeWorkId)).join("")
    : '<div class="work-items-empty"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span><div><strong>Sin trabajos detenidos o en retrabajo</strong><p>Al detener una SOP o reportar una falla, aparecerá aquí para reanudarla.</p></div></div>';
  const closedBody = recentClosed.length ? `<div class="work-items-closed"><h3>Últimos trabajos cerrados</h3><div class="work-items-list">${recentClosed.map((item) => renderWorkItem(item, activeWorkId)).join("")}</div></div>` : "";
  return `<section class="work-items-panel" id="work-items" aria-labelledby="work-items-heading"><div class="section-heading work-items-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">pause_circle</span><div><p class="eyebrow">Continuidad del trabajo</p><h2 id="work-items-heading">Detenidos y retrabajos</h2></div></div><div class="work-items-counts"><span><strong>${pausedCount}</strong> detenidos</span><span><strong>${reworkCount}</strong> en retrabajo</span><span><strong>${reviewCount}</strong> por revisar</span></div></div><div class="work-items-list">${body}</div>${closedBody}</section>`;
}

function renderEvidenceReviewDialog(state) {
  const files = state.reviewEvidence.map((file) => `<figure class="evidence-review-file"><button class="evidence-review-image-button" type="button" data-action="zoom-evidence-image" data-evidence-id="${escapeHtml(file.id)}" aria-label="Ampliar evidencia ${escapeHtml(file.name)}"><img src="${escapeHtml(file.url)}" alt="Evidencia del retrabajo: ${escapeHtml(file.name)}" /><span class="material-symbols-rounded" aria-hidden="true">zoom_in</span></button><figcaption>${escapeHtml(file.name)} · ${(file.size / 1024 / 1024).toFixed(1)} MB · agregó ${escapeHtml(file.addedBy?.name ?? "usuario anterior")}</figcaption></figure>`).join("");
  const errorHidden = state.reviewError ? "" : "hidden";
  const submissionStatus = state.reviewSubmission?.reviewStatus ?? "";
  const dialogTitle = submissionStatus === "Evidencia de validación" ? "Evidencia de la validación" : submissionStatus === "Evidencia al detener" ? "Evidencia al detener" : "Evidencia del retrabajo";
  const readOnlySummary = state.reviewReadOnly ? `<div class="evidence-review-result"><strong>${escapeHtml(submissionStatus)}</strong>${state.reviewSubmission?.submittedBy ? ` · subió ${escapeHtml(state.reviewSubmission.submittedBy)}` : ""}${state.reviewSubmission?.reviewedBy ? ` · revisó ${escapeHtml(state.reviewSubmission.reviewedBy)}` : ""}${state.reviewSubmission?.reviewNote ? `<p><strong>Nota de revisión:</strong> ${escapeHtml(state.reviewSubmission.reviewNote)}</p>` : ""}</div>` : "";
  const reviewControls = state.evidenceManageMode
    ? `<button class="button button--outlined evidence-record-upload" type="button" data-action="choose-record-evidence" ${state.evidenceBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">upload</span>${state.evidenceBusy ? "Guardando fotos…" : "Subir evidencia"}</button><input id="record-evidence-input" class="evidence-upload-input" type="file" data-record-evidence-input hidden accept="${EVIDENCE_FILE_ACCEPT}" multiple aria-label="Seleccionar evidencia adicional" ${state.evidenceBusy ? "disabled" : ""} /><p class="form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.reviewError)}</p><div class="work-dialog-actions"><button class="button button--secondary" type="button" data-action="close-evidence-review">Guardar y cerrar</button></div>`
    : state.reviewReadOnly
    ? '<div class="work-dialog-actions"><button class="button button--secondary" type="button" data-action="close-evidence-review">Cerrar</button></div>'
    : `<label class="validation-field">Comentario de revisión<textarea name="reviewNote" data-review-note rows="3" maxlength="500" placeholder="Indica qué debe corregirse si rechazas la evidencia">${escapeHtml(state.reviewNote)}</textarea></label>
      <p class="form-error" role="alert" aria-live="polite" ${errorHidden}>${escapeHtml(state.reviewError)}</p>
      <div class="work-dialog-actions"><button class="button button--outlined" type="button" data-action="reject-evidence" data-work-id="${escapeHtml(state.reviewItem?.id ?? "")}">Solicitar corrección</button><button class="button button--primary" type="button" data-action="approve-evidence" data-work-id="${escapeHtml(state.reviewItem?.id ?? "")}" ${state.reviewEvidence.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Aprobar retrabajo</button></div>`;
  return `<dialog class="app-dialog evidence-review-dialog" id="evidence-review-dialog" aria-labelledby="evidence-review-title"><div class="evidence-review-content"><div class="dialog-header"><div><p class="eyebrow">${state.reviewReadOnly ? "Registro de evidencia" : "Revisión del supervisor"}</p><h2 id="evidence-review-title">${dialogTitle}</h2></div><button class="icon-button" type="button" data-action="close-evidence-review" aria-label="Cerrar revisión"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
    <p class="work-dialog-context">Serial <strong>${escapeHtml(state.reviewItem?.serial ?? "")}</strong>${state.reviewSubmission?.attempt ? ` · intento ${escapeHtml(state.reviewSubmission.attempt)}` : ""}${state.reviewItem?.failedStep && state.reviewItem.failedStep !== "—" ? ` · paso con falla ${escapeHtml(state.reviewItem.failedStep)}` : ""}</p>
    ${readOnlySummary}<div class="evidence-review-grid">${files || `<p class="evidence-empty">${state.evidenceManageMode ? "Aún no hay fotos; usa Subir evidencia para adjuntarlas." : "No se pudieron cargar las imágenes guardadas en este navegador."}</p>`}</div>
    ${reviewControls}<p class="dialog-note">La aprobación registra revisión humana; el sistema no determina automáticamente si la reparación es correcta.</p></div></dialog>`;
}

function renderEvidenceImageDialog(state) {
  const file = state.zoomedEvidence;
  return `<dialog class="app-dialog evidence-image-dialog" id="evidence-image-dialog" aria-label="Imagen de evidencia ampliada"><div class="evidence-image-dialog-content"><button class="icon-button" type="button" data-action="close-evidence-image" aria-label="Cerrar imagen ampliada"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>${file ? `<img src="${escapeHtml(file.url)}" alt="Evidencia ampliada: ${escapeHtml(file.name)}" /><p>${escapeHtml(file.name)}</p>` : ""}</div></dialog>`;
}

function renderWorkItemDialog(state) {
  return `<dialog class="app-dialog work-item-dialog" id="work-item-dialog" aria-labelledby="work-item-dialog-title">
    <form id="work-item-form" novalidate><div class="dialog-header"><div><p class="eyebrow">Guardar estado de la SOP</p><h2 id="work-item-dialog-title">Detener trabajo o registrar retrabajo</h2></div><button class="icon-button" type="button" data-action="close-work-item-dialog" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      <p class="work-dialog-context">Se guardará el serial, operador, SOP, hoja, pasos marcados y el historial para continuar después.</p>
      <fieldset class="work-type-options"><legend>Tipo de registro</legend><label><input type="radio" name="workType" value="pause" ${state.workDraft.type === "pause" ? "checked" : ""}><span><strong>Detener por bloqueo</strong><small>El trabajo espera una pieza, herramienta o soporte.</small></span></label><label><input type="radio" name="workType" value="rework" ${state.workDraft.type === "rework" ? "checked" : ""}><span><strong>Requiere retrabajo</strong><small>Se detectó un defecto que debe corregirse y revalidarse.</small></span></label></fieldset>
      <div class="work-repair-fields">${renderComponentFields(state.form, state.workDraft)}</div>
      <label class="validation-field">Motivo<select name="reasonCode" required><option value="">Selecciona el motivo</option><option value="Falta de componente" ${state.workDraft.reasonCode === "Falta de componente" ? "selected" : ""}>Falta de componente</option><option value="Falta de herramienta" ${state.workDraft.reasonCode === "Falta de herramienta" ? "selected" : ""}>Falta de herramienta o fixture</option><option value="Soporte técnico" ${state.workDraft.reasonCode === "Soporte técnico" ? "selected" : ""}>Esperando soporte técnico</option><option value="Discrepancia SOP" ${state.workDraft.reasonCode === "Discrepancia SOP" ? "selected" : ""}>Discrepancia con la SOP</option><option value="Defecto detectado" ${state.workDraft.reasonCode === "Defecto detectado" ? "selected" : ""}>Defecto detectado en el nodo</option><option value="Otro" ${state.workDraft.reasonCode === "Otro" ? "selected" : ""}>Otro</option></select></label>
      <label class="validation-field work-failed-step" ${state.workDraft.type === "rework" ? "" : "hidden"}>Paso donde se detectó la falla<select name="failedStep"><option value="">Selecciona el paso</option>${getProcedure().steps.map((step) => `<option value="${escapeHtml(step.number)}" ${state.workDraft.failedStep === step.number ? "selected" : ""}>Paso ${escapeHtml(step.number)}</option>`).join("")}</select></label>
      <label class="validation-field">Nota para quien reanude<textarea name="workNote" rows="3" maxlength="500" placeholder="Describe qué falta o qué debe corregirse" required>${escapeHtml(state.workDraft.note)}</textarea></label>
      <div class="stop-evidence-control"><button class="evidence-inline-button" type="button" data-action="choose-stop-evidence" aria-label="Subir evidencia opcional de la detención" title="Subir evidencia" ${state.evidenceBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">add_a_photo</span><span>Evidencia</span></button><small class="evidence-inline-note">Opcional</small><input class="evidence-upload-input" type="file" data-stop-evidence-input hidden accept="${EVIDENCE_FILE_ACCEPT}" multiple aria-label="Seleccionar evidencia para detener el trabajo" />${(state.workDraft.evidenceFiles ?? []).map((file) => `<span class="evidence-inline-file" title="${escapeHtml(file.name)}"><span class="material-symbols-rounded" aria-hidden="true">image</span>${escapeHtml(file.name)}<button type="button" data-action="remove-stop-evidence" data-evidence-id="${escapeHtml(file.id)}" aria-label="Quitar evidencia ${escapeHtml(file.name)}">×</button></span>`).join("")}</div>
      <p class="form-error" id="work-item-error" role="alert" aria-live="polite" ${state.workError ? "" : "hidden"}>${escapeHtml(state.workError)}</p>
      <div class="work-dialog-actions"><button class="button button--secondary" type="button" data-action="close-work-item-dialog">Cancelar</button><button class="button button--primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">save</span>Guardar y detener</button></div>
      <p class="dialog-note">Si aún no se conoce la reparación, déjala por definir; se conserva al reanudar. Este prototipo guarda el dato en este navegador.</p>
    </form>
  </dialog>`;
}
