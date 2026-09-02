import React, { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

const formatCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 29);

export function ActivationView({ deviceId, onActivate }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (code.replace(/[^A-Z0-9]/g, "").length < 12) {
      setError("Escribí la clave completa que te dio el administrador.");
      return;
    }
    setWorking(true);
    setError("");
    try { await onActivate(code); }
    catch (activationError) { setError(activationError?.message || "No se pudo activar esta PC."); }
    finally { setWorking(false); }
  };

  return (
    <main className="min-h-screen bg-[#f5f0e6] p-4 text-gray-900 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[28px] border border-[#d9d2c5] bg-white shadow-[0_24px_80px_rgba(28,74,68,.12)] sm:min-h-[calc(100vh-4rem)] lg:grid-cols-[.92fr_1.08fr]">
        <section className="flex flex-col justify-between bg-[#173f3a] p-7 text-white sm:p-10">
          <img src={kioscoPlusLockup} alt="Kiosco+" className="h-12 w-auto max-w-[220px] object-contain object-left brightness-0 invert"/>
          <div className="my-12">
            <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><ShieldCheck size={29}/></span>
            <h1 className="max-w-md text-3xl font-bold leading-tight sm:text-4xl">Activá Kiosco+ en esta PC</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/75 sm:text-base">La clave confirma que esta instalación fue autorizada. Se pide una sola vez y las actualizaciones futuras se instalan normalmente.</p>
          </div>
          <p className="text-xs text-white/50">Equipo {String(deviceId || "").slice(-8).toUpperCase()}</p>
        </section>

        <section className="flex items-center p-7 sm:p-10 lg:p-14">
          <form onSubmit={submit} className="w-full">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><KeyRound size={24}/></span>
            <h2 className="mt-6 text-2xl font-bold">Clave de instalación</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">Pedile una clave al administrador de Kiosco+ y pegala acá.</p>
            <label className="mt-7 block text-xs font-bold uppercase tracking-wide text-gray-600" htmlFor="installation-code">Clave</label>
            <input
              id="installation-code"
              value={code}
              onChange={(event) => { setCode(formatCode(event.target.value)); setError(""); }}
              autoFocus
              autoComplete="off"
              spellCheck="false"
              placeholder="KIOSCO-XXXX-XXXX-XXXX-XXXX"
              className="mt-2 min-h-14 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 font-mono text-base font-semibold uppercase tracking-wide outline-none transition focus:border-[#1C4A44] focus:ring-4 focus:ring-[#1C4A44]/10"
            />
            {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            <button type="submit" disabled={working} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 font-semibold text-white transition hover:bg-[#163d38] disabled:cursor-wait disabled:opacity-60">
              {working ? <><Loader2 size={18} className="animate-spin"/>Comprobando...</> : <><CheckCircle2 size={18}/>Activar esta PC</>}
            </button>
            <p className="mt-5 text-center text-xs leading-5 text-gray-400">Necesitás Internet únicamente para validar la clave por primera vez.</p>
          </form>
        </section>
      </div>
    </main>
  );
}

