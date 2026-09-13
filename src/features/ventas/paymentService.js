import { cloudFetch } from "../../cloud/cloudAuth";
import { loadCloudConfig } from "../../cloud/config";

const context = (businessId) => {
  const config = loadCloudConfig();
  if (!config.enabled || !config.apiUrl) throw new Error("Necesitás la nube de Kiosco+ para usar cobros conectados.");
  return {
    config,
    headers: { "content-type": "application/json", "x-tenant-id": String(businessId || ""), "x-device-id": config.deviceId },
  };
};

const read = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "No se pudo completar la operación de cobro.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

const request = async (businessId, path, options = {}) => {
  const { config, headers } = context(businessId);
  return read(await cloudFetch(config.apiUrl, path, { ...options, headers: { ...headers, ...(options.headers || {}) } }));
};

export const paymentDeviceId = () => loadCloudConfig().deviceId || "";

export const loadPaymentProviders = (businessId) => request(businessId, "/v1/payments/providers");
export const startMercadoPagoConnection = (businessId) => request(businessId, "/v1/payments/mercado-pago/oauth/start", { method: "POST", body: "{}" });
export const disconnectMercadoPago = (businessId) => request(businessId, "/v1/payments/mercado-pago/connection", { method: "DELETE" });

export const createPaymentAttempt = (businessId, payload, idempotencyKey) => request(businessId, "/v1/payments/attempts", {
  method: "POST",
  headers: { "x-idempotency-key": idempotencyKey },
  body: JSON.stringify(payload),
});

export const refreshPaymentAttempt = (businessId, attemptId) => request(businessId, `/v1/payments/attempts/${encodeURIComponent(attemptId)}/refresh`, { method: "POST", body: "{}" });
export const cancelPaymentAttempt = (businessId, attemptId) => request(businessId, `/v1/payments/attempts/${encodeURIComponent(attemptId)}/cancel`, { method: "POST", body: "{}" });
export const listPaymentAttempts = (businessId) => request(businessId, "/v1/payments/attempts");

export const publishPaymentPresentation = (businessId, payload) => request(businessId, "/v1/payments/presentations", { method: "POST", body: JSON.stringify(payload) });
export const listActivePaymentPresentations = (businessId) => request(businessId, "/v1/payments/presentations/active");
export const closePaymentPresentation = (businessId, presentationId) => request(businessId, `/v1/payments/presentations/${encodeURIComponent(presentationId)}`, { method: "DELETE" });

export const PAYMENT_MODES = [
  { id: "ask", label: "Preguntarme en cada venta", detail: "Elegís QR estático, QR dinámico o Point al cobrar." },
  { id: "static_qr", label: "Siempre QR estático", detail: "Muestra la imagen cargada; la caja confirma el comprobante manualmente." },
  { id: "dynamic_qr", label: "Siempre QR dinámico", detail: "Genera un QR nuevo por el importe exacto y espera la acreditación." },
  { id: "point", label: "Siempre Mercado Pago Point", detail: "Envía el importe al número de terminal configurado." },
];

export const PAYMENT_TARGETS = [
  { id: "ask", label: "Preguntarme dónde mostrarlo" },
  { id: "cashier", label: "En el dispositivo que cobra" },
  { id: "customer_display", label: "En la pantalla del cliente" },
  { id: "mobile", label: "En la app abierta en un celular" },
];
