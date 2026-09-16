// Stub mínimo de localStorage para poder probar el vault fuera del navegador.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const {
  rememberAccount, forgetAccount, listRememberedAccounts,
  unlockAccountWithPin, renewRememberedCredential, isBiometricSupported, MAX_PIN_ATTEMPTS,
  shouldOfferToRemember, dismissRememberPrompt,
} = await import("../src/security/deviceVault.js");

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

const base = { apiUrl: "https://api.example.com", deviceId: "caja-1", username: "Dueño", businessId: "biz-1", nombreNegocio: "Kiosco de prueba", nombre: "Ana", rol: "Dueña" };

let rejected = false;
try { await rememberAccount({ ...base, deviceCredential: "secreto-1", pin: "12" }); } catch { rejected = true; }
test("un PIN demasiado corto se rechaza antes de cifrar nada", rejected);

const remembered = await rememberAccount({ ...base, deviceCredential: "secreto-1", pin: "4821" });
test("recordar una cuenta no expone el vault cifrado en la lista pública", !("vault" in remembered) && !("biometric" in remembered));
test("la lista de cuentas recordadas muestra negocio, usuario y rol", listRememberedAccounts(base.apiUrl).some((item) => item.nombreNegocio === "Kiosco de prueba" && item.username === "Dueño" && item.rol === "Dueña"));

const wrongPin = await unlockAccountWithPin(remembered.id, "0000").catch((error) => error);
test("un PIN incorrecto no revela la credencial del dispositivo", wrongPin instanceof Error && wrongPin.attemptsLeft === MAX_PIN_ATTEMPTS - 1);

const unlocked = await unlockAccountWithPin(remembered.id, "4821");
test("el PIN correcto recupera exactamente la credencial guardada", unlocked.deviceCredential === "secreto-1");

let attemptsLeftSeen = [];
for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS - 1; attempt += 1) {
  const error = await unlockAccountWithPin(remembered.id, "9999").catch((error) => error);
  attemptsLeftSeen.push(error.attemptsLeft);
}
test("los intentos fallidos se cuentan de a uno", attemptsLeftSeen.join(",") === Array.from({ length: MAX_PIN_ATTEMPTS - 1 }, (_, index) => MAX_PIN_ATTEMPTS - 1 - index).join(","));
const lastAttemptError = await unlockAccountWithPin(remembered.id, "9999").catch((error) => error);
test("después de demasiados PIN incorrectos la cuenta se borra de este dispositivo", lastAttemptError.forgotten === true);
test("una cuenta borrada por demasiados intentos ya no aparece en la lista", !listRememberedAccounts(base.apiUrl).some((item) => item.id === remembered.id));
const afterForgotten = await unlockAccountWithPin(remembered.id, "4821").catch((error) => error);
test("y tampoco se puede desbloquear con el PIN correcto una vez borrada", afterForgotten instanceof Error);

const second = await rememberAccount({ ...base, deviceId: "caja-2", deviceCredential: "secreto-inicial", pin: "1357" });
await unlockAccountWithPin(second.id, "1357");
const bytesForPin = new TextEncoder().encode("1357");
await renewRememberedCredential(second.id, bytesForPin, "secreto-renovado");
const afterRenewal = await unlockAccountWithPin(second.id, "1357");
test("renovar la credencial mantiene el mismo PIN pero cambia el secreto guardado", afterRenewal.deviceCredential === "secreto-renovado");

forgetAccount(second.id);
test("olvidar una cuenta la saca de la lista de este dispositivo", !listRememberedAccounts(base.apiUrl).some((item) => item.id === second.id));

const thirdApi = await rememberAccount({ ...base, apiUrl: "https://otra-nube.example.com", deviceId: "caja-3", deviceCredential: "secreto-3", pin: "2468" });
test("las cuentas recordadas se filtran por nube/servidor", listRememberedAccounts("https://otra-nube.example.com").some((item) => item.id === thirdApi.id) && !listRememberedAccounts(base.apiUrl).some((item) => item.id === thirdApi.id));

test("la detección de soporte biométrico no revienta fuera de un navegador", isBiometricSupported() === false);

test("se ofrece recordar una cuenta que todavía no está guardada ni descartada", shouldOfferToRemember(base.apiUrl, "caja-9", "nueva-persona"));
dismissRememberPrompt(base.apiUrl, "caja-9", "nueva-persona");
test("después de descartar el aviso, no se vuelve a ofrecer en ese dispositivo", !shouldOfferToRemember(base.apiUrl, "caja-9", "nueva-persona"));
const fourth = await rememberAccount({ ...base, deviceId: "caja-10", deviceCredential: "secreto-4", pin: "1122" });
test("una cuenta ya recordada tampoco vuelve a ofrecerse", !shouldOfferToRemember(base.apiUrl, "caja-10", base.username));
forgetAccount(fourth.id);

console.log(`\n${passed} pruebas de la bóveda local de cuentas recordadas superadas.`);
