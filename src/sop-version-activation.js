function pauseIncompatibleSopWork(state, targetVersionId) {
  const activeVersionId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID;
  if (targetVersionId === activeVersionId) return { saved: true, rollback() {} };

  const now = new Date();
  const timestamp = {
    at: now.getTime(),
    date: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(now).replaceAll(".", ""),
    time: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
  };
  const snapshots = [];
  for (const item of state.workItems) {
    const itemVersionId = item.sopVersionId ?? BUILT_IN_SOP_VERSION_ID;
    if (itemVersionId === targetVersionId || !["En proceso", "Retrabajo en proceso"].includes(item.status)) continue;
    snapshots.push({ item, status: item.status, reasonLabel: item.reasonLabel, reason: item.reason, updatedAt: item.updatedAt, updatedLabel: item.updatedLabel, history: [...(item.history ?? [])] });
    const note = `Avance conservado con ${item.sopDocumentId ?? "SOP"} · Rev. ${item.sopRevision ?? "anterior"}. Activa esa revisión para reanudarlo.`;
    item.status = "Detenida";
    item.reasonLabel = "Cambio de SOP activa";
    item.reason = note;
    item.updatedAt = timestamp.at;
    item.updatedLabel = `${timestamp.date} · ${timestamp.time}`;
    item.history = [...(item.history ?? []), { ...timestamp, status: "Detenida", note }];
  }

  const rollback = () => {
    for (const snapshot of snapshots) {
      Object.assign(snapshot.item, {
        status: snapshot.status,
        reasonLabel: snapshot.reasonLabel,
        reason: snapshot.reason,
        updatedAt: snapshot.updatedAt,
        updatedLabel: snapshot.updatedLabel,
        history: snapshot.history,
      });
    }
    if (snapshots.length) persistWorkItems(state.workItems);
  };

  if (snapshots.length && !persistWorkItems(state.workItems)) {
    rollback();
    return { saved: false, rollback() {} };
  }
  return { saved: true, rollback };
}
