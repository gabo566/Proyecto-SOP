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

function renderStationIntake(state) {
  const user = getAuthenticatedLocalUser();
  const currentAssignment = getWorkStationAssignment(state.form.stationAssignment);
  const assignment = currentAssignment ?? getWorkStationAssignment("MFG:TDR");
  const selectedType = assignment?.type ?? "MFG";
  const activeVersion = findSopVersionForStation(state, assignment?.value, state.form.sopVersionId);
  const enabledMfgAssignments = getEnabledWorkStationAssignments(state, "MFG");
  const enabledRwkAssignments = getEnabledWorkStationAssignments(state, "RWK");
  const status = getStationIntakeStatus(state);
  const canContinue = isStationIntakeComplete(state.form) && Boolean(activeVersion);
  const assignmentOptions = enabledMfgAssignments
    .map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === assignment?.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
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
  const rwkStationControl = rwkSelected
    ? enabledRwkAssignments.length > 1
      ? `<span class="station-choice-selector"><span>Estación:</span><select aria-label="Estación de retrabajo" data-station-code data-focus-key="station-code-select">${enabledRwkAssignments.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === assignment?.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></span>`
      : `<span class="station-choice-selector"><span>Estación:</span><strong>${escapeHtml(assignment?.label ?? rwkAssignment?.label ?? "RWK")}</strong></span>`
    : "";
  const rwkStatus = rwkSelected
    ? renderStationIntakeSopChoice(state, assignment, true)
    : enabledRwkAssignments.length
      ? `<span class="station-choice-status">${getEnabledSopVersionsForStation(state, rwkAssignment.value).length} SOP habilitada${getEnabledSopVersionsForStation(state, rwkAssignment.value).length === 1 ? "" : "s"}</span>`
      : '<span class="station-choice-status station-choice-status--disabled">Sin SOP habilitadas por Administración</span>';

  return `<div class="station-intake-screen" aria-labelledby="station-intake-title">
    <header class="station-intake-topbar">
      <a class="station-intake-brand" href="#top" aria-label="Ingrasys">
        <img src="./public/assets/ingrasys-logo.png" alt="Ingrasys" />
      </a>
      <div class="station-intake-user"><span class="station-intake-avatar" aria-hidden="true">${escapeHtml(user.name.slice(0,2).toLocaleUpperCase("es-MX"))}</span><span><strong>Bienvenido, ${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || "Técnico de FA")} · ${escapeHtml(LOCAL_USER_ROLES[user.role])}</small></span></div>
    </header>
    <section class="station-intake-banner"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span><div><h1 id="station-intake-title">Registrar validación</h1><p>Seguimiento de SOPs Nvidia Racks</p></div></section>
    <nav class="operator-flow-progress" aria-label="Progreso del registro">
      <div class="operator-flow-step operator-flow-step--active" aria-current="step"><span>1</span><strong>Seleccionar estación</strong></div><i></i>
      <div class="operator-flow-step"><span>2</span><strong>Ver SOP asignada</strong></div><i></i>
      <div class="operator-flow-step"><span>3</span><strong>Confirmar y guardar</strong></div>
    </nav>
    <form id="station-intake-form" class="station-intake-form" novalidate>
      <section class="station-choice-section" aria-labelledby="station-choice-title">
        <div class="station-section-title"><h2 id="station-choice-title">Selecciona la estación</h2><p>Elige el tipo de estación donde se realizará la validación. Solo aparecen estaciones con SOP habilitadas.</p></div>
        <fieldset class="station-choice-grid"><legend class="sr-only">Tipo de estación</legend>
          <label class="station-choice station-choice--mfg ${isMfg ? "station-choice--selected" : ""} ${enabledMfgAssignments.length ? "" : "station-choice--disabled"}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-MFG" value="MFG" ${isMfg ? "checked" : ""} ${enabledMfgAssignments.length ? "" : "disabled"} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--mfg">MFG</span><span class="station-choice-copy"><strong>Manufactura</strong><small>Estación de proceso en línea de producción.</small></span>
            ${mfgSelected ? `<span class="station-choice-selector"><span>Estación:</span><select aria-label="Estación de manufactura" data-station-code data-focus-key="station-code-select">${assignmentOptions}</select></span>` : ""}
            ${mfgSelected ? mfgStatus : !enabledMfgAssignments.length ? mfgStatus : ""}
          </label>
          <label class="station-choice station-choice--rwk ${selectedType === "RWK" ? "station-choice--selected" : ""} ${enabledRwkAssignments.length ? "" : "station-choice--disabled"}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-RWK" value="RWK" ${selectedType === "RWK" ? "checked" : ""} ${enabledRwkAssignments.length ? "" : "disabled"} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--rwk">RWK</span><span class="station-choice-copy"><strong>Retrabajo</strong><small>Desensamble, retrabajo o reparación del equipo.</small></span>
            ${rwkStationControl}
            ${rwkSelected || !enabledRwkAssignments.length ? rwkStatus : ""}
          </label>
        </fieldset>
      </section>
      <section class="station-asset-section" aria-labelledby="station-asset-title">
        <div class="station-section-title"><h2 id="station-asset-title">Datos obligatorios del nodo y la tarjeta</h2><p>Ingresa los números de parte (PN) y series tal como se visualizan en el equipo.</p></div>
        <div class="station-asset-grid">
          <label>PN del nodo <em aria-hidden="true">*</em><input data-form-field="nodePartNumber" data-focus-key="intake-node-part" value="${escapeHtml(state.form.nodePartNumber ?? "")}" placeholder="Ej. 900-9X123-00" required maxlength="100" autocomplete="off" /></label>
          <label>Serie del nodo <em aria-hidden="true">*</em><input data-form-field="serial" data-focus-key="intake-node-serial" value="${escapeHtml(state.form.serial ?? "")}" placeholder="Ej. SN12345678" required maxlength="100" autocomplete="off" /></label>
          <label>PN de la tarjeta <em aria-hidden="true">*</em><input data-form-field="componentPartNumber" data-focus-key="intake-card-part" value="${escapeHtml(state.form.componentPartNumber ?? "")}" placeholder="Ej. 699-ABC123-00" required maxlength="100" autocomplete="off" /></label>
          <label>Serie de la tarjeta <em aria-hidden="true">*</em><input data-form-field="componentSerial" data-focus-key="intake-card-serial" value="${escapeHtml(state.form.componentSerial ?? "")}" placeholder="Ej. TG12345678" required maxlength="100" autocomplete="off" /></label>
        </div>
      </section>
      <section class="station-work-summary" aria-label="Resumen de estación, operador y SOP">
        <div class="station-summary-item station-summary-location"><span class="material-symbols-rounded" aria-hidden="true">factory</span><span><small>Estación seleccionada</small><strong>${escapeHtml(assignment?.type ?? "—")} · ${escapeHtml(assignment?.label ?? "—")}</strong></span></div>
        <div class="station-summary-item station-summary-operator"><span class="material-symbols-rounded" aria-hidden="true">account_circle</span><span><small>Operador</small><strong>${escapeHtml(user.name)}</strong><small>Usuario registrado · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
        <div class="station-summary-item station-summary-sop"><span class="material-symbols-rounded" aria-hidden="true">description</span><span><small>SOP seleccionada · ${escapeHtml(assignment?.type ?? "")} · ${escapeHtml(assignment?.label ?? "")}</small><strong>${escapeHtml(activeVersion?.document?.title ?? "No hay una SOP habilitada")}</strong><small>${activeVersion ? `${escapeHtml(activeVersion.document.id)} · Rev. ${escapeHtml(activeVersion.document.revision)}` : "Administración debe asignar y habilitar una SOP."}</small></span></div>
      </section>
      <footer class="station-intake-footer"><div class="station-intake-status-row"><p class="station-intake-status ${activeVersion && isStationIntakeComplete(state.form) ? "station-intake-status--ready" : ""}" id="station-intake-status" role="status" aria-live="polite">${escapeHtml(status)}</p>${canManageSopVersions() ? '<button class="text-button station-admin-shortcut" type="button" data-action="open-sop-admin-from-intake"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Administrar SOPs</button>' : ""}</div>
        ${error}
        <button class="button button--primary station-intake-continue" type="submit" ${canContinue ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>Continuar a la SOP</button>
      </footer>
    </form>
    <p class="station-intake-footnote">La selección y los identificadores se conservarán en el registro de esta validación.</p>
  </div>${renderToast()}`;
}
