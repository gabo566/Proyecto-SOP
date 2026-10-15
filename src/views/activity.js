function getCategoryCounts(records) {
  const categoryOrder = new Map(Object.keys(CATEGORY_COLORS).map((category, index) => [category, index]));
  const categories = [...new Set(records.map((record) => record.category))]
    .sort((left, right) => (categoryOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(right) ?? Number.MAX_SAFE_INTEGER));
  return categories.map((category) => ({
    category,
    count: records.filter((record) => record.category === category).length,
  }));
}

function getOperatorCounts(records) {
  const operators = new Map();
  records.filter((record) => record.status === "Completado").forEach((record) => {
    const key = record.employeeNumber || record.operator || "Sin operador";
    const entry = operators.get(key) ?? {
      name: record.operator || "Sin operador",
      employeeNumber: record.employeeNumber || "",
      total: 0,
      categories: new Map(),
    };
    entry.total += 1;
    entry.categories.set(record.category, (entry.categories.get(record.category) ?? 0) + 1);
    operators.set(key, entry);
  });
  const categorySet = new Set([...operators.values()].flatMap((operator) => [...operator.categories.keys()]));
  const categories = [
    ...Object.keys(CATEGORY_COLORS).filter((category) => categorySet.has(category)),
    ...[...categorySet].filter((category) => !CATEGORY_COLORS[category]).sort((a, b) => a.localeCompare(b, "es-MX")),
  ];
  return {
    categories,
    operators: [...operators.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, "es-MX")),
  };
}

function renderOperatorCounts(records) {
  const { categories, operators } = getOperatorCounts(records);
  if (!operators.length) return '<p class="operator-chart-empty">Aún no hay SOPs completadas hoy.</p>';
  const categoryHeaders = categories.map((category) => `<th scope="col"><span class="operator-category-heading" style="--operator-category-color:${CATEGORY_COLORS[category] ?? "#586f86"}">${escapeHtml(category)}</span></th>`).join("");
  const legend = categories.map((category) => `<span class="operator-legend-item"><i style="--operator-category-color:${CATEGORY_COLORS[category] ?? "#586f86"}" aria-hidden="true"></i>${escapeHtml(category)}</span>`).join("");
  const rows = operators.map((operator) => {
    const segments = categories.map((category) => {
      const count = operator.categories.get(category) ?? 0;
      return count ? `<span style="--operator-category-color:${CATEGORY_COLORS[category] ?? "#586f86"};flex-grow:${count}" title="${escapeHtml(category)}: ${count}"></span>` : "";
    }).join("");
    const cells = categories.map((category) => `<td>${operator.categories.get(category) ?? 0}</td>`).join("");
    return `<tr><th scope="row"><strong>${escapeHtml(operator.name)}</strong><small>${escapeHtml(operator.employeeNumber || "Sin número de empleado")}</small></th>${cells}<td class="operator-count-total">${operator.total}</td><td><div class="operator-stacked-bar" role="img" aria-label="${escapeHtml(operator.name)}: ${categories.map((category) => `${category} ${operator.categories.get(category) ?? 0}`).join(", ")}; total ${operator.total}">${segments}</div></td></tr>`;
  }).join("");
  const grandTotal = operators.reduce((sum, operator) => sum + operator.total, 0);
  return `<section class="operator-activity" aria-labelledby="operator-activity-heading"><div class="operator-activity-heading"><div><p class="eyebrow">Rendimiento individual</p><h3 id="operator-activity-heading">SOPs completadas por operador</h3><small class="operator-table-note">Cada columna cuenta las SOPs terminadas por tipo; la barra muestra su distribución.</small></div><span>${operators.length} operadores · ${grandTotal} SOPs</span></div><div class="operator-table-wrap"><table class="operator-table"><thead><tr><th scope="col">Operador</th>${categoryHeaders}<th scope="col">Total</th><th scope="col">Distribución</th></tr></thead><tbody>${rows}</tbody></table></div><div class="operator-legend" aria-label="Leyenda de categorías">${legend}</div></section>`;
}

function renderActivityPanel(records) {
  const counts = getCategoryCounts(records);
  return `<section class="activity-panel" aria-labelledby="activity-heading">
    <div class="section-heading compact-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">monitoring</span>
      <div><p class="eyebrow">${escapeHtml(TODAY_DATE_LABEL)} · Datos de demostración</p><h2 id="activity-heading">Desensambles completados hoy</h2></div>
    </div><strong class="today-total">${records.length}</strong></div>
    <div class="category-summary">${counts.filter((item) => item.count || records.length === 0).map((item) => `<span class="category-pill">${escapeHtml(item.category)}<strong>${item.count}</strong></span>`).join("")}</div>
    <div class="chart-canvas-wrap"><div class="chart-bars" id="completion-chart" role="img" aria-label="Completados hoy por categoría: ${escapeHtml(counts.map((item) => `${item.category}: ${item.count}`).join(", "))}"></div></div>
    ${renderOperatorCounts(records)}
    <div class="activity-footer"><span>Conteo de validaciones completadas hoy. Incluye los datos de demostración.</span><button class="text-button" type="button" data-action="open-records" data-focus-key="records-open-chart"><span class="material-symbols-rounded" aria-hidden="true">format_list_bulleted</span>Procedimientos realizados</button></div>
  </section>`;
}

