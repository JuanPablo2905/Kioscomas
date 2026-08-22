export const CLOUD_CONFIG_KEY = "kiosco_cloud_config";

const publishedApiUrl = String(import.meta.env?.VITE_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
const autoConnectPublishedCloud = import.meta.env?.VITE_CLOUD_AUTO_CONNECT === "true";

export const defaultCloudConfig = {
  enabled: Boolean(publishedApiUrl) && autoConnectPublishedCloud,
  apiUrl: publishedApiUrl,
  deviceId: "",
  syncIntervalMs: 30000,
  updateChannel: "stable",
  autoCheckUpdates: true,
};

export function loadCloudConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
    const deviceId = saved.deviceId || globalThis.crypto?.randomUUID?.() || `device-${Date.now()}`;
    const hostname = globalThis.location?.hostname || "";
    const privateHost = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)$/.test(hostname);
    const tailscaleDns = /\.ts\.net$/i.test(hostname);
    const localUrl = globalThis.window?.kioscoDesktop?.localCloudUrl || (tailscaleDns ? `https://${hostname}:8443` : privateHost ? `http://${hostname}:8787` : "");
    const savedIsLocal = /^(http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+):8787|https:\/\/[a-z0-9.-]+\.ts\.net:8443)\/?$/i.test(saved.apiUrl || "");
    const useLocal = localUrl && (!saved.apiUrl || savedIsLocal);
    const localDefaults = useLocal ? { enabled: true, apiUrl: localUrl } : {};
    const config = { ...defaultCloudConfig, ...localDefaults, ...saved, deviceId };
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    return config;
  } catch {
    return { ...defaultCloudConfig, deviceId: `device-${Date.now()}` };
  }
}

export function saveCloudConfig(config) {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ ...defaultCloudConfig, ...config }));
}
