import assert from "node:assert/strict";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { dispatchEvent() {}, kioscoDesktop: { localCloudUrl: "http://127.0.0.1:8787" } };
globalThis.location = { hostname: "localhost" };

const remoteUrl = "https://kiosco-plus-api.onrender.com";
const localUrl = "http://127.0.0.1:8787";
const {
  CLOUD_CONFIG_KEY,
  normalizeCloudApiUrl,
  resolveCloudConfig,
} = await import("../src/cloud/config.js");
const {
  cloudFetch,
  cloudSession,
  cloudSessionBelongsToApi,
} = await import("../src/cloud/cloudAuth.js");
const { isRedundantBootstrapOperation } = await import("../src/cloud/syncEngine.js");

assert.equal(normalizeCloudApiUrl(`${remoteUrl}///`), remoteUrl);

const firstDesktopRun = resolveCloudConfig({ saved: {}, localUrl, publicApiUrl: remoteUrl, autoConnect: true });
assert.equal(firstDesktopRun.apiUrl, remoteUrl, "a published desktop build must prefer Render");
assert.equal(firstDesktopRun.serverMode, "remote");
assert.equal(firstDesktopRun.enabled, true);

const migratedLegacyDesktop = resolveCloudConfig({
  saved: { apiUrl: localUrl, enabled: true, deviceId: "desktop-1" },
  localUrl,
  publicApiUrl: remoteUrl,
  autoConnect: true,
});
assert.equal(migratedLegacyDesktop.apiUrl, remoteUrl, "legacy local URLs must migrate to Render");
assert.equal(migratedLegacyDesktop.migratedFromLocal, true);
assert.equal(migratedLegacyDesktop.deviceId, "desktop-1", "migration must preserve the device identity");

const explicitLocal = resolveCloudConfig({
  saved: { apiUrl: localUrl, enabled: true, serverMode: "local" },
  localUrl,
  publicApiUrl: remoteUrl,
  autoConnect: true,
});
assert.equal(explicitLocal.apiUrl, localUrl, "an explicit developer local selection must be preserved");

const customRemote = resolveCloudConfig({
  saved: { apiUrl: "https://cloud.example.com/", enabled: true },
  localUrl,
  publicApiUrl: remoteUrl,
  autoConnect: true,
});
assert.equal(customRemote.apiUrl, "https://cloud.example.com");

const disabled = resolveCloudConfig({
  saved: { apiUrl: localUrl, enabled: false },
  localUrl,
  publicApiUrl: remoteUrl,
  autoConnect: true,
});
assert.equal(disabled.apiUrl, remoteUrl);
assert.equal(disabled.enabled, false, "migration must not override an explicit disabled setting");

localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ apiUrl: remoteUrl }));
sessionStorage.setItem("kiosco_cloud_session", JSON.stringify({ apiUrl: localUrl, accessToken: "local-token" }));
localStorage.setItem("kiosco_cloud_session", JSON.stringify({ apiUrl: remoteUrl, refreshToken: "remote-refresh" }));
assert.equal(cloudSession()?.refreshToken, "remote-refresh", "a local session must never be reused against Render");
assert.equal(cloudSession(localUrl)?.accessToken, "local-token");
assert.equal(cloudSessionBelongsToApi({ apiUrl: localUrl }, remoteUrl), false);

sessionStorage.clear();
localStorage.setItem("kiosco_cloud_session", JSON.stringify({ apiUrl: remoteUrl, refreshToken: "keep-on-temporary-error" }));
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ error: "Servicio temporalmente no disponible" }), {
  status: 503,
  headers: { "content-type": "application/json" },
});
await assert.rejects(
  cloudFetch(remoteUrl, "/v1/sync/pull"),
  /temporalmente no disponible/,
  "a temporary refresh error must reach the sync engine",
);
assert.equal(cloudSession(remoteUrl)?.refreshToken, "keep-on-temporary-error", "a temporary cloud error must preserve the renewable session");

globalThis.fetch = async () => new Response(JSON.stringify({ error: "Sesión inválida" }), {
  status: 401,
  headers: { "content-type": "application/json" },
});
const unauthorized = await cloudFetch(remoteUrl, "/v1/sync/pull");
assert.equal(unauthorized.status, 401);
assert.equal(cloudSession(remoteUrl), null, "an invalid refresh token must clear the saved session");
globalThis.fetch = originalFetch;

const remoteSnapshot = {
  dataset: {
    products: [{ id: 1, nombre: "Coca-Cola", deposito: 12, _syncVersion: 4 }],
    ventas: [{ id: 10, total: 2500 }],
  },
  values: {},
};
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "entity_upsert", entity: "products", entityId: 1, value: { id: 1, nombre: "Coca-Cola", deposito: 12 } }, "2", remoteSnapshot), true);
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "entity_upsert", entity: "products", entityId: 1, value: { id: 1, nombre: "Coca-Cola", deposito: 9 } }, "2", remoteSnapshot), false);
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "entity_delete", entity: "products", entityId: 99 }, "2", remoteSnapshot), true);
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "section_set", section: "ventas", value: [{ id: 10, total: 2500 }] }, "2", remoteSnapshot), true);
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "section_delete", section: "pedidos" }, "2", remoteSnapshot), true);
assert.equal(isRedundantBootstrapOperation({ tenantId: "1", type: "section_delete", section: "pedidos" }, "2", remoteSnapshot), false);
assert.equal(isRedundantBootstrapOperation({ tenantId: "2", type: "entity_upsert", seedOnly: true }, "2", remoteSnapshot), true);

localStorage.removeItem("kiosco_cloud_session");
assert.equal(cloudSession(), null, "a mismatched local session must look disconnected from Render");
sessionStorage.setItem("kiosco_cloud_session", "{broken-json");
assert.equal(cloudSession(), null, "corrupt saved sessions must not crash startup");

console.log("cloud-config-tests: 28 assertions passed");
