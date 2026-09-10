import React, { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, CheckCircle2, Send, Smartphone } from "lucide-react";
import { DEFAULT_PUSH_PREFERENCES, disablePushNotifications, enablePushNotifications, loadPlatformNotifications, normalizePushPreferences, NOTIFICATION_CATEGORY_OPTIONS, pushCapability, sendPushNotificationTest, updatePushNotificationPreferences } from "./notificationService";

const GROUPS = [
  { id: "account", label: "Cuenta y suscripción", categories: ["subscription", "accounts"] },
  { id: "orders", label: "Pedidos y compras", categories: ["orders", "expenses"] },
  { id: "stock", label: "Stock y vencimientos", categories: ["stock", "expirations"] },
  { id: "sales", label: "Ventas y caja", categories: ["cash"] },
  { id: "system", label: "Sistema y mantenimiento", categories: ["sync", "maintenance"] },
];

export function NotificationSettingsPanel({ preferences = {}, onPreferencesChange, previewMode = false }) {
  const pushPreferences = normalizePushPreferences(preferences.pushNotifications || DEFAULT_PUSH_PREFERENCES);
  const [pushState, setPushState] = useState(() => pushCapability());
  const [pushConfigured, setPushConfigured] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const groupState = useMemo(() => Object.fromEntries(GROUPS.map((group) => {
    const enabled = group.categories.filter((category) => pushPreferences.categories[category] !== false).length;
    return [group.id, enabled === 0 ? "none" : enabled === group.categories.length ? "all" : "mixed"];
  })), [pushPreferences]);

  useEffect(() => {
    loadPlatformNotifications().then((detail) => setPushConfigured(Boolean(detail.pushConfigured))).catch(() => setPushConfigured(null));
  }, []);

  const save = (patch) => {
    const next = normalizePushPreferences({ ...pushPreferences, ...patch });
    onPreferencesChange?.({ pushNotifications: next });
    updatePushNotificationPreferences(next).catch(() => setMessage("La preferencia quedó guardada, pero todavía no pudo enviarse a la nube."));
  };
  const activate = async () => {
    setBusy(true); setMessage("");
    try { await enablePushNotifications(pushPreferences); setPushState("granted"); setMessage("Los avisos quedaron activos en este dispositivo."); }
    catch (error) { setPushState(pushCapability()); setMessage(error?.message || "No se pudieron activar los avisos."); }
    finally { setBusy(false); }
  };
  const deactivate = async () => {
    setBusy(true); setMessage("");
    try { await disablePushNotifications(); setPushState(pushCapability() === "granted" ? "available" : pushCapability()); setMessage("Los avisos se desactivaron en este dispositivo."); }
    catch (error) { setMessage(error?.message || "No se pudieron desactivar los avisos."); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMessage("");
    try { await sendPushNotificationTest(); setMessage("Enviamos un aviso de prueba. Puede tardar unos segundos."); }
    catch (error) { setMessage(error?.message || "No se pudo enviar la prueba."); }
    finally { setBusy(false); }
  };
  const toggleGroup = (group) => {
    const enabled = groupState[group.id] !== "all";
    save({ categories: { ...pushPreferences.categories, ...Object.fromEntries(group.categories.map((category) => [category, enabled])) } });
  };

  if (previewMode) return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>Vista administrativa del negocio</b><p className="mt-1">Podés revisar sus avisos, pero las preferencias pertenecen al dueño y a sus dispositivos.</p></div>;
  return <div className="grid gap-5"><section className="rounded-2xl border bg-white p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E9F5F0] text-[#1C4A44]"><Smartphone size={21}/></span><div><h3 className="font-bold">Avisos en este dispositivo</h3><p className="mt-1 text-xs leading-5 text-gray-500">Los mensajes siempre quedan dentro de Kiosco+. Esto controla los avisos que aparecen fuera de la aplicación.</p></div></div><div className="flex flex-wrap gap-2">{pushState === "granted" ? <><span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-2 text-xs font-bold text-green-800"><CheckCircle2 size={14}/>Activos</span><button disabled={busy} onClick={deactivate} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700"><BellOff size={15}/>Desactivar</button></> : <button disabled={busy || pushConfigured === false || pushState === "denied" || pushState === "unsupported"} onClick={activate} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1C4A44] px-4 text-xs font-bold text-white disabled:opacity-40"><BellRing size={16}/>Activar avisos</button>}</div></div>{pushConfigured === false && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">El servidor todavía no tiene configuradas las claves de notificaciones.</p>}{pushState === "denied" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">El navegador bloqueó los avisos. Habilitalos desde los permisos del sitio o del sistema.</p>}{pushState === "unsupported" && <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">Este navegador no admite notificaciones en segundo plano.</p>}{pushState === "granted" && <button type="button" disabled={busy} onClick={test} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Send size={15}/>Enviar notificación de prueba</button>}{message && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{message}</p>}</section>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-bold">Qué quiero recibir</h3><p className="mt-1 text-xs text-gray-500">Elegí grupos simples. Si necesitás más control, abrí la personalización detallada.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{GROUPS.map((group) => <button key={group.id} type="button" onClick={() => toggleGroup(group)} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${groupState[group.id] === "all" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : groupState[group.id] === "mixed" ? "border-amber-300 bg-amber-50" : "bg-gray-50 text-gray-500"}`}><span>{group.label}</span><span className="text-[10px] font-black uppercase">{groupState[group.id] === "all" ? "Activo" : groupState[group.id] === "mixed" ? "Parcial" : "Apagado"}</span></button>)}</div><button type="button" onClick={() => setDetailsOpen((value) => !value)} className="mt-3 text-xs font-bold text-[#1C4A44]">{detailsOpen ? "Ocultar detalle" : "Personalizar en detalle"}</button>{detailsOpen && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{NOTIFICATION_CATEGORY_OPTIONS.map(([id, label]) => <label key={id} className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium"><input type="checkbox" checked={pushPreferences.categories[id] !== false} onChange={(event) => save({ categories: { ...pushPreferences.categories, [id]: event.target.checked } })}/><span>{label}</span></label>)}</div>}</section>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Importancia<select value={pushPreferences.mode} onChange={(event) => save({ mode: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"><option value="all">Todos los avisos elegidos</option><option value="important">Sólo importantes y urgentes</option><option value="none">No avisar fuera de Kiosco+</option></select></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-xs font-semibold">Horario silencioso<input type="checkbox" checked={pushPreferences.quietHoursEnabled} onChange={(event) => save({ quietHoursEnabled: event.target.checked })}/></label>{pushPreferences.quietHoursEnabled && <><label className="text-xs font-semibold text-gray-600">Desde<input type="time" value={pushPreferences.quietStart} onChange={(event) => save({ quietStart: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Hasta<input type="time" value={pushPreferences.quietEnd} onChange={(event) => save({ quietEnd: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm font-normal"/></label></>}</div><p className="mt-3 text-xs text-gray-500">Los avisos urgentes pueden atravesar el horario silencioso. Los demás siguen guardados en el centro de notificaciones.</p></section>
  </div>;
}
