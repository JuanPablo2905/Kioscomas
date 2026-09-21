import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CreditCard, History, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { money } from "../../shared/domain";
import {
  PAYMENT_MODES, PAYMENT_TARGETS, cancelPaymentAttempt,
  listPaymentAttempts, loadPaymentProviders, refreshPaymentAttempt, refundPaymentAttempt,
} from "./paymentService";

const statusLabel = {
  creating: "Creando", pending: "Pendiente", approved: "Acreditado", failed: "Rechazado",
  canceled: "Cancelado", expired: "Vencido", refunded: "Devuelto", charged_back: "Contracargo",
};

const statusStyle = {
  approved: "bg-emerald-100 text-emerald-800",
  refunded: "bg-violet-100 text-violet-800",
  failed: "bg-red-100 text-red-700",
  charged_back: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-800",
  creating: "bg-amber-100 text-amber-800",
};

export function MercadoPagoSettings({ businessId, preferences, onChange, canConnect = true }) {
  const [provider, setProvider] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const set = (patch) => onChange({ ...preferences, ...patch });
  const anyConnected = Boolean(provider?.solutions?.qr?.connected || provider?.solutions?.point?.connected || provider?.connected);

  const load = async ({ quiet = false } = {}) => {
    if (!businessId) return;
    if (!quiet) setLoading(true);
    try {
      const [providerPayload, attemptPayload] = await Promise.all([
        loadPaymentProviders(businessId),
        listPaymentAttempts(businessId).catch(() => ({ attempts: [] })),
      ]);
      setProvider(providerPayload.providers?.find((item) => item.provider === "mercado_pago") || null);
      setAttempts(attemptPayload.attempts || []);
    } catch (error) {
      setMessage(error?.message || "No se pudo consultar Mercado Pago.");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [businessId]);

  const runAttemptAction = async (attempt, action) => {
    if (action === "refund" && !window.confirm(`¿Devolver ${money(attempt.amount)} del cobro ${attempt.ticketNumber || attempt.externalReference}? Esta operación mueve dinero real.`)) return;
    setWorkingId(`${action}:${attempt.id}`);
    try {
      const result = action === "refresh"
        ? await refreshPaymentAttempt(businessId, attempt.id)
        : action === "cancel"
          ? await cancelPaymentAttempt(businessId, attempt.id)
          : await refundPaymentAttempt(businessId, attempt.id);
      setAttempts((current) => current.map((item) => item.id === attempt.id ? result.attempt : item));
      setMessage(action === "refund" ? "Devolución enviada a Mercado Pago." : action === "cancel" ? "Cobro cancelado." : "Estado actualizado.");
    } catch (error) {
      setMessage(error?.message || "No se pudo actualizar el cobro.");
    } finally {
      setWorkingId("");
    }
  };

  const recentAttempts = useMemo(() => attempts.slice(0, 20), [attempts]);

  return <div className="rounded-2xl border border-sky-200 bg-[#eaf7ff] p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <span className="inline-flex rounded-full bg-[#009ee3] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">Mercado Pago</span>
        <h4 className="mt-2 text-base font-black text-sky-950">Cobros con Mercado Pago</h4>
        <p className="mt-1 text-xs leading-5 text-sky-900/75">Hoy cobrás con QR estático. QR dinámico y Point están en preparación.</p>
      </div>
      <button type="button" onClick={() => load()} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 text-xs font-bold text-sky-900 disabled:opacity-50"><RefreshCw className={loading ? "animate-spin" : ""} size={15}/>Actualizar estado</button>
    </div>

    <div className="mt-4 rounded-xl border border-dashed border-sky-300 bg-white p-4">
      <b className="flex items-center gap-2 text-sm font-black text-sky-950"><CreditCard size={16}/>QR dinámico y Mercado Pago Point · Próximamente</b>
      <p className="mt-1 text-xs leading-5 text-gray-600">Todavía no se pueden conectar cuentas nuevas para estas dos formas de cobro. Usá QR estático mientras tanto: subí la imagen de tu QR más abajo.</p>
    </div>

    {!canConnect && <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-sky-900">Sólo el dueño puede devolver dinero desde la app. El equipo con permiso de Ventas sí puede cobrar.</p>}

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-sky-950">Cómo cobrar con Mercado Pago<select value={preferences.customerDisplayMercadoPagoMode || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoMode: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">{PAYMENT_MODES.find((mode) => mode.id === (preferences.customerDisplayMercadoPagoMode || "ask"))?.detail}</span></label>
      <label className="text-xs font-bold text-sky-950">Dónde mostrar el QR<select value={preferences.customerDisplayMercadoPagoTarget || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoTarget: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_TARGETS.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">La opción del celular envía sólo el importe y el QR, nunca información privada del negocio.</span></label>
    </div>

    {anyConnected && <details className="mt-4 rounded-xl border border-sky-200 bg-white p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-sky-950"><History size={16}/>Actividad y conciliación<span className="ml-auto rounded-full bg-sky-100 px-2 py-1 text-[10px]">{recentAttempts.length}</span></summary>
      <p className="mt-2 text-xs leading-5 text-gray-600">Cada cobro conserva su referencia de Mercado Pago y el ticket local. Si un pago quedó acreditado sin ticket, aparece marcado para revisión.</p>
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
        {!recentAttempts.length && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-gray-500">Todavía no hay cobros conectados.</p>}
        {recentAttempts.map((attempt) => <div key={attempt.id} className={`rounded-xl border p-3 ${attempt.reconciliationStatus === "sale_pending" ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><b className="block text-sm text-gray-900">{money(attempt.amount)} · {attempt.type === "point" ? "Point" : "QR dinámico"}</b><span className="block break-all text-[10px] text-gray-500">{attempt.ticketNumber ? `Ticket ${attempt.ticketNumber}` : attempt.externalReference}</span></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusStyle[attempt.status] || "bg-gray-200 text-gray-700"}`}>{statusLabel[attempt.status] || attempt.status}</span></div>
          <p className="mt-2 text-[10px] text-gray-500">{attempt.createdAt ? new Date(attempt.createdAt).toLocaleString("es-AR") : ""}{attempt.providerOrderId ? ` · Orden ${attempt.providerOrderId}` : ""}</p>
          {attempt.failure && <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-800">
            <p className="font-bold">{attempt.failure.message || "Mercado Pago rechazó el intento."}</p>
            <details className="mt-1">
              <summary className="cursor-pointer select-none font-semibold">Ver diagnóstico técnico</summary>
              <p className="mt-1 break-all font-mono text-[10px]">{[
                attempt.failure.code ? `código ${attempt.failure.code}` : "",
                attempt.failure.httpStatus ? `HTTP ${attempt.failure.httpStatus}` : "",
                attempt.failure.requestId ? `solicitud ${attempt.failure.requestId}` : "",
              ].filter(Boolean).join(" · ")}</p>
              {(attempt.failure.details || []).map((detail, index) => <p key={`${attempt.id}-failure-${index}`} className="mt-1 break-words text-[10px]">{[detail.field, detail.code, detail.message].filter(Boolean).join(" · ")}</p>)}
            </details>
          </div>}
          {attempt.reconciliationStatus === "sale_pending" && <p className="mt-2 flex items-start gap-1 text-xs font-bold text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={13}/>El dinero figura acreditado, pero todavía falta vincular el ticket local.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {attempt.providerOrderId && <button type="button" onClick={() => runAttemptAction(attempt, "refresh")} disabled={Boolean(workingId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-3 text-[11px] font-bold disabled:opacity-50"><RefreshCw className={workingId === `refresh:${attempt.id}` ? "animate-spin" : ""} size={13}/>Consultar</button>}
            {["creating", "pending"].includes(attempt.status) && <button type="button" onClick={() => runAttemptAction(attempt, "cancel")} disabled={Boolean(workingId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 text-[11px] font-bold text-red-700 disabled:opacity-50"><XCircle size={13}/>Cancelar</button>}
            {canConnect && attempt.status === "approved" && <button type="button" onClick={() => runAttemptAction(attempt, "refund")} disabled={Boolean(workingId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 text-[11px] font-bold text-violet-700 disabled:opacity-50"><RotateCcw size={13}/>Devolver</button>}
          </div>
        </div>)}
      </div>
    </details>}

    {message && <p role="status" className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{message}</p>}
    <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-sky-900/65"><CreditCard className="mt-0.5 shrink-0" size={13}/>Kiosco+ nunca solicita ni guarda la contraseña de Mercado Pago. La autorización se hace en la página oficial y los tokens quedan cifrados en el servidor.</p>
  </div>;
}
