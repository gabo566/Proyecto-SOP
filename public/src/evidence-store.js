const EVIDENCE_DATABASE = "sop-operador-evidence-v1";
const EVIDENCE_STORE = "files";
const SOP_SOURCE_STORE = "sop-source";
const ACTIVE_SOP_SOURCE_ID = "active-sop-pdf";
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_MB = 8;
const MAX_EVIDENCE_FILE_BYTES = MAX_EVIDENCE_FILE_MB * 1024 * 1024;
const EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EVIDENCE_FILE_ACCEPT = [...EVIDENCE_MIME_TYPES].join(",");

function openEvidenceDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EVIDENCE_DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(EVIDENCE_STORE)) {
        request.result.createObjectStore(EVIDENCE_STORE, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(SOP_SOURCE_STORE)) {
        request.result.createObjectStore(SOP_SOURCE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeSopSourcePdf(file) {
  const filenameIsPdf = String(file?.name ?? "").toLocaleLowerCase("es-MX").endsWith(".pdf");
  if (!file || (!filenameIsPdf && file.type !== "application/pdf") || !file.size) {
    throw new Error("Selecciona un archivo PDF válido.");
  }
  const body = new FormData();
  body.set("pdf", file, file.name);
  const result = await sopApi("POST", "/api/sop-source", body);
  if (!result.ok) {
    const validation = result.data?.errors ? Object.values(result.data.errors).flat()[0] : "";
    throw new Error(result.status === 413 ? "El PDF es demasiado grande para el servidor."
      : result.status === 403 ? "Tu cuenta no tiene permiso para reemplazar el PDF de la SOP."
      : validation || "No se pudo guardar el PDF en el servidor.");
  }
  return result.data.source;
}

async function loadSopSourcePdf() {
  const result = await sopApi("GET", "/api/sop-source");
  return result.ok ? result.data.source : null;
}

async function storeEvidenceFile(id, file) {
  const database = await openEvidenceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE, "readwrite");
    transaction.objectStore(EVIDENCE_STORE).put({ id, blob: file, name: file.name, type: file.type, size: file.size });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

async function loadEvidenceFile(id) {
  const database = await openEvidenceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE, "readonly");
    const request = transaction.objectStore(EVIDENCE_STORE).get(id);
    request.onsuccess = () => { database.close(); resolve(request.result ?? null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function deleteEvidenceFile(id) {
  const database = await openEvidenceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EVIDENCE_STORE, "readwrite");
    transaction.objectStore(EVIDENCE_STORE).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}
