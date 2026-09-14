import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { TERMS_VERSION } from "../src/legal/terms.js";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8820;
const dataDir = path.join(tmpdir(), `kiosco-server-boundaries-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const administratorSecret = "boundary-administrator-secret";
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: { ...process.env, KIOSCO_CLOUD_PORT: String(port), KIOSCO_CLOUD_DB: dbPath, KIOSCO_CLOUD_DATA_DIR: dataDir, KIOSCO_LOCAL_MODE: "0", KIOSCO_REQUIRE_DEVICE_ACTIVATION: "0", DATABASE_URL: "", KIOSCO_ALLOWED_ORIGINS: "https://app.kioscomas.ar,https://kioscomas.ar", KIOSCO_SUPERADMIN_USERNAME: "boundary-admin", KIOSCO_SUPERADMIN_PASSWORD: administratorSecret },
  stdio: "ignore",
});
let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};
const request = async (route, options = {}) => {
  const response = await fetch(base + route, options);
  const value = await response.json().catch(() => ({}));
  return { response, value };
};

try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const trusted = await request("/v1/health", { headers: { origin: "https://app.kioscomas.ar" } });
  test("un origen publicado recibe CORS y cabeceras defensivas", trusted.response.ok && trusted.response.headers.get("access-control-allow-origin") === "https://app.kioscomas.ar" && trusted.response.headers.get("x-frame-options") === "DENY" && trusted.response.headers.get("cache-control") === "no-store");
  const rejected = await request("/v1/health", { headers: { origin: "https://sitio-ajeno.example" } });
  test("un origen web ajeno no puede leer la API", rejected.response.status === 403 && /origen/i.test(rejected.value.error || ""));
  const malformed = await request("/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  test("un cuerpo JSON inválido se rechaza como petición incorrecta", malformed.response.status === 400);
  const oversized = await request("/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(1280 * 1024 + 10) }) });
  test("una petición excesiva se corta antes de procesarse", oversized.response.status === 413);
  await request("/v1/activation/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: "boundary-device", deviceKey: administratorSecret, appVersion: "0.2.28" }) });
  await request("/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: "boundary-device", name: "Dueño", email: "boundary-owner@example.com", businessName: "Negocio seguro", username: "boundary-owner", password: "boundary-secret", termsAccepted: true, termsVersion: TERMS_VERSION }) });
  const login = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "boundary-owner", password: "boundary-secret", deviceId: "boundary-device" }) });
  const ttlHours = (Date.parse(login.value.expiresAt || "") - Date.now()) / 3600000;
  test("la sesión de producción vence alrededor de dos horas", login.response.ok && ttlHours > 1.9 && ttlHours <= 2.01);
  const persisted = JSON.parse(await fs.readFile(dbPath, "utf8"));
  test("la base almacena el hash y no el token entregado", !JSON.stringify(persisted).includes(login.value.accessToken) && Object.keys(persisted.sessions || {}).every((key) => /^[a-f0-9]{64}$/.test(key)));
  let limited = null;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    limited = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "boundary-owner", password: "incorrecta", deviceId: "boundary-device" }) });
    if (limited.response.status === 429) break;
  }
  test("los intentos repetidos de acceso terminan limitados", limited?.response.status === 429 && Number(limited.response.headers.get("retry-after")) > 0);
  console.log(`\n${passed} límites del servidor verificados.`);
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
