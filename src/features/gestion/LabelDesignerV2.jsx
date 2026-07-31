import React, { useMemo, useRef, useState } from "react";
import { Grip, Printer, RotateCcw } from "lucide-react";
import { money } from "../../shared/domain";

const DEFAULT_POSITIONS = {
  business: { x: 50, y: 10 }, name: { x: 50, y: 28 }, price: { x: 50, y: 48 },
  barcode: { x: 50, y: 69 }, code: { x: 50, y: 91 },
};
const LABELS = { business: "Negocio", name: "Producto", price: "Precio", barcode: "Código de barras", code: "Número del código" };

function Barcode({ code, color }) {
  const value = String(code || "7790000000000");
  const bits = [...value].flatMap((digit, index) => Array.from({ length: 7 }, (_, bit) => ((Number(digit) + bit + index) % 3 ? 1 : 0)));
  return <svg viewBox={`0 0 ${bits.length} 30`} preserveAspectRatio="none" className="h-8 w-32"><rect width="100%" height="100%" fill="transparent"/>{bits.map((bit, i) => bit ? <rect key={i} x={i} width="1" height={i % 8 === 0 ? 30 : 25} fill={color}/> : null)}</svg>;
}

function Element({ type, product, edit, config, draggable, onPointerDown }) {
  const common = { position: "absolute", left: `${config.positions[type].x}%`, top: `${config.positions[type].y}%`, transform: "translate(-50%, -50%)", cursor: draggable ? "grab" : "default", touchAction: "none", userSelect: "none", maxWidth: "92%", whiteSpace: "nowrap" };
  let content;
  if (type === "business") content = <span className="font-bold uppercase" style={{ fontSize: Number(config.sizes?.business) || 9 }}>{config.businessName}</span>;
  if (type === "name") content = <b className="block max-w-full overflow-hidden text-ellipsis" style={{ fontSize: Number(config.sizes?.name) || config.fontSize }}>{edit.nombre ?? product.nombre}</b>;
  if (type === "price") content = <strong style={{ color: config.priceColor, fontSize: Number(config.sizes?.price) || config.fontSize + 9 }}>{config.pricePrefix} {Number(edit.precio ?? product.venta).toLocaleString("es-AR")}</strong>;
  if (type === "barcode") content = <Barcode code={product.codigo} color={config.textColor}/>;
  if (type === "code") content = <span className="font-mono tracking-widest" style={{ fontSize: Number(config.sizes?.code) || 9 }}>{product.codigo || "SIN CÓDIGO"}</span>;
  return <div style={common} onPointerDown={onPointerDown} className={draggable ? "rounded border border-dashed border-blue-400 px-1 hover:bg-blue-50/30" : ""}>{content}</div>;
}

function LabelCanvas({ product, edit = {}, config, setConfig, interactive = false }) {
  const ref = useRef(null);
  const drag = (type) => (event) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (e) => {
      const rect = ref.current.getBoundingClientRect();
      const x = Math.max(3, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
      setConfig((prev) => ({ ...prev, positions: { ...prev.positions, [type]: { x, y } } }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return <div ref={ref} className="label-print relative mx-auto overflow-hidden border-2" style={{ width: `${config.width}mm`, height: `${config.height}mm`, maxWidth: "100%", background: config.background, color: config.textColor, borderColor: config.borderColor }}>
    {Object.keys(LABELS).map((type) => config[`show${type[0].toUpperCase()}${type.slice(1)}`] ? <Element key={type} type={type} product={product} edit={edit} config={config} draggable={interactive} onPointerDown={drag(type)}/> : null)}
  </div>;
}

export function LabelDesignerV2({ products }) {
  const [selected, setSelected] = useState(products[0]?.id ? [products[0].id] : []);
  const [edits, setEdits] = useState({});
  const [config, setConfig] = useState({ width: 60, height: 40, copies: 1, fontSize: 12, sizes: { business: 9, name: 12, price: 21, code: 9 }, pricePrefix: "$", businessName: "Mi negocio", background: "#ffffff", textColor: "#111827", priceColor: "#111827", borderColor: "#111827", showBusiness: true, showName: true, showPrice: true, showBarcode: true, showCode: true, positions: DEFAULT_POSITIONS });
  const chosen = useMemo(() => products.filter((p) => selected.includes(p.id)), [products, selected]);
  const sample = chosen[0] || products[0];
  const cfg = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));
  const setSize = (key, value) => setConfig((prev) => ({ ...prev, sizes: { ...prev.sizes, [key]: value } }));
  const reset = () => setConfig((prev) => ({ ...prev, positions: DEFAULT_POSITIONS }));
  if (!sample) return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">Primero cargá un producto para diseñar etiquetas.</div>;
  return <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="font-semibold">Editor libre de etiquetas</h3><p className="text-sm text-gray-500">Arrastrá el nombre, precio, código y demás elementos directamente sobre la etiqueta.</p></div><button disabled={!chosen.length} onClick={() => window.print()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40 sm:w-auto"><Printer size={16}/>Imprimir {chosen.length || ""}</button></div>
    <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-xl border p-2">{products.map((p) => <label key={p.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"><input type="checkbox" className="shrink-0" checked={selected.includes(p.id)} onChange={() => setSelected((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}/><span className="min-w-0 truncate">{p.nombre}</span></label>)}</div>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">{[["width","Ancho mm"],["height","Alto mm"],["copies","Copias"]].map(([key,label]) => <label key={key} className="min-w-0 text-xs">{label}<input type="number" min="1" value={config[key]} onChange={(e) => cfg(key, Math.max(1, Number(e.target.value)))} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2"/></label>)}</div>
        <div><p className="mb-2 text-xs font-semibold">Tamaño de cada texto</p><div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">{[["business","Negocio"],["name","Producto"],["price","Precio"],["code","Número código"]].map(([key,label]) => <label key={key} className="min-w-0 text-xs">{label}<input type="number" value={config.sizes[key]} onChange={(e) => setSize(key, e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2"/></label>)}</div><p className="mt-1 text-[11px] opacity-60">Podés borrar el valor completo y escribir cualquier tamaño.</p></div>
        <input value={config.businessName} onChange={(e) => cfg("businessName", e.target.value)} placeholder="Nombre del negocio" className="w-full rounded-lg border px-3 py-2 text-sm"/>
        <div className="grid grid-cols-2 gap-2">{[["background","Fondo"],["textColor","Texto"],["priceColor","Precio"],["borderColor","Borde"]].map(([key,label]) => <label key={key} className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg border p-2 text-xs"><span className="min-w-0 break-words">{label}</span><input type="color" className="shrink-0" value={config[key]} onChange={(e) => cfg(key, e.target.value)}/></label>)}</div>
        <div className="space-y-1">{Object.entries(LABELS).map(([type,label]) => { const key = `show${type[0].toUpperCase()}${type.slice(1)}`; return <label key={type} className="flex min-h-11 items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" className="shrink-0" checked={config[key]} onChange={(e) => cfg(key, e.target.checked)}/><Grip size={14} className="shrink-0 text-gray-400"/><span className="min-w-0 break-words">{label}</span></label>; })}</div>
        <button onClick={reset} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw size={15}/>Restablecer posiciones</button>
      </div>
      <div className="min-w-0"><div className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-5"><p className="mb-3 text-center text-xs font-semibold text-gray-500">VISTA EDITABLE · ARRASTRÁ LOS ELEMENTOS</p><LabelCanvas product={sample} edit={edits[sample.id]} config={config} setConfig={setConfig} interactive/><div className="mx-auto mt-3 grid max-w-md grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]"><input value={edits[sample.id]?.nombre ?? sample.nombre} onChange={(e) => setEdits((prev) => ({ ...prev, [sample.id]: { ...prev[sample.id], nombre: e.target.value } }))} className="min-w-0 rounded-lg border px-3 py-2 text-sm"/><input type="number" value={edits[sample.id]?.precio ?? sample.venta} onChange={(e) => setEdits((prev) => ({ ...prev, [sample.id]: { ...prev[sample.id], precio: e.target.value } }))} className="min-w-0 rounded-lg border px-3 py-2 text-sm"/></div></div>
        <div id="labels-print-sheet" className="hidden">{chosen.flatMap((product) => Array.from({ length: config.copies }, (_, i) => <LabelCanvas key={`${product.id}-${i}`} product={product} edit={edits[product.id]} config={config}/>))}</div>
      </div>
    </div>
  </div>;
}
