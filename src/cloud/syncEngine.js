import { storage } from "../shared/storage";
import { loadCloudConfig } from "./config";
import { mergeTenantDataset, normalizeOperation } from "./protocol";
import { applyAcceptedEntityVersions, applyEntityOperations, applySectionOperations, rebasePendingEntityOperations } from "./entitySync";
import { cloudFetch } from "./cloudAuth";
import { withDataStorageLock } from "./dataStorageLock";
import { isSameEntity, mergeConcurrentEntity } from "./conflictMerge";

const QUEUE_KEY = "__cloud_sync_queue_v1";
const META_KEY = "__cloud_sync_meta_v1";
const CONFLICTS_KEY = "__cloud_sync_conflicts_v1";
const listeners = new Set();
let status = { mode: "local", state: "idle", pending: 0, conflicts: 0, lastSyncAt: null, error: null };
let context = { tenantId: null };
let contextRevision = 0;

const readJson = async (key, fallback) => {
  const result = await storage.get(key);
  try { return result?.value ? JSON.parse(result.value) : fallback; } catch { return fallback; }
};
const writeJson = (key, value) => storage.set(key, JSON.stringify(value));
let queueMutation = Promise.resolve();
const updateQueue = async (updater) => {
  let next;
  const run = async () => {
    const current = await readJson(QUEUE_KEY, []);
    next = updater(current);
    await writeJson(QUEUE_KEY, next);
  };
  queueMutation = queueMutation.then(run, run);
  await queueMutation;
  return next;
};
let conflictMutation = Promise.resolve();
const updateConflicts = async (updater) => {
  let next;
  const run = async () => {
    const current = await readJson(CONFLICTS_KEY, []);
    next = await updater(current);
    await writeJson(CONFLICTS_KEY, next);
  };
  conflictMutation = conflictMutation.then(run, run);
  await conflictMutation;
  return next;
};
const publish = (patch) => { status = { ...status, ...patch }; listeners.forEach((fn) => fn(status)); };
const belongsToTenant = (item, tenantId) => String(item?.localOperation?.tenantId || item?.tenantId || "") === String(tenantId || "");
const operationTargetKey = (item) => {
  if (!item) return "";
  const tenant = String(item.tenantId || "");
  if (["entity_upsert", "entity_delete"].includes(item.type)) return `${tenant}:entity:${item.entity}:${String(item.entityId)}`;
  if (["section_set", "section_delete"].includes(item.type)) return `${tenant}:section:${item.section}`;
  if (["set", "delete", "system_set"].includes(item.type)) return `${tenant}:key:${item.key}`;
  return "";
};
const compactPendingQueue = (queue = []) => {
  const seen = new Set();
  const compacted = [];
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const item = queue[index];
    const key = operationTargetKey(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    compacted.push(item);
  }
  return compacted.reverse();
};

export const syncEngine = {
  getStatus: () => status,
  async getPendingReview() {
    const [conflicts, queue] = await Promise.all([
      readJson(CONFLICTS_KEY, []),
      readJson(QUEUE_KEY, []),
    ]);
    const tenantId = String(context.tenantId || "");
    return {
      conflicts: tenantId ? conflicts.filter((item) => belongsToTenant(item, tenantId)) : [],
      pending: tenantId ? queue.filter((item) => belongsToTenant(item, tenantId)) : [],
    };
  },
  setContext(value) {
    context = { ...context, ...value };
    const tenantId = String(context.tenantId || "");
    const revision = ++contextRevision;
    publish({ pending: 0, conflicts: 0, state: status.mode === "cloud" ? "idle" : status.state });
    if (!tenantId) return;
    Promise.all([readJson(QUEUE_KEY, []), readJson(CONFLICTS_KEY, [])]).then(([queue, conflicts]) => {
      if (revision !== contextRevision || tenantId !== String(context.tenantId || "")) return;
      const pending = queue.filter((item) => belongsToTenant(item, tenantId)).length;
      const visibleConflicts = conflicts.filter((item) => belongsToTenant(item, tenantId)).length;
      publish({ pending, conflicts: visibleConflicts, state: visibleConflicts ? "conflict" : pending ? "idle" : status.state === "syncing" ? "syncing" : "synced" });
    });
  },
  subscribe(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); },
  async initialize() {
    const config = loadCloudConfig();
    const queue = await updateQueue(compactPendingQueue);
    const meta = await readJson(META_KEY, {});
    const conflicts = await readJson(CONFLICTS_KEY, []);
    const tenantId = String(context.tenantId || "");
    const pending = tenantId ? queue.filter((item) => belongsToTenant(item, tenantId)).length : 0;
    const visibleConflicts = tenantId ? conflicts.filter((item) => belongsToTenant(item, tenantId)).length : 0;
    publish({ mode: config.enabled && config.apiUrl ? "cloud" : "local", state: visibleConflicts ? "conflict" : "idle", pending, conflicts: visibleConflicts, lastSyncAt: meta.lastSyncAt || null });
  },
  async enqueue(operation) {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl) return;
    const normalized = normalizeOperation({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, deviceId: config.deviceId, createdAt: new Date().toISOString(), schemaVersion: 1, ...operation });
    if (!normalized) return;
    const sameEntity = (item) => ["entity_upsert", "entity_delete"].includes(item.type)
      && item.tenantId === normalized.tenantId
      && item.entity === normalized.entity
      && String(item.entityId) === String(normalized.entityId);
    const targetKey = operationTargetKey(normalized);
    const sameTarget = (item) => targetKey && operationTargetKey(item) === targetKey;
    await conflictMutation;
    const storedConflicts = ["entity_upsert", "entity_delete"].includes(normalized.type)
      ? await readJson(CONFLICTS_KEY, [])
      : [];
    const previousConflict = storedConflicts.find((item) => item.localOperation && sameEntity(item.localOperation));
    const next = await updateQueue((queue) => {
      const previousEntityOperation = ["entity_upsert", "entity_delete"].includes(normalized.type) ? queue.find(sameEntity) : null;
      const foundation = previousEntityOperation || previousConflict?.localOperation;
      const merged = foundation
        ? { ...normalized, baseVersion: foundation.baseVersion, baseValue: foundation.baseValue ?? normalized.baseValue }
        : normalized;
      return [...queue.filter((item) => !sameTarget(item)), merged].slice(-5000);
    });
    // A newer local value already contains the unresolved local change. Keep a
    // single causal operation instead of sending an old conflict and a new sale
    // for the same product against each other.
    if (previousConflict) {
      await updateConflicts((conflicts) => conflicts.filter((item) => !(
        item.localOperation && sameEntity(item.localOperation)
      )));
    }
    const activeTenantId = String(context.tenantId || normalized.tenantId || "");
    publish({ mode: "cloud", pending: next.filter((item) => belongsToTenant(item, activeTenantId)).length });
  },
  async enqueueMany(operations) { for (const operation of operations) await this.enqueue(operation); },
  async flush() {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl || status.state === "syncing") return status;
    const tenantId = String(context.tenantId || "");
    if (!tenantId) {
      publish({ state: "error", error: "No hay un negocio activo para sincronizar" });
      return status;
    }
    // Mark synchronously, before the first await. Otherwise two timers can both
    // pass the guard and send overlapping versions of the same product.
    publish({ state: "syncing", error: null });
    await queueMutation;
    const queue = await readJson(QUEUE_KEY, []);
    if (!navigator.onLine) { publish({ state: "offline", pending: queue.filter((item) => belongsToTenant(item, tenantId)).length }); return status; }
    const activeQueue = queue.filter((item) => belongsToTenant(item, tenantId));
    await conflictMutation;
    const storedConflicts = await readJson(CONFLICTS_KEY, []);
    const activeEntities = new Set(activeQueue
      .filter((item) => ["entity_upsert", "entity_delete"].includes(item.type))
      .map((item) => `${item.entity}:${String(item.entityId)}`));
    const retryEntities = new Set();
    const retryableConflicts = storedConflicts.filter((item) => {
      if (!belongsToTenant(item, tenantId) || !item.localOperation) return false;
      const key = `${item.localOperation.entity}:${String(item.localOperation.entityId)}`;
      if (activeEntities.has(key) || retryEntities.has(key)) return false;
      retryEntities.add(key);
      return true;
    });
    const operationsToPush = [
      ...activeQueue,
      ...retryableConflicts.map((item) => item.localOperation).filter((operation) => !activeQueue.some((queued) => queued.id === operation.id)),
    ];
    publish({ state: "syncing", error: null, pending: activeQueue.length });
    try {
      const headers = { "content-type": "application/json", "x-device-id": config.deviceId, "x-tenant-id": tenantId };
      if (operationsToPush.length) {
        const response = await cloudFetch(config.apiUrl, "/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: operationsToPush }) });
        if (!response.ok) {
          if (response.status === 401) throw new Error("La sesión de nube venció. Volvé a conectarla desde Configuración.");
          if (response.status === 403) throw new Error("Este dispositivo ya no tiene permiso para sincronizar.");
          throw new Error(`El servidor no aceptó los cambios (${response.status}).`);
        }
        const result = await response.json();
        const accepted = new Set(result.acceptedIds || operationsToPush.map((item) => item.id));
        const conflictIds = new Set((result.conflicts || []).map((item)=>item.operationId));
        // New sales can enter the queue while this request is travelling.
        // Snapshot it before storing conflicts so an obsolete response cannot
        // resurrect a conflict already superseded by a newer local operation.
        await queueMutation;
        const latestQueue = await readJson(QUEUE_KEY, []);
        const refreshedConflicts = result.conflicts.map((conflict) => {
          const previousConflict = storedConflicts.find((item) => item.operationId === conflict.operationId);
          return {
            ...conflict,
            localOperation: operationsToPush.find((item) => item.id === conflict.operationId),
            detectedAt: previousConflict?.detectedAt
              || operationsToPush.find((item) => item.id === conflict.operationId)?.createdAt
              || new Date().toISOString(),
            lastAttemptAt: new Date().toISOString(),
            attempts: Number(previousConflict?.attempts || 0) + 1,
          };
        });
        const refreshedIds = new Set(refreshedConflicts.map((item) => item.operationId));
        await updateConflicts((currentConflicts) => {
          const stillRelevant = refreshedConflicts.filter((conflict) => {
            const wasStored = storedConflicts.some((item) => item.operationId === conflict.operationId);
            const wasRemovedWhileSyncing = wasStored && !currentConflicts.some((item) => item.operationId === conflict.operationId);
            const newerQueuedValue = latestQueue.some((item) => item.id !== conflict.operationId
              && belongsToTenant(item, tenantId) && isSameEntity(item, conflict));
            return !wasRemovedWhileSyncing && !newerQueuedValue;
          });
          const relevantIds = new Set(stillRelevant.map((item) => item.operationId));
          return [
            ...currentConflicts.filter((item) => !accepted.has(item.operationId) && !refreshedIds.has(item.operationId) && !relevantIds.has(item.operationId)),
            ...stillRelevant,
          ].slice(-500);
        });
        const acceptedVersions = result.acceptedEntityVersions?.length
          ? result.acceptedEntityVersions
          : operationsToPush.filter((item) => accepted.has(item.id) && !item.seedOnly && ["entity_upsert", "entity_delete"].includes(item.type)).map((item) => ({
              operationId: item.id,
              entity: item.entity,
              entityId: item.entityId,
              version: Number(item.baseVersion || 0) + 1,
            }));
        // Read the queue again because more sales may have been enqueued while
        // the request was travelling to the server.
        if (acceptedVersions.length) {
          await withDataStorageLock(async () => {
            const allData = await readJson("datos", {});
            const dataset = allData[tenantId] || allData[Number(tenantId)] || {};
            const confirmedDataset = applyAcceptedEntityVersions(dataset, latestQueue, acceptedVersions, [...accepted], tenantId, operationsToPush);
            await writeJson("datos", mergeTenantDataset(allData, tenantId, confirmedDataset));
          });
          window.dispatchEvent(new CustomEvent("kiosco-cloud-update", {
            detail: {
              tenantId,
              count: acceptedVersions.length,
              autoMerged: acceptedVersions.some((ack) => ack.autoMerged),
              confirmedVersions: true,
            },
          }));
        }
        await updateQueue((currentQueue) => rebasePendingEntityOperations(
          currentQueue.filter((item) => !accepted.has(item.id) && !conflictIds.has(item.id)),
          acceptedVersions,
        ));
      }
      const meta = await readJson(META_KEY, {});
      const tenantCursor = Number(meta.cursors?.[tenantId] || 0);
      const pull = await cloudFetch(config.apiUrl, `/v1/sync/pull?since=${tenantCursor}`, { headers });
      if (!pull.ok) {
        if (pull.status === 401) throw new Error("La sesión de nube venció. Volvé a conectarla desde Configuración.");
        if (pull.status === 403) throw new Error("Este dispositivo ya no tiene permiso para sincronizar.");
        throw new Error(`No se pudieron descargar cambios (${pull.status}).`);
      }
      const remote = await pull.json();
      for (const operation of remote.operations || []) {
        const normalized = normalizeOperation(operation); if (!normalized || normalized.tenantId !== tenantId) continue;
        if (["entity_upsert","entity_delete"].includes(normalized.type)) {
          await withDataStorageLock(async () => {
            const conflicts = await readJson(CONFLICTS_KEY, []);
            const hasUnresolvedLocal = conflicts.some((item) => belongsToTenant(item, tenantId)
              && item.localOperation && isSameEntity(item.localOperation, normalized));
            if (hasUnresolvedLocal) return;

            let pendingFound = false;
            let rebasedValue = null;
            await updateQueue((currentQueue) => currentQueue.map((item) => {
              if (!belongsToTenant(item, tenantId) || !isSameEntity(item, normalized)) return item;
              pendingFound = true;
              if (normalized.type !== "entity_upsert" || item.type !== "entity_upsert") return item;
              const merge = mergeConcurrentEntity(item, normalized.value);
              if (!merge.value) return item;
              rebasedValue = merge.value;
              return {
                ...item,
                value: merge.value,
                baseValue: normalized.value,
                baseVersion: Number(normalized.version || 0),
              };
            }));

            const allData = await readJson("datos", {});
            const dataset = allData[tenantId] || allData[Number(tenantId)] || {};
            if (pendingFound && !rebasedValue) return;
            const operationToApply = rebasedValue
              ? { ...normalized, type: "entity_upsert", value: rebasedValue }
              : normalized;
            await writeJson("datos", mergeTenantDataset(allData, tenantId, applyEntityOperations(dataset, [operationToApply])));
          });
        } else if (["section_set","section_delete"].includes(normalized.type)) {
          await withDataStorageLock(async () => { const allData=await readJson("datos",{}); const dataset=allData[tenantId]||allData[Number(tenantId)]||{}; await writeJson("datos",mergeTenantDataset(allData,tenantId,applySectionOperations(dataset,[normalized]))); });
        } else if (normalized.type === "system_set" && normalized.key === "cuentas") {
          await writeJson("cuentas", normalized.value);
        } else if (normalized.key === "datos" && normalized.type === "set") {
          await withDataStorageLock(async () => { const allData = await readJson("datos", {}); await writeJson("datos", mergeTenantDataset(allData, tenantId, normalized.value)); });
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
      const visiblePending = remaining.filter((item) => belongsToTenant(item, tenantId)).length;
      const visibleConflicts = conflicts.filter((item) => belongsToTenant(item, tenantId)).length;
      publish({ state: visibleConflicts ? "conflict" : visiblePending ? "idle" : "synced", pending: visiblePending, conflicts: visibleConflicts, lastSyncAt, error: null });
    } catch (error) {
      publish({ state: navigator.onLine ? "error" : "offline", error: error.message, pending: activeQueue.length });
    }
    return status;
  },
  async resolveConflict(operationId, strategy = "cloud") {
    await conflictMutation;
    const conflicts = await readJson(CONFLICTS_KEY, []);
    const conflict = conflicts.find((item) => item.operationId === operationId);
    if (!conflict) return status;
    await updateConflicts((items) => items.filter((item) => item.operationId !== operationId));
    if (strategy === "cloud" && conflict.entity && conflict.serverValue) {
      const tenantId = String(context.tenantId || conflict.localOperation?.tenantId || "");
      await withDataStorageLock(async () => {
        const allData = await readJson("datos", {});
        const dataset = allData[tenantId] || allData[Number(tenantId)] || {};
        const next = applyEntityOperations(dataset, [{ type: "entity_upsert", entity: conflict.entity, entityId: conflict.entityId, value: conflict.serverValue, version: conflict.serverVersion }]);
        await writeJson("datos", mergeTenantDataset(allData, tenantId, next));
      });
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
    const tenantId = String(context.tenantId || conflict.localOperation?.tenantId || "");
    const visibleConflicts = tenantId ? remaining.filter((item) => belongsToTenant(item, tenantId)).length : 0;
    const visiblePending = tenantId ? queue.filter((item) => belongsToTenant(item, tenantId)).length : 0;
    publish({ conflicts: visibleConflicts, pending: visiblePending, state: visibleConflicts ? "conflict" : visiblePending ? "idle" : "synced" });
    return status;
  },
  async discardPending(operationId) {
    const next = await updateQueue((queue) => queue.filter((item) => item.id !== operationId));
    const tenantId = String(context.tenantId || "");
    const pending = tenantId ? next.filter((item) => String(item.tenantId || "") === tenantId).length : next.length;
    const conflicts = await readJson(CONFLICTS_KEY, []);
    const visibleConflicts = tenantId
      ? conflicts.filter((item) => String(item.localOperation?.tenantId || item.tenantId || "") === tenantId).length
      : conflicts.length;
    publish({ pending, conflicts: visibleConflicts, state: visibleConflicts ? "conflict" : pending ? "idle" : "synced" });
    return status;
  },
};
