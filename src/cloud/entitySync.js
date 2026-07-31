export const SYNC_ENTITIES = ["products", "proveedores", "auditoria", "tutorialProgress"];

const byId = (items = []) => new Map(items.map((item) => [String(item.id), item]));
const comparable = (item) => { const { _syncVersion, ...value } = item || {}; return value; };

export function diffTenantEntities(previous = {}, next = {}, tenantId, deviceId, now = () => new Date().toISOString()) {
  const operations = [];
  for (const entity of SYNC_ENTITIES) {
    const before = byId(previous[entity]); const after = byId(next[entity]);
    for (const [id, value] of after) {
      const old = before.get(id);
      if (!old || JSON.stringify(comparable(old)) !== JSON.stringify(comparable(value))) operations.push({ type:"entity_upsert", entity, entityId:id, tenantId:String(tenantId), deviceId, baseVersion:old?._syncVersion ?? null, value:comparable(value), createdAt:now() });
    }
    for (const [id, old] of before) if (!after.has(id)) operations.push({ type:"entity_delete", entity, entityId:id, tenantId:String(tenantId), deviceId, baseVersion:old?._syncVersion ?? null, createdAt:now() });
  }
  return operations;
}

export function applyEntityOperations(dataset = {}, operations = []) {
  const next = { ...dataset };
  for (const operation of operations) {
    if (!SYNC_ENTITIES.includes(operation.entity)) continue;
    const items = [...(next[operation.entity] || [])]; const index = items.findIndex((item) => String(item.id) === String(operation.entityId));
    if (operation.type === "entity_delete") { if (index >= 0) items.splice(index, 1); }
    else if (operation.type === "entity_upsert") { const value = { ...operation.value, _syncVersion:operation.version }; if (index >= 0) items[index] = value; else items.push(value); }
    next[operation.entity] = items;
  }
  return next;
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
    if (JSON.stringify(previous?.[section]) !== JSON.stringify(next?.[section])) {
      operations.push({ type: "section_set", section, tenantId: String(tenantId), deviceId, value: next[section], createdAt: now() });
    }
  }
  return operations;
}

export function applySectionOperations(dataset = {}, operations = []) {
  const next = { ...dataset };
  for (const operation of operations) {
    if (operation.type === "section_delete") delete next[operation.section];
    else if (operation.type === "section_set") next[operation.section] = operation.value;
  }
  return next;
}
