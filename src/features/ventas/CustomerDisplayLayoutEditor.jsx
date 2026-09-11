import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Monitor, Plus, Trash2, X } from "lucide-react";
import {
  DISPLAY_MODES, DISPLAY_PRESETS, DISPLAY_SCHEDULE_DAYS, DISPLAY_WIDGET_CATALOG,
  DISPLAY_WIDGET_SIZE_MAX, DISPLAY_WIDGET_SIZE_MIN, DISPLAY_ZONES, SOCIAL_PLATFORMS,
  applyDisplayPreset, moveDisplayWidget, normalizeDisplayConfig, normalizeDisplaySchedule,
  normalizeDisplayWidgetSize,
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

function WidgetSizeField({ value, onChange }) {
  const normalized = normalizeDisplayWidgetSize(value);
  const [draft, setDraft] = useState(String(normalized));
  useEffect(() => setDraft(String(normalized)), [normalized]);
  const commit = (next = draft) => {
    const safe = normalizeDisplayWidgetSize(next);
    setDraft(String(safe)); onChange(safe);
  };
  return <div className="rounded-xl border bg-white p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold text-gray-700">Tamaño manual</p><p className="text-[9px] text-gray-500">Arrastrá la barra o escribí un porcentaje.</p></div><b className="rounded-full bg-violet-100 px-2.5 py-1 text-xs text-violet-800">{normalized}%</b></div><input type="range" min={DISPLAY_WIDGET_SIZE_MIN} max={DISPLAY_WIDGET_SIZE_MAX} step="1" value={normalized} onChange={(event) => onChange(normalizeDisplayWidgetSize(event.target.value))} className="mt-3 w-full accent-violet-700" aria-label="Tamaño del bloque"/><div className="mt-2 grid grid-cols-[40px_minmax(0,1fr)_40px_auto] gap-2"><button type="button" onClick={() => commit(normalized - 5)} className="min-h-10 rounded-lg border font-black">−</button><label className="relative"><input inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} className="min-h-10 w-full rounded-lg border px-3 pr-8 text-center text-xs font-black"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span></label><button type="button" onClick={() => commit(normalized + 5)} className="min-h-10 rounded-lg border font-black">+</button><button type="button" onClick={() => commit(100)} className="min-h-10 rounded-lg border px-3 text-[9px] font-bold text-gray-600">Restablecer</button></div></div>;
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

function WidgetVisual({ widget, state }) {
  const promotion = state.promotions?.[0];
  const type = widget?.type;
  if (type === "promotions") return <div className="flex h-full min-h-7 items-center gap-1.5 rounded-md bg-orange-500 px-2 text-[6px] font-bold text-white sm:text-[8px]"><span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-orange-950">{promotion?.badge || "PROMO"}</span><span className="truncate">{promotion?.title || "Promoción destacada"}</span></div>;
  if (type === "welcome") return <div className="grid h-full min-h-12 place-items-center rounded-md bg-white/10 px-2 text-center"><div><p className="font-serif text-[11px] font-black sm:text-xl">{state.welcomeMessage || "Bienvenido"}</p><p className="truncate text-[6px] text-emerald-100 sm:text-[8px]">{state.contactLine || "Gracias por elegirnos"}</p></div></div>;
  if (type === "clock") return <div className="rounded-md bg-white/10 px-2 py-1 text-center"><b className="text-[9px] sm:text-xs">14:35</b><p className="text-[5px] text-emerald-100 sm:text-[7px]">jueves 10 de septiembre</p></div>;
  if (type === "weather") return <div className="rounded-md bg-sky-500/25 p-1.5 text-center"><p className="text-[6px] font-bold sm:text-[8px]">CLIMA</p><b className="text-[10px] sm:text-base">24°</b><p className="truncate text-[5px] sm:text-[7px]">{widget.city || "Tu ciudad"}</p></div>;
  if (type === "socials") return <div className="grid gap-1">{(widget.items?.length ? widget.items : [{ platform: "whatsapp", value: "WhatsApp" }, { platform: "instagram", value: "Instagram" }]).slice(0, 2).map((item, index) => <span key={index} className={`truncate rounded-md px-1.5 py-1 text-center text-[5px] font-bold text-white sm:text-[7px] ${item.platform === "whatsapp" ? "bg-green-500" : item.platform === "instagram" ? "bg-violet-600" : "bg-blue-600"}`}>{item.label || item.value || SOCIAL_PLATFORMS[item.platform]?.label}</span>)}</div>;
  if (type === "hours") { const schedule = normalizeDisplaySchedule(widget.schedule); const active = schedule.filter((entry) => entry.enabled).slice(0, 3); return <div className="h-full rounded-md bg-white/10 p-1.5"><b className="text-[6px] text-amber-300 sm:text-[8px]">HORARIOS</b>{active.length ? <div className="mt-0.5 grid gap-px">{active.map((entry) => <p key={entry.day} className="flex justify-between gap-1 text-[5px] sm:text-[7px]"><span>{DISPLAY_SCHEDULE_DAYS.find((day) => day.id === entry.day)?.shortLabel}</span><span>{entry.open.replace(/^0/, "")}–{entry.close.replace(/^0/, "")}</span></p>)}</div> : <p className="line-clamp-2 text-[5px] sm:text-[7px]">{widget.text || "Configurá cada día"}</p>}</div>; }
  if (type === "payments") return <div className="rounded-md bg-white/10 p-1.5"><b className="text-[6px] text-amber-300 sm:text-[8px]">MEDIOS DE PAGO</b><p className="truncate text-[5px] sm:text-[7px]">{(widget.items || ["Efectivo", "Mercado Pago"]).join(" · ")}</p></div>;
  if (type === "notice") return <div className="rounded-md bg-amber-300 p-1.5 text-amber-950"><b className="block truncate text-[6px] sm:text-[8px]">{widget.title || "Aviso"}</b><p className="line-clamp-2 text-[5px] sm:text-[7px]">{widget.text || "Mensaje para tus clientes"}</p></div>;
  if (type === "featuredProduct") return <div className="rounded-md bg-white p-1.5 text-emerald-950"><b className="block truncate text-[6px] sm:text-[8px]">Producto destacado</b><p className="text-[5px] sm:text-[7px]">$2.500</p></div>;
  if (type === "image") return widget.src ? <img src={widget.src} alt="" className="h-full max-h-16 w-full rounded-md object-cover"/> : <div className="grid min-h-8 place-items-center rounded-md border border-dashed border-white/40 text-[6px] text-white/70">Tu imagen</div>;
  return <div className="rounded-md bg-white/10 p-1.5 text-[6px]">{DISPLAY_WIDGET_CATALOG[type]?.label || "Bloque"}</div>;
}

function PreviewBlock({ id, widget, state, selected, onSelect, onDragStart, onDragEnd }) {
  return <button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); onDragStart(id); }} onDragEnd={onDragEnd} onClick={(event) => { event.stopPropagation(); onSelect(id); }} className={`group relative h-full min-w-0 rounded-lg border p-0.5 text-left transition ${selected ? "border-amber-300 ring-2 ring-amber-300/70" : "border-white/15 hover:border-white/60"}`}>
    <WidgetVisual widget={widget} state={state}/><span className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"><GripVertical size={8}/></span>
  </button>;
}

function VisualZone({ zone, ids, config, state, selectedId, onSelect, draggingId, onDragStart, onDrop, horizontal = false }) {
  return <div onClick={() => onSelect("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingId) onDrop(draggingId, zone); }} className={`relative min-h-0 min-w-0 rounded-md border border-dashed border-white/15 bg-black/5 p-1 ${horizontal ? "flex-none" : "h-full"}`}>
    <span className="pointer-events-none absolute left-1 top-0 z-10 rounded-b bg-black/35 px-1 text-[4px] font-black uppercase tracking-wide text-white/70 sm:text-[6px]">{zoneNames[zone]}</span>
    <div className={`${horizontal ? "flex min-w-0 items-stretch gap-1 pt-1" : "flex h-full max-h-full min-h-0 flex-col gap-1 overflow-hidden pt-1"}`}>{ids.map((id, index) => { const widget = config.widgets[id]; const sizePercent = normalizeDisplayWidgetSize(widget?.sizePercent ?? widget?.size); const previewScale = Math.max(0.9, Math.min(1.18, 0.8 + (sizePercent / 500))); return <div key={id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingId) onDrop(draggingId, zone, index); }} className="grid min-h-0 min-w-0 place-items-center overflow-hidden" style={{ flexGrow: sizePercent, flexShrink: 1, flexBasis: 0, minHeight: horizontal ? `${14 + sizePercent * 0.1}px` : undefined }}><div className="h-full" style={{ width: `${100 / previewScale}%`, height: `${100 / previewScale}%`, transform: `scale(${previewScale})`, transformOrigin: "center" }}><PreviewBlock id={id} widget={widget} state={state} selected={selectedId === id} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={() => onDragStart("")}/></div></div>; })}</div>
    {!ids.length && <div className="grid h-full min-h-6 place-items-center text-[5px] text-white/35 sm:text-[7px]">Soltá un bloque acá</div>}
  </div>;
}

function VisualLayoutEditor({ config, mode, previewState, onChange }) {
  const allowedZones = mode === "idle" ? DISPLAY_ZONES : ["top", "bottom"];
  const [selectedId, setSelectedId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [addZone, setAddZone] = useState("top");
  useEffect(() => { setSelectedId(""); if (!allowedZones.includes(addZone)) setAddZone("top"); }, [mode]);
  const assigned = new Set(DISPLAY_ZONES.flatMap((zone) => config.layouts[mode][zone] || []));
  const available = Object.values(config.widgets).filter((item) => !assigned.has(item.id));
  const location = DISPLAY_ZONES.find((zone) => config.layouts[mode][zone]?.includes(selectedId));
  const selectedIndex = location ? config.layouts[mode][location].indexOf(selectedId) : -1;
  const selected = config.widgets[selectedId];
  const move = (widgetId, destination, position = null) => { onChange(moveDisplayWidget(config, mode, widgetId, destination, position)); setSelectedId(widgetId); setDraggingId(""); };
  const resize = (sizePercent) => {
    const next = normalizeDisplayConfig(config);
    next.widgets[selectedId] = { ...next.widgets[selectedId], sizePercent: normalizeDisplayWidgetSize(sizePercent) };
    next.preset = "custom"; onChange(next);
  };
  const remove = (widgetId) => {
    const next = normalizeDisplayConfig(config);
    DISPLAY_ZONES.forEach((zone) => { next.layouts[mode][zone] = next.layouts[mode][zone].filter((id) => id !== widgetId); });
    next.preset = "custom"; onChange(next); setSelectedId("");
  };
  const shift = (offset) => {
    if (!location || selectedIndex < 0) return;
    const next = normalizeDisplayConfig(config); const items = [...next.layouts[mode][location]]; const target = selectedIndex + offset;
    if (target < 0 || target >= items.length) return;
    [items[selectedIndex], items[target]] = [items[target], items[selectedIndex]]; next.layouts[mode][location] = items; next.preset = "custom"; onChange(next);
  };
  const state = { ...previewState, displayConfig: config, mode };
  const zone = (id, horizontal = false) => <VisualZone zone={id} ids={config.layouts[mode][id] || []} config={config} state={state} selectedId={selectedId} onSelect={setSelectedId} draggingId={draggingId} onDragStart={setDraggingId} onDrop={move} horizontal={horizontal}/>;
  return <div className="grid gap-3">
    <div className="rounded-2xl border bg-gray-950 p-2 shadow-xl sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-white"><span className="flex items-center gap-1.5 text-[9px] font-bold sm:text-xs"><Monitor size={13}/>Vista previa en vivo</span><span className="text-[7px] text-white/55 sm:text-[9px]">Arrastrá un bloque o tocalo para moverlo</span></div>
      <div className="mx-auto flex aspect-video w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-xl border-2 border-gray-700 bg-[#16433D] text-white">
        <div className="flex h-[12%] min-h-5 flex-none items-center justify-between border-b border-white/15 px-2"><b className="truncate font-serif text-[7px] sm:text-xs">{state.businessName || "Kiosco+"}</b><span className="text-[4px] uppercase tracking-widest text-emerald-100 sm:text-[6px]">Pantalla del cliente</span></div>
        {zone("top", true)}
        {mode === "idle" ? <div className="grid min-h-0 flex-1 grid-cols-[22%_minmax(0,1fr)_22%] gap-1 p-1">{zone("left")}{zone("center")}{zone("right")}</div> : <div className="grid min-h-0 flex-1 place-items-center p-1.5"><div className="grid h-full w-full grid-cols-[minmax(0,1fr)_36%] gap-1.5"><div className="rounded-lg bg-white p-2 text-emerald-950"><b className="text-[7px] sm:text-xs">{mode === "complete" ? "¡Gracias por tu compra!" : "Tu compra"}</b><div className="mt-1 h-px bg-gray-200"/><p className="mt-1 text-[5px] text-gray-500 sm:text-[7px]">{mode === "complete" ? "La venta fue registrada" : "2 × Producto con promoción"}</p></div><div className="rounded-lg bg-[#F6F1E7] p-2 text-emerald-950"><p className="text-[5px] uppercase text-orange-700 sm:text-[7px]">{mode === "complete" ? "Total abonado" : "Total a pagar"}</p><b className="font-serif text-[10px] sm:text-xl">$4.000</b></div></div></div>}
        {zone("bottom", true)}
      </div>
    </div>

    {selected ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wide text-amber-800">Bloque seleccionado</p><p className="text-sm font-black">{DISPLAY_WIDGET_CATALOG[selected.type]?.label || selected.type}</p></div><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => shift(-1)} disabled={selectedIndex <= 0} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-[10px] font-bold disabled:opacity-30"><ChevronUp size={13}/>Antes</button><button type="button" onClick={() => shift(1)} disabled={!location || selectedIndex >= config.layouts[mode][location].length - 1} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-[10px] font-bold disabled:opacity-30"><ChevronDown size={13}/>Después</button><button type="button" onClick={() => remove(selectedId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[10px] font-bold text-red-700"><X size={13}/>Quitar</button></div></div><div className="mt-3 grid gap-3 lg:grid-cols-2"><div><p className="mb-1.5 text-[10px] font-bold text-gray-600">Mover a:</p><div className="flex flex-wrap gap-1.5">{allowedZones.map((target) => <button type="button" key={target} onClick={() => move(selectedId, target)} className={`min-h-9 rounded-lg border px-2.5 text-[10px] font-bold ${location === target ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white"}`}>{zoneNames[target]}</button>)}</div></div><WidgetSizeField value={selected.sizePercent ?? selected.size} onChange={resize}/></div></div> : <p className="rounded-xl border border-dashed bg-gray-50 px-3 py-2 text-center text-[10px] text-gray-500">Tocá cualquier bloque de la vista previa para moverlo, cambiar su tamaño o quitarlo.</p>}

    <div className="rounded-xl border bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black">Agregar un bloque</p><p className="mt-0.5 text-[10px] text-gray-500">Primero elegí la zona y después tocá el bloque. No abre el teclado ni menús del teléfono.</p></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zona donde agregar el bloque">{allowedZones.map((target) => <button type="button" key={target} onClick={() => setAddZone(target)} className={`min-h-10 rounded-lg border px-3 text-[10px] font-bold ${addZone === target ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-gray-700"}`}>{zoneNames[target]}</button>)}</div>
      </div>
      {available.length
        ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{available.map((item) => <button type="button" key={item.id} onClick={() => move(item.id, addZone)} className="flex min-h-12 items-center justify-center rounded-xl border bg-gray-50 px-2 text-center text-[10px] font-bold text-gray-800 transition hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{DISPLAY_WIDGET_CATALOG[item.type]?.label || item.type}</button>)}</div>
        : <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center text-[10px] font-semibold text-emerald-800">Todos los bloques disponibles ya están en esta pantalla.</p>}
    </div>
    {mode === "sale" && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">La lista de productos, el total, el medio de pago y el QR son obligatorios y permanecen fijos. Sólo se personalizan las franjas de arriba y abajo.</p>}
  </div>;
}

function ScheduleEditor({ value, onChange }) {
  const schedule = normalizeDisplaySchedule(value);
  const updateDay = (day, patch) => onChange(schedule.map((entry) => entry.day === day ? { ...entry, ...patch } : entry));
  const applyPreset = (days) => onChange(schedule.map((entry) => ({ ...entry, enabled: days.includes(entry.day), open: "08:00", close: "20:00" })));
  return <div className="mt-3">
    <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => applyPreset(["monday", "tuesday", "wednesday", "thursday", "friday"])} className="rounded-full border bg-white px-2.5 py-1.5 text-[9px] font-bold">Lun a vie · 8–20</button><button type="button" onClick={() => applyPreset(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])} className="rounded-full border bg-white px-2.5 py-1.5 text-[9px] font-bold">Lun a sáb · 8–20</button><button type="button" onClick={() => applyPreset([])} className="rounded-full border bg-white px-2.5 py-1.5 text-[9px] font-bold text-gray-500">Marcar todo cerrado</button></div>
    <div className="mt-2 divide-y overflow-hidden rounded-xl border">{DISPLAY_SCHEDULE_DAYS.map((day) => { const entry = schedule.find((item) => item.day === day.id); return <div key={day.id} className="grid gap-2 bg-white p-2.5 sm:grid-cols-[minmax(100px,.8fr)_auto_minmax(210px,1.2fr)] sm:items-center"><p className="text-xs font-black capitalize">{day.label}</p><button type="button" role="switch" aria-checked={entry.enabled} onClick={() => updateDay(day.id, { enabled: !entry.enabled })} className={`min-h-10 rounded-full px-3 text-[10px] font-black ${entry.enabled ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-500"}`}>{entry.enabled ? "Abierto" : "Cerrado"}</button><div className={`grid grid-cols-2 gap-2 ${entry.enabled ? "" : "opacity-40"}`}><label className="text-[9px] font-bold text-gray-500">Desde<input type="time" value={entry.open} disabled={!entry.enabled} onChange={(event) => updateDay(day.id, { open: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs font-bold text-gray-900 disabled:bg-gray-50"/></label><label className="text-[9px] font-bold text-gray-500">Hasta<input type="time" value={entry.close} disabled={!entry.enabled} onChange={(event) => updateDay(day.id, { close: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs font-bold text-gray-900 disabled:bg-gray-50"/></label></div></div>; })}</div>
    <p className="mt-2 text-[10px] text-gray-500">La pantalla resalta el día actual e indica automáticamente si el negocio está abierto o cerrado.</p>
  </div>;
}

function WidgetDetails({ config, products, onChange }) {
  const patchWidget = (id, patch) => onChange({ ...config, widgets: { ...config.widgets, [id]: { ...config.widgets[id], ...patch } }, preset: "custom" });
  const socials = config.widgets.socials || { id: "socials", type: "socials", items: [] };
  const socialItems = Array.isArray(socials.items) ? socials.items : [];
  const updateSocial = (index, patch) => patchWidget("socials", { items: socialItems.map((item, current) => current === index ? { ...item, ...patch } : item) });
  return <div className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Clima</h5><p className="mt-1 text-[10px] text-gray-500">Escribí la ciudad. Si se corta Internet, conserva el último resultado obtenido.</p><input value={config.widgets.weather?.city || ""} onChange={(event) => patchWidget("weather", { city: event.target.value.slice(0, 100), latitude: null, longitude: null })} placeholder="Ej.: Buenos Aires" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3 lg:col-span-2"><h5 className="text-xs font-black">Horarios del negocio</h5><p className="mt-1 text-[10px] text-gray-500">Configurá cada día como en la ficha de Google. Las horas antiguas escritas como texto se conservan hasta que uses esta planilla.</p><ScheduleEditor value={config.widgets.hours?.schedule} onChange={(schedule) => patchWidget("hours", { schedule })}/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Aviso personalizado</h5><input value={config.widgets.notice?.title || ""} onChange={(event) => patchWidget("notice", { title: event.target.value.slice(0, 80) })} placeholder="Título" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/><textarea value={config.widgets.notice?.text || ""} onChange={(event) => patchWidget("notice", { text: event.target.value.slice(0, 240) })} placeholder="Mensaje para los clientes" className="mt-2 min-h-16 w-full rounded-lg border p-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Producto destacado</h5><select value={config.widgets.featured?.productId || ""} onChange={(event) => patchWidget("featured", { productId: event.target.value })} className="mt-2 min-h-10 w-full rounded-lg border bg-white px-3 text-xs"><option value="">Elegir automáticamente</option>{products.slice(0, 500).map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></div>
    <div className="rounded-xl border bg-white p-3 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div><h5 className="text-xs font-black">Redes y contactos listos</h5><p className="mt-1 text-[10px] text-gray-500">Elegí el servicio y completá solamente el usuario, teléfono o enlace. Kiosco+ aplica su color y crea el QR.</p></div><button type="button" onClick={() => patchWidget("socials", { items: [...socialItems, { platform: "whatsapp", value: "", label: "" }].slice(0, 6) })} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#1C4A44] px-3 text-[10px] font-bold text-white"><Plus size={13}/>Agregar</button></div><div className="mt-3 grid gap-2">{socialItems.map((item, index) => <div key={index} className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_36px]"><select value={item.platform || "whatsapp"} onChange={(event) => updateSocial(index, { platform: event.target.value })} className="min-h-9 rounded-lg border bg-white px-2 text-[10px]">{Object.entries(SOCIAL_PLATFORMS).map(([id, platform]) => <option key={id} value={id}>{platform.label}</option>)}</select><input value={item.value || ""} onChange={(event) => updateSocial(index, { value: event.target.value.slice(0, 180) })} placeholder="Usuario, teléfono o enlace" className="min-h-9 rounded-lg border px-2 text-[10px]"/><input value={item.label || ""} onChange={(event) => updateSocial(index, { label: event.target.value.slice(0, 60) })} placeholder="Texto opcional" className="min-h-9 rounded-lg border px-2 text-[10px]"/><button type="button" onClick={() => patchWidget("socials", { items: socialItems.filter((_, current) => current !== index) })} className="grid h-9 place-items-center rounded-lg border border-red-200 text-red-600"><Trash2 size={14}/></button></div>)}{!socialItems.length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-gray-400">Todavía no agregaste contactos.</p>}</div></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Medios de pago</h5><div className="mt-2 flex flex-wrap gap-2">{["Efectivo", "Mercado Pago", "Transferencia", "Tarjeta"].map((method) => { const active = config.widgets.payments?.items?.includes(method); return <button type="button" key={method} onClick={() => patchWidget("payments", { items: active ? config.widgets.payments.items.filter((item) => item !== method) : [...(config.widgets.payments?.items || []), method] })} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${active ? "bg-emerald-700 text-white" : "border bg-white text-gray-600"}`}>{method}</button>; })}</div></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Imagen publicitaria</h5><div className="mt-2 flex items-center gap-3">{config.widgets.image?.src ? <img src={config.widgets.image.src} alt="" className="h-16 w-24 rounded-lg border object-contain"/> : <span className="grid h-16 w-24 place-items-center rounded-lg border border-dashed text-[10px] text-gray-400">Sin imagen</span>}<label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[10px] font-bold"><ImagePlus size={14}/>Elegir<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) patchWidget("image", { src: await uploadImage(file) }); }}/></label>{config.widgets.image?.src && <button type="button" onClick={() => patchWidget("image", { src: "" })} className="text-red-600"><Trash2 size={16}/></button>}</div></div>
  </div>;
}

export function CustomerDisplayLayoutEditor({ value, previewState = {}, slideSeconds, thanksSeconds, products, onChange, onSlideSeconds, onThanksSeconds }) {
  const config = useMemo(() => normalizeDisplayConfig(value), [value]);
  const [mode, setMode] = useState("idle");
  return <div className="grid gap-4">
    <div className="rounded-xl border bg-white p-3"><h4 className="text-sm font-black">Qué debe hacer esta pantalla</h4><div className="mt-2 grid gap-2 sm:grid-cols-3">{[[DISPLAY_MODES.saleAndAds, "Ventas + publicidad"], [DISPLAY_MODES.adsOnly, "Sólo publicidad"], [DISPLAY_MODES.saleOnly, "Sólo ventas"]].map(([id, label]) => <button type="button" key={id} onClick={() => onChange({ ...config, operationMode: id })} className={`min-h-11 rounded-lg border px-3 text-xs font-bold ${config.operationMode === id ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-gray-700"}`}>{label}</button>)}</div><p className="mt-2 text-[10px] text-gray-500">“Sólo publicidad” nunca muestra lo que se cobra, aunque esté conectada por HDMI. Es ideal para una TV alejada de la caja.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><DurationField label="Cambiar anuncio cada" value={slideSeconds} min={4} max={60} presets={[5, 8, 10, 15]} onCommit={onSlideSeconds}/><DurationField label="Mostrar agradecimiento" value={thanksSeconds} min={2} max={30} presets={[3, 5, 8, 10]} onCommit={onThanksSeconds}/></div>
    <div><h4 className="text-sm font-black">Diseños rápidos</h4><div className="mt-2 flex flex-wrap gap-2">{Object.entries(DISPLAY_PRESETS).map(([id, preset]) => <button type="button" key={id} onClick={() => onChange(applyDisplayPreset(config, id))} className={`rounded-full border px-3 py-2 text-[10px] font-bold ${config.preset === id ? "border-violet-700 bg-violet-700 text-white" : "bg-white"}`}>{preset.label}</button>)}</div></div>
    <div className="rounded-xl border bg-white p-3"><div className="flex flex-wrap gap-2">{Object.keys(modeNames).map((id) => <button type="button" key={id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${mode === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{modeNames[id]}</button>)}</div><div className="mt-3"><VisualLayoutEditor config={config} mode={mode} previewState={previewState} onChange={onChange}/></div></div>
    <WidgetDetails config={config} products={products} onChange={onChange}/>
  </div>;
}
