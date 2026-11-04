// Sincronización de trabajos, registros de validación y auditoría con el servidor.
//
// El front sigue trabajando sobre el estado en memoria y llamando a los mismos
// persistWorkItems / persistSavedRecords / recordLocalAuditEvent de siempre, que
// ahora devuelven de inmediato y suben los cambios por una cola ordenada:
//  - cada escritura lleva la revisión que el cliente conoce; si otra persona se
//    adelantó, el servidor responde 409 y se carga su versión;
//  - sin conexión los cambios esperan en la cola y se reintentan cada 3 s;
//  - la auditoría solo se agrega (el servidor fija el actor y es idempotente).

const SYNC_KINDS = {
  work: { list: [], sigs: new Map(), revs: new Map(), url: "/api/work-items", field: "item", listKey: "items" },
  records: { list: [], sigs: new Map(), revs: new Map(), url: "/api/records", field: "record", listKey: "records" },
};
const AUDIT_LIMIT = 1000;
const AUDIT_BATCH = 100;
const serverSync = { audit: [], queue: [], running: null, offline: false };

function syncDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncNotify(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function hasPendingServerSync() {
  return serverSync.queue.length > 0;
}

function clearServerSync() {
  for (const kind of Object.values(SYNC_KINDS)) {
    kind.list = [];
    kind.sigs.clear();
    kind.revs.clear();
  }
  serverSync.audit = [];
  serverSync.queue.length = 0;
  serverSync.offline = false;
}

function pendingIds(kind) {
  return new Set(serverSync.queue.filter((job) => job.kind === kind).map((job) => job.id));
}

function pendingAuditEvents() {
  return serverSync.queue.filter((job) => job.kind === "audit").flatMap((job) => job.events);
}

// ---- lectura ---------------------------------------------------------------

async function fetchServerData() {
  const results = await Promise.race([
    Promise.all([
      sopApi("GET", SYNC_KINDS.work.url),
      sopApi("GET", SYNC_KINDS.records.url),
      sopApi("GET", `/api/audit-events?limit=${AUDIT_LIMIT}`),
    ]),
    syncDelay(3000).then(() => null),
  ]);
  if (!results || results.some((result) => !result.ok)) return null;
  const [work, records, audit] = results;
  return { work: work.data, records: records.data, audit: audit.data.events };
}

// Une lo que dice el servidor con lo local que aún no se ha subido.
function applySnapshot(kind, docs, revisions) {
  const sync = SYNC_KINDS[kind];
  const pending = pendingIds(kind);
  const localById = new Map(sync.list.map((doc) => [doc.id, doc]));
  const seen = new Set();
  const merged = [];
  for (const doc of docs) {
    seen.add(doc.id);
    if (pending.has(doc.id)) {
      merged.push(localById.get(doc.id) ?? doc);
      continue;
    }
    merged.push(doc);
    sync.sigs.set(doc.id, JSON.stringify(doc));
    sync.revs.set(doc.id, Number(revisions[doc.id]));
  }
  const unsent = sync.list.filter((doc) => !seen.has(doc.id) && pending.has(doc.id));
  sync.list = [...unsent, ...merged];
}

function applyAuditSnapshot(events) {
  const known = new Set(events.map((event) => event.id));
  const unsent = pendingAuditEvents().filter((event) => !known.has(event.id));
  serverSync.audit = [...events, ...unsent]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .slice(-AUDIT_LIMIT);
}

function applyServerData(data) {
  applySnapshot("work", data.work.items, data.work.revisions ?? {});
  applySnapshot("records", data.records.records, data.records.revisions ?? {});
  applyAuditSnapshot(data.audit);
}

// Carga inicial tras iniciar sesión.
async function hydrateServerData() {
  clearServerSync();
  const data = await fetchServerData();
  if (!data) return false;
  applyServerData(data);
  return true;
}

// Devuelve true si algo cambió respecto a lo que ya se tenía.
async function refreshServerData() {
  if (!getAuthenticatedLocalUser()) return false;
  const data = await fetchServerData();
  if (!data) return false;
  const before = JSON.stringify([SYNC_KINDS.work.list, SYNC_KINDS.records.list, serverSync.audit]);
  applyServerData(data);
  return before !== JSON.stringify([SYNC_KINDS.work.list, SYNC_KINDS.records.list, serverSync.audit]);
}

// ---- escritura -------------------------------------------------------------

function persistSyncDocs(kind, docs) {
  if (!getAuthenticatedLocalUser()) return false;
  const sync = SYNC_KINDS[kind];
  for (const doc of docs) {
    const signature = JSON.stringify(doc);
    if (sync.sigs.get(doc.id) === signature) continue;
    sync.sigs.set(doc.id, signature);
    const queued = serverSync.queue.find((job) => job.kind === kind && job.id === doc.id && job !== syncInFlightJob());
    if (queued) queued.doc = structuredClone(doc);
    else serverSync.queue.push({ kind, id: doc.id, doc: structuredClone(doc) });
  }
  sync.list = structuredClone(docs);
  scheduleFlush();
  return true;
}

// El trabajo que va en vuelo es el primero de la cola mientras corre el envío; no se toca.
function syncInFlightJob() {
  return serverSync.running ? serverSync.queue[0] : null;
}

function queueAuditEvent(event) {
  const target = [...serverSync.queue].reverse().find((job) => job.kind === "audit"
    && job !== syncInFlightJob()
    && job.events.length < AUDIT_BATCH);
  if (target) target.events.push(event);
  else serverSync.queue.push({ kind: "audit", events: [event] });
  scheduleFlush();
}

function scheduleFlush() {
  if (!serverSync.running && serverSync.queue.length) {
    serverSync.running = runSyncQueue().finally(() => {
      serverSync.running = null;
      if (serverSync.queue.length) scheduleFlush();
    });
  }
  return serverSync.running;
}

async function runSyncQueue() {
  while (serverSync.queue.length) {
    const outcome = await sendSyncJob(serverSync.queue[0]);
    if (outcome === "retry") {
      await syncDelay(3000);
      continue;
    }
    if (outcome === "abort") {
      serverSync.queue.length = 0;
      return;
    }
    if (outcome === "done") serverSync.queue.shift();
  }
}

function classifySyncFailure(result) {
  if (result.status === 0 || result.status >= 500) {
    if (!serverSync.offline) {
      serverSync.offline = true;
      syncNotify("sop:sync-offline");
    }
    return "retry";
  }
  if (result.status === 401 || result.status === 419) {
    if (result.status === 419) syncNotify("sop:session-expired", { code: "csrf" });
    return "abort";
  }
  return "reject";
}

async function sendSyncJob(job) {
  const result = job.kind === "audit"
    ? await sopApi("POST", "/api/audit-events", { events: job.events })
    : await sopApi("PUT", `${SYNC_KINDS[job.kind].url}/${encodeURIComponent(job.id)}`, {
      [SYNC_KINDS[job.kind].field]: job.doc,
      baseRevision: SYNC_KINDS[job.kind].revs.get(job.id) ?? null,
    });

  if (result.ok) {
    if (serverSync.offline) {
      serverSync.offline = false;
      syncNotify("sop:sync-online");
    }
    if (job.kind !== "audit") SYNC_KINDS[job.kind].revs.set(job.id, Number(result.data.revision));
    return "done";
  }

  if (job.kind !== "audit" && result.status === 409) {
    const sync = SYNC_KINDS[job.kind];
    sync.revs.set(job.id, Number(result.data.revision));
    sync.sigs.set(job.id, JSON.stringify(result.data.stored));
    sync.list = sync.list.map((doc) => (doc.id === job.id ? result.data.stored : doc));
    syncNotify("sop:sync-conflict", { kind: job.kind, id: job.id });
    return "done";
  }

  const outcome = classifySyncFailure(result);
  if (outcome === "reject") {
    // El servidor rechazó el cambio: se descarta y se vuelve a la versión guardada.
    serverSync.queue.shift();
    if (job.kind !== "audit") {
      SYNC_KINDS[job.kind].sigs.delete(job.id);
      await refreshServerData();
    }
    syncNotify("sop:sync-rejected", { kind: job.kind, id: job.id, status: result.status, code: result.data?.code });
    return "skip";
  }
  return outcome;
}

// Espera a que se vacíe la cola (cambio de operador, cierre de sesión).
async function flushServerSync({ timeoutMs = 8000 } = {}) {
  const running = scheduleFlush();
  if (!running) return true;
  const outcome = await Promise.race([running.then(() => "done"), syncDelay(timeoutMs).then(() => "timeout")]);
  return outcome === "done" && serverSync.queue.length === 0;
}
