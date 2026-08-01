import { storage } from "../shared/storage";
import { syncEngine } from "./syncEngine";
import { extractTenantValue, SYNCABLE_KEYS } from "./protocol";
import { diffTenantEntities, diffTenantSections } from "./entitySync";
import { loadCloudConfig } from "./config";
import { withDataStorageLock } from "./dataStorageLock";

let context = { tenantId: null, isSystemAdmin: false };
let syncTimer = null;
const scheduleSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncEngine.flush().catch(() => {}), 120);
};

// Único acceso a persistencia. En la migración se reemplaza esta implementación
// por una API HTTPS sin cambiar las pantallas ni las reglas de negocio.
export const repository = {
  initialize: () => syncEngine.initialize(),
  setContext(value) { context = { ...context, ...value }; syncEngine.setContext(context); },
  subscribe: (fn) => syncEngine.subscribe(fn),
  getSyncStatus: () => syncEngine.getStatus(),
  syncNow: () => syncEngine.flush(),
  async seedCurrentTenant() {
    if (!context.tenantId) return;
    const tenantId = String(context.tenantId);
    const config = loadCloudConfig();
    const allData = await this.get("datos", {});
    const dataset = extractTenantValue("datos", allData, tenantId) || {};
    const operations = [
      ...diffTenantEntities({}, dataset, tenantId, config.deviceId),
      ...diffTenantSections({}, dataset, tenantId, config.deviceId),
    ].map((operation) => ({ ...operation, seedOnly: true }));
    if (operations.length) await syncEngine.enqueueMany(operations);
    if (context.isSystemAdmin) {
      const accounts = await this.get("cuentas", []);
      await syncEngine.enqueue({ type: "system_set", key: "cuentas", tenantId, value: accounts });
    }
    return syncEngine.flush();
  },
  async get(key, fallback = null) {
    const result = await storage.get(key);
    if (!result?.value) return fallback;
    try { return JSON.parse(result.value); } catch { return fallback; }
  },
  async set(key, value) {
    const persist = async () => {
      const previousResult = await storage.get(key);
      let previous = null; try { previous = previousResult?.value ? JSON.parse(previousResult.value) : null; } catch {}
      await storage.set(key, JSON.stringify(value));
      if (context.tenantId && key === "datos") {
      const tenantId=String(context.tenantId), config=loadCloudConfig();
      const before=extractTenantValue(key,previous||{},tenantId)||{}, after=extractTenantValue(key,value,tenantId)||{};
      const operations=[
        ...diffTenantEntities(before,after,tenantId,config.deviceId),
        ...diffTenantSections(before,after,tenantId,config.deviceId),
      ];
      if(operations.length) { await syncEngine.enqueueMany(operations); scheduleSync(); }
      } else if (context.tenantId && key === "cuentas" && context.isSystemAdmin) {
      await syncEngine.enqueue({ type: "system_set", key: "cuentas", tenantId: String(context.tenantId), value });
      scheduleSync();
      } else if (context.tenantId && SYNCABLE_KEYS.has(key)) {
      await syncEngine.enqueue({ type: "set", key, tenantId: String(context.tenantId), value: extractTenantValue(key, value, String(context.tenantId)) });
      scheduleSync();
      }
    };
    return key === "datos" ? withDataStorageLock(persist) : persist();
  },
  async delete(key) {
    await storage.delete(key);
    if (context.tenantId && SYNCABLE_KEYS.has(key)) await syncEngine.enqueue({ type: "delete", key, tenantId: String(context.tenantId) });
  },
};
