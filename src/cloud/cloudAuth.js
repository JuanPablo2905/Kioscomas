const SESSION_KEY = "kiosco_cloud_session";
const isLocalApi = (value) => /^(http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+):8787|https:\/\/[a-z0-9.-]+\.ts\.net:8443)\/?$/i.test(String(value || ""));

const read = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
};

const save = (value) => {
  const serialized = JSON.stringify(value);
  sessionStorage.setItem(SESSION_KEY, serialized);
  if (isLocalApi(value?.apiUrl)) localStorage.setItem(SESSION_KEY, serialized);
};

export const cloudSession = () => read();

export async function bootstrapCloud(apiUrl, payload) {
  return fetch(`${apiUrl.replace(/\/$/, "")}/v1/auth/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginCloud(apiUrl, username, password, deviceId) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, deviceId }),
  });
  if (!response.ok) throw new Error("Usuario o contrasena de nube incorrectos");
  const session = await response.json();
  save({ ...session, apiUrl });
  return session;
}

export async function ensureLocalCloudSession(apiUrl, { businessId, username, password, name, superAdmin = false, deviceId }) {
  if (!isLocalApi(apiUrl)) return null;
  let lastError = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      try {
        return await loginCloud(apiUrl, username, password, deviceId);
      } catch {}
      const provision = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/auth/register-local`, {
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
  const session = read();
  try {
    if (session?.accessToken && apiUrl) {
      await fetch(`${apiUrl.replace(/\/$/, "")}/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
    }
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
}

async function refreshCloud(apiUrl) {
  const current = read();
  if (!current?.refreshToken) return null;
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!response.ok) {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const renewed = await response.json();
  const session = { ...current, ...renewed };
  save(session);
  return session;
}

export async function cloudFetch(apiUrl, url, options = {}) {
  let session = read();
  const request = () => fetch(`${apiUrl.replace(/\/$/, "")}${url}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
    },
  });
  let response = await request();
  if (response.status === 401 && session?.refreshToken) {
    session = await refreshCloud(apiUrl);
    if (session) response = await request();
  }
  return response;
}
