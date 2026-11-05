import React, { useState } from "react";
import {
  Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Bug, Camera,
} from "lucide-react";
import { HOME_CARDS, money } from "../../shared/domain";
import { permisosDe } from "../../app/data";
import { isWithinRange } from "../../shared/dateRanges";

const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ventasUltimos7Dias(tickets) {
  return Array.from({ length: 7 }, (_, idx) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - idx));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const total = (tickets || [])
      .filter((t) => { const fecha = new Date(t.fecha); return fecha >= day && fecha < next; })
      .reduce((sum, t) => sum + t.total, 0);
    return { label: WEEKDAY_SHORT[day.getDay()], total, isToday: idx === 6 };
  });
}

function VentasChart({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.total));
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Ventas · últimos 7 días</span>
      <div className="mt-3 flex h-32 items-end gap-1.5 sm:h-40 sm:gap-2">
        {dias.map((d, idx) => (
          <div key={idx} className="flex h-full flex-1 flex-col items-stretch justify-end">
            <div
              className={`sensitive-value w-full rounded-t-md ${d.isToday ? "" : "bg-gray-200"}`}
              style={{ height: `${Math.max(4, Math.round((d.total / max) * 100))}%`, background: d.isToday ? "var(--app-accent)" : undefined }}
              title={`${d.isToday ? "Hoy" : d.label}: ${money(d.total)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {dias.map((d, idx) => (
          <span key={idx} className={`flex-1 truncate text-center text-[10px] ${d.isToday ? "font-bold text-gray-900" : "text-gray-400"}`}>{d.isToday ? "Hoy" : d.label}</span>
        ))}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-center text-[12.5px] font-bold transition-transform active:scale-[0.98] sm:text-[13px]"
      style={{ background: "var(--app-accent)", color: "var(--app-accent-text, #fff)" }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}

function AccessTile({ icon: Icon, title, sub, subTone = "gray", badge, hint, onClick }) {
  const subClass = subTone === "amber" ? "font-semibold text-amber-700" : subTone === "green" ? "text-green-700" : "text-gray-500";
  return (
    <button onClick={onClick} title={hint} className="home-access-tile relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center transition-all hover:border-gray-400 hover:shadow-sm">
      {badge != null && badge > 0 && (
        <span className="absolute right-2 top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{badge}</span>
      )}
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gray-100"><Icon size={17} className="text-gray-700" /></span>
      <span className="break-words text-[12.5px] font-bold text-gray-900">{title}</span>
      {sub && <span className={`break-words text-[10.5px] ${subClass}`}>{sub}</span>}
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

  const puedeVentas = permisos.includes("ventas");
  const puedeStock = permisos.includes("stock");
  const puedeVitrina = permisos.includes("vitrina");
  const puedeGastos = permisos.includes("gastos");
  const dias = puedeVentas ? ventasUltimos7Dias(data?.tickets) : [];

  const accesosStats = {
    stock: puedeStock ? {
      sub: stockBajo.length > 0 ? `${stockBajo.length} crítico(s)` : "Sin críticos",
      tone: stockBajo.length > 0 ? "amber" : "gray",
      badge: stockBajo.length,
      hint: `Valor del stock: ${money(valorStock)}`,
    } : null,
    vitrina: puedeVitrina ? {
      sub: reposicionVitrina.length > 0 ? `${reposicionVitrina.length} para reponer` : "Al día",
      tone: reposicionVitrina.length > 0 ? "amber" : "gray",
      badge: reposicionVitrina.length,
    } : null,
    ventas: puedeVentas ? {
      sub: data?.cajaAbierta ? "Caja abierta" : "Caja cerrada",
      tone: data?.cajaAbierta ? "green" : "gray",
    } : null,
  };

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

      {data && (puedeVentas || puedeVitrina) && (
        <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[1.7fr_1fr]">
          {puedeVentas && <VentasChart dias={dias} />}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {puedeVentas && (
              <div className="flex min-w-0 flex-col justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-4">
                <div>
                  <span className="block text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Caja</span>
                  <span className={`sensitive-value block break-words text-lg font-extrabold ${data.cajaAbierta ? "text-green-600" : "text-gray-900"}`}>
                    {data.cajaAbierta ? `Abierta · ${money(data.caja.saldo)}` : "Cerrada"}
                  </span>
                </div>
                <div className="h-px bg-gray-100" />
                <div>
                  <span className="block text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Ventas de hoy</span>
                  <span className="sensitive-value block break-words text-lg font-extrabold text-gray-900">{money(ventasHoy)} · {ticketsHoy} ticket(s)</span>
                </div>
              </div>
            )}
            {puedeVitrina && (
              reposicionVitrina.length > 0 ? (
                <button onClick={() => onNavigate("vitrina")} className="flex min-w-0 flex-col justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800"><AlertTriangle size={13} />Atención</span>
                  <span className="break-words text-sm font-semibold text-gray-900">{reposicionVitrina.length} producto(s) para reponer en vitrina</span>
                  <span className="text-xs font-bold text-amber-800">Reponer vitrina &rarr;</span>
                </button>
              ) : (
                <div className="flex min-w-0 flex-col justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Vitrina</span>
                  <span className="text-sm font-semibold text-gray-700">Sin productos para reponer</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {(puedeVentas || puedeStock || puedeGastos) && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {puedeVentas && <QuickAction icon={ShoppingCart} label="Nueva venta" onClick={() => onNavigate("ventas")} />}
          {puedeVentas && <QuickAction icon={Lock} label={data?.cajaAbierta ? "Cerrar caja" : "Abrir caja"} onClick={() => onNavigate("ventas")} />}
          {puedeStock && <QuickAction icon={Plus} label="Agregar producto" onClick={() => onNavigate("stock")} />}
          {puedeGastos && <QuickAction icon={ArrowDownCircle} label="Registrar gasto" onClick={() => onNavigate("gastos")} />}
        </div>
      )}

      <div className="home-card-grid home-actions-grid grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cardsVisibles.map((card) => {
          const stat = accesosStats[card.id];
          return (
            <AccessTile
              key={card.id}
              icon={card.icon}
              title={card.title}
              sub={stat?.sub}
              subTone={stat?.tone}
              badge={stat?.badge}
              hint={stat?.hint}
              onClick={() => onNavigate(card.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
