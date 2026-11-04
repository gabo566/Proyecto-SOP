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

function renderSopVersionPreview(version, state) {
  const stepCount = version.procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  const currentAssignment = getWorkStationAssignment(version.document.stationAssignment);
  const stationType = version.document.stationType ?? currentAssignment?.type ?? "MFG";
  const stationMode = version.document.stationMode ?? "existing";
  const stationName = version.document.stationName ?? (currentAssignment?.custom ? currentAssignment.label : "");
  const stationOptions = getWorkStationAssignments(state)
    .filter((assignment) => assignment.type === stationType)
    .map((assignment) => `<option value="${escapeHtml(assignment.value)}" ${assignment.value === version.document.stationAssignment && stationMode !== "custom" ? "selected" : ""}>${escapeHtml(assignment.label)}${assignment.custom ? " · personalizada" : ""}</option>`)
    .join("");
  const customSelected = stationMode === "custom";
  const procedureEditors = version.procedures.map((procedure, procedureIndex) => `<details class="sop-version-procedure" ${procedureIndex === 0 ? "open" : ""}>
    <summary><strong>Hoja ${escapeHtml(procedure.sheet)} · ${escapeHtml(procedure.title)}</strong><span>${procedure.steps.length} pasos</span></summary>
    <div class="sop-version-sheet-editor-heading"><label class="sop-version-sheet-title">Nombre de la hoja<input type="text" data-procedure-index="${procedureIndex}" data-procedure-field="title" value="${escapeHtml(procedure.title)}" /></label>
      <div class="sop-version-sheet-tools"><small data-sop-annotation-count="${procedureIndex}">${(procedure.annotations ?? []).length} anotaciones</small><button class="icon-button sop-version-sheet-preview-trigger" type="button" data-action="preview-sop-sheet" data-procedure-index="${procedureIndex}" aria-label="Vista previa y anotaciones de la hoja ${escapeHtml(procedure.sheet)}" title="Vista previa y anotar hoja"><span class="material-symbols-rounded" aria-hidden="true">draw</span></button></div></div>
    <ol class="sop-version-step-editor">${procedure.steps.map((step, stepIndex) => `<li${procedureIndex === 0 && stepIndex === 0 ? ' class="is-current"' : ""}>
      <label class="sop-step-number"><input type="text" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" data-step-field="number" value="${escapeHtml(step.number)}" aria-label="Número del paso" title="Número del paso" /></label>
      <textarea rows="2" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" data-step-field="text" aria-label="Instrucción del paso ${escapeHtml(step.number)}" placeholder="Texto del paso">${escapeHtml(step.text)}</textarea>
      <div class="sop-step-tools"><span class="sop-step-chip" data-sop-step-chip data-state="${getSopStepMark(step)}" title="${getSopStepMark(step) === "saved" ? "Guardado" : "Editado"}" ${getSopStepMark(step) ? "" : "hidden"}><span class="material-symbols-rounded" data-sop-step-chip-icon aria-hidden="true">edit</span><span data-sop-step-chip-label>Editado</span></span>
        <button class="sop-step-btn sop-step-save" type="button" data-action="save-sop-step" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" title="Guardar paso y continuar" aria-label="Guardar paso ${escapeHtml(step.number)} y continuar"><span class="material-symbols-rounded" aria-hidden="true">check</span>Guardar paso</button>
        <button class="sop-step-btn sop-step-restore" type="button" data-action="restore-sop-step" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" title="Restaurar el texto original" aria-label="Restaurar el texto original del paso ${escapeHtml(step.number)}" ${isSopStepEdited(step) ? "" : "hidden"}><span class="material-symbols-rounded" aria-hidden="true">undo</span>Restaurar</button>
        <button class="sop-step-btn sop-version-delete-step" type="button" data-action="delete-sop-step" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" title="Eliminar paso" aria-label="Eliminar paso ${escapeHtml(step.number)} de la hoja ${escapeHtml(procedure.sheet)}"><span class="material-symbols-rounded" aria-hidden="true">delete</span>Eliminar</button></div></li>`).join("")}</ol>
    <div class="sop-sheet-actions"><button class="sop-sheet-add" type="button" data-action="add-sop-step" data-procedure-index="${procedureIndex}"><span class="material-symbols-rounded" aria-hidden="true">add_circle</span>Añadir paso a esta hoja</button><button class="sop-sheet-save" type="button" data-action="save-sop-sheet" data-procedure-index="${procedureIndex}" title="Guardar los pasos de esta hoja y cerrarla"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span>Guardar información de pasos</button></div>
  </details>`).join("");
  return `<section class="sop-version-preview" aria-labelledby="sop-version-preview-title"><div class="sop-version-preview-heading"><div class="sop-version-preview-heading-copy"><h3 id="sop-version-preview-title"><span class="material-symbols-rounded" aria-hidden="true">fact_check</span>Revisa y corrige la extracción automática</h3>
      <p class="sop-version-preview-description">Se detectaron ${stepCount} pasos en ${version.procedures.length} hojas. Corrige números o textos, elimina falsos positivos y agrega pasos omitidos antes de guardar la revisión.</p>
      <div class="sop-review-stats"><span class="sop-review-chip"><span class="material-symbols-rounded" aria-hidden="true">list_alt</span>${stepCount} pasos</span><span class="sop-review-chip"><span class="material-symbols-rounded" aria-hidden="true">description</span>${version.procedures.length} hojas</span><span class="sop-review-chip sop-review-chip--edited"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><span data-sop-edited-count>0 textos editados</span></span><span class="sop-review-chip sop-review-chip--saved"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span><span data-sop-reviewed-count>0 revisados</span></span></div></div></div>
    <div class="sop-workspace-launch"><div><strong>Editor visual de la hoja</strong><small>Trabaja sobre la hoja completa con herramientas de anotación, deshacer y exportación.</small></div><button class="button button--primary" type="button" data-action="open-sop-workspace" data-sop-workspace-open><span class="material-symbols-rounded" aria-hidden="true">draw</span>Abrir editor visual</button></div>
    <div class="sop-version-document-fields"><label>Nombre de la SOP<input type="text" data-sop-document-field="title" value="${escapeHtml(version.document.title)}" /></label>
      <label>Revisión<input type="text" data-sop-document-field="revision" value="${escapeHtml(version.document.revision)}" placeholder="Captura la nueva revisión" /></label>
      <label>Área<select data-sop-station-type><option value="MFG" ${stationType === "MFG" ? "selected" : ""}>MFG · Manufactura</option><option value="RWK" ${stationType === "RWK" ? "selected" : ""}>RWK · Retrabajo</option></select></label>
      <label>Estación<select data-sop-station-assignment><option value="">Selecciona una estación</option>${stationOptions}<option value="__custom__" ${customSelected ? "selected" : ""}>Otra estación…</option></select></label>
      ${customSelected ? `<label>Nombre de la estación<input type="text" data-sop-station-custom value="${escapeHtml(stationName)}" placeholder="Escribe el nombre de la estación" maxlength="80" autocomplete="off" /></label>` : ""}</div>
    <div class="sop-review-layout"><div class="sop-version-procedures">${procedureEditors}</div>
    <aside class="sop-inline-preview" id="sop-inline-preview" data-procedure-index="0" data-step-index="0" data-zoom="1" data-edit="0" aria-label="Vista previa de la hoja">
      <div class="sop-inline-preview-head"><div><p class="eyebrow"><span class="material-symbols-rounded" aria-hidden="true">visibility</span>VISTA PREVIA</p><h4 data-sop-inline-label></h4></div>
        <div class="sop-inline-toolbar" role="toolbar" aria-label="Controles de la vista previa">
          <button type="button" class="sop-tool-button" data-action="inline-prev-step" title="Paso anterior" aria-label="Paso anterior"><span class="material-symbols-rounded" aria-hidden="true">navigate_before</span></button>
          <button type="button" class="sop-tool-button" data-action="inline-next-step" title="Paso siguiente" aria-label="Paso siguiente"><span class="material-symbols-rounded" aria-hidden="true">navigate_next</span></button>
          <span class="sop-tool-divider" aria-hidden="true"></span>
          <button type="button" class="sop-tool-button" data-action="inline-zoom-out" title="Alejar" aria-label="Alejar"><span class="material-symbols-rounded" aria-hidden="true">zoom_out</span></button>
          <span class="sop-zoom-label" data-sop-zoom-label aria-live="polite">100%</span>
          <button type="button" class="sop-tool-button" data-action="inline-zoom-in" title="Acercar" aria-label="Acercar"><span class="material-symbols-rounded" aria-hidden="true">zoom_in</span></button>
          <button type="button" class="sop-tool-button" data-action="inline-zoom-area" aria-pressed="false" title="Acercar a una zona: dibuja un recuadro sobre la hoja" aria-label="Acercar a una zona"><span class="material-symbols-rounded" aria-hidden="true">fit_screen</span></button>
          <span class="sop-tool-divider" aria-hidden="true"></span>
          <button type="button" class="sop-tool-button sop-tool-button--edit" data-action="inline-toggle-edit" aria-pressed="false" title="Editar texto haciendo clic sobre la hoja" aria-label="Editar texto sobre la hoja"><span class="material-symbols-rounded" aria-hidden="true">edit_note</span></button>
          <button type="button" class="sop-tool-button" data-action="preview-sop-sheet" data-procedure-index="0" data-sop-inline-annotate title="Ampliar y anotar" aria-label="Ampliar y anotar"><span class="material-symbols-rounded" aria-hidden="true">open_in_full</span></button>
        </div></div>
      <p class="sop-edit-banner" role="status"><span class="material-symbols-rounded" aria-hidden="true">ads_click</span>Modo edición: haz clic sobre cualquier texto de la hoja para corregirlo.</p>
      <p class="sop-zoom-banner" role="status"><span class="material-symbols-rounded" aria-hidden="true">crop_free</span>Arrastra un recuadro sobre la zona que quieres ver de cerca.</p>
      <div class="sop-draft-preview-page"><div class="sop-annotation-canvas-wrap"><canvas data-sop-preview-canvas hidden></canvas>${renderSopAnnotationOverlay(version.procedures[0]?.annotations ?? [], false)}</div><p class="sop-draft-preview-status" data-sop-preview-status>Cargando hoja…</p></div>
      <div class="sop-inline-preview-card" data-sop-inline-card></div>
      <section class="sop-sheet-editor" data-sop-sheet-editor hidden>
        <header><span class="material-symbols-rounded" aria-hidden="true">edit_note</span><strong data-sop-sheet-editor-title>Editar texto</strong></header>
        <textarea rows="3" data-sop-sheet-editor-text aria-label="Texto corregido"></textarea>
        <div class="sop-sheet-editor-actions"><button type="button" class="text-button" data-action="sheet-editor-restore"><span class="material-symbols-rounded" aria-hidden="true">undo</span>Restaurar original</button><button type="button" class="button button--primary" data-action="sheet-editor-close"><span class="material-symbols-rounded" aria-hidden="true">check</span>Listo</button></div>
      </section>
      <p class="sop-draft-preview-hint"><span class="material-symbols-rounded" aria-hidden="true">info</span>Acerca la hoja con los botones o Ctrl + rueda y arrástrala para moverte. El texto corregido se dibuja con la misma letra del documento.</p>
    
    <dialog class="sop-draft-preview-dialog" id="sop-draft-preview-dialog" aria-labelledby="sop-draft-preview-title">
      <div class="sop-draft-preview-content"><header class="sop-draft-preview-header"><div><p class="eyebrow">VISTA PREVIA DE SOP</p><h3 id="sop-draft-preview-title">Hoja de la SOP</h3></div>
        <div class="sop-draft-preview-navigation"><button class="icon-button" type="button" data-action="preview-sop-previous-sheet" aria-label="Hoja anterior"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span></button><span data-sop-preview-sheet-label></span><button class="icon-button" type="button" data-action="preview-sop-next-sheet" aria-label="Hoja siguiente"><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button></div>
        <button class="icon-button" type="button" data-action="close-sop-sheet-preview" aria-label="Cerrar vista previa"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></header>
        <div class="sop-draft-preview-layout"><div class="sop-draft-preview-page"><div class="sop-annotation-canvas-wrap"><canvas data-sop-preview-canvas hidden></canvas>${renderSopAnnotationOverlay(version.procedures[0]?.annotations ?? [], Boolean(version.procedures[0]?.steps?.length))}</div><p class="sop-draft-preview-status" data-sop-preview-status>Selecciona una hoja para mostrar su vista previa.</p></div>
          <aside class="sop-draft-preview-edited"><label>Paso de la hoja<select data-sop-preview-step></select></label><div data-sop-preview-step-card></div><p class="sop-draft-preview-hint"><span class="material-symbols-rounded" aria-hidden="true">info</span>El recuadro azul ubica el texto editado. Las marcas rojas se guardan con esta revisión y aparecerán sobre la hoja para el operador.</p>
            <section class="sop-annotation-editor" aria-labelledby="sop-annotation-editor-title"><div><h4 id="sop-annotation-editor-title">Anotaciones visuales</h4><p>Elige una herramienta y marca el punto o área de la hoja.</p></div>
              <div class="sop-annotation-tools" role="toolbar" aria-label="Herramientas de anotación"><button type="button" data-action="select-sop-annotation-tool" data-annotation-tool="arrow" aria-pressed="true"><span class="material-symbols-rounded" aria-hidden="true">north_east</span>Flecha</button><button type="button" data-action="select-sop-annotation-tool" data-annotation-tool="box" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">crop_free</span>Recuadro</button><button type="button" data-action="select-sop-annotation-tool" data-annotation-tool="number" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">pin</span>Número</button><button type="button" data-action="select-sop-annotation-tool" data-annotation-tool="note" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">sticky_note_2</span>Nota</button></div>
              <label class="sop-annotation-note-field" hidden>Texto de nota<input type="text" data-sop-annotation-text maxlength="70" placeholder="Escribe una indicación breve" autocomplete="off" /></label>
              <p class="sop-annotation-tool-hint" data-sop-annotation-tool-hint role="status" aria-live="polite">Arrastra sobre la hoja para trazar una flecha.</p>
              <div class="sop-annotation-list" data-sop-annotation-list aria-label="Anotaciones de esta hoja"></div>
              <div class="sop-annotation-save"><small data-sop-annotation-save-status role="status">Sin cambios por guardar</small><button type="button" class="button button--primary" data-action="save-sop-annotations"><span class="material-symbols-rounded" aria-hidden="true">save</span>Guardar anotaciones</button></div>
            </section>
          </aside></div>
      </div>
    </dialog>
    <div class="sop-version-preview-actions"><button class="button button--primary" type="button" data-action="publish-sop-version" ${state.sopVersionBusy ? "disabled" : ""}>Guardar revisión y actualizar estación</button>
      <button class="button button--outlined" type="button" data-action="cancel-sop-version-draft" ${state.sopVersionBusy ? "disabled" : ""}>Cancelar revisión</button></div>
  </section>`;
}

function renderSopAnnotationList(procedure) {
  const annotations = procedure?.annotations ?? [];
  if (!annotations.length) return '<p class="sop-annotation-empty">Esta hoja todavía no tiene anotaciones.</p>';
  const toolNames = { arrow: "Flecha", box: "Recuadro", number: "Número", note: "Nota", textfix: "Texto corregido" };
  return `<ul>${annotations.map((annotation, index) => `<li><span><strong>${escapeHtml(toolNames[annotation.type] ?? "Marca")}${annotation.stepNumber ? ` · Paso ${escapeHtml(annotation.stepNumber)}` : ""}</strong><small>${escapeHtml(annotation.text || annotation.label || "Referencia visual")}</small></span><button type="button" data-action="remove-sop-annotation" data-annotation-index="${index}" aria-label="Eliminar ${escapeHtml(toolNames[annotation.type] ?? "anotación")} ${index + 1}"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button></li>`).join("")}</ul>`;
}

function updateSopInlinePreviewCard(aside, version) {
  const procedure = version?.procedures?.[Number(aside.dataset.procedureIndex)];
  const step = procedure?.steps?.[Number(aside.dataset.stepIndex)];
  const card = aside.querySelector("[data-sop-inline-card]");
  if (card) card.innerHTML = step
    ? `<span class="sop-draft-preview-step-number">Paso ${escapeHtml(step.number)}</span><p>${escapeHtml(step.text)}</p>`
    : '<p class="sop-page-empty">Esta hoja no tiene pasos detectados.</p>';
  const label = aside.querySelector("[data-sop-inline-label]");
  if (label && procedure) label.textContent = `Hoja ${procedure.sheet} · ${procedure.title}`;
  const annotate = aside.querySelector("[data-sop-inline-annotate]");
  if (annotate) annotate.dataset.procedureIndex = aside.dataset.procedureIndex;
  const stepCount = procedure?.steps?.length ?? 0;
  const stepIndex = Number(aside.dataset.stepIndex) || 0;
  const zoom = Number(aside.dataset.zoom) || 1;
  aside.querySelector('[data-action="inline-prev-step"]')?.toggleAttribute("disabled", stepIndex <= 0);
  aside.querySelector('[data-action="inline-next-step"]')?.toggleAttribute("disabled", stepIndex >= stepCount - 1);
  aside.querySelector('[data-action="inline-zoom-out"]')?.toggleAttribute("disabled", zoom <= 1);
  aside.querySelector('[data-action="inline-zoom-in"]')?.toggleAttribute("disabled", zoom >= 6);
  const areaButton = aside.querySelector('[data-action="inline-zoom-area"]');
  if (areaButton) {
    const zoomed = zoom > 1;
    areaButton.title = zoomed ? "Volver a la vista normal" : "Acercar a una zona: dibuja un recuadro sobre la hoja";
    areaButton.setAttribute("aria-label", zoomed ? "Volver a la vista normal" : "Acercar a una zona");
    areaButton.setAttribute("aria-pressed", String(aside.dataset.zoomSelect === "1"));
    const areaIcon = areaButton.querySelector(".material-symbols-rounded");
    if (areaIcon) areaIcon.textContent = zoomed ? "fullscreen_exit" : "fit_screen";
  }
}

async function paintSopInlinePreview(aside, version) {
  if (!aside || !version) return;
  const procedureIndex = Number(aside.dataset.procedureIndex) || 0;
  updateSopInlinePreviewCard(aside, version);
  const zoomLabel = aside.querySelector("[data-sop-zoom-label]");
  if (zoomLabel) zoomLabel.textContent = `${Math.round((Number(aside.dataset.zoom) || 1) * 100)}%`;
  await ensureSopStepBounds(version, version.procedures[procedureIndex]);
  await renderSopDraftPdfPage(aside, version, procedureIndex, Number(aside.dataset.stepIndex) || 0);
  const procedure = version.procedures[procedureIndex];
  const overlay = aside.querySelector(".sop-annotation-overlay");
  if (overlay && procedure) overlay.innerHTML = renderSopAnnotationContents(procedure.annotations ?? []);
}

function syncSopDraftPreviewPanel(dialog, version) {
  if (!dialog?.open || !version) return;
  const procedureIndex = Number(dialog.dataset.procedureIndex);
  const procedure = version.procedures[procedureIndex];
  if (!procedure) return;
  const stepSelect = dialog.querySelector("[data-sop-preview-step]");
  const selectedIndex = Math.min(Number(dialog.dataset.stepIndex) || 0, Math.max(0, procedure.steps.length - 1));
  dialog.dataset.stepIndex = String(selectedIndex);
  if (stepSelect) {
    stepSelect.replaceChildren(...procedure.steps.map((step, index) => new Option(`Paso ${step.number || index + 1}`, String(index))));
    stepSelect.value = String(selectedIndex);
  }
  const step = procedure.steps[selectedIndex];
  const label = dialog.querySelector("[data-sop-preview-sheet-label]");
  const title = dialog.querySelector("#sop-draft-preview-title");
  if (label) label.textContent = `Hoja ${procedure.sheet} · ${procedureIndex + 1} de ${version.procedures.length}`;
  if (title) title.textContent = `Hoja ${procedure.sheet} · ${procedure.title}`;
  const card = dialog.querySelector("[data-sop-preview-step-card]");
  if (card) card.innerHTML = step
    ? `<span class="sop-draft-preview-step-number">Paso ${escapeHtml(step.number)}</span><p>${escapeHtml(step.text)}</p>`
    : '<p class="sop-page-empty">Esta hoja no tiene pasos detectados.</p>';
  const overlayLayer = dialog.querySelector(".sop-annotation-overlay");
  const canAnnotate = Boolean(procedure.steps.length);
  if (overlayLayer) {
    overlayLayer.classList.toggle("sop-annotation-overlay--editable", canAnnotate);
    if (canAnnotate) {
      overlayLayer.setAttribute("data-sop-annotation-overlay", "");
      overlayLayer.setAttribute("role", "img");
      overlayLayer.setAttribute("tabindex", "0");
      overlayLayer.setAttribute("aria-label", "Lienzo de anotaciones de la hoja SOP");
      overlayLayer.removeAttribute("aria-hidden");
    } else {
      overlayLayer.removeAttribute("data-sop-annotation-overlay");
      overlayLayer.removeAttribute("role");
      overlayLayer.removeAttribute("tabindex");
      overlayLayer.removeAttribute("aria-label");
      overlayLayer.setAttribute("aria-hidden", "true");
    }
  }
  dialog.querySelectorAll("[data-annotation-tool]").forEach((button) => { button.disabled = !canAnnotate; });
  const noteField = dialog.querySelector("[data-sop-annotation-text]");
  if (noteField) noteField.disabled = !canAnnotate;
  const hint = dialog.querySelector("[data-sop-annotation-tool-hint]");
  if (hint) hint.textContent = canAnnotate
    ? "Arrastra sobre la hoja para trazar una flecha."
    : "Agrega al menos un paso para habilitar las anotaciones de esta hoja.";
  if (overlayLayer) overlayLayer.innerHTML = renderSopAnnotationContents(procedure.annotations ?? []);
  const annotationList = dialog.querySelector("[data-sop-annotation-list]");
  if (annotationList) annotationList.innerHTML = renderSopAnnotationList(procedure);
}

function showSopDraftPreview(dialog, state, procedureIndex, stepIndex = 0) {
  const procedure = state.sopDraft?.procedures?.[procedureIndex];
  if (!procedure || !dialog) return;
  dialog.dataset.procedureIndex = String(procedureIndex);
  dialog.dataset.stepIndex = String(stepIndex);
  dialog.dataset.annotationTool ||= "arrow";
  dialog.dataset.annotationsDirty = "0";
  const saveStatus = dialog.querySelector("[data-sop-annotation-save-status]");
  if (saveStatus) {
    saveStatus.textContent = "Sin cambios por guardar";
    saveStatus.classList.remove("is-dirty");
  }
  if (!dialog.open) dialog.showModal();
  syncSopDraftPreviewPanel(dialog, state.sopDraft);
  ensureSopStepBounds(state.sopDraft, procedure).then(() => renderSopDraftPdfPage(dialog, state.sopDraft, procedureIndex, stepIndex));
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
  const rows = allVersions.map((version, index) => {
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
      <label class="sop-catalog-area" role="cell"><small class="sop-catalog-mobile-label">Área</small><select aria-label="Área de ${escapeHtml(metadata.title)}" data-sop-catalog-type>${stationOptions}</select></label>
      <label class="sop-catalog-station" role="cell"><span class="sop-catalog-mobile-label">Estación</span><select aria-label="Estación de ${escapeHtml(metadata.title)}" data-sop-catalog-station data-previous-value="${escapeHtml(config.stationAssignment ?? "")}"><option value="">Selecciona estación</option>${areaOptions}<option value="__custom__">✎ Modificar estación…</option></select></label>
      <label class="sop-catalog-enabled" role="cell"><input type="checkbox" data-sop-catalog-enabled aria-label="Disponibilidad de ${escapeHtml(metadata.title)} · Rev. ${escapeHtml(metadata.revision)}" ${config.enabled ? "checked" : ""} ${config.stationAssignment ? "" : "disabled"} /></label>
      <div class="sop-catalog-status-cell ${config.enabled ? "is-enabled" : ""}" role="cell" data-sop-catalog-status><strong>${config.enabled ? "Habilitada" : "Deshabilitada"}</strong></div>
      <div role="cell">${versionActions}</div>
    </article>`;
  }).join("");

  return `<section class="sop-catalog-manager" aria-labelledby="sop-catalog-title">
    <div class="sop-catalog-heading"><div><p class="eyebrow">CATÁLOGO PARA OPERADORES</p><h3 id="sop-catalog-title">Estación y disponibilidad de cada SOP</h3></div><span class="material-symbols-rounded" aria-hidden="true">tune</span></div>
    <p>Cada archivo tiene una estación asignada. Habilita únicamente las SOP que deban aparecer al operador; puedes cambiar la estación o deshabilitar una revisión cuando lo necesites.</p>
    <form id="sop-catalog-form"><div class="sop-catalog-table" role="table" aria-label="SOP registradas por área, estación, disponibilidad y status"><div class="sop-catalog-table-head" role="row"><span role="columnheader">SOP / Revisión</span><span role="columnheader">Área</span><span role="columnheader">Estación</span><span role="columnheader">Disponibilidad</span><span role="columnheader">Status</span><span role="columnheader">Acciones</span></div><div class="sop-catalog-list" role="rowgroup">${rows || '<p class="sop-catalog-empty">Todavía no hay SOP guardadas.</p>'}</div></div><div class="sop-catalog-save-bar" ${state.sopCatalogDirty ? "" : "hidden"}><button class="button button--primary" type="submit"><span class="material-symbols-rounded" aria-hidden="true">save</span>Guardar estaciones y disponibilidad</button></div></form>
  </section>`;
}

function renderSopVersionManager(state) {
  if (!canManageSopVersions()) return '<section class="sop-version-panel"><h2>Acceso no disponible</h2></section>';
  const error = state.sopDraftError ? `<p class="form-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : "";
  const preview = state.sopDraft ? renderSopVersionPreview(state.sopDraft, state) : "";
  return `<section class="sop-version-panel" aria-labelledby="sop-version-title"><div class="sop-version-manager-header"><div class="section-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">rule_settings</span><div><p class="eyebrow sop-version-access-badge"><span class="material-symbols-rounded" aria-hidden="true">admin_panel_settings</span>Solo cuenta 140784</p><h2 id="sop-version-title">Modificar SOP</h2></div></div></div>
    <form class="sop-version-form sop-version-upload-form" id="sop-version-upload-form"><input class="sop-pdf-native-input" name="pdf" type="file" accept="application/pdf,.pdf" aria-label="Seleccionar archivo PDF de la SOP" />
      <div class="sop-version-actions"><button class="button button--outlined" type="button" data-action="choose-sop-pdf" ${state.sopVersionBusy || state.sopDraft ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">upload_file</span>Subir SOP PDF</button><button class="button button--primary" type="submit" ${state.sopVersionBusy || !state.sopUploadFile || state.sopDraft ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.sopVersionBusy ? "hourglass_top" : "manage_search"}</span>${state.sopVersionBusy ? "Extrayendo SOP…" : "Extraer SOP"}</button><small data-sop-pdf-name>${escapeHtml(state.sopDraft?.pdf?.name || state.sopUploadFile?.name || state.sopUploadFileName || "Selecciona un archivo PDF")}</small></div>
      ${error}</form></div>
    ${renderSopCatalog(state)}
    ${preview}
    <p class="sop-version-warning">Las revisiones, estaciones y disponibilidad se guardan en el servidor y las ven todos los equipos. Las evidencias anteriores conservan la versión utilizada.</p>
  </section>`;
}

function bindSopVersionInteractions(app, { state, render, showToast }) {
  let annotationDrag = null;
  const getAnnotationPoint = (event, overlay) => {
    const bounds = overlay.getBoundingClientRect();
    return {
      x: clampSopAnnotationCoordinate((event.clientX - bounds.left) / Math.max(1, bounds.width) * 1000),
      y: clampSopAnnotationCoordinate((event.clientY - bounds.top) / Math.max(1, bounds.height) * 1000),
    };
  };
  const markAnnotationsDirty = (dialog) => {
    dialog.dataset.annotationsDirty = "1";
    const status = dialog.querySelector("[data-sop-annotation-save-status]");
    if (status) {
      status.textContent = "Hay cambios sin guardar";
      status.classList.add("is-dirty");
    }
    refreshInlineOverlay(Number(dialog.dataset.procedureIndex));
  };
  const updateAnnotationEditor = (dialog, procedureIndex, preview = null) => {
    const procedure = state.sopDraft?.procedures?.[procedureIndex];
    if (!procedure || !dialog) return;
    const overlay = dialog.querySelector("[data-sop-annotation-overlay]");
    if (overlay) overlay.innerHTML = renderSopAnnotationContents(procedure.annotations ?? [], preview);
    const list = dialog.querySelector("[data-sop-annotation-list]");
    if (list) list.innerHTML = renderSopAnnotationList(procedure);
    const count = app.querySelector(`[data-sop-annotation-count="${procedureIndex}"]`);
    if (count) count.textContent = `${(procedure.annotations ?? []).length} anotaciones`;
  };
  const commitAnnotation = (dialog, annotation) => {
    const procedureIndex = Number(dialog.dataset.procedureIndex);
    const procedure = state.sopDraft?.procedures?.[procedureIndex];
    const step = procedure?.steps?.[Number(dialog.dataset.stepIndex)];
    if (!procedure || !step) return;
    if (!Array.isArray(procedure.annotations)) procedure.annotations = [];
    annotation.id = crypto.randomUUID();
    annotation.stepNumber = String(step.number);
    procedure.annotations.push(annotation);
    updateAnnotationEditor(dialog, procedureIndex);
    markAnnotationsDirty(dialog);
  };

  let inlineView = { draftId: null, procedureIndex: 0, stepIndex: 0, zoom: 1, edit: false, open: [0], restoreUntil: 0 };
  const selectInlineStep = (procedureIndex, stepIndex, field = null) => {
    const aside = app.querySelector("#sop-inline-preview");
    if (!aside || !state.sopDraft) return;
    aside.dataset.procedureIndex = String(procedureIndex);
    aside.dataset.stepIndex = String(stepIndex);
    inlineView.procedureIndex = procedureIndex;
    inlineView.stepIndex = stepIndex;
    app.querySelectorAll(".sop-version-step-editor li.is-current").forEach((item) => item.classList.remove("is-current"));
    field?.closest("li")?.classList.add("is-current");
    paintSopInlinePreview(aside, state.sopDraft);
  };
  app.addEventListener("focusin", (event) => {
    const field = event.target.closest?.("[data-step-field]");
    const aside = app.querySelector("#sop-inline-preview");
    if (!field || !aside) return;
    const procedureIndex = Number(field.dataset.procedureIndex);
    const stepIndex = Number(field.dataset.stepIndex);
    if (procedureIndex === Number(aside.dataset.procedureIndex) && stepIndex === Number(aside.dataset.stepIndex) && aside.dataset.ready) return;
    selectInlineStep(procedureIndex, stepIndex, field);
  });
  app.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!details.matches?.("details.sop-version-procedure")) return;
    const index = [...app.querySelectorAll("details.sop-version-procedure")].indexOf(details);
    if (index < 0) return;
    inlineView.open = inlineView.open.filter((value) => value !== index);
    if (details.open) inlineView.open.push(index);
    if (!details.open || Date.now() < inlineView.restoreUntil) return;
    if (index !== Number(app.querySelector("#sop-inline-preview")?.dataset.procedureIndex)) {
      selectInlineStep(index, 0, details.querySelector("[data-step-field]"));
    }
  }, true);
  const refreshSopReviewMarks = () => {
    const draft = state.sopDraft;
    if (!draft) return;
    const labels = { saved: ["check_circle", "Guardado"], edited: ["edit", "Editado"] };
    let edited = 0;
    let reviewed = 0;
    let total = 0;
    app.querySelectorAll("details.sop-version-procedure").forEach((details, procedureIndex) => {
      const procedure = draft.procedures[procedureIndex];
      if (!procedure) return;
      const sheetSaved = procedure.steps.length > 0 && procedure.steps.every((step) => step.reviewed);
      details.classList.toggle("is-sheet-saved", sheetSaved);
      const countLabel = details.querySelector("summary > span");
      if (countLabel) countLabel.textContent = `${procedure.steps.length} ${procedure.steps.length === 1 ? "paso" : "pasos"}${sheetSaved ? " · guardada" : ""}`;
      details.querySelectorAll(".sop-version-step-editor li").forEach((item, stepIndex) => {
        const step = procedure.steps[stepIndex];
        const mark = getSopStepMark(step);
        total += 1;
        if (isSopStepEdited(step)) edited += 1;
        if (step?.reviewed) reviewed += 1;
        const chip = item.querySelector("[data-sop-step-chip]");
        if (chip) {
          chip.hidden = !mark;
          chip.dataset.state = mark;
          if (mark) {
            chip.querySelector("[data-sop-step-chip-icon]").textContent = labels[mark][0];
            chip.querySelector("[data-sop-step-chip-label]").textContent = labels[mark][1];
          }
        }
        item.querySelector(".sop-step-restore")?.toggleAttribute("hidden", !isSopStepEdited(step));
        item.classList.toggle("is-edited", isSopStepEdited(step));
        item.classList.toggle("is-saved", Boolean(step?.reviewed));
      });
      edited += (procedure.annotations ?? []).filter((annotation) => annotation.type === "textfix" && !annotation.stepNumber).length;
    });
    const counter = app.querySelector("[data-sop-edited-count]");
    if (counter) counter.textContent = `${edited} ${edited === 1 ? "texto editado" : "textos editados"}`;
    const reviewedCounter = app.querySelector("[data-sop-reviewed-count]");
    if (reviewedCounter) reviewedCounter.textContent = `${reviewed} de ${total} revisados`;
  };
  const refreshInlineOverlay = (procedureIndex) => {
    const procedure = state.sopDraft?.procedures?.[procedureIndex];
    const aside = app.querySelector("#sop-inline-preview");
    const overlay = aside?.querySelector(".sop-annotation-overlay");
    if (!procedure || !overlay || Number(aside.dataset.procedureIndex) !== procedureIndex) return;
    overlay.innerHTML = renderSopAnnotationContents(procedure.annotations ?? []);
  };
  const applyInlineZoom = (aside, zoom) => {
    aside.dataset.zoom = String(Math.round(Math.max(1, Math.min(6, zoom)) * 100) / 100);
    inlineView.zoom = Number(aside.dataset.zoom);
    paintSopInlinePreview(aside, state.sopDraft);
  };
  let sheetEditorTarget = null;
  let freeFixTimer = 0;
  const openSheetEditor = (aside, target, text, title) => {
    sheetEditorTarget = target;
    const panel = aside.querySelector("[data-sop-sheet-editor]");
    if (!panel) return;
    panel.hidden = false;
    panel.querySelector("[data-sop-sheet-editor-title]").textContent = title;
    const field = panel.querySelector("textarea");
    field.value = text;
    field.focus();
  };
  const closeSheetEditor = () => {
    sheetEditorTarget = null;
    const panel = app.querySelector("[data-sop-sheet-editor]");
    if (panel) panel.hidden = true;
  };
  const applyFreeTextFix = async (target, text) => {
    const procedure = state.sopDraft?.procedures?.[target.procedureIndex];
    if (!procedure) return;
    const annotations = procedure.annotations ??= [];
    const index = target.id ? annotations.findIndex((annotation) => annotation.id === target.id) : -1;
    const clean = text.trim();
    if (!clean || clean === target.block.text.trim()) {
      if (index >= 0) annotations.splice(index, 1);
    } else {
      const fix = await buildSopTextFix(state.sopDraft, procedure, { bounds: target.block.bounds, format: target.block.format, prefix: "", text: clean, stepNumber: "" });
      target.id ??= `free-${crypto.randomUUID().slice(0, 8)}`;
      Object.assign(fix, { id: target.id, original: target.block.text, source: target.block.bounds, sourceFormat: target.block.format });
      const current = annotations.findIndex((annotation) => annotation.id === target.id);
      if (current >= 0) annotations[current] = fix;
      else annotations.push(fix);
    }
    refreshInlineOverlay(target.procedureIndex);
    refreshSopReviewMarks();
  };
  const findStepListItem = (procedureIndex, stepIndex) => app.querySelectorAll("details.sop-version-procedure")[procedureIndex]?.querySelectorAll(".sop-version-step-editor li")[stepIndex];
  const handleInlineAction = (action) => {
    const name = action.dataset.action;
    if (!state.sopDraft) return false;
    const aside = app.querySelector("#sop-inline-preview");
    if (["inline-zoom-in", "inline-zoom-out", "inline-zoom-fit"].includes(name)) {
      if (aside) applyInlineZoom(aside, name === "inline-zoom-fit" ? 1 : (Number(aside.dataset.zoom) || 1) + (name === "inline-zoom-in" ? 0.1 : -0.1));
      return true;
    }
    if (name === "inline-zoom-area") {
      if (!aside) return true;
      if ((Number(aside.dataset.zoom) || 1) > 1) {
        aside.dataset.zoomSelect = "0";
        applyInlineZoom(aside, 1);
      } else {
        aside.dataset.zoomSelect = aside.dataset.zoomSelect === "1" ? "0" : "1";
        updateSopInlinePreviewCard(aside, state.sopDraft);
      }
      return true;
    }
    if (name === "inline-prev-step" || name === "inline-next-step") {
      if (!aside) return true;
      const procedureIndex = Number(aside.dataset.procedureIndex) || 0;
      const procedure = state.sopDraft.procedures[procedureIndex];
      if (!procedure?.steps.length) return true;
      const next = Math.max(0, Math.min(procedure.steps.length - 1, (Number(aside.dataset.stepIndex) || 0) + (name === "inline-next-step" ? 1 : -1)));
      const item = findStepListItem(procedureIndex, next);
      selectInlineStep(procedureIndex, next, item?.querySelector("[data-step-field]"));
      item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return true;
    }
    if (name === "inline-toggle-edit") {
      if (!aside) return true;
      const on = aside.dataset.edit !== "1";
      aside.dataset.edit = on ? "1" : "0";
      inlineView.edit = on;
      action.setAttribute("aria-pressed", String(on));
      if (!on) closeSheetEditor();
      return true;
    }
    if (name === "save-sop-sheet") {
      const procedureIndex = Number(action.dataset.procedureIndex);
      const procedure = state.sopDraft.procedures[procedureIndex];
      const details = action.closest("details.sop-version-procedure");
      if (!procedure || !details) return true;
      procedure.steps.forEach((step) => { step.reviewed = true; });
      refreshSopReviewMarks();
      details.open = false;
      showInlineNotice(`Hoja ${procedure.sheet} guardada (${procedure.steps.length} ${procedure.steps.length === 1 ? "paso" : "pasos"}). Elige otra hoja para continuar.`);
      details.nextElementSibling?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return true;
    }
    if (name === "save-sop-annotations") {
      const dialog = action.closest("#sop-draft-preview-dialog");
      const procedureIndex = Number(dialog?.dataset.procedureIndex);
      const procedure = state.sopDraft.procedures[procedureIndex];
      if (!dialog || !procedure) return true;
      const count = (procedure.annotations ?? []).filter((annotation) => annotation.type !== "textfix").length;
      dialog.dataset.annotationsDirty = "0";
      refreshInlineOverlay(procedureIndex);
      dialog.close();
      showInlineNotice(`Anotaciones de la hoja ${procedure.sheet} guardadas (${count}). Pulsa «Guardar revisión» para publicarlas.`);
      return true;
    }
    if (name === "save-sop-step") {
      const procedureIndex = Number(action.dataset.procedureIndex);
      const stepIndex = Number(action.dataset.stepIndex);
      const procedures = state.sopDraft.procedures;
      const step = procedures[procedureIndex]?.steps[stepIndex];
      if (!step) return true;
      step.reviewed = true;
      refreshSopReviewMarks();
      let nextProcedure = procedureIndex;
      let nextStep = stepIndex + 1;
      if (nextStep >= procedures[procedureIndex].steps.length) {
        nextProcedure = procedures.findIndex((candidate, index) => index > procedureIndex && candidate.steps.length);
        nextStep = 0;
      }
      if (nextProcedure < 0) {
        showInlineNotice("Revisaste todos los pasos. Pulsa «Guardar revisión» para publicarla.");
        return true;
      }
      const details = app.querySelectorAll("details.sop-version-procedure")[nextProcedure];
      const item = findStepListItem(nextProcedure, nextStep);
      selectInlineStep(nextProcedure, nextStep, item?.querySelector("[data-step-field]"));
      if (details && !details.open) details.open = true;
      item?.scrollIntoView({ block: "center", behavior: "smooth" });
      item?.querySelector("textarea")?.focus({ preventScroll: true });
      return true;
    }
    if (name === "restore-sop-step") {
      const procedureIndex = Number(action.dataset.procedureIndex);
      const stepIndex = Number(action.dataset.stepIndex);
      const step = state.sopDraft.procedures[procedureIndex]?.steps[stepIndex];
      const item = action.closest("li");
      if (!step || !item || !isSopStepEdited(step)) return true;
      const numberField = item.querySelector('[data-step-field="number"]');
      const textField = item.querySelector('[data-step-field="text"]');
      numberField.value = step.originalNumber;
      numberField.dispatchEvent(new Event("input", { bubbles: true }));
      textField.value = step.originalText;
      textField.dispatchEvent(new Event("input", { bubbles: true }));
      showInlineNotice("Texto original restaurado.");
      return true;
    }
    if (name === "sheet-editor-close") {
      closeSheetEditor();
      return true;
    }
    if (name === "sheet-editor-restore") {
      const target = sheetEditorTarget;
      if (!target) return true;
      if (target.kind === "step") {
        findStepListItem(target.procedureIndex, target.stepIndex)?.querySelector(".sop-step-restore")?.click();
        const step = state.sopDraft.procedures[target.procedureIndex]?.steps[target.stepIndex];
        const field = app.querySelector("[data-sop-sheet-editor-text]");
        if (field && step) field.value = step.text;
      } else {
        const procedure = state.sopDraft.procedures[target.procedureIndex];
        const index = (procedure?.annotations ?? []).findIndex((annotation) => annotation.id === target.id);
        if (index >= 0) procedure.annotations.splice(index, 1);
        refreshInlineOverlay(target.procedureIndex);
        refreshSopReviewMarks();
        closeSheetEditor();
        showInlineNotice("Texto original restaurado.");
      }
      return true;
    }
    return false;
  };
  app.addEventListener("input", (event) => {
    if (!event.target.matches?.("[data-sop-sheet-editor-text]") || !sheetEditorTarget) return;
    const target = sheetEditorTarget;
    const text = event.target.value;
    if (target.kind === "step") {
      const field = app.querySelector(`textarea[data-procedure-index="${target.procedureIndex}"][data-step-index="${target.stepIndex}"][data-step-field="text"]`);
      if (field) {
        field.value = text;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    window.clearTimeout(freeFixTimer);
    freeFixTimer = window.setTimeout(() => applyFreeTextFix(target, text).catch(() => {}), 250);
  });
  let zoomSelection = null;
  app.addEventListener("pointerdown", (event) => {
    const wrap = event.target.closest?.("#sop-inline-preview .sop-annotation-canvas-wrap");
    const aside = wrap?.closest("#sop-inline-preview");
    if (!wrap || aside.dataset.zoomSelect !== "1" || event.button !== 0) return;
    event.preventDefault();
    const rect = wrap.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = "sop-zoom-rect";
    wrap.append(box);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    zoomSelection = { aside, wrap, box, rect, x0: x, y0: y, x1: x, y1: y };
    try { wrap.setPointerCapture(event.pointerId); } catch { /* El puntero puede no admitir captura. */ }
  });
  app.addEventListener("pointermove", (event) => {
    if (!zoomSelection) return;
    const selection = zoomSelection;
    selection.x1 = Math.max(0, Math.min(selection.rect.width, event.clientX - selection.rect.left));
    selection.y1 = Math.max(0, Math.min(selection.rect.height, event.clientY - selection.rect.top));
    Object.assign(selection.box.style, {
      left: `${Math.min(selection.x0, selection.x1)}px`,
      top: `${Math.min(selection.y0, selection.y1)}px`,
      width: `${Math.abs(selection.x1 - selection.x0)}px`,
      height: `${Math.abs(selection.y1 - selection.y0)}px`,
    });
  });
  app.addEventListener("pointerup", () => {
    if (!zoomSelection) return;
    const selection = zoomSelection;
    zoomSelection = null;
    selection.box.remove();
    inlinePanMoved = true;
    const width = Math.abs(selection.x1 - selection.x0);
    const height = Math.abs(selection.y1 - selection.y0);
    if (width < 14 || height < 14) {
      showInlineNotice("Dibuja un recuadro más grande sobre la zona que quieres acercar.", "warning");
      return;
    }
    const frame = selection.aside.querySelector(".sop-draft-preview-page");
    const factor = Math.min((frame.clientWidth - 24) / width, (frame.clientHeight - 24) / height);
    selection.aside.dataset.zoomSelect = "0";
    selection.aside._zoomTarget = {
      cx: (Math.min(selection.x0, selection.x1) + width / 2) / selection.rect.width,
      cy: (Math.min(selection.y0, selection.y1) + height / 2) / selection.rect.height,
    };
    applyInlineZoom(selection.aside, Math.max(1.5, (Number(selection.aside.dataset.zoom) || 1) * factor));
  });
  app.addEventListener("dblclick", (event) => {
    const aside = event.target.closest?.("#sop-inline-preview .sop-annotation-canvas-wrap")?.closest("#sop-inline-preview");
    if (!aside || (Number(aside.dataset.zoom) || 1) <= 1 || aside.dataset.edit === "1" || aside.dataset.zoomSelect === "1") return;
    applyInlineZoom(aside, 1);
  });
  let inlinePan = null;
  let inlinePanMoved = false;
  app.addEventListener("pointerdown", (event) => {
    const frame = event.target.closest?.("#sop-inline-preview .sop-draft-preview-page");
    if (!frame || event.button !== 0 || frame.closest("#sop-inline-preview")?.dataset.zoomSelect === "1") return;
    inlinePanMoved = false;
    inlinePan = { frame, x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop };
  });
  app.addEventListener("pointermove", (event) => {
    if (!inlinePan) return;
    const dx = event.clientX - inlinePan.x;
    const dy = event.clientY - inlinePan.y;
    if (Math.abs(dx) + Math.abs(dy) < 6) return;
    inlinePanMoved = true;
    inlinePan.frame.scrollLeft = inlinePan.left - dx;
    inlinePan.frame.scrollTop = inlinePan.top - dy;
  });
  app.addEventListener("pointerup", () => {
    inlinePan = null;
    window.setTimeout(() => { inlinePanMoved = false; }, 0);
  });
  app.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    const frame = event.target.closest?.("#sop-inline-preview .sop-draft-preview-page");
    const aside = frame?.closest("#sop-inline-preview");
    if (!aside || !state.sopDraft) return;
    event.preventDefault();
    applyInlineZoom(aside, (Number(aside.dataset.zoom) || 1) + (event.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
  app.addEventListener("click", async (event) => {
    const wrap = event.target.closest?.("#sop-inline-preview .sop-annotation-canvas-wrap");
    if (!wrap || !state.sopDraft || inlinePanMoved) return;
    const aside = wrap.closest("#sop-inline-preview");
    const canvas = wrap.querySelector("canvas");
    const viewport = canvas?._sopViewport;
    if (!viewport || canvas.hidden) return;
    const rect = wrap.getBoundingClientRect();
    const fractionX = (event.clientX - rect.left) / rect.width;
    const fractionY = (event.clientY - rect.top) / rect.height;
    const [px, py] = viewport.convertToPdfPoint(fractionX * viewport.width, fractionY * viewport.height);
    const procedureIndex = Number(aside.dataset.procedureIndex) || 0;
    const procedure = state.sopDraft.procedures[procedureIndex];
    if (!procedure) return;
    const editMode = aside.dataset.edit === "1";
    const stepIndex = procedure.steps.findIndex((step) => step.sourceBounds
      && px >= step.sourceBounds.x - 4 && px <= step.sourceBounds.x + step.sourceBounds.width + 4
      && py >= step.sourceBounds.y - 4 && py <= step.sourceBounds.y + step.sourceBounds.height + 4);
    if (stepIndex >= 0) {
      const item = findStepListItem(procedureIndex, stepIndex);
      selectInlineStep(procedureIndex, stepIndex, item?.querySelector("[data-step-field]"));
      item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (editMode) openSheetEditor(aside, { kind: "step", procedureIndex, stepIndex }, procedure.steps[stepIndex].text, `Paso ${procedure.steps[stepIndex].number} · Hoja ${procedure.sheet}`);
      return;
    }
    const free = (procedure.annotations ?? []).find((annotation) => annotation.type === "textfix" && !annotation.stepNumber
      && fractionX * 1000 >= annotation.x && fractionX * 1000 <= annotation.x + annotation.width
      && fractionY * 1000 >= annotation.y && fractionY * 1000 <= annotation.y + annotation.height);
    if (free && editMode) {
      openSheetEditor(aside, { kind: "free", procedureIndex, id: free.id, block: { text: free.original, bounds: free.source, format: free.sourceFormat } }, free.lines.join(" "), "Texto de la hoja");
      return;
    }
    if (!editMode) return;
    try {
      const pdf = await getSopDraftPdfDocument(state.sopDraft);
      const page = await pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet));
      const block = findSopTextBlockAt((await page.getTextContent()).items, px, py);
      if (!block) {
        showInlineNotice("No se encontró texto editable en ese punto de la hoja.", "warning");
        return;
      }
      openSheetEditor(aside, { kind: "free", procedureIndex, id: null, block }, block.text, "Texto de la hoja");
    } catch (error) {
      showInlineNotice("No se pudo leer el texto de la hoja.", "warning");
    }
  });

  app.addEventListener("close", (event) => {
    if (event.target?.id !== "sop-draft-preview-dialog") return;
    refreshInlineOverlay(Number(event.target.dataset.procedureIndex));
    refreshSopReviewMarks();
  }, true);
  new MutationObserver(() => {
    const aside = app.querySelector("#sop-inline-preview:not([data-ready])");
    if (!aside || !state.sopDraft) return;
    aside.dataset.ready = "1";
    if (inlineView.draftId !== state.sopDraft.id) {
      inlineView = { draftId: state.sopDraft.id, procedureIndex: 0, stepIndex: 0, zoom: 1, edit: false, open: [0], restoreUntil: 0 };
    } else {
      inlineView.restoreUntil = Date.now() + 700;
      aside.dataset.procedureIndex = String(inlineView.procedureIndex);
      aside.dataset.stepIndex = String(inlineView.stepIndex);
      aside.dataset.zoom = String(inlineView.zoom);
      aside.dataset.edit = inlineView.edit ? "1" : "0";
      aside.querySelector('[data-action="inline-toggle-edit"]')?.setAttribute("aria-pressed", String(inlineView.edit));
      app.querySelectorAll("details.sop-version-procedure").forEach((details, index) => { details.open = inlineView.open.includes(index); });
      app.querySelectorAll(".sop-version-step-editor li.is-current").forEach((item) => item.classList.remove("is-current"));
      findStepListItem(inlineView.procedureIndex, inlineView.stepIndex)?.classList.add("is-current");
    }
    refreshSopReviewMarks();
    paintSopInlinePreview(aside, state.sopDraft);
  }).observe(app, { childList: true, subtree: true });

  app.addEventListener("pointerdown", (event) => {
    const overlay = event.target.closest?.("[data-sop-annotation-overlay]");
    const dialog = overlay?.closest("#sop-draft-preview-dialog");
    if (!overlay || !dialog?.open || !canManageSopVersions() || !state.sopDraft) return;
    const procedure = state.sopDraft.procedures[Number(dialog.dataset.procedureIndex)];
    if (!procedure?.steps?.length) return;
    const tool = dialog.dataset.annotationTool || "arrow";
    if (!["arrow", "box", "number", "note"].includes(tool)) return;
    event.preventDefault();
    const point = getAnnotationPoint(event, overlay);
    annotationDrag = { pointerId: event.pointerId, tool, start: point, end: point, dialog, overlay };
    if (tool === "arrow" || tool === "box") {
      try { overlay.setPointerCapture(event.pointerId); } catch { /* El puntero puede no admitir captura. */ }
    }
  });

  app.addEventListener("pointermove", (event) => {
    if (!annotationDrag || !["arrow", "box"].includes(annotationDrag.tool)) return;
    annotationDrag.end = getAnnotationPoint(event, annotationDrag.overlay);
    const { start, end, tool, dialog } = annotationDrag;
    const procedure = state.sopDraft?.procedures?.[Number(dialog.dataset.procedureIndex)];
    const step = procedure?.steps?.[Number(dialog.dataset.stepIndex)];
    const preview = tool === "arrow"
      ? { type: "arrow", x1: start.x, y1: start.y, x2: end.x, y2: end.y, stepNumber: step?.number }
      : { type: "box", x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y), stepNumber: step?.number };
    const svg = dialog.querySelector("[data-sop-annotation-overlay]");
    if (svg) svg.innerHTML = renderSopAnnotationContents(procedure?.annotations ?? [], preview);
  });

  app.addEventListener("pointerup", (event) => {
    if (!annotationDrag || annotationDrag.pointerId !== event.pointerId) return;
    const { dialog, overlay, tool, start } = annotationDrag;
    const end = getAnnotationPoint(event, overlay);
    annotationDrag = null;
    const procedure = state.sopDraft?.procedures?.[Number(dialog.dataset.procedureIndex)];
    const step = procedure?.steps?.[Number(dialog.dataset.stepIndex)];
    if (!procedure || !step) return;

    if (tool === "arrow" || tool === "box") {
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (distance < 12) {
        updateAnnotationEditor(dialog, Number(dialog.dataset.procedureIndex));
        return;
      }
      if (tool === "arrow") commitAnnotation(dialog, { type: tool, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
      else commitAnnotation(dialog, { type: tool, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
      return;
    }
    if (tool === "number") {
      const nextNumber = (procedure.annotations ?? []).filter((annotation) => annotation.type === "number").length + 1;
      commitAnnotation(dialog, { type: tool, x: start.x, y: start.y, label: String(nextNumber) });
      return;
    }
    const noteField = dialog.querySelector("[data-sop-annotation-text]");
    const text = noteField?.value.trim() ?? "";
    if (!text) {
      dialog.querySelector("[data-sop-annotation-tool-hint]").textContent = "Escribe el texto de la nota antes de colocarla.";
      noteField?.focus();
      return;
    }
    commitAnnotation(dialog, { type: tool, x: start.x, y: start.y, text });
    noteField.value = "";
  });

  app.addEventListener("pointercancel", () => {
    if (!annotationDrag) return;
    const { dialog } = annotationDrag;
    annotationDrag = null;
    updateAnnotationEditor(dialog, Number(dialog.dataset.procedureIndex));
  });

  app.addEventListener("input", (event) => {
    if (!canManageSopVersions() || !state.sopDraft) return;
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
    const procedureIndex = Number(event.target.dataset.procedureIndex);
    if (!Number.isInteger(procedureIndex)) return;
    const procedure = state.sopDraft.procedures[procedureIndex];
    if (!procedure) return;
    const procedureField = event.target.dataset.procedureField;
    if (procedureField) {
      procedure[procedureField] = event.target.value;
      return;
    }
    const stepIndex = Number(event.target.dataset.stepIndex);
    const stepField = event.target.dataset.stepField;
    if (stepField && procedure.steps[stepIndex]) {
      const previousStepNumber = procedure.steps[stepIndex].number;
      procedure.steps[stepIndex].originalText ??= procedure.steps[stepIndex].text;
      procedure.steps[stepIndex].originalNumber ??= procedure.steps[stepIndex].number;
      procedure.steps[stepIndex].reviewed = false;
      procedure.steps[stepIndex][stepField] = event.target.value;
      if (stepField === "number" && previousStepNumber !== event.target.value) {
        procedure.annotations = (procedure.annotations ?? []).map((annotation) => annotation.stepNumber === previousStepNumber
          ? { ...annotation, stepNumber: event.target.value }
          : annotation);
      }
      const preview = app.querySelector("#sop-draft-preview-dialog");
      if (Number(preview?.dataset.procedureIndex) === procedureIndex && Number(preview?.dataset.stepIndex) === stepIndex) {
        syncSopDraftPreviewPanel(preview, state.sopDraft);
      }
      const inline = app.querySelector("#sop-inline-preview");
      if (inline && Number(inline.dataset.procedureIndex) === procedureIndex && Number(inline.dataset.stepIndex) === stepIndex) {
        updateSopInlinePreviewCard(inline, state.sopDraft);
      }
      refreshSopReviewMarks();
      syncSopStepTextFix(state.sopDraft, procedure, procedure.steps[stepIndex]).then(() => {
        const livePreview = app.querySelector("#sop-draft-preview-dialog");
        if (livePreview?.open && Number(livePreview.dataset.procedureIndex) === procedureIndex) syncSopDraftPreviewPanel(livePreview, state.sopDraft);
        refreshSopReviewMarks();
        window.dispatchEvent(new CustomEvent("sop-draft-annotations-changed", { detail: { procedureIndex } }));
        const liveInline = app.querySelector("#sop-inline-preview");
        const liveOverlay = liveInline?.querySelector(".sop-annotation-overlay");
        if (liveOverlay && Number(liveInline.dataset.procedureIndex) === procedureIndex) {
          liveOverlay.innerHTML = renderSopAnnotationContents(procedure.annotations ?? []);
          window.clearTimeout(sopInlineRepaintTimer);
          sopInlineRepaintTimer = window.setTimeout(() => paintSopInlinePreview(liveInline, state.sopDraft), 350);
        }
      }).catch(() => {});
    }
  });

  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    if (handleInlineAction(action)) return;
    if (action.dataset.action === "select-sop-annotation-tool") {
      const dialog = action.closest("#sop-draft-preview-dialog");
      const tool = action.dataset.annotationTool;
      if (!dialog?.open || !canManageSopVersions() || !["arrow", "box", "number", "note"].includes(tool)) return;
      dialog.dataset.annotationTool = tool;
      dialog.querySelectorAll("[data-annotation-tool]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.annotationTool === tool)));
      const hint = dialog.querySelector("[data-sop-annotation-tool-hint]");
      const noteField = dialog.querySelector(".sop-annotation-note-field");
      if (noteField) noteField.hidden = tool !== "note";
      if (hint) hint.textContent = ({
        arrow: "Arrastra sobre la hoja para trazar una flecha.",
        box: "Arrastra sobre la hoja para encuadrar un área.",
        number: "Haz clic sobre la hoja para colocar el siguiente número.",
        note: "Escribe una indicación y haz clic en la hoja para colocarla.",
      })[tool];
    } else if (action.dataset.action === "remove-sop-annotation") {
      const dialog = action.closest("#sop-draft-preview-dialog");
      const procedureIndex = Number(dialog?.dataset.procedureIndex);
      const procedure = state.sopDraft?.procedures?.[procedureIndex];
      const annotationIndex = Number(action.dataset.annotationIndex);
      if (!dialog?.open || !canManageSopVersions() || !procedure?.annotations?.[annotationIndex]) return;
      procedure.annotations.splice(annotationIndex, 1);
      const overlay = dialog.querySelector("[data-sop-annotation-overlay]");
      if (overlay) overlay.innerHTML = renderSopAnnotationContents(procedure.annotations);
      updateAnnotationEditor(dialog, procedureIndex);
      markAnnotationsDirty(dialog);
    } else if (action.dataset.action === "preview-sop-sheet" || action.dataset.action === "open-sop-workspace") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      const inline = app.querySelector("#sop-inline-preview");
      const procedureIndex = action.dataset.procedureIndex !== undefined ? Number(action.dataset.procedureIndex) : Number(inline?.dataset.procedureIndex) || 0;
      const stepIndex = Number(inline?.dataset.procedureIndex) === procedureIndex ? Number(inline?.dataset.stepIndex) || 0 : 0;
      openSopWorkspace({ state, render, showToast, procedureIndex, stepIndex });
    } else if (action.dataset.action === "close-sop-sheet-preview") {
      app.querySelector("#sop-draft-preview-dialog")?.close();
    } else if (["preview-sop-previous-sheet", "preview-sop-next-sheet"].includes(action.dataset.action)) {
      const dialog = app.querySelector("#sop-draft-preview-dialog");
      if (!dialog?.open || !state.sopDraft) return;
      const direction = action.dataset.action === "preview-sop-next-sheet" ? 1 : -1;
      const nextIndex = Number(dialog.dataset.procedureIndex) + direction;
      if (nextIndex < 0 || nextIndex >= state.sopDraft.procedures.length) return;
      showSopDraftPreview(dialog, state, nextIndex);
    } else if (action.dataset.action === "choose-sop-pdf") {
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
      if (!canManageSopVersions() || !state.sopDraft || state.sopVersionBusy) return;
      state.sopDraft = null;
      state.sopDraftError = "";
      state.sopDraftNotice = "";
      state.sopUploadFile = null;
      state.sopUploadFileName = "";
      showToast("Revisión cancelada; no se guardaron sus cambios.");
      render();
    } else if (action.dataset.action === "delete-sop-version") {
      if (!canManageSopVersions() || state.sopVersionBusy) return;
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
    } else if (action.dataset.action === "add-sop-step" || action.dataset.action === "delete-sop-step") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      const procedure = state.sopDraft.procedures[Number(action.dataset.procedureIndex)];
      if (!procedure) return;
      state.sopDraftError = "";
      if (action.dataset.action === "add-sop-step") procedure.steps.push({ number: "", text: "", sourceNote: "", images: [], added: true });
      else {
        const [removedStep] = procedure.steps.splice(Number(action.dataset.stepIndex), 1);
        if (removedStep && !removedStep.added) (state.sopDraft.deletedSteps ??= []).push({ sheet: procedure.sheet, number: removedStep.originalNumber ?? removedStep.number, text: removedStep.originalText ?? removedStep.text });
        procedure.annotations = (procedure.annotations ?? []).filter((annotation) => annotation.stepNumber !== String(removedStep?.number));
      }
      render();
    } else if (action.dataset.action === "edit-sop-version") {
      if (!canManageSopVersions() || state.sopVersionBusy) return;
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
      state.sopDraftError = "";
      state.sopDraftNotice = "Captura una nueva revisión y confirma su estación. La revisión nueva quedará deshabilitada hasta que la habilites.";
      state.activeSection = "sop-admin";
      render();
      document.querySelector('[data-sop-document-field="revision"]')?.focus();
    } else if (action.dataset.action === "publish-sop-version") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      try {
        state.sopDraft = validateSopDraft(state.sopDraft);
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
        state.sopDraftError = "";
        state.sopDraftNotice = "";
        state.sopUploadFileName = "";
        state.sopVersionBusy = false;
        recordLocalAuditEvent("sop_version_saved", { details: `Rev. ${version.document.revision} · ${version.document.id} · ${version.document.stationAssignment}` });
        showToast(`SOP Rev. ${version.document.revision} guardada y deshabilitada. Asigna la estación y habilítala cuando esté lista.`);
      } catch (error) {
        state.sopVersionBusy = false;
        state.sopDraftError = error?.message || "No se pudo guardar la revisión en el servidor.";
        render();
      }
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-sop-preview-step]")) {
      const dialog = event.target.closest("#sop-draft-preview-dialog");
      if (!dialog?.open || !state.sopDraft) return;
      dialog.dataset.stepIndex = event.target.value;
      syncSopDraftPreviewPanel(dialog, state.sopDraft);
      renderSopDraftPdfPage(dialog, state.sopDraft, Number(dialog.dataset.procedureIndex), Number(dialog.dataset.stepIndex));
      return;
    }
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
      if (!canManageSopVersions() || !state.sopDraft) return;
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
      if (!canManageSopVersions() || !state.sopDraft) return;
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
    if (!canManageSopVersions() || state.sopVersionBusy || state.sopDraft) return;
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
