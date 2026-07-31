export function applyExpensePayment(caja, expense) {
  return { ok: true, caja };
}

export const isExpenseOverdue = (expense, now = new Date()) =>
  expense.estado === "pendiente" && expense.vencimiento && new Date(`${expense.vencimiento}T23:59:59`) < now;
