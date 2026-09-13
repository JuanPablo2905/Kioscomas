import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HandCoins, Smartphone, X } from "lucide-react";
import QRCode from "qrcode";
import { money } from "../../shared/domain";
import { acknowledgePaymentPresentation, listActivePaymentPresentations } from "./paymentService";

export function RemotePaymentReceiver({ businessId, businessName }) {
  const [presentation, setPresentation] = useState(null);
  const [qrImage, setQrImage] = useState("");
  const [dismissed, setDismissed] = useState("");
  const mobileDevice = useMemo(() => window.matchMedia?.("(max-width: 900px), (pointer: coarse)")?.matches, []);

  useEffect(() => {
    if (!businessId || !mobileDevice) return undefined;
    let active = true;
    const load = async () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      try {
        const payload = await listActivePaymentPresentations(businessId);
        const next = (payload.presentations || []).find((item) => item.id !== dismissed);
        if (active) {
          setPresentation(next || null);
          if (next?.id && !next.seenAt) acknowledgePaymentPresentation(businessId, next.id).catch(() => {});
        }
      } catch { /* La recepción remota no interrumpe el resto de la app. */ }
    };
    load();
    const timer = window.setInterval(load, 3000);
    const visible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [businessId, mobileDevice, dismissed]);

  useEffect(() => {
    let active = true;
    if (!presentation?.qrData) { setQrImage(presentation?.qrImage || ""); return undefined; }
    QRCode.toDataURL(presentation.qrData, { width: 520, margin: 1, color: { dark: "#092f46", light: "#ffffff" } }).then((value) => active && setQrImage(value)).catch(() => active && setQrImage(""));
    return () => { active = false; };
  }, [presentation?.id, presentation?.qrData, presentation?.qrImage]);

  if (!presentation) return null;
  const approved = presentation.status === "approved";
  return <div className="fixed inset-0 z-[235] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Cobro enviado a este celular">
    <div className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${approved ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>{approved ? <CheckCircle2 size={25}/> : <Smartphone size={24}/>}</span><button type="button" onClick={() => { setDismissed(presentation.id); setPresentation(null); }} aria-label="Cerrar en este dispositivo" className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-600"><X size={19}/></button></div>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#009ee3]">Cobro enviado desde la caja</p><h2 className="mt-1 text-2xl font-black">{approved ? "Pago acreditado" : `Mostrá este QR al cliente`}</h2><p className="mt-1 text-sm text-gray-500">{businessName || "Kiosco+"}</p>
      <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-center"><span className="text-xs font-bold text-sky-800">Importe a cobrar</span><p className="mt-1 text-4xl font-black text-sky-950">{money(presentation.amount)}</p>{presentation.method === "Pago combinado" && presentation.payments?.length > 0 && <div className="mt-3 grid gap-1 border-t border-sky-200 pt-3 text-left">{presentation.payments.map((item) => <p key={item.metodo} className="flex justify-between gap-3 text-xs"><span>{item.metodo}</span><b>{money(item.monto)}</b></p>)}</div>}</div>
      {qrImage && !approved && <img src={qrImage} alt="Código QR de Mercado Pago" className="mx-auto mt-4 aspect-square w-full max-w-[320px] rounded-2xl border bg-white p-2"/>}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#009ee3] px-4 py-3 text-sm font-black text-white"><HandCoins size={18}/>{presentation.mode === "dynamic_qr" ? "QR dinámico de Mercado Pago" : "QR de Mercado Pago"}</div>
      <p className="mt-3 text-center text-xs leading-5 text-gray-500">Esta pantalla sólo muestra el cobro. El dispositivo que inició la venta confirma el resultado y termina la operación.</p>
    </div>
  </div>;
}
