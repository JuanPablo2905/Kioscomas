import crypto from "node:crypto";

const API_URL = "https://api.mercadopago.com";
const AUTH_URL = "https://auth.mercadopago.com/authorization";

const requiredText = (value, field, max = 180) => {
  const result = String(value || "").trim().slice(0, max);
  if (!result) throw new Error(`${field} es obligatorio`);
  return result;
};

export const normalizeExternalReference = (value) => {
  const reference = requiredText(value, "external_reference", 64);
  if (!/^[A-Za-z0-9_-]+$/.test(reference)) {
    throw new Error("external_reference sólo admite letras, números, guiones y guiones bajos");
  }
  return reference;
};

export const normalizeExpirationDuration = (value, defaultSeconds = 15 * 60) => {
  if (value === undefined || value === null || value === "") {
    const seconds = Math.max(30, Math.min(3 * 60 * 60, Math.round(Number(defaultSeconds) || 900)));
    return seconds % 60 === 0 ? `PT${seconds / 60}M` : `PT${seconds}S`;
  }
  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const seconds = Math.round(Number(value));
    if (!Number.isFinite(seconds) || seconds < 30 || seconds > 3 * 60 * 60) {
      throw new Error("La orden debe vencer entre 30 segundos y 3 horas");
    }
    return seconds % 60 === 0 ? `PT${seconds / 60}M` : `PT${seconds}S`;
  }
  const duration = String(value).trim().toUpperCase();
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match || !match.slice(1).some(Boolean)) throw new Error("expiration_time debe ser una duración ISO 8601, por ejemplo PT15M");
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  if (seconds < 30 || seconds > 3 * 60 * 60) throw new Error("La orden debe vencer entre 30 segundos y 3 horas");
  return duration;
};

const integrationData = (config = {}) => {
  const result = {};
  const platformId = String(config.platformId || "").trim();
  const integratorId = String(config.integratorId || "").trim();
  const sponsorId = String(config.sponsorId || "").trim();
  // Estos identificadores no son las credenciales de la aplicación ni el ID
  // del vendedor. Mercado Pago los asigna expresamente a plataformas e
  // integradores; omitir un valor dudoso es más seguro que rechazar el cobro.
  if (/^dev_[A-Za-z0-9_-]{3,115}$/i.test(platformId)) result.platform_id = platformId;
  if (/^dev_[A-Za-z0-9_-]{3,115}$/.test(integratorId)) result.integrator_id = integratorId;
  if (/^\d{3,30}$/.test(sponsorId)) result.sponsor = { id: sponsorId };
  return Object.keys(result).length ? result : undefined;
};

const providerDetailText = (detail = {}) => String(
  detail?.message
  || detail?.description
  || detail?.detail
  || detail?.error
  || "",
).trim();

const providerDetailEvidence = (error = {}) => (Array.isArray(error?.providerDetails) ? error.providerDetails : [])
  .map((detail) => [
    detail?.code,
    detail?.field,
    detail?.property,
    // Mercado Pago no siempre usa "field"/"property" para nombrar la propiedad
    // inválida en errores property_value/property_type: a veces la manda en "data".
    typeof detail?.data === "string" ? detail.data : null,
    providerDetailText(detail),
  ].filter(Boolean).join(" "))
  .filter(Boolean);

export const normalizePaymentAmount = (value) => {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    throw new Error("El importe del cobro no es válido");
  }
  return amount;
};

// Orders v1 returns the dynamic QR under type_response.qr_data. The two
// fallbacks keep compatibility with older/test responses without coupling the
// rest of the server to a single provider response shape.
export const mercadoPagoQrData = (order = {}) => (
  order?.type_response?.qr_data
  || order?.config?.qr?.qr_data
  || order?.qr_data
  || null
);

export const isMercadoPagoMissingPosError = (error = {}) => {
  const evidence = [
    error?.providerCode,
    error?.message,
    ...(Array.isArray(error?.providerDetails) ? error.providerDetails.map((detail) => (
      [detail?.code, detail?.message, detail?.description].filter(Boolean).join(" ")
    )) : []),
  ].filter(Boolean).join(" ");
  return /external[ _-]*pos[ _-]*(?:id[ _-]*)?not[ _-]*found|pos_obtainment_by_external_id_error/i.test(evidence);
};

export const mercadoPagoProviderMessage = (error) => {
  const message = String(error?.message || "").trim();
  const code = String(error?.providerCode || "").trim();
  const details = providerDetailEvidence(error);
  const evidence = [code, message, ...details].filter(Boolean).join(" ");
  if (/test credentials are not supported/i.test(message)) {
    return "La autorización guardada de Mercado Pago no es compatible con la API de cobros. Desconectá esta integración y volvé a conectarla con un usuario vendedor de prueba.";
  }
  if (isMercadoPagoMissingPosError(error)) {
    return "Mercado Pago no encontró la caja QR vinculada. Kiosco+ intentó repararla; si el aviso vuelve a aparecer, entrá en Configuración > Mercado Pago y volvé a crear la caja QR.";
  }
  if (/sponsor_id_not_valid/i.test(evidence)) {
    return "Mercado Pago rechazó el identificador opcional del integrador. Quitalo de la configuración del servidor salvo que Mercado Pago lo haya asignado expresamente a Kiosco+.";
  }
  if (/marketplace_not_valid|marketplace_fee_not_allowed/i.test(evidence)) {
    return "Mercado Pago no reconoce este acceso como una conexión OAuth válida para cobrar en nombre del negocio. Desconectá y volvé a conectar la cuenta desde Kiosco+.";
  }
  if (/empty_required_header/i.test(evidence)) {
    return "Mercado Pago rechazó la orden porque faltó su clave de reintento. Kiosco+ no registró la venta y podés volver a generar el QR.";
  }
  if (/unsupported_properties|property_value|property_type/i.test(evidence) && details.length) {
    return `Mercado Pago rechazó un dato de la orden: ${details[0]}`.slice(0, 300);
  }
  if (/an error occurred when creating a merchant order/i.test(message)) {
    return Number(error?.status) >= 500
      ? "Mercado Pago no pudo crear la orden QR dentro de su servicio. La venta no se registró; revisá el diagnóstico técnico del intento antes de volver a probar."
      : "Mercado Pago rechazó la creación de la orden QR. La venta no se registró; revisá el diagnóstico técnico del intento para identificar el dato observado.";
  }
  return message || "No se pudo procesar el cobro con Mercado Pago";
};

export const isMercadoPagoSandboxSeller = ({ tokens = {}, profile = {} } = {}) => (
  tokens.live_mode === false
  || profile.live_mode === false
  || profile.test_user === true
  || /@testuser\.com$/i.test(String(profile.email || "").trim())
  || /^TESTUSER/i.test(String(profile.nickname || profile.username || "").trim())
);

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

const mercadoPagoSolutionConfig = (env, shared, solution) => {
  const prefix = `KIOSCO_MERCADOPAGO_${solution.toUpperCase()}`;
  // The generic variables shipped before v0.2.27 remain a QR-only fallback.
  // Mercado Pago requires a different application for each in-person solution,
  // so Point never silently reuses QR credentials in production.
  const legacyQr = solution === "qr";
  const config = {
    ...shared,
    solution,
    clientId: String(env[`${prefix}_CLIENT_ID`] || (legacyQr ? env.KIOSCO_MERCADOPAGO_CLIENT_ID : "") || "").trim(),
    clientSecret: String(env[`${prefix}_CLIENT_SECRET`] || (legacyQr ? env.KIOSCO_MERCADOPAGO_CLIENT_SECRET : "") || "").trim(),
    redirectUri: String(env[`${prefix}_REDIRECT_URI`] || env.KIOSCO_MERCADOPAGO_REDIRECT_URI || "").trim(),
    webhookSecret: String(env[`${prefix}_WEBHOOK_SECRET`] || (legacyQr ? env.KIOSCO_MERCADOPAGO_WEBHOOK_SECRET : "") || "").trim(),
  };
  config.oauthConfigured = Boolean(config.clientId && config.clientSecret && config.redirectUri && config.tokenEncryptionKey.length >= 32);
  config.webhookConfigured = Boolean(config.webhookSecret);
  config.ready = config.enabled && config.oauthConfigured;
  return config;
};

export const mercadoPagoConfig = (env = process.env) => {
  const shared = {
    enabled: String(env.KIOSCO_MERCADOPAGO_BACKEND_ENABLED || "") === "1",
    testMode: String(env.KIOSCO_MERCADOPAGO_TEST_MODE || "") === "1",
    returnUri: String(env.KIOSCO_MERCADOPAGO_RETURN_URI || env.KIOSCO_PUBLIC_APP_URL || "https://app.kioscomas.ar").trim(),
    tokenEncryptionKey: String(env.KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY || ""),
    platformId: String(env.KIOSCO_MERCADOPAGO_PLATFORM_ID || "").trim(),
    integratorId: String(env.KIOSCO_MERCADOPAGO_INTEGRATOR_ID || "").trim(),
    sponsorId: String(env.KIOSCO_MERCADOPAGO_SPONSOR_ID || "").trim(),
  };
  const solutions = {
    qr: mercadoPagoSolutionConfig(env, shared, "qr"),
    point: mercadoPagoSolutionConfig(env, shared, "point"),
  };
  const config = {
    ...shared,
    solutions,
    // Compatibility aliases represent the QR application only.
    clientId: solutions.qr.clientId,
    clientSecret: solutions.qr.clientSecret,
    redirectUri: solutions.qr.redirectUri,
    webhookSecret: solutions.qr.webhookSecret,
    oauthConfigured: solutions.qr.oauthConfigured || solutions.point.oauthConfigured,
    webhookConfigured: solutions.qr.webhookConfigured || solutions.point.webhookConfigured,
    ready: solutions.qr.ready || solutions.point.ready,
    allSolutionsReady: solutions.qr.ready && solutions.point.ready,
  };
  return config;
};

export const mercadoPagoConfigFor = (config, solution) => {
  const normalized = solution === "point" ? "point" : "qr";
  return config?.solutions?.[normalized] || config;
};

export const mercadoPagoAvailability = (config) => ({
  provider: "mercado_pago",
  backendEnabled: Boolean(config.enabled),
  oauthConfigured: Boolean(config.oauthConfigured),
  webhookConfigured: Boolean(config.webhookConfigured),
  ready: Boolean(config.ready),
  allSolutionsReady: Boolean(config.allSolutionsReady),
  solutions: {
    qr: {
      backendEnabled: Boolean(mercadoPagoConfigFor(config, "qr")?.enabled),
      oauthConfigured: Boolean(mercadoPagoConfigFor(config, "qr")?.oauthConfigured),
      webhookConfigured: Boolean(mercadoPagoConfigFor(config, "qr")?.webhookConfigured),
      ready: Boolean(mercadoPagoConfigFor(config, "qr")?.ready),
      testMode: Boolean(mercadoPagoConfigFor(config, "qr")?.testMode),
    },
    point: {
      backendEnabled: Boolean(mercadoPagoConfigFor(config, "point")?.enabled),
      oauthConfigured: Boolean(mercadoPagoConfigFor(config, "point")?.oauthConfigured),
      webhookConfigured: Boolean(mercadoPagoConfigFor(config, "point")?.webhookConfigured),
      ready: Boolean(mercadoPagoConfigFor(config, "point")?.ready),
      testMode: Boolean(mercadoPagoConfigFor(config, "point")?.testMode),
    },
  },
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

export const buildQrOrderPayload = ({ amount, externalReference, externalPosId, expirationTime, expirationSeconds, description }, config = {}) => {
  const normalizedAmount = normalizePaymentAmount(amount).toFixed(2);
  const reference = normalizeExternalReference(externalReference);
  const orderDescription = String(description || "Cobro de Kiosco+").trim().slice(0, 120);
  const payload = {
    type: "qr",
    total_amount: normalizedAmount,
    external_reference: reference,
    expiration_time: normalizeExpirationDuration(expirationTime ?? expirationSeconds, 15 * 60),
    description: orderDescription,
    config: {
      qr: {
        external_pos_id: requiredText(externalPosId, "external_pos_id", 64),
        mode: "dynamic",
      },
    },
    transactions: { payments: [{ amount: normalizedAmount }] },
    // Aunque Orders admite omitir el detalle, algunas cuentas QR sandbox aún
    // pasan por Merchant Orders y fallan internamente cuando no reciben ningún
    // ítem. Un renglón resumen mantiene todos los importes consistentes sin
    // enviar el catálogo ni información privada del negocio.
    items: [{
      title: orderDescription || "Venta presencial",
      unit_price: normalizedAmount,
      quantity: 1,
      unit_measure: "unit",
      external_code: reference.slice(0, 64),
    }],
  };
  const attribution = integrationData(config);
  if (attribution) payload.integration_data = attribution;
  return payload;
};

export const buildPointOrderPayload = ({ amount, externalReference, terminalId, expirationTime, expirationSeconds, description, paymentMethodType, paymentMethodId }, config = {}) => {
  const reference = normalizeExternalReference(externalReference);
  const normalizedAmount = normalizePaymentAmount(amount).toFixed(2);
  const payload = {
    type: "point",
    external_reference: reference,
    expiration_time: normalizeExpirationDuration(expirationTime ?? expirationSeconds, 15 * 60),
    description: String(description || "Cobro de Kiosco+").trim().slice(0, 120),
    config: {
      point: {
        terminal_id: requiredText(terminalId, "terminal_id", 80),
        print_on_terminal: "no_ticket",
        ticket_number: reference.slice(0, 40),
      },
    },
    transactions: { payments: [{ amount: normalizedAmount }] },
  };
  const defaultType = String(paymentMethodType || paymentMethodId || "").trim().slice(0, 40);
  if (defaultType) payload.config.payment_method = { default_type: defaultType };
  const attribution = integrationData(config);
  if (attribution) payload.integration_data = attribution;
  return payload;
};

const normalizeProviderExternalId = (value, field, { alphanumericOnly = false, max = 60 } = {}) => {
  const result = requiredText(value, field, max);
  const valid = alphanumericOnly ? /^[A-Za-z0-9]+$/.test(result) : /^[A-Za-z0-9_-]+$/.test(result);
  if (!valid) throw new Error(alphanumericOnly ? `${field} sólo admite letras y números` : `${field} sólo admite letras, números, guiones y guiones bajos`);
  return result;
};

export const buildMercadoPagoStorePayload = ({
  name, externalId, streetName, streetNumber, cityName, stateName, latitude, longitude, reference,
}) => {
  const payload = {
    name: requiredText(name, "store_name", 60),
    external_id: normalizeProviderExternalId(externalId, "store_external_id", { alphanumericOnly: true }),
  };
  const street = String(streetName || "").trim().slice(0, 100);
  const number = String(streetNumber || "").trim().slice(0, 20);
  const city = String(cityName || "").trim().slice(0, 100);
  const state = String(stateName || "").trim().slice(0, 100);
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!street || !number || !city || !state || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error("Para ubicar el local completá calle, número, ciudad, provincia, latitud y longitud válidas");
  }
  payload.location = {
    street_name: street,
    street_number: number,
    city_name: city,
    state_name: state,
    latitude: lat,
    longitude: lon,
    reference: String(reference || "Local comercial").trim().slice(0, 80),
  };
  return payload;
};

export const buildMercadoPagoPosPayload = ({ name, storeId, externalId }) => ({
  name: requiredText(name, "pos_name", 60),
  store_id: requiredText(storeId, "store_id", 80),
  external_id: normalizeProviderExternalId(externalId, "pos_external_id", { alphanumericOnly: true, max: 40 }),
  config: { qr: { operating_mode: "pdv" } },
});

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
  const firstDetail = (Array.isArray(detail?.errors) ? detail.errors[0] : null)
    || (Array.isArray(detail?.cause) ? detail.cause[0] : null);
  const error = new Error(detail?.message || firstDetail?.message || firstDetail?.description || detail?.error || `Mercado Pago respondió HTTP ${response.status}`);
  error.status = response.status;
  error.providerCode = detail?.code || firstDetail?.code || detail?.error || null;
  error.providerDetails = detail?.errors || detail?.cause || null;
  error.providerRequestId = response?.headers?.get?.("x-request-id")
    || response?.headers?.get?.("x-correlation-id")
    || null;
  throw error;
};

export const createMercadoPagoClient = ({ config = mercadoPagoConfig(), fetchImpl = fetch } = {}) => {
  const request = async (pathname, { method = "GET", accessToken, body, idempotencyKey } = {}) => {
    const headers = { accept: "application/json" };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
    const attempts = idempotencyKey || method === "GET" ? 3 : 1;
    for (let index = 0; index < attempts; index += 1) {
      let response;
      try {
        response = await fetchImpl(`${API_URL}${pathname}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        if (index + 1 >= attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** index) + Math.floor(Math.random() * 100)));
        continue;
      }
      if (response.ok) return response.status === 204 ? {} : response.json();
      if (![425, 429, 500, 502, 503, 504].includes(Number(response.status)) || index + 1 >= attempts) return providerError(response);
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** index) + Math.floor(Math.random() * 100)));
    }
    throw new Error("Mercado Pago no respondió después de varios intentos");
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
      // Orders rechaza los tokens OAuth de tipo TEST. El entorno seguro se
      // obtiene autorizando un vendedor de prueba con la aplicación real.
      test_token: "false",
    }),
    refreshAccessToken: (refreshToken) => tokenRequest({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: requiredText(refreshToken, "refresh_token", 1024),
    }),
    currentUser: (accessToken) => request("/users/me", { accessToken }),
    createStore: ({ accessToken, userId, payload }) => request(`/users/${encodeURIComponent(requiredText(userId, "user_id", 80))}/stores`, { method: "POST", accessToken, body: payload }),
    searchStores: ({ accessToken, userId, externalId }) => request(`/users/${encodeURIComponent(requiredText(userId, "user_id", 80))}/stores/search?external_id=${encodeURIComponent(normalizeProviderExternalId(externalId, "store_external_id", { alphanumericOnly: true }))}`, { accessToken }),
    createPos: ({ accessToken, payload, idempotencyKey }) => request("/v2/pos", { method: "POST", accessToken, body: payload, idempotencyKey }),
    searchPos: ({ accessToken, externalId }) => request(`/v2/pos?external_id=${encodeURIComponent(normalizeProviderExternalId(externalId, "pos_external_id", { alphanumericOnly: true, max: 40 }))}`, { accessToken }),
    updatePos: ({ accessToken, posId, payload, idempotencyKey }) => request(`/v2/pos/${encodeURIComponent(requiredText(posId, "pos_id", 80))}`, { method: "PATCH", accessToken, body: payload, idempotencyKey }),
    listTerminals: ({ accessToken, storeId, posId }) => {
      const search = new URLSearchParams({ limit: "50", offset: "0" });
      if (storeId) search.set("store_id", requiredText(storeId, "store_id", 80));
      if (posId) search.set("pos_id", requiredText(posId, "pos_id", 80));
      return request(`/terminals/v1/list?${search}`, { accessToken });
    },
    setupTerminals: ({ accessToken, terminalIds }) => request("/terminals/v1/setup", {
      method: "PATCH",
      accessToken,
      body: { terminals: terminalIds.map((id) => ({ id: requiredText(id, "terminal_id", 80), operating_mode: "PDV" })) },
    }),
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
