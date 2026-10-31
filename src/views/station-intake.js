function renderStationIntakeIcon(name, className = "") {
  const paths = {
    factory: '<path d="M3 21V10l6 5V9l6 6V5h6v16H3Z"/><path d="M17 9h2M17 12h2M17 15h2M7 18h2M12 18h2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    rework: '<path d="M21.2 7.4a6.1 6.1 0 0 1-7.9 7.1l-6.7 6.7a2.1 2.1 0 0 1-3-3l6.7-6.7a6.1 6.1 0 0 1 7.1-7.9l-3.2 3.2.5 3.2 3.2.5 3.3-3.1Z"/><circle cx="6.1" cy="18" r=".8" fill="#fff"/>',
    check: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m7.5 12.2 3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    pending: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    location: '<path d="M19 10.2c0 5.1-7 11-7 11s-7-5.9-7-11a7 7 0 1 1 14 0Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/>',
    document: '<path d="M6 3h8l5 5v13H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5M9 13l2.2 2.2L16 10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return `<svg class="station-intake-svg ${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] ?? paths.info}</svg>`;
}

function renderStationIntake(state) {
  const user = getAuthenticatedLocalUser();
  const assignment = getWorkStationAssignment(state.form.stationAssignment) ?? getWorkStationAssignment("MFG:TDR");
  const activeVersion = findSopVersionForStation(state, assignment.value);
  const canContinue = isStationIntakeComplete(state.form) && Boolean(activeVersion);
  const assignmentOptions = WORK_STATION_ASSIGNMENTS
    .filter((item) => item.type === "MFG")
    .map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === assignment.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
  const error = state.formError ? `<p class="form-error station-intake-error" id="station-intake-error" role="alert">${escapeHtml(state.formError)}</p>` : "";
  const isMfg = assignment.type === "MFG";
  const sopTitle = activeVersion?.document?.title ?? "No hay una SOP asignada";
  const sopRevision = activeVersion?.document?.revision ?? "Pendiente de configuración";
  const sopId = activeVersion?.document?.id ?? "";

  return `<main class="station-intake-screen" aria-labelledby="station-intake-title">
    <header class="station-intake-topbar">
      <a class="station-intake-brand" href="#top" aria-label="Ingrasys"><img src="./public/assets/ingrasys-logo.png" alt="Ingrasys" /></a>
      <div class="station-intake-user"><span class="station-intake-avatar" aria-hidden="true">${escapeHtml(user.name.slice(0,2).toLocaleUpperCase("es-MX"))}</span><span><strong>Bienvenido, ${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || "Técnico de FA")} · ${escapeHtml(LOCAL_USER_ROLES[user.role])}</small></span></div>
    </header>
    <section class="station-intake-hero">
      <span class="station-intake-eyebrow">${renderStationIntakeIcon("factory")} REGISTRO DE PROCEDIMIENTO</span>
      <h1 id="station-intake-title">Selecciona tu estación de trabajo</h1>
      <p>El sistema abrirá automáticamente la SOP vigente que Administración asignó a la estación.</p>
    </section>
    ${renderOperatorFlowProgress(1)}
    <form id="station-intake-form" class="station-intake-form" novalidate>
      <section class="station-choice-section station-intake-card" aria-labelledby="station-choice-title">
        <div class="station-section-title station-section-title--center"><span class="station-section-kicker">PASO 1 · ESTACIÓN</span><h2 id="station-choice-title">¿Dónde realizarás el procedimiento?</h2><p>Selecciona MFG o RWK. La estación determina qué instrucciones y revisión aparecerán.</p></div>
        <fieldset class="station-choice-grid"><legend class="sr-only">Tipo de estación</legend>
          <label class="station-choice station-choice--mfg ${isMfg ? "station-choice--selected" : ""}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-MFG" value="MFG" ${isMfg ? "checked" : ""} />
            <span class="station-choice-icon station-choice-icon--mfg">${renderStationIntakeIcon("factory")}</span>
            <span class="station-choice-copy"><span class="station-choice-heading"><strong>MFG</strong><span class="station-choice-badge">Manufactura</span></span><small>Proceso realizado en una estación de manufactura.</small><span class="station-choice-assignment ${findSopVersionForStation(state, "MFG:TDR") ? "is-assigned" : "is-unassigned"}">${renderStationIntakeIcon(findSopVersionForStation(state, "MFG:TDR") ? "check" : "pending")}${findSopVersionForStation(state, "MFG:TDR") ? "SOP lista para esta estación" : "SOP pendiente de asignación"}</span></span>
          </label>
          <label class="station-choice station-choice--rwk ${!isMfg ? "station-choice--selected" : ""}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-RWK" value="RWK" ${!isMfg ? "checked" : ""} />
            <span class="station-choice-icon station-choice-icon--rwk">${renderStationIntakeIcon("rework")}</span>
            <span class="station-choice-copy"><span class="station-choice-heading"><strong>RWK</strong><span class="station-choice-badge">Retrabajo</span></span><small>Desensamble, retrabajo o reparación del equipo.</small><span class="station-choice-assignment ${findSopVersionForStation(state, "RWK:RWK") ? "is-assigned" : "is-unassigned"}">${renderStationIntakeIcon(findSopVersionForStation(state, "RWK:RWK") ? "check" : "pending")}${findSopVersionForStation(state, "RWK:RWK") ? "SOP lista para esta estación" : "SOP pendiente de asignación"}</span></span>
          </label>
        </fieldset>
        ${isMfg ? `<label class="station-choice-selector station-choice-selector--active">${renderStationIntakeIcon("location")}<span>Estación MFG</span><select aria-label="Estación de manufactura" data-station-code>${assignmentOptions}</select></label>` : `<div class="station-choice-selector station-choice-selector--fixed">${renderStationIntakeIcon("location")}<span>Estación seleccionada</span><strong>RWK · Retrabajo</strong></div>`}
      </section>

      <section class="station-asset-section station-intake-card" aria-labelledby="station-asset-title">
        <div class="station-section-title"><span class="station-section-kicker">PASO 2 · IDENTIFICACIÓN</span><h2 id="station-asset-title">Identifica el nodo y la tarjeta</h2><p>Captura los números de parte (PN) y de serie tal como aparecen en el equipo.</p></div>
        <div class="station-asset-grid">
          <label>PN del nodo <em aria-hidden="true">*</em><input data-form-field="nodePartNumber" data-focus-key="intake-node-part" value="${escapeHtml(state.form.nodePartNumber ?? "")}" placeholder="Ej. 900-9X123-00" required maxlength="100" autocomplete="off" /></label>
          <label>Serie del nodo <em aria-hidden="true">*</em><input data-form-field="serial" data-focus-key="intake-node-serial" value="${escapeHtml(state.form.serial ?? "")}" placeholder="Ej. SN12345678" required maxlength="100" autocomplete="off" /></label>
          <label>PN de la tarjeta <em aria-hidden="true">*</em><input data-form-field="componentPartNumber" data-focus-key="intake-card-part" value="${escapeHtml(state.form.componentPartNumber ?? "")}" placeholder="Ej. 699-ABC123-00" required maxlength="100" autocomplete="off" /></label>
          <label>Serie de la tarjeta <em aria-hidden="true">*</em><input data-form-field="componentSerial" data-focus-key="intake-card-serial" value="${escapeHtml(state.form.componentSerial ?? "")}" placeholder="Ej. TG12345678" required maxlength="100" autocomplete="off" /></label>
        </div>
      </section>

      <section class="station-assigned-sop ${activeVersion ? "station-assigned-sop--ready" : "station-assigned-sop--missing"}" aria-label="SOP asignada a la estación" aria-live="polite">
        <span class="station-assigned-sop-icon">${renderStationIntakeIcon(activeVersion ? "document" : "pending")}</span>
        <span class="station-assigned-sop-copy"><small>SOP ASIGNADA AUTOMÁTICAMENTE · ${escapeHtml(assignment.type)} · ${escapeHtml(assignment.label)}</small><strong class="station-assigned-sop-title">${escapeHtml(sopTitle)}</strong><span class="station-assigned-sop-revision">${activeVersion ? `${escapeHtml(sopId)} · Rev. ${escapeHtml(sopRevision)}` : "Administración debe cargar y asignar una SOP para poder continuar."}</span></span>
        <span class="station-assigned-sop-state">${activeVersion ? "Lista para abrir" : "Sin SOP"}</span>
      </section>
      <p class="station-assignment-note">${renderStationIntakeIcon("info")}Al continuar se abrirá esta SOP directamente. El operador no necesita cargar ni elegir archivos.</p>

      <footer class="station-intake-footer"><div class="station-intake-status-row"><p class="station-intake-status ${canContinue ? "station-intake-status--ready" : ""}" id="station-intake-status" role="status" aria-live="polite">${escapeHtml(getStationIntakeStatus(state))}</p>${canManageSopVersions() ? `<button class="text-button station-admin-shortcut" type="button" data-action="open-sop-admin-from-intake">${renderStationIntakeIcon("document")}Administrar SOPs</button>` : ""}</div>
        ${error}
        <button class="button button--primary station-intake-continue" type="submit" ${canContinue ? "" : "disabled"}><span>Continuar a la SOP</span>${renderStationIntakeIcon("arrow")}</button>
      </footer>
    </form>
    <p class="station-intake-footnote">Operador: ${escapeHtml(user.name)} · ${escapeHtml(user.employeeNumber)} · Los datos de esta validación se guardarán localmente.</p>
  </main>${renderToast()}`;
}
