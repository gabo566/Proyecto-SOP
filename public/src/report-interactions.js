// Carga el reporte de retrabajo (RWK) desde el servidor con los filtros actuales.
async function loadCardReport(state, render) {
  state.cardReportLoading = true;
  state.cardReportError = "";
  const filters = state.rwkFilters;
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.cardType !== "all") params.set("cardType", filters.cardType);
  if (filters.employeeNumber !== "all") params.set("employeeNumber", filters.employeeNumber);
  const result = await sopApi("GET", `/api/card-events/report${params.size ? `?${params}` : ""}`);
  state.cardReportLoading = false;
  if (result.ok && result.data?.ok) state.cardReport = result.data;
  else state.cardReportError = result.status === 0 ? "No hay conexión con el servidor." : "El servidor no pudo armar el reporte.";
  render();
}

// Historial de un nodo: búsqueda por serie completa o por su terminación.
async function searchNodeHistory(state, render, query) {
  const text = String(query ?? "").trim();
  state.rwkFilters.nodeQuery = text;
  if (text.length < 3) {
    state.nodeHistory = { query: text, events: [], error: "Escribe al menos 3 dígitos de la serie." };
    render();
    return;
  }
  state.nodeHistory = { query: text, events: [], loading: true };
  render();
  const result = await sopApi("GET", `/api/card-events?query=${encodeURIComponent(text)}`);
  state.nodeHistory = result.ok && result.data?.ok
    ? { query: text, events: result.data.events ?? [], summary: result.data.summary }
    : { query: text, events: [], error: result.status === 0 ? "No hay conexión con el servidor." : "El servidor no pudo buscar el nodo." };
  render();
}

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

  app.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-rwk-history-form]")) return;
    event.preventDefault();
    void searchNodeHistory(state, render, event.target.querySelector("[data-rwk-history-query]")?.value);
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
    if (target.matches("[data-rwk-filter]")) {
      state.rwkFilters[target.dataset.rwkFilter] = target.value;
      state.cardReport = null;
      void loadCardReport(state, render);
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
    if (action.dataset.action === "area-tab") {
      const area = action.dataset.area === "RWK" ? "RWK" : "MFG";
      if (action.dataset.scope === "production") state.productionArea = area;
      else if (action.dataset.scope === "traceability") state.traceabilityArea = area;
      render();
      return;
    }
    if (action.dataset.action === "report-area") {
      state.reportArea = action.dataset.area === "RWK" ? "RWK" : "MFG";
      render();
      return;
    }
    if (action.dataset.action === "rwk-tab") {
      state.rwkTab = action.dataset.tab;
      render();
      return;
    }
    if (action.dataset.action === "rwk-reload") {
      state.cardReport = null;
      state.cardReportError = "";
      render();
      return;
    }
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
