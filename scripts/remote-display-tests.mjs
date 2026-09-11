import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const port = 8812;
const dataDir = path.join(tmpdir(), `kiosco-display-test-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: { ...process.env, KIOSCO_CLOUD_PORT: String(port), KIOSCO_CLOUD_DB: dbPath, KIOSCO_CLOUD_DATA_DIR: dataDir, KIOSCO_LOCAL_MODE: "1", DATABASE_URL: "", KIOSCO_PUBLIC_APP_URL: "https://app.kioscomas.ar" },
  stdio: "ignore",
});

const request = async (url, options = {}) => {
  const response = await fetch(base + url, options); const value = await response.json().catch(() => ({}));
  return { response, value };
};
const assert = (condition, message) => { if (!condition) throw new Error(`FALLÓ: ${message}`); console.log(`OK: ${message}`); };

try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await request("/v1/auth/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessId: "business-display", username: "display-owner", password: "display-secret", name: "Dueño" }) });
  const login = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "display-owner", password: "display-secret", deviceId: "display-admin-pc" }) });
  const headers = { "content-type": "application/json", "x-device-id": "display-admin-pc", "x-tenant-id": "business-display", authorization: `Bearer ${login.value.accessToken}` };
  const created = await request("/v1/business-displays", { method: "POST", headers, body: JSON.stringify({ name: "TV vidriera", content: { businessName: "Comercio", secret: "NO-DEBE-SALIR", costs: [900], config: { operationMode: "sale-and-ads", widgets: { hours: { size: "hero", schedule: [{ day: "monday", enabled: true, open: "08:00", close: "20:00" }] } } }, promotions: [{ id: "promo", title: "2x1", internalCost: 500 }] } }) });
  assert(created.response.status === 201 && created.value.display?.id, "el dueño crea el espacio publicitario de una pantalla");
  assert(created.value.display?.content?.config?.operationMode === "ads-only", "la pantalla remota queda forzada al modo publicitario");
  assert(created.value.display?.content?.config?.widgets?.hours?.size === "hero" && created.value.display?.content?.config?.widgets?.hours?.schedule?.find((entry) => entry.day === "monday")?.open === "08:00", "la pantalla remota conserva tamaños y horarios configurados");
  assert(!JSON.stringify(created.value.display?.content).includes("NO-DEBE-SALIR") && !JSON.stringify(created.value.display?.content).includes("internalCost"), "el contenido remoto no expone campos privados");
  const requested = await request("/v1/displays/pairing-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: "remote-tv" }) });
  assert(requested.response.status === 201 && requested.value.pairing?.code?.length === 8 && requested.value.pairing?.authorizationUrl?.includes("displayPair="), "la TV genera el QR y un código temporal para mostrar en pantalla");
  const pending = await request("/v1/displays/pairing-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestToken: requested.value.pairing.requestToken }) });
  assert(pending.response.status === 202 && pending.value.status === "pending", "la TV espera sin autorizarse a sí misma");
  const approved = await request(`/v1/business-displays/${created.value.display.id}/pair`, { method: "POST", headers, body: JSON.stringify({ code: requested.value.pairing.code }) });
  assert(approved.response.status === 201, "el dueño autoriza desde su app el código que muestra la TV");
  const reused = await request(`/v1/business-displays/${created.value.display.id}/pair`, { method: "POST", headers, body: JSON.stringify({ code: requested.value.pairing.code }) });
  assert(reused.response.status === 400, "el código no puede autorizarse dos veces");
  const paired = await request("/v1/displays/pairing-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestToken: requested.value.pairing.requestToken }) });
  assert(paired.response.status === 200 && paired.value.status === "approved" && Boolean(paired.value.displayToken), "la TV detecta sola la autorización y recibe su credencial");
  const content = await request("/v1/displays/content", { headers: { authorization: `Display ${paired.value.displayToken}` } });
  assert(content.response.ok && content.value.display?.content?.businessName === "Comercio", "la credencial de pantalla sólo descarga contenido público");
  const directory = await request("/v1/business-displays", { headers });
  assert(directory.value.displays?.[0]?.pairedDevices === 1, "el dueño ve cuántos equipos están vinculados");
  await request(`/v1/business-displays/${created.value.display.id}/revoke`, { method: "POST", headers, body: "{}" });
  const revoked = await request("/v1/displays/content", { headers: { authorization: `Display ${paired.value.displayToken}` } });
  assert(revoked.response.status === 401, "revocar la pantalla corta el acceso remoto");
  const stored = JSON.stringify(JSON.parse(await fs.readFile(dbPath, "utf8")));
  assert(!stored.includes(paired.value.displayToken) && !stored.includes(requested.value.pairing.code) && !stored.includes(requested.value.pairing.requestToken), "el servidor nunca guarda códigos ni credenciales en texto legible");
} finally {
  child.kill();
  await fs.rm(dataDir, { recursive: true, force: true });
}
