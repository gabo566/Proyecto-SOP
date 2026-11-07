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

// Retrabajo: PN y serie de la tarjeta como siempre (una sola tarjeta por ahora; el tipo se identificará con la base de tarjetas).
function renderRwkCardFields(state) {
  const card = (state.form.cards ?? [])[0];
  if (!card) return "";
  const field = (name, icon, label, value, placeholder, key) => `<label class="station-scan-field" data-card-id="${escapeHtml(card.id)}"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span>${label} <em aria-hidden="true">*</em></span><input data-card-field="${name}" data-focus-key="${key}" value="${escapeHtml(value)}" placeholder="${placeholder}" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" /></label>`;
  return field("partNumber", "developer_board", "PN de la tarjeta", card.partNumber, "Escanea el PN de la tarjeta", "intake-card-part")
    + field("serial", "pin", "Serie de la tarjeta", card.serial, "Escanea la serie de la tarjeta", "intake-card-serial")
;
}

// Ventana flotante de hojas de la tarjeta que se está editando.
function renderCardSheetsOverlay(state) {
  const card = (state.form.cards ?? []).find((item) => item.id === state.cardSheetsOpen);
  if (!card) return "";
  const full = getStationDisassemblyChoice(state);
  const choice = { options: full.options, selected: full.options.filter((option) => card.sheets.includes(option.id)) };
  return renderDisassemblyChoice(choice, state.disassemblyFilter ?? "", true)
    .replace(/data-action="(toggle-disassembly-sheet|select-all-disassembly-sheets|clear-disassembly-sheets)"/g, `data-action="$1" data-card-id="${escapeHtml(card.id)}"`)
    .replace('Hojas del desensamble</h3>', `Hojas para ${escapeHtml(cardDisplayName(card))}</h3>`);
}

function renderDisassemblyChoice(choice, filter = "", panelOpen = false) {
  if (!choice.options.length) return "";
  const selectedIds = new Set(choice.selected.map((option) => option.id));
  const query = normalizeDisassemblySearch(filter).trim();
  const totalSteps = choice.selected.reduce((total, option) => total + option.steps, 0);
  if (!panelOpen) return "";
  return `<div class="station-disassembly-overlay" data-disassembly-overlay><fieldset class="station-disassembly station-disassembly--modal" id="station-disassembly-panel" aria-labelledby="station-disassembly-title"><legend id="station-disassembly-title" class="station-disassembly-legend-hidden">Hojas del desensamble</legend><h3 class="station-disassembly-title" aria-hidden="true">Hojas del desensamble</h3>
    <p>Elige una o varias. Solo verás en la SOP las hojas que selecciones.</p>
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
    }).join("")}</div>
    <div class="station-disassembly-done"><button type="button" class="button button--primary" data-action="close-disassembly-panel">Listo</button></div></fieldset></div>`;
}

// Menú lateral de la pantalla de registro: solo enlaces a funciones que ya existen en la app.
function renderIntakeSidebar() {
  const canSeeReports = ["supervisor", "admin"].includes(getActiveLocalUser()?.role);
  const item = (icon, label, attrs = "", active = false) => `<button type="button" class="vk-nav-item ${active ? "vk-nav-item--active" : ""}" ${attrs} ${active ? 'aria-current="page"' : ""}><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
  return `<aside class="vk-sidebar" aria-label="Navegación principal">
    <a class="vk-sidebar-brand" href="#top" aria-label="Ingrasys"><img src="./public/assets/ingrasys-logo-transparent.png" alt="Ingrasys" /></a>
    <nav class="vk-nav" aria-label="Secciones">
      ${item("check_circle", "Validaciones", "", true)}
      ${item("description", "SOPs", 'data-action="navigate" data-nav-id="overview"')}
      ${canSeeReports ? item("bar_chart", "Reportes", 'data-action="navigate" data-nav-id="reports"') : ""}
      ${item("person", "Mi perfil", 'data-action="open-profile"')}
      ${item("help", "Ayuda", 'data-action="open-help"')}
    </nav>
    <div class="vk-nav-foot">${item("logout", "Cerrar sesión", 'data-action="logout-local-user"')}</div>
  </aside>`;
}

function renderStationIntake(state) {
  const user = getAuthenticatedLocalUser();
  const currentAssignment = getWorkStationAssignment(state.form.stationAssignment);
  const assignment = currentAssignment ?? getWorkStationAssignment("MFG:TDR");
  const selectedType = assignment?.type ?? "MFG";
  state.form.actionType = "validation"; // por ahora no se elige validar/reemplazar
  if (selectedType === "RWK") ensureCardRow(state.form);
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

  return `<div class="station-intake-screen vk-app" aria-labelledby="station-intake-title">${renderIntakeSidebar()}<div class="vk-main">
    <section class="station-intake-banner" aria-label="Registrar validación">
      <div class="vk-head-brand">
        <a class="station-intake-banner-brand" href="#top" aria-label="Ingrasys">
          <img src="./public/assets/ingrasys-logo-transparent.png" alt="Ingrasys" />
        </a>
        <span class="vk-head-divider" aria-hidden="true"></span>
        <span class="vk-head-icon material-symbols-rounded" aria-hidden="true">fact_check</span>
        <h1 id="station-intake-title">Registrar validación</h1>
      </div>
      <div class="station-intake-user">${renderProfileMenu(getActiveLocalUser())}</div>
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
            <span class="vk-card-photo"><img src="./public/assets/intake/foto-manufactura.jpg" alt="" /></span>
            <span class="vk-card-body">
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--mfg vk-code-icon"><img src="./public/assets/intake/icono-manufactura.png" alt="" /><span class="sr-only">MFG</span></span><span class="station-choice-copy"><strong>Manufactura</strong><small>Estación de proceso en línea de producción.</small></span>
            ${renderStationPills(enabledMfgAssignments, mfgSelected ? assignment : null, "Estaciones de manufactura")}
            ${mfgSelected || !enabledMfgAssignments.length ? mfgStatus : stationHint}
            </span>
          </label>
          <label class="station-choice station-choice--rwk ${selectedType === "RWK" ? "station-choice--selected" : ""} ${enabledRwkAssignments.length ? "" : "station-choice--disabled"}">
            <input type="radio" name="stationAssignmentType" data-station-type data-focus-key="station-RWK" value="RWK" ${selectedType === "RWK" ? "checked" : ""} ${enabledRwkAssignments.length ? "" : "disabled"} />
            <span class="vk-card-photo"><img src="./public/assets/intake/foto-retrabajo.jpg" alt="" /></span>
            <span class="vk-card-body">
            <span class="station-choice-radio" aria-hidden="true"></span><span class="station-code station-code--rwk vk-code-icon"><img src="./public/assets/intake/icono-retrabajo.png" alt="" /><span class="sr-only">RWK</span></span><span class="station-choice-copy"><strong>Retrabajo</strong><small>Desensamble, retrabajo o reparación del equipo.</small></span>
            ${rwkStationControl}
            ${rwkSelected || !enabledRwkAssignments.length ? rwkStatus : stationHint}
            </span>
          </label>
        </fieldset>
        ${renderCardSheetsOverlay(state)}
      </section>
      <section class="station-asset-section" aria-labelledby="station-asset-title">
        <div class="station-section-title"><span class="station-section-num" aria-hidden="true">2</span><div><h2 id="station-asset-title">Captura los datos del equipo</h2><p>Escanea en orden: PN del nodo, serie del nodo, PN de la tarjeta y serie de la tarjeta. El cursor pasa solo al siguiente campo.</p></div></div>
        <div class="station-asset-grid">
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">memory</span>PN del nodo <em aria-hidden="true">*</em></span><input data-form-field="nodePartNumber" data-scan-field data-focus-key="intake-node-part" value="${escapeHtml(state.form.nodePartNumber ?? "")}" placeholder="Escanea el PN del nodo" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-nodePartNumber" aria-invalid="${state.scanErrors?.nodePartNumber ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-nodePartNumber" data-scan-error="nodePartNumber" role="alert" ${state.scanErrors?.nodePartNumber ? "" : "hidden"}>${escapeHtml(state.scanErrors?.nodePartNumber ?? "")}</small></label>
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">qr_code_2</span>Serie del nodo <em aria-hidden="true">*</em></span><input data-form-field="serial" data-scan-field data-focus-key="intake-node-serial" value="${escapeHtml(state.form.serial ?? "")}" placeholder="Escanea la serie del nodo" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-serial" aria-invalid="${state.scanErrors?.serial ? "true" : "false"}" inputmode="numeric" pattern="\d{13}" /><small class="station-scan-error" id="scan-error-serial" data-scan-error="serial" role="alert" ${state.scanErrors?.serial ? "" : "hidden"}>${escapeHtml(state.scanErrors?.serial ?? "")}</small></label>
          ${selectedType === "RWK" ? renderRwkCardFields(state) : `
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">developer_board</span>PN de la tarjeta <em aria-hidden="true">*</em></span><input data-form-field="componentPartNumber" data-scan-field data-focus-key="intake-card-part" value="${escapeHtml(state.form.componentPartNumber ?? "")}" placeholder="Escanea el PN de la tarjeta" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-componentPartNumber" aria-invalid="${state.scanErrors?.componentPartNumber ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-componentPartNumber" data-scan-error="componentPartNumber" role="alert" ${state.scanErrors?.componentPartNumber ? "" : "hidden"}>${escapeHtml(state.scanErrors?.componentPartNumber ?? "")}</small></label>
          <label class="station-scan-field"><span class="station-field-label"><span class="material-symbols-rounded" aria-hidden="true">pin</span>Serie de la tarjeta <em aria-hidden="true">*</em></span><input data-form-field="componentSerial" data-scan-field data-focus-key="intake-card-serial" value="${escapeHtml(state.form.componentSerial ?? "")}" placeholder="Escanea la serie de la tarjeta" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next" aria-describedby="scan-error-componentSerial" aria-invalid="${state.scanErrors?.componentSerial ? "true" : "false"}"  /><small class="station-scan-error" id="scan-error-componentSerial" data-scan-error="componentSerial" role="alert" ${state.scanErrors?.componentSerial ? "" : "hidden"}>${escapeHtml(state.scanErrors?.componentSerial ?? "")}</small></label>
          `}
        </div>
      </section>
      <section class="station-work-summary" aria-label="Resumen de estación, operador y SOP">
        <div class="station-summary-item station-summary-location"><span class="material-symbols-rounded" aria-hidden="true">factory</span><span><small>Estación seleccionada</small><strong>${escapeHtml(assignment?.type ?? "—")} · ${escapeHtml(assignment?.label ?? "—")}</strong></span></div>
        <div class="station-summary-item station-summary-operator"><span class="material-symbols-rounded" aria-hidden="true">account_circle</span><span><small>Operador que realiza la acción</small><strong>${escapeHtml(user.name)}</strong><small>No. de empleado ${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</small></span></div>
        <div class="station-summary-item station-summary-sop"><span class="material-symbols-rounded" aria-hidden="true">description</span><span><small>SOP seleccionada · ${escapeHtml(assignment?.type ?? "")} · ${escapeHtml(assignment?.label ?? "")}</small><strong>${escapeHtml(activeVersion?.document?.title ?? "No hay una SOP habilitada")}</strong><small>${activeVersion ? `${escapeHtml(activeVersion.document.id)} · Rev. ${escapeHtml(activeVersion.document.revision)}` : "Administración debe asignar y habilitar una SOP."}</small></span></div>
      </section>
      <footer class="station-intake-footer"><button type="button" class="vk-btn vk-btn--clear" data-action="clear-station-intake"><span class="material-symbols-rounded" aria-hidden="true">restart_alt</span>Limpiar</button><p class="station-intake-status ${canContinue ? "station-intake-status--ready" : ""}" id="station-intake-status" role="status" aria-live="polite"><span class="material-symbols-rounded" aria-hidden="true">${canContinue ? "check_circle" : "info"}</span><span>${escapeHtml(status)}</span></p>
        ${error}
        <button class="button button--primary station-intake-continue" type="submit" ${canContinue ? "" : "disabled"}><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>Continuar</button>
      </footer>
    </form>
    <p class="station-intake-footnote">La selección y los identificadores se conservarán en el registro de esta validación.</p>
  </div></div>${renderToast()}`;
}


// La ventana de hojas de una tarjeta se cierra al tocar fuera de ella o con Escape.
document.addEventListener("click", (event) => {
  if (!state.cardSheetsOpen || event.target.closest(".station-disassembly--modal")) return;
  if (event.target.closest('[data-action="add-card-type"], [data-action="open-card-sheets"], [data-action="pick-station"]')) return;
  state.cardSheetsOpen = null;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.cardSheetsOpen) return;
  state.cardSheetsOpen = null;
  render();
});

// Envía al historial del nodo las tarjetas de la sesión (una por tarjeta, con el mismo grupo).
// Si alguna validación encontró daño, deja lista la sesión de reemplazo con esas tarjetas.
async function saveCardEvents(record) {
  const cards = record.cards ?? [];
  if (!cards.length) return;
  const node = { serial: record.serial, nodePartNumber: record.nodePartNumber, nodeNumber: record.nodeNumber, stationAssignment: record.stationAssignment };
  const result = await sopApi("POST", "/api/card-events/batch", { groupId: record.id, events: buildCardEvents(cards, record.actionType, node) });
  if (!result.ok) {
    showToast("El registro se guardó, pero las tarjetas no llegaron al historial del nodo. Avisa a un administrador.", "warning");
    return;
  }
  const saved = result.data.events;
  const damaged = record.actionType === "replacement" ? [] : cards.map((card, index) => ({ card, event: saved[index] })).filter(({ card }) => card.result === "damage");
  if (!damaged.length) return;
  const replacementCards = damaged.map(({ card, event }) => ({ ...newCard(card.type), partNumber: card.partNumber, removedSerial: card.serial, sheets: [...card.sheets], validationId: event.id }));
  Object.assign(state.form, {
    stationAssignment: record.stationAssignment,
    sopVersionId: record.sopVersionId,
    nodePartNumber: record.nodePartNumber,
    serial: record.serial,
    nodeNumber: record.nodeNumber,
    actionType: "replacement",
    cards: replacementCards,
    ...legacyCardFields(replacementCards, "replacement"),
    disassemblySheets: unionSheets(replacementCards),
  });
  render();
  showToast(`Hubo daño en ${damaged.length} ${damaged.length === 1 ? "tarjeta" : "tarjetas"}. Captura la tarjeta nueva de cada una para registrar el reemplazo.`, "warning");
}
