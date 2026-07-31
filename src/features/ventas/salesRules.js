import { unidadInfo, roundQuantity } from "../../shared/domain";

export function calcularDescuento(subtotal, tipo = "porcentaje", valor = 0) {
  const base = Math.max(0, Number(subtotal) || 0);
  const amount = Math.max(0, Number(valor) || 0);
  const descuento = tipo === "fijo" ? amount : base * Math.min(amount, 100) / 100;
  return Math.min(base, Math.round(descuento * 100) / 100);
}

export function promocionVigente(promocion, fecha = new Date()) {
  if (!promocion?.activa) return false;
  const time = fecha instanceof Date ? fecha.getTime() : new Date(fecha).getTime();
  if (promocion.desde && time < new Date(`${promocion.desde}T00:00:00`).getTime()) return false;
  if (promocion.hasta && time > new Date(`${promocion.hasta}T23:59:59.999`).getTime()) return false;
  return true;
}

export function calcularPromocion(cartItems = [], promocion, fecha = new Date()) {
  if (!promocionVigente(promocion, fecha)) return 0;
  const selected = new Set((promocion.productIds || []).map(String));
  const lines = cartItems.filter((item) => item.product && (!selected.size || selected.has(String(item.product.id))));
  if (!lines.length) return 0;
  let discount = 0;
  if (promocion.tipo === "nxm") {
    const lleva = Math.max(2, Number(promocion.lleva) || 2);
    const paga = Math.max(1, Math.min(lleva - 1, Number(promocion.paga) || 1));
    discount = lines.filter((item) => (item.product.unidad || "unidad") === "unidad").reduce((sum, item) => {
      const units = Math.floor(Number(item.cantidad) || 0);
      return sum + Math.floor(units / lleva) * (lleva - paga) * Number(item.product.venta || 0);
    }, 0);
  } else if (promocion.tipo === "combo") {
    if (lines.some((line) => (line.product.unidad || "unidad") !== "unidad")) return 0;
    if (!selected.size || [...selected].some((id) => !lines.some((line) => String(line.product.id) === id))) return 0;
    const repeats = Math.min(...[...selected].map((id) => Math.floor(Number(lines.find((line) => String(line.product.id) === id)?.cantidad || 0))));
    const regular = [...selected].reduce((sum, id) => sum + Number(lines.find((line) => String(line.product.id) === id)?.product.venta || 0), 0);
    discount = Math.max(0, regular - Number(promocion.precioCombo || 0)) * repeats;
  } else if (promocion.tipo === "cantidad") {
    const minimum = Math.max(2, Number(promocion.cantidadMinima) || 2);
    discount = lines.reduce((sum, item) => Number(item.cantidad || 0) >= minimum ? sum + Number(item.product.venta || 0) * Number(item.cantidad || 0) * Math.min(100, Number(promocion.valor || 0)) / 100 : sum, 0);
  } else {
    const base = lines.reduce((sum, item) => sum + Number(item.product.venta || 0) * Number(item.cantidad || 0), 0);
    discount = base * Math.min(100, Number(promocion.valor || promocion.descuento || 0)) / 100;
  }
  return Math.max(0, Math.round(discount * 100) / 100);
}

export function calcularMejorPromocion(cartItems = [], promociones = [], fecha = new Date()) {
  return promociones.reduce((best, promocion) => {
    const descuento = calcularPromocion(cartItems, promocion, fecha);
    return descuento > best.descuento ? { promocion, descuento } : best;
  }, { promocion: null, descuento: 0 });
}

export function restaurarStock(products, ticket) {
  const cantidades = new Map((ticket.items || []).map((item) => [item.productId, item]));
  return products.map((product) => {
    const item = cantidades.get(product.id);
    if (!item) return product;
    const factor = unidadInfo(item.unidad || product.unidad).factor;
    return { ...product, vitrina: roundQuantity(Number(product.vitrina || 0) + Number(item.cantidad || 0) / factor) };
  });
}

export function anularTicket(ticket, motivo, responsable, fecha = new Date().toISOString()) {
  return { ...ticket, estado: "anulado", anulacion: { motivo, responsable, fecha } };
}
