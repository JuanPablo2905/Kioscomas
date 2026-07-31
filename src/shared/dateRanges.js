export function isWithinRange(dateStr, range) {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysByRange = { Semana: 6, Quincena: 14, Mes: 29 };

  if (range === "Hoy") return date >= startOfDay;
  if (daysByRange[range] !== undefined) {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - daysByRange[range]);
    return date >= start;
  }
  return true;
}

export function isWithinPreviousRange(dateStr, range) {
  const date = new Date(dateStr);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = { Hoy: 1, Semana: 7, Quincena: 15, Mes: 30 }[range] || 1;
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return date >= start && date < end;
}
