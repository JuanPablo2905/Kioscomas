import React, { useEffect, useState } from "react";
import { Link2, RefreshCw, Unplug, WifiOff } from "lucide-react";
import { CustomerDisplayCanvas, fallbackCustomerDisplayState } from "./CustomerDisplayScreen";
import { cachedRemoteDisplay, loadRemoteDisplay, pairRemoteDisplay, unlinkRemoteDisplay } from "./remoteDisplays";

const stateFromDisplay = (display) => ({ ...fallbackCustomerDisplayState, ...(display?.content || {}), mode: "idle", connected: true });

export function RemoteDisplayScreen({ pairingCode = "" }) {
  const cached = cachedRemoteDisplay();
  const [state, setState] = useState(() => cached?.display ? stateFromDisplay(cached.display) : null);
  const [code, setCode] = useState(pairingCode);
  const [status, setStatus] = useState(cached?.display ? "cached" : "unlinked");
  const [message, setMessage] = useState(cached?.display ? "Mostrando la última copia guardada." : "");

  const refresh = async () => {
    try { const payload = await loadRemoteDisplay(); setState(stateFromDisplay(payload.display)); setStatus("online"); setMessage(""); }
    catch (error) {
      if (cachedRemoteDisplay()?.display) { setStatus("offline"); setMessage("Sin conexión: la pantalla sigue mostrando la última copia guardada."); }
      else { setStatus("unlinked"); setMessage(error.message); }
    }
  };
  const pair = async () => {
    setStatus("pairing"); setMessage("");
    try {
      const payload = await pairRemoteDisplay(code); setState(stateFromDisplay(payload.display)); setStatus("online"); setMessage("");
      const url = new URL(window.location.href); url.searchParams.delete("pair"); window.history.replaceState({}, "", url);
    } catch (error) { setStatus("unlinked"); setMessage(error.message); }
  };

  useEffect(() => {
    let timer;
    const initial = async () => {
      if (pairingCode) await pair();
      else await refresh();
      timer = window.setInterval(refresh, 30000);
    };
    initial();
    return () => window.clearInterval(timer);
  }, []);

  if (!state) return <main className="grid h-screen place-items-center overflow-hidden bg-[#16433D] p-6 text-white"><div className="w-full max-w-md rounded-3xl bg-white p-7 text-[#173F3A] shadow-2xl"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#16433D] text-white"><Link2 size={27}/></span><h1 className="mt-5 font-serif text-3xl font-black">Vincular pantalla</h1><p className="mt-2 text-sm leading-6 text-gray-600">Ingresá el código que aparece en Kiosco+ → Configuración → Pantallas. Funciona una sola vez y vence en 10 minutos.</p><input autoFocus value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} onKeyDown={(event) => event.key === "Enter" && code.length >= 6 && pair()} placeholder="CÓDIGO" className="mt-5 min-h-14 w-full rounded-xl border px-4 text-center text-xl font-black tracking-[.25em]"/><button disabled={code.length < 6 || status === "pairing"} type="button" onClick={pair} className="mt-3 min-h-12 w-full rounded-xl bg-[#D96B32] px-4 text-sm font-black text-white disabled:opacity-40">{status === "pairing" ? "Vinculando…" : "Vincular"}</button>{message && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p>}</div></main>;

  return <main className="relative flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-[#16433D] text-white"><header className="flex flex-none items-center justify-between gap-4 border-b border-white/15 px-5 py-2"><div className="min-w-0"><p className="truncate text-lg font-black">{state.businessName || "Kiosco+"}</p><p className="text-[10px] uppercase tracking-widest text-emerald-100">Pantalla publicitaria</p></div><div className="flex items-center gap-2">{status === "offline" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black text-amber-950"><WifiOff size={11}/>Sin conexión</span>}<button type="button" title="Actualizar" onClick={refresh} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><RefreshCw size={14}/></button><button type="button" title="Desvincular esta pantalla" onClick={() => { if (window.confirm("¿Desvincular esta pantalla?")) { unlinkRemoteDisplay(); setState(null); setStatus("unlinked"); } }} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Unplug size={14}/></button></div></header><CustomerDisplayCanvas state={state}/>{message && status === "offline" && <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-1.5 text-[10px]">{message}</p>}</main>;
}
