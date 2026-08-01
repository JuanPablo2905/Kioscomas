import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, X } from "lucide-react";

const join = (...values) => values.filter(Boolean).join(" ");

export function AppSelect({ value, onChange, options, children, className = "", disabled = false, placeholder = "Seleccionar", searchable }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState(null);
  const host = useRef(null);
  const menuHost = useRef(null);
  const items = useMemo(() => {
    const raw = options || React.Children.toArray(children).map((child) => ({
      value: child.props.value ?? child.props.children,
      label: child.props.children,
      disabled: child.props.disabled,
    }));
    return raw.map((item) => {
      if (typeof item === "string" || typeof item === "number") return { value: item, label: String(item), disabled: false };
      return { ...item, value: item.value ?? item.label, label: item.label ?? String(item.value ?? "") };
    });
  }, [options, children]);
  const selected = items.find((item) => String(item.value) === String(value));
  const canSearch = searchable ?? items.length > 7;
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return items;
    return items.filter((item) => String(item.label).toLocaleLowerCase("es").includes(normalized));
  }, [items, query]);

  useEffect(() => {
    const close = (event) => { if (!host.current?.contains(event.target) && !menuHost.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === "Escape") setOpen(false); };
    const viewportChange = (event) => {
      if (menuHost.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", viewportChange);
    window.addEventListener("scroll", viewportChange, true);
    window.visualViewport?.addEventListener("resize", viewportChange);
    window.visualViewport?.addEventListener("scroll", viewportChange);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", viewportChange); window.removeEventListener("scroll", viewportChange, true); window.visualViewport?.removeEventListener("resize", viewportChange); window.visualViewport?.removeEventListener("scroll", viewportChange); };
  }, []);

  const choose = (item) => {
    if (item.disabled) return;
    onChange?.(item.value);
    setQuery("");
    setOpen(false);
  };

  const toggle = () => {
    if (open) { setOpen(false); setQuery(""); return; }
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width });
    setOpen(true);
  };

  const viewportTop = typeof window !== "undefined" ? (window.visualViewport?.offsetTop || 0) : 0;
  const viewportHeight = typeof window !== "undefined" ? (window.visualViewport?.height || window.innerHeight) : 800;
  const viewportBottom = viewportTop + viewportHeight;
  const expectedHeight = Math.min(300, visibleItems.length * 44 + (canSearch ? 58 : 12));
  const openAbove = Boolean(anchor && anchor.bottom + expectedHeight + 12 > viewportBottom && anchor.top - expectedHeight - 12 >= viewportTop);
  const availableHeight = anchor ? (openAbove ? anchor.top - viewportTop - 12 : viewportBottom - anchor.bottom - 12) : 300;
  const menuWidth = anchor && typeof window !== "undefined" ? Math.min(Math.max(anchor.width, 208), window.innerWidth - 16) : 208;
  const menuLeft = anchor && typeof window !== "undefined" ? Math.max(8, Math.min(anchor.left, window.innerWidth - menuWidth - 8)) : 8;
  const menuTop = anchor ? (openAbove ? Math.max(viewportTop + 8, anchor.top - Math.min(expectedHeight, availableHeight) - 6) : anchor.bottom + 6) : 8;

  return <>
    <div ref={host} className={join("app-select", className, open && "is-open")}>
      <button type="button" disabled={disabled} onClick={toggle} className="app-select-trigger" aria-haspopup="listbox" aria-expanded={open}>
        <span className={join("min-w-0 flex-1 truncate", !selected && "text-gray-400")}>{selected?.label ?? placeholder}</span><ChevronDown className="shrink-0" size={16}/>
      </button>
    </div>
    {open && anchor && createPortal(<div ref={menuHost} className="app-select-menu" role="listbox" onWheel={(event) => event.stopPropagation()} style={{ position: "fixed", left: menuLeft, top: menuTop, width: menuWidth, maxHeight: Math.max(96, Math.min(300, availableHeight)), overflowY: "auto", overscrollBehavior: "contain", zIndex: 130 }}>
      {canSearch && <label className="sticky top-0 z-10 flex items-center gap-2 border-b bg-[var(--app-card)] p-2"><Search size={15} className="shrink-0 opacity-60"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Buscar opción..." className="min-h-9 min-w-0 flex-1 rounded-lg border bg-[var(--app-control)] px-2 text-sm text-[var(--app-control-text)]"/></label>}
      {visibleItems.map((item) => { const active = String(item.value) === String(value); return <button type="button" role="option" aria-selected={active} disabled={item.disabled} key={String(item.value)} onClick={() => choose(item)} className={join("app-select-option", active && "is-selected")}><span>{item.label}</span>{active && <Check className="shrink-0" size={15}/>}</button>; })}
      {visibleItems.length === 0 && <p className="p-3 text-center text-sm opacity-60">No hay coincidencias.</p>}
    </div>, document.body)}
  </>;
}

export function NumberInput({ value, onChange, onFocus, onBlur, min, max, step = 1, className = "", inputClassName = "", disabled = false, ...props }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(String(value ?? "")); }, [value, editing]);
  const numeric = Number(draft);
  const send = (next) => { const text = String(next); setDraft(text); onChange?.({ target: { value: text, valueAsNumber: Number(next) } }); };
  const adjust = (direction) => {
    const base = Number.isFinite(numeric) ? numeric : Number(min || 0);
    let next = base + Number(step || 1) * direction;
    if (min !== undefined) next = Math.max(Number(min), next);
    if (max !== undefined) next = Math.min(Number(max), next);
    const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
    send(Number(next.toFixed(decimals)));
  };
  const change = (event) => { setDraft(event.target.value); onChange?.(event); };
  const focus = (event) => { setEditing(true); const input = event.currentTarget; if (draft === "0") requestAnimationFrame(() => input.select()); onFocus?.(event); };
  const blur = (event) => { setEditing(false); if (draft.trim() === "") setDraft(String(value ?? 0)); onBlur?.(event); };
  return <div className={join("app-number", className)}>
    <button type="button" disabled={disabled || (min !== undefined && numeric <= Number(min))} onClick={() => adjust(-1)} aria-label="Disminuir"><Minus size={14}/></button>
    <input {...props} disabled={disabled} type="text" inputMode="decimal" value={draft} min={min} max={max} step={step} onChange={change} onFocus={focus} onBlur={blur} className={inputClassName}/>
    <button type="button" disabled={disabled || (max !== undefined && numeric >= Number(max))} onClick={() => adjust(1)} aria-label="Aumentar"><Plus size={14}/></button>
  </div>;
}

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Elegir fecha";

export function DateInput({ value, onChange, className = "", min, max }) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [anchor, setAnchor] = useState(null);
  const host = useRef(null);
  const calendarHost = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (!host.current?.contains(event.target) && !calendarHost.current?.contains(event.target)) setOpen(false);
    };
    const viewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", viewportChange);
    window.addEventListener("scroll", viewportChange, true);
    window.visualViewport?.addEventListener("resize", viewportChange);
    window.visualViewport?.addEventListener("scroll", viewportChange);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", viewportChange);
      window.removeEventListener("scroll", viewportChange, true);
      window.visualViewport?.removeEventListener("resize", viewportChange);
      window.visualViewport?.removeEventListener("scroll", viewportChange);
    };
  }, []);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstOffset = (start.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstOffset + 1));
  const choose = (date) => { const next = iso(date); if ((min && next < min) || (max && next > max)) return; onChange?.({ target: { value: next } }); setOpen(false); };
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width });
    setOpen(true);
  };
  const viewportTop = typeof window !== "undefined" ? (window.visualViewport?.offsetTop || 0) : 0;
  const viewportHeight = typeof window !== "undefined" ? (window.visualViewport?.height || window.innerHeight) : 800;
  const viewportBottom = viewportTop + viewportHeight;
  const calendarWidth = typeof window !== "undefined" ? Math.min(304, window.innerWidth - 16) : 304;
  const calendarHeight = 342;
  const openAbove = Boolean(anchor && anchor.bottom + calendarHeight + 12 > viewportBottom && anchor.top - calendarHeight - 12 >= viewportTop);
  const calendarLeft = anchor && typeof window !== "undefined" ? Math.max(8, Math.min(anchor.left, window.innerWidth - calendarWidth - 8)) : 8;
  const calendarTop = anchor ? (openAbove ? Math.max(viewportTop + 8, anchor.top - calendarHeight - 6) : Math.max(viewportTop + 8, Math.min(anchor.bottom + 6, viewportBottom - calendarHeight - 8))) : 8;
  const calendar = open && anchor ? createPortal(
    <div ref={calendarHost} className="app-calendar" style={{ position: "fixed", left: calendarLeft, top: calendarTop, width: calendarWidth, zIndex: 130 }}>
      <div className="app-calendar-header">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16}/></button>
        <b>{month.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</b>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16}/></button>
      </div>
      <div className="app-calendar-grid">
        {["L","M","X","J","V","S","D"].map((day) => <small key={day}>{day}</small>)}
        {days.map((date) => {
          const current = iso(date);
          return <button type="button" key={current} disabled={(min && current < min) || (max && current > max)} onClick={() => choose(date)} className={join(date.getMonth() !== month.getMonth() && "is-outside", current === value && "is-selected")}>{date.getDate()}</button>;
        })}
      </div>
    </div>,
    document.body,
  ) : null;
  return <><div ref={host} className={join("app-date", className)}><button type="button" onClick={toggle} className="app-date-trigger"><span className="min-w-0 truncate">{dateLabel(value)}</span><CalendarDays className="shrink-0" size={16}/></button></div>{calendar}</>;
}

export function ConfirmDialog({ open, title = "Confirmar accion", message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="app-confirm-title" className="app-confirm w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"><div className="flex items-start gap-3 border-b p-5"><span className={join("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}><AlertTriangle size={20}/></span><div className="min-w-0 flex-1"><h2 id="app-confirm-title" className="font-bold">{title}</h2><p className="mt-1 text-sm opacity-70">{message}</p></div><button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-black/5"><X size={18}/></button></div><div className="grid grid-cols-2 gap-2 p-4 sm:flex sm:justify-end"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">{cancelLabel}</button><button type="button" onClick={onConfirm} className={join("rounded-xl px-4 py-2.5 text-sm font-semibold text-white", danger ? "bg-red-600" : "bg-[var(--app-primary,#1d564d)]")}>{confirmLabel}</button></div></div></div>, document.body);
}

export function PromptDialog({ open, title, message, value, onChange, placeholder = "", confirmLabel = "Confirmar", cancelLabel = "Cancelar", readOnly = false, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"><div role="dialog" aria-modal="true" className="app-confirm w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"><div className="flex items-start justify-between gap-3 border-b p-5"><div><h2 className="font-bold">{title}</h2>{message&&<p className="mt-1 text-sm opacity-70">{message}</p>}</div><button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-black/5"><X size={18}/></button></div><div className="p-4"><textarea autoFocus={!readOnly} readOnly={readOnly} value={value} onChange={(event)=>onChange?.(event.target.value)} placeholder={placeholder} rows={readOnly?8:4} className="w-full resize-y rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--app-primary,#1d564d)]"/><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">{cancelLabel}</button><button type="button" onClick={onConfirm} className="rounded-xl bg-[var(--app-primary,#1d564d)] px-4 py-2.5 text-sm font-semibold text-white">{confirmLabel}</button></div></div></div></div>, document.body);
}

export function NativeSelectBridge() {
  const [menu, setMenu] = useState(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const open = (event) => {
      const select = event.target.closest?.("select");
      if (!select || select.disabled) return;
      event.preventDefault();
      const rect = select.getBoundingClientRect();
      setQuery("");
      setMenu({ select, rect, value: select.value, options: Array.from(select.options).map((option) => ({ value: option.value, label: option.text, disabled: option.disabled })) });
    };
    const close = (event) => { if (!event.target.closest?.(".native-select-menu") && !event.target.closest?.("select")) setMenu(null); };
    const escape = (event) => event.key === "Escape" && setMenu(null);
    const closeForViewportChange = (event) => {
      if (event.target?.closest?.(".native-select-menu")) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", open, true);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", closeForViewportChange);
    window.addEventListener("scroll", closeForViewportChange, true);
    window.visualViewport?.addEventListener("resize", closeForViewportChange);
    window.visualViewport?.addEventListener("scroll", closeForViewportChange);
    return () => { document.removeEventListener("pointerdown", open, true); document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); window.removeEventListener("resize", closeForViewportChange); window.removeEventListener("scroll", closeForViewportChange, true); window.visualViewport?.removeEventListener("resize", closeForViewportChange); window.visualViewport?.removeEventListener("scroll", closeForViewportChange); };
  }, []);
  if (!menu) return null;
  const choose = (option) => {
    if (option.disabled) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(menu.select, option.value);
    menu.select.dispatchEvent(new Event("change", { bubbles: true }));
    setMenu(null);
  };
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportBottom = viewportTop + viewportHeight;
  const menuWidth = Math.max(0, Math.min(Math.max(menu.rect.width, 190), viewportWidth - 16));
  const menuHeight = Math.min(256, menu.options.length * 42 + 12);
  const opensAbove = menu.rect.bottom + 8 + menuHeight > viewportBottom && menu.rect.top - menuHeight - 8 >= viewportTop;
  const top = opensAbove ? Math.max(viewportTop + 8, menu.rect.top - menuHeight - 8) : Math.min(menu.rect.bottom + 8, viewportBottom - Math.min(menuHeight, viewportHeight - 16) - 8);
  const left = Math.max(viewportLeft + 8, Math.min(menu.rect.left, viewportLeft + viewportWidth - menuWidth - 8));
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const visibleOptions = normalizedQuery ? menu.options.filter((option) => option.label.toLocaleLowerCase("es").includes(normalizedQuery)) : menu.options;
  return createPortal(<div className="native-select-menu fixed z-[120] max-h-64 overflow-y-auto overscroll-contain rounded-xl border p-1.5 shadow-2xl" onWheel={(event) => event.stopPropagation()} style={{ left, top, width: menuWidth, maxWidth: "calc(100vw - 16px)" }}>{menu.options.length > 7 && <label className="sticky top-0 z-10 flex items-center gap-2 border-b bg-[var(--app-card)] p-1.5"><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar opción..." className="min-h-9 min-w-0 flex-1 rounded-lg border bg-[var(--app-control)] px-2 text-sm text-[var(--app-control-text)]"/></label>}{visibleOptions.map((option) => { const active = String(option.value) === String(menu.value); return <button type="button" key={`${option.value}-${option.label}`} disabled={option.disabled} onClick={() => choose(option)} className={join("app-select-option rounded-lg", active && "is-selected")}><span>{option.label}</span>{active && <Check className="shrink-0" size={15}/>}</button>; })}{visibleOptions.length === 0 && <p className="p-3 text-center text-sm opacity-60">No hay coincidencias.</p>}</div>, document.body);
}
