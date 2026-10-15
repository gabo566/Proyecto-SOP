const EVIDENCE_DATABASE = "sop-operador-evidence-v1";
const EVIDENCE_STORE = "files";
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_MB = 8;
const MAX_EVIDENCE_FILE_BYTES = MAX_EVIDENCE_FILE_MB * 1024 * 1024;
const EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EVIDENCE_FILE_ACCEPT = [...EVIDENCE_MIME_TYPES].join(",");

function openEvidenceDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EVIDENCE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(EVIDENCE_STORE)) {
        request.result.createObjectStore(EVIDENCE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
