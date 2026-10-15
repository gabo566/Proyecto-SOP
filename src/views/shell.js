const NAV_ITEMS = [
  { id: "overview", label: "Seguimiento SOP", icon: "space_dashboard", target: "top" },
  { id: "production", label: "Producción", icon: "precision_manufacturing", target: "production" },
  { id: "traceability", label: "Trazabilidad", icon: "inventory_2", target: "records" },
  { id: "reports", label: "Reportes", icon: "bar_chart", action: "reports" },
];

function renderSidebar(state) {
  const navItems = NAV_ITEMS.map((item) => `
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
      <div class="sidebar-bottom"><span class="demo-pulse"></span><div><strong>Entorno de muestra</strong><small>Sin conexión a producción</small></div></div>
    </aside>`;
}

function renderTopbar() {
  return `<header class="topbar" id="top">
    <button class="icon-button menu-toggle" type="button" data-action="open-menu" data-focus-key="menu-open" aria-label="Abrir menú">
      <span class="material-symbols-rounded" aria-hidden="true">menu</span>
    </button>
    <div class="topbar-title"><span class="topbar-kicker">Panel ejecutivo</span><h1>DESENSAMBLE GENERAL DE COMPU TRAY <span class="topbar-title-revision">MODELO 2000 REV. 2</span></h1><p>Control de ejecución, validación y trazabilidad del desensamble</p></div>
    <div class="topbar-profile">
      <div class="profile-chip"><span class="profile-avatar">FA</span><span><strong>Supervisor</strong><small>Modo de demostración</small></span></div>
    </div>
    <div class="topbar-meta">
      <div class="date-chip"><span class="material-symbols-rounded" aria-hidden="true">calendar_today</span><span>${escapeHtml(TODAY_DATE_LABEL)}</span></div>
      <div class="shift-chip"><span class="material-symbols-rounded" aria-hidden="true">groups</span><span>Turno A</span></div>
    </div>
  </header>`;
}

function renderSopSelector(selectedId) {
  const options = PROCEDURES.map((procedure) => `<option value="${escapeHtml(procedure.id)}" ${procedure.id === selectedId ? "selected" : ""}>${escapeHtml(procedure.category)} · ${escapeHtml(procedure.title)} · hoja ${procedure.sheet}</option>`).join("");
  const procedure = PROCEDURES.find((item) => item.id === selectedId) ?? PROCEDURES[0];
  const sourceUrl = `${SOP_DOCUMENT.pdfPath}#page=${procedure.sheet}`;

  return `<section class="selector-panel" aria-label="Selección de SOP y procedimiento">
    <div class="selector-icon"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span></div>
    <div class="selector-fields"><label for="procedure-select">Seleccionar SOP o procedimiento</label>
      <select id="procedure-select" data-action="select-procedure" data-focus-key="procedure-select">${options}</select>
      <div class="selector-context"><span>${escapeHtml(SOP_DOCUMENT.id)} · Rev. ${escapeHtml(SOP_DOCUMENT.revision)}</span><span>${escapeHtml(SOP_DOCUMENT.title)}</span></div>
    </div>
    <a class="text-button source-link" href="${sourceUrl}" target="_blank" rel="noreferrer"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>Ver SOP</a>
  </section>`;
}

function renderSummaryMetrics(todayRecords, state) {
  const completedRecords = todayRecords.filter((record) => record.status === "Completado");
  const completedProcedureIds = new Set(completedRecords.map((record) => record.procedureId).filter(Boolean));
  const inProgressCount = state.completedSteps.length && !completedProcedureIds.has(state.selectedId) ? 1 : 0;
  const pendingCount = Math.max(0, PROCEDURES.length - completedProcedureIds.size - inProgressCount);
  const metrics = [
    { tone: "total", label: "Total de SOP (GB200)", value: String(PROCEDURES.length), unit: "procedimientos", icon: "description" },
    { tone: "completed", label: "Completados hoy", value: String(completedRecords.length), unit: `${TODAY_DATE_LABEL} · demostración`, icon: "check_circle" },
    { tone: "progress", label: "En proceso", value: String(inProgressCount), unit: `${state.completedSteps.length} pasos marcados`, icon: "donut_large" },
    { tone: "pending", label: "Pendientes", value: String(pendingCount), unit: `de ${PROCEDURES.length} procedimientos`, icon: "radio_button_unchecked" },
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

