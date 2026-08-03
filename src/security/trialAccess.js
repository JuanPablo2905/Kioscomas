const DAY_MS = 24 * 60 * 60 * 1000;

const allowedTrialDays = (days) => (Number(days) === 7 ? 7 : 1);

export function grantTrialAccess(account, days = 1, now = Date.now()) {
  const durationDays = allowedTrialDays(days);
  return {
    ...account,
    estado: account?.estado === "bloqueada" ? "pendiente" : (account?.estado || "pendiente"),
    trialStartedAt: new Date(now).toISOString(),
    trialExpiresAt: new Date(now + durationDays * DAY_MS).toISOString(),
    trialDays: durationDays,
  };
}

export function trialAccessStatus(account, now = Date.now()) {
  if (!account) return { allowed: false, active: false, reason: "missing" };
  if (account.superAdmin || account.estado === "aprobada") {
    return { allowed: true, active: false, reason: "approved" };
  }
  if (account.estado === "bloqueada") {
    return { allowed: false, active: false, reason: "blocked" };
  }
  const expiresAtMs = Date.parse(account.trialExpiresAt || "");
  if (Number.isFinite(expiresAtMs) && expiresAtMs > now) {
    return {
      allowed: true,
      active: true,
      reason: "trial",
      expiresAt: new Date(expiresAtMs).toISOString(),
      remainingMs: expiresAtMs - now,
      remainingDays: Math.max(1, Math.ceil((expiresAtMs - now) / DAY_MS)),
    };
  }
  return { allowed: false, active: false, reason: Number.isFinite(expiresAtMs) ? "expired" : "pending" };
}

export const canAccessAccount = (account, now = Date.now()) => trialAccessStatus(account, now).allowed;

export function accountAccessMessage(account, now = Date.now()) {
  const status = trialAccessStatus(account, now);
  if (status.reason === "blocked") return "Esta cuenta está bloqueada.";
  if (status.reason === "expired") return "El período de prueba venció. La cuenta conserva sus datos y está esperando aprobación.";
  return "Esta cuenta todavía está pendiente de aprobación y no tiene una prueba activa.";
}

export function formatTrialExpiration(account) {
  const expiresAtMs = Date.parse(account?.trialExpiresAt || "");
  if (!Number.isFinite(expiresAtMs)) return "";
  return new Date(expiresAtMs).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

