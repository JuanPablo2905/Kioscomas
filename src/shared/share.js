const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export function normalizeWhatsAppPhone(value, countryCode = "54") {
  let digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  digits = digits.replace(/^0+/, "").replace(/^([1-9]\d{1,3})15/, "$1");
  return `${countryCode}${digits}`;
}

export function isValidWhatsAppPhone(value) {
  return /^\d{10,15}$/.test(normalizeWhatsAppPhone(value));
}

export function purchaseMessage({ businessName = "Kiosco+", providerName = "proveedor", items = [] }) {
  const lines = items.map((item) => `• ${Number(item.cantidad || 0)} x ${item.nombre}${Number(item.costoCompra || 0) > 0 ? ` (costo previsto $ ${Number(item.costoCompra).toLocaleString("es-AR")})` : ""}`);
  return `Hola ${providerName}. Pedido de ${businessName}:\n\n${lines.join("\n")}\n\n¿Podés confirmarme disponibilidad y total?`;
}

export function customerOrderMessage({ businessName = "Kiosco+", order = {} }) {
  const lines = (order.items || []).map((item) => `• ${Number(item.cantidad || 0)} x ${item.nombre}`);
  const scheduled = order.fechaRetiro
    ? new Date(`${order.fechaRetiro}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "fecha a coordinar";
  const time = order.horaRetiro ? ` a las ${order.horaRetiro}` : "";
  const note = String(order.nota || "").trim() ? `\nNota: ${String(order.nota).trim()}` : "";
  return `Hola ${order.cliente || ""}. Te confirmamos tu pedido en ${businessName}:\n\n${lines.join("\n")}\n\nRetiro: ${scheduled}${time}.${note}\nTotal estimado: $ ${Number(order.total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

export function ticketMessage(ticket, businessName = "Kiosco+") {
  const lines = (ticket?.items || []).map((item) => `• ${item.cantidad} x ${item.nombre} — $ ${Number(item.subtotal || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}${item.promocion?.nombre ? `\n  ${item.promocion.etiqueta || "PROMO"} · ${item.promocion.nombre}${Number(item.descuentoPromocion || 0) > 0 ? ` · ahorraste $ ${Number(item.descuentoPromocion).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ""}` : ""}`);
  const customer = ticket?.clienteNombre ? `\nCliente: ${ticket.clienteNombre}` : "";
  const savings = Number(ticket?.descuento || 0) > 0 ? `\nAHORRASTE: $ ${Number(ticket.descuento).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "";
  const presentation = ticket?.presentacionTicket || {};
  const numberLine = presentation.numeroVisible === false ? "" : `\nTicket #${String(presentation.prefijo || "")}${ticket?.numero || ticket?.id}`;
  return `${businessName}${numberLine}\n${new Date(ticket?.fecha || Date.now()).toLocaleString("es-AR")}${customer}\n\n${lines.join("\n")}\n\nTOTAL: $ ${Number(ticket?.total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}${savings}\nPago: ${ticket?.medio || "No informado"}`;
}

export function openWhatsApp({ phone = "", text = "" }) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!/^\d{10,15}$/.test(normalized)) return "";
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
}

export function openEmailDraft({ to = "", subject = "", body = "" }) {
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  return url;
}

export async function copyText(text) {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
}
