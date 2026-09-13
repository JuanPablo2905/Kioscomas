import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, RefreshCw, Unlink } from "lucide-react";
import { PAYMENT_MODES, PAYMENT_TARGETS, disconnectMercadoPago, loadPaymentProviders, startMercadoPagoConnection } from "./paymentService";

export function MercadoPagoSettings({ businessId, preferences, onChange, canConnect = true }) {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const set = (patch) => onChange({ ...preferences, ...patch });
  const load = async () => {
    setLoading(true);
    try {
      const payload = await loadPaymentProviders(businessId);
      setProvider(payload.providers?.find((item) => item.provider === "mercado_pago") || null);
      setMessage("");
    } catch (error) { setMessage(error?.message || "No se pudo consultar Mercado Pago."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (businessId) load(); }, [businessId]);

  const connect = async () => {
    setMessage("Preparando la conexión segura...");
    try {
      const payload = await startMercadoPagoConnection(businessId);
      const opened = window.open(payload.authorizationUrl, "_blank", "noopener,noreferrer");
      if (!opened) window.location.assign(payload.authorizationUrl);
      else setMessage("Autorizá Kiosco+ en Mercado Pago y después tocá Actualizar estado.");
    } catch (error) { setMessage(error?.message || "No se pudo iniciar la conexión."); }
  };

  const disconnect = async () => {
    if (!window.confirm("¿Desconectar la cuenta de Mercado Pago de este negocio? Los QR estáticos seguirán disponibles.")) return;
    try { await disconnectMercadoPago(businessId); await load(); }
    catch (error) { setMessage(error?.message || "No se pudo desconectar."); }
  };

  return <div className="rounded-2xl border border-sky-200 bg-[#eaf7ff] p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><span className="inline-flex rounded-full bg-[#009ee3] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">Mercado Pago</span><h4 className="mt-2 text-base font-black text-sky-950">Cobros conectados del negocio</h4><p className="mt-1 text-xs leading-5 text-sky-900/75">Prepará QR dinámico por importe exacto, enviá órdenes a Point o seguí usando tu QR estático.</p></div><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 text-xs font-bold text-sky-900 disabled:opacity-50"><RefreshCw className={loading ? "animate-spin" : ""} size={15}/>Actualizar estado</button></div>

    <div className={`mt-4 rounded-xl border p-3 ${provider?.connected ? "border-emerald-300 bg-emerald-50" : "border-sky-200 bg-white"}`}>
      {provider?.connected ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18}/><div><b className="block text-sm text-emerald-950">Cuenta conectada</b><span className="text-xs text-emerald-800">{provider.sellerNickname || provider.sellerId || "Mercado Pago autorizado"}</span></div></div>{canConnect && <button type="button" onClick={disconnect} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700"><Unlink size={14}/>Desconectar</button>}</div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><b className="block text-sm text-sky-950">{provider?.ready ? "Lista para vincular" : "Integración preparada, todavía sin credenciales"}</b><p className="mt-1 text-xs leading-5 text-gray-600">{provider?.ready ? "El dueño debe autorizar la cuenta que recibirá los cobros." : "Hasta que se carguen las credenciales de prueba en Render no se crearán QR dinámicos ni órdenes Point."}</p></div>{provider?.ready && canConnect && <button type="button" onClick={connect} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-4 text-xs font-black text-white"><Link2 size={15}/>Conectar cuenta<ExternalLink size={13}/></button>}</div>}
    </div>
    {!canConnect && <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-sky-900">Sólo el dueño del negocio puede conectar o desconectar la cuenta. Las demás preferencias siguen visibles para el equipo.</p>}

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-sky-950">Cómo cobrar con Mercado Pago<select value={preferences.customerDisplayMercadoPagoMode || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoMode: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">{PAYMENT_MODES.find((mode) => mode.id === (preferences.customerDisplayMercadoPagoMode || "ask"))?.detail}</span></label>
      <label className="text-xs font-bold text-sky-950">Dónde mostrar el QR<select value={preferences.customerDisplayMercadoPagoTarget || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoTarget: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_TARGETS.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">La opción del celular envía sólo el importe y el QR, nunca información privada del negocio.</span></label>
      <label className="text-xs font-bold text-sky-950">Identificador de caja QR<input value={preferences.customerDisplayMercadoPagoPosId || ""} onChange={(event) => set({ customerDisplayMercadoPagoPosId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) })} placeholder="Ej.: CAJA-1" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/><span className="mt-1 block text-[10px] font-normal text-sky-900/70">Lo entrega la configuración QR de Mercado Pago.</span></label>
      <label className="text-xs font-bold text-sky-950">Número de terminal Point<input value={preferences.customerDisplayMercadoPagoTerminalId || ""} onChange={(event) => set({ customerDisplayMercadoPagoTerminalId: event.target.value.slice(0, 80) })} placeholder="Ej.: PAX-A910-01" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/><span className="mt-1 block text-[10px] font-normal text-sky-900/70">Necesario solamente si elegís cobrar con Point.</span></label>
    </div>
    {message && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{message}</p>}
  </div>;
}
