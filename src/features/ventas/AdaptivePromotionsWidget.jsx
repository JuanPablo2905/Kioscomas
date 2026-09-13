import React, { useEffect, useMemo, useState } from "react";
import { BadgePercent } from "lucide-react";
import { useWidgetSize } from "./useWidgetSize";

const bounded = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const stableHash = (value) => Array.from(String(value || "")).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);

function selectedPromotions(widget, promotions) {
  const all = Array.isArray(promotions) ? promotions.filter(Boolean) : [];
  const selected = Array.isArray(widget?.promotionIds) ? widget.promotionIds.map(String) : [];
  if (widget?.promotionSource !== "manual") return all;
  if (!selected.length) return [];
  const byId = new Map(all.map((promotion) => [String(promotion.id), promotion]));
  return selected.map((id) => byId.get(id)).filter(Boolean);
}

function layoutFor(size, forcedVisible) {
  const { width, height } = size;
  const ratio = width / Math.max(1, height);
  const orientation = ratio >= 1.35 ? "horizontal" : ratio <= 0.78 ? "vertical" : "grid";
  if (Number(forcedVisible) > 0) return { orientation, capacity: bounded(Math.round(Number(forcedVisible)), 1, 6) };
  if (!width || !height) return { orientation, capacity: 1 };
  if (orientation === "horizontal") return { orientation, capacity: bounded(Math.floor(width / Math.max(155, height * 1.55)), 1, 6) };
  if (orientation === "vertical") return { orientation, capacity: bounded(Math.floor(height / Math.max(88, width * 0.58)), 1, 6) };
  return { orientation, capacity: width >= 300 && height >= 210 ? 4 : width >= 180 && height >= 130 ? 2 : 1 };
}

function PromotionCard({ promotion, detailed, compact }) {
  return <article className={`adaptive-promotion-card ${compact ? "is-compact" : ""} ${detailed ? "is-detailed" : ""}`}>
    {promotion.image && !compact && <img src={promotion.image} alt=""/>}
    <div className="adaptive-promotion-card__copy">
      <span className="adaptive-promotion-card__badge"><BadgePercent aria-hidden="true"/>{promotion.badge || "PROMO"}</span>
      <strong>{promotion.title || "Promoción"}</strong>
      {promotion.description && <p>{promotion.description}</p>}
      {detailed && promotion.productNames?.length > 0 && <small>{promotion.productNames.join(" · ")}</small>}
    </div>
  </article>;
}

export function AdaptivePromotionsWidget({ widget = {}, promotions = [], seconds = 8, rotation = "ordered", sequenceOffset = 0, preview = false }) {
  const [ref, size] = useWidgetSize();
  const candidates = useMemo(() => selectedPromotions(widget, promotions), [widget.promotionSource, JSON.stringify(widget.promotionIds || []), promotions]);
  const { orientation, capacity } = layoutFor(size, widget.visibleCount);
  const requestedMotion = widget.motion || "auto";
  const motion = requestedMotion === "auto" ? (orientation === "vertical" ? "vertical" : orientation === "horizontal" ? "horizontal" : "fade") : requestedMotion;
  const direction = widget.direction === "reverse" ? -1 : 1;
  const interval = bounded(Number(widget.intervalSeconds || seconds) || 8, 4, 60);
  const [page, setPage] = useState(0);
  const signature = candidates.map((promotion) => promotion.id).join("|");
  const pageCount = Math.max(1, Math.ceil(candidates.length / capacity));

  useEffect(() => { setPage(0); }, [signature, capacity]);
  useEffect(() => {
    if (preview || motion === "none" || pageCount < 2) return undefined;
    const timer = window.setInterval(() => setPage((current) => {
      if (rotation === "random") {
        const jump = 1 + Math.floor(Math.random() * Math.max(1, pageCount - 1));
        return (current + jump) % pageCount;
      }
      return (current + 1) % pageCount;
    }), interval * 1000);
    return () => window.clearInterval(timer);
  }, [preview, motion, pageCount, interval, rotation]);

  const visible = useMemo(() => {
    if (!candidates.length) return [];
    const baseOffset = stableHash(widget.id) + Math.max(0, Number(sequenceOffset) || 0);
    const first = ((page * capacity * direction) + baseOffset) % candidates.length;
    return Array.from({ length: Math.min(capacity, candidates.length) }, (_, index) => candidates[(first + index * direction + candidates.length) % candidates.length]);
  }, [candidates, page, capacity, direction, sequenceOffset, widget.id]);

  const compact = size.height > 0 && size.height < 92;
  const detailed = !compact && capacity === 1 && size.width >= 250 && size.height >= 150;
  const animationClass = pageCount > 1 && motion !== "none" ? `promo-motion-${motion}` : "";
  const layoutClass = orientation === "vertical" ? "is-vertical" : orientation === "grid" ? "is-grid" : "is-horizontal";

  return <div ref={ref} className={`adaptive-promotions-widget ${layoutClass}`}>
    {!visible.length
      ? <div className="adaptive-promotions-widget__empty">Las promociones elegidas aparecerán acá</div>
      : <div key={`${page}-${capacity}-${motion}`} className={`adaptive-promotions-widget__track ${animationClass}`}>
        {visible.map((promotion, index) => <PromotionCard key={`${promotion.id}-${index}`} promotion={promotion} compact={compact} detailed={detailed}/>)}
      </div>}
  </div>;
}
