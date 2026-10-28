function renderReportsView(allRecords, state) {
  const { reportFilters, includeDemoData } = state;
  const filtered = getReportRecords(allRecords, reportFilters, includeDemoData);
  const summary = getReportSummary(filtered);
  const availableRecords = filterDemoRecords(allRecords, includeDemoData);
  const categories = [...new Set(availableRecords.map((record) => record.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-MX"));
  const employees = [...new Map(availableRecords.filter((record) => record.employeeNumber).map((record) => [record.employeeNumber, record.operator]))];
  const metrics = [
    { label: "Validaciones", value: summary.total },
    { label: "Operadores", value: summary.operators },
    { label: "Retrabajos enviados", value: summary.reworkCount },
    { label: "Con evidencia", value: `${summary.evidenceCount} · ${summary.evidencePercent}%` },
  ];
  const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category)}" ${reportFilters.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("");
  const employeeOptions = employees.map(([id, name]) => `<option value="${escapeHtml(id)}" ${reportFilters.employeeNumber === id ? "selected" : ""}>${escapeHtml(name)} · ${escapeHtml(id)}</option>`).join("");
  const periodLabel = reportFilters.dateFrom || reportFilters.dateTo
    ? `${reportFilters.dateFrom || "inicio"} – ${reportFilters.dateTo || "hoy"}`
    : "todo el historial";

  return `<section class="reports-view" aria-labelledby="reports-title">
    <div class="section-heading reports-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">bar_chart</span><div><h2 id="reports-title">Reportes de ejecución SOP</h2><p class="reports-subtitle">Indicadores del periodo seleccionado · registros guardados en este navegador</p></div></div>
      <button class="button button--primary" type="button" data-action="export-report" ${filtered.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">download</span>Exportar CSV</button></div>
    <div class="report-filters" role="group" aria-label="Filtros de reportes">
      <label>Desde<input type="date" data-report-filter="dateFrom" data-focus-key="report-date-from" value="${escapeHtml(reportFilters.dateFrom)}" /></label>
      <label>Hasta<input type="date" data-report-filter="dateTo" data-focus-key="report-date-to" value="${escapeHtml(reportFilters.dateTo)}" /></label>
      <label>Turno<select data-report-filter="shift" data-focus-key="report-shift"><option value="all">Todos los turnos</option>${["Turno 1", "Turno 2", "Turno 3", "Sin turno"].map((shift) => `<option value="${shift}" ${reportFilters.shift === shift ? "selected" : ""}>${shift}</option>`).join("")}</select></label>
      <label>Tipo SOP<select data-report-filter="category" data-focus-key="report-category"><option value="all">Todos los tipos</option>${categoryOptions}</select></label>
      <label>Operador<select data-report-filter="employeeNumber" data-focus-key="report-operator"><option value="all">Todos los operadores</option>${employeeOptions}</select></label>
      <label class="demo-toggle"><input type="checkbox" data-demo-data-toggle data-focus-key="demo-data-toggle" ${includeDemoData ? "checked" : ""} /> Incluir datos demo</label>
    </div>
    <dl class="report-summary-strip">${metrics.map((metric) => `<div><dt>${metric.label}</dt><dd>${metric.value}</dd></div>`).join("")}</dl>
    <div class="report-data-note-row"><p class="report-data-note">${includeDemoData ? "Incluye registros ilustrativos DEMO." : "Los registros ilustrativos DEMO están excluidos."} El turno se calcula desde la hora guardada. El CSV contiene el conjunto completo filtrado.</p><button class="button button--outlined" type="button" data-action="navigate" data-nav-id="traceability" data-focus-key="nav-traceability"><span class="material-symbols-rounded" aria-hidden="true">manage_search</span>Consultar detalle en Trazabilidad</button></div>
    ${filtered.length ? `<div class="reports-chart-grid"><section class="report-chart-panel" aria-labelledby="report-chart-title"><h3 id="report-chart-title">Validaciones por tipo de SOP</h3><div class="chart-canvas-wrap"><div class="chart-bars" id="completion-chart" role="img" aria-label="Validaciones por tipo de SOP para ${escapeHtml(periodLabel)}"></div></div></section>${renderOperatorCounts(filtered, periodLabel)}</div>` : '<div class="report-empty"><strong>Sin actividad en este periodo</strong><p>Intenta con otras fechas o activa los datos demo para explorar el reporte.</p></div>'}
  </section>`;
}
