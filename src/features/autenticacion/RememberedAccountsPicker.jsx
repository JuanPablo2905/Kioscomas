import React, { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LogIn, Trash2, Users } from "lucide-react";
import {
  forgetAccount, isBiometricSupported, listRememberedAccounts,
  renewRememberedCredential, unlockAccountWithBiometric, unlockAccountWithPin,
} from "../../security/deviceVault";
const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;

const initials = (value) => String(value || "?").trim().slice(0, 2).toUpperCase();

// Pantalla tipo "¿quién sos?" para entrar sin volver a escribir la
// contraseña: elegís tu perfil recordado en este dispositivo y ponés el PIN
// (o usás huella/Face ID si ya lo activaste). Nunca reemplaza a la
// contraseña real -- "Usar otra cuenta" siempre está disponible.
export function RememberedAccountsPicker({ apiUrl, rpId, onDeviceCredentialLogin, onPasswordLogin, passwordError, onUseAnotherAccount }) {
  const [accounts, setAccounts] = useState(() => listRememberedAccounts(apiUrl));
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const biometricSupported = isBiometricSupported();

  useEffect(() => { setPin(""); setPassword(""); setError(""); }, [selected]);
  useEffect(() => { if (selected?.requiresPassword && passwordError) { setError(passwordError); setWorking(false); } }, [passwordError]);

  if (!accounts.length) { onUseAnotherAccount(); return null; }

  const refresh = () => setAccounts(listRememberedAccounts(apiUrl));

  const complete = async (entry, deviceCredential, unlockMaterialBytes, biometric) => {
    setWorking(true);
    try {
      const nextSecret = await onDeviceCredentialLogin(entry, deviceCredential);
      if (nextSecret) await renewRememberedCredential(entry.id, unlockMaterialBytes, nextSecret, { biometric });
    } catch (loginError) {
      setError(loginError?.message || "No se pudo entrar con esta cuenta recordada.");
      setWorking(false);
      return;
    }
    setWorking(false);
  };

  const tryBiometric = async (entry) => {
    setError("");
    setWorking(true);
    try {
      const { deviceCredential, unlockMaterialBytes } = await unlockAccountWithBiometric(entry.id, rpId);
      await complete(entry, deviceCredential, unlockMaterialBytes, true);
    } catch (biometricError) {
      setWorking(false);
      setError(biometricError?.message || "No se pudo verificar la biometría. Usá el PIN.");
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!selected || working || !password) return;
    setError("");
    setWorking(true);
    await onPasswordLogin(selected, password);
    // Si falló, la app avisa por "passwordError" (ver useEffect); si funcionó,
    // esta pantalla ya no se vuelve a mostrar.
  };

  const submitPin = async (event) => {
    event.preventDefault();
    if (!selected || working) return;
    setError("");
    setWorking(true);
    try {
      const { deviceCredential } = await unlockAccountWithPin(selected.id, pin);
      await complete(selected, deviceCredential, new TextEncoder().encode(pin), false);
    } catch (pinError) {
      setWorking(false);
      setPin("");
      if (pinError?.forgotten) refresh();
      setError(pinError?.message || "PIN incorrecto.");
    }
  };

  const forget = (id) => {
    forgetAccount(id);
    setSelected(null);
    refresh();
  };

  return (
    <div className="login-screen flex min-h-screen w-full items-center justify-start bg-gray-50 sm:justify-center">
      <div className="login-card w-full max-w-sm min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-2 flex justify-center"><img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[230px] object-contain object-left"/></div>
        <p className="mb-5 text-sm text-gray-500">{!selected ? "¿Quién va a usar Kiosco+ ahora?" : selected.requiresPassword ? "Esta cuenta pide la contraseña real por seguridad." : "Ingresá tu PIN para entrar."}</p>

        {!selected ? <div className="space-y-2">
          {accounts.map((account) => (
            <button key={account.id} type="button" onClick={() => setSelected(account)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1C4A44] text-sm font-black text-white">{initials(account.nombre || account.username)}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm text-gray-900">{account.nombre || account.username}</b>
                <span className="block truncate text-xs text-gray-500">{account.nombreNegocio ? `${account.nombreNegocio} · ` : ""}{account.rol}</span>
              </span>
              {account.requiresPassword ? <KeyRound size={18} className="shrink-0 text-gray-400"/> : account.hasBiometric && <Fingerprint size={18} className="shrink-0 text-gray-400"/>}
            </button>
          ))}
          <button type="button" onClick={onUseAnotherAccount} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50"><Users size={16}/>Usar otra cuenta</button>
        </div> : <form onSubmit={selected.requiresPassword ? submitPassword : submitPin}>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1C4A44] text-sm font-black text-white">{initials(selected.nombre || selected.username)}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm text-gray-900">{selected.nombre || selected.username}</b><span className="block truncate text-xs text-gray-500">{selected.nombreNegocio ? `${selected.nombreNegocio} · ` : ""}{selected.rol}</span></span>
          </div>
          {selected.requiresPassword ? <>
            <label className="mb-1 block text-sm text-gray-700" htmlFor="remembered-password">Contraseña</label>
            <input
              id="remembered-password" type="password" autoComplete="current-password" autoFocus
              value={password} onChange={(event) => setPassword(event.target.value)}
              className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm"
            />
          </> : <>
            <label className="mb-1 block text-sm text-gray-700" htmlFor="remembered-pin">PIN</label>
            <input
              id="remembered-pin" type="password" inputMode="numeric" autoComplete="off" autoFocus
              value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              className="mb-3 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.5em]"
            />
          </>}
          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={working || (selected.requiresPassword ? !password : pin.length < 4)} className="brand-cta mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"><LogIn size={16}/>{working ? "Entrando..." : "Entrar"}</button>
          {!selected.requiresPassword && selected.hasBiometric && biometricSupported && <button type="button" onClick={() => tryBiometric(selected)} disabled={working} className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-60"><Fingerprint size={16}/>Usar huella o Face ID</button>}
          <div className="mt-3 flex items-center justify-between text-xs">
            <button type="button" onClick={() => setSelected(null)} className="font-semibold text-gray-500 underline">Volver</button>
            <button type="button" onClick={() => forget(selected.id)} className="flex items-center gap-1 font-semibold text-red-500 underline"><Trash2 size={13}/>Olvidar esta cuenta</button>
          </div>
        </form>}
        {!selected && <p className="mt-4 flex items-center justify-center gap-1 text-center text-[11px] leading-relaxed text-gray-400"><KeyRound size={12}/>El PIN sólo funciona en este dispositivo.</p>}
      </div>
    </div>
  );
}
