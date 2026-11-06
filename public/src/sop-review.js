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
  const showAll = Boolean(state.sopReviewShowAll);
  const visible = showAll ? rows : rows.slice(0, 10);
  const rowsHtml = visible.map((row) => `<tr><td><b>${escapeHtml(row.sheet)}</b></td><td>${escapeHtml(row.type)}${row.step ? `<small> · paso ${escapeHtml(row.step)}</small>` : ""}</td><td class="${row.before ? "sop-flow-del" : ""}">${row.before ? escapeHtml(row.before) : "—"}</td><td class="${row.after ? "sop-flow-add" : ""}">${row.after ? escapeHtml(row.after) : "—"}</td></tr>`).join("");
  const busy = state.sopVersionBusy ? "disabled" : "";
  let decision;
  if (mode === "review") {
    decision = `<section class="sop-flow-card"><h3 class="sop-flow-h3">Tu revisión</h3>
      ${block ? `<p class="sop-flow-notice"><span class="material-symbols-rounded" aria-hidden="true">block</span>${escapeHtml(block)}</p>` : ""}
      <label class="sop-review-note"><span>Comentario general <small>(si la devuelves, escribe un comentario o deja marcas en las hojas)</small></span><textarea id="sop-review-note" rows="4" maxlength="1000" placeholder="Escribe qué revisaste o qué debe corregirse" ${block ? "disabled" : ""}>${escapeHtml(state.sopReviewNoteDraft ?? "")}</textarea></label>
      <div class="sop-review-decide"><button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-review-decide" data-decision="approve" ${block || state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Aprobar</button>
        <button class="sop-flow-btn sop-flow-btn--amber" type="button" data-action="sop-review-decide" data-decision="reject" ${block || state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Devolver con comentarios${(state.sopReviewMarks ?? []).length ? ` y ${(state.sopReviewMarks ?? []).length} ${(state.sopReviewMarks ?? []).length === 1 ? "marca" : "marcas"}` : ""}</button></div></section>`;
  } else if (mode === "publish") {
    decision = `<section class="sop-flow-card"><h3 class="sop-flow-h3">Publicación</h3>
      ${block ? `<p class="sop-flow-notice"><span class="material-symbols-rounded" aria-hidden="true">block</span>${escapeHtml(block)}</p>` : '<p class="sop-flow-sub" style="margin:0 0 10px">Al publicarla podrá habilitarse para las estaciones. Esta acción queda registrada a tu nombre.</p>'}
      ${version.reviewNote ? `<p class="sop-review-quote"><b>${escapeHtml(version.reviewedBy ?? "Revisor")}:</b> ${escapeHtml(version.reviewNote)}</p>` : ""}
      <button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-publish-version" ${block || state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.sopVersionBusy ? "hourglass_top" : "rocket_launch"}</span>${state.sopVersionBusy ? "Publicando…" : `Publicar Rev. ${escapeHtml(version.document.revision)}`}</button></section>`;
  } else {
    const canResubmit = status === "rejected" && isMySopVersion(version);
    decision = `<section class="sop-flow-card"><h3 class="sop-flow-h3">Estado</h3><p class="sop-flow-sub" style="margin:0 0 8px">${(SOP_STATUS_INFO[status] ?? SOP_STATUS_INFO.published).hint}.</p>
      ${version.reviewNote ? `<p class="sop-review-quote"><b>${escapeHtml(version.reviewedBy ?? "Revisor")}:</b> ${escapeHtml(version.reviewNote)}</p>` : ""}
      ${canResubmit ? `<button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-resubmit-open" data-version-id="${escapeHtml(version.id)}"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Corregir y reenviar</button>` : ""}</section>`;
  }
  return `<section class="sop-flow sop-review" aria-label="Revisión de la SOP">
    <button class="sop-flow-link sop-review-back" type="button" data-action="sop-review-close"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Volver al catálogo</button>
    <section class="sop-flow-card sop-flow-card--head"><div><h2 class="sop-flow-title">${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</h2><p class="sop-flow-sub">${escapeHtml(version.document.id)} · Estación ${escapeHtml(formatWorkStationAssignment(version.document.stationAssignment) || "sin asignar")}</p></div>${renderSopStatusChip(version)}</section>
    ${renderSopQuickBar(version, mode, block, state)}
    ${state.sopDraftError ? `<p class="form-error sop-flow-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : ""}
    <section class="sop-flow-card">${renderSopReviewTracker(version)}</section>
    ${mode === "review"
      ? renderSopMarksViewer(version, { marks: state.sopReviewMarks ?? [], editable: !block, sheetIndex: state.sopReviewSheet ?? 0, tool: state.sopReviewTool ?? "box", text: state.sopReviewMarkText ?? "", heading: "Revisa las hojas y marca lo que deba corregirse" })
      : sopReviewsOf(version).length ? renderSopMarksViewer(version, { marks: sopReviewsOf(version)[0].marks ?? [], sheetIndex: state.sopReviewSheet ?? 0, heading: `Marcas de ${escapeHtml(sopReviewsOf(version)[0].reviewerName ?? "el revisor")} · ronda ${escapeHtml(sopReviewsOf(version)[0].round)}` }) : ""}
    ${renderSopReviewHistory(version)}
    <div class="sop-flow-kpis"><div class="sop-flow-kpi"><span>Cambios en total</span><strong>${summary.total ?? rows.length}</strong></div><div class="sop-flow-kpi"><span>Textos y números de pasos</span><strong>${summary.stepRows ?? 0}</strong></div><div class="sop-flow-kpi"><span>Marcas sobre las hojas</span><strong>${summary.markRows ?? 0}</strong></div><div class="sop-flow-kpi"><span>Hojas con pasos</span><strong>${version.procedures.length}</strong></div></div>
    <div class="sop-flow-split">
      <section class="sop-flow-card sop-flow-card--flush"><div class="sop-flow-card-head"><h3 class="sop-flow-h3">Qué cambió</h3>${rows.length > 10 ? `<button type="button" class="sop-flow-link" data-action="sop-review-toggle-rows">${showAll ? "Ver menos" : `Ver los ${rows.length} cambios`}</button>` : ""}</div>
        ${rows.length ? `<table class="sop-flow-table"><thead><tr><th>Hoja</th><th>Tipo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : '<p class="sop-flow-empty">Esta revisión no trae un resumen de cambios guardado.</p>'}</section>
      <div class="sop-flow-side">${decision}
        <section class="sop-flow-card"><h3 class="sop-flow-h3">Para revisar con calma</h3>
          <button type="button" class="sop-flow-export" data-action="sop-review-export" data-kind="pdf"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>PDF con anotaciones<small>hojas con cambios</small><span class="material-symbols-rounded sop-flow-export-end" aria-hidden="true">download</span></button>
          <button type="button" class="sop-flow-export" data-action="sop-review-export" data-kind="print"><span class="material-symbols-rounded" aria-hidden="true">print</span>Resumen para imprimir<span class="material-symbols-rounded sop-flow-export-end" aria-hidden="true">open_in_new</span></button></section></div></div>
  </section>`;
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
      state.sopDraftError = "";
      render();
      window.scrollTo({ top: 0 });
    } else if (name === "sop-review-close") {
      state.sopReview = null;
      state.sopDraftError = "";
      render();
    } else if (name === "sop-review-toggle-rows") {
      state.sopReviewShowAll = !state.sopReviewShowAll;
      render();
    } else if (name === "sop-review-export") {
      const version = state.sopVersionHistory.find((item) => item.id === state.sopReview?.id);
      if (!version || action.disabled) return;
      action.disabled = true;
      try {
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
