import crypto from "node:crypto";
import {
  buildMercadoPagoAuthorizationUrl,
  buildPointOrderPayload,
  buildQrOrderPayload,
  createMercadoPagoClient,
  decryptPaymentSecret,
  encryptPaymentSecret,
  mercadoPagoAvailability,
  mercadoPagoConfig,
  normalizedPaymentStatus,
  verifyMercadoPagoWebhookSignature,
} from "../server/mercado-pago.mjs";

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

const disabled = mercadoPagoConfig({});
test("Mercado Pago queda apagado por defecto", !disabled.enabled && !disabled.ready);
test("el diagnóstico público no expone secretos", !JSON.stringify(mercadoPagoAvailability(disabled)).includes("clientSecret"));

const config = mercadoPagoConfig({
  KIOSCO_MERCADOPAGO_BACKEND_ENABLED: "1",
  KIOSCO_MERCADOPAGO_CLIENT_ID: "client-test",
  KIOSCO_MERCADOPAGO_CLIENT_SECRET: "secret-test",
  KIOSCO_MERCADOPAGO_REDIRECT_URI: "https://api.example.com/v1/payments/mercado-pago/oauth/callback",
  KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY: "clave-de-prueba-de-por-lo-menos-32-caracteres",
  KIOSCO_MERCADOPAGO_WEBHOOK_SECRET: "webhook-secret",
});
test("la integración sólo queda lista con OAuth y cifrado", config.ready && config.oauthConfigured && config.webhookConfigured);

const encrypted = encryptPaymentSecret({ accessToken: "APP_USR-token", refreshToken: "refresh" }, config.tokenEncryptionKey);
test("los tokens se cifran antes de persistirse", !encrypted.includes("APP_USR-token") && decryptPaymentSecret(encrypted, config.tokenEncryptionKey).refreshToken === "refresh");
let wrongKeyRejected = false;
try { decryptPaymentSecret(encrypted, "otra-clave-segura-de-por-lo-menos-32-caracteres"); } catch { wrongKeyRejected = true; }
test("una clave distinta no puede leer las credenciales", wrongKeyRejected);

const authorizationUrl = new URL(buildMercadoPagoAuthorizationUrl(config, { state: "estado-unico", codeChallenge: "desafio-pkce" }));
test("OAuth usa state, callback exacto y PKCE", authorizationUrl.searchParams.get("state") === "estado-unico" && authorizationUrl.searchParams.get("redirect_uri") === config.redirectUri && authorizationUrl.searchParams.get("code_challenge_method") === "S256");

const qr = buildQrOrderPayload({ amount: 13000, externalReference: "V-ABC123", externalPosId: "CAJA-1", description: "Venta" });
test("QR dinámico conserva importe, referencia y caja", qr.type === "qr" && qr.config.qr.mode === "dynamic" && qr.config.qr.external_pos_id === "CAJA-1" && qr.transactions.payments[0].amount === "13000");
const point = buildPointOrderPayload({ amount: 1250.5, externalReference: "V-POINT", terminalId: "PAX-A910-01" });
test("Point envía la orden a una terminal concreta", point.type === "point" && point.config.point.terminal_id === "PAX-A910-01" && point.total_amount === "1250.5");

const dataId = "ORDER-ABC";
const requestId = "request-123";
const timestamp = Math.floor(Date.now() / 1000);
const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
const signatureHash = crypto.createHmac("sha256", config.webhookSecret).update(manifest).digest("hex");
const signature = `ts=${timestamp},v1=${signatureHash}`;
test("webhook firmado y reciente es aceptado", verifyMercadoPagoWebhookSignature({ signature, requestId, dataId, secret: config.webhookSecret }));
test("webhook alterado es rechazado", !verifyMercadoPagoWebhookSignature({ signature, requestId: "otro", dataId, secret: config.webhookSecret }));
test("webhook viejo es rechazado", !verifyMercadoPagoWebhookSignature({ signature, requestId, dataId, secret: config.webhookSecret, now: Date.now() + 10 * 60 * 1000 }));

const requests = [];
const client = createMercadoPagoClient({
  config,
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 201, json: async () => ({ id: "order-1", status: "created" }) };
  },
});
await client.createOrder({ accessToken: "token-privado", payload: qr, idempotencyKey: "idempotencia-123" });
test("cada creación lleva bearer e idempotencia al proveedor", requests[0].options.headers.authorization === "Bearer token-privado" && requests[0].options.headers["x-idempotency-key"] === "idempotencia-123");
test("estados del proveedor se normalizan", normalizedPaymentStatus("processed") === "approved" && normalizedPaymentStatus("rejected") === "failed" && normalizedPaymentStatus("created") === "pending");

console.log(`\n${passed} pruebas del backend de pagos superadas.`);

