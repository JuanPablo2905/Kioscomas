import { SYNCABLE_ENTITIES } from "./protocol.js";

export const SYNC_ENTITIES = [...SYNCABLE_ENTITIES];

const NESTED_ENTITY_KEYS = {
  cajaMovimientos: "movimientos",
  cajaHistorial: "historial",
  cajaEstado: "estado",
};
const entityItems = (dataset = {}, entity) => {
  if (entity === "cajaEstado") return dataset.caja ? [{ id: "actual", saldo: Number(dataset.caja.saldo || 0), _syncVersion: dataset.caja._syncSaldoVersion }] : [];
  const nestedKey = NESTED_ENTITY_KEYS[entity];
  return nestedKey ? (dataset.caja?.[nestedKey] || []) : (dataset[entity] || []);
};
const withEntityItems = (dataset = {}, entity, items = []) => {
  if (entity === "cajaEstado") {
    const state = items.find((item) => String(item?.id) === "actual");
    if (!state) return dataset;
    return { ...dataset, caja: { ...(dataset.caja || {}), saldo: Number(state.saldo || 0), _syncSaldoVersion: Number(state._syncVersion || 0) } };
  }
  const nestedKey = NESTED_ENTITY_KEYS[entity];
  if (!nestedKey) return { ...dataset, [entity]: items };
  return { ...dataset, caja: { ...(dataset.caja || {}), [nestedKey]: items } };
};
const cajaSectionValue = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { movimientos: _movimientos, historial: _historial, saldo: _saldo, _syncSaldoVersion: _syncSaldoVersion, ...rest } = value;
  return rest;
};
const comparableSection = (section, value) => section === "caja" ? cajaSectionValue(value) : value;
const byId = (items = []) => new Map(items.map((item) => [String(item.id), item]));
const comparable = (item) => { const { _syncVersion, ...value } = item || {}; return value; };

export function diffTenantEntities(previous = {}, next = {}, tenantId, deviceId, now = () => new Date().toISOString()) {
  const operations = [];
  for (const entity of SYNC_ENTITIES) {
    const before = byId(entityItems(previous, entity)); const after = byId(entityItems(next, entity));
    for (const [id, value] of after) {
      const old = before.get(id);
      const needsNestedMigration = Boolean(NESTED_ENTITY_KEYS[entity]) && value?._syncVersion == null;
      if (!old || needsNestedMigration || JSON.stringify(comparable(old)) !== JSON.stringify(comparable(value))) operations.push({ type:"entity_upsert", entity, entityId:id, tenantId:String(tenantId), deviceId, baseVersion:old?._syncVersion ?? null, baseValue:old ? comparable(old) : null, value:comparable(value), createdAt:now() });
    }
    for (const [id, old] of before) if (!after.has(id)) operations.push({ type:"entity_delete", entity, entityId:id, tenantId:String(tenantId), deviceId, baseVersion:old?._syncVersion ?? null, createdAt:now() });
  }
  return operations;
}

export function applyEntityOperations(dataset = {}, operations = []) {
  const next = { ...dataset };
  for (const operation of operations) {
    if (!SYNC_ENTITIES.includes(operation.entity)) continue;
    const items = [...entityItems(next, operation.entity)]; const index = items.findIndex((item) => String(item.id) === String(operation.entityId));
    if (operation.type === "entity_delete") { if (index >= 0) items.splice(index, 1); }
    else if (operation.type === "entity_upsert") { const value = { ...operation.value, _syncVersion:operation.version }; if (index >= 0) items[index] = value; else items.push(value); }
    Object.assign(next, withEntityItems(next, operation.entity, items));
  }
  return next;
}

const sameEntity = (left, right) => left?.entity === right?.entity
  && String(left?.entityId) === String(right?.entityId);

// A server response may arrive after the user already changed the same product
// again. In that case only confirm the version: never replace the newer local
// value with the older value contained in the acknowledgement.
export function applyAcceptedEntityVersions(dataset = {}, pendingQueue = [], acceptedVersions = [], acceptedIds = [], tenantId = null, pushedOperations = []) {
  const accepted = new Set(acceptedIds);
  const next = { ...dataset };
  for (const ack of acceptedVersions) {
    const items = [...entityItems(next, ack.entity)];
    const index = items.findIndex((item) => String(item.id) === String(ack.entityId));
    const pushed = pushedOperations.find((item) => item.id === ack.operationId);
    const hasNewerLocalValue = index >= 0 && pushed?.type === "entity_upsert"
      && JSON.stringify(comparable(items[index])) !== JSON.stringify(pushed.value);
    const hasNewerPending = pendingQueue.some((item) => (
      (!tenantId || String(item.tenantId) === String(tenantId))
      && sameEntity(item, ack)
      && item.id !== ack.operationId
      && !accepted.has(item.id)
    ));
    if (index >= 0) {
      items[index] = hasNewerPending || hasNewerLocalValue || !ack.value
        ? { ...items[index], _syncVersion: Number(ack.version || 0) }
        : { ...ack.value, _syncVersion: Number(ack.version || 0) };
    } else if (!hasNewerPending && ack.value) {
      items.push({ ...ack.value, _syncVersion: Number(ack.version || 0) });
    }
    Object.assign(next, withEntityItems(next, ack.entity, items));
  }
  return next;
}

export function rebasePendingEntityOperations(queue = [], acceptedVersions = []) {
  return queue.map((item) => {
    const ack = acceptedVersions.find((entry) => sameEntity(entry, item));
    return ack ? {
      ...item,
      baseVersion: Number(ack.version || 0),
      baseValue: ack.value ?? item.baseValue,
    } : item;
  });
}

export function diffTenantSections(previous = {}, next = {}, tenantId, deviceId, now = () => new Date().toISOString()) {
  const operations = [];
  const entitySections = new Set(SYNC_ENTITIES);
  const sections = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  for (const section of sections) {
    if (entitySections.has(section)) continue;
    if (!(section in (next || {}))) {
      operations.push({ type: "section_delete", section, tenantId: String(tenantId), deviceId, createdAt: now() });
      continue;
    }
    const previousValue = comparableSection(section, previous?.[section]);
    const nextValue = comparableSection(section, next?.[section]);
    if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      operations.push({ type: "section_set", section, tenantId: String(tenantId), deviceId, value: nextValue, createdAt: now() });
    }
  }
  return operations;
}

export function applySectionOperations(dataset = {}, operations = []) {
  const next = { ...dataset };
  for (const operation of operations) {
    if (operation.type === "section_delete") delete next[operation.section];
    else if (operation.type === "section_set") {
      if (operation.section === "caja") {
        const suppliedSaldo = operation.value && Object.prototype.hasOwnProperty.call(operation.value, "saldo");
        next[operation.section] = {
          ...(operation.value || {}),
          saldo: suppliedSaldo ? Number(operation.value.saldo || 0) : Number(next.caja?.saldo || 0),
          _syncSaldoVersion: Number(next.caja?._syncSaldoVersion || 0),
          movimientos: next.caja?.movimientos || [],
          historial: next.caja?.historial || [],
        };
      } else next[operation.section] = operation.value;
    }
  }
  return next;
}
