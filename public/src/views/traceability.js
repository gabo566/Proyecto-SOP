const TRACEABILITY_PAGE_SIZE = 25;

function getTraceabilityEvents(records, workItems) {
  const recordEvents = records.map((record) => ({
    id: `record-${record.id}`,
    at: Date.parse(`${record.date ?? ""}T${record.time ?? "00:00"}`) || 0,
    dateKey: record.date ?? "",
    record,
    workItem: workItems.find((item) => item.id === record.workItemId),
    serial: record.serial,
    nodeNumber: record.nodeNumber,
    nodePartNumber: record.nodePartNumber,
    stationAssignment: record.stationAssignment,
    componentPartNumber: record.componentPartNumber,
    componentSerial: record.componentSerial,
    category: record.category,
    procedureTitle: record.operation ?? record.category,
    sheet: record.sheet,
    operator: record.operator,
    employeeNumber: record.employeeNumber,
    shift: getShiftForTime(record.time),
    label: record.recordType ?? "Validación registrada",
    detail: [record.stationAssignment ? `Estación: ${formatWorkStationAssignment(record.stationAssignment)}` : "", record.repairType ? `Reparación: ${record.repairType}` : "Validación SOP"].filter(Boolean).join(" · "),
    timeLabel: `${record.displayDate ?? record.date ?? "Fecha no disponible"} · ${record.time ?? "Hora no disponible"}`,
  }));
  const workEvents = workItems.flatMap((item) => (item.history ?? []).map((event, index) => ({
    id: `work-${item.id}-${index}`,
    at: Number(event.at) || 0,
    dateKey: Number(event.at) ? getLocalDateKey(new Date(Number(event.at))) : "",
    record: null,
    workItem: item,
    serial: item.serial,
    nodeNumber: item.nodeNumber,
    nodePartNumber: item.form?.nodePartNumber ?? "",
    stationAssignment: item.form?.stationAssignment ?? "",
    componentPartNumber: item.componentPartNumber,
    componentSerial: item.componentSerial,
    category: item.category,
    procedureTitle: item.procedureTitle,
    sheet: item.sheet,
    operator: item.form?.name ?? "Sin operador",
    employeeNumber: item.employeeNumber,
    shift: getShiftForTime(event.time),
    label: `${item.workKind === "rework" ? "Retrabajo" : item.workKind === "guided" ? "Desensamble SOP" : "Trabajo detenido"} · ${event.status}`,
    detail: [item.form?.stationAssignment ? `Estación: ${formatWorkStationAssignment(item.form.stationAssignment)}` : "", item.repairType ? `Reparación: ${item.repairType}` : "", event.note || item.reason || item.reasonLabel || "Cambio de estado"].filter(Boolean).join(" · "),
    timeLabel: `${event.date ?? "Fecha no disponible"} · ${event.time ?? "Hora no disponible"}`,
  })));
  return [...recordEvents, ...workEvents].sort((left, right) => right.at - left.at);
}

function traceabilityEvidenceButton(event) {
  if (event.record) {
    const count = Number(event.record.evidenceCount ?? event.record.evidenceFiles?.length ?? 0);
    if (!count) return "";
    return `<button class="icon-button evidence-eye-button" type="button" data-action="view-record-evidence" data-work-id="${escapeHtml(event.workItem?.id ?? "")}" data-record-id="${escapeHtml(event.record.id)}" aria-label="Ver evidencia del registro"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>`;
  }
  const item = event.workItem;
  if (item?.stopEvidence?.length) return `<button class="icon-button evidence-eye-button" type="button" data-action="view-stop-evidence" data-work-id="${escapeHtml(item.id)}" aria-label="Ver evidencia al detener"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>`;
  const hasEvidence = item?.evidenceHistory?.some((submission) => submission.files?.length) || item?.evidenceFiles?.length;
  return hasEvidence ? `<button class="icon-button evidence-eye-button" type="button" data-action="view-work-evidence" data-work-id="${escapeHtml(item.id)}" aria-label="Ver evidencia del retrabajo"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>` : "";
}

function traceabilityEventMatches(event, filters) {
  if (filters.dateFrom && event.dateKey < filters.dateFrom) return false;
  if (filters.dateTo && event.dateKey > filters.dateTo) return false;
  if (filters.shift !== "all" && event.shift !== filters.shift) return false;
  if (filters.category !== "all" && event.category !== filters.category) return false;
  if (filters.employeeNumber !== "all" && event.employeeNumber !== filters.employeeNumber) return false;
  const query = filters.query.trim().toLocaleLowerCase("es-MX");
  if (!query) return true;
  return [event.serial, event.nodeNumber, event.nodePartNumber, event.stationAssignment, event.componentPartNumber, event.componentSerial, event.category, event.procedureTitle, event.operator, event.employeeNumber, event.label, event.detail]
    .some((value) => String(value ?? "").toLocaleLowerCase("es-MX").includes(query));
}

function getFilteredTraceabilityEvents(records, workItems, filters) {
  return getTraceabilityEvents(records, workItems).filter((event) => traceabilityEventMatches(event, filters));
}

// ---- Presentación de la tabla: iconos, etiquetas de color y avatar del operador ----
function traceIcon(name) {
  return `<span class="material-symbols-rounded tr-ico" aria-hidden="true">${name}</span>`;
}

function traceShiftTone(shift) {
  return shift === "Turno 1" ? "t1" : shift === "Turno 2" ? "t2" : shift === "Turno 3" ? "t3" : "none";
}

function traceEventKind(event) {
  const text = String(event.label ?? "").toLocaleLowerCase("es-MX");
  if (text.includes("detenido") || text.includes("detenid")) return { tone: "stop", icon: "pause_circle" };
  if (text.includes("retrabajo")) return { tone: "rework", icon: "build_circle" };
  if (text.includes("desensamble")) return { tone: "sop", icon: "construction" };
  return { tone: "ok", icon: "task_alt" };
}

function traceInitials(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return (words.length ? (words[0][0] + (words[1]?.[0] ?? "")) : "?").toLocaleUpperCase("es-MX");
}

function traceStationChip(value) {
  return value ? `<span class="tr-chip tr-chip--station">${traceIcon("factory")}${escapeHtml(formatWorkStationAssignment(value))}</span>` : "";
}

function renderTraceabilityRow(event) {
  const kind = traceEventKind(event);
  const detailText = String(event.detail ?? "").split(" · ").filter((part) => part && !part.startsWith("Estación:")).join(" · ");
  const [datePart, timePart] = String(event.timeLabel ?? "").split(" · ");
  return `<tr>
    <td><div class="tr-when"><span class="tr-line">${traceIcon("calendar_month")}<b>${escapeHtml(datePart || "Fecha no disponible")}</b></span><span class="tr-line tr-line--soft">${traceIcon("schedule")}${escapeHtml(timePart || "—")}</span><span class="tr-chip tr-chip--${traceShiftTone(event.shift)}">${escapeHtml(event.shift)}</span></div></td>
    <td><div class="tr-node"><span class="tr-icon-box tr-icon-box--node">${traceIcon("dns")}</span><div><strong class="tr-serial">${escapeHtml(event.serial || "Serial sin capturar")}</strong><small>Nodo ${escapeHtml(event.nodeNumber || "sin número")}</small><small class="tr-pn">${escapeHtml(event.nodePartNumber || "P/N nodo no capturado")}</small></div></div></td>
    <td><div class="tr-sop"><span class="tr-icon-box">${traceIcon("description")}</span><div><strong>${escapeHtml(event.procedureTitle || event.category || "—")}</strong>${event.sheet ? `<span class="tr-chip tr-chip--sheet">${traceIcon("layers")}Hoja ${escapeHtml(event.sheet)}</span>` : '<small>Hoja no capturada</small>'}</div></div></td>
    <td><div class="tr-event"><span class="tr-chip tr-chip--${kind.tone}">${traceIcon(kind.icon)}${escapeHtml(event.label)}</span>${traceStationChip(event.stationAssignment)}${detailText ? `<small>${escapeHtml(detailText)}</small>` : ""}</div></td>
    <td><div class="tr-op"><span class="tr-avatar" aria-hidden="true">${escapeHtml(traceInitials(event.operator))}</span><div><strong>${escapeHtml(event.operator || "Sin operador")}</strong><small>${traceIcon("badge")}${escapeHtml(event.employeeNumber || "Sin número de empleado")}</small></div></div></td>
    <td><div class="tr-comp"><span class="tr-icon-box tr-icon-box--card">${traceIcon("memory")}</span><div><strong>${escapeHtml(event.componentPartNumber || "—")}</strong><small>${traceIcon("pin")}${escapeHtml(event.componentSerial || "Serie no capturada")}</small></div></div></td>
    <td>${traceabilityEvidenceButton(event) || '<span class="evidence-not-available">—</span>'}</td>
  </tr>`;
}

function renderTraceabilityView(records, workItems, state) {
  const allEvents = getTraceabilityEvents(records, workItems);
  const filters = state.traceabilityFilters;
  const filtered = getFilteredTraceabilityEvents(records, workItems, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / TRACEABILITY_PAGE_SIZE));
  const page = Math.min(Math.max(1, state.traceabilityPage), pageCount);
  const visible = filtered.slice((page - 1) * TRACEABILITY_PAGE_SIZE, page * TRACEABILITY_PAGE_SIZE);
  const categories = [...new Set(allEvents.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-MX"));
  const employees = [...new Map(allEvents.filter((event) => event.employeeNumber).map((event) => [event.employeeNumber, { id: event.employeeNumber, name: event.operator }])).entries()];
  const rows = visible.length ? visible.map(renderTraceabilityRow).join("") : '<tr><td class="empty-row" colspan="7">No hay eventos con estos filtros. Prueba con otro serial, fecha o turno.</td></tr>';
  const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category)}" ${filters.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("");
  const employeeOptions = employees.map(([id, value]) => `<option value="${escapeHtml(id)}" ${filters.employeeNumber === id ? "selected" : ""}>${escapeHtml(value.name)} · ${escapeHtml(id)}</option>`).join("");
  const pageLabel = filtered.length ? `Eventos ${((page - 1) * TRACEABILITY_PAGE_SIZE) + 1}–${Math.min(page * TRACEABILITY_PAGE_SIZE, filtered.length)} de ${filtered.length}` : "0 eventos";
  return `<section class="traceability-view" aria-labelledby="traceability-title">
    <div class="section-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">account_tree</span><div><h2 id="traceability-title">Trazabilidad de nodo y componentes</h2><p class="traceability-subtitle">Validaciones, pausas y retrabajos en orden cronológico · servidor</p></div></div>
      <div class="traceability-actions"><label class="demo-toggle"><input type="checkbox" data-demo-data-toggle data-focus-key="demo-data-toggle" ${state.includeDemoData ? "checked" : ""} /> Incluir registros demo</label><button class="button button--primary" type="button" data-action="export-traceability" ${filtered.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">download</span>Exportar CSV</button></div></div>
    <div class="traceability-filters" aria-label="Filtros de trazabilidad">
      <label class="search-box"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" data-traceability-filter="query" data-focus-key="traceability-search" placeholder="Serial, P/N, operador o SOP" value="${escapeHtml(filters.query)}" /></label>
      <label>Desde<input type="date" data-traceability-filter="dateFrom" data-focus-key="traceability-from" value="${escapeHtml(filters.dateFrom)}" /></label>
      <label>Hasta<input type="date" data-traceability-filter="dateTo" data-focus-key="traceability-to" value="${escapeHtml(filters.dateTo)}" /></label>
      <label>Turno<select data-traceability-filter="shift" data-focus-key="traceability-shift"><option value="all">Todos</option>${["Turno 1", "Turno 2", "Turno 3", "Sin turno"].map((shift) => `<option value="${shift}" ${filters.shift === shift ? "selected" : ""}>${shift}</option>`).join("")}</select></label>
      <label>Tipo SOP<select data-traceability-filter="category" data-focus-key="traceability-category"><option value="all">Todos</option>${categoryOptions}</select></label>
      <label>Operador<select data-traceability-filter="employeeNumber" data-focus-key="traceability-operator"><option value="all">Todos</option>${employeeOptions}</select></label>
    </div>
    <div class="table-scroll"><table class="traceability-table"><thead><tr><th>Fecha y turno</th><th>Nodo</th><th>SOP / hoja</th><th>Evento y detalle</th><th>Operador</th><th>Componente</th><th>Evidencia</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="traceability-pagination"><span>${pageLabel}</span><div><button class="button button--outlined" type="button" data-action="traceability-page" data-direction="previous" ${page <= 1 ? "disabled" : ""}>Anterior</button><button class="button button--outlined" type="button" data-action="traceability-page" data-direction="next" ${page >= pageCount ? "disabled" : ""}>Siguiente</button></div></div>
    <p class="traceability-note">Los registros de periodos antiguos no contienen turno explícito; el turno se estima a partir de la hora registrada. La aplicación no sincroniza datos entre usuarios.</p>
  </section>`;
}
