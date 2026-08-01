import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const port = 8799;
const dataDir = path.join(tmpdir(), `kiosco-cloud-test-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: {
    ...process.env,
    KIOSCO_CLOUD_PORT: String(port),
    KIOSCO_CLOUD_DB: dbPath,
    KIOSCO_CLOUD_DATA_DIR: dataDir,
    KIOSCO_LOCAL_MODE: "1",
  },
  stdio: "ignore",
});
let passed = 0;
const test = (name, value) => {
  if (!value) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};
const request = async (url, options = {}) => {
  const response = await fetch(base + url, options);
  let value = {};
  try { value = await response.json(); } catch {}
  return { response, value };
};

try {
  for (let index = 0; index < 30; index += 1) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const providers = await request("/v1/catalog/providers");
  test("servidor informa catálogos gratuitos y opcionales", providers.value.providers?.some((provider) => provider.id === "open-facts" && provider.enabled) && providers.value.providers?.some((provider) => provider.id === "go-upc" && !provider.enabled));
  const boot = await request("/v1/auth/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId: "business-a", username: "owner", password: "secret", name: "Dueño" }),
  });
  test("crear administrador inicial", boot.response.status === 201);
  const login = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "secret", deviceId: "pc-1" }),
  });
  test("login entrega sesión corta y renovación", !!login.value.accessToken && !!login.value.refreshToken);
  const headers = {
    "content-type": "application/json",
    "x-device-id": "pc-1",
    "x-tenant-id": "business-a",
    authorization: `Bearer ${login.value.accessToken}`,
  };
  const operation = { id: "op-1", deviceId: "pc-1", tenantId: "business-a", type: "entity_upsert", entity: "products", entityId: "1", value: { id: 1, nombre: "Coca de prueba", codigo: "7791234567890", categoria: "Bebidas", venta: 2500, costo: 1000, deposito: 8, historial: [{ id: "base", tipo: "creacion" }] }, baseVersion: null };
  const first = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [operation] }) });
  test("alta incremental aceptada", first.value.acceptedIds?.includes("op-1"));
  test("servidor confirma la versión aceptada", first.value.acceptedEntityVersions?.[0]?.operationId === "op-1" && first.value.acceptedEntityVersions?.[0]?.version === 1);
  const duplicate = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [operation] }) });
  test("reintento idempotente no duplica", duplicate.value.acceptedIds?.includes("op-1"));
  const catalog = await request("/v1/catalog/barcodes/7791234567890", { headers });
  test("el catálogo aprende códigos confirmados", catalog.value.product?.nombre === "Coca de prueba");
  test("el catálogo no expone precios ni stock", catalog.value.product?.venta === undefined && catalog.value.product?.deposito === undefined);
  const conflict = { ...operation, id: "op-2", value: { id: 1, nombre: "Pepsi" }, baseVersion: 99 };
  const conflicted = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [conflict] }) });
  test("conflicto de versión detectado", conflicted.value.conflicts?.[0]?.serverVersion === 1);
  const loginSecondDevice = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "secret", deviceId: "pc-2" }),
  });
  const secondDeviceHeaders = {
    ...headers,
    "x-device-id": "pc-2",
    authorization: `Bearer ${loginSecondDevice.value.accessToken}`,
  };
  const productBase = operation.value;
  const saleFromFirstDevice = {
    ...operation,
    id: "sale-pc-1",
    value: { ...productBase, deposito: 7, historial: [...productBase.historial, { id: "sale-1", tipo: "venta" }] },
    baseValue: productBase,
    baseVersion: 1,
  };
  const saleFromSecondDevice = {
    ...saleFromFirstDevice,
    id: "sale-pc-2",
    deviceId: "pc-2",
    value: { ...productBase, deposito: 7, historial: [...productBase.historial, { id: "sale-2", tipo: "venta" }] },
  };
  const firstSale = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [saleFromFirstDevice] }) });
  const secondSale = await request("/v1/sync/push", { method: "POST", headers: secondDeviceHeaders, body: JSON.stringify({ operations: [saleFromSecondDevice] }) });
  test("primera venta actualiza el stock", firstSale.value.acceptedEntityVersions?.[0]?.value?.deposito === 7);
  test("dos ventas simultáneas no generan un conflicto falso", secondSale.value.conflicts?.length === 0 && secondSale.value.acceptedIds?.includes("sale-pc-2"));
  test("se acumula el descuento de stock de ambos equipos", secondSale.value.acceptedEntityVersions?.[0]?.value?.deposito === 6 && secondSale.value.acceptedEntityVersions?.[0]?.autoMerged === true);
  test("se conservan los historiales de ambas ventas", secondSale.value.acceptedEntityVersions?.[0]?.value?.historial?.length === 3);
  const wrong = await request("/v1/sync/pull?since=0", { headers: { ...headers, "x-tenant-id": "business-b" } });
  test("una sesión no accede a otro negocio", wrong.response.status === 401);
  const refresh = await request("/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: login.value.refreshToken }),
  });
  test("renovación revoca token anterior", !!refresh.value.accessToken);

  await request("/v1/auth/register-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId: "admin", username: "demo", password: "1234", name: "Admin", superAdmin: true }),
  });
  const admin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "demo", password: "1234", deviceId: "admin-pc" }),
  });
  const adminHeaders = {
    "content-type": "application/json",
    "x-device-id": "admin-pc",
    "x-tenant-id": "business-b",
    authorization: `Bearer ${admin.value.accessToken}`,
  };
  const section = { id: "section-1", deviceId: "admin-pc", tenantId: "business-b", type: "section_set", section: "ventas", value: [{ id: 20, total: 5000 }] };
  const adminPush = await request("/v1/sync/push", { method: "POST", headers: adminHeaders, body: JSON.stringify({ operations: [section] }) });
  test("administrador puede actualizar otro negocio", adminPush.value.acceptedIds?.includes("section-1"));

  await request("/v1/auth/register-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId: "business-b", username: "owner-b", password: "1234", name: "Dueño B" }),
  });
  const ownerB = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner-b", password: "1234", deviceId: "pc-b" }),
  });
  const ownerHeaders = {
    "x-device-id": "pc-b",
    "x-tenant-id": "business-b",
    authorization: `Bearer ${ownerB.value.accessToken}`,
  };
  const ownerPull = await request("/v1/sync/pull?since=0", { headers: ownerHeaders });
  test("dueño recibe el cambio hecho por el administrador", ownerPull.value.operations?.some((item) => item.type === "section_set" && item.section === "ventas"));
  const sharedCatalog = await request("/v1/catalog/barcodes/7791234567890", { headers: ownerHeaders });
  test("otro negocio puede reutilizar el código aprendido", sharedCatalog.value.product?.nombre === "Coca de prueba");
  const mirror = JSON.parse(await fs.readFile(path.join(dataDir, "negocios", "business-b", "datos.json"), "utf8"));
  test("se crea una carpeta central por negocio", mirror.ventas?.[0]?.total === 5000);
  const backup = path.join(dataDir, "backups", new Date().toISOString().slice(0, 10), "database.json");
  test("se crea respaldo diario automático", !!(await fs.stat(backup)));
  const catalogMirror = JSON.parse(await fs.readFile(path.join(dataDir, "catalogo", "codigos-de-barras.json"), "utf8"));
  test("se crea el archivo legible del catálogo compartido", catalogMirror["7791234567890"]?.nombre === "Coca de prueba");
  console.log(`\n${passed} pruebas de nube superadas.`);
} finally {
  child.kill();
  await fs.rm(dataDir, { recursive: true, force: true });
}
