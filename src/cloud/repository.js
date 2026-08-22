import { storage } from "../shared/storage";
import { syncEngine } from "./syncEngine";
import { extractTenantValue, SYNCABLE_KEYS } from "./protocol";
import { diffTenantEntities, diffTenantSections } from "./entitySync";
import { loadCloudConfig } from "./config";
import { cloudSession } from "./cloudAuth";
import { withDataStorageLock } from "./dataStorageLock";

let context = { tenantId: null, isSystemAdmin: false };
let syncTimer = null;
let bootstrapScope = "";
let bootstrapPromise = null;
let bootstrapResult = null;
const scheduleSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    ensureCloudBootstrap()
      .then(() => syncEngine.flush())
      .catch(() => {});
  }, 120);
};
const canSyncSystemData = () => cloudSession()?.user?.role === "superAdmin";
const currentBootstrapScope = () => {
  const config = loadCloudConfig();
  return `${config.enabled ? config.apiUrl : "local"}:${String(context.tenantId || "")}`;
};
const ensureCloudBootstrap = async () => {
  const scope = currentBootstrapScope();
  if (!context.tenantId || scope.startsWith("local:")) return { hasRemoteData: false, skipped: true };
  if (scope !== bootstrapScope) {
    bootstrapScope = scope;
    bootstrapPromise = null;
    bootstrapResult = null;
  }
  if (bootstrapResult) return bootstrapResult;
  if (!bootstrapPromise) {
    bootstrapPromise = syncEngine.bootstrapTenant()
      .then((result) => { bootstrapResult = result; return result; })
      .catch((error) => { bootstrapPromise = null; throw error; });
  }
  return bootstrapPromise;
};

// Único acceso a persistencia. En la migración se reemplaza esta implementación
// por una API HTTPS sin cambiar las pantallas ni las reglas de negocio.
export const repository = {
  async initialize() {
    bootstrapScope = "";
    bootstrapPromise = null;
    bootstrapResult = null;
    return syncEngine.initialize();
  },
  setContext(value) {
    const previousTenant = String(context.tenantId || "");
    context = { ...context, ...value };
    if (previousTenant !== String(context.tenantId || "")) {
      bootstrapScope = "";
      bootstrapPromise = null;
      bootstrapResult = null;
    }
    syncEngine.setContext(context);
  },
  subscribe: (fn) => syncEngine.subscribe(fn),
  getSyncStatus: () => syncEngine.getStatus(),
  async syncNow() {
    await ensureCloudBootstrap();
    return syncEngine.flush();
  },
  async seedCurrentTenant() {
    if (!context.tenantId) return;
    const bootstrap = await ensureCloudBootstrap();
    if (bootstrap.hasRemoteData) return syncEngine.flush();
    const tenantId = String(context.tenantId);
    const config = loadCloudConfig();
    const allData = await this.get("datos", {});
    const dataset = extractTenantValue("datos", allData, tenantId) || {};
    const operations = [
      ...diffTenantEntities({}, dataset, tenantId, config.deviceId),
      ...diffTenantSections({}, dataset, tenantId, config.deviceId),
    ].map((operation) => ({ ...operation, seedOnly: true }));
    if (operations.length) await syncEngine.enqueueMany(operations);
    if (context.isSystemAdmin && canSyncSystemData()) {
      const accounts = await this.get("cuentas", []);
      await syncEngine.enqueue({ type: "system_set", key: "cuentas", tenantId, value: accounts });
    }
    const result = await syncEngine.flush();
    bootstrapResult = { hasRemoteData: true, seeded: true };
    return result;
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
      const serializedValue = JSON.stringify(value);
      // Los efectos de arranque vuelven a entregar el estado recién leído. Si
      // no cambió, no hay nada que guardar ni que agregar a la cola de nube.
      if (previousResult?.value === serializedValue) return;
      await storage.set(key, serializedValue);
      if (context.tenantId && key === "datos") {
        const tenantId=String(context.tenantId), config=loadCloudConfig();
        const before=extractTenantValue(key,previous||{},tenantId)||{}, after=extractTenantValue(key,value,tenantId)||{};
        const operations=[
          ...diffTenantEntities(before,after,tenantId,config.deviceId),
          ...diffTenantSections(before,after,tenantId,config.deviceId),
        ];
        if(operations.length) { await syncEngine.enqueueMany(operations); scheduleSync(); }
      } else if (context.tenantId && key === "cuentas" && context.isSystemAdmin && canSyncSystemData()) {
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
