import React, { useMemo, useState } from "react";
import { Check, FileText, Minus, PackageCheck, Plus, Search, Trash2 } from "lucide-react";
import { money } from "../../shared/domain";

const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";

function ProductQuantityBuilder({ products = [], onSave, actionLabel }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => `${p.nombre} ${p.codigo || ""} ${p.familia || ""} ${p.variante || ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);
  const add = (product) => {
    setItems((prev) => prev.some((x) => x.productId === product.id)
      ? prev.map((x) => x.productId === product.id ? { ...x, cantidad: x.cantidad + 1 } : x)
      : [...prev, { productId: product.id, nombre: product.nombre, precio: Number(product.venta || 0), cantidad: 1 }]);
    setQuery("");
  };
  const quantity = (id, value) => setItems((prev) => prev.map((x) => x.productId === id ? { ...x, cantidad: value === "" ? "" : Math.max(1, Number(value) || 1) } : x));
  const total = items.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0);
  return <div>
    <div className="relative">
      <Search size={16} className="absolute left-3 top-3 opacity-45" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto, variante o código..." className={`${inputClass} pl-9`} />
      {matches.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-xl">{matches.map((p) => <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"><span className="min-w-0 flex-1 truncate">{p.nombre}</span><b className="shrink-0">{money(p.venta)}</b></button>)}</div>}
    </div>
    <div className="mt-3 space-y-2">{items.map((item) => <div key={item.productId} className="grid min-w-0 items-center gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_120px_130px_auto]"><span className="min-w-0 break-words text-sm font-medium">{item.nombre}</span><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:contents"><div className="flex min-w-0 overflow-hidden rounded-lg border"><button type="button" onClick={() => quantity(item.productId, Math.max(1, Number(item.cantidad || 1) - 1))} className="min-h-11 px-3"><Minus size={14}/></button><input type="number" value={item.cantidad} onFocus={(e) => e.target.select()} onChange={(e) => quantity(item.productId, e.target.value)} onBlur={() => quantity(item.productId, item.cantidad || 1)} className="min-w-0 flex-1 border-x px-2 py-2 text-center text-sm"/><button type="button" onClick={() => quantity(item.productId, Number(item.cantidad || 0) + 1)} className="min-h-11 px-3"><Plus size={14}/></button></div><b className="whitespace-nowrap text-right text-sm">{money(item.precio * Number(item.cantidad || 0))}</b><button type="button" aria-label={`Quitar ${item.nombre}`} onClick={() => setItems((prev) => prev.filter((x) => x.productId !== item.productId))} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-red-200 text-red-500"><Trash2 size={16}/></button></div></div>)}</div>
    {items.length > 0 && <div className="mt-4 flex flex-col items-stretch gap-3 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"><b>Total: {money(total)}</b><button type="button" onClick={() => { onSave(items.map((x) => ({ ...x, cantidad: Number(x.cantidad || 1) })), total); setItems([]); }} className="action w-full justify-center sm:w-auto"><Check size={16}/>{actionLabel}</button></div>}
  </div>;
}

function SavedList({ records = [], setRecords, emptyText }) {
  if (!records.length) return <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm opacity-55">{emptyText}</p>;
  return <div className="mt-4 space-y-2">{records.map((record) => {
    const items = Array.isArray(record.items) ? record.items : [];
    return <div key={record.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><b>{record.cliente || record.detalle || "Sin cliente"}</b>{record.__tutorial && <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Ejemplo ficticio</span>}<p className="text-xs opacity-60">{new Date(record.fecha).toLocaleString("es-AR")} · {items.length ? items.map((x) => `${x.cantidad}× ${x.nombre}`).join(", ") : record.detalle}</p></div><div className="flex items-center gap-3"><b>{money(record.total || record.sena || 0)}</b><button onClick={() => setRecords((prev) => (prev || []).filter((x) => x.id !== record.id))} className="text-red-500"><Trash2 size={16}/></button></div></div></div>;
  })}</div>;
}

export function CustomerOrders({ products, records = [], setRecords }) {
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  return <section className="rounded-xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><PackageCheck size={18}/>Pedidos de clientes</h2><p className="mb-4 text-sm opacity-60">Reservá varios productos y cantidades sin descontar el stock.</p><div className="mb-3 grid gap-2 sm:grid-cols-2"><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente" className={inputClass}/><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota o fecha de retiro" className={inputClass}/></div><ProductQuantityBuilder products={products} actionLabel="Guardar pedido" onSave={(items,total) => { setRecords((prev) => [{ id: Date.now(), fecha: new Date().toISOString(), cliente: cliente.trim() || "Sin identificar", nota, items, total, estado: "pendiente" }, ...(prev || [])]); setCliente(""); setNota(""); }}/><SavedList records={records} setRecords={setRecords} emptyText="Todavía no hay pedidos guardados."/></section>;
}

export function Budgets({ products, records = [], setRecords }) {
  const [cliente, setCliente] = useState("");
  return <section className="rounded-xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><FileText size={18}/>Presupuestos</h2><p className="mb-4 text-sm opacity-60">Armá cantidades de varios productos sin modificar existencias.</p><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente (opcional)" className={`${inputClass} mb-3`}/><ProductQuantityBuilder products={products} actionLabel="Guardar presupuesto" onSave={(items,total) => { setRecords((prev) => [{ id: Date.now(), fecha: new Date().toISOString(), cliente: cliente.trim() || "Consumidor final", items, total, estado: "borrador" }, ...(prev || [])]); setCliente(""); }}/><SavedList records={records} setRecords={setRecords} emptyText="Todavía no hay presupuestos guardados."/></section>;
}
