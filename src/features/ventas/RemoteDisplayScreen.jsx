import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, LoaderCircle, RefreshCw, Smartphone, Unplug, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { CustomerDisplayCanvas, fallbackCustomerDisplayState } from "./CustomerDisplayScreen";
import {
  cachedRemoteDisplay, loadRemoteDisplay, pairRemoteDisplay, pollRemoteDisplayPairing,
  requestRemoteDisplayPairing, unlinkRemoteDisplay,
} from "./remoteDisplays";

const stateFromDisplay = (display) => ({ ...fallbackCustomerDisplayState, ...(display?.content || {}), mode: "idle", connected: true });

export function RemoteDisplayScreen({ pairingCode = "" }) {
  const cached = cachedRemoteDisplay();
  const [state, setState] = useState(() => cached?.display ? stateFromDisplay(cached.display) : null);
  const [pairing, setPairing] = useState(null);
  const [pairingQr, setPairingQr] = useState("");
  const [status, setStatus] = useState(cached?.display ? "cached" : "preparing");
  const [message, setMessage] = useState(cached?.display ? "Mostrando la última copia guardada." : "Preparando un código seguro…");

  const refresh = async () => {
    try {
      const payload = await loadRemoteDisplay();
      setState(stateFromDisplay(payload.display)); setStatus("online"); setMessage("");
    } catch (error) {
      if (cachedRemoteDisplay()?.display) { setStatus("offline"); setMessage("Sin conexión: la pantalla sigue mostrando la última copia guardada."); }
      else { setState(null); setStatus("preparing"); setMessage(error.message); }
    }
  };

  const preparePairing = async (force = false) => {
    setStatus("preparing"); setMessage("Preparando un código seguro…");
    try {
      const next = await requestRemoteDisplayPairing({ force });
      setPairing(next); setStatus("waiting"); setMessage("Esperando que el dueño autorice esta pantalla desde Kiosco+.");
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };

  useEffect(() => {
    let active = true;
    const initial = async () => {
      if (cachedRemoteDisplay()?.display) { await refresh(); return; }
      if (pairingCode) {
        try {
          const payload = await pairRemoteDisplay(pairingCode);
          if (active) { setState(stateFromDisplay(payload.display)); setStatus("online"); setMessage(""); }
          return;
        } catch {}
      }
      if (active) await preparePairing();
    };
    initial();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!pairing?.authorizationUrl) { setPairingQr(""); return undefined; }
    QRCode.toDataURL(pairing.authorizationUrl, { width: 360, margin: 2, color: { dark: "#123c36", light: "#ffffff" } })
      .then((value) => active && setPairingQr(value)).catch(() => active && setPairingQr(""));
    return () => { active = false; };
  }, [pairing?.authorizationUrl]);

  useEffect(() => {
    if (!pairing?.requestToken || state) return undefined;
    let active = true; let checking = false;
    const check = async () => {
      if (checking) return; checking = true;
      try {
        const payload = await pollRemoteDisplayPairing(pairing.requestToken);
        if (active && payload.status === "approved" && payload.display) {
          setState(stateFromDisplay(payload.display)); setStatus("online"); setMessage("");
        }
      } catch (error) {
        if (!active) return;
        if ([404, 410].includes(error.status)) await preparePairing(true);
        else { setStatus("waiting"); setMessage("No pudimos consultar ahora. Seguimos intentando automáticamente…"); }
      } finally { checking = false; }
    };
    check(); const timer = window.setInterval(check, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [pairing?.requestToken, state]);

  useEffect(() => {
    if (!state) return undefined;
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [Boolean(state)]);

  if (!state) return <main className="grid min-h-[100dvh] place-items-center overflow-auto bg-[#16433D] p-4 text-white sm:p-8">
    <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white text-[#173F3A] shadow-2xl">
      <div className="grid lg:grid-cols-[minmax(280px,42%)_minmax(0,1fr)]">
        <section className="grid place-items-center bg-[#F6F1E7] p-6 sm:p-8">
          {pairingQr ? <img src={pairingQr} alt="Código QR para autorizar esta pantalla" className="aspect-square w-full max-w-[320px] rounded-2xl border bg-white p-2 shadow-lg"/> : <span className="grid aspect-square w-full max-w-[320px] place-items-center rounded-2xl border border-dashed bg-white"><LoaderCircle className="animate-spin" size={38}/></span>}
        </section>
        <section className="p-6 sm:p-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#16433D] text-white"><Smartphone size={27}/></span>
          <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[#D65F2B]">Conectar con el negocio</p>
          <h1 className="mt-2 font-serif text-3xl font-black sm:text-4xl">Vinculá esta pantalla</h1>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-gray-600">
            <li><b className="text-[#173F3A]">1.</b> Desde el celular del dueño, escaneá el QR.</li>
            <li><b className="text-[#173F3A]">2.</b> Iniciá sesión en Kiosco+ y elegí la pantalla publicitaria.</li>
            <li><b className="text-[#173F3A]">3.</b> Tocá <b>Autorizar</b>. Esta TV se conectará sola.</li>
          </ol>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">También podés escribir este código en la app</p>
            <p className="mt-2 font-mono text-3xl font-black tracking-[.22em] text-emerald-950 sm:text-4xl">{pairing?.code || "········"}</p>
            <p className="mt-2 text-[10px] text-emerald-800">Vence en 10 minutos y funciona una sola vez.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {pairing?.authorizationUrl && <button type="button" onClick={() => navigator.clipboard?.writeText(pairing.authorizationUrl)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold"><Copy size={14}/>Copiar enlace del QR</button>}
            <button type="button" onClick={() => preparePairing(true)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold"><RefreshCw size={14}/>Generar otro código</button>
          </div>
          <p className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800"}`}><LoaderCircle className={status === "preparing" ? "animate-spin" : ""} size={13}/><span>{message}</span></p>
        </section>
      </div>
    </div>
  </main>;

  return <main className="relative flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-[#16433D] text-white"><header className="flex flex-none items-center justify-between gap-4 border-b border-white/15 px-5 py-2"><div className="min-w-0"><p className="truncate text-lg font-black">{state.businessName || "Kiosco+"}</p><p className="text-[10px] uppercase tracking-widest text-emerald-100">Pantalla publicitaria</p></div><div className="flex items-center gap-2">{status === "online" && <span className="hidden items-center gap-1 rounded-full bg-emerald-300 px-2.5 py-1 text-[9px] font-black text-emerald-950 sm:inline-flex"><CheckCircle2 size={11}/>Conectada</span>}{status === "offline" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black text-amber-950"><WifiOff size={11}/>Sin conexión</span>}<button type="button" title="Actualizar" onClick={refresh} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><RefreshCw size={14}/></button><button type="button" title="Desvincular esta pantalla" onClick={() => { if (window.confirm("¿Desvincular esta pantalla?")) { unlinkRemoteDisplay(); setState(null); setPairing(null); preparePairing(true); } }} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Unplug size={14}/></button></div></header><CustomerDisplayCanvas state={state}/>{message && status === "offline" && <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-1.5 text-[10px]">{message}</p>}</main>;
}
