import { normalizeCloudApiUrl } from "./config.js";

const DEFAULT_TOTAL_TIMEOUT_MS = 115_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRY_DELAY_MS = 1_500;
const READY_CACHE_MS = 5 * 60_000;

const listeners = new Set();
const inFlight = new Map();
const readyAt = new Map();
let currentState = {
  status: "idle",
  apiUrl: "",
  attempt: 0,
  startedAt: null,
  readyAt: null,
  error: "",
};

const publish = (next) => {
  currentState = { ...currentState, ...next };
  listeners.forEach((listener) => listener(currentState));
  return currentState;
};

const browserIsOnline = () => typeof globalThis.navigator === "undefined" || globalThis.navigator.onLine !== false;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const cloudUnavailableError = (message, code = "cloud_unavailable") => {
  const error = new Error(message);
  error.code = code;
  error.temporary = true;
  return error;
};

export const getCloudWarmupState = () => currentState;

export const subscribeCloudWarmup = (listener) => {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
};

/**
 * Despierta la API cuando la persona abre Kiosco+ y espera a que también esté
 * disponible la base de datos. No deja ningún ping periódico funcionando.
 */
export function startCloudWarmup(apiUrl, {
  force = false,
  totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  const base = normalizeCloudApiUrl(apiUrl);
  if (!base) return Promise.reject(cloudUnavailableError("La dirección de la nube no está configurada.", "cloud_not_configured"));

  if (!browserIsOnline()) {
    const error = cloudUnavailableError("No hay conexión a Internet para preparar la nube.", "cloud_offline");
    publish({ status: "offline", apiUrl: base, error: error.message, attempt: 0 });
    return Promise.reject(error);
  }

  const cachedAt = readyAt.get(base) || 0;
  if (!force && cachedAt && Date.now() - cachedAt < READY_CACHE_MS) {
    publish({ status: "ready", apiUrl: base, readyAt: cachedAt, error: "" });
    return Promise.resolve(currentState);
  }

  if (inFlight.has(base)) return inFlight.get(base);

  const startedAt = Date.now();
  const operation = (async () => {
    let attempt = 0;
    let lastError = null;
    publish({ status: "waking", apiUrl: base, attempt, startedAt, readyAt: null, error: "" });

    while (Date.now() - startedAt < totalTimeoutMs) {
      if (!browserIsOnline()) {
        const error = cloudUnavailableError("Se perdió la conexión a Internet mientras se preparaba la nube.", "cloud_offline");
        publish({ status: "offline", apiUrl: base, error: error.message, attempt });
        throw error;
      }

      attempt += 1;
      publish({ status: "waking", apiUrl: base, attempt, startedAt, error: "" });
      const remaining = Math.max(1, totalTimeoutMs - (Date.now() - startedAt));
      try {
        const response = await fetchWithTimeout(`${base}/v1/ready`, Math.min(attemptTimeoutMs, remaining));
        const detail = await response.json().catch(() => ({}));
        if (response.ok && detail?.ok !== false) {
          const timestamp = Date.now();
          readyAt.set(base, timestamp);
          return publish({ status: "ready", apiUrl: base, attempt, startedAt, readyAt: timestamp, error: "" });
        }
        lastError = cloudUnavailableError(detail?.error || `La nube todavía se está preparando (${response.status}).`);
      } catch (error) {
        lastError = error?.name === "AbortError"
          ? cloudUnavailableError("La nube todavía se está iniciando.", "cloud_waking")
          : cloudUnavailableError(error?.message || "No se pudo contactar a la nube.");
      }

      const remainingAfterAttempt = totalTimeoutMs - (Date.now() - startedAt);
      if (remainingAfterAttempt <= 0) break;
      await pause(Math.min(retryDelayMs, remainingAfterAttempt));
    }

    const error = cloudUnavailableError(
      "La nube todavía no respondió. Esperá unos segundos y volvé a intentar.",
      lastError?.code || "cloud_timeout",
    );
    publish({ status: "error", apiUrl: base, attempt, startedAt, error: error.message });
    throw error;
  })().finally(() => inFlight.delete(base));

  inFlight.set(base, operation);
  return operation;
}

export const waitForCloudReady = (apiUrl, options = {}) => startCloudWarmup(apiUrl, options);

