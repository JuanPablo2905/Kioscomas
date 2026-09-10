import { recordsToState, stateToRecords } from "../server/postgres-record-store.mjs";

const normalize = (records) => [...records]
  .map((entry) => ({ scope: entry.scope, key: entry.key, payload: entry.payload }))
  .sort((left, right) => `${left.scope}:${left.key}`.localeCompare(`${right.scope}:${right.key}`));

const fixture = {
  schemaVersion: 5,
  cursor: 12,
  system: { cuentas: [{ id: "negocio-beta", nombreNegocio: "Prueba de restauración", pagos: [] }] },
  tenants: {
    "negocio-beta": {
      entities: {
        products: { "producto-1": { id: "producto-1", nombre: "Alfajor", deposito: 12 } },
        tickets: { "venta-1": { id: "venta-1", total: 1800 } },
      },
      sections: { caja: { abierta: true, saldo: 5000 } },
    },
  },
  users: { dueno: { id: "usuario-1", businessId: "negocio-beta", role: "owner" } },
  platformNotifications: { aviso: { id: "aviso", title: "Prueba" } },
};

const firstPass = stateToRecords(fixture);
const restored = recordsToState(firstPass.map((entry) => ({ scope: entry.scope, record_key: entry.key, payload: JSON.parse(JSON.stringify(entry.payload)) })));
const secondPass = stateToRecords(restored);
if (JSON.stringify(normalize(firstPass)) !== JSON.stringify(normalize(secondPass))) {
  throw new Error("El ensayo de respaldo no pudo reconstruir todos los registros.");
}
if (restored.tenants["negocio-beta"].entities.products["producto-1"].deposito !== 12 || restored.system.cuentas[0].id !== "negocio-beta") {
  throw new Error("El ensayo reconstruyó una copia incompleta.");
}
console.log(`Respaldo y restauración en seco: OK (${firstPass.length} registros reconstruidos).`);
