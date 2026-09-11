import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, CloudSun, Image as ImageIcon, Monitor, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { money } from "../../shared/domain";
import { DISPLAY_MODES, SOCIAL_PLATFORMS, normalizeDisplayConfig, socialDestination } from "./displayConfig";
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
  return <header className="flex flex-none items-center justify-between gap-4 border-b border-white/15 px-5 py-2.5 sm:px-8">
    <div className="flex min-w-0 items-center gap-3">
      {state.businessImage
        ? <img src={state.businessImage} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1"/>
        : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 font-serif text-lg font-black">K+</span>}
      <div className="min-w-0"><p className="truncate text-lg font-bold sm:text-2xl">{state.businessName || "Kiosco+"}</p><p className="truncate text-[11px] text-emerald-100">{state.contactLine || "Tu compra, clara y a la vista"}</p></div>
    </div>
    <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest">Pantalla del cliente</span>
  </header>;
}

function ClockWidget() {
  const now = useClock();
  return <div className="px-3 py-2 text-center"><p className="flex items-center justify-center gap-2 text-xl font-black sm:text-2xl"><Clock3 size={19}/>{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-[10px] capitalize text-emerald-100">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p></div>;
}

function PromotionMini({ promotion }) {
  return <article className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/10 px-4 py-2 text-white"><span className="shrink-0 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase text-amber-950">{promotion.badge || "PROMO"}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{promotion.title}</p>{promotion.description && <p className="truncate text-[10px] text-emerald-100">{promotion.description}</p>}</div></article>;
}

function PromotionsWidget({ state }) {
  const promotions = state.promotions || [];
  const rotating = usePromotion(promotions, state.slideSeconds, state.rotation);
  if (!promotions.length) return <div className="rounded-2xl border border-dashed border-white/25 px-4 py-2 text-center text-[10px] text-white/60">Las promociones activas aparecerán acá</div>;
  const visible = promotions.length <= 3 ? promotions : [rotating];
  return <div className="flex min-w-0 gap-2 overflow-hidden">{visible.filter(Boolean).map((promotion) => <PromotionMini key={promotion.id} promotion={promotion}/>)}</div>;
}

function WeatherWidget({ widget }) {
  const weather = useWeather(widget);
  return <div className="rounded-2xl bg-white/10 p-4 text-center"><CloudSun className="mx-auto text-amber-300" size={28}/><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-100">{weather?.city || widget.city || "Elegí una ciudad"}</p>{weather && <><p className="mt-1 text-3xl font-black">{Math.round(weather.temperature)}°</p><p className="text-[10px] text-emerald-100">Máx. {Math.round(weather.max)}° · Mín. {Math.round(weather.min)}°</p></>}</div>;
}

function SocialCard({ item }) {
  const platform = SOCIAL_PLATFORMS[item.platform] || SOCIAL_PLATFORMS.web;
  const qr = useQr(socialDestination(item));
  return <div className="rounded-2xl p-3 text-center shadow-lg" style={{ background: item.platform === "instagram" ? "linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)" : platform.color, color: platform.foreground }}><p className="text-[10px] font-black uppercase tracking-wide">{item.label || platform.label}</p><p className="mt-1 break-all text-[10px] font-semibold">{item.value}</p>{qr && <img src={qr} alt={`QR de ${platform.label}`} className="mx-auto mt-2 h-16 w-16 rounded-lg bg-white p-1"/>}</div>;
}

function SocialsWidget({ widget }) {
  const items = Array.isArray(widget.items) ? widget.items.filter((item) => item?.value).slice(0, 4) : [];
  if (!items.length) return <div className="rounded-2xl border border-dashed border-white/25 p-4 text-center text-[10px] text-white/60">Agregá WhatsApp, Instagram o tu web</div>;
  return <div className="grid gap-2">{items.map((item, index) => <SocialCard key={`${item.platform}-${index}`} item={item}/>)}</div>;
}

function BasicWidget({ widget, state }) {
  const type = widget.type;
  if (type === "clock") return <ClockWidget/>;
  if (type === "weather") return <WeatherWidget widget={widget}/>;
  if (type === "socials") return <SocialsWidget widget={widget}/>;
  if (type === "hours") return <div className="rounded-2xl bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-amber-300">Horarios</p><p className="mt-2 whitespace-pre-line text-xs">{widget.text || "Configurá los horarios del negocio"}</p></div>;
  if (type === "payments") return <div className="rounded-2xl bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-amber-300">Medios de pago</p><div className="mt-2 flex flex-wrap gap-1.5">{(widget.items || []).map((item) => <span key={item} className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#173F3A]">{item}</span>)}</div></div>;
  if (type === "notice") return <div className="rounded-2xl bg-amber-300 p-4 text-amber-950"><p className="font-black">{widget.title || "Aviso"}</p><p className="mt-1 text-xs">{widget.text || "Escribí un aviso para tus clientes"}</p></div>;
  if (type === "featuredProduct") { const product = (state.featuredProducts || []).find((item) => String(item.id) === String(widget.productId)) || state.featuredProducts?.[0]; return product ? <div className="rounded-2xl bg-white p-4 text-[#173F3A]">{product.image && <img src={product.image} alt="" className="mb-2 h-20 w-full rounded-xl object-contain"/>}<p className="font-bold">{product.name}</p><p className="mt-1 text-xl font-black">{money(product.price)}</p></div> : null; }
  if (type === "image") return widget.src ? <img src={widget.src} alt={widget.alt || "Publicidad"} className="max-h-full w-full rounded-2xl object-contain"/> : <div className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-white/25"><ImageIcon size={26}/></div>;
  if (type === "welcome") return <div className="grid h-full place-items-center px-4 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10"><Monitor size={28}/></span><h1 className="mt-4 font-serif text-4xl font-bold sm:text-6xl">{state.welcomeMessage || "Bienvenido"}</h1><p className="mx-auto mt-3 max-w-2xl text-sm text-emerald-100 sm:text-lg">{state.contactLine || "Gracias por elegirnos"}</p></div></div>;
  if (type === "promotions") return <PromotionsWidget state={state}/>;
  return null;
}

function Zone({ state, config, mode, zone, horizontal = false }) {
  const ids = config.layouts?.[mode]?.[zone] || [];
  const visible = ids.map((id) => config.widgets[id]).filter((item) => item?.enabled !== false);
  if (!visible.length) return null;
  return <div className={horizontal ? "flex-none px-3 py-1.5" : "min-h-0 overflow-hidden p-1.5"}><div className={horizontal ? "flex min-w-0 gap-2" : "grid max-h-full gap-2 overflow-y-auto"}>{visible.map((item) => <div key={item.id} className="min-w-0 flex-1"><BasicWidget widget={item} state={state}/></div>)}</div></div>;
}

function Idle({ state, config }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Zone state={state} config={config} mode="idle" zone="top" horizontal/><div className="grid min-h-0 flex-1 grid-cols-[minmax(0,22%)_minmax(0,1fr)_minmax(0,22%)] overflow-hidden px-2"><aside className="min-h-0"><Zone state={state} config={config} mode="idle" zone="left"/></aside><section className="min-h-0"><Zone state={state} config={config} mode="idle" zone="center"/></section><aside className="min-h-0"><Zone state={state} config={config} mode="idle" zone="right"/></aside></div><Zone state={state} config={config} mode="idle" zone="bottom" horizontal/></div>;
}

function SaleCore({ state }) {
  const listRef = useRef(null);
  const payment = state.payment || null;
  const showQr = ["Mercado Pago", "Transferencia"].includes(payment?.method) && state.paymentQrImage;
  const discountLines = Array.isArray(state.discountLines) ? state.discountLines.filter((line) => Number(line.amount) > 0) : [];
  useEffect(() => { const list = listRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }); }, [state.items?.length]);
  return <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 py-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,36%)]">
    <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white text-gray-900 shadow-2xl"><div className="flex-none border-b px-5 py-2"><h1 className="text-lg font-bold">Tu compra</h1><p className="text-[10px] text-gray-500">{state.items.length} producto{state.items.length === 1 ? "" : "s"}</p></div><div ref={listRef} className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">{state.items.map((item, index) => { const hasPromotion = Number(item.promotion?.discount) > 0; return <div key={`${item.id}-${index}`} className={`grid gap-1 px-5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] ${index === state.items.length - 1 ? "bg-amber-50" : ""}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-[10px] text-gray-500">{item.quantityLabel || item.quantity}{state.showUnitPrices !== false ? ` × ${money(item.unitPrice)}` : ""}</p>{hasPromotion && <div className="mt-1 flex flex-wrap items-center gap-1"><span className="rounded-full bg-violet-100 px-2 py-0.5 text-[8px] font-black uppercase text-violet-800">{item.promotion.badge || "PROMO"}</span><span className="max-w-48 truncate text-[9px] font-semibold text-violet-700">{item.promotion.name}</span><span className="text-[9px] font-bold text-emerald-700">Ahorrás {money(item.promotion.discount)}</span></div>}</div><div className="text-left sm:text-right">{hasPromotion && <p className="text-[10px] text-gray-400 line-through">{money(item.subtotal)}</p>}<p className="text-base font-bold">{money(hasPromotion ? item.finalSubtotal : item.subtotal)}</p></div></div>; })}</div></section>
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-[#F6F1E7] p-3 text-[#173F3A] shadow-2xl"><div className="flex-none space-y-1 text-xs">{Number(state.discount || 0) > 0 && <><div className="flex justify-between gap-3"><span>Subtotal</span><b>{money(state.subtotal)}</b></div>{discountLines.map((line, index) => <div key={`${line.kind}-${line.label}-${index}`} className={`flex justify-between gap-3 ${line.kind === "manual" ? "text-blue-700" : "text-emerald-700"}`}><span className="min-w-0 truncate">{line.kind === "manual" ? "Descuento manual" : line.label}</span><b className="shrink-0">-{money(line.amount)}</b></div>)}</>}</div><div className="flex-none border-t border-[#173F3A]/20 pt-2"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B95125]">Total a pagar</p><p className="truncate font-serif text-3xl font-black sm:text-5xl">{money(state.total)}</p>{Number(state.discount || 0) > 0 && <p className="rounded-lg bg-emerald-100 px-2 py-1 text-center text-[10px] font-black text-emerald-800">Ahorraste {money(state.discount)}</p>}</div>{payment && <div className="mt-1 min-h-0 overflow-y-auto rounded-2xl bg-white p-2 text-center"><p className="text-[9px] font-semibold text-gray-500">Medio elegido</p><p className="text-lg font-bold">{payment.method}</p>{payment.method === "Efectivo" && state.showChange !== false && <div className="mt-1 grid grid-cols-2 gap-2 border-t pt-1 text-left"><div><span className="text-[9px] text-gray-500">Recibido</span><b className="block text-sm">{money(payment.received || 0)}</b></div><div><span className="text-[9px] text-gray-500">Vuelto</span><b className="block text-sm text-emerald-700">{money(Math.max(0, payment.change || 0))}</b></div></div>}{showQr && <div className="mt-1"><img src={state.paymentQrImage} alt="Código QR para pagar" className="mx-auto aspect-square max-h-[min(22vh,10rem)] max-w-full rounded-xl border object-contain p-1"/><p className="text-[9px] font-semibold text-gray-500">Escaneá el QR y mostrá el comprobante.</p></div>}</div>}<p className="mt-auto flex-none pt-1 text-center text-[9px] text-[#173F3A]/60">El pago se confirma en la caja.</p></aside>
  </div>;
}

function Sale({ state, config }) { return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Zone state={state} config={config} mode="sale" zone="top" horizontal/><SaleCore state={state}/><Zone state={state} config={config} mode="sale" zone="bottom" horizontal/></div>; }

function Complete({ state, config }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Zone state={state} config={config} mode="complete" zone="top" horizontal/><div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-6 py-4 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400 text-emerald-950"><CheckCircle2 size={38}/></span><h1 className="mt-4 font-serif text-4xl font-black sm:text-6xl">{state.thanksMessage || "¡Gracias por tu compra!"}</h1><p className="mt-3 text-lg text-emerald-100">Total: <b className="text-white">{money(state.total)}</b></p>{Number(state.discount || 0) > 0 && <p className="mt-1 font-bold text-amber-300">Ahorraste {money(state.discount)}</p>}</div></div><Zone state={state} config={config} mode="complete" zone="bottom" horizontal/></div>;
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
