function renderProductionView(todayRecords, state) {
  const openItems = state.workItems.filter((item) => item.status !== "Completado");
  const counts = [
    { label: "Activos", value: openItems.filter((item) => ["En proceso", "Retrabajo en proceso"].includes(item.status)).length },
    { label: "Detenidos", value: openItems.filter((item) => item.status === "Detenida").length },
    { label: "Retrabajos", value: openItems.filter((item) => item.workKind === "rework" && item.status !== "Pendiente de revisión").length },
    { label: "Por revisar", value: openItems.filter((item) => item.status === "Pendiente de revisión").length },
    { label: "Validaciones hoy", value: todayRecords.filter((record) => record.status === "Completado").length },
  ];
  return `<section class="production-dashboard" aria-labelledby="production-dashboard-title">
    <div class="production-dashboard-heading"><div><h2 id="production-dashboard-title">Producción · trabajos en curso</h2><p>Cola de trabajo local · los registros demo están excluidos.</p></div>
      <button class="button button--outlined" type="button" data-action="navigate" data-nav-id="overview" data-focus-key="nav-overview"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span>Ir a seguimiento SOP</button>
    </div>
    <dl class="production-status-strip">${counts.map((item) => `<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`).join("")}</dl>
    ${renderWorkItemsPanel(state.workItems, state.activeWorkId)}
  </section>`;
}
