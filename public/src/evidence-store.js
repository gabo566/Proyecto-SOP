const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_MB = 8;
const MAX_EVIDENCE_FILE_BYTES = MAX_EVIDENCE_FILE_MB * 1024 * 1024;
const EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EVIDENCE_FILE_ACCEPT = [...EVIDENCE_MIME_TYPES].join(",");

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

// Las fotos de evidencia viven en el servidor (storage/app/evidence); en los
// documentos del trabajo solo queda su metadato { id, name, type, size, ... }.
async function storeEvidenceFile(id, file) {
  const body = new FormData();
  body.set("id", id);
  body.set("file", file, file.name || "evidencia");
  const result = await sopApi("POST", "/api/evidence", body);
  if (!result.ok) {
    const validation = result.data?.errors ? Object.values(result.data.errors).flat()[0] : "";
    throw new Error(result.status === 413 ? "La foto es demasiado grande para el servidor."
      : result.status === 403 ? "Tu cuenta no puede reemplazar esa foto."
      : validation || "No se pudo guardar la foto en el servidor.");
  }
}

// Devuelve { id, blob, name, type, size } o null si la foto no existe o no hay acceso.
async function loadEvidenceFile(id) {
  try {
    const response = await fetch(`/api/evidence/${encodeURIComponent(id)}`, { credentials: "same-origin", headers: { Accept: "image/*" } });
    if (!response.ok) return null;
    const blob = await response.blob();
    return { id, blob, name: id, type: blob.type, size: blob.size };
  } catch {
    return null;
  }
}

async function deleteEvidenceFile(id) {
  const result = await sopApi("DELETE", `/api/evidence/${encodeURIComponent(id)}`);
  if (!result.ok && result.status !== 404) throw new Error("No se pudo borrar la foto en el servidor.");
}
