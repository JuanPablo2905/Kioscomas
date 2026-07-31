import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Plus, X } from "lucide-react";
import { CATEGORIES, formatQuantity, money, unidadInfo } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect } from "../../shared/controls";
import { applyInventory, inventoryDifference, stockTotal } from "./inventoryRules";

function NuevoConteoModal({ onClose, onStart }) {
  const [category, setCategory] = useState("Todas");
  const categoryOptions = ["Todas", ...CATEGORIES.filter((item) => item !== "Sin categoría")].map((value) => ({ value, label: value }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4"><div data-tour="inventory-start-form" className="max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Nuevo conteo físico</h2><button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" aria-label="Cerrar"><X size={20}/></button></div><label className="mb-1 block text-sm">Alcance</label><AppSelect value={category} onChange={setCategory} className="mb-5 w-full" options={categoryOptions}/><div className="grid grid-cols-2 gap-2"><button onClick={onClose} className="min-h-11 rounded-lg border px-3 py-2 text-sm">Cancelar</button><button data-tour="inventory-start" onClick={() => onStart(category)} className="min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">Comenzar</button></div></div></div>;
}

export function InventoryView({ products, setProducts, inventarios = [], setInventarios, identidad }) {
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState(null);
  const rows = useMemo(() => draft ? products.filter((product) => draft.category === "Todas" || product.categoria === draft.category) : [], [draft, products]);
  const entries = draft?.entries || {};
  const counted = rows.filter((product) => entries[product.id] !== undefined);
  const summary = counted.reduce((acc, product) => { const diff = inventoryDifference(product, entries[product.id]); acc.units += diff.diferencia; acc.cost += diff.costoDiferencia; return acc; }, { units: 0, cost: 0 });
  const setCount = (id, value) => setDraft((current) => ({ ...current, entries: { ...current.entries, [id]: value } }));
  const confirm = () => {
    const result = counted.map((product) => ({ productId: product.id, nombre: product.nombre, ...inventoryDifference(product, entries[product.id]) }));
    setProducts((current) => applyInventory(current, result));
    setInventarios((current) => [{ id: Date.now(), fecha: new Date().toISOString(), categoria: draft.category, responsable: identidad?.nombre || "Sin identificar", items: result, diferenciaCosto: summary.cost }, ...current]);
    setDraft(null);
  };
  return (
    <div className="p-4 sm:p-8">
      <SectionHeader
        title="Conteo físico"
        subtitle="Compará lo que hay realmente con el stock registrado y aprobá los ajustes."
        actions={!draft && <button data-tour="inventory-new" onClick={() => setModal(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white sm:w-auto"><Plus size={16}/>Nuevo conteo</button>}
      />
      {draft ? <>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Alcance</p><p className="truncate font-bold">{draft.category}</p></div>
          <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Contados</p><p className="font-bold">{counted.length} / {rows.length}</p></div>
          <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Diferencia física</p><p className={`truncate font-bold ${summary.units < 0 ? "text-red-600" : "text-green-600"}`}>{formatQuantity(summary.units)}</p></div>
          <div className="min-w-0 rounded-xl border p-3 sm:p-4"><p className="text-xs text-gray-500">Diferencia a costo</p><p className={`truncate font-bold ${summary.cost < 0 ? "text-red-600" : "text-green-600"}`}>{money(summary.cost)}</p></div>
        </div>
        <div className="space-y-2 sm:max-h-[52vh] sm:overflow-y-auto sm:pr-1">
          {rows.map((product) => {
            const has = entries[product.id] !== undefined;
            const diff = has ? inventoryDifference(product, entries[product.id]) : null;
            return <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="col-span-2 min-w-0 sm:col-span-1"><p className="truncate font-medium">{product.nombre}</p><p className="text-xs text-gray-500">Esperado: {formatQuantity(stockTotal(product))} {unidadInfo(product.unidad).baseAbbr}</p></div>
              <input data-tour="inventory-count" type="number" min="0" step="any" inputMode="decimal" value={entries[product.id] ?? ""} onChange={(e) => setCount(product.id, e.target.value)} placeholder="Cantidad física" className="min-h-11 min-w-0 w-full rounded-lg border px-3 py-2 text-sm sm:w-36"/>
              <p className={`min-w-[7rem] text-right text-sm font-semibold sm:w-32 ${!diff ? "text-gray-300" : diff.diferencia < 0 ? "text-red-600" : diff.diferencia > 0 ? "text-green-600" : "text-gray-500"}`}>{diff ? `${diff.diferencia > 0 ? "+" : ""}${formatQuantity(diff.diferencia)} · ${money(diff.costoDiferencia)}` : "Sin contar"}</p>
            </div>;
          })}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:justify-end"><button onClick={() => setDraft(null)} className="min-h-11 rounded-lg border px-4 py-2 text-sm">Cancelar conteo</button><button data-tour="inventory-approve" disabled={!counted.length} onClick={confirm} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"><CheckCircle2 size={16}/>Aprobar {counted.length} ajuste(s)</button></div>
      </> : <div data-tour="inventory-history">
        <h2 className="mb-3 text-sm font-semibold">Historial de conteos</h2>
        {inventarios.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-400 sm:p-12"><ClipboardCheck className="mx-auto mb-2"/>Todavía no se realizaron conteos físicos.</div> : <div className="space-y-2">{inventarios.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">Conteo {item.categoria}</p><p className="text-xs text-gray-500">{new Date(item.fecha).toLocaleString("es-AR")} · {item.responsable} · {item.items.length} producto(s)</p></div><p className={`shrink-0 font-semibold ${item.diferenciaCosto < 0 ? "text-red-600" : "text-green-600"}`}>{money(item.diferenciaCosto)}</p></div>)}</div>}
      </div>}
      {modal && <NuevoConteoModal onClose={() => setModal(false)} onStart={(category) => { setDraft({ category, entries: {} }); setModal(false); }}/>} 
    </div>
  );
}
