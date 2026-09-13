import { cloudFetch } from "../../cloud/cloudAuth";
import { loadCloudConfig } from "../../cloud/config";

const context = (businessId) => {
  const config = loadCloudConfig();
  if (!config.enabled || !config.apiUrl) throw new Error("Primero conectá la aplicación con la nube.");
  return { config, headers: { "content-type": "application/json", "x-tenant-id": String(businessId || ""), "x-device-id": config.deviceId } };
};

const result = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación.");
  return payload;
};

export async function listRemoteDisplays(businessId) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, "/v1/business-displays", { headers }));
}

export async function createRemoteDisplay(businessId, name, content) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, "/v1/business-displays", { method: "POST", headers, body: JSON.stringify({ name, content }) }));
}

export async function updateRemoteDisplay(businessId, displayId, patch) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, `/v1/business-displays/${encodeURIComponent(displayId)}`, { method: "PUT", headers, body: JSON.stringify(patch) }));
}

export async function createRemotePairing(businessId, displayId) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, `/v1/business-displays/${encodeURIComponent(displayId)}/pairing-code`, { method: "POST", headers, body: "{}" }));
}

export async function approveRemotePairing(businessId, displayId, code) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, `/v1/business-displays/${encodeURIComponent(displayId)}/pair`, {
    method: "POST", headers, body: JSON.stringify({ code }),
  }));
}

export async function revokeRemoteDisplay(businessId, displayId) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, `/v1/business-displays/${encodeURIComponent(displayId)}/revoke`, { method: "POST", headers, body: "{}" }));
}

export async function deleteRemoteDisplay(businessId, displayId) {
  const { config, headers } = context(businessId);
  return result(await cloudFetch(config.apiUrl, `/v1/business-displays/${encodeURIComponent(displayId)}`, { method: "DELETE", headers }));
}

const remoteDeviceId = () => {
  const key = "kiosco:remote-display-device";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID?.() || `screen-${Date.now()}`; localStorage.setItem(key, id); }
  return id;
};

const pairingRequestKey = "kiosco:remote-display-pairing-request";
let pendingPairingRequest = null;

const cachedPairingRequest = () => {
  try {
    const value = JSON.parse(localStorage.getItem(pairingRequestKey) || "null");
    return value?.requestToken && Date.parse(value.expiresAt || "") > Date.now() + 5000 ? value : null;
  } catch { return null; }
};

export async function requestRemoteDisplayPairing({ force = false } = {}) {
  const config = loadCloudConfig();
  if (!config.apiUrl) throw new Error("Esta pantalla no conoce la dirección del servidor.");
  if (!force && pendingPairingRequest) return pendingPairingRequest;
  if (!force) {
    const cached = cachedPairingRequest();
    if (cached) return cached;
  }
  localStorage.removeItem(pairingRequestKey);
  const operation = (async () => {
    const payload = await result(await fetch(`${config.apiUrl}/v1/displays/pairing-request`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: remoteDeviceId() }),
    }));
    localStorage.setItem(pairingRequestKey, JSON.stringify(payload.pairing));
    return payload.pairing;
  })();
  if (!force) pendingPairingRequest = operation;
  try { return await operation; }
  finally { if (pendingPairingRequest === operation) pendingPairingRequest = null; }
}

export async function pollRemoteDisplayPairing(requestToken) {
  const config = loadCloudConfig();
  if (!config.apiUrl) throw new Error("Esta pantalla no conoce la dirección del servidor.");
  const response = await fetch(`${config.apiUrl}/v1/displays/pairing-status`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestToken }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 202) return payload;
  if (!response.ok) {
    const error = new Error(payload.error || "No se pudo consultar la vinculación.");
    error.status = response.status; throw error;
  }
  if (payload.status === "approved" && payload.displayToken) {
    localStorage.setItem("kiosco:remote-display-token", payload.displayToken);
    localStorage.setItem("kiosco:remote-display-cache", JSON.stringify({ savedAt: Date.now(), display: payload.display }));
    localStorage.removeItem(pairingRequestKey);
  }
  return payload;
}

export function remoteDisplayEntryUrl() {
  const configured = import.meta.env.VITE_PUBLIC_DISPLAY_URL || "https://kioscomas.ar/pantalla";
  return new URL(configured, window.location.href).toString();
}

export async function pairRemoteDisplay(code) {
  const config = loadCloudConfig();
  if (!config.apiUrl) throw new Error("Esta pantalla no conoce la dirección del servidor.");
  const response = await fetch(`${config.apiUrl}/v1/displays/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, deviceId: remoteDeviceId() }) });
  const payload = await result(response);
  localStorage.setItem("kiosco:remote-display-token", payload.displayToken);
  localStorage.setItem("kiosco:remote-display-cache", JSON.stringify({ savedAt: Date.now(), display: payload.display }));
  return payload;
}

export async function loadRemoteDisplay() {
  const config = loadCloudConfig();
  const displayToken = localStorage.getItem("kiosco:remote-display-token") || "";
  if (!config.apiUrl || !displayToken) throw new Error("Esta pantalla todavía no está vinculada.");
  const payload = await result(await fetch(`${config.apiUrl}/v1/displays/content`, { headers: { authorization: `Display ${displayToken}` } }));
  localStorage.setItem("kiosco:remote-display-cache", JSON.stringify({ savedAt: Date.now(), display: payload.display }));
  return payload;
}

export function cachedRemoteDisplay() {
  try { return JSON.parse(localStorage.getItem("kiosco:remote-display-cache") || "null"); } catch { return null; }
}

export function unlinkRemoteDisplay() {
  localStorage.removeItem("kiosco:remote-display-token");
  localStorage.removeItem("kiosco:remote-display-cache");
  localStorage.removeItem(pairingRequestKey);
}
