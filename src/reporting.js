function isDemoRecord(record) {
  return record?.recordType === "Demostración" || String(record?.id ?? "").startsWith("demo-") || String(record?.serial ?? "").startsWith("DEMO-");
}

function filterDemoRecords(records, includeDemo = false) {
  return includeDemo ? records : records.filter((record) => !isDemoRecord(record));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .format(date)
    .replaceAll(".", "");
}

function getShiftForTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "Sin turno";
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes >= 7 * 60 && minutes < 15 * 60) return "Turno 1";
  if (minutes >= 15 * 60 && minutes < 22 * 60 + 30) return "Turno 2";
  if (minutes >= 22 * 60 + 30 || minutes <= 5 * 60 + 30) return "Turno 3";
  return "Sin turno";
}

function getReportRecords(records, filters = {}, includeDemo = false) {
  return records.filter((record) => {
    if (!includeDemo && isDemoRecord(record)) return false;
    if (filters.dateFrom && record.date < filters.dateFrom) return false;
    if (filters.dateTo && record.date > filters.dateTo) return false;
    if (filters.shift && filters.shift !== "all" && getShiftForTime(record.time) !== filters.shift) return false;
    if (filters.category && filters.category !== "all" && record.category !== filters.category) return false;
    if (filters.employeeNumber && filters.employeeNumber !== "all" && record.employeeNumber !== filters.employeeNumber) return false;
    return true;
  }).sort((left, right) => `${right.date ?? ""}T${right.time ?? ""}`.localeCompare(`${left.date ?? ""}T${left.time ?? ""}`));
}

function getReportSummary(records) {
  const operatorIds = new Set(records.map((record) => record.employeeNumber || record.operator).filter(Boolean));
  const reworkCount = records.filter((record) => String(record.recordType ?? "").toLocaleLowerCase("es-MX").includes("retrabajo")).length;
  const evidenceCount = records.filter((record) => Number(record.evidenceCount ?? record.evidenceFiles?.length ?? 0) > 0).length;
  return {
    total: records.length,
    operators: operatorIds.size,
    reworkCount,
    evidenceCount,
    evidencePercent: records.length ? Math.round((evidenceCount / records.length) * 100) : 0,
  };
}

function escapeCsvCell(value) {
  let cell = String(value ?? "");
  if (/^\s*[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

function downloadReportCsv(records) {
  if (!records.length) return false;
  const columns = [
    ["Fecha", (record) => record.date],
    ["Hora", (record) => record.time],
    ["Turno calculado", (record) => getShiftForTime(record.time)],
    ["Estación", (record) => getWorkStationAssignment(record.stationAssignment)?.value ?? record.stationAssignment],
    ["Serial del nodo", (record) => record.serial],
    ["N° de nodo", (record) => record.nodeNumber],
    ["P/N del nodo", (record) => record.nodePartNumber],
    ["Tipo de SOP", (record) => record.operation ?? record.category],
    ["Revisión SOP", (record) => record.sopRevision],
    ["Hojas SOP validadas", (record) => record.validatedSheets?.map((sheet) => sheet.sheet).join("; ")],
    ["Cantidad de pasos confirmados", (record) => record.validatedStepCount],
    ["Declaración final", (record) => record.declarationText],
    ["Categoría", (record) => record.category],
    ["Tipo de reparación", (record) => record.repairType],
    ["P/N del componente", (record) => record.componentPartNumber],
    ["Serial del componente", (record) => record.componentSerial],
    ["Operador", (record) => record.operator],
    ["N° de empleado", (record) => record.employeeNumber],
    ["Estado", (record) => record.status],
    ["Origen", (record) => isDemoRecord(record) ? "Demostración" : "Registro local"],
  ];
  const rows = [columns.map(([label]) => escapeCsvCell(label)).join(",")];
  records.forEach((record) => rows.push(columns.map(([, getValue]) => escapeCsvCell(getValue(record))).join(",")));
  const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-sop-${getLocalDateKey()}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function downloadTraceabilityCsv(events) {
  if (!events.length) return false;
  const columns = [
    ["Fecha", (event) => event.dateKey], ["Hora", (event) => event.timeLabel.split(" · ").at(-1)],
    ["Turno", (event) => event.shift], ["Serial del nodo", (event) => event.serial],
    ["N° de nodo", (event) => event.nodeNumber],
    ["P/N del nodo", (event) => event.nodePartNumber], ["Estación", (event) => getWorkStationAssignment(event.stationAssignment)?.value ?? event.stationAssignment], ["Tipo de SOP", (event) => event.procedureTitle],
    ["Hoja", (event) => event.sheet], ["Evento", (event) => event.label], ["Detalle", (event) => event.detail],
    ["Operador", (event) => event.operator], ["N° de empleado", (event) => event.employeeNumber],
    ["P/N del componente", (event) => event.componentPartNumber], ["Serial del componente", (event) => event.componentSerial],
  ];
  const rows = [columns.map(([label]) => escapeCsvCell(label)).join(",")];
  events.forEach((event) => rows.push(columns.map(([, getValue]) => escapeCsvCell(getValue(event))).join(",")));
  const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trazabilidad-sop-${getLocalDateKey()}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
