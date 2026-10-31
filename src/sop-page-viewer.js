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

async function renderSopPagePreview() {
  const viewport = document.querySelector("#sop-page-preview");
  if (!viewport) return;
  const canvas = viewport.querySelector("canvas");
  const iframe = viewport.querySelector("iframe");
  const status = viewport.querySelector(".guided-pdf-status");
  if (!canvas || !iframe || !status) return;

  const sequence = ++sopPageRenderSequence;
  const source = viewport.dataset.pdfSource;
  const pageNumber = Number(viewport.dataset.pdfPage);
  const zoom = Number(viewport.dataset.zoom) || 100;
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
    const fitScale = Math.min(availableWidth / naturalViewport.width, availableHeight / naturalViewport.height);
    const scale = Math.max(0.2, fitScale * zoom / 100);
    const pageViewport = page.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
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
    iframe.src = "about:blank";
    status.hidden = true;
  } catch (error) {
    if (sequence !== sopPageRenderSequence) return;
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
