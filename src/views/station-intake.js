function renderStationIntake(state) {
  const user = getAuthenticatedLocalUser();
  const assignment = getWorkStationAssignment(state.form.stationAssignment) ?? getWorkStationAssignment("MFG:TDR");
  const activeVersion = findSopVersionForStation(state, assignment.value);
  const rwkVersion = findSopVersionForStation(state, "RWK:RWK");
  const status = getStationIntakeStatus(state);
  const canContinue = isStationIntakeComplete(state.form) && Boolean(activeVersion);
  const assignmentOptions = WORK_STATION_ASSIGNMENTS
    .filter((item) => item.type === "MFG")
    .map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === assignment.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
  const error = state.formError ? `<p class="form-error station-intake-error" id="station-intake-error" role="alert">${escapeHtml(state.formError)}</p>` : "";
  const sopTitle = activeVersion?.document?.title ?? "SOP TDR";
  const sopRevision = activeVersion?.document?.revision ?? "Pendiente de cargar";
  const isMfg = assignment.type === "MFG";

  return `<main class="station-intake-screen" aria-labelledby="station-intake-title">
    <header class="station-intake-topbar">
      <a class="station-intake-brand" href="#top" aria-label="Ingrasys">
        <img src="./public/assets/ingrasys-logo.png" alt="Ingrasys" />
      </a>
      <div class="station-intake-user"><span class="station-intake-avatar" aria-hidden="true">${escapeHtml(user.name.slice(0,2).toLocaleUpperCase("es-MX"))}</span><span><strong>Bienvenido, ${escapeHtml(user.name)}</strong><small>Usuario registrado · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
    </header>
    <section class="station-intake-banner"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span><div><h1 id="station-intake-title">Registrar validación</h1><p>Seguimiento de SOPs Nvidia Racks</p></div></section>
    <nav class="operator-flow-progress" aria-label="Progreso del registro">
      <div class="operator-flow-step operator-flow-step--active" aria-current="step"><span>1</span><strong>Registrar validación</strong></div><i></i>
      <div class="operator-flow-step"><span>2</span><strong>Cargar SOP</strong></div><i></i>
      <div class="operator-flow-step"><span>3</span><strong>Confirmar y guardar</strong></div>
    </nav>
    <form id="station-intake-form" class="station-intake-form" novalidate>
      <section class="station-choice-section" aria-labelledby="station-choice-title">
        <div class="station-section-title"><h2 id="station-choice-title">Selecciona la estación</h2><p>Elige el tipo de estación donde se realizará la validación.</p></div>
        <fieldset class="station-choice-grid"><legend class="sr-only">Tipo de estación</legend>
          <label class="station-choice station-choice--mfg ${isMfg ? "station-choice--selected" : ""}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-MFG" value="MFG" ${isMfg ? "checked" : ""} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--mfg">MFG</span><span class="station-choice-copy"><strong>Manufactura</strong><small>Estación de proceso en línea de producción.</small></span>
            ${isMfg ? `<span class="station-choice-selector"><span>Estación:</span><select aria-label="Estación de manufactura" data-station-code>${assignmentOptions}</select></span>` : ""}
          </label>
          <label class="station-choice station-choice--rwk ${!isMfg ? "station-choice--selected" : ""}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-RWK" value="RWK" ${!isMfg ? "checked" : ""} />
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--rwk">RWK</span><span class="station-choice-copy"><strong>Retrabajo</strong><small>Asociada a ${escapeHtml(rwkVersion?.document?.title ?? "SOP de desensamble")} · Rev. ${escapeHtml(rwkVersion?.document?.revision ?? "pendiente")}.</small></span>
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
        <div class="station-summary-item station-summary-location"><span class="material-symbols-rounded" aria-hidden="true">factory</span><span><small>Estación seleccionada</small><strong>${escapeHtml(assignment.type)} · ${escapeHtml(assignment.label)}</strong></span></div>
        <div class="station-summary-item station-summary-operator"><span class="material-symbols-rounded" aria-hidden="true">account_circle</span><span><small>Operador</small><strong>${escapeHtml(user.name)}</strong><small>Usuario registrado · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
        <div class="station-summary-item station-summary-sop"><span class="material-symbols-rounded" aria-hidden="true">description</span><span><small>SOP de la estación</small><strong>${escapeHtml(sopTitle)}</strong><small>${activeVersion ? `Rev. ${escapeHtml(sopRevision)}` : "Pendiente de cargar"}</small></span></div>
      </section>
      <footer class="station-intake-footer"><div class="station-intake-status-row"><p class="station-intake-status ${activeVersion && isStationIntakeComplete(state.form) ? "station-intake-status--ready" : ""}" id="station-intake-status" role="status" aria-live="polite">${escapeHtml(status)}</p>${!activeVersion && canManageSopVersions() ? '<button class="text-button station-admin-shortcut" type="button" data-action="open-sop-admin-from-intake"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Administrar SOP</button>' : ""}</div>
        ${error}
        <button class="button button--primary station-intake-continue" type="submit" ${canContinue ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>Continuar a la SOP</button>
      </footer>
    </form>
    <p class="station-intake-footnote">La selección y los identificadores se conservarán en el registro de esta validación.</p>
  </main>${renderToast()}`;
}
