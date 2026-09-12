import { ticketBarcodeHtml } from "./ticketBarcode";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
const currency = (value) => Number(value || 0).toLocaleString("es-AR", { style:"currency", currency:"ARS" });

export function printTicket(ticket, { businessName = "Mi negocio", paper = "80", template = {}, reprint = false } = {}) {
  const width = paper === "58" ? "58mm" : "80mm";
  const items = (ticket.items || []).map((item) => {
    const original = Number(item.subtotalBruto ?? Number(item.precioUnitario || item.precio || 0) * Number(item.cantidad || 0));
    const final = Number(item.subtotal ?? original);
    const promotion = item.promocion ? `<small class="promo">${escapeHtml(item.promocion.etiqueta || "PROMO")} · ${escapeHtml(item.promocion.nombre || "Promoción")}${Number(item.descuentoPromocion || 0) > 0 ? ` · ahorro ${currency(item.descuentoPromocion)}` : ""}</small>` : "";
    const amount = final < original ? `<span class="amount"><s>${currency(original)}</s><b>${currency(final)}</b></span>` : `<b>${currency(final)}</b>`;
    return `<div class="row"><span>${escapeHtml(item.cantidad)} × ${escapeHtml(item.nombre)}<small>${currency(item.precioUnitario || item.precio || 0)} c/u</small>${promotion}</span>${amount}</div>`;
  }).join("");
  const promotionDiscount = Math.max(0, Number(ticket.descuentoPromocion || 0));
  const manualDiscount = Math.max(0, Number(ticket.descuento || 0) - promotionDiscount);
  const promotionRows = Array.isArray(ticket.promociones) && ticket.promociones.length
    ? ticket.promociones.map((promotion) => `<div class="row saving"><span>${escapeHtml(promotion.etiqueta || "PROMO")} · ${escapeHtml(promotion.nombre || "Promoción")}</span><b>-${currency(promotion.descuento)}</b></div>`).join("")
    : promotionDiscount > 0 ? `<div class="row saving"><span>${escapeHtml(ticket.promocion?.nombre || "Promoción")}</span><b>-${currency(promotionDiscount)}</b></div>` : "";
  const discounts = `${promotionRows}${manualDiscount > 0 ? `<div class="row saving"><span>Descuento manual</span><b>-${currency(manualDiscount)}</b></div>` : ""}`;
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return false;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${escapeHtml(ticket.numero || ticket.id)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"><style>@page{size:${width} auto;margin:3mm}*{box-sizing:border-box}body{width:${width};margin:0 auto;padding:3mm;font-family:"Space Mono",Consolas,monospace;font-size:${Number(template.fontSize||12)}px;color:${template.textColor||"#2A241E"};background:${template.background||"#F6F1E7"}}h1,p{margin:0}h1{font-family:"Fraunces",Georgia,serif;font-weight:900;letter-spacing:-.025em}.center{text-align:center}.line{border-top:1px dashed currentColor;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:4px 0}.row small{display:block;opacity:.65}.row .promo{font-weight:700;opacity:1}.amount{text-align:right}.amount s{display:block;opacity:.55;font-size:.85em}.saving{font-size:.9em;font-weight:700}.total{font-size:1.25em;font-weight:900}.stamp{border:2px solid #B8412F;color:#B8412F;padding:4px;margin-bottom:8px;text-align:center;font-weight:900}</style></head><body>${reprint?'<div class="stamp">REIMPRESIÓN</div>':''}<div class="center"><b>${escapeHtml(template.header||"¡Gracias por tu compra!")}</b>${template.showBusiness!==false?`<h1>${escapeHtml(businessName)}</h1>`:""}</div><div class="line"></div><p>Ticket #${escapeHtml(ticket.numero || ticket.id)}</p><p>${new Date(ticket.fecha).toLocaleString("es-AR")}</p>${template.showCashier!==false?`<p>Atendió: ${escapeHtml(ticket.quien||"Sin identificar")}</p>`:""}<div class="line"></div>${items}<div class="line"></div>${Number(ticket.subtotal || 0) > Number(ticket.total || 0) ? `<div class="row"><span>Subtotal</span><b>${currency(ticket.subtotal)}</b></div>` : ""}${discounts}<div class="row total"><span>TOTAL</span><span>${currency(ticket.total)}</span></div>${Number(ticket.descuento || 0) > 0 ? `<p class="center saving">AHORRASTE ${currency(ticket.descuento)}</p>` : ""}${template.showPayment!==false?`<p>Pago: ${escapeHtml(ticket.medio||"")}</p>`:""}${template.showBarcode!==false?ticketBarcodeHtml(ticket.codigoTicket || ticket.id,template.textColor||"#2A241E"):""}<div class="line"></div><p class="center">${escapeHtml(template.footer||"Conservá este ticket")}</p></body></html>`);
  popup.document.close(); popup.focus(); setTimeout(() => { popup.print(); popup.close(); }, 250); return true;
}

export async function openCashDrawer(preferences = {}) {
  if (!preferences.hasCashDrawer) return { ok:false, reason:"disabled" };
  if (preferences.drawerConnection === "simulacion" || !window.kioscoDesktop?.openCashDrawer) return { ok:true, simulated:true };
  return window.kioscoDesktop.openCashDrawer({ printerName: preferences.printerName || "" });
}
