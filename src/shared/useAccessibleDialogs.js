import { useEffect } from "react";

const focusableSelector = [
  "button:not([disabled])", "a[href]", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useAccessibleDialogs() {
  useEffect(() => {
    const previousFocus = new WeakMap();
    const visibleDialogs = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
      .filter((element) => element.getClientRects().length > 0);
    const focusDialog = (dialog) => {
      if (dialog.dataset.accessibleDialogReady) return;
      dialog.dataset.accessibleDialogReady = "true";
      previousFocus.set(dialog, document.activeElement);
      queueMicrotask(() => {
        const target = dialog.querySelector("[autofocus], input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])");
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
        else { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
      });
    };
    const scan = () => visibleDialogs().forEach(focusDialog);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) for (const removed of mutation.removedNodes) {
        if (!(removed instanceof Element)) continue;
        const dialog = removed.matches?.('[role="dialog"][aria-modal="true"]') ? removed : removed.querySelector?.('[role="dialog"][aria-modal="true"]');
        const previous = dialog ? previousFocus.get(dialog) : null;
        if (previous instanceof HTMLElement && previous.isConnected) queueMicrotask(() => previous.focus({ preventScroll: true }));
      }
      scan();
    });
    const onKeyDown = (event) => {
      const dialog = visibleDialogs().at(-1);
      if (!dialog) return;
      if (event.key === "Escape") {
        const close = dialog.querySelector('[data-dialog-close], button[aria-label^="Cerrar"], button[aria-label="Cancelar"]');
        if (close instanceof HTMLElement) { event.preventDefault(); close.click(); }
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKeyDown, true);
    scan();
    return () => { observer.disconnect(); document.removeEventListener("keydown", onKeyDown, true); };
  }, []);
}
