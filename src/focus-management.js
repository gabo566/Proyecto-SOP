function getFocusState() {
  const active = document.activeElement;
  return {
    key: active?.dataset?.focusKey ?? "",
    start: typeof active?.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active?.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function restoreFocus(previousFocus, { focusDialog, initial }, state) {
  if (focusDialog && state.helpDialogOpen) {
    document.querySelector('[data-focus-key="help-close"]')?.focus();
    return;
  }
  if (focusDialog && state.recordsDialogOpen) {
    document.querySelector('[data-focus-key="records-search"]')?.focus();
    return;
  }
  if (focusDialog && state.validationDialogOpen) {
    (document.querySelector("#guided-confirmation-heading") ?? document.querySelector("#completion-form [name='declaration']"))?.focus();
    return;
  }
  if (!previousFocus.key) {
    if (!initial && !state.recordsDialogOpen && state.dialogTriggerFocusKey) {
      document.querySelector(`[data-focus-key="${CSS.escape(state.dialogTriggerFocusKey)}"]`)?.focus();
      state.dialogTriggerFocusKey = "";
    }
    return;
  }
  const element = document.querySelector(`[data-focus-key="${CSS.escape(previousFocus.key)}"]`);
  if (!element) return;
  element.focus();
  if (previousFocus.start !== null && typeof element.setSelectionRange === "function") {
    element.setSelectionRange(previousFocus.start, previousFocus.end);
  }
}
