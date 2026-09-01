export const CLOUD_CONFIG_KEY = "kiosco_cloud_config";

export const normalizeCloudApiUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
export const isLocalCloudApiUrl = (value) => /^(http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+):8787|https:\/\/[a-z0-9.-]+\.ts\.net:8443)\/?$/i.test(normalizeCloudApiUrl(value));

const publishedApiUrl = normalizeCloudApiUrl(import.meta.env?.VITE_PUBLIC_API_URL || "");
const autoConnectPublishedCloud = import.meta.env?.VITE_CLOUD_AUTO_CONNECT === "true";

export const defaultCloudConfig = {
  enabled: Boolean(publishedApiUrl) && autoConnectPublishedCloud,
  apiUrl: publishedApiUrl,
  serverMode: publishedApiUrl ? "remote" : "local",
  deviceId: "",
  syncIntervalMs: 30000,
  updateChannel: "stable",
  autoCheckUpdates: true,
};

export function resolveCloudConfig({ saved = {}, localUrl = "", publicApiUrl = publishedApiUrl, autoConnect = autoConnectPublishedCloud } = {}) {
  const normalizedPublicUrl = normalizeCloudApiUrl(publicApiUrl);
  const normalizedLocalUrl = normalizeCloudApiUrl(localUrl);
  const savedApiUrl = normalizeCloudApiUrl(saved.apiUrl);
  const savedIsLocal = isLocalCloudApiUrl(savedApiUrl);
  const explicitlyLocal = saved.serverMode === "local" && savedIsLocal;
  const migrateLegacyLocal = Boolean(normalizedPublicUrl && autoConnect && savedIsLocal && !explicitlyLocal);
  let apiUrl = savedApiUrl;

  if (normalizedPublicUrl && autoConnect && (!savedApiUrl || migrateLegacyLocal)) apiUrl = normalizedPublicUrl;
  else if (!apiUrl && normalizedLocalUrl) apiUrl = normalizedLocalUrl;

  const deviceId = saved.deviceId || globalThis.crypto?.randomUUID?.() || `device-${Date.now()}`;
  return {
    ...defaultCloudConfig,
    ...saved,
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : Boolean(apiUrl),
    apiUrl,
    serverMode: isLocalCloudApiUrl(apiUrl) ? "local" : "remote",
    deviceId,
    migratedFromLocal: Boolean(saved.migratedFromLocal || migrateLegacyLocal),
  };
}

export function loadCloudConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
    const hostname = globalThis.location?.hostname || "";
    const privateHost = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)$/.test(hostname);
    const tailscaleDns = /\.ts\.net$/i.test(hostname);
    const localUrl = globalThis.window?.kioscoDesktop?.localCloudUrl || (tailscaleDns ? `https://${hostname}:8443` : privateHost ? `http://${hostname}:8787` : "");
    const config = resolveCloudConfig({ saved, localUrl });
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    return config;
  } catch {
    return { ...defaultCloudConfig, deviceId: `device-${Date.now()}` };
  }
}

export function saveCloudConfig(config) {
  const apiUrl = normalizeCloudApiUrl(config.apiUrl);
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({
    ...defaultCloudConfig,
    ...config,
    apiUrl,
    serverMode: isLocalCloudApiUrl(apiUrl) ? "local" : "remote",
  }));
}
