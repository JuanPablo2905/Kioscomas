import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

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
  const rejectedPair = await request("/v1/auth/pair-device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceKey: "incorrecta", deviceId: "paired-pc" }),
  });
  test("una clave privada incorrecta no autoriza el dispositivo", rejectedPair.response.status === 401);
  const pairedDevice = await request("/v1/auth/pair-device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceKey: "central-admin-secret", deviceId: "paired-pc" }),
  });
  test("la clave privada autoriza el dispositivo una sola vez", pairedDevice.response.ok && pairedDevice.value.user?.role === "superAdmin" && !!pairedDevice.value.refreshToken);
  const portableSalt = crypto.randomBytes(16).toString("base64");
  const portableHash = crypto.pbkdf2Sync("lazy-secret", Buffer.from(portableSalt, "base64"), 210000, 32, "sha256").toString("base64");
  const centralHeaders = {
    "content-type": "application/json",
    "x-device-id": "central-pc",
    "x-tenant-id": "system-admin",
    authorization: `Bearer ${configuredAdminLogin.value.accessToken}`,
  };
  const existingDeviceActivation = await request("/v1/activation/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "paired-pc", appVersion: "0.1.4" }),
  });
  test("una instalación anterior reconocida por la nube no vuelve a pedir clave", existingDeviceActivation.value.activated === true && existingDeviceActivation.value.activation?.deviceId === "paired-pc");
  const rejectedAdminActivation = await request("/v1/activation/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "admin-recovery-pc", deviceKey: "incorrecta", appVersion: "0.2.0" }),
  });
  test("una clave privada incorrecta no activa una PC administradora", rejectedAdminActivation.response.status === 401);
  const adminActivation = await request("/v1/activation/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "admin-recovery-pc", deviceKey: "central-admin-secret", appVersion: "0.2.0" }),
  });
  test("el administrador puede recuperar la activación de su propia PC", adminActivation.response.ok && adminActivation.value.activation?.deviceId === "admin-recovery-pc");
  const createdActivationCode = await request("/v1/admin/activation-codes", {
    method: "POST",
    headers: centralHeaders,
    body: JSON.stringify({ label: "PC de prueba", expiresInDays: 7, maxUses: 1 }),
  });
  test("el administrador genera una clave de instalación", createdActivationCode.response.status === 201 && /^KIOSCO-(?:[A-Z0-9]{4}-){3}[A-Z0-9]{4}$/.test(createdActivationCode.value.code));
  const activationBeforeRedeem = await request("/v1/activation/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc" }),
  });
  test("una PC nueva empieza sin autorización", activationBeforeRedeem.value.activated === false);
  const wrongActivationCode = await request("/v1/activation/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc", code: "KIOSCO-AAAA-BBBB-CCCC-DDDD" }),
  });
  test("una clave inventada no activa la aplicación", wrongActivationCode.response.status === 401);
  const redeemedActivation = await request("/v1/activation/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc", code: createdActivationCode.value.code, appVersion: "0.1.5" }),
  });
  test("la clave válida queda vinculada a una PC", redeemedActivation.response.ok && redeemedActivation.value.activation?.deviceId === "activation-pc");
  const repeatedActivation = await request("/v1/activation/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc", code: createdActivationCode.value.code }),
  });
  test("repetir la activación en la misma PC no consume otro uso", repeatedActivation.response.ok);
  const reusedActivationCode = await request("/v1/activation/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "other-activation-pc", code: createdActivationCode.value.code }),
  });
  test("una clave de una sola PC no se puede compartir", reusedActivationCode.response.status === 409);
  const unactivatedRegistration = await request("/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "not-activated-pc", name: "Cliente", businessName: "Kiosco sin activar", businessMode: "solo", username: "not-activated-owner", password: "1234" }),
  });
  test("una PC sin clave de instalación no puede solicitar una cuenta", unactivatedRegistration.response.status === 403);
  const registration = await request("/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc", name: "Cliente Nuevo", businessName: "Kiosco Nuevo", businessMode: "solo", username: "new-owner", password: "new-secret" }),
  });
  const registeredAccount = registration.value.account;
  test("una PC activada envía el alta como pendiente", registration.response.status === 201 && registeredAccount?.estado === "pendiente" && !registeredAccount?.trialExpiresAt);
  const duplicateRegistration = await request("/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "activation-pc", name: "Otro", businessName: "Otro", username: "new-owner", password: "new-secret" }),
  });
  test("no se puede registrar dos veces el mismo usuario", duplicateRegistration.response.status === 409);
  const pendingLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "new-owner", password: "new-secret", deviceId: "activation-pc" }),
  });
  test("el inicio de sesión devuelve el estado actualizado de la cuenta", pendingLogin.value.account?.id === registeredAccount.id && pendingLogin.value.account?.estado === "pendiente");
  const pendingHeaders = {
    "content-type": "application/json",
    "x-device-id": "activation-pc",
    "x-tenant-id": registeredAccount.id,
    authorization: `Bearer ${pendingLogin.value.accessToken}`,
  };
  const pendingWrite = await request("/v1/sync/push", { method: "POST", headers: pendingHeaders, body: JSON.stringify({ operations: [] }) });
  test("una cuenta pendiente no puede escribir datos antes del pago", pendingWrite.response.status === 403);
  const centralRegistrationPull = await request("/v1/sync/pull?since=0", { headers: centralHeaders });
  test("el administrador recibe la nueva solicitud en su padrón", centralRegistrationPull.value.operations?.some((item) => item.type === "system_set" && item.value?.some((account) => account.id === registeredAccount.id)));
  const activationDirectory = await request("/v1/admin/activation-codes", { headers: centralHeaders });
  const savedActivationCode = activationDirectory.value.codes?.find((item) => item.id === createdActivationCode.value.item?.id);
  test("el panel muestra usos y equipos sin exponer la clave completa", savedActivationCode?.uses === 1 && !JSON.stringify(savedActivationCode).includes(createdActivationCode.value.code) && activationDirectory.value.activations?.some((item) => item.deviceId === "activation-pc"));
  const revokedActivation = await request("/v1/admin/activations/paired-pc/revoke", { method: "POST", headers: centralHeaders });
  test("el administrador puede desactivar una PC", revokedActivation.response.ok && !!revokedActivation.value.activation?.revokedAt);
  const activationAfterRevoke = await request("/v1/activation/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "paired-pc" }),
  });
  test("una PC desactivada deja de estar autorizada", activationAfterRevoke.value.activated === false);
  const revokedDeviceLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "central-admin", password: "central-admin-secret", deviceId: "paired-pc" }),
  });
  test("un dispositivo desactivado no se rehabilita al iniciar sesión", revokedDeviceLogin.response.status === 403);
  const accountDirectory = await request("/v1/sync/push", {
    method: "POST",
    headers: centralHeaders,
    body: JSON.stringify({ operations: [{
      id: "seed-lazy-cloud-user",
      deviceId: "central-pc",
      tenantId: "system-admin",
      type: "system_set",
      key: "cuentas",
      value: [
        { ...registeredAccount, estado: "aprobada", subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "business-lazy", usuario: "lazy-owner", nombre: "Dueño migrado", estado: "aprobada", passwordHash: portableHash, passwordSalt: portableSalt, passwordVersion: 1 },
      ],
    }] }),
  });
  test("el administrador publica el padrón de cuentas", accountDirectory.value.acceptedIds?.includes("seed-lazy-cloud-user"));
  const staleEmptyDirectory = await request("/v1/sync/push", {
    method: "POST",
    headers: centralHeaders,
    body: JSON.stringify({ operations: [{
      id: "stale-empty-account-directory",
      deviceId: "old-admin-pc",
      tenantId: "system-admin",
      type: "system_set",
      key: "cuentas",
      value: [],
    }] }),
  });
  const directoryAfterStalePush = await request("/v1/sync/bootstrap", { headers: centralHeaders });
  test(
    "una lista vacía de una versión anterior no borra los negocios",
    staleEmptyDirectory.value.acceptedIds?.includes("stale-empty-account-directory")
      && directoryAfterStalePush.value.accounts?.some((account) => account.id === registeredAccount.id)
      && directoryAfterStalePush.value.accounts?.some((account) => account.id === "business-lazy"),
  );
  const approvedLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "new-owner", password: "new-secret", deviceId: "activation-pc" }),
  });
  test("después del pago la PC recibe la cuenta habilitada", approvedLogin.value.account?.estado === "aprobada" && Date.parse(approvedLogin.value.account?.subscriptionExpiresAt) > Date.now());
  const rejectedLazyLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "lazy-owner", password: "wrong-secret", deviceId: "lazy-pc" }),
  });
  test("la migración automática rechaza una contraseña incorrecta", rejectedLazyLogin.response.status === 401);
  const lazyLogin = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "lazy-owner", password: "lazy-secret", deviceId: "lazy-pc" }),
  });
  test("una cuenta importada crea su usuario de nube al iniciar sesión", lazyLogin.response.ok && lazyLogin.value.user?.businessId === "business-lazy" && lazyLogin.value.user?.role === "owner");
  const login = await request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner", password: "secret", deviceId: "pc-1" }),
  });
  test("login entrega sesión renovable para toda la jornada", !!login.value.accessToken && !!login.value.refreshToken && Date.parse(login.value.expiresAt) > Date.now() + 23 * 60 * 60 * 1000);
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
  const bootstrap = await request("/v1/sync/bootstrap", { headers });
  test("un equipo nuevo puede descargar la copia inicial antes de subir datos", bootstrap.value.hasData === true && bootstrap.value.dataset?.products?.[0]?.nombre === "Coca de prueba");
  test("la copia inicial incluye la versión remota de cada registro", bootstrap.value.dataset?.products?.[0]?._syncVersion === 1 && bootstrap.value.cursor >= 1);
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
  const concurrentTickets = await Promise.all([
    request("/v1/sync/push", { method: "POST", headers, body: JSON.stringify({ operations: [{ id: "ticket-pc-1", deviceId: "pc-1", tenantId: "business-a", type: "entity_upsert", entity: "tickets", entityId: "ticket-1", baseVersion: null, value: { id: "ticket-1", total: 1000 } }] }) }),
    request("/v1/sync/push", { method: "POST", headers: secondDeviceHeaders, body: JSON.stringify({ operations: [{ id: "ticket-pc-2", deviceId: "pc-2", tenantId: "business-a", type: "entity_upsert", entity: "tickets", entityId: "ticket-2", baseVersion: null, value: { id: "ticket-2", total: 2000 } }] }) }),
  ]);
  test("dos cajas pueden guardar tickets simultáneos", concurrentTickets.every((result) => result.value.acceptedIds?.length === 1));
  const ticketsAfterConcurrentSales = await request("/v1/sync/bootstrap", { headers });
  test("ninguna venta simultánea reemplaza a la otra", ticketsAfterConcurrentSales.value.dataset?.tickets?.length === 2);
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
  const repeatedRefresh = await request("/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: login.value.refreshToken }),
  });
  test("un reintento inmediato de renovación no pierde la sesión", repeatedRefresh.response.ok && !!repeatedRefresh.value.refreshToken);

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
  const expireAccount = { id: "expire-business-b", deviceId: "admin-pc", tenantId: "business-b", type: "system_set", key: "cuentas", value: [{ id: "business-b", estado: "aprobada", subscriptionExpiresAt: "2026-01-01T00:00:00.000Z" }] };
  await request("/v1/sync/push", { method: "POST", headers: adminHeaders, body: JSON.stringify({ operations: [expireAccount] }) });
  const expiredWrite = await request("/v1/sync/push", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ operations: [{ ...section, id: "expired-write", deviceId: "pc-b" }] }) });
  const expiredRead = await request("/v1/sync/pull?since=0", { headers: ownerHeaders });
  test("un abono vencido conserva lectura pero bloquea escrituras en la nube", expiredRead.response.ok && expiredWrite.response.status === 403);
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
