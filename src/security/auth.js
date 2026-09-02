// Una terminal de comercio debe seguir operativa entre jornadas. La sesión
// local acompaña la duración del token renovable de nube; cerrar sesión sigue
// siendo una acción explícita y el administrador puede bloquear el equipo.
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function hashPassword(password, saltValue) {
  const salt = saltValue ? base64ToBytes(saltValue) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, material, 256);
  return { passwordHash: bytesToBase64(new Uint8Array(bits)), passwordSalt: bytesToBase64(salt), passwordVersion: 1 };
}

export async function verifyPassword(password, subject) {
  if (subject.passwordHash && subject.passwordSalt) {
    const candidate = await hashPassword(password, subject.passwordSalt);
    return candidate.passwordHash === subject.passwordHash;
  }
  return subject.password === password;
}

export async function secureSubject(subject) {
  if (!subject) return subject;
  if (subject.passwordHash) {
    const { password: _removed, ...rest } = subject;
    return rest;
  }
  if (!subject.password) return subject;
  const protectedPassword = await hashPassword(subject.password);
  const { password: _removed, ...rest } = subject;
  return { ...rest, ...protectedPassword };
}

export async function secureAccounts(accounts) {
  return Promise.all(accounts.map(async (account) => ({ ...await secureSubject(account), tenantId: String(account.tenantId || account.id), empleados: await Promise.all((account.empleados || []).map(secureSubject)) })));
}

export function createSession(accountId, identity, now = Date.now()) {
  return { accountId, identity, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_DAYS * 24 * 3600000).toISOString() };
}

export function validSession(session, now = Date.now()) {
  return !!session?.accountId && new Date(session.expiresAt).getTime() > now;
}

export function loginGuard(state = {}, username, now = Date.now()) {
  const entry = state[username.toLowerCase()] || { attempts: 0 };
  return { blocked: Number(entry.lockedUntil || 0) > now, remainingMs: Math.max(0, Number(entry.lockedUntil || 0) - now) };
}

export function registerLoginFailure(state = {}, username, now = Date.now()) {
  const key = username.toLowerCase();
  const attempts = (state[key]?.attempts || 0) + 1;
  return { ...state, [key]: attempts >= MAX_ATTEMPTS ? { attempts: 0, lockedUntil: now + LOCK_MINUTES * 60000 } : { attempts, lockedUntil: 0 } };
}

export function clearLoginFailures(state = {}, username) {
  const next = { ...state };
  delete next[username.toLowerCase()];
  return next;
}
