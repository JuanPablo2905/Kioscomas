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
    KIOSCO_REQUIRE_DEVICE_ACTIVATION: "1",
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

const post = (url, payload) => request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
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

  assert(health?.response.ok && health.value.deviceActivationRequired === true, "la nube publicada exige activar dispositivos");

  const rejected = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "new-web-browser",
  });
  assert(rejected.response.status === 403, "un navegador nuevo no puede iniciar sesión sin activación");

  const activation = await post("/v1/activation/admin", {
    deviceKey: adminPassword,
    deviceId: "new-web-browser",
    appVersion: "web-test",
  });
  assert(activation.response.ok && activation.value.activated === true, "la clave autoriza el navegador");

  const accepted = await post("/v1/auth/login", {
    username: adminUsername,
    password: adminPassword,
    deviceId: "new-web-browser",
  });
  assert(accepted.response.ok && Boolean(accepted.value.accessToken), "el navegador autorizado puede iniciar sesión");
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
