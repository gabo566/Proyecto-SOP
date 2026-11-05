// Reportes por área: MFG (SOP usadas y tarjetas involucradas) y RWK (validaciones, reemplazos e historial del nodo).

function isRwkRecord(record) {
  return String(record?.stationAssignment ?? "").startsWith("RWK");
}

function renderReportAreaTabs(state) {
  const area = state.reportArea ?? "MFG";
  const tab = (id, label, icon, hint) => `<button type="button" class="ra-area ${area === id ? "is-on" : ""}" data-action="report-area" data-area="${id}" aria-pressed="${area === id}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span><strong>${label}</strong><small>${hint}</small></span></button>`;
  return `<div class="ra-areas" role="group" aria-label="Área del reporte">${tab("MFG", "MFG · Manufactura", "precision_manufacturing", "SOP usadas y tarjetas involucradas")}${tab("RWK", "RWK · Retrabajo", "build_circle", "Validaciones, reemplazos e historial del nodo")}</div>`;
}

// Dos botones grandes MFG | RWK, iguales a los de Reportes, para Producción y Trazabilidad.
function renderAreaButtons(current, scope, hints = {}) {
  const tab = (id, label, icon) => `<button type="button" class="ra-area ${current === id ? "is-on" : ""}" data-action="area-tab" data-scope="${scope}" data-area="${id}" aria-pressed="${current === id}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span><strong>${label}</strong><small>${hints[id] ?? ""}</small></span></button>`;
  return `<div class="ra-areas ra-areas--center" role="group" aria-label="Área">${tab("MFG", "MFG · Manufactura", "precision_manufacturing")}${tab("RWK", "RWK · Retrabajo", "build_circle")}</div>`;
}

function renderRaBars(entries, tone = "blue", emptyText = "Sin datos en este periodo.") {
  if (!entries.length) return `<p class="ra-empty">${escapeHtml(emptyText)}</p>`;
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return `<ul class="ra-bars ra-bars--${tone}">${entries.map(([label, count]) => `<li><span class="ra-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span><span class="ra-bar-track"><span class="ra-bar-fill" style="width:${Math.max(4, (count / max) * 100)}%"></span></span><b>${count}</b></li>`).join("")}</ul>`;
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "es-MX"));
}

// ---------- MFG ----------
function renderMfgReport(allRecords, state) {
  const { reportFilters, includeDemoData } = state;
  const available = filterDemoRecords(allRecords, includeDemoData).filter((record) => !isRwkRecord(record));
  const filtered = getReportRecords(available, reportFilters, includeDemoData);
  const employees = [...new Map(available.filter((record) => record.employeeNumber).map((record) => [record.employeeNumber, record.operator]))];
  const cards = countBy(filtered, (record) => String(record.componentPartNumber ?? "").trim());
  const sops = new Set(filtered.map((record) => record.category).filter(Boolean));
  const employeeOptions = employees.map(([id, name]) => `<option value="${escapeHtml(id)}" ${reportFilters.employeeNumber === id ? "selected" : ""}>${escapeHtml(name)} · ${escapeHtml(id)}</option>`).join("");
  const period = reportFilters.dateFrom || reportFilters.dateTo ? `${reportFilters.dateFrom || "inicio"} – ${reportFilters.dateTo || "hoy"}` : "todo el historial";
  const metrics = [
    { label: "Validaciones MFG", value: filtered.length },
    { label: "Tipos de SOP usados", value: sops.size },
    { label: "Tarjetas distintas", value: cards.length },
    { label: "Operadores", value: new Set(filtered.map((record) => record.employeeNumber || record.operator).filter(Boolean)).size },
  ];
  return `<div class="report-filters ra-filters" role="group" aria-label="Filtros MFG">
      <label>Desde<input type="date" data-report-filter="dateFrom" data-focus-key="report-date-from" value="${escapeHtml(reportFilters.dateFrom)}" /></label>
      <label>Hasta<input type="date" data-report-filter="dateTo" data-focus-key="report-date-to" value="${escapeHtml(reportFilters.dateTo)}" /></label>
      <label>Operador<select data-report-filter="employeeNumber" data-focus-key="report-operator"><option value="all">Todos los operadores</option>${employeeOptions}</select></label>
      <label class="demo-toggle"><input type="checkbox" data-demo-data-toggle data-focus-key="demo-data-toggle" ${includeDemoData ? "checked" : ""} /> Incluir datos demo</label>
    </div>
    <dl class="report-summary-strip">${metrics.map((metric) => `<div><dt>${metric.label}</dt><dd>${metric.value}</dd></div>`).join("")}</dl>
    ${filtered.length ? `<div class="ra-grid">
      <section class="ra-panel report-chart-panel" aria-labelledby="ra-sop-title"><h3 id="ra-sop-title">SOP utilizadas</h3><p class="ra-note">Validaciones por tipo de SOP · ${escapeHtml(period)}</p><div class="chart-canvas-wrap"><div class="chart-bars" id="completion-chart" role="img" aria-label="Validaciones por tipo de SOP"></div></div></section>
      <section class="ra-panel" aria-labelledby="ra-cards-title"><h3 id="ra-cards-title">Tarjetas involucradas</h3><p class="ra-note">Veces que cada P/N de tarjeta pasó por una SOP de manufactura</p>${renderRaBars(cards.slice(0, 12), "blue", "Sin tarjetas capturadas en este periodo.")}</section>
    </div>` : '<div class="report-empty"><strong>Sin actividad MFG en este periodo</strong><p>Intenta con otras fechas o activa los datos demo.</p></div>'}`;
}

// ---------- RWK ----------
const RWK_TABS = [
  { id: "validations", label: "Validaciones", icon: "fact_check" },
  { id: "replacements", label: "Reemplazos", icon: "swap_horiz" },
  { id: "history", label: "Historial del nodo", icon: "history" },
];

function formatRaDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(date).replaceAll(".", "")} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function raResultChip(row) {
  if (row.type === "replacement") return `<span class="ra-chip ra-chip--swap">Reemplazo${row.reason === "damage" ? " por daño" : ""}</span>`;
  return row.result === "damage" ? '<span class="ra-chip ra-chip--bad">Con daño</span>' : '<span class="ra-chip ra-chip--ok">Sin daño</span>';
}

function renderRwkFilters(state, report) {
  const filters = state.rwkFilters;
  const rows = [...(report?.validations?.rows ?? []), ...(report?.replacements?.rows ?? [])];
  const operators = [...new Map(rows.filter((row) => row.employeeNumber).map((row) => [row.employeeNumber, row.operatorName]))];
  const types = [...new Set([...getCardTypes(), ...Object.keys(report?.validations?.byCard ?? {}), ...Object.keys(report?.replacements?.byCard ?? {}), ...(filters.cardType !== "all" ? [filters.cardType] : [])])].sort((a, b) => a.localeCompare(b, "es-MX"));
  return `<div class="report-filters ra-filters" role="group" aria-label="Filtros RWK">
      <label>Desde<input type="date" data-rwk-filter="dateFrom" data-focus-key="rwk-date-from" value="${escapeHtml(filters.dateFrom)}" /></label>
      <label>Hasta<input type="date" data-rwk-filter="dateTo" data-focus-key="rwk-date-to" value="${escapeHtml(filters.dateTo)}" /></label>
      <label>Tipo de tarjeta<select data-rwk-filter="cardType" data-focus-key="rwk-card-type"><option value="all">Todos los tipos</option>${types.map((type) => `<option value="${escapeHtml(type)}" ${filters.cardType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
      <label>Operador<select data-rwk-filter="employeeNumber" data-focus-key="rwk-operator"><option value="all">Todos los operadores</option>${operators.map(([id, name]) => `<option value="${escapeHtml(id)}" ${filters.employeeNumber === id ? "selected" : ""}>${escapeHtml(name)} · ${escapeHtml(id)}</option>`).join("")}</select></label>
    </div>`;
}

function renderRwkValidations(report) {
  const v = report.validations;
  const rows = v.rows.length ? v.rows.map((row) => `<tr>
      <td><span>${escapeHtml(formatRaDate(row.occurredAt))}</span></td>
      <td><strong class="serial-cell">${escapeHtml(row.nodeSerial)}</strong></td>
      <td>${escapeHtml(row.cardType)}<small>PN ${escapeHtml(row.cardPartNumber || "—")} · Serie ${escapeHtml(row.cardSerial || "—")}</small></td>
      <td>${raResultChip(row)}${row.note ? `<small>${escapeHtml(row.note)}</small>` : ""}</td>
      <td><span>${escapeHtml(row.operatorName)}</span><small>${escapeHtml(row.employeeNumber)}</small></td>
    </tr>`).join("") : '<tr><td class="empty-row" colspan="5">No hay validaciones en este periodo.</td></tr>';
  return `<dl class="report-summary-strip ra-strip"><div><dt>Validaciones</dt><dd>${v.total}</dd></div><div><dt>Con daño</dt><dd>${v.damage}</dd></div><div><dt>Sin daño</dt><dd>${v.total - v.damage}</dd></div><div><dt>Tipos de tarjeta</dt><dd>${Object.keys(v.byCard).length}</dd></div></dl>
    <div class="ra-grid">
      <section class="ra-panel" aria-labelledby="ra-val-types"><h3 id="ra-val-types">Validaciones por tipo de tarjeta</h3>${renderRaBars(Object.entries(v.byCard).sort((a, b) => b[1] - a[1]), "blue", "Sin validaciones en este periodo.")}</section>
      <section class="ra-panel ra-panel--table report-table-panel" aria-labelledby="ra-val-table"><h3 id="ra-val-table">Detalle de validaciones</h3><div class="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Nodo</th><th>Tarjeta</th><th>Resultado</th><th>Operador</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    </div>`;
}

function renderRwkReplacements(report) {
  const r = report.replacements;
  const rows = r.rows.length ? r.rows.map((row) => `<tr>
      <td><span>${escapeHtml(formatRaDate(row.occurredAt))}</span></td>
      <td><strong class="serial-cell">${escapeHtml(row.nodeSerial)}</strong></td>
      <td>${escapeHtml(row.cardType)}<small>PN ${escapeHtml(row.cardPartNumber || "—")}</small></td>
      <td><span class="ra-serial ra-serial--new">Nueva · ${escapeHtml(row.cardSerial || "—")}</span><span class="ra-serial ra-serial--old">Retirada · ${escapeHtml(row.removedSerial || "—")}</span></td>
      <td>${raResultChip(row)}</td>
      <td><span>${escapeHtml(row.operatorName)}</span><small>${escapeHtml(row.employeeNumber)}</small></td>
    </tr>`).join("") : '<tr><td class="empty-row" colspan="6">No hay reemplazos en este periodo.</td></tr>';
  const byOperator = r.byOperator.map((item) => [`${item.operatorName} · ${item.employeeNumber}`, item.count]);
  return `<dl class="report-summary-strip ra-strip"><div><dt>Reemplazos</dt><dd>${r.total}</dd></div><div><dt>Tipos de tarjeta</dt><dd>${Object.keys(r.byCard).length}</dd></div><div><dt>Quién los hizo</dt><dd>${byOperator.length}</dd></div><div><dt>Seriales retirados</dt><dd>${r.rows.filter((row) => row.removedSerial).length}</dd></div></dl>
    <div class="ra-grid">
      <section class="ra-panel" aria-labelledby="ra-rep-types"><h3 id="ra-rep-types">Reemplazos por tipo de tarjeta</h3>${renderRaBars(Object.entries(r.byCard).sort((a, b) => b[1] - a[1]), "amber", "Sin reemplazos en este periodo.")}</section>
      <section class="ra-panel" aria-labelledby="ra-rep-ops"><h3 id="ra-rep-ops">Quién realiza los reemplazos</h3>${renderRaBars(byOperator, "navy", "Sin reemplazos en este periodo.")}</section>
      <section class="ra-panel ra-panel--table report-table-panel ra-span" aria-labelledby="ra-rep-table"><h3 id="ra-rep-table">Seriales de cada reemplazo</h3><div class="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Nodo</th><th>Tarjeta</th><th>Seriales</th><th>Motivo</th><th>Operador</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    </div>`;
}

function renderRwkHistory(state) {
  const h = state.nodeHistory;
  const search = `<form class="ra-search" data-rwk-history-form><label class="uh-search ra-search-box"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" data-rwk-history-query value="${escapeHtml(state.rwkFilters.nodeQuery)}" placeholder="Serie del nodo o su terminación (mínimo 3 dígitos)" aria-label="Buscar nodo" autocomplete="off" inputmode="numeric" maxlength="40" /></label><button class="button button--primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">manage_search</span>Buscar nodo</button></form>`;
  if (!h) return `${search}<div class="report-empty"><strong>Busca un nodo</strong><p>Escribe la serie completa o solo la terminación para ver todas sus validaciones y reemplazos.</p></div>`;
  if (h.loading) return `${search}<p class="ra-empty">Buscando…</p>`;
  if (h.error) return `${search}<div class="report-empty"><strong>No se pudo buscar</strong><p>${escapeHtml(h.error)}</p></div>`;
  if (!h.events.length) return `${search}<div class="report-empty"><strong>Sin historial para “${escapeHtml(h.query)}”</strong><p>Ese nodo no tiene validaciones ni reemplazos guardados.</p></div>`;
  const nodes = [...new Set(h.events.map((event) => event.nodeSerial))];
  const summary = h.summary ?? {};
  const items = h.events.map((event) => `<li class="ra-event ra-event--${event.type}">
      <span class="ra-dot material-symbols-rounded" aria-hidden="true">${event.type === "replacement" ? "swap_horiz" : event.result === "damage" ? "report" : "fact_check"}</span>
      <div><header><strong>${event.type === "replacement" ? "Reemplazo" : "Validación"} · ${escapeHtml(event.cardType)}</strong>${raResultChip(event)}<time>${escapeHtml(formatRaDate(event.occurredAt))}</time></header>
        <p>Nodo <b class="serial-cell">${escapeHtml(event.nodeSerial)}</b> · PN ${escapeHtml(event.cardPartNumber || "—")} · Serie ${escapeHtml(event.cardSerial || "—")}${event.type === "replacement" ? ` · Retirada ${escapeHtml(event.removedSerial || "—")}` : ""}</p>
        ${event.note ? `<p class="ra-note-text">${escapeHtml(event.note)}</p>` : ""}
        <small>${escapeHtml(event.operatorName)} · ${escapeHtml(event.employeeNumber)}</small></div></li>`).join("");
  return `${search}<dl class="report-summary-strip ra-strip"><div><dt>Nodos encontrados</dt><dd>${nodes.length}</dd></div><div><dt>Validaciones</dt><dd>${h.events.filter((event) => event.type === "validation").length}</dd></div><div><dt>Reemplazos</dt><dd>${h.events.filter((event) => event.type === "replacement").length}</dd></div><div><dt>Daños encontrados</dt><dd>${h.events.filter((event) => event.result === "damage").length}</dd></div></dl>
    <ol class="ra-timeline" aria-label="Historial del nodo">${items}</ol>`;
}

function renderRwkReport(state) {
  const report = state.cardReport;
  const tabs = `<div class="ra-tabs" role="tablist" aria-label="Categorías RWK">${RWK_TABS.map((tab) => `<button type="button" role="tab" class="ra-tab ${state.rwkTab === tab.id ? "is-on" : ""}" aria-selected="${state.rwkTab === tab.id}" data-action="rwk-tab" data-tab="${tab.id}"><span class="material-symbols-rounded" aria-hidden="true">${tab.icon}</span>${tab.label}${report && tab.id !== "history" ? `<b>${tab.id === "validations" ? report.validations.total : report.replacements.total}</b>` : ""}</button>`).join("")}</div>`;
  const filters = state.rwkTab === "history" ? "" : renderRwkFilters(state, report);
  let body;
  if (state.rwkTab === "history") body = renderRwkHistory(state);
  else if (!report) body = state.cardReportError
    ? `<div class="report-empty"><strong>No se pudo cargar el reporte</strong><p>${escapeHtml(state.cardReportError)}</p><button class="button button--outlined" type="button" data-action="rwk-reload">Reintentar</button></div>`
    : '<p class="ra-empty">Cargando reporte de retrabajo…</p>';
  else body = state.rwkTab === "replacements" ? renderRwkReplacements(report) : renderRwkValidations(report);
  return `${tabs}${filters}${body}`;
}

function renderReportsArea(allRecords, state, workItems) {
  const area = state.reportArea ?? "MFG";
  const subtitle = area === "RWK" ? "Retrabajo: validaciones, reemplazos y el historial de cada nodo." : "Manufactura: SOP utilizadas y tarjetas involucradas.";
  return `<section class="reports-view ra-view" aria-labelledby="reports-title">
    <div class="section-heading reports-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">bar_chart</span><div><h2 id="reports-title">Reportes</h2><p class="ra-sub">${subtitle}</p></div></div></div>
    ${renderReportAreaTabs(state)}
    ${area === "RWK" ? renderRwkReport(state) : renderMfgReport(allRecords, state)}
  </section>`;
}
