import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, PackageX, X } from "lucide-react";
import { formatQuantity, historialEntry, money, roundQuantity, unidadInfo } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect } from "../../shared/controls";

const diasHasta = (date) => {
  if (!date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
};

function PerdidaModal({ product, onClose, onConfirm }) {
  const info = unidadInfo(product.unidad);
  const disponible = roundQuantity((product.deposito || 0) + (product.vitrina || 0));
  const [cantidad, setCantidad] = useState(String(disponible));
  const [motivo, setMotivo] = useState("Vencimiento");
  const number = Number(cantidad);
  const motivos = ["Vencimiento", "Producto roto", "Mal estado", "Robo o faltante", "Otro"].map((value) => ({ value, label: value }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
    <div data-tour="loss-form" className="max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-lg font-bold">Registrar pérdida</h2><p className="break-words text-sm text-gray-500">{product.nombre}</p></div>
        <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" aria-label="Cerrar"><X size={20}/></button>
      </div>
      <label className="mb-1 block text-sm">Cantidad ({info.baseAbbr})</label>
      <input type="number" inputMode="decimal" step="any" min="0" max={disponible} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="mb-3 min-h-11 w-full rounded-lg border px-3 py-2"/>
      <p className="mb-3 text-xs text-gray-400">Disponible total: {formatQuantity(disponible)} {info.baseAbbr}</p>
      <label className="mb-1 block text-sm">Motivo</label>
      <AppSelect value={motivo} onChange={setMotivo} className="mb-4 w-full" options={motivos}/>
      <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Pérdida estimada: <b>{money((Number(product.costo) || 0) * (number || 0))}</b></div>
      <div className="grid grid-cols-2 gap-2"><button onClick={onClose} className="min-h-11 rounded-lg border px-3 py-2 text-sm">Cancelar</button><button data-tour="loss-confirm" disabled={!number || number <= 0 || number > disponible} onClick={() => onConfirm({ cantidad: number, motivo })} className="min-h-11 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Registrar descarte</button></div>
    </div>
  </div>;
}

export function VencimientosView({ products, setProducts, perdidas, setPerdidas }) {
  const [discarding, setDiscarding] = useState(null);
  const [filter, setFilter] = useState("todos");
  const rows = useMemo(() => products.filter((p) => p.vencimiento).map((p) => ({ ...p, dias: diasHasta(p.vencimiento) })).sort((a, b) => a.dias - b.dias), [products]);
  const visible = rows.filter((p) => filter === "todos" || (filter === "vencidos" ? p.dias < 0 : filter === "proximos" ? p.dias >= 0 && p.dias <= 30 : p.dias > 30));
  const costoTotal = perdidas.reduce((sum, p) => sum + Number(p.costoTotal || 0), 0);
  const confirm = ({ cantidad, motivo }) => {
    const product = discarding; let remaining = cantidad;
    setProducts((prev) => prev.map((p) => { if (p.id !== product.id) return p; const desdeDeposito = Math.min(Number(p.deposito || 0), remaining); remaining = roundQuantity(remaining - desdeDeposito); const deposito = roundQuantity(p.deposito - desdeDeposito); const vitrina = roundQuantity(Math.max(0, p.vitrina - remaining)); return { ...p, deposito, vitrina, historial: [...(p.historial || []), historialEntry("perdida", `-${cantidad} ${unidadInfo(p.unidad).baseAbbr} · ${motivo}`)] }; }));
    setPerdidas((prev) => [{ id: Date.now(), productId: product.id, nombre: product.nombre, cantidad, unidad: product.unidad, motivo, costoTotal: (Number(product.costo) || 0) * cantidad, fecha: new Date().toISOString() }, ...prev]);
    setDiscarding(null);
  };
  return <div className="p-4 sm:p-8">
    <SectionHeader title="Vencimientos y pérdidas" subtitle="Controlá mercadería próxima a vencer y registrá descartes."/>

    <div data-tour="expiry-summary" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Vencidos</p><p className="text-xl font-bold text-red-600 sm:text-2xl">{rows.filter((p) => p.dias < 0).length}</p></div>
      <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Vencen en 30 días</p><p className="text-xl font-bold text-amber-600 sm:text-2xl">{rows.filter((p) => p.dias >= 0 && p.dias <= 30).length}</p></div>
      <div className="col-span-2 min-w-0 rounded-xl border p-3 sm:col-span-1 sm:p-4"><p className="text-xs text-gray-500">Costo perdido registrado</p><p className="truncate text-xl font-bold text-red-600 sm:text-2xl">{money(costoTotal)}</p></div>
    </div>

    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">{[["todos","Todos"],["vencidos","Vencidos"],["proximos","Próximos"],["vigentes","Vigentes"]].map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`min-h-10 rounded-full border px-4 py-2 text-xs ${filter === id ? "bg-gray-900 text-white" : "bg-white"}`}>{label}</button>)}</div>

    {visible.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center sm:p-12"><CalendarClock className="mx-auto mb-2 text-gray-300"/><p className="text-sm text-gray-400">No hay productos en este grupo. Las fechas se cargan al crear o editar un producto.</p></div> : <div className="space-y-2">{visible.map((p) => {
      const cls = p.dias < 0 ? "border-red-200 bg-red-50" : p.dias <= 30 ? "border-amber-200 bg-amber-50" : "border-gray-200";
      const disponible = roundQuantity((Number(p.deposito) || 0) + (Number(p.vitrina) || 0));
      return <div key={p.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${cls}`}>
        <div className="flex min-w-0 items-start gap-3">
          {p.dias <= 30 && <AlertTriangle size={18} className={`mt-0.5 shrink-0 ${p.dias < 0 ? "text-red-600" : "text-amber-600"}`}/>} 
          <div className="min-w-0"><p className="break-words font-semibold">{p.nombre}</p><p className="mt-0.5 text-xs leading-relaxed text-gray-500">Vence: {new Date(`${p.vencimiento}T00:00:00`).toLocaleDateString("es-AR")} · {p.dias < 0 ? `Venció hace ${Math.abs(p.dias)} día(s)` : p.dias === 0 ? "Vence hoy" : `Faltan ${p.dias} día(s)`}</p></div>
        </div>
        {disponible > 0
          ? <button data-tour="loss-open" onClick={() => setDiscarding(p)} className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 sm:w-auto"><PackageX size={15}/>Registrar pérdida</button>
          : <button disabled className="flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 opacity-40 sm:w-auto"><PackageX size={15}/>Sin stock para descartar</button>}
      </div>;
    })}</div>}

    <div data-tour="loss-history" className="mt-8">
      <h2 className="mb-3 font-semibold">Historial de pérdidas</h2>
      {perdidas.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">Todavía no se registraron pérdidas.</p> : <div className="space-y-2">{perdidas.slice(0,20).map((p) => <div key={p.id} className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium">{p.nombre} · {formatQuantity(p.cantidad)} {unidadInfo(p.unidad).baseAbbr}</p><p className="mt-0.5 text-xs text-gray-400">{p.motivo} · {new Date(p.fecha).toLocaleString("es-AR")}</p></div><b className="shrink-0 text-red-600">-{money(p.costoTotal)}</b></div>)}</div>}
    </div>

    {discarding && <PerdidaModal product={discarding} onClose={() => setDiscarding(null)} onConfirm={confirm}/>} 
  </div>;
}
