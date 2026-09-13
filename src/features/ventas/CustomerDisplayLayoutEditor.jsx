import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Monitor, Plus, Trash2, X } from "lucide-react";
import {
  DISPLAY_MODES, DISPLAY_PRESETS, DISPLAY_SCHEDULE_DAYS, DISPLAY_WIDGET_CATALOG,
  DISPLAY_PLACEMENT_MIN_HEIGHT, DISPLAY_PLACEMENT_MIN_WIDTH, SOCIAL_PLATFORMS,
  applyDisplayPreset, normalizeDisplayConfig, normalizeDisplayPlacement, normalizeDisplaySchedule,
} from "./displayConfig";
import { AdaptiveSocialCard } from "./AdaptiveSocialCard";
import { AdaptiveWelcomeCard } from "./AdaptiveWelcomeCard";
import { AdaptivePromotionsWidget } from "./AdaptivePromotionsWidget";
import { AdaptivePaymentMethodsWidget } from "./AdaptivePaymentMethodsWidget";

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

function WidgetVisual({ widget, state }) {
  const type = widget?.type;
  if (type === "saleItems") return <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-white text-emerald-950"><div className="border-b px-2 py-1"><b className="text-[6px] sm:text-[9px]">Tu compra</b><p className="text-[4px] text-gray-500 sm:text-[6px]">2 productos</p></div><div className="grid min-h-0 flex-1 content-center gap-1 px-2 text-[5px] sm:text-[7px]"><p className="flex justify-between gap-2"><span className="truncate">2 × Producto con promoción</span><b>$4.000</b></p><p className="flex justify-between gap-2"><span className="truncate">1 × Producto</span><b>$2.500</b></p></div></div>;
  if (type === "saleTotal") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-[#F6F1E7] p-1.5 text-center text-emerald-950"><p className="text-[5px] font-black uppercase text-orange-700 sm:text-[7px]">Total a pagar</p><b className="font-serif text-[11px] sm:text-xl">$6.500</b><p className="rounded bg-emerald-100 px-1 text-[4px] text-emerald-800 sm:text-[6px]">Ahorraste $2.000</p></div>;
  if (type === "salePayment") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-white p-1.5 text-center text-emerald-950"><p className="text-[4px] text-gray-500 sm:text-[6px]">Medio elegido</p><b className="text-[7px] sm:text-[10px]">Mercado Pago</b><span className="mt-1 grid aspect-square h-[45%] place-items-center rounded bg-gray-100 text-[5px] font-black sm:text-[7px]">QR</span></div>;
  if (type === "promotions") return <AdaptivePromotionsWidget widget={widget} promotions={state.promotions || []} seconds={state.slideSeconds} rotation={state.rotation} preview/>;
  if (type === "welcome") return <AdaptiveWelcomeCard title={state.welcomeMessage || "Bienvenido"} subtitle={state.contactLine || "Gracias por elegirnos"} preview/>;
  if (type === "clock") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-white/10 px-2 py-1 text-center"><b className="text-[9px] sm:text-xs">14:35</b><p className="text-[5px] text-emerald-100 sm:text-[7px]">jueves 10 de septiembre</p></div>;
  if (type === "weather") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-sky-500/25 p-1.5 text-center"><p className="text-[6px] font-bold sm:text-[8px]">CLIMA</p><b className="text-[10px] sm:text-base">24°</b><p className="truncate text-[5px] sm:text-[7px]">{widget.city || "Tu ciudad"}</p></div>;
  if (type === "social") return <AdaptiveSocialCard item={widget} preview/>;
  if (type === "hours") { const schedule = normalizeDisplaySchedule(widget.schedule); const active = schedule.filter((entry) => entry.enabled).slice(0, 3); return <div className="h-full rounded-md bg-white/10 p-1.5"><b className="text-[6px] text-amber-300 sm:text-[8px]">HORARIOS</b>{active.length ? <div className="mt-0.5 grid gap-px">{active.map((entry) => <p key={entry.day} className="flex justify-between gap-1 text-[5px] sm:text-[7px]"><span>{DISPLAY_SCHEDULE_DAYS.find((day) => day.id === entry.day)?.shortLabel}</span><span>{entry.open.replace(/^0/, "")}–{entry.close.replace(/^0/, "")}</span></p>)}</div> : <p className="line-clamp-2 text-[5px] sm:text-[7px]">{widget.text || "Configurá cada día"}</p>}</div>; }
  if (type === "payments") return <AdaptivePaymentMethodsWidget widget={widget} preview/>;
  if (type === "notice") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-amber-300 p-1.5 text-center text-amber-950"><b className="block truncate text-[6px] sm:text-[8px]">{widget.title || "Aviso"}</b><p className="line-clamp-2 text-[5px] sm:text-[7px]">{widget.text || "Mensaje para tus clientes"}</p></div>;
  if (type === "featuredProduct") return <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-white p-1.5 text-center text-emerald-950"><b className="block truncate text-[6px] sm:text-[8px]">Producto destacado</b><p className="text-[5px] sm:text-[7px]">$2.500</p></div>;
  if (type === "image") return widget.src ? <img src={widget.src} alt="" className="h-full w-full rounded-md object-cover"/> : <div className="grid h-full w-full min-h-8 place-items-center rounded-md border border-dashed border-white/40 text-[6px] text-white/70">Tu imagen</div>;
  return <div className="grid h-full w-full place-items-center rounded-md bg-white/10 p-1.5 text-[6px]">{DISPLAY_WIDGET_CATALOG[type]?.label || "Bloque"}</div>;
}

function CanvasNumberField({ label, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const safe = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : value;
    setDraft(String(Math.round(safe * 10) / 10));
    onCommit(safe);
  };
  return <label className="min-w-0 text-[10px] font-bold text-gray-600">{label}<span className="relative mt-1 block"><input inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} className="min-h-10 w-full min-w-0 rounded-lg border bg-white px-2 pr-6 text-center text-xs font-black text-gray-900"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">%</span></span></label>;
}

const defaultPlacementFor = (type, index = 0) => {
  const sizes = {
    promotions: [72, 13], welcome: [52, 48], clock: [30, 18], weather: [24, 32], social: [24, 34],
    hours: [27, 43], payments: [30, 22], notice: [34, 24], featuredProduct: [30, 38], image: [38, 34],
  };
  const [width, height] = sizes[type] || [30, 24];
  return normalizeDisplayPlacement({ x: (100 - width) / 2, y: Math.min(100 - height, 8 + index * 4), width, height, z: index + 1 });
};

const widgetName = (widget) => {
  if (widget?.type !== "social") return DISPLAY_WIDGET_CATALOG[widget?.type]?.label || widget?.type || "Bloque";
  const platform = SOCIAL_PLATFORMS[widget.platform] || SOCIAL_PLATFORMS.web;
  return `${platform.label}${widget.value ? ` · ${widget.value}` : ""}`;
};

const resizeHandles = [
  ["nw", "-left-2 -top-2 cursor-nwse-resize"], ["ne", "-right-2 -top-2 cursor-nesw-resize"],
  ["sw", "-bottom-2 -left-2 cursor-nesw-resize"], ["se", "-bottom-2 -right-2 cursor-nwse-resize"],
];

function CanvasWidget({ id, widget, placement, state, selected, onSelect, onPointerStart, onNudge }) {
  return <div role="button" tabIndex={0} aria-label={`${widgetName(widget)}. Arrastrar para mover.`} onPointerDown={(event) => onPointerStart(event, id, "move")} onKeyDown={(event) => { const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (movement) { event.preventDefault(); onNudge(id, ...movement); } }} onFocus={() => onSelect(id)} className={`customer-display-widget-frame group absolute touch-none select-none overflow-visible rounded-lg border text-left outline-none ${selected ? "border-amber-300 ring-2 ring-amber-300" : "border-white/20 hover:border-white/70 focus-visible:border-white"}`} style={{ left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, height: `${placement.height}%`, zIndex: placement.z }}>
    <div className="pointer-events-none h-full w-full overflow-hidden rounded-[inherit] p-0.5"><WidgetVisual widget={widget} state={state}/></div>
    <span className={`pointer-events-none absolute left-1 top-1 max-w-[85%] items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[5px] font-black text-white sm:text-[7px] ${selected ? "flex" : "hidden group-hover:flex"}`}><GripVertical className="shrink-0" size={8}/><span className="truncate">{widgetName(widget)}</span></span>
    {selected && resizeHandles.map(([handle, className]) => <span key={handle} role="presentation" onPointerDown={(event) => onPointerStart(event, id, handle)} className={`absolute z-20 h-4 w-4 touch-none rounded-full border-2 border-white bg-amber-400 shadow ${className}`}/>)}
  </div>;
}

function VisualLayoutEditor({ config, mode, previewState, onChange }) {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState("");
  const [draftPlacement, setDraftPlacement] = useState(null);
  useEffect(() => { setSelectedId(""); setDraftPlacement(null); }, [mode]);
  const placements = config.placements?.[mode] || {};
  const effectivePlacements = draftPlacement ? { ...placements, [draftPlacement.id]: draftPlacement.value } : placements;
  const available = Object.values(config.widgets).filter((item) => {
    const modes = DISPLAY_WIDGET_CATALOG[item.type]?.modes;
    return !placements[item.id] && (!modes || modes.includes(mode));
  });
  const selected = config.widgets[selectedId];
  const selectedPlacement = selectedId ? normalizeDisplayPlacement(effectivePlacements[selectedId]) : null;
  const state = { ...previewState, displayConfig: config, mode };

  const commitConfig = (mutate) => {
    const next = normalizeDisplayConfig(config);
    mutate(next);
    next.preset = "custom";
    onChange(next);
  };
  const updatePlacement = (id, value) => commitConfig((next) => { next.placements[mode][id] = normalizeDisplayPlacement(value); });
  const startPointer = (event, id, action) => {
    if (event.button != null && event.button !== 0) return;
    const canvas = canvasRef.current;
    const origin = normalizeDisplayPlacement(effectivePlacements[id]);
    if (!canvas || !origin) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(id);
    const rect = canvas.getBoundingClientRect();
    const startX = event.clientX; const startY = event.clientY;
    let latest = origin;
    const move = (pointer) => {
      const dx = ((pointer.clientX - startX) / rect.width) * 100;
      const dy = ((pointer.clientY - startY) / rect.height) * 100;
      if (action === "move") latest = normalizeDisplayPlacement({ ...origin, x: origin.x + dx, y: origin.y + dy });
      else {
        let left = origin.x; let right = origin.x + origin.width; let top = origin.y; let bottom = origin.y + origin.height;
        if (action.includes("w")) left = Math.max(0, Math.min(right - DISPLAY_PLACEMENT_MIN_WIDTH, origin.x + dx));
        if (action.includes("e")) right = Math.min(100, Math.max(left + DISPLAY_PLACEMENT_MIN_WIDTH, origin.x + origin.width + dx));
        if (action.includes("n")) top = Math.max(0, Math.min(bottom - DISPLAY_PLACEMENT_MIN_HEIGHT, origin.y + dy));
        if (action.includes("s")) bottom = Math.min(100, Math.max(top + DISPLAY_PLACEMENT_MIN_HEIGHT, origin.y + origin.height + dy));
        latest = normalizeDisplayPlacement({ x: left, y: top, width: right - left, height: bottom - top, z: origin.z });
      }
      setDraftPlacement({ id, value: latest });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish);
      setDraftPlacement(null); updatePlacement(id, latest);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
  };
  const nudge = (id, dx, dy) => { const current = normalizeDisplayPlacement(placements[id]); updatePlacement(id, { ...current, x: current.x + dx, y: current.y + dy }); };
  const add = (item) => {
    const placement = defaultPlacementFor(item.type, Object.keys(placements).length);
    commitConfig((next) => {
      next.placements[mode][item.id] = placement;
      const legacyZone = mode === "idle" ? "center" : "top";
      if (!next.layouts[mode][legacyZone].includes(item.id)) next.layouts[mode][legacyZone].push(item.id);
    });
    setSelectedId(item.id);
  };
  const remove = (id) => {
    commitConfig((next) => {
      delete next.placements[mode][id];
      Object.keys(next.layouts[mode]).forEach((zone) => { next.layouts[mode][zone] = next.layouts[mode][zone].filter((widgetId) => widgetId !== id); });
    });
    setSelectedId("");
  };
  const reorder = (id, direction) => commitConfig((next) => {
    const ids = Object.keys(next.placements[mode]).sort((a, b) => next.placements[mode][a].z - next.placements[mode][b].z);
    const filtered = ids.filter((widgetId) => widgetId !== id);
    direction === "front" ? filtered.push(id) : filtered.unshift(id);
    filtered.forEach((widgetId, index) => { next.placements[mode][widgetId] = { ...next.placements[mode][widgetId], z: index + 1 }; });
  });
  const patchSelected = (patch) => selectedPlacement && updatePlacement(selectedId, { ...selectedPlacement, ...patch });
  const patchSelectedWidget = (patch) => selected && commitConfig((next) => {
    next.widgets[selectedId] = { ...next.widgets[selectedId], ...patch };
  });
  const createSocial = () => {
    const id = `social-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const placement = defaultPlacementFor("social", Object.keys(placements).length);
    commitConfig((next) => {
      next.widgets[id] = { id, type: "social", enabled: true, platform: "whatsapp", value: "", label: "" };
      next.placements[mode][id] = placement;
      const legacyZone = mode === "idle" ? "right" : "bottom";
      next.layouts[mode][legacyZone].push(id);
    });
    setSelectedId(id);
  };
  const createPromotions = () => {
    const id = `promotions-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const placement = defaultPlacementFor("promotions", Object.keys(placements).length);
    commitConfig((next) => {
      next.widgets[id] = { id, type: "promotions", enabled: true, style: "strip", promotionSource: "auto", promotionIds: [], motion: "auto", direction: "forward", intervalSeconds: 0, visibleCount: 0 };
      next.placements[mode][id] = placement;
      next.layouts[mode][mode === "idle" ? "top" : "bottom"].push(id);
    });
    setSelectedId(id);
  };
  const deleteSocial = (id) => {
    commitConfig((next) => {
      delete next.widgets[id];
      for (const currentMode of ["idle", "sale", "complete"]) {
        delete next.placements[currentMode][id];
        Object.keys(next.layouts[currentMode]).forEach((zone) => { next.layouts[currentMode][zone] = next.layouts[currentMode][zone].filter((widgetId) => widgetId !== id); });
      }
    });
    setSelectedId("");
  };

  return <div className="grid gap-3">
    <div className="rounded-2xl border bg-gray-950 p-2 shadow-xl sm:p-3">
      <div className="mb-2 flex flex-col gap-1 px-1 text-white sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-1.5 text-[9px] font-bold sm:text-xs"><Monitor size={13}/>Editor libre de la pantalla</span><span className="text-[7px] text-white/60 sm:text-[9px]">No hay zonas ni tamaños preestablecidos · arrastrá y usá las cuatro esquinas</span></div>
      <div className="mx-auto flex aspect-video w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-xl border-2 border-gray-700 bg-[#16433D] text-white">
        <div className="flex h-[12%] min-h-5 flex-none items-center justify-between border-b border-white/15 px-2"><b className="truncate font-serif text-[7px] sm:text-xs">{state.businessName || "Kiosco+"}</b><span className="text-[4px] uppercase tracking-widest text-emerald-100 sm:text-[6px]">Pantalla del cliente</span></div>
        <div ref={canvasRef} onPointerDown={() => setSelectedId("")} className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:5%_10%]">
          {mode === "complete" && <div className="pointer-events-none absolute inset-x-[8%] bottom-[20%] top-[17%] grid place-items-center rounded-lg border border-dashed border-white/25 text-center opacity-75"><div><b className="font-serif text-[10px] sm:text-xl">¡Gracias por tu compra!</b><p className="text-[6px] text-emerald-100 sm:text-[8px]">Total abonado: $4.000</p></div></div>}
          {Object.entries(effectivePlacements).sort(([, a], [, b]) => a.z - b.z).map(([id, placement]) => config.widgets[id] ? <CanvasWidget key={id} id={id} widget={config.widgets[id]} placement={normalizeDisplayPlacement(placement)} state={state} selected={selectedId === id} onSelect={setSelectedId} onPointerStart={startPointer} onNudge={nudge}/> : null)}
          {!Object.keys(effectivePlacements).length && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[8px] font-semibold text-white/45 sm:text-xs">Agregá un bloque debajo y arrastralo donde quieras</div>}
        </div>
      </div>
    </div>

    {selected && selectedPlacement ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wide text-amber-800">Bloque seleccionado</p><p className="text-sm font-black">{widgetName(selected)}</p></div><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => reorder(selectedId, "back")} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-[10px] font-bold"><ChevronDown size={13}/>Enviar atrás</button><button type="button" onClick={() => reorder(selectedId, "front")} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-[10px] font-bold"><ChevronUp size={13}/>Traer adelante</button><button type="button" onClick={() => remove(selectedId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[10px] font-bold text-red-700"><X size={13}/>Quitar de esta vista</button></div></div>
      {selected.type === "welcome" && <p className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[10px] font-semibold text-amber-900">La bienvenida es un bloque completamente libre: podés moverla, estirarla, achicarla, superponerla o quitarla de esta vista.</p>}
      {selected.type === "social" && <div className="mt-3 grid gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:grid-cols-3"><label className="text-[10px] font-bold text-gray-600">Red o contacto<select value={selected.platform || "whatsapp"} onChange={(event) => patchSelectedWidget({ platform: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs text-gray-900">{Object.entries(SOCIAL_PLATFORMS).map(([id, platform]) => <option key={id} value={id}>{platform.label}</option>)}</select></label><label className="text-[10px] font-bold text-gray-600">Usuario, teléfono o enlace<input value={selected.value || ""} onChange={(event) => patchSelectedWidget({ value: event.target.value.slice(0, 180) })} placeholder="Ej.: 1122334455 o @minegocio" className="mt-1 min-h-10 w-full rounded-lg border px-2 text-xs text-gray-900"/></label><label className="text-[10px] font-bold text-gray-600">Texto del cuadro<input value={selected.label || ""} onChange={(event) => patchSelectedWidget({ label: event.target.value.slice(0, 80) })} placeholder="Ej.: Pedinos por WhatsApp" className="mt-1 min-h-10 w-full rounded-lg border px-2 text-xs text-gray-900"/></label><div className="sm:col-span-3"><button type="button" onClick={() => deleteSocial(selectedId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-[10px] font-bold text-red-700"><Trash2 size={13}/>Eliminar esta red de todas las vistas</button></div></div>}
      {selected.type === "promotions" && <PromotionWidgetSettings widget={selected} promotions={state.promotions || []} onChange={patchSelectedWidget}/>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><CanvasNumberField label="Posición horizontal" value={selectedPlacement.x} min={0} max={100 - selectedPlacement.width} onCommit={(x) => patchSelected({ x })}/><CanvasNumberField label="Posición vertical" value={selectedPlacement.y} min={0} max={100 - selectedPlacement.height} onCommit={(y) => patchSelected({ y })}/><CanvasNumberField label="Ancho" value={selectedPlacement.width} min={DISPLAY_PLACEMENT_MIN_WIDTH} max={100 - selectedPlacement.x} onCommit={(width) => patchSelected({ width })}/><CanvasNumberField label="Alto" value={selectedPlacement.height} min={DISPLAY_PLACEMENT_MIN_HEIGHT} max={100 - selectedPlacement.y} onCommit={(height) => patchSelected({ height })}/></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => patchSelected({ x: (100 - selectedPlacement.width) / 2 })} className="min-h-9 rounded-lg border bg-white px-3 text-[10px] font-bold">Centrar horizontal</button><button type="button" onClick={() => patchSelected({ y: (100 - selectedPlacement.height) / 2 })} className="min-h-9 rounded-lg border bg-white px-3 text-[10px] font-bold">Centrar vertical</button><button type="button" onClick={() => patchSelected({ x: 0, width: 100 })} className="min-h-9 rounded-lg border bg-white px-3 text-[10px] font-bold">Ocupar todo el ancho</button></div>
    </div> : <p className="rounded-xl border border-dashed bg-gray-50 px-3 py-2 text-center text-[10px] text-gray-500">Tocá un bloque para editarlo. También podés moverlo con las flechas del teclado.</p>}

    <div className="rounded-xl border bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black">Agregar un bloque</p><p className="mt-0.5 text-[10px] text-gray-500">Cada red social se crea como un cuadro independiente. Las tiras de promociones también conservan su propio contenido, tamaño y movimiento.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={createPromotions} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 text-[10px] font-bold text-orange-800"><Plus size={14}/>Nueva tira de promociones</button><button type="button" onClick={createSocial} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1C4A44] px-3 text-[10px] font-bold text-white"><Plus size={14}/>Nueva red o contacto</button></div></div>{available.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{available.map((item) => <button type="button" key={item.id} onClick={() => add(item)} className="flex min-h-12 items-center justify-center rounded-xl border bg-gray-50 px-2 text-center text-[10px] font-bold text-gray-800 transition hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{widgetName(item)}</button>)}</div> : <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center text-[10px] font-semibold text-emerald-800">Los bloques existentes ya están en esta vista. Podés crear otra red o tira con los botones de arriba.</p>}</div>
    {mode === "sale" && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">La lista de la compra, el total y el pago/QR son widgets independientes. Podés moverlos, achicarlos, agrandarlos o quitarlos igual que cualquier publicidad.</p>}
    {mode === "complete" && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">El agradecimiento central permanece como base. Los demás widgets se pueden mover, redimensionar o superponer libremente.</p>}
  </div>;
}

function PromotionWidgetSettings({ widget, promotions, onChange }) {
  const selectedIds = Array.isArray(widget.promotionIds) ? widget.promotionIds.map(String) : [];
  const togglePromotion = (id) => onChange({ promotionIds: selectedIds.includes(String(id)) ? selectedIds.filter((current) => current !== String(id)) : [...selectedIds, String(id)] });
  return <div className="mt-3 rounded-xl border border-orange-200 bg-white p-3">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-[10px] font-bold text-gray-600">Qué promociones mostrar<select value={widget.promotionSource || "auto"} onChange={(event) => onChange({ promotionSource: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs text-gray-900"><option value="auto">Todas las activas</option><option value="manual">Elegir manualmente</option></select></label>
      <label className="text-[10px] font-bold text-gray-600">Movimiento<select value={widget.motion || "auto"} onChange={(event) => onChange({ motion: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs text-gray-900"><option value="auto">Automático según la forma</option><option value="horizontal">Deslizar horizontal</option><option value="vertical">Deslizar vertical</option><option value="fade">Fundido</option><option value="none">Sin movimiento</option></select></label>
      <label className="text-[10px] font-bold text-gray-600">Sentido<select value={widget.direction || "forward"} onChange={(event) => onChange({ direction: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs text-gray-900"><option value="forward">Normal</option><option value="reverse">Inverso</option></select></label>
      <label className="text-[10px] font-bold text-gray-600">Promociones visibles<select value={Number(widget.visibleCount || 0)} onChange={(event) => onChange({ visibleCount: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs text-gray-900"><option value="0">Automático por tamaño</option>{[1,2,3,4,5,6].map((count) => <option value={count} key={count}>{count} a la vez</option>)}</select></label>
      <label className="text-[10px] font-bold text-gray-600 sm:col-span-2">Segundos propios del widget <span className="font-normal text-gray-400">(0 usa el tiempo general)</span><input inputMode="numeric" value={Number(widget.intervalSeconds || 0)} onChange={(event) => onChange({ intervalSeconds: Math.max(0, Math.min(60, Number(event.target.value.replace(/\D/g, "")) || 0)) })} className="mt-1 min-h-10 w-full rounded-lg border px-3 text-xs text-gray-900"/></label>
    </div>
    {widget.promotionSource === "manual" && <div className="mt-3"><p className="text-[10px] font-black text-gray-700">Promociones de este cuadro</p>{promotions.length ? <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{promotions.map((promotion) => { const active = selectedIds.includes(String(promotion.id)); return <button type="button" key={promotion.id} onClick={() => togglePromotion(promotion.id)} className={`min-h-10 rounded-lg border px-3 text-left text-[10px] font-bold ${active ? "border-orange-500 bg-orange-50 text-orange-900" : "bg-white text-gray-600"}`}><span className="mr-1.5">{active ? "✓" : "○"}</span>{promotion.badge || "PROMO"} · {promotion.title}</button>; })}</div> : <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[10px] text-gray-500">Todavía no hay promociones activas anunciadas en Gestión.</p>}<p className="mt-2 text-[9px] text-gray-500">Si no elegís ninguna, el cuadro queda vacío. Así podés reservarlo para una campaña futura sin mezclar otras promociones.</p></div>}
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
  return <div className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Clima</h5><p className="mt-1 text-[10px] text-gray-500">Escribí la ciudad. Si se corta Internet, conserva el último resultado obtenido.</p><input value={config.widgets.weather?.city || ""} onChange={(event) => patchWidget("weather", { city: event.target.value.slice(0, 100), latitude: null, longitude: null })} placeholder="Ej.: Buenos Aires" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3 lg:col-span-2"><h5 className="text-xs font-black">Horarios del negocio</h5><p className="mt-1 text-[10px] text-gray-500">Configurá cada día como en la ficha de Google. Las horas antiguas escritas como texto se conservan hasta que uses esta planilla.</p><ScheduleEditor value={config.widgets.hours?.schedule} onChange={(schedule) => patchWidget("hours", { schedule })}/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Aviso personalizado</h5><input value={config.widgets.notice?.title || ""} onChange={(event) => patchWidget("notice", { title: event.target.value.slice(0, 80) })} placeholder="Título" className="mt-2 min-h-10 w-full rounded-lg border px-3 text-xs"/><textarea value={config.widgets.notice?.text || ""} onChange={(event) => patchWidget("notice", { text: event.target.value.slice(0, 240) })} placeholder="Mensaje para los clientes" className="mt-2 min-h-16 w-full rounded-lg border p-3 text-xs"/></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Producto destacado</h5><select value={config.widgets.featured?.productId || ""} onChange={(event) => patchWidget("featured", { productId: event.target.value })} className="mt-2 min-h-10 w-full rounded-lg border bg-white px-3 text-xs"><option value="">Elegir automáticamente</option>{products.slice(0, 500).map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></div>
    <div className="rounded-xl border bg-white p-3"><h5 className="text-xs font-black">Medios de pago</h5><p className="mt-1 text-[10px] text-gray-500">El widget usa todo el lugar disponible y cambia su distribución según la forma que le des.</p><div className="mt-2 flex flex-wrap gap-2">{["Efectivo", "Mercado Pago", "Transferencia", "Tarjeta", "Cuenta corriente"].map((method) => { const active = config.widgets.payments?.items?.includes(method); return <button type="button" key={method} onClick={() => patchWidget("payments", { items: active ? config.widgets.payments.items.filter((item) => item !== method) : [...(config.widgets.payments?.items || []), method] })} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${active ? "bg-emerald-700 text-white" : "border bg-white text-gray-600"}`}>{method}</button>; })}</div></div>
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
