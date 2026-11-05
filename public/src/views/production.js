// Producción en dos bloques: Manufactura (MFG) y Retrabajo (RWK), cada uno con sus indicadores y su cola de trabajo.
function isRwkWorkItem(item) {
  return String(item?.form?.stationAssignment ?? "").startsWith("RWK");
}

function isRwkStationRecord(record) {
  return String(record?.stationAssignment ?? "").startsWith("RWK");
}

function renderProductionArea(area, workItems, todayRecords, state) {
  const isRwk = area === "RWK";
  const items = workItems.filter((item) => isRwkWorkItem(item) === isRwk);
  const open = items.filter((item) => item.status !== "Completado");
  const validations = todayRecords.filter((record) => record.status === "Completado" && isRwkStationRecord(record) === isRwk).length;
  const counts = [
    { label: "Activos", icon: "play_circle", tone: "blue", value: open.filter((item) => ["En proceso", "Retrabajo en proceso"].includes(item.status)).length },
    { label: "Detenidos", icon: "pause_circle", tone: "red", value: open.filter((item) => item.status === "Detenida").length },
    ...(isRwk ? [{ label: "Retrabajos", icon: "build_circle", tone: "amber", value: open.filter((item) => item.workKind === "rework" && item.status !== "Pendiente de revisión").length }] : []),
    { label: "Por revisar", icon: "rate_review", tone: "violet", value: open.filter((item) => item.status === "Pendiente de revisión").length },
    { label: "Validaciones hoy", icon: "task_alt", tone: "green", value: validations },
  ];
  const meta = isRwk
    ? { icon: "build_circle", title: "Retrabajo · RWK", sub: "Desensamble, retrabajo y reparación del equipo", id: "work-items-rwk", panelTitle: "Detenidos y retrabajos de retrabajo" }
    : { icon: "precision_manufacturing", title: "Manufactura · MFG", sub: "Estaciones de proceso en la línea de producción", id: "work-items-mfg", panelTitle: "Detenidos de manufactura" };
  return `<section class="pa pa--${isRwk ? "rwk" : "mfg"}" aria-labelledby="pa-${area}-title">
    <header class="pa-head"><span class="pa-icon"><span class="material-symbols-rounded" aria-hidden="true">${meta.icon}</span></span>
      <div><h3 id="pa-${area}-title">${meta.title}</h3><p>${meta.sub}</p></div>
      <span class="pa-total"><b>${open.length}</b> ${open.length === 1 ? "trabajo abierto" : "trabajos abiertos"}</span></header>
    <dl class="pa-kpis">${counts.map((item) => `<div class="pa-kpi pa-kpi--${item.tone}"><span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span><div><dt>${item.label}</dt><dd>${item.value}</dd></div></div>`).join("")}</dl>
    ${renderWorkItemsPanel(items, state.activeWorkId, { id: meta.id, title: meta.panelTitle })}
  </section>`;
}

function renderProductionView(todayRecords, state) {
  const area = state.productionArea === "RWK" ? "RWK" : "MFG";
  const openCount = (isRwk) => state.workItems.filter((item) => isRwkWorkItem(item) === isRwk && item.status !== "Completado").length;
  const hint = (count) => `${count} ${count === 1 ? "trabajo abierto" : "trabajos abiertos"}`;
  return `<section class="production-dashboard area-center" aria-labelledby="production-dashboard-title">
    <div class="production-dashboard-heading"><div><h2 id="production-dashboard-title">Producción · trabajos en curso</h2><p>Cola de trabajo local por área · los registros demo están excluidos.</p></div>
      <button class="button button--outlined" type="button" data-action="navigate" data-nav-id="overview" data-focus-key="nav-overview"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span>Ir a seguimiento SOP</button>
    </div>
    ${renderAreaButtons(area, "production", { MFG: hint(openCount(false)), RWK: hint(openCount(true)) })}
    <div class="pa-grid">${renderProductionArea(area, state.workItems, todayRecords, state)}</div>
  </section>`;
}
