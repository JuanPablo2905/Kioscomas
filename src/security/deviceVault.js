// Cuentas recordadas por PIN en este dispositivo.
//
// Nunca se guarda la contraseña real de la cuenta. Lo que se cifra acá es la
// "credencial de dispositivo" que emite el servidor al recordar una cuenta
// (ver server/cloud-server.mjs, POST /v1/auth/device-credential): un secreto
// aleatorio propio de este dispositivo, sin relación con la contraseña, que
// se renueva solo en cada uso. El PIN (o, si el navegador lo permite, una
// verificación biométrica vía WebAuthn) es lo único que puede descifrarla acá.
//
// Después de demasiados PIN incorrectos la cuenta se borra de este
// dispositivo -- no queda "bloqueada esperando" -- y hay que volver a iniciar
// sesión con la contraseña real para recordarla de nuevo.

const STORAGE_KEY = "kiosco_remembered_accounts_v1";
const PBKDF2_ITERATIONS = 210000;
export const MAX_PIN_ATTEMPTS = 5;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const randomBase64 = (length) => toBase64(crypto.getRandomValues(new Uint8Array(length)));

const deriveKey = async (materialBytes, saltBase64) => {
  const salt = fromBase64(saltBase64);
  const material = await crypto.subtle.importKey("raw", materialBytes, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

const encryptWith = async (materialBytes, payload) => {
  const salt = randomBase64(16);
  const iv = randomBase64(12);
  const key = await deriveKey(materialBytes, salt);
  const ciphertext = toBase64(await crypto.subtle.encrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, textEncoder.encode(JSON.stringify(payload))));
  return { salt, iv, ciphertext };
};

const decryptWith = async (materialBytes, box) => {
  const key = await deriveKey(materialBytes, box.salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(box.iv) }, key, fromBase64(box.ciphertext));
  return JSON.parse(textDecoder.decode(plain));
};

const pinBytes = (pin) => textEncoder.encode(String(pin));
const pinPattern = /^\d{4,8}$/;

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeAll = (list) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* almacenamiento no disponible en este navegador */ }
};

const accountId = (apiUrl, deviceId, username) => `${apiUrl}::${deviceId}::${String(username).toLowerCase()}`;

// Nunca devuelve el contenido de "vault"/"biometric" (son ciphertext, pero
// igual no hace falta exponerlos a la pantalla del selector de cuentas).
const toPublicEntry = ({ vault: _vault, biometric, ...visible }) => ({ ...visible, hasBiometric: !!biometric });

export const listRememberedAccounts = (apiUrl) => readAll()
  .filter((entry) => !apiUrl || entry.apiUrl === apiUrl)
  .map(toPublicEntry)
  .sort((a, b) => String(b.lastUsedAt || b.rememberedAt).localeCompare(String(a.lastUsedAt || a.rememberedAt)));

// Evita insistir con "¿recordar esta cuenta?" en cada login si ya está
// guardada o si la persona ya dijo que no en este dispositivo.
const dismissedKey = (apiUrl, deviceId, username) => `kiosco_remember_dismissed::${accountId(apiUrl, deviceId, username)}`;
export const shouldOfferToRemember = (apiUrl, deviceId, username) => {
  const id = accountId(apiUrl, deviceId, username);
  if (readAll().some((entry) => entry.id === id)) return false;
  try { return !localStorage.getItem(dismissedKey(apiUrl, deviceId, username)); } catch { return true; }
};
export const dismissRememberPrompt = (apiUrl, deviceId, username) => {
  try { localStorage.setItem(dismissedKey(apiUrl, deviceId, username), "1"); } catch { /* almacenamiento no disponible */ }
};

export const rememberAccount = async ({ apiUrl, deviceId, username, deviceCredential, pin, businessId, nombreNegocio, nombre, rol }) => {
  if (!pinPattern.test(String(pin || ""))) throw new Error("El PIN debe tener entre 4 y 8 números.");
  if (!apiUrl || !deviceId || !username || !deviceCredential) throw new Error("Faltan datos para recordar esta cuenta.");
  const id = accountId(apiUrl, deviceId, username);
  const vault = await encryptWith(pinBytes(pin), { deviceCredential });
  const entry = {
    id, apiUrl, deviceId, username, businessId: String(businessId || ""),
    nombreNegocio: String(nombreNegocio || ""), nombre: String(nombre || ""), rol: String(rol || ""),
    rememberedAt: new Date().toISOString(), lastUsedAt: null,
    vault: { ...vault, failedAttempts: 0 },
  };
  writeAll([...readAll().filter((item) => item.id !== id), entry]);
  return toPublicEntry(entry);
};

export const forgetAccount = (id) => writeAll(readAll().filter((item) => item.id !== id));

const applyEntryUpdate = (id, updater) => {
  const list = readAll();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const next = updater(list[index]);
  if (next === null) { list.splice(index, 1); writeAll(list); return null; }
  list[index] = next;
  writeAll(list);
  return next;
};

const pinAttemptError = (attemptsLeft, forgotten) => Object.assign(
  new Error(forgotten
    ? "Demasiados PIN incorrectos. Esta cuenta dejó de estar recordada en este dispositivo; iniciá sesión con tu contraseña."
    : `PIN incorrecto. Te quedan ${attemptsLeft} intento(s).`),
  { forgotten, attemptsLeft },
);

export const unlockAccountWithPin = async (id, pin) => {
  const list = readAll();
  const entry = list.find((item) => item.id === id);
  if (!entry) throw new Error("Esa cuenta ya no está recordada en este dispositivo.");
  try {
    const { deviceCredential } = await decryptWith(pinBytes(pin), entry.vault);
    applyEntryUpdate(id, (current) => ({ ...current, vault: { ...current.vault, failedAttempts: 0 }, lastUsedAt: new Date().toISOString() }));
    return { deviceCredential, entry: toPublicEntry(entry) };
  } catch {
    const failedAttempts = (entry.vault.failedAttempts || 0) + 1;
    const forgotten = failedAttempts >= MAX_PIN_ATTEMPTS;
    applyEntryUpdate(id, (current) => forgotten ? null : { ...current, vault: { ...current.vault, failedAttempts } });
    throw pinAttemptError(MAX_PIN_ATTEMPTS - failedAttempts, forgotten);
  }
};

// Se llama después de iniciar sesión con éxito (por PIN o biometría), con el
// nuevo secreto que devolvió el servidor -- rota en cada uso -- para que el
// vault local nunca quede desactualizado.
export const renewRememberedCredential = async (id, unlockMaterialBytes, deviceCredential, { biometric = false } = {}) => {
  const list = readAll();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return;
  const entry = list[index];
  const box = await encryptWith(unlockMaterialBytes, { deviceCredential });
  list[index] = biometric
    ? { ...entry, biometric: { ...entry.biometric, ...box } }
    : { ...entry, vault: { ...box, failedAttempts: 0 } };
  writeAll(list);
};

// --- Biometría opcional (WebAuthn), sólo donde el navegador lo permite ---
// Nunca reemplaza el PIN: es una forma más rápida de desbloquear el mismo
// vault en este dispositivo. Usa la extensión "prf" de WebAuthn para derivar
// material criptográfico estable a partir de una verificación biométrica del
// sistema operativo (Face ID, Touch ID, Windows Hello, huella en Android).
// El soporte de "prf" todavía varía según navegador y sistema operativo.
export const isBiometricSupported = () => typeof window !== "undefined"
  && !!window.PublicKeyCredential
  && typeof navigator?.credentials?.create === "function";

export const registerBiometric = async ({ id, rpName = "Kiosco+", rpId, userLabel, deviceCredential, pin }) => {
  if (!isBiometricSupported()) throw new Error("Este navegador o dispositivo no permite usar huella/Face ID todavía.");
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge, rp: { name: rpName, id: rpId },
      user: { id: userId, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      extensions: { prf: {} },
      timeout: 60000,
    },
  });
  if (!credential?.getClientExtensionResults?.().prf?.enabled) {
    throw new Error("Este dispositivo no soporta desbloqueo biométrico del vault todavía. Podés seguir usando el PIN.");
  }
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rpId,
      allowCredentials: [{ id: credential.rawId, type: "public-key" }],
      userVerification: "required",
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  const material = new Uint8Array(assertion.getClientExtensionResults().prf.results.first);
  const box = await encryptWith(material, { deviceCredential });
  applyEntryUpdate(id, (current) => current && {
    ...current,
    biometric: { ...box, credentialId: toBase64(credential.rawId), prfSalt: toBase64(prfSalt) },
  });
  return true;
};

export const unlockAccountWithBiometric = async (id, rpId) => {
  const entry = readAll().find((item) => item.id === id);
  if (!entry?.biometric) throw new Error("Esta cuenta todavía no tiene biometría configurada en este dispositivo.");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rpId,
      allowCredentials: [{ id: fromBase64(entry.biometric.credentialId), type: "public-key" }],
      userVerification: "required",
      extensions: { prf: { eval: { first: fromBase64(entry.biometric.prfSalt) } } },
    },
  });
  const result = assertion.getClientExtensionResults().prf?.results?.first;
  if (!result) throw new Error("No se pudo verificar la biometría. Usá el PIN.");
  const material = new Uint8Array(result);
  const { deviceCredential } = await decryptWith(material, entry.biometric);
  applyEntryUpdate(id, (current) => ({ ...current, lastUsedAt: new Date().toISOString() }));
  return { deviceCredential, entry: toPublicEntry(entry), unlockMaterialBytes: material };
};

export const forgetBiometric = (id) => applyEntryUpdate(id, (current) => {
  const { biometric: _biometric, ...rest } = current;
  return rest;
});
