import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Printer,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { calcularRentabilidadHistorica, detectarTicketsDuplicados } from "./reportMetrics";
import { isWithinRange, isWithinPreviousRange } from "../../shared/dateRanges";
import { anularTicket, restaurarStock } from "../ventas/salesRules";
import { printTicket } from "../../shared/ticketPrint";

function StatCard({ label, value, sub }) {
  return (
    <div className="min-w-0 border border-gray-200 rounded-xl p-3 sm:p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="break-words text-base font-bold text-gray-900 sm:text-lg">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function MotivoBorradoModal({ ticket, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState(ticket.motivoSugerido || "");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Anular Ticket #{ticket.id}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Se devolverá el stock y se revertirá el cobro de <b>{money(ticket.total)}</b>. El ticket seguirá visible para auditoría.
        </p>
        <label className="text-sm text-gray-700 block mb-1">Motivo</label>
        <input
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: ticket duplicado, error de carga..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-5"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => motivo.trim() && onConfirm(motivo.trim())}
            disabled={!motivo.trim()}
            className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
          >
            Anular y revertir
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportesView({ tickets, products, setTickets, setCaja, setProducts, clientes = [], setClientes, identidad, puedeEliminarTickets = true, perdidas = [], gastos = [], preferences = {}, ticketConfig = {}, businessName = "Mi negocio", hasEmployees = true }) {
  const [range, setRange] = useState("Hoy");
  const [expanded, setExpanded] = useState(null);
  const [borrandoTicket, setBorrandoTicket] = useState(null);
  const [openReports, setOpenReports] = useState(() => new Set(["categorias", "personas", "ranking"]));
  const toggleReport = (id) => setOpenReports((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const ticketsPeriodo = tickets.filter((t) => isWithinRange(t.fecha, range));
  const filtered = ticketsPeriodo.filter((t) => t.estado !== "anulado");
  const previous = tickets.filter((t) => t.estado !== "anulado" && isWithinPreviousRange(t.fecha, range));

  const totalVendido = filtered.reduce((sum, t) => sum + t.total, 0);
  const totalAnterior = previous.reduce((sum, t) => sum + t.total, 0);
  const variacion = totalAnterior > 0 ? ((totalVendido - totalAnterior) / totalAnterior) * 100 : null;

  const rentabilidad = useMemo(
    () => calcularRentabilidadHistorica(filtered),
    [filtered]
  );
  const perdidasPeriodo = perdidas.filter((item) => isWithinRange(item.fecha, range)).reduce((sum, item) => sum + Number(item.costoTotal || 0), 0);
  const gastosPeriodo = gastos.filter((item) => item.estado === "pagado" && isWithinRange(item.pagadoFecha || item.fecha, range)).reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const gananciaNeta = rentabilidad.gananciaHistorica - perdidasPeriodo - gastosPeriodo;

  const rentabilidadCategorias = useMemo(() => {
    const map = new Map();
    filtered.forEach((ticket) => (ticket.items || []).forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      const category = product?.categoria || "Sin categoría";
      const current = map.get(category) || { categoria: category, vendido: 0, ganancia: 0 };
      const cost = Number.isFinite(item.costoTotal) ? item.costoTotal : 0;
      current.vendido += Number(item.subtotal || 0); current.ganancia += Number(item.subtotal || 0) - cost;
      map.set(category, current);
    }));
    return [...map.values()].sort((a, b) => b.ganancia - a.ganancia);
  }, [filtered, products]);

  const rendimientoPersonas = useMemo(() => {
    const map = new Map();
    filtered.forEach((ticket) => { const name = ticket.quien || "Sin identificar"; const current = map.get(name) || { nombre: name, tickets: 0, vendido: 0 }; current.tickets += 1; current.vendido += Number(ticket.total || 0); map.set(name, current); });
    return [...map.values()].sort((a, b) => b.vendido - a.vendido);
  }, [filtered]);

  const ranking = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      t.items.forEach((it) => {
        if (!map[it.nombre]) map[it.nombre] = { nombre: it.nombre, cantidad: 0, total: 0 };
        map[it.nombre].cantidad += it.cantidad;
        map[it.nombre].total += it.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
  }, [filtered]);

  const masVendido = ranking[0];
  const menosVendido = ranking[ranking.length - 1];
  const productosSinMovimiento = useMemo(() => {
    const vendidos = new Set(
      filtered.flatMap((ticket) => ticket.items.map((item) => item.productId || item.nombre))
    );
    return products.filter((product) => !vendidos.has(product.id) && !vendidos.has(product.nombre));
  }, [filtered, products]);
  const ticketsDuplicados = useMemo(
    () => detectarTicketsDuplicados(filtered, Number(preferences.duplicateHours || 24)),
    [filtered, preferences.duplicateHours]
  );
  const paresDuplicados = useMemo(() => {
    const pairs = new Map();
    ticketsDuplicados.forEach((alerta, ticketId) => {
      if (pairs.has(alerta.parejaKey)) return;
      const first = tickets.find((ticket) => String(ticket.id) === String(ticketId));
      const second = tickets.find((ticket) => String(ticket.id) === String(alerta.parejaId));
      if (!first || !second) return;
      const firstIndex = tickets.findIndex((ticket) => String(ticket.id) === String(first.id));
      const secondIndex = tickets.findIndex((ticket) => String(ticket.id) === String(second.id));
      pairs.set(alerta.parejaKey, {
        key: alerta.parejaKey,
        first,
        second,
        suggestedDuplicate: firstIndex > secondIndex ? first : second,
      });
    });
    return [...pairs.values()];
  }, [ticketsDuplicados, tickets]);

  const responsableRevision = identidad?.nombre || identidad?.rol || "Sin identificar";
  const confirmarVentasValidas = (first, second) => {
    const fecha = new Date().toISOString();
    setTickets((prev) => prev.map((ticket) => {
      if (String(ticket.id) === String(first.id)) return { ...ticket, revisionDuplicado: { estado: "ventas_validas", parejaId: second.id, fecha, responsable: responsableRevision } };
      if (String(ticket.id) === String(second.id)) return { ...ticket, revisionDuplicado: { estado: "ventas_validas", parejaId: first.id, fecha, responsable: responsableRevision } };
      return ticket;
    }));
  };
  const volverARevisar = (ticket) => {
    const parejaId = ticket.revisionDuplicado?.parejaId;
    setTickets((prev) => prev.map((item) => {
      if (String(item.id) !== String(ticket.id) && String(item.id) !== String(parejaId)) return item;
      const next = { ...item };
      delete next.revisionDuplicado;
      return next;
    }));
  };
  const prepararAnulacionDuplicada = (pair) => {
    setBorrandoTicket({
      ...pair.suggestedDuplicate,
      duplicatePairId: String(pair.suggestedDuplicate.id) === String(pair.first.id) ? pair.second.id : pair.first.id,
      motivoSugerido: `Ticket duplicado de #${String(pair.suggestedDuplicate.id) === String(pair.first.id) ? pair.second.id : pair.first.id}`,
    });
  };

  const handleBorrarTicket = (motivo) => {
    if (!borrandoTicket) return;
    const responsable = identidad?.nombre || identidad?.rol || "Sin identificar";
    const fecha = new Date();
    setTickets((prev) => prev.map((t) => t.id === borrandoTicket.id ? anularTicket({
      ...t,
      ...(borrandoTicket.duplicatePairId ? {
        revisionDuplicado: {
          estado: "duplicado_confirmado",
          parejaId: borrandoTicket.duplicatePairId,
          fecha: fecha.toISOString(),
          responsable,
        },
      } : {}),
    }, motivo, responsable, fecha.toISOString()) : t));
    setProducts((prev) => restaurarStock(prev, borrandoTicket));
    if (borrandoTicket.medio === "Cuenta corriente" && borrandoTicket.clienteId && setClientes) {
      setClientes((prev) => prev.map((cliente) => cliente.id === borrandoTicket.clienteId ? {
        ...cliente,
        saldo: Number(cliente.saldo || 0) - Number(borrandoTicket.total || 0),
        movimientos: [...(cliente.movimientos || []), { id: (cliente.movimientos || []).length + 1, tipo: "anulacion", monto: Number(borrandoTicket.total || 0), nota: `Anulación ticket #${borrandoTicket.id}: ${motivo}`, fecha: fecha.toLocaleString("es-AR") }],
      } : cliente));
    }
    const efectivoTicket = borrandoTicket.medio === "Efectivo" ? Number(borrandoTicket.total || 0) : Number(borrandoTicket.pagos?.find((pago) => pago.metodo === "Efectivo")?.monto || 0);
    setCaja((prev) => ({
      ...prev,
      saldo: efectivoTicket > 0 ? Number(prev.saldo || 0) - efectivoTicket : prev.saldo,
      movimientos: efectivoTicket > 0 ? [...(prev.movimientos || []), { id: (prev.movimientos || []).length + 1, tipo: "retiro", monto: efectivoTicket, nota: `Devolución ticket #${borrandoTicket.id}`, fecha: fecha.toLocaleString("es-AR") }] : (prev.movimientos || []),
      historial: [
        ...(prev.historial || []),
        {
          id: (prev.historial || []).length + 1,
          tipo: "anulacion_ticket",
          detalle: `Ticket #${borrandoTicket.id} (${money(borrandoTicket.total)}) anulado por ${responsable}. Motivo: ${motivo}`,
          fecha: nowFecha(),
        },
      ],
    }));
    setBorrandoTicket(null);
  };

  return (
    <div className="reportes-view min-w-0 px-4 py-5 sm:p-8">
      <SectionHeader title="Reportes de Ventas" />
      <div data-tour="reports-period" className="mb-6 grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
        {["Hoy", "Semana", "Quincena", "Mes"].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`min-w-0 px-1.5 py-2 rounded-lg text-xs font-medium sm:px-3 sm:py-1.5 sm:text-sm ${
              range === r
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {ticketsPeriodo.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl px-4 py-10 text-center text-sm text-gray-400 sm:p-10">
          Todavía no hay ventas registradas en este período.
        </div>
      ) : (
        <>
          <div data-tour="reports-summary" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3">
            <StatCard label="Total vendido" value={money(totalVendido)} sub={variacion === null ? "Sin período anterior para comparar" : `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}% contra el período anterior`} />
            <StatCard
              label="Ganancia bruta histórica"
              value={money(rentabilidad.gananciaHistorica)}
              sub={`${money(rentabilidad.costoHistorico)} de costo registrado`}
            />
            <StatCard label="Pérdidas del período" value={money(perdidasPeriodo)} sub="Vencimientos, roturas y faltantes" />
            <StatCard label="Gastos pagados" value={money(gastosPeriodo)} sub="Salidas operativas del período" />
            <StatCard label="Ganancia neta real" value={money(gananciaNeta)} sub="Ganancia bruta menos pérdidas y gastos" />
            <StatCard label="Tickets" value={filtered.length} />
            <StatCard
              label="Sin movimiento"
              value={productosSinMovimiento.length}
              sub="Productos sin ventas"
            />
            <StatCard
              label="Más vendido"
              value={masVendido?.nombre || "-"}
              sub={masVendido ? `${masVendido.cantidad} u.` : ""}
            />
            <StatCard
              label="Menos vendido"
              value={menosVendido?.nombre || "-"}
              sub={menosVendido ? `${menosVendido.cantidad} u.` : ""}
            />
          </div>

          {rentabilidad.itemsSinCosto > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {rentabilidad.itemsSinCosto} ítem(s) pertenecen a ventas anteriores y no tienen
              costo histórico. La ganancia mostrada sólo incluye ventas nuevas con costo guardado.
            </div>
          )}

          {paresDuplicados.length > 0 && (
            <div data-tour="reports-duplicates" className="mb-6 rounded-xl border border-red-200 bg-red-50/60 p-3 sm:p-4">
              <div className="flex gap-2 text-xs text-gray-700">
                <AlertTriangle size={17} className="shrink-0 text-red-600" />
                <div><p className="font-semibold">Coincidencias pendientes: {paresDuplicados.length}</p><p className="mt-1 text-red-700">Coinciden productos, cantidades, importes, pago, cliente y fecha/hora. Revisá cada par antes de anular.</p></div>
              </div>
              <div className="mt-3 grid gap-2">
                {paresDuplicados.map((pair) => (
                  <div key={pair.key} className="rounded-lg border border-red-200 bg-white p-3">
                    <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-gray-900">Tickets #{pair.first.id} y #{pair.second.id}</p>
                      <p className="text-gray-500">{new Date(pair.first.fecha).toLocaleString("es-AR")} · {money(pair.first.total)}</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => confirmarVentasValidas(pair.first, pair.second)} className="min-h-10 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100">
                        Son dos ventas válidas
                      </button>
                      {puedeEliminarTickets && <button type="button" onClick={() => prepararAnulacionDuplicada(pair)} className="min-h-10 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">
                        Anular el ticket repetido #{pair.suggestedDuplicate.id}
                      </button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 sm:gap-6">
            <div data-tour="reports-categories" className={`min-w-0 rounded-xl border p-3 shadow-sm sm:p-4 ${rentabilidadCategorias.some((item) => item.ganancia < 0) ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-white"}`}>
              <button onClick={() => toggleReport("categorias")} className="mb-2 flex w-full items-center justify-between text-left"><span><h2 className="text-sm font-semibold text-gray-900">Rentabilidad por categoría</h2><small className="text-gray-500">{rentabilidadCategorias.length} categoría(s)</small></span><ChevronRight size={18} className={`transition-transform ${openReports.has("categorias") ? "rotate-90" : ""}`}/></button>
              {openReports.has("categorias") && <div className="space-y-2">{rentabilidadCategorias.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-xs text-gray-400">Sin datos por categoría.</p> : rentabilidadCategorias.map((item) => <div key={item.categoria} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"><div><p className="text-sm font-medium">{item.categoria}</p><p className="text-xs text-gray-400">Vendido: {money(item.vendido)}</p></div><p className={`text-sm font-semibold ${item.ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>{money(item.ganancia)}</p></div>)}</div>}
            </div>

            {hasEmployees && <div className={`min-w-0 rounded-xl border p-3 shadow-sm sm:p-4 ${rendimientoPersonas.some((item) => item.nombre === "Sin identificar") ? "border-amber-300 bg-amber-50/50" : "border-gray-200 bg-white"}`}>
              <button onClick={() => toggleReport("personas")} className="mb-2 flex w-full items-center justify-between text-left"><span><h2 className="text-sm font-semibold text-gray-900">Rendimiento por persona</h2><small className="text-gray-500">{rendimientoPersonas.length} persona(s)</small></span><ChevronRight size={18} className={`transition-transform ${openReports.has("personas") ? "rotate-90" : ""}`}/></button>
              {openReports.has("personas") && <div className="space-y-2">{rendimientoPersonas.map((item) => <div key={item.nombre} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"><div><p className="text-sm font-medium">{item.nombre}</p><p className="text-xs text-gray-400">{item.tickets} ticket(s)</p></div><p className="text-sm font-semibold">{money(item.vendido)}</p></div>)}</div>}
            </div>}

            <div data-tour="reports-ranking" className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <button onClick={() => toggleReport("ranking")} className="mb-2 flex w-full items-center justify-between text-left"><span><h2 className="text-sm font-semibold text-gray-900">Ranking de productos</h2><small className="text-gray-500">Top {ranking.length} productos</small></span><ChevronRight size={18} className={`transition-transform ${openReports.has("ranking") ? "rotate-90" : ""}`}/></button>
              {openReports.has("ranking") && <div className="space-y-2">
                {ranking.map((r, i) => (
                  <div
                    key={r.nombre}
                    className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-900 text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {r.nombre}
                        </p>
                        <p className="text-xs text-gray-500">{money(r.total)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {r.cantidad} u.
                    </p>
                  </div>
                ))}
              </div>}
            </div>

            <div className={`min-w-0 rounded-xl border p-3 shadow-sm sm:p-4 ${productosSinMovimiento.length ? "border-amber-300 bg-amber-50/50" : "border-green-200 bg-green-50/40"}`}>
              <button onClick={() => toggleReport("sin-movimiento")} className="mb-2 flex w-full items-center justify-between text-left"><span><h2 className="text-sm font-semibold text-gray-900">Productos sin movimiento</h2><small className={productosSinMovimiento.length ? "text-amber-700" : "text-green-700"}>{productosSinMovimiento.length ? `${productosSinMovimiento.length} para revisar` : "Sin problemas"}</small></span><ChevronRight size={18} className={`transition-transform ${openReports.has("sin-movimiento") ? "rotate-90" : ""}`}/></button>
              {openReports.has("sin-movimiento") && (productosSinMovimiento.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg px-3 py-6 text-center text-xs text-gray-400">
                  Todos los productos tuvieron ventas en este período.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {productosSinMovimiento.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between border border-amber-100 bg-amber-50/40 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.nombre}</p>
                        <p className="text-xs text-gray-500">{product.categoria}</p>
                      </div>
                      <span className="text-xs text-amber-700">Sin ventas</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div data-tour="reports-tickets" className={`min-w-0 rounded-xl border p-3 shadow-sm sm:p-4 ${ticketsDuplicados.size ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-white"}`}>
              <button onClick={() => toggleReport("tickets")} className="mb-2 flex w-full items-center justify-between text-left"><span><h2 className="text-sm font-semibold text-gray-900">Tickets recientes</h2><small className={ticketsDuplicados.size ? "text-red-700" : "text-gray-500"}>{ticketsDuplicados.size ? `${ticketsDuplicados.size} posible(s) duplicado(s)` : `${ticketsPeriodo.length} ticket(s)`}</small></span><ChevronRight size={18} className={`transition-transform ${openReports.has("tickets") ? "rotate-90" : ""}`}/></button>
              {openReports.has("tickets") && <div className="space-y-2">
                {[...ticketsPeriodo].reverse().map((t) => {
                  const isOpen = expanded === t.id;
                  const alertaDuplicado = ticketsDuplicados.get(t.id);
                  const estilosDuplicado = alertaDuplicado ? "border-red-300 bg-red-50/40" : "border-gray-200";
                  const labelDuplicado = "POSIBLE DUPLICADO EXACTO";
                  return (
                    <div
                      key={t.id}
                      className={`border rounded-lg overflow-hidden ${t.estado === "anulado" ? "border-gray-300 bg-gray-100 opacity-70" : estilosDuplicado}`}
                    >
                      <button
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                        className="w-full flex flex-col items-stretch gap-2 px-3 py-2 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-left">
                          <p className="break-words text-sm font-medium text-gray-900">
                            Ticket #{t.id}
                            {t.estado === "anulado" && <span className="ml-2 inline-block text-[10px] font-semibold text-red-700">ANULADO</span>}
                            {alertaDuplicado && (
                              <span className="mt-1 block text-[10px] font-semibold text-red-700 sm:ml-2 sm:mt-0 sm:inline-block">{labelDuplicado} · TICKET #{alertaDuplicado.parejaId}</span>
                            )}
                            {t.revisionDuplicado?.estado === "ventas_validas" && (
                              <span className="mt-1 block text-[10px] font-semibold text-green-700 sm:ml-2 sm:mt-0 sm:inline-block">REVISADO · VENTAS VÁLIDAS</span>
                            )}
                            {t.revisionDuplicado?.estado === "duplicado_confirmado" && (
                              <span className="mt-1 block text-[10px] font-semibold text-red-700 sm:ml-2 sm:mt-0 sm:inline-block">DUPLICADO CONFIRMADO</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(t.fecha).toLocaleString("es-AR")}
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 sm:justify-start">
                          <p className="text-sm font-semibold text-gray-900">
                            {money(t.total)}
                          </p>
                          <span onClick={(event)=>{event.stopPropagation();printTicket(t,{businessName,paper:preferences.ticketPaper,template:ticketConfig.ticket,reprint:true});}} title="Reimprimir ticket" className="cursor-pointer opacity-60 hover:opacity-100"><Printer size={15}/></span>
                          {puedeEliminarTickets && t.estado !== "anulado" && <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setBorrandoTicket(t);
                            }}
                            className="text-gray-300 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </span>}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 px-3 py-2 space-y-1">
                          {t.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-3 text-xs text-gray-600"
                            >
                              <span className="min-w-0 break-words">
                                {it.cantidad} x {it.nombre}
                              </span>
                              <span>{money(it.subtotal)}</span>
                            </div>
                          ))}
                          {Number(t.descuento || 0) > 0 && <div className="flex justify-between text-xs font-medium text-green-700"><span>Descuento aplicado</span><span>-{money(t.descuento)}</span></div>}
                          {t.revisionDuplicado?.estado === "ventas_validas" && (
                            <div className="mt-2 flex flex-col gap-2 rounded bg-green-50 p-2 text-xs text-green-800 sm:flex-row sm:items-center sm:justify-between">
                              <span>Marcado como venta válida por {t.revisionDuplicado.responsable || "Sin identificar"}.</span>
                              <button type="button" onClick={() => volverARevisar(t)} className="rounded border border-green-300 px-2 py-1 font-semibold hover:bg-green-100">Volver a revisar</button>
                            </div>
                          )}
                          {t.estado === "anulado" && <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">Motivo: {t.anulacion?.motivo || "Sin detalle"} · {t.anulacion?.responsable || "Sin identificar"}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>}
            </div>
          </div>
        </>
      )}

      {borrandoTicket && puedeEliminarTickets && (
        <MotivoBorradoModal
          ticket={borrandoTicket}
          onClose={() => setBorrandoTicket(null)}
          onConfirm={handleBorrarTicket}
        />
      )}
    </div>
  );
}
