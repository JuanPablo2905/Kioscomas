import { storage } from "../shared/storage";
import { syncEngine } from "./syncEngine";
import { extractTenantValue, SYNCABLE_KEYS } from "./protocol";
import { diffTenantEntities, diffTenantSections } from "./entitySync";
import { loadCloudConfig } from "./config";
import { cloudFetch, cloudSession } from "./cloudAuth";
import { withDataStorageLock } from "./dataStorageLock";

let context = { tenantId: null, isSystemAdmin: false };
let syncTimer = null;
let bootstrapScope = "";
let bootstrapPromise = null;
let bootstrapResult = null;
let teamSyncTimer = null;
let teamSyncMutation = Promise.resolve();
let teamSyncDirty = false;
const scheduleSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    ensureCloudBootstrap()
      .then(() => syncEngine.flush())
      .catch(() => {});
  }, 120);
};
const canSyncSystemData = () => cloudSession()?.user?.role === "superAdmin";
const teamValue = (account = {}) => ({
  roles: account.roles || [],
  empleados: account.empleados || [],
  modoNegocio: account.modoNegocio === "solo" ? "solo" : "equipo",
});
const readStoredAccounts = async () => {
  const result = await storage.get("cuentas");
  try { return result?.value ? JSON.parse(result.value) : []; } catch { return []; }
};
const writeAccountsAndNotify = async (accounts, detail = {}) => {
  await storage.set("cuentas", JSON.stringify(accounts));
  globalThis.window?.dispatchEvent?.(new CustomEvent("kiosco-cloud-update", {
    detail: { tenantId: String(context.tenantId || ""), accounts: true, authoritative: true, ...detail },
  }));
};
const flushBusinessTeam = async () => {
  clearTimeout(teamSyncTimer);
  teamSyncTimer = null;
  if (!teamSyncDirty) return { skipped: true };
  const run = async () => {
    const config = loadCloudConfig();
    const session = cloudSession(config.apiUrl);
    if (!config.enabled || !config.apiUrl || !context.tenantId || !["owner", "employee"].includes(session?.user?.role)) return { skipped: true };
    const accounts = await readStoredAccounts();
    const account = accounts.find((item) => String(item?.id) === String(context.tenantId));
    if (!account) return { skipped: true };
    teamSyncDirty = false;
    const sentTeam = teamValue(account);
    const response = await cloudFetch(config.apiUrl, "/v1/account", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-device-id": config.deviceId, "x-tenant-id": String(context.tenantId) },
      body: JSON.stringify({ teamRevision: Number(account.teamRevision || 0), businessMode: sentTeam.modoNegocio, roles: sentTeam.roles, employees: sentTeam.empleados }),
    });
    const detail = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409 && detail.account) {
        // La nube ganó la carrera. Reemplazar la foto local evita reintentar
        // eternamente con la misma revisión atrasada; el usuario puede volver
        // a aplicar su cambio sobre el equipo que acaba de descargarse.
        const latest = await readStoredAccounts();
        const authoritative = latest.map((item) => String(item?.id) === String(context.tenantId) ? detail.account : item);
        if (!authoritative.some((item) => String(item?.id) === String(context.tenantId))) authoritative.push(detail.account);
        teamSyncDirty = false;
        await writeAccountsAndNotify(authoritative, { team: true, conflict: true });
      } else {
        teamSyncDirty = true;
      }
      throw new Error(detail.error || `No se pudo guardar el equipo en la nube (${response.status}).`);
    }
    const latest = await readStoredAccounts();
    const latestAccount = latest.find((item) => String(item?.id) === String(context.tenantId));
    const teamChangedWhileSaving = JSON.stringify(teamValue(latestAccount)) !== JSON.stringify(sentTeam);
    const merged = latest.map((item) => String(item?.id) !== String(context.tenantId)
      ? item
      : teamChangedWhileSaving
        ? { ...item, teamRevision: Number(detail.teamRevision || 0) }
        : detail.account);
    await writeAccountsAndNotify(merged, { team: true });
    if (teamChangedWhileSaving) scheduleBusinessTeamSync();
    return detail;
  };
  teamSyncMutation = teamSyncMutation.then(run, run);
  return teamSyncMutation;
};
const scheduleBusinessTeamSync = () => {
  teamSyncDirty = true;
  clearTimeout(teamSyncTimer);
  teamSyncTimer = setTimeout(() => flushBusinessTeam().catch((error) => syncEngine.reportError(error)), 350);
};
const refreshCurrentCloudAccount = async () => {
  const config = loadCloudConfig();
  const session = cloudSession(config.apiUrl);
  if (!config.enabled || !config.apiUrl || !context.tenantId || !["owner", "employee"].includes(session?.user?.role)) return { skipped: true };
  const response = await cloudFetch(config.apiUrl, "/v1/account", {
    headers: { "x-device-id": config.deviceId, "x-tenant-id": String(context.tenantId) },
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detail.error || `No se pudo actualizar el equipo (${response.status}).`);
  const accounts = await readStoredAccounts();
  const next = accounts.map((item) => {
    if (String(item?.id) !== String(context.tenantId)) return item;
    if (session.user.role === "owner") return detail.account;
    const remoteEmployees = detail.account?.empleados || [];
    return {
      ...item,
      ...detail.account,
      empleados: remoteEmployees.length
        ? remoteEmployees.map((employee) => ({ ...(item.empleados || []).find((candidate) => String(candidate?.id) === String(employee.id)), ...employee }))
        : item.empleados || [],
    };
  });
  if (!next.some((item) => String(item?.id) === String(context.tenantId)) && detail.account) next.push(detail.account);
  if (JSON.stringify(next) !== JSON.stringify(accounts)) await writeAccountsAndNotify(next, { team: true });
  return detail;
};
const refreshSystemAccountDirectory = async () => {
  if (!context.isSystemAdmin) return { skipped: true };
  const config = loadCloudConfig();
  const session = cloudSession(config.apiUrl);
  if (!config.enabled || !config.apiUrl || !context.tenantId || session?.user?.role !== "superAdmin") {
    return { skipped: true };
  }
  const response = await cloudFetch(config.apiUrl, "/v1/admin/accounts", {
    headers: {
      "x-device-id": config.deviceId,
      "x-tenant-id": String(context.tenantId),
    },
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error("La sesión de nube venció. Volvé a iniciar sesión.");
    if (response.status === 403) throw new Error("Este dispositivo ya no tiene permiso para consultar los negocios.");
    throw new Error(detail.error || `No se pudo actualizar la lista de negocios (${response.status}).`);
  }
  const remoteBusinesses = (Array.isArray(detail.accounts) ? detail.accounts : [])
    .filter((account) => account && !account.superAdmin);
  const currentResult = await storage.get("cuentas");
  let currentAccounts = [];
  try { currentAccounts = currentResult?.value ? JSON.parse(currentResult.value) : []; } catch {}
  const localAdministrators = (Array.isArray(currentAccounts) ? currentAccounts : [])
    .filter((account) => account?.superAdmin);
  const accounts = [...localAdministrators, ...remoteBusinesses];
  const serialized = JSON.stringify(accounts);
  if (currentResult?.value !== serialized) await storage.set("cuentas", serialized);
  globalThis.window?.dispatchEvent?.(new CustomEvent("kiosco-cloud-update", {
    detail: { tenantId: String(context.tenantId), accounts: true, authoritative: true },
  }));
  return { ...detail, accounts };
};
const currentBootstrapScope = () => {
  const config = loadCloudConfig();
  return `${config.enabled ? config.apiUrl : "local"}:${String(context.tenantId || "")}`;
};
const ensureCloudBootstrap = async () => {
  const scope = currentBootstrapScope();
  if (!context.tenantId || scope.startsWith("local:")) return { hasRemoteData: false, skipped: true };
  if (scope !== bootstrapScope) {
    bootstrapScope = scope;
    bootstrapPromise = null;
    bootstrapResult = null;
  }
  if (bootstrapResult) return bootstrapResult;
  if (!bootstrapPromise) {
    bootstrapPromise = syncEngine.bootstrapTenant()
      .then((result) => { bootstrapResult = result; return result; })
      .catch((error) => { bootstrapPromise = null; syncEngine.reportError(error); throw error; });
  }
  return bootstrapPromise;
};
const recoveryRequest = async (route, options = {}) => {
  const config = loadCloudConfig();
  if (!config.enabled || !config.apiUrl || !context.tenantId) throw new Error("Conectá este negocio a la nube para usar la recuperación");
  const response = await cloudFetch(config.apiUrl, route, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      "x-device-id": config.deviceId,
      "x-tenant-id": String(context.tenantId),
      ...(options.headers || {}),
    },
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detail.error || `La nube rechazó la solicitud (${response.status}).`);
  return detail;
};

// Único acceso a persistencia. En la migración se reemplaza esta implementación
// por una API HTTPS sin cambiar las pantallas ni las reglas de negocio.
export const repository = {
  async initialize() {
    bootstrapScope = "";
    bootstrapPromise = null;
    bootstrapResult = null;
    await syncEngine.initialize();

    // Al reabrir la app ya existe una sesión local, pero React todavía no
    // alcanzó a restaurarla. Preparar la nube acá evita que los efectos de
    // arranque vuelvan a guardar la copia vieja antes de descargar la vigente.
    if (!context.tenantId) {
      const savedSessionResult = await storage.get("sesion");
      try {
        const savedSession = savedSessionResult?.value ? JSON.parse(savedSessionResult.value) : null;
        const sessionIsCurrent = savedSession?.accountId
          && (!savedSession.expiresAt || new Date(savedSession.expiresAt).getTime() > Date.now());
        if (sessionIsCurrent) {
          context = {
            ...context,
            tenantId: String(savedSession.accountId),
            isSystemAdmin: !!(savedSession.identity?.superAdmin || savedSession.identity?.adminApp),
          };
          syncEngine.setContext(context);
          // La nube puede estar despertando, migrando datos o reintentando una
          // sesión y tardar varios segundos. El arranque siempre debe terminar
          // con la copia local disponible; la actualización remota continúa en
          // segundo plano y notificará a la interfaz cuando esté lista.
          setTimeout(() => {
            ensureCloudBootstrap()
              .then(() => syncEngine.flush())
              .catch(() => {});
          }, 0);
        }
      } catch {}
    }
  },
  setContext(value) {
    const previousTenant = String(context.tenantId || "");
    context = { ...context, ...value };
    if (previousTenant !== String(context.tenantId || "")) {
      bootstrapScope = "";
      bootstrapPromise = null;
      bootstrapResult = null;
    }
    syncEngine.setContext(context);
  },
  subscribe: (fn) => syncEngine.subscribe(fn),
  getSyncStatus: () => syncEngine.getStatus(),
  reportSyncError: (error) => syncEngine.reportError(error),
  listRecoveryBackups: () => recoveryRequest("/v1/recovery/backups"),
  previewRecovery: (backupDay) => recoveryRequest("/v1/recovery/preview", { method: "POST", body: JSON.stringify({ backupDay }) }),
  exportBusinessData: () => recoveryRequest("/v1/recovery/export"),
  async restoreRecovery(backupDay, confirmation) {
    const result = await recoveryRequest("/v1/recovery/restore", { method: "POST", body: JSON.stringify({ backupDay, confirmation }) });
    bootstrapResult = null;
    bootstrapPromise = null;
    await syncEngine.replaceTenantFromCloud();
    return result;
  },
  async syncNow() {
    try {
      await ensureCloudBootstrap();
      await flushBusinessTeam();
      const result = await syncEngine.flush();
      await refreshSystemAccountDirectory();
      await refreshCurrentCloudAccount();
      return result;
    } catch (error) {
      syncEngine.reportError(error);
      throw error;
    }
  },
  async seedCurrentTenant() {
    if (!context.tenantId) return;
    const bootstrap = await ensureCloudBootstrap();
    if (bootstrap.hasRemoteData) return syncEngine.flush();
    const tenantId = String(context.tenantId);
    const config = loadCloudConfig();
    const allData = await this.get("datos", {});
    const dataset = extractTenantValue("datos", allData, tenantId) || {};
    const operations = [
      ...diffTenantEntities({}, dataset, tenantId, config.deviceId),
      ...diffTenantSections({}, dataset, tenantId, config.deviceId),
    ].map((operation) => ({ ...operation, seedOnly: true }));
    if (operations.length) await syncEngine.enqueueMany(operations);
    // El padrón global de negocios nunca se usa como semilla. Al iniciar una
    // instalación nueva el administrador sólo existe localmente; publicar esa
    // lista parcial podía reemplazar el padrón real de la nube.
    const result = await syncEngine.flush();
    bootstrapResult = { hasRemoteData: true, seeded: true };
    return result;
  },
  async get(key, fallback = null) {
    const result = await storage.get(key);
    if (!result?.value) return fallback;
    try { return JSON.parse(result.value); } catch { return fallback; }
  },
  async set(key, value) {
    const persist = async () => {
      const previousResult = await storage.get(key);
      let previous = null; try { previous = previousResult?.value ? JSON.parse(previousResult.value) : null; } catch {}
      const serializedValue = JSON.stringify(value);
      // Los efectos de arranque vuelven a entregar el estado recién leído. Si
      // no cambió, no hay nada que guardar ni que agregar a la cola de nube.
      if (previousResult?.value === serializedValue) return;
      await storage.set(key, serializedValue);
      if (context.tenantId && key === "datos") {
        const tenantId=String(context.tenantId), config=loadCloudConfig();
        const before=extractTenantValue(key,previous||{},tenantId)||{}, after=extractTenantValue(key,value,tenantId)||{};
        const operations=[
          ...diffTenantEntities(before,after,tenantId,config.deviceId),
          ...diffTenantSections(before,after,tenantId,config.deviceId),
        ];
        if(operations.length) { await syncEngine.enqueueMany(operations); scheduleSync(); }
      } else if (context.tenantId && key === "cuentas" && context.isSystemAdmin && canSyncSystemData()) {
        const previousBusinesses = (Array.isArray(previous) ? previous : []).filter((account) => !account?.superAdmin);
        const businesses = (Array.isArray(value) ? value : []).filter((account) => !account?.superAdmin);
        // Una identidad administradora sintética se crea al entrar desde una
        // PC limpia. No es una modificación del padrón y no debe subir sola.
        if (!businesses.length && !previousBusinesses.length) return;
        if (JSON.stringify(previousBusinesses) === JSON.stringify(businesses)) return;
        // Una diferencia entre dos fotos locales nunca se interpreta como una
        // baja. Eliminar un negocio es una operación explícita del panel y va
        // por su endpoint dedicado; así un render atrasado no puede borrar un
        // alta que acaba de llegar desde la nube.
        await syncEngine.enqueue({
          type: "system_set",
          key: "cuentas",
          tenantId: String(context.tenantId),
          value: businesses,
          removedAccountIds: [],
        });
        scheduleSync();
      } else if (context.tenantId && key === "cuentas" && ["owner", "employee"].includes(cloudSession(loadCloudConfig().apiUrl)?.user?.role)) {
        const tenantId = String(context.tenantId);
        const previousAccount = (Array.isArray(previous) ? previous : []).find((account) => String(account?.id) === tenantId);
        const nextAccount = (Array.isArray(value) ? value : []).find((account) => String(account?.id) === tenantId);
        if (nextAccount && JSON.stringify(teamValue(previousAccount)) !== JSON.stringify(teamValue(nextAccount))) scheduleBusinessTeamSync();
      } else if (context.tenantId && SYNCABLE_KEYS.has(key)) {
        await syncEngine.enqueue({ type: "set", key, tenantId: String(context.tenantId), value: extractTenantValue(key, value, String(context.tenantId)) });
        scheduleSync();
      }
    };
    return key === "datos" ? withDataStorageLock(persist) : persist();
  },
  async delete(key) {
    await storage.delete(key);
    if (context.tenantId && SYNCABLE_KEYS.has(key)) await syncEngine.enqueue({ type: "delete", key, tenantId: String(context.tenantId) });
  },
};
