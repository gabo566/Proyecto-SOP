const SOP_ACTIVE_VERSION_STORAGE_KEY = "sop-operador-active-sop-version-v1";

function clampSopAnnotationCoordinate(value) {
  return Math.max(0, Math.min(1000, Math.round(Number(value) || 0)));
}

// Las anotaciones se guardan normalizadas (0–1000 en ambos ejes). Para dibujarlas sin deformar círculos,
// grosores ni textos, se pasan a un espacio uniforme de 1000 × (1000 / proporción de la hoja).
const SOP_PAGE_ASPECT = 1.294;
const SOP_ANNOTATION_COLOR = "#d31e27";

function getSopAnnotationAspect(options = {}) {
  return Math.max(0.2, Math.min(5, Number(options.aspect) || SOP_PAGE_ASPECT));
}

function sopAnnotationColor(value, fallback = SOP_ANNOTATION_COLOR) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
}

function tintSopColor(hex, amount = 0.82) {
  const value = sopAnnotationColor(hex, "#f0a020");
  const channel = (offset) => Math.round(parseInt(value.slice(offset, offset + 2), 16) * (1 - amount) + 255 * amount);
  return `#${[1, 3, 5].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
}

function wrapSopAnnotationText(text, maxChars) {
  const lines = [];
  for (const paragraph of String(text ?? "").split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (current && `${current} ${word}`.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

// Tamaño (en unidades uniformes) de las notas y los textos libres; también lo usa la selección en el editor.
function measureSopAnnotationBox(annotation) {
  if (annotation.type === "note") {
    const width = Math.max(140, Math.min(700, Number(annotation.width) || 280));
    const fontSize = Math.max(12, Math.min(60, Number(annotation.fontSize) || 21));
    const lines = wrapSopAnnotationText(annotation.text, Math.max(6, Math.floor((width - 28) / (fontSize * 0.55)))).slice(0, 10);
    return { width, height: Math.max(56, lines.length * fontSize * 1.1 + 22), lines, fontSize };
  }
  const fontSize = Math.max(12, Math.min(120, Number(annotation.fontSize) || 30));
  const lines = String(annotation.text ?? "").split("\n").slice(0, 12);
  const widest = Math.max(1, ...lines.map((line) => line.length));
  return { width: Math.max(fontSize, widest * fontSize * 0.56), height: Math.max(fontSize * 1.3, lines.length * fontSize * 1.25), lines, fontSize };
}

function renderSopAnnotationContents(annotations = [], preview = null, options = {}) {
  const aspect = getSopAnnotationAspect(options);
  const print = Boolean(options.print);
  const ux = (value) => clampSopAnnotationCoordinate(value);
  const uy = (value) => Math.round(clampSopAnnotationCoordinate(value) / aspect * 100) / 100;
  const markers = new Map();
  const visibleAnnotations = preview ? [...annotations, preview] : annotations;
  const dash = (annotation, width) => (annotation.dash === "dashed" ? `stroke-dasharray:${Math.round(width * 2.4)} ${Math.round(width * 1.5)};` : "");
  const shapes = visibleAnnotations.map((annotation) => {
    const title = annotation.stepNumber ? `Paso ${escapeHtml(annotation.stepNumber)}` : "Anotación visual";
    const color = sopAnnotationColor(annotation.color);
    const idAttribute = annotation.id ? ` data-annotation-id="${escapeHtml(annotation.id)}"` : "";
    if (annotation.type === "arrow") {
      const width = Math.max(2, Math.min(30, Number(annotation.strokeWidth) || 10));
      const markerId = `sop-ah-${color.slice(1)}`;
      markers.set(markerId, color);
      return `<g class="sop-annotation sop-annotation--arrow"${idAttribute} pointer-events="none"><title>${title}</title><line x1="${ux(annotation.x1)}" y1="${uy(annotation.y1)}" x2="${ux(annotation.x2)}" y2="${uy(annotation.y2)}" style="stroke:${color};stroke-width:${width};stroke-linecap:round;fill:none;${dash(annotation, width)}marker-end:url(#${markerId})${print ? ";filter:none" : ""}" /></g>`;
    }
    if (annotation.type === "box" || annotation.type === "highlight") {
      const x = ux(annotation.x);
      const y = clampSopAnnotationCoordinate(annotation.y);
      const width = Math.max(1, Math.min(1000 - x, clampSopAnnotationCoordinate(annotation.width)));
      const height = Math.max(1, Math.min(1000 - y, clampSopAnnotationCoordinate(annotation.height)));
      if (annotation.type === "highlight") {
        const opacity = Math.max(0.1, Math.min(0.9, Number(annotation.opacity) || 0.38));
        return `<g class="sop-annotation sop-annotation--highlight"${idAttribute} pointer-events="none"><title>${title} · resaltado</title><rect x="${x}" y="${uy(y)}" width="${width}" height="${uy(height)}" style="fill:${sopAnnotationColor(annotation.color, "#ffe14d")};fill-opacity:${opacity};stroke:none" /></g>`;
      }
      const strokeWidth = Math.max(2, Math.min(30, Number(annotation.strokeWidth) || 7));
      return `<g class="sop-annotation sop-annotation--box"${idAttribute} pointer-events="none"><title>${title}</title><rect x="${x}" y="${uy(y)}" width="${width}" height="${uy(height)}" style="fill:${color};fill-opacity:.1;stroke:${color};stroke-width:${strokeWidth};${dash(annotation, strokeWidth)}vector-effect:none" /></g>`;
    }
    if (annotation.type === "number") {
      const x = ux(annotation.x);
      const y = uy(annotation.y);
      return `<g class="sop-annotation sop-annotation--number"${idAttribute} pointer-events="none"><title>${title}</title><circle cx="${x}" cy="${y}" r="29" style="fill:${color};stroke:#fff;stroke-width:7${print ? ";filter:none" : ""}" /><text x="${x}" y="${y + 14}" text-anchor="middle" style="fill:#fff;font-family:Roboto,Arial,sans-serif;font-size:42px;font-weight:800">${escapeHtml(annotation.label || "1")}</text></g>`;
    }
    if (annotation.type === "textfix") {
      const x = ux(annotation.x);
      const y = clampSopAnnotationCoordinate(annotation.y);
      const width = Math.max(1, Math.min(1000 - x, clampSopAnnotationCoordinate(annotation.width)));
      const height = Math.max(1, Math.min(1000 - y, clampSopAnnotationCoordinate(annotation.height)));
      const fontSize = Math.max(2, Math.min(60, Number(annotation.fontSize) || 8));
      const pitch = Math.max(fontSize, Math.min(fontSize * 3, Number(annotation.pitch) || fontSize * 1.22));
      const baseX = ux(annotation.baselineX ?? x + 5);
      const baseY = uy(annotation.baselineY ?? y + fontSize * 0.95 * aspect);
      const family = String(annotation.fontFamily ?? "").replace(/[^A-Za-z0-9 -]/g, "").trim();
      const fontFamily = `${family ? `'${family}', ` : ""}Carlito, Calibri, Arial, sans-serif`;
      const fontWeight = Number(annotation.fontWeight) >= 600 ? 700 : 400;
      const fontStyle = annotation.fontStyle === "italic" ? "italic" : "normal";
      const bg = sopAnnotationColor(annotation.bg, "#ffffff");
      const ink = sopAnnotationColor(annotation.ink, "#000000");
      const prefix = String(annotation.prefix ?? "");
      const prefixWeight = annotation.prefixBold ? 700 : fontWeight;
      const lines = (Array.isArray(annotation.lines) && annotation.lines.length ? annotation.lines : [annotation.text ?? ""]).slice(0, 40);
      const tspans = lines.map((line, index) => `<tspan x="0" ${index ? `dy="${pitch}"` : ""}>${index === 0 && prefix ? `<tspan font-weight="${prefixWeight}">${escapeHtml(prefix)}</tspan>` : ""}${escapeHtml(String(line))}</tspan>`).join("");
      return `<g class="sop-annotation sop-annotation--textfix"${idAttribute} pointer-events="none"><title>${title} · texto corregido</title><rect style="fill:${bg};stroke:none" x="${x}" y="${uy(y)}" width="${width}" height="${uy(height)}" /><text style="fill:${ink}" transform="translate(${baseX} ${baseY})" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" font-style="${fontStyle}">${tspans}</text></g>`;
    }
    if (annotation.type === "note") {
      const x = Math.max(0, Math.min(1000 - 140, ux(annotation.x)));
      const y = Math.max(0, uy(annotation.y));
      const box = measureSopAnnotationBox(annotation);
      const lineHeight = box.fontSize * 1.1;
      const noteColor = sopAnnotationColor(annotation.color, "#a96a05");
      return `<g class="sop-annotation sop-annotation--note"${idAttribute} pointer-events="none"><title>${title}</title><rect x="${x}" y="${y}" width="${box.width}" height="${box.height}" rx="8" style="fill:${tintSopColor(noteColor, 0.84)};stroke:${noteColor};stroke-width:4${print ? ";filter:none" : ""}" /><text x="${x + 14}" y="${y + box.fontSize + 6}" style="fill:#2b2418;font-family:Roboto,Arial,sans-serif;font-size:${box.fontSize}px;font-weight:700">${box.lines.map((line, index) => `<tspan x="${x + 14}" dy="${index ? lineHeight : 0}">${escapeHtml(line)}</tspan>`).join("")}</text></g>`;
    }
    if (annotation.type === "text") {
      const x = ux(annotation.x);
      const y = uy(annotation.y);
      const box = measureSopAnnotationBox(annotation);
      const background = annotation.bg ? `<rect x="${x - 6}" y="${y - 4}" width="${box.width + 12}" height="${box.height + 8}" rx="4" style="fill:${sopAnnotationColor(annotation.bg, "#ffffff")};fill-opacity:.92" />` : "";
      return `<g class="sop-annotation sop-annotation--text"${idAttribute} pointer-events="none"><title>${title}</title>${background}<text x="${x}" y="${y + box.fontSize}" style="fill:${color};font-family:Roboto,Arial,sans-serif;font-size:${box.fontSize}px;font-weight:${annotation.bold ? 800 : 500}">${box.lines.map((line, index) => `<tspan x="${x}" dy="${index ? box.fontSize * 1.25 : 0}">${escapeHtml(line)}</tspan>`).join("")}</text></g>`;
    }
    return "";
  }).join("");
  const markerDefs = [...markers].map(([id, color]) => `<marker id="${id}" markerWidth="28" markerHeight="28" refX="23" refY="14" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 28 14 L 0 28 z" style="fill:${color}" /></marker>`).join("");
  return `<defs><marker id="sop-annotation-arrowhead" markerWidth="28" markerHeight="28" refX="23" refY="14" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 28 14 L 0 28 z" /></marker>${markerDefs}</defs>${shapes}`;
}

function wrapSopTextFix(text, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && measure(`${line} ${word}`) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const sopStepBoundsCache = new WeakMap();
async function ensureSopStepBounds(version, procedure) {
  if (!procedure?.steps?.some((step) => !step.sourceBounds)) return false;
  let pending = sopStepBoundsCache.get(procedure);
  if (!pending) {
    pending = (async () => {
      const pdf = await getSopDraftPdfDocument(version);
      const page = await pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet));
      const content = await page.getTextContent();
      return extractSopPageSteps(content.items, page.getViewport({ scale: 1 }));
    })().catch(() => []);
    sopStepBoundsCache.set(procedure, pending);
  }
  const detected = await pending;
  let changed = false;
  for (const step of procedure.steps) {
    if (step.sourceBounds) continue;
    const match = detected.find((candidate) => candidate.number === String(step.originalNumber ?? step.number))
      ?? detected.find((candidate) => candidate.number === String(step.number));
    if (match?.sourceBounds) {
      step.sourceBounds = match.sourceBounds;
      step.sourceFormat = match.sourceFormat;
      changed = true;
    }
  }
  return changed;
}

let sopInlineRepaintTimer = 0;
let sopTextFixSequence = 0;
let sopTextFixMeasureContext = null;
function getSopStepMark(step) {
  if (!step) return "";
  return step.reviewed ? "saved" : (isSopStepEdited(step) ? "edited" : "");
}

function showInlineNotice(message, kind = "success") {
  document.querySelector(".sop-inline-notice")?.remove();
  const node = document.createElement("div");
  node.className = `sop-inline-notice sop-inline-notice--${kind}`;
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 3200);
}

function isSopStepEdited(step) {
  if (!step || step.originalText === undefined) return false;
  return String(step.text ?? "").trim() !== String(step.originalText).trim() || step.number !== step.originalNumber;
}

async function readSopStepFont(page, format = {}) {
  let realName = "";
  let markerName = "";
  try {
    await page.getOperatorList();
    realName = String(page.commonObjs.get(format.fontName)?.name ?? "");
    markerName = String(page.commonObjs.get(format.markerFontName ?? format.fontName)?.name ?? "");
  } catch (error) {
    realName = "";
  }
  const base = realName.replace(/^[A-Z]{6}\+/, "");
  return {
    family: (base.split(/[-,]/)[0] || "Calibri").replace(/([a-z])([A-Z])/g, "$1 $2"),
    bold: /bold|black|heavy/i.test(base),
    italic: /italic|oblique/i.test(base),
    markerBold: /bold|black|heavy/i.test(markerName.replace(/^[A-Z]{6}\+/, "")),
  };
}

const sopSamplerCache = new WeakMap();
async function getSopSampler(page) {
  let pending = sopSamplerCache.get(page);
  if (!pending) {
    pending = (async () => {
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
      return { context, scale, width: canvas.width, height: canvas.height };
    })().catch(() => null);
    sopSamplerCache.set(page, pending);
  }
  return pending;
}

function sampleSopTextColors(sampler, viewport, bounds) {
  const fallback = { bg: "#ffffff", ink: "#000000" };
  if (!sampler) return fallback;
  const toHex = (color) => `#${color.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  try {
    const scale = sampler.scale;
    const left = Math.max(0, Math.floor(bounds.x * scale));
    const right = Math.min(sampler.width - 1, Math.ceil((bounds.x + bounds.width) * scale));
    const top = Math.max(0, Math.floor((viewport.height - (bounds.y + bounds.height)) * scale));
    const bottom = Math.min(sampler.height - 1, Math.ceil((viewport.height - bounds.y) * scale));
    if (right <= left || bottom <= top) return fallback;
    const clampX = (value) => Math.max(0, Math.min(sampler.width - 1, Math.round(value)));
    const clampY = (value) => Math.max(0, Math.min(sampler.height - 1, Math.round(value)));
    const read = (x, y) => Array.from(sampler.context.getImageData(clampX(x), clampY(y), 1, 1).data.slice(0, 3));
    const ring = 6;
    const points = [];
    for (let index = 0; index <= 4; index += 1) {
      const x = left + (right - left) * index / 4;
      points.push([x, top - ring], [x, bottom + ring]);
    }
    for (let index = 0; index <= 2; index += 1) {
      const y = top + (bottom - top) * index / 2;
      points.push([left - ring, y], [right + ring, y]);
    }
    const counts = new Map();
    for (const [x, y] of points) {
      const color = read(x, y);
      const key = color.map((value) => value >> 4).join(",");
      const entry = counts.get(key) ?? { count: 0, color };
      entry.count += 1;
      counts.set(key, entry);
    }
    const bg = [...counts.values()].sort((a, b) => b.count - a.count)[0].color;
    const region = sampler.context.getImageData(left, top, right - left + 1, bottom - top + 1).data;
    const distances = [];
    for (let index = 0; index < region.length; index += 4) {
      distances.push([Math.abs(region[index] - bg[0]) + Math.abs(region[index + 1] - bg[1]) + Math.abs(region[index + 2] - bg[2]), index]);
    }
    distances.sort((a, b) => b[0] - a[0]);
    const strongest = distances.slice(0, Math.max(1, Math.floor(distances.length * 0.04)));
    if (!strongest.length || strongest[0][0] < 90) {
      const luminance = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
      return { bg: toHex(bg), ink: luminance > 140 ? "#000000" : "#ffffff" };
    }
    const ink = [0, 1, 2].map((channel) => strongest.reduce((sum, [, index]) => sum + region[index + channel], 0) / strongest.length);
    return { bg: toHex(bg), ink: toHex(ink) };
  } catch (error) {
    return fallback;
  }
}

function findSopTextBlockAt(items, px, py) {
  const rows = groupSopPdfRows(items);
  const splitSegments = (row) => {
    const segments = [];
    let current = null;
    for (const item of row.items) {
      if (current && item.x - current.right <= 14) {
        current.items.push(item);
        current.right = Math.max(current.right, item.x + item.width);
      } else {
        current = { items: [item], left: item.x, right: item.x + item.width };
        segments.push(current);
      }
    }
    return segments;
  };
  let hit = null;
  for (const row of rows) {
    for (const segment of splitSegments(row)) {
      const height = Math.max(...segment.items.map((item) => item.height));
      if (px >= segment.left - 2 && px <= segment.right + 2 && py >= row.y - height * 0.3 && py <= row.y + height * 1.05) {
        hit = { row, segment, height };
        break;
      }
    }
    if (hit) break;
  }
  if (!hit) return null;
  const collect = (down) => {
    const found = [];
    let last = hit;
    for (let guard = 0; guard < 14; guard += 1) {
      let best = null;
      for (const row of rows) {
        const gap = down ? last.row.y - row.y : row.y - last.row.y;
        if (gap <= 0 || gap > last.height * 1.9 || (best && gap >= best.gap)) continue;
        const segment = splitSegments(row).find((candidate) => Math.abs(candidate.left - hit.segment.left) <= 24 && candidate.left < hit.segment.right && candidate.right > hit.segment.left);
        if (segment) best = { row, segment, height: Math.max(...segment.items.map((item) => item.height)), gap };
      }
      if (!best) break;
      found.push(best);
      last = best;
    }
    return found;
  };
  const lines = [...collect(false).reverse(), hit, ...collect(true)];
  const items2 = lines.flatMap((line) => line.segment.items);
  const text = lines.reduce((result, line) => appendSopContinuation(result, readSopRowText(line.segment.items)), "");
  if (!text || text.length > 600) return null;
  return {
    text,
    bounds: getSopSourceBounds(items2),
    format: { fontName: hit.segment.items[0].fontName, markerFontName: hit.segment.items[0].fontName, fontSize: Number(hit.height.toFixed(2)), markerSuffix: "" },
  };
}

async function buildSopTextFix(version, procedure, { bounds, format = {}, prefix = "", text, stepNumber = "" }) {
  const pdf = await getSopDraftPdfDocument(version);
  const page = await pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet));
  const font = await readSopStepFont(page, format);
  const viewport = page.getViewport({ scale: 1 });
  const colors = sampleSopTextColors(await getSopSampler(page), viewport, bounds);
  const fontPt = Math.max(5, Math.min(40, Number(format.fontSize) || 10.8));
  const weight = font.bold ? 700 : 400;
  const style = font.italic ? "italic" : "normal";
  sopTextFixMeasureContext ??= document.createElement("canvas").getContext("2d");
  sopTextFixMeasureContext.font = `${style} ${weight} ${fontPt}px '${font.family}', Carlito, Calibri, Arial, sans-serif`;
  const measure = (value) => sopTextFixMeasureContext.measureText(value).width;
  const pitchPt = fontPt * 1.22;
  const left = bounds.x;
  const singleLine = bounds.height < fontPt * 1.8;
  const roomRight = viewport.width * 0.97 - left;
  const columnRoom = left < viewport.width * 0.44 ? viewport.width * 0.47 - left : roomRight;
  const wrapWidth = Math.max(bounds.width, singleLine ? Math.min(roomRight, columnRoom) : bounds.width);
  const lines = wrapSopTextFix(text, wrapWidth - measure(prefix), measure);
  const widest = Math.max(...lines.map((line, lineIndex) => measure(lineIndex === 0 ? prefix + line : line)));
  const firstBaselineY = viewport.height - (bounds.y + bounds.height - fontPt);
  const originalTop = viewport.height - (bounds.y + bounds.height);
  const coverTop = Math.max(0, originalTop - 2);
  const coverHeight = Math.max(bounds.height, (lines.length - 1) * pitchPt + fontPt * 1.25) + 4;
  const coverLeft = Math.max(0, left - 2);
  const coverWidth = Math.max(bounds.width, widest) + 6;
  const toX = (value) => clampSopAnnotationCoordinate(value / viewport.width * 1000);
  const toY = (value) => clampSopAnnotationCoordinate(value / viewport.height * 1000);
  return {
    type: "textfix",
    stepNumber,
    x: toX(coverLeft),
    y: toY(coverTop),
    width: Math.min(1000 - toX(coverLeft), toX(coverWidth)),
    height: Math.min(1000 - toY(coverTop), toY(coverHeight)),
    aspect: Number((viewport.width / viewport.height).toFixed(4)),
    fontSize: Number((fontPt / viewport.width * 1000).toFixed(3)),
    pitch: Number((pitchPt / viewport.width * 1000).toFixed(3)),
    baselineX: toX(left),
    baselineY: toY(firstBaselineY),
    prefix,
    prefixBold: font.markerBold,
    fontFamily: font.family,
    fontWeight: weight,
    fontStyle: style,
    bg: colors.bg,
    ink: colors.ink,
    lines,
    text: `${prefix}${text}`.slice(0, 600),
  };
}

async function syncSopStepTextFix(version, procedure, step) {
  const sequence = ++sopTextFixSequence;
  const annotations = procedure.annotations ??= [];
  const findIndex = () => annotations.findIndex((annotation) => annotation.type === "textfix" && annotation.stepNumber === step.number);
  const text = String(step.text ?? "").trim();
  const changed = isSopStepEdited(step) && text;
  if (changed && !step.sourceBounds) await ensureSopStepBounds(version, procedure);
  if (!changed || !step.sourceBounds) {
    const index = findIndex();
    if (index >= 0) annotations.splice(index, 1);
    return;
  }
  const fix = await buildSopTextFix(version, procedure, {
    bounds: step.sourceBounds,
    format: step.sourceFormat,
    prefix: `${step.number}${step.sourceFormat?.markerSuffix ?? ".-"}`,
    text,
    stepNumber: step.number,
  });
  if (sequence !== sopTextFixSequence) return;
  const index = findIndex();
  if (index >= 0) annotations[index] = fix;
  else annotations.push(fix);
}

function renderSopAnnotationOverlay(annotations = [], editable = false, aspect = SOP_PAGE_ASPECT) {
  const pageAspect = getSopAnnotationAspect({ aspect });
  return `<svg class="sop-annotation-overlay ${editable ? "sop-annotation-overlay--editable" : ""}" viewBox="0 0 1000 ${Math.round(1000 / pageAspect * 100) / 100}" preserveAspectRatio="none" data-aspect="${pageAspect}" ${editable ? 'data-sop-annotation-overlay role="img" tabindex="0" aria-label="Lienzo de anotaciones de la hoja SOP"' : 'aria-hidden="true"'}>${renderSopAnnotationContents(annotations, null, { aspect: pageAspect })}</svg>`;
}

function openStationNameDialog(type, initialName, onSave) {
  document.querySelector(".station-name-dialog")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "station-name-dialog";
  overlay.innerHTML = `<form class="station-name-dialog-card" role="dialog" aria-modal="true" aria-label="Modificar estación">
    <h3>Modificar estación</h3>
    <p>Escribe el nombre de la estación (${type === "RWK" ? "Retrabajo" : "Manufactura"}). Se agregará a la lista y se guarda con «Guardar estaciones y disponibilidad».</p>
    <input type="text" maxlength="80" placeholder="Nombre de la estación" autocomplete="off" />
    <div class="station-name-dialog-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Agregar estación</button></div>
  </form>`;
  const form = overlay.querySelector("form");
  const input = overlay.querySelector("input");
  input.value = initialName;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector("[data-cancel]").addEventListener("click", close);
  overlay.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (onSave(input.value) !== false) close();
  });
  document.body.append(overlay);
  input.focus();
  input.select();
}

function canManageSopVersions(user = getActiveLocalUser()) {
  return canUserDo("sop.manage", user);
}

// Las revisiones y el catálogo viven en el servidor (tablas sop_versions y
// sop_catalog). Solo la revisión activa se recuerda por navegador: cada
// operador trabaja con la SOP de su estación, no con una global.
function readSopApiError(result, fallback) {
  if (result.status === 0) return "No se pudo conectar con el servidor.";
  if (result.status === 413) return "El archivo es demasiado grande para el servidor.";
  if (result.status === 403) return "Tu cuenta no tiene permiso para modificar la SOP.";
  const validation = result.data?.errors ? Object.values(result.data.errors).flat()[0] : "";
  return validation || result.data?.message || fallback;
}

async function listStoredSopVersions() {
  const result = await sopApi("GET", "/api/sop-versions");
  if (!result.ok) throw new Error(readSopApiError(result, "No se pudieron leer las revisiones de la SOP."));
  return result.data.versions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function getActiveStoredSopVersionId() {
  try {
    return localStorage.getItem(SOP_ACTIVE_VERSION_STORAGE_KEY) || BUILT_IN_SOP_VERSION_ID;
  } catch {
    return BUILT_IN_SOP_VERSION_ID;
  }
}

async function setActiveSopVersionId(versionId) {
  try {
    localStorage.setItem(SOP_ACTIVE_VERSION_STORAGE_KEY, versionId);
  } catch {
    throw new Error("No se pudo recordar la SOP activa en este navegador.");
  }
}

async function saveSopVersion(version) {
  const { pdf, ...data } = version;
  const body = new FormData();
  body.set("version", JSON.stringify(data));
  if (pdf?.blob instanceof Blob) body.set("pdf", pdf.blob, pdf.name || "sop.pdf");
  else if (pdf?.versionId && pdf.versionId !== version.id) body.set("pdfCopyFrom", pdf.versionId);
  const result = await sopApi("POST", "/api/sop-versions", body);
  if (!result.ok) throw new Error(readSopApiError(result, "No se pudo guardar la revisión en el servidor."));
}

async function deleteStoredSopVersion(versionId) {
  const result = await sopApi("DELETE", `/api/sop-versions/${encodeURIComponent(versionId)}`);
  if (!result.ok) throw new Error(readSopApiError(result, "No se pudo eliminar la revisión en el servidor."));
  if (await getActiveStoredSopVersionId() === versionId) await setActiveSopVersionId(BUILT_IN_SOP_VERSION_ID);
}

async function saveStoredSopCatalog(catalog) {
  const payload = {};
  for (const [versionId, config] of Object.entries(catalog)) {
    payload[versionId] = { stationAssignment: config.stationAssignment ?? "", enabled: Boolean(config.enabled) };
  }
  const result = await sopApi("PUT", "/api/sop-catalog", { catalog: payload });
  if (!result.ok) throw new Error(readSopApiError(result, "No se pudo guardar el catálogo de SOP en el servidor."));
}

async function restoreStoredSopCatalog(state) {
  const result = await sopApi("GET", "/api/sop-catalog");
  if (!result.ok) throw new Error(readSopApiError(result, "No se pudo leer el catálogo de SOP."));
  const stored = result.data.catalog ?? {};
  const versionsById = new Map([
    [BUILT_IN_SOP_VERSION.id, BUILT_IN_SOP_VERSION],
    ...(state.sopVersionHistory ?? []).map((version) => [version.id, version]),
  ]);
  const catalog = {};

  for (const version of versionsById.values()) {
    const row = stored[version.id];
    if (row) {
      const stationAssignment = getWorkStationAssignment(row.stationAssignment)?.value ?? "";
      catalog[version.id] = { stationAssignment, enabled: Boolean(row.enabled && stationAssignment) };
      continue;
    }
    // Revisión sin fila en el catálogo: se propone la estación del documento y
    // solo la SOP incluida en el proyecto arranca habilitada.
    const stationAssignment = getWorkStationAssignment(version.document?.stationAssignment)?.value ?? "";
    catalog[version.id] = { stationAssignment, enabled: version.id === BUILT_IN_SOP_VERSION_ID && stationAssignment === "RWK:RWK" };
  }

  state.sopVersionCatalog = catalog;
  const missingRows = [...versionsById.keys()].some((id) => !stored[id]);
  if (missingRows && canManageSopVersions()) await saveStoredSopCatalog(catalog).catch(() => {});
  state.sopCatalogLoaded = true;
}

function createSopVersionMetadata(version, builtIn = false) {
  const procedures = version.procedures ?? [];
  return {
    id: version.id,
    revision: version.document.revision,
    stationAssignment: version.document.stationAssignment ?? "",
    title: version.document.title,
    documentId: version.document.id,
    procedureCount: procedures.filter((procedure) => procedure.steps.length > 0).length,
    sheetCount: procedures.length,
    stepCount: procedures.reduce((count, procedure) => count + procedure.steps.length, 0),
    createdAt: version.createdAt ?? "",
    createdBy: version.createdBy ?? "Catálogo incluido en el proyecto",
    pdfName: version.pdf?.name ?? (builtIn ? "SOP-NVD-GB200-141.pdf" : ""),
    builtIn,
  };
}

let activeSopImageUrls = [];

function applySopVersion(version, state, builtIn = false) {
  const previousPdfUrl = state.sopPdfUrl;
  activeSopImageUrls.forEach((url) => URL.revokeObjectURL(url));
  if (previousPdfUrl && !activeSopImageUrls.includes(previousPdfUrl)) URL.revokeObjectURL(previousPdfUrl);
  activeSopImageUrls = [];
  const procedures = structuredClone(version.procedures);
  for (const procedure of procedures) {
    if (procedure.pageImage?.blob instanceof Blob) {
      procedure.pageImage = URL.createObjectURL(procedure.pageImage.blob);
      activeSopImageUrls.push(procedure.pageImage);
    }
    for (const step of procedure.steps) {
      for (const image of step.images ?? []) {
        if (image.blob instanceof Blob) {
          image.src = URL.createObjectURL(image.blob);
          activeSopImageUrls.push(image.src);
        }
      }
    }
  }
  if (version.pdf?.blob instanceof Blob) {
    state.sopPdfUrl = URL.createObjectURL(version.pdf.blob);
    state.sopPdfName = version.pdf.name;
    activeSopImageUrls.push(state.sopPdfUrl);
  } else if (version.pdf?.url) {
    state.sopPdfUrl = version.pdf.url;
    state.sopPdfName = version.pdf.name;
  } else {
    state.sopPdfUrl = "";
    state.sopPdfName = "";
  }
  SOP_DOCUMENT = structuredClone(version.document);
  SOP_SHEETS = procedures;
  PROCEDURES = procedures.filter((procedure) => procedure.steps.length > 0);
  SOP_STEP_COUNT = PROCEDURES.reduce((count, procedure) => count + procedure.steps.length, 0);
  state.sopVersionMeta = createSopVersionMetadata({ ...version, procedures }, builtIn);
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const preserveActiveWork = activeWork && (activeWork.sopVersionId ?? BUILT_IN_SOP_VERSION_ID) === version.id;
  if (activeWork && !preserveActiveWork) state.activeWorkId = "";
  if (!preserveActiveWork) {
    state.selectedId = (PROCEDURES[0] ?? SOP_SHEETS[0])?.id ?? "";
    state.completedSteps = [];
    state.sopRun = null;
    state.form = createEmptyForm();
  } else {
    state.sopRun = activeWork.sopRun ? structuredClone(activeWork.sopRun) : null;
    state.selectedId = state.sopRun
      ? getGuidedSopProcedure(state.sopRun, PROCEDURES)?.id ?? activeWork.procedureId
      : activeWork.procedureId;
    state.completedSteps = state.sopRun
      ? getGuidedSopCheckedSteps(state.sopRun, state.selectedId)
      : [...(activeWork.completedSteps ?? [])];
    state.form = { ...createEmptyForm(), ...(activeWork.form ?? {}) };
  }
  state.form.nodePartNumber ||= SOP_DOCUMENT.nodePartNumber ?? "";
}

function applyBuiltInSopVersion(state) {
  applySopVersion(BUILT_IN_SOP_VERSION, state, true);
}

async function restoreCurrentSopVersion(state) {
  state.sopVersionHistory = await listStoredSopVersions();
  const activeId = await getActiveStoredSopVersionId();
  let restoredCustomVersion = false;
  if (activeId === BUILT_IN_SOP_VERSION_ID) {
    applyBuiltInSopVersion(state);
  } else {
    const version = state.sopVersionHistory.find((entry) => entry.id === activeId);
    if (!version) {
      await setActiveSopVersionId(BUILT_IN_SOP_VERSION_ID);
      applyBuiltInSopVersion(state);
    } else {
      const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
      if (activeWork && (activeWork.sopVersionId ?? BUILT_IN_SOP_VERSION_ID) !== activeId) {
        state.activeWorkId = "";
        state.completedSteps = [];
      }
      applySopVersion(version, state);
      restoredCustomVersion = true;
    }
  }
  await restoreStoredSopCatalog(state);
  return restoredCustomVersion;
}

let sopPdfJsPromise;

async function loadSopPdfJs() {
  if (!sopPdfJsPromise) {
    sopPdfJsPromise = import(new URL("./public/vendor/pdfjs/pdf.min.mjs", document.baseURI).href).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("./public/vendor/pdfjs/pdf.worker.mjs", document.baseURI).href;
      return pdfjs;
    }).catch((error) => {
      sopPdfJsPromise = null;
      if (globalThis.location?.protocol === "file:") {
        throw new Error("El navegador bloquea la lectura del PDF al abrir index.html como archivo. Abre el proyecto desde un servidor local HTTP y vuelve a subir la SOP.");
      }
      throw error;
    });
  }
  return sopPdfJsPromise;
}

function normalizeExtractedSopText(value) {
  return String(value ?? "").replace(/\s+/g, " ").replace(/\s*-\s*(?=\d)/g, "-").replace(/\s+-\s+(?=(?:lb|oz|nm)\b)/gi, "-").replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¿¡(])\s+/g, "$1").replace(/(\d)\.\s+(?=\d)/g, "$1.")
    .replace(/\bP\s+N\b/gi, "PN").trim();
}

function readSopMarker(items, index) {
  const direct = items[index].str.trim().match(/^(\d+(?:\.\d+)*\.?)\s*-\s*(.*)$/);
  if (direct) return { id: direct[1].replace(/\.$/, ""), endIndex: index, tail: direct[2] };

  let combined = "";
  let previous = null;
  for (let endIndex = index; endIndex < Math.min(items.length, index + 8); endIndex += 1) {
    const item = items[endIndex];
    if (previous && item.x - (previous.x + previous.width) > 22) break;
    combined += item.str;
    const match = combined.match(/^\s*(\d+(?:\.\d+)*\.?)\s*-\s*(.*)$/);
    if (match) return { id: match[1].replace(/\.$/, ""), endIndex, tail: match[2] };
    const compactPrefix = combined.replace(/\s/g, "");
    if (!/^\d+(?:\.\d+)*\.?$/.test(compactPrefix) && !/^\d*[.]?$/.test(compactPrefix)) break;
    previous = item;
  }
  return null;
}

function isSopMarkerStart(items, index) {
  if (index === 0) return true;
  const previous = items[index - 1];
  return items[index].x - (previous.x + previous.width) >= 18;
}

function isSopStepNumber(value) {
  return /^(?:[1-9]\d{0,2})(?:\.\d+)*$/.test(String(value ?? ""));
}

function groupSopPdfRows(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 1.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: item.transform[4], y, width: item.width, height: Math.hypot(item.transform[2], item.transform[3]) || 10, str: item.str, fontName: item.fontName });
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => ({
    ...row,
    items: row.items.sort((a, b) => a.x - b.x),
  }));
}

function readSopMarkersInRow(row, pageWidth) {
  const markersByColumn = { left: [], right: [] };
  for (let index = 0; index < row.items.length; index += 1) {
    if (!isSopMarkerStart(row.items, index)) continue;
    const marker = readSopMarker(row.items, index);
    if (!marker || !isSopStepNumber(marker.id)) continue;
    const column = row.items[index].x < pageWidth * 0.44 ? "left" : "right";
    markersByColumn[column].push({ ...marker, index, x: row.items[index].x, column });
  }
  return { ...markersByColumn, all: [...markersByColumn.left, ...markersByColumn.right].sort((a, b) => a.index - b.index) };
}

function readSopRowText(items) {
  return normalizeExtractedSopText(items.map((item) => item.str).join(" "));
}

function getSopSourceBounds(items, fallbackY = 0) {
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const baselines = items.map((item) => item.y ?? fallbackY);
  const fontHeight = Math.max(6, ...items.map((item) => item.height ?? 0));
  const bottom = Math.min(...baselines);
  const top = Math.max(...baselines) + fontHeight;
  return { x: left, y: bottom, width: Math.max(1, right - left), height: Math.max(fontHeight, top - bottom) };
}

function extendSopSourceBounds(current, next) {
  if (!next) return current;
  if (!current) return { ...next };
  const x = Math.min(current.x, next.x);
  const y = Math.min(current.y, next.y);
  return {
    x,
    y,
    width: Math.max(current.x + current.width, next.x + next.width) - x,
    height: Math.max(current.y + current.height, next.y + next.height) - y,
  };
}

function hasUsefulSopText(value) {
  const text = normalizeExtractedSopText(value).replace(/^[\s([{"'¿¡]+/, "");
  return (text.match(/\p{L}/gu) ?? []).length >= 4;
}

function isUsefulSopInstruction(value) {
  const text = normalizeExtractedSopText(value).replace(/^[\s([{"'¿¡]+/, "");
  return hasUsefulSopText(text) && !/^\d/.test(text);
}

function appendSopContinuation(instruction, continuation) {
  const current = normalizeExtractedSopText(instruction);
  const next = normalizeExtractedSopText(continuation);
  if (!current) return next;
  if (!next) return current;
  if (current.endsWith("-")) {
    return normalizeExtractedSopText(`${/^[a-záéíóúüñ]/i.test(next) ? current.slice(0, -1) : current}${next}`);
  }
  return normalizeExtractedSopText(`${current} ${next}`);
}

function compareSopStepNumbers(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1);
    if (difference) return difference;
  }
  return 0;
}

function extractSopMetadata(text, fileName, sheetLabels) {
  const documentId = text.match(/#\s*Control\s*:\s*([A-Z0-9][A-Z0-9._-]+)/i)?.[1] ?? "";
  const revision = text.match(/\bRev\s*:\s*([A-Z0-9][A-Z0-9._-]*)/i)?.[1] ?? "1";
  const baseName = String(fileName ?? "SOP").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const totalSheets = Math.max(0, ...sheetLabels.map((label) => label.total));
  return {
    id: documentId || baseName || "SOP-NUEVA",
    title: baseName || "SOP nueva",
    revision,
    family: "",
    customer: "",
    station: "",
    stationAssignment: "",
    nodePartNumber: "",
    totalSheets,
  };
}

function extractSopPageSteps(items, viewport) {
  const rows = groupSopPdfRows(items).filter((row) => row.y > viewport.height * 0.12 && row.y < viewport.height * 0.9);
  const procedure = { steps: [] };
      const activeByColumn = { left: null, right: null };

      for (const row of rows) {
        const markersByColumn = readSopMarkersInRow(row, viewport.width);
        for (const column of ["left", "right"]) {
          const hasBothActiveColumns = activeByColumn.left && activeByColumn.right;
          const continuationBoundary = hasBothActiveColumns ? activeByColumn.right.startX - 30 : viewport.width * 0.44;
          const columnItems = row.items.filter((item) => column === "left" ? item.x < continuationBoundary : item.x >= continuationBoundary);
          const markers = markersByColumn[column];
          if (markers.length) {
            for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
              const marker = markers[markerIndex];
              const nextMarker = markersByColumn.all.find((candidate) => candidate.index > marker.index);
              const bodyItems = row.items.slice(marker.endIndex + 1, nextMarker?.index ?? row.items.length);
              const text = readSopRowText([{ str: marker.tail }, ...bodyItems]);
              if (!isUsefulSopInstruction(text)) continue;
              const step = {
                number: marker.id,
                text,
                sourceNote: "",
                images: [],
                sourceBounds: getSopSourceBounds([row.items[marker.index], ...bodyItems], row.y),
                sourceFormat: {
                  fontName: bodyItems[0]?.fontName ?? row.items[marker.index].fontName,
                  markerFontName: row.items[marker.index].fontName,
                  fontSize: Number((bodyItems[0]?.height ?? row.items[marker.index].height).toFixed(2)),
                  markerSuffix: String(row.items[marker.index].str).trim().match(/^\d+(?:\.\d+)*(\.?\s*-)/)?.[1]?.replace(/\s+/g, "") ?? ".-",
                },
              };
              procedure.steps.push(step);
              activeByColumn[column] = { step, y: row.y, startX: marker.x };
            }
            continue;
          }

          const active = activeByColumn[column];
          if (!active) continue;
          const lineGap = active.y - row.y;
          const continuationItems = columnItems.filter((item) => item.x >= active.startX - 30);
          const startX = continuationItems[0]?.x;
          if (lineGap <= 0 || lineGap > 18) {
            activeByColumn[column] = null;
            continue;
          }
          if (startX === undefined || startX > active.startX + 60) continue;
          const continuation = readSopRowText(continuationItems);
          if (hasUsefulSopText(continuation)) {
            active.step.text = appendSopContinuation(active.step.text, continuation);
            active.step.sourceBounds = extendSopSourceBounds(active.step.sourceBounds, getSopSourceBounds(continuationItems, row.y));
            active.y = row.y;
          }
        }
      }


  return procedure.steps;
}

async function extractSopPdfVersion(pdfFile, pdfjsOverride = null) {
  if (!pdfFile || (!String(pdfFile.name ?? "").toLowerCase().endsWith(".pdf") && pdfFile.type !== "application/pdf") || !pdfFile.size) {
    throw new Error("Selecciona un archivo PDF válido.");
  }
  const pdfjs = pdfjsOverride ?? await loadSopPdfJs();
  const assetRoot = new URL("./public/vendor/pdfjs/", globalThis.document.baseURI).href;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await pdfFile.arrayBuffer()),
    standardFontDataUrl: `${assetRoot}standard_fonts/`,
    cMapUrl: `${assetRoot}cmaps/`,
    cMapPacked: true,
    disableWorker: typeof window === "undefined",
    verbosity: pdfjs.VerbosityLevel?.ERROR,
  });
  const pdf = await loadingTask.promise;
  const extractedPages = [];
  const sheetLabels = [];
  const pageTexts = [];
  let readableCharacters = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const fullText = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
      pageTexts.push(fullText);
      readableCharacters += fullText.length;
      const label = fullText.match(/P[aá]gina\s*(\d+)\s*D\s*E\s*(\d+)/i);
      if (label) sheetLabels.push({ sheet: Number(label[1]), total: Number(label[2]) });
      const procedure = {
        id: `sheet-${label ? Number(label[1]) : pageNumber}`,
        sheet: label ? Number(label[1]) : pageNumber,
        pdfPage: pageNumber,
        category: "Procedimiento",
        title: `Hoja ${label ? Number(label[1]) : pageNumber}`,
        stepRange: "",
        partNumber: "",
        steps: [],
      };
      procedure.steps = extractSopPageSteps(content.items, viewport).filter((step) => step.text);
      if (procedure.steps.length) {
        procedure.steps.sort((a, b) => compareSopStepNumbers(a.number, b.number));
        procedure.stepRange = `${procedure.steps[0].number}–${procedure.steps.at(-1).number}`;
        extractedPages.push(procedure);
      }
    }
  } finally {
    await pdf.destroy();
  }

  const processPages = extractedPages.filter((procedure) => procedure.sheet >= 5);
  const procedures = processPages.length ? processPages : extractedPages;
  const stepCount = procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  if (!stepCount) {
    if (readableCharacters < 100) {
      throw new Error("El PDF parece escaneado o no contiene texto seleccionable. Guarda el mismo PDF con OCR de texto y vuelve a cargarlo.");
    }
    throw new Error("Se pudo leer el PDF, pero no se detectaron pasos con numeración y formato reconocibles. Revisa que sea la SOP controlada y no un escaneo sin OCR.");
  }

  const sopDocument = extractSopMetadata(pageTexts.join(" "), pdfFile.name, sheetLabels);
  const sheetNumbers = procedures.map((procedure) => procedure.sheet).sort((a, b) => a - b);
  const minSheet = sheetNumbers[0];
  const maxSheet = sheetNumbers.at(-1);
  sopDocument.totalSheets = Math.max(sopDocument.totalSheets, maxSheet);
  return {
    id: `sop-version-${crypto.randomUUID()}`,
    document: {
      ...sopDocument,
      processSheets: procedures.length,
      processSheetRange: `${minSheet}–${maxSheet}`,
      pdfPath: "",
    },
    pdf: { blob: pdfFile, name: pdfFile.name },
    procedures,
    createdAt: new Date().toISOString(),
    createdBy: getActiveLocalUser().name,
  };
}

function validateSopDraft(draft) {
  const version = structuredClone(draft);
  for (const workingField of ["sourceKind", "basedOnRevision", "deletedSteps"]) delete version[workingField];
  const document = version.document;
  if (!String(document.id ?? "").trim()) document.id = `SOP-DOC-${crypto.randomUUID()}`;
  for (const field of ["title", "revision"]) {
    if (!String(document[field] ?? "").trim()) throw new Error(`Completa el campo ${field === "title" ? "título" : "revisión"} del documento.`);
    document[field] = String(document[field]).trim();
  }
  if (document.stationMode === "custom") {
    document.stationAssignment = createCustomWorkStationAssignment(document.stationType, document.stationName);
  }
  if (!getWorkStationAssignment(document.stationAssignment)) {
    throw new Error("Selecciona una estación precargada o escribe el nombre de una estación personalizada.");
  }
  delete document.stationMode;
  delete document.stationType;
  delete document.stationName;

  const sheetNumbers = new Set();
  const procedures = version.procedures.filter((procedure) => procedure.steps.length).map((procedure, procedureIndex) => {
    const sheet = Number(procedure.sheet);
    if (!Number.isInteger(sheet) || sheet < 1) throw new Error(`La hoja ${procedureIndex + 1} requiere un número entero mayor que cero.`);
    if (sheetNumbers.has(sheet)) throw new Error(`Hay más de un procedimiento asignado a la hoja ${sheet}.`);
    sheetNumbers.add(sheet);
    const seenStepNumbers = new Set();
    const steps = procedure.steps.map((step, stepIndex) => {
      const number = String(step.number ?? "").trim();
      const text = String(step.text ?? "").trim();
      if (!number || !text) throw new Error(`Completa el número y el texto del paso ${stepIndex + 1} de la hoja ${sheet}.`);
      if (seenStepNumbers.has(number)) throw new Error(`El paso ${number} está repetido en la hoja ${sheet}.`);
      seenStepNumbers.add(number);
      return { ...step, number, text, images: step.images ?? [] };
    });
    steps.sort((a, b) => compareSopStepNumbers(a.number, b.number));
    const validStepNumbers = new Set(steps.map((step) => step.number));
    const annotations = (procedure.annotations ?? []).map((annotation, annotationIndex) => {
      const type = String(annotation.type ?? "");
      if (!["arrow", "box", "highlight", "number", "note", "text", "textfix"].includes(type)) throw new Error(`La anotación ${annotationIndex + 1} de la hoja ${sheet} tiene una herramienta desconocida.`);
      let stepNumber = String(annotation.stepNumber ?? "").trim();
      if (stepNumber && !validStepNumbers.has(stepNumber)) stepNumber = "";
      const style = {
        color: annotation.color === undefined ? undefined : sopAnnotationColor(annotation.color, ""),
        strokeWidth: annotation.strokeWidth === undefined ? undefined : Math.max(2, Math.min(30, Number(annotation.strokeWidth) || 8)),
        dash: annotation.dash === "dashed" ? "dashed" : undefined,
        opacity: annotation.opacity === undefined ? undefined : Math.max(0.1, Math.min(0.9, Number(annotation.opacity) || 0.38)),
      };
      for (const key of Object.keys(style)) if (style[key] === undefined || style[key] === "") delete style[key];
      if (type === "highlight") {
        const x = clampSopAnnotationCoordinate(annotation.x);
        const y = clampSopAnnotationCoordinate(annotation.y);
        return { ...annotation, ...style, type, stepNumber, x, y, width: Math.max(1, Math.min(1000 - x, clampSopAnnotationCoordinate(annotation.width))), height: Math.max(1, Math.min(1000 - y, clampSopAnnotationCoordinate(annotation.height))) };
      }
      if (type === "text") {
        const text = String(annotation.text ?? "").trim().slice(0, 300);
        if (!text) throw new Error(`El texto ${annotationIndex + 1} de la hoja ${sheet} está vacío.`);
        return { ...annotation, ...style, type, stepNumber, x: clampSopAnnotationCoordinate(annotation.x), y: clampSopAnnotationCoordinate(annotation.y), text, fontSize: Math.max(12, Math.min(120, Number(annotation.fontSize) || 30)), bold: Boolean(annotation.bold) };
      }
      if (type === "arrow") return {
        ...annotation,
        ...style,
        type,
        stepNumber,
        x1: clampSopAnnotationCoordinate(annotation.x1),
        y1: clampSopAnnotationCoordinate(annotation.y1),
        x2: clampSopAnnotationCoordinate(annotation.x2),
        y2: clampSopAnnotationCoordinate(annotation.y2),
      };
      if (type === "box") {
        const x = clampSopAnnotationCoordinate(annotation.x);
        const y = clampSopAnnotationCoordinate(annotation.y);
        return { ...annotation, ...style, type, stepNumber, x, y, width: Math.max(1, Math.min(1000 - x, clampSopAnnotationCoordinate(annotation.width))), height: Math.max(1, Math.min(1000 - y, clampSopAnnotationCoordinate(annotation.height))) };
      }
      if (type === "number") return { ...annotation, ...style, type, stepNumber, x: clampSopAnnotationCoordinate(annotation.x), y: clampSopAnnotationCoordinate(annotation.y), label: String(annotation.label ?? "1").slice(0, 4) };
      if (type === "textfix") {
        const x = clampSopAnnotationCoordinate(annotation.x);
        const y = clampSopAnnotationCoordinate(annotation.y);
        return {
          ...annotation, type, stepNumber, x, y,
          width: Math.max(1, Math.min(1000 - x, clampSopAnnotationCoordinate(annotation.width))),
          height: Math.max(1, Math.min(1000 - y, clampSopAnnotationCoordinate(annotation.height))),
          aspect: Math.max(0.2, Math.min(5, Number(annotation.aspect) || 1.294)),
          fontSize: Math.max(2, Math.min(60, Number(annotation.fontSize) || 8)),
          pitch: Math.max(2, Math.min(180, Number(annotation.pitch) || 10)),
          baselineX: clampSopAnnotationCoordinate(annotation.baselineX ?? x),
          baselineY: clampSopAnnotationCoordinate(annotation.baselineY ?? y),
          prefix: String(annotation.prefix ?? "").slice(0, 20),
          prefixBold: Boolean(annotation.prefixBold),
          fontFamily: String(annotation.fontFamily ?? "").replace(/[^A-Za-z0-9 -]/g, "").slice(0, 40),
          fontWeight: Number(annotation.fontWeight) >= 600 ? 700 : 400,
          fontStyle: annotation.fontStyle === "italic" ? "italic" : "normal",
          bg: /^#[0-9a-f]{6}$/i.test(String(annotation.bg)) ? annotation.bg : "#ffffff",
          ink: /^#[0-9a-f]{6}$/i.test(String(annotation.ink)) ? annotation.ink : "#000000",
          lines: (Array.isArray(annotation.lines) ? annotation.lines : []).slice(0, 40).map((line) => String(line).slice(0, 300)),
          text: String(annotation.text ?? "").slice(0, 600),
        };
      }
      const text = String(annotation.text ?? "").trim().slice(0, 200);
      if (!text) throw new Error(`La nota ${annotationIndex + 1} de la hoja ${sheet} necesita texto.`);
      return { ...annotation, ...style, type, stepNumber, x: clampSopAnnotationCoordinate(annotation.x), y: clampSopAnnotationCoordinate(annotation.y), text, fontSize: Math.max(12, Math.min(60, Number(annotation.fontSize) || 21)), width: Math.max(140, Math.min(700, Number(annotation.width) || 280)) };
    });
    if (annotations.length > 100) throw new Error(`La hoja ${sheet} no puede tener más de 100 anotaciones.`);
    return {
      ...procedure,
      id: `sheet-${sheet}`,
      sheet,
      title: String(procedure.title || `Hoja ${sheet}`).trim(),
      category: String(procedure.category || "Procedimiento").trim(),
      steps,
      annotations,
      ...(Number(procedure.pageAspect) > 0 ? { pageAspect: Math.max(0.2, Math.min(5, Number(procedure.pageAspect))) } : {}),
      stepRange: `${steps[0].number}–${steps.at(-1).number}`,
    };
  });
  if (!procedures.length) throw new Error("La SOP debe conservar al menos un paso de validación.");
  procedures.sort((a, b) => a.sheet - b.sheet);
  const sheets = procedures.map((procedure) => procedure.sheet);
  document.totalSheets = Math.max(Number(document.totalSheets) || 0, ...sheets);
  document.processSheets = procedures.length;
  document.processSheetRange = `${sheets[0]}–${sheets.at(-1)}`;
  version.procedures = procedures;
  return version;
}

function formatSopVersionDate(value) {
  if (!value) return "Incluida en el proyecto";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getSopVersionDeleteBlockReason(version, state) {
  return version.id === BUILT_IN_SOP_VERSION_ID
    ? "La SOP incluida en el sistema no es una revisión cargada para eliminar."
    : "";
}

function getSopCatalogAreaAssignments(state, type, preferredValue = "") {
  const assignments = getWorkStationAssignments(state).filter((entry) => entry.type === type);
  if (type !== "RWK") return assignments;
  const selected = assignments.find((entry) => entry.value === preferredValue)
    ?? assignments.find((entry) => entry.value === "RWK:RWK")
    ?? assignments[0];
  return selected ? [selected] : [];
}

function renderSopCatalog(state) {
  const allVersions = getAllSopVersions(state);
  const canEditCatalog = canManageSopVersions();
  const rows = allVersions.map((version, index) => {
    const workflowStatus = getSopVersionStatus(version);
    const isPublished = workflowStatus === "published";
    const stationAssignment = getSopVersionStationAssignment(state, version);
    const config = state.sopVersionCatalog?.[version.id] ?? { stationAssignment, enabled: false };
    const metadata = createSopVersionMetadata(version, version.id === BUILT_IN_SOP_VERSION_ID);
    const assignment = getWorkStationAssignment(config.stationAssignment);
    const currentType = assignment?.type ?? "MFG";
    const areaAssignments = getSopCatalogAreaAssignments(state, currentType, config.stationAssignment);
    const stationOptions = ["MFG", "RWK"].map((type) => `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`).join("");
    const areaOptions = areaAssignments.map((entry) => {
      const areaName = entry.type === "RWK" && !entry.custom ? "Desensamble" : entry.label;
      return `<option value="${escapeHtml(entry.value)}" ${entry.value === config.stationAssignment ? "selected" : ""}>${escapeHtml(areaName)}</option>`;
    }).join("");
    const infoPopoverId = `sop-info-${index}`;
    const deleteBlockReason = getSopVersionDeleteBlockReason(version, state);
    const versionActions = version.id === BUILT_IN_SOP_VERSION_ID
      ? `<div class="sop-catalog-actions"><div class="sop-catalog-action-buttons"><button class="text-button" type="button" data-action="edit-sop-version" data-version-id="${escapeHtml(version.id)}"><span class="material-symbols-rounded" aria-hidden="true">note_add</span>Crear nueva revisión</button>
        <button class="text-button sop-version-delete-button" type="button" disabled title="${escapeHtml(deleteBlockReason)}"><span class="material-symbols-rounded" aria-hidden="true">delete</span>Eliminar</button></div></div>`
      : `<div class="sop-catalog-actions"><div class="sop-catalog-action-buttons"><button class="text-button" type="button" data-action="edit-sop-version" data-version-id="${escapeHtml(version.id)}"><span class="material-symbols-rounded" aria-hidden="true">note_add</span>Crear nueva revisión</button>
        <button class="text-button sop-version-delete-button" type="button" data-action="delete-sop-version" data-version-id="${escapeHtml(version.id)}" ${deleteBlockReason || state.sopVersionBusy ? "disabled" : ""} title="${escapeHtml(deleteBlockReason || "Eliminar esta revisión guardada")}"><span class="material-symbols-rounded" aria-hidden="true">delete</span>Eliminar</button></div>
        ${deleteBlockReason ? `<small class="sop-version-delete-blocked">${escapeHtml(deleteBlockReason)}</small>` : ""}</div>`;
    return `<article class="sop-catalog-row ${config.enabled ? "is-enabled" : ""}" role="row" data-sop-catalog-row="${escapeHtml(version.id)}" data-sop-catalog-document-id="${escapeHtml(version.document.id)}">
      <div class="sop-catalog-sop-cell" role="cell"><span class="sop-catalog-file-icon material-symbols-rounded" aria-hidden="true">description</span><div class="sop-catalog-copy"><strong class="sop-catalog-title">${escapeHtml(metadata.title)}</strong><div class="sop-catalog-revision-line"><span class="sop-catalog-revision">Rev. ${escapeHtml(metadata.revision)}</span><button class="sop-catalog-info-trigger material-symbols-rounded" type="button" popovertarget="${infoPopoverId}" aria-label="Ver información de ${escapeHtml(metadata.title)}" title="Información de la SOP">help</button></div><div id="${infoPopoverId}" class="sop-catalog-info-panel" popover="auto"><div class="sop-catalog-info-heading"><strong>Información de la SOP</strong><button class="material-symbols-rounded" type="button" popovertarget="${infoPopoverId}" popovertargetaction="hide" aria-label="Cerrar información">close</button></div><dl><div><dt>Documento</dt><dd>${escapeHtml(metadata.documentId)}</dd></div><div><dt>Hojas</dt><dd>${metadata.sheetCount}</dd></div><div><dt>Procedimientos</dt><dd>${metadata.procedureCount}</dd></div><div><dt>Pasos</dt><dd>${metadata.stepCount}</dd></div><div><dt>Fecha de carga</dt><dd>${escapeHtml(formatSopVersionDate(metadata.createdAt))}</dd></div><div><dt>Responsable</dt><dd>${escapeHtml(metadata.createdBy)}</dd></div><div class="sop-catalog-info-file"><dt>Archivo PDF</dt><dd>${escapeHtml(metadata.pdfName || "Sin nombre de archivo")}</dd></div></dl></div></div></div>
      <label class="sop-catalog-area" role="cell"><small class="sop-catalog-mobile-label">Área</small><select aria-label="Área de ${escapeHtml(metadata.title)}" data-sop-catalog-type ${canEditCatalog ? "" : "disabled"}>${stationOptions}</select></label>
      <label class="sop-catalog-station" role="cell"><span class="sop-catalog-mobile-label">Estación</span><select aria-label="Estación de ${escapeHtml(metadata.title)}" data-sop-catalog-station data-previous-value="${escapeHtml(config.stationAssignment ?? "")}" ${canEditCatalog ? "" : "disabled"}><option value="">Selecciona estación</option>${areaOptions}<option value="__custom__">✎ Modificar estación…</option></select></label>
      <label class="sop-catalog-enabled" role="cell"><input type="checkbox" data-sop-catalog-enabled aria-label="Disponibilidad de ${escapeHtml(metadata.title)} · Rev. ${escapeHtml(metadata.revision)}" ${config.enabled ? "checked" : ""} ${config.stationAssignment && isPublished && canEditCatalog ? "" : "disabled"} ${isPublished ? "" : 'title="Solo se habilita una revisión publicada"'} /></label>
      <div class="sop-catalog-status-cell ${config.enabled && isPublished ? "is-enabled" : ""}" role="cell" data-sop-catalog-status>${isPublished ? `<strong>${config.enabled ? "Habilitada" : "Deshabilitada"}</strong>` : renderSopStatusChip(version)}</div>
      <div role="cell">${canEditCatalog ? versionActions : ""}${renderSopWorkflowActionsCell(version)}</div>
    </article>`;
  }).join("");

  return `<section class="sop-catalog-manager" aria-labelledby="sop-catalog-title">
    <div class="sop-catalog-heading"><div><p class="eyebrow">CATÁLOGO PARA OPERADORES</p><h3 id="sop-catalog-title">Estación y disponibilidad de cada SOP</h3></div><span class="material-symbols-rounded" aria-hidden="true">tune</span></div>
    <p>Cada archivo tiene una estación asignada. Habilita únicamente las SOP que deban aparecer al operador; puedes cambiar la estación o deshabilitar una revisión cuando lo necesites.</p>
    <form id="sop-catalog-form"><div class="sop-catalog-table" role="table" aria-label="SOP registradas por área, estación, disponibilidad y status"><div class="sop-catalog-table-head" role="row"><span role="columnheader">SOP / Revisión</span><span role="columnheader">Área</span><span role="columnheader">Estación</span><span role="columnheader">Disponibilidad</span><span role="columnheader">Status</span><span role="columnheader">Acciones</span></div><div class="sop-catalog-list" role="rowgroup">${rows || '<p class="sop-catalog-empty">Todavía no hay SOP guardadas.</p>'}</div></div><div class="sop-catalog-save-bar" ${state.sopCatalogDirty && canEditCatalog ? "" : "hidden"}><button class="button button--primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">save</span>Guardar estaciones y disponibilidad</button></div></form>
  </section>`;
}

function renderSopVersionManager(state) {
  if (!canAccessSopAdmin()) return '<section class="sop-version-panel"><h2>Acceso no disponible</h2></section>';
  if (state.sopReview) {
    const reviewScreen = renderSopReviewScreen(state);
    if (reviewScreen) return reviewScreen;
    state.sopReview = null;
  }
  if (state.sopDraft && canUploadSop()) return renderSopRevisionFlow(state);
  const error = state.sopDraftError ? `<p class="form-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : "";
  return `<section class="sop-version-panel" aria-labelledby="sop-version-title"><div class="sop-version-manager-header"><div class="section-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">rule_settings</span><div><p class="eyebrow sop-version-access-badge"><span class="material-symbols-rounded" aria-hidden="true">admin_panel_settings</span>${escapeHtml(describeSopFunctions())}</p><h2 id="sop-version-title">Modificar SOP</h2></div></div></div>
    ${canUploadSop() ? `    <form class="sop-version-form sop-version-upload-form" id="sop-version-upload-form"><input class="sop-pdf-native-input" name="pdf" type="file" accept="application/pdf,.pdf" aria-label="Seleccionar archivo PDF de la SOP" />
      <div class="sop-version-actions"><button class="button button--outlined" type="button" data-action="choose-sop-pdf" ${state.sopVersionBusy || state.sopDraft ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">upload_file</span>Subir SOP PDF</button><button class="button button--primary" type="submit" ${state.sopVersionBusy || !state.sopUploadFile || state.sopDraft ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.sopVersionBusy ? "hourglass_top" : "manage_search"}</span>${state.sopVersionBusy ? "Extrayendo SOP…" : "Extraer SOP"}</button><small data-sop-pdf-name>${escapeHtml(state.sopDraft?.pdf?.name || state.sopUploadFile?.name || state.sopUploadFileName || "Selecciona un archivo PDF")}</small></div>
      ${error}</form>` : ""}</div>
    ${renderSopInbox(state)}
    ${canUploadSop() || canManageSopVersions() ? renderSopCatalog(state) : ""}
    <p class="sop-version-warning">Las revisiones, estaciones y disponibilidad se guardan en el servidor y las ven todos los equipos. Las evidencias anteriores conservan la versión utilizada.</p>
  </section>`;
}

function bindSopVersionInteractions(app, { state, render, showToast }) {
  bindSopRevisionFlow(app, { state, render, showToast });
  bindSopReview(app, { state, render, showToast });
  bindSopReviewMarks(app, { state, render, showToast });
  app.addEventListener("input", (event) => {
    if (!canUploadSop() || !state.sopDraft) return;
    if (state.sopDraftError) {
      state.sopDraftError = "";
      app.querySelector(".sop-version-panel .form-error")?.remove();
    }
    const documentField = event.target.dataset.sopDocumentField;
    if (documentField) {
      state.sopDraft.document[documentField] = event.target.value;
      return;
    }
    if (event.target.matches("[data-sop-station-custom]")) {
      state.sopDraft.document.stationName = event.target.value;
      return;
    }
  });

  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    if (action.dataset.action === "choose-sop-pdf") {

      if (state.sopVersionBusy) return;
      if (state.sopDraft) {
        showToast("Guarda o cancela la revisión actual antes de seleccionar otro PDF.", "warning");
        return;
      }
      const fileInput = app.querySelector("#sop-version-upload-form input[name=pdf]");
      if (!fileInput) {
        showToast("No se encontró el selector de archivos PDF.", "warning");
        return;
      }
      try {
        if (typeof fileInput.showPicker === "function") fileInput.showPicker();
        else fileInput.click();
      } catch {
        try {
          fileInput.click();
        } catch {
          showToast("El navegador no pudo abrir el selector de PDF. Revisa los permisos de archivos del navegador.", "warning");
        }
      }
    } else if (action.dataset.action === "cancel-sop-version-draft") {
      if (!canUploadSop() || !state.sopDraft || state.sopVersionBusy) return;
      cancelSopRevisionDraft();
    } else if (action.dataset.action === "delete-sop-version") {
      if (!canUploadSop() || state.sopVersionBusy) return;
      const version = state.sopVersionHistory.find((entry) => entry.id === action.dataset.versionId);
      if (!version) {
        showToast("No se encontró la revisión que quieres eliminar.", "warning");
        render();
        return;
      }
      const blockReason = getSopVersionDeleteBlockReason(version, state);
      if (blockReason) {
        showToast(blockReason, "warning");
        return;
      }
      state.sopVersionBusy = true;
      const deletingActiveVersion = state.sopVersionMeta?.id === version.id;
      render();
      try {
        await deleteStoredSopVersion(version.id);
        const nextCatalog = { ...state.sopVersionCatalog };
        delete nextCatalog[version.id];
        state.sopVersionCatalog = nextCatalog;
        state.sopVersionHistory = await listStoredSopVersions();
        if (deletingActiveVersion) {
          applyBuiltInSopVersion(state);
          state.operatorFlowReady = false;
          state.activeWorkId = "";
        }
        state.sopVersionBusy = false;
        recordLocalAuditEvent("sop_version_deleted", { details: `Rev. ${version.document.revision} · ${version.document.id}` });
        showToast(`SOP Rev. ${version.document.revision} eliminada del catálogo.`);
        render();
      } catch (error) {
        state.sopVersionBusy = false;
        showToast(error?.message || "No se pudo eliminar la revisión guardada.", "warning");
        render();
      }
    } else if (action.dataset.action === "edit-sop-version") {
      if (!canUploadSop() || state.sopVersionBusy) return;
      if (state.sopDraft) {
        showToast("Guarda o descarta la edición actual antes de abrir otra revisión.", "warning");
        return;
      }
      const versionId = action.dataset.versionId;
      const source = versionId === BUILT_IN_SOP_VERSION_ID
        ? BUILT_IN_SOP_VERSION
        : state.sopVersionHistory.find((entry) => entry.id === versionId);
      if (!source) {
        showToast("No se encontró la revisión que quieres editar.", "warning");
        return;
      }
      state.sopDraft = structuredClone(source);
      state.sopDraft.id = `sop-version-${crypto.randomUUID()}`;
      state.sopDraft.document.stationAssignment = getSopVersionStationAssignment(state, source);
      const sourceStation = getWorkStationAssignment(state.sopDraft.document.stationAssignment);
      state.sopDraft.document.stationType = sourceStation?.type ?? "MFG";
      state.sopDraft.document.stationMode = "existing";
      state.sopDraft.document.stationName = "";
      state.sopDraft.document = { ...state.sopDraft.document, revision: "" };
      state.sopDraft.createdAt = new Date().toISOString();
      state.sopDraft.createdBy = getActiveLocalUser().name;
      state.sopDraft.sourceKind = "revision";
      state.sopDraft.basedOnRevision = source.document.revision;
      state.sopDraftStage = 1;
      state.sopFlowShowAll = false;
      state.sopDraftError = "";
      state.sopDraftNotice = "Captura el número de la nueva revisión y confirma su estación. La revisión nueva quedará deshabilitada hasta que la habilites.";
      state.activeSection = "sop-admin";
      render();
      document.querySelector('[data-sop-document-field="revision"]')?.focus();
    } else if (action.dataset.action === "publish-sop-version") {
      if (!canUploadSop() || !state.sopDraft) return;
      try {
        cleanupSopWorkspaceDraft(state.sopDraft);
        const draftSummary = summarizeSopDraftChanges(state.sopDraft);
        state.sopDraft = validateSopDraft(state.sopDraft);
        state.sopDraft.changeSummary = { total: draftSummary.rows.length, stepRows: draftSummary.stepRows, markRows: draftSummary.markRows, rows: draftSummary.rows.slice(0, 300) };
      } catch (error) {
        state.sopDraftError = error?.message || "Corrige los campos incompletos antes de guardar.";
        render();
        return;
      }
      state.sopVersionBusy = true;
      render();
      try {
        const version = state.sopDraft;
        await saveSopVersion(version);
        const nextCatalog = {
          ...state.sopVersionCatalog,
          [version.id]: { stationAssignment: version.document.stationAssignment, enabled: false },
        };
        await saveStoredSopCatalog(nextCatalog);
        state.sopVersionCatalog = nextCatalog;
        state.sopVersionHistory = await listStoredSopVersions();
        state.sopDraft = null;
        state.sopDraftStage = 1;
        state.sopDraftError = "";
        state.sopDraftNotice = "";
        state.sopUploadFileName = "";
        state.sopVersionBusy = false;
        recordLocalAuditEvent(version.resubmit ? "sop_version_resubmitted" : "sop_version_submitted", { details: `Rev. ${version.document.revision} · ${version.document.id} · ${version.document.stationAssignment}` });
        showToast(version.resubmit
          ? `Rev. ${version.document.revision} corregida y reenviada a revisión. El revisor la verá en su bandeja.`
          : `Rev. ${version.document.revision} enviada a revisión. Otra persona debe revisarla y una tercera publicarla antes de habilitarla.`);
      } catch (error) {
        state.sopVersionBusy = false;
        state.sopDraftError = error?.message || "No se pudo guardar la revisión en el servidor.";
        render();
      }
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("#sop-version-upload-form input[name=pdf]")) {
      const selectedFile = event.target.files?.[0];
      const fileName = app.querySelector("[data-sop-pdf-name]");
      if (selectedFile && !state.sopVersionBusy) {
        if (state.sopDraft) {
          showToast("Guarda o cancela la revisión actual antes de seleccionar otro PDF.", "warning");
          event.target.value = "";
          return;
        }
        state.sopUploadFile = selectedFile;
        state.sopUploadFileName = selectedFile.name;
        if (fileName) fileName.textContent = selectedFile.name;
        state.sopDraftError = "";
        app.querySelector("#sop-version-upload-form button[type=submit]")?.removeAttribute("disabled");
        app.querySelector("#sop-version-upload-form .form-error")?.remove();
      }
      return;
    }
    if (event.target.matches("[data-sop-station-type]")) {
      if (!canUploadSop() || !state.sopDraft) return;
      const type = event.target.value;
      const assignment = getWorkStationAssignments(state).find((entry) => entry.type === type);
      state.sopDraft.document.stationType = type;
      state.sopDraft.document.stationMode = "existing";
      state.sopDraft.document.stationName = "";
      state.sopDraft.document.stationAssignment = assignment?.value ?? "";
      render();
      return;
    }
    if (event.target.matches("[data-sop-station-assignment]")) {
      if (!canUploadSop() || !state.sopDraft) return;
      const value = event.target.value;
      const document = state.sopDraft.document;
      if (value === "__custom__") {
        document.stationMode = "custom";
        document.stationType ||= getWorkStationAssignment(document.stationAssignment)?.type ?? "MFG";
        document.stationAssignment = "";
        document.stationName = "";
      } else {
        const assignment = getWorkStationAssignment(value);
        document.stationMode = "existing";
        document.stationAssignment = assignment?.value ?? "";
        document.stationType = assignment?.type ?? document.stationType ?? "MFG";
        document.stationName = "";
      }
      render();
      return;
    }
    if (event.target.matches("[data-sop-catalog-type]")) {
      const row = event.target.closest("[data-sop-catalog-row]");
      const areaSelect = row?.querySelector("[data-sop-catalog-station]");
      if (!row || !areaSelect) return;
      const currentAssignment = areaSelect.value;
      const current = getWorkStationAssignment(currentAssignment);
      const preferredValue = current?.type === event.target.value ? currentAssignment : "";
      const areaAssignments = getSopCatalogAreaAssignments(state, event.target.value, preferredValue);
      areaSelect.replaceChildren(new Option("Selecciona estación", ""));
      for (const assignment of areaAssignments) {
        const areaName = assignment.type === "RWK" && !assignment.custom ? "Desensamble" : assignment.label;
        areaSelect.add(new Option(areaName, assignment.value));
      }
      areaSelect.value = (areaAssignments.find((entry) => entry.value === preferredValue) ?? areaAssignments[0])?.value ?? "";
      areaSelect.add(new Option("✎ Modificar estación…", "__custom__"));
      areaSelect.dataset.previousValue = areaSelect.value;
    }
    if (event.target.matches("[data-sop-catalog-station]") && event.target.value === "__custom__") {
      const select = event.target;
      const type = select.closest("[data-sop-catalog-row]")?.querySelector("[data-sop-catalog-type]")?.value ?? "MFG";
      const previous = select.dataset.previousValue ?? "";
      const previousAssignment = getWorkStationAssignment(previous);
      select.value = previous;
      openStationNameDialog(type, previousAssignment?.custom ? previousAssignment.label : "", (typedName) => {
        const customValue = createCustomWorkStationAssignment(type, typedName);
        if (!customValue) {
          showToast("Escribe un nombre de estación de hasta 80 caracteres.", "warning");
          return false;
        }
        if (![...select.options].some((option) => option.value === customValue)) {
          select.add(new Option(typedName.trim(), customValue), select.querySelector('option[value="__custom__"]'));
        }
        select.value = customValue;
        select.dataset.previousValue = customValue;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      });
      return;
    }
    if (event.target.matches("[data-sop-catalog-station]")) event.target.dataset.previousValue = event.target.value;
    if (!event.target.matches("[data-sop-catalog-type], [data-sop-catalog-station], [data-sop-catalog-enabled]")) return;
    const row = event.target.closest("[data-sop-catalog-row]");
    const stationSelect = row?.querySelector("[data-sop-catalog-station]");
    const enabledToggle = row?.querySelector("[data-sop-catalog-enabled]");
    const status = row?.querySelector("[data-sop-catalog-status]");
    if (!row || !stationSelect || !enabledToggle) return;
    if (event.target.matches("[data-sop-catalog-enabled]") && enabledToggle.checked) {
      for (const otherRow of app.querySelectorAll(`[data-sop-catalog-document-id="${CSS.escape(row.dataset.sopCatalogDocumentId)}"]`)) {
        if (otherRow === row) continue;
        const otherToggle = otherRow.querySelector("[data-sop-catalog-enabled]");
        if (otherToggle) otherToggle.checked = false;
        const otherStatus = otherRow.querySelector("[data-sop-catalog-status]");
        if (otherStatus) {
          otherStatus.querySelector("strong").textContent = "Deshabilitada";
          otherStatus.classList.remove("is-enabled");
        }
        otherRow.classList.remove("is-enabled");
      }
    }
    if (event.target.matches("[data-sop-catalog-station]") && !stationSelect.value) enabledToggle.checked = false;
    enabledToggle.disabled = !stationSelect.value;
    if (status) {
      status.classList.toggle("is-enabled", enabledToggle.checked);
      status.querySelector("strong").textContent = enabledToggle.checked ? "Habilitada" : "Deshabilitada";
    }
    row.classList.toggle("is-enabled", enabledToggle.checked);
    state.sopCatalogDirty = true;
    const saveBar = app.querySelector(".sop-catalog-save-bar");
    if (saveBar) saveBar.hidden = false;
  });

  app.addEventListener("submit", async (event) => {
    if (event.target.matches("#sop-catalog-form")) {
      event.preventDefault();
      if (!canManageSopVersions()) return;
      const allVersions = getAllSopVersions(state);
      const nextCatalog = {};
      const changedVersionAssignments = [];
      for (const row of event.target.querySelectorAll("[data-sop-catalog-row]")) {
        const versionId = row.dataset.sopCatalogRow;
        const version = allVersions.find((entry) => entry.id === versionId);
        const stationAssignment = row.querySelector("[data-sop-catalog-station]")?.value ?? "";
        const enabled = Boolean(row.querySelector("[data-sop-catalog-enabled]")?.checked);
        if (!version) continue;
        if (enabled && !getWorkStationAssignment(stationAssignment)) {
          showToast(`Selecciona una estación para ${version.document.title} antes de habilitarla.`, "warning");
          return;
        }
        nextCatalog[versionId] = { stationAssignment, enabled: enabled && Boolean(stationAssignment) };
        if (version.id !== BUILT_IN_SOP_VERSION_ID && version.document.stationAssignment !== stationAssignment) {
          changedVersionAssignments.push({
            ...version,
            document: { ...version.document, stationAssignment },
          });
        }
      }
      try {
        for (const version of changedVersionAssignments) await saveSopVersion(version);
        await saveStoredSopCatalog(nextCatalog);
        state.sopVersionCatalog = nextCatalog;
        state.sopVersionHistory = await listStoredSopVersions();
        state.sopCatalogDirty = false;
        const details = allVersions.map((version) => {
          const config = nextCatalog[version.id];
          const station = formatWorkStationAssignment(config?.stationAssignment) || "sin estación";
          return `${version.document.id} Rev. ${version.document.revision}: ${config?.enabled ? `habilitada en ${station}` : `deshabilitada · ${station}`}`;
        }).join(" · ");
        recordLocalAuditEvent("sop_catalog_updated", { details });
        showToast("Catálogo de SOP actualizado. Los operadores verán solo las SOP habilitadas para su estación.");
        render();
      } catch (error) {
        showToast(error?.message || "No se pudo guardar el catálogo de SOP.", "warning");
      }
      return;
    }
    if (!event.target.matches("#sop-version-upload-form")) return;
    event.preventDefault();
    if (!canUploadSop() || state.sopVersionBusy || state.sopDraft) return;
    const form = event.target;
    const pdfFile = state.sopUploadFile ?? form.elements.namedItem("pdf").files?.[0];
    if (!pdfFile) {
      state.sopDraftError = "Selecciona un archivo PDF antes de extraer la SOP.";
      render();
      return;
    }
    state.sopVersionBusy = true;
    state.sopDraftError = "";
    state.sopDraftNotice = "";
    render();
    try {
      state.sopDraft = await extractSopPdfVersion(pdfFile);
      state.sopDraft.sourceKind = "pdf";
      state.sopDraftStage = 1;
      state.sopFlowShowAll = false;
      state.sopDraftError = "";
    } catch (error) {
      state.sopDraft = null;
      state.sopDraftError = error?.message || "No se pudo validar el archivo de SOP.";
    }
    state.sopUploadFile = null;
    state.sopUploadFileName = "";
    state.sopVersionBusy = false;
    render();
  });
}
