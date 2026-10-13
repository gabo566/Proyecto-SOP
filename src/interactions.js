function bindInteractions(app, handlers) {
  const {
    state,
    navItems,
    getRecords,
    render,
    showToast,
    selectProcedure,
    moveProcedure,
    openRecords,
    closeDialog,
    handleCompletionSubmit,
  } = handlers;
  let stepImageViewer = { zoom: 100 };

  function handleNavigation(action) {
    const item = navItems.find((navItem) => navItem.id === action.dataset.navId);
    if (!item) return;
    state.navOpen = false;
    if (item.action === "reports") {
      openRecords(action.dataset.focusKey);
      return;
    }
    state.activeSection = item.id;
    render();
    document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateSerialSearch() {
    const { filtered, visible } = getVisibleSerialRecords(getRecords(), state.serialQuery);
    const body = document.querySelector("#serial-table-body");
    const count = document.querySelector("#serial-table-count");
    if (!body || !count) return;
    body.innerHTML = visible.length ? renderSerialRows(visible) : '<tr><td class="empty-row" colspan="9">No hay registros que coincidan con la búsqueda.</td></tr>';
    count.textContent = `Mostrando ${visible.length} de ${filtered.length} ${state.serialQuery.trim() ? "coincidencias" : "registros representativos"}`;
  }

  function updateDialogSearch() {
    const body = document.querySelector("#dialog-table-body");
    if (body) body.innerHTML = renderDialogRows(getRecords(), state.recordsQuery);
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
    stepImageViewer = { zoom: 100 };
    document.querySelector("#step-image-dialog-title").textContent = `Paso ${action.dataset.stepNumber} · hoja ${action.dataset.sheet}`;
    image.alt = action.dataset.imageAlt;
    document.querySelector("#step-image-caption").textContent = action.dataset.imageAlt;
    image.onload = updateStepImageZoom;
    image.style.width = "auto";
    image.src = action.dataset.imageSrc;
    dialog.showModal();
    if (image.complete) updateStepImageZoom();
  }

  window.addEventListener("resize", updateStepImageZoom, { passive: true });

  app.addEventListener("click", (event) => {
    if (event.target instanceof HTMLDialogElement && event.target.open) {
      const bounds = event.target.getBoundingClientRect();
      const clickedBackdrop = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (clickedBackdrop) {
        if (event.target.id === "step-image-dialog") event.target.close();
        else closeDialog("recordsDialogOpen");
      }
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action || !app.contains(action)) return;
    switch (action.dataset.action) {
      case "navigate": handleNavigation(action); break;
      case "open-menu": state.navOpen = true; render(); break;
      case "close-menu": state.navOpen = false; render(); break;
      case "brand-home": state.navOpen = false; render(); break;
      case "previous-procedure": moveProcedure(-1); break;
      case "next-procedure": moveProcedure(1); break;
      case "zoom-step-image": openStepImage(action); break;
      case "step-image-zoom-in": setStepImageZoom(stepImageViewer.zoom + 25); break;
      case "step-image-zoom-out": setStepImageZoom(stepImageViewer.zoom - 25); break;
      case "step-image-zoom-reset": setStepImageZoom(100); break;
      case "close-step-image": document.querySelector("#step-image-dialog")?.close(); break;
      case "open-records": openRecords(action.dataset.focusKey); break;
      case "close-records": closeDialog("recordsDialogOpen"); break;
      case "close-toast": state.toast = null; render(); break;
      default: break;
    }
  });

  app.addEventListener("change", (event) => {
    const { target } = event;
    if (target.matches("#procedure-select")) {
      selectProcedure(target.value);
    } else if (target.matches("[data-step]")) {
      const step = target.dataset.step;
      state.completedSteps = target.checked
        ? [...state.completedSteps, step]
        : state.completedSteps.filter((value) => value !== step);
      render();
    } else if (target.dataset.formField === "declaration") {
      state.form.declaration = target.checked;
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-describedby");
      clearFormError();
    }
  });

  app.addEventListener("input", (event) => {
    const { target } = event;
    if (target.dataset.search === "serial") {
      state.serialQuery = target.value;
      updateSerialSearch();
    } else if (target.dataset.search === "dialog") {
      state.recordsQuery = target.value;
      updateDialogSearch();
    } else if (target.dataset.formField) {
      state.form[target.dataset.formField] = target.value;
      if (state.formError) clearFormError();
      target.removeAttribute("aria-invalid");
      target.removeAttribute("aria-describedby");
    }
  });

  app.addEventListener("submit", (event) => {
    if (event.target.matches("#completion-form")) handleCompletionSubmit(event);
  });
}
