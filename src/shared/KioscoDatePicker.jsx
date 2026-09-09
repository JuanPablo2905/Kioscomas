import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const pad = (value) => String(value).padStart(2, "0");
const dateValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const validDateValue = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === Number(match[1])
    && date.getMonth() + 1 === Number(match[2])
    && date.getDate() === Number(match[3]);
};
const displayValue = (value) => validDateValue(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "";
const parseDisplayValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (validDateValue(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!match) return null;
  const normalized = `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  const date = new Date(`${normalized}T12:00:00`);
  return date.getFullYear() === Number(match[3]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[1]) ? normalized : null;
};

export function KioscoDatePicker({ value = "", onChange, min = "", max = "", disabled = false, placeholder = "dd/mm/aaaa", allowClear = true, className = "" }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => displayValue(value));
  const initial = validDateValue(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  useEffect(() => setDraft(displayValue(value)), [value]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const days = useMemo(() => {
    const mondayOffset = (visibleMonth.getDay() + 6) % 7;
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const choose = (next) => {
    if ((min && next < min) || (max && next > max)) return;
    onChange?.(next);
    setDraft(displayValue(next));
    setOpen(false);
  };
  const commitDraft = () => {
    const parsed = parseDisplayValue(draft);
    if (parsed !== null && (!parsed || ((!min || parsed >= min) && (!max || parsed <= max)))) onChange?.(parsed);
    else setDraft(displayValue(value));
  };
  const openCalendar = () => {
    if (disabled) return;
    const selected = validDateValue(value) ? new Date(`${value}T12:00:00`) : new Date();
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen((previous) => !previous);
  };

  return <div ref={rootRef} className={`relative min-w-0 ${className}`}>
    <div className="flex min-h-10 overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-[#1C4A44] focus-within:ring-2 focus-within:ring-[#1C4A44]/10">
      <input type="text" inputMode="numeric" value={draft} disabled={disabled} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter") { commitDraft(); event.currentTarget.blur(); } }} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:bg-gray-100" aria-label="Fecha"/>
      {allowClear && value && !disabled && <button type="button" onClick={() => { onChange?.(""); setDraft(""); }} className="grid w-8 place-items-center text-gray-400 hover:text-gray-700" aria-label="Borrar fecha"><X size={14}/></button>}
      <button type="button" disabled={disabled} onClick={openCalendar} className="grid w-10 shrink-0 place-items-center border-l bg-[#F6F1E7] text-[#1C4A44] disabled:opacity-50" aria-label="Abrir calendario"><CalendarDays size={17}/></button>
    </div>
    {open && <div className="fixed inset-x-3 bottom-3 z-[260] max-h-[calc(100vh-1.5rem)] overflow-auto rounded-2xl border border-[#C9D9D5] bg-white p-3 shadow-2xl sm:absolute sm:bottom-auto sm:left-0 sm:right-auto sm:top-[calc(100%+0.4rem)] sm:w-[19rem]">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F6F1E7]" aria-label="Mes anterior"><ChevronLeft size={18}/></button>
        <strong className="text-sm capitalize">{visibleMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</strong>
        <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F6F1E7]" aria-label="Mes siguiente"><ChevronRight size={18}/></button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-gray-400">{["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-0.5">{days.map((date) => {
        const next = dateValue(date);
        const selected = next === value;
        const today = next === dateValue(new Date());
        const outside = date.getMonth() !== visibleMonth.getMonth();
        const unavailable = (min && next < min) || (max && next > max);
        return <button type="button" key={next} disabled={unavailable} onClick={() => choose(next)} className={`grid aspect-square min-h-8 place-items-center rounded-lg text-xs transition ${selected ? "bg-[#1C4A44] font-bold text-white" : today ? "border border-[#D96B32] font-bold text-[#B95425]" : outside ? "text-gray-300 hover:bg-gray-50" : "text-gray-700 hover:bg-[#E8F3EF]"} disabled:cursor-not-allowed disabled:opacity-25`}>{date.getDate()}</button>;
      })}</div>
      <div className="mt-2 flex gap-2 border-t pt-2"><button type="button" onClick={() => choose(dateValue(new Date()))} className="flex-1 rounded-lg bg-[#E8F3EF] px-3 py-2 text-xs font-bold text-[#1C4A44]">Hoy</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cerrar</button></div>
    </div>}
  </div>;
}

export const datePickerHelpers = { dateValue, displayValue, parseDisplayValue };
