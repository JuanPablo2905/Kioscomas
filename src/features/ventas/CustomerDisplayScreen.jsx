import React, { useEffect, useState } from "react";
import { CheckCircle2, Monitor, WifiOff } from "lucide-react";
import { money } from "../../shared/domain";
import { subscribeCustomerDisplay } from "./customerDisplay";

const fallbackState = {
  mode: "idle",
  businessName: "Kiosco+",
  welcomeMessage: "Bienvenido",
  items: [],
  total: 0,
  connected: false,
};

function Brand({ state }) {
  return <header className="flex items-center justify-between gap-5 border-b border-white/15 px-6 py-5 sm:px-10"><div className="flex min-w-0 items-center gap-4">{state.businessImage ? <img src={state.businessImage} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1"/> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 font-serif text-2xl font-black">K+</span>}<div className="min-w-0"><p className="truncate text-2xl font-bold sm:text-3xl">{state.businessName || "Kiosco+"}</p><p className="text-sm text-emerald-100">Tu compra, clara y a la vista</p></div></div><span className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-semibold sm:inline">Pantalla del cliente</span></header>;
}

function Idle({ state }) {
  return <div className="grid flex-1 place-items-center px-6 py-12 text-center"><div><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10"><Monitor size={38}/></span><h1 className="mt-6 font-serif text-4xl font-bold sm:text-6xl">{state.welcomeMessage || "Bienvenido"}</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-100">Cuando comience la venta vas a ver acá cada producto, sus descuentos y el total.</p></div></div>;
}

function Sale({ state }) {
  const payment = state.payment || null;
  const showQr = ["Mercado Pago", "Transferencia"].includes(payment?.method) && state.paymentQrImage;
  return <div className="grid min-h-0 flex-1 gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] sm:p-8"><section className="min-h-0 overflow-hidden rounded-3xl bg-white text-gray-900 shadow-2xl"><div className="border-b px-5 py-4 sm:px-7"><h1 className="text-xl font-bold">Tu compra</h1><p className="text-sm text-gray-500">{state.items.length} producto{state.items.length === 1 ? "" : "s"}</p></div><div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y">{state.items.map((item, index) => <div key={`${item.id}-${index}`} className={`grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-7 ${index === state.items.length - 1 ? "bg-amber-50" : ""}`}><div className="min-w-0"><p className="truncate text-lg font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.quantityLabel || item.quantity}{state.showUnitPrices !== false ? ` × ${money(item.unitPrice)}` : ""}</p></div><p className="text-xl font-bold">{money(item.subtotal)}</p></div>)}</div></section><aside className="flex flex-col rounded-3xl bg-[#F6F1E7] p-6 text-[#173F3A] shadow-2xl sm:p-8"><div className="space-y-2 text-base">{Number(state.discount || 0) > 0 && <><div className="flex justify-between gap-3"><span>Subtotal</span><b>{money(state.subtotal)}</b></div><div className="flex justify-between gap-3 text-emerald-700"><span>Descuentos</span><b>-{money(state.discount)}</b></div></>}</div><div className="mt-4 border-t border-[#173F3A]/20 pt-5"><p className="text-sm font-bold uppercase tracking-[.18em] text-[#B95125]">Total a pagar</p><p className="mt-2 break-all font-serif text-5xl font-black sm:text-6xl">{money(state.total)}</p></div>{payment && <div className="mt-6 rounded-2xl bg-white p-5 text-center"><p className="text-sm font-semibold text-gray-500">Medio elegido</p><p className="mt-1 text-2xl font-bold">{payment.method}</p>{payment.method === "Efectivo" && state.showChange !== false && <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-left"><div><span className="text-xs text-gray-500">Recibido</span><b className="block text-lg">{money(payment.received || 0)}</b></div><div><span className="text-xs text-gray-500">Vuelto</span><b className="block text-lg text-emerald-700">{money(Math.max(0, payment.change || 0))}</b></div></div>}{showQr && <div className="mt-4"><img src={state.paymentQrImage} alt="Código QR para pagar" className="mx-auto aspect-square w-full max-w-56 rounded-2xl border object-contain p-2"/><p className="mt-3 text-xs font-semibold text-gray-500">Escaneá el QR y mostrá el comprobante al vendedor.</p><p className="mt-1 text-xs font-bold text-amber-700">Esperando confirmación del vendedor</p></div>}{payment.method === "Tarjeta" && <p className="mt-3 text-sm text-gray-600">Aguardá mientras procesamos el pago en el posnet.</p>}</div>}<p className="mt-auto pt-6 text-center text-xs text-[#173F3A]/60">Los pagos se confirman en la caja del comercio.</p></aside></div>;
}

function Complete({ state }) {
  return <div className="grid flex-1 place-items-center px-6 py-12 text-center"><div><span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-400 text-emerald-950"><CheckCircle2 size={52}/></span><h1 className="mt-6 font-serif text-5xl font-black sm:text-7xl">¡Gracias por tu compra!</h1><p className="mt-5 text-xl text-emerald-100">Total: <b className="text-white">{money(state.total)}</b></p>{state.payment?.method && <p className="mt-2 text-emerald-100">Pago registrado por {state.payment.method.toLowerCase()}.</p>}</div></div>;
}

export function CustomerDisplayScreen({ channelId }) {
  const [state, setState] = useState(fallbackState);
  useEffect(() => subscribeCustomerDisplay(channelId, (next) => next && setState({ ...fallbackState, ...next, connected: true })), [channelId]);
  return <main className="flex min-h-screen flex-col overflow-hidden bg-[#16433D] text-white"><Brand state={state}/>{!state.connected ? <div className="grid flex-1 place-items-center text-center"><div><WifiOff className="mx-auto text-amber-300" size={42}/><h1 className="mt-4 text-2xl font-bold">Esperando a la caja</h1><p className="mt-2 text-emerald-100">Dejá esta pantalla abierta. Se conectará automáticamente.</p></div></div> : state.mode === "complete" ? <Complete state={state}/> : state.mode === "sale" && state.items.length ? <Sale state={state}/> : <Idle state={state}/>}</main>;
}
