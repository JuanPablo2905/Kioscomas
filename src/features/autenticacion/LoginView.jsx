import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Download, Eye, EyeOff, Share2, ArrowLeft, Mail,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { getPwaInstallState, requestPwaInstall, subscribePwaInstall } from "../../shared/pwaInstall";
import { TERMS_VERSION } from "../../legal/terms";
import { passwordPolicyError, passwordPolicyHint } from "../../security/passwordPolicy";
import { CloudWarmupStatus } from "./CloudWarmupStatus";
const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;
const formatReferralCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 14);

export function LoginView({ onLogin, onRegister, onForgotPassword, error, notice, onReset, showDemoAccounts = false, cloudWarmupState, onRetryCloud }) {
  const [modo, setModo] = useState("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [modoNegocio, setModoNegocio] = useState("solo");
  const [referralCode, setReferralCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [installState, setInstallState] = useState(getPwaInstallState);
  const [installHelp, setInstallHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => subscribePwaInstall(setInstallState), []);

  const handleSubmit = async () => {
    if (submitting) return;
    setFormError("");
    setSubmitting(true);
    try {
      if (modo === "login") {
        await onLogin({ usuario, password });
      } else if (modo === "recuperar") {
        if (!email.trim()) return;
        await onForgotPassword({ email: email.trim() });
      } else {
        if (!nombre.trim() || !email.trim() || !usuario.trim() || !password.trim() || !nombreNegocio.trim()) return;
        const policyError = passwordPolicyError(password);
        if (policyError) return setFormError(policyError);
        if (password !== passwordConfirmation) return setFormError("Las dos contraseñas no coinciden.");
        if (!termsAccepted) {
          setTermsError("Tenés que leer y aceptar los Términos y Condiciones para crear la cuenta.");
          return;
        }
        const result = await onRegister({
          nombre: nombre.trim(),
          email: email.trim(),
          usuario: usuario.trim(),
          password,
          nombreNegocio: nombreNegocio.trim(),
          modoNegocio,
          referralCode,
          termsAccepted: true,
          termsVersion: TERMS_VERSION,
        });
        if (result?.ok) {
          setModo("login");
          setPassword("");
          setPasswordConfirmation("");
          setTermsAccepted(false);
          setTermsError("");
        }
      }
    } finally {
      setSubmitting(false);
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
            : modo === "recuperar"
              ? "Te enviaremos un enlace seguro para crear una contraseña nueva."
              : "Creá una cuenta para un nuevo local."}
        </p>

        <CloudWarmupStatus state={cloudWarmupState} onRetry={onRetryCloud} className="mb-4"/>

        {modo === "recuperar" ? <button type="button" onClick={() => setModo("login")} className="mb-5 flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C4A44]"><ArrowLeft size={16}/>Volver al inicio de sesión</button> : <div className="mb-5 grid grid-cols-2 gap-2">
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
        </div>}

        {modo === "recuperar" && <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
          <div className="mb-1 flex items-center gap-2 font-bold"><Mail size={15}/>Recuperación segura</div>
          Si el correo está asociado a una cuenta, vas a recibir un botón con un enlace de uso único. Nunca te enviaremos una contraseña por correo.
        </div>}

        {modo === "registro" && (
          <>
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Vas a poder entrar enseguida: la beta incluye 30 días de prueba sin cargo ni tarjeta. Si ya tenés una cuenta, volvé a Iniciar sesión.
            </div>
            <label className="text-sm text-gray-700 block mb-1">Tu nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
            />
            <label className="text-sm text-gray-700 block mb-1" htmlFor="registration-email">Correo electrónico</label>
            <input
              id="registration-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="nombre@correo.com"
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
            <label className="block text-sm text-gray-700" htmlFor="registration-referral-code">Código de referido <span className="text-gray-400">(opcional)</span></label>
            <input
              id="registration-referral-code"
              value={referralCode}
              onChange={(event) => setReferralCode(formatReferralCode(event.target.value))}
              autoComplete="off"
              spellCheck="false"
              placeholder="Ej.: KIOS-ABC123"
              className="mb-1 mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm font-semibold uppercase"
            />
            <p className="mb-4 text-xs leading-relaxed text-gray-500">Si otro comercio te recomendó Kiosco+, ingresá acá su código.</p>
          </>
        )}

        {modo === "recuperar" ? <>
          <label className="text-sm text-gray-700 block mb-1" htmlFor="recovery-email">Correo electrónico</label>
          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
            autoComplete="email"
            placeholder="nombre@correo.com"
            className="mb-4 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
          />
        </> : <>
          <label className="text-sm text-gray-700 block mb-1">Usuario</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
          />
          <label className="text-sm text-gray-700 block mb-1">Contraseña</label>
          <div className={`${modo === "login" ? "mb-2" : "mb-1"} relative`}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
              onKeyDown={(e) => e.key === "Enter" && modo === "login" && handleSubmit()}
              autoComplete={modo === "registro" ? "new-password" : "current-password"}
              className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-base sm:text-sm"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-gray-500">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          {modo === "registro" && <>
            <p className="mb-3 text-xs leading-5 text-gray-500">{passwordPolicyHint}</p>
            <label className="mb-1 block text-sm text-gray-700" htmlFor="registration-password-confirmation">Repetir contraseña</label>
            <input id="registration-password-confirmation" type={showPassword ? "text" : "password"} value={passwordConfirmation} onChange={(event) => { setPasswordConfirmation(event.target.value); setFormError(""); }} onKeyDown={(event) => event.key === "Enter" && handleSubmit()} autoComplete="new-password" className="mb-4 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"/>
          </>}
          {modo === "login" && <button type="button" onClick={() => setModo("recuperar")} className="mb-4 block text-left text-xs font-semibold text-[#1C4A44] underline underline-offset-2">Olvidé mi contraseña</button>}
        </>}

        {modo === "registro" && <div className="mb-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsAccepted(event.target.checked); if (event.target.checked) setTermsError(""); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1C4A44]"/>
            <span>Leí y acepto los <a href="./terminos.html" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1C4A44] underline">Términos y Condiciones de Uso</a> (versión {TERMS_VERSION}) y conozco la <a href="./privacidad.html" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1C4A44] underline">Política de Privacidad</a>.</span>
          </label>
          {termsError && <p className="mt-2 text-xs text-red-500">{termsError}</p>}
        </div>}

        {(formError || error) && <p className="text-xs text-red-500 mb-3">{formError || error}</p>}
        {notice && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs leading-5 text-green-800">{notice}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="brand-cta min-h-11 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? (modo === "recuperar" ? "Enviando..." : "Conectando...") : modo === "login" ? "Entrar" : modo === "recuperar" ? "Enviar enlace de recuperación" : "Enviar solicitud"}
        </button>

        {!installState.standalone && <div className="pwa-install-card mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900">
          <button type="button" onClick={async () => {
            if (!installState.canInstall) return setInstallHelp((value) => !value);
            const result = await requestPwaInstall();
            if (result.outcome !== "accepted") setInstallHelp(true);
          }} className="flex min-h-10 w-full items-center justify-center gap-2 text-sm font-semibold"><Download size={16}/>Instalar Kiosco+ en este celular</button>
          <p className="mt-1 text-center text-[11px] leading-relaxed opacity-75">Queda con su ícono y se actualiza automáticamente.</p>
          {installHelp && <div className="mt-2 space-y-1 border-t border-current/15 pt-2 text-xs leading-relaxed"><p><Share2 size={14} className="mr-1 inline"/><b>iPhone:</b> abrí esta página en Safari, tocá Compartir y después Agregar a inicio.</p><p><b>Android:</b> abrí el menú del navegador y elegí Instalar aplicación o Agregar a pantalla principal.</p></div>}
        </div>}

        {showDemoAccounts && <p className="text-xs text-gray-400 mt-4 text-center">
          Cuentas de prueba:
          <br />
          <b>demo</b>/<b>1234</b> — vos, Administrador de la app
          <br />
          <b>sur</b>/<b>1234</b> — Dueña de Kiosco Sur
          <br />
          <b>lucia</b>/<b>1234</b> — Cajera de Mi Negocio de Pruebas
        </p>}

        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <div className="mb-3 flex flex-wrap justify-center gap-3 text-xs font-medium text-gray-500"><a href="./terminos.html" target="_blank" rel="noopener noreferrer" className="underline">Términos y Condiciones</a><a href="./privacidad.html" target="_blank" rel="noopener noreferrer" className="underline">Privacidad</a></div>
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
