import { loadCloudConfig } from "../../cloud/config";
import { cloudFetch, cloudSession } from "../../cloud/cloudAuth";

const context = () => {
  const config = loadCloudConfig();
  const session = cloudSession(config.apiUrl);
  if (!config.enabled || !config.apiUrl || !session?.user?.businessId) throw new Error("La sesión de nube no está conectada.");
  return { config, session };
};

const request = async (path, options = {}) => {
  const { config, session } = context();
  const response = await cloudFetch(config.apiUrl, path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-device-id": config.deviceId,
      "x-tenant-id": String(session.user.businessId),
      ...(options.headers || {}),
    },
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detail.error || "No se pudo completar la operación de notificaciones.");
  return detail;
};

const previewHeaders = (previewBusinessId) => previewBusinessId ? { "x-kiosco-preview-business": String(previewBusinessId) } : {};
export const loadPlatformNotifications = ({ previewBusinessId = "" } = {}) => request("/v1/notifications", { headers: previewHeaders(previewBusinessId) });
export const markPlatformNotificationRead = (id, { previewBusinessId = "" } = {}) => request(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: "POST", body: "{}", headers: previewHeaders(previewBusinessId) });
export const loadAdminNotifications = () => request("/v1/admin/notifications");
export const publishPlatformNotification = (values) => request("/v1/admin/notifications", { method: "POST", body: JSON.stringify(values) });
export const archivePlatformNotification = (id) => request(`/v1/admin/notifications/${encodeURIComponent(id)}/archive`, { method: "POST", body: "{}" });
export const reportPlatformIssue = (values) => request("/v1/issues", { method: "POST", body: JSON.stringify(values) });
export const loadAdminIssues = () => request("/v1/admin/issues");
export const updateAdminIssueStatus = (id, status) => request(`/v1/admin/issues/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status }) });
export const archiveAdminIssue = (id) => request(`/v1/admin/issues/${encodeURIComponent(id)}/archive`, { method: "POST", body: "{}" });
export const sendPushNotificationTest = () => request("/v1/notifications/test", { method: "POST", body: "{}" });

export const NOTIFICATION_CATEGORY_OPTIONS = [
  ["subscription", "Suscripción y acceso"],
  ["orders", "Pedidos y entregas"],
  ["stock", "Stock y reposición"],
  ["expirations", "Vencimientos de productos"],
  ["cash", "Caja y diferencias"],
  ["payments", "Cobros y Mercado Pago"],
  ["expenses", "Gastos y pagos"],
  ["accounts", "Clientes y cuentas corrientes"],
  ["sync", "Nube y sincronización"],
  ["maintenance", "Mantenimiento y novedades"],
];
export const DEFAULT_PUSH_PREFERENCES = {
  mode: "all",
  quietHoursEnabled: true,
  quietStart: "22:00",
  quietEnd: "08:00",
  categories: Object.fromEntries(NOTIFICATION_CATEGORY_OPTIONS.map(([id]) => [id, true])),
};

export const normalizePushPreferences = (value = {}) => ({
  ...DEFAULT_PUSH_PREFERENCES,
  ...value,
  mode: ["all", "important", "none"].includes(value.mode) ? value.mode : DEFAULT_PUSH_PREFERENCES.mode,
  categories: { ...DEFAULT_PUSH_PREFERENCES.categories, ...(value.categories || {}) },
});

export const pushCapability = () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" ? "granted" : "available";
};

export async function hasActivePushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

// El permiso del navegador (Notification.permission) nunca vuelve a "no otorgado" por código,
// aunque el usuario haya desactivado los avisos desde Kiosco+ y ya no exista una suscripción real.
// Por eso el estado visible depende de si hay una suscripción activa, no sólo del permiso.
export async function resolvePushState() {
  const capability = pushCapability();
  if (capability !== "granted") return capability;
  return (await hasActivePushSubscription()) ? "granted" : "available";
}

const urlBase64ToBytes = (value) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};
const sameBytes = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);

export async function enablePushNotifications(preferences = DEFAULT_PUSH_PREFERENCES) {
  if (pushCapability() === "unsupported") throw new Error("Este navegador no admite avisos al celular.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("El permiso de notificaciones no fue autorizado.");
  const { config } = context();
  const keyResponse = await fetch(`${config.apiUrl.replace(/\/$/, "")}/v1/notifications/push-public-key`);
  const keyDetail = await keyResponse.json().catch(() => ({}));
  if (!keyResponse.ok || !keyDetail.publicKey) throw new Error(keyDetail.error || "El servidor todavía no tiene configurados los avisos al celular.");
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToBytes(keyDetail.publicKey);
  let previous = await registration.pushManager.getSubscription();
  const previousKey = previous?.options?.applicationServerKey ? new Uint8Array(previous.options.applicationServerKey) : null;
  if (previous && previousKey && !sameBytes(previousKey, applicationServerKey)) {
    await previous.unsubscribe();
    previous = null;
  }
  const subscription = previous || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  await request("/v1/notifications/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({ subscription: subscription.toJSON(), preferences: normalizePushPreferences(preferences) }),
  });
  return subscription;
}

export async function updatePushNotificationPreferences(preferences) {
  if (!("serviceWorker" in navigator)) return { savedLocally: true };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { savedLocally: true };
  return request("/v1/notifications/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({ subscription: subscription.toJSON(), preferences: normalizePushPreferences(preferences) }),
  });
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await request("/v1/notifications/push-subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
  await subscription.unsubscribe();
}
