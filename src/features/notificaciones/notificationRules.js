import { detectarTicketsDuplicados } from "../reportes/reportMetrics";
import { isExpenseOverdue } from "../gastos/expenseRules";

const daysUntil = (value) => {
  if (!value) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${value}T00:00:00`) - now) / 86400000);
};

export function buildNotifications(data) {
  const notifications = [];
  (data.products || []).forEach((product) => {
    if (product.deposito <= product.minimo) notifications.push({ id: `stock-${product.id}`, type: "stock", level: "alta", title: "Stock bajo", detail: product.nombre, view: "stock" });
    if (product.vitrina <= product.alertaVitrina) notifications.push({ id: `vitrina-${product.id}`, type: "vitrina", level: "media", title: "Reponer vitrina", detail: product.nombre, view: "vitrina" });
    const days = daysUntil(product.vencimiento);
    if (days !== null && days <= 30) notifications.push({ id: `vence-${product.id}`, type: "vencimiento", level: days < 0 ? "critica" : "alta", title: days < 0 ? "Producto vencido" : "Próximo a vencer", detail: `${product.nombre} · ${days < 0 ? `hace ${Math.abs(days)} día(s)` : `en ${days} día(s)`}`, view: "vencimientos" });
  });
  const suggestions = (data.sugerencias || []).filter((item) => item.estado === "pendiente");
  if (suggestions.length) notifications.push({ id: "sugerencias", type: "sugerencias", level: "media", title: "Sugerencias pendientes", detail: `${suggestions.length} esperando aprobación`, view: "administracion" });
  const duplicates = detectarTicketsDuplicados(data.tickets || []);
  if (duplicates.size) notifications.push({ id: "duplicados", type: "tickets", level: "alta", title: "Posibles tickets duplicados", detail: `${duplicates.size} ticket(s) con todos los datos coincidentes`, view: "reportes" });
  const unusual = (data.caja?.historial || []).filter((item) => item.inusual);
  if (unusual.length) notifications.push({ id: "caja", type: "caja", level: "critica", title: "Diferencias de caja", detail: `${unusual.length} cierre(s) inusual(es)`, view: "administracion" });
  const overdueExpenses = (data.gastos || []).filter((item) => isExpenseOverdue(item));
  if (overdueExpenses.length) notifications.push({ id: "gastos-vencidos", type: "gastos", level: "critica", title: "Gastos vencidos", detail: `${overdueExpenses.length} pago(s) pendiente(s)`, view: "gastos" });
  const rank = { critica: 0, alta: 1, media: 2, baja: 3 };
  return notifications.sort((a, b) => rank[a.level] - rank[b.level]);
}
