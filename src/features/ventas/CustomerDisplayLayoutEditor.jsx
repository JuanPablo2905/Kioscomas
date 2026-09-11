import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import {
  DISPLAY_MODES, DISPLAY_PRESETS, DISPLAY_WIDGET_CATALOG, DISPLAY_ZONES, SOCIAL_PLATFORMS,
  applyDisplayPreset, moveDisplayWidget, normalizeDisplayConfig,
} from "./displayConfig";

const zoneNames = { top: "Arriba", left: "Izquierda", center: "Centro", right: "Derecha", bottom: "Abajo" };
const modeNames = { idle: "Sin venta / publicidad", sale: "Durante la venta", complete: "Después de cobrar" };

function DurationField({ label, value, min, max, presets, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next = draft) => {
    const parsed = Number(next);
    const safe = Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : value;
    setDraft(String(safe));
    onCommit(safe);
  };
  return <div className="rounded-xl border bg-white p-3"><label className="text-xs font-bold text-gray-700">{label}</label><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => commit(Number(value) - 1)} className="h-10 w-10 rounded-lg border font-bold">−</button><input inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-center text-sm font-bold"/><button type="button" onClick={() => commit(Number(value) + 1)} className="h-10 w-10 rounded-lg border font-bold">+</button></div><div className="mt-2 flex flex-wrap gap-1">{presets.map((item) => <button type="button" key={item} onClick={() => commit(item)} className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-700">{item} s</button>)}</div></div>;
}

const uploadImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
    image.onload = () => {
      const limit = 1000; const scale = Math.min(1, limit / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", 0.88));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function LayoutZones({ config, mode, onChange }) {
  const allowedZones = mode === "idle" ? DISPLAY_ZONES : ["top", "bottom"];
  const [addZone, setAddZone] = useState("top");
  useEffect(() => { if (!allowedZones.includes(addZone)) setAddZone("top"); }, [mode, addZone]);
  const assigned = new Set(DISPLAY_ZONES.flatMap((zone) => config.layouts[mode][zone] || []));
  const available = Object.values(config.widgets).filter((item) => !assigned.has(item.id));
  const add = (widgetId) => widgetId && onChange(moveDisplayWidget(config, mode, widgetId, addZone));
  const remove = (widgetId) => {
    const next = normalizeDisplayConfig(config);
    DISPLAY_ZONES.forEach((zone) => { next.layouts[mode][zone] = next.layouts[mode][zone].filter((id) => id !== widgetId); });
    next.preset = "custom"; onChange(next);
  };
  const shift = (zone, index, offset) => {
    const next = normalizeDisplayConfig(config); const items = [...next.layouts[mode][zone]];
    const target = index + offset; if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]]; next.layouts[mode][zone] = items; next.preset = "custom"; onChange(next);
  };
  return <div className="grid gap-3">
    <div className="grid gap-2 rounded-xl border border-dashed bg-white p-3 sm:grid-cols-[140px_minmax(0,1fr)]"><select value={addZone} onChange={(event) => setAddZone(event.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-xs">{allowedZones.map((zone) => <option key={zone} value={zone}>{zoneNames[zone]}</option>)}</select><select value="" onChange={(event) => add(event.target.value)} className="min-h-10 rounded-lg border bg-white px-2 text-xs"><option value="">+ Agregar un bloque…</option>{available.map((item) => <option key={item.id} value={item.id}>{DISPLAY_WIDGET_CATALOG[item.type]?.label || item.type}</option>)}</select></div>
    <div className={`grid gap-3 ${allowedZones.length === 2 ? "sm:grid-cols-2" : "lg:grid-cols-5"}`}>{allowedZones.map((zone) => <div key={zone} className="min-w-0 rounded-xl border bg-gray-50 p-2"><p className="mb-2 text-center text-[10px] font-black uppercase tracking-wide text-gray-500">{zoneNames[zone]}</p><div className="grid gap-1.5">{(config.layouts[mode][zone] || []).map((id, index) => { const item = config.widgets[id]; return <div key={id} className="rounded-lg border bg-white p-2"><div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[10px] font-bold">{DISPLAY_WIDGET_CATALOG[item?.type]?.label || id}</p><select aria-label="Mover de zona" value={zone} onChange={(event) => onChange(moveDisplayWidget(config, mode, id, event.target.value))} className="h-7 rounded border bg-white px-1 text-[9px]">{allowedZones.map((target) => <option key={target} value={target}>{zoneNames[target]}</option>)}</select></div><div className="mt-1 flex gap-1"><button type="button" aria-label="Subir" onClick={() => shift(zone, index, -1)} className="grid h-7 flex-1 place-items-center rounded border disabled:opacity-30" disabled={index === 0}><ChevronUp size={13}/></button><button type="button" aria-label="Bajar" onClick={() => shift(zone, index, 1)} className="grid h-7 flex-1 place-items-center rounded border disabled:opacity-30" disabled={index === config.layouts[mode][zone].length - 1}><ChevronDown size={13}/></button><button type="button" aria-label="Quitar" onClick={() => remove(id)} className="grid h-7 flex-1 place-items-center rounded border border-red-200 text-red-600"><X size={13}/></button></div></div>; })}{!config.layouts[mode][zone]?.length && <p className="py-4 text-center text-[10px] text-gray-400">Vacío</p>}</div></div>)}</div>
    {mode === "sale" && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">La lista de productos, el total, el medio de pago y el QR son obligatorios y siempre permanecen en el centro. Acá personalizás las franjas que los acompañan.</p>}
  </div>;
}

function WidgetDetails({ config, products, onChange }) {
  const patchWidget = (id, patch) => onChange({ ...config, widgets: { ...config.widgets, [id]: { ...config.widgets[id], ...patch } }, preset: "custom" });
  const socials = config.widgets.socials || { id: "socials", type: "socials", items: [] };
  const socialItems = Array.isArray(socials.items) ? socials.items : [];
  const updateSocial = (index, patch) => patchWidget("socials", { items: socialItems.map((item, current) => current === index ? { ...item, ...patch } : item) });
  return <div className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Clima</h5><p className="mt-1 text-[10px] text-gray-500">Escribí la ciudad. Si se corta Internet, conserva el último resultado obtenido.</p><input value={config.widgets.weather?.city || ""} onChange={(event) => patchWidget("weather", { city: event.target.value.slice(0, 100), latitude: null, longitude: null })} placeholder="Ej.: Buenos Aires" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Horarios</h5><textarea value={config.widgets.hours?.text || ""} onChange={(event) => patchWidget("hours", { text: event.target.value.slice(0, 260) })} placeholder="Lun a sáb · 8 a 20 h" className="mt-2 min-h-20 w-full rounded-lg border p-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Aviso personalizado</h5><input value={config.widgets.notice?.title || ""} onChange={(event) => patchWidget("notice", { title: event.target.value.slice(0, 80) })} placeholder="Título" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/><textarea value={config.widgets.notice?.text || ""} onChange={(event) => patchWidget("notice", { text: event.target.value.slice(0, 240) })} placeholder="Mensaje para los clientes" className="mt-2 min-h-16 w-full rounded-lg border p-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Producto destacado</h5><select value={config.widgets.featured?.productId || ""} onChange={(event) => patchWidget("featured", { productId: event.target.value })} className="mt-2 min-h-10 w-full rounded-lg border bg-white px-3 text-xs"><option value="">Elegir automáticamente</option>{products.slice(0, 500).map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></div>
    <div className="rounded-xl border bg-white p-3 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div><h5 className="text-xs font-black">Redes y contactos listos</h5><p className="mt-1 text-[10px] text-gray-500">Elegí el servicio y completá solamente el usuario, teléfono o enlace. Kiosco+ aplica su color y crea el QR.</p></div><button type="button" onClick={() => patchWidget("socials", { items: [...socialItems, { platform: "whatsapp", value: "", label: "" }].slice(0, 6) })} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#1C4A44] px-3 text-[10px] font-bold text-white"><Plus size={13}/>Agregar</button></div><div className="mt-3 grid gap-2">{socialItems.map((item, index) => <div key={index} className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_36px]"><select value={item.platform || "whatsapp"} onChange={(event) => updateSocial(index, { platform: event.target.value })} className="min-h-9 rounded-lg border bg-white px-2 text-[10px]">{Object.entries(SOCIAL_PLATFORMS).map(([id, platform]) => <option key={id} value={id}>{platform.label}</option>)}</select><input value={item.value || ""} onChange={(event) => updateSocial(index, { value: event.target.value.slice(0, 180) })} placeholder="Usuario, teléfono o enlace" className="min-h-9 rounded-lg border px-2 text-[10px]"/><input value={item.label || ""} onChange={(event) => updateSocial(index, { label: event.target.value.slice(0, 60) })} placeholder="Texto opcional" className="min-h-9 rounded-lg border px-2 text-[10px]"/><button type="button" onClick={() => patchWidget("socials", { items: socialItems.filter((_, current) => current !== index) })} className="grid h-9 place-items-center rounded-lg border border-red-200 text-red-600"><Trash2 size={14}/></button></div>)}{!socialItems.length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-gray-400">Todavía no agregaste contactos.</p>}</div></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Medios de pago</h5><div className="mt-2 flex flex-wrap gap-2">{["Efectivo", "Mercado Pago", "Transferencia", "Tarjeta"].map((method) => { const active = config.widgets.payments?.items?.includes(method); return <button type="button" key={method} onClick={() => patchWidget("payments", { items: active ? config.widgets.payments.items.filter((item) => item !== method) : [...(config.widgets.payments?.items || []), method] })} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${active ? "bg-emerald-700 text-white" : "border bg-white text-gray-600"}`}>{method}</button>; })}</div></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Imagen publicitaria</h5><div className="mt-2 flex items-center gap-3">{config.widgets.image?.src ? <img src={config.widgets.image.src} alt="" className="h-16 w-24 rounded-lg border object-contain"/> : <span className="grid h-16 w-24 place-items-center rounded-lg border border-dashed text-[10px] text-gray-400">Sin imagen</span>}<label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[10px] font-bold"><ImagePlus size={14}/>Elegir<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) patchWidget("image", { src: await uploadImage(file) }); }}/></label>{config.widgets.image?.src && <button type="button" onClick={() => patchWidget("image", { src: "" })} className="text-red-600"><Trash2 size={16}/></button>}</div></div>
  </div>;
}

export function CustomerDisplayLayoutEditor({ value, slideSeconds, thanksSeconds, products, onChange, onSlideSeconds, onThanksSeconds }) {
  const config = useMemo(() => normalizeDisplayConfig(value), [value]);
  const [mode, setMode] = useState("idle");
  return <div className="grid gap-4">
    <div className="rounded-xl border bg-white p-3"><h4 className="text-sm font-black">Qué debe hacer esta pantalla</h4><div className="mt-2 grid gap-2 sm:grid-cols-3">{[[DISPLAY_MODES.saleAndAds, "Ventas + publicidad"], [DISPLAY_MODES.adsOnly, "Sólo publicidad"], [DISPLAY_MODES.saleOnly, "Sólo ventas"]].map(([id, label]) => <button type="button" key={id} onClick={() => onChange({ ...config, operationMode: id })} className={`min-h-11 rounded-lg border px-3 text-xs font-bold ${config.operationMode === id ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-gray-700"}`}>{label}</button>)}</div><p className="mt-2 text-[10px] text-gray-500">“Sólo publicidad” nunca muestra lo que se cobra, aunque esté conectada por HDMI. Es ideal para una TV alejada de la caja.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><DurationField label="Cambiar anuncio cada" value={slideSeconds} min={4} max={60} presets={[5, 8, 10, 15]} onCommit={onSlideSeconds}/><DurationField label="Mostrar agradecimiento" value={thanksSeconds} min={2} max={30} presets={[3, 5, 8, 10]} onCommit={onThanksSeconds}/></div>
    <div><h4 className="text-sm font-black">Diseños rápidos</h4><div className="mt-2 flex flex-wrap gap-2">{Object.entries(DISPLAY_PRESETS).map(([id, preset]) => <button type="button" key={id} onClick={() => onChange(applyDisplayPreset(config, id))} className={`rounded-full border px-3 py-2 text-[10px] font-bold ${config.preset === id ? "border-violet-700 bg-violet-700 text-white" : "bg-white"}`}>{preset.label}</button>)}</div></div>
    <div className="rounded-xl border bg-white p-3"><div className="flex flex-wrap gap-2">{Object.keys(modeNames).map((id) => <button type="button" key={id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${mode === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{modeNames[id]}</button>)}</div><div className="mt-3"><LayoutZones config={config} mode={mode} onChange={onChange}/></div></div>
    <WidgetDetails config={config} products={products} onChange={onChange}/>
  </div>;
}
