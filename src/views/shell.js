const NAV_ITEMS = [
  { id: "overview", label: "Seguimiento SOP", icon: "space_dashboard", target: "top" },
  { id: "production", label: "Producción", icon: "precision_manufacturing", target: "production-dashboard-title" },
  { id: "traceability", label: "Trazabilidad", icon: "inventory_2", target: "traceability-title" },
  { id: "reports", label: "Reportes", icon: "bar_chart", target: "reports-title" },
  { id: "users", label: "Crear usuarios", icon: "person_add", target: "users-panel" },
  { id: "sop-admin", label: "Modificar SOP", icon: "edit_document", target: "sop-version-title" },
];

function renderSidebar(state) {
  const user = getActiveLocalUser();
  const role = user.role;
  const visibleItems = NAV_ITEMS.filter((item) => item.id !== "users" || role === "admin")
    .filter((item) => item.id !== "reports" || ["supervisor", "admin"].includes(role))
    .filter((item) => item.id !== "sop-admin" || canManageSopVersions(user));
  const navItems = visibleItems.map((item) => `
    <button class="nav-item ${state.activeSection === item.id ? "nav-item--active" : ""}"
      type="button" data-action="navigate" data-nav-id="${item.id}" data-focus-key="nav-${item.id}"
      aria-current="${state.activeSection === item.id ? "page" : "false"}">
      <span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span><span>${item.label}</span>
    </button>`).join("");

  return `${state.navOpen ? '<button class="nav-scrim" type="button" aria-label="Cerrar menú" data-action="close-menu"></button>' : ""}
    <aside class="sidebar ${state.navOpen ? "sidebar--open" : ""}" aria-label="Navegación principal">
      <a class="brand" href="#top" data-action="brand-home" aria-label="Ingrasys, inicio">
        <img class="brand-full" src="./public/assets/ingrasys-logo-dark.png" alt="Ingrasys" />
        <img class="brand-mark" src="./public/assets/ingrasys-emblem.png" alt="" aria-hidden="true" />
      </a>
      <nav class="side-nav">${navItems}</nav>
    </aside>`;
}

function renderTopbar(state = {}) {
  const user = getActiveLocalUser();
  return `<header class="topbar" id="top">
    <button class="icon-button menu-toggle" type="button" data-action="open-menu" data-focus-key="menu-open" aria-label="Abrir menú">
      <span class="material-symbols-rounded" aria-hidden="true">menu</span>
    </button>
    <div class="topbar-title">
      <span class="topbar-title-icon"><span class="material-symbols-rounded" aria-hidden="true">description</span></span>
      <div class="topbar-title-copy"><span class="topbar-kicker">SOP actual · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</span><h1>${escapeHtml(SOP_DOCUMENT.title)}</h1><p>Control de ejecución, validación y trazabilidad</p></div>
    </div>
    <div class="topbar-profile">
      <details class="profile-menu">
        <summary class="profile-chip" aria-label="Opciones de ${escapeHtml(user.name)}">
          <span class="profile-avatar">${escapeHtml(user.name.slice(0, 2).toLocaleUpperCase("es-MX"))}</span>
        <span class="profile-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || "Técnico de FA")}</small></span>
          <span class="material-symbols-rounded profile-menu-chevron" aria-hidden="true">expand_more</span>
        </summary>
        <div class="profile-dropdown"><span class="profile-dropdown-role">${escapeHtml(LOCAL_USER_ROLES[user.role])}</span><button class="profile-logout" type="button" data-action="logout-local-user"><span class="material-symbols-rounded" aria-hidden="true">logout</span>Cerrar sesión</button></div>
      </details>
    </div>
    <div class="topbar-meta">
      <div class="date-chip"><span class="material-symbols-rounded" aria-hidden="true">calendar_today</span><span>${escapeHtml(TODAY_DATE_LABEL)}</span></div>
      <div class="shift-chip" aria-label="Turno actual"><span class="material-symbols-rounded" aria-hidden="true">groups</span><span id="current-shift-label">${getCurrentShiftLabel()}</span></div>
      <button class="icon-button help-button" type="button" data-action="open-help" data-focus-key="help-open" aria-label="Ayuda sobre almacenamiento local" title="Ayuda"><span class="material-symbols-rounded" aria-hidden="true">help</span></button>
    </div>
  </header>`;
}

function getCurrentShiftLabel(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 7 * 60 && minutes < 15 * 60) return "Turno 1";
  if (minutes >= 15 * 60 && minutes < 22 * 60 + 30) return "Turno 2";
  if (minutes >= 22 * 60 + 30 || minutes <= 5 * 60 + 30) return "Turno 3";
  return "Sin turno";
}

function updateCurrentShiftLabel() {
  const label = document.querySelector("#current-shift-label");
  if (label) label.textContent = getCurrentShiftLabel();
}

function startCurrentShiftClock() {
  const refreshAtNextMinute = 60_000 - (Date.now() % 60_000);
  window.setTimeout(() => {
    updateCurrentShiftLabel();
    window.setInterval(updateCurrentShiftLabel, 60_000);
  }, refreshAtNextMinute);
}

function renderSopSelector(selectedId, pageZoom = 100, state = {}) {
  const options = SOP_SHEETS.map((procedure) => `<option value="${escapeHtml(procedure.id)}" ${procedure.id === selectedId ? "selected" : ""}>${escapeHtml(procedure.category)} · ${escapeHtml(procedure.title)} · hoja ${procedure.sheet}</option>`).join("");
  const procedure = SOP_SHEETS.find((item) => item.id === selectedId) ?? SOP_SHEETS[0];
  const pdfPath = state.sopPdfUrl || SOP_DOCUMENT.pdfPath;
  const sourceUrl = pdfPath ? `${pdfPath}#page=${procedure.sheet}` : "";
  const canUpdateSop = canManageSopVersions();

  return `<section class="selector-panel procedure-selector-panel" aria-label="Selección de SOP y hoja">
    <div class="selector-fields"><label for="procedure-select">Seleccionar SOP</label>
      <select id="procedure-select" data-action="select-procedure" data-focus-key="procedure-select">${options}</select>
    </div>
    <div class="sop-page-zoom-controls" role="group" aria-label="Controles para ampliar o reducir la hoja SOP">
      <button class="icon-button" type="button" data-action="sop-page-zoom-out" data-focus-key="sop-page-zoom-out" aria-label="Reducir hoja SOP" title="Reducir hoja SOP" ${pageZoom <= 50 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>
      <output id="sop-page-zoom-level" aria-live="polite">${pageZoom}%</output>
      <button class="icon-button" type="button" data-action="sop-page-zoom-in" data-focus-key="sop-page-zoom-in" aria-label="Ampliar hoja SOP" title="Ampliar hoja SOP" ${pageZoom >= 150 ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">add</span></button>
      <button class="text-button" type="button" data-action="sop-page-zoom-reset" data-focus-key="sop-page-zoom-reset" aria-label="Ajustar hoja al panel">Ajustar</button>
    </div>
    <div class="sop-source-actions">${sourceUrl ? `<a class="text-button source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>${state.sopPdfName ? "Ver PDF local" : "Ver PDF"}</a>` : ""}
      ${canUpdateSop ? `<button class="text-button sop-update-button" type="button" data-action="navigate" data-nav-id="sop-admin" data-focus-key="nav-sop-admin"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Modificar SOP</button>` : ""}
    </div>
  </section>`;
}

function renderSummaryMetrics(todayRecords, state) {
  const completedRecords = todayRecords.filter((record) => record.status === "Completado");
  const completedProcedureIds = new Set(completedRecords.map((record) => record.procedureId).filter(Boolean));
  const inProgressCount = Boolean(state.activeWorkId || (state.completedSteps.length && !completedProcedureIds.has(state.selectedId))) ? 1 : 0;
  const pausedCount = state.workItems.filter((item) => item.status === "Detenida").length;
  const reworkCount = state.workItems.filter((item) => ["Retrabajo requerido", "Retrabajo en proceso"].includes(item.status)).length;
  const reviewCount = state.workItems.filter((item) => item.status === "Pendiente de revisión").length;
  const attentionCount = pausedCount + reworkCount + reviewCount;
  const metrics = [
    { tone: "total", label: "Hojas de SOP (GB200)", value: String(SOP_DOCUMENT.totalSheets), unit: `${SOP_DOCUMENT.processSheets} procedimientos · ${SOP_STEP_COUNT} pasos`, icon: "description" },
    { tone: "completed", label: "Validaciones locales hoy", value: String(completedRecords.length), unit: `${TODAY_DATE_LABEL} · este navegador`, icon: "check_circle" },
    { tone: "progress", label: "En proceso", value: String(inProgressCount), unit: `${state.completedSteps.length} pasos marcados`, icon: "donut_large" },
    { tone: "pending", label: "Atención requerida", value: String(attentionCount), unit: `${pausedCount} detenidos · ${reworkCount} retrabajos · ${reviewCount} por revisar`, icon: "priority_high" },
    { tone: "current", label: "SOP actual", value: SOP_DOCUMENT.id, unit: `Rev. ${SOP_DOCUMENT.revision}`, icon: "description" },
  ];

  return `<div class="metric-grid" aria-label="Resumen de procedimientos GB200">${metrics.map((metric) => `
    <article class="metric-card metric-card--${metric.tone}"><span class="metric-icon material-symbols-rounded" aria-hidden="true">${metric.icon}</span>
      <div class="metric-copy"><span>${metric.label}</span><div class="metric-value"><strong>${metric.value}</strong><small>${escapeHtml(metric.unit)}</small></div></div>
    </article>`).join("")}</div>`;
}

function renderFooter() {
  return `<footer class="app-footer"><span>Ingrasys · SOP de desensamble GB200</span><span>Prototipo local · sin conexión a sistemas productivos</span></footer>`;
}

