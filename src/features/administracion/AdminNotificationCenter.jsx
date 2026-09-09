import React, { useEffect, useMemo, useState } from "react";
import { Archive, BellRing, CheckCircle2, Megaphone, RefreshCw, Send } from "lucide-react";
import { AppSelect } from "../../shared/controls";
import { KioscoDatePicker, datePickerHelpers } from "../../shared/KioscoDatePicker";
import { archivePlatformNotification, enablePushNotifications, loadAdminNotifications, publishPlatformNotification, pushCapability } from "../notificaciones/notificationService";

const emptyForm = { title: "", message: "", level: "info", audienceType: "all", businessIds: [], publishDate: "", expiresDate: "", actionView: "" };

export function AdminNotificationCenter({ accounts = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pushState, setPushState] = useState(() => pushCapability());
  const [pushConfigured, setPushConfigured] = useState(null);
  const [pushDevices, setPushDevices] = useState(0);
  const activeItems = useMemo(() => items.filter((item) => !item.archivedAt), [items]);

  const reload = async () => {
    try {
      const detail = await loadAdminNotifications();
      setItems(detail.notifications || []);
      setPushDevices(Number(detail.activePushDevices || 0));
      setPushConfigured(Boolean(detail.pushConfigured));
      setError("");
    } catch (requestError) { setError(requestError?.message || "No se pudieron cargar los avisos."); }
  };

  useEffect(() => {
    reload();
    if (pushCapability() === "granted") enablePushNotifications().catch(() => {});
    const reloadAfterLogin = () => reload();
    window.addEventListener("kiosco-cloud-session-changed", reloadAfterLogin);
    return () => window.removeEventListener("kiosco-cloud-session-changed", reloadAfterLogin);
  }, []);

  const toggleBusiness = (id) => setForm((previous) => ({
    ...previous,
    businessIds: previous.businessIds.includes(String(id))
      ? previous.businessIds.filter((value) => value !== String(id))
      : [...previous.businessIds, String(id)],
  }));

  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      const today = datePickerHelpers.dateValue(new Date());
      const detail = await publishPlatformNotification({
        ...form,
        publishAt: form.publishDate && form.publishDate > today ? new Date(`${form.publishDate}T09:00:00-03:00`).toISOString() : null,
        expiresAt: form.expiresDate ? new Date(`${form.expiresDate}T23:59:59-03:00`).toISOString() : null,
        action: form.actionView ? { view: form.actionView } : null,
      });
      setItems((previous) => [detail.notification, ...previous]);
      setForm(emptyForm);
    } catch (requestError) { setError(requestError?.message || "No se pudo publicar el aviso."); }
    finally { setBusy(false); }
  };

  const activatePush = async () => {
    setBusy(true);
    setError("");
    try {
      await enablePushNotifications();
      setPushState("granted");
      await reload();
    } catch (requestError) {
      setPushState(pushCapability());
      setError(requestError?.message || "No se pudieron activar los avisos al dispositivo.");
    } finally { setBusy(false); }
  };

  const archive = async (id) => {
    try {
      await archivePlatformNotification(id);
      setItems((previous) => previous.map((item) => item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item));
    } catch (requestError) { setError(requestError?.message || "No se pudo archivar el aviso."); }
  };

  return <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-2"><Megaphone size={20} className="mt-0.5 text-[#D96B32]"/><div><h2 className="font-semibold">Centro de avisos</h2><p className="mt-1 text-xs text-gray-500">Publicá un mensaje dentro de la app y, en los dispositivos autorizados, también como aviso del sistema.</p></div></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-semibold">{pushDevices} dispositivo(s) con avisos</span>
        {pushConfigured && pushState === "available" && <button type="button" disabled={busy} onClick={activatePush} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C4A44] px-3 py-2 text-xs font-bold text-white"><BellRing size={15}/>Avisarme en este dispositivo</button>}
        {pushConfigured && pushState === "granted" && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-[11px] font-bold text-green-800"><CheckCircle2 size={14}/>Este dispositivo recibe avisos</span>}
        {pushConfigured === false && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">Falta configurar avisos push en Render</span>}
        <button type="button" onClick={reload} className="grid h-9 w-9 place-items-center rounded-lg border" aria-label="Actualizar avisos"><RefreshCw size={15}/></button>
      </div>
    </div>

    <div className="mt-4 grid gap-3 rounded-xl border bg-gray-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_210px]">
      <div className="space-y-2">
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} placeholder="Título del aviso" className="w-full rounded-lg border bg-white px-3 py-2 text-sm"/>
        <textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={700} rows={3} placeholder="Escribí el mensaje que van a recibir..." className="w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm"/>
      </div>
      <div className="space-y-2">
        <AppSelect value={form.level} onChange={(level) => setForm({ ...form, level })} options={[{ value: "info", label: "Información" }, { value: "importante", label: "Importante" }, { value: "urgente", label: "Urgente" }, { value: "mantenimiento", label: "Mantenimiento" }]}/>
        <AppSelect value={form.audienceType} onChange={(audienceType) => setForm({ ...form, audienceType, businessIds: audienceType === "business" ? form.businessIds : [] })} options={[{ value: "all", label: "Todos, incluida administración" }, { value: "business", label: "Negocios elegidos" }, { value: "admin", label: "Sólo administradores" }]}/>
        <button type="button" disabled={busy || !form.title.trim() || !form.message.trim() || (form.audienceType === "business" && !form.businessIds.length)} onClick={publish} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D96B32] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={15}/>{busy ? "Publicando..." : "Publicar aviso"}</button>
      </div>
      {form.audienceType === "business" && <div className="grid max-h-44 gap-2 overflow-auto rounded-lg border bg-white p-2 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">{accounts.map((account) => <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50"><input type="checkbox" checked={form.businessIds.includes(String(account.id))} onChange={() => toggleBusiness(account.id)}/><span className="truncate">{account.nombreNegocio}</span></label>)}</div>}
      <div className="grid gap-2 sm:grid-cols-3 lg:col-span-2"><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Publicar desde (opcional)</span><KioscoDatePicker value={form.publishDate} min={datePickerHelpers.dateValue(new Date())} onChange={(publishDate) => setForm({ ...form, publishDate })}/></div><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Ocultar después de (opcional)</span><KioscoDatePicker value={form.expiresDate} min={form.publishDate || datePickerHelpers.dateValue(new Date())} onChange={(expiresDate) => setForm({ ...form, expiresDate })}/></div><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Al tocar, abrir</span><AppSelect value={form.actionView} onChange={(actionView) => setForm({ ...form, actionView })} options={[{ value: "", label: "Sólo el aviso" }, { value: "home", label: "Inicio" }, { value: "stock", label: "Stock" }, { value: "ventas", label: "Ventas" }, { value: "compras", label: "Compras" }, { value: "reportes", label: "Reportes" }, { value: "notificaciones", label: "Notificaciones" }]}/></div></div>
    </div>
    {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

    <div className="mt-4 space-y-2">
      {activeItems.slice(0, 8).map((item) => {
        const scheduled = Date.parse(item.publishAt || "") > Date.now();
        return <div key={item.id} className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{item.title}</b><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase">{item.level}</span>{scheduled && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Programado</span>}</div><p className="mt-1 break-words text-xs text-gray-600">{item.message}</p><p className="mt-1 text-[10px] text-gray-400">{item.audience?.type === "all" ? "Todos" : item.audience?.type === "admin" ? "Administradores" : `${item.audience?.businessIds?.length || 0} negocio(s)`} · {scheduled ? `sale ${new Date(item.publishAt).toLocaleString("es-AR")}` : new Date(item.createdAt).toLocaleString("es-AR")}</p></div><button type="button" onClick={() => archive(item.id)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs text-gray-600"><Archive size={14}/>Archivar</button></div>;
      })}
      {!activeItems.length && <p className="rounded-xl border border-dashed p-5 text-center text-xs text-gray-400">Todavía no publicaste avisos.</p>}
    </div>
  </section>;
}
