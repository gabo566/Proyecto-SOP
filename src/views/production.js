function renderProductionView(state) {
  const openItems = state.workItems.filter((item) => item.status !== "Completado");
  const counts = [
    { label: "En proceso", value: openItems.filter((item) => item.status === "En proceso").length },
    { label: "Detenidos", value: openItems.filter((item) => item.status === "Detenida").length },
    { label: "En retrabajo", value: openItems.filter((item) => ["Retrabajo requerido", "Retrabajo en proceso"].includes(item.status)).length },
    { label: "Por revisar", value: openItems.filter((item) => item.status === "Pendiente de revisión").length },
  ];
  return `<section class="production-dashboard" aria-labelledby="production-dashboard-title">
    <div class="production-dashboard-heading"><div><h2 id="production-dashboard-title">Producción · cola de trabajos abiertos</h2><p>Continúa trabajos activos, detenidos o en retrabajo. Los registros de demostración están excluidos.</p></div>
      <button class="button button--outlined" type="button" data-action="navigate" data-nav-id="overview" data-focus-key="nav-overview"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span>Ir a seguimiento SOP</button>
    </div>
    <dl class="production-status-strip">${counts.map((item) => `<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`).join("")}</dl>
    ${renderWorkItemsPanel(openItems, state.activeWorkId)}
  </section>`;
}
