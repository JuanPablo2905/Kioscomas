import assert from "node:assert/strict";
import { cleanV2Seed, recordsToState, stateToRecords } from "../server/postgres-record-store.mjs";

const state = {
  schemaVersion: 4,
  cursor: 7,
  accepted: { "operation-1": 7 },
  system: { cuentas: [{ id: "business-a", nombreNegocio: "Comercio A" }] },
  tenants: {
    "business-a": { entities: { products: { 1: { value: { id: 1, nombre: "Producto" }, version: 1 } } }, sections: {} },
    "business-b": { entities: {}, sections: { ventas: [{ id: 2, total: 500 }] } },
  },
  changes: [{ id: "operation-1", cursor: 7, tenantId: "business-a", type: "entity_upsert" }],
  devices: { "device-a": { tenantId: "business-a" } },
  users: { owner: { id: "owner", businessId: "business-a" } },
  sessions: { token: { userId: "owner" } },
  barcodeCatalog: { 7791: { status: "verified" } },
  activationCodes: { code: { uses: 0 } },
  activations: { "device-a": { id: "activation-a" } },
};

const rows = stateToRecords(state).map(({ scope, key, payload }) => ({ scope, record_key: key, payload }));
assert.deepEqual(recordsToState(rows), state, "el estado debe sobrevivir una ida y vuelta por registros");

const scopes = new Set(rows.map((entry) => entry.scope));
for (const expected of ["meta", "system", "account", "tenant", "tenant_section", "tenant_entity", "change", "accepted", "device", "user", "session", "catalog", "activation_code", "activation"]) {
  assert.equal(scopes.has(expected), true, `falta separar el alcance ${expected}`);
}

const tenantRows = rows.filter((entry) => entry.scope === "tenant");
assert.equal(tenantRows.length, 2, "cada negocio debe guardar sus valores generales por separado");
assert.notEqual(tenantRows[0].record_key, tenantRows[1].record_key);
assert.equal(rows.filter((entry) => entry.scope === "tenant_entity").length, 1, "cada producto debe ser un registro independiente");
assert.equal(rows.filter((entry) => entry.scope === "tenant_section").length, 1, "cada sección debe ser un registro independiente");
assert.equal(rows.filter((entry) => entry.scope === "account").length, 1, "cada cuenta comercial debe guardarse por separado");

const changedState = structuredClone(state);
changedState.tenants["business-a"].entities.products[1].value.nombre = "Producto actualizado";
const before = new Map(stateToRecords(state).map((entry) => [`${entry.scope}:${entry.key}`, JSON.stringify(entry.payload)]));
const after = new Map(stateToRecords(changedState).map((entry) => [`${entry.scope}:${entry.key}`, JSON.stringify(entry.payload)]));
const changedKeys = [...after].filter(([key, payload]) => before.get(key) !== payload).map(([key]) => key);
assert.deepEqual(changedKeys, ['tenant_entity:["business-a","products","1"]'], "editar un producto no debe reescribir el resto del negocio");

const cleanSeed = cleanV2Seed(
  { users: { admin: { id: "admin", role: "superAdmin", businessId: "system-admin" } } },
  {
    system: { cuentas: [{ id: "fake-business" }] },
    tenants: { "fake-business": { sections: { tickets: [{ id: 1 }] } } },
    users: { customer: { id: "customer" } },
    devices: {
      "admin-pc": { tenantId: "system-admin", revokedAt: null },
      "customer-pc": { tenantId: "fake-business", revokedAt: null },
    },
    activations: {
      "admin-pc": { id: "admin-activation", revokedAt: null },
      "customer-pc": { id: "customer-activation", revokedAt: null },
    },
  },
);
assert.deepEqual(cleanSeed.system.cuentas, [], "el corte limpio no debe importar negocios ficticios");
assert.deepEqual(Object.keys(cleanSeed.tenants), [], "el corte limpio no debe importar movimientos ficticios");
assert.deepEqual(Object.keys(cleanSeed.users), ["admin"], "sólo se conserva la cuenta administradora configurada");
assert.deepEqual(Object.keys(cleanSeed.devices), ["admin-pc"], "se conserva únicamente la PC administradora reconocida");
assert.deepEqual(Object.keys(cleanSeed.activations), ["admin-pc"], "se conserva únicamente su activación administradora");

console.log("postgres-record-store-tests: almacenamiento por registro verificado");
