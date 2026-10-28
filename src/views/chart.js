function drawCompletionChart(container, records) {
  if (!container) return;
  const counts = getCategoryCounts(records);
  container.setAttribute("aria-label", `Validaciones por tipo de SOP: ${counts.map((item) => `${item.category}: ${item.count}`).join(", ") || "sin registros"}`);
  const maximum = Math.max(2, Math.ceil(Math.max(0, ...counts.map((item) => item.count)) / 2) * 2);
  const columns = Math.max(4, counts.length);
  container.style.setProperty("--chart-columns", String(columns));
  container.style.setProperty("--chart-width", `${columns * 52}px`);
  container.innerHTML = counts.map((item) => {
    const height = item.count ? Math.max(4, (item.count / maximum) * 100) : 0;
    const color = CATEGORY_COLORS[item.category] ?? "#586f86";
    return `<div class="chart-column"><span class="chart-value">${item.count}</span>
      <div class="chart-bar-track"><span class="chart-bar" data-category="${escapeHtml(item.category)}" style="--category-color:${color};height:${height}%"></span></div>
      <span class="chart-label">${escapeHtml(item.category)}</span></div>`;
  }).join("");
}
