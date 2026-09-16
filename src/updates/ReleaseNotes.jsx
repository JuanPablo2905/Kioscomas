import React, { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Sparkles, X } from "lucide-react";
import releases from "../../release-notes/releases.json";

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";
const SEEN_RELEASE_KEY = "kiosco:release-notes:last-seen";

const formatDate = (value) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(date);
};

export const RELEASE_NOTES = releases;
export const CURRENT_RELEASE = RELEASE_NOTES.find((release) => release.version === CURRENT_VERSION) || null;

function ReleaseHighlights({ release }) {
  return <ul className="grid gap-2">
    {release.highlights.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6 text-gray-700"><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={10} strokeWidth={3}/></span><span>{item}</span></li>)}
  </ul>;
}

function ReleaseContent({ release, compact = false }) {
  return <div className={compact ? "grid gap-3" : "grid gap-5"}>
    {release.sections.map((section) => <section key={section.title}>
      <h4 className="text-sm font-black text-[#1C4A44]">{section.title}</h4>
      <ul className="mt-2 grid gap-2">
        {section.items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6 text-gray-600"><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={10} strokeWidth={3}/></span><span>{item}</span></li>)}
      </ul>
    </section>)}
  </div>;
}

// Primero lo simple (qué cambia para quien usa el kiosco), los detalles
// técnicos quedan un clic más adentro para quien los necesita.
function ReleaseBody({ release, compact = false }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasHighlights = Array.isArray(release.highlights) && release.highlights.length > 0;
  if (!hasHighlights) return <ReleaseContent release={release} compact={compact}/>;
  return <div className={compact ? "grid gap-3" : "grid gap-4"}>
    <ReleaseHighlights release={release}/>
    {showDetails ? <div className="border-t pt-4"><ReleaseContent release={release} compact={compact}/></div>
      : <button type="button" onClick={() => setShowDetails(true)} className="flex min-h-9 items-center gap-1 self-start text-xs font-bold text-[#1C4A44] underline underline-offset-2">Ver detalles<ChevronDown size={14}/></button>}
  </div>;
}

export function ReleaseNotesAnnouncement({ disabled = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled || !CURRENT_RELEASE) return;
    try {
      if (localStorage.getItem(SEEN_RELEASE_KEY) !== CURRENT_RELEASE.version) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [disabled]);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_RELEASE_KEY, CURRENT_RELEASE?.version || CURRENT_VERSION); } catch {}
    setOpen(false);
  };

  if (!open || !CURRENT_RELEASE) return null;
  return <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="release-notes-title" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
    <div className="flex max-h-[min(90dvh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <header className="relative shrink-0 bg-[#1C4A44] px-5 py-6 text-white sm:px-7">
        <button type="button" onClick={dismiss} aria-label="Cerrar novedades" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={20}/></button>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-amber-950"><Sparkles size={22}/></span>
        <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-emerald-100">Kiosco+ se actualizó</p>
        <h2 id="release-notes-title" className="mt-1 pr-10 font-serif text-2xl font-black sm:text-3xl">{CURRENT_RELEASE.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-100"><b className="rounded-full bg-white/10 px-2.5 py-1 text-white">Versión {CURRENT_RELEASE.version}</b><span className="inline-flex items-center gap-1"><CalendarDays size={13}/>{formatDate(CURRENT_RELEASE.date)}</span></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <p className="mb-5 text-sm leading-6 text-gray-700">{CURRENT_RELEASE.summary}</p>
        <ReleaseBody release={CURRENT_RELEASE}/>
      </div>
      <footer className="shrink-0 border-t bg-gray-50 p-4 sm:px-7"><button type="button" onClick={dismiss} className="min-h-12 w-full rounded-xl bg-[#1C4A44] px-5 text-sm font-black text-white">Entendido, empezar a usarla</button></footer>
    </div>
  </div>;
}

export function ReleaseNotesHistory() {
  if (!RELEASE_NOTES.length) return null;
  return <section className="rounded-2xl border bg-white p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Sparkles size={19}/></span><div><h3 className="font-bold">Novedades de Kiosco+</h3><p className="mt-1 text-xs leading-5 text-gray-500">Podés volver a consultar qué agregamos, corregimos o mejoramos en cada actualización.</p></div></div>
    <div className="mt-4 grid gap-3">
      {RELEASE_NOTES.map((release, index) => <details key={release.version} open={index === 0} className="group overflow-hidden rounded-xl border bg-gray-50">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"><span className="min-w-0"><b className="block text-sm">Versión {release.version} · {release.title}</b><small className="text-xs text-gray-500">{formatDate(release.date)}</small></span><ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={17}/></summary>
        <div className="border-t bg-white px-4 py-4"><p className="mb-4 text-sm leading-6 text-gray-600">{release.summary}</p><ReleaseBody release={release} compact/></div>
      </details>)}
    </div>
  </section>;
}
