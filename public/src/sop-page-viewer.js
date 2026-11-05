let sopPagePdfJsPromise = null;
let sopPagePdfSource = "";
let sopPagePdfDocumentPromise = null;
let sopPageRenderSequence = 0;
let sopPageResizeTimer = 0;

async function getSopPagePdfJs() {
  if (!sopPagePdfJsPromise) {
    sopPagePdfJsPromise = import(new URL("./public/vendor/pdfjs/pdf.min.mjs", document.baseURI).href)
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("./public/vendor/pdfjs/pdf.worker.mjs", document.baseURI).href;
        return pdfjs;
      })
      .catch((error) => {
        sopPagePdfJsPromise = null;
        throw error;
      });
  }
  return sopPagePdfJsPromise;
}

async function getSopPagePdfDocument(pdfjs, source) {
  if (source !== sopPagePdfSource) {
    const previous = sopPagePdfDocumentPromise;
    sopPagePdfSource = source;
    sopPagePdfDocumentPromise = null;
    previous?.then((documentProxy) => documentProxy.destroy()).catch(() => {});
  }
  if (!sopPagePdfDocumentPromise) {
    sopPagePdfDocumentPromise = pdfjs.getDocument({ url: source }).promise.catch((error) => {
      sopPagePdfDocumentPromise = null;
      throw error;
    });
  }
  return sopPagePdfDocumentPromise;
}

// Escala de dibujo del PDF: al menos 3x y nunca por debajo de la densidad de píxeles de la pantalla.
function getSopPageOutputScale(width, height) {
  const wanted = Math.max(window.devicePixelRatio || 1, 3);
  const bySide = 8192 / Math.max(1, width, height);
  const byArea = Math.sqrt(36_000_000 / Math.max(1, width * height));
  return Math.max(1, Math.min(5, wanted, bySide, byArea));
}

// ---- Hoja completa: ventana grande con la hoja entera, zoom y desplazamiento ----
let sopFullSheet = null;

async function openSopFullSheet() {
  const source = document.querySelector("#sop-page-preview");
  if (!source || sopFullSheet) return;
  const pdfSource = source.dataset.pdfSource;
  const pageNumber = Number(source.dataset.pdfPage);
  if (!pdfSource || !pageNumber) return;
  const title = document.querySelector(".guided-page-sheet")?.textContent || `Hoja ${pageNumber}`;
  const overlay = document.createElement("div");
  overlay.className = "sop-full-sheet";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `${title} completa`);
  overlay.innerHTML = `<div class="sop-full-sheet-bar"><strong><span class="material-symbols-rounded" aria-hidden="true">description</span>${title.replace(/[<>&]/g, "")} · hoja completa</strong>
    <span class="sop-full-sheet-tools"><button type="button" data-fs="out" aria-label="Alejar"><span class="material-symbols-rounded" aria-hidden="true">remove</span></button><output data-fs="level">100%</output><button type="button" data-fs="in" aria-label="Acercar"><span class="material-symbols-rounded" aria-hidden="true">add</span></button><button type="button" data-fs="fit" aria-label="Ajustar a la pantalla" title="Ajustar a la pantalla"><span class="material-symbols-rounded" aria-hidden="true">fit_screen</span></button><button type="button" data-fs="close" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></span></div>
    <div class="sop-full-sheet-body" tabindex="0"><canvas aria-label="${title.replace(/[<>&"]/g, "")} completa"></canvas><p class="sop-full-sheet-status" role="status">Cargando hoja completa…</p></div>`;
  document.body.append(overlay);
  document.body.classList.add("sop-full-sheet-open");
  const body = overlay.querySelector(".sop-full-sheet-body");
  const canvas = overlay.querySelector("canvas");
  const status = overlay.querySelector(".sop-full-sheet-status");
  const level = overlay.querySelector('[data-fs="level"]');
  const trigger = document.activeElement;
  let zoom = 100;
  let page = null;
  let sequence = 0;
  const state = { overlay, trigger };
  sopFullSheet = state;

  const render = async () => {
    if (!page) return;
    const token = ++sequence;
    const natural = page.getViewport({ scale: 1 });
    const fit = Math.min((body.clientWidth - 32) / natural.width, (body.clientHeight - 32) / natural.height);
    const viewport = page.getViewport({ scale: Math.max(0.1, fit * zoom / 100) });
    const outputScale = getSopPageOutputScale(viewport.width, viewport.height);
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    level.textContent = `${zoom}%`;
    await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0], background: "#ffffff" }).promise;
    if (token !== sequence) return;
    status.hidden = true;
    canvas.hidden = false;
  };
  const setZoom = (value) => { zoom = Math.max(50, Math.min(400, value)); void render(); };
  const close = () => {
    sequence += 1;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    overlay.remove();
    document.body.classList.remove("sop-full-sheet-open");
    sopFullSheet = null;
    if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
  };
  const onKey = (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "+" || event.key === "=") setZoom(zoom + 25);
    else if (event.key === "-") setZoom(zoom - 25);
    else if (event.key === "0") setZoom(100);
  };
  let resizeTimer = 0;
  const onResize = () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(render, 120); };
  overlay.addEventListener("click", (event) => {
    const action = event.target.closest("[data-fs]")?.dataset.fs;
    if (action === "close" || event.target === overlay) close();
    else if (action === "in") setZoom(zoom + 25);
    else if (action === "out") setZoom(zoom - 25);
    else if (action === "fit") setZoom(100);
  });
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize, { passive: true });
  canvas.hidden = true;
  overlay.querySelector('[data-fs="close"]').focus();
  try {
    const pdfjs = await getSopPagePdfJs();
    const pdf = await getSopPagePdfDocument(pdfjs, pdfSource);
    page = await pdf.getPage(pageNumber);
    await render();
  } catch (error) {
    status.textContent = "No se pudo abrir la hoja completa. Cierra esta ventana e inténtalo de nuevo.";
  }
}

async function renderSopPagePreview(zoomAnchor = null) {
  const viewport = document.querySelector("#sop-page-preview");
  if (!viewport) return;
  const canvas = viewport.querySelector("canvas");
  const iframe = viewport.querySelector("iframe");
  const status = viewport.querySelector(".guided-pdf-status");
  if (!canvas || !iframe || !status) return;

  const sequence = ++sopPageRenderSequence;
  const source = viewport.dataset.pdfSource;
  const pageNumber = Number(viewport.dataset.pdfPage);
  let zoom = Number(viewport.dataset.zoom) || 100;
  if (!source || !Number.isInteger(pageNumber) || pageNumber < 1) {
    status.textContent = "No se encontró el PDF de la SOP para mostrar esta hoja.";
    status.hidden = false;
    canvas.hidden = true;
    iframe.hidden = true;
    return;
  }

  status.textContent = "Cargando hoja completa…";
  status.hidden = false;
  canvas.hidden = true;
  iframe.hidden = true;
  iframe.onload = null;
  iframe.onerror = null;
  try {
    const pdfjs = await getSopPagePdfJs();
    const pdf = await getSopPagePdfDocument(pdfjs, source);
    if (sequence !== sopPageRenderSequence) return;
    if (pageNumber > pdf.numPages) throw new Error(`El PDF tiene ${pdf.numPages} páginas; no existe la página ${pageNumber}.`);

    const page = await pdf.getPage(pageNumber);
    if (sequence !== sopPageRenderSequence) return;
    const naturalViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, viewport.clientHeight - 24);
    // En teléfono la caja del visor toma la altura de la hoja (sin mínimo fijo), así que la
    // hoja se ajusta solo al ancho; en pantallas grandes sigue cabiendo completa en la caja.
    const fitsWidthOnly = window.matchMedia("(max-width: 650px)").matches;
    const fitScale = fitsWidthOnly
      ? availableWidth / naturalViewport.width
      : Math.min(availableWidth / naturalViewport.width, availableHeight / naturalViewport.height);
    // Zoom automático: la hoja se ajusta al ancho del recuadro para verse completa desde el inicio (sin franjas a los lados).
    if (state.sopPageZoomAuto && !fitsWidthOnly && !state.sopFocusedZoom) {
      const widthFit = Math.max(1, availableWidth - 16) / naturalViewport.width; // 16 px: barra de desplazamiento vertical
      const heightFit = availableHeight / naturalViewport.height;
      zoom = widthFit > heightFit ? Math.max(100, Math.min(300, Math.round(widthFit / heightFit * 100))) : 100;
      state.sopPageZoom = zoom;
      viewport.dataset.zoom = String(zoom);
      const level = document.querySelector("#sop-page-zoom-level");
      if (level) level.textContent = `${zoom}%`;
      const zoomIn = document.querySelector('[data-action="sop-page-zoom-in"]');
      const zoomOut = document.querySelector('[data-action="sop-page-zoom-out"]');
      if (zoomIn) zoomIn.disabled = zoom >= 500;
      if (zoomOut) zoomOut.disabled = zoom <= 50;
    }
    const scale = Math.max(0.2, fitScale * zoom / 100);
    const pageViewport = page.getViewport({ scale });
    // Nitidez: se dibuja a 3x como mínimo (o la densidad de la pantalla) para que el texto de la hoja no salga borroso.
    const outputScale = getSopPageOutputScale(pageViewport.width, pageViewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("El navegador no pudo preparar el visor PDF.");

    canvas.width = Math.ceil(pageViewport.width * outputScale);
    canvas.height = Math.ceil(pageViewport.height * outputScale);
    canvas.style.width = `${Math.ceil(pageViewport.width)}px`;
    canvas.style.height = `${Math.ceil(pageViewport.height)}px`;
    await page.render({
      canvasContext: context,
      viewport: pageViewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      background: "#ffffff",
    }).promise;
    if (sequence !== sopPageRenderSequence) return;
    canvas.hidden = false;
    viewport.scrollLeft = Math.max(0, Math.round((viewport.scrollWidth - viewport.clientWidth) / 2));
    if (zoomAnchor) {
      const viewportBounds = viewport.getBoundingClientRect();
      const canvasBounds = canvas.getBoundingClientRect();
      const contentLeft = canvasBounds.left - viewportBounds.left - viewport.clientLeft + viewport.scrollLeft;
      const contentTop = canvasBounds.top - viewportBounds.top - viewport.clientTop + viewport.scrollTop;
      viewport.scrollLeft = contentLeft + zoomAnchor.pointX * canvasBounds.width - zoomAnchor.pointerX;
      viewport.scrollTop = contentTop + zoomAnchor.pointY * canvasBounds.height - zoomAnchor.pointerY;
    }
    iframe.src = "about:blank";
    status.hidden = true;
  } catch (error) {
    if (sequence !== sopPageRenderSequence) return;
    if (viewport.dataset.restricted === "true") {
      status.textContent = error?.message || "No se pudo cargar la hoja de la SOP.";
      status.hidden = false;
      return;
    }
    status.textContent = "Abriendo la hoja completa con el visor PDF del navegador…";
    const zoomScale = zoom / 100;
    iframe.style.width = `${100 / zoomScale}%`;
    iframe.style.height = `${100 / zoomScale}%`;
    iframe.style.transform = `scale(${zoomScale})`;
    iframe.style.transformOrigin = "center center";
    iframe.onload = () => {
      if (sequence !== sopPageRenderSequence) return;
      status.hidden = true;
    };
    iframe.onerror = () => {
      if (sequence !== sopPageRenderSequence) return;
      status.textContent = error?.message || "No se pudo cargar la hoja del PDF.";
      status.hidden = false;
    };
    iframe.hidden = false;
    iframe.src = `${source}#page=${pageNumber}&toolbar=0&navpanes=0&view=Fit`;
  }
}

window.addEventListener("resize", () => {
  window.clearTimeout(sopPageResizeTimer);
  sopPageResizeTimer = window.setTimeout(renderSopPagePreview, 100);
}, { passive: true });
