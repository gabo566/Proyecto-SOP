function createGuidedSopRun(procedures, document, versionId, user) {
  const procedureIds = procedures
    .filter((procedure) => Array.isArray(procedure.steps) && procedure.steps.length)
    .map((procedure) => procedure.id);
  if (!procedureIds.length) throw new Error("La SOP activa no contiene pasos para validar.");
  return {
    procedureIds,
    currentIndex: 0,
    completedByProcedure: {},
    stage: "steps",
    versionId,
    document: { id: document.id, title: document.title, revision: document.revision, totalSheets: document.totalSheets },
    startedBy: { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position ?? "Técnico de FA", role: user.role },
    startedAt: Date.now(),
  };
}

function getGuidedSopProcedure(run, procedures) {
  if (!run?.procedureIds?.length) return null;
  const currentId = run.procedureIds[run.currentIndex];
  return procedures.find((procedure) => procedure.id === currentId) ?? null;
}

function getGuidedSopCheckedSteps(run, procedureId) {
  return [...(run?.completedByProcedure?.[procedureId] ?? [])];
}

function setGuidedSopStep(run, procedureId, stepNumber, checked) {
  if (!run || !run.procedureIds.includes(procedureId)) return;
  const current = new Set(getGuidedSopCheckedSteps(run, procedureId));
  if (checked) current.add(String(stepNumber));
  else current.delete(String(stepNumber));
  run.completedByProcedure[procedureId] = [...current];
}

function isGuidedSopProcedureComplete(run, procedure) {
  return Boolean(procedure?.steps?.length)
    && procedure.steps.every((step) => getGuidedSopCheckedSteps(run, procedure.id).includes(String(step.number)));
}

function isGuidedSopRunComplete(run, procedures) {
  return Boolean(run?.procedureIds?.length)
    && run.procedureIds.every((id) => {
      const procedure = procedures.find((item) => item.id === id);
      return isGuidedSopProcedureComplete(run, procedure);
    });
}

function getGuidedSopProgress(run, procedures) {
  const total = run?.procedureIds?.reduce((sum, id) => {
    const procedure = procedures.find((item) => item.id === id);
    return sum + (procedure?.steps?.length ?? 0);
  }, 0) ?? 0;
  const complete = run?.procedureIds?.reduce((sum, id) => {
    const procedure = procedures.find((item) => item.id === id);
    return sum + getGuidedSopCheckedSteps(run, id).filter((number) => procedure?.steps?.some((step) => String(step.number) === number)).length;
  }, 0) ?? 0;
  return { complete, total };
}

function advanceGuidedSopRun(run, procedures) {
  const procedure = getGuidedSopProcedure(run, procedures);
  if (run?.stage !== "steps" || !isGuidedSopProcedureComplete(run, procedure)) return false;
  if (run.currentIndex < run.procedureIds.length - 1) run.currentIndex += 1;
  else run.stage = "confirmation";
  return true;
}

function returnGuidedSopRunToSteps(run) {
  if (!run?.procedureIds?.length) return false;
  if (run.stage === "confirmation") {
    run.stage = "steps";
    run.currentIndex = run.procedureIds.length - 1;
    return true;
  }
  if (run.currentIndex <= 0) return false;
  run.currentIndex -= 1;
  return true;
}
