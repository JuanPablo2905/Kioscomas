const RECEIPT_KEY = "kiosco_installation_activation_v1";
const REQUEST_TIMEOUT_MS = 20000;

const activationRequest = async (apiUrl, path, payload) => {
  const base = String(apiUrl || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("La dirección de la nube no está configurada.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const detail = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(detail.error || "No se pudo comprobar la clave de instalación.");
      error.status = response.status;
      throw error;
    }
    return detail;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("La nube tardó demasiado en responder. Revisá Internet e intentá otra vez.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const loadInstallationReceipt = () => {
  try { return JSON.parse(globalThis.localStorage?.getItem(RECEIPT_KEY) || "null"); }
  catch { return null; }
};

export const saveInstallationReceipt = (value) => {
  globalThis.localStorage?.setItem(RECEIPT_KEY, JSON.stringify(value));
  return value;
};

export const clearInstallationReceipt = () => globalThis.localStorage?.removeItem(RECEIPT_KEY);

export const markLegacyInstallation = (deviceId) => saveInstallationReceipt({
  activated: true,
  mode: "legacy",
  deviceId,
  activatedAt: new Date().toISOString(),
});

export const verifyInstallationActivation = (apiUrl, deviceId, appVersion = "") => activationRequest(apiUrl, "/v1/activation/status", {
  deviceId,
  appVersion,
});

export const redeemInstallationCode = async (apiUrl, code, deviceId, appVersion = "") => {
  const result = await activationRequest(apiUrl, "/v1/activation/redeem", { code, deviceId, appVersion });
  if (result.activated) {
    saveInstallationReceipt({
      activated: true,
      mode: "code",
      deviceId,
      activationId: result.activation?.id || null,
      activatedAt: result.activation?.activatedAt || new Date().toISOString(),
    });
  }
  return result;
};

