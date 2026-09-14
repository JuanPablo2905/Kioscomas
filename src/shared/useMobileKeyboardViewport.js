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
    let baselineHeight = Math.max(
      Math.round(window.innerHeight || 0),
      Math.round((viewport?.height || 0) + (viewport?.offsetTop || 0)),
    );
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
        // Safari ya desplaza la ventana visual cuando abre el teclado. Centrar con
        // una animación agregaba un segundo desplazamiento y dejaba media pantalla
        // cubierta por el fondo del modal.
        element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }, delay);
    };

    const updateViewport = () => {
      const visibleHeight = Math.round(viewport?.height || window.innerHeight);
      const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
      root.style.setProperty("--app-visible-height", `${visibleHeight}px`);
      root.style.setProperty("--app-viewport-offset-top", `${viewportOffsetTop}px`);

      const active = document.activeElement;
      if (!isEditable(active)) {
        // Al perder el foco iOS tarda unas décimas en devolver el alto completo.
        // Conservar el último alto estable durante ese lapso evita la franja vacía.
        if (baselineHeight - visibleHeight <= 80 && viewportOffsetTop <= 40) {
          baselineHeight = Math.max(visibleHeight, Math.round(window.innerHeight || 0));
        }
        root.style.setProperty("--app-viewport-height", `${baselineHeight}px`);
        root.dataset.mobileKeyboard = "closed";
        return;
      }

      const keyboardReducedViewport = baselineHeight - visibleHeight > 80 || viewportOffsetTop > 40;
      if (keyboardReducedViewport || root.dataset.mobileKeyboard === "open") {
        root.dataset.mobileKeyboard = "open";
        // El alto principal representa la superficie de la app, no el recorte que
        // informa el teclado. El alto visible queda disponible por separado.
        root.style.setProperty("--app-viewport-height", `${baselineHeight}px`);
        if (viewportRevealTimer) window.clearTimeout(viewportRevealTimer);
        viewportRevealTimer = window.setTimeout(() => {
          viewportRevealTimer = null;
          if (document.activeElement === active) active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        }, 70);
      } else {
        baselineHeight = Math.max(baselineHeight, visibleHeight, Math.round(window.innerHeight || 0));
        root.style.setProperty("--app-viewport-height", `${baselineHeight}px`);
      }
    };

    const handleFocus = (event) => {
      if (!isEditable(event.target)) return;
      baselineHeight = Math.max(
        baselineHeight,
        Math.round(window.innerHeight || 0),
        Math.round((viewport?.height || 0) + (viewport?.offsetTop || 0)),
      );
      root.dataset.mobileKeyboard = "open";
      updateViewport();
      reveal(event.target, 80);
      reveal(event.target, 280);
    };

    const handleBlur = () => {
      later(() => {
        if (isEditable(document.activeElement)) return;
        root.dataset.mobileKeyboard = "closed";
        updateViewport();
      }, 140);
      later(updateViewport, 420);
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
      root.style.removeProperty("--app-visible-height");
      root.style.removeProperty("--app-viewport-offset-top");
      delete root.dataset.mobileKeyboard;
    };
  }, []);
}
