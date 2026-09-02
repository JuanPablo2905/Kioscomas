export const CLOUD_SCHEMA_VERSION = 1;
export const SYNCABLE_KEYS = new Set(["datos", "reportesProblemas", "menuPreferences", "userPreferences"]);
// Las colecciones con identidad propia viajan registro por registro. Así dos
// cajas pueden crear ventas distintas sin reemplazarse mutuamente con una
// copia completa de la lista.
export const SYNCABLE_ENTITIES = new Set([
  "products",
  "tickets",
  "clientes",
  "comprasItems",
  "proveedores",
  "perdidas",
  "sugerencias",
  "pedidos",
  "gastos",
  "ventasSuspendidas",
  "auditoria",
  "inventarios",
  "tareas",
  "metas",
  "promociones",
  "reservas",
  "presupuestos",
  "arqueos",
  "comprobantes",
  "listaCompras",
  "retornables",
  "autoconsumos",
  "turnos",
  "recordatoriosProveedor",
  "movimientosStock",
  "historialLimpiezas",
  "labelTemplates",
  "tutorialProgress",
]);

export function normalizeOperation(operation) {
  if (!operation || typeof operation !== "object") return null;
  if (!operation.id || !operation.deviceId || !operation.tenantId) return null;
  const snapshot = ["set", "delete"].includes(operation.type) && SYNCABLE_KEYS.has(operation.key);
  const entity = ["entity_upsert", "entity_delete"].includes(operation.type) && SYNCABLE_ENTITIES.has(operation.entity) && operation.entityId != null;
  const section = ["section_set", "section_delete"].includes(operation.type) && operation.section;
  const system = operation.type === "system_set" && operation.key === "cuentas";
  if (!snapshot && !entity && !section && !system) return null;
  return { ...operation, tenantId: String(operation.tenantId), schemaVersion: Number(operation.schemaVersion || CLOUD_SCHEMA_VERSION) };
}

export function mergeTenantDataset(allData, tenantId, tenantData) {
  return { ...(allData || {}), [String(tenantId)]: tenantData };
}

export function extractTenantValue(key, value, tenantId) {
  if (key !== "datos") return value;
  return value?.[tenantId] ?? value?.[Number(tenantId)] ?? null;
}
