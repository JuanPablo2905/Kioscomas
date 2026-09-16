import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8801;
const dataDir = path.join(tmpdir(), `kiosco-device-credential-test-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: {
    ...process.env,
    KIOSCO_CLOUD_PORT: String(port),
    KIOSCO_CLOUD_DB: dbPath,
    KIOSCO_CLOUD_DATA_DIR: dataDir,
    KIOSCO_LOCAL_MODE: "1",
  },
  stdio: "ignore",
});

let passed = 0;
const test = (name, value) => {
  if (!value) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};
const request = async (url, options = {}) => {
  const response = await fetch(base + url, options);
  let value = {};
  try { value = await response.json(); } catch {}
  return { response, value };
};
const json = (body) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

try {
  for (let index = 0; index < 30; index += 1) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await request("/v1/auth/bootstrap", { method: "POST", ...json({ businessId: "business-pin", username: "duenio", password: "clave-secreta-1", name: "Dueño" }) });
  const login = await request("/v1/auth/login", { method: "POST", ...json({ username: "duenio", password: "clave-secreta-1", deviceId: "caja-1" }) });
  test("el login normal con contraseña sigue funcionando", login.response.ok && !!login.value.accessToken);

  const authHeaders = { "content-type": "application/json", "x-tenant-id": "business-pin", "x-device-id": "caja-1", authorization: `Bearer ${login.value.accessToken}` };

  const missingSessionRegister = await request("/v1/auth/device-credential", { method: "POST", headers: { "content-type": "application/json", "x-tenant-id": "business-pin", "x-device-id": "caja-1" } });
  test("registrar una credencial de dispositivo exige sesión activa", missingSessionRegister.response.status === 401);

  const register = await request("/v1/auth/device-credential", { method: "POST", headers: authHeaders });
  test("el dueño puede recordar este dispositivo con una sesión válida", register.response.status === 201 && typeof register.value.deviceCredential === "string" && register.value.deviceCredential.length > 20);
  test("la credencial del dispositivo nunca es la contraseña real", register.value.deviceCredential !== "clave-secreta-1");
  const firstSecret = register.value.deviceCredential;

  const wrongSecretLogin = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-1", deviceCredential: "algo-inventado" }) });
  test("una credencial inventada no inicia sesión", wrongSecretLogin.response.status === 401);

  const wrongDeviceLogin = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "otra-caja", deviceCredential: firstSecret }) });
  test("la credencial de un dispositivo no sirve en otro dispositivo", wrongDeviceLogin.response.status === 401);

  const pinLogin = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-1", deviceCredential: firstSecret }) });
  test("el PIN recordado permite entrar sin escribir la contraseña", pinLogin.response.ok && !!pinLogin.value.accessToken && pinLogin.value.user?.businessId === "business-pin");
  test("cada entrada por PIN renueva la credencial del dispositivo", typeof pinLogin.value.deviceCredential === "string" && pinLogin.value.deviceCredential !== firstSecret);
  const secondSecret = pinLogin.value.deviceCredential;

  const staleSecretLogin = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-1", deviceCredential: firstSecret }) });
  test("la credencial anterior deja de servir apenas se renueva", staleSecretLogin.response.status === 401);

  const freshSecretLogin = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-1", deviceCredential: secondSecret }) });
  test("la credencial renovada sí funciona", freshSecretLogin.response.ok);

  const revoke = await request("/v1/auth/device-credential", { method: "DELETE", headers: { ...authHeaders, authorization: `Bearer ${freshSecretLogin.value.accessToken}` } });
  test("el dueño puede olvidar la cuenta recordada por su cuenta", revoke.response.ok);
  const afterForget = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-1", deviceCredential: freshSecretLogin.value.deviceCredential }) });
  test("después de olvidar la cuenta, el PIN ya no sirve", afterForget.response.status === 401);

  const secondLogin = await request("/v1/auth/login", { method: "POST", ...json({ username: "duenio", password: "clave-secreta-1", deviceId: "caja-2" }) });
  const secondHeaders = { "content-type": "application/json", "x-tenant-id": "business-pin", "x-device-id": "caja-2", authorization: `Bearer ${secondLogin.value.accessToken}` };
  const secondRegister = await request("/v1/auth/device-credential", { method: "POST", headers: secondHeaders });
  test("se puede recordar la misma cuenta en un segundo dispositivo", secondRegister.response.status === 201);
  const revokeDevice = await request("/v1/devices/revoke", { method: "POST", headers: secondHeaders, body: JSON.stringify({ deviceId: "caja-2" }) });
  test("desactivar el dispositivo desde el servidor lo revoca", revokeDevice.response.ok);
  const afterDeviceRevoked = await request("/v1/auth/device-credential/login", { method: "POST", ...json({ username: "duenio", deviceId: "caja-2", deviceCredential: secondRegister.value.deviceCredential }) });
  test("desactivar el dispositivo también invalida el PIN recordado en ese equipo", afterDeviceRevoked.response.status === 403);

  console.log(`\n${passed} pruebas de cuentas recordadas por dispositivo superadas.`);
} finally {
  await stopChildProcess(child);
}
