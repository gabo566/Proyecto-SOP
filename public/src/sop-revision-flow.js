// Flujo de revisión de SOP en tres etapas: 1 Preparar · 2 Editar (sop-workspace.js) · 3 Revisar y publicar.
// Reemplaza la lista de hojas con vista previa de la edición anterior.

const SOP_FLOW_STAGES = ["Preparar", "Editar", "Revisar y publicar"];
let sopFlowEnv = null;

function sopDraftStationReady(draft) {
  const document = draft?.document ?? {};
  if (document.stationMode === "custom") return Boolean(String(document.stationName ?? "").trim());
  return Boolean(getWorkStationAssignment(document.stationAssignment));
}

function renderSopFlowStepper(active) {
  return `<nav class="operator-flow-progress sop-flow-stepper" aria-label="Etapas de la revisión">${SOP_FLOW_STAGES.map((label, index) => {
    const number = index + 1;
    const status = number < active ? "operator-flow-step--complete" : number === active ? "operator-flow-step--active" : "";
    return `${index ? '<i aria-hidden="true"></i>' : ""}<div class="operator-flow-step ${status}" ${number === active ? 'aria-current="step"' : ""}><span>${number < active ? '<span class="material-symbols-rounded" aria-hidden="true">check</span>' : number}</span><strong>${label}</strong></div>`;
  }).join("")}</nav>`;
}

function renderSopRevisionFlow(state) {
  const draft = state.sopDraft;
  const stage = [1, 2, 3].includes(state.sopDraftStage) ? state.sopDraftStage : 1;
  const error = state.sopDraftError ? `<p class="form-error sop-flow-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : "";
  const body = stage === 1 ? renderSopFlowPrepare(state, draft, error)
    : stage === 2 ? `<div data-sop-ws-host class="sop-flow-host">${error}</div>`
      : renderSopFlowReview(state, draft, error);
  return `<section class="sop-flow" aria-label="Revisión de SOP · etapa ${stage} de 3">${renderSopFlowStepper(stage)}${body}</section>`;
}

// ---------------------------------------------------------------- etapa 1
function renderSopFlowPrepare(state, draft, error) {
  const document = draft.document;
  const stepCount = draft.procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  const sheetsWithSteps = draft.procedures.filter((procedure) => procedure.steps.length).length;
  const fromRevision = draft.sourceKind !== "pdf";
  const currentAssignment = getWorkStationAssignment(document.stationAssignment);
  const stationType = document.stationType ?? currentAssignment?.type ?? "MFG";
  const stationMode = document.stationMode ?? "existing";
  const stationName = document.stationName ?? (currentAssignment?.custom ? currentAssignment.label : "");
  const customSelected = stationMode === "custom";
  const stationOptions = getWorkStationAssignments(state)
    .filter((assignment) => assignment.type === stationType)
    .map((assignment) => `<option value="${escapeHtml(assignment.value)}" ${assignment.value === document.stationAssignment && !customSelected ? "selected" : ""}>${escapeHtml(assignment.label)}${assignment.custom ? " · personalizada" : ""}</option>`)
    .join("");
  const notice = state.sopDraftNotice ? `<p class="sop-flow-notice"><span class="material-symbols-rounded" aria-hidden="true">info</span>${escapeHtml(state.sopDraftNotice)}</p>` : "";
  return `<div class="sop-flow-stack">
    <section class="sop-flow-card sop-flow-card--head"><div><h2 class="sop-flow-title">${fromRevision ? "Nueva revisión de la SOP" : "Revisa la SOP extraída"}</h2><p class="sop-flow-sub">${fromRevision ? "Confirma los datos de la revisión y elige qué quieres hacer." : `Se detectaron ${stepCount} pasos en ${sheetsWithSteps} hojas del archivo ${escapeHtml(draft.pdf?.name ?? "PDF")}. Confirma los datos antes de editar.`}</p></div>
      <span class="sop-flow-chip"><span class="material-symbols-rounded" aria-hidden="true">description</span>${escapeHtml(document.id)}${fromRevision && state.sopDraft.basedOnRevision ? ` · Rev. ${escapeHtml(state.sopDraft.basedOnRevision)}` : ""} · ${sheetsWithSteps} hojas · ${stepCount} pasos</span></section>
    ${notice}${error}
    <section class="sop-flow-card"><div class="sop-flow-fields">
      <label class="sop-flow-field sop-flow-field--wide"><span>Nombre de la SOP</span><input type="text" data-sop-document-field="title" value="${escapeHtml(document.title)}" maxlength="255" /></label>
      <label class="sop-flow-field"><span>Número de la nueva revisión</span><input type="text" data-sop-document-field="revision" value="${escapeHtml(document.revision)}" placeholder="Ej. 4" maxlength="40" autocomplete="off" /></label>
      <label class="sop-flow-field"><span>Área</span><select data-sop-station-type><option value="MFG" ${stationType === "MFG" ? "selected" : ""}>MFG · Manufactura</option><option value="RWK" ${stationType === "RWK" ? "selected" : ""}>RWK · Retrabajo</option></select></label>
      <label class="sop-flow-field"><span>Estación</span><select data-sop-station-assignment><option value="">Selecciona una estación</option>${stationOptions}<option value="__custom__" ${customSelected ? "selected" : ""}>Otra estación…</option></select></label>
      ${customSelected ? `<label class="sop-flow-field"><span>Nombre de la estación</span><input type="text" data-sop-station-custom value="${escapeHtml(stationName)}" placeholder="Escribe el nombre de la estación" maxlength="80" autocomplete="off" /></label>` : ""}
    </div></section>
    ${fromRevision ? `<section class="sop-flow-card"><h3 class="sop-flow-h3">¿Qué quieres hacer?</h3><div class="sop-flow-options">
      <div class="sop-flow-option is-selected"><span class="sop-flow-badge">Recomendado</span><span class="sop-flow-option-icon material-symbols-rounded" aria-hidden="true">edit_document</span><div><h3>Editar la SOP</h3><p>Parte de la revisión actual y haz tus cambios sobre las hojas.</p><ul><li>Corrige textos y números de paso</li><li>Marca hojas con flechas, recuadros y notas</li><li>Exporta un resumen de cambios</li></ul></div></div>
      <button class="sop-flow-option" type="button" data-action="sop-flow-upload-other"><span class="sop-flow-option-icon material-symbols-rounded" aria-hidden="true">upload_file</span><div><h3>Subir otro PDF</h3><p>Extrae una SOP nueva desde un archivo, en lugar de partir de la actual.</p><ul><li>Se detectan hojas y pasos automáticamente</li><li>Después los revisas y corriges</li></ul></div></button>
    </div></section>` : ""}
    <div class="sop-flow-actions"><button class="sop-flow-btn sop-flow-btn--ghost" type="button" data-action="cancel-sop-version-draft" ${state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">close</span>Cancelar</button>
      <button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="sop-flow-go" data-stage="2">Continuar a editar<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></div>
  </div>`;
}

// ---------------------------------------------------------------- etapa 3
function summarizeSopDraftChanges(draft) {
  const rows = collectSopChanges(draft);
  const stepRows = rows.filter((row) => ["Texto del paso", "Número de paso", "Paso nuevo", "Paso eliminado"].includes(row.type)).length;
  const withSteps = draft.procedures.filter((procedure) => procedure.steps.length);
  const reviewed = withSteps.filter((procedure) => procedure.steps.every((step) => step.reviewed)).length;
  return { rows, stepRows, markRows: rows.length - stepRows, reviewed, total: withSteps.length };
}

function renderSopFlowReview(state, draft, error) {
  const summary = summarizeSopDraftChanges(draft);
  const revisionOk = Boolean(String(draft.document.revision ?? "").trim());
  const stationOk = sopDraftStationReady(draft);
  const pending = summary.total - summary.reviewed;
  const visible = state.sopFlowShowAll ? summary.rows : summary.rows.slice(0, 8);
  const rowsHtml = visible.map((row) => `<tr><td><b>${escapeHtml(row.sheet)}</b></td><td>${escapeHtml(row.type)}${row.step ? `<small> · paso ${escapeHtml(row.step)}</small>` : ""}</td><td class="${row.before ? "sop-flow-del" : ""}">${row.before ? escapeHtml(row.before) : "—"}</td><td class="${row.after ? "sop-flow-add" : ""}">${row.after ? escapeHtml(row.after) : "—"}</td></tr>`).join("");
  const check = (ok, title, detail, warn = false) => `<div class="sop-flow-check sop-flow-check--${ok ? "ok" : warn ? "warn" : "bad"}"><span class="material-symbols-rounded" aria-hidden="true">${ok ? "check_circle" : warn ? "error" : "cancel"}</span><span><b>${title}</b><br><small>${detail}</small></span></div>`;
  const stationLabel = draft.document.stationMode === "custom" ? draft.document.stationName : formatWorkStationAssignment(draft.document.stationAssignment);
  const coverage = describeSopRoleCoverage(state.sopRoles, getActiveLocalUser().id);
  const rolesCheck = coverage.loading
    ? check(false, "Quién la revisa y publica", "Consultando las funciones asignadas…", true)
    : coverage.ready
      ? check(true, "Quién la revisa y publica", `${coverage.reviewers.length} ${coverage.reviewers.length === 1 ? "revisor" : "revisores"} · ${coverage.publishers.length} ${coverage.publishers.length === 1 ? "publicador" : "publicadores"} disponibles (distintos de ti)`)
      : check(false, "Quién la revisa y publica", "Todavía no hay un revisor y un publicador distintos. La cuenta 140784 los asigna en Crear usuarios; puedes enviarla y quedará en espera.", true);
  return `<div class="sop-flow-stack">
    <section class="sop-flow-card sop-flow-card--head"><div><h2 class="sop-flow-title">${revisionOk ? `Revisión ${escapeHtml(draft.document.revision)} lista para revisar` : "Falta el número de revisión"}</h2><p class="sop-flow-sub">${escapeHtml(draft.document.title)}${stationOk ? ` · Estación ${escapeHtml(stationLabel)}` : ""}</p></div>
      <span class="sop-flow-chip sop-flow-chip--warn"><span class="material-symbols-rounded" aria-hidden="true">groups</span>Otra persona la revisa y una tercera la publica</span></section>
    ${error}
    <div class="sop-flow-kpis"><div class="sop-flow-kpi"><span>Cambios en total</span><strong>${summary.rows.length}</strong></div><div class="sop-flow-kpi"><span>Textos y números de pasos</span><strong>${summary.stepRows}</strong></div><div class="sop-flow-kpi"><span>Marcas sobre las hojas</span><strong>${summary.markRows}</strong></div><div class="sop-flow-kpi"><span>Hojas revisadas</span><strong>${summary.reviewed} <small>de ${summary.total}</small></strong></div></div>
    <div class="sop-flow-split">
      <section class="sop-flow-card sop-flow-card--flush"><div class="sop-flow-card-head"><h3 class="sop-flow-h3">Qué cambió</h3>${summary.rows.length > 8 ? `<button type="button" class="sop-flow-link" data-action="sop-flow-toggle-changes">${state.sopFlowShowAll ? "Ver menos" : `Ver los ${summary.rows.length} cambios`}</button>` : ""}</div>
        ${summary.rows.length ? `<table class="sop-flow-table"><thead><tr><th>Hoja</th><th>Tipo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : '<p class="sop-flow-empty">Todavía no hay cambios en esta revisión. Puedes volver a editar o publicarla tal cual.</p>'}</section>
      <div class="sop-flow-side">
        <section class="sop-flow-card"><h3 class="sop-flow-h3">Antes de publicar</h3>
          ${check(revisionOk, "Número de revisión", revisionOk ? `Rev. ${escapeHtml(draft.document.revision)}` : "Captúralo en la etapa 1")}
          ${check(stationOk, "Estación asignada", stationOk ? escapeHtml(stationLabel) : "Elígela en la etapa 1")}
          ${rolesCheck}
          ${check(pending === 0, pending === 0 ? "Todas las hojas revisadas" : `${pending} ${pending === 1 ? "hoja sin marcar" : "hojas sin marcar"} como revisada${pending === 1 ? "" : "s"}`, pending === 0 ? "Listo para publicar" : "Puedes publicar así o volver a revisarlas", true)}</section>
        <section class="sop-flow-card"><h3 class="sop-flow-h3">Exportar</h3>
          <button type="button" class="sop-flow-export" data-action="sop-export" data-kind="pdf" data-scope="changed"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>PDF con anotaciones<small>hojas con cambios</small><span class="material-symbols-rounded sop-flow-export-end" aria-hidden="true">download</span></button>
          <button type="button" class="sop-flow-export" data-action="sop-export" data-kind="csv"><span class="material-symbols-rounded" aria-hidden="true">table_view</span>Resumen de cambios<small>CSV</small><span class="material-symbols-rounded sop-flow-export-end" aria-hidden="true">download</span></button>
          <button type="button" class="sop-flow-export" data-action="sop-export" data-kind="print"><span class="material-symbols-rounded" aria-hidden="true">print</span>Resumen para imprimir<span class="material-symbols-rounded sop-flow-export-end" aria-hidden="true">open_in_new</span></button></section></div></div>
    <div class="sop-flow-actions"><button class="sop-flow-btn sop-flow-btn--ghost" type="button" data-action="sop-flow-go" data-stage="2"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Volver a editar</button>
      <div class="sop-flow-actions-end"><button class="sop-flow-btn sop-flow-btn--ghost" type="button" data-action="cancel-sop-version-draft" ${state.sopVersionBusy ? "disabled" : ""}>Cancelar edición</button>
        <button class="sop-flow-btn sop-flow-btn--green" type="button" data-action="publish-sop-version" ${state.sopVersionBusy || !revisionOk || !stationOk ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.sopVersionBusy ? "hourglass_top" : "send"}</span>${state.sopVersionBusy ? "Enviando…" : `Enviar a revisión${revisionOk ? ` · Rev. ${escapeHtml(draft.document.revision)}` : ""}`}</button></div></div>
  </div>`;
}

// ---------------------------------------------------------------- exportaciones (etapa 2 y etapa 3)
async function runSopDraftExport(draft, kind, scope = "changed", currentProcedure = null, onStatus = () => {}) {
  const baseName = `${String(draft.document.id || "SOP").replace(/[^A-Za-z0-9._-]+/g, "_")}_Rev${String(draft.document.revision || "borrador").replace(/[^A-Za-z0-9._-]+/g, "_")}`;
  if (kind === "csv" || kind === "print") {
    const rows = collectSopChanges(draft);
    if (kind === "csv") downloadSopBlob(new Blob(["﻿", sopChangesToCsv(draft, rows)], { type: "text/csv;charset=utf-8" }), `${baseName}_cambios.csv`);
    else openSopChangesPrint(draft, rows);
    showInlineNotice(rows.length ? `Resumen con ${rows.length} cambios listo.` : "Todavía no hay cambios; el resumen quedó vacío.");
    return;
  }
  if (kind === "png") {
    if (!currentProcedure) throw new Error("Elige una hoja para exportarla como imagen.");
    onStatus("Preparando imagen…");
    const sheet = await renderSopSheetCanvas(draft, currentProcedure, { maxWidth: 2000 });
    const blob = await new Promise((resolve) => sheet.canvas.toBlob(resolve, "image/png"));
    downloadSopBlob(blob, `${baseName}_hoja${currentProcedure.sheet}.png`);
    showInlineNotice(`Hoja ${currentProcedure.sheet} exportada como imagen.`);
    return;
  }
  const changedOnly = (procedure) => (procedure.annotations ?? []).length > 0 || procedure.steps.some((step) => step.added || isSopStepEdited(step));
  const targets = scope === "all" ? draft.procedures
    : scope === "changed" ? draft.procedures.filter(changedOnly)
      : currentProcedure ? [currentProcedure] : [];
  if (!targets.length) {
    showInlineNotice("Ninguna hoja tiene cambios todavía. Elige «Todas las hojas» o edita alguna.", "warning");
    return;
  }
  const blob = await exportSopAnnotatedPdf(draft, targets, (done, total) => onStatus(`Exportando PDF… hoja ${done} de ${total}`));
  downloadSopBlob(blob, `${baseName}_${scope === "current" ? `hoja${currentProcedure?.sheet}` : scope === "changed" ? "con_cambios" : "completa"}.pdf`);
  showInlineNotice(`PDF con ${targets.length} ${targets.length === 1 ? "hoja" : "hojas"} exportado.`);
}

// ---------------------------------------------------------------- navegación entre etapas
function goSopFlowStage(stage) {
  const env = sopFlowEnv;
  const state = env?.state;
  if (!state?.sopDraft) return;
  const draft = state.sopDraft;
  if (stage >= 2 && state.sopDraftStage === 1) {
    if (!String(draft.document.revision ?? "").trim()) {
      state.sopDraftError = "Captura el número de la nueva revisión para continuar.";
      env.render();
      document.querySelector('[data-sop-document-field="revision"]')?.focus();
      return;
    }
    if (!sopDraftStationReady(draft)) {
      state.sopDraftError = "Selecciona una estación o escribe el nombre de una personalizada para continuar.";
      env.render();
      return;
    }
  }
  if (state.sopDraftStage === 2 || stage === 3) cleanupSopWorkspaceDraft(draft);
  state.sopDraftError = "";
  state.sopDraftNotice = "";
  state.sopDraftStage = stage;
  if (stage === 3) {
    state.sopRoles = null;
    loadSopRoles(state).then(() => { if (state.sopDraft && state.sopDraftStage === 3) env.render(); });
  }
  env.render();
  window.scrollTo({ top: 0 });
}

// Cancelar la edición desde cualquier etapa (la etapa 2 pide confirmación antes).
function cancelSopRevisionDraft() {
  const env = sopFlowEnv;
  const state = env?.state;
  if (!state?.sopDraft) return;
  state.sopDraft = null;
  state.sopDraftStage = 1;
  state.sopFlowShowAll = false;
  state.sopRoles = null;
  state.sopDraftError = "";
  state.sopDraftNotice = "";
  state.sopUploadFile = null;
  state.sopUploadFileName = "";
  env.showToast("Edición cancelada; no se guardó ningún cambio.");
  env.render();
  window.scrollTo({ top: 0 });
}

function bindSopRevisionFlow(app, env) {
  sopFlowEnv = env;
  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    const name = action.dataset.action;
    if (name === "sop-flow-go") {
      goSopFlowStage(Number(action.dataset.stage));
    } else if (name === "sop-flow-toggle-changes") {
      env.state.sopFlowShowAll = !env.state.sopFlowShowAll;
      env.render();
    } else if (name === "sop-flow-upload-other") {
      if (!canUploadSop() || env.state.sopVersionBusy) return;
      env.state.sopDraft = null;
      env.state.sopDraftStage = 1;
      env.state.sopDraftError = "";
      env.state.sopDraftNotice = "";
      env.render();
      app.querySelector('#sop-version-upload-form [data-action="choose-sop-pdf"]')?.click();
    } else if (name === "sop-export") {
      if (!env.state.sopDraft || action.disabled) return;
      action.disabled = true;
      try {
        await runSopDraftExport(env.state.sopDraft, action.dataset.kind, action.dataset.scope ?? "changed", null, () => {});
      } catch (error) {
        showInlineNotice(error?.message || "No se pudo exportar.", "warning");
      } finally {
        action.disabled = false;
      }
    }
  });
}
