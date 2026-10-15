function createEvidenceCaptureWorkflow(state, { render, getTimestamp }) {
  async function saveEvidenceFiles(fileList, existing, onSaved, onError) {
    const files = [...(fileList ?? [])];
    if (!files.length) return;
    if (existing.length + files.length > MAX_EVIDENCE_FILES) {
      onError(`Puedes adjuntar hasta ${MAX_EVIDENCE_FILES} fotos.`);
      render();
      return;
    }
    const invalid = files.find((file) => !EVIDENCE_MIME_TYPES.has(file.type) || file.size > MAX_EVIDENCE_FILE_BYTES);
    if (invalid) {
      onError(!EVIDENCE_MIME_TYPES.has(invalid.type) ? "Usa una foto JPG, PNG o WebP." : "Cada foto debe pesar 8 MB o menos.");
      render();
      return;
    }
    state.evidenceBusy = true;
    state.evidenceError = "";
    render();
    const additions = [];
    try {
      for (const file of files) {
        const id = `evidence-${crypto.randomUUID()}`;
        await storeEvidenceFile(id, file);
        additions.push({ id, name: file.name, type: file.type, size: file.size, addedAt: getTimestamp() });
      }
      onSaved([...existing, ...additions]);
      state.evidenceBusy = false;
      render();
    } catch {
      await Promise.all(additions.map((file) => deleteEvidenceFile(file.id).catch(() => {})));
      state.evidenceBusy = false;
      onError("No se pudo guardar la evidencia en este navegador.");
      render();
    }
  }

  function addValidationEvidence(files) {
    return saveEvidenceFiles(files, state.validationEvidenceFiles ?? [], (next) => {
      state.validationEvidenceFiles = next;
    }, (message) => { state.evidenceError = message; });
  }

  async function removeValidationEvidence(id) {
    state.validationEvidenceFiles = (state.validationEvidenceFiles ?? []).filter((file) => file.id !== id);
    await deleteEvidenceFile(id).catch(() => {});
    state.evidenceError = "";
    render();
  }

  function addDraftEvidence(files) {
    return saveEvidenceFiles(files, state.workDraft.evidenceFiles ?? [], (next) => {
      state.workDraft.evidenceFiles = next;
    }, (message) => { state.workError = message; });
  }

  async function removeDraftEvidence(id) {
    state.workDraft.evidenceFiles = (state.workDraft.evidenceFiles ?? []).filter((file) => file.id !== id);
    await deleteEvidenceFile(id).catch(() => {});
    render();
  }

  async function openRecordEvidence(recordId) {
    const record = state.savedRecords.find((entry) => entry.id === recordId);
    const evidence = record?.evidenceFiles ?? [];
    if (!record || !evidence.length) {
      return;
    }
    const loaded = await Promise.all(evidence.map(async (file) => {
      const saved = await loadEvidenceFile(file.id).catch(() => null);
      return saved ? { ...file, url: URL.createObjectURL(saved.blob) } : null;
    }));
    state.reviewItem = { id: record.id, serial: record.serial, failedStep: "—" };
    state.reviewSubmission = { files: evidence, observations: record.evidenceObservation ?? "", reviewStatus: "Evidencia de validación" };
    state.reviewEvidence = loaded.filter(Boolean);
    state.evidenceManageMode = false;
    state.reviewReadOnly = true;
    state.reviewObservation = record.evidenceObservation ?? "";
    state.reviewError = loaded.every(Boolean) ? "" : "Una o más fotos no están disponibles en este navegador.";
    state.evidenceReviewDialogOpen = true;
    render();
  }

  return { addValidationEvidence, removeValidationEvidence, addDraftEvidence, removeDraftEvidence, openRecordEvidence };
}
