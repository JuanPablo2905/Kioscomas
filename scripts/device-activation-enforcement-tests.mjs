import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8803;
const dataDir = path.join(tmpdir(), `kiosco-device-activation-test-${Date.now()}`);
const base = `http://127.0.0.1:${port}`;
const adminUsername = "activation-test-admin";
const adminPassword = "activation-test-secret";
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: {
    ...process.env,
    KIOSCO_CLOUD_PORT: String(port),
    KIOSCO_CLOUD_DB: path.join(dataDir, "database.json"),
    KIOSCO_CLOUD_DATA_DIR: dataDir,
    KIOSCO_LOCAL_MODE: "0",
    KIOSCO_SUPERADMIN_USERNAME: adminUsername,
    KIOSCO_SUPERADMIN_PASSWORD: adminPassword,
    DATABASE_URL: "",
  },
  stdio: "ignore",
});

const request = async (url, options = {}) => {
  const response = await fetch(base + url, options);
  let value = {};
  try { value = await response.json(); } catch {}
  return { response, value };
};

const post = (url, payload, headers = {}) => request(url, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(payload),
});

const assert = (condition, message) => {
  if (!condition) throw new Error(`FALLÓ: ${message}`);
  console.log(`OK: ${message}`);
};

try {
  let health;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      health = await request("/v1/health");
      if (health.response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(health?.response.ok, "el servidor arrancó");

  const firstLogin = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "dispositivo-nuevo-sin-clave",
  });
  assert(firstLogin.response.ok && Boolean(firstLogin.value.accessToken), "un dispositivo nuevo puede iniciar sesión sin pedir ninguna clave de activación");

  const callerLogin = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "dispositivo-del-admin",
  });
  assert(callerLogin.response.ok && Boolean(callerLogin.value.accessToken), "el dispositivo que va a revocar al otro también entra directo, sin clave");

  const revoke = await post("/v1/admin/activations/dispositivo-nuevo-sin-clave/revoke", {}, {
    authorization: `Bearer ${callerLogin.value.accessToken}`,
    "x-tenant-id": "system-admin",
    "x-device-id": "dispositivo-del-admin",
  });
  assert(revoke.response.ok && Boolean(revoke.value.activation?.revokedAt), "el superadmin puede desactivar puntualmente un dispositivo ya usado");

  const rejected = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "dispositivo-nuevo-sin-clave",
  });
  assert(rejected.response.status === 403 && /desactivado/i.test(String(rejected.value.error || "")), "el dispositivo desactivado no puede volver a iniciar sesión, con un mensaje claro de por qué");

  const stillWorks = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "otro-dispositivo-cualquiera",
  });
  assert(stillWorks.response.ok && Boolean(stillWorks.value.accessToken), "desactivar un dispositivo puntual no afecta a los demás dispositivos nuevos");
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
