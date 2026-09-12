import crypto from "node:crypto";

const API_URL = "https://api.mercadopago.com";
const AUTH_URL = "https://auth.mercadopago.com/authorization";

const requiredText = (value, field, max = 180) => {
  const result = String(value || "").trim().slice(0, max);
  if (!result) throw new Error(`${field} es obligatorio`);
  return result;
};

export const normalizePaymentAmount = (value) => {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    throw new Error("El importe del cobro no es válido");
  }
  return amount;
};

const keyFromSecret = (secret) => crypto.createHash("sha256").update(String(secret || "")).digest();

export const encryptPaymentSecret = (value, secret) => {
  if (!value) return null;
  if (String(secret || "").length < 32) throw new Error("Falta una clave segura para cifrar las credenciales de pago");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
};

export const decryptPaymentSecret = (encoded, secret) => {
  if (!encoded) return null;
  const [version, iv, tag, encrypted] = String(encoded).split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("La credencial cifrada no tiene un formato válido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"));
};

export const createPkcePair = () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

export const mercadoPagoConfig = (env = process.env) => {
  const config = {
    enabled: String(env.KIOSCO_MERCADOPAGO_BACKEND_ENABLED || "") === "1",
    clientId: String(env.KIOSCO_MERCADOPAGO_CLIENT_ID || "").trim(),
    clientSecret: String(env.KIOSCO_MERCADOPAGO_CLIENT_SECRET || "").trim(),
    redirectUri: String(env.KIOSCO_MERCADOPAGO_REDIRECT_URI || "").trim(),
    returnUri: String(env.KIOSCO_MERCADOPAGO_RETURN_URI || env.KIOSCO_PUBLIC_APP_URL || "https://app.kioscomas.ar").trim(),
    tokenEncryptionKey: String(env.KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY || ""),
    webhookSecret: String(env.KIOSCO_MERCADOPAGO_WEBHOOK_SECRET || "").trim(),
  };
  config.oauthConfigured = Boolean(config.clientId && config.clientSecret && config.redirectUri && config.tokenEncryptionKey.length >= 32);
  config.webhookConfigured = Boolean(config.webhookSecret);
  config.ready = config.enabled && config.oauthConfigured;
  return config;
};

export const mercadoPagoAvailability = (config) => ({
  provider: "mercado_pago",
  backendEnabled: Boolean(config.enabled),
  oauthConfigured: Boolean(config.oauthConfigured),
  webhookConfigured: Boolean(config.webhookConfigured),
  ready: Boolean(config.ready),
});

export const buildMercadoPagoAuthorizationUrl = (config, { state, codeChallenge }) => {
  if (!config.ready) throw new Error("El backend de Mercado Pago todavía no está habilitado y configurado");
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", requiredText(state, "state", 256));
  url.searchParams.set("code_challenge", requiredText(codeChallenge, "code_challenge", 256));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
};

export const buildQrOrderPayload = ({ amount, externalReference, externalPosId, expirationTime, description }) => ({
  type: "qr",
  total_amount: String(normalizePaymentAmount(amount)),
  external_reference: requiredText(externalReference, "external_reference", 64),
  expiration_time: expirationTime || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  description: String(description || "Cobro de Kiosco+").trim().slice(0, 120),
  config: {
    qr: {
      external_pos_id: requiredText(externalPosId, "external_pos_id", 64),
      mode: "dynamic",
    },
  },
  transactions: { payments: [{ amount: String(normalizePaymentAmount(amount)) }] },
});

export const buildPointOrderPayload = ({ amount, externalReference, terminalId, description, paymentMethodId }) => {
  const payment = { amount: String(normalizePaymentAmount(amount)) };
  if (paymentMethodId) payment.payment_method = { id: String(paymentMethodId).trim().slice(0, 40) };
  return {
    type: "point",
    total_amount: String(normalizePaymentAmount(amount)),
    external_reference: requiredText(externalReference, "external_reference", 64),
    description: String(description || "Cobro de Kiosco+").trim().slice(0, 120),
    config: {
      point: {
        terminal_id: requiredText(terminalId, "terminal_id", 80),
        print_on_terminal: "no_ticket",
        ticket_number: requiredText(externalReference, "ticket_number", 40),
      },
    },
    transactions: { payments: [payment] },
  };
};

export const verifyMercadoPagoWebhookSignature = ({ signature, requestId, dataId, secret, now = Date.now(), toleranceMs = 5 * 60 * 1000 }) => {
  if (!signature || !requestId || !dataId || !secret) return false;
  const parts = Object.fromEntries(String(signature).split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
  const timestamp = Number(parts.ts);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp * 1000) > toleranceMs || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const received = Buffer.from(String(parts.v1), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
};

const providerError = async (response) => {
  let detail = null;
  try { detail = await response.json(); } catch { /* respuesta sin JSON */ }
  const error = new Error(detail?.message || detail?.error || `Mercado Pago respondió HTTP ${response.status}`);
  error.status = response.status;
  error.providerCode = detail?.code || detail?.error || null;
  error.providerDetails = detail?.errors || detail?.cause || null;
  throw error;
};

export const createMercadoPagoClient = ({ config = mercadoPagoConfig(), fetchImpl = fetch } = {}) => {
  const request = async (pathname, { method = "GET", accessToken, body, idempotencyKey } = {}) => {
    const headers = { accept: "application/json" };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
    const response = await fetchImpl(`${API_URL}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return providerError(response);
    return response.status === 204 ? {} : response.json();
  };

  const tokenRequest = async (payload) => {
    const response = await fetchImpl(`${API_URL}/oauth/token`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return providerError(response);
    return response.json();
  };

  return {
    config,
    exchangeAuthorizationCode: ({ code, codeVerifier }) => tokenRequest({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: requiredText(code, "code", 512),
      redirect_uri: config.redirectUri,
      code_verifier: requiredText(codeVerifier, "code_verifier", 256),
    }),
    refreshAccessToken: (refreshToken) => tokenRequest({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: requiredText(refreshToken, "refresh_token", 1024),
    }),
    currentUser: (accessToken) => request("/users/me", { accessToken }),
    createOrder: ({ accessToken, payload, idempotencyKey }) => request("/v1/orders", { method: "POST", accessToken, body: payload, idempotencyKey }),
    getOrder: ({ accessToken, orderId }) => request(`/v1/orders/${encodeURIComponent(requiredText(orderId, "order_id", 120))}`, { accessToken }),
    cancelOrder: ({ accessToken, orderId, idempotencyKey }) => request(`/v1/orders/${encodeURIComponent(requiredText(orderId, "order_id", 120))}/cancel`, { method: "POST", accessToken, idempotencyKey }),
    refundOrder: ({ accessToken, orderId, idempotencyKey }) => request(`/v1/orders/${encodeURIComponent(requiredText(orderId, "order_id", 120))}/refund`, { method: "POST", accessToken, idempotencyKey }),
  };
};

export const normalizedPaymentStatus = (providerStatus) => {
  const value = String(providerStatus || "").toLowerCase();
  if (["processed", "approved", "paid"].includes(value)) return "approved";
  if (["canceled", "cancelled", "expired", "refunded", "charged_back"].includes(value)) return value === "cancelled" ? "canceled" : value;
  if (["failed", "rejected"].includes(value)) return "failed";
  return "pending";
};
