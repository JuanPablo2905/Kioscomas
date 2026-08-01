const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

export function normalizeWhatsAppPhone(value, countryCode = "54") {
  let digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  digits = digits.replace(/^0+/, "").replace(/^([1-9]\d{1,3})15/, "$1");
  return `${countryCode}${digits}`;
}

export function purchaseMessage({ businessName = "Kiosco+", providerName = "proveedor", items = [] }) {
  const lines = items.map((item) => `• ${Number(item.cantidad || 0)} x ${item.nombre}${Number(item.costoCompra || 0) > 0 ? ` (costo previsto $ ${Number(item.costoCompra).toLocaleString("es-AR")})` : ""}`);
  return `Hola ${providerName}. Pedido de ${businessName}:\n\n${lines.join("\n")}\n\n¿Podés confirmarme disponibilidad y total?`;
}

export function ticketMessage(ticket, businessName = "Kiosco+") {
  const lines = (ticket?.items || []).map((item) => `• ${item.cantidad} x ${item.nombre} — $ ${Number(item.subtotal || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`);
  const customer = ticket?.clienteNombre ? `\nCliente: ${ticket.clienteNombre}` : "";
  return `${businessName}\nTicket #${ticket?.id}\n${new Date(ticket?.fecha || Date.now()).toLocaleString("es-AR")}${customer}\n\n${lines.join("\n")}\n\nTOTAL: $ ${Number(ticket?.total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}\nPago: ${ticket?.medio || "No informado"}`;
}

export function openWhatsApp({ phone = "", text = "" }) {
  const normalized = normalizeWhatsAppPhone(phone);
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
