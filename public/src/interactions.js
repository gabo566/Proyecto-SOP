function bindInteractions(app, handlers) {
  const {
    state,
    navItems,
    getRecords,
    getProcedure,
    render,
    showToast,
    selectProcedure,
    moveProcedure,
    openRecords,
    closeDialog,
    handleCompletionSubmit,
    continueGuidedSopSheet,
    continueStationIntake,
    previousGuidedSopSheet,
    openWorkItemDialog,
    closeWorkItemDialog,
    handleWorkItemSubmit,
    resumeWorkItem,
    handoffWorkOperator,
    persistWorkState,
    parkActiveWorkForSopChange,
    addEvidence,
    removeEvidence,
    openEvidenceReview,
    closeEvidenceReview,
    decideEvidenceReview,
    addEvidenceToRecord,
    addValidationEvidence,
    removeValidationEvidence,
    addDraftEvidence,
    removeDraftEvidence,
    openRecordEvidence,
    authenticateLocalUser,
    endLocalUserSession,
    createLocalUser,
    changeLocalUserPassword,
    toggleLocalUser,
  } = handlers;
  let stepImageViewer = { zoom: 100 };
  let sopAreaSelection = null;

  // Cambios de pantalla discretos (render() reconstruye el DOM): View Transitions con fallback sin animación.
  // direction: "forward" (por defecto), "back" o "soft" (solo fundido corto, sin desplazamiento).
  function runWithTransition(update, direction = "forward") {
    const canAnimate = typeof document.startViewTransition === "function"
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canAnimate) {
      update();
      return Promise.resolve();
    }
    document.documentElement.dataset.navDir = direction;
    const transition = document.startViewTransition(update);
    return transition.finished
      .catch(() => {})
      .finally(() => { delete document.documentElement.dataset.navDir; });
  }

  // ---- Mi perfil: los errores se escriben en el diálogo abierto para no perder lo tecleado.
  function showProfileMessage(id, message) {
    const element = document.querySelector(`#${id}`);
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  async function submitProfileForm(form) {
    showProfileMessage("profile-error", "");
    const data = new FormData(form);
    const text = (name) => String(data.get(name) ?? "").trim();
    const result = await saveLocalProfile({ email: text("email"), phone: text("phone"), position: text("position"), area: text("area"), shift: text("shift") });
    if (!result.ok) {
      showProfileMessage("profile-error", result.message);
      return;
    }
    recordLocalAuditEvent("profile_updated", {});
    showToast("Perfil actualizado.");
    document.querySelector("#profile-dialog")?.close();
  }

  async function submitPasswordForm(form) {
    showProfileMessage("profile-password-error", "");
    const data = new FormData(form);
    const next = String(data.get("password") ?? "");
    if (next !== String(data.get("passwordConfirm") ?? "")) {
      showProfileMessage("profile-password-error", "Las contraseñas nuevas no coinciden.");
      return;
    }
    const result = await changeOwnPassword(String(data.get("currentPassword") ?? ""), next);
    if (!result.ok) {
      showProfileMessage("profile-password-error", result.message);
      return;
    }
    recordLocalAuditEvent("own_password_changed", {});
    form.reset();
    showToast("Contraseña actualizada.");
  }

  async function changeOwnAvatar(input) {
    const file = input.files?.[0];
    input.value = "";
    showProfileMessage("profile-photo-error", "");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      showProfileMessage("profile-photo-error", file.size > 2 * 1024 * 1024 ? "La foto debe pesar 2 MB o menos." : "Usa una foto JPG, PNG o WebP.");
      return;
    }
    const result = await uploadProfileAvatar(file);
    if (!result.ok) {
      showProfileMessage("profile-photo-error", result.message);
      return;
    }
    render();
  }

  async function removeOwnAvatar() {
    const result = await removeProfileAvatar();
    if (!result.ok) {
      showProfileMessage("profile-photo-error", result.message);
      return;
    }
    render();
  }

  function handleNavigation(action) {
    const item = navItems.find((navItem) => navItem.id === action.dataset.navId);
    if (!item) return;
    const role = getActiveLocalUser().role;
    if ((item.id === "reports" && !["supervisor", "admin"].includes(role))
      || (item.id === "users" && role !== "admin")
      || (item.id === "sop-admin" && !canAccessSopAdmin())) return;
    state.navOpen = false;
    if (item.action === "reports") {
      openRecords(action.dataset.focusKey);
      return;
    }
    // Cada sección abre desde arriba: el scroll se reinicia dentro de la transición (instantáneo) para que
    // la vista nueva no herede la posición de la anterior ni quede a medias por un scrollIntoView.
    const update = () => {
      state.activeSection = item.id;
      render();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    if (item.id === state.activeSection) {
      update();
    } else {
      runWithTransition(update);
    }
    // Trabajos y registros son compartidos: se traen los cambios de otras personas.
    void refreshWorkData();
  }

  function prepareSopChangeFromIntake(target) {
    if (!target.closest("#station-intake-form") || !state.activeWorkId) return false;
    if (parkActiveWorkForSopChange()) return false;
    render({ focusKey: target.dataset.focusKey });
    showToast("No se pudo guardar el avance del trabajo anterior. Libera espacio e inténtalo de nuevo.", "warning");
    return true;
  }

  function setScanError(field, message) {
    state.scanErrors = { ...(state.scanErrors ?? {}), [field]: message };
    const node = document.querySelector(`[data-scan-error="${field}"]`);
    if (node) {
      node.textContent = message;
      node.hidden = !message;
    }
    const input = document.querySelector(`[data-form-field="${field}"]`);
    if (!input) return;
    input.setAttribute("aria-invalid", message ? "true" : "false");
    input.classList.toggle("station-scan-input--error", Boolean(message));
    if (message) {
      input.classList.remove("station-scan-input--shake");
      void input.offsetWidth;
      input.classList.add("station-scan-input--shake");
    }
  }

  function focusNextScanField(field) {
    const next = SCAN_FIELD_ORDER[SCAN_FIELD_ORDER.indexOf(field) + 1];
    const nextField = next ? document.querySelector(`[data-form-field="${next}"]`) : null;
    const target = nextField
      ?? document.querySelector('input[data-card-field="partNumber"]')
      ?? document.querySelector(".station-intake-continue:not(:disabled)");
    target?.focus();
  }

  // Enter en un renglón de tarjeta pasa al siguiente campo; al final, al botón de abrir la SOP.
  app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches?.("input[data-card-field]")) return;
    event.preventDefault();
    const inputs = [...app.querySelectorAll("input[data-card-field]")];
    const next = inputs[inputs.indexOf(event.target) + 1];
    (next ?? app.querySelector(".station-intake-continue:not(:disabled)"))?.focus();
  });

  function commitScanField(input, advance) {
    const field = input.dataset.formField;
    const value = normalizeScanValue(input.value);
    if (!value) return false;
    const result = validateScanField(field, value);
    if (!result.ok) {
      state.form[field] = "";
      input.value = "";
      setScanError(field, result.message);
      persistWorkState();
      updateStationIntakeUI(state);
      input.focus();
      return false;
    }
    state.form[field] = value;
    input.value = value;
    setScanError(field, "");
    persistWorkState();
    updateStationIntakeUI(state);
    if (advance) focusNextScanField(field);
    return true;
  }

  app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches?.("[data-scan-field]")) return;
    event.preventDefault();
    commitScanField(event.target, true);
  });

  function updateSerialSearch() {
    const { filtered, visible } = getVisibleSerialRecords(getRecords(), state.serialQuery);
    const body = document.querySelector("#serial-table-body");
    const count = document.querySelector("#serial-table-count");
    if (!body || !count) return;
    body.innerHTML = visible.length ? renderSerialRows(visible, state.workItems) : '<tr><td class="empty-row" colspan="13">No hay registros que coincidan con la búsqueda.</td></tr>';
    count.textContent = `Mostrando ${visible.length} de ${filtered.length} ${state.serialQuery.trim() ? "coincidencias" : "registros representativos"}`;
  }

  function updateDialogSearch() {
    const body = document.querySelector("#dialog-table-body");
    if (body) body.innerHTML = renderDialogRows(getRecords(), state.recordsQuery, state.workItems);
  }

  function clearFormError() {
    state.formError = "";
    const error = document.querySelector("#completion-form-error");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    app.querySelectorAll("[aria-invalid='true']").forEach((element) => {
      element.removeAttribute("aria-invalid");
      element.removeAttribute("aria-describedby");
    });
  }

  function updateStepImageZoom() {
    const image = document.querySelector("#step-image-preview");
    const zoomLevel = document.querySelector("#step-image-zoom-level");
    const viewport = document.querySelector(".step-image-dialog-viewport");
    if (!image || !zoomLevel || !viewport) return;
    zoomLevel.textContent = `${stepImageViewer.zoom}%`;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const fitScale = Math.min(
      Math.max(1, viewport.clientWidth - 16) / image.naturalWidth,
      Math.max(1, viewport.clientHeight - 16) / image.naturalHeight,
      1,
    );
    image.style.width = `${Math.round(image.naturalWidth * fitScale * stepImageViewer.zoom / 100)}px`;
  }

  function setStepImageZoom(zoom) {
    stepImageViewer.zoom = Math.max(50, Math.min(400, zoom));
    updateStepImageZoom();
  }

  function openStepImage(action) {
    const dialog = document.querySelector("#step-image-dialog");
    const image = document.querySelector("#step-image-preview");
    if (!dialog || !image) return;
    stepImageViewer = { zoom: 90 };
    document.querySelector("#step-image-dialog-title").textContent = `Paso ${action.dataset.stepNumber} · hoja ${action.dataset.sheet}`;
    image.alt = action.dataset.imageAlt;
    document.querySelector("#step-image-caption").textContent = action.dataset.stepText || action.dataset.imageAlt;
    image.onload = updateStepImageZoom;
    image.style.width = "auto";
    image.src = action.dataset.imageSrc;
    dialog.showModal();
    if (image.complete) updateStepImageZoom();
  }

  const SOP_PAGE_DEFAULT_ZOOM = 100;

  function setSopPageZoom(zoom, anchor = null, auto = false) {
    state.sopPageZoomAuto = auto;
    state.sopPageZoom = Math.max(50, Math.min(500, zoom));
    const viewport = document.querySelector("#sop-page-preview");
    if (!viewport) {
      render();
      return;
    }
    viewport.dataset.zoom = String(state.sopPageZoom);
    const level = document.querySelector("#sop-page-zoom-level");
    const zoomIn = document.querySelector('[data-action="sop-page-zoom-in"]');
    const zoomOut = document.querySelector('[data-action="sop-page-zoom-out"]');
    if (level) level.textContent = `${state.sopPageZoom}%`;
    if (zoomIn) zoomIn.disabled = state.sopPageZoom >= 500;
    if (zoomOut) zoomOut.disabled = state.sopPageZoom <= 50;
    renderSopPagePreview(anchor);
  }

  function toggleSopFocusZoom() {
    state.sopFocusedZoom = !state.sopFocusedZoom;
    const button = document.querySelector('[data-action="sop-page-toggle-focused-zoom"]');
    const viewport = document.querySelector("#sop-page-preview");
    const hint = document.querySelector("#sop-page-focus-zoom-hint");
    button?.setAttribute("aria-pressed", String(state.sopFocusedZoom));
    if (viewport) viewport.dataset.focusZoom = String(state.sopFocusedZoom);
    if (hint) {
      hint.textContent = "Arrastra sobre la hoja para seleccionar el recuadro; al soltar se ampliará esa zona.";
      hint.hidden = !state.sopFocusedZoom;
    }
    const selectionOverlay = viewport?.querySelector("[data-sop-zoom-selection-overlay]");
    if (selectionOverlay) selectionOverlay.hidden = true;
    if (!state.sopFocusedZoom && state.sopPageZoom !== SOP_PAGE_DEFAULT_ZOOM) setSopPageZoom(SOP_PAGE_DEFAULT_ZOOM, null, true);
  }

  function getSopSelectionPoint(event, selection) {
    return {
      x: Math.max(0, Math.min(1, (event.clientX - selection.canvasBounds.left) / Math.max(1, selection.canvasBounds.width))),
      y: Math.max(0, Math.min(1, (event.clientY - selection.canvasBounds.top) / Math.max(1, selection.canvasBounds.height))),
    };
  }

  function startSopAreaSelection(event) {
    const viewport = event.target.closest?.("#sop-page-preview");
    const canvas = viewport?.querySelector("canvas");
    if (!state.sopFocusedZoom || !viewport || !canvas || canvas.hidden || event.target !== canvas || event.button !== 0) return;
    const selectionOverlay = viewport.querySelector("[data-sop-zoom-selection-overlay]");
    const selectionBox = selectionOverlay?.querySelector("[data-sop-zoom-selection-box]");
    if (!selectionOverlay || !selectionBox) return;
    const selection = { viewport, canvas, canvasBounds: canvas.getBoundingClientRect(), selectionOverlay, selectionBox, pointerId: event.pointerId };
    const point = getSopSelectionPoint(event, selection);
    selection.start = point;
    selection.end = point;
    sopAreaSelection = selection;
    viewport.dataset.selectingArea = "true";
    selectionOverlay.hidden = false;
    updateSopAreaSelection(event);
    const hint = document.querySelector("#sop-page-focus-zoom-hint");
    if (hint) hint.hidden = true;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture may be unavailable in older embedded browsers. */ }
    event.preventDefault();
  }

  function updateSopAreaSelection(event) {
    const selection = sopAreaSelection;
    if (!selection || event.pointerId !== selection.pointerId) return;
    const end = getSopSelectionPoint(event, selection);
    selection.end = end;
    const x = Math.min(selection.start.x, end.x) * 1000;
    const y = Math.min(selection.start.y, end.y) * 1000;
    selection.selectionBox.setAttribute("x", String(x));
    selection.selectionBox.setAttribute("y", String(y));
    selection.selectionBox.setAttribute("width", String(Math.abs(end.x - selection.start.x) * 1000));
    selection.selectionBox.setAttribute("height", String(Math.abs(end.y - selection.start.y) * 1000));
  }

  function finishSopAreaSelection(event) {
    const selection = sopAreaSelection;
    if (!selection || event.pointerId !== selection.pointerId) return;
    updateSopAreaSelection(event);
    sopAreaSelection = null;
    selection.selectionOverlay.hidden = true;
    selection.viewport.dataset.selectingArea = "false";
    try {
      if (selection.canvas.hasPointerCapture(event.pointerId)) selection.canvas.releasePointerCapture(event.pointerId);
    } catch { /* Pointer capture may already have been released by the browser. */ }

    const width = Math.abs(selection.end.x - selection.start.x) * selection.canvasBounds.width;
    const height = Math.abs(selection.end.y - selection.start.y) * selection.canvasBounds.height;
    const hint = document.querySelector("#sop-page-focus-zoom-hint");
    if (width < 18 || height < 18) {
      if (hint) {
        hint.textContent = "Arrastra un recuadro más amplio sobre la zona que quieres revisar.";
        hint.hidden = false;
      }
      return;
    }

    const availableWidth = Math.max(1, selection.viewport.clientWidth - 32);
    const availableHeight = Math.max(1, selection.viewport.clientHeight - 32);
    const fitFactor = Math.min(availableWidth / width, availableHeight / height);
    const currentZoom = Number(state.sopPageZoom) || 100;
    const factor = Math.max(1.1, fitFactor);
    const nextZoom = Math.min(500, Math.max(currentZoom + 10, Math.round(currentZoom * factor / 10) * 10));
    const anchor = {
      pointX: (selection.start.x + selection.end.x) / 2,
      pointY: (selection.start.y + selection.end.y) / 2,
      pointerX: selection.viewport.clientWidth / 2,
      pointerY: selection.viewport.clientHeight / 2,
    };
    setSopPageZoom(nextZoom, anchor);
    if (hint) {
      hint.textContent = "Zona ampliada. Selecciona otra zona o desactiva «Acercar a una zona» para volver a la hoja completa.";
      hint.hidden = false;
    }
  }

  function cancelSopAreaSelection(event) {
    const selection = sopAreaSelection;
    if (!selection || event.pointerId !== selection.pointerId) return;
    sopAreaSelection = null;
    selection.selectionOverlay.hidden = true;
    selection.viewport.dataset.selectingArea = "false";
    try {
      if (selection.canvas.hasPointerCapture(event.pointerId)) selection.canvas.releasePointerCapture(event.pointerId);
    } catch { /* Pointer capture may already have been released by the browser. */ }
    const hint = document.querySelector("#sop-page-focus-zoom-hint");
    if (hint) {
      hint.textContent = "Arrastra sobre la hoja para seleccionar el recuadro; al soltar se ampliará esa zona.";
      hint.hidden = !state.sopFocusedZoom;
    }
  }

  window.addEventListener("resize", updateStepImageZoom, { passive: true });
  window.addEventListener("pointerdown", startSopAreaSelection);
  window.addEventListener("pointermove", updateSopAreaSelection);
  window.addEventListener("pointerup", finishSopAreaSelection);
  window.addEventListener("pointercancel", cancelSopAreaSelection);

  app.addEventListener("click", (event) => {
    if (event.target instanceof HTMLDialogElement && event.target.open) {
      const bounds = event.target.getBoundingClientRect();
      const clickedBackdrop = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (clickedBackdrop) {
        if (event.target.id === "step-image-dialog") event.target.close();
        else if (event.target.id === "work-item-dialog") closeWorkItemDialog();
        else if (event.target.id === "validation-dialog") event.target.close();
        else if (event.target.id === "operator-handoff-dialog") event.target.close();
        else if (event.target.id === "evidence-review-dialog") closeEvidenceReview();
        else if (event.target.id === "help-dialog") event.target.close();
        else if (event.target.id === "profile-dialog") event.target.close();
        else closeDialog("recordsDialogOpen");
      }
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    switch (action.dataset.action) {
      case "users-filter":
        state.usersFilter = action.dataset.filter;
        applyUsersFilter(app.querySelector("#users-panel"), state.usersFilter, state.usersSearch);
        break;
      case "users-sop-toggle": {
        const id = String(action.dataset.userId);
        const wasOpen = (state.usersSopOpen ?? []).map(String).includes(id);
        setUsersSopOpen(wasOpen ? null : id);
        break;
      }
      case "delete-local-user":
        void deleteUserFromCard(action.dataset.userId);
        break;
      case "close-disassembly-panel":
        state.cardSheetsOpen = null;
        render();
        break;
      case "add-card-type": {
        const cards = addCard(state.form.cards ?? [], action.dataset.cardType);
        state.form.cards = cards;
        state.cardSheetsOpen = cards.at(-1).id;
        syncCardsToForm(persistWorkState);
        render();
        break;
      }
      case "add-card-blank":
        state.form.cards = addCard(state.form.cards ?? [], "");
        syncCardsToForm(persistWorkState);
        render();
        app.querySelector(".station-card-row:last-of-type select")?.focus();
        break;
      case "remove-card":
        state.form.cards = removeCard(state.form.cards ?? [], action.dataset.cardId);
        if (state.cardSheetsOpen === action.dataset.cardId) state.cardSheetsOpen = null;
        syncCardsToForm(persistWorkState);
        render();
        break;
      case "open-card-sheets":
        state.cardSheetsOpen = action.dataset.cardId;
        render();
        break;
      case "users-new-toggle":
        state.usersNewOpen = !state.usersNewOpen;
        state.usersPasswordFor = null;
        render();
        if (state.usersNewOpen) app.querySelector('#local-user-form [name="userName"]')?.focus();
        break;
      case "users-password-toggle":
        state.usersPasswordFor = String(state.usersPasswordFor) === String(action.dataset.userId) ? null : action.dataset.userId;
        state.usersNewOpen = false;
        render();
        if (state.usersPasswordFor) app.querySelector('#local-password-form [name="newPassword"]')?.focus();
        break;
      case "toggle-password-visibility": {
        const field = action.closest(".password-field")?.querySelector("input");
        if (!field) break;
        const show = field.type === "password";
        field.type = show ? "text" : "password";
        action.setAttribute("aria-pressed", String(show));
        action.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
        action.querySelector(".material-symbols-rounded").textContent = show ? "visibility_off" : "visibility";
        field.focus();
        break;
      }
      case "toggle-login-password": {
        const input = document.querySelector("#login-password");
        if (!input) break;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        action.setAttribute("aria-pressed", String(show));
        action.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
        action.querySelector(".material-symbols-rounded").textContent = show ? "visibility_off" : "visibility";
        input.focus();
        break;
      }
      case "toggle-disassembly-sheet": {
        const card = (state.form.cards ?? []).find((item) => item.id === action.dataset.cardId);
        const current = card ? card.sheets : (Array.isArray(state.form.disassemblySheets) ? state.form.disassemblySheets : []);
        const id = action.dataset.sheetId;
        const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
        if (card) { card.sheets = next; syncCardsToForm(persistWorkState); } else state.form.disassemblySheets = next;
        state.formError = "";
        render({ focusKey: action.dataset.focusKey });
        break;
      }
      case "select-all-disassembly-sheets":
      case "clear-disassembly-sheets": {
        const sheets = action.dataset.action === "clear-disassembly-sheets" ? [] : getStationDisassemblyChoice(state).options.map((option) => option.id);
        const card = (state.form.cards ?? []).find((item) => item.id === action.dataset.cardId);
        if (card) { card.sheets = sheets; syncCardsToForm(persistWorkState); } else state.form.disassemblySheets = sheets;
        state.formError = "";
        render({ focusKey: action.dataset.focusKey });
        break;
      }
      case "pick-station": {
        if (prepareSopChangeFromIntake(action)) break;
        const nextVersion = getEnabledSopVersionsForStation(state, action.dataset.stationValue)[0];
        state.form.stationAssignment = action.dataset.stationValue;
        state.form.sopVersionId = nextVersion?.id ?? "";
        state.form.disassemblySheets = [];
        state.formError = "";
        // Retrabajo: al tocar la estación se abre la ventana flotante de hojas de la primera tarjeta.
        if (getWorkStationAssignment(action.dataset.stationValue)?.type === "RWK" && state.form.actionType !== "replacement") {
          ensureCardRow(state.form);
          state.cardSheetsOpen = state.form.cards[0]?.id ?? null;
        } else state.cardSheetsOpen = null;
        runWithTransition(() => render({ focusKey: action.dataset.focusKey }), "soft");
        break;
      }
      case "navigate": handleNavigation(action); break;
      case "open-sop-admin-from-intake":
        if (!canAccessSopAdmin()) break;
        state.activeSection = "sop-admin";
        render();
        break;
      case "open-menu": state.navOpen = true; render(); break;
      case "close-menu": state.navOpen = false; render(); break;
      case "brand-home": state.navOpen = false; render(); break;
      case "logout-local-user": void endLocalUserSession(); break;
      case "open-help":
        state.dialogTriggerFocusKey = action.dataset.focusKey || "help-open";
        state.helpDialogOpen = true;
        render({ focusDialog: true });
        break;
      case "close-help": document.querySelector("#help-dialog")?.close(); break;
      case "open-profile":
        document.querySelector(".profile-menu")?.removeAttribute("open");
        state.dialogTriggerFocusKey = "profile-open";
        state.profileDialogOpen = true;
        render({ focusDialog: true });
        break;
      case "close-profile": document.querySelector("#profile-dialog")?.close(); break;
      case "choose-profile-avatar": document.querySelector("#profile-avatar-input")?.click(); break;
      case "remove-profile-avatar": void removeOwnAvatar(); break;
      case "previous-procedure": moveProcedure(-1); break;
      case "next-procedure": moveProcedure(1); break;
      case "sop-page-zoom-out": setSopPageZoom(state.sopPageZoom - 10); break;
      case "sop-page-zoom-in": setSopPageZoom(state.sopPageZoom + 10); break;
      case "sop-page-full": void openSopFullSheet(); break;
      case "sop-page-zoom-reset": setSopPageZoom(100, null, true); break;
      case "sop-page-toggle-focused-zoom": toggleSopFocusZoom(); break;
      case "return-to-sop-selection":
        if (!canOperateGuidedSopRun()) {
          showToast("Solo el operador actualmente asignado puede volver a la selección de SOP.", "warning");
          break;
        }
        if (!parkActiveWorkForSopChange()) {
          showToast("No se pudo guardar el avance actual. Inténtalo de nuevo antes de regresar.", "warning");
          break;
        }
        state.formError = "";
        runWithTransition(() => render({ focusKey: `station-${getWorkStationAssignment(state.form.stationAssignment)?.type ?? "MFG"}` }), "back");
        break;
      case "close-validation-dialog": document.querySelector("#validation-dialog")?.close(); break;
      case "confirm-current-step": document.querySelector(".guided-check-item:not(.guided-check-item--checked) > input[data-step]")?.click(); break;
      case "continue-sop-sheet": runWithTransition(() => continueGuidedSopSheet()); break;
      case "open-final-confirmation": runWithTransition(() => continueGuidedSopSheet()); break;
      case "previous-sop-sheet": runWithTransition(() => previousGuidedSopSheet(), "back"); break;
      case "zoom-step-image": openStepImage(action); break;
      case "step-image-zoom-in": setStepImageZoom(stepImageViewer.zoom + 25); break;
      case "step-image-zoom-out": setStepImageZoom(stepImageViewer.zoom - 25); break;
      case "step-image-zoom-reset": setStepImageZoom(90); break;
      case "close-step-image": document.querySelector("#step-image-dialog")?.close(); break;
      case "open-records": openRecords(action.dataset.focusKey); break;
      case "close-records": closeDialog("recordsDialogOpen"); break;
      case "open-work-item-dialog": openWorkItemDialog(); break;
      case "close-work-item-dialog": closeWorkItemDialog(); break;
      case "resume-work": resumeWorkItem(action.dataset.workId); break;
      case "open-operator-handoff": {
        const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
        const canHandOffActiveWork = !activeWork || isActiveHandoffWorkItem(activeWork);
        if (state.evidenceBusy) {
          showToast("Espera a que termine de guardarse la evidencia antes de cambiar el operador.", "warning");
          break;
        }
        if (!canHandOffActiveWork || !canOperateGuidedSopRun()) {
          showToast("El cambio solo está disponible para el operador asignado a un trabajo activo.", "warning");
          break;
        }
        if (!persistWorkState()) {
          showToast("No se pudo guardar el avance de la SOP. Inténtalo de nuevo.", "warning");
          break;
        }
        const savedWork = state.workItems.find((item) => item.id === state.activeWorkId);
        if (!isActiveHandoffWorkItem(savedWork)) {
          showToast("No se pudo guardar un trabajo activo para entregar.", "warning");
          break;
        }
        state.operatorHandoffError = "";
        state.operatorHandoffDialogOpen = true;
        state.dialogTriggerFocusKey = action.dataset.focusKey || "change-operator";
        render({ focusDialog: true });
        break;
      }
      case "close-operator-handoff":
        document.querySelector("#operator-handoff-dialog")?.close();
        break;
      case "toggle-local-user": if (getActiveLocalUser().role === "admin") toggleLocalUser(action.dataset.userId, action.dataset.active === "true"); break;
      case "remove-evidence": removeEvidence(action.dataset.evidenceId); break;
      case "remove-validation-evidence": removeValidationEvidence(action.dataset.evidenceId); break;
      case "remove-stop-evidence": removeDraftEvidence(action.dataset.evidenceId); break;
      case "review-evidence": if (["supervisor", "admin"].includes(getActiveLocalUser().role)) openEvidenceReview(action.dataset.workId); else showToast("La revisión está reservada para supervisor o administrador.", "warning"); break;
      case "view-work-evidence": if (["supervisor", "admin"].includes(getActiveLocalUser().role)) openEvidenceReview(action.dataset.workId); else showToast("La evidencia de retrabajo está reservada para supervisor o administrador.", "warning"); break;
      case "view-record-evidence": if (["supervisor", "admin"].includes(getActiveLocalUser().role)) action.dataset.workId ? openEvidenceReview(action.dataset.workId, action.dataset.recordId, false, true) : openRecordEvidence(action.dataset.recordId); else showToast("La evidencia está reservada para supervisor o administrador.", "warning"); break;
      case "view-stop-evidence": if (["supervisor", "admin"].includes(getActiveLocalUser().role)) openEvidenceReview(action.dataset.workId); else showToast("La evidencia está reservada para supervisor o administrador.", "warning"); break;
      case "manage-record-evidence": if (["supervisor", "admin"].includes(getActiveLocalUser().role)) openEvidenceReview(action.dataset.workId, action.dataset.recordId, true); else showToast("La evidencia está reservada para supervisor o administrador.", "warning"); break;
      case "close-evidence-review": closeEvidenceReview(); break;
      case "choose-evidence-file": app.querySelector("[data-evidence-input]")?.click(); break;
      case "choose-validation-evidence": app.querySelector("[data-validation-evidence-input]")?.click(); break;
      case "choose-stop-evidence": app.querySelector("[data-stop-evidence-input]")?.click(); break;
      case "choose-record-evidence": app.querySelector("[data-record-evidence-input]")?.click(); break;
      case "zoom-evidence-image":
        state.zoomedEvidence = state.reviewEvidence.find((file) => file.id === action.dataset.evidenceId) ?? null;
        state.evidenceImageDialogOpen = Boolean(state.zoomedEvidence);
        render();
        break;
      case "close-evidence-image": document.querySelector("#evidence-image-dialog")?.close(); break;
      case "approve-evidence": decideEvidenceReview(action.dataset.workId, true); break;
      case "reject-evidence": decideEvidenceReview(action.dataset.workId, false); break;
      case "close-toast": state.toast = null; render(); break;
      default: break;
    }
  });

  document.addEventListener("click", (event) => {
    if (!state.usersSopOpen?.length || event.target.closest(".uh-sop--tab")) return;
    setUsersSopOpen(null);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.usersSopOpen?.length) return;
    const toggle = app.querySelector(".uh-sop--tab.is-open .uh-sop-toggle");
    setUsersSopOpen(null);
    toggle?.focus();
  });

  app.addEventListener("change", (event) => {
    const { target } = event;
    if (target.matches("select[data-card-field]")) {
      const card = (state.form.cards ?? []).find((item) => item.id === target.closest("[data-card-id]")?.dataset.cardId);
      if (card) { card.type = target.value; syncCardsToForm(persistWorkState); render(); }
      return;
    }
    if (target.matches("input[data-card-field]")) {
      const card = (state.form.cards ?? []).find((item) => item.id === target.closest("[data-card-id]")?.dataset.cardId);
      if (card) {
        card[target.dataset.cardField] = normalizeScanValue(target.value);
        target.value = card[target.dataset.cardField];
        const slot = target.closest("[data-card-id]")?.querySelector(".station-card-detected-slot");
        if (slot && target.dataset.cardField === "partNumber") slot.innerHTML = renderDetectedCardType(card);
        syncCardsToForm(persistWorkState);
      }
      return;
    }
    if (target.matches("[data-action-type]")) {
      state.form.actionType = target.value;
      ensureCardRow(state.form);
      render();
      return;
    }
    if (target.matches("[data-sop-role-toggle]")) {
      enforceSopRoleExclusive(target);
      void changeUserSopRole(target);
      return;
    }
    if (target.matches('[name="sopReview"], [name="sopPublish"]')) {
      enforceSopRoleExclusive(target);
      return;
    }
    if (target.matches("[data-admin-toggle]")) {
      void changeUserAdmin(target);
      return;
    }
    if (target.matches("#profile-avatar-input")) {
      void changeOwnAvatar(target);
      return;
    }
    if (target.matches("[data-scan-field]")) {
      commitScanField(target, false);
      return;
    }
    if (target.matches("[data-station-type]")) {
      if (prepareSopChangeFromIntake(target)) return;
      const assignment = getEnabledWorkStationAssignments(state, target.value)[0];
      const nextVersion = assignment && getEnabledSopVersionsForStation(state, assignment.value)[0];
      if (assignment) {
        state.form.stationAssignment = assignment.value;
        state.form.sopVersionId = nextVersion?.id ?? "";
        state.form.disassemblySheets = [];
      }
      state.formError = "";
      if (target.value === "RWK") ensureCardRow(state.form);
      render({ focusKey: target.dataset.focusKey });
      return;
    } else if (target.matches("[data-station-code]")) {
      if (prepareSopChangeFromIntake(target)) return;
      const nextVersion = getEnabledSopVersionsForStation(state, target.value)[0];
      state.form.stationAssignment = target.value;
      state.form.sopVersionId = nextVersion?.id ?? "";
      state.form.disassemblySheets = [];
      state.formError = "";
      render({ focusKey: target.dataset.focusKey });
      return;
    } else if (target.matches("[data-sop-version]")) {
      if (prepareSopChangeFromIntake(target)) return;
      state.form.sopVersionId = target.value;
      state.form.disassemblySheets = [];
      state.formError = "";
      render({ focusKey: target.dataset.focusKey });
    } else if (target.matches("#procedure-select")) {
      selectProcedure(target.value);
    } else if (target.matches("[data-step]")) {
      if (!canOperateGuidedSopRun()) {
        target.checked = !target.checked;
        showToast("Solo el operador actualmente asignado puede validar sus pasos.", "warning");
        return;
      }
      const step = target.dataset.step;
      state.completedSteps = target.checked
        ? [...state.completedSteps, step]
        : state.completedSteps.filter((value) => value !== step);
      setGuidedSopStep(state.sopRun, state.selectedId, step, target.checked);
      recordLocalAuditEvent(target.checked ? "step_completed" : "step_reopened", {
        sessionId: state.auditSessionId,
        serial: state.form.serial.trim(),
        nodeNumber: state.form.nodeNumber.trim(),
        procedureId: state.selectedId,
        procedureTitle: getProcedure().title,
        sheet: getProcedure().sheet,
        step,
      });
      persistWorkState();
      updateGuidedChecklistUI(getProcedure(), state);
      revealCurrentGuidedStep();
    } else if (target.matches("input[data-card-result]")) {
      const card = (state.form.cards ?? []).find((item) => item.id === target.dataset.cardId);
      if (card) {
        card.result = target.value;
        const row = target.closest("[data-card-result-row]");
        row?.querySelector("[data-card-note-box]")?.toggleAttribute("hidden", target.value !== "damage");
        row?.querySelectorAll(".validation-result-option").forEach((option) => option.classList.toggle("is-on", option.querySelector("input")?.checked));
        document.querySelector("#validation-damage-evidence")?.toggleAttribute("hidden", !state.form.cards.some((item) => item.result === "damage"));
        persistWorkState();
        clearFormError();
      }
    } else if (target.matches("textarea[data-card-note]")) {
      const card = (state.form.cards ?? []).find((item) => item.id === target.dataset.cardId);
      if (card) {
        card.damageNote = target.value;
        persistWorkState();
        clearFormError();
      }
    } else if (target.dataset.formField === "declaration") {
      state.form.declaration = target.checked;
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-describedby");
      const submitButton = document.querySelector(".guided-final-actions .validation-submit");
      if (submitButton) submitButton.disabled = !target.checked;
      clearFormError();
    } else if (target.dataset.formField) {
      if (prepareSopChangeFromIntake(target)) return;
      state.form[target.dataset.formField] = target.value;
      if (target.dataset.formField === "nodeNumber") {
        const value = document.querySelector("#guided-confirmation-node");
        if (value) value.textContent = target.value.trim() || "nodo sin número";
      } else if (target.dataset.formField === "serial") {
        const value = document.querySelector("#guided-confirmation-serial");
        if (value) value.textContent = target.value.trim() || "serie sin capturar";
      }
      persistWorkState();
      if (state.formError) clearFormError();
      if (target.closest("#station-intake-form")) updateStationIntakeUI(state);
    } else if (target.matches('input[name="workType"]')) {
      state.workDraft.type = target.value;
      document.querySelector(".work-failed-step").hidden = target.value !== "rework";
    } else if (target.name === "failedStep") {
      state.workDraft.failedStep = target.value;
    } else if (target.name === "reasonCode") {
      state.workDraft.reasonCode = target.value;
    } else if (target.dataset.workDraftField) {
      state.workDraft[target.dataset.workDraftField] = target.value;
    } else if (target.matches("[data-evidence-input]")) {
      const selectedFiles = [...target.files];
      target.value = "";
      addEvidence(selectedFiles);
    } else if (target.matches("[data-validation-evidence-input]")) {
      const selectedFiles = [...target.files];
      target.value = "";
      addValidationEvidence(selectedFiles);
    } else if (target.matches("[data-stop-evidence-input]")) {
      const selectedFiles = [...target.files];
      target.value = "";
      addDraftEvidence(selectedFiles);
    } else if (target.matches("[data-record-evidence-input]")) {
      const selectedFiles = [...target.files];
      target.value = "";
      addEvidenceToRecord(selectedFiles);
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.matches("[data-users-search]")) {
      state.usersSearch = event.target.value;
      applyUsersFilter(app.querySelector("#users-panel"), state.usersFilter ?? "all", state.usersSearch);
      return;
    }
    if (event.target.matches("[data-password-strength], [data-password-confirm]")) {
      updatePasswordStrength(event.target.closest("form").querySelector("[data-password-strength]"));
      return;
    }
    if (event.target.matches("[data-sheet-observation]")) {
      state.sheetObservations = { ...state.sheetObservations, [event.target.dataset.sheetObservation]: event.target.value };
      return;
    }
    if (event.target.matches("[data-scan-field]") && state.scanErrors?.[event.target.dataset.formField]) setScanError(event.target.dataset.formField, "");
    if (event.target.matches("[data-disassembly-filter]")) {
      state.disassemblyFilter = event.target.value;
      const query = normalizeDisassemblySearch(event.target.value).trim();
      document.querySelectorAll(".station-disassembly-sheet").forEach((tile) => { tile.hidden = Boolean(query) && !tile.dataset.search.includes(query); });
      return;
    }
    const { target } = event;
    if (target.matches('#local-user-form input[name="userPassword"], #local-user-form input[name="userPasswordConfirm"]')) {
      const form = target.form;
      const confirm = form.elements.namedItem("userPasswordConfirm");
      confirm.setCustomValidity(form.elements.namedItem("userPassword").value === confirm.value ? "" : "Las contraseñas no coinciden.");
    }
    if (target.matches('[data-login-field="username"]')) {
      state.loginUsername = target.value;
    } else if (target.matches("#operator-handoff-form input")) {
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-describedby");
      state.operatorHandoffError = "";
      const error = document.querySelector("#operator-handoff-error");
      if (error) error.hidden = true;
    } else if (target.dataset.search === "serial") {
      state.serialQuery = target.value;
      updateSerialSearch();
    } else if (target.dataset.search === "dialog") {
      state.recordsQuery = target.value;
      updateDialogSearch();
    } else if (target.dataset.formField) {
      if (prepareSopChangeFromIntake(target)) return;
      state.form[target.dataset.formField] = target.value;
      persistWorkState();
      if (state.formError) clearFormError();
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-describedby");
      if (target.closest("#station-intake-form")) updateStationIntakeUI(state);
    } else if (target.name === "workNote") {
      state.workDraft.note = target.value;
    } else if (target.name === "failedStep") {
      state.workDraft.failedStep = target.value;
    } else if (target.name === "reasonCode") {
      state.workDraft.reasonCode = target.value;
    } else if (target.dataset.workDraftField) {
      state.workDraft[target.dataset.workDraftField] = target.value;
    } else if (target.matches("[data-review-note]")) {
      state.reviewNote = target.value;
    }
  });

  app.addEventListener("submit", async (event) => {
    if (event.target.matches("#station-intake-form")) {
      event.preventDefault();
      runWithTransition(() => continueStationIntake());
      return;
    }
    if (event.target.matches("#profile-form")) {
      event.preventDefault();
      await submitProfileForm(event.target);
      return;
    }
    if (event.target.matches("#profile-password-form")) {
      event.preventDefault();
      await submitPasswordForm(event.target);
      return;
    }
    if (event.target.matches("#local-login-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      state.loginUsername = String(formData.get("username") ?? "").trim();
      const user = await authenticateLocalUser(state.loginUsername, String(formData.get("password") ?? ""));
      if (!user) {
        state.loginError = {
          throttled: "Demasiados intentos. Espera un minuto antes de volver a intentar.",
          network: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
        }[sopSession.loginFailure] ?? "Usuario o contraseña incorrectos, o cuenta inactiva.";
        render();
        return;
      }
      await loadSopData({ silent: true });
      state.loginError = "";
      state.loginUsername = "";
      state.activeSection = "overview";
      const activeWork = state.workItems.find((item) => item.id === state.activeWorkId);
      if (activeWork && activeWork.form?.employeeNumber !== user.employeeNumber) {
        state.activeWorkId = "";
        state.completedSteps = [];
        state.sopRun = null;
      }
      if (!state.activeWorkId) {
        state.sopRun = null;
        state.form = { ...createEmptyForm(), name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", stationAssignment: "MFG:TDR", sopVersionId: "", nodeNumber: "", serial: "", declaration: false };
        state.operatorFlowReady = false;
      } else {
        state.form = { ...state.form, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA" };
        state.operatorFlowReady = false;
      }
      state.formError = "";
      state.auditSessionId = `session-${crypto.randomUUID()}`;
      localStorage.setItem("sop-operador-audit-session-v1", state.auditSessionId);
      recordLocalAuditEvent("local_login", { sessionId: state.auditSessionId });
      render();
    } else if (event.target.matches("#completion-form")) handleCompletionSubmit(event);
    if (event.target.matches("#work-item-form")) {
      handleWorkItemSubmit(event);
    } else if (event.target.matches("#operator-handoff-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const result = await handoffWorkOperator(String(formData.get("operatorUsername") ?? "").trim(), String(formData.get("operatorPassword") ?? ""));
      const errors = {
        "not-active-work": "No hay un trabajo SOP activo que se pueda transferir.",
        "not-current-operator": "Solo el operador actualmente asignado puede entregar este trabajo.",
        "sop-loading": "Espera a que termine de cargarse la SOP y el historial local para cambiar de operador.",
        "invalid-credentials": "El número de empleado o la contraseña no son correctos, o la cuenta está inactiva.",
        "same-operator": "Ingresa las credenciales de otra persona para cambiar de operador.",
        "save-failed": "No se pudo guardar el avance. El operador actual no cambió; libera espacio e inténtalo de nuevo.",
      };
      if (result !== "ok") {
        state.operatorHandoffError = errors[result] || "No se pudo cambiar el operador.";
        const error = document.querySelector("#operator-handoff-error");
        if (error) {
          error.textContent = state.operatorHandoffError;
          error.hidden = false;
        }
        const password = event.target.querySelector('[name="operatorPassword"]');
        for (const field of event.target.querySelectorAll("input")) {
          field.setAttribute("aria-invalid", "true");
          field.setAttribute("aria-describedby", "operator-handoff-error");
        }
        if (password) password.value = "";
        event.target.querySelector('[name="operatorUsername"]')?.focus();
        return;
      }
      state.operatorHandoffError = "";
      state.operatorHandoffDialogOpen = false;
      state.dialogTriggerFocusKey = "change-operator";
      render({ focusKey: state.dialogTriggerFocusKey });
      showToast("Avance guardado. El retrabajo continúa con el nuevo operador.", "success");
    }
    if (event.target.matches("#local-user-form")) {
      event.preventDefault();
      if (getActiveLocalUser().role !== "admin") return;
      await createLocalUser(new FormData(event.target));
    } else if (event.target.matches("#local-password-form")) {
      event.preventDefault();
      if (getActiveLocalUser().role !== "admin") return;
      await changeLocalUserPassword(new FormData(event.target));
    }
  });
}

// Concede o retira la función de revisor o publicador desde la tarjeta de una persona.
async function changeUserSopRole(toggle) {
  const card = toggle.closest("[data-user-card]");
  const create = card.querySelector('[data-role="create"]').checked;
  const review = card.querySelector('[data-role="review"]').checked;
  const publish = card.querySelector('[data-role="publish"]').checked;
  const label = { create: "Creador", review: "Revisor", publish: "Publicador" }[toggle.dataset.role] ?? "Función";
  card.querySelectorAll("[data-sop-role-toggle]").forEach((input) => { input.disabled = true; });
  const result = await setLocalUserSopRoles(toggle.dataset.userId, { create, review, publish });
  if (result === "ok") {
    showToast(toggle.checked ? `${label} habilitado.` : `${label} retirado.`, "success");
    // Si la persona cambió sus propias funciones, se actualizan de inmediato los botones y el menú.
    if (String(toggle.dataset.userId) === String(getActiveLocalUser().id)) await syncLocalSessionPermissions();
  }
  else {
    toggle.checked = !toggle.checked;
    showToast(result === "forbidden" ? "Solo la cuenta 140784 puede asignar estas funciones." : "No se pudo cambiar la función; intenta de nuevo.", "warning");
  }
  render();
}

// Solo una ventana de "Funciones en la SOP" abierta a la vez; se cierra al tocar fuera o con Escape.
function setUsersSopOpen(id) {
  state.usersSopOpen = id === null ? [] : [String(id)];
  app.querySelectorAll(".uh-sop--tab").forEach((box) => {
    const toggle = box.querySelector(".uh-sop-toggle");
    const open = id !== null && String(toggle?.dataset.userId) === String(id);
    toggle?.setAttribute("aria-expanded", String(open));
    box.classList.toggle("is-open", open);
    const body = box.querySelector(".uh-sop-body");
    if (body) body.hidden = !open;
  });
}

// La primera tarjeta alimenta los campos de siempre y las hojas de la SOP son la unión de las de cada tarjeta.
function syncCardsToForm(persist) {
  const cards = state.form.cards ?? [];
  Object.assign(state.form, legacyCardFields(cards, state.form.actionType));
  state.form.disassemblySheets = unionSheets(cards);
  persist?.();
  updateStationIntakeUI(state);
}

// Revisor y publicador no pueden estar activos a la vez: al activar uno se apaga el otro.
function enforceSopRoleExclusive(input) {
  if (!input.checked) return;
  // El rol de creador no se excluye con ningún otro: solo revisor y publicador.
  if (input.dataset.role === "create" || input.name === "sopCreate") return;
  const scope = input.closest("[data-user-card]") ?? input.closest("#local-user-form");
  const reviewing = input.dataset.role === "review" || input.name === "sopReview";
  const other = scope?.querySelector(reviewing ? '[data-role="publish"], [name="sopPublish"]' : '[data-role="review"], [name="sopReview"]');
  if (other) other.checked = false;
}

// Pide confirmación y elimina la cuenta desde su tarjeta.
async function deleteUserFromCard(userId) {
  const card = app.querySelector(`[data-user-card][data-user-id="${CSS.escape(String(userId))}"]`);
  const name = card?.querySelector(".uh-card-id strong")?.textContent ?? "esta persona";
  if (!window.confirm(`¿Eliminar la cuenta de ${name}? No se puede deshacer. Sus registros y su historial se conservan.`)) return;
  const result = await deleteLocalUser(userId);
  const messages = {
    "active-user": "No puedes eliminar tu propia cuenta.",
    "last-admin": "Debe quedar al menos un administrador activo.",
    forbidden: "Solo un administrador puede eliminar cuentas.",
    missing: "La cuenta ya no existe.",
  };
  if (result === "ok") showToast("Cuenta eliminada.", "success");
  else showToast(messages[result] ?? "No se pudo eliminar la cuenta; intenta de nuevo.", "warning");
  render();
}

// Habilita o quita el rol de administrador desde la tarjeta de una persona.
async function changeUserAdmin(toggle) {
  const wanted = toggle.checked;
  toggle.disabled = true;
  const result = await setLocalUserAdmin(toggle.dataset.userId, wanted);
  const messages = {
    "active-user": "No puedes quitarte a ti mismo el rol de administrador.",
    "last-admin": "Debe quedar al menos un administrador activo.",
    forbidden: "Solo la cuenta 140784 puede asignar estas funciones.",
  };
  if (result === "ok") showToast(wanted ? "Administrador habilitado." : "Administrador retirado.", "success");
  else showToast(messages[result] ?? "No se pudo cambiar el rol; intenta de nuevo.", "warning");
  render();
}

// Mantiene a la vista el paso en curso (el primero sin marcar) dentro de la lista de pasos,
// para que el operador no tenga que bajar con la barra de desplazamiento.
function revealCurrentGuidedStep(smooth = true) {
  const list = document.querySelector(".guided-checklist-list");
  const current = list?.querySelector(".guided-check-item:not(.guided-check-item--checked)");
  if (!list || !current) return;
  const listBounds = list.getBoundingClientRect();
  const currentBounds = current.getBoundingClientRect();
  if (currentBounds.top >= listBounds.top + 4 && currentBounds.bottom <= listBounds.bottom - 4) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  list.scrollTo({ top: list.scrollTop + (currentBounds.top - listBounds.top) - 8, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
}

function scrollToNextPendingStep(checkbox) {
  const list = checkbox.closest(".guided-checklist-list");
  const current = checkbox.closest(".guided-check-item");
  if (!list || !current) return;
  const items = [...list.querySelectorAll(".guided-check-item")];
  const pending = items.filter((item) => !item.classList.contains("guided-check-item--checked"));
  const next = pending.find((item) => current.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING) ?? pending[0];
  if (!next) return;
  const listBounds = list.getBoundingClientRect();
  const nextBounds = next.getBoundingClientRect();
  if (nextBounds.bottom > listBounds.bottom - 8 || nextBounds.top < listBounds.top + 8) {
    list.scrollBy({ top: nextBounds.top - listBounds.top - 12, behavior: "smooth" });
  }
}

function updateGuidedChecklistUI(procedure, state) {
  const checked = new Set(getGuidedSopCheckedSteps(state.sopRun, procedure.id));
  for (const row of document.querySelectorAll(".guided-check-item")) {
    const checkbox = row.querySelector("[data-step]");
    row.classList.toggle("guided-check-item--checked", Boolean(checkbox?.checked));
  }
  const currentRow = [...document.querySelectorAll(".guided-check-item")].find((row) => !row.classList.contains("guided-check-item--checked"));
  for (const row of document.querySelectorAll(".guided-check-item")) {
    const status = row.classList.contains("guided-check-item--checked") ? "done" : row === currentRow ? "current" : "pending";
    const pill = row.querySelector(".guided-check-status");
    if (pill) pill.outerHTML = renderGuidedStepStatusPill(status);
  }
  const currentCount = procedure.steps.filter((step) => checked.has(String(step.number))).length;
  const currentCountLabel = document.querySelector(".guided-checklist-heading-count");
  if (currentCountLabel) currentCountLabel.textContent = `${currentCount}/${procedure.steps.length}`;
  const localProgress = document.querySelector(".guided-checklist-panel .sop-run-progress-track > span");
  const localProgressLabel = document.querySelector(".guided-checklist-panel .sop-run-progress > strong");
  const localPercent = procedure.steps.length ? Math.round(currentCount / procedure.steps.length * 100) : 0;
  if (localProgress) localProgress.style.width = `${localPercent}%`;
  if (localProgressLabel) localProgressLabel.textContent = `${localPercent}%`;
  const pendingNote = document.querySelector(".guided-checklist-footer .guided-checklist-note");
  if (pendingNote) pendingNote.textContent = isGuidedSopProcedureComplete(state.sopRun, procedure)
    ? "¡Hoja completa! Ya puedes continuar."
    : `Toca cada paso al terminarlo · faltan ${procedure.steps.length - currentCount}`;
  const progress = getGuidedSopProgress(state.sopRun, SOP_SHEETS);
  const sopPercent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
  const sopBar = document.querySelector("[data-sop-progress-bar]");
  const sopPct = document.querySelector("[data-sop-progress-pct]");
  if (sopBar) sopBar.style.width = `${sopPercent}%`;
  if (sopPct) sopPct.textContent = `${sopPercent}%`;
  const progressCopy = document.querySelector(".guided-progress-copy");
  if (progressCopy) {
    progressCopy.textContent = `${progress.complete} / ${progress.total} SOP`;
  }
  const confirmButton = document.querySelector('[data-action="confirm-current-step"]');
  if (confirmButton) {
    const complete = isGuidedSopProcedureComplete(state.sopRun, procedure);
    confirmButton.disabled = complete || !canOperateGuidedSopRun();
    confirmButton.dataset.complete = String(complete);
    const confirmLabel = confirmButton.querySelector("[data-confirm-label]");
    if (confirmLabel) confirmLabel.textContent = complete ? "¡Hoja completa!" : `Confirmar paso (${Math.min(currentCount + 1, procedure.steps.length)}/${procedure.steps.length})`;
  }
  const continueButton = document.querySelector('[data-action="continue-sop-sheet"], [data-action="open-final-confirmation"]');
  if (continueButton) continueButton.disabled = !isGuidedSopProcedureComplete(state.sopRun, procedure) || !canOperateGuidedSopRun();
  if (state.formError) {
    state.formError = "";
    for (const error of document.querySelectorAll(".form-error")) {
      error.textContent = "";
      error.hidden = true;
    }
  }
}
