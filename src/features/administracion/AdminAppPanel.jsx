import React, { useMemo, useState } from "react";
import { ArrowLeft, Barcode, Bug, CalendarDays, CheckCircle2, Cloud, Clock, CreditCard, History, KeyRound, Lightbulb, Pencil, Plus, Search, Settings2, Shield, Store, Trash2, UserRound, UsersRound, X, XCircle } from "lucide-react";
import { SectionHeader } from "../../shared/layout";
import { secureSubject } from "../../security/auth";
import { canAccessAccount, formatAccessExpiration, formatTrialExpiration, grantTrialAccess, trialAccessStatus } from "../../security/trialAccess";
import { AppSelect, ConfirmDialog } from "../../shared/controls";
import { BarcodeCatalogAdmin } from "./BarcodeCatalogAdmin";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

const ESTADOS = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobada: "bg-green-100 text-green-700",
  bloqueada: "bg-red-100 text-red-700",
};

function TrialStatus({ account }) {
  const trial = trialAccessStatus(account);
  if (trial.activeSubscription) return <p className="mt-1 text-xs font-semibold text-green-700">Abono activo · vence {formatAccessExpiration(account)}</p>;
  if (trial.reason === "subscription_expired") return <p className="mt-1 text-xs font-semibold text-red-600">Abono vencido · acceso de consulta</p>;
  if (account.estado === "aprobada") return <p className="mt-1 text-xs text-gray-500">Cuenta aprobada sin vencimiento asignado</p>;
  if (trial.active) return <p className="mt-1 text-xs font-medium text-amber-700">Prueba activa · vence {formatTrialExpiration(account)}</p>;
  if (trial.reason === "expired") return <p className="mt-1 text-xs font-medium text-red-600">Prueba vencida · conserva todos sus datos</p>;
  return <p className="mt-1 text-xs text-gray-500">Sin acceso temporal activo</p>;
}

const emptyPayment = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  importe: "",
  medio: "Transferencia",
  meses: 1,
  nota: "",
});

function addCalendarMonths(value, months) {
  const date = new Date(value);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Math.max(1, Number(months) || 1));
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return date;
}

export function AdminAppPanel({ cuentas, setCuentas, datos, setDatos, notas, setNotas, reportes = [], setReportes, onOpenNegocio, onLogout, onOpenSettings, syncStatus, onSyncNow }) {
  const [textoNota, setTextoNota] = useState("");
  const [prioridad, setPrioridad] = useState("normal");
  const [categoria, setCategoria] = useState("función");
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({});
  const [capturaAbierta, setCapturaAbierta] = useState(null);
  const [cuentaABorrarId, setCuentaABorrarId] = useState(null);
  const [menuActivo, setMenuActivo] = useState("administracion");
  const [pagoCuentaId, setPagoCuentaId] = useState(null);
  const [pagoForm, setPagoForm] = useState(emptyPayment);
  const [historialCuentaId, setHistorialCuentaId] = useState(null);
  const [busquedaNegocios, setBusquedaNegocios] = useState("");
  const [usuariosCuentaId, setUsuariosCuentaId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [credencialTemporal, setCredencialTemporal] = useState(null);
  const negocios = useMemo(() => cuentas.filter((cuenta) => !cuenta.superAdmin), [cuentas]);
  const negociosFiltrados = useMemo(() => {
    const query = busquedaNegocios.trim().toLocaleLowerCase("es");
    if (!query) return negocios;
    return negocios.filter((cuenta) => [
      cuenta.nombreNegocio,
      cuenta.nombre,
      cuenta.usuario,
      ...(cuenta.empleados || []).flatMap((empleado) => [empleado.nombre, empleado.usuario, empleado.rol]),
    ].some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  }, [busquedaNegocios, negocios]);

  const actualizarCuenta = (id, cambios) =>
    setCuentas((prev) => prev.map((cuenta) => cuenta.id === id ? { ...cuenta, ...cambios } : cuenta));

  const guardarCuenta = async (cuenta) => {
    const cambios = { nombre: form.nombre, nombreNegocio: form.nombreNegocio, usuario: form.usuario, planNombre: form.planNombre || "Mensual", planPrecio: Number(form.planPrecio || 0) };
    if (form.password?.trim()) Object.assign(cambios, await secureSubject({ password: form.password.trim() }));
    actualizarCuenta(cuenta.id, cambios);
    setEditandoId(null);
  };

  const abrirRestablecimiento = (cuenta, sujeto, tipo) => {
    setResetTarget({ cuentaId: cuenta.id, sujetoId: sujeto.id, tipo, nombre: sujeto.nombre, usuario: sujeto.usuario, rol: tipo === "dueno" ? "Dueño" : (sujeto.rol || "Empleado") });
    setResetPassword("");
    setResetError("");
    setCredencialTemporal(null);
  };

  const generarPasswordTemporal = () => {
    const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(5));
    const token = bytes ? Array.from(bytes, (value) => value.toString(36)).join("").slice(0, 8) : Math.random().toString(36).slice(2, 10);
    setResetPassword(`K+${token}`);
    setResetError("");
  };

  const guardarPasswordTemporal = async () => {
    const password = resetPassword.trim();
    if (!resetTarget || password.length < 4) {
      setResetError("La contraseña temporal debe tener al menos 4 caracteres.");
      return;
    }
    const securedPassword = await secureSubject({ password });
    setCuentas((previous) => previous.map((cuenta) => {
      if (cuenta.id !== resetTarget.cuentaId) return cuenta;
      if (resetTarget.tipo === "dueno") return { ...cuenta, ...securedPassword };
      return {
        ...cuenta,
        empleados: (cuenta.empleados || []).map((empleado) => empleado.id === resetTarget.sujetoId ? { ...empleado, ...securedPassword } : empleado),
      };
    }));
    setCredencialTemporal({ usuario: resetTarget.usuario, password, nombre: resetTarget.nombre });
    setResetTarget(null);
    setResetPassword("");
    setResetError("");
  };

  const registrarPago = (cuenta) => {
    const importe = Number(String(pagoForm.importe).replace(",", "."));
    if (!Number.isFinite(importe) || importe < 0 || !pagoForm.fecha) return;
    const now = new Date();
    const currentExpiration = new Date(cuenta.subscriptionExpiresAt || 0);
    const base = Number.isFinite(currentExpiration.getTime()) && currentExpiration > now ? currentExpiration : now;
    const expiresAt = addCalendarMonths(base, pagoForm.meses);
    const payment = {
      id: globalThis.crypto?.randomUUID?.() || `pago-${Date.now()}`,
      fechaPago: new Date(`${pagoForm.fecha}T12:00:00`).toISOString(),
      registradoAt: now.toISOString(),
      importe,
      medio: pagoForm.medio,
      meses: Math.max(1, Number(pagoForm.meses) || 1),
      nota: pagoForm.nota.trim(),
      accesoDesde: base.toISOString(),
      accesoHasta: expiresAt.toISOString(),
      registradoPor: "Administrador de Kiosco+",
    };
    actualizarCuenta(cuenta.id, {
      estado: "aprobada",
      subscriptionStartedAt: cuenta.subscriptionStartedAt || now.toISOString(),
      subscriptionExpiresAt: expiresAt.toISOString(),
      lastPaymentAt: payment.fechaPago,
      planMonths: payment.meses,
      pagos: [payment, ...(cuenta.pagos || [])],
    });
    setPagoCuentaId(null);
    setPagoForm(emptyPayment());
  };

  const agregarNota = () => {
    if (!textoNota.trim()) return;
    setNotas((prev) => [{ id: Date.now(), texto: textoNota.trim(), prioridad, categoria, estado: "pendiente", fecha: new Date().toISOString() }, ...prev]);
    setTextoNota("");
  };

  const confirmarBorrado = () => {
    if (!cuentaABorrarId) return;
    setCuentas((prev) => prev.filter((item) => item.id !== cuentaABorrarId));
    setDatos((prev) => { const next = { ...prev }; delete next[cuentaABorrarId]; return next; });
    setCuentaABorrarId(null);
  };

  const totales = {
    activas: negocios.filter((cuenta) => ["approved", "subscription", "trial"].includes(trialAccessStatus(cuenta).reason)).length,
    pendientes: negocios.filter((cuenta) => cuenta.estado === "pendiente").length,
    bloqueadas: negocios.filter((cuenta) => cuenta.estado === "bloqueada").length,
    vencidas: negocios.filter((cuenta) => trialAccessStatus(cuenta).reason === "subscription_expired").length,
  };

  if (menuActivo === "catalogo") {
    return (
      <div className="kiosco-themed admin-catalog-shell min-h-screen w-full bg-gray-50 text-gray-900">
        <div className="w-full px-4 py-5 sm:px-7 lg:px-10">
          <button type="button" onClick={() => setMenuActivo("administracion")} className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:border-[#1C4A44] hover:text-[#1C4A44]">
            <ArrowLeft size={18}/>Volver a Administración
          </button>
          <header className="mb-6 border-b border-gray-200 pb-5">
            <div className="flex items-center gap-3"><Barcode size={28}/><h1 className="text-2xl font-bold sm:text-3xl">Catálogo del escáner</h1></div>
            <p className="mt-2 max-w-4xl text-sm text-gray-500 sm:text-base">Consultá todos los códigos guardados, completá productos desconocidos y corregí nombres, categorías, variantes o imágenes.</p>
          </header>
          <BarcodeCatalogAdmin businessData={datos}/>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosco-themed admin-app-shell min-h-screen bg-gray-50 p-5 text-gray-900 md:p-8">
      <ConfirmDialog open={Boolean(cuentaABorrarId)} title="Eliminar cuenta" message={`Se borrara la cuenta de ${negocios.find((item) => item.id === cuentaABorrarId)?.nombreNegocio || "este negocio"} y todos sus datos. Esta accion no se puede deshacer.`} confirmLabel="Eliminar definitivamente" danger onCancel={() => setCuentaABorrarId(null)} onConfirm={confirmarBorrado}/>
      <div className="mx-auto max-w-6xl">
        <div className="admin-app-header mb-7 flex flex-wrap items-start gap-3">
          <div className="order-last grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0"><button onClick={onSyncNow} title={syncStatus?.error || "Estado del servidor"} className="flex min-w-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium"><Cloud className="shrink-0" size={16}/><span className={`h-2 w-2 shrink-0 rounded-full ${syncStatus?.state === "error" ? "bg-red-500" : syncStatus?.mode === "cloud" ? "bg-green-500" : "bg-amber-500"}`}/><span className="truncate">{syncStatus?.mode === "cloud" ? "Nube" : "Local"}</span></button><button onClick={onOpenSettings} className="flex min-w-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-100"><Settings2 className="shrink-0" size={16}/><span className="truncate">Configurar</span></button></div>
          <SectionHeader
            title={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>Panel de</span><img src={kioscoPlusLockup} alt="Kiosco+" className="h-9 w-auto max-w-[190px] object-contain object-left sm:h-10 sm:max-w-[220px]"/></span>}
            subtitle="Administración interna de la aplicación y sus negocios."
          />
          <button onClick={onLogout} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-100 sm:w-auto">Cerrar sesión</button>
        </div>

        <div className="mb-7 border-b border-gray-200 pb-4">
          <button onClick={() => setMenuActivo("catalogo")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#163d38] sm:w-auto"><Barcode size={17}/>Abrir catálogo del escáner</button>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[['Negocios', negocios.length, Store], ['Activos', totales.activas, CheckCircle2], ['Vencidos', totales.vencidas, CalendarDays], ['Pendientes', totales.pendientes, Clock], ['Bloqueados', totales.bloqueadas, XCircle]].map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><Icon size={18} className="mb-3 text-gray-500"/><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
          ))}
        </div>

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><Shield size={19}/><h2 className="font-semibold">Administrador de cuentas</h2></div>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 sm:w-80">
              <Search size={17} className="shrink-0 text-gray-400"/>
              <input value={busquedaNegocios} onChange={(event) => setBusquedaNegocios(event.target.value)} placeholder="Buscar negocio, dueño o usuario..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
              {busquedaNegocios && <button type="button" onClick={() => setBusquedaNegocios("")} className="rounded p-0.5 text-gray-400 hover:text-gray-700" aria-label="Limpiar búsqueda"><X size={15}/></button>}
            </label>
          </div>
          {credencialTemporal && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <p className="font-semibold">Contraseña temporal actualizada para {credencialTemporal.nombre}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-white px-3 py-2">@{credencialTemporal.usuario} · {credencialTemporal.password}</code><button type="button" onClick={() => navigator.clipboard?.writeText(`${credencialTemporal.usuario}\n${credencialTemporal.password}`)} className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold">Copiar acceso</button><button type="button" onClick={() => setCredencialTemporal(null)} className="rounded-lg px-2 py-2 text-xs">Ocultar</button></div>
            <p className="mt-2 text-xs">Compartila de forma privada. La contraseña anterior ya no funciona.</p>
          </div>}
          <div className="space-y-3">
            {negociosFiltrados.map((cuenta) => (
              <div key={cuenta.id} className="rounded-xl border border-gray-200 p-4">
                {editandoId === cuenta.id ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Responsable" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.nombreNegocio || ""} onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })} placeholder="Negocio" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.usuario || ""} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Usuario" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Contraseña" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.planNombre || ""} onChange={(e) => setForm({ ...form, planNombre: e.target.value })} placeholder="Nombre del plan" className="rounded-lg border px-3 py-2 text-sm" />
                    <input type="number" min="0" value={form.planPrecio || ""} onChange={(e) => setForm({ ...form, planPrecio: e.target.value })} placeholder="Precio de referencia" className="rounded-lg border px-3 py-2 text-sm" />
                    <div className="grid grid-cols-2 gap-2 md:col-span-4 md:flex"><button onClick={() => guardarCuenta(cuenta)} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">Guardar</button><button onClick={() => setEditandoId(null)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button></div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{cuenta.nombreNegocio}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADOS[cuenta.estado] || ESTADOS.pendiente}`}>{cuenta.estado || "pendiente"}</span></div><p className="mt-1 text-sm text-gray-500">{cuenta.nombre} · @{cuenta.usuario} · {(cuenta.empleados || []).length} empleado(s)</p><TrialStatus account={cuenta}/></div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <button onClick={() => onOpenNegocio(cuenta.id)} disabled={!canAccessAccount(cuenta)} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-30">Entrar</button>
                      {cuenta.estado !== "aprobada" && <><button onClick={() => actualizarCuenta(cuenta.id, grantTrialAccess(cuenta, 1))} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800">Dar 1 día</button><button onClick={() => actualizarCuenta(cuenta.id, grantTrialAccess(cuenta, 7))} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800">Dar 1 semana</button></>}
                      <button onClick={() => { setPagoCuentaId(pagoCuentaId === cuenta.id ? null : cuenta.id); setPagoForm(emptyPayment()); }} className="flex items-center justify-center gap-1 rounded-lg bg-[#1C4A44] px-3 py-2 text-xs font-semibold text-white"><CreditCard size={14}/>Registrar pago</button>
                      {(cuenta.pagos || []).length > 0 && <button onClick={() => setHistorialCuentaId(historialCuentaId === cuenta.id ? null : cuenta.id)} className="flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs"><History size={14}/>Historial</button>}
                      <button onClick={() => actualizarCuenta(cuenta.id, { estado: cuenta.estado === "bloqueada" ? "aprobada" : "bloqueada" })} className="rounded-lg border border-amber-300 px-3 py-2 text-xs text-amber-700">{cuenta.estado === "bloqueada" ? "Desbloquear" : "Bloquear"}</button>
                      <button onClick={() => setUsuariosCuentaId(usuariosCuentaId === cuenta.id ? null : cuenta.id)} className="flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"><UsersRound size={14}/>{usuariosCuentaId === cuenta.id ? "Ocultar cuentas" : `Cuentas (${1 + (cuenta.empleados || []).length})`}</button>
                      <button onClick={() => { setEditandoId(cuenta.id); setForm({ nombre: cuenta.nombre, nombreNegocio: cuenta.nombreNegocio, usuario: cuenta.usuario, password: "", planNombre: cuenta.planNombre || "Mensual", planPrecio: cuenta.planPrecio || "" }); }} className="rounded-lg border px-3 py-2 text-gray-500"><Pencil size={14}/></button>
                      <button onClick={() => setCuentaABorrarId(cuenta.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )}
                {usuariosCuentaId === cuenta.id && <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60">
                  <div className="flex items-start gap-2 border-b bg-gray-50 px-4 py-3"><UsersRound size={17} className="mt-0.5"/><div><h3 className="text-sm font-bold">Cuentas asociadas a {cuenta.nombreNegocio}</h3><p className="text-xs text-gray-500">Por seguridad no se muestran contraseñas existentes. Podés asignar una temporal nueva.</p></div></div>
                  <div className="divide-y">
                    {[{ ...cuenta, rol: "Dueño", tipoCuenta: "dueno" }, ...(cuenta.empleados || []).map((empleado) => ({ ...empleado, tipoCuenta: "empleado" }))].map((sujeto) => <div key={`${sujeto.tipoCuenta}-${sujeto.id}`} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#1C4A44] shadow-sm"><UserRound size={17}/></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{sujeto.nombre || "Sin nombre"} <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">{sujeto.rol || "Empleado"}</span></p><p className="truncate text-xs text-gray-500">Usuario: @{sujeto.usuario}</p></div></div>
                      <button type="button" onClick={() => abrirRestablecimiento(cuenta, sujeto, sujeto.tipoCuenta)} className="flex items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold hover:border-[#1C4A44] hover:text-[#1C4A44]"><KeyRound size={14}/>Restablecer contraseña</button>
                    </div>)}
                  </div>
                </div>}
                {resetTarget?.cuentaId === cuenta.id && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Nueva contraseña temporal</h3><p className="mt-1 text-xs text-gray-600">{resetTarget.nombre} · @{resetTarget.usuario} · {resetTarget.rol}</p></div><button type="button" onClick={() => { setResetTarget(null); setResetPassword(""); setResetError(""); }} className="rounded-lg p-1 text-gray-500"><X size={17}/></button></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input type="text" value={resetPassword} onChange={(event) => { setResetPassword(event.target.value); setResetError(""); }} placeholder="Escribí una contraseña temporal" autoComplete="off" className="min-w-0 rounded-lg border bg-white px-3 py-2 text-sm"/>
                    <button type="button" onClick={generarPasswordTemporal} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Generar segura</button>
                    <button type="button" onClick={guardarPasswordTemporal} className="rounded-lg bg-[#1C4A44] px-3 py-2 text-xs font-semibold text-white">Guardar contraseña</button>
                  </div>
                  {resetError && <p className="mt-2 text-xs font-medium text-red-600">{resetError}</p>}
                </div>}
                {pagoCuentaId === cuenta.id && <div className="mt-4 rounded-xl border border-green-200 bg-green-50/40 p-4">
                  <div className="mb-3 flex items-center gap-2"><CreditCard size={17}/><h3 className="text-sm font-bold">Registrar pago y habilitar acceso</h3></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <input type="date" value={pagoForm.fecha} onChange={(event) => setPagoForm({ ...pagoForm, fecha: event.target.value })} className="rounded-lg border bg-white px-3 py-2 text-sm"/>
                    <input type="number" min="0" step="0.01" value={pagoForm.importe} onChange={(event) => setPagoForm({ ...pagoForm, importe: event.target.value })} placeholder="Importe" className="rounded-lg border bg-white px-3 py-2 text-sm"/>
                    <AppSelect value={pagoForm.medio} onChange={(medio) => setPagoForm({ ...pagoForm, medio })} options={["Transferencia", "Efectivo", "Mercado Pago", "Otro"]}/>
                    <label className="rounded-lg border bg-white px-3 py-1"><span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Meses a habilitar</span><input type="number" min="1" max="24" value={pagoForm.meses} onChange={(event) => setPagoForm({ ...pagoForm, meses: event.target.value })} className="w-full bg-transparent py-0.5 text-sm outline-none"/></label>
                    <button onClick={() => registrarPago(cuenta)} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white">Confirmar pago</button>
                    <input value={pagoForm.nota} onChange={(event) => setPagoForm({ ...pagoForm, nota: event.target.value })} placeholder="Nota opcional" className="rounded-lg border bg-white px-3 py-2 text-sm sm:col-span-2 lg:col-span-5"/>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">El plazo se suma desde el vencimiento vigente; si ya vencio, empieza desde hoy.</p>
                </div>}
                {historialCuentaId === cuenta.id && <div className="mt-4 overflow-hidden rounded-xl border">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-bold">Historial de pagos</div>
                  <div className="divide-y">{(cuenta.pagos || []).map((pago) => <div key={pago.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[1fr_1fr_1fr_2fr]"><span><b>{new Date(pago.fechaPago).toLocaleDateString("es-AR")}</b></span><span>${Number(pago.importe || 0).toLocaleString("es-AR")} · {pago.medio}</span><span>{pago.meses} mes(es) · hasta {new Date(pago.accesoHasta).toLocaleDateString("es-AR")}</span><span className="text-gray-500">{pago.nota || "Sin nota"}</span></div>)}</div>
                </div>}
              </div>
            ))}
            {negociosFiltrados.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No encontramos negocios ni usuarios con “{busquedaNegocios}”.</div>}
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Bug size={19} className="text-red-600"/><h2 className="font-semibold">Problemas reportados</h2></div><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{reportes.filter((item) => item.estado === "nuevo").length} nuevo(s)</span></div>
          {reportes.length === 0 ? <p className="text-sm text-gray-400">Todavía no se reportaron problemas.</p> : <div className="space-y-3">{reportes.map((reporte) => <div key={reporte.id} className={`rounded-xl border p-4 ${reporte.estado === "nuevo" ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}><div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium">{reporte.descripcion}</p><p className="mt-1 break-words text-xs text-gray-500">{reporte.negocio} · {reporte.usuario} · pantalla {reporte.vista} · {new Date(reporte.fecha).toLocaleString("es-AR")}</p>{reporte.detalleTecnico && <details className="mt-2 text-xs text-gray-500"><summary className="cursor-pointer font-medium text-gray-700">Ver datos técnicos</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-900 p-2 text-[11px] text-gray-100">{reporte.detalleTecnico}</pre></details>}</div><div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">{reporte.captura && <button onClick={() => setCapturaAbierta(reporte.captura)} className="rounded-lg border bg-white px-2 py-2 text-xs">Ver captura</button>}<button onClick={() => setReportes((prev) => prev.map((item) => item.id === reporte.id ? { ...item, estado: item.estado === "resuelto" ? "nuevo" : "resuelto" } : item))} className="rounded-lg border bg-white px-2 py-2 text-xs">{reporte.estado === "resuelto" ? "Reabrir" : "Resolver"}</button><button onClick={() => setReportes((prev) => prev.filter((item) => item.id !== reporte.id))} className="grid min-h-9 place-items-center rounded-lg border border-red-200 text-red-500"><Trash2 size={14}/></button></div></div></div>)}</div>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Lightbulb size={19}/><h2 className="font-semibold">Anotador de ideas</h2></div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <input value={textoNota} onChange={(e) => setTextoNota(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarNota()} placeholder="Escribí una idea o tarea..." className="rounded-lg border px-3 py-2 text-sm" />
            <AppSelect value={categoria} onChange={setCategoria} options={["función", "error", "diseño", "otra"]}/>
            <AppSelect value={prioridad} onChange={setPrioridad} options={[{ value: "importante", label: "Importante" }, { value: "normal", label: "Normal" }, { value: "baja", label: "Baja" }]}/>
            <button onClick={agregarNota} className="flex items-center justify-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white"><Plus size={15}/>Agregar</button>
          </div>
          <div className="mt-4 space-y-2">
            {notas.length === 0 && <p className="text-sm text-gray-400">Todavía no anotaste ideas.</p>}
            {notas.map((nota) => (
              <div key={nota.id} className="flex flex-col items-stretch gap-3 rounded-lg border border-gray-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className={`${nota.estado === "terminada" ? "text-gray-400 line-through" : ""} break-words text-sm`}>{nota.texto}</p><p className="text-xs text-gray-400">{nota.categoria} · {nota.prioridad}</p></div>
                <div className="grid grid-cols-[1fr_42px] gap-2 sm:flex"><button onClick={() => setNotas((prev) => prev.map((item) => item.id === nota.id ? { ...item, estado: item.estado === "terminada" ? "pendiente" : "terminada" } : item))} className="rounded border px-2 py-2 text-xs">{nota.estado === "terminada" ? "Reabrir" : "Terminar"}</button><button onClick={() => setNotas((prev) => prev.filter((item) => item.id !== nota.id))} className="grid place-items-center rounded border border-red-200 text-red-500"><Trash2 size={14}/></button></div>
              </div>
            ))}
          </div>
        </section>
        {capturaAbierta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => setCapturaAbierta(null)}><div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}><button onClick={() => setCapturaAbierta(null)} className="absolute right-2 top-2 rounded-full bg-white p-2"><X size={18}/></button><img src={capturaAbierta} alt="Captura del problema" className="max-h-[85vh] rounded-xl bg-white object-contain"/></div></div>}
      </div>
    </div>
  );
}
