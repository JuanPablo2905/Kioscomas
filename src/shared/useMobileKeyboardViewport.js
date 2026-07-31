import { useEffect } from "react";

const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "textarea",
  "select",
  '[contenteditable="true"]',
].join(",");

function isEditable(element) {
  return element instanceof HTMLElement && element.matches(EDITABLE_SELECTOR) && !element.hasAttribute("readonly") && !element.hasAttribute("disabled");
}

export function useMobileKeyboardViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const timers = new Set();
    let baselineHeight = Math.round(viewport?.height || window.innerHeight);
    let viewportRevealTimer = null;

    const later = (callback, delay) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    };

    const reveal = (element, delay = 0) => {
      later(() => {
        if (document.activeElement !== element || !isEditable(element)) return;
        element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }, delay);
    };

    const updateViewport = () => {
      const visibleHeight = Math.round(viewport?.height || window.innerHeight);
      root.style.setProperty("--app-viewport-height", `${visibleHeight}px`);

      const active = document.activeElement;
      if (!isEditable(active)) {
        baselineHeight = visibleHeight;
        root.dataset.mobileKeyboard = "closed";
        return;
      }

      const keyboardReducedViewport = baselineHeight - visibleHeight > 80;
      if (keyboardReducedViewport || root.dataset.mobileKeyboard === "open") {
        root.dataset.mobileKeyboard = "open";
        if (viewportRevealTimer) window.clearTimeout(viewportRevealTimer);
        viewportRevealTimer = window.setTimeout(() => {
          viewportRevealTimer = null;
          if (document.activeElement === active) active.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }, 70);
      }
    };

    const handleFocus = (event) => {
      if (!isEditable(event.target)) return;
      baselineHeight = Math.max(baselineHeight, Math.round(viewport?.height || window.innerHeight));
      root.dataset.mobileKeyboard = "open";
      updateViewport();
      reveal(event.target, 100);
      reveal(event.target, 360);
    };

    const handleBlur = () => {
      later(() => {
        if (isEditable(document.activeElement)) return;
        root.dataset.mobileKeyboard = "closed";
        updateViewport();
      }, 140);
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("focusout", handleBlur, true);

    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("focusout", handleBlur, true);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (viewportRevealTimer) window.clearTimeout(viewportRevealTimer);
      root.style.removeProperty("--app-viewport-height");
      delete root.dataset.mobileKeyboard;
    };
  }, []);
}
