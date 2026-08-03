import React, { useMemo, useState } from "react";
import { Barcode, Bug, CheckCircle2, Cloud, Clock, Lightbulb, Pencil, Plus, Settings2, Shield, Store, Trash2, X, XCircle } from "lucide-react";
import { SectionHeader } from "../../shared/layout";
import { secureSubject } from "../../security/auth";
import { canAccessAccount, formatTrialExpiration, grantTrialAccess, trialAccessStatus } from "../../security/trialAccess";
import { AppSelect, ConfirmDialog } from "../../shared/controls";
import { BarcodeCatalogAdmin } from "./BarcodeCatalogAdmin";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

const ESTADOS = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobada: "bg-green-100 text-green-700",
  bloqueada: "bg-red-100 text-red-700",
};

function TrialStatus({ account }) {
  if (account.estado === "aprobada") return null;
  const trial = trialAccessStatus(account);
  if (trial.active) return <p className="mt-1 text-xs font-medium text-amber-700">Prueba activa · vence {formatTrialExpiration(account)}</p>;
  if (trial.reason === "expired") return <p className="mt-1 text-xs font-medium text-red-600">Prueba vencida · conserva todos sus datos</p>;
  return <p className="mt-1 text-xs text-gray-500">Sin acceso temporal activo</p>;
}

export function AdminAppPanel({ cuentas, setCuentas, datos, setDatos, notas, setNotas, reportes = [], setReportes, onOpenNegocio, onLogout, onOpenSettings, syncStatus, onSyncNow }) {
  const [textoNota, setTextoNota] = useState("");
  const [prioridad, setPrioridad] = useState("normal");
  const [categoria, setCategoria] = useState("función");
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({});
  const [capturaAbierta, setCapturaAbierta] = useState(null);
  const [cuentaABorrarId, setCuentaABorrarId] = useState(null);
  const negocios = useMemo(() => cuentas.filter((cuenta) => !cuenta.superAdmin), [cuentas]);

  const actualizarCuenta = (id, cambios) =>
    setCuentas((prev) => prev.map((cuenta) => cuenta.id === id ? { ...cuenta, ...cambios } : cuenta));

  const guardarCuenta = async (cuenta) => {
    const cambios = { nombre: form.nombre, nombreNegocio: form.nombreNegocio, usuario: form.usuario };
    if (form.password?.trim()) Object.assign(cambios, await secureSubject({ password: form.password.trim() }));
    actualizarCuenta(cuenta.id, cambios);
    setEditandoId(null);
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
    aprobadas: negocios.filter((cuenta) => cuenta.estado === "aprobada").length,
    pendientes: negocios.filter((cuenta) => cuenta.estado === "pendiente").length,
    bloqueadas: negocios.filter((cuenta) => cuenta.estado === "bloqueada").length,
  };

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

        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Negocios', negocios.length, Store], ['Aprobados', totales.aprobadas, CheckCircle2], ['Pendientes', totales.pendientes, Clock], ['Bloqueados', totales.bloqueadas, XCircle]].map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4"><Icon size={18} className="mb-3 text-gray-500"/><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
          ))}
        </div>

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Shield size={19}/><h2 className="font-semibold">Administrador de cuentas</h2></div>
          <div className="space-y-3">
            {negocios.map((cuenta) => (
              <div key={cuenta.id} className="rounded-xl border border-gray-200 p-4">
                {editandoId === cuenta.id ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Responsable" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.nombreNegocio || ""} onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })} placeholder="Negocio" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.usuario || ""} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Usuario" className="rounded-lg border px-3 py-2 text-sm" />
                    <input value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Contraseña" className="rounded-lg border px-3 py-2 text-sm" />
                    <div className="grid grid-cols-2 gap-2 md:col-span-4 md:flex"><button onClick={() => guardarCuenta(cuenta)} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">Guardar</button><button onClick={() => setEditandoId(null)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button></div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{cuenta.nombreNegocio}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADOS[cuenta.estado] || ESTADOS.pendiente}`}>{cuenta.estado || "pendiente"}</span></div><p className="mt-1 text-sm text-gray-500">{cuenta.nombre} · @{cuenta.usuario} · {(cuenta.empleados || []).length} empleado(s)</p><TrialStatus account={cuenta}/></div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <button onClick={() => onOpenNegocio(cuenta.id)} disabled={!canAccessAccount(cuenta)} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-30">Entrar</button>
                      {cuenta.estado !== "aprobada" && <><button onClick={() => actualizarCuenta(cuenta.id, grantTrialAccess(cuenta, 1))} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800">Dar 1 día</button><button onClick={() => actualizarCuenta(cuenta.id, grantTrialAccess(cuenta, 7))} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800">Dar 1 semana</button></>}
                      <button onClick={() => actualizarCuenta(cuenta.id, { estado: "aprobada", approvedAt: new Date().toISOString() })} className="rounded-lg border border-green-300 px-3 py-2 text-xs text-green-700">Aprobar</button>
                      <button onClick={() => actualizarCuenta(cuenta.id, { estado: "bloqueada" })} className="rounded-lg border border-amber-300 px-3 py-2 text-xs text-amber-700">Bloquear</button>
                      <button onClick={() => { setEditandoId(cuenta.id); setForm({ nombre: cuenta.nombre, nombreNegocio: cuenta.nombreNegocio, usuario: cuenta.usuario, password: "" }); }} className="rounded-lg border px-3 py-2 text-gray-500"><Pencil size={14}/></button>
                      <button onClick={() => setCuentaABorrarId(cuenta.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-1 flex items-center gap-2"><Barcode size={20}/><h2 className="font-semibold">Catalogo del escaner</h2></div>
          <p className="mb-4 text-sm text-gray-500">Revisa los codigos buscados, completa productos desconocidos y corrige nombres, categorias o imagenes para todos los negocios.</p>
          <BarcodeCatalogAdmin/>
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
