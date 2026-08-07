import React, { useState, useMemo } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight,
} from "lucide-react";
import { money, NAV_ITEMS, historialEntry } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect } from "../../shared/controls";
import { defaultDataset, PERMISOS_MENU, PERMISOS_ACCION } from "../../app/data";
import { secureSubject } from "../../security/auth";
import { auditActor, auditDisplayDetail, auditDisplayRole, auditDisplaySection } from "../../shared/audit";

const MOCK_LOCALES = [
  {
    id: 1,
    nombre: "Kiosco Centro",
    direccion: "Av. Mitre 1234, Quilmes",
    ventasHoy: 45000,
    cajaAbierta: true,
    empleados: 2,
  },
  {
    id: 2,
    nombre: "Kiosco Sur",
    direccion: "Calle 12 y 51, Berazategui",
    ventasHoy: 28000,
    cajaAbierta: false,
    empleados: 1,
  },
  {
    id: 3,
    nombre: "Kiosco Estación",
    direccion: "Terminal Quilmes",
    ventasHoy: 61500,
    cajaAbierta: true,
    empleados: 3,
  },
];

function safeBusinessData(raw) {
  const base = defaultDataset(false);
  const source = raw || {};
  return {
    ...base,
    ...source,
    products: Array.isArray(source.products) ? source.products : [],
    tickets: Array.isArray(source.tickets) ? source.tickets : [],
    caja: {
      ...base.caja,
      ...(source.caja || {}),
      movimientos: Array.isArray(source.caja?.movimientos) ? source.caja.movimientos : [],
      historial: Array.isArray(source.caja?.historial) ? source.caja.historial : [],
    },
  };
}

const MOCK_EMPLEADOS = [
  { id: 1, nombre: "Juan Pérez", rol: "Dueño", local: "Todos los locales" },
  { id: 2, nombre: "Marcos Díaz", rol: "Administrador", local: "Kiosco Centro" },
  { id: 3, nombre: "Lucía Gómez", rol: "Cajero", local: "Kiosco Centro" },
  { id: 4, nombre: "Fede Torres", rol: "Cajero", local: "Kiosco Sur" },
  { id: 5, nombre: "Ana Ríos", rol: "Administrador", local: "Kiosco Estación" },
  { id: 6, nombre: "Tomás Ibáñez", rol: "Cajero", local: "Kiosco Estación" },
];

const MOCK_MOVIMIENTOS = [
  { id: 1, local: "Kiosco Centro", tipo: "Venta", monto: 12000, fecha: "09/07 18:32", usuario: "Lucía Gómez" },
  { id: 2, local: "Kiosco Estación", tipo: "Venta", monto: 8500, fecha: "09/07 19:05", usuario: "Tomás Ibáñez" },
  { id: 3, local: "Kiosco Sur", tipo: "Cierre de caja", monto: -500, fecha: "09/07 20:10", usuario: "Fede Torres" },
  { id: 4, local: "Kiosco Centro", tipo: "Retiro", monto: -3000, fecha: "09/07 20:40", usuario: "Marcos Díaz" },
  { id: 5, local: "Kiosco Estación", tipo: "Venta", monto: 15200, fecha: "10/07 09:15", usuario: "Ana Ríos" },
];

const ROL_STYLE = {
  Dueño: "bg-gray-900 text-white",
  Administrador: "bg-blue-100 text-blue-700",
  Cajero: "bg-gray-100 text-gray-600",
};

function LegacyAdministracionView({ cuenta }) {
  const ventasTotalHoy = MOCK_LOCALES.reduce((sum, l) => sum + l.ventasHoy, 0);

  return (
    <div className="p-4 sm:p-8">
      <SectionHeader title="Administración" />

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 mb-5">
        🔧 Todo lo de acá abajo (locales, empleados y movimientos) es una
        <b> vista de demostración con datos de ejemplo</b>, para mostrar cómo
        va a quedar la jerarquía. Cuando conectemos base de datos real, cada
        local va a operar con su propia cuenta y vos, como Dueño, vas a ver
        todo esto agregado automáticamente acá.
      </div>

      <div className="border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-sm text-gray-500 mb-1">Tu cuenta (Dueño)</p>
        <p className="font-semibold text-gray-900">{cuenta?.nombre}</p>
        <p className="text-sm text-gray-600">Usuario: @{cuenta?.usuario}</p>
        <p className="text-sm text-gray-600">Negocio: {cuenta?.nombreNegocio}</p>
        <p className="text-xs text-gray-400 mt-2">
          Como Dueño, tu cuenta puede ver los movimientos de todos los locales.
          Administradores solo ven su local, y Cajeros solo operan la caja.
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-900">🏪 Locales</h2>
          <p className="text-xs text-gray-500">
            Ventas de hoy (todos los locales):{" "}
            <span className="font-semibold text-gray-900">
              {money(ventasTotalHoy)}
            </span>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MOCK_LOCALES.map((l) => (
            <div key={l.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900">{l.nombre}</p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    l.cajaAbierta
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {l.cajaAbierta ? "Caja abierta" : "Caja cerrada"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{l.direccion}</p>
              <p className="text-sm text-gray-600">
                Ventas hoy: <span className="font-semibold text-gray-900">{money(l.ventasHoy)}</span>
              </p>
              <p className="text-xs text-gray-500">{l.empleados} empleado(s)</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          👥 Empleados y roles
        </h2>
        <div className="space-y-2">
          {MOCK_EMPLEADOS.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{e.nombre}</p>
                <p className="text-xs text-gray-500">{e.local}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROL_STYLE[e.rol]}`}
              >
                {e.rol}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          📊 Movimientos de todos los locales
        </h2>
        <div className="space-y-1">
          {MOCK_MOVIMIENTOS.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-lg border border-gray-100 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {m.local}
                </span>
                <span className="text-gray-700">{m.tipo}</span>
                <span className="text-xs text-gray-400">· {m.usuario}</span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-gray-400">{m.fecha}</span>
                <span
                  className={`font-semibold ${
                    m.monto >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {m.monto >= 0 ? "+" : ""}
                  {money(m.monto)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditarMovimientoModal({ movimiento, onClose, onConfirm, onDelete }) {
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [nota, setNota] = useState(movimiento.nota || "");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Editar movimiento</h2>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Esta edición queda registrada en el historial como corrección.
        </p>
        <label className="text-sm text-gray-700 block mb-1">Monto</label>
        <input
          type="number"
          onFocus={(e) => e.target.select()}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="text-sm text-gray-700 block mb-1">Nota</label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
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
              onConfirm({ monto: Number(monto), nota: nota.trim() })
            }
            disabled={!Number(monto) || Number(monto) <= 0}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Guardar corrección
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          {!confirmandoBorrado ? (
            <button
              onClick={() => setConfirmandoBorrado(true)}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Eliminar este movimiento
            </button>
          ) : (
            <div>
              <p className="text-xs text-red-500 mb-2">
                El movimiento queda tachado (no desaparece), y la caja se
                ajusta según corresponda. ¿Confirmás?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmandoBorrado(false)}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmpleadoModal({ rolesDisponibles, onClose, onConfirm }) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState(rolesDisponibles[0]?.nombre || "");
  const [rolNuevo, setRolNuevo] = useState("");
  const creandoRol = rol === "__nuevo__";

  const rolFinal = creandoRol ? rolNuevo.trim() : rol;
  const puedeGuardar =
    nombre.trim() && usuario.trim() && password.trim() && rolFinal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nuevo empleado</h2>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <label className="text-sm text-gray-700 block mb-1">Nombre</label>
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="text-sm text-gray-700 block mb-1">Usuario</label>
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="text-sm text-gray-700 block mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <label className="text-sm text-gray-700 block mb-1">Rol</label>
        <AppSelect
          value={rol}
          onChange={setRol}
          className="mb-1 w-full"
        >
          {rolesDisponibles.map((r) => (
            <option key={r.nombre} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
          <option value="__nuevo__">+ Crear rol nuevo...</option>
        </AppSelect>
        {creandoRol ? (
          <input
            autoFocus
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value)}
            placeholder="Nombre del rol nuevo"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 mb-4"
          />
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            Los permisos de cada rol se configuran abajo, en "Roles y permisos".
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
            onClick={() =>
              puedeGuardar &&
              onConfirm({
                nombre: nombre.trim(),
                usuario: usuario.trim(),
                password,
                rol: rolFinal,
              })
            }
            disabled={!puedeGuardar}
            className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
          >
            Crear empleado
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdministracionView({ cuenta, cuentas, setCuentas, datos, onOpenNegocio, setDatos, identidad, sugerencias = [], setSugerencias, setProducts, hasEmployees = true }) {
  const esSuperAdmin = !!identidad?.superAdmin;
  const [negocioAbiertoId, setNegocioAbiertoId] = useState(
    esSuperAdmin ? null : cuenta?.id || null
  );
  const [editandoMovimiento, setEditandoMovimiento] = useState(null);
  const [nuevoEmpleadoOpen, setNuevoEmpleadoOpen] = useState(null);
  const [nuevoRolNombre, setNuevoRolNombre] = useState("");
  const permisosIdentidad = identidad?.rol === "Dueño" || (identidad?.adminApp && identidad?.operandoNegocio) ? null : (cuenta?.roles || []).find((r) => r.nombre === identidad?.rol)?.permisos || [];
  const puedeCorregirCaja = permisosIdentidad === null || permisosIdentidad.includes("corregir_caja");
  const puedeGestionarPersonal = permisosIdentidad === null || permisosIdentidad.includes("gestionar_personal");

  const resumenes = cuentas.map((negocio) => {
    const negocioDatos = safeBusinessData(datos?.[negocio.id]);
    const ventasHoy = negocioDatos.tickets.reduce(
      (total, ticket) => total + (ticket.total || 0),
      0
    );
    return {
      ...negocio,
      productos: negocioDatos.products.length,
      ventasHoy,
      cajaAbierta: negocioDatos.cajaAbierta,
      saldoCaja: negocioDatos.caja.saldo,
      tickets: negocioDatos.tickets.length,
      movimientos: negocioDatos.caja.movimientos,
      auditoria: negocioDatos.auditoria || [],
    };
  });
  const ventasTotalHoy = resumenes.reduce(
    (total, negocio) => total + negocio.ventasHoy,
    0
  );
  const negocioAbierto = resumenes.find(
    (negocio) => negocio.id === negocioAbiertoId
  );

  const alertas = (esSuperAdmin ? cuentas : cuentas.filter((n) => n.id === cuenta?.id)).flatMap(
    (negocio) => {
      const negocioDatos = safeBusinessData(datos?.[negocio.id]);
      return (negocioDatos.caja.historial || [])
        .filter((h) => h.inusual)
        .map((h) => ({ ...h, negocioNombre: negocio.nombreNegocio, negocioId: negocio.id }));
    }
  );

  const handleEditarMovimiento = ({ monto, nota }) => {
    if (!negocioAbiertoId || !editandoMovimiento) return;
    setDatos((prev) => {
      const negocioDatos = safeBusinessData(prev?.[negocioAbiertoId]);
      const original = editandoMovimiento;
      const nuevosMovimientos = negocioDatos.caja.movimientos.map((m) =>
        m.id === original.id ? { ...m, monto, nota } : m
      );
      const contribucionOriginal =
        original.tipo === "retiro" ? -original.monto : original.monto;
      const contribucionNueva =
        original.tipo === "retiro" ? -monto : monto;
      const diff = contribucionNueva - contribucionOriginal;
      const actor = auditActor(identidad);
      return {
        ...prev,
        [negocioAbiertoId]: {
          ...negocioDatos,
          caja: {
            ...negocioDatos.caja,
            saldo: negocioDatos.caja.saldo + diff,
            movimientos: nuevosMovimientos,
            historial: [
              ...negocioDatos.caja.historial,
              {
                id: negocioDatos.caja.historial.length + 1,
                tipo: "correccion",
                detalle: `Movimiento #${original.id} corregido: ${money(
                  original.monto
                )} → ${money(monto)} (${cuenta?.nombre || "Dueño"})`,
                fecha: new Date().toLocaleString("es-AR"),
              },
            ],
          },
          auditoria: [
            ...(negocioDatos.auditoria || []),
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fecha: new Date().toISOString(),
              tenantId: String(negocioAbiertoId),
              seccion: "administracion",
              recurso: "caja",
              accion: "corregir_movimiento_caja",
              detalle: `Movimiento #${original.id}: ${money(original.monto)} → ${money(monto)} · ${nota || original.nota || "Sin nota"}`,
              ...actor,
            },
          ],
        },
      };
    });
    setEditandoMovimiento(null);
  };

  const handleEliminarMovimiento = () => {
    if (!negocioAbiertoId || !editandoMovimiento) return;
    setDatos((prev) => {
      const negocioDatos = safeBusinessData(prev?.[negocioAbiertoId]);
      const original = editandoMovimiento;
      const contribucionOriginal =
        original.tipo === "retiro" ? -original.monto : original.monto;
      const nuevosMovimientos = negocioDatos.caja.movimientos.map((m) =>
        m.id === original.id ? { ...m, eliminado: true } : m
      );
      const actor = auditActor(identidad);
      return {
        ...prev,
        [negocioAbiertoId]: {
          ...negocioDatos,
          caja: {
            ...negocioDatos.caja,
            saldo: negocioDatos.caja.saldo - contribucionOriginal,
            movimientos: nuevosMovimientos,
            historial: [
              ...negocioDatos.caja.historial,
              {
                id: negocioDatos.caja.historial.length + 1,
                tipo: "eliminacion_movimiento",
                detalle: `Movimiento #${original.id} eliminado: ${money(
                  original.monto
                )} · "${original.nota}" (${cuenta?.nombre || "Dueño"})`,
                fecha: new Date().toLocaleString("es-AR"),
              },
            ],
          },
          auditoria: [
            ...(negocioDatos.auditoria || []),
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fecha: new Date().toISOString(),
              tenantId: String(negocioAbiertoId),
              seccion: "administracion",
              recurso: "caja",
              accion: "eliminar_movimiento_caja",
              detalle: `Movimiento #${original.id} eliminado: ${money(original.monto)} · ${original.nota || "Sin nota"}`,
              ...actor,
            },
          ],
        },
      };
    });
    setEditandoMovimiento(null);
  };

  const registrarAuditoria = (negocioId, detalle) => {
    setDatos((prev) => {
      const negocioDatos = safeBusinessData(prev?.[negocioId]);
      if (!prev?.[negocioId]) return prev;
      const actor = auditActor(identidad);
      return {
        ...prev,
        [negocioId]: {
          ...negocioDatos,
          caja: {
            ...negocioDatos.caja,
            historial: [
              ...negocioDatos.caja.historial,
              {
                id: negocioDatos.caja.historial.length + 1,
                tipo: "auditoria_tecnica",
                detalle,
                fecha: new Date().toLocaleString("es-AR"),
              },
            ],
          },
          auditoria: [
            ...(negocioDatos.auditoria || []),
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fecha: new Date().toISOString(),
              tenantId: String(negocioId),
              seccion: "administracion",
              recurso: "cuentas",
              accion: "auditoria_tecnica",
              detalle,
              ...actor,
            },
          ],
        },
      };
    });
  };

  const handleAgregarEmpleado = async ({ nombre, usuario, password, rol }) => {
    if (!nuevoEmpleadoOpen) return;
    const normalizedUser = String(usuario || "").trim();
    const normalizedPassword = String(password || "").trim();
    const yaExiste = cuentas.some(
      (c) =>
        String(c.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase() ||
        (c.empleados || []).some((e) => String(e.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase())
    );
    if (yaExiste) return;
    const empleadoSeguro = await secureSubject({ id: Date.now(), nombre: nombre.trim(), usuario: normalizedUser, password: normalizedPassword, rol });
    setCuentas((prev) =>
      prev.map((c) => {
        if (c.id !== nuevoEmpleadoOpen) return c;
        const rolesActuales = c.roles || [];
        const rolesConNuevo = rolesActuales.some((r) => r.nombre === rol)
          ? rolesActuales
          : [...rolesActuales, { nombre: rol, permisos: [] }];
        return {
          ...c,
          roles: rolesConNuevo,
          empleados: [
            ...(c.empleados || []),
            empleadoSeguro,
          ],
        };
      })
    );
    registrarAuditoria(
      nuevoEmpleadoOpen,
      `Empleado creado: ${nombre} (@${usuario}) con rol "${rol}" — por ${cuenta?.nombre || "Dueño"}`
    );
    setNuevoEmpleadoOpen(null);
  };

  const handleEliminarEmpleado = (negocioId, empleadoId) => {
    const empleado = cuentas
      .find((c) => c.id === negocioId)
      ?.empleados?.find((e) => e.id === empleadoId);
    setCuentas((prev) =>
      prev.map((c) =>
        c.id === negocioId
          ? { ...c, empleados: (c.empleados || []).filter((e) => e.id !== empleadoId) }
          : c
      )
    );
    registrarAuditoria(
      negocioId,
      `Empleado eliminado: ${empleado?.nombre || "?"} (@${empleado?.usuario || "?"}) — por ${cuenta?.nombre || "Dueño"}`
    );
  };

  const handleCambiarRolEmpleado = (negocioId, empleadoId, rol) => {
    const employee = cuentas.find((item) => item.id === negocioId)?.empleados?.find((item) => item.id === empleadoId);
    if (!employee || employee.rol === rol) return;
    setCuentas((previous) => previous.map((business) => business.id === negocioId ? {
      ...business,
      empleados: (business.empleados || []).map((item) => item.id === empleadoId ? { ...item, rol } : item),
    } : business));
    registrarAuditoria(negocioId, `Rol de ${employee.nombre} cambiado de "${employee.rol}" a "${rol}"`);
  };

  const handleCrearRol = (negocioId, nombreRol) => {
    const nombre = nombreRol.trim();
    if (!nombre) return;
    setCuentas((prev) =>
      prev.map((c) => {
        if (c.id !== negocioId) return c;
        if ((c.roles || []).some((r) => r.nombre === nombre)) return c;
        return { ...c, roles: [...(c.roles || []), { nombre, permisos: [] }] };
      })
    );
    registrarAuditoria(negocioId, `Rol creado: "${nombre}" — por ${cuenta?.nombre || "Dueño"}`);
  };

  const handleTogglePermiso = (negocioId, rolNombre, permisoId) => {
    setCuentas((prev) =>
      prev.map((c) => {
        if (c.id !== negocioId) return c;
        return {
          ...c,
          roles: (c.roles || []).map((r) => {
            if (r.nombre !== rolNombre) return r;
            const tiene = r.permisos.includes(permisoId);
            return {
              ...r,
              permisos: tiene
                ? r.permisos.filter((p) => p !== permisoId)
                : [...r.permisos, permisoId],
            };
          }),
        };
      })
    );
    const rolActual = cuentas.find((c) => c.id === negocioId)?.roles?.find((r) => r.nombre === rolNombre);
    const yaTenia = rolActual?.permisos.includes(permisoId);
    registrarAuditoria(
      negocioId,
      `Permiso "${permisoId}" ${yaTenia ? "quitado de" : "agregado a"} rol "${rolNombre}" — por ${cuenta?.nombre || "Dueño"}`
    );
  };

  const handleEliminarRol = (negocioId, rolNombre) => {
    setCuentas((prev) =>
      prev.map((c) =>
        c.id === negocioId
          ? { ...c, roles: (c.roles || []).filter((r) => r.nombre !== rolNombre) }
          : c
      )
    );
    registrarAuditoria(negocioId, `Rol eliminado: "${rolNombre}" — por ${cuenta?.nombre || "Dueño"}`);
  };

  const resolverSugerencia = (sugerencia, aprobar) => {
    if (aprobar && sugerencia.tipo === "nuevo_producto") {
      setProducts((prev) => [...prev, { id: Date.now(), vitrina: 0, ...sugerencia.data, historial: [historialEntry("creacion", `Producto aprobado · sugerido por ${sugerencia.autor}`)] }]);
    }
    if (aprobar && sugerencia.tipo === "actualizar_producto") {
      const data = sugerencia.data || {};
      const codigo = String(data.codigo || "").replace(/\D/g, "");
      setProducts((prev) => prev.map((p) => p.codigo && String(p.codigo).replace(/\D/g, "") === codigo ? {
        ...p,
        nombre: data.nombre || p.nombre,
        categoria: data.categoria ?? p.categoria,
        familia: data.familia ?? p.familia,
        variante: data.variante ?? p.variante,
        unidad: data.unidad || p.unidad || "unidad",
        imagenUrl: data.imagenUrl ?? p.imagenUrl,
        descripcionCatalogo: data.descripcionCatalogo ?? p.descripcionCatalogo,
        historial: [...(p.historial || []), historialEntry("actualizacion", `Actualizado desde el catálogo · ${sugerencia.autor}`)],
      } : p));
    }
    setSugerencias((prev) => prev.map((item) => item.id === sugerencia.id ? { ...item, estado: aprobar ? "aprobada" : "rechazada", resueltaFecha: new Date().toISOString() } : item));
  };

  return (
    <div data-tour="administration-content" className="mx-auto max-w-6xl p-4 sm:p-8">
      <SectionHeader title="Administracion" />

      {sugerencias.filter((s) => s.estado === "pendiente").length > 0 && (identidad?.rol === "Dueño" || (identidad?.adminApp && identidad?.operandoNegocio)) && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-blue-900">Sugerencias pendientes</h2>
          <div className="space-y-2">{sugerencias.filter((s) => s.estado === "pendiente").map((s) => <div key={s.id} className="flex flex-col gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium">{s.tipo === "actualizar_producto" ? `Actualizar producto: ${s.data?.nombre || s.data?.codigo}` : `Nuevo producto: ${s.data?.nombre}`}</p><p className="text-xs text-gray-500">Sugerido por {s.autor} · {new Date(s.fecha).toLocaleString("es-AR")}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => resolverSugerencia(s, false)} className="min-h-10 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600">Rechazar</button><button onClick={() => resolverSugerencia(s, true)} className="min-h-10 rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white">Aprobar</button></div></div>)}</div>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} />
            {alertas.length} movimiento(s) inusual(es) detectado(s)
          </p>
          <div className="space-y-1">
            {alertas.map((a) => (
              <p key={`${a.negocioId}-${a.id}`} className="text-xs text-red-600">
                <span className="font-medium">{a.negocioNombre}</span> — Cierre
                del {a.fecha}: diferencia de {a.diferencia > 0 ? "+" : ""}
                {money(a.diferencia)}
              </p>
            ))}
          </div>
        </div>
      )}

      {esSuperAdmin ? (
        <>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500">
                Gestioná todos los negocios desde un solo lugar.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Sesión actual: {cuenta?.nombreNegocio} (Administrador de la app)
              </p>
            </div>
            <div className="bg-gray-900 text-white rounded-xl px-4 py-3 mt-3 sm:mt-0">
              <p className="text-[11px] uppercase tracking-wide text-gray-300">
                Ventas totales
              </p>
              <p className="font-semibold">{money(ventasTotalHoy)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resumenes.map((negocio) => (
              <button
                data-tour="administration-business"
                key={negocio.id}
                type="button"
                onClick={() => setNegocioAbiertoId(negocio.id)}
                className={`text-left border rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                  negocioAbiertoId === negocio.id
                    ? "border-gray-900 shadow-md"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Store size={20} className="text-gray-700" />
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      negocio.cajaAbierta
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {negocio.cajaAbierta ? "Caja abierta" : "Caja cerrada"}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 truncate">
                  {negocio.nombreNegocio}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Responsable: {negocio.nombre}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[11px] text-gray-400">Productos</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {negocio.productos}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Ventas</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {money(negocio.ventasHoy)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm font-medium text-gray-700">
                  Abrir menu del negocio <ChevronRight size={17} />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500 mb-4">
          {hasEmployees ? "Administrá tu negocio: empleados, roles y movimientos de caja." : "Administrá los movimientos, correcciones y la auditoría de tu negocio."}
        </p>
      )}

      {negocioAbierto && (
        <div className="mt-6 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-start justify-between gap-4 bg-gray-50 p-4 sm:p-5">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Menu del negocio
              </p>
              <h2 className="text-lg font-semibold text-gray-900 mt-1">
                {negocioAbierto.nombreNegocio}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                @{negocioAbierto.usuario} - {negocioAbierto.tickets} venta(s) registrada(s)
              </p>
            </div>
            {esSuperAdmin && (
              <button
                type="button"
                onClick={() => setNegocioAbiertoId(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700"
                aria-label="Cerrar menu"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Caja actual</p>
              <p className="font-semibold text-gray-900 mt-1">
                {money(negocioAbierto.saldoCaja)}
              </p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Productos cargados</p>
              <p className="font-semibold text-gray-900 mt-1">
                {negocioAbierto.productos}
              </p>
            </div>
            {esSuperAdmin && (
              <button
                type="button"
                onClick={() => onOpenNegocio(negocioAbierto.id)}
                className="col-span-2 min-h-20 rounded-xl bg-gray-900 p-4 text-left text-white transition-colors hover:bg-gray-800 sm:col-span-1"
              >
                <p className="text-xs text-gray-300">Operar este local</p>
                <p className="font-semibold mt-1 flex items-center justify-between">
                  Entrar al negocio <ChevronRight size={18} />
                </p>
              </button>
            )}
          </div>

          <div data-tour="administration-cash" className="px-4 pb-4 sm:px-5 sm:pb-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Movimientos de caja (podés corregirlos)
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {negocioAbierto.movimientos.length === 0 && (
                <p className="text-xs text-gray-400">
                  Todavía no hay movimientos registrados.
                </p>
              )}
              {[...negocioAbierto.movimientos].reverse().map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
                    m.eliminado
                      ? "border-gray-100 bg-gray-50 opacity-60"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {m.tipo === "ingreso" ? (
                      <ArrowUpCircle size={14} className="text-green-600" />
                    ) : (
                      <ArrowDownCircle size={14} className="text-red-500" />
                    )}
                    <div>
                      <p className="text-gray-900">
                        {m.nota}
                        {m.eliminado && (
                          <span className="ml-2 text-[11px] text-red-500 font-medium">
                            (eliminado)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{m.fecha}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span
                      className={`font-semibold ${
                        m.eliminado
                          ? "line-through text-gray-400"
                          : m.tipo === "ingreso"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "+" : "-"}
                      {money(m.monto)}
                    </span>
                    {!m.eliminado && puedeCorregirCaja && (
                      <button
                        onClick={() => setEditandoMovimiento(m)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-gray-900"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-tour="administration-audit" className="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Registro completo de actividad</h3>
                <p className="text-xs text-gray-500">Incluye cambios de stock, ventas, caja, compras, clientes, gastos, configuración y acciones administrativas.</p>
              </div>
              <span className="text-xs text-gray-400">{(negocioAbierto.auditoria || []).length} evento(s)</span>
            </div>
            {(negocioAbierto.auditoria || []).length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-gray-400">Todavía no hay actividad auditada.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border bg-gray-50/50 p-2">
                {[...(negocioAbierto.auditoria || [])].reverse().map((evento) => (
                  <div key={evento.id} className="rounded-lg border bg-white px-3 py-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-gray-900">{auditDisplayDetail(evento, negocioAbierto)}</p>
                        <p className="mt-0.5 break-words text-xs text-gray-500">
                          {evento.usuario || "Sin identificar"} · {auditDisplayRole(evento, negocioAbierto)}
                          {evento.seccion ? ` · ${auditDisplaySection(evento.seccion)}` : ""}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-gray-400">{evento.fecha ? new Date(evento.fecha).toLocaleString("es-AR") : "Sin fecha"}</time>
                    </div>
                    {evento.origen === "administracion_app" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Hecho desde administración de la app</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasEmployees && negocioAbierto.id === cuenta?.id && puedeGestionarPersonal && (
            <div data-tour="administration-employees" className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Empleados de este negocio
                </h3>
                <button
                  onClick={() => setNuevoEmpleadoOpen(negocioAbierto.id)}
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 sm:w-auto"
                >
                  <UserPlus size={13} />
                  Agregar empleado
                </button>
              </div>
              {(negocioAbierto.empleados || []).length === 0 ? (
                <p className="text-xs text-gray-400">
                  Todavía no agregaste empleados. Vos (Dueño) sos el único con
                  acceso.
                </p>
              ) : (
                <div className="space-y-1">
                  {(negocioAbierto.empleados || []).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900">{e.nombre}</p>
                        <p className="text-xs text-gray-400">@{e.usuario}</p>
                        <AppSelect value={e.rol} onChange={(role) => handleCambiarRolEmpleado(negocioAbierto.id, e.id, role)} options={(negocioAbierto.roles || []).map((role) => ({ value: role.nombre, label: role.nombre }))} className="mt-2 w-full max-w-56"/>
                      </div>
                      <button
                        onClick={() => handleEliminarEmpleado(negocioAbierto.id, e.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div data-tour="administration-roles" className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Roles y permisos
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Tildá qué secciones puede ver cada rol. Podés crear roles
                  personalizados además de Administrador y Cajero.
                </p>
                <div className="space-y-3">
                  {(negocioAbierto.roles || []).map((rol) => (
                    <div key={rol.nombre} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{rol.nombre}</p>
                        <button
                          onClick={() => handleEliminarRol(negocioAbierto.id, rol.nombre)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[...PERMISOS_MENU.map((id) => ({ id, label: NAV_ITEMS.find((n) => n.id === id)?.label || id })), ...PERMISOS_ACCION].map(({ id: permisoId, label }) => {
                          const activo = rol.permisos.includes(permisoId);
                          return (
                            <button
                              key={permisoId}
                              onClick={() =>
                                handleTogglePermiso(negocioAbierto.id, rol.nombre, permisoId)
                              }
                            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium ${
                                activo
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-white text-gray-500 border-gray-300"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={nuevoRolNombre}
                    onChange={(e) => setNuevoRolNombre(e.target.value)}
                    placeholder="Nombre del rol nuevo (ej: Repositor)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      handleCrearRol(negocioAbierto.id, nuevoRolNombre);
                      setNuevoRolNombre("");
                    }}
                    disabled={!nuevoRolNombre.trim()}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                  >
                    <Plus size={14} />
                    Crear rol
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {nuevoEmpleadoOpen && (
        <EmpleadoModal
          rolesDisponibles={
            resumenes.find((n) => n.id === nuevoEmpleadoOpen)?.roles || []
          }
          onClose={() => setNuevoEmpleadoOpen(null)}
          onConfirm={handleAgregarEmpleado}
        />
      )}

      {editandoMovimiento && (
        <EditarMovimientoModal
          movimiento={editandoMovimiento}
          onClose={() => setEditandoMovimiento(null)}
          onConfirm={handleEditarMovimiento}
          onDelete={handleEliminarMovimiento}
        />
      )}
    </div>
  );
}
