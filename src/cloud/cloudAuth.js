import { CLOUD_CONFIG_KEY, isLocalCloudApiUrl, normalizeCloudApiUrl } from "./config.js";

const SESSION_KEY = "kiosco_cloud_session";
const CLOUD_REQUEST_TIMEOUT_MS = 20000;
const refreshPromises = new Map();
const cloudRequest = async (url, options = {}) => {
  if (options.signal) return fetch(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLOUD_REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw new Error("El servidor de nube tardó demasiado en responder.");
    throw error;
  } finally { clearTimeout(timer); }
};
const configuredApiUrl = () => {
  try { return normalizeCloudApiUrl(JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}").apiUrl); }
  catch { return ""; }
};
const parseStoredSession = (storageArea) => {
  if (!storageArea?.getItem) return null;
  try { return JSON.parse(storageArea.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
};
export const cloudSessionBelongsToApi = (session, apiUrl) => !apiUrl || normalizeCloudApiUrl(session?.apiUrl) === normalizeCloudApiUrl(apiUrl);

const durableSession = (value) => value?.refreshToken ? { ...value, accessToken: undefined } : null;

const read = (apiUrl = "") => {
  const volatile = parseStoredSession(globalThis.sessionStorage);
  if (volatile && cloudSessionBelongsToApi(volatile, apiUrl)) return volatile;
  const durable = parseStoredSession(globalThis.localStorage);
  return durable && cloudSessionBelongsToApi(durable, apiUrl) ? durable : null;
};

const save = (value) => {
  const scoped = { ...value, apiUrl: normalizeCloudApiUrl(value?.apiUrl) };
  const serialized = JSON.stringify(scoped);
  globalThis.sessionStorage?.setItem(SESSION_KEY, serialized);
  const durable = isLocalCloudApiUrl(scoped.apiUrl) ? scoped : durableSession(scoped);
  if (durable) globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(durable));
  globalThis.window?.dispatchEvent?.(new Event("kiosco-cloud-session-changed"));
};

export const cloudSession = (apiUrl = configuredApiUrl()) => read(apiUrl);

export async function bootstrapCloud(apiUrl, payload) {
  return cloudRequest(`${apiUrl.replace(/\/$/, "")}/v1/auth/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginCloud(apiUrl, username, password, deviceId) {
  const response = await cloudRequest(`${apiUrl.replace(/\/$/, "")}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, deviceId }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.error || `No se pudo iniciar sesión en la nube (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  const session = await response.json();
  save({ ...session, apiUrl });
  return session;
}

export async function ensureLocalCloudSession(apiUrl, { businessId, username, password, name, superAdmin = false, deviceId }) {
  if (!isLocalCloudApiUrl(apiUrl)) return null;
  let lastError = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      try {
        return await loginCloud(apiUrl, username, password, deviceId);
      } catch {}
      const provision = await cloudRequest(`${apiUrl.replace(/\/$/, "")}/v1/auth/register-local`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, username, password, name, superAdmin }),
      });
      if (!provision.ok) throw new Error("No se pudo registrar la cuenta local");
      return await loginCloud(apiUrl, username, password, deviceId);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw lastError || new Error("El servidor local no está disponible");
}

export async function logoutCloud(apiUrl) {
  const normalizedApiUrl = normalizeCloudApiUrl(apiUrl);
  const session = read(normalizedApiUrl);
  try {
    if (session?.accessToken && normalizedApiUrl) {
      await cloudRequest(`${normalizedApiUrl}/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
    }
  } finally {
    const volatile = parseStoredSession(globalThis.sessionStorage);
    const durable = parseStoredSession(globalThis.localStorage);
    if (cloudSessionBelongsToApi(volatile, normalizedApiUrl)) globalThis.sessionStorage?.removeItem(SESSION_KEY);
    if (cloudSessionBelongsToApi(durable, normalizedApiUrl)) globalThis.localStorage?.removeItem(SESSION_KEY);
    globalThis.window?.dispatchEvent?.(new Event("kiosco-cloud-session-changed"));
  }
}

async function refreshCloud(apiUrl) {
  const normalizedApiUrl = normalizeCloudApiUrl(apiUrl);
  const current = read(normalizedApiUrl);
  if (!current?.refreshToken) return null;
  const response = await cloudRequest(`${normalizedApiUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!response.ok) {
    const latest = read(normalizedApiUrl);
    if (latest?.refreshToken && latest.refreshToken !== current.refreshToken) return latest;
    const volatile = parseStoredSession(globalThis.sessionStorage);
    const durable = parseStoredSession(globalThis.localStorage);
    if (cloudSessionBelongsToApi(volatile, normalizedApiUrl)) globalThis.sessionStorage?.removeItem(SESSION_KEY);
    if (cloudSessionBelongsToApi(durable, normalizedApiUrl)) globalThis.localStorage?.removeItem(SESSION_KEY);
    return null;
  }
  const renewed = await response.json();
  const session = { ...current, ...renewed };
  save(session);
  return session;
}

const refreshCloudOnce = (apiUrl) => {
  const key = normalizeCloudApiUrl(apiUrl);
  if (!refreshPromises.has(key)) {
    refreshPromises.set(key, refreshCloud(key).finally(() => { refreshPromises.delete(key); }));
  }
  return refreshPromises.get(key);
};

export async function cloudFetch(apiUrl, url, options = {}) {
  const normalizedApiUrl = normalizeCloudApiUrl(apiUrl);
  let session = read(normalizedApiUrl);
  if (!session?.accessToken && session?.refreshToken) {
    session = await refreshCloudOnce(normalizedApiUrl);
  }
  const request = () => cloudRequest(`${normalizedApiUrl}${url}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
    },
  });
  let response = await request();
  if (response.status === 401 && session?.refreshToken) {
    const failedAccessToken = session.accessToken;
    const latest = read(normalizedApiUrl);
    session = latest?.accessToken && latest.accessToken !== failedAccessToken
      ? latest
      : await refreshCloudOnce(normalizedApiUrl);
    if (session) response = await request();
  }
  return response;
}
