function bindReportInteractions(app, { state, getAllRecords, render, showToast }) {
  let traceabilitySearchTimer = 0;
  app.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.matches('[data-traceability-filter="query"]')) return;
    state.traceabilityFilters.query = target.value;
    state.traceabilityPage = 1;
    window.clearTimeout(traceabilitySearchTimer);
    traceabilitySearchTimer = window.setTimeout(render, 140);
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-demo-data-toggle]")) {
      state.includeDemoData = target.checked;
      state.traceabilityPage = 1;
      state.reportPage = 1;
      render();
      return;
    }
    if (target.matches("[data-report-filter]")) {
      state.reportFilters[target.dataset.reportFilter] = target.value;
      state.reportPage = 1;
      render();
      return;
    }
    if (target.matches("[data-traceability-filter]")) {
      state.traceabilityFilters[target.dataset.traceabilityFilter] = target.value;
      state.traceabilityPage = 1;
      render();
    }
  });

  app.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    if (action.dataset.action === "export-report") {
      const records = getReportRecords(getAllRecords(), state.reportFilters, state.includeDemoData);
      if (!downloadReportCsv(records)) showToast("No hay registros para exportar con estos filtros.", "warning");
      else showToast("Reporte CSV descargado.", "success");
      return;
    }
    if (action.dataset.action === "export-traceability") {
      const records = filterDemoRecords(getAllRecords(), state.includeDemoData);
      const events = getFilteredTraceabilityEvents(records, state.workItems, state.traceabilityFilters);
      if (!downloadTraceabilityCsv(events)) showToast("No hay eventos para exportar con estos filtros.", "warning");
      else showToast("Trazabilidad CSV descargada. Las fotos no se incluyen.", "success");
      return;
    }
    if (action.dataset.action === "report-page") {
      state.reportPage = Math.max(1, state.reportPage + (action.dataset.direction === "next" ? 1 : -1));
      render();
      return;
    }
    if (action.dataset.action === "traceability-page") {
      state.traceabilityPage = Math.max(1, state.traceabilityPage + (action.dataset.direction === "next" ? 1 : -1));
      render();
    }
  });
}
