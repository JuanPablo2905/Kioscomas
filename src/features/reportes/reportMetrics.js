export function calcularRentabilidadHistorica(tickets) {
  let costoHistorico = 0;
  let vendidoConCosto = 0;
  let itemsSinCosto = 0;

  tickets.forEach((ticket) => {
    ticket.items.forEach((item) => {
      const costoTotal = Number.isFinite(item.costoTotal)
        ? item.costoTotal
        : Number.isFinite(item.costoUnitario)
          ? item.costoUnitario * item.cantidad
          : null;

      if (costoTotal === null) {
        itemsSinCosto += 1;
        return;
      }

      costoHistorico += costoTotal;
      vendidoConCosto += item.subtotal;
    });
  });

  return {
    costoHistorico,
    gananciaHistorica: vendidoConCosto - costoHistorico,
    itemsSinCosto,
  };
}

const firmaDetalle = (ticket) =>
  ticket.items
    .map((item) => `${item.productId || item.nombre}:${item.cantidad}:${item.precioUnitario ?? ""}:${item.subtotal ?? ""}`)
    .sort()
    .join("|");

const firmaPagos = (ticket) => (ticket.pagos || [{ metodo: ticket.medio || "", monto: ticket.total || 0 }])
  .map((pago) => `${pago.metodo}:${Number(pago.monto || 0)}`)
  .sort()
  .join("|");

export function detectarTicketsDuplicados(tickets, ventanaHoras = 24) {
  const duplicados = new Map();
  const ordenados = [...tickets]
    .filter((ticket) => ticket.estado !== "anulado")
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const registrar = (ticket, pareja) => duplicados.set(ticket.id, {
    nivel: "rojo",
    parejaId: pareja.id,
    parejaKey: [String(ticket.id), String(pareja.id)].sort().join(":"),
  });
  const revisionResuelvePareja = (ticket, pareja) =>
    ticket.revisionDuplicado?.estado === "ventas_validas" &&
    String(ticket.revisionDuplicado?.parejaId) === String(pareja.id);

  for (let i = 0; i < ordenados.length; i += 1) {
    for (let j = i + 1; j < ordenados.length; j += 1) {
      const a = ordenados[i];
      const b = ordenados[j];
      const diferenciaHoras = (new Date(b.fecha).getTime() - new Date(a.fecha).getTime()) / 3600000;
      if (!Number.isFinite(diferenciaHoras)) continue;
      if (diferenciaHoras > ventanaHoras) break;
      const coincideTodo =
        firmaDetalle(a) === firmaDetalle(b) &&
        Number(a.total) === Number(b.total) &&
        (a.medio || "") === (b.medio || "") &&
        firmaPagos(a) === firmaPagos(b) &&
        (a.clienteId || null) === (b.clienteId || null) &&
        new Date(a.fecha).getTime() === new Date(b.fecha).getTime();
      if (!coincideTodo) continue;
      if (revisionResuelvePareja(a, b) || revisionResuelvePareja(b, a)) continue;
      registrar(a, b);
      registrar(b, a);
    }
  }

  return duplicados;
}
