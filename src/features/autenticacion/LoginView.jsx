import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Download, Share2,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

export function LoginView({ onLogin, onRegister, error, onReset }) {
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [modoNegocio, setModoNegocio] = useState("solo");
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installHelp, setInstallHelp] = useState(false);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  useEffect(() => {
    const capture = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const handleSubmit = () => {
    if (modo === "login") {
      onLogin({ usuario, password });
    } else {
      if (!nombre.trim() || !usuario.trim() || !password.trim() || !nombreNegocio.trim())
        return;
      onRegister({
        nombre: nombre.trim(),
        usuario: usuario.trim(),
        password,
        nombreNegocio: nombreNegocio.trim(),
        modoNegocio,
      });
    }
  };

  return (
    <div className="login-screen flex min-h-screen w-full items-center justify-start bg-gray-50 sm:justify-center">
      <div className="login-card w-full max-w-sm min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="login-brand-intro mb-2 flex justify-center">
          <img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[230px] object-contain object-left" />
        </div>
        <p className="mb-3 text-sm font-medium text-[#1C4A44]">Tu negocio, bajo control</p>
        <p className="text-sm text-gray-500 mb-5">
          {modo === "login"
            ? "Iniciá sesión para entrar a tu negocio."
            : "Creá una cuenta para un nuevo local."}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => setModo("login")}
            className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-sm font-medium ${
              modo === "login"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => setModo("registro")}
            className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-sm font-medium ${
              modo === "registro"
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {modo === "registro" && (
          <>
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Al crearla vas a poder usar la cuenta durante <b>1 día</b> mientras espera aprobación. El administrador puede extender la prueba a una semana.
            </div>
            <label className="text-sm text-gray-700 block mb-1">Tu nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
            />
            <label className="text-sm text-gray-700 block mb-1">
              Nombre del negocio / local
            </label>
            <input
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              placeholder="Ej: Kiosco Don Juan - Sucursal Centro"
              className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
            />
            <label className="text-sm text-gray-700 block mb-2">¿Cómo trabajás?</label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoNegocio("solo")}
                className={`min-h-20 rounded-xl border p-3 text-left ${modoNegocio === "solo" ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-gray-200 bg-white"}`}
              >
                <b className="block text-sm text-gray-900">Trabajo solo</b>
                <span className="mt-1 block text-xs text-gray-500">Oculta empleados, roles y turnos.</span>
              </button>
              <button
                type="button"
                onClick={() => setModoNegocio("equipo")}
                className={`min-h-20 rounded-xl border p-3 text-left ${modoNegocio === "equipo" ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-gray-200 bg-white"}`}
              >
                <b className="block text-sm text-gray-900">Tengo empleados</b>
                <span className="mt-1 block text-xs text-gray-500">Habilita usuarios, roles y turnos.</span>
              </button>
            </div>
          </>
        )}

        <label className="text-sm text-gray-700 block mb-1">Usuario</label>
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
        />
        <label className="text-sm text-gray-700 block mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="mb-4 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          className="brand-cta min-h-11 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          {modo === "login" ? "Entrar" : "Crear cuenta y entrar"}
        </button>

        {!standalone && <div className="pwa-install-card mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900">
          <button type="button" onClick={async () => { if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); } else setInstallHelp((value) => !value); }} className="flex min-h-10 w-full items-center justify-center gap-2 text-sm font-semibold"><Download size={16}/>Instalar en este celular</button>
          {installHelp && <p className="mt-2 text-xs leading-relaxed"><Share2 size={14} className="mr-1 inline"/>En iPhone: abrí esta página en Safari, tocá <b>Compartir</b> y después <b>Agregar a inicio</b>.</p>}
        </div>}

        <p className="text-xs text-gray-400 mt-4 text-center">
          Cuentas de prueba:
          <br />
          <b>demo</b>/<b>1234</b> — vos, Administrador de la app
          <br />
          <b>sur</b>/<b>1234</b> — Dueña de Kiosco Sur
          <br />
          <b>lucia</b>/<b>1234</b> — Cajera de Mi Negocio de Pruebas
        </p>

        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          {!confirmarReset ? (
            <button
              onClick={() => setConfirmarReset(true)}
              className="text-xs text-gray-400 hover:text-red-500 underline"
            >
              Borrar todos los datos guardados
            </button>
          ) : (
            <div>
              <p className="text-xs text-red-500 mb-2">
                Esto borra TODAS las cuentas y datos guardados en este
                navegador. No se puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmarReset(false)}
                  className="min-h-10 rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onReset}
                  className="min-h-10 rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                >
                  Sí, borrar todo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
