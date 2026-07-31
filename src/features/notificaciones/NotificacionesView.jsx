import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Package, Store } from "lucide-react";
import { SectionHeader } from "../../shared/layout";
import { buildNotifications } from "./notificationRules";

const LEVELS = ["critica", "alta", "media", "baja"];
const levelUi = {
  critica: {
    label: "Críticas",
    hint: "Atención inmediata",
    card: "border-red-200 border-l-red-600 bg-red-50/80",
    icon: "bg-red-600 text-white",
    badge: "bg-red-600 text-white",
    text: "text-red-800",
    count: "text-red-700",
  },
  alta: {
    label: "Altas",
    hint: "Revisar pronto",
    card: "border-orange-200 border-l-orange-500 bg-orange-50/80",
    icon: "bg-orange-500 text-white",
    badge: "bg-orange-500 text-white",
    text: "text-orange-800",
    count: "text-orange-700",
  },
  media: {
    label: "Medias",
    hint: "Conviene revisar",
    card: "border-amber-200 border-l-amber-500 bg-amber-50/80",
    icon: "bg-amber-400 text-amber-950",
    badge: "bg-amber-400 text-amber-950",
    text: "text-amber-900",
    count: "text-amber-700",
  },
  baja: {
    label: "Bajas",
    hint: "Información",
    card: "border-slate-200 border-l-slate-400 bg-slate-50/90",
    icon: "bg-slate-500 text-white",
    badge: "bg-slate-500 text-white",
    text: "text-slate-800",
    count: "text-slate-700",
  },
};
const icons = { stock: Package, vitrina: Store };

export function NotificacionesView({ data, onNavigate }) {
  const [filter, setFilter] = useState("todas");
  const notifications = useMemo(() => buildNotifications(data), [data]);
  const counts = useMemo(() => Object.fromEntries(LEVELS.map((level) => [
    level,
    notifications.filter((item) => item.level === level).length,
  ])), [notifications]);
  const visible = filter === "todas" ? notifications : notifications.filter((item) => item.level === filter);
  const groups = LEVELS
    .map((level) => ({ level, items: visible.filter((item) => item.level === level) }))
    .filter((group) => group.items.length);

  return (
    <div data-tour="notifications-center" className="p-4 sm:p-8">
      <SectionHeader title="Centro de notificaciones" subtitle="Primero aparecen los asuntos más urgentes. Tocá una tarjeta para ir a resolverla." />

      <div data-tour="notifications-filters" className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <button
          onClick={() => setFilter("todas")}
          className={`min-h-20 rounded-xl border p-3 text-left transition-all ${filter === "todas" ? "border-gray-900 bg-gray-900 text-white shadow-md" : "bg-white hover:-translate-y-0.5 hover:shadow-sm"}`}
        >
          <span className="block text-[11px] font-bold uppercase tracking-wide opacity-65">Todas</span>
          <strong className="mt-1 block text-2xl leading-none">{notifications.length}</strong>
          <span className="mt-1 block text-xs opacity-70">Alertas pendientes</span>
        </button>
        {LEVELS.slice(0, 3).map((level) => {
          const ui = levelUi[level];
          return (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`min-h-20 rounded-xl border p-3 text-left transition-all ${filter === level ? `${ui.card} ring-2 ring-current shadow-md` : `${ui.card} hover:-translate-y-0.5 hover:shadow-sm`}`}
            >
              <span className={`block text-[11px] font-black uppercase tracking-wide ${ui.text}`}>{ui.label}</span>
              <strong className={`mt-1 block text-2xl leading-none ${ui.count}`}>{counts[level]}</strong>
              <span className={`mt-1 block text-xs ${ui.text} opacity-75`}>{ui.hint}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div data-tour="notifications-list" className="rounded-xl border border-dashed p-8 text-center sm:p-14">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" />
          <p className="font-semibold">No hay alertas en este grupo</p>
          <p className="mt-1 text-sm text-gray-400">El negocio está al día.</p>
        </div>
      ) : (
        <div data-tour="notifications-list" className="space-y-6">
          {groups.map(({ level, items }) => {
            const ui = levelUi[level];
            return (
              <section key={level} aria-label={`Notificaciones ${ui.label.toLowerCase()}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${ui.icon.split(" ")[0]}`} />
                  <h2 className="text-sm font-bold">{ui.label}</h2>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold opacity-65">{items.length}</span>
                  <span className="text-xs opacity-50">{ui.hint}</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const Icon = icons[item.type] || (item.level === "critica" ? AlertTriangle : Bell);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.view)}
                        className={`group relative flex min-h-[5.25rem] w-full items-center gap-3 overflow-hidden rounded-xl border border-l-4 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${ui.card}`}
                      >
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm ${ui.icon}`}>
                          <Icon size={19} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block break-words text-sm font-bold ${ui.text}`}>{item.title}</span>
                          <span className={`mt-1 block break-words text-xs leading-relaxed ${ui.text} opacity-75`}>{item.detail}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${ui.badge}`}>{level}</span>
                          <span className={`hidden items-center gap-1 text-[10px] font-semibold opacity-60 sm:flex ${ui.text}`}>Abrir sección <ChevronRight size={13} /></span>
                        </span>
                        <ChevronRight size={18} className={`shrink-0 opacity-55 sm:hidden ${ui.text}`} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
