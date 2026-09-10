import { unidadInfo, roundQuantity } from "../../shared/domain";

const roundMoney = (value) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);

export function etiquetaPromocion(promocion) {
  if (!promocion) return "Promoción";
  if (promocion.tipo === "nxm") return `${Math.max(2, Number(promocion.lleva) || 2)}×${Math.max(1, Number(promocion.paga) || 1)}`;
  if (promocion.tipo === "combo") return "COMBO";
  if (promocion.tipo === "cantidad") return `${Math.min(100, Number(promocion.valor) || 0)}% DESDE ${Math.max(2, Number(promocion.cantidadMinima) || 2)} UN.`;
  return `${Math.min(100, Number(promocion.valor ?? promocion.descuento) || 0)}% OFF`;
}

export function descripcionPromocion(promocion) {
  if (!promocion) return "";
  if (promocion.mensajePantalla) return String(promocion.mensajePantalla);
  if (promocion.tipo === "nxm") return `Llevá ${Math.max(2, Number(promocion.lleva) || 2)} y pagá ${Math.max(1, Number(promocion.paga) || 1)}`;
  if (promocion.tipo === "combo") return `Llevá el combo por $${Number(promocion.precioCombo ?? promocion.valor ?? 0).toLocaleString("es-AR")}`;
  if (promocion.tipo === "cantidad") return `${Math.min(100, Number(promocion.valor) || 0)}% de descuento desde ${Math.max(2, Number(promocion.cantidadMinima) || 2)} unidades`;
  return `${Math.min(100, Number(promocion.valor ?? promocion.descuento) || 0)}% de descuento`;
}

export function calcularDescuento(subtotal, tipo = "porcentaje", valor = 0) {
  const base = Math.max(0, Number(subtotal) || 0);
  const amount = Math.max(0, Number(valor) || 0);
  const descuento = tipo === "fijo" ? amount : base * Math.min(amount, 100) / 100;
  return Math.min(base, Math.round(descuento * 100) / 100);
}

export function promocionVigente(promocion, fecha = new Date()) {
  if (!promocion?.activa) return false;
  const currentDate = fecha instanceof Date ? fecha : new Date(fecha);
  const time = currentDate.getTime();
  if (!Number.isFinite(time)) return false;
  if (promocion.desde && time < new Date(`${promocion.desde}T00:00:00`).getTime()) return false;
  if (promocion.hasta && time > new Date(`${promocion.hasta}T23:59:59.999`).getTime()) return false;
  const days = Array.isArray(promocion.diasSemana) ? promocion.diasSemana.map(Number) : [];
  if (days.length && !days.includes(currentDate.getDay())) return false;
  if (promocion.horaDesde || promocion.horaHasta) {
    const toMinutes = (value, fallback) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
      return match ? Math.min(1439, Number(match[1]) * 60 + Number(match[2])) : fallback;
    };
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const from = toMinutes(promocion.horaDesde, 0);
    const until = toMinutes(promocion.horaHasta, 1439);
    const withinHours = from <= until
      ? currentMinutes >= from && currentMinutes <= until
      : currentMinutes >= from || currentMinutes <= until;
    if (!withinHours) return false;
  }
  return true;
}

function distributeDiscount(entries, totalDiscount) {
  const eligible = entries.filter((entry) => entry.base > 0);
  const totalBase = eligible.reduce((sum, entry) => sum + entry.base, 0);
  if (!eligible.length || totalBase <= 0 || totalDiscount <= 0) return {};
  let assigned = 0;
  return eligible.reduce((result, entry, index) => {
    const amount = index === eligible.length - 1
      ? roundMoney(totalDiscount - assigned)
      : roundMoney(totalDiscount * entry.base / totalBase);
    assigned = roundMoney(assigned + amount);
    result[String(entry.id)] = amount;
    return result;
  }, {});
}

export function calcularDetallePromocion(cartItems = [], promocion, fecha = new Date()) {
  const empty = { promocion: promocion || null, descuento: 0, descuentosPorProducto: {}, productIds: [], etiqueta: etiquetaPromocion(promocion) };
  if (!promocionVigente(promocion, fecha)) return empty;
  const selected = new Set((promocion.productIds || []).map(String));
  const lines = cartItems.filter((item) => item.product && (!selected.size || selected.has(String(item.product.id))));
  if (!lines.length) return empty;
  let discount = 0;
  let lineDiscounts = {};
  if (promocion.tipo === "nxm") {
    const lleva = Math.max(2, Number(promocion.lleva) || 2);
    const paga = Math.max(1, Math.min(lleva - 1, Number(promocion.paga) || 1));
    for (const item of lines.filter((entry) => (entry.product.unidad || "unidad") === "unidad")) {
      const units = Math.floor(Number(item.cantidad) || 0);
      const amount = roundMoney(Math.floor(units / lleva) * (lleva - paga) * Number(item.product.venta || 0));
      if (amount > 0) lineDiscounts[String(item.product.id)] = amount;
    }
    discount = Object.values(lineDiscounts).reduce((sum, amount) => sum + amount, 0);
  } else if (promocion.tipo === "combo") {
    if (lines.some((line) => (line.product.unidad || "unidad") !== "unidad")) return empty;
    if (!selected.size || [...selected].some((id) => !lines.some((line) => String(line.product.id) === id))) return empty;
    const repeats = Math.min(...[...selected].map((id) => Math.floor(Number(lines.find((line) => String(line.product.id) === id)?.cantidad || 0))));
    const regular = [...selected].reduce((sum, id) => sum + Number(lines.find((line) => String(line.product.id) === id)?.product.venta || 0), 0);
    discount = roundMoney(Math.max(0, regular - Number(promocion.precioCombo ?? promocion.valor ?? 0)) * repeats);
    lineDiscounts = distributeDiscount([...selected].map((id) => ({ id, base: Number(lines.find((line) => String(line.product.id) === id)?.product.venta || 0) * repeats })), discount);
  } else if (promocion.tipo === "cantidad") {
    const minimum = Math.max(2, Number(promocion.cantidadMinima) || 2);
    for (const item of lines) {
      if (Number(item.cantidad || 0) < minimum) continue;
      lineDiscounts[String(item.product.id)] = roundMoney(Number(item.product.venta || 0) * Number(item.cantidad || 0) * Math.min(100, Number(promocion.valor || 0)) / 100);
    }
    discount = Object.values(lineDiscounts).reduce((sum, amount) => sum + amount, 0);
  } else {
    const percentage = Math.min(100, Number(promocion.valor ?? promocion.descuento) || 0);
    for (const item of lines) {
      lineDiscounts[String(item.product.id)] = roundMoney(Number(item.product.venta || 0) * Number(item.cantidad || 0) * percentage / 100);
    }
    discount = Object.values(lineDiscounts).reduce((sum, amount) => sum + amount, 0);
  }
  discount = roundMoney(discount);
  return {
    promocion,
    descuento: discount,
    descuentosPorProducto: lineDiscounts,
    productIds: Object.keys(lineDiscounts).filter((id) => Number(lineDiscounts[id]) > 0),
    etiqueta: etiquetaPromocion(promocion),
  };
}

export function calcularPromocion(cartItems = [], promocion, fecha = new Date()) {
  return calcularDetallePromocion(cartItems, promocion, fecha).descuento;
}

export function calcularMejorPromocion(cartItems = [], promociones = [], fecha = new Date()) {
  return promociones.reduce((best, promocion) => {
    const detail = calcularDetallePromocion(cartItems, promocion, fecha);
    return detail.descuento > best.descuento ? detail : best;
  }, { promocion: null, descuento: 0, descuentosPorProducto: {}, productIds: [], etiqueta: "" });
}

export function calcularPromocionesAplicadas(cartItems = [], promociones = [], fecha = new Date()) {
  const candidates = promociones
    .map((promocion) => calcularDetallePromocion(cartItems, promocion, fecha))
    .filter((detail) => detail.descuento > 0 && detail.productIds.length > 0);
  let states = [{ productIds: new Set(), detalles: [], descuento: 0 }];
  for (const candidate of candidates) {
    const nextStates = [...states];
    for (const state of states) {
      if (candidate.productIds.some((id) => state.productIds.has(String(id)))) continue;
      nextStates.push({
        productIds: new Set([...state.productIds, ...candidate.productIds.map(String)]),
        detalles: [...state.detalles, candidate],
        descuento: roundMoney(state.descuento + candidate.descuento),
      });
    }
    const bestByProducts = new Map();
    for (const state of nextStates) {
      const key = [...state.productIds].sort().join("|");
      if (!bestByProducts.has(key) || bestByProducts.get(key).descuento < state.descuento) bestByProducts.set(key, state);
    }
    states = [...bestByProducts.values()];
    if (states.length > 4096) states = states.sort((left, right) => right.descuento - left.descuento).slice(0, 4096);
  }
  const best = states.reduce((winner, state) => state.descuento > winner.descuento ? state : winner, states[0]);
  const descuentosPorProducto = {};
  const promocionesPorProducto = {};
  for (const detail of best.detalles) {
    for (const [productId, amount] of Object.entries(detail.descuentosPorProducto)) {
      if (!(Number(amount) > 0)) continue;
      descuentosPorProducto[productId] = roundMoney(amount);
      promocionesPorProducto[productId] = {
        id: detail.promocion.id,
        nombre: detail.promocion.nombre,
        etiqueta: detail.etiqueta,
        descuento: roundMoney(amount),
      };
    }
  }
  return {
    promocion: best.detalles[0]?.promocion || null,
    promociones: best.detalles.map((detail) => detail.promocion),
    detalles: best.detalles,
    descuento: roundMoney(best.descuento),
    descuentosPorProducto,
    promocionesPorProducto,
    productIds: [...best.productIds],
    etiqueta: best.detalles.length === 1 ? best.detalles[0].etiqueta : "",
  };
}

export function promocionesParaPantalla(promociones = [], products = [], fecha = new Date()) {
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  return promociones
    .filter((promocion) => promocion?.mostrarEnPantalla === true && promocionVigente(promocion, fecha))
    .filter((promocion) => {
      const ids = (promocion.productIds || []).map(String);
      if (!ids.length) return true;
      const available = ids.map((id) => Number(productMap.get(id)?.vitrina || 0) > 0);
      return promocion.tipo === "combo" ? available.every(Boolean) : available.some(Boolean);
    })
    .map((promocion) => {
      const productNames = (promocion.productIds || []).map((id) => productMap.get(String(id))?.nombre).filter(Boolean);
      return {
        id: String(promocion.id),
        title: String(promocion.nombre || "Promoción"),
        badge: etiquetaPromocion(promocion),
        description: descripcionPromocion(promocion),
        image: promocion.imagenPantalla || null,
        productNames: productNames.slice(0, 4),
      };
    });
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
