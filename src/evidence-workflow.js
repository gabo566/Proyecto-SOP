function createEvidenceWorkflow(state, { render, showToast, persistSavedRecords, getTimestamp, appendEvent }) {
  function getActiveWorkItem() {
    return state.workItems.find((item) => item.id === state.activeWorkId);
  }

  function requiresEvidence() {
    return getActiveWorkItem()?.workKind === "rework";
  }

  function hasEvidence() {
    return (getActiveWorkItem()?.evidenceFiles?.length ?? 0) > 0;
  }

  function saveEvidenceObservation(value) {
    const item = getActiveWorkItem();
    if (!item || item.workKind !== "rework") return;
    item.evidenceObservation = String(value ?? "").slice(0, 500);
    persistWorkItems(state.workItems);
  }

  async function addEvidence(fileList) {
    const item = getActiveWorkItem();
    const files = [...(fileList ?? [])];
    if (!item || item.workKind !== "rework" || !files.length) return;
    const currentFiles = item.evidenceFiles ?? [];
    if (currentFiles.length + files.length > MAX_EVIDENCE_FILES) {
      state.evidenceError = `Puedes adjuntar hasta ${MAX_EVIDENCE_FILES} fotos por retrabajo.`;
      render();
      return;
    }
    const invalidFile = files.find((file) => !EVIDENCE_MIME_TYPES.has(file.type) || file.size > MAX_EVIDENCE_FILE_BYTES);
    if (invalidFile) {
      state.evidenceError = !EVIDENCE_MIME_TYPES.has(invalidFile.type)
        ? "Usa una foto JPG, PNG o WebP."
        : "Cada foto debe pesar 8 MB o menos.";
      render();
      return;
    }
    const itemSnapshot = JSON.parse(JSON.stringify(item));
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
      item.evidenceFiles = [...currentFiles, ...additions];
      if (!persistWorkItems(state.workItems)) throw new Error("local-storage");
      state.evidenceBusy = false;
      render();
    } catch {
      Object.assign(item, itemSnapshot);
      await Promise.all(additions.map((file) => deleteEvidenceFile(file.id).catch(() => {})));
      state.evidenceBusy = false;
      state.evidenceError = "No se pudo guardar la evidencia en este navegador.";
      render();
    }
  }

  async function removeEvidence(id) {
    const item = getActiveWorkItem();
    if (!item || item.workKind !== "rework") return;
    const file = (item.evidenceFiles ?? []).find((entry) => entry.id === id);
    if (!file) return;
    const previousFiles = item.evidenceFiles;
    item.evidenceFiles = previousFiles.filter((entry) => entry.id !== id);
    if (!persistWorkItems(state.workItems)) {
      item.evidenceFiles = previousFiles;
      state.evidenceError = "No se pudo actualizar la lista de evidencias.";
      render();
      return;
    }
    await deleteEvidenceFile(id).catch(() => {});
    state.evidenceError = "";
    render();
  }

  async function openEvidenceReview(id, recordId = "", manage = false, preview = false) {
    const item = state.workItems.find((workItem) => workItem.id === id);
    if (!item) return;
    const submissions = [...(item.evidenceHistory ?? [])].reverse();
    const currentEvidence = !recordId && item.evidenceFiles?.length
      ? { files: item.evidenceFiles, observations: item.evidenceObservation ?? "", reviewStatus: "Evidencia guardada", attempt: item.attempts }
      : null;
    const submission = recordId
      ? submissions.find((entry) => entry.recordId === recordId)
      : submissions.find((entry) => entry.reviewStatus === "Pendiente de revisión") ?? submissions[0];
    const evidenceSubmission = currentEvidence ?? submission;
    if (!evidenceSubmission || !Array.isArray(evidenceSubmission.files) || (!manage && !evidenceSubmission.files.length)) {
      showToast("Este retrabajo todavía no tiene evidencia adjunta.", "warning");
      return;
    }
    const loadedFiles = await Promise.all(evidenceSubmission.files.map(async (file) => {
      const saved = await loadEvidenceFile(file.id).catch(() => null);
      return saved ? { ...file, url: URL.createObjectURL(saved.blob) } : null;
    }));
    state.reviewItem = item;
    state.reviewSubmission = evidenceSubmission;
    state.reviewEvidence = loadedFiles.filter(Boolean);
    state.evidenceManageMode = manage;
    const canReview = item.status === "Pendiente de revisión"
      && evidenceSubmission.reviewStatus === "Pendiente de revisión"
      && evidenceSubmission.recordId === item.submissionRecordId;
    state.reviewReadOnly = manage || preview || !canReview;
    state.reviewNote = "";
    state.reviewObservation = evidenceSubmission.observations ?? "";
    state.reviewError = loadedFiles.every(Boolean) ? "" : "Una o más fotos no están disponibles en este navegador.";
    state.evidenceReviewDialogOpen = true;
    render();
  }

  function revokeReviewUrls() {
    state.reviewEvidence.forEach((file) => URL.revokeObjectURL(file.url));
    state.reviewEvidence = [];
  }

  function closeEvidenceReview() {
    state.evidenceReviewDialogOpen = false;
    const dialog = document.querySelector("#evidence-review-dialog");
    if (dialog?.open) dialog.close();
    state.reviewItem = null;
    state.reviewSubmission = null;
    state.reviewReadOnly = false;
    state.evidenceManageMode = false;
    state.reviewNote = "";
    state.reviewObservation = "";
    state.reviewError = "";
    revokeReviewUrls();
    render();
  }

  function handleReviewDialogClose() {
    if (!state.evidenceReviewDialogOpen) return;
    state.evidenceReviewDialogOpen = false;
    state.reviewItem = null;
    state.reviewSubmission = null;
    state.reviewReadOnly = false;
    state.evidenceManageMode = false;
    state.reviewNote = "";
    state.reviewObservation = "";
    state.reviewError = "";
    revokeReviewUrls();
    render();
  }

  function decideEvidenceReview(id, approved) {
    if (state.reviewReadOnly) return;
    const item = state.workItems.find((workItem) => workItem.id === id && workItem.status === "Pendiente de revisión");
    const submission = item?.evidenceHistory?.find((entry) => entry === state.reviewSubmission && entry.reviewStatus === "Pendiente de revisión");
    const record = state.savedRecords.find((entry) => entry.id === submission?.recordId);
    const note = state.reviewNote.trim();
    if (!item || !submission || !record) return;
    if (!approved && !note) {
      state.reviewError = "Escribe qué debe corregirse antes de devolver el retrabajo.";
      render();
      return;
    }
    if (approved && !state.reviewEvidence.length) {
      state.reviewError = "No hay evidencia visible para aprobar.";
      render();
      return;
    }
    const itemSnapshot = JSON.parse(JSON.stringify(item));
    const recordSnapshot = { ...record };
    const timestamp = getTimestamp();
    submission.reviewStatus = approved ? "Aprobada" : "Corrección solicitada";
    submission.reviewedBy = "Supervisor";
    submission.reviewedAt = timestamp;
    submission.reviewNote = note;
    record.reviewedBy = "Supervisor";
    record.reviewedAt = `${timestamp.date} · ${timestamp.time}`;
    record.reviewNote = note;
    if (approved) {
      record.status = "Completado";
      record.recordType = "Retrabajo validado";
      appendEvent(item, "Completado", `Evidencia aprobada por Supervisor${note ? `: ${note}` : ""}`);
    } else {
      record.status = "Corrección solicitada";
      record.recordType = "Retrabajo requiere ajuste";
      item.reasonLabel = "Corrección solicitada";
      item.reason = note;
      appendEvent(item, "Retrabajo requerido", `Supervisor solicitó corrección: ${note}`);
    }
    const recordsSaved = persistSavedRecords(state.savedRecords);
    const workSaved = recordsSaved && persistWorkItems(state.workItems);
    if (!workSaved) {
      Object.assign(item, itemSnapshot);
      Object.assign(record, recordSnapshot);
      persistWorkItems(state.workItems);
      state.reviewError = "No se pudo guardar la decisión de revisión.";
      render();
      return;
    }
    closeEvidenceReview();
    showToast(approved ? "Retrabajo aprobado y cerrado." : "Retrabajo devuelto para corrección.");
  }

  async function addEvidenceToRecord(fileList) {
    const item = state.reviewItem;
    const submission = state.reviewSubmission;
    if (!state.evidenceManageMode || !item || !submission) return;
    const files = [...(fileList ?? [])];
    if (!files.length) return;
    if (submission.files.length + files.length > MAX_EVIDENCE_FILES) {
      state.reviewError = `Puedes adjuntar hasta ${MAX_EVIDENCE_FILES} fotos por envío.`;
      render();
      return;
    }
    const invalidFile = files.find((file) => !EVIDENCE_MIME_TYPES.has(file.type) || file.size > MAX_EVIDENCE_FILE_BYTES);
    if (invalidFile) {
      state.reviewError = !EVIDENCE_MIME_TYPES.has(invalidFile.type) ? "Usa una foto JPG, PNG o WebP." : "Cada foto debe pesar 8 MB o menos.";
      render();
      return;
    }
    const itemSnapshot = JSON.parse(JSON.stringify(item));
    const record = state.savedRecords?.find((entry) => entry.id === submission.recordId);
    const recordSnapshot = record ? { ...record } : null;
    const additions = [];
    state.evidenceBusy = true;
    state.reviewError = "";
    render();
    try {
      for (const file of files) {
        const id = `evidence-${crypto.randomUUID()}`;
        await storeEvidenceFile(id, file);
        additions.push({ id, name: file.name, type: file.type, size: file.size, addedAt: getTimestamp() });
      }
      submission.files = [...submission.files, ...additions];
      if (record) record.evidenceCount = submission.files.length;
      const savedRecords = !record || persistSavedRecords(state.savedRecords);
      if (!savedRecords || !persistWorkItems(state.workItems)) throw new Error("save-failed");
      state.reviewEvidence = [...state.reviewEvidence, ...additions.map((file, index) => ({ ...file, url: URL.createObjectURL(files[index]) }))];
      state.evidenceBusy = false;
      render();
    } catch {
      Object.assign(item, itemSnapshot);
      if (record && recordSnapshot) Object.assign(record, recordSnapshot);
      await Promise.all(additions.map((file) => deleteEvidenceFile(file.id).catch(() => {})));
      state.evidenceBusy = false;
      state.reviewError = "No se pudieron guardar las fotos en este registro.";
      render();
    }
  }

  function saveManagedObservation(value) {
    if (!state.evidenceManageMode || !state.reviewSubmission) return;
    const submission = state.reviewSubmission;
    const item = state.reviewItem;
    const record = state.savedRecords.find((entry) => entry.id === submission.recordId);
    const previous = submission.observations ?? "";
    const previousRecordValue = record?.evidenceObservation;
    submission.observations = String(value ?? "").slice(0, 500);
    state.reviewObservation = submission.observations;
    if (record) record.evidenceObservation = submission.observations;
    if (!persistWorkItems(state.workItems) || (record && !persistSavedRecords(state.savedRecords))) {
      submission.observations = previous;
      if (record) record.evidenceObservation = previousRecordValue;
      state.reviewError = "No se pudieron guardar las observaciones.";
      render();
      return;
    }
    state.reviewError = "";
  }

  return {
    requiresEvidence,
    hasEvidence,
    saveEvidenceObservation,
    addEvidence,
    removeEvidence,
    openEvidenceReview,
    closeEvidenceReview,
    handleReviewDialogClose,
    decideEvidenceReview,
    addEvidenceToRecord,
    saveManagedObservation,
  };
}
