import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, CloudSun, Image as ImageIcon, Monitor, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { money } from "../../shared/domain";
import {
  DISPLAY_MODES, DISPLAY_SCHEDULE_DAYS, SOCIAL_PLATFORMS, normalizeDisplayConfig,
  normalizeDisplayPlacement, normalizeDisplaySchedule, socialDestination,
} from "./displayConfig";
import { subscribeCustomerDisplay } from "./customerDisplay";

export const fallbackCustomerDisplayState = {
  mode: "idle", businessName: "Kiosco+", welcomeMessage: "Bienvenido", thanksMessage: "¡Gracias por tu compra!",
  contactLine: "", items: [], promotions: [], featuredProducts: [], total: 0, connected: false,
};

function useClock(enabled = true) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

function usePromotion(promotions = [], seconds = 8, rotation = "ordered") {
  const [index, setIndex] = useState(0);
  const signature = promotions.map((promotion) => promotion.id).join("|");
  useEffect(() => { setIndex(0); }, [signature]);
  useEffect(() => {
    if (promotions.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((current) => {
      if (rotation !== "random") return (current + 1) % promotions.length;
      return (current + 1 + Math.floor(Math.random() * (promotions.length - 1))) % promotions.length;
    }), Math.max(4, Number(seconds) || 8) * 1000);
    return () => window.clearInterval(timer);
  }, [signature, seconds, rotation, promotions.length]);
  return promotions[index % Math.max(1, promotions.length)] || null;
}

function useQr(value) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    if (!value) { setSrc(""); return undefined; }
    QRCode.toDataURL(value, { width: 220, margin: 1, color: { dark: "#112d29", light: "#ffffff" } })
      .then((next) => active && setSrc(next)).catch(() => active && setSrc(""));
    return () => { active = false; };
  }, [value]);
  return src;
}

function useWeather(widget) {
  const [weather, setWeather] = useState(null);
  const city = String(widget?.city || "").trim();
  const latitude = widget?.latitude === null || widget?.latitude === "" || widget?.latitude === undefined ? Number.NaN : Number(widget.latitude);
  const longitude = widget?.longitude === null || widget?.longitude === "" || widget?.longitude === undefined ? Number.NaN : Number(widget.longitude);
  useEffect(() => {
    if (!city && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) { setWeather(null); return undefined; }
    let active = true;
    const cacheKey = `kiosco:display-weather:${city}:${latitude}:${longitude}`;
    try { const cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); if (cached?.savedAt > Date.now() - 1800000) setWeather(cached.value); } catch {}
    const load = async () => {
      let lat = latitude; let lon = longitude; let label = city;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const lookup = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`).then((response) => response.json());
        const result = lookup?.results?.[0];
        if (!result) throw new Error("Ciudad no encontrada");
        lat = result.latitude; lon = result.longitude; label = result.name;
      }
      const result = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`).then((response) => response.json());
      const value = { city: label, temperature: result?.current?.temperature_2m, max: result?.daily?.temperature_2m_max?.[0], min: result?.daily?.temperature_2m_min?.[0] };
      if (active) setWeather(value);
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value })); } catch {}
    };
    load().catch(() => {});
    return () => { active = false; };
  }, [city, latitude, longitude]);
  return weather;
}

function Brand({ state }) {
  return <header className="flex flex-none items-center justify-between gap-[clamp(1rem,2.5vmin,2rem)] border-b border-white/15 px-[clamp(1.25rem,3vw,3.5rem)] py-[clamp(.7rem,1.6vmin,1.25rem)]">
    <div className="flex min-w-0 items-center gap-[clamp(.75rem,1.8vmin,1.5rem)]">
      {state.businessImage
        ? <img src={state.businessImage} alt="" className="h-[clamp(3rem,6vmin,4.5rem)] w-[clamp(3rem,6vmin,4.5rem)] shrink-0 rounded-[clamp(.75rem,1.5vmin,1.25rem)] bg-white object-contain p-1.5"/>
        : <span className="grid h-[clamp(3rem,6vmin,4.5rem)] w-[clamp(3rem,6vmin,4.5rem)] shrink-0 place-items-center rounded-[clamp(.75rem,1.5vmin,1.25rem)] bg-white/10 font-serif text-[clamp(1.2rem,2.8vmin,2rem)] font-black">K+</span>}
      <div className="min-w-0"><p className="truncate text-[clamp(1.4rem,3.2vmin,3rem)] font-bold leading-tight">{state.businessName || "Kiosco+"}</p><p className="truncate text-[clamp(.75rem,1.45vmin,1.25rem)] text-emerald-100">{state.contactLine || "Tu compra, clara y a la vista"}</p></div>
    </div>
    <span className="shrink-0 rounded-full bg-white/10 px-[clamp(.75rem,1.5vw,1.5rem)] py-[clamp(.35rem,.8vmin,.75rem)] text-[clamp(.6rem,1.05vmin,.9rem)] font-bold uppercase tracking-widest">Pantalla del cliente</span>
  </header>;
}

function ClockWidget() {
  const now = useClock();
  return <div className="flex h-full w-full flex-col items-center justify-center px-[clamp(.75rem,1.8vmin,1.5rem)] py-[clamp(.6rem,1.4vmin,1.25rem)] text-center"><p className="flex items-center justify-center gap-2 text-[clamp(1.5rem,4vmin,3.75rem)] font-black"><Clock3 className="h-[clamp(1.25rem,3vmin,2.75rem)] w-[clamp(1.25rem,3vmin,2.75rem)]"/>{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-[clamp(.7rem,1.35vmin,1.15rem)] capitalize text-emerald-100">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p></div>;
}

function PromotionMini({ promotion }) {
  return <article className="flex h-full min-w-0 flex-1 items-center gap-[clamp(.65rem,1.4vmin,1.25rem)] rounded-[clamp(.9rem,2vmin,1.75rem)] bg-white/10 px-[clamp(.8rem,1.8vw,1.75rem)] py-[clamp(.65rem,1.35vmin,1.2rem)] text-white"><span className="shrink-0 rounded-full bg-amber-300 px-[clamp(.55rem,1vw,1rem)] py-[clamp(.25rem,.6vmin,.55rem)] text-[clamp(.6rem,1.05vmin,.9rem)] font-black uppercase text-amber-950">{promotion.badge || "PROMO"}</span><div className="min-w-0"><p className="truncate text-[clamp(.95rem,2vmin,1.65rem)] font-bold leading-tight">{promotion.title}</p>{promotion.description && <p className="truncate text-[clamp(.68rem,1.3vmin,1.1rem)] text-emerald-100">{promotion.description}</p>}</div></article>;
}

function PromotionsWidget({ state }) {
  const promotions = state.promotions || [];
  const rotating = usePromotion(promotions, state.slideSeconds, state.rotation);
  if (!promotions.length) return <div className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-white/25 px-4 py-[clamp(.7rem,1.3vmin,1.2rem)] text-center text-[clamp(.7rem,1.3vmin,1.1rem)] text-white/60">Las promociones activas aparecerán acá</div>;
  const visible = promotions.length <= 3 ? promotions : [rotating];
  return <div className="flex h-full w-full min-w-0 gap-2 overflow-hidden">{visible.filter(Boolean).map((promotion) => <PromotionMini key={promotion.id} promotion={promotion}/>)}</div>;
}

function WeatherWidget({ widget }) {
  const weather = useWeather(widget);
  return <div className="flex h-full w-full flex-col items-center justify-center rounded-[clamp(1rem,2.2vmin,2rem)] bg-white/10 p-[clamp(1rem,2.5vmin,2.25rem)] text-center"><CloudSun className="h-[clamp(2.25rem,5vmin,4.5rem)] w-[clamp(2.25rem,5vmin,4.5rem)] text-amber-300"/><p className="mt-[clamp(.5rem,1.2vmin,1rem)] text-[clamp(.7rem,1.35vmin,1.15rem)] font-bold uppercase tracking-wide text-emerald-100">{weather?.city || widget.city || "Elegí una ciudad"}</p>{weather && <><p className="mt-1 text-[clamp(2.25rem,6vmin,5.25rem)] font-black leading-none">{Math.round(weather.temperature)}°</p><p className="mt-1 text-[clamp(.68rem,1.25vmin,1.05rem)] text-emerald-100">Máx. {Math.round(weather.max)}° · Mín. {Math.round(weather.min)}°</p></>}</div>;
}

function SocialCard({ item }) {
  const platform = SOCIAL_PLATFORMS[item.platform] || SOCIAL_PLATFORMS.web;
  const qr = useQr(socialDestination(item));
  return <div className="flex h-full w-full flex-col items-center justify-center rounded-[clamp(1rem,2.2vmin,2rem)] p-[clamp(.85rem,2vmin,1.75rem)] text-center shadow-lg" style={{ background: item.platform === "instagram" ? "linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)" : platform.color, color: platform.foreground }}><p className="text-[clamp(.72rem,1.35vmin,1.15rem)] font-black uppercase tracking-wide">{item.label || platform.label}</p><p className="mt-1 break-all text-[clamp(.7rem,1.25vmin,1.05rem)] font-semibold">{item.value}</p>{qr && <img src={qr} alt={`QR de ${platform.label}`} className="mt-[clamp(.5rem,1.2vmin,1rem)] h-[clamp(4.5rem,10vmin,9rem)] w-[clamp(4.5rem,10vmin,9rem)] rounded-xl bg-white p-1.5"/>}</div>;
}

const scheduleMinutes = (value) => {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + minutes;
};

const scheduleTimeLabel = (value) => String(value || "").replace(/^0/, "");

function HoursWidget({ widget }) {
  const now = useClock();
  const schedule = normalizeDisplaySchedule(widget.schedule);
  const configured = schedule.some((entry) => entry.enabled);
  if (!configured) return <div className="flex h-full flex-col justify-center rounded-2xl bg-white/10 p-[clamp(1rem,2.5vmin,2.25rem)]"><p className="text-[clamp(.72rem,1.35vmin,1.15rem)] font-black uppercase tracking-wide text-amber-300">Horarios</p><p className="mt-2 whitespace-pre-line text-[clamp(.85rem,1.7vmin,1.4rem)]">{widget.text || "Configurá los horarios del negocio"}</p></div>;
  const todayDefinition = DISPLAY_SCHEDULE_DAYS.find((day) => day.jsDay === now.getDay());
  const today = schedule.find((entry) => entry.day === todayDefinition?.id);
  const current = (now.getHours() * 60) + now.getMinutes();
  const opens = scheduleMinutes(today?.open); const closes = scheduleMinutes(today?.close);
  const openNow = Boolean(today?.enabled) && (closes > opens ? current >= opens && current < closes : current >= opens || current < closes);
  return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white/10 p-[clamp(.8rem,2vmin,1.75rem)]">
    <div className="flex flex-none items-center justify-between gap-2"><p className="text-[clamp(.72rem,1.35vmin,1.15rem)] font-black uppercase tracking-wide text-amber-300">Horarios</p><span className={`rounded-full px-2 py-1 text-[clamp(.58rem,1.05vmin,.9rem)] font-black ${openNow ? "bg-emerald-300 text-emerald-950" : "bg-red-100 text-red-800"}`}>{openNow ? "Abierto ahora" : "Cerrado"}</span></div>
    <div className="mt-2 min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto">{DISPLAY_SCHEDULE_DAYS.map((day) => { const entry = schedule.find((item) => item.day === day.id); const isToday = day.jsDay === now.getDay(); return <div key={day.id} className={`grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-2 px-1 py-[clamp(.28rem,.65vmin,.55rem)] text-[clamp(.68rem,1.2vmin,1rem)] ${isToday ? "font-black text-amber-200" : "text-white/90"}`}><span>{day.label}</span><span className="text-right">{entry?.enabled ? `${scheduleTimeLabel(entry.open)}–${scheduleTimeLabel(entry.close)}` : "Cerrado"}</span></div>; })}</div>
  </div>;
}

function BasicWidget({ widget, state }) {
  const type = widget.type;
  if (type === "saleItems") return <SaleItemsWidget state={state}/>;
  if (type === "saleTotal") return <SaleTotalWidget state={state}/>;
  if (type === "salePayment") return <SalePaymentWidget state={state}/>;
  if (type === "clock") return <ClockWidget/>;
  if (type === "weather") return <WeatherWidget widget={widget}/>;
  if (type === "social") return <SocialCard item={widget}/>;
  if (type === "hours") return <HoursWidget widget={widget}/>;
  if (type === "payments") return <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-white/10 p-[clamp(1rem,2.5vmin,2.25rem)] text-center"><p className="text-[clamp(.72rem,1.35vmin,1.15rem)] font-black uppercase tracking-wide text-amber-300">Medios de pago</p><div className="mt-2 flex flex-wrap justify-center gap-[clamp(.35rem,.8vmin,.7rem)]">{(widget.items || []).map((item) => <span key={item} className="rounded-full bg-white px-[clamp(.55rem,1vw,1rem)] py-[clamp(.25rem,.55vmin,.5rem)] text-[clamp(.65rem,1.2vmin,1rem)] font-bold text-[#173F3A]">{item}</span>)}</div></div>;
  if (type === "notice") return <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-amber-300 p-[clamp(1rem,2.5vmin,2.25rem)] text-center text-amber-950"><p className="text-[clamp(1rem,2vmin,1.65rem)] font-black">{widget.title || "Aviso"}</p><p className="mt-1 text-[clamp(.8rem,1.6vmin,1.35rem)]">{widget.text || "Escribí un aviso para tus clientes"}</p></div>;
  if (type === "featuredProduct") { const product = (state.featuredProducts || []).find((item) => String(item.id) === String(widget.productId)) || state.featuredProducts?.[0]; return product ? <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-white p-[clamp(1rem,2.5vmin,2.25rem)] text-center text-[#173F3A]">{product.image && <img src={product.image} alt="" className="mb-2 h-[clamp(6rem,16vmin,14rem)] w-full rounded-xl object-contain"/>}<p className="text-[clamp(1rem,2vmin,1.65rem)] font-bold">{product.name}</p><p className="mt-1 text-[clamp(1.5rem,4vmin,3.5rem)] font-black">{money(product.price)}</p></div> : null; }
  if (type === "image") return widget.src ? <img src={widget.src} alt={widget.alt || "Publicidad"} className="h-full w-full rounded-2xl object-contain"/> : <div className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-white/25"><ImageIcon size={26}/></div>;
  if (type === "welcome") return <div className="grid h-full place-items-center px-[clamp(1rem,3vw,3rem)] text-center"><div><span className="mx-auto grid h-[clamp(4.5rem,10vmin,9rem)] w-[clamp(4.5rem,10vmin,9rem)] place-items-center rounded-full bg-white/10"><Monitor className="h-[clamp(2.25rem,5vmin,4.5rem)] w-[clamp(2.25rem,5vmin,4.5rem)]"/></span><h1 className="mt-[clamp(1rem,2.5vmin,2.25rem)] font-serif text-[clamp(3.5rem,10vmin,9rem)] font-bold leading-[.95]">{state.welcomeMessage || "Bienvenido"}</h1><p className="mx-auto mt-[clamp(.8rem,2vmin,1.75rem)] max-w-4xl text-[clamp(1rem,2.4vmin,2rem)] text-emerald-100">{state.contactLine || "Gracias por elegirnos"}</p></div></div>;
  if (type === "promotions") return <PromotionsWidget state={state}/>;
  return null;
}

function CanvasWidgetLayer({ state, config, mode }) {
  const placements = config.placements?.[mode] || {};
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{Object.entries(placements).sort(([, a], [, b]) => a.z - b.z).map(([id, rawPlacement]) => {
    const widget = config.widgets[id];
    if (!widget || widget.enabled === false) return null;
    const placement = normalizeDisplayPlacement(rawPlacement);
    return <div key={id} className="absolute overflow-hidden p-[clamp(.18rem,.45vmin,.4rem)] [&>*]:h-full [&>*]:w-full" style={{ left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, height: `${placement.height}%`, zIndex: placement.z }}><BasicWidget widget={widget} state={state}/></div>;
  })}</div>;
}

function Idle({ state, config }) {
  return <div className="relative min-h-0 flex-1 overflow-hidden"><CanvasWidgetLayer state={state} config={config} mode="idle"/></div>;
}

function SaleItemsWidget({ state }) {
  const listRef = useRef(null);
  useEffect(() => { const list = listRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }); }, [state.items?.length]);
  return <section className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[clamp(.7rem,2vmin,2.5rem)] bg-white text-gray-900 shadow-2xl"><div className="flex-none border-b px-[clamp(.65rem,1.6vw,2.75rem)] py-[clamp(.4rem,1vmin,1.3rem)]"><h1 className="text-[clamp(.8rem,2.2vmin,2.5rem)] font-bold">Tu compra</h1><p className="text-[clamp(.55rem,1.05vmin,1.05rem)] text-gray-500">{state.items.length} producto{state.items.length === 1 ? "" : "s"}</p></div><div ref={listRef} className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">{state.items.map((item, index) => { const hasPromotion = Number(item.promotion?.discount) > 0; return <div key={`${item.id}-${index}`} className={`grid gap-1 px-[clamp(.65rem,1.6vw,2.75rem)] py-[clamp(.4rem,1vmin,1.15rem)] sm:grid-cols-[minmax(0,1fr)_auto] ${index === state.items.length - 1 ? "bg-amber-50" : ""}`}><div className="min-w-0"><p className="truncate text-[clamp(.7rem,1.55vmin,1.65rem)] font-semibold">{item.name}</p><p className="text-[clamp(.55rem,1vmin,1.1rem)] text-gray-500">{item.quantityLabel || item.quantity}{state.showUnitPrices !== false ? ` × ${money(item.unitPrice)}` : ""}</p>{hasPromotion && <div className="mt-1 flex flex-wrap items-center gap-[clamp(.2rem,.45vmin,.5rem)]"><span className="rounded-full bg-violet-100 px-[clamp(.3rem,.6vw,.8rem)] py-0.5 text-[clamp(.5rem,.85vmin,.9rem)] font-black uppercase text-violet-800">{item.promotion.badge || "PROMO"}</span><span className="min-w-0 truncate text-[clamp(.5rem,.9vmin,1rem)] font-semibold text-violet-700">{item.promotion.name}</span><span className="text-[clamp(.5rem,.9vmin,1rem)] font-bold text-emerald-700">Ahorrás {money(item.promotion.discount)}</span></div>}</div><div className="text-left sm:text-right">{hasPromotion && <p className="text-[clamp(.5rem,.9vmin,1rem)] text-gray-400 line-through">{money(item.subtotal)}</p>}<p className="text-[clamp(.75rem,1.75vmin,2rem)] font-bold">{money(hasPromotion ? item.finalSubtotal : item.subtotal)}</p></div></div>; })}</div></section>;
}

function SaleTotalWidget({ state }) {
  const discountLines = Array.isArray(state.discountLines) ? state.discountLines.filter((line) => Number(line.amount) > 0) : [];
  return <section className="flex h-full w-full min-h-0 flex-col items-center justify-center overflow-y-auto rounded-[clamp(.7rem,2vmin,2.5rem)] bg-[#F6F1E7] p-[clamp(.55rem,1.4vmin,1.75rem)] text-center text-[#173F3A] shadow-2xl"><div className="w-full space-y-1 text-[clamp(.55rem,1.05vmin,1.1rem)]">{Number(state.discount || 0) > 0 && <><div className="flex justify-between gap-3"><span>Subtotal</span><b>{money(state.subtotal)}</b></div>{discountLines.map((line, index) => <div key={`${line.kind}-${line.label}-${index}`} className={`flex justify-between gap-3 ${line.kind === "manual" ? "text-blue-700" : "text-emerald-700"}`}><span className="min-w-0 truncate">{line.kind === "manual" ? "Descuento manual" : line.label}</span><b className="shrink-0">-{money(line.amount)}</b></div>)}</>}</div><div className="mt-1 w-full border-t border-[#173F3A]/20 pt-[clamp(.35rem,.8vmin,1rem)]"><p className="text-[clamp(.55rem,1vmin,1.1rem)] font-bold uppercase tracking-[.14em] text-[#B95125]">Total a pagar</p><p className="truncate font-serif text-[clamp(1.4rem,4.5vmin,6rem)] font-black leading-tight">{money(state.total)}</p>{Number(state.discount || 0) > 0 && <p className="rounded-lg bg-emerald-100 px-2 py-1 text-[clamp(.5rem,.9vmin,1.1rem)] font-black text-emerald-800">Ahorraste {money(state.discount)}</p>}</div></section>;
}

function SalePaymentWidget({ state }) {
  const payment = state.payment || null;
  const showQr = ["Mercado Pago", "Transferencia"].includes(payment?.method) && state.paymentQrImage;
  return <section className="flex h-full w-full min-h-0 flex-col items-center justify-center overflow-y-auto rounded-[clamp(.7rem,2vmin,2.5rem)] bg-white p-[clamp(.5rem,1.2vmin,1.25rem)] text-center text-[#173F3A] shadow-2xl">{payment ? <><p className="text-[clamp(.5rem,.9vmin,1rem)] font-semibold text-gray-500">Medio elegido</p><p className="text-[clamp(.8rem,2vmin,2.5rem)] font-bold">{payment.method}</p>{payment.method === "Efectivo" && state.showChange !== false && <div className="mt-1 grid w-full grid-cols-2 gap-2 border-t pt-1 text-left"><div><span className="text-[clamp(.5rem,.85vmin,.95rem)] text-gray-500">Recibido</span><b className="block text-[clamp(.65rem,1.25vmin,1.4rem)]">{money(payment.received || 0)}</b></div><div><span className="text-[clamp(.5rem,.85vmin,.95rem)] text-gray-500">Vuelto</span><b className="block text-[clamp(.65rem,1.25vmin,1.4rem)] text-emerald-700">{money(Math.max(0, payment.change || 0))}</b></div></div>}{showQr && <div className="mt-1 min-h-0"><img src={state.paymentQrImage} alt="Código QR para pagar" className="mx-auto aspect-square max-h-[min(20vh,12rem)] max-w-full rounded-xl border object-contain p-1"/><p className="text-[clamp(.48rem,.8vmin,.9rem)] font-semibold text-gray-500">Escaneá el QR y mostrá el comprobante.</p></div>}</> : <p className="text-[clamp(.6rem,1.1vmin,1rem)] font-semibold text-gray-500">Esperando el medio de pago</p>}<p className="mt-auto flex-none pt-1 text-[clamp(.48rem,.8vmin,.85rem)] text-[#173F3A]/60">El pago se confirma en la caja.</p></section>;
}

function Sale({ state, config }) { return <div className="relative min-h-0 flex-1 overflow-hidden"><CanvasWidgetLayer state={state} config={config} mode="sale"/></div>; }

function Complete({ state, config }) {
  return <div className="relative min-h-0 flex-1 overflow-hidden"><div className="absolute inset-x-[4%] bottom-[20%] top-[17%] grid place-items-center overflow-y-auto px-[clamp(1.5rem,4vw,4rem)] py-[clamp(1rem,2.5vmin,2.5rem)] text-center"><div><span className="mx-auto grid h-[clamp(5rem,11vmin,10rem)] w-[clamp(5rem,11vmin,10rem)] place-items-center rounded-full bg-emerald-400 text-emerald-950"><CheckCircle2 className="h-[clamp(2.75rem,6vmin,5.5rem)] w-[clamp(2.75rem,6vmin,5.5rem)]"/></span><h1 className="mt-[clamp(1rem,2.5vmin,2.25rem)] font-serif text-[clamp(3.25rem,9vmin,8rem)] font-black leading-none">{state.thanksMessage || "¡Gracias por tu compra!"}</h1><p className="mt-[clamp(.8rem,2vmin,1.75rem)] text-[clamp(1.25rem,3vmin,2.75rem)] text-emerald-100">Total: <b className="text-white">{money(state.total)}</b></p>{Number(state.discount || 0) > 0 && <p className="mt-1 text-[clamp(1rem,2.2vmin,2rem)] font-bold text-amber-300">Ahorraste {money(state.discount)}</p>}</div></div><CanvasWidgetLayer state={state} config={config} mode="complete"/></div>;
}

export function CustomerDisplayCanvas({ state }) {
  const config = useMemo(() => normalizeDisplayConfig(state.displayConfig), [state.displayConfig]);
  let mode = state.mode;
  if (config.operationMode === DISPLAY_MODES.adsOnly) mode = "idle";
  if (config.operationMode === DISPLAY_MODES.saleOnly && mode === "idle") return <div className="grid min-h-0 flex-1 place-items-center text-center"><div><Monitor className="mx-auto text-emerald-200" size={40}/><p className="mt-3 text-xl font-black">Esperando la próxima venta</p></div></div>;
  if (mode === "complete") return <Complete state={state} config={config}/>;
  if (mode === "sale" && state.items?.length) return <Sale state={state} config={config}/>;
  return <Idle state={state} config={config}/>;
}

export function CustomerDisplayScreen({ channelId }) {
  const [state, setState] = useState(fallbackCustomerDisplayState);
  useEffect(() => subscribeCustomerDisplay(channelId, (next) => next && setState({ ...fallbackCustomerDisplayState, ...next, connected: true })), [channelId]);
  return <main className="flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-[#16433D] text-white"><Brand state={state}/>{state.connected ? <CustomerDisplayCanvas state={state}/> : <div className="grid min-h-0 flex-1 place-items-center text-center"><div><WifiOff className="mx-auto text-amber-300" size={42}/><h1 className="mt-4 text-2xl font-bold">Esperando a la caja</h1><p className="mt-2 text-emerald-100">Dejá esta pantalla abierta. Se conectará automáticamente.</p></div></div>}</main>;
}
