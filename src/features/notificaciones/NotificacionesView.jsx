import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronRight, Cloud, Package, PackageCheck, Settings, Store } from "lucide-react";
import { SectionHeader } from "../../shared/layout";
import { buildNotifications } from "./notificationRules";
import { loadPlatformNotifications, markPlatformNotificationRead } from "./notificationService";

const LEVELS = ["critica", "alta", "media", "baja"];
const levelUi = {
  critica: { label: "Críticas", hint: "Atención inmediata", card: "border-red-200 border-l-red-600 bg-red-50/80", icon: "bg-red-600 text-white", badge: "bg-red-600 text-white", text: "text-red-800", count: "text-red-700" },
  alta: { label: "Altas", hint: "Revisar pronto", card: "border-orange-200 border-l-orange-500 bg-orange-50/80", icon: "bg-orange-500 text-white", badge: "bg-orange-500 text-white", text: "text-orange-800", count: "text-orange-700" },
  media: { label: "Medias", hint: "Conviene revisar", card: "border-amber-200 border-l-amber-500 bg-amber-50/80", icon: "bg-amber-400 text-amber-950", badge: "bg-amber-400 text-amber-950", text: "text-amber-900", count: "text-amber-700" },
  baja: { label: "Bajas", hint: "Información", card: "border-slate-200 border-l-slate-400 bg-slate-50/90", icon: "bg-slate-500 text-white", badge: "bg-slate-500 text-white", text: "text-slate-800", count: "text-slate-700" },
};
const icons = { stock: Package, vitrina: Store, pedidos: PackageCheck, reservas: CalendarClock };
const platformIcons = { stock: Package, expirations: AlertTriangle, orders: PackageCheck };
const platformCategoryLabels = { stock: "Stock", expirations: "Vencimientos", orders: "Pedidos", subscription: "Suscripción", maintenance: "Novedades" };

export function NotificacionesView({ data, onNavigate, onOpenNotificationSettings, previewBusinessId = "", previewBusinessName = "" }) {
  const [filter, setFilter] = useState("todas");
  const [platform, setPlatform] = useState([]);
  const [platformError, setPlatformError] = useState("");
  const [pushConfigured, setPushConfigured] = useState(null);
  const [notificationClock, setNotificationClock] = useState(() => Date.now());
  const notifications = useMemo(() => buildNotifications(data, notificationClock), [data, notificationClock]);
  const counts = useMemo(() => Object.fromEntries(LEVELS.map((level) => [level, notifications.filter((item) => item.level === level).length])), [notifications]);
  const visible = filter === "todas" ? notifications : notifications.filter((item) => item.level === filter);
  const groups = LEVELS.map((level) => ({ level, items: visible.filter((item) => item.level === level) })).filter((group) => group.items.length);
  const previewMode = Boolean(previewBusinessId);

  const refreshPlatform = async () => {
    try {
      const detail = await loadPlatformNotifications({ previewBusinessId });
      setPlatform(detail.notifications || []);
      setPushConfigured(Boolean(detail.pushConfigured));
      setPlatformError("");
    } catch (error) { setPlatformError(error?.message || "No se pudieron cargar las novedades de Kiosco+."); }
  };

  useEffect(() => {
    refreshPlatform();
    const timer = setInterval(refreshPlatform, 60000);
    const reloadAfterLogin = () => refreshPlatform();
    window.addEventListener("kiosco-cloud-session-changed", reloadAfterLogin);
    return () => { clearInterval(timer); window.removeEventListener("kiosco-cloud-session-changed", reloadAfterLogin); };
  }, [previewBusinessId]);

  useEffect(() => {
    const timer = setInterval(() => setNotificationClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const openPlatformNotification = async (item) => {
    if (!item.readAt) {
      try {
        const result = await markPlatformNotificationRead(item.id, { previewBusinessId });
        setPlatform((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, readAt: result.readAt } : entry));
      } catch {}
    }
    if (item.action?.view) onNavigate(item.action.view);
  };

  return <div data-tour="notifications-center" className="p-4 sm:p-8">
    <SectionHeader title="Centro de notificaciones" subtitle="Primero aparecen los asuntos más urgentes. Tocá una tarjeta para ir a resolverla." />
    {previewMode && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><b>Vista administrativa de {previewBusinessName || "este negocio"}</b><p className="mt-1 text-xs">Estás revisando qué ve este comercio. Sus preferencias y el estado de lectura del dueño no se modifican.</p></div>}

    <section className="mb-6 rounded-2xl border border-emerald-100 bg-[#F5FAF7] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1C4A44] text-white"><Cloud size={19}/></span><div><h2 className="font-bold text-[#173F3A]">Novedades de Kiosco+</h2><p className="text-xs leading-5 text-gray-600">Mensajes del administrador, avisos de mantenimiento y novedades importantes.</p></div></div>{!previewMode && <button type="button" onClick={onOpenNotificationSettings} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold text-[#173F3A]"><Settings size={15}/>Configurar avisos</button>}</div>
      {pushConfigured === false && !previewMode && <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">Los mensajes quedan acá; los avisos fuera de la app todavía no están habilitados en el servidor.</p>}
      {platformError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{platformError}</p>}
      {platform.length > 0 ? <div className="mt-4 space-y-2">{platform.map((item) => {
        const colors = item.level === "urgente" ? "border-red-200 bg-red-50 text-red-900" : item.level === "mantenimiento" ? "border-blue-200 bg-blue-50 text-blue-900" : item.level === "importante" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-100 bg-white text-gray-800";
        const PlatformIcon = platformIcons[item.category] || Bell;
        return <button type="button" key={item.id} onClick={() => openPlatformNotification(item)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${colors} ${item.readAt ? "opacity-65" : "shadow-sm"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-current/15 bg-white/70"><PlatformIcon size={17}/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b className="break-words text-sm">{item.title}</b>{!item.readAt && <span className="rounded-full bg-[#D96B32] px-2 py-0.5 text-[9px] font-black uppercase text-white">Nuevo</span>}<span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-[9px] font-bold uppercase">{platformCategoryLabels[item.category] || "Aviso"}</span></span><span className="mt-1 block break-words text-xs leading-5 opacity-80">{item.message}</span><span className="mt-1 block text-[10px] opacity-55">{new Date(item.publishAt || item.createdAt).toLocaleString("es-AR")}</span></span>{item.action?.view && <ChevronRight size={17} className="mt-2 shrink-0"/>}</button>;
      })}</div> : !platformError && <p className="mt-4 text-xs text-gray-500">No hay mensajes generales pendientes.</p>}
    </section>

    <div data-tour="notifications-filters" className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4"><button onClick={() => setFilter("todas")} className={`min-h-20 rounded-xl border p-3 text-left transition-all ${filter === "todas" ? "border-gray-900 bg-gray-900 text-white shadow-md" : "bg-white hover:-translate-y-0.5 hover:shadow-sm"}`}><span className="block text-[11px] font-bold uppercase tracking-wide opacity-65">Todas</span><strong className="mt-1 block text-2xl leading-none">{notifications.length}</strong><span className="mt-1 block text-xs opacity-70">Alertas pendientes</span></button>{LEVELS.slice(0, 3).map((level) => { const ui = levelUi[level]; return <button key={level} onClick={() => setFilter(level)} className={`min-h-20 rounded-xl border p-3 text-left transition-all ${filter === level ? `${ui.card} ring-2 ring-current shadow-md` : `${ui.card} hover:-translate-y-0.5 hover:shadow-sm`}`}><span className={`block text-[11px] font-black uppercase tracking-wide ${ui.text}`}>{ui.label}</span><strong className={`mt-1 block text-2xl leading-none ${ui.count}`}>{counts[level]}</strong><span className={`mt-1 block text-xs ${ui.text} opacity-75`}>{ui.hint}</span></button>; })}</div>

    {visible.length === 0 ? <div data-tour="notifications-list" className="rounded-xl border border-dashed p-8 text-center sm:p-14"><CheckCircle2 size={32} className="mx-auto mb-3 text-green-500"/><p className="font-semibold">No hay alertas en este grupo</p><p className="mt-1 text-sm text-gray-400">El negocio está al día.</p></div> : <div data-tour="notifications-list" className="space-y-6">{groups.map(({ level, items }) => { const ui = levelUi[level]; return <section key={level} aria-label={`Notificaciones ${ui.label.toLowerCase()}`}><div className="mb-2 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${ui.icon.split(" ")[0]}`}/><h2 className="text-sm font-bold">{ui.label}</h2><span className="rounded-full border px-2 py-0.5 text-[10px] font-bold opacity-65">{items.length}</span><span className="text-xs opacity-50">{ui.hint}</span></div><div className="space-y-2">{items.map((item) => { const Icon = icons[item.type] || (item.level === "critica" ? AlertTriangle : Bell); return <button key={item.id} onClick={() => onNavigate(item.view)} className={`group relative flex min-h-[5.25rem] w-full items-center gap-3 overflow-hidden rounded-xl border border-l-4 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${ui.card}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm ${ui.icon}`}><Icon size={19}/></span><span className="min-w-0 flex-1"><span className={`block break-words text-sm font-bold ${ui.text}`}>{item.title}</span><span className={`mt-1 block break-words text-xs leading-relaxed ${ui.text} opacity-75`}>{item.detail}</span></span><span className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${ui.badge}`}>{level}</span><span className={`hidden items-center gap-1 text-[10px] font-semibold opacity-60 sm:flex ${ui.text}`}>Abrir sección <ChevronRight size={13}/></span></span><ChevronRight size={18} className={`shrink-0 opacity-55 sm:hidden ${ui.text}`}/></button>; })}</div></section>; })}</div>}
  </div>;
}
