import React, { useEffect, useMemo, useState } from "react";
import { BadgePercent, CheckCircle2, Clock3, Monitor, Sparkles, WifiOff } from "lucide-react";
import { money } from "../../shared/domain";
import { subscribeCustomerDisplay } from "./customerDisplay";

const fallbackState = {
  mode: "idle",
  businessName: "Kiosco+",
  welcomeMessage: "Bienvenido",
  thanksMessage: "¡Gracias por tu compra!",
  contactLine: "",
  items: [],
  promotions: [],
  total: 0,
  connected: false,
};

function useClock(enabled) {
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
      const offset = 1 + Math.floor(Math.random() * (promotions.length - 1));
      return (current + offset) % promotions.length;
    }), Math.max(4, Number(seconds) || 8) * 1000);
    return () => window.clearInterval(timer);
  }, [signature, seconds, rotation, promotions.length]);
  return promotions[index % Math.max(1, promotions.length)] || null;
}

function Brand({ state }) {
  const now = useClock(state.showClock !== false);
  return <header className="flex items-center justify-between gap-5 border-b border-white/15 px-6 py-4 sm:px-10 sm:py-5"><div className="flex min-w-0 items-center gap-4">{state.businessImage ? <img src={state.businessImage} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1 sm:h-14 sm:w-14"/> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 font-serif text-xl font-black sm:h-14 sm:w-14 sm:text-2xl">K+</span>}<div className="min-w-0"><p className="truncate text-xl font-bold sm:text-3xl">{state.businessName || "Kiosco+"}</p><p className="truncate text-xs text-emerald-100 sm:text-sm">{state.contactLine || "Tu compra, clara y a la vista"}</p></div></div>{state.showClock !== false ? <div className="shrink-0 text-right"><p className="flex items-center justify-end gap-2 text-xl font-black sm:text-3xl"><Clock3 size={20}/>{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p><p className="hidden text-xs capitalize text-emerald-100 sm:block">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p></div> : <span className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-semibold sm:inline">Pantalla del cliente</span>}</header>;
}

function PromotionCard({ promotion, compact = false }) {
  if (!promotion) return null;
  return <article className={`${compact ? "flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3" : `grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white text-[#173F3A] shadow-2xl ${promotion.image ? "lg:grid-cols-[44%_1fr]" : ""}`}`}>
    {!compact && promotion.image && <img src={promotion.image} alt="" className="h-52 w-full object-cover lg:h-full lg:min-h-[360px]"/>}
    <div className={compact ? "min-w-0" : "flex min-h-[300px] flex-col justify-center p-7 text-left sm:p-10 lg:p-14"}>
      <span className={`${compact ? "bg-amber-300 text-amber-950" : "w-fit bg-[#D96B32] text-white"} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide`}><BadgePercent size={14}/>{promotion.badge || "PROMO"}</span>
      <h2 className={`${compact ? "mt-1 truncate text-sm font-bold text-white" : "mt-5 font-serif text-4xl font-black sm:text-6xl"}`}>{promotion.title}</h2>
      {!compact && <><p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#315B55] sm:text-2xl">{promotion.description}</p>{promotion.productNames?.length > 0 && <p className="mt-6 text-sm font-semibold text-[#315B55]">{promotion.productNames.join(" · ")}</p>}<p className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-[#B95125]"><Sparkles size={18}/>Promoción vigente</p></>}
    </div>
  </article>;
}

function Idle({ state }) {
  const promotion = usePromotion(state.promotions || [], state.slideSeconds, state.rotation);
  if (promotion) return <div className="flex flex-1 items-center justify-center p-5 sm:p-8"><PromotionCard promotion={promotion}/></div>;
  return <div className="grid flex-1 place-items-center px-6 py-12 text-center"><div><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10"><Monitor size={38}/></span><h1 className="mt-6 font-serif text-4xl font-bold sm:text-6xl">{state.welcomeMessage || "Bienvenido"}</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-100">Cuando comience la venta vas a ver acá cada producto, sus promociones y el total.</p>{state.contactLine && <p className="mt-7 text-sm font-semibold text-white/80">{state.contactLine}</p>}</div></div>;
}

function Sale({ state }) {
  const payment = state.payment || null;
  const showQr = ["Mercado Pago", "Transferencia"].includes(payment?.method) && state.paymentQrImage;
  const bannerPromotion = usePromotion(state.promotions || [], state.slideSeconds, state.rotation);
  const discountLines = Array.isArray(state.discountLines) ? state.discountLines.filter((line) => Number(line.amount) > 0) : [];
  return <div className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(310px,38%)] lg:p-8"><section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white text-gray-900 shadow-2xl"><div className="border-b px-5 py-4 sm:px-7"><h1 className="text-xl font-bold">Tu compra</h1><p className="text-sm text-gray-500">{state.items.length} producto{state.items.length === 1 ? "" : "s"}</p></div><div className="min-h-0 flex-1 divide-y overflow-y-auto">{state.items.map((item, index) => { const hasPromotion = Number(item.promotion?.discount) > 0; return <div key={`${item.id}-${index}`} className={`grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-7 ${index === state.items.length - 1 ? "bg-amber-50" : ""}`}><div className="min-w-0"><p className="truncate text-lg font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.quantityLabel || item.quantity}{state.showUnitPrices !== false ? ` × ${money(item.unitPrice)}` : ""}</p>{hasPromotion && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase text-violet-800">{item.promotion.badge || "PROMO"}</span><span className="text-xs font-semibold text-violet-700">{item.promotion.name}</span><span className="text-xs font-bold text-emerald-700">Ahorrás {money(item.promotion.discount)}</span></div>}</div><div className="text-left sm:text-right">{hasPromotion && <p className="text-sm font-semibold text-gray-400 line-through">{money(item.subtotal)}</p>}<p className="text-xl font-bold">{money(hasPromotion ? item.finalSubtotal : item.subtotal)}</p></div></div>; })}</div>{state.showPromotionsDuringSale !== false && bannerPromotion && <div className="border-t border-white/10 bg-[#16433D] p-3 text-white"><PromotionCard promotion={bannerPromotion} compact/></div>}</section><aside className="flex flex-col rounded-3xl bg-[#F6F1E7] p-6 text-[#173F3A] shadow-2xl sm:p-8"><div className="space-y-2 text-base">{Number(state.discount || 0) > 0 && <><div className="flex justify-between gap-3"><span>Subtotal</span><b>{money(state.subtotal)}</b></div>{discountLines.map((line, index) => <div key={`${line.kind}-${line.label}-${index}`} className={`flex justify-between gap-3 ${line.kind === "manual" ? "text-blue-700" : "text-emerald-700"}`}><span className="min-w-0"><span className="block truncate">{line.kind === "manual" ? "Descuento manual" : line.label}</span>{line.badge && <small className="font-bold uppercase">{line.badge}</small>}</span><b className="shrink-0">-{money(line.amount)}</b></div>)}{!discountLines.length && <div className="flex justify-between gap-3 text-emerald-700"><span>Descuentos</span><b>-{money(state.discount)}</b></div>}</>}</div><div className="mt-4 border-t border-[#173F3A]/20 pt-5"><p className="text-sm font-bold uppercase tracking-[.18em] text-[#B95125]">Total a pagar</p><p className="mt-2 break-all font-serif text-5xl font-black sm:text-6xl">{money(state.total)}</p>{Number(state.discount || 0) > 0 && <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-center text-sm font-black text-emerald-800">Ahorraste {money(state.discount)}</p>}</div>{payment && <div className="mt-6 rounded-2xl bg-white p-5 text-center"><p className="text-sm font-semibold text-gray-500">Medio elegido</p><p className="mt-1 text-2xl font-bold">{payment.method}</p>{payment.method === "Efectivo" && state.showChange !== false && <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-left"><div><span className="text-xs text-gray-500">Recibido</span><b className="block text-lg">{money(payment.received || 0)}</b></div><div><span className="text-xs text-gray-500">Vuelto</span><b className="block text-lg text-emerald-700">{money(Math.max(0, payment.change || 0))}</b></div></div>}{showQr && <div className="mt-4"><img src={state.paymentQrImage} alt="Código QR para pagar" className="mx-auto aspect-square w-full max-w-56 rounded-2xl border object-contain p-2"/><p className="mt-3 text-xs font-semibold text-gray-500">Escaneá el QR y mostrá el comprobante al vendedor.</p><p className="mt-1 text-xs font-bold text-amber-700">Esperando confirmación del vendedor</p></div>}{payment.method === "Tarjeta" && <p className="mt-3 text-sm text-gray-600">Aguardá mientras procesamos el pago en el posnet.</p>}</div>}<p className="mt-auto pt-6 text-center text-xs text-[#173F3A]/60">Los pagos se confirman en la caja del comercio.</p></aside></div>;
}

function Complete({ state }) {
  const promotion = (state.promotions || [])[0] || null;
  return <div className="grid flex-1 place-items-center px-6 py-10 text-center"><div className="max-w-4xl"><span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-400 text-emerald-950"><CheckCircle2 size={52}/></span><h1 className="mt-6 font-serif text-5xl font-black sm:text-7xl">{state.thanksMessage || "¡Gracias por tu compra!"}</h1><p className="mt-5 text-xl text-emerald-100">Total: <b className="text-white">{money(state.total)}</b></p>{Number(state.discount || 0) > 0 && <p className="mt-2 text-lg font-bold text-amber-300">Ahorraste {money(state.discount)} con tus promociones</p>}{state.payment?.method && <p className="mt-2 text-emerald-100">Pago registrado por {state.payment.method.toLowerCase()}.</p>}{promotion && <div className="mx-auto mt-7 max-w-2xl"><PromotionCard promotion={promotion} compact/></div>}{state.contactLine && <p className="mt-6 text-sm font-semibold text-white/80">{state.contactLine}</p>}</div></div>;
}

export function CustomerDisplayScreen({ channelId }) {
  const [state, setState] = useState(fallbackState);
  useEffect(() => subscribeCustomerDisplay(channelId, (next) => next && setState({ ...fallbackState, ...next, connected: true })), [channelId]);
  const screen = useMemo(() => {
    if (!state.connected) return <div className="grid flex-1 place-items-center text-center"><div><WifiOff className="mx-auto text-amber-300" size={42}/><h1 className="mt-4 text-2xl font-bold">Esperando a la caja</h1><p className="mt-2 text-emerald-100">Dejá esta pantalla abierta. Se conectará automáticamente.</p></div></div>;
    if (state.mode === "complete") return <Complete state={state}/>;
    if (state.mode === "sale" && state.items.length) return <Sale state={state}/>;
    return <Idle state={state}/>;
  }, [state]);
  return <main className="flex min-h-screen flex-col overflow-hidden bg-[#16433D] text-white"><Brand state={state}/>{screen}</main>;
}
