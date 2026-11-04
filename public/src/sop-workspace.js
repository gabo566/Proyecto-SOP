// Etapa 2 «Editar» del flujo de revisión de SOP: miniaturas de hojas · lienzo con herramientas · panel con pestañas.
// Vive dentro de la página (host [data-sop-ws-host]) y trabaja directamente sobre state.sopDraft.
// Se vuelve a montar tras cada render() de la aplicación conservando selección, zoom e historial.

const SOP_WS_TOOLS = [
  { id: "select", icon: "near_me", label: "Seleccionar", key: "V", hint: "Haz clic en una marca para seleccionarla; arrástrala para moverla o usa sus puntos para cambiar el tamaño." },
  { id: "arrow", icon: "north_east", label: "Flecha", key: "A", hint: "Arrastra sobre la hoja para trazar una flecha. Mantén Shift para ángulos de 15°." },
  { id: "box", icon: "crop_square", label: "Recuadro", key: "R", hint: "Arrastra sobre la hoja para encuadrar un área." },
  { id: "highlight", icon: "highlight", label: "Resaltador", key: "H", hint: "Arrastra sobre un texto o zona para resaltarla." },
  { id: "number", icon: "looks_one", label: "Número", key: "N", hint: "Haz clic para colocar el siguiente número de referencia." },
  { id: "note", icon: "sticky_note_2", label: "Nota", key: "M", hint: "Haz clic para colocar una nota y escribe su texto en la pestaña Marcas." },
  { id: "text", icon: "title", label: "Texto libre", key: "T", hint: "Haz clic para colocar un texto y escríbelo en la pestaña Marcas." },
  { id: "edit", icon: "edit_note", label: "Texto del documento", key: "E", hint: "Haz clic sobre un texto de la hoja para corregirlo; se dibuja con la misma letra del documento." },
];
const SOP_WS_COLORS = [["#d31e27", "Rojo"], ["#1f56b3", "Azul"], ["#f0a020", "Ámbar"], ["#2f8f3c", "Verde"], ["#ffe14d", "Amarillo"], ["#111111", "Negro"], ["#ffffff", "Blanco"]];
const SOP_WS_TYPE_NAMES = { arrow: "Flecha", box: "Recuadro", highlight: "Resaltado", number: "Número", note: "Nota", text: "Texto", textfix: "Texto corregido" };
const SOP_WS_TYPE_ICONS = { arrow: "north_east", box: "crop_square", highlight: "highlight", number: "looks_one", note: "sticky_note_2", text: "title", textfix: "edit_note" };

let sopWs = null;
let sopWsGlobalsBound = false;

// ---------------------------------------------------------------- montaje
function createSopWsState(state) {
  return {
    draftId: state.sopDraft.id, state, root: null, host: null,
    procedureIndex: Math.max(0, state.sopDraft.procedures.findIndex((procedure) => procedure.steps.length)), stepIndex: 0, tool: "select", tab: "steps", selectedId: null, zoom: 1, dash: "solid", width: 8,
    colors: { arrow: "#d31e27", box: "#d31e27", highlight: "#ffe14d", number: "#d31e27", note: "#f0a020", text: "#d31e27" },
    history: new Map(), drag: null, renderSeq: 0, aspect: SOP_PAGE_ASPECT, vp: null, natural: null,
    textEdit: null, fieldSnapshot: null, space: false, busy: false, nudgeAt: 0, thumbChain: Promise.resolve(),
  };
}

// Se llama después de cada render() de la aplicación.
function mountSopWorkspace(state) {
  const host = document.querySelector("[data-sop-ws-host]");
  if (!state?.sopDraft) { sopWs = null; return; }
  if (!host) return;
  if (!sopWs || sopWs.draftId !== state.sopDraft.id) sopWs = createSopWsState(state);
  sopWs.state = state;
  sopWs.host = host;
  host.innerHTML = buildSopWorkspaceShell();
  sopWs.root = host.querySelector(".sop-ws-inline");
  sopWs.procedureIndex = Math.max(0, Math.min(state.sopDraft.procedures.length - 1, sopWs.procedureIndex));
  bindSopWorkspace(sopWs.root);
  renderSopWsRail();
  renderSopWsToolbar();
  renderSopWsTop();
  renderSopWsInspector();
  paintSopWsPage();
}

// Antes de salir de la etapa 2: quita notas y textos vacíos (no se pueden publicar).
function cleanupSopWorkspaceDraft(draft) {
  for (const procedure of draft?.procedures ?? []) {
    procedure.annotations = (procedure.annotations ?? []).filter((annotation) => !(["note", "text"].includes(annotation.type) && !String(annotation.text ?? "").trim()));
  }
}

const sopWsDraft = () => sopWs?.state.sopDraft;
const sopWsProcedure = () => sopWsDraft()?.procedures[sopWs.procedureIndex];
const sopWsAnnotations = () => (sopWsProcedure().annotations ??= []);
const sopWsSelected = () => sopWsAnnotations().find((annotation) => annotation.id === sopWs.selectedId) ?? null;
const sopWsCanAnnotate = () => Boolean(sopWsProcedure()?.steps?.length);
const sopWsNotice = (message, kind = "success") => showInlineNotice(message, kind);

function buildSopWorkspaceShell() {
  const draft = sopWsDraft();
  return `<div class="sop-flow-editor">
    <div class="sop-flow-editor-head">
      <div><h2 class="sop-flow-title">${escapeHtml(draft.document.title)}${draft.document.revision ? ` · Rev. ${escapeHtml(draft.document.revision)}` : ""}</h2><p class="sop-flow-sub" data-ws-summary></p></div>
      <div class="sop-flow-editor-actions">
        <button class="sop-flow-btn sop-flow-btn--ghost sop-flow-btn--icon" type="button" data-ws-action="undo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><span class="material-symbols-rounded" aria-hidden="true">undo</span></button>
        <button class="sop-flow-btn sop-flow-btn--ghost sop-flow-btn--icon" type="button" data-ws-action="redo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><span class="material-symbols-rounded" aria-hidden="true">redo</span></button>
        <div class="sop-ws-menu"><button class="sop-flow-btn sop-flow-btn--ghost" type="button" data-ws-action="toggle-export" aria-haspopup="true" aria-expanded="false"><span class="material-symbols-rounded" aria-hidden="true">download</span>Exportar</button>
          <div class="sop-ws-menu-list" data-ws-export-menu hidden role="menu">
            <p>PDF con anotaciones</p>
            <button type="button" role="menuitem" data-ws-action="export-pdf" data-scope="current"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>Hoja actual</button>
            <button type="button" role="menuitem" data-ws-action="export-pdf" data-scope="changed"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>Hojas con cambios</button>
            <button type="button" role="menuitem" data-ws-action="export-pdf" data-scope="all"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>Todas las hojas</button>
            <p>Otros formatos</p>
            <button type="button" role="menuitem" data-ws-action="export-png"><span class="material-symbols-rounded" aria-hidden="true">image</span>Imagen PNG de la hoja actual</button>
            <button type="button" role="menuitem" data-ws-action="export-csv"><span class="material-symbols-rounded" aria-hidden="true">table_view</span>Resumen de cambios (CSV)</button>
            <button type="button" role="menuitem" data-ws-action="export-print"><span class="material-symbols-rounded" aria-hidden="true">print</span>Resumen de cambios (imprimir)</button>
          </div></div>
        <button class="sop-flow-btn sop-flow-btn--green" type="button" data-ws-action="go-review">Revisar y publicar<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </div>
    </div>
    <div class="sop-ws-inline">
      <nav class="sop-ws-rail" aria-label="Hojas de la SOP" data-ws-rail></nav>
      <section class="sop-ws-stage" aria-label="Hoja">
        <div class="sop-ws-toolbar" role="toolbar" aria-label="Herramientas" data-ws-toolbar></div>
        <p class="sop-ws-hint" role="status" data-ws-hint></p>
        <div class="sop-ws-viewport" data-ws-viewport>
          <div class="sop-ws-page" data-ws-page><canvas data-ws-canvas></canvas>
            <svg class="sop-ws-overlay" data-ws-overlay viewBox="0 0 1000 772" preserveAspectRatio="none" tabindex="0" aria-label="Lienzo de anotaciones"></svg></div>
          <p class="sop-ws-status" data-ws-status role="status">Cargando hoja…</p>
        </div>
      </section>
      <aside class="sop-ws-inspector" aria-label="Pasos y propiedades" data-ws-inspector></aside>
    </div>
    <div class="sop-flow-nav">
      <button class="sop-flow-btn sop-flow-btn--ghost" type="button" data-ws-action="step-prev"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Paso anterior</button>
      <strong data-ws-step-label></strong>
      <button class="sop-flow-btn sop-flow-btn--blue" type="button" data-ws-action="step-next">Paso siguiente<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- historial
function sopWsHistory() {
  const key = sopWs.procedureIndex;
  if (!sopWs.history.has(key)) sopWs.history.set(key, { undo: [], redo: [] });
  return sopWs.history.get(key);
}

function sopWsSnapshot() {
  return JSON.stringify(sopWsAnnotations());
}

function sopWsCommit(before) {
  if (before === sopWsSnapshot()) return false;
  const history = sopWsHistory();
  history.undo.push(before);
  if (history.undo.length > 120) history.undo.shift();
  history.redo = [];
  sopWsChanged();
  return true;
}

function sopWsMutate(change) {
  const before = sopWsSnapshot();
  change();
  sopWsCommit(before);
}

function sopWsStep(direction) {
  const history = sopWsHistory();
  const from = direction === "undo" ? history.undo : history.redo;
  const to = direction === "undo" ? history.redo : history.undo;
  if (!from.length) return;
  to.push(sopWsSnapshot());
  sopWsProcedure().annotations = JSON.parse(from.pop());
  if (!sopWsSelected()) sopWs.selectedId = null;
  sopWsChanged();
  renderSopWsInspector();
}

function sopWsChanged() {
  paintSopWsOverlay();
  renderSopWsTop();
  updateSopWsRailMeta();
  renderSopWsAnnotationList();
  const tab = sopWs.root?.querySelector('[data-ws-tab="marks"]');
  if (tab) tab.textContent = `Marcas · ${sopWsAnnotations().length}`;
}

// ---------------------------------------------------------------- cabecera, barra de herramientas y rail
function renderSopWsTop() {
  const root = sopWs?.root;
  if (!root) return;
  const draft = sopWsDraft();
  const changes = collectSopChanges(draft).length;
  const stepCount = draft.procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  const summary = root.closest(".sop-flow-editor")?.querySelector("[data-ws-summary]");
  if (summary) summary.textContent = `${draft.procedures.length} hojas · ${stepCount} pasos · ${changes} ${changes === 1 ? "cambio" : "cambios"} sin publicar`;
  const history = sopWsHistory();
  const editor = root.closest(".sop-flow-editor");
  editor.querySelector('[data-ws-action="undo"]').disabled = !history.undo.length;
  editor.querySelector('[data-ws-action="redo"]').disabled = !history.redo.length;
  updateSopWsStepNav();
}

function sopWsStepPosition() {
  const draft = sopWsDraft();
  const procedure = sopWsProcedure();
  const total = procedure.steps.length;
  const previous = draft.procedures.slice(0, sopWs.procedureIndex).some((item) => item.steps.length);
  const next = draft.procedures.slice(sopWs.procedureIndex + 1).some((item) => item.steps.length);
  return { total, canPrev: sopWs.stepIndex > 0 || previous, canNext: sopWs.stepIndex < total - 1 || next };
}

function updateSopWsStepNav() {
  const editor = sopWs?.root?.closest(".sop-flow-editor");
  if (!editor) return;
  const procedure = sopWsProcedure();
  const position = sopWsStepPosition();
  const label = editor.querySelector("[data-ws-step-label]");
  if (label) label.textContent = position.total ? `Paso ${sopWs.stepIndex + 1} de ${position.total} · Hoja ${procedure.sheet}` : `Hoja ${procedure.sheet} · sin pasos`;
  editor.querySelector('[data-ws-action="step-prev"]').disabled = !position.canPrev;
  editor.querySelector('[data-ws-action="step-next"]').disabled = !position.canNext;
}

function sopWsGoStep(direction) {
  const draft = sopWsDraft();
  const procedure = sopWsProcedure();
  let next = sopWs.stepIndex + direction;
  if (next >= 0 && next < procedure.steps.length) {
    sopWs.stepIndex = next;
    renderSopWsInspector();
    paintSopWsOverlay();
    updateSopWsStepNav();
    return;
  }
  const candidates = draft.procedures.map((item, index) => ({ item, index })).filter(({ item, index }) => item.steps.length && (direction > 0 ? index > sopWs.procedureIndex : index < sopWs.procedureIndex));
  const target = direction > 0 ? candidates[0] : candidates.at(-1);
  if (!target) return;
  sopWsSelectSheet(target.index, direction > 0 ? 0 : target.item.steps.length - 1);
}

function renderSopWsToolbar() {
  const root = sopWs.root;
  const disabled = !sopWsCanAnnotate();
  root.querySelector("[data-ws-toolbar]").innerHTML = `${SOP_WS_TOOLS.map((tool) => `<button type="button" class="sop-ws-tool" data-ws-tool="${tool.id}" aria-pressed="${sopWs.tool === tool.id}" title="${tool.label} (${tool.key})" aria-label="${tool.label}" ${disabled && tool.id !== "select" ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${tool.icon}</span><span class="sop-ws-tool-label">${tool.label}</span></button>`).join("")}
    <span class="sop-ws-sep" aria-hidden="true"></span>
    <button type="button" class="sop-ws-icon" data-ws-action="zoom-out" title="Alejar" aria-label="Alejar"><span class="material-symbols-rounded" aria-hidden="true">zoom_out</span></button>
    <output class="sop-ws-zoom" data-ws-zoom>${Math.round(sopWs.zoom * 100)}%</output>
    <button type="button" class="sop-ws-icon" data-ws-action="zoom-in" title="Acercar" aria-label="Acercar"><span class="material-symbols-rounded" aria-hidden="true">zoom_in</span></button>
    <button type="button" class="sop-ws-icon" data-ws-action="zoom-fit" title="Ajustar a la ventana" aria-label="Ajustar a la ventana"><span class="material-symbols-rounded" aria-hidden="true">fit_screen</span></button>`;
  const tool = SOP_WS_TOOLS.find((item) => item.id === sopWs.tool);
  root.querySelector("[data-ws-hint]").innerHTML = disabled
    ? '<span class="material-symbols-rounded" aria-hidden="true">info</span>Esta hoja no tiene pasos. Añade un paso en la pestaña Pasos para poder anotarla.'
    : `<span class="material-symbols-rounded" aria-hidden="true">${tool.icon}</span>${escapeHtml(tool.hint)}`;
  root.querySelector("[data-ws-viewport]").dataset.tool = sopWs.tool;
}

function renderSopWsRail() {
  const draft = sopWsDraft();
  const rail = sopWs.root.querySelector("[data-ws-rail]");
  rail.innerHTML = draft.procedures.map((procedure, index) => `<button type="button" class="sop-ws-thumb" data-ws-sheet="${index}" aria-current="${index === sopWs.procedureIndex}">
    <canvas data-index="${index}" data-pending="1" width="120" height="93"></canvas>
    <span class="sop-ws-thumb-info"><strong>Hoja ${escapeHtml(procedure.sheet)}</strong><small data-ws-thumb-meta="${index}"></small></span><i class="sop-ws-dot" data-ws-thumb-dot="${index}" aria-hidden="true"></i></button>`).join("");
  updateSopWsRailMeta();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      sopWs.thumbChain = sopWs.thumbChain.then(() => paintSopWsThumb(entry.target)).catch(() => {});
    }
  }, { root: rail, rootMargin: "300px" });
  rail.querySelectorAll("canvas[data-pending]").forEach((canvas) => observer.observe(canvas));
  rail.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
}

function sopWsSheetHasChanges(procedure) {
  return (procedure.annotations ?? []).length > 0 || procedure.steps.some((step) => step.added || isSopStepEdited(step));
}

function updateSopWsRailMeta() {
  const draft = sopWsDraft();
  const root = sopWs?.root;
  if (!draft || !root) return;
  draft.procedures.forEach((procedure, index) => {
    const meta = root.querySelector(`[data-ws-thumb-meta="${index}"]`);
    const dot = root.querySelector(`[data-ws-thumb-dot="${index}"]`);
    const marks = (procedure.annotations ?? []).length;
    if (meta) meta.textContent = `${procedure.steps.length} ${procedure.steps.length === 1 ? "paso" : "pasos"}${marks ? ` · ${marks} ${marks === 1 ? "marca" : "marcas"}` : ""}`;
    if (dot) {
      const reviewed = procedure.steps.length > 0 && procedure.steps.every((step) => step.reviewed);
      dot.dataset.state = reviewed ? "reviewed" : sopWsSheetHasChanges(procedure) ? "edited" : procedure.steps.length ? "" : "empty";
    }
  });
  root.querySelectorAll("[data-ws-sheet]").forEach((button) => button.setAttribute("aria-current", String(Number(button.dataset.wsSheet) === sopWs.procedureIndex)));
}

async function paintSopWsThumb(canvas) {
  if (!sopWs || !canvas.isConnected) return;
  const procedure = sopWsDraft().procedures[Number(canvas.dataset.index)];
  if (!procedure) return;
  const pdf = await getSopDraftPdfDocument(sopWsDraft());
  const page = await pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet));
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 120 / natural.width });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport, background: "#ffffff" }).promise;
  delete canvas.dataset.pending;
}

// ---------------------------------------------------------------- lienzo
async function paintSopWsPage() {
  const ws = sopWs;
  if (!ws?.root) return;
  const sequence = ++ws.renderSeq;
  const root = ws.root;
  const status = root.querySelector("[data-ws-status]");
  const canvas = root.querySelector("[data-ws-canvas]");
  const procedure = sopWsProcedure();
  status.textContent = "Cargando hoja…";
  status.hidden = false;
  try {
    const draft = sopWsDraft();
    const pdf = await getSopDraftPdfDocument(draft);
    const pdfPage = Number(procedure.pdfPage ?? procedure.sheet);
    if (!Number.isInteger(pdfPage) || pdfPage < 1 || pdfPage > pdf.numPages) throw new Error(`No existe la página ${pdfPage} en el PDF.`);
    const page = await pdf.getPage(pdfPage);
    if (sequence !== ws.renderSeq || !canvas.isConnected) return;
    await ensureSopStepBounds(draft, procedure);
    const natural = page.getViewport({ scale: 1 });
    ws.natural = natural;
    ws.aspect = natural.width / natural.height;
    procedure.pageAspect = Math.round(ws.aspect * 10000) / 10000;
    const area = root.querySelector("[data-ws-viewport]");
    const fit = Math.min(Math.max(120, area.clientWidth - 40) / natural.width, Math.max(120, area.clientHeight - 40) / natural.height);
    const viewport = page.getViewport({ scale: fit * ws.zoom });
    const output = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 4096 / viewport.width, 4096 / viewport.height));
    canvas.width = Math.ceil(viewport.width * output);
    canvas.height = Math.ceil(viewport.height * output);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    const pageBox = root.querySelector("[data-ws-page]");
    pageBox.style.width = `${Math.ceil(viewport.width)}px`;
    pageBox.style.height = `${Math.ceil(viewport.height)}px`;
    await page.render({
      canvasContext: canvas.getContext("2d", { alpha: false }), viewport,
      transform: output === 1 ? null : [output, 0, 0, output, 0, 0], background: "#ffffff",
    }).promise;
    if (sequence !== ws.renderSeq || !canvas.isConnected) return;
    ws.vp = viewport;
    ws.page = page;
    status.hidden = true;
    paintSopWsOverlay();
  } catch (error) {
    if (sequence !== ws.renderSeq) return;
    status.textContent = error?.message || "No se pudo cargar la hoja de la SOP.";
  }
}

function sopWsUniformBox(annotation) {
  const aspect = sopWs.aspect;
  if (annotation.type === "arrow") {
    const x1 = annotation.x1, x2 = annotation.x2, y1 = annotation.y1 / aspect, y2 = annotation.y2 / aspect;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  if (["box", "highlight", "textfix"].includes(annotation.type)) return { x: annotation.x, y: annotation.y / aspect, w: annotation.width, h: annotation.height / aspect };
  if (annotation.type === "number") return { x: annotation.x - 29, y: annotation.y / aspect - 29, w: 58, h: 58 };
  const box = measureSopAnnotationBox(annotation);
  return { x: annotation.x, y: annotation.y / aspect, w: box.width, h: box.height };
}

function sopWsHandles(annotation) {
  const aspect = sopWs.aspect;
  if (annotation.type === "arrow") return [{ id: "p1", x: annotation.x1, y: annotation.y1 / aspect }, { id: "p2", x: annotation.x2, y: annotation.y2 / aspect }];
  if (annotation.type === "box" || annotation.type === "highlight") {
    const box = sopWsUniformBox(annotation);
    return [{ id: "nw", x: box.x, y: box.y }, { id: "ne", x: box.x + box.w, y: box.y }, { id: "sw", x: box.x, y: box.y + box.h }, { id: "se", x: box.x + box.w, y: box.y + box.h }];
  }
  return [];
}

function paintSopWsOverlay(preview = null) {
  const ws = sopWs;
  const overlay = ws?.root?.querySelector("[data-ws-overlay]");
  if (!overlay) return;
  const aspect = ws.aspect;
  overlay.setAttribute("viewBox", `0 0 1000 ${Math.round(1000 / aspect * 100) / 100}`);
  let ui = "";
  const procedure = sopWsProcedure();
  const step = procedure.steps[ws.stepIndex];
  if (step?.sourceBounds && ws.natural && !ws.textEdit && ws.tool !== "edit") {
    const bounds = step.sourceBounds;
    const x = bounds.x / ws.natural.width * 1000;
    const y = (ws.natural.height - (bounds.y + bounds.height)) / ws.natural.height * 1000 / aspect;
    ui += `<rect class="sop-ws-step-focus" x="${x - 4}" y="${y - 4}" width="${bounds.width / ws.natural.width * 1000 + 8}" height="${bounds.height / ws.natural.height * 1000 / aspect + 8}" rx="4" />`;
  }
  const selected = sopWsSelected();
  if (selected) {
    const box = sopWsUniformBox(selected);
    ui += `<rect class="sop-ws-selection" x="${box.x - 8}" y="${box.y - 8}" width="${box.w + 16}" height="${box.h + 16}" rx="6" />`;
    ui += sopWsHandles(selected).map((handle) => `<circle class="sop-ws-handle" data-handle="${handle.id}" cx="${handle.x}" cy="${handle.y}" r="10" />`).join("");
  }
  overlay.innerHTML = `${renderSopAnnotationContents(sopWsAnnotations(), preview, { aspect })}<g class="sop-ws-ui">${ui}</g>`;
}

// ---------------------------------------------------------------- geometría y selección
function sopWsPoint(event) {
  const bounds = sopWs.root.querySelector("[data-ws-overlay]").getBoundingClientRect();
  return {
    x: clampSopAnnotationCoordinate((event.clientX - bounds.left) / Math.max(1, bounds.width) * 1000),
    y: clampSopAnnotationCoordinate((event.clientY - bounds.top) / Math.max(1, bounds.height) * 1000),
  };
}

function sopWsDistanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sopWsHit(point) {
  const aspect = sopWs.aspect;
  const px = point.x, py = point.y / aspect;
  const annotations = sopWsAnnotations();
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (annotation.type === "arrow") {
      const tolerance = Math.max(14, (Number(annotation.strokeWidth) || 10) * 1.2);
      if (sopWsDistanceToSegment(px, py, annotation.x1, annotation.y1 / aspect, annotation.x2, annotation.y2 / aspect) <= tolerance) return annotation;
      continue;
    }
    const box = sopWsUniformBox(annotation);
    const pad = annotation.type === "number" ? 4 : 6;
    if (px >= box.x - pad && px <= box.x + box.w + pad && py >= box.y - pad && py <= box.y + box.h + pad) return annotation;
  }
  return null;
}

function sopWsHitHandle(point) {
  const selected = sopWsSelected();
  if (!selected) return null;
  const aspect = sopWs.aspect;
  return sopWsHandles(selected).find((handle) => Math.hypot(point.x - handle.x, point.y / aspect - handle.y) <= 18)?.id ?? null;
}

function sopWsSelect(id) {
  sopWs.selectedId = id;
  sopWs.textEdit = null;
  if (id) sopWs.tab = "marks";
  paintSopWsOverlay();
  renderSopWsInspector();
}

function sopWsMoveBy(annotation, original, dx, dy) {
  if (annotation.type === "arrow") {
    const minX = Math.min(original.x1, original.x2), maxX = Math.max(original.x1, original.x2);
    const minY = Math.min(original.y1, original.y2), maxY = Math.max(original.y1, original.y2);
    const mx = Math.max(-minX, Math.min(1000 - maxX, dx));
    const my = Math.max(-minY, Math.min(1000 - maxY, dy));
    Object.assign(annotation, { x1: original.x1 + mx, x2: original.x2 + mx, y1: original.y1 + my, y2: original.y2 + my });
    return;
  }
  if (["box", "highlight", "textfix"].includes(annotation.type)) {
    const mx = Math.max(-original.x, Math.min(1000 - original.x - original.width, dx));
    const my = Math.max(-original.y, Math.min(1000 - original.y - original.height, dy));
    annotation.x = original.x + mx;
    annotation.y = original.y + my;
    if (annotation.type === "textfix") {
      annotation.baselineX = original.baselineX + mx;
      annotation.baselineY = original.baselineY + my;
    }
    return;
  }
  annotation.x = Math.max(0, Math.min(1000, original.x + dx));
  annotation.y = Math.max(0, Math.min(1000, original.y + dy));
}

function sopWsResize(annotation, original, handle, point) {
  if (annotation.type === "arrow") {
    if (handle === "p1") Object.assign(annotation, { x1: point.x, y1: point.y });
    else Object.assign(annotation, { x2: point.x, y2: point.y });
    return;
  }
  const right = original.x + original.width, bottom = original.y + original.height;
  const min = 8;
  const x = handle.includes("w") ? Math.min(point.x, right - min) : original.x;
  const y = handle.includes("n") ? Math.min(point.y, bottom - min) : original.y;
  const x2 = handle.includes("e") ? Math.max(point.x, original.x + min) : right;
  const y2 = handle.includes("s") ? Math.max(point.y, original.y + min) : bottom;
  Object.assign(annotation, { x, y, width: x2 - x, height: y2 - y });
}

function sopWsNewAnnotation(type, extra = {}) {
  const procedure = sopWsProcedure();
  const step = procedure.steps[sopWs.stepIndex];
  const base = { id: crypto.randomUUID(), type, stepNumber: step ? String(step.number) : "", aspect: Math.round(sopWs.aspect * 10000) / 10000, color: sopWs.colors[type] ?? "#d31e27" };
  if (type === "arrow" || type === "box") Object.assign(base, { strokeWidth: sopWs.width, ...(sopWs.dash === "dashed" ? { dash: "dashed" } : {}) });
  if (type === "highlight") base.opacity = 0.38;
  return Object.assign(base, extra);
}

// ---------------------------------------------------------------- panel derecho con pestañas
function renderSopWsInspector() {
  const ws = sopWs;
  if (!ws?.root) return;
  const procedure = sopWsProcedure();
  ws.stepIndex = Math.min(ws.stepIndex, Math.max(0, procedure.steps.length - 1));
  const tabs = [["steps", "Pasos"], ["marks", `Marcas · ${(procedure.annotations ?? []).length}`], ["sheet", "Hoja"]];
  const body = ws.tab === "marks" ? sopWsMarksTabHtml() : ws.tab === "sheet" ? sopWsSheetTabHtml() : sopWsStepsTabHtml();
  ws.root.querySelector("[data-ws-inspector]").innerHTML = `<div class="sop-flow-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="sop-flow-tab ${ws.tab === id ? "is-on" : ""}" data-ws-tab="${id}" aria-selected="${ws.tab === id}">${label}</button>`).join("")}</div><div class="sop-flow-pane">${body}</div>`;
  updateSopWsStepNav();
}

function sopWsStepsTabHtml() {
  const procedure = sopWsProcedure();
  const currentStep = procedure.steps[sopWs.stepIndex];
  const cards = procedure.steps.length
    ? procedure.steps.map((step, index) => {
      const pill = step.reviewed ? '<i class="sop-flow-pill sop-flow-pill--ok">Revisado</i>' : (step.added || isSopStepEdited(step)) ? '<i class="sop-flow-pill sop-flow-pill--edit">Editado</i>' : "";
      return `<button type="button" class="sop-flow-step ${index === sopWs.stepIndex ? "is-current" : ""}" data-ws-step="${index}"><b>${escapeHtml(step.number || "—")}</b><span>${escapeHtml(step.text || "Paso sin texto")}</span>${pill}</button>`;
    }).join("")
    : '<p class="sop-ws-empty">Esta hoja todavía no tiene pasos.</p>';
  const editor = currentStep ? `<div class="sop-flow-step-editor">
      <div class="sop-ws-field-row"><label>Número<input type="text" data-ws-step-field="number" value="${escapeHtml(currentStep.number)}" maxlength="20" /></label>
        <button type="button" class="sop-ws-small ${currentStep.reviewed ? "is-on" : ""}" data-ws-action="toggle-reviewed"><span class="material-symbols-rounded" aria-hidden="true">${currentStep.reviewed ? "check_circle" : "radio_button_unchecked"}</span>${currentStep.reviewed ? "Revisado" : "Marcar revisado"}</button></div>
      <label>Texto del paso<textarea rows="4" data-ws-step-field="text">${escapeHtml(currentStep.text)}</textarea></label>
      <div class="sop-ws-field-row"><button type="button" class="sop-ws-small" data-ws-action="restore-step" ${isSopStepEdited(currentStep) ? "" : "hidden"}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Restaurar</button>
        <button type="button" class="sop-ws-small sop-ws-small--danger" data-ws-action="delete-step"><span class="material-symbols-rounded" aria-hidden="true">delete</span>Eliminar paso</button></div>
    </div>` : "";
  return `<p class="sop-flow-pane-title">Hoja ${escapeHtml(procedure.sheet)} · ${escapeHtml(procedure.title)}</p>${cards}${editor}
    <button type="button" class="sop-ws-small" data-ws-action="add-step"><span class="material-symbols-rounded" aria-hidden="true">add</span>Añadir paso a esta hoja</button>`;
}

function sopWsSheetTabHtml() {
  const procedure = sopWsProcedure();
  const reviewed = procedure.steps.filter((step) => step.reviewed).length;
  return `<p class="sop-flow-pane-title">Datos de la hoja ${escapeHtml(procedure.sheet)}</p>
    <label>Nombre de la hoja<input type="text" data-ws-sheet-title value="${escapeHtml(procedure.title)}" maxlength="120" /></label>
    <p class="sop-ws-muted">${procedure.steps.length} ${procedure.steps.length === 1 ? "paso" : "pasos"} · ${reviewed} revisados · ${(procedure.annotations ?? []).length} marcas</p>
    <button type="button" class="sop-ws-small is-on" data-ws-action="review-sheet" ${procedure.steps.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Marcar toda la hoja como revisada</button>`;
}

function sopWsSwatches(active) {
  return `<div class="sop-ws-swatches" role="group" aria-label="Color">${SOP_WS_COLORS.map(([hex, name]) => `<button type="button" class="sop-ws-swatch" data-ws-color="${hex}" style="--swatch:${hex}" aria-label="${name}" title="${name}" aria-pressed="${String(active).toLowerCase() === hex}"></button>`).join("")}</div>`;
}

function sopWsMarksTabHtml() {
  return `<div data-ws-props>${sopWsPropertiesHtml()}</div><div class="sop-flow-marks"><p class="sop-flow-pane-title">Marcas de esta hoja</p><div data-ws-annotation-list>${sopWsAnnotationListHtml()}</div></div>`;
}

function sopWsPropertiesHtml() {
  const selected = sopWsSelected();
  const procedure = sopWsProcedure();
  if (sopWs.textEdit) {
    return `<p class="sop-flow-pane-title">Texto del documento</p>
      <label>Corrige el texto<textarea rows="4" data-ws-doc-text>${escapeHtml(sopWs.textEdit.value)}</textarea></label>
      <div class="sop-ws-field-row"><button type="button" class="sop-ws-small" data-ws-action="doc-restore"><span class="material-symbols-rounded" aria-hidden="true">undo</span>Restaurar original</button><button type="button" class="sop-ws-small is-on" data-ws-action="doc-done"><span class="material-symbols-rounded" aria-hidden="true">check</span>Listo</button></div>`;
  }
  if (!selected) {
    const tool = ["arrow", "box", "highlight", "number", "note", "text"].includes(sopWs.tool) ? sopWs.tool : "arrow";
    return `<p class="sop-flow-pane-title">Valores para lo que dibujes</p>
      <p class="sop-ws-muted">Elige una herramienta y dibuja; luego selecciona la marca para ajustarla.</p>
      <div class="sop-ws-group"><span>Color de ${escapeHtml((SOP_WS_TYPE_NAMES[tool] ?? "marca").toLowerCase())}</span>${sopWsSwatches(sopWs.colors[tool])}</div>
      <label class="sop-ws-range">Grosor de líneas<input type="range" min="3" max="20" value="${sopWs.width}" data-ws-default-width /><output>${sopWs.width}</output></label>
      <div class="sop-ws-group"><span>Estilo de línea</span><div class="sop-ws-segment"><button type="button" data-ws-default-dash="solid" aria-pressed="${sopWs.dash === "solid"}">Continua</button><button type="button" data-ws-default-dash="dashed" aria-pressed="${sopWs.dash === "dashed"}">Punteada</button></div></div>`;
  }
  const hasLine = selected.type === "arrow" || selected.type === "box";
  const hasText = selected.type === "note" || selected.type === "text";
  const stepOptions = `<option value="">Sin paso</option>${procedure.steps.map((step) => `<option value="${escapeHtml(step.number)}" ${String(selected.stepNumber) === String(step.number) ? "selected" : ""}>Paso ${escapeHtml(step.number)}</option>`).join("")}`;
  return `<p class="sop-flow-pane-title">${SOP_WS_TYPE_NAMES[selected.type] ?? "Marca"} seleccionada</p>
    ${selected.type === "textfix" ? '<p class="sop-ws-muted">Este texto reemplaza al original sobre la hoja. Edítalo con la herramienta «Texto del documento».</p>' : `<div class="sop-ws-group"><span>Color</span>${sopWsSwatches(selected.color ?? sopWs.colors[selected.type])}</div>`}
    ${hasText ? `<label>Texto<textarea rows="3" maxlength="${selected.type === "note" ? 200 : 300}" data-ws-prop="text" placeholder="Escribe aquí">${escapeHtml(selected.text ?? "")}</textarea></label>
      <label class="sop-ws-range">Tamaño de letra<input type="range" min="14" max="${selected.type === "note" ? 48 : 90}" value="${Number(selected.fontSize) || (selected.type === "note" ? 21 : 30)}" data-ws-prop="fontSize" /><output>${Number(selected.fontSize) || (selected.type === "note" ? 21 : 30)}</output></label>` : ""}
    ${selected.type === "note" ? `<label class="sop-ws-range">Ancho de la nota<input type="range" min="160" max="640" step="10" value="${Number(selected.width) || 280}" data-ws-prop="width" /><output>${Number(selected.width) || 280}</output></label>` : ""}
    ${selected.type === "text" ? `<label class="sop-ws-check"><input type="checkbox" data-ws-prop="bold" ${selected.bold ? "checked" : ""} />Negrita</label><label class="sop-ws-check"><input type="checkbox" data-ws-prop="bg" ${selected.bg ? "checked" : ""} />Fondo blanco</label>` : ""}
    ${hasLine ? `<label class="sop-ws-range">Grosor<input type="range" min="3" max="24" value="${Number(selected.strokeWidth) || (selected.type === "arrow" ? 10 : 7)}" data-ws-prop="strokeWidth" /><output>${Number(selected.strokeWidth) || (selected.type === "arrow" ? 10 : 7)}</output></label>
      <div class="sop-ws-group"><span>Estilo de línea</span><div class="sop-ws-segment"><button type="button" data-ws-dash="solid" aria-pressed="${selected.dash !== "dashed"}">Continua</button><button type="button" data-ws-dash="dashed" aria-pressed="${selected.dash === "dashed"}">Punteada</button></div></div>` : ""}
    ${selected.type === "highlight" ? `<label class="sop-ws-range">Opacidad<input type="range" min="10" max="90" value="${Math.round((Number(selected.opacity) || 0.38) * 100)}" data-ws-prop="opacity" /><output>${Math.round((Number(selected.opacity) || 0.38) * 100)}%</output></label>` : ""}
    ${selected.type === "number" ? `<label>Número<input type="text" maxlength="3" value="${escapeHtml(selected.label ?? "1")}" data-ws-prop="label" /></label>` : ""}
    ${selected.type === "textfix" ? "" : `<label>Mostrar en el paso<select data-ws-prop="stepNumber">${stepOptions}</select></label>`}
    <div class="sop-ws-field-row"><button type="button" class="sop-ws-small" data-ws-action="duplicate"><span class="material-symbols-rounded" aria-hidden="true">content_copy</span>Duplicar</button>
      <button type="button" class="sop-ws-small" data-ws-action="to-front"><span class="material-symbols-rounded" aria-hidden="true">flip_to_front</span>Al frente</button>
      <button type="button" class="sop-ws-small sop-ws-small--danger" data-ws-action="delete"><span class="material-symbols-rounded" aria-hidden="true">delete</span>Eliminar</button></div>`;
}

function sopWsAnnotationListHtml() {
  const annotations = sopWsAnnotations();
  if (!annotations.length) return '<p class="sop-ws-empty">Todavía no hay marcas en esta hoja.</p>';
  return `<ul class="sop-ws-list">${annotations.map((annotation) => `<li><button type="button" data-ws-select="${escapeHtml(annotation.id)}" class="${annotation.id === sopWs.selectedId ? "is-current" : ""}"><span class="material-symbols-rounded" aria-hidden="true">${SOP_WS_TYPE_ICONS[annotation.type] ?? "draw"}</span><span><strong>${SOP_WS_TYPE_NAMES[annotation.type] ?? "Marca"}${annotation.stepNumber ? ` · paso ${escapeHtml(annotation.stepNumber)}` : ""}</strong><small>${escapeHtml(annotation.text || annotation.label || (annotation.lines ? annotation.lines.join(" ") : "") || "Referencia visual").slice(0, 60)}</small></span></button></li>`).join("")}</ul>`;
}

function renderSopWsAnnotationList() {
  const holder = sopWs?.root?.querySelector("[data-ws-annotation-list]");
  if (holder) holder.innerHTML = sopWsAnnotationListHtml();
}

// ---------------------------------------------------------------- acciones
function sopWsSetTool(tool) {
  if (!SOP_WS_TOOLS.some((item) => item.id === tool)) return;
  if (tool !== "select" && !sopWsCanAnnotate()) return;
  sopWs.tool = tool;
  if (tool !== "select") sopWs.selectedId = null;
  if (tool !== "edit") sopWs.textEdit = null;
  renderSopWsToolbar();
  paintSopWsOverlay();
  renderSopWsInspector();
}

function sopWsSelectSheet(index, stepIndex = 0) {
  if (!sopWsDraft().procedures[index]) return;
  if (index === sopWs.procedureIndex && stepIndex === sopWs.stepIndex) return;
  const changedSheet = index !== sopWs.procedureIndex;
  sopWs.procedureIndex = index;
  sopWs.stepIndex = stepIndex;
  sopWs.selectedId = null;
  sopWs.textEdit = null;
  if (!sopWsCanAnnotate() && sopWs.tool !== "select") sopWs.tool = "select";
  renderSopWsToolbar();
  renderSopWsInspector();
  updateSopWsRailMeta();
  renderSopWsTop();
  if (changedSheet) paintSopWsPage();
  else paintSopWsOverlay();
  sopWs.root.querySelector('.sop-ws-thumb[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
}

function sopWsSetZoom(zoom) {
  sopWs.zoom = Math.max(0.5, Math.min(5, Math.round(zoom * 100) / 100));
  const label = sopWs.root.querySelector("[data-ws-zoom]");
  if (label) label.textContent = `${Math.round(sopWs.zoom * 100)}%`;
  window.clearTimeout(sopWs.zoomTimer);
  sopWs.zoomTimer = window.setTimeout(paintSopWsPage, 60);
}

// Edición de número o texto de un paso: mismas reglas que el editor anterior (restaurar, renumerar marcas, texto corregido sobre la hoja).
function sopWsEditStep(field, value) {
  const procedure = sopWsProcedure();
  const step = procedure.steps[sopWs.stepIndex];
  if (!step) return;
  const previousNumber = step.number;
  step.originalText ??= step.text;
  step.originalNumber ??= step.number;
  step.reviewed = false;
  step[field] = value;
  if (field === "number" && previousNumber !== value) {
    procedure.annotations = (procedure.annotations ?? []).map((annotation) => (annotation.stepNumber === previousNumber ? { ...annotation, stepNumber: value } : annotation));
  }
  const procedureIndex = sopWs.procedureIndex;
  syncSopStepTextFix(sopWsDraft(), procedure, step).then(() => {
    if (!sopWs || sopWs.procedureIndex !== procedureIndex) return;
    paintSopWsOverlay();
    renderSopWsAnnotationList();
    renderSopWsTop();
    updateSopWsRailMeta();
  }).catch(() => {});
  sopWsAfterStepEdit();
}

function sopWsAfterStepEdit() {
  renderSopWsTop();
  updateSopWsRailMeta();
  const button = sopWs.root.querySelector(`[data-ws-step="${sopWs.stepIndex}"]`);
  const step = sopWsProcedure().steps[sopWs.stepIndex];
  if (button && step) {
    button.querySelector("b").textContent = step.number || "—";
    button.querySelector("span").textContent = step.text || "Paso sin texto";
    button.querySelector(".sop-flow-pill")?.remove();
    if (step.added || isSopStepEdited(step)) button.insertAdjacentHTML("beforeend", '<i class="sop-flow-pill sop-flow-pill--edit">Editado</i>');
  }
}

async function sopWsEditDocumentText(point) {
  const ws = sopWs;
  const procedure = sopWsProcedure();
  if (!ws.vp) return;
  const [px, py] = ws.vp.convertToPdfPoint(point.x / 1000 * ws.vp.width, point.y / 1000 * ws.vp.height);
  const stepIndex = procedure.steps.findIndex((step) => step.sourceBounds
    && px >= step.sourceBounds.x - 4 && px <= step.sourceBounds.x + step.sourceBounds.width + 4
    && py >= step.sourceBounds.y - 4 && py <= step.sourceBounds.y + step.sourceBounds.height + 4);
  if (stepIndex >= 0) {
    ws.stepIndex = stepIndex;
    ws.tab = "steps";
    renderSopWsInspector();
    paintSopWsOverlay();
    ws.root.querySelector('[data-ws-step-field="text"]')?.focus();
    sopWsNotice(`Ese texto es el paso ${procedure.steps[stepIndex].number}: edítalo en el panel derecho.`);
    return;
  }
  const free = sopWsAnnotations().find((annotation) => annotation.type === "textfix" && !annotation.stepNumber
    && point.x >= annotation.x && point.x <= annotation.x + annotation.width && point.y >= annotation.y && point.y <= annotation.y + annotation.height);
  let target;
  if (free) {
    target = { id: free.id, block: { text: free.original, bounds: free.source, format: free.sourceFormat }, value: (free.lines ?? []).join(" ") };
  } else {
    const page = await getSopDraftPdfDocument(sopWsDraft()).then((pdf) => pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet)));
    const block = findSopTextBlockAt((await page.getTextContent()).items, px, py);
    if (!block) {
      sopWsNotice("No se encontró texto editable en ese punto de la hoja.", "warning");
      return;
    }
    target = { id: null, block, value: block.text };
  }
  ws.textEdit = target;
  ws.selectedId = null;
  ws.tab = "marks";
  paintSopWsOverlay();
  renderSopWsInspector();
  ws.root.querySelector("[data-ws-doc-text]")?.focus();
}

async function sopWsApplyDocumentText(text) {
  const target = sopWs?.textEdit;
  if (!target) return;
  const procedure = sopWsProcedure();
  const annotations = sopWsAnnotations();
  const before = sopWsSnapshot();
  const clean = text.trim();
  const index = target.id ? annotations.findIndex((annotation) => annotation.id === target.id) : -1;
  if (!clean || clean === target.block.text.trim()) {
    if (index >= 0) annotations.splice(index, 1);
    target.id = null;
  } else {
    const fix = await buildSopTextFix(sopWsDraft(), procedure, { bounds: target.block.bounds, format: target.block.format, prefix: "", text: clean, stepNumber: "" });
    target.id ??= `free-${crypto.randomUUID().slice(0, 8)}`;
    Object.assign(fix, { id: target.id, original: target.block.text, source: target.block.bounds, sourceFormat: target.block.format });
    const current = annotations.findIndex((annotation) => annotation.id === target.id);
    if (current >= 0) annotations[current] = fix;
    else annotations.push(fix);
  }
  target.value = text;
  sopWsCommit(before);
}

async function runSopWsExport(kind, scope = "current") {
  const ws = sopWs;
  if (!ws || ws.busy) return;
  const status = ws.root.querySelector("[data-ws-status]");
  try {
    ws.busy = true;
    ws.root.classList.add("is-busy");
    await runSopDraftExport(ws.state.sopDraft, kind, scope, sopWsProcedure(), (message) => { status.hidden = false; status.textContent = message; });
  } catch (error) {
    sopWsNotice(error?.message || "No se pudo exportar.", "warning");
  } finally {
    ws.busy = false;
    ws.root?.classList.remove("is-busy");
    const live = ws.root?.querySelector("[data-ws-status]");
    if (live && ws.vp) live.hidden = true;
  }
}

// ---------------------------------------------------------------- eventos
function toggleSopWsExportMenu(open) {
  const editor = sopWs?.root?.closest(".sop-flow-editor");
  if (!editor) return;
  const menu = editor.querySelector("[data-ws-export-menu]");
  const button = editor.querySelector('[data-ws-action="toggle-export"]');
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function bindSopWorkspaceGlobals() {
  if (sopWsGlobalsBound) return;
  sopWsGlobalsBound = true;
  window.addEventListener("resize", () => {
    if (!sopWs?.root?.isConnected) return;
    window.clearTimeout(sopWs.resizeTimer);
    sopWs.resizeTimer = window.setTimeout(paintSopWsPage, 150);
  });
  window.addEventListener("sop-draft-annotations-changed", () => {
    if (!sopWs?.root?.isConnected) return;
    paintSopWsOverlay();
    renderSopWsAnnotationList();
    renderSopWsTop();
    updateSopWsRailMeta();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === " " && sopWs) { sopWs.space = false; sopWs.root?.classList.remove("is-panning"); }
  });
  document.addEventListener("keydown", (event) => {
    if (!sopWs?.root?.isConnected || !document.contains(sopWs.root)) return;
    const typing = event.target.closest?.("input, textarea, select, [contenteditable]");
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z" && !typing) { event.preventDefault(); sopWsStep(event.shiftKey ? "redo" : "undo"); return; }
    if (modifier && event.key.toLowerCase() === "y" && !typing) { event.preventDefault(); sopWsStep("redo"); return; }
    if (typing || modifier || event.altKey || event.target.closest?.("dialog[open]")) return;
    if (event.key === " " && !event.target.closest("button")) { sopWs.space = true; sopWs.root.classList.add("is-panning"); event.preventDefault(); return; }
    if (event.key === "Escape") {
      if (sopWs.selectedId || sopWs.textEdit) { sopWsSelect(null); return; }
      toggleSopWsExportMenu(false);
      return;
    }
    const tool = SOP_WS_TOOLS.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
    if (tool) { event.preventDefault(); sopWsSetTool(tool.id); return; }
    const selected = sopWsSelected();
    if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); handleSopWsAction({ dataset: { wsAction: "delete" } }); return; }
    const step = event.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (delta) {
      event.preventDefault();
      const now = Date.now();
      const before = sopWsSnapshot();
      sopWsMoveBy(selected, structuredClone(selected), delta[0], delta[1]);
      if (now - sopWs.nudgeAt > 700) { sopWsHistory().undo.push(before); sopWsHistory().redo = []; }
      sopWs.nudgeAt = now;
      sopWsChanged();
    }
  });
}

function bindSopWorkspace(root) {
  bindSopWorkspaceGlobals();
  const editor = root.closest(".sop-flow-editor");

  editor.addEventListener("click", (event) => {
    const menu = editor.querySelector("[data-ws-export-menu]");
    if (!menu.hidden && !event.target.closest(".sop-ws-menu")) toggleSopWsExportMenu(false);
    const tool = event.target.closest("[data-ws-tool]");
    if (tool) { sopWsSetTool(tool.dataset.wsTool); return; }
    const tab = event.target.closest("[data-ws-tab]");
    if (tab) { sopWs.tab = tab.dataset.wsTab; renderSopWsInspector(); return; }
    const sheet = event.target.closest("[data-ws-sheet]");
    if (sheet) { sopWsSelectSheet(Number(sheet.dataset.wsSheet)); return; }
    const step = event.target.closest("[data-ws-step]");
    if (step) { sopWs.stepIndex = Number(step.dataset.wsStep); renderSopWsInspector(); paintSopWsOverlay(); return; }
    const pick = event.target.closest("[data-ws-select]");
    if (pick) { sopWs.tool = "select"; renderSopWsToolbar(); sopWsSelect(pick.dataset.wsSelect); return; }
    const color = event.target.closest("[data-ws-color]");
    if (color) { sopWsApplyColor(color.dataset.wsColor); return; }
    const dash = event.target.closest("[data-ws-dash]");
    if (dash) { const selected = sopWsSelected(); if (selected) { sopWsMutate(() => { if (dash.dataset.wsDash === "dashed") selected.dash = "dashed"; else delete selected.dash; }); renderSopWsInspector(); } return; }
    const defaultDash = event.target.closest("[data-ws-default-dash]");
    if (defaultDash) { sopWs.dash = defaultDash.dataset.wsDefaultDash; renderSopWsInspector(); return; }
    const action = event.target.closest("[data-ws-action]");
    if (action) handleSopWsAction(action);
  });

  editor.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-ws-step-field]")) {
      sopWsEditStep(target.dataset.wsStepField, target.value);
      return;
    }
    if (target.matches("[data-ws-sheet-title]")) { sopWsProcedure().title = target.value; return; }
    if (target.matches("[data-ws-default-width]")) {
      sopWs.width = Number(target.value);
      target.nextElementSibling.textContent = String(sopWs.width);
      return;
    }
    if (target.matches("[data-ws-doc-text]")) {
      window.clearTimeout(sopWs.docTimer);
      const value = target.value;
      sopWs.docTimer = window.setTimeout(() => sopWsApplyDocumentText(value).then(() => { paintSopWsOverlay(); renderSopWsAnnotationList(); }).catch(() => {}), 250);
      return;
    }
    if (target.matches("[data-ws-prop]")) {
      const selected = sopWsSelected();
      if (!selected) return;
      const key = target.dataset.wsProp;
      if (key === "text") selected.text = target.value;
      else if (key === "label") selected.label = target.value.slice(0, 3);
      else if (key === "stepNumber") selected.stepNumber = target.value;
      else if (key === "bold") selected.bold = target.checked;
      else if (key === "bg") { if (target.checked) selected.bg = "#ffffff"; else delete selected.bg; }
      else if (key === "opacity") { selected.opacity = Number(target.value) / 100; target.nextElementSibling.textContent = `${target.value}%`; }
      else { selected[key] = Number(target.value); if (target.nextElementSibling?.tagName === "OUTPUT") target.nextElementSibling.textContent = target.value; }
      paintSopWsOverlay();
    }
  });
  editor.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-ws-prop], [data-ws-default-width]")) sopWs.fieldSnapshot = sopWsSnapshot();
  });
  editor.addEventListener("change", (event) => {
    if (event.target.matches("[data-ws-prop]") && sopWs.fieldSnapshot !== null) {
      sopWsCommit(sopWs.fieldSnapshot);
      sopWs.fieldSnapshot = null;
      if (event.target.dataset.wsProp === "stepNumber") renderSopWsInspector();
      renderSopWsAnnotationList();
    }
  });
  editor.addEventListener("focusout", (event) => {
    if (sopWs && event.target.matches("[data-ws-prop]") && sopWs.fieldSnapshot !== null) {
      sopWsCommit(sopWs.fieldSnapshot);
      sopWs.fieldSnapshot = null;
    }
  });

  // dibujo y selección sobre el lienzo
  const overlay = root.querySelector("[data-ws-overlay]");
  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !sopWs.vp) return;
    const viewport = root.querySelector("[data-ws-viewport]");
    if (sopWs.space) {
      sopWs.drag = { mode: "pan", x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      try { overlay.setPointerCapture(event.pointerId); } catch { /* el puntero puede no admitir captura */ }
      return;
    }
    const point = sopWsPoint(event);
    const tool = sopWs.tool;
    event.preventDefault();
    if (tool === "select") {
      const handle = sopWsHitHandle(point);
      const selected = sopWsSelected();
      if (handle && selected) {
        sopWs.drag = { mode: "resize", handle, original: structuredClone(selected), before: sopWsSnapshot(), id: selected.id };
      } else {
        const hit = sopWsHit(point);
        if (hit) {
          if (hit.id !== sopWs.selectedId) sopWsSelect(hit.id);
          sopWs.drag = { mode: "move", start: point, original: structuredClone(hit), before: sopWsSnapshot(), id: hit.id, moved: false };
        } else if (sopWs.selectedId) {
          sopWsSelect(null);
          return;
        } else return;
      }
      try { overlay.setPointerCapture(event.pointerId); } catch { /* el puntero puede no admitir captura */ }
      return;
    }
    if (["arrow", "box", "highlight"].includes(tool)) {
      sopWs.drag = { mode: "draw", tool, start: point, end: point };
      try { overlay.setPointerCapture(event.pointerId); } catch { /* el puntero puede no admitir captura */ }
      return;
    }
    if (tool === "edit") { sopWsEditDocumentText(point).catch(() => {}); return; }
    let annotation;
    if (tool === "number") {
      const count = sopWsAnnotations().filter((item) => item.type === "number").length + 1;
      annotation = sopWsNewAnnotation("number", { x: point.x, y: point.y, label: String(count) });
    } else if (tool === "note") {
      annotation = sopWsNewAnnotation("note", { x: Math.min(point.x, 840), y: point.y, text: "Nota", fontSize: 21, width: 280 });
    } else {
      annotation = sopWsNewAnnotation("text", { x: point.x, y: point.y, text: "Texto", fontSize: 30 });
    }
    sopWsMutate(() => sopWsAnnotations().push(annotation));
    sopWs.selectedId = annotation.id;
    sopWs.tab = "marks";
    paintSopWsOverlay();
    renderSopWsInspector();
    if (tool !== "number") {
      const field = root.querySelector('[data-ws-prop="text"]');
      field?.focus();
      field?.select();
    }
  });
  overlay.addEventListener("pointermove", (event) => {
    const drag = sopWs.drag;
    if (!drag) return;
    if (drag.mode === "pan") {
      const viewport = root.querySelector("[data-ws-viewport]");
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
      return;
    }
    const point = sopWsPoint(event);
    if (drag.mode === "draw") {
      let end = point;
      if (drag.tool === "arrow" && event.shiftKey) {
        const dx = point.x - drag.start.x, dy = (point.y - drag.start.y) / sopWs.aspect;
        const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
        const length = Math.hypot(dx, dy);
        end = { x: clampSopAnnotationCoordinate(drag.start.x + Math.cos(angle) * length), y: clampSopAnnotationCoordinate(drag.start.y + Math.sin(angle) * length * sopWs.aspect) };
      }
      drag.end = end;
      const preview = drag.tool === "arrow"
        ? { type: "arrow", x1: drag.start.x, y1: drag.start.y, x2: end.x, y2: end.y, color: sopWs.colors.arrow, strokeWidth: sopWs.width, dash: sopWs.dash === "dashed" ? "dashed" : undefined }
        : { type: drag.tool, x: Math.min(drag.start.x, end.x), y: Math.min(drag.start.y, end.y), width: Math.abs(end.x - drag.start.x), height: Math.abs(end.y - drag.start.y), color: sopWs.colors[drag.tool], strokeWidth: sopWs.width, dash: sopWs.dash === "dashed" ? "dashed" : undefined, opacity: 0.38 };
      paintSopWsOverlay(preview);
      return;
    }
    const annotation = sopWsAnnotations().find((item) => item.id === drag.id);
    if (!annotation) return;
    if (drag.mode === "move") {
      const dx = point.x - drag.start.x, dy = point.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      sopWsMoveBy(annotation, drag.original, dx, dy);
    } else {
      sopWsResize(annotation, drag.original, drag.handle, point);
    }
    paintSopWsOverlay();
  });
  const finishDrag = (event) => {
    const drag = sopWs?.drag;
    if (!drag) return;
    sopWs.drag = null;
    try { overlay.releasePointerCapture(event.pointerId); } catch { /* ya liberado */ }
    if (drag.mode === "pan") return;
    if (drag.mode === "draw") {
      const { start, end, tool } = drag;
      if (Math.hypot(end.x - start.x, (end.y - start.y) / sopWs.aspect) < 12) { paintSopWsOverlay(); return; }
      const annotation = tool === "arrow"
        ? sopWsNewAnnotation("arrow", { x1: start.x, y1: start.y, x2: end.x, y2: end.y })
        : sopWsNewAnnotation(tool, { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.max(8, Math.abs(end.x - start.x)), height: Math.max(8, Math.abs(end.y - start.y)) });
      sopWsMutate(() => sopWsAnnotations().push(annotation));
      sopWs.selectedId = annotation.id;
      sopWs.tab = "marks";
      paintSopWsOverlay();
      renderSopWsInspector();
      return;
    }
    sopWsCommit(drag.before);
    paintSopWsOverlay();
  };
  overlay.addEventListener("pointerup", finishDrag);
  overlay.addEventListener("pointercancel", finishDrag);
  overlay.addEventListener("dblclick", () => {
    const selected = sopWsSelected();
    if (selected && ["note", "text"].includes(selected.type)) root.querySelector('[data-ws-prop="text"]')?.focus();
  });
  root.querySelector("[data-ws-viewport]").addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    sopWsSetZoom(sopWs.zoom + (event.deltaY < 0 ? 0.15 : -0.15));
  }, { passive: false });
}

function sopWsApplyColor(hex) {
  const selected = sopWsSelected();
  if (selected && selected.type !== "textfix") {
    sopWsMutate(() => { selected.color = hex; });
    sopWs.colors[selected.type] = hex;
    renderSopWsInspector();
    return;
  }
  const tool = ["arrow", "box", "highlight", "number", "note", "text"].includes(sopWs.tool) ? sopWs.tool : "arrow";
  sopWs.colors[tool] = hex;
  renderSopWsInspector();
}

function handleSopWsAction(action) {
  const name = action.dataset.wsAction;
  const ws = sopWs;
  if (name === "go-review") { goSopFlowStage(3); return; }
  if (name === "undo" || name === "redo") { sopWsStep(name); return; }
  if (name === "step-prev") { sopWsGoStep(-1); return; }
  if (name === "step-next") { sopWsGoStep(1); return; }
  if (name === "toggle-export") { toggleSopWsExportMenu(ws.root.closest(".sop-flow-editor").querySelector("[data-ws-export-menu]").hidden); return; }
  if (name.startsWith("export-")) {
    toggleSopWsExportMenu(false);
    runSopWsExport(name.replace("export-", ""), action.dataset.scope);
    return;
  }
  if (name === "zoom-in") { sopWsSetZoom(ws.zoom + 0.25); return; }
  if (name === "zoom-out") { sopWsSetZoom(ws.zoom - 0.25); return; }
  if (name === "zoom-fit") { sopWsSetZoom(1); return; }
  const selected = sopWsSelected();
  if (name === "delete" && selected) {
    sopWsMutate(() => { sopWsProcedure().annotations = sopWsAnnotations().filter((annotation) => annotation.id !== selected.id); });
    ws.selectedId = null;
    paintSopWsOverlay();
    renderSopWsInspector();
    return;
  }
  if (name === "duplicate" && selected) {
    const copy = structuredClone(selected);
    copy.id = crypto.randomUUID();
    sopWsMoveBy(copy, structuredClone(selected), 20, 20);
    sopWsMutate(() => sopWsAnnotations().push(copy));
    ws.selectedId = copy.id;
    paintSopWsOverlay();
    renderSopWsInspector();
    return;
  }
  if (name === "to-front" && selected) {
    sopWsMutate(() => { const list = sopWsAnnotations(); list.splice(list.indexOf(selected), 1); list.push(selected); });
    paintSopWsOverlay();
    renderSopWsAnnotationList();
    return;
  }
  const procedure = sopWsProcedure();
  const step = procedure.steps[ws.stepIndex];
  if (name === "add-step") {
    procedure.steps.push({ number: "", text: "", sourceNote: "", images: [], added: true });
    ws.stepIndex = procedure.steps.length - 1;
    ws.tab = "steps";
    renderSopWsToolbar();
    renderSopWsInspector();
    renderSopWsTop();
    updateSopWsRailMeta();
    ws.root.querySelector('[data-ws-step-field="number"]')?.focus();
    return;
  }
  if (name === "delete-step" && step) {
    const [removed] = procedure.steps.splice(ws.stepIndex, 1);
    if (removed && !removed.added) (sopWsDraft().deletedSteps ??= []).push({ sheet: procedure.sheet, number: removed.originalNumber ?? removed.number, text: removed.originalText ?? removed.text });
    procedure.annotations = sopWsAnnotations().filter((annotation) => annotation.stepNumber !== String(removed?.number));
    ws.stepIndex = Math.max(0, ws.stepIndex - 1);
    ws.selectedId = null;
    renderSopWsToolbar();
    renderSopWsInspector();
    paintSopWsOverlay();
    renderSopWsTop();
    updateSopWsRailMeta();
    return;
  }
  if (name === "restore-step" && step) {
    const number = step.originalNumber ?? step.number;
    const text = step.originalText ?? step.text;
    sopWsEditStep("number", number);
    sopWsEditStep("text", text);
    step.reviewed = false;
    renderSopWsInspector();
    sopWsAfterStepEdit();
    return;
  }
  if (name === "toggle-reviewed" && step) {
    step.reviewed = !step.reviewed;
    renderSopWsInspector();
    updateSopWsRailMeta();
    return;
  }
  if (name === "review-sheet") {
    procedure.steps.forEach((item) => { item.reviewed = true; });
    renderSopWsInspector();
    updateSopWsRailMeta();
    sopWsNotice(`Hoja ${procedure.sheet} marcada como revisada.`);
    return;
  }
  if (name === "doc-done") { ws.textEdit = null; renderSopWsInspector(); paintSopWsOverlay(); return; }
  if (name === "doc-restore" && ws.textEdit) {
    const target = ws.textEdit;
    sopWsApplyDocumentText(target.block.text).then(() => { renderSopWsInspector(); paintSopWsOverlay(); renderSopWsAnnotationList(); });
  }
}
