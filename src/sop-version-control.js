const SOP_VERSION_DATABASE = "sop-operador-sop-versions-v1";
const SOP_VERSION_STORE = "versions";
const SOP_VERSION_SETTINGS = "settings";
const SOP_VERSION_ACTIVE_KEY = "active-version";
const SOP_VERSION_MAX_PDF_BYTES = 100 * 1024 * 1024;

function canManageSopVersions(user = getActiveLocalUser()) {
  return String(user?.employeeNumber ?? "") === "140784" && user?.role === "admin";
}

function openSopVersionDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SOP_VERSION_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SOP_VERSION_STORE)) {
        request.result.createObjectStore(SOP_VERSION_STORE, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(SOP_VERSION_SETTINGS)) {
        request.result.createObjectStore(SOP_VERSION_SETTINGS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function listStoredSopVersions() {
  const database = await openSopVersionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SOP_VERSION_STORE, "readonly");
    const request = transaction.objectStore(SOP_VERSION_STORE).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function getActiveStoredSopVersionId() {
  const database = await openSopVersionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SOP_VERSION_SETTINGS, "readonly");
    const request = transaction.objectStore(SOP_VERSION_SETTINGS).get(SOP_VERSION_ACTIVE_KEY);
    request.onsuccess = () => { database.close(); resolve(request.result?.versionId ?? BUILT_IN_SOP_VERSION_ID); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function saveSopVersionAndActivate(version) {
  const database = await openSopVersionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SOP_VERSION_STORE, SOP_VERSION_SETTINGS], "readwrite");
    transaction.objectStore(SOP_VERSION_STORE).put(version);
    transaction.objectStore(SOP_VERSION_SETTINGS).put({ id: SOP_VERSION_ACTIVE_KEY, versionId: version.id });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

async function setActiveSopVersionId(versionId) {
  const database = await openSopVersionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SOP_VERSION_SETTINGS, "readwrite");
    transaction.objectStore(SOP_VERSION_SETTINGS).put({ id: SOP_VERSION_ACTIVE_KEY, versionId });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

function createSopVersionMetadata(version, builtIn = false) {
  const procedures = version.procedures ?? [];
  return {
    id: version.id,
    revision: version.document.revision,
    title: version.document.title,
    documentId: version.document.id,
    procedureCount: procedures.filter((procedure) => procedure.steps.length > 0).length,
    sheetCount: procedures.length,
    stepCount: procedures.reduce((count, procedure) => count + procedure.steps.length, 0),
    createdAt: version.createdAt ?? "",
    createdBy: version.createdBy ?? "Catálogo incluido en el proyecto",
    pdfName: version.pdf?.name ?? (builtIn ? "SOP-NVD-GB200-141.pdf" : ""),
    builtIn,
  };
}

let activeSopImageUrls = [];

function applySopVersion(version, state, builtIn = false) {
  const previousPdfUrl = state.sopPdfUrl;
  activeSopImageUrls.forEach((url) => URL.revokeObjectURL(url));
  if (previousPdfUrl && !activeSopImageUrls.includes(previousPdfUrl)) URL.revokeObjectURL(previousPdfUrl);
  activeSopImageUrls = [];
  const procedures = structuredClone(version.procedures);
  for (const procedure of procedures) {
    if (procedure.pageImage?.blob instanceof Blob) {
      procedure.pageImage = URL.createObjectURL(procedure.pageImage.blob);
      activeSopImageUrls.push(procedure.pageImage);
    }
    for (const step of procedure.steps) {
      for (const image of step.images ?? []) {
        if (image.blob instanceof Blob) {
          image.src = URL.createObjectURL(image.blob);
          activeSopImageUrls.push(image.src);
        }
      }
    }
  }
  if (version.pdf?.blob instanceof Blob) {
    state.sopPdfUrl = URL.createObjectURL(version.pdf.blob);
    state.sopPdfName = version.pdf.name;
    activeSopImageUrls.push(state.sopPdfUrl);
  } else {
    state.sopPdfUrl = "";
    state.sopPdfName = "";
  }
  SOP_DOCUMENT = structuredClone(version.document);
  SOP_SHEETS = procedures;
  PROCEDURES = procedures.filter((procedure) => procedure.steps.length > 0);
  SOP_STEP_COUNT = PROCEDURES.reduce((count, procedure) => count + procedure.steps.length, 0);
  state.sopVersionMeta = createSopVersionMetadata({ ...version, procedures }, builtIn);
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  const preserveActiveWork = activeWork && (activeWork.sopVersionId ?? BUILT_IN_SOP_VERSION_ID) === version.id;
  if (activeWork && !preserveActiveWork) state.activeWorkId = "";
  if (!preserveActiveWork) {
    state.selectedId = (PROCEDURES[0] ?? SOP_SHEETS[0])?.id ?? "";
    state.completedSteps = [];
    state.sopRun = null;
    state.form = createEmptyForm();
  } else {
    state.sopRun = activeWork.sopRun ? structuredClone(activeWork.sopRun) : null;
    state.selectedId = state.sopRun
      ? getGuidedSopProcedure(state.sopRun, PROCEDURES)?.id ?? activeWork.procedureId
      : activeWork.procedureId;
    state.completedSteps = state.sopRun
      ? getGuidedSopCheckedSteps(state.sopRun, state.selectedId)
      : [...(activeWork.completedSteps ?? [])];
    state.form = { ...createEmptyForm(), ...(activeWork.form ?? {}) };
  }
  state.form.nodePartNumber ||= SOP_DOCUMENT.nodePartNumber ?? "";
}

function applyBuiltInSopVersion(state) {
  applySopVersion(BUILT_IN_SOP_VERSION, state, true);
}

async function restoreCurrentSopVersion(state) {
  state.sopVersionHistory = await listStoredSopVersions();
  const activeId = await getActiveStoredSopVersionId();
  if (activeId === BUILT_IN_SOP_VERSION_ID) {
    applyBuiltInSopVersion(state);
    return false;
  }
  const version = state.sopVersionHistory.find((entry) => entry.id === activeId);
  if (!version) {
    await setActiveSopVersionId(BUILT_IN_SOP_VERSION_ID);
    applyBuiltInSopVersion(state);
    return false;
  }
  const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
  if (activeWork && (activeWork.sopVersionId ?? BUILT_IN_SOP_VERSION_ID) !== activeId) {
    state.activeWorkId = "";
    state.completedSteps = [];
  }
  applySopVersion(version, state);
  return true;
}

function hasOpenSopWork(state, targetVersionId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID) {
  if (state.activeWorkId && !state.workItems.some((item) => item.id === state.activeWorkId)) return true;
  return state.workItems.some((item) => !["Completado", "Aprobado"].includes(item.status)
    && (item.sopVersionId ?? BUILT_IN_SOP_VERSION_ID) !== targetVersionId);
}

let sopPdfJsPromise;

async function loadSopPdfJs() {
  if (!sopPdfJsPromise) {
    sopPdfJsPromise = import(new URL("./public/vendor/pdfjs/pdf.min.mjs", document.baseURI).href).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("./public/vendor/pdfjs/pdf.worker.mjs", document.baseURI).href;
      return pdfjs;
    }).catch((error) => {
      sopPdfJsPromise = null;
      throw error;
    });
  }
  return sopPdfJsPromise;
}

function normalizeExtractedSopText(value) {
  return String(value ?? "").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¿¡(])\s+/g, "$1").replace(/(\d)\.\s+(?=\d)/g, "$1.")
    .replace(/\s*-\s*/g, "-").replace(/\bP\s+N\b/gi, "PN").trim();
}

function readSopMarker(items, index) {
  const direct = items[index].str.trim().replace(/\s/g, "").match(/^(\d+(?:\.\d+)*\.?)-(.*)$/);
  if (direct) return { id: direct[1].replace(/\.$/, ""), endIndex: index, tail: direct[2] };

  let combined = "";
  let previous = null;
  for (let endIndex = index; endIndex < Math.min(items.length, index + 8); endIndex += 1) {
    const item = items[endIndex];
    if (previous && item.x - (previous.x + previous.width) > 22) break;
    combined += item.str.trim().replace(/\s/g, "");
    const match = combined.match(/^(\d+(?:\.\d+)*\.?)-(.*)$/);
    if (match) return { id: match[1].replace(/\.$/, ""), endIndex, tail: match[2] };
    if (!/^\d+(?:\.\d+)*\.?$/.test(combined) && !/^\d*[.]?$/.test(combined)) break;
    previous = item;
  }
  return null;
}

function isSopMarkerStart(items, index) {
  if (index === 0) return true;
  const previous = items[index - 1];
  return items[index].x - (previous.x + previous.width) >= 18;
}

function isSopStepNumber(value) {
  return /^(?:[1-9]\d{0,2})(?:\.\d+)*$/.test(String(value ?? ""));
}

function groupSopPdfRows(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 1.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: item.transform[4], y, width: item.width, str: item.str });
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => ({
    ...row,
    items: row.items.sort((a, b) => a.x - b.x),
  }));
}

function readSopMarkersInRow(row, pageWidth) {
  const markersByColumn = { left: [], right: [] };
  for (let index = 0; index < row.items.length; index += 1) {
    if (!isSopMarkerStart(row.items, index)) continue;
    const marker = readSopMarker(row.items, index);
    if (!marker || !isSopStepNumber(marker.id)) continue;
    const column = row.items[index].x < pageWidth * 0.44 ? "left" : "right";
    markersByColumn[column].push({ ...marker, index, x: row.items[index].x, column });
  }
  return { ...markersByColumn, all: [...markersByColumn.left, ...markersByColumn.right].sort((a, b) => a.index - b.index) };
}

function readSopRowText(items) {
  return normalizeExtractedSopText(items.map((item) => item.str).join(" "));
}

function hasUsefulSopText(value) {
  const text = normalizeExtractedSopText(value).replace(/^[\s([{"'¿¡]+/, "");
  return (text.match(/\p{L}/gu) ?? []).length >= 4;
}

function isUsefulSopInstruction(value) {
  const text = normalizeExtractedSopText(value).replace(/^[\s([{"'¿¡]+/, "");
  return hasUsefulSopText(text) && !/^\d/.test(text);
}

function appendSopContinuation(instruction, continuation) {
  const current = normalizeExtractedSopText(instruction);
  const next = normalizeExtractedSopText(continuation);
  if (!current) return next;
  if (!next) return current;
  if (current.endsWith("-")) {
    return normalizeExtractedSopText(`${/^[a-záéíóúüñ]/i.test(next) ? current.slice(0, -1) : current}${next}`);
  }
  return normalizeExtractedSopText(`${current} ${next}`);
}

function compareSopStepNumbers(left, right) {
  const leftParts = String(left).split(".").map(Number);
  const rightParts = String(right).split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1);
    if (difference) return difference;
  }
  return 0;
}

function extractSopMetadata(text, fileName, sheetLabels) {
  const documentId = text.match(/#\s*Control\s*:\s*([A-Z0-9][A-Z0-9._-]+)/i)?.[1] ?? "";
  const revision = text.match(/\bRev\s*:\s*([A-Z0-9][A-Z0-9._-]*)/i)?.[1] ?? "1";
  const baseName = String(fileName ?? "SOP").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const totalSheets = Math.max(0, ...sheetLabels.map((label) => label.total));
  return {
    id: documentId || baseName || "SOP-NUEVA",
    title: baseName || "SOP nueva",
    revision,
    family: "",
    customer: "",
    station: "",
    nodePartNumber: "",
    totalSheets,
  };
}

async function extractSopPdfVersion(pdfFile, pdfjsOverride = null) {
  if (!pdfFile || (!String(pdfFile.name ?? "").toLowerCase().endsWith(".pdf") && pdfFile.type !== "application/pdf") || !pdfFile.size) {
    throw new Error("Selecciona un archivo PDF válido.");
  }
  if (pdfFile.size > SOP_VERSION_MAX_PDF_BYTES) throw new Error("El PDF excede el límite local de 100 MB.");

  const pdfjs = pdfjsOverride ?? await loadSopPdfJs();
  const assetRoot = new URL("./public/vendor/pdfjs/", globalThis.document.baseURI).href;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await pdfFile.arrayBuffer()),
    standardFontDataUrl: `${assetRoot}standard_fonts/`,
    cMapUrl: `${assetRoot}cmaps/`,
    cMapPacked: true,
    disableWorker: typeof window === "undefined",
    verbosity: pdfjs.VerbosityLevel?.ERROR,
  });
  const pdf = await loadingTask.promise;
  const extractedPages = [];
  const sheetLabels = [];
  const pageTexts = [];
  let readableCharacters = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const fullText = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
      pageTexts.push(fullText);
      readableCharacters += fullText.length;
      const label = fullText.match(/P[aá]gina\s*(\d+)\s*D\s*E\s*(\d+)/i);
      if (label) sheetLabels.push({ sheet: Number(label[1]), total: Number(label[2]) });
      const rows = groupSopPdfRows(content.items).filter((row) => row.y > viewport.height * 0.12 && row.y < viewport.height * 0.9);
      const procedure = {
        id: `sheet-${label ? Number(label[1]) : pageNumber}`,
        sheet: label ? Number(label[1]) : pageNumber,
        pdfPage: pageNumber,
        category: "Procedimiento",
        title: `Hoja ${label ? Number(label[1]) : pageNumber}`,
        stepRange: "",
        partNumber: "",
        steps: [],
      };
      const activeByColumn = { left: null, right: null };

      for (const row of rows) {
        const markersByColumn = readSopMarkersInRow(row, viewport.width);
        for (const column of ["left", "right"]) {
          const hasBothActiveColumns = activeByColumn.left && activeByColumn.right;
          const continuationBoundary = hasBothActiveColumns ? activeByColumn.right.startX - 30 : viewport.width * 0.44;
          const columnItems = row.items.filter((item) => column === "left" ? item.x < continuationBoundary : item.x >= continuationBoundary);
          const markers = markersByColumn[column];
          if (markers.length) {
            for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
              const marker = markers[markerIndex];
              const nextMarker = markersByColumn.all.find((candidate) => candidate.index > marker.index);
              const bodyItems = row.items.slice(marker.endIndex + 1, nextMarker?.index ?? row.items.length);
              const text = readSopRowText([{ str: marker.tail }, ...bodyItems]);
              if (!isUsefulSopInstruction(text)) continue;
              const step = { number: marker.id, text, sourceNote: "", images: [] };
              procedure.steps.push(step);
              activeByColumn[column] = { step, y: row.y, startX: marker.x };
            }
            continue;
          }

          const active = activeByColumn[column];
          if (!active) continue;
          const lineGap = active.y - row.y;
          const continuationItems = columnItems.filter((item) => item.x >= active.startX - 30);
          const startX = continuationItems[0]?.x;
          if (lineGap <= 0 || lineGap > 18) {
            activeByColumn[column] = null;
            continue;
          }
          if (startX === undefined || startX > active.startX + 60) continue;
          const continuation = readSopRowText(continuationItems);
          if (hasUsefulSopText(continuation)) {
            active.step.text = appendSopContinuation(active.step.text, continuation);
            active.y = row.y;
          }
        }
      }

      procedure.steps = procedure.steps.filter((step) => step.text);
      if (procedure.steps.length) {
        procedure.steps.sort((a, b) => compareSopStepNumbers(a.number, b.number));
        procedure.stepRange = `${procedure.steps[0].number}–${procedure.steps.at(-1).number}`;
        extractedPages.push(procedure);
      }
    }
  } finally {
    await pdf.destroy();
  }

  const processPages = extractedPages.filter((procedure) => procedure.sheet >= 5);
  const procedures = processPages.length ? processPages : extractedPages;
  const stepCount = procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  if (!stepCount) {
    if (readableCharacters < 100) {
      throw new Error("El PDF parece escaneado o no contiene texto seleccionable. Guarda el mismo PDF con OCR de texto y vuelve a cargarlo.");
    }
    throw new Error("Se pudo leer el PDF, pero no se detectaron pasos con numeración y formato reconocibles. Revisa que sea la SOP controlada y no un escaneo sin OCR.");
  }

  const sopDocument = extractSopMetadata(pageTexts.join(" "), pdfFile.name, sheetLabels);
  const sheetNumbers = procedures.map((procedure) => procedure.sheet).sort((a, b) => a - b);
  const minSheet = sheetNumbers[0];
  const maxSheet = sheetNumbers.at(-1);
  sopDocument.totalSheets = Math.max(sopDocument.totalSheets, maxSheet);
  return {
    id: `sop-version-${crypto.randomUUID()}`,
    document: {
      ...sopDocument,
      processSheets: procedures.length,
      processSheetRange: `${minSheet}–${maxSheet}`,
      pdfPath: "",
    },
    pdf: { blob: pdfFile, name: pdfFile.name },
    procedures,
    createdAt: new Date().toISOString(),
    createdBy: getActiveLocalUser().name,
  };
}

function validateSopDraft(draft) {
  const version = structuredClone(draft);
  const document = version.document;
  for (const field of ["id", "title", "revision"]) {
    if (!String(document[field] ?? "").trim()) throw new Error(`Completa el campo ${field === "id" ? "identificador" : field === "title" ? "título" : "revisión"} del documento.`);
    document[field] = String(document[field]).trim();
  }

  const sheetNumbers = new Set();
  const procedures = version.procedures.filter((procedure) => procedure.steps.length).map((procedure, procedureIndex) => {
    const sheet = Number(procedure.sheet);
    if (!Number.isInteger(sheet) || sheet < 1) throw new Error(`La hoja ${procedureIndex + 1} requiere un número entero mayor que cero.`);
    if (sheetNumbers.has(sheet)) throw new Error(`Hay más de un procedimiento asignado a la hoja ${sheet}.`);
    sheetNumbers.add(sheet);
    const seenStepNumbers = new Set();
    const steps = procedure.steps.map((step, stepIndex) => {
      const number = String(step.number ?? "").trim();
      const text = String(step.text ?? "").trim();
      if (!number || !text) throw new Error(`Completa el número y el texto del paso ${stepIndex + 1} de la hoja ${sheet}.`);
      if (seenStepNumbers.has(number)) throw new Error(`El paso ${number} está repetido en la hoja ${sheet}.`);
      seenStepNumbers.add(number);
      return { ...step, number, text, images: step.images ?? [] };
    });
    steps.sort((a, b) => compareSopStepNumbers(a.number, b.number));
    return {
      ...procedure,
      id: `sheet-${sheet}`,
      sheet,
      title: String(procedure.title || `Hoja ${sheet}`).trim(),
      category: String(procedure.category || "Procedimiento").trim(),
      steps,
      stepRange: `${steps[0].number}–${steps.at(-1).number}`,
    };
  });
  if (!procedures.length) throw new Error("La SOP debe conservar al menos un paso de validación.");
  procedures.sort((a, b) => a.sheet - b.sheet);
  const sheets = procedures.map((procedure) => procedure.sheet);
  document.totalSheets = Math.max(Number(document.totalSheets) || 0, ...sheets);
  document.processSheets = procedures.length;
  document.processSheetRange = `${sheets[0]}–${sheets.at(-1)}`;
  version.procedures = procedures;
  return version;
}

function formatSopVersionDate(value) {
  if (!value) return "Incluida en el proyecto";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderSopVersionPreview(version, state) {
  const stepCount = version.procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  const procedureEditors = version.procedures.map((procedure, procedureIndex) => `<details class="sop-version-procedure" ${procedureIndex === 0 ? "open" : ""}>
    <summary><strong>Hoja ${escapeHtml(procedure.sheet)} · ${escapeHtml(procedure.title)}</strong><span>${procedure.steps.length} pasos</span></summary>
    <label class="sop-version-sheet-title">Nombre de la hoja<input type="text" data-procedure-index="${procedureIndex}" data-procedure-field="title" value="${escapeHtml(procedure.title)}" /></label>
    <ol class="sop-version-step-editor">${procedure.steps.map((step, stepIndex) => `<li><label>Número<input type="text" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" data-step-field="number" value="${escapeHtml(step.number)}" /></label>
      <label>Instrucción<textarea rows="2" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" data-step-field="text">${escapeHtml(step.text)}</textarea></label>
      <button class="text-button sop-version-delete-step" type="button" data-action="delete-sop-step" data-procedure-index="${procedureIndex}" data-step-index="${stepIndex}" aria-label="Eliminar paso ${escapeHtml(step.number)} de la hoja ${escapeHtml(procedure.sheet)}">Eliminar paso</button></li>`).join("")}</ol>
    <button class="text-button" type="button" data-action="add-sop-step" data-procedure-index="${procedureIndex}">Añadir paso a esta hoja</button>
  </details>`).join("");
  return `<section class="sop-version-preview" aria-labelledby="sop-version-preview-title"><h3 id="sop-version-preview-title">Revisa y corrige la extracción automática</h3>
    <p>Se detectaron ${stepCount} pasos en ${version.procedures.length} hojas. Corrige números o textos, elimina falsos positivos y agrega pasos omitidos antes de activarla.</p>
    <div class="sop-version-document-fields"><label>Identificador<input type="text" data-sop-document-field="id" value="${escapeHtml(version.document.id)}" /></label>
      <label>Nombre de la SOP<input type="text" data-sop-document-field="title" value="${escapeHtml(version.document.title)}" /></label>
      <label>Revisión<input type="text" data-sop-document-field="revision" value="${escapeHtml(version.document.revision)}" /></label></div>
    <div class="sop-version-procedures">${procedureEditors}</div>
    <button class="button button--primary" type="button" data-action="publish-sop-version" ${state.sopVersionBusy || hasOpenSopWork(state, version.id) ? "disabled" : ""}>Guardar y activar esta revisión</button>
    ${hasOpenSopWork(state, version.id) ? '<p class="sop-version-blocked">Completa los trabajos abiertos con su revisión actual antes de activar esta versión.</p>' : ""}
  </section>`;
}

function renderSopVersionManager(state) {
  if (!canManageSopVersions()) return '<section class="sop-version-panel"><h2>Acceso no disponible</h2></section>';
  const activeId = state.sopVersionMeta?.id ?? BUILT_IN_SOP_VERSION_ID;
  const base = createSopVersionMetadata(BUILT_IN_SOP_VERSION, true);
  const versions = [base, ...(state.sopVersionHistory ?? []).map((version) => createSopVersionMetadata(version))];
  const historyRows = versions.map((version) => `<li class="sop-version-row"><div><strong>Rev. ${escapeHtml(version.revision)} · ${escapeHtml(version.title)}</strong><small>${version.sheetCount} hojas · ${version.procedureCount} procedimientos · ${version.stepCount} pasos${version.pdfName ? ` · PDF ${escapeHtml(version.pdfName)}` : ""} · ${escapeHtml(formatSopVersionDate(version.createdAt))} · ${escapeHtml(version.createdBy)}</small></div>
    ${version.id === activeId ? '<span class="sop-version-current">Activa</span>' : `<button class="text-button" type="button" data-action="activate-sop-version" data-version-id="${escapeHtml(version.id)}">Usar esta versión</button>`}</li>`).join("");
  const error = state.sopDraftError ? `<p class="form-error" role="alert">${escapeHtml(state.sopDraftError)}</p>` : "";
  const preview = state.sopDraft ? renderSopVersionPreview(state.sopDraft, state) : "";
  return `<section class="sop-version-panel" aria-labelledby="sop-version-title"><div class="section-heading"><div class="section-title"><span class="heading-icon material-symbols-rounded" aria-hidden="true">rule_settings</span><div><p class="eyebrow">Solo cuenta 140784</p><h2 id="sop-version-title">Modificar SOP</h2></div></div></div>
    <p class="sop-version-intro">Carga un solo PDF. El sistema lee sus páginas, detecta los pasos numerados y prepara una vista editable antes de activar la nueva revisión.</p>
    <form class="sop-version-form" id="sop-version-upload-form"><label>Archivo PDF de la SOP<input name="pdf" type="file" accept="application/pdf,.pdf" required /></label>
      <div class="sop-version-actions"><button class="button button--primary" type="submit" ${state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">${state.sopVersionBusy ? "hourglass_top" : "auto_awesome"}</span>${state.sopVersionBusy ? "Leyendo y extrayendo pasos…" : "Cargar PDF y detectar pasos"}</button></div>
      <p class="dialog-note"><span class="material-symbols-rounded" aria-hidden="true">info</span>PDF de hasta 100 MB. El archivo debe contener texto seleccionable y conservar la numeración de pasos del formato SOP. Un escaneo sin OCR no se puede interpretar automáticamente.</p>${error}</form>
    ${preview}
    <section class="sop-version-history" aria-labelledby="sop-version-history-title"><h3 id="sop-version-history-title">Versiones de SOP guardadas en este navegador</h3><ul>${historyRows}</ul></section>
    <p class="sop-version-warning">Las revisiones se guardan en este navegador. Los demás usuarios que entren desde este mismo navegador verán la revisión activa; otros equipos o perfiles no se sincronizan automáticamente. Conserva el PDF original como respaldo. Las evidencias previas conservarán su revisión.</p>
  </section>`;
}

function bindSopVersionInteractions(app, { state, render, showToast }) {
  app.addEventListener("input", (event) => {
    if (!canManageSopVersions() || !state.sopDraft) return;
    if (state.sopDraftError) {
      state.sopDraftError = "";
      app.querySelector(".sop-version-panel .form-error")?.remove();
    }
    const documentField = event.target.dataset.sopDocumentField;
    if (documentField) {
      state.sopDraft.document[documentField] = event.target.value;
      return;
    }
    const procedureIndex = Number(event.target.dataset.procedureIndex);
    if (!Number.isInteger(procedureIndex)) return;
    const procedure = state.sopDraft.procedures[procedureIndex];
    if (!procedure) return;
    const procedureField = event.target.dataset.procedureField;
    if (procedureField) {
      procedure[procedureField] = event.target.value;
      return;
    }
    const stepIndex = Number(event.target.dataset.stepIndex);
    const stepField = event.target.dataset.stepField;
    if (stepField && procedure.steps[stepIndex]) procedure.steps[stepIndex][stepField] = event.target.value;
  });

  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    if (action.dataset.action === "add-sop-step" || action.dataset.action === "delete-sop-step") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      const procedure = state.sopDraft.procedures[Number(action.dataset.procedureIndex)];
      if (!procedure) return;
      state.sopDraftError = "";
      if (action.dataset.action === "add-sop-step") procedure.steps.push({ number: "", text: "", sourceNote: "", images: [] });
      else procedure.steps.splice(Number(action.dataset.stepIndex), 1);
      render();
    } else if (action.dataset.action === "publish-sop-version") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      if (hasOpenSopWork(state, state.sopDraft.id)) {
        showToast("Finaliza los trabajos abiertos antes de cambiar la versión activa de la SOP.", "warning");
        return;
      }
      try {
        state.sopDraft = validateSopDraft(state.sopDraft);
      } catch (error) {
        state.sopDraftError = error?.message || "Corrige los campos incompletos antes de guardar.";
        render();
        return;
      }
      state.sopVersionBusy = true;
      render();
      try {
        const version = state.sopDraft;
        await saveSopVersionAndActivate(version);
        state.sopVersionHistory = await listStoredSopVersions();
        applySopVersion(version, state);
        state.sopDraft = null;
        state.sopDraftError = "";
        state.sopVersionBusy = false;
        recordLocalAuditEvent("sop_version_activated", { details: `Rev. ${version.document.revision} · ${version.document.id}` });
        showToast(`SOP Rev. ${version.document.revision} guardada y activada en este navegador.`);
      } catch (error) {
        state.sopVersionBusy = false;
        state.sopDraftError = error?.message || "No se pudo guardar la revisión en IndexedDB.";
        render();
      }
    } else if (action.dataset.action === "activate-sop-version") {
      if (!canManageSopVersions()) return;
      if (hasOpenSopWork(state, action.dataset.versionId)) {
        showToast("Finaliza los trabajos abiertos antes de cambiar la versión activa de la SOP.", "warning");
        return;
      }
      const versionId = action.dataset.versionId;
      try {
        if (versionId === BUILT_IN_SOP_VERSION_ID) {
          await setActiveSopVersionId(versionId);
          applyBuiltInSopVersion(state);
        } else {
          const version = state.sopVersionHistory.find((entry) => entry.id === versionId);
          if (!version) throw new Error("No se encontró la versión guardada en este navegador.");
          await setActiveSopVersionId(version.id);
          applySopVersion(version, state);
        }
        recordLocalAuditEvent("sop_version_activated", { details: `Rev. ${SOP_DOCUMENT.revision} · ${SOP_DOCUMENT.id}` });
        showToast(`SOP Rev. ${SOP_DOCUMENT.revision} activada.`);
      } catch (error) {
        showToast(error?.message || "No se pudo cambiar la versión activa de la SOP.", "warning");
      }
    }
  });

  app.addEventListener("submit", async (event) => {
    if (!event.target.matches("#sop-version-upload-form")) return;
    event.preventDefault();
    if (!canManageSopVersions()) return;
    if (hasOpenSopWork(state)) {
      state.sopDraftError = "Finaliza los trabajos abiertos antes de cambiar la versión activa de la SOP.";
      render();
      return;
    }
    const form = event.target;
    const pdfFile = form.elements.namedItem("pdf").files?.[0];
    state.sopVersionBusy = true;
    state.sopDraftError = "";
    render();
    try {
      state.sopDraft = await extractSopPdfVersion(pdfFile);
      state.sopDraftError = "";
    } catch (error) {
      state.sopDraft = null;
      state.sopDraftError = error?.message || "No se pudo validar el archivo de SOP.";
    }
    state.sopVersionBusy = false;
    render();
  });
}
