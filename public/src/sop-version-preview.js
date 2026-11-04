let sopDraftPdfReference = null;
let sopDraftPdfDocumentPromise = null;
let sopDraftPreviewSequence = 0;

async function getSopDraftPdfDocument(version) {
  const pdfBlob = version.pdf?.blob instanceof Blob ? version.pdf.blob : null;
  const sourcePath = String(version.document.pdfPath ?? "").trim();
  if (!pdfBlob && !sourcePath) throw new Error("Esta SOP no tiene un PDF disponible para previsualizar.");
  const source = pdfBlob ?? new URL(sourcePath, document.baseURI).href;
  if (source !== sopDraftPdfReference) {
    const previous = sopDraftPdfDocumentPromise;
    sopDraftPdfReference = source;
    sopDraftPdfDocumentPromise = null;
    previous?.then((pdf) => pdf.destroy()).catch(() => {});
  }
  if (!sopDraftPdfDocumentPromise) {
    const pdfjs = await loadSopPdfJs();
    const assetRoot = new URL("./public/vendor/pdfjs/", document.baseURI).href;
    const data = pdfBlob ? new Uint8Array(await pdfBlob.arrayBuffer()) : null;
    sopDraftPdfDocumentPromise = pdfjs.getDocument({
      ...(data ? { data } : { url: source }),
      standardFontDataUrl: `${assetRoot}standard_fonts/`,
      cMapUrl: `${assetRoot}cmaps/`,
      cMapPacked: true,
      verbosity: pdfjs.VerbosityLevel?.ERROR,
    }).promise.catch((error) => {
      sopDraftPdfDocumentPromise = null;
      throw error;
    });
  }
  return sopDraftPdfDocumentPromise;
}

async function renderSopDraftPdfPage(dialog, version, procedureIndex, stepIndex) {
  const canvas = dialog?.querySelector("[data-sop-preview-canvas]");
  const status = dialog?.querySelector("[data-sop-preview-status]");
  const procedure = version?.procedures?.[procedureIndex];
  if (!canvas || !status || !procedure) return;

  const sequence = ++sopDraftPreviewSequence;
  const pdfPage = Number(procedure.pdfPage ?? procedure.sheet);
  status.textContent = "Cargando hoja completa…";
  status.hidden = false;
  canvas.hidden = true;
  try {
    const pdf = await getSopDraftPdfDocument(version);
    if (sequence !== sopDraftPreviewSequence) return;
    if (!Number.isInteger(pdfPage) || pdfPage < 1 || pdfPage > pdf.numPages) {
      throw new Error(`No existe la página ${pdfPage} en el PDF (${pdf.numPages} hojas).`);
    }
    const page = await pdf.getPage(pdfPage);
    if (sequence !== sopDraftPreviewSequence) return;
    const natural = page.getViewport({ scale: 1 });
    const frame = canvas.closest(".sop-draft-preview-page");
    const canvasWrap = canvas.parentElement;
    const availableWidth = Math.max(1, frame.clientWidth - 24);
    const availableHeight = Math.max(1, frame.clientHeight - 24);
    const zoom = Math.max(1, Math.min(6, Number(dialog.dataset.zoom) || 1));
    const scale = Math.min(availableWidth / natural.width, availableHeight / natural.height) * zoom;
    const viewport = page.getViewport({ scale });
    const outputScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 4096 / viewport.width, 4096 / viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("No se pudo preparar la vista previa de la hoja.");
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    canvasWrap.style.width = `${Math.ceil(viewport.width)}px`;
    canvasWrap.style.height = `${Math.ceil(viewport.height)}px`;
    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      background: "#ffffff",
    }).promise;
    if (sequence !== sopDraftPreviewSequence) return;

    const currentStep = procedure.steps[stepIndex];
    const hasTextFix = (procedure.annotations ?? []).some((annotation) => annotation.type === "textfix" && annotation.stepNumber === currentStep?.number);
    const bounds = hasTextFix ? null : currentStep?.sourceBounds;
    if (bounds) {
      const lowerLeft = viewport.convertToViewportPoint(bounds.x, bounds.y);
      const upperRight = viewport.convertToViewportPoint(bounds.x + bounds.width, bounds.y + bounds.height);
      const x = Math.min(lowerLeft[0], upperRight[0]);
      const y = Math.min(lowerLeft[1], upperRight[1]);
      const width = Math.max(2, Math.abs(upperRight[0] - lowerLeft[0]));
      const height = Math.max(2, Math.abs(upperRight[1] - lowerLeft[1]));
      context.save();
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      context.fillStyle = "rgba(30, 136, 229, .12)";
      context.strokeStyle = "#1684e8";
      context.lineWidth = 2;
      context.fillRect(x - 3, y - 3, width + 6, height + 6);
      context.strokeRect(x - 3, y - 3, width + 6, height + 6);
      context.restore();
      status.textContent = `Hoja ${procedure.sheet} completa · ubicación del paso ${procedure.steps[stepIndex]?.number} resaltada`;
    } else {
      status.textContent = hasTextFix
        ? `Hoja ${procedure.sheet} completa · paso ${currentStep.number} con el texto corregido`
        : `Hoja ${procedure.sheet} completa · consulta el texto actualizado del paso en el panel lateral`;
    }
    const overlay = dialog.querySelector("[data-sop-annotation-overlay]");
    if (overlay) overlay.innerHTML = renderSopAnnotationContents(procedure.annotations ?? []);
    canvas.hidden = false;
    canvas._sopViewport = viewport;
    const focusBounds = procedure.steps[stepIndex]?.sourceBounds;
    const zoomTarget = dialog._zoomTarget;
    if (zoom > 1 && zoomTarget) {
      dialog._zoomTarget = null;
      const frameRect = frame.getBoundingClientRect();
      const wrapRect = canvasWrap.getBoundingClientRect();
      frame.scrollLeft += wrapRect.left + zoomTarget.cx * wrapRect.width - (frameRect.left + frame.clientWidth / 2);
      frame.scrollTop += wrapRect.top + zoomTarget.cy * wrapRect.height - (frameRect.top + frame.clientHeight / 2);
    } else if (zoom > 1 && focusBounds) {
      const a = viewport.convertToViewportPoint(focusBounds.x, focusBounds.y);
      const b = viewport.convertToViewportPoint(focusBounds.x + focusBounds.width, focusBounds.y + focusBounds.height);
      const frameRect = frame.getBoundingClientRect();
      const wrapRect = canvasWrap.getBoundingClientRect();
      frame.scrollLeft += wrapRect.left + (a[0] + b[0]) / 2 - (frameRect.left + frame.clientWidth / 2);
      frame.scrollTop += wrapRect.top + (a[1] + b[1]) / 2 - (frameRect.top + frame.clientHeight / 2);
    }
  } catch (error) {
    if (sequence !== sopDraftPreviewSequence) return;
    status.textContent = error?.message || "No se pudo cargar la hoja de la SOP.";
    canvas.hidden = true;
  }
}
