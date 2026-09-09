import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

export function PasswordResetView({ onSubmit, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (password.length < 8) return setError("Usá al menos 8 caracteres.");
    if (password.length > 128) return setError("La contraseña no puede superar los 128 caracteres.");
    if (password !== confirmation) return setError("Las dos contraseñas no coinciden.");
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(password);
      setCompleted(true);
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      setError(requestError?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="login-screen flex min-h-screen w-full items-center justify-center bg-gray-50 p-3">
    <div className="login-card w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex justify-center"><img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[230px] object-contain"/></div>
      {completed ? <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-green-700"><CheckCircle2 size={29}/></span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">Contraseña actualizada</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">La contraseña anterior y las sesiones que estaban abiertas dejaron de ser válidas. Ya podés ingresar con la nueva.</p>
        <button type="button" onClick={() => onDone({ completed: true })} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white"><ArrowLeft size={17}/>Volver a iniciar sesión</button>
      </div> : <>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><KeyRound size={24}/></span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">Creá una contraseña nueva</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">El enlace funciona una sola vez. Cuando guardes el cambio, las sesiones anteriores se cerrarán por seguridad.</p>
        <label className="mt-6 block text-sm font-medium text-gray-700" htmlFor="new-password">Contraseña nueva</label>
        <input id="new-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none focus:border-[#1C4A44] focus:ring-2 focus:ring-[#1C4A44]/20"/>
        <p className="mt-1 text-xs text-gray-400">Entre 8 y 128 caracteres.</p>
        <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="confirm-new-password">Repetir contraseña</label>
        <input id="confirm-new-password" type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} onKeyDown={(event) => event.key === "Enter" && submit()} autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none focus:border-[#1C4A44] focus:ring-2 focus:ring-[#1C4A44]/20"/>
        {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">{error}</p>}
        <button type="button" onClick={submit} disabled={submitting} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"><ShieldCheck size={17}/>{submitting ? "Actualizando..." : "Guardar contraseña nueva"}</button>
        <button type="button" onClick={() => onDone({ completed: false })} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 text-xs font-semibold text-gray-500"><ArrowLeft size={15}/>Cancelar y volver</button>
      </>}
    </div>
  </div>;
}
