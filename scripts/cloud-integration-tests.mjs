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
    KIOSCO_SUPERADMIN_USERNAME: "central-admin",
    KIOSCO_SUPERADMIN_PASSWORD: "central-admin-secret",
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
  const configuredAdminLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "central-admin", password: "central-admin-secret", deviceId: "central-pc" }),
  });
  test("la cuenta central configurada inicia como superadministrador", configuredAdminLogin.value.user?.role === "superAdmin");
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
  const deniedCatalogAdmin = await request("/v1/admin/catalog?status=all", { headers });
  test("un dueno de negocio no puede modificar el catalogo global", deniedCatalogAdmin.response.status === 403);
  const pendingVerification = await request("/v1/catalog/verify-pending", {
    method: "POST",
    headers,
    body: JSON.stringify({ codigo: "7790000000007" }),
  });
  test("un negocio puede enviar un codigo desconocido a verificar", pendingVerification.response.status === 202 && pendingVerification.value.item?.status === "pending");
  await request("/v1/auth/register-local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId: "system-admin", username: "catalog-admin", password: "admin-secret", name: "Admin", superAdmin: true }),
  });
  const catalogAdminLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "catalog-admin", password: "admin-secret", deviceId: "admin-pc" }),
  });
  const catalogAdminHeaders = {
    "content-type": "application/json",
    "x-device-id": "admin-pc",
    "x-tenant-id": "system-admin",
    authorization: `Bearer ${catalogAdminLogin.value.accessToken}`,
  };
  const pendingCatalogList = await request("/v1/admin/catalog?query=7790000000007&status=pending", { headers: catalogAdminHeaders });
  test("el administrador central recibe los codigos pendientes", pendingCatalogList.value.items?.[0]?.codigo === "7790000000007");
  const manualCatalog = await request("/v1/admin/catalog/7799999999991", {
    method: "PUT",
    headers: catalogAdminHeaders,
    body: JSON.stringify({ product: { nombre: "Producto verificado manualmente", categoria: "Almacen", imagenUrl: "https://example.com/producto.jpg", unidad: "unidad" } }),
  });
  test("el administrador puede agregar un producto verificado", manualCatalog.response.ok && manualCatalog.value.status === "verified");
  const catalogAdminList = await request("/v1/admin/catalog?query=7799999999991&status=verified", { headers: catalogAdminHeaders });
  test("el panel administrativo puede buscar el producto agregado", catalogAdminList.value.items?.[0]?.product?.nombre === "Producto verificado manualmente");
  const publicManualCatalog = await request("/v1/catalog/lookup/7799999999991");
  test("el escaner recibe inmediatamente la correccion manual", publicManualCatalog.value.product?.nombre === "Producto verificado manualmente");
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
  const [firstSale, secondSale] = await Promise.all([
    request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [saleFromFirstDevice] }) }),
    request("/v1/sync/push", { method: "POST", headers: secondDeviceHeaders, body: JSON.stringify({ operations: [saleFromSecondDevice] }) }),
  ]);
  const simultaneousSales = [firstSale, secondSale];
  const simultaneousVersions = simultaneousSales.map((result) => result.value.acceptedEntityVersions?.[0]).sort((left, right) => left.version - right.version);
  test("primera venta actualiza el stock", simultaneousVersions[0]?.value?.deposito === 7);
  test("dos ventas realmente simultáneas no generan un conflicto falso", simultaneousSales.every((result) => result.value.conflicts?.length === 0));
  test("se acumula el descuento de stock de ambos equipos", simultaneousVersions[1]?.value?.deposito === 6 && simultaneousVersions[1]?.autoMerged === true);
  test("se conservan los historiales de ambas ventas", simultaneousVersions[1]?.value?.historial?.length === 3);
  const burstSale = { ...saleFromFirstDevice, id: "sale-burst-pc-1", baseVersion: simultaneousVersions[0].version, baseValue: simultaneousVersions[0].value, value: { ...simultaneousVersions[0].value, deposito: 2, historial: [productBase.historial[0], ...Array.from({ length: 5 }, (_, index) => ({ id: `burst-${index + 1}`, tipo: "venta" }))] } };
  const burstResult = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [burstSale] }) });
  test("una ráfaga de cinco ventas no genera conflictos", burstResult.value.conflicts?.length === 0 && burstResult.value.acceptedIds?.includes("sale-burst-pc-1"));
  test("la ráfaga aplica las cinco unidades sobre el stock más nuevo", burstResult.value.acceptedEntityVersions?.[0]?.value?.deposito === 1);
  test("la ráfaga conserva eventos locales y remotos aunque el historial local esté atrasado", burstResult.value.acceptedEntityVersions?.[0]?.value?.historial?.length === 8);
  const stressBase = { id: 2, nombre: "Producto de estrés", deposito: 100, vitrina: 0, historial: [{ id: "stress-base", tipo: "creacion" }] };
  const stressSeed = await request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [{ ...operation, id: "stress-seed", entityId: "2", value: stressBase }] }) });
  const stressVersion = stressSeed.value.acceptedEntityVersions?.[0]?.version;
  const stressResults = await Promise.all(Array.from({ length: 20 }, (_, index) => request("/v1/sync/push", {
    method: "POST", headers, body: JSON.stringify({ operations: [{ ...operation, id: `stress-sale-${index + 1}`, entityId: "2", baseVersion: stressVersion, baseValue: stressBase, value: { ...stressBase, deposito: 99, historial: [...stressBase.historial, { id: `stress-history-${index + 1}`, tipo: "venta" }] } }] }),
  })));
  const stressVersions = stressResults.map((result) => result.value.acceptedEntityVersions?.[0]).filter(Boolean).sort((left, right) => left.version - right.version);
  test("veinte envíos simultáneos no pierden escrituras ni generan conflictos", stressVersions.length === 20 && stressResults.every((result) => result.value.conflicts?.length === 0));
  test("la prueba de estrés acumula las veinte ventas", stressVersions.at(-1)?.value?.deposito === 80);
  test("la prueba de estrés conserva los veinte eventos", stressVersions.at(-1)?.value?.historial?.length === 21);
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
    "content-type": "application/json",
    "x-device-id": "pc-b",
    "x-tenant-id": "business-b",
    authorization: `Bearer ${ownerB.value.accessToken}`,
  };
  const forbiddenSystemChange = { id: "owner-system-1", deviceId: "pc-b", tenantId: "business-b", type: "system_set", key: "cuentas", value: [] };
  const ownerSystemPush = await request("/v1/sync/push", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ operations: [forbiddenSystemChange] }) });
  test("un cambio global sin permiso se rechaza explícitamente", ownerSystemPush.value.rejected?.some((item) => item.operationId === "owner-system-1" && item.reason === "system_admin_required"));
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
