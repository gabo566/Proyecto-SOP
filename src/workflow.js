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

  function persistProgress() {
    if (!state.activeWorkId) return true;
    const item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) return true;
    const procedure = getProcedure();
    Object.assign(item, {
      procedureId: state.selectedId,
      procedureTitle: procedure.title,
      sheet: procedure.sheet,
      completedSteps: [...state.completedSteps],
      totalSteps: procedure.steps.length,
      form: { ...state.form },
      updatedAt: Date.now(),
    });
    return persistWorkItems(state.workItems);
  }

  function openDialog() {
    state.workDraft = { type: "pause", failedStep: "", note: "" };
    state.workError = "";
    state.workDialogOpen = true;
    render();
  }

  function closeDialog() {
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
      let item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
      if (!item) {
        item = { id: `work-${timestamp.at}`, createdAt: timestamp.at, attempts: 0, history: [], evidenceFiles: [], evidenceHistory: [], evidenceObservation: "" };
        state.workItems = [item, ...state.workItems];
      }
      Object.assign(item, {
        category: procedure.category,
        procedureId: procedure.id,
        procedureTitle: procedure.title,
        sheet: procedure.sheet,
        serial: state.form.serial.trim(),
        nodeNumber: state.form.nodeNumber.trim(),
        employeeNumber: state.form.employeeNumber.trim(),
        form: { ...state.form },
        completedSteps: [...state.completedSteps],
        totalSteps: procedure.steps.length,
        failedStep: isRework ? failedStep : item.failedStep ?? "",
        workKind: isRework ? "rework" : item.workKind ?? "pause",
        reasonLabel,
        reason: note,
      });
      appendEvent(item, isRework ? "Retrabajo requerido" : "Detenida", `${reasonLabel}: ${note}`);
      if (!persistWorkItems(state.workItems)) {
        state.workItems = readWorkItems();
        state.workError = "No se pudo guardar. Revisa el almacenamiento local del navegador.";
      } else {
        state.activeWorkId = "";
        state.completedSteps = [];
        state.form = createEmptyForm();
        state.workDialogOpen = false;
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
    const itemIndex = state.workItems.indexOf(item);
    const previousItem = JSON.parse(JSON.stringify(item));
    const previousState = {
      selectedId: state.selectedId,
      completedSteps: [...state.completedSteps],
      form: { ...state.form },
      activeWorkId: state.activeWorkId,
    };
    state.selectedId = item.procedureId;
    state.completedSteps = [...item.completedSteps];
    state.form = { ...createEmptyForm(), ...item.form };
    state.activeWorkId = item.id;
    const isStartingRework = item.status === "Retrabajo requerido";
    if (isStartingRework) {
      item.attempts += 1;
      state.completedSteps = state.completedSteps.filter((step) => step !== item.failedStep);
      item.completedSteps = [...state.completedSteps];
    }
    const resumeNote = isStartingRework ? `Paso ${item.failedStep} reabierto para corregir y revalidar` : `Retoma ${state.form.name || "el responsable"} (${state.form.employeeNumber || "sin número"})`;
    appendEvent(item, item.workKind === "rework" ? "Retrabajo en proceso" : "En proceso", resumeNote);
    if (!persistWorkItems(state.workItems)) {
      state.workItems[itemIndex] = previousItem;
      Object.assign(state, previousState);
      showToast("No se pudo registrar la reanudación en este navegador.", "warning");
      return;
    }
    state.activeSection = "production";
    render();
    document.getElementById("production")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function prepareCompletionRecord(record) {
    const item = state.workItems.find((workItem) => workItem.id === state.activeWorkId);
    if (!item) return;
    record.workItemId = item.id;
    record.attemptNumber = item.attempts;
    if (item.workKind === "rework") {
      record.status = "Pendiente de revisión";
      record.recordType = "Retrabajo enviado a revisión";
      record.evidenceCount = item.evidenceFiles?.length ?? 0;
      record.evidenceObservation = item.evidenceObservation ?? "";
    } else {
      record.recordType = "SOP reanudada";
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
    openDialog,
    closeDialog,
    submit,
    resume,
    prepareCompletionRecord,
    completeActiveWork,
    ...evidenceWorkflow,
  };
}
