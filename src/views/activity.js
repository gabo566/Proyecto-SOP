function getCategoryCounts(records) {
  const categoryOrder = new Map(Object.keys(CATEGORY_COLORS).map((category, index) => [category, index]));
  const categories = [...new Set(records.map((record) => record.category))]
    .sort((left, right) => (categoryOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(right) ?? Number.MAX_SAFE_INTEGER));
  return categories.map((category) => ({
    category,
    count: records.filter((record) => record.category === category).length,
  }));
}

function renderActivityPanel(records) {
  const counts = getCategoryCounts(records);
  return `<section class="activity-panel" aria-labelledby="activity-heading">
    <div class="section-heading compact-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">monitoring</span>
      <div><p class="eyebrow">${escapeHtml(TODAY_DATE_LABEL)} · Datos de demostración</p><h2 id="activity-heading">Desensambles completados hoy</h2></div>
    </div><strong class="today-total">${records.length}</strong></div>
    <div class="category-summary">${counts.filter((item) => item.count || records.length === 0).map((item) => `<span class="category-pill">${escapeHtml(item.category)}<strong>${item.count}</strong></span>`).join("")}</div>
    <div class="chart-canvas-wrap"><div class="chart-bars" id="completion-chart" role="img" aria-label="Completados hoy por categoría: ${escapeHtml(counts.map((item) => `${item.category}: ${item.count}`).join(", "))}"></div></div>
    <div class="activity-footer"><span>Conteo ilustrativo por tipo de procedimiento</span><button class="text-button" type="button" data-action="open-records" data-focus-key="records-open-chart"><span class="material-symbols-rounded" aria-hidden="true">format_list_bulleted</span>Procedimientos realizados</button></div>
  </section>`;
}

