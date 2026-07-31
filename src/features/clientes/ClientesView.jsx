import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect } from "../../shared/controls";
import { SmallBusinessTools } from "../gestion/SmallBusinessTools";

function ClienteModal({ onClose, onSave }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div data-tour="client-form" className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nuevo cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <label className="text-sm text-gray-700 block mb-1">Nombre</label>
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        <label className="text-sm text-gray-700 block mb-1">
          Teléfono (opcional)
        </label>
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
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
            data-tour="client-save"
            onClick={() =>
              nombre.trim() &&
              onSave({ nombre: nombre.trim(), telefono: telefono.trim() })
            }
            disabled={!nombre.trim()}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function PagoModal({ cliente, onClose, onConfirm }) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("Efectivo");
  const montoNumerico = Number(monto) || 0;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="min-w-0 pr-3 text-lg font-bold text-gray-900">
            Registrar pago de {cliente.nombre}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Saldo pendiente:{" "}
          <span className="font-semibold text-gray-900">
            {money(cliente.saldo)}
          </span>
        </p>
        <label className="text-sm text-gray-700 block mb-1">
          Monto que paga
        </label>
        <input
          autoFocus
          type="number"
          max={cliente.saldo}
          onFocus={(e) => e.target.select()}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <button
          type="button"
          onClick={() => setMonto(String(cliente.saldo))}
          className="text-xs text-gray-600 underline hover:text-gray-900 mb-4"
        >
          Cobrar saldo total
        </button>
        <label className="text-sm text-gray-700 block mb-1">Medio de pago</label>
        <AppSelect
          value={medio}
          onChange={setMedio}
          className="mb-5 w-full"
        >
          <option>Efectivo</option>
          <option>Mercado Pago</option>
          <option>Transferencia</option>
        </AppSelect>
        {montoNumerico > cliente.saldo && (
          <p className="text-xs text-amber-700 -mt-3 mb-4">
            Se aplicara solamente el saldo pendiente.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => montoNumerico > 0 && onConfirm({ monto: montoNumerico, medio })}
            disabled={montoNumerico <= 0}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}

function DeudaManualModal({ cliente, onClose, onConfirm }) {
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="min-w-0 pr-3 text-lg font-bold text-gray-900">
            Cargar deuda de {cliente.nombre}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <label className="text-sm text-gray-700 block mb-1">Monto</label>
        <input
          autoFocus
          type="number"
          onFocus={(e) => e.target.select()}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        <label className="text-sm text-gray-700 block mb-1">
          Nota (opcional)
        </label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: venta de mostrador, sin ticket..."
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
            onClick={() =>
              Number(monto) > 0 &&
              onConfirm({ monto: Number(monto), nota: nota.trim() || "Deuda manual" })
            }
            disabled={!Number(monto) || Number(monto) <= 0}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Agregar deuda
          </button>
        </div>
      </div>
    </div>
  );
}

function VincularTicketModal({ cliente, tickets, onClose, onConfirm }) {
  const [selected, setSelected] = useState(null);
  const disponibles = tickets.filter(
    (t) => !t.clienteId && t.medio !== "Cuenta corriente"
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="min-w-0 pr-3 text-lg font-bold text-gray-900">
            Vincular ticket a {cliente.nombre}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {disponibles.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No hay tickets sueltos para vincular. Todos ya están asociados a
            algún cliente.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto mb-5">
            {[...disponibles].reverse().map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-start justify-between gap-3 border rounded-lg px-3 py-2 text-left ${
                  selected === t.id
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Ticket #{t.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(t.fecha).toLocaleString("es-AR")} ·{" "}
                    {t.medio || "Efectivo"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-gray-900">
                  {money(t.total)}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Vincular
          </button>
        </div>
      </div>
    </div>
  );
}

function ClienteRow({ cliente, onPagar, onDeuda, onVincular, onToggleHistorial, expanded }) {
  return (
    <div data-tour="client-card" className="client-card border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{cliente.nombre}</p>
          {cliente.telefono && (
            <p className="text-xs text-gray-500">{cliente.telefono}</p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <p
            className={`col-span-1 text-left text-sm font-bold sm:text-right ${
              cliente.saldo > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {money(cliente.saldo)}
          </p>
          <button
            data-tour="client-history"
            onClick={() => onToggleHistorial(cliente.id)}
            className="col-span-1 text-right text-xs text-gray-500 hover:text-gray-900 underline"
          >
            {expanded ? "Ocultar" : "Historial"}
          </button>
          <button
            data-tour="client-link-ticket"
            onClick={() => onVincular(cliente)}
            className="flex min-h-10 items-center justify-center gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-gray-50 sm:min-h-0 sm:px-3"
          >
            <ClipboardList size={13} />
            Vincular ticket
          </button>
          <button
            data-tour="client-debt"
            onClick={() => onDeuda(cliente)}
            className="flex min-h-10 items-center justify-center gap-1.5 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-gray-50 sm:min-h-0 sm:px-3"
          >
            <Plus size={13} />
            Deuda manual
          </button>
          <button
            data-tour="client-payment"
            onClick={() => onPagar(cliente)}
            disabled={cliente.saldo <= 0}
            className="col-span-2 flex min-h-10 items-center justify-center gap-1.5 bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-800 disabled:opacity-30 sm:min-h-0"
          >
            <Wallet size={13} />
            Registrar pago
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2 space-y-1 bg-gray-50">
          {cliente.movimientos.length === 0 && (
            <p className="text-xs text-gray-400 py-2">
              Sin movimientos todavía.
            </p>
          )}
          {[...cliente.movimientos].reverse().map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 break-words text-gray-600">
                {m.nota} · {m.fecha}
              </span>
              <span
                className={
                  m.tipo === "deuda"
                    ? "text-red-600 font-medium"
                    : "text-green-600 font-medium"
                }
              >
                {m.tipo === "deuda" ? "+" : "-"}
                {money(m.monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientesView({ clientes, setClientes, tickets, setTickets, setCaja, retornables = [], setRetornables }) {
  const [areaTab, setAreaTab] = useState("clientes");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [pagoCliente, setPagoCliente] = useState(null);
  const [deudaCliente, setDeudaCliente] = useState(null);
  const [vincularCliente, setVincularCliente] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const totalDeuda = clientes.reduce((sum, c) => sum + c.saldo, 0);

  const handleNuevoCliente = ({ nombre, telefono }) => {
    setClientes((prev) => [
      ...prev,
      { id: Date.now(), nombre, telefono, saldo: 0, movimientos: [] },
    ]);
    setNuevoOpen(false);
  };

  const handlePago = ({ monto, medio }) => {
    const clienteQuePaga = clientes.find((c) => c.id === pagoCliente?.id);
    const montoAplicado = Math.min(
      Number(monto) || 0,
      clienteQuePaga?.saldo || 0
    );
    if (!pagoCliente || montoAplicado <= 0) return;
    setClientes((prev) =>
      prev.map((c) => {
        if (c.id !== pagoCliente.id) return c;
        return {
          ...c,
          saldo: Math.round((c.saldo - montoAplicado) * 100) / 100,
          movimientos: [
            ...c.movimientos,
            {
              id: `pago-${Date.now()}`,
              tipo: "pago",
              monto: montoAplicado,
              nota: `Pago recibido (${medio})`,
              fecha: new Date().toLocaleString("es-AR"),
            },
          ],
        };
      })
    );
    if (medio === "Efectivo") {
      setCaja((prev) => ({
        ...prev,
        saldo: prev.saldo + montoAplicado,
        movimientos: [
          ...prev.movimientos,
          {
            id: `cobro-fiado-${Date.now()}`,
            tipo: "ingreso",
            monto: montoAplicado,
            nota: `Cobro fiado - ${clienteQuePaga.nombre}`,
            fecha: new Date().toLocaleString("es-AR"),
          },
        ],
      }));
    }
    setPagoCliente(null);
  };

  const handleDeudaManual = ({ monto, nota }) => {
    const montoValido = Math.round((Number(monto) || 0) * 100) / 100;
    if (!deudaCliente || montoValido <= 0) return;
    setClientes((prev) =>
      prev.map((c) =>
        c.id === deudaCliente.id
          ? {
              ...c,
              saldo: Math.round((c.saldo + montoValido) * 100) / 100,
              movimientos: [
                ...c.movimientos,
                {
                  id: `deuda-manual-${Date.now()}`,
                  tipo: "deuda",
                  monto: montoValido,
                  nota,
                  fecha: new Date().toLocaleString("es-AR"),
                  origen: "manual",
                },
              ],
            }
          : c
      )
    );
    setDeudaCliente(null);
  };

  const handleVincular = (ticketId) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.clienteId || ticket.medio === "Cuenta corriente") return;
    setClientes((prev) =>
      prev.map((c) =>
        c.id === vincularCliente.id
            ? {
              ...c,
              saldo: Math.round((c.saldo + ticket.total) * 100) / 100,
              movimientos: [
                ...c.movimientos,
                {
                  id: `ticket-${ticket.id}-${Date.now()}`,
                  tipo: "deuda",
                  monto: ticket.total,
                  nota: `Ticket #${ticket.id} vinculado como fiado`,
                  fecha: new Date().toLocaleString("es-AR"),
                  ticketId: ticket.id,
                  origen: "ticket",
                },
              ],
            }
          : c
      )
    );
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              clienteId: vincularCliente.id,
              clienteNombre: vincularCliente.nombre,
              medio: "Cuenta corriente",
              fiado: true,
              fechaVinculacion: new Date().toISOString(),
            }
          : t
      )
    );
    if (ticket.medio === "Efectivo") {
      setCaja((prev) => ({
        ...prev,
        saldo: prev.saldo - ticket.total,
        movimientos: [
          ...prev.movimientos,
          {
            id: `ajuste-fiado-${ticket.id}-${Date.now()}`,
            tipo: "egreso",
            monto: ticket.total,
            nota: `Ticket #${ticket.id} pasado a fiado - ${vincularCliente.nombre}`,
            fecha: new Date().toLocaleString("es-AR"),
          },
        ],
      }));
    }
    setVincularCliente(null);
  };

  return (
    <div className="clientes-view min-w-0 px-4 py-5 sm:p-8">
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex">
        <button data-tour="clients-account-tab" onClick={() => setAreaTab("clientes")} className={`min-h-11 rounded-lg border px-2 py-2 text-sm sm:min-h-0 sm:px-3 ${areaTab === "clientes" ? "bg-gray-900 text-white" : "bg-white"}`}>Clientes y fiado</button>
        <button data-tour="clients-returnables-tab" onClick={() => setAreaTab("retornables")} className={`min-h-11 rounded-lg border px-2 py-2 text-sm sm:min-h-0 sm:px-3 ${areaTab === "retornables" ? "bg-gray-900 text-white" : "bg-white"}`}>Envases retornables</button>
      </div>
      <div data-tour={`clients-content-${areaTab}`}>
      {areaTab === "retornables" ? <SmallBusinessTools data={{ retornables, products: [], tickets: [], gastos: [] }} setters={{ setRetornables }} sectionsAllowed={["retornables"]}/> : <>
      <SectionHeader
        title="Clientes / Fiado"
        actions={
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {clientes.length > 0 && (
              <div className="mr-auto text-left sm:mr-0 sm:text-right">
                <p className="text-xs text-gray-500">Deuda total</p>
                <p
                  className={`text-lg font-bold ${
                    totalDeuda > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {money(totalDeuda)}
                </p>
              </div>
            )}
            <button
              data-tour="clients-new"
              onClick={() => setNuevoOpen(true)}
              className="flex min-h-10 items-center justify-center gap-2 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-800"
            >
              <UserPlus size={16} />
              Nuevo cliente
            </button>
          </div>
        }
      />

      {clientes.length === 0 ? (
        <div data-tour="clients-list" className="border border-dashed border-gray-300 rounded-xl px-4 py-10 text-center text-sm text-gray-400 sm:p-10">
          Todavía no cargaste clientes. Los podés usar como medio de pago
          "Cuenta corriente" en Ventas.
        </div>
      ) : (
        <div data-tour="clients-list" className="space-y-2">
          {clientes.map((c) => (
            <ClienteRow
              key={c.id}
              cliente={c}
              onPagar={setPagoCliente}
              onDeuda={setDeudaCliente}
              onVincular={setVincularCliente}
              onToggleHistorial={(id) =>
                setExpandedId(expandedId === id ? null : id)
              }
              expanded={expandedId === c.id}
            />
          ))}
        </div>
      )}

      {nuevoOpen && (
        <ClienteModal onClose={() => setNuevoOpen(false)} onSave={handleNuevoCliente} />
      )}
      {pagoCliente && (
        <PagoModal
          cliente={pagoCliente}
          onClose={() => setPagoCliente(null)}
          onConfirm={handlePago}
        />
      )}
      {deudaCliente && (
        <DeudaManualModal
          cliente={deudaCliente}
          onClose={() => setDeudaCliente(null)}
          onConfirm={handleDeudaManual}
        />
      )}
      {vincularCliente && (
        <VincularTicketModal
          cliente={vincularCliente}
          tickets={tickets}
          onClose={() => setVincularCliente(null)}
          onConfirm={handleVincular}
        />
      )}
      </>}
      </div>
    </div>
  );
}
