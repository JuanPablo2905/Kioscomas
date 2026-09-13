import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { TERMS_VERSION } from "../src/legal/terms.js";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8817;
const dataDir = path.join(tmpdir(), `kiosco-security-recovery-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const adminSecret = "central-security-secret";
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: { ...process.env, KIOSCO_CLOUD_PORT: String(port), KIOSCO_CLOUD_DB: dbPath, KIOSCO_CLOUD_DATA_DIR: dataDir, KIOSCO_LOCAL_MODE: "1", KIOSCO_SUPERADMIN_USERNAME: "security-admin", KIOSCO_SUPERADMIN_PASSWORD: adminSecret },
  stdio: "ignore",
});
let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};
const request = async (route, options = {}) => {
  const response = await fetch(base + route, options);
  const value = await response.json().catch(() => ({}));
  return { response, value };
};
const portablePassword = (password) => {
  const salt = crypto.randomBytes(16);
  return {
    passwordHash: crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64"),
    passwordSalt: salt.toString("base64"),
    passwordVersion: 1,
  };
};
const operation = (tenantId, deviceId, values) => ({ id: crypto.randomUUID(), tenantId, deviceId, createdAt: new Date().toISOString(), ...values });

try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const ownerDevice = "security-owner-pc";
  await request("/v1/activation/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: ownerDevice, deviceKey: adminSecret, appVersion: "0.2.21" }) });
  const weak = await request("/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: ownerDevice, name: "Clave débil", email: "weak@example.com", businessName: "Débil", username: "weak-owner", password: "1234", termsAccepted: true, termsVersion: TERMS_VERSION }) });
  test("el servidor rechaza contraseñas nuevas de menos de ocho caracteres", weak.response.status === 400 && /8 caracteres/i.test(weak.value.error || ""));

  const registration = await request("/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: ownerDevice, name: "Dueña Segura", email: "owner-security@example.com", businessName: "Kiosco Seguridad", businessMode: "equipo", username: "security-owner", password: "owner-secret", termsAccepted: true, termsVersion: TERMS_VERSION }) });
  const businessId = registration.value.businessId;
  test("una contraseña válida permite crear el negocio", registration.response.status === 201 && Boolean(businessId));
  const ownerLogin = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "security-owner", password: "owner-secret", deviceId: ownerDevice }) });
  const ownerHeaders = { "content-type": "application/json", "x-device-id": ownerDevice, "x-tenant-id": businessId, authorization: `Bearer ${ownerLogin.value.accessToken}` };
  const employeePassword = portablePassword("employee-secret");
  const employee = { id: "employee-1", nombre: "Cajera", usuario: "security-cashier", email: "cashier-security@example.com", rol: "Cajero", estado: "activo", ...employeePassword };
  const savedTeam = await request("/v1/account", { method: "PUT", headers: ownerHeaders, body: JSON.stringify({ teamRevision: 0, businessMode: "equipo", roles: [{ nombre: "Cajero", permisos: ["ventas", "gestionar_personal"] }], employees: [employee] }) });
  test("el dueño publica empleados y permisos en el servidor", savedTeam.response.ok && savedTeam.value.teamRevision === 1 && savedTeam.value.account?.empleados?.length === 1);

  const employeeDevice = "security-cashier-pc";
  const employeeLogin = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: employee.usuario, password: "employee-secret", deviceId: employeeDevice }) });
  const employeeHeaders = { "content-type": "application/json", "x-device-id": employeeDevice, "x-tenant-id": businessId, authorization: `Bearer ${employeeLogin.value.accessToken}` };
  test("el empleado publicado puede iniciar sesión", employeeLogin.response.ok && employeeLogin.value.user?.role === "employee");
  const staleTeam = await request("/v1/account", { method: "PUT", headers: employeeHeaders, body: JSON.stringify({ teamRevision: 0, businessMode: "equipo", roles: [{ nombre: "Cajero", permisos: ["ventas", "gestionar_personal"] }], employees: [employee] }) });
  test("una edición atrasada del equipo se rechaza sin exponer la clave del dueño", staleTeam.response.status === 409 && staleTeam.value.teamRevision === 1 && !staleTeam.value.account?.passwordHash && !staleTeam.value.account?.passwordSalt);

  const product = { id: "product-1", nombre: "Alfajor", precio: 1200, costo: 700, deposito: 10, vitrina: 2 };
  const productCreated = await request("/v1/sync/push", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ operations: [operation(businessId, ownerDevice, { type: "entity_upsert", entity: "products", entityId: product.id, baseVersion: 0, value: product })] }) });
  test("el dueño puede crear el producto usado por la prueba", productCreated.value.acceptedEntityVersions?.[0]?.version === 1);
  const ticketOperation = operation(businessId, employeeDevice, { type: "entity_upsert", entity: "tickets", entityId: "ticket-1", baseVersion: 0, value: { id: "ticket-1", total: 1200, fecha: new Date().toISOString() } });
  const allowedSale = await request("/v1/sync/push", { method: "POST", headers: employeeHeaders, body: JSON.stringify({ operations: [ticketOperation] }) });
  test("un empleado con Ventas puede guardar una venta", allowedSale.value.acceptedIds?.includes(ticketOperation.id));
  const priceOperation = operation(businessId, employeeDevice, { type: "entity_upsert", entity: "products", entityId: product.id, baseVersion: 1, value: { ...product, precio: 9999 } });
  const deniedPrice = await request("/v1/sync/push", { method: "POST", headers: employeeHeaders, body: JSON.stringify({ operations: [priceOperation] }) });
  test("un empleado sin permiso no puede cambiar precios desde una petición fabricada", deniedPrice.value.rejected?.[0]?.operationId === priceOperation.id && deniedPrice.value.rejected?.[0]?.requiredPermissions?.includes("editar_precios"));
  const deniedDevices = await request("/v1/devices", { headers: employeeHeaders });
  test("un empleado no puede administrar dispositivos del negocio", deniedDevices.response.status === 403);
  const securityEvents = await request("/v1/security/events", { headers: ownerHeaders });
  test("el dueño puede auditar intentos rechazados", securityEvents.value.events?.some((event) => event.operationType === "entity_upsert" && event.target === "products" && event.outcome === "denied"));

  const roleChanged = await request("/v1/account", { method: "PUT", headers: ownerHeaders, body: JSON.stringify({ teamRevision: 1, businessMode: "equipo", roles: [{ nombre: "Sin acceso", permisos: [] }], employees: [{ ...employee, rol: "Sin acceso" }] }) });
  test("cambiar el rol aumenta la versión del equipo", roleChanged.response.ok && roleChanged.value.teamRevision === 2);
  const oldSessionAttempt = await request("/v1/sync/push", { method: "POST", headers: employeeHeaders, body: JSON.stringify({ operations: [operation(businessId, employeeDevice, { type: "entity_upsert", entity: "tickets", entityId: "ticket-old-session", baseVersion: 0, value: { id: "ticket-old-session", total: 1 } })] }) });
  test("cambiar el rol corta inmediatamente la sesión anterior", oldSessionAttempt.response.status === 401);
  const relogin = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: employee.usuario, password: "employee-secret", deviceId: employeeDevice }) });
  const restrictedHeaders = { ...employeeHeaders, authorization: `Bearer ${relogin.value.accessToken}` };
  const restrictedOperation = operation(businessId, employeeDevice, { type: "entity_upsert", entity: "tickets", entityId: "ticket-restricted", baseVersion: 0, value: { id: "ticket-restricted", total: 1 } });
  const restrictedSale = await request("/v1/sync/push", { method: "POST", headers: restrictedHeaders, body: JSON.stringify({ operations: [restrictedOperation] }) });
  test("la sesión nueva usa los permisos actuales del servidor", restrictedSale.value.rejected?.some((entry) => entry.operationId === restrictedOperation.id));
  const employeeDeleted = await request("/v1/account", { method: "PUT", headers: ownerHeaders, body: JSON.stringify({ teamRevision: 2, businessMode: "equipo", roles: [{ nombre: "Sin acceso", permisos: [] }], employees: [] }) });
  test("el dueño puede eliminar el empleado en la nube", employeeDeleted.response.ok && employeeDeleted.value.account?.empleados?.length === 0);
  const deletedSessionAttempt = await request("/v1/security/events", { headers: restrictedHeaders });
  test("eliminar el empleado invalida también la sesión que tenía abierta", deletedSessionAttempt.response.status === 401);

  const snapshotDay = "2026-09-10";
  const snapshot = JSON.parse(await fs.readFile(dbPath, "utf8"));
  await fs.mkdir(path.join(dataDir, "backups", snapshotDay), { recursive: true });
  await fs.writeFile(path.join(dataDir, "backups", snapshotDay, "database.json"), JSON.stringify(snapshot));
  const secondProduct = operation(businessId, ownerDevice, { type: "entity_upsert", entity: "products", entityId: "product-2", baseVersion: 0, value: { id: "product-2", nombre: "Gaseosa", precio: 2000 } });
  await request("/v1/sync/push", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ operations: [secondProduct] }) });
  const backups = await request("/v1/recovery/backups", { headers: ownerHeaders });
  test("el dueño puede ver las fechas de respaldo disponibles", backups.value.backups?.some((backup) => backup.day === snapshotDay));
  const preview = await request("/v1/recovery/preview", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ backupDay: snapshotDay }) });
  test("la recuperación muestra una comparación antes de tocar datos", preview.response.ok && preview.value.current?.totalRecords > preview.value.backup?.totalRecords);
  const exported = await request("/v1/recovery/export", { headers: ownerHeaders });
  const serializedExport = JSON.stringify(exported.value);
  test("la exportación incluye los datos y excluye credenciales", exported.value.export?.data?.products?.length === 2 && !/passwordHash|passwordSalt|refreshToken|accessToken/.test(serializedExport));
  const wrongConfirmation = await request("/v1/recovery/restore", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ backupDay: snapshotDay, confirmation: "otro negocio" }) });
  test("una recuperación no se ejecuta sin confirmación exacta", wrongConfirmation.response.status === 400);
  const restored = await request("/v1/recovery/restore", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ backupDay: snapshotDay, confirmation: "Kiosco Seguridad" }) });
  test("el dueño puede recuperar sólo los datos operativos del negocio", restored.response.ok && Boolean(restored.value.recoveryPointId));
  const bootstrap = await request("/v1/sync/bootstrap", { headers: ownerHeaders });
  test("la copia recuperada reemplaza los datos más nuevos", bootstrap.value.dataset?.products?.length === 1 && bootstrap.value.dataset.products[0].id === "product-1");
  const loginAfterRestore = await request("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "security-owner", password: "owner-secret", deviceId: ownerDevice }) });
  test("recuperar datos no reemplaza la contraseña ni el acceso del dueño", loginAfterRestore.response.ok);
  const recoveryPoints = await fs.readdir(path.join(dataDir, "recovery-points", businessId));
  test("antes de restaurar se guarda una copia automática para soporte", recoveryPoints.length === 1);

  console.log(`\n${passed} pruebas de seguridad y recuperación superadas.`);
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
