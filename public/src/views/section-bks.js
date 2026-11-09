// Encabezado y vista previa de diseño para Producción, Trazabilidad y Reportes.
// Los datos de la vista previa son FICTICIOS (ejemplos de diseño); no vienen de la base de datos.
// La lógica de cada sección (filtros, registros, descargas) sigue en sus vistas originales.

const BKS_SECTIONS = {
  production: {
    eyebrow: "Producción · línea en vivo",
    title: "Producción",
    text: "Avance por estación, validaciones por hora y órdenes en curso.",
    chips: [["Turno", "2 · 15:00–22:30"], ["Estaciones", "8 activas"]],
  },
  traceability: {
    eyebrow: "Trazabilidad · nodo y componentes",
    title: "Trazabilidad",
    text: "Historial completo de cada nodo: validaciones, pausas, retrabajos y tarjetas.",
    chips: [["Eventos", "6 en la línea de tiempo"], ["Estado", "En retrabajo"]],
  },
  reports: {
    eyebrow: "Reportes · indicadores del periodo",
    title: "Reportes",
    text: "Validaciones, aprobación y tiempos por SOP. Exporta el periodo que necesites.",
    chips: [["Periodo", "Nov 2026"], ["SOP activas", "4"]],
  },
};

const BKS_SAMPLE = {
  production: {
    kpis: [
      ["Unidades hoy", "98", "+12 % vs. ayer", "up"],
      ["Validaciones", "84", "86 % del plan", "up"],
      ["Retrabajos", "6", "−2 vs. ayer", "down"],
      ["Eficiencia", "94.2 %", "Meta 92 %", "up"],
    ],
    hours: ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"],
    hourly: [6, 9, 11, 8, 12, 10, 7, 9, 11, 5],
    stations: [["Activas", 7, "#2563eb"], ["Detenidas", 1, "#dc2626"], ["Mantenimiento", 1, "#f59e0b"]],
    orders: [
      ["OT-2401", "GB200 · Compute tray", "MFG · TDR", 82, "En curso"],
      ["OT-2402", "GB200 · Compute tray", "RWK · Desensamble", 46, "En retrabajo"],
      ["OT-2403", "GB300 · Switch tray", "MFG · TDR", 100, "Completa"],
      ["OT-2404", "GB200 · Power shelf", "MFG · TDR", 30, "Por revisar"],
    ],
  },
  traceability: {
    node: { serial: "1934-EJ-0001", pn: "675-24975-2000-000", model: "GB200 · Compute tray", station: "RWK · Desensamble" },
    events: [
      ["08:12", "Validación MFG", "Estación TDR · SOP Rev. 6.2", "ok"],
      ["09:40", "Pausa por torque", "Tornillo M2 fuera de rango", "warn"],
      ["10:05", "Retrabajo RWK", "Cambio de conector PCIe riser", "warn"],
      ["10:48", "Revalidación", "Torque dentro de rango", "ok"],
      ["11:20", "Retrabajo cerrado", "Tarjeta BMC reemplazada", "ok"],
      ["11:35", "Liberado a MFG", "Pendiente validación final", "info"],
    ],
    parts: [["Tarjeta BMC", "Revisada"], ["Interposer", "Revisada"], ["HMC", "En revisión"], ["Riser PCIe", "Reemplazada"]],
  },
  reports: {
    kpis: [
      ["Validaciones del mes", "428", "+8 % vs. oct.", "up"],
      ["Aprobación", "96.4 %", "Meta 95 %", "up"],
      ["Retrabajos", "18", "4.2 % del total", "down"],
      ["Tiempo medio", "42 min", "−3 min vs. oct.", "up"],
    ],
    weeks: ["S1", "S2", "S3", "S4"],
    weekly: [96, 112, 104, 116],
    bySop: [["SOP desensamble GB200", 40, "#2563eb"], ["SOP GB300 switch", 25, "#0ea5e9"], ["SOP power shelf", 20, "#14b8a6"], ["SOP compute tray", 15, "#8b5cf6"]],
    rows: [
      ["Desensamble GB200", "Rev. 6.2", 172, 97.1, [4, 5, 6, 6, 7, 8]],
      ["Desensamble GB300", "Rev. 2.0", 107, 95.3, [3, 4, 4, 5, 6, 6]],
      ["Power shelf", "Rev. 1.4", 85, 96.5, [5, 5, 6, 5, 6, 7]],
      ["Compute tray", "Rev. 3.1", 64, 94.0, [2, 3, 3, 4, 4, 5]],
    ],
  },
};

function bksSection(section) {
  return BKS_SECTIONS[section] ?? null;
}

// Encabezado oscuro con líneas y puntos, igual que el diseño de referencia.
function renderBksHero(section) {
  const meta = bksSection(section);
  if (!meta) return "";
  return `<header class="bks-hero">
    <div class="bks-hero-copy">
      <span class="bks-eyebrow">${meta.eyebrow}</span>
      <h2 class="bks-hero-title">${meta.title}</h2>
      <p class="bks-hero-text">${meta.text}</p>
    </div>
    <div class="bks-hero-chips">${meta.chips.map(([label, value]) => `<div class="bks-chip"><small>${label}</small><strong>${value}</strong></div>`).join("")}</div>
  </header>`;
}

function bksKpis(list) {
  return `<div class="bks-kpis">${list.map(([label, value, delta, tone]) => `<article class="bks-kpi">
      <span class="bks-kpi-label">${label}</span>
      <strong class="bks-kpi-value">${value}</strong>
      <span class="bks-kpi-delta bks-kpi-delta--${tone}">${delta}</span>
    </article>`).join("")}</div>`;
}

// Gráfica de barras en SVG; cada barra tiene su valor en el título (aparece al pasar el cursor).
function bksBarChart(labels, values, { unit = "", max = null } = {}) {
  const width = 640, height = 220, pad = 28, top = 14;
  const peak = max ?? Math.max(...values) * 1.15;
  const step = (width - pad * 2) / values.length;
  const barW = step * 0.56;
  const bars = values.map((v, i) => {
    const h = ((height - pad - top) * v) / peak;
    const x = pad + i * step + (step - barW) / 2;
    const y = height - pad - h;
    return `<g class="bks-bar"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="6"><title>${labels[i]}: ${v}${unit}</title></rect><text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${labels[i]}</text></g>`;
  }).join("");
  return `<svg class="bks-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica de barras de ejemplo">${bars}</svg>`;
}

// Anillo (donut) con segmentos proporcionales.
function bksDonut(parts) {
  const r = 46, c = 2 * Math.PI * r;
  const total = parts.reduce((sum, [, v]) => sum + v, 0);
  let offset = 0;
  const arcs = parts.map(([label, v, color]) => {
    const len = (v / total) * c;
    const arc = `<circle class="bks-donut-arc" cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${label}: ${v}</title></circle>`;
    offset += len;
    return arc;
  }).join("");
  const legend = parts.map(([label, v, color]) => `<li><i style="background:${color}"></i><span>${label}</span><b>${v}</b></li>`).join("");
  return `<div class="bks-donut-wrap"><svg class="bks-donut" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#e8edf6" stroke-width="16"/>${arcs}</svg><ul class="bks-legend">${legend}</ul></div>`;
}

// Mini línea de tendencia (sparkline).
function bksSpark(values) {
  const w = 96, h = 30, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i * (w / (values.length - 1))).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return `<svg class="bks-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderBksProductionPreview() {
  const s = BKS_SAMPLE.production;
  return `${bksKpis(s.kpis)}
    <div class="bks-grid bks-grid--main">
      <article class="bks-card"><header class="bks-card-head"><h3>Validaciones por hora</h3><span class="bks-tag">Hoy</span></header>${bksBarChart(s.hours, s.hourly, { unit: " val." })}</article>
      <article class="bks-card"><header class="bks-card-head"><h3>Estado de estaciones</h3><span class="bks-tag">9 totales</span></header>${bksDonut(s.stations)}</article>
    </div>
    <article class="bks-card">
      <header class="bks-card-head"><h3>Órdenes en curso</h3><span class="bks-tag">Ejemplo</span></header>
      <div class="bks-table" role="table">
        <div class="bks-row bks-row--head" role="row"><span>Orden</span><span>Modelo</span><span>Estación</span><span>Avance</span><span>Estado</span></div>
        ${s.orders.map(([id, model, station, pct, status]) => `<div class="bks-row" role="row">
          <span class="bks-strong">${id}</span><span>${model}</span><span>${station}</span>
          <span class="bks-progress"><i style="width:${pct}%"></i><b>${pct} %</b></span>
          <span class="bks-status bks-status--${pct === 100 ? "ok" : status === "En retrabajo" ? "warn" : "info"}">${status}</span>
        </div>`).join("")}
      </div>
    </article>`;
}

function renderBksTraceabilityPreview() {
  const s = BKS_SAMPLE.traceability;
  return `<div class="bks-grid bks-grid--trace">
      <article class="bks-card bks-node">
        <header class="bks-card-head"><h3>Nodo</h3><span class="bks-tag bks-tag--warn">En retrabajo</span></header>
        <dl class="bks-dl">
          <div><dt>Serie</dt><dd>${s.node.serial}</dd></div>
          <div><dt>Número de parte</dt><dd>${s.node.pn}</dd></div>
          <div><dt>Modelo</dt><dd>${s.node.model}</dd></div>
          <div><dt>Estación actual</dt><dd>${s.node.station}</dd></div>
        </dl>
        <h4 class="bks-sub">Componentes</h4>
        <ul class="bks-parts">${s.parts.map(([name, state]) => `<li><span>${name}</span><em class="bks-status bks-status--${state === "En revisión" ? "warn" : state === "Reemplazada" ? "info" : "ok"}">${state}</em></li>`).join("")}</ul>
      </article>
      <article class="bks-card">
        <header class="bks-card-head"><h3>Línea de tiempo</h3><span class="bks-tag">Hoy</span></header>
        <ol class="bks-timeline">${s.events.map(([time, title, detail, tone]) => `<li class="bks-tl bks-tl--${tone}">
          <time>${time}</time><span class="bks-tl-dot" aria-hidden="true"></span>
          <div><strong>${title}</strong><small>${detail}</small></div>
        </li>`).join("")}</ol>
      </article>
    </div>`;
}

function renderBksReportsPreview() {
  const s = BKS_SAMPLE.reports;
  return `${bksKpis(s.kpis)}
    <div class="bks-grid bks-grid--main">
      <article class="bks-card"><header class="bks-card-head"><h3>Validaciones por semana</h3><span class="bks-tag">Nov 2026</span></header>${bksBarChart(s.weeks, s.weekly, { unit: " val." })}</article>
      <article class="bks-card"><header class="bks-card-head"><h3>Distribución por SOP</h3><span class="bks-tag">%</span></header>${bksDonut(s.bySop.map(([label, v, color]) => [label, v, color]))}</article>
    </div>
    <article class="bks-card">
      <header class="bks-card-head"><h3>Desempeño por SOP</h3><span class="bks-tag">Ejemplo</span></header>
      <div class="bks-table" role="table">
        <div class="bks-row bks-row--head bks-row--report" role="row"><span>SOP</span><span>Revisión</span><span>Validaciones</span><span>Aprobación</span><span>Tendencia</span></div>
        ${s.rows.map(([sop, rev, count, approval, trend]) => `<div class="bks-row bks-row--report" role="row">
          <span class="bks-strong">${sop}</span><span>${rev}</span><span>${count}</span>
          <span class="bks-progress bks-progress--thin"><i style="width:${approval}%"></i><b>${approval} %</b></span>
          ${bksSpark(trend)}
        </div>`).join("")}
      </div>
    </article>`;
}

// Bloque que se muestra arriba de cada sección: encabezado y vista previa de diseño (datos ficticios).
function renderBksPrefix(state) {
  const section = state.activeSection;
  if (!bksSection(section)) return "";
  const preview = section === "production" ? renderBksProductionPreview()
    : section === "traceability" ? renderBksTraceabilityPreview()
      : renderBksReportsPreview();
  return `<div class="bks-wrap">${renderBksHero(section)}
    <section class="bks-preview" aria-label="Vista previa de diseño con datos ficticios">
      <div class="bks-preview-tag"><span class="material-symbols-rounded" aria-hidden="true">visibility</span>Vista previa de diseño · datos ficticios</div>
      ${preview}
    </section>
  </div>`;
}
