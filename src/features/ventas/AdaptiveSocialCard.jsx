import React, { useLayoutEffect, useRef } from "react";
import { SOCIAL_PLATFORMS } from "./displayConfig";
import { calculateAdaptiveSocialLayout } from "./adaptiveSocialLayout";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function AdaptiveSocialCard({ item, qrSrc = "", preview = false }) {
  const cardRef = useRef(null);
  const textRef = useRef(null);
  const platform = SOCIAL_PLATFORMS[item.platform] || SOCIAL_PLATFORMS.web;
  const label = String(item.label || platform.label || "Contacto").trim();
  const value = String(item.value || (preview ? "Completá el dato" : "")).trim();
  const hasQr = Boolean(qrSrc || preview);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const text = textRef.current;
    if (!card || !text) return undefined;
    let frame = 0;

    const measure = () => {
      const { width, height } = card.getBoundingClientRect();
      if (width < 12 || height < 12) return;

      const contentLength = Array.from(`${label} ${value}`.trim()).length;
      const wordCount = `${label} ${value}`.trim().split(/\s+/).filter(Boolean).length;
      const { orientation, padding, gap, qrSize, maximumTitle } = calculateAdaptiveSocialLayout({ width, height, contentLength, wordCount, hasQr, preview });

      card.dataset.orientation = orientation;
      card.style.setProperty("--social-padding", `${padding}px`);
      card.style.setProperty("--social-gap", `${gap}px`);
      card.style.setProperty("--social-qr-size", `${qrSize}px`);

      const applyFont = (titleSize) => {
        const valueRatio = value.length > 30 ? .68 : .76;
        card.style.setProperty("--social-title-size", `${titleSize}px`);
        card.style.setProperty("--social-value-size", `${Math.max(5.5, titleSize * valueRatio)}px`);
        card.style.setProperty("--social-copy-gap", `${clamp(titleSize * .22, 1, 5)}px`);
      };
      const fits = () => text.scrollHeight <= text.clientHeight + 1 && text.scrollWidth <= text.clientWidth + 1;

      let low = 5.5;
      let high = maximumTitle;
      let best = low;
      applyFont(low);
      for (let attempt = 0; attempt < 11; attempt += 1) {
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
  }, [hasQr, label, preview, value]);

  return <div ref={cardRef} data-orientation="vertical" className={`customer-social-card ${preview ? "rounded-md" : "rounded-[clamp(1rem,2.2vmin,2rem)] shadow-lg"}`} style={{ background: item.platform === "instagram" ? "linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)" : platform.color, color: platform.foreground }}>
    <div ref={textRef} className="customer-social-card__text">
      <p className="customer-social-card__title">{label}</p>
      {value && <p className="customer-social-card__value">{value}</p>}
    </div>
    {hasQr && (qrSrc
      ? <img src={qrSrc} alt={`QR de ${platform.label}`} className="customer-social-card__qr"/>
      : <span aria-hidden="true" className="customer-social-card__qr grid place-items-center font-black text-emerald-950">QR</span>)}
  </div>;
}
