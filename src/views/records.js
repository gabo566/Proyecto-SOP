function recordMatchesQuery(record, query, includePartNumber = false) {
  const normalized = query.trim().toLocaleLowerCase("es-MX");
  if (!normalized) return true;
  const values = [record.serial, record.nodeNumber, record.nodePartNumber, record.category, record.stationAssignment, record.operator, record.employeeNumber, record.componentPartNumber, record.componentSerial];
  return values
    .some((value) => value?.toLocaleLowerCase("es-MX").includes(normalized));
}

function getRecordStationLabel(record) {
  const assignment = getWorkStationAssignment(record.stationAssignment);
  return assignment ? `${assignment.type} · ${assignment.label}` : "—";
}

function recordStatusClass(status) {
  if (status === "Pendiente de revisión") return "status-chip--review";
  if (status === "Corrección solicitada") return "status-chip--pending";
  return "";
}

function getRecordEvidence(record, workItems) {
  const item = workItems.find((workItem) => workItem.id === record.workItemId);
  const submission = item?.evidenceHistory?.find((entry) => entry.recordId === record.id);
  return { item, submission, count: submission?.files?.length ?? record.evidenceCount ?? 0 };
}

function renderRecordEvidenceCell(record, workItems) {
  if (!record.workItemId) {
    const view = record.evidenceCount ? `<button class="icon-button evidence-eye-button" type="button" data-action="view-record-evidence" data-record-id="${escapeHtml(record.id)}" aria-label="Ver evidencia del serial ${escapeHtml(record.serial)}"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>` : '';
    return `<td>${view || '<span class="evidence-not-available">—</span>'}</td>`;
  }
  const { count } = getRecordEvidence(record, workItems);
  const uploadButton = record.status !== "Completado"
    ? `<button class="button button--outlined evidence-record-button" type="button" data-action="manage-record-evidence" data-work-id="${escapeHtml(record.workItemId)}" data-record-id="${escapeHtml(record.id)}"><span class="material-symbols-rounded" aria-hidden="true">upload</span>${count ? `Subir más evidencia · ${count}` : "Subir evidencia"}</button>`
    : "";
  const viewButton = count ? `<button class="icon-button evidence-eye-button" type="button" data-action="view-record-evidence" data-work-id="${escapeHtml(record.workItemId)}" data-record-id="${escapeHtml(record.id)}" aria-label="Ver evidencia del serial ${escapeHtml(record.serial)}"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>` : "";
  return `<td>${uploadButton || viewButton ? `<div class="record-evidence-actions">${uploadButton}${viewButton}</div>` : '<span class="evidence-not-available">—</span>'}</td>`;
}

function renderSerialRows(records, workItems = []) {
  return records.map((record) => `<tr>
    <td><span>${escapeHtml(record.displayDate ?? TODAY_DATE_LABEL)}</span><small>${escapeHtml(record.time)}</small></td><td>${escapeHtml(getRecordStationLabel(record))}</td>
    <td class="serial-cell">${escapeHtml(record.serial)}${isDemoRecord(record) ? '<small class="record-origin record-origin--demo">DEMO</small>' : ""}</td><td>${escapeHtml(record.nodeNumber || "—")}</td><td>${escapeHtml(record.nodePartNumber)}</td>
    <td>${escapeHtml(record.operation ?? record.category)}<small>${escapeHtml(record.category)} · hoja ${escapeHtml(record.sheet ?? "—")} · SOP Rev. ${escapeHtml(record.sopRevision ?? "sin dato")}</small></td>
    <td>${escapeHtml(record.repairType ?? "—")}</td><td>${escapeHtml(record.componentPartNumber ?? "—")}</td><td>${escapeHtml(record.componentSerial ?? "—")}</td>
    <td>${escapeHtml(record.sheet ?? "—")}</td><td><span>${escapeHtml(record.operator)}</span></td><td>${escapeHtml(record.employeeNumber)}</td><td>${escapeHtml(record.position ?? "Técnico de FA")}</td>
    <td><span class="status-chip ${recordStatusClass(record.status)}"><span></span>${escapeHtml(record.status)}</span></td>${renderRecordEvidenceCell(record, workItems)}
  </tr>`).join("");
}

function getVisibleSerialRecords(records, query) {
  const filtered = records.filter((record) => recordMatchesQuery(record, query, true));
  if (query.trim()) return { filtered, visible: filtered.slice(0, 6) };
  const seenCategories = new Set();
  const visible = filtered.filter((record) => {
    if (seenCategories.has(record.category)) return false;
    seenCategories.add(record.category);
    return true;
  }).slice(0, 4);
  return { filtered, visible };
}

function renderSerialTable(records, query = "", workItems = []) {
  const { filtered, visible } = getVisibleSerialRecords(records, query);
  const rows = visible.length ? renderSerialRows(visible, workItems) : '<tr><td class="empty-row" colspan="15">No hay registros que coincidan con la búsqueda.</td></tr>';
  const footnote = `Mostrando ${visible.length} de ${filtered.length} ${query.trim() ? "coincidencias" : "registros representativos"}`;

  return `<section class="serial-panel" id="records" aria-labelledby="serial-heading"><div class="section-heading records-heading">
    <div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">database</span><div><p class="eyebrow">Seriales y evidencia de cierre</p><h2 id="serial-heading">Validaciones recientes</h2></div></div>
    <div class="records-actions"><label class="search-box"><span class="material-symbols-rounded" aria-hidden="true">search</span><input id="serial-search" data-search="serial" data-focus-key="serial-search" placeholder="Buscar serial, nodo o categoría" aria-label="Buscar registros por serial, nodo o categoría" value="${escapeHtml(query)}" /></label>
      <button class="text-button" type="button" data-action="open-records" data-focus-key="records-open-table">Ver todas las validaciones <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
    </div></div>
    <div class="demo-banner"><span class="material-symbols-rounded" aria-hidden="true">info</span>Datos de demostración · seriales, operadores y registros ilustrativos; no son producción real.</div>
    <div class="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Estación</th><th>N° de serie del nodo</th><th>N° de nodo</th><th>N° de parte del nodo</th><th>Tipo de SOP utilizada</th><th>Tipo de reparación</th><th>N° de parte del componente</th><th>N° de serie del componente</th><th>Hojas</th><th>Operador</th><th>N° empleado</th><th>Puesto</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody id="serial-table-body">${rows}</tbody></table></div>
    <div class="table-footnote"><span id="serial-table-count">${footnote}</span><span>El cierre se basa en la declaración y el registro del operador.</span></div>
  </section>`;
}

function renderDialogRows(records, query, workItems = []) {
  const filtered = records.filter((record) => recordMatchesQuery(record, query));
  if (!filtered.length) return '<tr><td class="empty-row" colspan="11">No hay coincidencias.</td></tr>';
  return filtered.map((record) => `<tr><td>${escapeHtml(record.operation ?? record.category)}<small>${escapeHtml(record.category)} · hoja ${escapeHtml(record.sheet ?? "—")} · SOP Rev. ${escapeHtml(record.sopRevision ?? "sin dato")}</small></td><td>${escapeHtml(getRecordStationLabel(record))}</td><td class="serial-cell">${escapeHtml(record.serial)}</td><td>${escapeHtml(record.nodeNumber || "—")}</td>
    <td>${escapeHtml(record.nodePartNumber)}</td><td>${escapeHtml(record.componentPartNumber)}</td><td>${escapeHtml(record.componentSerial ?? "—")}</td><td>${escapeHtml(record.repairType ?? "—")}</td>
    <td>${escapeHtml(record.operator)}<small>${escapeHtml(record.employeeNumber)} · ${escapeHtml(record.position ?? "Técnico de FA")}</small></td><td>${escapeHtml(record.time)}</td>${renderRecordEvidenceCell(record, workItems)}</tr>`).join("");
}

function renderSerialRowsOrEmpty(records, message) {
  return records.length ? renderSerialRows(records) : `<tr><td class="empty-row" colspan="7">${message}</td></tr>`;
}

function renderRecordsDialog(records, query = "", workItems = []) {
  return `<dialog class="app-dialog records-dialog" id="records-dialog" aria-labelledby="records-dialog-title">
    <div class="dialog-header"><div><p class="eyebrow">${escapeHtml(TODAY_DATE_LABEL)} · Muestra ilustrativa</p><h2 id="records-dialog-title">Procedimientos realizados</h2></div>
      <button class="icon-button" type="button" data-action="close-records" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
    <div class="dialog-summary"><strong>${records.length}</strong><span>desensambles de demostración</span></div>
    <label class="search-box dialog-search"><span class="material-symbols-rounded" aria-hidden="true">search</span><input id="records-search" data-search="dialog" data-focus-key="records-search" placeholder="Buscar por serial, nodo u operador" aria-label="Buscar en procedimientos realizados" value="${escapeHtml(query)}" /></label>
    <div class="table-scroll dialog-table-scroll"><table><thead><tr><th>Tipo de SOP utilizada</th><th>Estación</th><th>Serial del nodo</th><th>N° de nodo</th><th>P/N nodo</th><th>P/N componente</th><th>Serial del componente</th><th>Tipo de reparación</th><th>Operador / empleado</th><th>Hora</th><th>Evidencia</th></tr></thead>
      <tbody id="dialog-table-body">${renderDialogRows(records, query, workItems)}</tbody></table></div>
    <p class="dialog-note"><span class="material-symbols-rounded" aria-hidden="true">info</span>Los ${DEMO_RECORDS.length} registros iniciales y sus seriales son ficticios. Los cierres nuevos se guardan en este navegador.</p>
  </dialog>`;
}
