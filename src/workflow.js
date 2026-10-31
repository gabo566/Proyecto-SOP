function createWorkItemWorkflow(state, { getProcedure, createEmptyForm, render, showToast, persistSavedRecords }) {
  function getTimestamp() {
    const now = new Date();
    return {
      at: now.getTime(),
      date: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(now).replaceAll(".", ""),
      time: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    };
  }

  function appendEvent(item, status, note) {
    const timestamp = getTimestamp();
    item.status = status;
    item.updatedAt = timestamp.at;
    item.updatedLabel = `${timestamp.date} · ${timestamp.time}`;
    item.history = [...item.history, { ...timestamp, status, note }];
  }

  const evidenceWorkflow = createEvidenceWorkflow(state, { render, showToast, persistSavedRecords, getTimestamp, appendEvent });
  const evidenceCaptureWorkflow = createEvidenceCaptureWorkflow(state, { render, getTimestamp });

  function persistProgress() {
    if (!state.activeWorkId) {
      const hasEnteredRunData = Boolean(
        state.form.nodeNumber?.trim()
        || state.form.serial?.trim()
        || state.form.repairType?.trim()
        || state.form.componentPartNumber?.trim()
        || state.form.componentSerial?.trim()
        || state.sopRun?.procedureIds.some((procedureId) => getGuidedSopCheckedSteps(state.sopRun, procedureId).length),
      );
      if (!hasEnteredRunData) return true;
      if (!state.sopRun || !startGuidedWork(state.sopRun)) return false;
    }
    const item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) return true;
    const procedure = getProcedure();
    const allCompletedSteps = state.sopRun
      ? state.sopRun.procedureIds.flatMap((procedureId) => getGuidedSopCheckedSteps(state.sopRun, procedureId))
      : [...state.completedSteps];
    Object.assign(item, {
      procedureId: state.selectedId,
      procedureTitle: state.sopRun?.document.title ?? procedure.title,
      sheet: procedure.sheet,
      serial: state.form.serial.trim(),
      nodeNumber: state.form.nodeNumber.trim(),
      employeeNumber: state.form.employeeNumber,
      completedSteps: allCompletedSteps,
      totalSteps: state.sopRun ? getGuidedSopProgress(state.sopRun, SOP_SHEETS).total : procedure.steps.length,
      form: { ...state.form },
      sopRun: state.sopRun ? structuredClone(state.sopRun) : null,
      updatedAt: Date.now(),
    });
    return persistWorkItems(state.workItems);
  }

  function startGuidedWork(run) {
    const currentProcedure = getProcedure();
    let item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) {
      const timestamp = getTimestamp();
      item = { id: `work-${timestamp.at}`, createdAt: timestamp.at, attempts: 0, history: [], evidenceFiles: [], evidenceHistory: [], evidenceObservation: "" };
      state.workItems = [item, ...state.workItems];
      state.activeWorkId = item.id;
    }
    const timestamp = getTimestamp();
    Object.assign(item, {
      category: SOP_DOCUMENT.family || currentProcedure.category,
      sopDocumentId: run.document.id,
      sopVersionId: run.versionId,
      sopRevision: run.document.revision,
      procedureId: currentProcedure.id,
      procedureTitle: run.document.title,
      sheet: currentProcedure.sheet,
      serial: state.form.serial.trim(),
      nodeNumber: state.form.nodeNumber.trim(),
      employeeNumber: state.form.employeeNumber,
      form: { ...state.form },
      completedSteps: [...state.completedSteps],
      totalSteps: run.procedureIds.reduce((count, id) => count + (SOP_SHEETS.find((procedure) => procedure.id === id)?.steps.length ?? 0), 0),
      sopRun: structuredClone(run),
      workKind: item.workKind === "rework" ? "rework" : "guided",
      status: item.workKind === "rework" ? "Retrabajo en proceso" : "En proceso",
      updatedAt: timestamp.at,
      updatedLabel: `${timestamp.date} · ${timestamp.time}`,
    });
    item.history = [...(item.history ?? []), { ...timestamp, status: item.status, note: `Inició ${run.document.title} · Rev. ${run.document.revision}` }];
    const saved = persistWorkItems(state.workItems);
    if (!saved) {
      state.workItems = readWorkItems();
      state.activeWorkId = "";
      return false;
    }
    recordLocalAuditEvent("guided_sop_started", {
      serial: item.serial,
      nodeNumber: item.nodeNumber,
      procedureId: currentProcedure.id,
      procedureTitle: run.document.title,
      sheet: currentProcedure.sheet,
      workItemId: item.id,
      details: `Rev. ${run.document.revision}; ${run.procedureIds.length} hojas con pasos`,
    });
    return true;
  }

  function openDialog() {
    state.workDraft = { type: "pause", failedStep: "", note: "", reasonCode: "", repairType: state.form.repairType ?? "", componentPartNumber: state.form.componentPartNumber ?? "", componentSerial: state.form.componentSerial ?? "", evidenceFiles: [] };
    state.workError = "";
    state.workDialogOpen = true;
    render();
  }

  function closeDialog() {
    const stagedEvidence = state.workDraft.evidenceFiles ?? [];
    Promise.all(stagedEvidence.map((file) => deleteEvidenceFile(file.id).catch(() => {})));
    state.workDraft = { type: "pause", failedStep: "", note: "", reasonCode: "", repairType: "", componentPartNumber: "", componentSerial: "", evidenceFiles: [] };
    state.workDialogOpen = false;
    state.workError = "";
    render();
  }

  function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const type = formData.get("workType");
    const reasonLabel = String(formData.get("reasonCode") ?? "").trim();
    const note = String(formData.get("workNote") ?? "").trim();
    const failedStep = String(formData.get("failedStep") ?? "").trim();
    const repairType = String(formData.get("repairType") ?? "").trim();
    const componentPartNumber = String(formData.get("componentPartNumber") ?? "").trim();
    const componentSerial = String(formData.get("componentSerial") ?? "").trim();
    if (!state.form.serial.trim() || !state.form.name.trim() || !state.form.employeeNumber.trim()) {
      state.workError = "Captura el serial, nombre del operador y número de empleado antes de detener el trabajo.";
    } else if (!reasonLabel || !note || (type === "rework" && !failedStep)) {
      state.workError = type === "rework" && !failedStep
        ? "Selecciona el paso donde se detectó la falla."
        : "Selecciona un motivo y escribe una nota para el siguiente responsable.";
    } else {
      const timestamp = getTimestamp();
      const procedure = getProcedure();
      const isRework = type === "rework";
      state.form.repairType = repairType;
      state.form.componentPartNumber = componentPartNumber;
      state.form.componentSerial = componentSerial;
      const allCompletedSteps = state.sopRun
        ? state.sopRun.procedureIds.flatMap((procedureId) => getGuidedSopCheckedSteps(state.sopRun, procedureId))
        : [...state.completedSteps];
      let item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
      if (!item) {
        item = { id: `work-${timestamp.at}`, createdAt: timestamp.at, attempts: 0, history: [], evidenceFiles: [], evidenceHistory: [], evidenceObservation: "" };
        state.workItems = [item, ...state.workItems];
      }
      Object.assign(item, {
        category: procedure.category,
        sopDocumentId: SOP_DOCUMENT.id,
        sopVersionId: state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID,
        sopRevision: SOP_DOCUMENT.revision,
        procedureId: procedure.id,
        procedureTitle: procedure.title,
        sheet: procedure.sheet,
        serial: state.form.serial.trim(),
        nodeNumber: state.form.nodeNumber.trim(),
        employeeNumber: state.form.employeeNumber.trim(),
        form: { ...state.form },
        repairType,
        componentPartNumber,
        componentSerial,
        completedSteps: allCompletedSteps,
        totalSteps: state.sopRun ? getGuidedSopProgress(state.sopRun, SOP_SHEETS).total : procedure.steps.length,
        sopRun: state.sopRun ? structuredClone(state.sopRun) : item.sopRun ?? null,
        failedStep: isRework ? failedStep : item.failedStep ?? "",
        workKind: isRework ? "rework" : item.workKind ?? "pause",
        reasonLabel,
        reason: note,
        stopEvidence: [...(state.workDraft.evidenceFiles ?? []), ...(state.validationEvidenceFiles ?? [])],
      });
      appendEvent(item, isRework ? "Retrabajo requerido" : "Detenida", `${reasonLabel}: ${note}`);
      if (!persistWorkItems(state.workItems)) {
        state.workItems = readWorkItems();
        state.workError = "No se pudo guardar. Revisa el almacenamiento local del navegador.";
      } else {
        recordLocalAuditEvent(isRework ? "rework_required" : "work_paused", {
          serial: item.serial,
          nodeNumber: item.nodeNumber,
          procedureId: item.procedureId,
          procedureTitle: item.procedureTitle,
          sheet: item.sheet,
          workItemId: item.id,
          step: item.failedStep,
          details: `${reasonLabel}: ${note}`,
        });
        state.activeWorkId = "";
        state.completedSteps = [];
        state.sopRun = null;
        state.form = createEmptyForm();
        state.validationEvidenceFiles = [];
        state.workDialogOpen = false;
        state.workDraft = { type: "pause", failedStep: "", note: "", reasonCode: "", repairType: "", componentPartNumber: "", componentSerial: "", evidenceFiles: [] };
        state.workError = "";
        showToast(isRework ? "Retrabajo guardado con el avance original." : "Trabajo detenido; el avance quedó guardado.");
        return;
      }
    }
    document.querySelector("#work-item-error").textContent = state.workError;
    document.querySelector("#work-item-error").hidden = false;
  }

  function resume(id) {
    if (state.activeWorkId) {
      showToast("Guarda el trabajo activo antes de reanudar otro.", "warning");
      return;
    }
    const item = state.workItems.find((workItem) => workItem.id === id);
    if (!item || item.status === "Completado") return;
    const activeSopVersionId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID;
    const itemSopVersionId = item.sopVersionId ?? BUILT_IN_SOP_VERSION_ID;
    if (itemSopVersionId !== activeSopVersionId) {
      showToast(`Este trabajo usa la SOP Rev. ${item.sopRevision ?? "anterior"}. Activa esa versión antes de reanudarlo.`, "warning");
      return;
    }
    const itemIndex = state.workItems.indexOf(item);
    const previousItem = JSON.parse(JSON.stringify(item));
    const previousState = {
      selectedId: state.selectedId,
      completedSteps: [...state.completedSteps],
      form: { ...state.form },
      activeWorkId: state.activeWorkId,
      sopRun: state.sopRun ? structuredClone(state.sopRun) : null,
    };
    state.sopRun = item.sopRun ? structuredClone(item.sopRun) : null;
    state.selectedId = state.sopRun
      ? getGuidedSopProcedure(state.sopRun, PROCEDURES)?.id ?? item.procedureId
      : item.procedureId;
    state.completedSteps = state.sopRun
      ? getGuidedSopCheckedSteps(state.sopRun, state.selectedId)
      : [...item.completedSteps];
    state.form = { ...createEmptyForm(), ...item.form };
    state.activeWorkId = item.id;
    const isStartingRework = item.status === "Retrabajo requerido";
    if (isStartingRework) {
      item.attempts += 1;
      if (state.sopRun) {
        setGuidedSopStep(state.sopRun, state.selectedId, item.failedStep, false);
        state.completedSteps = getGuidedSopCheckedSteps(state.sopRun, state.selectedId);
        item.sopRun = structuredClone(state.sopRun);
        item.completedSteps = state.sopRun.procedureIds.flatMap((procedureId) => getGuidedSopCheckedSteps(state.sopRun, procedureId));
      } else {
        state.completedSteps = state.completedSteps.filter((step) => step !== item.failedStep);
        item.completedSteps = [...state.completedSteps];
      }
    }
    const resumeNote = isStartingRework ? `Paso ${item.failedStep} reabierto para corregir y revalidar` : `Retoma ${state.form.name || "el responsable"} (${state.form.employeeNumber || "sin número"})`;
    appendEvent(item, item.workKind === "rework" ? "Retrabajo en proceso" : "En proceso", resumeNote);
    if (!persistWorkItems(state.workItems)) {
      state.workItems[itemIndex] = previousItem;
      Object.assign(state, previousState);
      showToast("No se pudo registrar la reanudación en este navegador.", "warning");
      return;
    }
    recordLocalAuditEvent("work_resumed", {
      serial: item.serial,
      nodeNumber: item.nodeNumber,
      procedureId: item.procedureId,
      procedureTitle: item.procedureTitle,
      sheet: item.sheet,
      workItemId: item.id,
      step: item.failedStep,
    });
    state.activeSection = "production";
    render();
    document.getElementById("production")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function prepareCompletionRecord(record) {
    const item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) return;
    record.workItemId = item.id;
    record.sopDocumentId = item.sopDocumentId ?? record.sopDocumentId;
    record.sopVersionId = item.sopVersionId ?? record.sopVersionId;
    record.sopRevision = item.sopRevision ?? record.sopRevision;
    record.repairType = record.repairType || item.repairType || "";
    item.repairType = record.repairType;
    record.componentPartNumber = record.componentPartNumber || item.componentPartNumber || "";
    record.componentSerial = record.componentSerial || item.componentSerial || "";
    item.componentPartNumber = record.componentPartNumber;
    item.componentSerial = record.componentSerial;
    record.attemptNumber = item.attempts;
    if (item.workKind === "rework") {
      record.status = "Pendiente de revisión";
      record.recordType = "Retrabajo enviado a revisión";
      record.evidenceCount = item.evidenceFiles?.length ?? 0;
      record.evidenceObservation = item.evidenceObservation ?? "";
    } else if (item.workKind === "pause") {
      record.recordType = "SOP reanudada";
    } else {
      record.recordType = "Validación guiada SOP";
    }
  }

  function completeActiveWork(recordId, operator) {
    const item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) return { saved: true, needsReview: false };
    const needsReview = item.workKind === "rework";
    if (needsReview) {
      item.evidenceHistory = [...(item.evidenceHistory ?? []), {
        attempt: item.attempts,
        files: [...item.evidenceFiles],
        recordId,
        submittedBy: operator,
        submittedAt: getTimestamp(),
        observations: item.evidenceObservation ?? "",
        reviewStatus: "Pendiente de revisión",
      }];
      item.evidenceFiles = [];
    }
    item.submissionRecordId = recordId;
    appendEvent(item, needsReview ? "Pendiente de revisión" : "Completado", needsReview
      ? `Evidencia enviada por ${operator}; requiere aprobación del supervisor`
      : `Validación registrada por ${operator}`);
    const saved = persistWorkItems(state.workItems);
    state.activeWorkId = "";
    return { saved, needsReview };
  }

  return {
    persistProgress,
    startGuidedWork,
    openDialog,
    closeDialog,
    submit,
    resume,
    prepareCompletionRecord,
    completeActiveWork,
    ...evidenceWorkflow,
    ...evidenceCaptureWorkflow,
  };
}
