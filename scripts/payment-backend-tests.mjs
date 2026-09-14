import crypto from "node:crypto";
import {
  buildMercadoPagoAuthorizationUrl,
  buildMercadoPagoPosPayload,
  buildMercadoPagoStorePayload,
  buildPointOrderPayload,
  buildQrOrderPayload,
  createMercadoPagoClient,
  decryptPaymentSecret,
  encryptPaymentSecret,
  mercadoPagoAvailability,
  mercadoPagoConfig,
  mercadoPagoConfigFor,
  mercadoPagoProviderMessage,
  mercadoPagoQrData,
  isMercadoPagoSandboxSeller,
  normalizeExpirationDuration,
  normalizeExternalReference,
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
  KIOSCO_MERCADOPAGO_QR_CLIENT_ID: "client-qr-test",
  KIOSCO_MERCADOPAGO_QR_CLIENT_SECRET: "secret-qr-test",
  KIOSCO_MERCADOPAGO_QR_WEBHOOK_SECRET: "webhook-qr-secret",
  KIOSCO_MERCADOPAGO_POINT_CLIENT_ID: "client-point-test",
  KIOSCO_MERCADOPAGO_POINT_CLIENT_SECRET: "secret-point-test",
  KIOSCO_MERCADOPAGO_POINT_WEBHOOK_SECRET: "webhook-point-secret",
  KIOSCO_MERCADOPAGO_REDIRECT_URI: "https://api.example.com/v1/payments/mercado-pago/oauth/callback",
  KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY: "clave-de-prueba-de-por-lo-menos-32-caracteres",
  KIOSCO_MERCADOPAGO_PLATFORM_ID: "DEV_PLATFORM_TEST",
  KIOSCO_MERCADOPAGO_INTEGRATOR_ID: "dev-integrator-test",
  KIOSCO_MERCADOPAGO_SPONSOR_ID: "123456",
});
test("la integración sólo queda lista con OAuth y cifrado", config.ready && config.oauthConfigured && config.webhookConfigured);
test("QR y Point usan aplicaciones y secretos separados", config.allSolutionsReady
  && mercadoPagoConfigFor(config, "qr").clientId === "client-qr-test"
  && mercadoPagoConfigFor(config, "point").clientId === "client-point-test"
  && mercadoPagoConfigFor(config, "qr").webhookSecret !== mercadoPagoConfigFor(config, "point").webhookSecret);
const legacyQrOnly = mercadoPagoConfig({
  KIOSCO_MERCADOPAGO_BACKEND_ENABLED: "1",
  KIOSCO_MERCADOPAGO_CLIENT_ID: "legacy-client",
  KIOSCO_MERCADOPAGO_CLIENT_SECRET: "legacy-secret",
  KIOSCO_MERCADOPAGO_REDIRECT_URI: "https://api.example.com/callback",
  KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY: "clave-de-prueba-de-por-lo-menos-32-caracteres",
});
test("las variables anteriores migran sólo Código QR y no habilitan Point", mercadoPagoConfigFor(legacyQrOnly, "qr").ready && !mercadoPagoConfigFor(legacyQrOnly, "point").ready);
const sandboxConfig = mercadoPagoConfig({
  KIOSCO_MERCADOPAGO_BACKEND_ENABLED: "1",
  KIOSCO_MERCADOPAGO_TEST_MODE: "1",
  KIOSCO_MERCADOPAGO_QR_CLIENT_ID: "sandbox-client",
  KIOSCO_MERCADOPAGO_QR_CLIENT_SECRET: "sandbox-secret",
  KIOSCO_MERCADOPAGO_REDIRECT_URI: "https://api.example.com/callback",
  KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY: "clave-de-prueba-de-por-lo-menos-32-caracteres",
});
let sandboxTokenBody = "";
const sandboxClient = createMercadoPagoClient({
  config: mercadoPagoConfigFor(sandboxConfig, "qr"),
  fetchImpl: async (_url, options) => {
    sandboxTokenBody = String(options.body || "");
    return { ok: true, status: 200, json: async () => ({ access_token: "sandbox-token" }) };
  },
});
await sandboxClient.exchangeAuthorizationCode({ code: "sandbox-code", codeVerifier: "sandbox-verifier-abcdefghijklmnopqrstuvwxyz-123456" });
test("OAuth no solicita un token TEST que Orders rechaza", new URLSearchParams(sandboxTokenBody).get("test_token") === "false");
test("el modo de prueba reconoce al vendedor sandbox sin aceptar una cuenta real", isMercadoPagoSandboxSeller({ tokens: { live_mode: false } })
  && isMercadoPagoSandboxSeller({ profile: { email: "vendedor@testuser.com" } })
  && !isMercadoPagoSandboxSeller({ tokens: { live_mode: true }, profile: { email: "venta@negocio.com" } }));

const encrypted = encryptPaymentSecret({ accessToken: "APP_USR-token", refreshToken: "refresh" }, config.tokenEncryptionKey);
test("los tokens se cifran antes de persistirse", !encrypted.includes("APP_USR-token") && decryptPaymentSecret(encrypted, config.tokenEncryptionKey).refreshToken === "refresh");
let wrongKeyRejected = false;
try { decryptPaymentSecret(encrypted, "otra-clave-segura-de-por-lo-menos-32-caracteres"); } catch { wrongKeyRejected = true; }
test("una clave distinta no puede leer las credenciales", wrongKeyRejected);

const authorizationUrl = new URL(buildMercadoPagoAuthorizationUrl(config, { state: "estado-unico", codeChallenge: "desafio-pkce" }));
test("OAuth usa state, callback exacto y PKCE", authorizationUrl.searchParams.get("state") === "estado-unico" && authorizationUrl.searchParams.get("redirect_uri") === config.redirectUri && authorizationUrl.searchParams.get("code_challenge_method") === "S256");

const qr = buildQrOrderPayload({ amount: 13000, externalReference: "V-ABC123", externalPosId: "CAJA-1", description: "Venta" });
test("QR dinámico conserva importe, referencia y caja", qr.type === "qr" && qr.config.qr.mode === "dynamic" && qr.config.qr.external_pos_id === "CAJA-1" && qr.transactions.payments[0].amount === "13000.00");
test("el QR se lee desde la respuesta vigente de Orders v1", mercadoPagoQrData({ type_response: { qr_data: "000201-test" } }) === "000201-test");
test("el lector de QR conserva compatibilidad con respuestas anteriores", mercadoPagoQrData({ config: { qr: { qr_data: "legacy-test" } } }) === "legacy-test");
test("el rechazo de credenciales de prueba explica en castellano cómo corregir la configuración", mercadoPagoProviderMessage({
  message: "Test credentials are not supported, use test users with production credentials to sandbox environment and your production credentials to production environment.",
}).includes("Desconectá esta integración"));
test("las órdenes usan una duración y no una fecha absoluta", qr.expiration_time === "PT15M" && normalizeExpirationDuration(30) === "PT30S");
let absoluteExpirationRejected = false;
try { normalizeExpirationDuration("2026-09-13T12:00:00.000Z"); } catch { absoluteExpirationRejected = true; }
test("una fecha absoluta inválida no llega a Mercado Pago", absoluteExpirationRejected);
let unsafeReferenceRejected = false;
try { normalizeExternalReference("venta con espacios"); } catch { unsafeReferenceRejected = true; }
test("la referencia no admite datos o caracteres inseguros", unsafeReferenceRejected);
const attributedQr = buildQrOrderPayload({ amount: 10, externalReference: "V-ATTR", externalPosId: "CAJA-1" }, config);
test("la atribución de plataforma se agrega sólo desde el servidor", attributedQr.integration_data.platform_id === "DEV_PLATFORM_TEST" && attributedQr.integration_data.sponsor.id === "123456");

const point = buildPointOrderPayload({ amount: 1250.5, externalReference: "V-POINT", terminalId: "NEWLAND_N950__SBX0000001", paymentMethodType: "credit_card" });
test("Point envía la orden a una terminal concreta sin campos que esa API no admite", point.type === "point" && point.config.point.terminal_id === "NEWLAND_N950__SBX0000001" && point.transactions.payments[0].amount === "1250.50" && !("total_amount" in point));
test("Point ubica el medio de pago en config.payment_method", point.config.payment_method.default_type === "credit_card" && !point.transactions.payments[0].payment_method);

const storePayload = buildMercadoPagoStorePayload({ name: "Kiosco Centro", externalId: "KIOSCOTEST", streetName: "Av. Siempre Viva", streetNumber: "123", cityName: "Buenos Aires", stateName: "Buenos Aires", latitude: -34.6, longitude: -58.4 });
const posPayload = buildMercadoPagoPosPayload({ name: "Caja principal", storeId: "998877", externalId: "CAJATEST" });
test("el alta QR prepara una dirección fiscal completa y una caja válida", storePayload.location.street_name === "Av. Siempre Viva" && storePayload.location.city_name === "Buenos Aires" && storePayload.location.latitude === -34.6 && posPayload.store_id === "998877" && !("config" in posPayload));
let incompleteLocationRejected = false;
try { buildMercadoPagoStorePayload({ name: "Kiosco", externalId: "KIOSCO2", streetName: "Caseros", latitude: -34.6, longitude: -58.4 }); } catch { incompleteLocationRejected = true; }
test("una sucursal sin dirección completa se rechaza antes de llamar al proveedor", incompleteLocationRejected);

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
await client.createStore({ accessToken: "token-privado", userId: "123", payload: storePayload });
await client.createPos({ accessToken: "token-privado", payload: posPayload, idempotencyKey: "pos-idempotente" });
test("el cliente oficial crea local y POS por las rutas correctas", requests[1].url.endsWith("/users/123/stores") && requests[2].url.endsWith("/v2/pos") && requests[2].options.headers["x-idempotency-key"] === "pos-idempotente");
await client.searchStores({ accessToken: "token-privado", userId: "123", externalId: "KIOSCOTEST" });
await client.searchPos({ accessToken: "token-privado", externalId: "CAJATEST" });
await client.listTerminals({ accessToken: "token-privado", storeId: "998877", posId: "112233" });
await client.setupTerminals({ accessToken: "token-privado", terminalIds: ["NEWLAND_N950__SBX0000001"] });
test("la recuperación del alta y la configuración Point usan los endpoints vigentes", requests[3].url.includes("/stores/search?external_id=KIOSCOTEST") && requests[4].url.includes("/v2/pos?external_id=CAJATEST") && requests[5].url.includes("/terminals/v1/list?") && requests[6].options.method === "PATCH");
let transientCalls = 0;
const retryClient = createMercadoPagoClient({
  config,
  fetchImpl: async () => {
    transientCalls += 1;
    return transientCalls === 1
      ? { ok: false, status: 503, json: async () => ({ message: "temporal" }) }
      : { ok: true, status: 201, json: async () => ({ id: "order-recovered", status: "created" }) };
  },
});
const recoveredOrder = await retryClient.createOrder({ accessToken: "token-privado", payload: qr, idempotencyKey: "reintento-idempotente" });
test("una falla transitoria repite la misma operación sin duplicar el cobro", transientCalls === 2 && recoveredOrder.id === "order-recovered");
test("estados del proveedor se normalizan", normalizedPaymentStatus("processed") === "approved" && normalizedPaymentStatus("rejected") === "failed" && normalizedPaymentStatus("created") === "pending");

console.log(`\n${passed} pruebas del backend de pagos superadas.`);
