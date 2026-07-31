import { roundQuantity, unidadInfo } from "../../shared/domain";

export function buildReplenishmentSuggestions(products = [], tickets = [], now = new Date(), forecastDays = 7) {
  const since = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const sold = new Map();
  tickets.filter((ticket) => !ticket.anulado && !ticket.devuelto && new Date(ticket.fecha).getTime() >= since).forEach((ticket) => {
    (ticket.items || []).forEach((item) => sold.set(item.productId, (sold.get(item.productId) || 0) + Number(item.cantidad || 0)));
  });
  return products.map((product) => {
    const factor = unidadInfo(product.unidad).factor;
    const ventas30 = (sold.get(product.id) || 0) / factor;
    const ventaDiaria = ventas30 / 30;
    const stock = Number(product.deposito || 0) + Number(product.vitrina || 0);
    const coberturaDias = ventaDiaria > 0 ? stock / ventaDiaria : null;
    const objetivo = Math.max(Number(product.minimo || 0) * 2, ventaDiaria * forecastDays + Number(product.minimo || 0));
    const recomendada = product.unidad === "unidad" ? Math.max(1, Math.ceil(objetivo - stock)) : Math.max(0.1, roundQuantity(objetivo - stock));
    return { product, ventas30: roundQuantity(ventas30), ventaDiaria, stock: roundQuantity(stock), coberturaDias, recomendada };
  }).filter((item) => item.stock <= Number(item.product.minimo || 0) || (item.coberturaDias !== null && item.coberturaDias < 3));
}
