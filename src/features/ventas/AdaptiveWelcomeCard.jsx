import React, { useLayoutEffect, useRef } from "react";
import { Monitor } from "lucide-react";
import { calculateAdaptiveWelcomeLayout } from "./adaptiveWelcomeLayout";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function AdaptiveWelcomeCard({ title = "Bienvenido", subtitle = "Gracias por elegirnos", preview = false }) {
  const cardRef = useRef(null);
  const copyRef = useRef(null);
  const safeTitle = String(title || "Bienvenido").trim() || "Bienvenido";
  const safeSubtitle = String(subtitle || "").trim();

  useLayoutEffect(() => {
    const card = cardRef.current;
    const copy = copyRef.current;
    if (!card || !copy) return undefined;
    let frame = 0;

    const measure = () => {
      const { width, height } = card.getBoundingClientRect();
      if (width < 12 || height < 12) return;

      const layout = calculateAdaptiveWelcomeLayout({
        width,
        height,
        titleLength: Array.from(safeTitle).length,
        subtitleLength: Array.from(safeSubtitle).length,
        preview,
      });
      card.dataset.orientation = layout.orientation;
      card.style.setProperty("--welcome-padding", `${layout.padding}px`);
      card.style.setProperty("--welcome-gap", `${layout.gap}px`);
      card.style.setProperty("--welcome-icon-size", `${layout.iconSize}px`);

      const applyFont = (titleSize) => {
        const subtitleRatio = safeSubtitle.length > 65 ? .25 : safeSubtitle.length > 35 ? .28 : .32;
        const minimumSubtitle = preview ? 5 : 7;
        card.style.setProperty("--welcome-title-size", `${titleSize}px`);
        card.style.setProperty("--welcome-subtitle-size", `${Math.max(minimumSubtitle, titleSize * subtitleRatio)}px`);
        card.style.setProperty("--welcome-copy-gap", `${clamp(titleSize * .18, preview ? 1 : 3, preview ? 6 : 18)}px`);
      };
      const fits = () => copy.scrollHeight <= copy.clientHeight + 1 && copy.scrollWidth <= copy.clientWidth + 1;

      let low = preview ? 5.5 : 8;
      let high = Math.max(low, layout.maximumTitle);
      let best = low;
      applyFont(low);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = (low + high) / 2;
        applyFont(candidate);
        if (fits()) {
          best = candidate;
          low = candidate;
        } else {
          high = candidate;
        }
      }
      applyFont(best);
    };

    const scheduleMeasure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(card);
    window.addEventListener("resize", scheduleMeasure);
    document.fonts?.ready?.then(scheduleMeasure).catch(() => {});
    scheduleMeasure();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [preview, safeSubtitle, safeTitle]);

  return <div ref={cardRef} data-orientation="vertical" className={`customer-welcome-card ${preview ? "customer-welcome-card--preview" : ""}`}>
    <span className="customer-welcome-card__icon" aria-hidden="true"><Monitor/></span>
    <div ref={copyRef} className="customer-welcome-card__copy">
      <p className="customer-welcome-card__title">{safeTitle}</p>
      {safeSubtitle && <p className="customer-welcome-card__subtitle">{safeSubtitle}</p>}
    </div>
  </div>;
}
