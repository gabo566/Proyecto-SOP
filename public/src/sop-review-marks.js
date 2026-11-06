// Revisión con marcas: el revisor dibuja notas, recuadros y flechas sobre las hojas (capa de revisión,
// el operador no la ve), quien subió la SOP las recibe en su bandeja y puede corregir y reenviar.

const SOP_MARK_TYPES = { box: "Recuadro", arrow: "Flecha", note: "Nota" };
const sopMarkSheetCache = new Map();

function sopReviewsOf(version) {
  return Array.isArray(version?.reviews) ? version.reviews : [];
}

// Última devolución (la ronda que quien subió debe atender).
function sopLatestReturn(version) {
  return sopReviewsOf(version).find((review) => review.decision === "rejected") ?? null;
}

function isMySopVersion(version, user = getActiveLocalUser()) {
  return sameSopPerson(user?.id, version?.submittedById);
}

// ---------------------------------------------------------------- dibujo de las marcas
function sopMarkGeometry(mark, height) {
  const x = Number(mark.x) * 1000;
  const y = Number(mark.y) * height;
  const w = Number(mark.w ?? 0) * 1000;
  const h = Number(mark.h ?? 0) * height;
  return { x, y, w, h };
}

function renderSopMarkShapes(marks, aspect, numbers) {
  const height = Math.round((1000 / (aspect || SOP_PAGE_ASPECT)) * 100) / 100;
  const defs = '<defs><marker id="srm-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c2410c"/></marker></defs>';
  const shapes = marks.map((mark, index) => {
    const { x, y, w, h } = sopMarkGeometry(mark, height);
    const label = numbers?.[index] ?? index + 1;
    const badge = (bx, by) => `<g class="srm-badge"><circle cx="${bx}" cy="${by}" r="15"/><text x="${bx}" y="${by + 5}" text-anchor="middle">${label}</text></g>`;
    if (mark.type === "box") {
      const left = Math.min(x, x + w);
      const top = Math.min(y, y + h);
      return `<rect class="srm-box" x="${left}" y="${top}" width="${Math.abs(w)}" height="${Math.abs(h)}" rx="6"/>${badge(left, top)}`;
    }
    if (mark.type === "arrow") {
      return `<line class="srm-arrow" x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" marker-end="url(#srm-head)"/>${badge(x, y)}`;
    }
    return `<g class="srm-note"><circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y + 6}" text-anchor="middle">${label}</text></g>`;
  }).join("");
  return { viewBox: `0 0 1000 ${height}`, html: `${defs}${shapes}` };
}

// ---------------------------------------------------------------- visor de hojas con marcas
function renderSopMarksViewer(version, { marks = [], editable = false, sheetIndex = 0, tool = "box", text = "", heading = "" } = {}) {
  const procedures = (version.procedures ?? []).filter((procedure) => procedure?.id);
  if (!procedures.length) return "";
  const index = Math.max(0, Math.min(procedures.length - 1, sheetIndex));
  const procedure = procedures[index];
  const indexed = marks.map((mark, position) => ({ mark, position }));
  const here = indexed.filter(({ mark }) => mark.procedureId === procedure.id);
  const numbers = here.map((_, order) => order + 1);
  const aspect = sopMarkSheetCache.get(`${version.id}|${procedure.id}`)?.aspect ?? procedure.pageAspect ?? SOP_PAGE_ASPECT;
  const shapes = renderSopMarkShapes(here.map(({ mark }) => mark), aspect, numbers);
  const chips = procedures.map((item, position) => {
    const count = marks.filter((mark) => mark.procedureId === item.id).length;
    return `<button type="button" class="srm-chip ${position === index ? "is-on" : ""}" data-action="srm-sheet" data-index="${position}" aria-pressed="${position === index}">Hoja ${escapeHtml(item.sheet)}${count ? `<b>${count}</b>` : ""}</button>`;
  }).join("");
  const tools = editable ? `<div class="srm-tools" role="toolbar" aria-label="Marcas del revisor">
      ${Object.entries(SOP_MARK_TYPES).map(([id, label]) => `<button type="button" class="srm-tool ${tool === id ? "is-on" : ""}" data-action="srm-tool" data-tool="${id}" aria-pressed="${tool === id}"><span class="material-symbols-rounded" aria-hidden="true">${id === "box" ? "crop_square" : id === "arrow" ? "north_east" : "sticky_note_2"}</span>${label}</button>`).join("")}
      <input class="srm-text" type="text" data-srm-text maxlength="300" value="${escapeHtml(text)}" placeholder="Comentario de la marca (se pone en la siguiente que dibujes)" aria-label="Comentario de la marca" />
      <button type="button" class="srm-tool" data-action="srm-undo" ${marks.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Quitar última</button>
    </div>
    <p class="srm-hint">${tool === "note" ? "Escribe el comentario y toca la hoja donde va la nota." : `Arrastra sobre la hoja para dibujar ${tool === "box" ? "el recuadro" : "la flecha"}.`}</p>` : "";
  const list = here.length
    ? `<ol class="srm-list">${here.map(({ mark, position }, order) => `<li><span class="srm-num">${order + 1}</span><span><b>${SOP_MARK_TYPES[mark.type] ?? "Marca"}</b>${mark.text ? ` · ${escapeHtml(mark.text)}` : ""}</span>${editable ? `<button type="button" class="srm-del" data-action="srm-delete" data-position="${position}" aria-label="Quitar marca ${order + 1}"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>` : ""}</li>`).join("")}</ol>`
    : `<p class="srm-empty">${editable ? "Sin marcas en esta hoja." : "El revisor no dejó marcas en esta hoja."}</p>`;
  return `<section class="sop-flow-card srm-card" aria-label="Hojas con marcas del revisor">
    ${heading ? `<h3 class="sop-flow-h3">${heading}</h3>` : ""}
    <div class="srm-chips" role="group" aria-label="Hojas">${chips}</div>
    ${tools}
    <div class="srm-body">
      <div class="srm-stage ${editable ? "is-editable" : ""}" data-srm-stage data-version-id="${escapeHtml(version.id)}" data-procedure-id="${escapeHtml(procedure.id)}" data-editable="${editable}" data-srm-marks="${escapeHtml(JSON.stringify(here.map(({ mark }) => mark)))}">
        <img class="srm-img" data-srm-img alt="Hoja ${escapeHtml(procedure.sheet)} de la SOP" hidden />
        <p class="srm-loading" data-srm-loading>Cargando hoja ${escapeHtml(procedure.sheet)}…</p>
        <svg class="srm-overlay" data-srm-overlay viewBox="${shapes.viewBox}" preserveAspectRatio="none">${shapes.html}</svg>
      </div>
      <div class="srm-side"><p class="srm-side-title">Hoja ${escapeHtml(procedure.sheet)} · ${escapeHtml(procedure.title ?? "")}</p>${list}</div>
    </div>
  </section>`;
}

// Carga la imagen de cada hoja visible (una vez por hoja) y ajusta la proporción de la capa de marcas.
function hydrateSopMarksViewers(state) {
  for (const stage of document.querySelectorAll("[data-srm-stage]")) {
    const versionId = stage.dataset.versionId;
    const procedureId = stage.dataset.procedureId;
    const key = `${versionId}|${procedureId}`;
    const apply = (entry) => {
      const image = stage.querySelector("[data-srm-img]");
      if (!image || !stage.isConnected) return;
      image.src = entry.url;
      image.hidden = false;
      stage.querySelector("[data-srm-loading]")?.setAttribute("hidden", "");
      const marks = JSON.parse(stage.dataset.srmMarks || "[]");
      const shapes = renderSopMarkShapes(marks, entry.aspect, marks.map((_, index) => index + 1));
      const overlay = stage.querySelector("[data-srm-overlay]");
      overlay.setAttribute("viewBox", shapes.viewBox);
      overlay.innerHTML = shapes.html;
    };
    const cached = sopMarkSheetCache.get(key);
    if (cached?.url) { apply(cached); continue; }
    if (cached?.loading) continue;
    const version = (state.sopVersionHistory ?? []).find((item) => item.id === versionId);
    const procedure = version?.procedures?.find((item) => item.id === procedureId);
    if (!version || !procedure) continue;
    sopMarkSheetCache.set(key, { loading: true });
    renderSopSheetCanvas(version, procedure, { maxWidth: 1600 })
      .then((sheet) => {
        const entry = { url: sheet.canvas.toDataURL("image/jpeg", 0.9), aspect: sheet.width / sheet.height };
        sopMarkSheetCache.set(key, entry);
        // La pantalla pudo redibujarse mientras cargaba: aplica la imagen a los visores actuales.
        hydrateSopMarksViewers(state);
      })
      .catch(() => {
        sopMarkSheetCache.delete(key);
        const loading = stage.querySelector("[data-srm-loading]");
        if (loading) loading.textContent = "No se pudo cargar la hoja.";
      });
  }
}

// ---------------------------------------------------------------- historial de rondas
function renderSopReviewHistory(version) {
  const reviews = sopReviewsOf(version);
  if (!reviews.length) return "";
  return `<section class="sop-flow-card"><h3 class="sop-flow-h3">Historial de revisiones</h3><ol class="srm-history">${reviews.map((review) => `<li class="${review.decision === "rejected" ? "is-returned" : "is-approved"}">
      <span class="material-symbols-rounded" aria-hidden="true">${review.decision === "rejected" ? "undo" : "task_alt"}</span>
      <div><b>Ronda ${escapeHtml(review.round)} · ${review.decision === "rejected" ? "Devuelta" : "Aprobada"}</b><small>${escapeHtml(review.reviewerName ?? "Revisor")} · ${escapeHtml(formatSopWorkflowDate(review.at))} · ${(review.marks ?? []).length} ${(review.marks ?? []).length === 1 ? "marca" : "marcas"}</small>${review.note ? `<p>${escapeHtml(review.note)}</p>` : ""}</div></li>`).join("")}</ol></section>`;
}

// ---------------------------------------------------------------- bandeja
function getSopInboxBuckets(state, user = getActiveLocalUser()) {
  const versions = (state.sopVersionHistory ?? []).filter((version) => version.id !== BUILT_IN_SOP_VERSION_ID);
  const mine = versions.filter((version) => isMySopVersion(version, user));
  return {
    returned: canUploadSop(user) ? mine.filter((version) => getSopVersionStatus(version) === "rejected") : [],
    sent: canUploadSop(user) ? mine.filter((version) => getSopVersionStatus(version) !== "rejected") : [],
    toReview: canReviewSop(user) ? versions.filter((version) => getSopVersionStatus(version) === "pending_review" && !isMySopVersion(version, user)) : [],
    toPublish: canPublishSop(user) ? versions.filter((version) => getSopVersionStatus(version) === "approved" && !isMySopVersion(version, user) && !sameSopPerson(user?.id, version.reviewedById)) : [],
  };
}

// Número que se muestra en el menú: devueltas (para quien subió) + pendientes por revisar o publicar.
function getSopInboxCount(state) {
  const buckets = getSopInboxBuckets(state);
  return buckets.returned.length + buckets.toReview.length + buckets.toPublish.length;
}

function renderSopInbox(state) {
  const buckets = getSopInboxBuckets(state);
  const tabs = [
    canUploadSop() && { id: "returned", label: "Devueltas", icon: "undo", items: buckets.returned, urgent: true },
    canReviewSop() && { id: "toReview", label: "Por revisar", icon: "rate_review", items: buckets.toReview, urgent: true },
    canPublishSop() && { id: "toPublish", label: "Por publicar", icon: "rocket_launch", items: buckets.toPublish, urgent: true },
    canUploadSop() && { id: "sent", label: "Mis envíos", icon: "outbox", items: buckets.sent },
  ].filter(Boolean);
  if (!tabs.length) return "";
  const current = tabs.find((tab) => tab.id === state.sopInboxTab) ?? tabs.find((tab) => tab.urgent && tab.items.length) ?? tabs[0];
  const row = (version) => {
    const status = getSopVersionStatus(version);
    const latest = sopLatestReturn(version);
    let actions = `<button type="button" class="text-button sop-workflow-button" data-action="sop-review-open" data-version-id="${escapeHtml(version.id)}" data-mode="view"><span class="material-symbols-rounded" aria-hidden="true">visibility</span>Ver detalle</button>`;
    if (current.id === "returned") actions = `<button type="button" class="text-button sop-workflow-button sop-workflow-button--primary" data-action="sop-resubmit-open" data-version-id="${escapeHtml(version.id)}"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Corregir y reenviar</button>${actions}`;
    if (current.id === "toReview") actions = `<button type="button" class="text-button sop-workflow-button sop-workflow-button--primary" data-action="sop-review-open" data-version-id="${escapeHtml(version.id)}" data-mode="review"><span class="material-symbols-rounded" aria-hidden="true">rate_review</span>Revisar</button>`;
    if (current.id === "toPublish") actions = `<button type="button" class="text-button sop-workflow-button sop-workflow-button--primary" data-action="sop-review-open" data-version-id="${escapeHtml(version.id)}" data-mode="publish"><span class="material-symbols-rounded" aria-hidden="true">rocket_launch</span>Publicar</button>`;
    const detail = current.id === "returned" && latest
      ? `<small class="sop-inbox-note"><b>${escapeHtml(latest.reviewerName ?? "Revisor")}:</b> ${escapeHtml(latest.note || "Revisa las marcas en las hojas.")} · ${(latest.marks ?? []).length} ${(latest.marks ?? []).length === 1 ? "marca" : "marcas"}</small>`
      : `<small>Envió ${escapeHtml(version.submittedBy ?? version.createdBy ?? "—")} · ${escapeHtml(formatSopWorkflowDate(version.submittedAt ?? version.createdAt))}${version.reviewRound > 1 ? ` · ronda ${escapeHtml(version.reviewRound)}` : ""}</small>`;
    return `<li class="sop-inbox-row"><div><strong>${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</strong>${detail}</div>${renderSopStatusChip(version)}<div class="sop-inbox-actions">${actions}</div></li>`;
  };
  const empty = { returned: "No tienes SOP devueltas.", toReview: "No hay SOP pendientes de revisar.", toPublish: "No hay SOP aprobadas por publicar.", sent: "Todavía no has enviado SOP." }[current.id];
  return `<section class="sop-inbox" aria-labelledby="sop-inbox-title">
    <div class="sop-inbox-head"><h3 id="sop-inbox-title"><span class="material-symbols-rounded" aria-hidden="true">inbox</span>Bandeja de revisión</h3></div>
    <div class="sop-inbox-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" class="sop-inbox-tab ${tab.id === current.id ? "is-on" : ""} ${tab.urgent && tab.items.length ? "has-items" : ""}" aria-selected="${tab.id === current.id}" data-action="sop-inbox-tab" data-tab="${tab.id}"><span class="material-symbols-rounded" aria-hidden="true">${tab.icon}</span>${tab.label}<b>${tab.items.length}</b></button>`).join("")}</div>
    ${current.items.length ? `<ul class="sop-inbox-list">${current.items.map(row).join("")}</ul>` : `<p class="sop-inbox-empty">${empty}</p>`}
  </section>`;
}

// Abre el editor con la misma versión devuelta (mismo id) para corregirla y reenviarla.
function openSopResubmit(state, versionId) {
  const source = (state.sopVersionHistory ?? []).find((entry) => entry.id === versionId);
  if (!source || !isMySopVersion(source) || getSopVersionStatus(source) !== "rejected") return false;
  const draft = structuredClone(source);
  draft.document.stationAssignment = getSopVersionStationAssignment(state, source);
  const station = getWorkStationAssignment(draft.document.stationAssignment);
  draft.document.stationType = station?.type ?? "MFG";
  draft.document.stationMode = "existing";
  draft.document.stationName = "";
  draft.sourceKind = "revision";
  draft.basedOnRevision = source.document.revision;
  draft.resubmit = true;
  draft.reviewFeedback = sopLatestReturn(source);
  state.sopDraft = draft;
  state.sopDraftStage = 2;
  state.sopDraftError = "";
  state.sopDraftNotice = "";
  state.sopReview = null;
  return true;
}

// Panel "Comentarios del revisor" para el editor de una versión devuelta.
function renderSopFeedbackPanel(draft, procedureId = null) {
  const feedback = draft?.reviewFeedback;
  if (!feedback) return "";
  const marks = (feedback.marks ?? []).filter((mark) => !procedureId || mark.procedureId === procedureId);
  const sheetOf = (id) => draft.procedures.find((procedure) => procedure.id === id)?.sheet ?? "?";
  return `<div class="srm-feedback">
    <p class="srm-feedback-title"><span class="material-symbols-rounded" aria-hidden="true">feedback</span>Comentarios de ${escapeHtml(feedback.reviewerName ?? "el revisor")} · ronda ${escapeHtml(feedback.round)}</p>
    ${feedback.note ? `<p class="srm-feedback-note">${escapeHtml(feedback.note)}</p>` : ""}
    ${marks.length ? `<ol class="srm-list">${marks.map((mark, index) => `<li><span class="srm-num">${index + 1}</span><span>${procedureId ? "" : `Hoja ${escapeHtml(sheetOf(mark.procedureId))} · `}<b>${SOP_MARK_TYPES[mark.type] ?? "Marca"}</b>${mark.text ? ` · ${escapeHtml(mark.text)}` : ""}</span></li>`).join("")}</ol>` : `<p class="srm-empty">${procedureId ? "Sin marcas del revisor en esta hoja." : "Sin marcas sobre las hojas."}</p>`}
  </div>`;
}

// Capa de marcas del revisor dentro del editor (solo lectura).
function paintSopFeedbackOverlay(root, draft, procedure, aspect) {
  const overlay = root?.querySelector("[data-ws-review-overlay]");
  if (!overlay) return;
  const marks = (draft?.reviewFeedback?.marks ?? []).filter((mark) => mark.procedureId === procedure?.id);
  const shapes = renderSopMarkShapes(marks, aspect, marks.map((_, index) => index + 1));
  overlay.setAttribute("viewBox", shapes.viewBox);
  overlay.innerHTML = shapes.html;
  overlay.hidden = !marks.length;
}

// ---------------------------------------------------------------- contador del menú
async function refreshSopInboxSummary(state) {
  if (!canAccessSopAdmin()) { state.sopInboxSummary = null; return; }
  const result = await sopApi("GET", "/api/sop-versions/mine/summary");
  if (result.ok) state.sopInboxSummary = result.data.summary;
}

// ---------------------------------------------------------------- eventos
function bindSopReviewMarks(app, { state, render, showToast }) {
  let drag = null;
  const point = (stage, event) => {
    const box = stage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) };
  };
  const addMark = (mark) => {
    state.sopReviewMarks = [...(state.sopReviewMarks ?? []), mark];
    state.sopReviewMarkText = "";
    render();
  };

  app.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    const name = action.dataset.action;
    if (name === "srm-sheet") { state.sopReviewSheet = Number(action.dataset.index) || 0; render(); }
    else if (name === "srm-tool") { state.sopReviewTool = action.dataset.tool; render(); }
    else if (name === "srm-undo") { state.sopReviewMarks = (state.sopReviewMarks ?? []).slice(0, -1); render(); }
    else if (name === "srm-delete") { const position = Number(action.dataset.position); state.sopReviewMarks = (state.sopReviewMarks ?? []).filter((_, index) => index !== position); render(); }
    else if (name === "sop-inbox-tab") { state.sopInboxTab = action.dataset.tab; render(); }
    else if (name === "sop-resubmit-open") {
      if (state.sopDraft) { showToast("Guarda o descarta la edición actual antes de abrir otra revisión.", "warning"); return; }
      if (!openSopResubmit(state, action.dataset.versionId)) { showToast("Solo quien subió la SOP puede corregirla y reenviarla.", "warning"); return; }
      state.activeSection = "sop-admin";
      render();
      window.scrollTo({ top: 0 });
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.matches("[data-srm-text]")) state.sopReviewMarkText = event.target.value;
    if (event.target.matches("#sop-review-note")) state.sopReviewNoteDraft = event.target.value;
  });

  app.addEventListener("pointerdown", (event) => {
    const stage = event.target.closest('[data-srm-stage][data-editable="true"]');
    if (!stage || event.button !== 0) return;
    event.preventDefault();
    const tool = state.sopReviewTool ?? "box";
    const start = point(stage, event);
    const procedureId = stage.dataset.procedureId;
    const text = String(state.sopReviewMarkText ?? "").trim();
    if (tool === "note") {
      if (!text) { showToast("Escribe primero el comentario de la nota.", "warning"); stage.closest(".srm-card")?.querySelector("[data-srm-text]")?.focus(); return; }
      addMark({ procedureId, type: "note", x: start.x, y: start.y, w: 0, h: 0, text });
      return;
    }
    stage.setPointerCapture?.(event.pointerId);
    const preview = document.createElementNS("http://www.w3.org/2000/svg", tool === "box" ? "rect" : "line");
    preview.setAttribute("class", tool === "box" ? "srm-box srm-preview" : "srm-arrow srm-preview");
    stage.querySelector("[data-srm-overlay]")?.append(preview);
    drag = { stage, start, tool, procedureId, text, preview };
  });

  app.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const end = point(drag.stage, event);
    const overlay = drag.stage.querySelector("[data-srm-overlay]");
    const height = Number(String(overlay?.getAttribute("viewBox") ?? "0 0 1000 772").split(" ")[3]) || 772;
    const x1 = drag.start.x * 1000; const y1 = drag.start.y * height; const x2 = end.x * 1000; const y2 = end.y * height;
    if (drag.tool === "box") {
      drag.preview.setAttribute("x", Math.min(x1, x2)); drag.preview.setAttribute("y", Math.min(y1, y2));
      drag.preview.setAttribute("width", Math.abs(x2 - x1)); drag.preview.setAttribute("height", Math.abs(y2 - y1));
    } else {
      drag.preview.setAttribute("x1", x1); drag.preview.setAttribute("y1", y1); drag.preview.setAttribute("x2", x2); drag.preview.setAttribute("y2", y2);
      drag.preview.setAttribute("marker-end", "url(#srm-head)");
    }
  });

  const finish = (event) => {
    if (!drag) return;
    const current = drag;
    drag = null;
    const end = point(current.stage, event);
    const w = end.x - current.start.x;
    const h = end.y - current.start.y;
    current.preview.remove();
    if (Math.hypot(w, h) < 0.012) { showToast(current.tool === "box" ? "Arrastra para dibujar el recuadro." : "Arrastra para dibujar la flecha.", "warning"); return; }
    addMark({ procedureId: current.procedureId, type: current.tool, x: current.start.x, y: current.start.y, w, h, text: current.text });
  };
  app.addEventListener("pointerup", finish);
  app.addEventListener("pointercancel", () => { drag?.preview.remove(); drag = null; });
}
