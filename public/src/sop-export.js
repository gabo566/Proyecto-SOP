// Exportación de la edición de una revisión de SOP: PDF con anotaciones, imagen de una hoja y resumen de cambios.

const SOP_EXPORT_TYPE_LABELS = { arrow: "Flecha", box: "Recuadro", highlight: "Resaltado", number: "Número", note: "Nota", text: "Texto libre" };

function downloadSopBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- resumen de cambios
function collectSopChanges(draft) {
  const rows = [];
  for (const procedure of draft?.procedures ?? []) {
    const sheet = procedure.sheet;
    for (const step of procedure.steps) {
      if (step.added) {
        rows.push({ sheet, step: step.number || "(sin número)", type: "Paso nuevo", before: "", after: step.text ?? "" });
        continue;
      }
      if (step.originalNumber !== undefined && String(step.number) !== String(step.originalNumber)) {
        rows.push({ sheet, step: step.originalNumber, type: "Número de paso", before: String(step.originalNumber), after: String(step.number) });
      }
      if (step.originalText !== undefined && String(step.text ?? "").trim() !== String(step.originalText).trim()) {
        rows.push({ sheet, step: step.number, type: "Texto del paso", before: String(step.originalText).trim(), after: String(step.text ?? "").trim() });
      }
    }
    for (const annotation of procedure.annotations ?? []) {
      if (annotation.type === "textfix") {
        if (annotation.stepNumber) continue;
        rows.push({ sheet, step: "", type: "Texto de la hoja", before: String(annotation.original ?? "").trim(), after: (annotation.lines ?? []).join(" ").trim() });
        continue;
      }
      const detail = annotation.text || annotation.label || "";
      rows.push({ sheet, step: annotation.stepNumber ?? "", type: `Anotación · ${SOP_EXPORT_TYPE_LABELS[annotation.type] ?? "Marca"}`, before: "", after: detail });
    }
  }
  for (const removed of draft?.deletedSteps ?? []) {
    rows.push({ sheet: removed.sheet, step: removed.number, type: "Paso eliminado", before: String(removed.text ?? "").trim(), after: "" });
  }
  return rows;
}

function sopChangesToCsv(draft, rows) {
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const header = [
    ["SOP", draft.document.title], ["Documento", draft.document.id], ["Revisión", draft.document.revision],
    ["Creada por", draft.createdBy ?? ""], ["Fecha de exportación", new Date().toLocaleString("es-MX")], ["Cambios", rows.length],
  ].map((line) => line.map(quote).join(","));
  const body = [["Hoja", "Paso", "Tipo de cambio", "Antes", "Después"], ...rows.map((row) => [row.sheet, row.step, row.type, row.before, row.after])].map((line) => line.map(quote).join(","));
  return [...header, "", ...body].join("\r\n");
}

function openSopChangesPrint(draft, rows) {
  const counts = rows.reduce((result, row) => { result[row.type] = (result[row.type] ?? 0) + 1; return result; }, {});
  const summary = Object.entries(counts).map(([type, count]) => `<li><b>${count}</b> ${escapeHtml(type)}</li>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen de cambios · ${escapeHtml(draft.document.title)} Rev. ${escapeHtml(draft.document.revision)}</title>
<style>
  body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#14223d;margin:24px}
  h1{font-size:20px;margin:0 0 4px}.meta{color:#566179;margin:0 0 14px}
  ul{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0 0 16px}li{padding:4px 10px;border:1px solid #c9d3e2;border-radius:999px;background:#f1f4f9}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #c9d3e2;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#1b2940;color:#fff}tr:nth-child(even) td{background:#f6f8fc}td.before{color:#8a2a2a}td.after{color:#1d5c24}
  @media print{body{margin:10mm}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>Resumen de cambios</h1>
<p class="meta">${escapeHtml(draft.document.title)} · ${escapeHtml(draft.document.id)} · Rev. ${escapeHtml(draft.document.revision || "sin número")} · ${new Date().toLocaleString("es-MX")}</p>
<ul>${summary || "<li>Sin cambios</li>"}</ul>
<table><thead><tr><th>Hoja</th><th>Paso</th><th>Tipo de cambio</th><th>Antes</th><th>Después</th></tr></thead><tbody>
${rows.map((row) => `<tr><td>${escapeHtml(row.sheet)}</td><td>${escapeHtml(row.step)}</td><td>${escapeHtml(row.type)}</td><td class="before">${escapeHtml(row.before)}</td><td class="after">${escapeHtml(row.after)}</td></tr>`).join("") || '<tr><td colspan="5">Todavía no hay cambios en esta revisión.</td></tr>'}
</tbody></table>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const opened = window.open(url, "_blank");
  if (!opened) downloadSopBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `Resumen_de_cambios_Rev${draft.document.revision || "borrador"}.html`);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------------------------------------------------------------- hoja con anotaciones → lienzo
async function renderSopSheetCanvas(draft, procedure, { maxWidth = 1700 } = {}) {
  const pdf = await getSopDraftPdfDocument(draft);
  const page = await pdf.getPage(Number(procedure.pdfPage ?? procedure.sheet));
  const natural = page.getViewport({ scale: 1 });
  const scale = Math.min(3, maxWidth / natural.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
  const aspect = natural.width / natural.height;
  const annotations = procedure.annotations ?? [];
  if (annotations.length) {
    const height = Math.round(1000 / aspect * 100) / 100;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" width="${canvas.width}" height="${canvas.height}" preserveAspectRatio="none">${renderSopAnnotationContents(annotations, null, { aspect, print: true })}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("No se pudieron dibujar las anotaciones.")); image.src = url; });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { canvas, width: canvas.width, height: canvas.height, ptWidth: natural.width, ptHeight: natural.height };
}

// ---------------------------------------------------------------- PDF (imágenes JPEG, sin dependencias)
function buildSopPdf(pages) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, body, stream = null) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}`);
    if (stream) { push("\nstream\n"); push(stream); push("\nendstream"); }
    push("\nendobj\n");
  };
  push(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  const kids = pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((page, index) => {
    const base = 3 + index * 3;
    const w = page.ptWidth.toFixed(2);
    const h = page.ptHeight.toFixed(2);
    object(base, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${base + 2} 0 R >> >> /Contents ${base + 1} 0 R >>`);
    const content = encoder.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(base + 1, `<< /Length ${content.length} >>`, content);
    object(base + 2, `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`, page.jpeg);
  });
  const total = 3 + pages.length * 3;
  const xrefStart = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

async function exportSopAnnotatedPdf(draft, procedures, onProgress = () => {}) {
  const pages = [];
  for (let index = 0; index < procedures.length; index += 1) {
    onProgress(index + 1, procedures.length);
    const sheet = await renderSopSheetCanvas(draft, procedures[index], { maxWidth: 1700 });
    const blob = await new Promise((resolve) => sheet.canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("No se pudo preparar una de las hojas para el PDF.");
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: sheet.width, height: sheet.height, ptWidth: sheet.ptWidth, ptHeight: sheet.ptHeight });
    sheet.canvas.width = 1;
    sheet.canvas.height = 1;
  }
  return buildSopPdf(pages);
}
