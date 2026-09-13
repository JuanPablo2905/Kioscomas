import { detectarTicketsDuplicados } from "../reportes/reportMetrics";
import { isExpenseOverdue } from "../gastos/expenseRules";

const daysUntil = (value, nowValue = Date.now()) => {
  if (!value) return null;
  const now = new Date(nowValue); now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`) - now) / 86400000);
};

const customerOrderDueAt = (order) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(order?.fechaRetiro || "")) || !/^\d{2}:\d{2}$/.test(String(order?.horaRetiro || ""))) return null;
  const value = new Date(`${order.fechaRetiro}T${order.horaRetiro}:00-03:00`);
  return Number.isFinite(value.getTime()) ? value.getTime() : null;
};

export function buildNotifications(data, nowValue = Date.now(), preferences = {}) {
  const notifications = [];
  const expiryDays = Math.max(0, Number(preferences.expiryDays ?? 7));
  (data.products || []).forEach((product) => {
    if (product.deposito <= product.minimo) notifications.push({ id: `stock-${product.id}`, type: "stock", level: "alta", title: "Stock bajo", detail: product.nombre, view: "stock" });
    if (product.vitrina <= product.alertaVitrina) notifications.push({ id: `vitrina-${product.id}`, type: "vitrina", level: "media", title: "Reponer vitrina", detail: product.nombre, view: "vitrina" });
    const days = daysUntil(product.vencimiento, nowValue);
    if (days !== null && days <= expiryDays) notifications.push({ id: `vence-${product.id}`, type: "vencimiento", level: days < 0 ? "critica" : "alta", title: days < 0 ? "Producto vencido" : "Próximo a vencer", detail: `${product.nombre} · ${days < 0 ? `hace ${Math.abs(days)} día(s)` : `en ${days} día(s)`}`, view: "vencimientos" });
  });
  const suggestions = (data.sugerencias || []).filter((item) => item.estado === "pendiente");
  if (suggestions.length) notifications.push({ id: "sugerencias", type: "sugerencias", level: "media", title: "Sugerencias pendientes", detail: `${suggestions.length} esperando aprobación`, view: "administracion" });
  const duplicates = detectarTicketsDuplicados(data.tickets || []);
  if (duplicates.size) notifications.push({ id: "duplicados", type: "tickets", level: "alta", title: "Posibles tickets duplicados", detail: `${duplicates.size} ticket(s) con todos los datos coincidentes`, view: "reportes" });
  const unusual = (data.caja?.historial || []).filter((item) => item.inusual);
  if (unusual.length) notifications.push({ id: "caja", type: "caja", level: "critica", title: "Diferencias de caja", detail: `${unusual.length} cierre(s) inusual(es)`, view: "administracion" });
  const overdueExpenses = (data.gastos || []).filter((item) => isExpenseOverdue(item));
  if (overdueExpenses.length) notifications.push({ id: "gastos-vencidos", type: "gastos", level: "critica", title: "Gastos vencidos", detail: `${overdueExpenses.length} pago(s) pendiente(s)`, view: "gastos" });
  (data.pedidos || []).filter((item) => item && !["recibido", "cancelado"].includes(item.estado) && item.fechaEntregaEsperada).forEach((order) => {
    const days = daysUntil(order.fechaEntregaEsperada, nowValue);
    if (days == null || days > 1) return;
    const provider = order.proveedorNombre || "Proveedor sin nombre";
    notifications.push({
      id: `pedido-entrega-${order.id}-${order.fechaEntregaEsperada}`,
      type: "pedidos",
      level: days < 0 ? "alta" : "media",
      title: days < 0 ? "Entrega demorada" : days === 0 ? "Entrega prevista para hoy" : "Entrega prevista para mañana",
      detail: `${provider}${order.horaEntregaEsperada ? ` · ${order.horaEntregaEsperada} h` : ""}`,
      view: "compras",
    });
  });
  (data.reservas || []).filter((item) => item && !["entregado", "cancelado"].includes(item.estado)).forEach((order) => {
    const dueAt = customerOrderDueAt(order);
    if (dueAt === null || dueAt > Number(nowValue)) return;
    const overdueMinutes = Math.max(0, Math.floor((Number(nowValue) - dueAt) / 60000));
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    notifications.push({
      id: `pedido-cliente-${order.id}-${order.fechaRetiro}-${order.horaRetiro}`,
      type: "reservas",
      level: overdueMinutes >= 24 * 60 ? "alta" : "media",
      title: overdueMinutes >= 24 * 60 ? "Pedido de cliente demorado" : "Pedido de cliente para entregar",
      detail: `${order.cliente || "Cliente sin identificar"} · ${order.horaRetiro} h${itemCount ? ` · ${itemCount} producto${itemCount === 1 ? "" : "s"}` : ""}`,
      view: "ventas",
    });
  });
  const rank = { critica: 0, alta: 1, media: 2, baja: 3 };
  const unique = [...new Map(notifications.map((item) => [item.id, item])).values()];
  return unique.sort((a, b) => rank[a.level] - rank[b.level]);
}
