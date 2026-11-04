function renderStationIntakeSopChoice(state, assignment, isSelected) {
  if (!isSelected || !assignment) return "";
  const versions = getEnabledSopVersionsForStation(state, assignment.value);
  if (!versions.length) return '<span class="station-choice-status station-choice-status--disabled">No hay SOP habilitadas en esta estación</span>';
  if (versions.length === 1) {
    const version = versions[0];
    return `<span class="station-choice-status">SOP: ${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</span>`;
  }
  const selectedId = versions.some((version) => version.id === state.form.sopVersionId)
    ? state.form.sopVersionId
    : versions[0].id;
  return `<span class="station-choice-sop-selector"><span>SOP habilitadas:</span><select aria-label="SOP habilitadas para ${escapeHtml(assignment.type)} · ${escapeHtml(assignment.label)}" data-sop-version data-focus-key="sop-version-select">${versions.map((version) => `<option value="${escapeHtml(version.id)}" ${version.id === selectedId ? "selected" : ""}>${escapeHtml(version.document.title)} · Rev. ${escapeHtml(version.document.revision)}</option>`).join("")}</select></span>`;
}

function renderStationPills(assignments, current, label) {
  if (!assignments.length) return "";
  return `<span class="station-pills" role="group" aria-label="${escapeHtml(label)}">${assignments.map((item) => {
    const selected = item.value === current?.value;
    const name = item.type === "RWK" && !item.custom ? "Desensamble" : item.label;
    return `<button type="button" class="station-pill ${selected ? "station-pill--on" : ""}" data-action="pick-station" data-station-value="${escapeHtml(item.value)}" data-focus-key="station-pick-${escapeHtml(item.value)}" aria-pressed="${selected}">${escapeHtml(name)}</button>`;
  }).join("")}</span>`;
}

function renderDisassemblyChoice(choice, filter = "") {
  if (!choice.options.length) return "";
  const selectedIds = new Set(choice.selected.map((option) => option.id));
  const query = normalizeDisassemblySearch(filter).trim();
  const totalSteps = choice.selected.reduce((total, option) => total + option.steps, 0);
  return `<fieldset class="station-disassembly" aria-labelledby="station-disassembly-title"><legend id="station-disassembly-title"><span class="material-symbols-rounded" aria-hidden="true">build_circle</span>¿Qué hojas del desensamble vas a realizar?</legend>
    <p>Elige una o varias hojas. Solo verás en la SOP las hojas que selecciones.</p>
    <div class="station-disassembly-bar">
      <label class="station-disassembly-search"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" data-disassembly-filter value="${escapeHtml(filter)}" placeholder="Buscar: BF3, busbar, hoja 35…" autocomplete="off" aria-label="Buscar hoja" /></label>
      <button type="button" class="station-disassembly-tool" data-action="select-all-disassembly-sheets" data-focus-key="disassembly-all"><span class="material-symbols-rounded" aria-hidden="true">select_all</span>Todas (${choice.options.length})</button>
      <button type="button" class="station-disassembly-tool" data-action="clear-disassembly-sheets" data-focus-key="disassembly-none" ${choice.selected.length ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">deselect</span>Quitar</button>
      <span class="station-disassembly-count ${choice.selected.length ? "station-disassembly-count--on" : ""}" role="status"><span class="material-symbols-rounded" aria-hidden="true">${choice.selected.length ? "task_alt" : "info"}</span>${choice.selected.length ? `${choice.selected.length} ${choice.selected.length === 1 ? "hoja" : "hojas"} · ${totalSteps} pasos` : "Ninguna hoja elegida"}</span>
    </div>
    <div class="station-disassembly-grid">${choice.options.map((option, index) => {
      const selected = selectedIds.has(option.id);
      const search = normalizeDisassemblySearch(`${option.label} ${option.description}`);
      return `<button type="button" class="station-disassembly-sheet ${selected ? "station-disassembly-sheet--on" : ""}" data-action="toggle-disassembly-sheet" data-sheet-id="${escapeHtml(option.id)}" data-focus-key="disassembly-${index}" data-search="${escapeHtml(search)}" aria-pressed="${selected}" ${query && !search.includes(query) ? "hidden" : ""}><span class="station-disassembly-icon station-disassembly-icon--${option.tone}" aria-hidden="true"><span class="material-symbols-rounded">${option.icon}</span></span><span class="station-disassembly-body"><span class="station-disassembly-sheet-head"><strong>${escapeHtml(option.label)}</strong><small>${option.steps} ${option.steps === 1 ? "paso" : "pasos"}</small></span><span class="station-disassembly-sheet-text">${escapeHtml(option.description)}</span></span><span class="station-disassembly-check" aria-hidden="true"><span class="material-symbols-rounded">${selected ? "check_circle" : "radio_button_unchecked"}</span></span></button>`;
    }).join("")}</div></fieldset>`;
}

function renderStationIntake(state) {
  const user = getAuthenticatedLocalUser();
  const currentAssignment = getWorkStationAssignment(state.form.stationAssignment);
  const assignment = currentAssignment ?? getWorkStationAssignment("MFG:TDR");
  const selectedType = assignment?.type ?? "MFG";
  const activeVersion = findSopVersionForStation(state, assignment?.value, state.form.sopVersionId);
  const enabledMfgAssignments = getEnabledWorkStationAssignments(state, "MFG");
  const enabledRwkAssignments = getEnabledWorkStationAssignments(state, "RWK");
  const status = getStationIntakeStatus(state);
  const disassemblyChoice = getStationDisassemblyChoice(state);
  const canContinue = isStationIntakeReady(state);
  const stationHint = '<span class="station-choice-status station-choice-status--hint">Elige una estación</span>';
  const error = state.formError ? `<p class="form-error station-intake-error" id="station-intake-error" role="alert">${escapeHtml(state.formError)}</p>` : "";
  const isMfg = selectedType === "MFG";
  const mfgSelected = isMfg && enabledMfgAssignments.some((item) => item.value === assignment?.value);
  const rwkSelected = selectedType === "RWK" && enabledRwkAssignments.some((item) => item.value === assignment?.value);
  const mfgStatus = mfgSelected
    ? `${renderStationIntakeSopChoice(state, assignment, true)}`
    : enabledMfgAssignments.length
      ? `<span class="station-choice-status">${enabledMfgAssignments.length} estación${enabledMfgAssignments.length === 1 ? "" : "es"} habilitada${enabledMfgAssignments.length === 1 ? "" : "s"}</span>`
      : '<span class="station-choice-status station-choice-status--disabled">Sin SOP habilitadas por Administración</span>';
  const rwkAssignment = enabledRwkAssignments.find((item) => item.value === assignment?.value) ?? enabledRwkAssignments[0];
  const rwkStationControl = renderStationPills(enabledRwkAssignments, rwkSelected ? assignment : null, "Estaciones de retrabajo");
  const rwkStatus = rwkSelected
    ? renderStationIntakeSopChoice(state, assignment, true)
    : enabledRwkAssignments.length
      ? `<span class="station-choice-status">${getEnabledSopVersionsForStation(state, rwkAssignment.value).length} SOP habilitada${getEnabledSopVersionsForStation(state, rwkAssignment.value).length === 1 ? "" : "s"}</span>`
      : '<span class="station-choice-status station-choice-status--disabled">Sin SOP habilitadas por Administración</span>';

  return `<div class="station-intake-screen" aria-labelledby="station-intake-title">
    <div class="station-intake-user">${renderProfileMenu(getActiveLocalUser())}</div>
    <section class="station-intake-banner" aria-label="Registrar validación">
      <a class="station-intake-banner-brand" href="#top" aria-label="Ingrasys">
        <img src="./public/assets/ingrasys-logo-transparent.png" alt="Ingrasys" />
      </a>
      <div class="station-intake-banner-heading"><span class="station-intake-banner-icon" aria-hidden="true"><span class="material-symbols-rounded">fact_check</span></span><div><h1 id="station-intake-title">Registrar validación</h1></div></div>
    </section>
    ${canAccessSopAdmin() && getActiveLocalUser()?.role !== "admin" ? '<div class="station-intake-review-entry"><button class="button button--outlined" type="button" data-action="open-sop-admin-from-intake"><span class="material-symbols-rounded" aria-hidden="true">rate_review</span>Revisar o publicar SOP</button></div>' : ""}
    <nav class="operator-flow-progress" aria-label="Progreso del registro">
      <div class="operator-flow-step operator-flow-step--active" aria-current="step"><span>1</span><strong>Seleccionar estación</strong></div><i></i>
      <div class="operator-flow-step"><span>2</span><strong>Ver SOP asignada</strong></div><i></i>
      <div class="operator-flow-step"><span>3</span><strong>Confirmar y guardar</strong></div>
    </nav>
    <form id="station-intake-form" class="station-intake-form" novalidate>
      <section class="station-choice-section" aria-labelledby="station-choice-title">
        <div class="station-section-title"><span class="station-section-num" aria-hidden="true">1</span><div><h2 id="station-choice-title">¿En qué área de la línea de producción te encuentras?</h2><p>Toca una estación. Solo aparecen las que tienen SOP habilitada.</p></div></div>
        <fieldset class="station-choice-grid"><legend class="sr-only">Tipo de estación</legend>
          <label class="station-choice station-choice--mfg ${isMfg ? "station-choice--selected" : ""} ${enabledMfgAssignments.length ? "" : "station-choice--disabled"}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-MFG" value="MFG" ${isMfg ? "checked" : ""} ${enabledMfgAssignments.length ? "" : "disabled"} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--mfg"><span class="material-symbols-rounded" aria-hidden="true">precision_manufacturing</span>MFG</span><span class="station-choice-copy"><strong>Manufactura</strong><small>Estación de proceso en línea de producción.</small></span>
            ${renderStationPills(enabledMfgAssignments, mfgSelected ? assignment : null, "Estaciones de manufactura")}
            ${mfgSelected || !enabledMfgAssignments.length ? mfgStatus : stationHint}
          </label>
          <label class="station-choice station-choice--rwk ${selectedType === "RWK" ? "station-choice--selected" : ""} ${enabledRwkAssignments.length ? "" : "station-choice--disabled"}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-RWK" value="RWK" ${selectedType === "RWK" ? "checked" : ""} ${enabledRwkAssignments.length ? "" : "disabled"} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--rwk"><span class="material-symbols-rounded" aria-hidden="true">build_circle</span>RWK</span><span class="station-choice-copy"><strong>Retrabajo</strong><small>Desensamble, retrabajo o reparación del equipo.</small></span>
            ${rwkStationControl}
            ${rwkSelected || !enabledRwkAssignments.length ? rwkStatus : stationHint}
          </label>
        </fieldset>
        ${renderDisassemblyChoice(disassemblyChoice, state.disassemblyFilter ?? "")}
      </section>
      <section class="station-asset-section" aria-labelledby="station-asset-title">
        <div class="station-section-title"><span class="station-section-num" aria-hidden="true">2</span><div><h2 id="station-asset-title">Captura los datos del equipo</h2><p>Escanea en orden: PN del nodo, serie del nodo, PN de la tarjeta y serie de la tarjeta. El cursor pasa solo al siguiente campo.</p></div></div>
        <fieldset class="station-action-choice" aria-label="Qué vas a realizar">
          <legend>¿Qué vas a realizar?</legend>
          <label class="station-action-option ${(state.form.actionType ?? "validation") === "validation" ? "station-action-option--selected" : ""}"><input type="radio" name="actionType" value="validation" data-action-type ${(state.form.actionType ?? "validation") === "validation" ? "checked" : ""} /><span class="material-symbols-rounded" aria-hidden="true">fact_check</span><span><strong>Validar una tarjeta</strong><small>Se guarda como validación.</small></span></label>
          <label class="station-action-option ${state.form.actionType === "replacement" ? "station-action-option--selected" : ""}"><input type="radio" name="actionType" value="replacement" data-action-type ${state.form.actionType === "replacement" ? "checked" : ""} /><span class="material-symbols-rounded" aria-hidden="true">swap_horiz</span><span><strong>Reemplazar una tarjeta</strong><small>Se guarda como reemplazo.</small></span></label>
        </fieldset>
        <div class="station-asset-grid">
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">memory</span>PN del nodo <em aria-hidden="true">*</em></span><input data-form-field="nodePartNumber" data-scan-field data-focus-key="intake-node-part" value="${escapeHtml(state.form.nodePartNumber ?? "")}" placeholder="Escanea el PN del nodo" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-nodePartNumber" aria-invalid="${state.scanErrors?.nodePartNumber ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-nodePartNumber" data-scan-error="nodePartNumber" role="alert" ${state.scanErrors?.nodePartNumber ? "" : "hidden"}>${escapeHtml(state.scanErrors?.nodePartNumber ?? "")}</small></label>
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">qr_code_2</span>Serie del nodo <em aria-hidden="true">*</em></span><input data-form-field="serial" data-scan-field data-focus-key="intake-node-serial" value="${escapeHtml(state.form.serial ?? "")}" placeholder="Escanea la serie del nodo" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-serial" aria-invalid="${state.scanErrors?.serial ? "true" : "false"}" inputmode="numeric" pattern="\d{13}" /><small class="station-scan-error" id="scan-error-serial" data-scan-error="serial" role="alert" ${state.scanErrors?.serial ? "" : "hidden"}>${escapeHtml(state.scanErrors?.serial ?? "")}</small></label>
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">developer_board</span>PN de la tarjeta <em aria-hidden="true">*</em></span><input data-form-field="componentPartNumber" data-scan-field data-focus-key="intake-card-part" value="${escapeHtml(state.form.componentPartNumber ?? "")}" placeholder="Escanea el PN de la tarjeta" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-componentPartNumber" aria-invalid="${state.scanErrors?.componentPartNumber ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-componentPartNumber" data-scan-error="componentPartNumber" role="alert" ${state.scanErrors?.componentPartNumber ? "" : "hidden"}>${escapeHtml(state.scanErrors?.componentPartNumber ?? "")}</small></label>
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">pin</span>Serie de la tarjeta <em aria-hidden="true">*</em></span><input data-form-field="componentSerial" data-scan-field data-focus-key="intake-card-serial" value="${escapeHtml(state.form.componentSerial ?? "")}" placeholder="Escanea la serie de la tarjeta" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-componentSerial" aria-invalid="${state.scanErrors?.componentSerial ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-componentSerial" data-scan-error="componentSerial" role="alert" ${state.scanErrors?.componentSerial ? "" : "hidden"}>${escapeHtml(state.scanErrors?.componentSerial ?? "")}</small></label>
        </div>
      </section>
      <section class="station-work-summary" aria-label="Resumen de estación, operador y SOP">
        <div class="station-summary-item station-summary-location"><span class="material-symbols-rounded" aria-hidden="true">factory</span><span><small>Estación seleccionada</small><strong>${escapeHtml(assignment?.type ?? "—")} · ${escapeHtml(assignment?.label ?? "—")}</strong></span></div>
        <div class="station-summary-item station-summary-operator"><span class="material-symbols-rounded" aria-hidden="true">account_circle</span><span><small>Operador que realiza la acción</small><strong>${escapeHtml(user.name)}</strong><small>No. de empleado ${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
        <div class="station-summary-item station-summary-sop"><span class="material-symbols-rounded" aria-hidden="true">description</span><span><small>SOP seleccionada · ${escapeHtml(assignment?.type ?? "")} · ${escapeHtml(assignment?.label ?? "")}</small><strong>${escapeHtml(activeVersion?.document?.title ?? "No hay una SOP habilitada")}</strong><small>${activeVersion ? `${escapeHtml(activeVersion.document.id)} · Rev. ${escapeHtml(activeVersion.document.revision)}` : "Administración debe asignar y habilitar una SOP."}</small></span></div>
      </section>
      <footer class="station-intake-footer"><p class="station-intake-status ${canContinue ? "station-intake-status--ready" : ""}" id="station-intake-status" role="status" aria-live="polite"><span class="material-symbols-rounded" aria-hidden="true">${canContinue ? "check_circle" : "info"}</span><span>${escapeHtml(status)}</span></p>
        ${error}
        <button class="button button--primary station-intake-continue" type="submit" ${canContinue ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>Abrir la SOP</button>
      </footer>
    </form>
    <p class="station-intake-footnote">La selección y los identificadores se conservarán en el registro de esta validación.</p>
  </div>${renderToast()}`;
}

// Envía al historial de tarjetas del nodo lo que se acaba de guardar (validación o reemplazo).
async function recordCardEvent(record) {
  const isReplacement = record.actionType === "replacement";
  const cardType = String(record.repairType ?? "").replace(/^Reemplazo de /, "").trim() || "Sin tipo";
  const result = await sopApi("POST", "/api/card-events", {
    type: isReplacement ? "replacement" : "validation",
    nodeSerial: record.serial,
    nodePartNumber: record.nodePartNumber,
    nodeNumber: record.nodeNumber,
    stationAssignment: record.stationAssignment,
    cardType,
    cardPartNumber: record.componentPartNumber,
    cardSerial: record.componentSerial,
    result: isReplacement ? undefined : "ok",
    reason: isReplacement ? "direct" : undefined,
    removedSerial: record.removedComponentSerial || undefined,
    sheets: (record.validatedSheets ?? []).map((item) => String(item.sheet)),
  });
  return result.ok;
}
