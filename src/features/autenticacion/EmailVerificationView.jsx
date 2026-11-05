import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

export function EmailVerificationView({ onVerify, onDone }) {
  const [status, setStatus] = useState("working");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    onVerify()
      .then(() => { if (active) setStatus("done"); })
      .catch((verifyError) => {
        if (!active) return;
        setError(verifyError?.message || "No se pudo confirmar el correo.");
        setStatus("error");
      });
    return () => { active = false; };
  }, []);

  return <div className="login-screen flex min-h-screen w-full items-center justify-center bg-gray-50 p-3">
    <div className="login-card w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex justify-center"><img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[230px] object-contain"/></div>
      {status === "working" && <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Loader2 size={29} className="animate-spin"/></span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">Confirmando tu correo...</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">Esto tarda sólo un segundo.</p>
      </div>}
      {status === "done" && <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-green-700"><CheckCircle2 size={29}/></span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">Correo confirmado</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">Ya podés iniciar sesión con tu usuario y contraseña. Arrancás con 30 días de prueba sin cargo.</p>
        <button type="button" onClick={onDone} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white"><ShieldCheck size={17}/>Ir a iniciar sesión</button>
      </div>}
      {status === "error" && <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle size={29}/></span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">No pudimos confirmar tu correo</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{error}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">Si el enlace venció, iniciá sesión y pedí que te reenviemos uno nuevo.</p>
        <button type="button" onClick={onDone} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"><ArrowLeft size={17}/>Volver a iniciar sesión</button>
      </div>}
    </div>
  </div>;
}
