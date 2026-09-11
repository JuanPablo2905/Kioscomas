import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Link2, MonitorUp, RefreshCw, ShieldCheck, Trash2, Unplug } from "lucide-react";
import {
  approveRemotePairing, createRemoteDisplay, deleteRemoteDisplay, listRemoteDisplays,
  remoteDisplayEntryUrl, revokeRemoteDisplay, updateRemoteDisplay,
} from "./remoteDisplays";

const cleanPairingCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

export function RemoteDisplayManager({ businessId, content }) {
  const linkCode = useMemo(() => cleanPairingCode(new URLSearchParams(window.location.search).get("displayPair")), []);
  const [displays, setDisplays] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState(linkCode);
  const [selectedDisplayId, setSelectedDisplayId] = useState("");
  const [message, setMessage] = useState(linkCode ? "Código recibido desde el QR. Elegí la pantalla y autorizala." : "");
  const [busy, setBusy] = useState(false);
  const entryUrl = useMemo(() => remoteDisplayEntryUrl(), []);

  const refresh = async () => {
    try {
      const payload = await listRemoteDisplays(businessId); const next = payload.displays || [];
      setDisplays(next); setSelectedDisplayId((current) => current && next.some((display) => display.id === current) ? current : (next[0]?.id || ""));
    } catch (error) { setMessage(error.message); }
  };
  useEffect(() => { if (businessId) refresh(); }, [businessId]);

  const act = async (operation, success) => {
    setBusy(true); setMessage("");
    try { const payload = await operation(); success?.(payload); await refresh(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const authorize = () => {
    if (!selectedDisplayId) { setMessage("Primero creá o elegí una pantalla publicitaria."); return; }
    if (code.length !== 8) { setMessage("Ingresá los 8 caracteres que muestra la TV."); return; }
    act(() => approveRemotePairing(businessId, selectedDisplayId, code), () => {
      setMessage("Pantalla autorizada. La TV se conectará automáticamente en unos segundos."); setCode("");
      const url = new URL(window.location.href); url.searchParams.delete("displayPair"); window.history.replaceState({}, "", url);
    });
  };

  return <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white"><MonitorUp size={19}/></span><div><h4 className="text-sm font-black text-blue-950">TVs y pantallas publicitarias remotas</h4><p className="mt-1 text-xs leading-5 text-blue-800">La TV muestra el código y el dueño lo autoriza desde acá. Sólo recibe diseño, promociones y datos públicos.</p></div></div>

    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
      <p className="text-xs font-black text-gray-900">1. Abrí este enlace en la TV, tablet o computadora</p>
      <p className="mt-1 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-[10px] text-gray-600">{entryUrl}</p>
      <button type="button" onClick={async () => { try { await navigator.clipboard?.writeText(entryUrl); setMessage("Enlace copiado."); } catch { setMessage("No se pudo copiar. Mantené presionado el enlace para copiarlo."); } }} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold"><Copy size={13}/>Copiar enlace para la TV</button>
      <p className="mt-2 text-[10px] leading-4 text-gray-500">Al abrirlo, la TV mostrará un QR y un código de 8 caracteres. No necesita cámara.</p>
    </div>

    <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
      <p className="text-xs font-black text-gray-900">2. Creá el espacio publicitario que recibirá esa TV</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} placeholder="Ej.: TV de la vidriera" className="min-h-10 min-w-0 rounded-lg border bg-white px-3 text-xs"/><button disabled={busy} type="button" onClick={() => act(() => createRemoteDisplay(businessId, name || `Pantalla ${displays.length + 1}`, content), (payload) => { setName(""); setSelectedDisplayId(payload.display.id); setMessage("Pantalla publicitaria creada. Ya podés autorizar el código de la TV."); })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-50"><Link2 size={15}/>Crear pantalla</button></div>
    </div>

    <div className={`mt-3 rounded-xl border p-3 ${linkCode ? "border-emerald-300 bg-emerald-50" : "border-blue-200 bg-white"}`}>
      <p className="flex items-center gap-2 text-xs font-black text-gray-900"><ShieldCheck size={15}/>3. Autorizá el código que aparece en la TV</p>
      {linkCode && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-emerald-800">El QR completó el código automáticamente. Sólo falta elegir la pantalla y confirmar.</p>}
      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto]">
        <select value={selectedDisplayId} onChange={(event) => setSelectedDisplayId(event.target.value)} className="min-h-11 min-w-0 rounded-lg border bg-white px-3 text-xs"><option value="">Elegir pantalla…</option>{displays.map((display) => <option key={display.id} value={display.id}>{display.name}</option>)}</select>
        <input value={code} onChange={(event) => setCode(cleanPairingCode(event.target.value))} onKeyDown={(event) => event.key === "Enter" && authorize()} placeholder="CÓDIGO DE LA TV" autoComplete="one-time-code" className="min-h-11 min-w-0 rounded-lg border bg-white px-3 text-center font-mono text-sm font-black uppercase tracking-[.14em]"/>
        <button disabled={busy || code.length !== 8 || !selectedDisplayId} type="button" onClick={authorize} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 size={15}/>Autorizar</button>
      </div>
      <p className="mt-2 text-[10px] text-gray-500">Podés escanear el QR con la cámara normal del celular: abrirá Kiosco+ con este código ya escrito. Si preferís, copialo manualmente.</p>
    </div>

    <div className="mt-3 grid gap-2">{displays.map((display) => <div key={display.id} className={`rounded-xl border bg-white p-3 ${selectedDisplayId === display.id ? "border-blue-400 ring-1 ring-blue-200" : ""}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setSelectedDisplayId(display.id)} className="min-w-0 text-left"><p className="truncate text-xs font-black text-gray-900">{display.name}</p><p className="mt-1 text-[10px] text-gray-500">{display.pairedDevices ? `${display.pairedDevices} dispositivo(s) vinculado(s)` : "Sin vincular"}{display.lastSeenAt ? ` · Última conexión ${new Date(display.lastSeenAt).toLocaleString("es-AR")}` : ""}</p></button><div className="flex flex-wrap gap-1.5"><button disabled={busy} type="button" onClick={() => act(() => updateRemoteDisplay(businessId, display.id, { content }), () => setMessage(`Contenido de ${display.name} actualizado.`))} className="inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 text-[9px] font-bold"><RefreshCw size={12}/>Actualizar</button><button type="button" onClick={() => { setSelectedDisplayId(display.id); setMessage("Pantalla elegida. Ingresá el código que muestra la TV."); }} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 px-2.5 text-[9px] font-bold text-blue-800"><ShieldCheck size={12}/>Elegir</button><button disabled={busy || !display.pairedDevices} type="button" onClick={() => act(() => revokeRemoteDisplay(businessId, display.id), () => setMessage(`Se desvincularon los equipos de ${display.name}.`))} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-200 px-2.5 text-[9px] font-bold text-amber-800 disabled:opacity-40"><Unplug size={12}/>Desvincular</button><button disabled={busy} type="button" onClick={() => window.confirm(`¿Eliminar ${display.name}?`) && act(() => deleteRemoteDisplay(businessId, display.id), () => setMessage("Pantalla eliminada."))} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-600"><Trash2 size={13}/></button></div></div></div>)}{!displays.length && <p className="rounded-lg border border-dashed border-blue-200 bg-white p-4 text-center text-xs text-gray-500">Todavía no creaste pantallas remotas.</p>}</div>
    {message && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{message}</p>}
  </div>;
}
