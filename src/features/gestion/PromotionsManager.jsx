import React, { useMemo, useState } from "react";
import { BadgePercent, CalendarDays, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { AppSelect } from "../../shared/controls";
import { money } from "../../shared/domain";

const TYPES = [
  { value: "porcentaje", label: "Descuento porcentual" },
  { value: "cantidad", label: "Descuento por cantidad" },
  { value: "nxm", label: "Promoción 2x1 / 3x2" },
  { value: "combo", label: "Combo a precio fijo" },
];

export function PromotionsManager({ products = [], promociones = [], setPromociones }) {
  const empty = { nombre: "", tipo: "porcentaje", valor: 10, lleva: 2, paga: 1, cantidadMinima: 2, precioCombo: "", desde: "", hasta: "", productIds: [] };
  const [form, setForm] = useState(empty);
  const [productQuery, setProductQuery] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedProducts = useMemo(() => products.filter((product) => form.productIds.includes(product.id)), [products, form.productIds]);
  const visibleProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => [product.nombre, product.codigo, product.familia, product.variante, product.categoria].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [products, productQuery]);
  const changeType = (tipo) => setForm((current) => ({ ...current, tipo, productIds: (tipo === "nxm" || tipo === "combo") ? current.productIds.filter((id) => (products.find((product) => product.id === id)?.unidad || "unidad") === "unidad") : current.productIds }));
  const toggleProduct = (id) => set("productIds", form.productIds.includes(id) ? form.productIds.filter((item) => item !== id) : [...form.productIds, id]);
  const valid = form.nombre.trim() && (form.tipo !== "combo" || (form.productIds.length >= 2 && Number(form.precioCombo) > 0));
  const create = () => {
    if (!valid) return;
    setPromociones((previous) => [{ ...form, id: Date.now(), nombre: form.nombre.trim(), valor: Number(form.valor || 0), lleva: Number(form.lleva || 2), paga: Number(form.paga || 1), cantidadMinima: Number(form.cantidadMinima || 2), precioCombo: Number(form.precioCombo || 0), activa: true, fecha: new Date().toISOString() }, ...(previous || [])]);
    setForm(empty); setProductQuery("");
  };
  const describe = (promotion) => promotion.tipo === "nxm" ? `${promotion.lleva}x${promotion.paga}` : promotion.tipo === "combo" ? `Combo a ${money(promotion.precioCombo)}` : promotion.tipo === "cantidad" ? `${promotion.valor}% desde ${promotion.cantidadMinima} unidades` : `${promotion.valor ?? promotion.descuento}% de descuento`;
  return <div className="grid min-w-0 gap-5 xl:grid-cols-[420px_1fr]">
    <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2"><BadgePercent size={18} className="shrink-0"/><h3 className="min-w-0 break-words font-semibold">Nueva promoción o combo</h3></div>
      <div className="mt-4 grid gap-3">
        <input value={form.nombre} onChange={(event) => set("nombre", event.target.value)} placeholder="Nombre visible" className="rounded-lg border px-3 py-2 text-sm"/>
        <AppSelect value={form.tipo} onChange={changeType} options={TYPES}/>
        {(form.tipo === "porcentaje" || form.tipo === "cantidad") && <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><label className="min-w-0 text-xs opacity-70">Descuento %<input type="number" min="1" max="100" value={form.valor} onChange={(event) => set("valor", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>{form.tipo === "cantidad" && <label className="min-w-0 text-xs opacity-70">Cantidad mínima<input type="number" min="2" value={form.cantidadMinima} onChange={(event) => set("cantidadMinima", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>}</div>}
        {form.tipo === "nxm" && <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><label className="min-w-0 text-xs opacity-70">Lleva<input type="number" min="2" value={form.lleva} onChange={(event) => set("lleva", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label><label className="min-w-0 text-xs opacity-70">Paga<input type="number" min="1" value={form.paga} onChange={(event) => set("paga", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label></div>}
        {form.tipo === "combo" && <label className="text-xs opacity-70">Precio final del combo<input type="number" min="0" value={form.precioCombo} onChange={(event) => set("precioCombo", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>}
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><label className="min-w-0 text-xs opacity-70">Desde (opcional)<input type="date" value={form.desde} onChange={(event) => set("desde", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label><label className="min-w-0 text-xs opacity-70">Hasta (opcional)<input type="date" value={form.hasta} onChange={(event) => set("hasta", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label></div>
        <div className="min-w-0"><p className="mb-2 text-xs font-medium opacity-70">Productos incluidos {form.tipo === "porcentaje" && "(vacío = todos)"}</p><div className="relative mb-2 min-w-0"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"/><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar nombre, código o familia..." className="w-full min-w-0 rounded-lg border py-2 pl-9 pr-3 text-sm"/></div><div className="promotion-product-list max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-lg border p-2">{visibleProducts.map((product) => { const disabled = (form.tipo === "nxm" || form.tipo === "combo") && (product.unidad || "unidad") !== "unidad"; const selected = form.productIds.includes(product.id); return <label key={product.id} className={`promotion-product-option flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${selected ? "is-selected" : ""}`}><input type="checkbox" className="shrink-0" disabled={disabled} checked={selected} onChange={() => toggleProduct(product.id)}/><span className="min-w-0 flex-1"><b className="block truncate font-medium">{product.nombre}</b>{(product.codigo || product.familia || product.variante) && <small className="block truncate opacity-65">{[product.codigo, product.familia, product.variante].filter(Boolean).join(" · ")}</small>}</span></label>; })}{visibleProducts.length === 0 && <p className="p-5 text-center text-xs opacity-60">No hay productos que coincidan.</p>}</div><p className="mt-1 text-[11px] opacity-60">{visibleProducts.length} de {products.length} producto(s)</p></div>
        {selectedProducts.length > 0 && <p className="text-xs opacity-70">{selectedProducts.length} producto(s) seleccionado(s)</p>}
        <button disabled={!valid} onClick={create} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40"><Plus size={16}/>Crear promoción</button>
      </div>
    </div>
    <div className="min-w-0"><h3 className="mb-3 font-semibold">Promociones configuradas</h3><div className="grid gap-3 md:grid-cols-2">{promociones.map((promotion) => <div key={promotion.id} className={`min-w-0 rounded-xl border p-4 ${promotion.activa ? "border-green-200 bg-green-50" : "bg-gray-50"}`}><div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><b className="block break-words">{promotion.nombre}</b><p className="mt-1 break-words text-sm opacity-75">{describe(promotion)}</p><p className="mt-2 flex min-w-0 items-start gap-1 text-xs opacity-65"><CalendarDays size={13} className="mt-0.5 shrink-0"/><span className="min-w-0 break-words">{promotion.desde || "Ahora"} → {promotion.hasta || "Sin límite"}</span></p><p className="mt-1 text-xs opacity-65">{promotion.productIds?.length ? `${promotion.productIds.length} producto(s)` : "Todos los productos"}</p></div><div className="flex self-end gap-1 sm:self-auto"><button title={promotion.activa ? "Pausar" : "Activar"} onClick={() => setPromociones((previous) => previous.map((item) => item.id === promotion.id ? { ...item, activa: !item.activa } : item))} className="flex h-10 w-10 items-center justify-center rounded-lg border">{promotion.activa ? <Pause size={14}/> : <Play size={14}/>}</button><button title="Eliminar" onClick={() => setPromociones((previous) => previous.filter((item) => item.id !== promotion.id))} className="flex h-10 w-10 items-center justify-center rounded-lg border text-red-600"><Trash2 size={14}/></button></div></div></div>)}{promociones.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm opacity-60 sm:p-10 md:col-span-2">Todavía no hay promociones.</div>}</div></div>
  </div>;
}
