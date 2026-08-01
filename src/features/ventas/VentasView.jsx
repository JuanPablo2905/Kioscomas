import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, Mail, Copy, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Star, Zap,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money, formatQuantity, roundQuantity } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { ScanModal } from "../../shared/ScanModal";
import { AppSelect, ConfirmDialog, NumberInput } from "../../shared/controls";
import { calcularDescuento, calcularMejorPromocion } from "./salesRules";
import { groupProductFamilies, productVariant } from "../../shared/productFamilies";
import { openCashDrawer, printTicket } from "../../shared/ticketPrint";
import { SmallBusinessTools } from "../gestion/SmallBusinessTools";
import { Budgets, CustomerOrders } from "./SalesSupportTools";
import { copyText, openEmailDraft, openWhatsApp, ticketMessage } from "../../shared/share";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];
const UMBRAL_DIFERENCIA_INUSUAL = 1000;

function DenomCounter({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
      {DENOMINACIONES.map((d) => (
        <div
          key={d}
          className="flex items-center justify-between border border-gray-200 rounded-lg px-2 py-1.5"
        >
          <span className="text-xs text-gray-600">{money(d)}</span>
          <input
            type="number"
            onFocus={(e) => e.target.select()}
            min={0}
            value={values[d] || ""}
            onChange={(e) => onChange(d, e.target.value)}
            className="w-14 border border-gray-300 rounded px-1 py-1 text-xs text-center"
          />
        </div>
      ))}
    </div>
  );
}

function LegacyAperturaModal({ onClose, onConfirm }) {
  const [values, setValues] = useState({});
  const total = DENOMINACIONES.reduce((sum, d) => sum + (Number(values[d]) || 0) * d, 0);
  const handleChange = (d, v) => setValues((prev) => ({ ...prev, [d]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Apertura de caja</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Contá con cuántos billetes/monedas arrancás el día.
        </p>
        <DenomCounter values={values} onChange={handleChange} />
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-900">Total</p>
          <p className="text-lg font-bold text-gray-900">{money(total)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ total, detalle: values })}
            disabled={total <= 0}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Abrir con {money(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

function LegacyCierreModal({ esperado, onClose, onConfirm }) {
  const [values, setValues] = useState({});
  const total = DENOMINACIONES.reduce((sum, d) => sum + (Number(values[d]) || 0) * d, 0);
  const diferencia = total - esperado;
  const handleChange = (d, v) => setValues((prev) => ({ ...prev, [d]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Cierre de caja</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-gray-500">Esperado en sistema</span>
          <span className="font-semibold text-gray-900">{money(esperado)}</span>
        </div>
        <DenomCounter values={values} onChange={handleChange} />
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-900">Diferencia</p>
          <p
            className={`text-lg font-bold ${
              diferencia === 0
                ? "text-green-600"
                : diferencia > 0
                ? "text-blue-600"
                : "text-red-500"
            }`}
          >
            {diferencia > 0 ? "+" : ""}
            {money(diferencia)}
          </p>
        </div>
        {diferencia !== 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {diferencia > 0
              ? "Hay más plata de la que espera el sistema."
              : "Falta plata respecto a lo que espera el sistema."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ total, diferencia, detalle: values })}
            className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700"
          >
            Cerrar caja
          </button>
        </div>
      </div>
    </div>
  );
}

function AperturaModal({ onClose, onConfirm }) {
  const [modo, setModo] = useState("sin-contar");
  const [montoManual, setMontoManual] = useState("");
  const [values, setValues] = useState({});
  const totalContado = DENOMINACIONES.reduce(
    (sum, d) => sum + (Number(values[d]) || 0) * d,
    0
  );
  const total = modo === "contar" ? totalContado : Number(montoManual) || 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Apertura de caja</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Elegi como queres registrar el monto inicial.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setModo("sin-contar")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              modo === "sin-contar" ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-600"
            }`}
          >
            Sin contar billetes
          </button>
          <button
            type="button"
            onClick={() => setModo("contar")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              modo === "contar" ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-600"
            }`}
          >
            Contar billetes
          </button>
        </div>
        {modo === "contar" ? (
          <>
            <p className="text-xs text-gray-500 mb-3">Carga las cantidades de cada billete o moneda.</p>
            <DenomCounter
              values={values}
              onChange={(d, v) => setValues((prev) => ({ ...prev, [d]: v }))}
            />
          </>
        ) : (
          <>
            <label className="text-sm text-gray-700 block mb-1">Monto inicial (opcional)</label>
            <input
              autoFocus
              type="number"
              min="0"
              value={montoManual}
              onChange={(e) => setMontoManual(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-2">
              Se registrara la apertura sin detalle de billetes.
            </p>
          </>
        )}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-900">Monto inicial</p>
          <p className="text-lg font-bold text-gray-900">{money(total)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ total, detalle: modo === "contar" ? values : null, contado: modo === "contar" })}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
          >
            Abrir caja
          </button>
        </div>
      </div>
    </div>
  );
}

function CierreModal({ esperado, onClose, onConfirm }) {
  const [modo, setModo] = useState("sin-contar");
  const [values, setValues] = useState({});
  const totalContado = DENOMINACIONES.reduce(
    (sum, d) => sum + (Number(values[d]) || 0) * d,
    0
  );
  const diferencia = totalContado - esperado;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Cierre de caja</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-500">Esperado en sistema</span>
          <span className="font-semibold text-gray-900">{money(esperado)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" onClick={() => setModo("sin-contar")} className={`rounded-lg border px-3 py-2 text-sm font-medium ${modo === "sin-contar" ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-600"}`}>
            Cerrar sin contar
          </button>
          <button type="button" onClick={() => setModo("contar")} className={`rounded-lg border px-3 py-2 text-sm font-medium ${modo === "contar" ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-600"}`}>
            Contar billetes
          </button>
        </div>
        {modo === "contar" ? (
          <>
            <DenomCounter values={values} onChange={(d, v) => setValues((prev) => ({ ...prev, [d]: v }))} />
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900">Diferencia</p>
              <p className={`text-lg font-bold ${diferencia === 0 ? "text-green-600" : diferencia > 0 ? "text-blue-600" : "text-red-500"}`}>
                {diferencia > 0 ? "+" : ""}{money(diferencia)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 py-3">
            El cierre quedara registrado sin arqueo ni diferencia de caja.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ total: modo === "contar" ? totalContado : null, diferencia: modo === "contar" ? diferencia : null, detalle: modo === "contar" ? values : null, contado: modo === "contar" })}
            className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700"
          >
            Cerrar caja
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorialCajaModal({ historial, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Historial de apertura / cierre
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {historial.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              Todavía no hay registros.
            </p>
          )}
          {[...historial].reverse().map((h) => (
            <div
              key={h.id}
              className={`border rounded-lg px-3 py-2 ${
                h.inusual ? "border-red-300 bg-red-50" : "border-gray-200"
              }`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-gray-900 flex flex-wrap items-center gap-1.5">
                  {h.tipo === "apertura" ? "Apertura" : "Cierre"}
                  {h.inusual && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} />
                      Diferencia inusual
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{h.fecha}</p>
              </div>
              {h.tipo === "apertura" ? (
                <p className="text-sm text-gray-600 mt-1">
                  Monto inicial: {money(h.monto)} · {h.contado ? "Billetes contados" : "Sin contar billetes"}
                </p>
              ) : (
                <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                  {h.contado ? (
                    <>
                      <p>Esperado: {money(h.esperado)} · Contado: {money(h.monto)}</p>
                      <p className={h.diferencia === 0 ? "text-green-600" : h.diferencia > 0 ? "text-blue-600" : "text-red-500"}>
                        Diferencia: {h.diferencia > 0 ? "+" : ""}{money(h.diferencia)}
                      </p>
                    </>
                  ) : (
                    <p>Cierre registrado sin contar billetes.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MovimientoModal({ saldo, onClose, onConfirm }) {
  const [tipo, setTipo] = useState("ingreso");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");

  const n = Number(monto) || 0;
  const excedeSaldo = tipo === "retiro" && n > saldo;

  const handleConfirm = () => {
    if (!n || n <= 0 || excedeSaldo) return;
    onConfirm({ tipo, monto: n, nota: nota.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            Agregar / Retirar dinero
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTipo("ingreso")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tipo === "ingreso"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Plus size={14} />
            Ingreso
          </button>
          <button
            onClick={() => setTipo("retiro")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tipo === "retiro"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Retiro
          </button>
        </div>

        {tipo === "retiro" && (
          <p className="text-xs text-gray-500 mb-2">
            Disponible en caja: <span className="font-semibold">{money(saldo)}</span>
          </p>
        )}

        <label className="text-sm text-gray-700 block mb-1">Monto</label>
        <input
          type="number"
          onFocus={(e) => e.target.select()}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 text-sm mb-1 ${
            excedeSaldo ? "border-red-400" : "border-gray-300"
          }`}
        />
        {excedeSaldo && (
          <p className="text-xs text-red-500 mb-3">
            No podés retirar más de lo que hay en caja.
          </p>
        )}

        <label className="text-sm text-gray-700 block mb-1 mt-3">
          Nota (opcional)
        </label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: cambio para vuelto, retiro personal..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-5"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!n || n <= 0 || excedeSaldo}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function MovimientosModal({ movimientos, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Movimientos de caja
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {movimientos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              Todavía no hay movimientos manuales.
            </p>
          )}
          {[...movimientos].reverse().map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {m.tipo === "ingreso" ? (
                  <ArrowUpCircle size={16} className="text-green-600" />
                ) : (
                  <ArrowDownCircle size={16} className="text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.nota || (m.tipo === "ingreso" ? "Ingreso de caja" : "Retiro de caja")}
                  </p>
                  <p className="text-xs text-gray-500">{m.fecha}</p>
                </div>
              </div>
              <p
                className={`text-sm font-bold ${
                  m.tipo === "ingreso" ? "text-green-600" : "text-red-500"
                }`}
              >
                {m.tipo === "ingreso" ? "+" : "-"}
                {money(m.monto)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function calcularVuelto(monto) {
  let resto = monto;
  const combinacion = [];
  for (const d of DENOMINACIONES) {
    const cantidad = Math.floor(resto / d);
    if (cantidad > 0) {
      combinacion.push({ denominacion: d, cantidad, subtotal: cantidad * d });
      resto -= cantidad * d;
    }
  }
  return combinacion;
}

const MEDIOS_PAGO = [
  {
    id: "Efectivo",
    emoji: "💵",
    activeClass: "bg-green-500 border-green-500 text-white",
  },
  {
    id: "Mercado Pago",
    emoji: "🤝",
    activeClass: "bg-sky-400 border-sky-400 text-white",
  },
  {
    id: "Tarjeta",
    emoji: "💳",
    activeClass: "bg-orange-500 border-orange-500 text-white",
  },
  {
    id: "Transferencia",
    emoji: "🏦",
    activeClass: "bg-indigo-500 border-indigo-500 text-white",
  },
  {
    id: "Cuenta corriente",
    emoji: "📒",
    activeClass: "bg-gray-800 border-gray-800 text-white",
  },
  {
    id: "Pago combinado",
    emoji: "➗",
    activeClass: "bg-violet-600 border-violet-600 text-white",
  },
];

function MercadoPagoBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="inline-block -mt-0.5">
      <circle cx="12" cy="12" r="11" fill="#00AEEF" stroke="#0B3B8C" strokeWidth="1" />
      <path
        d="M7 9c1.5 1.8 3 2.6 5 2.6s3.5-.8 5-2.6"
        stroke="#0B3B8C"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CobrarModal({ total, clientes, onClose, onConfirm }) {
  const [medio, setMedio] = useState("Efectivo");
  const [recibido, setRecibido] = useState(String(total));
  const [clienteId, setClienteId] = useState("");
  const [pagosMixtos, setPagosMixtos] = useState({ Efectivo: "", "Mercado Pago": "", Tarjeta: "", Transferencia: "" });
  const monto = Number(recibido) || 0;
  const vuelto = monto - total;
  const combinacion = vuelto > 0 ? calcularVuelto(vuelto) : [];
  const esEfectivo = medio === "Efectivo";
  const esFiado = medio === "Cuenta corriente";
  const esMixto = medio === "Pago combinado";
  const totalMixto = Object.values(pagosMixtos).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const puedeConfirmar = esEfectivo
    ? monto >= total
    : esFiado
    ? Boolean(clienteId)
    : esMixto
    ? Math.abs(totalMixto - total) < 0.01
    : true;
  const confirmingRef = useRef(false);
  const confirmSale = () => {
    if (!puedeConfirmar || confirmingRef.current) return;
    confirmingRef.current = true;
    onConfirm({ medio, clienteId: clienteId ? Number(clienteId) : null, pagos: esMixto ? Object.entries(pagosMixtos).filter(([, value]) => Number(value) > 0).map(([metodo, montoPago]) => ({ metodo, monto: Number(montoPago) })) : [] });
  };

  useEffect(() => {
    const onEnter = (event) => {
      if (event.key !== "Enter" || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      confirmSale();
    };
    window.addEventListener("keydown", onEnter, true);
    return () => window.removeEventListener("keydown", onEnter, true);
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="mobile-dialog bg-white rounded-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <div data-tour="sales-payment" className="mb-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Medio de pago
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {MEDIOS_PAGO.map((m) => {
              const active = medio === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMedio(m.id)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-center text-xs font-semibold border transition-colors sm:px-3 sm:py-1.5 ${
                    active
                      ? m.activeClass
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{m.emoji}</span>
                  {m.id === "Mercado Pago" && <MercadoPagoBadge />}
                  {m.id}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Cobrar venta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="text-center mb-5">
          <p className="text-sm text-gray-500 mb-1">Total a cobrar</p>
          <p className="text-3xl font-bold text-gray-900">{money(total)}</p>
        </div>

        {esFiado && (
          <>
            <label className="text-sm text-gray-700 block mb-1">Cliente</label>
            <AppSelect
              value={clienteId}
              onChange={setClienteId}
              className="mb-4 w-full"
            >
              <option value="">Seleccioná un cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </AppSelect>
            {clientes.length === 0 && (
              <p className="text-xs text-amber-600 mb-4">
                Todavía no cargaste clientes en Clientes / Fiado.
              </p>
            )}
          </>
        )}

        {esEfectivo && (
          <>
            <label className="text-sm text-gray-700 block mb-1">
              Monto recibido
            </label>
            <input
              autoFocus
              type="number"
              onFocus={(e) => e.target.select()}
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-900">Vuelto</p>
              <p
                className={`text-lg font-bold ${
                  vuelto >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {money(Math.max(vuelto, 0))}
              </p>
            </div>

            {combinacion.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Combinación sugerida para el vuelto:
                </p>
                <div className="space-y-1">
                  {combinacion.map((c) => (
                    <div
                      key={c.denominacion}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {c.cantidad} x {money(c.denominacion)}
                      </span>
                      <span className="font-medium text-gray-900">
                        {money(c.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {monto > 0 && monto < total && (
              <p className="text-xs text-red-500 mb-4">
                El monto recibido es menor al total.
              </p>
            )}
          </>
        )}

        {esMixto && <div className="mb-4 rounded-xl border bg-gray-50 p-3"><p className="mb-2 text-xs font-semibold text-gray-600">Dividí el total entre dos o más medios</p><div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">{Object.keys(pagosMixtos).map((nombre) => <label key={nombre} className="text-xs text-gray-500">{nombre}<input type="number" min="0" value={pagosMixtos[nombre]} onChange={(event) => setPagosMixtos((current) => ({ ...current, [nombre]: event.target.value }))} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"/></label>)}</div><div className={`mt-3 flex flex-col gap-1 text-sm font-semibold min-[360px]:flex-row min-[360px]:justify-between ${Math.abs(totalMixto-total)<0.01 ? "text-green-600" : "text-amber-700"}`}><span>Cargado: {money(totalMixto)}</span><span>Falta: {money(Math.max(0,total-totalMixto))}</span></div>{totalMixto > total && <p className="mt-1 text-xs text-red-600">El reparto supera el total por {money(totalMixto-total)}.</p>}</div>}

        {!esEfectivo && !esFiado && !esMixto && (
          <p className="text-xs text-gray-500 mb-4">
            Se registra como pagado por {medio.toLowerCase()}, sin afectar el
            efectivo físico de la caja.
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
            data-tour="sales-confirm"
            onClick={confirmSale}
            disabled={!puedeConfirmar}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            {esFiado ? "Confirmar venta (fiado)" : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartQtyInput({ cantidad, onCommit }) {
  const [texto, setTexto] = useState(String(cantidad));

  useEffect(() => {
    setTexto(String(cantidad));
  }, [cantidad]);

  const commit = () => {
    onCommit(texto === "" ? "0" : texto);
  };

  return (
    <input
      type="number"
      onFocus={(e) => e.target.select()}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      className="w-16 text-center text-sm font-medium border border-gray-300 rounded-lg py-1"
    />
  );
}

export function VentasView({
  products,
  setProducts,
  caja,
  setCaja,
  setTickets,
  tickets = [],
  cajaAbierta,
  setCajaAbierta,
  clientes,
  setClientes,
  cart,
  setCart,
  identidad,
  ventasSuspendidas = [],
  setVentasSuspendidas,
  promociones = [],
  puedeAplicarDescuentos = false,
  preferences = {},
  ticketConfig = {},
  businessName = "Mi negocio",
  supportData = {},
  supportSetters = {},
  staffOptions = [],
  hasEmployees = true,
  tutorialMode = false,
}) {
  const [salesArea, setSalesArea] = useState("venta");
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [movListOpen, setMovListOpen] = useState(false);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [aperturaOpen, setAperturaOpen] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [descuentoTipo, setDescuentoTipo] = useState("porcentaje");
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [nombreSuspendida, setNombreSuspendida] = useState("");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [ventaARecuperar, setVentaARecuperar] = useState(null);
  const [ticketParaImprimir, setTicketParaImprimir] = useState(null);
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [ticketCopied, setTicketCopied] = useState(false);
  const lastEnterRef = useRef(0);
  const lastAutoPrintedRef = useRef(null);
  const salesTabs = [["venta","Venta"],["pedidos","Pedidos de clientes"],["presupuestos","Presupuestos"],["cambio","Cambio"],["turnos","Turnos"],["resumen","Resumen diario"]].filter(([id]) => hasEmployees || id !== "turnos");
  const salesNavigation = <><div data-tour="sales-tabs" className="desktop-section-tabs mb-5 flex flex-wrap gap-2">{salesTabs.map(([id,label]) => <button data-tour={`sales-tab-${id}`} key={id} type="button" onClick={() => setSalesArea(id)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${salesArea === id ? "bg-gray-900 text-white" : "bg-white"}`}>{label}</button>)}</div><div data-tour="sales-tabs" className="mobile-section-select mobile-section-select--content sales-mobile-navigation"><span>Área de Ventas</span><AppSelect value={salesArea} onChange={setSalesArea} options={salesTabs.map(([value,label])=>({value,label}))}/></div></>;
  useEffect(() => {
    if (!hasEmployees && salesArea === "turnos") setSalesArea("venta");
  }, [hasEmployees, salesArea]);
  useEffect(() => {
    if (!ticketParaImprimir) return;
    const linkedCustomer = clientes.find((customer) => String(customer.id) === String(ticketParaImprimir.clienteId));
    setSharePhone(ticketParaImprimir.clienteTelefono || linkedCustomer?.telefono || "");
    setShareEmail(ticketParaImprimir.clienteEmail || linkedCustomer?.email || linkedCustomer?.correo || "");
    setTicketCopied(false);
    const efectivo = ticketParaImprimir.medio === "Efectivo" || ticketParaImprimir.pagos?.some((pago) => pago.metodo === "Efectivo" && Number(pago.monto) > 0);
    if (efectivo && preferences.hasCashDrawer && preferences.drawerOpenOnCash) openCashDrawer(preferences);
    if (preferences.ticketPrintMode === "automatica" && lastAutoPrintedRef.current !== ticketParaImprimir.id) {
      lastAutoPrintedRef.current = ticketParaImprimir.id;
      printTicket(ticketParaImprimir, { businessName, paper: preferences.ticketPaper, template: ticketConfig.ticket });
      queueMicrotask(() => setTicketParaImprimir(null));
    } else if (preferences.ticketPrintMode === "nunca") {
      queueMicrotask(() => setTicketParaImprimir(null));
    }
  }, [ticketParaImprimir, clientes, preferences, ticketConfig, businessName]);

  const ventaRapida = useMemo(() => {
    const cantidades = new Map();
    tickets.forEach((ticket) => (ticket.items || []).forEach((item) => {
      const id = item.productId;
      if (id != null) cantidades.set(id, (cantidades.get(id) || 0) + Number(item.cantidad || 0));
    }));
    return products
      .filter((product) => product.vitrina > 0)
      .sort((a, b) => Number(Boolean(b.favorito)) - Number(Boolean(a.favorito)) || (cantidades.get(b.id) || 0) - (cantidades.get(a.id) || 0))
      .slice(0, 8);
  }, [products, tickets]);

  const toggleFavorito = (id) => {
    setProducts((prev) => prev.map((product) => product.id === id ? { ...product, favorito: !product.favorito } : product));
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        (p.nombre.toLowerCase().includes(q) ||
          String(p.codigo || "").toLowerCase().includes(q) ||
          String(p.familia || "").toLowerCase().includes(q) ||
          String(p.variante || "").toLowerCase().includes(q)) &&
        p.vitrina > 0
    );
  }, [products, query]);
  const resultFamilies = useMemo(() => groupProductFamilies(results), [results]);
  const resultRows = useMemo(() => resultFamilies.flatMap((family) => family.products.length === 1
    ? family.products
    : [{ __family: true, ...family }, ...family.products.map((product) => ({ ...product, __familyName: family.name }))]), [resultFamilies]);

  const cartItems = cart.map((c) => {
    const product = products.find((p) => p.id === c.productId);
    return { ...c, product };
  });

  const subtotal = cartItems.reduce(
    (sum, c) => sum + (c.product ? c.product.venta * c.cantidad : 0),
    0
  );
  const promoAplicada = calcularMejorPromocion(cartItems, promociones);
  const descuentoPromocion = Math.min(subtotal, promoAplicada.descuento);
  const descuentoLimitado = descuentoTipo === "porcentaje" ? Math.min(Number(descuentoValor) || 0, Number(preferences.maxDiscount ?? 100)) : descuentoValor;
  const descuentoManual = puedeAplicarDescuentos ? calcularDescuento(subtotal - descuentoPromocion, descuentoTipo, descuentoLimitado) : 0;
  const descuento = descuentoPromocion + descuentoManual;
  const total = subtotal - descuento;

  useEffect(() => {
    const handleQuickCheckout = (event) => {
      if (event.defaultPrevented || event.key !== "Enter" || cobrarOpen || !cajaAbierta || cartItems.length === 0) return;
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (editable || event.ctrlKey || event.altKey || event.metaKey) return;
      const now = performance.now();
      if (now - lastEnterRef.current <= 550) {
        event.preventDefault();
        lastEnterRef.current = 0;
        setCobrarOpen(true);
      } else {
        lastEnterRef.current = now;
      }
    };
    window.addEventListener("keydown", handleQuickCheckout);
    return () => window.removeEventListener("keydown", handleQuickCheckout);
  }, [cobrarOpen, cajaAbierta, cartItems.length]);

  const suspenderVenta = () => {
    if (!cart.length || !setVentasSuspendidas) return;
    const fecha = new Date().toISOString();
    setVentasSuspendidas((prev) => [...prev, { id: Date.now(), nombre: nombreSuspendida.trim() || `Venta ${prev.length + 1}`, fecha, cart: cart.map((item) => ({ ...item })), descuentoTipo, descuentoValor, total }]);
    setCart([]);
    setNombreSuspendida("");
    setDescuentoValor(0);
  };

  const recuperarVentaNativa = (venta) => {
    if (cart.length && !window.confirm("La venta actual será reemplazada. ¿Continuar?")) return;
    const disponibles = (venta.cart || []).map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return null;
      const max = Number(product.vitrina || 0) * unidadInfo(product.unidad).factor;
      const cantidad = Math.min(Number(item.cantidad || 0), max);
      return cantidad > 0 ? { ...item, cantidad } : null;
    }).filter(Boolean);
    setCart(disponibles);
    setDescuentoTipo(venta.descuentoTipo || "porcentaje");
    setDescuentoValor(Number(venta.descuentoValor || 0));
    setVentasSuspendidas((prev) => prev.filter((item) => item.id !== venta.id));
  };

  const aplicarVentaSuspendida = (venta) => {
    const disponibles = (venta.cart || []).map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return null;
      const max = Number(product.vitrina || 0) * unidadInfo(product.unidad).factor;
      const cantidad = Math.min(Number(item.cantidad || 0), max);
      return cantidad > 0 ? { ...item, cantidad } : null;
    }).filter(Boolean);
    setCart(disponibles);
    setDescuentoTipo(venta.descuentoTipo || "porcentaje");
    setDescuentoValor(Number(venta.descuentoValor || 0));
    setVentasSuspendidas((prev) => prev.filter((item) => item.id !== venta.id));
    setVentaARecuperar(null);
  };

  const recuperarVenta = (venta) => cart.length ? setVentaARecuperar(venta) : aplicarVentaSuspendida(venta);

  const stepFor = (product) => (unidadInfo(product.unidad).factor === 1 ? 1 : 100);

  const addToCart = (product) => {
    const info = unidadInfo(product.unidad);
    const disponibleVenta = product.vitrina * info.factor;
    if (disponibleVenta <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        const next = existing.cantidad + stepFor(product);
        if (next > disponibleVenta) return prev;
        return prev.map((c) =>
          c.productId === product.id ? { ...c, cantidad: next } : c
        );
      }
      const inicial =
        info.factor === 1 ? 1 : Math.min(stepFor(product), disponibleVenta);
      return [...prev, { productId: product.id, cantidad: inicial }];
    });
    setQuery("");
  };

  const changeQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId) return c;
          const product = products.find((p) => p.id === productId);
          const info = product ? unidadInfo(product.unidad) : { factor: 1 };
          const max = product ? product.vitrina * info.factor : Infinity;
          const next = c.cantidad + delta;
          if (next <= 0) return null;
          if (next > max) return c;
          return { ...c, cantidad: next };
        })
        .filter(Boolean)
    );
  };

  const setCantidadDirecta = (productId, value) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const info = unidadInfo(product.unidad);
    const max = product.vitrina * info.factor;
    let next = Number(value);
    if (Number.isNaN(next)) next = 0;
    next = Math.max(0, Math.min(next, max));
    setCart((prev) => {
      if (next <= 0) return prev.filter((c) => c.productId !== productId);
      return prev.map((c) =>
        c.productId === productId ? { ...c, cantidad: next } : c
      );
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const handleScanned = (code) => {
    const product = products.find((p) => p.codigo === code);
    if (product && product.vitrina > 0) {
      addToCart(product);
      return true;
    }
    return false;
  };

  const handleCobrar = ({ medio, clienteId, pagos = [] }) => {
    if (cartItems.length === 0) return;
    const selectedCustomer = medio === "Cuenta corriente" ? clientes.find((customer) => String(customer.id) === String(clienteId)) : null;
    setProducts((prev) =>
      prev.map((p) => {
        const item = cart.find((c) => c.productId === p.id);
        if (!item) return p;
        const info = unidadInfo(p.unidad);
        const decremento = item.cantidad / info.factor;
        return {
          ...p,
          vitrina: roundQuantity(p.vitrina - decremento),
          historial: [
            ...(p.historial || []),
            historialEntry(
              "venta",
              `-${item.cantidad} ${info.ventaAbbr} vendidos (${medio})`
            ),
          ],
        };
      })
    );
    const fecha = new Date();
    setTickets((prev) => {
      const nextId = Math.max(0, ...prev.map((item) => Number(item.id) || 0)) + 1;
      const ticket = {
        id: nextId,
        fecha: fecha.toISOString(),
        medio,
        pagos: medio === "Pago combinado" ? pagos : [{ metodo: medio, monto: total }],
        clienteId: medio === "Cuenta corriente" ? clienteId : null,
        clienteNombre: selectedCustomer?.nombre || null,
        clienteTelefono: selectedCustomer?.telefono || "",
        clienteEmail: selectedCustomer?.email || selectedCustomer?.correo || "",
        quien: identidad?.nombre || identidad?.rol || "Sin identificar",
        items: cartItems.map((c) => {
          const info = unidadInfo(c.product.unidad);
          const costoUnitario = c.product.costo / info.factor;
          const subtotalBruto = c.product.venta * c.cantidad;
          const subtotalNeto = subtotal > 0 ? subtotalBruto * total / subtotal : subtotalBruto;
          return {
            productId: c.product.id,
            nombre: c.product.nombre,
            cantidad: c.cantidad,
            unidad: c.product.unidad || "unidad",
            precioUnitario: c.product.venta,
            costoUnitario,
            costoTotal: costoUnitario * c.cantidad,
            subtotalBruto,
            subtotal: Math.round(subtotalNeto * 100) / 100,
          };
        }),
        total,
        subtotal,
        descuento,
        descuentoPromocion,
        promocion: promoAplicada.promocion ? { id: promoAplicada.promocion.id, nombre: promoAplicada.promocion.nombre } : null,
        descuentoTipo: descuento > 0 ? descuentoTipo : null,
        descuentoValor: descuento > 0 ? Number(descuentoValor) : 0,
      };
      queueMicrotask(() => setTicketParaImprimir(ticket));
      return [...prev, ticket];
    });

    const efectivoCobrado = medio === "Efectivo" ? total : medio === "Pago combinado" ? Number(pagos.find((pago) => pago.metodo === "Efectivo")?.monto || 0) : 0;
    if (efectivoCobrado > 0) {
      setCaja((prev) => ({
        ...prev,
        saldo: prev.saldo + efectivoCobrado,
        movimientos: [
          ...prev.movimientos,
          {
            id: prev.movimientos.length + 1,
            tipo: "ingreso",
            monto: efectivoCobrado,
            nota: medio === "Pago combinado" ? "Venta (parte en efectivo)" : "Venta (efectivo)",
            fecha: fecha.toLocaleString("es-AR"),
          },
        ],
      }));
    } else if (medio === "Cuenta corriente" && clienteId) {
      setClientes((prev) =>
        prev.map((c) =>
          c.id === clienteId
            ? {
                ...c,
                saldo: c.saldo + total,
                movimientos: [
                  ...c.movimientos,
                  {
                    id: c.movimientos.length + 1,
                    tipo: "deuda",
                    monto: total,
                    nota: "Venta a cuenta corriente",
                    fecha: fecha.toLocaleString("es-AR"),
                  },
                ],
              }
            : c
        )
      );
    }
    setCart([]);
    setDescuentoValor(0);
  };

  const handleMovimiento = ({ tipo, monto, nota }) => {
    if (tipo === "retiro" && monto > caja.saldo) return;
    const base = tipo === "ingreso" ? "Ingreso de caja" : "Retiro de caja";
    const motivo = String(nota || "").trim();
    const notaFinal = motivo ? `${base} — ${motivo}` : base;
    setCaja((prev) => {
      if (tipo === "retiro" && monto > prev.saldo) return prev;
      return {
        ...prev,
        saldo: tipo === "ingreso" ? prev.saldo + monto : prev.saldo - monto,
        movimientos: [
          ...prev.movimientos,
          {
            id: prev.movimientos.length + 1,
            tipo,
            monto,
            nota: notaFinal,
            fecha: new Date().toLocaleString("es-AR"),
          },
        ],
      };
    });
    setMovOpen(false);
  };

  const handleAperturaConfirm = ({ total: montoApertura, detalle, contado }) => {
    const fecha = new Date();
    setCaja((prev) => ({
      ...prev,
      saldo: montoApertura,
      movimientos: [
        ...prev.movimientos,
        {
          id: prev.movimientos.length + 1,
          tipo: "ingreso",
          monto: montoApertura,
          nota: contado ? "Apertura de caja (billetes contados)" : "Apertura de caja (sin contar billetes)",
          fecha: fecha.toLocaleString("es-AR"),
        },
      ],
      historial: [
        ...prev.historial,
        {
          id: prev.historial.length + 1,
          tipo: "apertura",
          monto: montoApertura,
          detalle,
          contado,
          fecha: fecha.toLocaleString("es-AR"),
        },
      ],
    }));
    setCajaAbierta(true);
    setAperturaOpen(false);
  };

  const handleCierreConfirm = ({ total: montoContado, diferencia, detalle, contado }) => {
    const fecha = new Date();
    const inusual = contado && Math.abs(diferencia) >= UMBRAL_DIFERENCIA_INUSUAL;
    setCaja((prev) => ({
      ...prev,
      saldo: 0,
      historial: [
        ...prev.historial,
        {
          id: prev.historial.length + 1,
          tipo: "cierre",
          monto: montoContado,
          esperado: prev.saldo,
          diferencia,
          detalle,
          contado,
          inusual,
          fecha: fecha.toLocaleString("es-AR"),
        },
      ],
    }));
    setCajaAbierta(false);
    setCierreOpen(false);
  };

  if (salesArea !== "venta") {
    return <div className="ventas-view min-w-0 px-4 py-5 sm:p-8"><SectionHeader title="Ventas / Caja" />{salesNavigation}<div data-tour={`sales-content-${salesArea}`}>{salesArea === "pedidos" ? <CustomerOrders products={products} records={supportData.reservas || []} setRecords={supportSetters.setReservas}/> : salesArea === "presupuestos" ? <Budgets products={products} records={supportData.presupuestos || []} setRecords={supportSetters.setPresupuestos}/> : <SmallBusinessTools key={salesArea} data={{ ...supportData, products, tickets, caja }} setters={{ ...supportSetters, setProducts }} identidad={identidad} preferences={preferences} staffOptions={staffOptions} sectionsAllowed={[salesArea]}/>}</div></div>;
  }

  if (!cajaAbierta) {
    return (
      <div className="ventas-view min-w-0 px-4 py-5 sm:p-8">
        <SectionHeader title="Ventas / Caja" />
        {salesNavigation}
        <div className="flex min-h-[calc(100vh-230px)] flex-col items-center justify-center text-center">
        <ShoppingCart size={32} className="text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">¿Arrancamos?</h1>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Abrí la caja para empezar a vender y registrar movimientos.
        </p>
        <button
          onClick={() => setAperturaOpen(true)}
          className="bg-gray-900 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-gray-800"
        >
          Abrir caja
        </button>

        {aperturaOpen && (
          <AperturaModal
            onClose={() => setAperturaOpen(false)}
            onConfirm={handleAperturaConfirm}
          />
        )}
        </div>
      </div>
    );
  }

  return (
    <div data-tour="sales-content-venta" className="ventas-view min-w-0 px-4 py-5 sm:p-8">
      <ConfirmDialog open={Boolean(ventaARecuperar)} title="Reemplazar venta actual" message="Los productos cargados actualmente seran reemplazados por la venta suspendida." confirmLabel="Reemplazar venta" onCancel={() => setVentaARecuperar(null)} onConfirm={() => aplicarVentaSuspendida(ventaARecuperar)}/>
      <SectionHeader
        title="Ventas / Caja"
        actions={
          <div className="sales-header-actions flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <div data-tour="cash-balance" className="mr-auto text-left sm:mr-0 sm:text-right">
              <p className="text-xs text-gray-500">Saldo en caja</p>
              <p className="text-lg font-bold text-green-600">
                {money(caja.saldo)}
              </p>
            </div>
            <button
              data-tour="cash-adjust"
              onClick={() => setMovOpen(true)}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:flex-none"
            >
              <Plus size={16} />
              Agregar / Retirar
            </button>
            <button
              data-tour="cash-movements"
              onClick={() => setMovListOpen(true)}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:flex-none"
            >
              <Clock size={16} />
              Movimientos
            </button>
            <button
              data-tour="cash-history"
              onClick={() => setHistorialOpen(true)}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:flex-none"
            >
              <History size={16} />
              Historial
            </button>
            <button
              data-tour="cash-close"
              onClick={() => setCierreOpen(true)}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-3 py-2 text-sm font-medium text-white sm:flex-none"
            >
              <Lock size={16} />
              Cerrar caja
            </button>
          </div>
        }
      />
      {salesNavigation}

      {tutorialMode && (
        <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50 p-3 text-sm text-violet-900">
          <b>Demostración guiada</b>
          <p className="mt-1 text-xs">El producto y la venta mostrados son ficticios. Podés probar el cobro: nada de este recorrido se guarda ni modifica el stock real.</p>
        </div>
      )}

      <div className="sales-search-bar grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 mb-4 sm:gap-3">
        <button
          onClick={() => setScanOpen(true)}
          className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <ScanLine size={16} />
          Escanear
        </button>
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
          {results.length > 0 && (
            <div className="sales-search-results absolute z-10 mt-1 w-full border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {resultRows.map((p) => p.__family ? (
                <div key={`family-${p.key}`} className="sales-family-heading flex items-center justify-between border-b px-3 py-2 text-sm font-bold"><span>{p.name}</span><small>{p.products.length} variantes</small></div>
              ) : (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="sales-search-option w-full flex flex-col items-start gap-0.5 px-3 py-2 text-sm text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <span className={p.__familyName ? "ml-2 border-l-2 pl-4" : ""}>{p.__familyName ? `↳ ${productVariant(p, p.__familyName)}` : p.nombre}</span>
                  <span className="text-xs text-gray-500 sm:text-sm sm:text-right">
                    {money(p.venta)}/{unidadInfo(p.unidad).ventaAbbr} · Vitrina:{" "}
                    {formatQuantity(p.vitrina)} {unidadInfo(p.unidad).baseAbbr}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {ventasSuspendidas.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Ventas suspendidas ({ventasSuspendidas.length})</p>
          <div className="flex flex-wrap gap-2">
            {ventasSuspendidas.map((venta) => <div key={venta.id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"><button onClick={() => recuperarVenta(venta)} className="text-left font-medium text-amber-900"><span className="block">{venta.nombre} · {(venta.cart || []).length} producto(s){venta.total != null ? ` · ${money(venta.total)}` : ""}</span><small className="font-normal text-amber-700">{venta.fecha ? new Date(venta.fecha).toLocaleString("es-AR") : ""}</small></button><button onClick={() => setVentasSuspendidas((prev) => prev.filter((item) => item.id !== venta.id))} className="text-gray-400 hover:text-red-600"><X size={14}/></button></div>)}
          </div>
        </div>
      )}

      {ventaRapida.length > 0 && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Venta rápida</h2>
            <span className="min-w-0 flex-1 text-xs text-gray-400">Favoritos y más vendidos</span>
            <button onClick={() => setFavoritesOpen((value) => !value)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 sm:ml-auto">{favoritesOpen ? "Cerrar" : "Elegir favoritos"}</button>
          </div>
          {favoritesOpen && <div className="mb-3 max-h-52 overflow-y-auto rounded-xl border bg-white p-2"><div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{products.filter((product) => product.vitrina > 0).map((product) => <button key={product.id} onClick={() => toggleFavorito(product.id)} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${product.favorito ? "bg-amber-50 text-amber-900" : "hover:bg-gray-50"}`}><span className="truncate pr-3">{product.nombre}</span><Star size={15} className={product.favorito ? "text-amber-500" : "text-gray-300"} fill={product.favorito ? "currentColor" : "none"}/></button>)}</div></div>}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {ventaRapida.map((product) => (
              <div key={product.id} className="relative rounded-lg border border-gray-200 bg-white p-2">
                <button onClick={() => addToCart(product)} className="w-full pr-4 text-left">
                  <p className="truncate text-xs font-semibold text-gray-900">{product.nombre}</p>
                  <p className="mt-1 text-xs text-gray-500">{money(product.venta)}</p>
                </button>
                <button onClick={() => toggleFavorito(product.id)} title={product.favorito ? "Quitar de favoritos" : "Agregar a favoritos"} className={`absolute right-1.5 top-1.5 ${product.favorito ? "text-amber-500" : "text-gray-300 hover:text-amber-500"}`}>
                  <Star size={14} fill={product.favorito ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl px-4 py-12 text-center sm:p-16">
          <ShoppingCart size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">
            Escaneá o buscá productos para armar el ticket
          </p>
        </div>
      ) : (
        <div data-tour="sales-cart" className="space-y-2">
          {cartItems.map((c) => (
            <div
              key={c.productId}
              className="sales-cart-item flex flex-col items-stretch gap-3 border border-gray-200 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div>
                <p className="font-medium text-gray-900">{c.product.nombre}</p>
                <p className="text-xs text-gray-500">
                  {money(c.product.venta)} /{unidadInfo(c.product.unidad).ventaAbbr}{" "}
                  · Disponible:{" "}
                  {Math.round(
                    c.product.vitrina * unidadInfo(c.product.unidad).factor * 100
                  ) / 100}{" "}
                  {unidadInfo(c.product.unidad).ventaAbbr}
                </p>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end sm:gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeQty(c.productId, -stepFor(c.product))}
                    className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Minus size={14} />
                  </button>
                  <CartQtyInput
                    cantidad={c.cantidad}
                    onCommit={(v) => setCantidadDirecta(c.productId, v)}
                  />
                  <button
                    onClick={() => changeQty(c.productId, stepFor(c.product))}
                    className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="min-w-0 flex-1 text-right text-sm font-semibold text-gray-900 sm:w-24 sm:flex-none">
                  {money(c.product.venta * c.cantidad)}
                </p>
                <button
                  onClick={() => removeFromCart(c.productId)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 md:grid-cols-2">
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><input value={nombreSuspendida} onChange={(e) => setNombreSuspendida(e.target.value)} placeholder="Nombre opcional" className="min-w-0 rounded-lg border px-3 py-2 text-sm"/><button onClick={suspenderVenta} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800">Suspender</button></div>
              {puedeAplicarDescuentos && <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 min-[430px]:flex"><span className="text-xs text-gray-500">Descuento</span><select value={descuentoTipo} onChange={(e) => setDescuentoTipo(e.target.value)} className="min-w-0 rounded-lg border bg-white px-2 py-1.5 text-xs"><option value="porcentaje">Porcentaje</option><option value="fijo">Monto fijo</option></select><input type="number" min="0" max={descuentoTipo === "porcentaje" ? Number(preferences.maxDiscount ?? 100) : undefined} value={descuentoValor || ""} onChange={(e) => setDescuentoValor(e.target.value)} className="col-span-2 w-full rounded-lg border px-2 py-1.5 text-sm min-[430px]:col-span-1 min-[430px]:w-28" placeholder={descuentoTipo === "porcentaje" ? `% (máx. ${preferences.maxDiscount ?? 100})` : "$"}/></div>}
            </div>
            <div className="text-left md:text-right">
              {descuento > 0 && <><p className="text-sm text-gray-500">Subtotal: {money(subtotal)}</p>{descuentoPromocion > 0 && <p className="text-sm font-medium text-violet-600">Promo “{promoAplicada.promocion?.nombre}”: -{money(descuentoPromocion)}</p>}{descuentoManual > 0 && <p className="text-sm font-medium text-green-600">Descuento manual: -{money(descuentoManual)}</p>}</>}
              <p className="text-lg font-bold text-gray-900">Total: {money(total)}</p>
            </div>
          </div>
          <button
            data-tour="sales-charge"
            onClick={() => setCobrarOpen(true)}
            className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-gray-800"
          >
            Cobrar {money(total)}
          </button>
        </div>
      )}

      {cobrarOpen && (
        <CobrarModal
          total={total}
          clientes={clientes}
          onClose={() => setCobrarOpen(false)}
          onConfirm={(payload) => {
            handleCobrar(payload);
            setCobrarOpen(false);
          }}
        />
      )}
      {ticketParaImprimir && !["automatica","nunca"].includes(preferences.ticketPrintMode) && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-2 sm:p-4"><div className="mobile-dialog max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:p-6"><h2 className="text-lg font-bold">Venta registrada</h2><p className="mt-1 text-sm opacity-65">Ticket #{ticketParaImprimir.id} · {money(ticketParaImprimir.total)}</p><p className="mt-4 text-sm font-semibold">¿Qué querés hacer con el ticket?</p><p className="mt-1 text-xs opacity-60">Podés enviarlo, imprimirlo o terminar la venta sin hacer nada.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={sharePhone} onChange={(event)=>setSharePhone(event.target.value)} placeholder="WhatsApp del cliente" className="rounded-lg border px-3 py-2 text-sm"/><input type="email" value={shareEmail} onChange={(event)=>setShareEmail(event.target.value)} placeholder="Correo del cliente" className="rounded-lg border px-3 py-2 text-sm"/></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><button onClick={()=>setTicketParaImprimir(null)} className="rounded-lg border px-3 py-2 text-sm">No hacer nada</button><button onClick={()=>openWhatsApp({phone:sharePhone,text:ticketMessage(ticketParaImprimir,businessName)})} className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"><MessageCircle size={15}/>WhatsApp</button><button onClick={()=>openEmailDraft({to:shareEmail,subject:`Ticket #${ticketParaImprimir.id} - ${businessName}`,body:ticketMessage(ticketParaImprimir,businessName)})} className="flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm"><Mail size={15}/>Correo</button><button onClick={()=>printTicket(ticketParaImprimir,{businessName,paper:preferences.ticketPaper,template:ticketConfig.ticket})} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">Imprimir</button></div><button onClick={async()=>{try{await copyText(ticketMessage(ticketParaImprimir,businessName));setTicketCopied(true);}catch{}}} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs"><Copy size={14}/>{ticketCopied?"Ticket copiado":"Copiar texto del ticket"}</button></div></div>}

      {scanOpen && (
        <ScanModal continuous products={products} preferences={preferences} onClose={() => setScanOpen(false)} onDetected={handleScanned} />
      )}
      {movOpen && (
        <MovimientoModal
          saldo={caja.saldo}
          onClose={() => setMovOpen(false)}
          onConfirm={handleMovimiento}
        />
      )}
      {movListOpen && (
        <MovimientosModal
          movimientos={caja.movimientos}
          onClose={() => setMovListOpen(false)}
        />
      )}
      {cierreOpen && (
        <CierreModal
          esperado={caja.saldo}
          onClose={() => setCierreOpen(false)}
          onConfirm={handleCierreConfirm}
        />
      )}
      {historialOpen && (
        <HistorialCajaModal
          historial={caja.historial}
          onClose={() => setHistorialOpen(false)}
        />
      )}
    </div>
  );
}

function isWithinRange(dateStr, range) {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "Hoy") return date >= startOfDay;
  if (range === "Semana") {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 6);
    return date >= start;
  }
  if (range === "Quincena") {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 14);
    return date >= start;
  }
  if (range === "Mes") {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 29);
    return date >= start;
  }
  return true;
}
