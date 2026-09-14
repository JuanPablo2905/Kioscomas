import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, CreditCard, ExternalLink, History, Link2,
  MapPin, RefreshCw, RotateCcw, Store, Unlink, XCircle,
} from "lucide-react";
import { money } from "../../shared/domain";
import {
  PAYMENT_MODES, PAYMENT_TARGETS, cancelPaymentAttempt, disconnectMercadoPago,
  listMercadoPagoTerminals, listPaymentAttempts, loadPaymentProviders, refreshPaymentAttempt, refundPaymentAttempt,
  setupMercadoPagoPoint, setupMercadoPagoQr, startMercadoPagoConnection,
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
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [setup, setSetup] = useState({
    storeName: "", posName: "Caja principal", streetName: "", streetNumber: "",
    cityName: "", stateName: "", reference: "", latitude: "", longitude: "",
  });
  const set = (patch) => onChange({ ...preferences, ...patch });
  const qrConfigured = Boolean(provider?.qr?.configured);
  const qrConnection = provider?.solutions?.qr || {
    connected: Boolean(provider?.connected), status: provider?.status, ready: provider?.ready,
    webhookConfigured: provider?.webhookConfigured, sellerId: provider?.sellerId, sellerNickname: provider?.sellerNickname,
  };
  const pointConnection = provider?.solutions?.point || { connected: false, status: "disconnected", ready: false, webhookConfigured: false };
  const anyConnected = Boolean(qrConnection.connected || pointConnection.connected);

  const load = async ({ quiet = false } = {}) => {
    if (!businessId) return;
    if (!quiet) setLoading(true);
    try {
      const [providerPayload, attemptPayload] = await Promise.all([
        loadPaymentProviders(businessId),
        listPaymentAttempts(businessId).catch(() => ({ attempts: [] })),
      ]);
      const nextProvider = providerPayload.providers?.find((item) => item.provider === "mercado_pago") || null;
      setProvider(nextProvider);
      setAttempts(attemptPayload.attempts || []);
      setSetup((current) => ({
        ...current,
        storeName: current.storeName || nextProvider?.qr?.storeName || "",
        posName: current.posName || nextProvider?.qr?.posName || "Caja principal",
      }));
    } catch (error) {
      setMessage(error?.message || "No se pudo consultar Mercado Pago.");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [businessId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connection = params.get("payment_connection");
    if (connection) {
      const solution = params.get("payment_solution") === "point" ? "Point" : "Código QR";
      setMessage(connection === "connected"
        ? `Mercado Pago para ${solution} quedó conectado.`
        : connection === "canceled"
          ? `La autorización de ${solution} fue cancelada; no se modificó la cuenta.`
          : params.get("payment_reason") === "seller_account_mismatch"
            ? "QR y Point deben conectarse con la misma cuenta vendedora de Mercado Pago."
            : `Mercado Pago no pudo completar la conexión de ${solution}. Probá otra vez.`);
      params.delete("payment_connection");
      params.delete("payment_reason");
      params.delete("payment_solution");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      load({ quiet: true });
    }
    const refreshOnReturn = () => load({ quiet: true });
    window.addEventListener("focus", refreshOnReturn);
    return () => window.removeEventListener("focus", refreshOnReturn);
  }, [businessId]);

  const connect = async (solution) => {
    const label = solution === "point" ? "Point" : "Código QR";
    setMessage(`Preparando la conexión segura para ${label}…`);
    try {
      const payload = await startMercadoPagoConnection(businessId, solution);
      const opened = window.open(payload.authorizationUrl, "_blank");
      if (opened) opened.opener = null;
      if (!opened) window.location.assign(payload.authorizationUrl);
      else setMessage(`Autorizá Kiosco+ para ${label} en Mercado Pago. Al volver, el estado se actualizará solo.`);
    } catch (error) {
      setMessage(error?.message || "No se pudo iniciar la conexión.");
    }
  };

  const disconnect = async (solution) => {
    const label = solution === "point" ? "Point" : "Código QR";
    if (!window.confirm(`¿Desconectar Mercado Pago para ${label}? No se borran los cobros ya registrados.`)) return;
    try {
      await disconnectMercadoPago(businessId, solution);
      setMessage(`${label} quedó desconectado.`);
      await load({ quiet: true });
    } catch (error) {
      setMessage(error?.message || "No se pudo desconectar.");
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Este dispositivo no permite obtener la ubicación. Podés escribir latitud y longitud.");
      return;
    }
    setWorkingId("location");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSetup((current) => ({ ...current, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
        setWorkingId("");
        setMessage("Ubicación cargada. Revisá la dirección antes de crear la caja QR.");
      },
      () => {
        setWorkingId("");
        setMessage("No se pudo obtener la ubicación. Revisá el permiso o escribila manualmente.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const configureQr = async () => {
    if (!setup.storeName.trim() || !setup.posName.trim() || !setup.streetName.trim() || !setup.streetNumber.trim() || !setup.cityName.trim() || !setup.stateName.trim() || !setup.latitude || !setup.longitude) {
      setMessage("Para crear la caja QR completá local, caja, dirección, ciudad, provincia y ubicación.");
      return;
    }
    setWorkingId("setup");
    try {
      const payload = await setupMercadoPagoQr(businessId, setup);
      const next = payload.integration;
      setProvider((current) => ({ ...current, ...next }));
      if (next?.qr?.posExternalId) set({ customerDisplayMercadoPagoPosId: next.qr.posExternalId });
      setMessage("Caja QR creada y vinculada con este negocio.");
      await load({ quiet: true });
    } catch (error) {
      if (error?.payload?.integration) setProvider((current) => ({ ...current, ...error.payload.integration }));
      setMessage(error?.message || "No se pudo crear la caja QR.");
    } finally {
      setWorkingId("");
    }
  };

  const repairQr = async () => {
    setWorkingId("repair-qr");
    try {
      const payload = await setupMercadoPagoQr(businessId, {
        storeName: provider?.qr?.storeName || setup.storeName,
        posName: provider?.qr?.posName || setup.posName,
        repairOnly: true,
      });
      const next = payload.integration;
      setProvider((current) => ({ ...current, ...next }));
      if (next?.qr?.posExternalId) set({ customerDisplayMercadoPagoPosId: next.qr.posExternalId });
      setMessage("Caja QR comprobada y vinculada con la cuenta actual de Mercado Pago.");
      await load({ quiet: true });
    } catch (error) {
      if (error?.payload?.integration) setProvider((current) => ({ ...current, ...error.payload.integration }));
      setMessage(error?.message || "No se pudo comprobar la caja QR.");
    } finally {
      setWorkingId("");
    }
  };

  const loadTerminals = async () => {
    setWorkingId("terminals");
    try {
      const payload = await listMercadoPagoTerminals(businessId);
      setTerminals(payload.terminals || []);
      setMessage(payload.terminals?.length ? "Elegí el Point que corresponde a esta caja." : "No apareció ningún Point asociado. Revisá que esté encendido y vinculado con esta cuenta.");
    } catch (error) {
      setMessage(error?.message || "No se pudieron consultar los Point.");
    } finally {
      setWorkingId("");
    }
  };

  const configurePoint = async (terminalId) => {
    setWorkingId(`terminal:${terminalId}`);
    try {
      const payload = await setupMercadoPagoPoint(businessId, terminalId);
      setProvider((current) => ({ ...current, ...payload.integration }));
      set({ customerDisplayMercadoPagoTerminalId: terminalId });
      setTerminals((current) => current.map((terminal) => terminal.id === terminalId ? payload.terminal : terminal));
      setMessage("Point vinculado y configurado en modo Punto de Venta (PDV). Reinicialo antes de la primera prueba.");
    } catch (error) {
      setMessage(error?.message || "No se pudo configurar el Point.");
    } finally {
      setWorkingId("");
    }
  };

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
        <h4 className="mt-2 text-base font-black text-sky-950">Cobros conectados del negocio</h4>
        <p className="mt-1 text-xs leading-5 text-sky-900/75">QR dinámico por el importe exacto, QR estático y órdenes para Point, con seguimiento hasta la acreditación.</p>
      </div>
      <button type="button" onClick={() => load()} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 text-xs font-bold text-sky-900 disabled:opacity-50"><RefreshCw className={loading ? "animate-spin" : ""} size={15}/>Actualizar estado</button>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {[
        { id: "qr", label: "Código QR", detail: "QR dinámico por el importe exacto", connection: qrConnection },
        { id: "point", label: "Point", detail: "Cobro enviado al lector físico", connection: pointConnection },
      ].map(({ id, label, detail, connection }) => <div key={id} className={`rounded-xl border p-3 ${connection.connected ? "border-emerald-300 bg-emerald-50" : "border-sky-200 bg-white"}`}>
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-start gap-2">
            {connection.connected ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18}/> : id === "point" ? <CreditCard className="mt-0.5 shrink-0 text-sky-700" size={18}/> : <Link2 className="mt-0.5 shrink-0 text-sky-700" size={18}/>}
            <div><b className={`block text-sm ${connection.connected ? "text-emerald-950" : "text-sky-950"}`}>{label}</b><span className={`text-xs ${connection.connected ? "text-emerald-800" : "text-gray-600"}`}>{connection.connected ? connection.sellerNickname || connection.sellerId || "Cuenta autorizada" : detail}</span></div>
          </div>
          {connection.status === "reauthorization_required" && <p className="text-xs leading-5 text-amber-800">La autorización venció o fue revocada. Volvé a conectarla; la configuración y el historial se conservan.</p>}
          {!connection.ready && <p className="text-xs leading-5 text-gray-500">Faltan las credenciales de esta solución en el servidor.</p>}
          {connection.ready && !connection.webhookConfigured && <p className="flex items-start gap-2 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={14}/>Falta el secreto del webhook de {label}.</p>}
          {canConnect && <div className="mt-auto flex justify-end">{connection.connected
            ? <button type="button" onClick={() => disconnect(id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700"><Unlink size={14}/>Desconectar {label}</button>
            : connection.ready && <button type="button" onClick={() => connect(id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-4 text-xs font-black text-white"><Link2 size={15}/>Conectar {label}<ExternalLink size={13}/></button>}
          </div>}
        </div>
      </div>)}
    </div>
    {(qrConnection.testMode || pointConnection.testMode) && <p className="mt-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold leading-5 text-violet-900"><AlertTriangle className="mt-0.5 shrink-0" size={15}/>Modo de pruebas activo: Mercado Pago generará credenciales sandbox. Antes de habilitar cobros reales hay que apagar esta opción en el servidor y volver a conectar ambas soluciones.</p>}
    {qrConnection.connected && pointConnection.connected && qrConnection.sellerId !== pointConnection.sellerId && <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"><AlertTriangle className="mt-0.5 shrink-0" size={15}/>QR y Point están vinculados a cuentas distintas. Reconectá una de las dos con la misma cuenta vendedora.</p>}
    {!canConnect && <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-sky-900">Sólo el dueño puede conectar cuentas, crear cajas QR y devolver dinero. El equipo con permiso de Ventas sí puede cobrar.</p>}

    {qrConnection.connected && canConnect && <div className="mt-4 rounded-xl border border-sky-200 bg-white p-4">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009ee3] text-white"><Store size={19}/></span><div><h5 className="text-sm font-black text-sky-950">Caja para QR dinámico</h5><p className="mt-1 text-xs leading-5 text-gray-600">Kiosco+ crea el local y el puesto de cobro en la cuenta conectada. Se hace una sola vez.</p></div></div>
      {qrConfigured ? <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0"><b className="block">Configurada correctamente</b><span>{provider.qr.storeName} · {provider.qr.posName}</span><code className="mt-1 block break-all text-[10px]">{provider.qr.posExternalId}</code></span><button type="button" onClick={repairQr} disabled={Boolean(workingId)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-900 disabled:opacity-50"><RefreshCw className={workingId === "repair-qr" ? "animate-spin" : ""} size={14}/>{workingId === "repair-qr" ? "Comprobando…" : "Comprobar y reparar"}</button></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-sky-950">Nombre del local<input value={setup.storeName} onChange={(event) => setSetup((current) => ({ ...current, storeName: event.target.value.slice(0, 60) }))} placeholder="Ej.: Kiosco Centro" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Nombre de esta caja<input value={setup.posName} onChange={(event) => setSetup((current) => ({ ...current, posName: event.target.value.slice(0, 60) }))} placeholder="Ej.: Caja principal" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Calle<input value={setup.streetName} onChange={(event) => setSetup((current) => ({ ...current, streetName: event.target.value.slice(0, 100) }))} placeholder="Ej.: Av. Caseros" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Número<input inputMode="numeric" value={setup.streetNumber} onChange={(event) => setSetup((current) => ({ ...current, streetNumber: event.target.value.slice(0, 20) }))} placeholder="Ej.: 1490" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Ciudad o localidad<input value={setup.cityName} onChange={(event) => setSetup((current) => ({ ...current, cityName: event.target.value.slice(0, 100) }))} placeholder="Ej.: Buenos Aires" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Provincia<input value={setup.stateName} onChange={(event) => setSetup((current) => ({ ...current, stateName: event.target.value.slice(0, 100) }))} placeholder="Ej.: Buenos Aires" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950 sm:col-span-2">Referencia del lugar <span className="font-normal text-gray-500">(opcional)</span><input value={setup.reference} onChange={(event) => setSetup((current) => ({ ...current, reference: event.target.value.slice(0, 80) }))} placeholder="Ej.: local a la calle, persiana verde" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Latitud<input inputMode="decimal" value={setup.latitude} onChange={(event) => setSetup((current) => ({ ...current, latitude: event.target.value }))} placeholder="-34.6037" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <label className="text-xs font-bold text-sky-950">Longitud<input inputMode="decimal" value={setup.longitude} onChange={(event) => setSetup((current) => ({ ...current, longitude: event.target.value }))} placeholder="-58.3816" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/></label>
        <button type="button" onClick={useLocation} disabled={Boolean(workingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 text-xs font-bold text-sky-900 disabled:opacity-50"><MapPin size={15}/>{workingId === "location" ? "Buscando…" : "Usar ubicación actual"}</button>
        <button type="button" onClick={configureQr} disabled={Boolean(workingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-3 text-xs font-black text-white disabled:opacity-50">{workingId === "setup" ? <RefreshCw className="animate-spin" size={15}/> : <CheckCircle2 size={15}/>}Crear y vincular caja QR</button>
      </div>}
    </div>}

    {pointConnection.connected && canConnect && qrConfigured && <div className="mt-4 rounded-xl border border-sky-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009ee3] text-white"><CreditCard size={19}/></span><div><h5 className="text-sm font-black text-sky-950">Mercado Pago Point</h5><p className="mt-1 text-xs leading-5 text-gray-600">Buscá los lectores asociados a esta caja y activá el modo integrado PDV.</p></div></div><button type="button" onClick={loadTerminals} disabled={Boolean(workingId)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 px-3 text-xs font-bold text-sky-900 disabled:opacity-50"><RefreshCw className={workingId === "terminals" ? "animate-spin" : ""} size={14}/>Buscar mis Point</button></div>
      {provider.point?.configured && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">Point activo: <code className="break-all">{provider.point.terminalId}</code> · modo {provider.point.operatingMode || "PDV"}</p>}
      {terminals.length > 0 && <div className="mt-3 space-y-2">{terminals.map((terminal) => <div key={terminal.id} className="flex flex-col gap-2 rounded-xl border bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><code className="block break-all text-xs font-bold text-gray-900">{terminal.id}</code><span className={`mt-1 block text-[10px] ${terminal.assignedToCurrentPos ? "text-emerald-700" : "text-amber-700"}`}>{terminal.assignedToCurrentPos ? `Asociado a esta caja · modo ${terminal.operatingMode || "sin definir"}` : "Todavía no está asociado a esta caja en Mercado Pago"}</span></div><button type="button" onClick={() => configurePoint(terminal.id)} disabled={Boolean(workingId) || !terminal.assignedToCurrentPos} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#009ee3] px-3 text-xs font-black text-white disabled:opacity-50">{workingId === `terminal:${terminal.id}` ? "Configurando…" : provider.point?.terminalId === terminal.id ? "Volver a comprobar" : terminal.assignedToCurrentPos ? "Usar este Point" : "Falta asociarlo"}</button></div>)}</div>}
      <p className="mt-3 text-[10px] leading-4 text-gray-500">El final del identificador coincide con el número de serie de la etiqueta trasera. Primero asociá el lector con este local/caja en Mercado Pago; Kiosco+ activa luego el modo PDV. Mercado Pago permite un Point en modo PDV por caja.</p>
    </div>}

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-sky-950">Cómo cobrar con Mercado Pago<select value={preferences.customerDisplayMercadoPagoMode || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoMode: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">{PAYMENT_MODES.find((mode) => mode.id === (preferences.customerDisplayMercadoPagoMode || "ask"))?.detail}</span></label>
      <label className="text-xs font-bold text-sky-950">Dónde mostrar el QR<select value={preferences.customerDisplayMercadoPagoTarget || "ask"} onChange={(event) => set({ customerDisplayMercadoPagoTarget: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900">{PAYMENT_TARGETS.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-sky-900/70">La opción del celular envía sólo el importe y el QR, nunca información privada del negocio.</span></label>
      <label className="text-xs font-bold text-sky-950">Identificador de caja QR<input value={provider?.qr?.posExternalId || ""} readOnly placeholder="Se completa al vincular la caja" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-normal text-gray-700"/><span className="mt-1 block text-[10px] font-normal text-sky-900/70">Lo administra Kiosco+ para evitar que una caja vieja o escrita a mano impida cobrar.</span></label>
      <label className="text-xs font-bold text-sky-950">Identificador de terminal Point<input value={preferences.customerDisplayMercadoPagoTerminalId || ""} onChange={(event) => set({ customerDisplayMercadoPagoTerminalId: event.target.value.trim().slice(0, 80) })} placeholder="Ej.: NEWLAND_N950__SBX0000001" className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-normal text-gray-900"/><span className="mt-1 block text-[10px] font-normal text-sky-900/70">Figura en el Point: modelo, doble guion bajo y número de serie.</span></label>
    </div>

    {anyConnected && <details className="mt-4 rounded-xl border border-sky-200 bg-white p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-sky-950"><History size={16}/>Actividad y conciliación<span className="ml-auto rounded-full bg-sky-100 px-2 py-1 text-[10px]">{recentAttempts.length}</span></summary>
      <p className="mt-2 text-xs leading-5 text-gray-600">Cada cobro conserva su referencia de Mercado Pago y el ticket local. Si un pago quedó acreditado sin ticket, aparece marcado para revisión.</p>
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
        {!recentAttempts.length && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-gray-500">Todavía no hay cobros conectados.</p>}
        {recentAttempts.map((attempt) => <div key={attempt.id} className={`rounded-xl border p-3 ${attempt.reconciliationStatus === "sale_pending" ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><b className="block text-sm text-gray-900">{money(attempt.amount)} · {attempt.type === "point" ? "Point" : "QR dinámico"}</b><span className="block break-all text-[10px] text-gray-500">{attempt.ticketNumber ? `Ticket ${attempt.ticketNumber}` : attempt.externalReference}</span></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusStyle[attempt.status] || "bg-gray-200 text-gray-700"}`}>{statusLabel[attempt.status] || attempt.status}</span></div>
          <p className="mt-2 text-[10px] text-gray-500">{attempt.createdAt ? new Date(attempt.createdAt).toLocaleString("es-AR") : ""}{attempt.providerOrderId ? ` · Orden ${attempt.providerOrderId}` : ""}</p>
          {attempt.reconciliationStatus === "sale_pending" && <p className="mt-2 flex items-start gap-1 text-xs font-bold text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={13}/>El dinero figura acreditado, pero todavía falta vincular el ticket local.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => runAttemptAction(attempt, "refresh")} disabled={Boolean(workingId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-3 text-[11px] font-bold disabled:opacity-50"><RefreshCw className={workingId === `refresh:${attempt.id}` ? "animate-spin" : ""} size={13}/>Consultar</button>
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
