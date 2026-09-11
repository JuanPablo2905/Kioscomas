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
}
