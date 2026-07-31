import React, { useState } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Bug, Camera,
} from "lucide-react";
import { HOME_CARDS, money } from "../../shared/domain";
import { permisosDe } from "../../app/data";
import { isWithinRange } from "../../shared/dateRanges";

function DashboardCard({ icon: Icon, label, value, sub, tono, onClick }) {
  const tonos = {
    verde: "text-green-600",
    rojo: "text-red-600",
    ambar: "text-amber-600",
    gris: "text-gray-900",
  };
  return (
    <button
      onClick={onClick}
      className="home-metric-card min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-400 hover:shadow-sm"
    >
      <Icon size={17} className="text-gray-400 mb-2" />
      <p className={`break-words text-xl font-bold tabular-nums ${tonos[tono] || "text-gray-900"}`}>{value}</p>
      <p className="mt-0.5 break-words text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-1 break-words text-[11px] text-gray-400">{sub}</p>}
    </button>
  );
}

export function ReportarProblemaModal({ onClose, onSubmit, onCapture, canSystemCapture = false, initialCapture = null, errorContext = "" }) {
  const [descripcion, setDescripcion] = useState("");
  const [captura, setCaptura] = useState(initialCapture);
  const [captureSource, setCaptureSource] = useState(initialCapture ? "automatic" : null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const selectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError("La captura debe ser una imagen de hasta 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1400 / image.width, 900 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setCaptura(canvas.toDataURL("image/jpeg", 0.76));
        setCaptureSource("manual");
        setError("");
      };
      image.onerror = () => setError("No se pudo procesar la captura.");
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const takeScreenshot = async () => {
    if (!onCapture || capturing) return;
    setCapturing(true);
    setError("");
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const nextCapture = await onCapture();
    if (nextCapture) {
      setCaptura(nextCapture);
      setCaptureSource("automatic");
    }
    else setError("No se pudo sacar la captura automáticamente. Podés subirla manualmente.");
    setCapturing(false);
  };
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-2 sm:p-4 ${capturing ? "invisible" : ""}`} role="dialog" aria-modal="true" aria-labelledby="report-problem-title">
      <div
        className="w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl bg-white p-4 sm:p-6"
        style={{ maxHeight: "calc(var(--app-viewport-height, 100dvh) - 1rem)" }}
      >
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="report-problem-title" className="break-words text-lg font-bold">Reportar un problema</h2>
            <p className="break-words text-xs text-gray-500">El reporte llegará al administrador de Kiosco+.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-gray-100"><X size={20}/></button>
        </div>
        <textarea autoFocus rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Contá qué estabas haciendo y qué salió mal..." className="w-full resize-y rounded-lg border p-3 text-base sm:text-sm"/>
        {errorContext && <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">También se adjuntarán los datos técnicos de la pantalla que falló.</p>}
        {!captura && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Antes de enviar el reporte, sacá una captura de pantalla.</b><p className="mt-1 text-xs">Después subila con el botón de abajo para que podamos ver exactamente qué sucedió.</p></div>}
        <div className={`mt-3 grid gap-2 ${canSystemCapture ? "sm:grid-cols-2" : ""}`}>
          {canSystemCapture && <button type="button" onClick={takeScreenshot} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center text-sm text-gray-600"><Camera size={17} className="shrink-0"/><span className="min-w-0 break-words">{captura ? "Sacar otra captura" : "Sacar captura ahora"}</span></button>}
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center text-sm text-gray-600"><Camera size={17} className="shrink-0"/><span className="min-w-0 break-words">{captura ? "Cambiar archivo" : "Subir captura de pantalla"}</span><input type="file" accept="image/*" onChange={selectImage} className="hidden"/></label>
        </div>
        {captura && <div className="mt-3"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-medium text-green-700">{captureSource === "automatic" ? "Captura tomada automáticamente" : "Captura adjunta"}</span><button onClick={() => { setCaptura(null); setCaptureSource(null); }} className="min-h-10 text-xs text-red-600">Quitar captura</button></div><img src={captura} alt="Captura adjunta" className="max-h-48 w-full rounded-lg border object-contain"/></div>}
        {error && <p className="mt-2 break-words text-xs text-red-600">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="min-h-11 min-w-0 rounded-lg border px-2 py-2 text-sm">Cancelar</button>
          <button disabled={!descripcion.trim()} onClick={() => onSubmit({ descripcion: descripcion.trim(), captura, detalleTecnico: errorContext })} className="min-h-11 min-w-0 rounded-lg bg-red-600 px-2 py-2 text-sm font-medium text-white disabled:opacity-40">Enviar reporte</button>
        </div>
      </div>
    </div>
  );
}

export function Home({ onNavigate, cuenta, identidad, data, onReportProblem }) {
  const hour = new Date().getHours();
  const saludo = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const permisos = permisosDe(identidad, cuenta);
  const cardsVisibles = HOME_CARDS.filter((card) => permisos.includes(card.id));

  const stockBajo = (data?.products || []).filter((p) => p.deposito <= p.minimo);
  const reposicionVitrina = (data?.products || []).filter(
    (p) => p.vitrina <= p.alertaVitrina
  );
  const valorStock = (data?.products || []).reduce(
    (sum, p) => sum + p.deposito * p.costo,
    0
  );
  const ventasHoy = (data?.tickets || [])
    .filter((t) => isWithinRange(t.fecha, "Hoy"))
    .reduce((sum, t) => sum + t.total, 0);
  const ticketsHoy = (data?.tickets || []).filter((t) =>
    isWithinRange(t.fecha, "Hoy")
  ).length;

  return (
    <div data-tour="home-summary" className="min-w-0 p-4 sm:p-8">
      <h1 className="mb-1 break-words text-2xl font-bold text-gray-900">
        {saludo}, {identidad?.nombre || cuenta?.nombre}
      </h1>
      <p className="mb-6 break-words text-sm text-gray-500">
        {cuenta?.nombreNegocio}
        {identidad?.rol && identidad.rol !== "Dueño" ? ` · ${identidad.rol}` : ""}{" "}
        · ¿Qué querés hacer hoy?
      </p>

      {data && (
        <div className="home-card-grid home-metrics-grid grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {permisos.includes("ventas") && (
            <DashboardCard
              icon={Lock}
              label="Caja"
              value={data.cajaAbierta ? "Abierta" : "Cerrada"}
              sub={data.cajaAbierta ? money(data.caja.saldo) : null}
              tono={data.cajaAbierta ? "verde" : "gris"}
              onClick={() => onNavigate("ventas")}
            />
          )}
          {permisos.includes("ventas") && (
            <DashboardCard
              icon={ShoppingCart}
              label="Ventas de hoy"
              value={money(ventasHoy)}
              sub={`${ticketsHoy} ticket(s)`}
              tono="verde"
              onClick={() => onNavigate("reportes")}
            />
          )}
          {permisos.includes("stock") && (
            <DashboardCard
              icon={AlertTriangle}
              label="Productos críticos"
              value={stockBajo.length}
              sub="Stock bajo en depósito"
              tono={stockBajo.length > 0 ? "rojo" : "gris"}
              onClick={() => onNavigate("stock")}
            />
          )}
          {permisos.includes("vitrina") && (
            <DashboardCard
              icon={Bell}
              label="Reponer vitrina"
              value={reposicionVitrina.length}
              sub="Productos por debajo del umbral"
              tono={reposicionVitrina.length > 0 ? "ambar" : "gris"}
              onClick={() => onNavigate("vitrina")}
            />
          )}
          {permisos.includes("stock") && (
            <DashboardCard
              icon={Package}
              label="Valor del stock"
              value={money(valorStock)}
              sub="Depósito, a precio de costo"
              tono="gris"
              onClick={() => onNavigate("stock")}
            />
          )}
        </div>
      )}

      <div className="home-card-grid home-actions-grid grid grid-cols-2 md:grid-cols-4 gap-4">
        {cardsVisibles.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="home-action-card min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-gray-400 hover:shadow-sm"
            >
              <Icon size={22} className="text-gray-900 mb-4" />
              <p className="break-words font-semibold text-gray-900">{card.title}</p>
              <p className="mt-0.5 break-words text-sm text-gray-500">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
