const digits = (value) => String(value || "").replace(/\D/g, "");
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function isValidCuit(value) {
  const normalized = digits(value);
  if (normalized.length !== 11 || /^(\d)\1+$/.test(normalized)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(normalized[index]) * weight, 0);
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return verifier === Number(normalized[10]);
}

export function formatCuit(value) {
  const normalized = digits(value).slice(0, 11);
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 10) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 10)}-${normalized.slice(10)}`;
}

export function allowedDocumentTypes(issuerCondition) {
  return issuerCondition === "Responsable inscripto" ? ["A", "B"] : ["C"];
}

export function suggestedDocumentType(issuerCondition, receiverCondition) {
  if (issuerCondition !== "Responsable inscripto") return "C";
  return receiverCondition === "Responsable inscripto" ? "A" : "B";
}

export function calculateDocumentTotals(ticket, type, taxRate = 21) {
  const total = roundMoney(ticket?.total || 0);
  const rate = Math.max(0, Number(taxRate) || 0);
  if (type === "C" || rate === 0) return { net: total, tax: 0, total, taxRate: 0 };
  const net = roundMoney(total / (1 + rate / 100));
  return { net, tax: roundMoney(total - net), total, taxRate: rate };
}

export function nextDocumentSequence(existing = [], pointOfSale, type) {
  const normalizedPoint = String(Number(pointOfSale) || 1).padStart(4, "0");
  const sequences = existing
    .filter((item) => String(item.puntoVenta || item.numero?.split("-")[0] || "").padStart(4, "0") === normalizedPoint && item.tipo === type)
    .map((item) => Number(item.secuencia || item.numero?.split("-").at(-1)) || 0);
  return Math.max(0, ...sequences) + 1;
}

function internalVerificationCode({ type, pointOfSale, sequence, ticketId, total }) {
  const source = `${type}|${pointOfSale}|${sequence}|${ticketId}|${total}`;
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `CNF-${Math.abs(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

export function validateDocumentDraft({ config, draft, ticket, existing = [] }) {
  const errors = [];
  const allowed = allowedDocumentTypes(config.condicionFiscal);
  if (!String(config.razonSocial || "").trim()) errors.push("Completá la razón social del emisor.");
  if (!isValidCuit(config.cuit)) errors.push("El CUIT del emisor no es válido.");
  if (!String(config.domicilio || "").trim()) errors.push("Completá el domicilio del emisor.");
  const point = Number(config.puntoVenta);
  if (!Number.isInteger(point) || point < 1 || point > 99999) errors.push("El punto de venta debe ser un número entre 1 y 99999.");
  if (!ticket) errors.push("Elegí una venta de origen.");
  if (ticket?.anulado) errors.push("No se puede generar un comprobante para una venta anulada.");
  if (!allowed.includes(draft.tipo)) errors.push(`La condición ${config.condicionFiscal} sólo admite comprobante ${allowed.join(" o ")} en este modo.`);
  if (!String(draft.receptor || "").trim()) errors.push("Completá el nombre o razón social del receptor.");
  if (draft.tipo === "A" && draft.condicionReceptor !== "Responsable inscripto") errors.push("El comprobante A requiere un receptor Responsable inscripto.");
  if (draft.tipo === "A" && !isValidCuit(draft.receptorCuit)) errors.push("El comprobante A requiere un CUIT válido del receptor.");
  const receiverId = digits(draft.receptorCuit);
  if (receiverId && ![7, 8].includes(receiverId.length) && !isValidCuit(receiverId)) errors.push("El CUIT o DNI del receptor no es válido.");
  if (ticket && existing.some((item) => String(item.ticketId) === String(ticket.id) && item.estado !== "anulado")) errors.push("Esta venta ya tiene un comprobante activo.");
  return errors;
}

export function buildCommercialDocument({ config, draft, ticket, existing = [], identity }) {
  const pointOfSale = String(Number(config.puntoVenta) || 1).padStart(4, "0");
  const sequence = nextDocumentSequence(existing, pointOfSale, draft.tipo);
  const totals = calculateDocumentTotals(ticket, draft.tipo, config.alicuotaIva ?? 21);
  const items = (ticket.items || []).map((item) => {
    const quantity = Number(item.cantidad || 0);
    const lineTotal = roundMoney(item.subtotal ?? Number(item.precioUnitario || item.precio || 0) * quantity);
    return {
      productId: item.productId,
      nombre: item.nombre,
      cantidad: quantity,
      unidad: item.unidad || "unidad",
      precioLista: roundMoney(item.precioUnitario || item.precio || 0),
      precioUnitario: quantity ? roundMoney(lineTotal / quantity) : 0,
      subtotal: lineTotal,
    };
  });
  const document = {
    id: `cnf-${Date.now()}-${sequence}`,
    version: 1,
    clase: "comprobante-comercial-no-fiscal",
    tipo: draft.tipo,
    puntoVenta: pointOfSale,
    secuencia: sequence,
    numero: `${pointOfSale}-${String(sequence).padStart(8, "0")}`,
    fecha: new Date().toISOString(),
    estado: "emitido-no-fiscal",
    sinCae: true,
    ticketId: ticket.id,
    emisor: {
      razonSocial: String(config.razonSocial || "").trim(),
      cuit: formatCuit(config.cuit),
      domicilio: String(config.domicilio || "").trim(),
      condicionFiscal: config.condicionFiscal,
      ingresosBrutos: String(config.ingresosBrutos || "").trim(),
      inicioActividades: config.inicioActividades || "",
    },
    receptor: {
      nombre: String(draft.receptor || "").trim(),
      documento: String(draft.receptorCuit || "").trim(),
      condicionFiscal: draft.condicionReceptor,
      domicilio: String(draft.domicilio || "").trim(),
      email: String(draft.email || "").trim(),
    },
    items,
    subtotalVenta: roundMoney(ticket.subtotal ?? totals.total),
    descuento: roundMoney(ticket.descuento || 0),
    netoGravado: totals.net,
    iva: totals.tax,
    alicuotaIva: totals.taxRate,
    total: totals.total,
    medioPago: ticket.medio || ticket.pagos?.map((payment) => payment.metodo).join(" + ") || "No informado",
    emitidoPor: identity?.nombre || identity?.rol || "Sin identificar",
  };
  return { ...document, codigoInterno: internalVerificationCode({ type: document.tipo, pointOfSale, sequence, ticketId: ticket.id, total: totals.total }) };
}
