import React, { useEffect, useMemo, useState } from "react";
import { Archive, Bell, History, Megaphone, RefreshCw, Send } from "lucide-react";
import { AppSelect } from "../../shared/controls";
import { KioscoDatePicker, datePickerHelpers } from "../../shared/KioscoDatePicker";
import { archivePlatformNotification, loadAdminNotifications, publishPlatformNotification } from "../notificaciones/notificationService";

const emptyForm = { title: "", message: "", level: "info", audienceType: "all", businessIds: [], publishDate: "", expiresDate: "", actionView: "" };

const groupAutomaticHistory = (items) => {
  const groups = new Map();
  for (const item of items) {
    const automatic = item.createdBy === "kiosco-cloud";
    const key = automatic ? `${item.title}|${item.message}|${item.level}|${item.category}` : item.id;
    const current = groups.get(key);
    if (!current) groups.set(key, { ...item, groupedIds: [item.id], groupedBusinessIds: [...(item.audience?.businessIds || [])] });
    else {
      current.groupedIds.push(item.id);
      current.groupedBusinessIds.push(...(item.audience?.businessIds || []));
      if (String(item.createdAt) > String(current.createdAt)) current.createdAt = item.createdAt;
    }
  }
  return [...groups.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
};

export function AdminNotificationCenter({ accounts = [] }) {
  const [tab, setTab] = useState("admin");
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(null);
  const [pushDevices, setPushDevices] = useState(0);
  const activeItems = useMemo(() => items.filter((item) => !item.archivedAt), [items]);
  const adminItems = useMemo(() => activeItems.filter((item) => item.audience?.type === "admin"), [activeItems]);
  const historyItems = useMemo(() => groupAutomaticHistory(activeItems.filter((item) => item.audience?.type !== "admin")), [activeItems]);

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
    const reloadAfterLogin = () => reload();
    window.addEventListener("kiosco-cloud-session-changed", reloadAfterLogin);
    return () => window.removeEventListener("kiosco-cloud-session-changed", reloadAfterLogin);
  }, []);

  const toggleBusiness = (id) => setForm((previous) => ({ ...previous, businessIds: previous.businessIds.includes(String(id)) ? previous.businessIds.filter((value) => value !== String(id)) : [...previous.businessIds, String(id)] }));
  const publish = async () => {
    setBusy(true); setError("");
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
      setTab("history");
    } catch (requestError) { setError(requestError?.message || "No se pudo publicar el aviso."); }
    finally { setBusy(false); }
  };
  const archive = async (item) => {
    const ids = item.groupedIds || [item.id];
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => archivePlatformNotification(id)));
      const archivedAt = new Date().toISOString();
      setItems((previous) => previous.map((entry) => ids.includes(entry.id) ? { ...entry, archivedAt } : entry));
    } catch (requestError) { setError(requestError?.message || "No se pudo archivar el aviso."); }
    finally { setBusy(false); }
  };
  const audienceLabel = (item) => {
    if (item.audience?.type === "admin") return "Administración de Kiosco+";
    if (item.audience?.type === "all") return "Todos los negocios y administración";
    const ids = [...new Set(item.groupedBusinessIds || item.audience?.businessIds || [])].map(String);
    const names = ids.map((id) => accounts.find((account) => String(account.id) === id)?.nombreNegocio || `Negocio ${id.slice(-6)}`);
    if (!names.length) return "Negocio no disponible";
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`;
  };
  const visibleItems = tab === "admin" ? adminItems : historyItems;

  return <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-2"><Megaphone size={20} className="mt-0.5 text-[#D96B32]"/><div><h2 className="font-semibold">Avisos y comunicaciones</h2><p className="mt-1 text-xs text-gray-500">Tu bandeja administrativa está separada de los mensajes enviados a los negocios.</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-semibold">{pushDevices} dispositivo(s) con avisos</span>{pushConfigured === false && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">Falta configurar push</span>}<button type="button" onClick={reload} className="grid h-9 w-9 place-items-center rounded-lg border" aria-label="Actualizar avisos"><RefreshCw size={15}/></button></div></div>
    <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1"><button type="button" onClick={() => setTab("admin")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold ${tab === "admin" ? "bg-white text-[#1C4A44] shadow-sm" : "text-gray-500"}`}><Bell size={15}/>Para administrar {adminItems.length > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] text-white">{adminItems.length}</span>}</button><button type="button" onClick={() => setTab("send")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold ${tab === "send" ? "bg-white text-[#1C4A44] shadow-sm" : "text-gray-500"}`}><Send size={15}/>Enviar aviso</button><button type="button" onClick={() => setTab("history")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-bold ${tab === "history" ? "bg-white text-[#1C4A44] shadow-sm" : "text-gray-500"}`}><History size={15}/>Historial</button></div>

    {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

    {tab === "send" && <div className="mt-4 grid gap-3 rounded-xl border bg-gray-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_210px]"><div className="space-y-2"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} placeholder="Título del aviso" className="w-full rounded-lg border bg-white px-3 py-2 text-sm"/><textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={700} rows={3} placeholder="Escribí el mensaje que van a recibir..." className="w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm"/></div><div className="space-y-2"><AppSelect value={form.level} onChange={(level) => setForm({ ...form, level })} options={[{ value: "info", label: "Información" }, { value: "importante", label: "Importante" }, { value: "urgente", label: "Urgente" }, { value: "mantenimiento", label: "Mantenimiento" }]}/><AppSelect value={form.audienceType} onChange={(audienceType) => setForm({ ...form, audienceType, businessIds: audienceType === "business" ? form.businessIds : [] })} options={[{ value: "all", label: "Todos, incluida administración" }, { value: "business", label: "Negocios elegidos" }, { value: "admin", label: "Sólo administradores" }]}/><button type="button" disabled={busy || !form.title.trim() || !form.message.trim() || (form.audienceType === "business" && !form.businessIds.length)} onClick={publish} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D96B32] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={15}/>{busy ? "Publicando..." : "Publicar aviso"}</button></div>{form.audienceType === "business" && <div className="grid max-h-44 gap-2 overflow-auto rounded-lg border bg-white p-2 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">{accounts.map((account) => <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50"><input type="checkbox" checked={form.businessIds.includes(String(account.id))} onChange={() => toggleBusiness(account.id)}/><span className="truncate">{account.nombreNegocio}</span></label>)}</div>}<div className="grid gap-2 sm:grid-cols-3 lg:col-span-2"><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Publicar desde</span><KioscoDatePicker value={form.publishDate} min={datePickerHelpers.dateValue(new Date())} onChange={(publishDate) => setForm({ ...form, publishDate })}/></div><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Ocultar después</span><KioscoDatePicker value={form.expiresDate} min={form.publishDate || datePickerHelpers.dateValue(new Date())} onChange={(expiresDate) => setForm({ ...form, expiresDate })}/></div><div><span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500">Al tocar, abrir</span><AppSelect value={form.actionView} onChange={(actionView) => setForm({ ...form, actionView })} options={[{value:"",label:"Nada"},{value:"notificaciones",label:"Notificaciones"},{value:"stock",label:"Stock"},{value:"compras",label:"Compras"},{value:"ventas",label:"Ventas"}]}/></div></div></div>}

    {tab !== "send" && <div className="mt-4 space-y-2">{visibleItems.map((item) => <div key={item.id} className="rounded-xl border px-4 py-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{item.title}</b><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${item.level === "urgente" ? "bg-red-100 text-red-800" : item.level === "importante" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{item.level}</span>{(item.groupedIds?.length || 1) > 1 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">{item.groupedIds.length} avisos agrupados</span>}</div><p className="mt-1 text-xs leading-5 text-gray-600">{item.message}</p><p className="mt-2 text-[10px] text-gray-500"><b>Destinatario:</b> {audienceLabel(item)} · <b>Origen:</b> {item.createdBy === "kiosco-cloud" ? "Automático" : "Enviado manualmente"} · {new Date(item.createdAt).toLocaleString("es-AR")}</p></div><button type="button" disabled={busy} onClick={() => archive(item)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"><Archive size={14}/>Archivar</button></div></div>)}{!visibleItems.length && <p className="rounded-xl border border-dashed p-6 text-center text-xs text-gray-400">{tab === "admin" ? "No hay asuntos administrativos pendientes." : "Todavía no hay comunicaciones activas en el historial."}</p>}</div>}
  </section>;
}
