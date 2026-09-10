import React, { useEffect, useMemo, useState } from "react";
import { BadgePercent, Clock3, ImagePlus, Monitor, Play, Power, Trash2 } from "lucide-react";
import { closeCustomerDisplay, listCustomerDisplays, openCustomerDisplay } from "./customerDisplay";
import { promocionesParaPantalla } from "./salesRules";

const Switch = ({ checked, onChange }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`flex w-14 shrink-0 rounded-full p-1 ${checked ? "justify-end bg-emerald-600" : "justify-start bg-gray-300"}`}><span className="h-5 w-5 rounded-full bg-white shadow"/></button>;

const resizeImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
    image.onload = () => {
      const size = 640;
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", 0.9));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

export function CustomerDisplaySettings({ preferences, onChange, account, businessId, promotions = [], products = [] }) {
  const [displays, setDisplays] = useState([]);
  const [mode, setMode] = useState("browser");
  const [message, setMessage] = useState("");
  const set = (patch) => onChange({ ...preferences, ...patch });
  const displayPromotions = useMemo(() => promocionesParaPantalla(promotions, products), [promotions, products]);

  useEffect(() => {
    listCustomerDisplays().then((detail) => {
      setDisplays(detail.displays || []);
      setMode(detail.mode || "browser");
      if (!preferences.customerDisplayId && detail.displays?.length > 1) {
        const secondary = detail.displays.find((display) => !display.primary);
        if (secondary) set({ customerDisplayId: secondary.id });
      }
    }).catch(() => {});
  }, []);

  const basePreviewState = () => ({
    businessName: account?.nombreNegocio || "Kiosco+",
    businessImage: preferences.customerDisplayShowLogo === false ? null : account?.imagenNegocio,
    welcomeMessage: preferences.customerDisplayWelcome || "Bienvenido",
    thanksMessage: preferences.customerDisplayThanksMessage || "¡Gracias por tu compra!",
    contactLine: preferences.customerDisplayContactLine || "",
    showClock: preferences.customerDisplayShowClock !== false,
    slideSeconds: Math.max(4, Number(preferences.customerDisplaySlideSeconds || 8)),
    rotation: preferences.customerDisplayRotation || "ordered",
    showPromotionsDuringSale: preferences.customerDisplayShowPromotionsDuringSale !== false,
    promotions: displayPromotions,
    connected: true,
  });

  const openPreview = async (previewMode = "idle") => {
    setMessage("Abriendo...");
    const samplePromotion = displayPromotions[0] || { id: "sample", title: "Promoción de ejemplo", badge: "2×1", description: "La publicidad configurada aparecerá en este espacio.", productNames: ["Producto destacado"] };
    const state = previewMode === "sale" ? {
      ...basePreviewState(),
      mode: "sale",
      items: [
        { id: "sample-1", name: "Producto con promoción", quantity: 2, quantityLabel: "2 un", unitPrice: 2500, subtotal: 5000, finalSubtotal: 2500, promotion: { id: samplePromotion.id, name: samplePromotion.title, badge: samplePromotion.badge, discount: 2500 } },
        { id: "sample-2", name: "Producto sin promoción", quantity: 1, quantityLabel: "1 un", unitPrice: 1500, subtotal: 1500, finalSubtotal: 1500 },
      ],
      subtotal: 6500,
      promotionDiscount: 2500,
      manualDiscount: 0,
      discount: 2500,
      discountLines: [{ kind: "promotion", label: samplePromotion.title, badge: samplePromotion.badge, amount: 2500 }],
      total: 4000,
      payment: null,
      paymentQrImage: preferences.customerDisplayQrImage || null,
      showUnitPrices: preferences.customerDisplayShowUnitPrices !== false,
      showChange: preferences.customerDisplayShowChange !== false,
    } : { ...basePreviewState(), mode: "idle" };
    try {
      await openCustomerDisplay({ businessId, displayId: preferences.customerDisplayId, fullscreen: preferences.customerDisplayFullscreen !== false, state });
      setMessage(mode === "desktop" ? "La pantalla del cliente quedó abierta." : "La ventana quedó abierta. Podés moverla al segundo monitor y ponerla en pantalla completa.");
    } catch (error) { setMessage(error?.message || "No se pudo abrir la pantalla."); }
  };

  const uploadQr = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { set({ customerDisplayQrImage: await resizeImage(file) }); setMessage("QR guardado para este negocio."); }
    catch (error) { setMessage(error?.message || "No se pudo guardar el QR."); }
  };

  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1C4A44] text-white"><Monitor size={21}/></span><div><h3 className="font-bold">Segunda pantalla para clientes</h3><p className="mt-1 text-xs leading-5 text-gray-600">Muestra productos, promociones realmente aplicadas, total y medio de pago. Nunca recibe costos, stock, usuarios ni información administrativa.</p></div></div><Switch checked={preferences.customerDisplayEnabled === true} onChange={(customerDisplayEnabled) => set({ customerDisplayEnabled })}/></div>
    {preferences.customerDisplayEnabled && <div className="mt-5 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">{mode === "desktop" && displays.length > 0 && <label className="text-xs font-semibold text-gray-600">Monitor preferido<select value={preferences.customerDisplayId || ""} onChange={(event) => set({ customerDisplayId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"><option value="">Elegir automáticamente</option>{displays.map((display) => <option key={display.id} value={display.id}>{display.label} · {display.width}×{display.height}{display.primary ? " (principal)" : ""}</option>)}</select></label>}<label className="text-xs font-semibold text-gray-600">Mensaje de bienvenida<input value={preferences.customerDisplayWelcome || ""} onChange={(event) => set({ customerDisplayWelcome: event.target.value.slice(0, 80) })} placeholder="Bienvenido" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Mensaje después de cobrar<input value={preferences.customerDisplayThanksMessage || ""} onChange={(event) => set({ customerDisplayThanksMessage: event.target.value.slice(0, 100) })} placeholder="¡Gracias por tu compra!" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Contacto o redes<input value={preferences.customerDisplayContactLine || ""} onChange={(event) => set({ customerDisplayContactLine: event.target.value.slice(0, 120) })} placeholder="WhatsApp · Instagram · Dirección" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Mostrar agradecimiento (segundos)<input type="number" min="2" max="30" value={preferences.customerDisplayThanksSeconds || 6} onChange={(event) => set({ customerDisplayThanksSeconds: Math.max(2, Math.min(30, Number(event.target.value) || 6)) })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Cambiar anuncio cada (segundos)<input type="number" min="4" max="60" value={preferences.customerDisplaySlideSeconds || 8} onChange={(event) => set({ customerDisplaySlideSeconds: Math.max(4, Math.min(60, Number(event.target.value) || 8)) })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-gray-600">Orden de promociones<select value={preferences.customerDisplayRotation || "ordered"} onChange={(event) => set({ customerDisplayRotation: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"><option value="ordered">En el orden de Gestión</option><option value="random">Orden aleatorio</option></select></label></div>

      <div className="grid gap-2 sm:grid-cols-2"><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Abrir al entrar en Ventas<Switch checked={preferences.customerDisplayAutoOpen === true} onChange={(customerDisplayAutoOpen) => set({ customerDisplayAutoOpen })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Pantalla completa<Switch checked={preferences.customerDisplayFullscreen !== false} onChange={(customerDisplayFullscreen) => set({ customerDisplayFullscreen })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Mostrar logo<Switch checked={preferences.customerDisplayShowLogo !== false} onChange={(customerDisplayShowLogo) => set({ customerDisplayShowLogo })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Mostrar reloj<Switch checked={preferences.customerDisplayShowClock !== false} onChange={(customerDisplayShowClock) => set({ customerDisplayShowClock })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Mostrar precios unitarios<Switch checked={preferences.customerDisplayShowUnitPrices !== false} onChange={(customerDisplayShowUnitPrices) => set({ customerDisplayShowUnitPrices })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold">Mostrar vuelto<Switch checked={preferences.customerDisplayShowChange !== false} onChange={(customerDisplayShowChange) => set({ customerDisplayShowChange })}/></label><label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-semibold sm:col-span-2">Franja promocional durante la venta<Switch checked={preferences.customerDisplayShowPromotionsDuringSale !== false} onChange={(customerDisplayShowPromotionsDuringSale) => set({ customerDisplayShowPromotionsDuringSale })}/></label></div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="flex items-center gap-2 text-sm font-bold text-violet-950"><BadgePercent size={16}/>Promociones publicitarias</h4><p className="mt-1 text-xs leading-5 text-violet-800">Se administran en <b>Gestión → Promociones</b>. Activá “Anunciar en la segunda pantalla” en cada una. Las vencidas o sin productos disponibles se ocultan automáticamente.</p></div><span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-800">{displayPromotions.length} visible(s) ahora</span></div>{displayPromotions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{displayPromotions.map((promotion) => <span key={promotion.id} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-semibold text-violet-900">{promotion.badge} · {promotion.title}</span>)}</div>}</div>

      <div className="rounded-xl border bg-white p-4"><h4 className="text-sm font-bold">QR estático de Mercado Pago o transferencia</h4><p className="mt-1 text-xs leading-5 text-gray-500">Se muestra cuando el cajero elige Mercado Pago o Transferencia. Kiosco+ no confirma el pago automáticamente: el vendedor debe revisar el comprobante.</p><div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">{preferences.customerDisplayQrImage ? <img src={preferences.customerDisplayQrImage} alt="QR configurado" className="h-28 w-28 rounded-xl border object-contain p-1"/> : <span className="grid h-28 w-28 place-items-center rounded-xl border border-dashed text-center text-xs text-gray-400">Sin QR</span>}<div className="grid w-full gap-2 sm:w-auto"><label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1C4A44] px-4 text-xs font-bold text-white"><ImagePlus size={15}/>{preferences.customerDisplayQrImage ? "Reemplazar QR" : "Subir QR"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadQr} className="hidden"/></label>{preferences.customerDisplayQrImage && <button type="button" onClick={() => set({ customerDisplayQrImage: null })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-xs font-semibold text-red-700"><Trash2 size={15}/>Quitar QR</button>}</div></div></div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><button type="button" onClick={() => openPreview("idle")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-bold text-white"><Play size={16}/>Probar publicidad</button><button type="button" onClick={() => openPreview("sale")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-900"><Clock3 size={16}/>Simular venta</button><button type="button" onClick={() => closeCustomerDisplay({ businessId }).then(() => setMessage("Pantalla cerrada.")).catch(() => {})} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold"><Power size={16}/>Cerrar</button></div>{mode === "browser" && <p className="text-xs text-gray-500">En navegador se abre una ventana que tenés que mover manualmente al segundo monitor. La aplicación instalada puede elegirlo automáticamente.</p>}{message && <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{message}</p>}
    </div>}
  </section>;
}
