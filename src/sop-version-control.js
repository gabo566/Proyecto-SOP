const SOP_VERSION_DATABASE = "sop-operador-sop-versions-v1";
const SOP_VERSION_STORE = "versions";
const SOP_VERSION_SETTINGS = "settings";
const SOP_VERSION_ACTIVE_KEY = "active-version";
const SOP_VERSION_MAX_IMAGE_BYTES = 100 * 1024 * 1024;

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
    state.form = createEmptyForm();
  } else {
    state.selectedId = activeWork.procedureId;
  }
  state.form.nodePartNumber = SOP_DOCUMENT.nodePartNumber ?? "";
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

function normalizeSopImageReference(reference, filesByName, context) {
  const filename = typeof reference === "string" ? reference : reference?.file;
  if (!filename) return null;
  const file = filesByName.get(filename);
  if (!file) throw new Error(`Falta la imagen «${filename}» referenciada en ${context}.`);
  return { blob: file, name: file.name };
}

function normalizeSopPackage(manifest, imageFiles, pdfFile) {
  if (!pdfFile || (!pdfFile.name.toLocaleLowerCase("es-MX").endsWith(".pdf") && pdfFile.type !== "application/pdf") || !pdfFile.size) {
    throw new Error("Selecciona el PDF fuente de esta revisión.");
  }
  if (pdfFile.size > SOP_VERSION_MAX_IMAGE_BYTES) throw new Error("El PDF excede el límite local de 100 MB.");
  const document = manifest?.document;
  if (!document || !String(document.id ?? "").trim() || !String(document.title ?? "").trim() || !String(document.revision ?? "").trim()) {
    throw new Error("El JSON debe incluir document.id, document.title y document.revision.");
  }
  if (!Array.isArray(manifest.procedures) || !manifest.procedures.length) {
    throw new Error("Agrega al menos un procedimiento en procedures.");
  }
  if (manifest.procedures.length > 500) throw new Error("El paquete excede el límite de 500 procedimientos.");

  const totalImageBytes = imageFiles.reduce((total, file) => total + file.size, 0);
  if (totalImageBytes > SOP_VERSION_MAX_IMAGE_BYTES) throw new Error("Las imágenes exceden el límite local de 100 MB por versión.");
  const filesByName = new Map();
  for (const file of imageFiles) {
    if (filesByName.has(file.name)) throw new Error(`Hay más de una imagen llamada «${file.name}». Renombra los archivos para que sean únicos.`);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`El archivo «${file.name}» no es JPG, PNG o WebP.`);
    filesByName.set(file.name, file);
  }

  const procedureIds = new Set();
  const sheetNumbers = new Set();
  const procedures = manifest.procedures.map((rawProcedure, procedureIndex) => {
    const sheet = Number(rawProcedure.sheet);
    const id = String(rawProcedure.id || `sheet-${sheet}`);
    if (!Number.isInteger(sheet) || sheet < 1) throw new Error(`El procedimiento ${procedureIndex + 1} requiere un número de hoja entero mayor que cero.`);
    if (procedureIds.has(id) || sheetNumbers.has(sheet)) throw new Error(`Los identificadores y números de hoja deben ser únicos (hoja ${sheet}).`);
    if (!String(rawProcedure.category ?? "").trim() || !String(rawProcedure.title ?? "").trim() || !Array.isArray(rawProcedure.steps)) {
      throw new Error(`El procedimiento de la hoja ${sheet} requiere category, title y una lista steps.`);
    }
    if (rawProcedure.steps.length > 500) throw new Error(`La hoja ${sheet} excede el límite de 500 pasos.`);
    procedureIds.add(id);
    sheetNumbers.add(sheet);
    const stepNumbers = new Set();
    const steps = rawProcedure.steps.map((rawStep, stepIndex) => {
      const number = String(rawStep.number ?? "").trim();
      const text = String(rawStep.text ?? "").trim();
      if (!number || !text) throw new Error(`El paso ${stepIndex + 1} de la hoja ${sheet} requiere number y text.`);
      if (stepNumbers.has(number)) throw new Error(`El número de paso ${number} está repetido en la hoja ${sheet}.`);
      stepNumbers.add(number);
      const images = (rawStep.images ?? []).map((reference, imageIndex) => {
        const resolved = normalizeSopImageReference(reference, filesByName, `el paso ${number} de la hoja ${sheet}`);
        if (!resolved) throw new Error(`Indica el archivo de imagen del recurso ${imageIndex + 1} del paso ${number}, hoja ${sheet}.`);
        return { ...resolved, alt: String(reference?.alt || `Referencia del paso ${number}, hoja ${sheet}`) };
      });
      return { number, text, sourceNote: String(rawStep.sourceNote ?? ""), images };
    });
    const pageImage = rawProcedure.pageImage
      ? normalizeSopImageReference(rawProcedure.pageImage, filesByName, `la hoja ${sheet}`)
      : null;
    const stepRange = String(rawProcedure.stepRange || (steps.length ? `${steps[0].number}–${steps.at(-1).number}` : ""));
    return {
      id, sheet, category: String(rawProcedure.category).trim(), title: String(rawProcedure.title).trim(),
      stepRange, partNumber: String(rawProcedure.partNumber ?? ""), steps, pageImage,
    };
  });

  const maxSheet = Math.max(...procedures.map((procedure) => procedure.sheet));
  return {
    id: `sop-version-${crypto.randomUUID()}`,
    document: {
      id: String(document.id).trim(), title: String(document.title).trim(), revision: String(document.revision).trim(),
      family: String(document.family ?? ""), customer: String(document.customer ?? ""), station: String(document.station ?? ""),
      nodePartNumber: String(document.nodePartNumber ?? ""), totalSheets: Math.max(maxSheet, Number(document.totalSheets) || maxSheet),
      processSheets: procedures.filter((procedure) => procedure.steps.length).length,
      processSheetRange: String(document.processSheetRange ?? ""),
      pdfPath: "",
    },
    pdf: { blob: pdfFile, name: pdfFile.name },
    procedures,
    createdAt: new Date().toISOString(),
    createdBy: getActiveLocalUser().name,
  };
}

function formatSopVersionDate(value) {
  if (!value) return "Incluida en el proyecto";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha desconocida" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderSopVersionPreview(version, state) {
  const stepCount = version.procedures.reduce((total, procedure) => total + procedure.steps.length, 0);
  const rows = version.procedures.map((procedure) => `<li><strong>Hoja ${escapeHtml(procedure.sheet)} · ${escapeHtml(procedure.title)}</strong><span>${procedure.steps.length} pasos · ${escapeHtml(procedure.category)}</span></li>`).join("");
  return `<section class="sop-version-preview" aria-labelledby="sop-version-preview-title"><h3 id="sop-version-preview-title">Vista previa · Rev. ${escapeHtml(version.document.revision)}</h3>
    <p>${escapeHtml(version.document.title)} · ${version.procedures.length} hojas · ${stepCount} pasos</p><ul>${rows}</ul>
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
    <p class="sop-version-intro">Carga el PDF fuente, el JSON con los pasos y las imágenes referenciadas. El sistema valida y muestra la revisión antes de guardarla en este navegador.</p>
    <form class="sop-version-form" id="sop-version-upload-form"><label>PDF fuente de la SOP<input name="pdf" type="file" accept="application/pdf,.pdf" required /></label><label>Archivo JSON de pasos<input name="manifest" type="file" accept="application/json,.json" required /></label>
      <label>Imágenes indicadas en el JSON<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
      <div class="sop-version-actions"><button class="button button--primary" type="submit" ${state.sopVersionBusy ? "disabled" : ""}><span class="material-symbols-rounded" aria-hidden="true">preview</span>Validar y previsualizar</button><button class="text-button" type="button" data-action="download-sop-template">Descargar plantilla JSON</button></div>
      <p class="dialog-note"><span class="material-symbols-rounded" aria-hidden="true">info</span>Formatos de imagen: JPG, PNG o WebP. PDF e imágenes: máximo 100 MB cada uno. El PDF y las imágenes quedan dentro del almacenamiento local del navegador.</p>${error}</form>
    ${preview}
    <section class="sop-version-history" aria-labelledby="sop-version-history-title"><h3 id="sop-version-history-title">Versiones de SOP guardadas en este navegador</h3><ul>${historyRows}</ul></section>
    <p class="sop-version-warning">Los cambios solo están disponibles en este navegador y perfil. Exporta o conserva los archivos originales para tener respaldo. Las evidencias ya guardadas conservarán la revisión con la que se registraron.</p>
  </section>`;
}

function renderSopTemplateDownload() {
  return {
    document: {
      id: "SOP-EJEMPLO-001", title: "Nombre de la SOP", revision: "1", family: "GB200", customer: "Nvidia Racks",
      station: "Rework", nodePartNumber: "", totalSheets: 1, processSheetRange: "1",
    },
    procedures: [{
      id: "sheet-1", sheet: 1, category: "Chasis", title: "Nombre del procedimiento", stepRange: "1–2", partNumber: "",
      pageImage: "hoja-1.jpg",
      steps: [
        { number: "1", text: "Describe la acción que debe ejecutar el operador.", images: [{ file: "paso-1.jpg", alt: "Referencia del paso 1" }] },
        { number: "2", text: "Describe la siguiente acción.", images: [] },
      ],
    }],
  };
}

function downloadSopTemplate() {
  const blob = new Blob([JSON.stringify(renderSopTemplateDownload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla-sop.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function bindSopVersionInteractions(app, { state, render, showToast }) {
  app.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    if (action.dataset.action === "download-sop-template") {
      if (canManageSopVersions()) downloadSopTemplate();
    } else if (action.dataset.action === "publish-sop-version") {
      if (!canManageSopVersions() || !state.sopDraft) return;
      if (hasOpenSopWork(state, state.sopDraft.id)) {
        showToast("Finaliza los trabajos abiertos antes de cambiar la versión activa de la SOP.", "warning");
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
    const manifestFile = form.elements.namedItem("manifest").files?.[0];
    const imageFiles = [...(form.elements.namedItem("images").files ?? [])];
    state.sopVersionBusy = true;
    state.sopDraftError = "";
    render();
    try {
      if (!manifestFile) throw new Error("Selecciona el archivo JSON de la SOP.");
      const manifest = JSON.parse(await manifestFile.text());
      state.sopDraft = normalizeSopPackage(manifest, imageFiles, pdfFile);
      state.sopDraftError = "";
    } catch (error) {
      state.sopDraft = null;
      state.sopDraftError = error?.message || "No se pudo validar el archivo de SOP.";
    }
    state.sopVersionBusy = false;
    render();
  });
}
