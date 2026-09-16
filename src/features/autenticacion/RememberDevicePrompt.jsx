import React, { useEffect, useState } from "react";
import { Fingerprint, KeyRound, X } from "lucide-react";
import { isBiometricSupported, registerBiometric, rememberAccount } from "../../security/deviceVault";

const pinPattern = /^\d{4,8}$/;

// Se muestra una sola vez, justo después de un inicio de sesión real con
// contraseña. Nunca guarda la contraseña: pide un PIN nuevo, propio de este
// dispositivo, y recién ahí pide al servidor la credencial de dispositivo
// (ver server/cloud-server.mjs, POST /v1/auth/device-credential) para
// cifrarla localmente. La biometría es un paso opcional posterior.
export function RememberDevicePrompt({ context, registerCredential, onSkip, onSaved }) {
  const [step, setStep] = useState("ask"); // ask | pin | biometric | done
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [remembered, setRemembered] = useState(null);
  const [pendingSecret, setPendingSecret] = useState(null);

  useEffect(() => { if (step === "done") onSaved(); }, [step]);

  const savePin = async (event) => {
    event.preventDefault();
    if (!pinPattern.test(pin)) return setError("El PIN debe tener entre 4 y 8 números.");
    if (pin !== pinConfirm) return setError("Los dos PIN no coinciden.");
    setError("");
    setWorking(true);
    try {
      const { deviceCredential, username } = await registerCredential();
      const savedEntry = await rememberAccount({ ...context, username: username || context.username, deviceCredential, pin });
      setRemembered(savedEntry);
      setPendingSecret(deviceCredential);
      setStep(isBiometricSupported() ? "biometric" : "done");
    } catch (saveError) {
      setError(saveError?.message || "No se pudo recordar esta cuenta en este dispositivo.");
    } finally {
      setWorking(false);
    }
  };

  const setUpBiometric = async () => {
    setWorking(true);
    setError("");
    try {
      await registerBiometric({ id: remembered.id, rpId: context.rpId, userLabel: context.username, deviceCredential: pendingSecret });
      setStep("done");
    } catch (biometricError) {
      setError(biometricError?.message || "No se pudo configurar la biometría.");
    } finally {
      setWorking(false);
    }
  };

  if (step === "done") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
        {step === "ask" && <>
          <div className="mb-3 flex items-start justify-between"><h3 className="text-base font-black text-gray-900">¿Recordar esta cuenta acá?</h3><button type="button" onClick={onSkip} aria-label="Cerrar"><X size={18} className="text-gray-400"/></button></div>
          <p className="mb-4 text-sm leading-5 text-gray-600">La próxima vez vas a poder entrar con un PIN corto en este dispositivo, en vez de escribir la contraseña. Nunca guardamos la contraseña real.</p>
          <button type="button" onClick={() => setStep("pin")} className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white"><KeyRound size={16}/>Elegir un PIN</button>
          <button type="button" onClick={onSkip} className="flex min-h-11 w-full items-center justify-center text-sm font-semibold text-gray-500">Ahora no</button>
        </>}
        {step === "pin" && <form onSubmit={savePin}>
          <h3 className="mb-3 text-base font-black text-gray-900">Elegí un PIN</h3>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="new-pin">PIN (4 a 8 números)</label>
          <input id="new-pin" type="password" inputMode="numeric" autoFocus value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.5em]"/>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="new-pin-confirm">Repetí el PIN</label>
          <input id="new-pin-confirm" type="password" inputMode="numeric" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.5em]"/>
          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={working} className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{working ? "Guardando..." : "Guardar"}</button>
          <button type="button" onClick={onSkip} className="flex min-h-11 w-full items-center justify-center text-sm font-semibold text-gray-500">Cancelar</button>
        </form>}
        {step === "biometric" && <>
          <h3 className="mb-3 flex items-center gap-2 text-base font-black text-gray-900"><Fingerprint size={20}/>¿Usar huella o Face ID acá?</h3>
          <p className="mb-4 text-sm leading-5 text-gray-600">Vas a poder entrar sin escribir el PIN. Podés seguir usando el PIN en cualquier momento; esto no lo reemplaza.</p>
          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
          <button type="button" onClick={setUpBiometric} disabled={working} className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{working ? "Configurando..." : "Sí, activar"}</button>
          <button type="button" onClick={() => setStep("done")} className="flex min-h-11 w-full items-center justify-center text-sm font-semibold text-gray-500">Ahora no</button>
        </>}
      </div>
    </div>
  );
}
