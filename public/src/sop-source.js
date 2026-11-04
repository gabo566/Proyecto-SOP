async function restoreStoredSopSource(state) {
  const saved = await loadSopSourcePdf();
  if (!saved?.blob) return false;
  if (state.sopPdfUrl) URL.revokeObjectURL(state.sopPdfUrl);
  state.sopPdfUrl = URL.createObjectURL(saved.blob);
  state.sopPdfName = saved.name;
  state.sopPdfUpdatedAt = saved.updatedAt;
  return true;
}

function bindSopSourceInteractions(app, { state, render, showToast }) {
  app.addEventListener("click", (event) => {
    const action = event.target.closest('[data-action="select-sop-pdf"]');
    if (action && app.contains(action) && !state.sopPdfUpdating) {
      app.querySelector("#sop-pdf-input")?.click();
    }
  });

  app.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.matches("#sop-pdf-input")) return;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const previousUrl = state.sopPdfUrl;
    state.sopPdfUpdating = true;
    render();
    try {
      const saved = await storeSopSourcePdf(file);
      state.sopPdfUrl = URL.createObjectURL(saved.blob);
      state.sopPdfName = saved.name;
      state.sopPdfUpdatedAt = saved.updatedAt;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      state.sopPdfUpdating = false;
      showToast("PDF SOP guardado en este navegador. Los pasos requieren cotejo manual.", "warning");
    } catch (error) {
      state.sopPdfUpdating = false;
      showToast(error?.message || "No se pudo guardar el PDF en el almacenamiento local.", "warning");
    }
  });
}
