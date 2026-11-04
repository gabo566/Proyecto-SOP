let sopDraftPdfReference = null;
let sopDraftPdfDocumentPromise = null;

async function getSopDraftPdfDocument(version) {
  const pdfBlob = version.pdf?.blob instanceof Blob ? version.pdf.blob : null;
  const sourcePath = String(version.pdf?.url || version.document.pdfPath || "").trim();
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
