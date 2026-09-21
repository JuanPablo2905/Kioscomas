import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { TERMS_VERSION } from "../src/legal/terms.js";
import { createEmailService } from "../server/email-service.mjs";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8804;
const dataDir = path.join(tmpdir(), `kiosco-password-recovery-test-${Date.now()}`);
const dbPath = path.join(dataDir, "database.json");
const base = `http://127.0.0.1:${port}`;
const adminUsername = "recovery-test-admin";
const adminPassword = "recovery-test-secret";
const accountEmail = "owner.recovery@example.com";
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: {
    ...process.env,
    KIOSCO_CLOUD_PORT: String(port),
    KIOSCO_CLOUD_DB: dbPath,
    KIOSCO_CLOUD_DATA_DIR: dataDir,
    KIOSCO_LOCAL_MODE: "1",
    KIOSCO_EMAIL_TEST_MODE: "1",
    KIOSCO_SUPERADMIN_USERNAME: adminUsername,
    KIOSCO_SUPERADMIN_PASSWORD: adminPassword,
    KIOSCO_PASSWORD_RESET_MINUTES: "30",
    DATABASE_URL: "",
  },
  stdio: "ignore",
});

const request = async (url, options = {}) => {
  const response = await fetch(base + url, options);
  let value = {};
  try { value = await response.json(); } catch {}
  return { response, value };
};
const post = (url, payload, headers = {}) => request(url, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(payload),
});
const assert = (condition, message) => {
  if (!condition) throw new Error(`FALLÓ: ${message}`);
  console.log(`OK: ${message}`);
};

try {
  let capturedEmailRequest = null;
  const templateService = createEmailService({
    apiKey: "re_test_key",
    from: "Kiosco+ <notificaciones@correo.kioscomas.ar>",
    replyTo: "soporte@kioscomas.ar",
    appUrl: "https://app.kioscomas.ar",
    fetchImpl: async (url, options) => {
      capturedEmailRequest = { url, options, payload: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ id: "email-test" }) };
    },
  });
  await templateService.sendPasswordReset({
    to: "usuario@example.com",
    name: "<Juan>",
    resetUrl: "https://app.kioscomas.ar/?reset_token=seguro",
    expiresInMinutes: 30,
    requestId: "request-a",
  });
  assert(capturedEmailRequest?.url === "https://api.resend.com/emails" && capturedEmailRequest.options.headers["idempotency-key"] === "password-reset/request-a", "Resend recibe una solicitud idempotente");
  assert(capturedEmailRequest.payload.html.includes("Crear una nueva contraseña") && !capturedEmailRequest.payload.html.includes("<Juan>"), "la plantilla visual escapa datos y muestra la acción segura");

  let health;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      health = await request("/v1/health");
      if (health.response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(health?.response.ok, "el servidor de recuperación inicia");

  const adminLogin = await post("/v1/auth/login", { username: adminUsername, password: adminPassword, deviceId: "recovery-admin-pc" });
  const adminHeaders = {
    authorization: `Bearer ${adminLogin.value.accessToken}`,
    "x-device-id": "recovery-admin-pc",
    "x-tenant-id": "system-admin",
  };
  const activationCode = await post("/v1/admin/activation-codes", { label: "Recuperación", maxUses: 1, expiresInDays: 1 }, adminHeaders);
  await post("/v1/activation/redeem", { deviceId: "recovery-pc", code: activationCode.value.code, appVersion: "web-test" });

  const invalidEmailRegistration = await post("/v1/auth/register", {
    deviceId: "recovery-pc", name: "Correo inválido", email: "correo-invalido", businessName: "No crear", username: "invalid-email-owner", password: "old-secret", termsAccepted: true, termsVersion: TERMS_VERSION,
  });
  assert(invalidEmailRegistration.response.status === 400, "el registro exige un correo válido");

  const registration = await post("/v1/auth/register", {
    deviceId: "recovery-pc", name: "Dueño Recovery", email: accountEmail, businessName: "Kiosco Recovery", username: "recovery-owner", password: "old-secret", termsAccepted: true, termsVersion: TERMS_VERSION,
  });
  assert(registration.response.status === 201 && registration.value.account?.email === accountEmail, "el registro conserva el correo de la cuenta");
  const secondRegistration = await post("/v1/auth/register", {
    deviceId: "recovery-pc", name: "Segundo Dueño", email: "second.recovery@example.com", businessName: "Segundo Kiosco", username: "second-recovery-owner", password: "second-secret", termsAccepted: true, termsVersion: TERMS_VERSION,
  });
  assert(secondRegistration.response.status === 201, "la prueba crea una segunda cuenta para comprobar el límite por IP");
  const duplicateEmail = await post("/v1/auth/register", {
    deviceId: "recovery-pc", name: "Correo repetido", email: accountEmail, businessName: "No crear", username: "duplicate-email-owner", password: "duplicate-secret", termsAccepted: true, termsVersion: TERMS_VERSION,
  });
  assert(duplicateEmail.response.status === 409, "un correo no puede pertenecer a dos cuentas");

  assert(typeof registration.value.testEmailVerifyToken === "string" && registration.value.testEmailVerifyToken.length >= 30, "el registro exige confirmar el correo antes de poder entrar");
  const blockedLogin = await post("/v1/auth/login", { username: "recovery-owner", password: "old-secret", deviceId: "recovery-pc" });
  assert(blockedLogin.response.status === 403 && blockedLogin.value.code === "email_not_verified", "no se puede iniciar sesión antes de confirmar el correo");
  const verifyEmail = await post("/v1/auth/verify-email", { token: registration.value.testEmailVerifyToken });
  assert(verifyEmail.response.ok, "el enlace del mail confirma la cuenta");

  const oldLogin = await post("/v1/auth/login", { username: "recovery-owner", password: "old-secret", deviceId: "recovery-pc" });
  assert(oldLogin.response.ok && oldLogin.value.refreshToken, "la contraseña original funciona antes del cambio");

  const unknown = await post("/v1/auth/password/forgot", { email: "unknown@example.com" });
  const recovery = await post("/v1/auth/password/forgot", { email: accountEmail.toUpperCase() });
  assert(unknown.response.status === 202 && recovery.response.status === 202 && unknown.value.message === recovery.value.message, "la respuesta no revela si un correo existe");
  assert(typeof recovery.value.testResetToken === "string" && recovery.value.testResetToken.length >= 30, "la prueba obtiene un enlace de recuperación");

  const rawToken = recovery.value.testResetToken;
  const storedDatabase = await fs.readFile(dbPath, "utf8");
  assert(!storedDatabase.includes(rawToken), "el servidor no guarda el token de recuperación en texto plano");

  const expiringRecovery = await post("/v1/auth/password/forgot", { email: "second.recovery@example.com" });
  const expiringToken = expiringRecovery.value.testResetToken;
  const databaseWithExpiringToken = JSON.parse(await fs.readFile(dbPath, "utf8"));
  const expiringHash = crypto.createHash("sha256").update(expiringToken).digest("hex");
  databaseWithExpiringToken.passwordResetTokens[expiringHash].expiresAt = new Date(Date.now() - 1000).toISOString();
  await fs.writeFile(dbPath, JSON.stringify(databaseWithExpiringToken, null, 2));
  const expired = await post("/v1/auth/password/reset", { token: expiringToken, password: "expired-secret-123" });
  assert(expired.response.status === 400, "un enlace vencido no cambia la contraseña");

  const wrongToken = await post("/v1/auth/password/reset", { token: "incorrect-token-that-is-long-enough-123456", password: "new-secret-123" });
  assert(wrongToken.response.status === 400, "un token inventado no cambia la contraseña");

  const reset = await post("/v1/auth/password/reset", { token: rawToken, password: "new-secret-123" });
  assert(reset.response.ok, "el enlace válido permite definir una contraseña nueva");

  const reused = await post("/v1/auth/password/reset", { token: rawToken, password: "another-secret-456" });
  assert(reused.response.status === 400, "el enlace no se puede usar dos veces");

  const oldPassword = await post("/v1/auth/login", { username: "recovery-owner", password: "old-secret", deviceId: "recovery-pc" });
  const newPassword = await post("/v1/auth/login", { username: "recovery-owner", password: "new-secret-123", deviceId: "recovery-pc" });
  assert(oldPassword.response.status === 401 && newPassword.response.ok, "sólo la contraseña nueva permite iniciar sesión");

  const revokedRefresh = await post("/v1/auth/refresh", { refreshToken: oldLogin.value.refreshToken });
  assert(revokedRefresh.response.status === 401, "el cambio revoca las sesiones anteriores");

  const repeatedRequest = await post("/v1/auth/password/forgot", { email: accountEmail });
  assert(repeatedRequest.response.status === 202 && !repeatedRequest.value.testResetToken, "el límite por correo frena envíos repetidos sin revelar el motivo");
  for (let index = 0; index < 7; index += 1) await post("/v1/auth/password/forgot", { email: `unknown-${index}@example.com` });
  const ipLimited = await post("/v1/auth/password/forgot", { email: "second.recovery@example.com" });
  assert(ipLimited.response.status === 202 && !ipLimited.value.testResetToken, "el límite por IP evita envíos masivos y conserva la respuesta neutra");
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
