import React, { useState } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Settings2, RotateCcw, Bug, House, HelpCircle,
} from "lucide-react";
import { NAV_ITEMS } from "./domain";
import { buildNotifications } from "../features/notificaciones/notificationRules";
const kioscoPlusMark = `${import.meta.env.BASE_URL}kiosco-plus-mark.svg`;

function NavCountBadge({ count, tone }) {
  const displayed = count > 99 ? "99+" : count;
  return <span className={`nav-count-badge nav-count-badge--${tone}`} aria-label={`${count} alerta${count === 1 ? "" : "s"}`}>{displayed}</span>;
}

export function Sidebar({ current, onNavigate, cuenta, identidad, permisos, onLogout, products, data, onReturnAdmin, menuOrder = [], onMenuOrderChange, onOpenSettings, onReportProblem, onGlobalScan, onHelp, syncStatus, onSyncNow, demoMode = false }) {
  const [ordenando, setOrdenando] = useState(false);
  const reposicionPendiente = (products || []).filter(
    (p) => p.vitrina <= p.alertaVitrina
  ).length;
  const stockBajo = (products || []).filter(
    (p) => p.deposito <= p.minimo
  ).length;
  const normalizedOrder = [...menuOrder.filter((id) => NAV_ITEMS.some((item) => item.id === id)), ...NAV_ITEMS.map((item) => item.id).filter((id) => !menuOrder.includes(id))];
  const itemsVisibles = normalizedOrder.map((id) => NAV_ITEMS.find((item) => item.id === id)).filter((item) => item && permisos.includes(item.id));
  const moveItem = (id, direction) => {
    const next = [...normalizedOrder];
    const visibleIndex = itemsVisibles.findIndex((item) => item.id === id);
    const neighbor = itemsVisibles[visibleIndex + direction];
    if (visibleIndex < 0 || !neighbor) return;
    const index = next.indexOf(id);
    const target = next.indexOf(neighbor.id);
    [next[index], next[target]] = [next[target], next[index]];
    onMenuOrderChange?.(next);
  };
  const notificationCount = data ? buildNotifications(data).length : 0;

  return (
    <div className="app-sidebar w-56 shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <div className="mobile-app-header min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {cuenta?.imagenNegocio ? <span className="flex h-9 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1"><img src={cuenta.imagenNegocio} alt="" className="max-h-full max-w-full object-contain"/></span> : <img src={kioscoPlusMark} alt="Kiosco+" className="h-9 w-9 shrink-0 object-contain"/>}
          <span className="truncate text-sm font-semibold">{cuenta?.nombreNegocio || "Kiosco+"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button data-tour="global-scan" onClick={onGlobalScan} aria-label="Escanear producto o ticket" className="mobile-header-action"><ScanLine size={18}/></button>
          <button data-tour="help-button" onClick={onHelp} aria-label="Ayuda de esta sección" className="mobile-header-action"><HelpCircle size={18}/></button>
          <button data-tour="settings-button" onClick={onOpenSettings} aria-label="Configuración" className="mobile-header-action"><Settings2 size={18}/></button>
          <button onClick={onReportProblem} aria-label="Reportar un problema" className="mobile-header-action text-red-600"><Bug size={18}/></button>
          <button onClick={onLogout} aria-label={demoMode ? "Restablecer demostración" : "Cerrar sesión"} className="mobile-header-action"><LogOut size={18}/></button>
        </div>
      </div>
      <div className="sidebar-brand px-5 py-5 flex items-center gap-2">
        {cuenta?.imagenNegocio ? <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1"><img src={cuenta.imagenNegocio} alt="" className="max-h-full max-w-full object-contain"/></span> : <img src={kioscoPlusMark} alt="Kiosco+" className="h-9 w-9 shrink-0 object-contain"/>}
        <span className="font-semibold text-gray-900 truncate">
          {cuenta?.nombreNegocio || "Kiosco+"}
        </span>
      </div>

      <nav data-tour="main-navigation" className="app-sidebar-nav flex-1 px-3 space-y-1">
        {onReturnAdmin && (
          <button
            onClick={onReturnAdmin}
            className="sidebar-admin-return mb-3 min-h-10 w-full break-words rounded-lg bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            ← Volver al panel de la app
          </button>
        )}
        <button
          onClick={() => onNavigate("home")}
          className={`sidebar-home-nav w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            current === "home"
              ? "sidebar-nav-active bg-gray-100 text-gray-900 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <House className="mobile-nav-icon" size={18}/>
          Inicio
        </button>
        <div className="sidebar-menu-heading mb-2 flex items-center justify-between px-3 pt-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Menú</span><div className="flex gap-1">{ordenando && <button onClick={() => onMenuOrderChange?.(NAV_ITEMS.map((item) => item.id))} title="Restablecer orden" className="rounded p-1 text-gray-400 hover:bg-gray-100"><RotateCcw size={14}/></button>}<button onClick={() => setOrdenando((value) => !value)} title="Ordenar menú" className={`rounded p-1 ${ordenando ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-100"}`}><Settings2 size={14}/></button></div></div>
        {itemsVisibles.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <div key={item.id} className="sidebar-nav-item flex items-center gap-1">
            <button
              onClick={() => !ordenando && onNavigate(item.id)}
              className={`min-w-0 flex-1 flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "sidebar-nav-active bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="shrink-0" size={18} />
                <span className="desktop-nav-label min-w-0 truncate">{item.label}</span>
                <span className="mobile-nav-label min-w-0">{item.mobileLabel || item.label}</span>
              </span>
              {item.id === "vitrina" && reposicionPendiente > 0 && (
                <NavCountBadge count={reposicionPendiente} tone="amber" />
              )}
              {item.id === "stock" && stockBajo > 0 && (
                <NavCountBadge count={stockBajo} tone="red" />
              )}
              {item.id === "notificaciones" && notificationCount > 0 && (
                <NavCountBadge count={notificationCount} tone="blue" />
              )}
            </button>
            {ordenando && <div className="flex shrink-0 flex-col"><button onClick={() => moveItem(item.id, -1)} className="text-gray-400 hover:text-gray-900"><ArrowUpCircle size={14}/></button><button onClick={() => moveItem(item.id, 1)} className="text-gray-400 hover:text-gray-900"><ArrowDownCircle size={14}/></button></div>}
            </div>
          );
        })}

        {permisos.includes("administracion") && (
          <div className="sidebar-admin-nav pt-2 mt-2 border-t border-gray-100">
            <button
              onClick={() => onNavigate("administracion")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                current === "administracion"
                  ? "sidebar-nav-active bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Shield className="shrink-0" size={18} />
              <span className="desktop-nav-label">Administración</span>
              <span className="mobile-nav-label">Admin.</span>
            </button>
          </div>
        )}
      </nav>

      <div className="sidebar-footer px-4 py-4 border-t border-gray-100 text-sm">
        <button onClick={onSyncNow} title={syncStatus?.error || "Estado de sincronización"} className="mb-3 flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs"><span className={`h-2 w-2 shrink-0 rounded-full ${syncStatus?.state === "error" ? "bg-red-500" : syncStatus?.state === "conflict" ? "bg-purple-500" : syncStatus?.state === "offline" ? "bg-amber-500" : syncStatus?.state === "syncing" ? "animate-pulse bg-blue-500" : "bg-green-500"}`}/><span className="min-w-0 flex-1 truncate">{syncStatus?.mode === "cloud" ? syncStatus.state === "syncing" ? "Sincronizando..." : syncStatus.conflicts ? `${syncStatus.conflicts} conflicto(s) para revisar` : syncStatus.pending ? `${syncStatus.pending} cambio(s) pendiente(s)` : "Nube sincronizada" : "Datos locales"}</span></button>
        <p className="text-gray-500 truncate">
          {identidad?.nombre} · @{cuenta?.usuario}
        </p>
        <span className="inline-block text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-1">
          {demoMode ? "Demostración" : identidad?.rol}
        </span>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-1"><button data-tour="settings-button" onClick={onOpenSettings} className="flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><Settings2 size={14}/><span className="truncate">Configurar</span></button><button data-tour="help-button" onClick={onHelp} title="Ayuda de esta sección" className="rounded-lg border px-2 py-1.5 text-gray-600 hover:bg-gray-50"><HelpCircle size={14}/></button><button data-tour="global-scan" onClick={onGlobalScan} title="Escanear producto o ticket" className="rounded-lg border px-2 py-1.5 text-gray-600 hover:bg-gray-50"><ScanLine size={14}/></button><button onClick={onReportProblem} title="Reportar problema" className="rounded-lg border px-2 py-1.5 text-red-600 hover:bg-red-50"><Bug size={14}/></button></div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 mt-2 text-gray-900 font-medium hover:opacity-70"
        >
          <LogOut size={16} />
          {demoMode ? "Restablecer demo" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}


export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header mb-4 min-w-0">
      <div className="section-header-row flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-bold text-gray-900">{title}</h1>
        {actions && <div className="section-header-actions flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-1 break-words text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
