import { storage } from "../shared/storage";
import { loadCloudConfig } from "./config";
import { mergeTenantDataset, normalizeOperation } from "./protocol";
import { applyEntityOperations, applySectionOperations } from "./entitySync";
import { cloudFetch } from "./cloudAuth";

const QUEUE_KEY = "__cloud_sync_queue_v1";
const META_KEY = "__cloud_sync_meta_v1";
const CONFLICTS_KEY = "__cloud_sync_conflicts_v1";
const listeners = new Set();
let status = { mode: "local", state: "idle", pending: 0, conflicts: 0, lastSyncAt: null, error: null };
let context = { tenantId: null };

const readJson = async (key, fallback) => {
  const result = await storage.get(key);
  try { return result?.value ? JSON.parse(result.value) : fallback; } catch { return fallback; }
};
const writeJson = (key, value) => storage.set(key, JSON.stringify(value));
const publish = (patch) => { status = { ...status, ...patch }; listeners.forEach((fn) => fn(status)); };

export const syncEngine = {
  getStatus: () => status,
  async getPendingReview() {
    const [conflicts, queue] = await Promise.all([
      readJson(CONFLICTS_KEY, []),
      readJson(QUEUE_KEY, []),
    ]);
    return { conflicts, pending: queue };
  },
  setContext(value) { context = { ...context, ...value }; },
  subscribe(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); },
  async initialize() {
    const config = loadCloudConfig();
    const queue = await readJson(QUEUE_KEY, []);
    const meta = await readJson(META_KEY, {});
    const conflicts = await readJson(CONFLICTS_KEY, []);
    publish({ mode: config.enabled && config.apiUrl ? "cloud" : "local", pending: queue.length, conflicts: conflicts.length, lastSyncAt: meta.lastSyncAt || null });
  },
  async enqueue(operation) {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl) return;
    const queue = await readJson(QUEUE_KEY, []);
    const normalized = normalizeOperation({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, deviceId: config.deviceId, createdAt: new Date().toISOString(), schemaVersion: 1, ...operation });
    if (!normalized) return;
    const sameEntity = (item) => ["entity_upsert", "entity_delete"].includes(item.type)
      && item.tenantId === normalized.tenantId
      && item.entity === normalized.entity
      && String(item.entityId) === String(normalized.entityId);
    const previousEntityOperation = ["entity_upsert", "entity_delete"].includes(normalized.type) ? queue.find(sameEntity) : null;
    const merged = previousEntityOperation
      ? { ...normalized, baseVersion: previousEntityOperation.baseVersion, baseValue: previousEntityOperation.baseValue ?? normalized.baseValue }
      : normalized;
    const next = [...queue.filter((item) => !sameEntity(item)), merged].slice(-5000);
    await writeJson(QUEUE_KEY, next);
    publish({ mode: "cloud", pending: next.length });
  },
  async enqueueMany(operations) { for (const operation of operations) await this.enqueue(operation); },
  async flush() {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl || status.state === "syncing") return status;
    const queue = await readJson(QUEUE_KEY, []);
    if (!navigator.onLine) { publish({ state: "offline", pending: queue.length }); return status; }
    publish({ state: "syncing", error: null, pending: queue.length });
    try {
      const tenantId = String(context.tenantId || "");
      if (!tenantId) throw new Error("No hay un negocio activo para sincronizar");
      const headers = { "content-type": "application/json", "x-device-id": config.deviceId, "x-tenant-id": tenantId };
      if (queue.length) {
        const response = await cloudFetch(config.apiUrl, "/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: queue.filter((item)=>item.tenantId===tenantId) }) });
        if (!response.ok) throw new Error(`Servidor respondió ${response.status}`);
        const result = await response.json();
        const accepted = new Set(result.acceptedIds || queue.map((item) => item.id));
        const conflictIds = new Set((result.conflicts || []).map((item)=>item.operationId));
        if(conflictIds.size){const existing=await readJson(CONFLICTS_KEY,[]);await writeJson(CONFLICTS_KEY,[...existing,...result.conflicts.map((conflict)=>({...conflict,localOperation:queue.find((item)=>item.id===conflict.operationId),detectedAt:new Date().toISOString()}))].slice(-500));}
        const acceptedVersions = result.acceptedEntityVersions?.length
          ? result.acceptedEntityVersions
          : queue.filter((item) => accepted.has(item.id) && !item.seedOnly && ["entity_upsert", "entity_delete"].includes(item.type)).map((item) => ({
              operationId: item.id,
              entity: item.entity,
              entityId: item.entityId,
              version: Number(item.baseVersion || 0) + 1,
            }));
        if (acceptedVersions.length) {
          const allData = await readJson("datos", {});
          const dataset = allData[tenantId] || allData[Number(tenantId)] || {};
          for (const ack of acceptedVersions) {
            const items = [...(dataset[ack.entity] || [])];
            const index = items.findIndex((item) => String(item.id) === String(ack.entityId));
            if (index >= 0) items[index] = { ...items[index], _syncVersion: Number(ack.version || 0) };
            dataset[ack.entity] = items;
          }
          await writeJson("datos", mergeTenantDataset(allData, tenantId, dataset));
        }
        const latestQueue = await readJson(QUEUE_KEY, []);
        const remainingQueue = latestQueue
          .filter((item) => !accepted.has(item.id) && !conflictIds.has(item.id))
          .map((item) => {
            const ack = acceptedVersions.find((entry) => entry.entity === item.entity && String(entry.entityId) === String(item.entityId));
            return ack ? { ...item, baseVersion: Number(ack.version || 0) } : item;
          });
        await writeJson(QUEUE_KEY, remainingQueue);
      }
      const meta = await readJson(META_KEY, {});
      const tenantCursor = Number(meta.cursors?.[tenantId] || 0);
      const pull = await cloudFetch(config.apiUrl, `/v1/sync/pull?since=${tenantCursor}`, { headers });
      if (!pull.ok) throw new Error(`No se pudieron descargar cambios (${pull.status})`);
      const remote = await pull.json();
      for (const operation of remote.operations || []) {
        const normalized = normalizeOperation(operation); if (!normalized || normalized.tenantId !== tenantId) continue;
        if (["entity_upsert","entity_delete"].includes(normalized.type)) {
          const allData=await readJson("datos",{}); const dataset=allData[tenantId]||allData[Number(tenantId)]||{}; await writeJson("datos",mergeTenantDataset(allData,tenantId,applyEntityOperations(dataset,[normalized])));
        } else if (["section_set","section_delete"].includes(normalized.type)) {
          const allData=await readJson("datos",{}); const dataset=allData[tenantId]||allData[Number(tenantId)]||{}; await writeJson("datos",mergeTenantDataset(allData,tenantId,applySectionOperations(dataset,[normalized])));
        } else if (normalized.type === "system_set" && normalized.key === "cuentas") {
          await writeJson("cuentas", normalized.value);
        } else if (normalized.key === "datos" && normalized.type === "set") {
          const allData = await readJson("datos", {}); await writeJson("datos", mergeTenantDataset(allData, tenantId, normalized.value));
        } else if (normalized.type === "delete") await storage.delete(normalized.key); else await writeJson(normalized.key, normalized.value);
      }
      if ((remote.operations || []).length) window.dispatchEvent(new CustomEvent("kiosco-cloud-update", { detail: { tenantId, count: remote.operations.length } }));
      const lastSyncAt = new Date().toISOString();
      await writeJson(META_KEY, {
        ...meta,
        lastSyncAt,
        cursors: { ...(meta.cursors || {}), [tenantId]: Number(remote.cursor || tenantCursor) },
      });
      const remaining = await readJson(QUEUE_KEY, []);
      const conflicts = await readJson(CONFLICTS_KEY, []);
      publish({ state: conflicts.length ? "conflict" : "synced", pending: remaining.length, conflicts: conflicts.length, lastSyncAt, error: null });
    } catch (error) {
      publish({ state: navigator.onLine ? "error" : "offline", error: error.message, pending: queue.length });
    }
    return status;
  },
  async resolveConflict(operationId, strategy = "cloud") {
    const conflicts = await readJson(CONFLICTS_KEY, []);
    const conflict = conflicts.find((item) => item.operationId === operationId);
    if (!conflict) return status;
    await writeJson(CONFLICTS_KEY, conflicts.filter((item) => item.operationId !== operationId));
    if (strategy === "cloud" && conflict.entity && conflict.serverValue) {
      const tenantId = String(context.tenantId || conflict.localOperation?.tenantId || "");
      const allData = await readJson("datos", {});
      const dataset = allData[tenantId] || allData[Number(tenantId)] || {};
      const next = applyEntityOperations(dataset, [{ type: "entity_upsert", entity: conflict.entity, entityId: conflict.entityId, value: conflict.serverValue, version: conflict.serverVersion }]);
      await writeJson("datos", mergeTenantDataset(allData, tenantId, next));
      window.dispatchEvent(new CustomEvent("kiosco-cloud-update", { detail: { tenantId, count: 1, resolvedConflict: true } }));
    } else if (strategy === "local" && conflict.localOperation) {
      await this.enqueue({
        ...conflict.localOperation,
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        baseVersion: Number(conflict.serverVersion || 0),
        createdAt: new Date().toISOString(),
      });
    }
    const remaining = await readJson(CONFLICTS_KEY, []);
    const queue = await readJson(QUEUE_KEY, []);
    publish({ conflicts: remaining.length, pending: queue.length, state: remaining.length ? "conflict" : queue.length ? "idle" : "synced" });
    return status;
  },
};
