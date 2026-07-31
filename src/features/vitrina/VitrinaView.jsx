import React, { useMemo, useState } from "react";
import { Bell, ChevronRight, FolderPlus, Save, Search, Store, X } from "lucide-react";
import { formatQuantity, roundQuantity, unidadInfo } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { groupProductFamilies, productVariant } from "../../shared/productFamilies";

function VitrinaRow({ product, onSave, nested = false }) {
  const [value, setValue] = useState(String(product.vitrina));
  const [alerta, setAlerta] = useState(String(product.alertaVitrina));
  const numValue = value === "" ? 0 : Number(value);
  const numAlerta = alerta === "" ? 0 : Number(alerta);
  const total = roundQuantity(Number(product.deposito || 0) + Number(product.vitrina || 0));
  const dirty = numValue !== product.vitrina || numAlerta !== product.alertaVitrina;
  const invalid = !Number.isFinite(numValue) || !Number.isFinite(numAlerta) || numValue < 0 || numValue > total || numAlerta < 0;
  const needsRefill = Number(product.vitrina || 0) <= Number(product.alertaVitrina || 0);

  const save = () => {
    if (invalid) return;
    const nextVitrina = roundQuantity(numValue);
    const difference = roundQuantity(nextVitrina - Number(product.vitrina || 0));
    onSave(product.id, {
      vitrina: nextVitrina,
      deposito: roundQuantity(Number(product.deposito || 0) - difference),
      alertaVitrina: numAlerta,
    });
    setValue(String(nextVitrina));
    setAlerta(String(numAlerta));
  };

  return (
    <div className={`vitrina-product-card flex flex-col items-stretch gap-3 rounded-xl border border-l-4 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${nested ? "ml-3 sm:ml-6" : ""} ${needsRefill ? "is-warning border-amber-300" : "border-gray-200"}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`vitrina-product-icon mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${needsRefill ? "is-warning" : ""}`}>
          {needsRefill ? <Bell size={17}/> : <Store size={17}/>}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-semibold">{product.nombre}</p>
            {needsRefill && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><Bell size={11}/>Reponer</span>}
          </div>
          <p className="text-xs opacity-65">Depósito: {formatQuantity(product.deposito)} {unidadInfo(product.unidad).baseAbbr} · Vitrina actual: {formatQuantity(product.vitrina)} {unidadInfo(product.unidad).baseAbbr} · Total: {formatQuantity(total)} {unidadInfo(product.unidad).baseAbbr}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:items-center sm:gap-3">
        <label data-tour="vitrina-quantity" className="text-center text-[11px] opacity-70">Vitrina<input type="number" onFocus={(event) => event.target.select()} min={0} max={total} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => value === "" && setValue("0")} className={`mt-0.5 min-h-11 w-full rounded-lg border px-2 py-1.5 text-center text-sm sm:w-20 ${numValue < 0 || numValue > total ? "border-red-400" : ""}`}/></label>
        <label data-tour="vitrina-alert" className="text-center text-[11px] opacity-70">Alerta en<input type="number" onFocus={(event) => event.target.select()} min={0} value={alerta} onChange={(event) => setAlerta(event.target.value)} onBlur={() => alerta === "" && setAlerta("0")} className={`mt-0.5 min-h-11 w-full rounded-lg border px-2 py-1.5 text-center text-sm sm:w-20 ${numAlerta < 0 ? "border-red-400" : ""}`}/></label>
        <button data-tour="vitrina-save" onClick={save} disabled={!dirty || invalid} className="col-span-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white disabled:opacity-30 sm:col-span-1 sm:w-auto"><Save size={14}/>Guardar</button>
      </div>
    </div>
  );
}

export function VitrinaView({ products, setProducts }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupProductQuery, setGroupProductQuery] = useState("");
  const [groupSelection, setGroupSelection] = useState(() => new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = useMemo(() => products.filter((product) => !normalizedQuery || [product.nombre, product.codigo, product.familia, product.variante, product.vitrinaGrupo].some((value) => String(value || "").toLocaleLowerCase("es").includes(normalizedQuery))), [products, normalizedQuery]);
  const customGroups = useMemo(() => [...new Set(products.map((product) => product.vitrinaGrupo).filter(Boolean))].map((name) => ({ name, products: filtered.filter((product) => product.vitrinaGrupo === name) })).filter((group) => group.products.length), [products, filtered]);
  const families = useMemo(() => groupProductFamilies(filtered.filter((product) => !product.vitrinaGrupo)), [filtered]);
  const needingRefill = products.filter((product) => Number(product.vitrina || 0) <= Number(product.alertaVitrina || 0));
  const groupPickerProducts = useMemo(() => {
    const value = groupProductQuery.trim().toLocaleLowerCase("es");
    return value ? products.filter((product) => [product.nombre, product.codigo, product.familia, product.variante, product.vitrinaGrupo].some((field) => String(field || "").toLocaleLowerCase("es").includes(value))) : products;
  }, [products, groupProductQuery]);
  const toggle = (key) => setExpanded((previous) => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const saveRow = (id, updates) => setProducts((previous) => previous.map((product) => product.id === id ? { ...product, ...updates } : product));
  const saveGroup = () => {
    const name = groupName.trim();
    if (!name || groupSelection.size === 0) return;
    setProducts((previous) => previous.map((product) => groupSelection.has(product.id) ? { ...product, vitrinaGrupo: name } : product));
    setExpanded((previous) => new Set(previous).add(`custom:${name}`));
    setGroupName("");
    setGroupProductQuery("");
    setGroupSelection(new Set());
    setGroupEditorOpen(false);
  };
  const removeGroup = (name) => setProducts((previous) => previous.map((product) => product.vitrinaGrupo === name ? { ...product, vitrinaGrupo: "" } : product));

  return (
    <div className="p-4 sm:p-8">
      <SectionHeader title="Vitrina / Exhibición" subtitle="Indicá cuántas unidades de cada producto están en vitrina. Al aumentar la cantidad, se descuenta del depósito." actions={<button data-tour="vitrina-groups" type="button" onClick={() => setGroupEditorOpen((value) => !value)} className="flex min-h-10 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><FolderPlus size={16}/>Grupos</button>}/>
      <div className="mb-4 flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3"><Search size={18} className="shrink-0 opacity-50"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, código, variante o grupo..." className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"/>{query && <button type="button" onClick={() => setQuery("")} className="rounded p-1 opacity-50"><X size={16}/></button>}</div>
      {groupEditorOpen && <div className="vitrina-group-editor mb-4 rounded-xl border bg-white p-4"><h3 className="font-semibold">Crear grupo personalizado</h3><p className="mt-1 text-xs opacity-65">Por ejemplo: Heladera, Mostrador o Promociones.</p><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nombre del grupo" className="min-h-11 rounded-lg border px-3 text-sm"/><button type="button" onClick={saveGroup} disabled={!groupName.trim() || !groupSelection.size} className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40">Guardar grupo</button></div><div className="relative mt-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"/><input value={groupProductQuery} onChange={(event) => setGroupProductQuery(event.target.value)} placeholder="Buscar productos para agregar..." className="min-h-11 w-full rounded-lg border bg-[var(--app-control)] py-2 pl-9 pr-9 text-sm text-[var(--app-control-text)]"/>{groupProductQuery && <button type="button" onClick={() => setGroupProductQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-50"><X size={15}/></button>}</div><div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{groupPickerProducts.map((product) => <label key={product.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${groupSelection.has(product.id) ? "bg-blue-50" : ""}`}><input type="checkbox" checked={groupSelection.has(product.id)} onChange={() => setGroupSelection((previous) => { const next = new Set(previous); next.has(product.id) ? next.delete(product.id) : next.add(product.id); return next; })}/><span className="min-w-0 flex-1 truncate">{product.nombre}</span>{product.vitrinaGrupo && <small className="shrink-0 opacity-60">{product.vitrinaGrupo}</small>}</label>)}{groupPickerProducts.length === 0 && <p className="col-span-full p-4 text-center text-sm opacity-60">No hay coincidencias.</p>}</div></div>}
      {needingRefill.length > 0 && <div className="mb-3 flex items-center gap-2 text-sm text-amber-700"><Bell size={15}/>{needingRefill.length} producto{needingRefill.length > 1 ? "s" : ""} necesita{needingRefill.length > 1 ? "n" : ""} reposición en vitrina</div>}
      <div className="space-y-2">
        {products.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm opacity-50">Todavía no cargaste productos en Stock.</div>}
        {customGroups.map((group) => {
          const key = `custom:${group.name}`;
          return <div key={key} className="vitrina-family-card overflow-hidden rounded-xl border bg-white"><button data-tour="vitrina-family" onClick={() => toggle(key)} className="product-family-trigger flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"><span className="min-w-0"><b>{group.name}</b><small className="ml-2 opacity-60">{group.products.length} producto(s)</small></span><span className="flex shrink-0 items-center gap-2"><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); removeGroup(group.name); }} onKeyDown={(event) => event.key === "Enter" && removeGroup(group.name)} className="rounded px-2 py-1 text-xs text-red-600">Desarmar</span><ChevronRight size={18} className={`transition-transform ${expanded.has(key) ? "rotate-90" : ""}`}/></span></button>{expanded.has(key) && <div className="space-y-2 border-t p-2">{group.products.map((product) => <VitrinaRow key={product.id} product={product} onSave={saveRow} nested/>)}</div>}</div>;
        })}
        {families.map((family) => family.products.length === 1 ? <VitrinaRow key={family.products[0].id} product={family.products[0]} onSave={saveRow}/> : <div key={family.key} className="vitrina-family-card overflow-hidden rounded-xl border bg-white"><button data-tour="vitrina-family" onClick={() => toggle(family.key)} className="product-family-trigger flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"><span className="min-w-0"><b>{family.name}</b><small className="ml-2 opacity-60">{family.products.length} variantes · {formatQuantity(family.products.reduce((sum, product) => sum + Number(product.vitrina || 0), 0))} en vitrina</small></span><ChevronRight size={18} className={`transition-transform ${expanded.has(family.key) ? "rotate-90" : ""}`}/></button>{expanded.has(family.key) && <div className="space-y-2 border-t p-2">{family.products.map((product) => <div key={product.id}><p className="mb-1 px-5 text-xs font-semibold opacity-60">↳ {productVariant(product, family.name)}</p><VitrinaRow product={product} onSave={saveRow} nested/></div>)}</div>}</div>)}
        {filtered.length === 0 && products.length > 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm opacity-60">No hay productos que coincidan con la búsqueda.</div>}
      </div>
    </div>
  );
}
