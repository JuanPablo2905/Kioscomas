import React, { useEffect, useState } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Settings2, RotateCcw, Bug, House, HelpCircle,
} from "lucide-react";
import { NAV_ITEMS } from "./domain";
import { buildNotifications } from "../features/notificaciones/notificationRules";
import { syncEngine } from "../cloud/syncEngine";
import { ConfirmDialog } from "./controls";
const kioscoPlusMark = `${import.meta.env.BASE_URL}kiosco-plus-mark.svg`;

function NavCountBadge({ count, tone }) {
  const displayed = count > 99 ? "99+" : count;
  return <span className={`nav-count-badge nav-count-badge--${tone}`} aria-label={`${count} alerta${count === 1 ? "" : "s"}`}>{displayed}</span>;
}

const SYNC_SENSITIVE_FIELD = /(password|contrase(?:n|ñ)a|token|secret|hash|captura|imagen|archivo)/i;

function sanitizeSyncDetail(value, depth = 0) {
  if (depth > 5) return "[detalle resumido]";
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeSyncDetail(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SYNC_SENSITIVE_FIELD.test(key) ? "[dato protegido]" : sanitizeSyncDetail(item, depth + 1)]));
}

function syncOperationLabel(type) {
  return ({ entity_upsert: "Crear o actualizar un registro", entity_delete: "Eliminar un registro", section_set: "Actualizar un área completa", section_delete: "Eliminar los datos de un área", set: "Actualizar datos del negocio", delete: "Eliminar datos del negocio", system_set: "Actualizar datos generales de la aplicación" }[type] || type || "Sincronizar un cambio");
}

function describeSyncValue(value) {
  if (Array.isArray(value)) return `${value.length} elemento${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") return `${Object.keys(value).length} campo${Object.keys(value).length === 1 ? "" : "s"}`;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value === null || value === undefined || value === "") return "Sin valor";
  const text = String(value);
  return text.length > 110 ? `${text.slice(0, 107)}...` : text;
}

function PendingSyncDetail({ operation, title, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!operation) return null;
  const technicalDetail = JSON.stringify(sanitizeSyncDetail(operation), null, 2);
  const value = operation.value;
  const visibleFields = value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).filter(([key]) => !SYNC_SENSITIVE_FIELD.test(key)).slice(0, 10) : [];
  const copyDetail = async () => { try { await navigator.clipboard.writeText(technicalDetail); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onMouseDown={onClose}><section className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 text-gray-900 shadow-2xl" onMouseDown={(event)=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Detalle del cambio pendiente"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">ESPERANDO ENVÍO</span><h2 className="mt-2 text-lg font-bold">Detalle del cambio pendiente</h2><p className="mt-1 text-sm text-gray-600">Esto es exactamente lo que la app está intentando enviar.</p></div><button onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg border p-2 hover:bg-gray-100"><X size={17}/></button></div><div className="mt-4 grid gap-2 rounded-xl border bg-gray-50 p-3 text-sm"><div><span className="block text-xs font-semibold text-gray-500">Qué quiere hacer</span><b>{syncOperationLabel(operation.type)}</b></div><div><span className="block text-xs font-semibold text-gray-500">Área o registro</span><b>{title}</b></div><div className="grid grid-cols-2 gap-3"><div><span className="block text-xs font-semibold text-gray-500">Creado</span>{operation.createdAt ? new Date(operation.createdAt).toLocaleString("es-AR") : "Sin fecha"}</div><div><span className="block text-xs font-semibold text-gray-500">Identificador</span><span className="break-all font-mono text-xs">{operation.entityId || operation.section || operation.key || operation.id}</span></div></div><div className="grid grid-cols-2 gap-3"><div><span className="block text-xs font-semibold text-gray-500">Negocio</span><span className="break-all text-xs">{operation.tenantId || "Sin identificar"}</span></div><div><span className="block text-xs font-semibold text-gray-500">Dispositivo</span><span className="break-all font-mono text-[10px]">{operation.deviceId || "Sin identificar"}</span></div></div></div><div className="mt-4"><h3 className="text-sm font-bold">Datos principales</h3>{visibleFields.length ? <div className="mt-2 divide-y rounded-xl border">{visibleFields.map(([key, item])=><div key={key} className="grid grid-cols-[minmax(90px,0.8fr)_1.4fr] gap-3 px-3 py-2 text-xs"><b className="break-words text-gray-600">{key}</b><span className="break-words">{describeSyncValue(item)}</span></div>)}</div> : <p className="mt-2 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">{describeSyncValue(value)}</p>}</div><details className="mt-4 rounded-xl border bg-gray-950 text-white"><summary className="cursor-pointer px-3 py-2 text-xs font-bold">Ver detalle técnico para diagnóstico</summary><pre className="max-h-56 overflow-auto border-t border-gray-700 p-3 text-[10px] leading-4 whitespace-pre-wrap">{technicalDetail}</pre></details><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={copyDetail} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50">{copied ? "Detalle copiado" : "Copiar detalle"}</button><button onClick={onClose} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">Cerrar</button></div></section></div>;
}

export function Sidebar({ current, onNavigate, cuenta, identidad, permisos, onLogout, products, data, onReturnAdmin, menuOrder = [], onMenuOrderChange, onOpenSettings, onReportProblem, onGlobalScan, onHelp, syncStatus, onSyncNow, demoMode = false }) {
  const [ordenando, setOrdenando] = useState(false);
  const [syncReviewOpen, setSyncReviewOpen] = useState(false);
  const [syncReview, setSyncReview] = useState({ conflicts: [], pending: [] });
  const [pendingDiscardId, setPendingDiscardId] = useState(null);
  const [pendingDetailId, setPendingDetailId] = useState(null);
  useEffect(() => {
    if (syncStatus?.conflicts || syncStatus?.pending) return;
    setSyncReviewOpen(false);
    setSyncReview({ conflicts: [], pending: [] });
  }, [syncStatus?.conflicts, syncStatus?.pending]);
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
  const entityLabel = (entity) => ({ products: "Producto", proveedores: "Proveedor", auditoria: "Auditoría", tutorialProgress: "Tutorial" }[entity] || "Registro");
  const sectionLabel = (section) => ({
    caja: "Caja y movimientos",
    tickets: "Ventas y tickets",
    clientes: "Clientes y fiado",
    comprasItems: "Lista de compras",
    pedidos: "Pedidos a proveedores",
    gastos: "Gastos",
    ventasSuspendidas: "Ventas suspendidas",
    inventarios: "Conteos de stock",
    perdidas: "Vencimientos y pérdidas",
    cart: "Carrito de venta",
    cajaAbierta: "Estado de la caja",
    promociones: "Promociones",
    comprobantes: "Comprobantes",
    movimientosStock: "Movimientos de stock",
  }[section] || section || null);
  const pendingTitle = (operation) => operation?.value?.nombre
    || (operation?.entity ? entityLabel(operation.entity) : null)
    || sectionLabel(operation?.section)
    || (operation?.key === "cuentas" ? "Cuentas y negocios" : operation?.key)
    || "Datos del negocio";
  const pendingDetail = syncReview.pending.find((operation) => operation.id === pendingDetailId) || null;
  const conflictTitle = (conflict) => {
    const value = conflict?.localOperation?.value || conflict?.serverValue || {};
    return value.nombre || value.descripcion || `${entityLabel(conflict?.entity)} #${conflict?.entityId || ""}`;
  };
  const refreshSyncReview = async (closeWhenEmpty = false) => {
    const review = await syncEngine.getPendingReview();
    setSyncReview(review);
    if (closeWhenEmpty && !review.conflicts.length && !review.pending.length) setSyncReviewOpen(false);
    return review;
  };
  const openSyncReview = async () => {
    if (!syncStatus?.conflicts && !syncStatus?.pending) {
      onSyncNow?.();
      return;
    }
    await refreshSyncReview();
    setSyncReviewOpen((value) => !value);
  };
  const resolveSyncConflict = async (operationId, strategy) => {
    await syncEngine.resolveConflict(operationId, strategy);
    if (strategy === "local") await onSyncNow?.();
    await refreshSyncReview(true);
  };
  const discardPendingSync = async () => {
    if (!pendingDiscardId) return;
    await syncEngine.discardPending(pendingDiscardId);
    setPendingDiscardId(null);
    await refreshSyncReview(true);
  };

  return (
    <div className="app-sidebar w-56 shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <ConfirmDialog open={Boolean(pendingDiscardId)} title="Descartar cambio pendiente" message="Se eliminará únicamente este intento trabado. Los datos que ya llegaron a la nube no se modificarán." confirmLabel="Descartar cambio" danger onCancel={()=>setPendingDiscardId(null)} onConfirm={discardPendingSync}/>
      <PendingSyncDetail operation={pendingDetail} title={pendingDetail ? pendingTitle(pendingDetail) : ""} onClose={()=>setPendingDetailId(null)}/>
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

      <div className="sidebar-footer relative px-4 py-4 border-t border-gray-100 text-sm">
        {syncReviewOpen && <div className="absolute bottom-[calc(100%-8px)] left-3 right-3 z-40 max-h-80 overflow-y-auto rounded-xl border bg-white p-3 text-gray-900 shadow-xl"><div className="mb-2 flex items-start justify-between gap-2"><div><b className="text-sm">Pendiente de sincronización</b><p className="mt-0.5 text-[11px] text-gray-500">Revisá solamente los cambios que todavía no llegaron a la nube.</p></div><button onClick={()=>setSyncReviewOpen(false)} aria-label="Cerrar" className="rounded p-1 hover:bg-gray-100"><X size={15}/></button></div>{syncStatus?.error&&<div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] leading-4 text-red-800"><b>No se pudieron enviar todavía.</b><p className="mt-0.5">{syncStatus.error}</p>{/sesión|permiso/i.test(syncStatus.error)&&<button onClick={()=>{setSyncReviewOpen(false);onOpenSettings?.();}} className="mt-2 rounded-md bg-red-700 px-2 py-1.5 font-semibold text-white">Abrir configuración</button>}</div>}<div className="space-y-2">{syncReview.conflicts.map((conflict)=><div key={conflict.operationId} className="rounded-lg border border-purple-200 bg-purple-50 p-2"><div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900"><span className="h-2 w-2 rounded-full bg-purple-500"/>{entityLabel(conflict.entity)} en conflicto</div><p className="mt-1 break-words text-xs font-medium">{conflictTitle(conflict)}</p><p className="mt-1 text-[10px] leading-4 text-gray-600">Se modificó también desde otro dispositivo. Elegí la versión de la nube o reenviá la de este equipo.</p>{conflict.detectedAt&&<p className="mt-1 text-[10px] text-gray-500">Detectado: {new Date(conflict.detectedAt).toLocaleString("es-AR")}</p>}<div className="mt-2 grid grid-cols-2 gap-1"><button onClick={()=>resolveSyncConflict(conflict.operationId,"cloud")} className="rounded-md border bg-white px-2 py-1.5 text-[10px] font-semibold">Usar la nube</button><button onClick={()=>resolveSyncConflict(conflict.operationId,"local")} className="rounded-md bg-purple-700 px-2 py-1.5 text-[10px] font-semibold text-white">Conservar este equipo</button></div></div>)}{syncReview.pending.map((operation)=><div key={operation.id} role="button" tabIndex={0} onClick={()=>setPendingDetailId(operation.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setPendingDetailId(operation.id);}}} className="cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2 transition-colors hover:border-amber-400"><div className="text-xs font-semibold text-amber-900">Cambio esperando conexión</div><p className="mt-1 break-words text-xs">{pendingTitle(operation)}</p><div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-amber-800"><span>Tocá para ver qué contiene</span><ChevronRight size={13}/></div><button onClick={(event)=>{event.stopPropagation();setPendingDiscardId(operation.id);}} className="mt-2 w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-900">Descartar este cambio trabado</button></div>)}{!syncReview.conflicts.length&&!syncReview.pending.length&&<p className="rounded-lg bg-green-50 p-2 text-xs text-green-800">Ya no quedan cambios pendientes.</p>}</div><button onClick={async()=>{await onSyncNow?.();await refreshSyncReview(true);}} className="mt-3 w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white">Volver a sincronizar</button></div>}
        <button onClick={openSyncReview} aria-expanded={syncReviewOpen} title={syncStatus?.error || "Estado de sincronización"} className="mb-3 flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs"><span className={`h-2 w-2 shrink-0 rounded-full ${syncStatus?.state === "error" ? "bg-red-500" : syncStatus?.state === "conflict" ? "bg-purple-500" : syncStatus?.state === "offline" ? "bg-amber-500" : syncStatus?.state === "syncing" ? "animate-pulse bg-blue-500" : "bg-green-500"}`}/><span className="min-w-0 flex-1 truncate">{syncStatus?.mode === "cloud" ? syncStatus.state === "syncing" ? "Sincronizando..." : syncStatus.conflicts ? `${syncStatus.conflicts} conflicto(s) para revisar` : syncStatus.pending ? `${syncStatus.pending} cambio(s) pendiente(s)` : "Nube sincronizada" : "Datos locales"}</span>{(syncStatus?.conflicts||syncStatus?.pending)>0&&<ChevronRight size={13} className={`shrink-0 transition-transform ${syncReviewOpen?"-rotate-90":"rotate-90"}`}/>}</button>
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
