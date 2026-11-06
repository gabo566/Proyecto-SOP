// Control de dos personas para las revisiones de SOP: quien edita la envía, otra persona la revisa
// (permiso sop.review) y una tercera la publica (sop.publish). El servidor hace cumplir las reglas;
// aquí se muestran el estado, las acciones disponibles y el motivo cuando una acción está bloqueada.

const SOP_STATUS_INFO = {
  pending_review: { label: "En revisión", tone: "amber", icon: "hourglass_top", hint: "Espera a que otra persona la revise" },
  approved: { label: "Aprobada · falta publicar", tone: "blue", icon: "task_alt", hint: "Espera a que una tercera persona la publique" },
  rejected: { label: "Devuelta", tone: "red", icon: "undo", hint: "El revisor pidió cambios" },
  published: { label: "Publicada", tone: "green", icon: "verified", hint: "Ya puede habilitarse para los operadores" },
};

function getSopVersionStatus(version) {
  return version?.status ?? "published";
}

// Revisar: el revisor y el editor, siempre sobre lo que subió otra persona.
function canReviewSop(user = getActiveLocalUser()) {
  return canUserDo("sop.review", user) || canManageSopVersions(user);
}

// Subir una revisión: el editor o el revisor. El publicador no sube.
function canUploadSop(user = getActiveLocalUser()) {
  return canUserDo("sop.review", user) || canManageSopVersions(user);
}

function canPublishSop(user = getActiveLocalUser()) {
  return canUserDo("sop.publish", user);
}

// Entra a «Modificar SOP» quien edita, revisa o publica; cada acción se valida por separado.
function canAccessSopAdmin(user = getActiveLocalUser()) {
  return canManageSopVersions(user) || canReviewSop(user) || canPublishSop(user);
}

function sameSopPerson(userId, otherId) {
  return userId !== undefined && userId !== null && otherId !== undefined && otherId !== null && String(userId) === String(otherId);
}

// Motivo por el que la persona actual no puede revisar o publicar esta revisión ("" si puede).
function getSopWorkflowBlock(version, action, user = getActiveLocalUser()) {
  const status = getSopVersionStatus(version);
  if (action === "review") {
    if (!canReviewSop(user)) return "Tu cuenta no tiene la función de revisor.";
    if (status !== "pending_review") return "Esta revisión ya no está pendiente de revisión.";
    if (sameSopPerson(user.id, version.submittedById)) return "Tú subiste esta revisión: la debe revisar otra persona.";
    return "";
  }
  if (!canPublishSop(user)) return "Tu cuenta no tiene la función de publicador.";
  if (status !== "approved") return "Solo se publican revisiones aprobadas.";
  if (sameSopPerson(user.id, version.submittedById)) return "Tú subiste esta revisión: la debe publicar otra persona.";
  if (sameSopPerson(user.id, version.reviewedById)) return "Tú la revisaste: la debe publicar una tercera persona.";
  return "";
}

function renderSopStatusChip(version) {
  const info = SOP_STATUS_INFO[getSopVersionStatus(version)] ?? SOP_STATUS_INFO.published;
  return `<span class="sop-status-chip sop-status-chip--${info.tone}"><span class="material-symbols-rounded" aria-hidden="true">${info.icon}</span>${info.label}</span>`;
}

// Botones de flujo que se suman a las acciones de cada fila del catálogo.
function renderSopWorkflowActions(version) {
  const status = getSopVersionStatus(version);
  if (status === "published" || version.id === BUILT_IN_SOP_VERSION_ID) return "";
  const user = getActiveLocalUser();
  const button = (mode, label, icon, primary = false) => `<button class="text-button sop-workflow-button ${primary ? "sop-workflow-button--primary" : ""}" type="button" data-action="sop-review-open" data-version-id="${escapeHtml(version.id)}" data-mode="${mode}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span>${label}</button>`;
  if (status === "rejected" && isMySopVersion(version, user)) return `<button class="text-button sop-workflow-button sop-workflow-button--primary" type="button" data-action="sop-resubmit-open" data-version-id="${escapeHtml(version.id)}"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Corregir y reenviar</button>${button("view", "Ver detalle", "visibility")}`;
  if (status === "pending_review" && canReviewSop(user) && !isMySopVersion(version, user)) return button("review", "Revisar", "rate_review", !getSopWorkflowBlock(version, "review"));
  if (status === "approved" && canPublishSop(user)) return button("publish", "Publicar", "rocket_launch", !getSopWorkflowBlock(version, "publish"));
  return button("view", "Ver detalle", "visibility");
}

function formatSopWorkflowDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderSopReviewTracker(version) {
  const status = getSopVersionStatus(version);
  const reviewed = ["approved", "published"].includes(status) || status === "rejected";
  const steps = [
    { title: "Editó y envió", who: version.submittedBy || version.createdBy || "—", at: version.submittedAt, done: true, icon: "edit_document" },
    { title: status === "rejected" ? "Devolvió" : "Revisó", who: reviewed ? version.reviewedBy : "Pendiente", at: reviewed ? version.reviewedAt : null, done: reviewed, tone: status === "rejected" ? "red" : "", icon: status === "rejected" ? "undo" : "rate_review" },
    { title: "Publicó", who: status === "published" ? version.publishedBy : status === "approved" ? "Pendiente" : "—", at: status === "published" ? version.publishedAt : null, done: status === "published", icon: "rocket_launch" },
  ];
  return `<ol class="sop-review-track">${steps.map((step, index) => `<li class="${step.done ? "is-done" : ""} ${step.tone ? `is-${step.tone}` : ""}"><span class="sop-review-track-icon material-symbols-rounded" aria-hidden="true">${step.done ? step.icon : "radio_button_unchecked"}</span><div><strong>${step.title}</strong><span>${escapeHtml(step.who)}</span>${step.at ? `<small>${escapeHtml(formatSopWorkflowDate(step.at))}</small>` : ""}</div></li>`).join("")}</ol>`;
}

// Barra de acciones rápidas: reutiliza los mismos botones y reglas de la pantalla de revisión.
function renderSopQuickBar(version, mode, block, state) {
  const busy = state.sopVersionBusy;
  const disabled = block || busy ? "disabled" : "";
  const decide = mode === "review" ? `
    <button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-review-decide" data-decision="approve" ${disabled}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Terminar revisión · Aprobar</button>
    <button class="sop-flow-btn sop-flow-btn--amber" type="button" data-action="sop-review-decide" data-decision="reject" ${disabled}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Devolver</button>` : "";
  const publish = mode === "publish" ? `
    <button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-publish-version" ${disabled}><span class="material-symbols-rounded" aria-hidden="true">rocket_launch</span>${busy ? "Publicando…" : `Publicar Rev. ${escapeHtml(version.document.revision)}`}</button>` : "";
  return `<div class="sop-quick-bar" role="toolbar" aria-label="Acciones rápidas de la revisión">
    ${decide}${publish}
    <button class="sop-flow-btn" type="button" data-action="sop-review-export" data-kind="pdf"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>PDF con anotaciones</button>
    ${block ? `<small class="sop-quick-note"><span class="material-symbols-rounded" aria-hidden="true">block</span>${escapeHtml(block)}</small>` : ""}
  </div>`;
}

function renderSopReviewScreen(state) {
  const request = state.sopReview;
  const version = state.sopVersionHistory?.find((item) => item.id === request?.id);
  if (!version) return "";
  const summary = version.changeSummary ?? { total: 0, stepRows: 0, markRows: 0, rows: [] };
  const rows = Array.isArray(summary.rows) ? summary.rows : [];
  const mode = request.mode;
  const status = getSopVersionStatus(version);
  const block = mode === "view" ? "" : getSopWorkflowBlock(version, mode);
  const reviews = sopReviewsOf(version);
  const reviewing = mode === "review";
  const publishing = mode === "publish";
  const marks = reviewing ? (state.sopReviewMarks ?? []) : (reviews[0]?.marks ?? []);
  const busy = Boolean(state.sopVersionBusy);
  const canResubmit = status === "rejected" && isMySopVersion(version);
  const sheetIndex = state.sopReviewSheet ?? 0;
  const button = (tone, action, icon, label, { badge = "", disabled = false, attrs = "" } = {}) => `<button class="rv-btn rv-btn--${tone}" type="button" data-action="${action}" ${attrs} ${disabled ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${label}</span>${badge !== "" ? `<b>${badge}</b>` : ""}</button>`;
  const decide = reviewing
    ? `${button("danger", "sop-review-decide", "thumb_down", "No aprobar", { disabled: Boolean(block) || busy, attrs: 'data-decision="reject"' })}${button("ok", "sop-review-decide", "thumb_up", "Aprobar", { disabled: Boolean(block) || busy, attrs: 'data-decision="approve"' })}`
    : publishing
      ? button("ok", "sop-publish-version", busy ? "hourglass_top" : "rocket_launch", busy ? "Publicando…" : `Publicar Rev. ${escapeHtml(version.document.revision)}`, { disabled: Boolean(block) || busy })
      : canResubmit ? button("ok", "sop-resubmit-open", "edit_document", "Corregir y reenviar", { attrs: `data-version-id="${escapeHtml(version.id)}"` }) : "";
  const pdfButton = publishing ? "" : button("ghost", "sop-review-export", "picture_as_pdf", "PDF con anotaciones", { badge: marks.length || "", attrs: 'data-kind="marks"' });
  const rowsHtml = (state.sopReviewShowAll ? rows : rows.slice(0, 12)).map((row) => `<tr><td><b>${escapeHtml(row.sheet)}</b></td><td>${escapeHtml(row.type)}${row.step ? `<small> · paso ${escapeHtml(row.step)}</small>` : ""}</td><td class="${row.before ? "sop-flow-del" : ""}">${row.before ? escapeHtml(row.before) : "—"}</td><td class="${row.after ? "sop-flow-add" : ""}">${row.after ? escapeHtml(row.after) : "—"}</td></tr>`).join("");
  const latest = reviews[0];
  // Recuadro 1: comentario general (revisor escribe; quien sube o publica lee).
  const commentCard = reviewing
    ? `<section class="rv-card"><label class="rv-label" for="sop-review-note"><span class="material-symbols-rounded" aria-hidden="true">chat</span>Comentario general para quien subió la SOP</label>
        <textarea id="sop-review-note" rows="4" maxlength="1000" placeholder="Escribe qué debe corregirse. Si no la apruebas, ${escapeHtml(version.submittedBy ?? "quien la subió")} recibirá este comentario y tus marcas en su bandeja." ${block ? "disabled" : ""}>${escapeHtml(state.sopReviewNoteDraft ?? "")}</textarea>
        <p class="rv-help"><span class="material-symbols-rounded" aria-hidden="true">info</span><b>No aprobar</b> exige un comentario o al menos una marca sobre las hojas.</p></section>`
    : `<section class="rv-card"><h3 class="rv-label"><span class="material-symbols-rounded" aria-hidden="true">chat</span>${latest ? `Comentario de ${escapeHtml(latest.reviewerName ?? "el revisor")}` : "Estado"}</h3>
        ${latest?.note ? `<p class="sop-review-quote">${escapeHtml(latest.note)}</p>` : `<p class="rv-help">${escapeHtml((SOP_STATUS_INFO[status] ?? SOP_STATUS_INFO.published).hint)}.</p>`}
        ${publishing && block ? `<p class="sop-flow-notice"><span class="material-symbols-rounded" aria-hidden="true">block</span>${escapeHtml(block)}</p>` : ""}</section>`;
  // Recuadro 2: observaciones sobre las hojas.
  const marksCard = `<section class="rv-card rv-marks">${renderSopMarksList(version, { marks, editable: reviewing && !block, sheetIndex })}</section>`;
  // Recuadro 3: historial de publicación (lo ven revisor y publicador).
  const publicationCard = `<section class="rv-card"><h3 class="rv-label"><span class="material-symbols-rounded" aria-hidden="true">how_to_reg</span>Historial de publicación</h3>${renderSopReviewTracker(version)}</section>`;
  // Recuadro 4: resumen de cambios, colapsado.
  const changes = `<details class="rv-card rv-changes"><summary><span class="material-symbols-rounded" aria-hidden="true">difference</span>Resumen de cambios<b>${summary.total ?? rows.length}</b></summary>
      ${rows.length ? `<div class="rv-table-wrap"><table class="sop-flow-table"><thead><tr><th>Hoja</th><th>Tipo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>${rows.length > 12 ? `<button type="button" class="sop-flow-link" data-action="sop-review-toggle-rows">${state.sopReviewShowAll ? "Ver menos" : `Ver los ${rows.length} cambios`}</button>` : ""}` : '<p class="sop-flow-empty">Esta revisión no trae un resumen de cambios guardado.</p>'}</details>`;
  return `<section class="sop-flow sop-review rv" aria-label="Revisión de la SOP">
    <header class="rv-head">
      <button class="rv-back" type="button" data-action="sop-review-close" aria-label="Volver al catálogo" title="Volver al catálogo"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span></button>
      <div class="rv-title"><h2>${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</h2>
        <p>${escapeHtml(version.document.id)} · Estación ${escapeHtml(formatWorkStationAssignment(version.document.stationAssignment) || "sin asignar")} · Ronda ${escapeHtml(version.reviewRound ?? 1)} · Subió ${escapeHtml(version.submittedBy ?? version.createdBy ?? "—")}</p></div>
      ${renderSopStatusChip(version)}
      <div class="rv-actions" role="toolbar" aria-label="Acciones de la revisión">
        ${button("ghost", "sop-review-history", "history", publishing ? "Historial de publicación" : "Historial de revisiones", { badge: reviews.length })}
        ${pdfButton}
        ${decide}
      </div>
    </header>
    ${block && reviewing ? `<p class="sop-flow-notice rv-notice"><span class="material-symbols-rounded" aria-hidden="true">block</span>${escapeHtml(block)}</p>` : ""}
    ${state.sopDraftError ? `<p class="form-error sop-flow-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : ""}
    <div class="rv-grid">
      <div class="rv-main">${renderSopMarksViewer(version, { marks, editable: reviewing && !block, sheetIndex, tool: state.sopReviewTool ?? "box", zoom: state.sopReviewZoom ?? 100, text: state.sopReviewMarkText ?? "" })}</div>
      <aside class="rv-side" aria-label="Recuadros de la revisión">
        ${commentCard}
        ${marksCard}
        ${publicationCard}
        ${changes}
      </aside>
    </div>
    ${state.sopReviewHistoryOpen ? renderSopReviewHistoryModal(version) : ""}
  </section>`;
}

function renderSopReviewHistoryModal(version) {
  return `<div class="rv-modal" data-rv-modal><div class="rv-modal-card" role="dialog" aria-modal="true" aria-labelledby="rv-history-title">
    <header><h3 id="rv-history-title"><span class="material-symbols-rounded" aria-hidden="true">history</span>Historial de revisiones</h3><button type="button" class="rv-back" data-action="sop-review-history-close" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></header>
    <p class="rv-modal-sub">${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</p>
    ${renderSopReviewTracker(version)}
    ${renderSopReviewHistory(version) || '<p class="srm-empty">Todavía no hay rondas de revisión.</p>'}
  </div></div>`;
}

async function loadSopRoles(state) {
  const result = await sopApi("GET", "/api/sop-roles");
  state.sopRoles = result.ok ? { reviewers: result.data.reviewers, publishers: result.data.publishers } : { reviewers: [], publishers: [], failed: true };
}

// ¿Existe al menos un revisor y un publicador distintos entre sí y distintos de quien edita?
function describeSopRoleCoverage(roles, editorId) {
  if (!roles) return { loading: true };
  const reviewers = roles.reviewers.filter((person) => !sameSopPerson(person.id, editorId));
  const publishers = roles.publishers.filter((person) => !sameSopPerson(person.id, editorId));
  const ready = reviewers.some((reviewer) => publishers.some((publisher) => !sameSopPerson(publisher.id, reviewer.id)));
  return { loading: false, ready, reviewers, publishers };
}

function bindSopReview(app, { state, render, showToast }) {
  const refreshVersions = async () => {
    state.sopVersionHistory = await listStoredSopVersions();
    state.sopVersionCatalog = (await sopApi("GET", "/api/sop-catalog")).data?.catalog ?? state.sopVersionCatalog;
  };
  const failureText = (result) => {
    const code = result.data?.code;
    if (code === "own-version") return "Tú subiste esta revisión: la debe revisar otra persona.";
    if (code === "same-person") return "Una misma persona no puede hacer dos pasos del proceso: pídelo a otra persona.";
    if (code === "note-required") return "Escribe un comentario para devolver la revisión.";
    if (code === "not-pending" || code === "not-approved") return "La revisión cambió de estado; se actualizó la lista.";
    if (result.status === 403) return "Tu cuenta no tiene permiso para esta acción.";
    return result.status === 0 ? "No se pudo conectar con el servidor." : "No se pudo completar la acción.";
  };

  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    const name = action.dataset.action;
    if (name === "sop-review-open") {
      if (!canAccessSopAdmin()) return;
      state.sopReview = { id: action.dataset.versionId, mode: action.dataset.mode };
      state.sopReviewShowAll = false;
      state.sopReviewMarks = [];
      state.sopReviewSheet = 0;
      state.sopReviewTool = "box";
      state.sopReviewMarkText = "";
      state.sopReviewNoteDraft = "";
      state.sopReviewZoom = 100;
      state.sopReviewHistoryOpen = false;
      state.sopDraftError = "";
      render();
      window.scrollTo({ top: 0 });
    } else if (name === "sop-review-close") {
      state.sopReview = null;
      state.sopReviewHistoryOpen = false;
      state.sopDraftError = "";
      render();
    } else if (name === "sop-review-toggle-rows") {
      state.sopReviewShowAll = !state.sopReviewShowAll;
      render();
    } else if (name === "sop-review-history") {
      state.sopReviewHistoryOpen = true;
      render();
    } else if (name === "sop-review-history-close") {
      state.sopReviewHistoryOpen = false;
      render();
    } else if (name === "sop-review-export") {
      const version = state.sopVersionHistory.find((item) => item.id === state.sopReview?.id);
      if (!version || action.disabled) return;
      action.disabled = true;
      try {
        if (action.dataset.kind === "marks") {
          const reviews = sopReviewsOf(version);
          const marks = state.sopReview?.mode === "review" ? (state.sopReviewMarks ?? []) : (reviews[0]?.marks ?? []);
          if (!marks.length) { showToast("Todavía no hay marcas sobre las hojas. Dibuja observaciones y vuelve a exportar.", "warning"); return; }
          await exportSopReviewMarksPdf(version, marks, { reviewer: state.sopReview?.mode === "review" ? getActiveLocalUser()?.name : reviews[0]?.reviewerName });
          showToast("PDF con las anotaciones descargado.");
          return;
        }
        await runSopDraftExport(version, action.dataset.kind, "changed", null, () => {});
      } catch (error) {
        showInlineNotice(error?.message || "No se pudo exportar.", "warning");
      } finally {
        action.disabled = false;
      }
    } else if (name === "sop-review-decide" || name === "sop-publish-version") {
      const version = state.sopVersionHistory.find((item) => item.id === state.sopReview?.id);
      if (!version || state.sopVersionBusy) return;
      const publishing = name === "sop-publish-version";
      const decision = action.dataset.decision;
      const note = app.querySelector("#sop-review-note")?.value.trim() ?? "";
      const marks = state.sopReviewMarks ?? [];
      if (!publishing && decision === "reject" && !note && !marks.length) {
        state.sopDraftError = "Escribe un comentario o deja marcas en las hojas para devolver la revisión.";
        render();
        return;
      }
      state.sopVersionBusy = true;
      state.sopDraftError = "";
      render();
      const result = publishing
        ? await sopApi("POST", `/api/sop-versions/${encodeURIComponent(version.id)}/publish`)
        : await sopApi("POST", `/api/sop-versions/${encodeURIComponent(version.id)}/review`, { decision, note, marks });
      state.sopVersionBusy = false;
      if (!result.ok) {
        state.sopDraftError = failureText(result);
        try { await refreshVersions(); } catch { /* se conserva la lista actual */ }
        render();
        return;
      }
      await refreshVersions();
      const label = `Rev. ${version.document.revision} · ${version.document.id}`;
      recordLocalAuditEvent(publishing ? "sop_version_published" : decision === "approve" ? "sop_version_approved" : "sop_version_returned", { details: label });
      state.sopReview = null;
      state.sopReviewMarks = [];
      state.sopReviewNoteDraft = "";
      showToast(publishing ? `Rev. ${version.document.revision} publicada. Ya puede habilitarse para las estaciones.`
        : decision === "approve" ? `Rev. ${version.document.revision} aprobada. Falta que una tercera persona la publique.`
          : `Rev. ${version.document.revision} devuelta. ${version.submittedBy ?? "Quien la subió"} verá tus comentarios${marks.length ? ` y ${marks.length} ${marks.length === 1 ? "marca" : "marcas"}` : ""} en su bandeja.`);
      render();
      window.scrollTo({ top: 0 });
    }
  });
}

// Celda de acciones de flujo (Revisar, Publicar o Ver detalle) de una fila del catálogo.
function renderSopWorkflowActionsCell(version) {
  const buttons = renderSopWorkflowActions(version);
  return buttons ? `<div class="sop-catalog-actions sop-catalog-actions--workflow"><div class="sop-catalog-action-buttons">${buttons}</div></div>` : "";
}

// Texto corto de lo que puede hacer la cuenta actual en el control de dos personas.
function describeSopFunctions(user = getActiveLocalUser()) {
  const functions = [canManageSopVersions(user) && "Editor", canReviewSop(user) && "Revisor", canPublishSop(user) && "Publicador"].filter(Boolean);
  return functions.length ? `Tu función: ${functions.join(" · ")}` : "Sin funciones de SOP";
}
