const RECORD_TABLE = "cloud_records_v2";

const emptyState = () => ({
  schemaVersion: 4,
  cursor: 0,
  accepted: {},
  system: {},
  tenants: {},
  changes: [],
  devices: {},
  users: {},
  sessions: {},
  barcodeCatalog: {},
  activationCodes: {},
  activations: {},
});

const normalizePayload = (value) => {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === "string"; depth += 1) {
    try { current = JSON.parse(current); }
    catch { break; }
  }
  return current;
};

const stateValue = (value) => {
  const normalized = normalizePayload(value);
  return normalized && typeof normalized === "object" && !Array.isArray(normalized)
    ? normalized
    : {};
};

const stateArray = (value) => {
  const normalized = normalizePayload(value);
  return Array.isArray(normalized) ? normalized : [];
};

const recordId = (scope, key) => `${scope}\u0000${key}`;
const record = (scope, key, payload) => ({ scope, key: String(key), payload });
const compositeKey = (...parts) => JSON.stringify(parts.map((part) => String(part)));

export function stateToRecords(value) {
  const state = { ...emptyState(), ...stateValue(value) };
  const system = stateValue(state.system);
  const { cuentas: accounts = [], ...systemWithoutAccounts } = system;
  const records = [
    record("meta", "state", {
      schemaVersion: Number(state.schemaVersion || 4),
      cursor: Number(state.cursor || 0),
    }),
    record("system", "state", systemWithoutAccounts),
  ];

  for (const [position, account] of stateArray(accounts).entries()) {
    const key = String(account?.id ?? `position-${position}`);
    records.push(record("account", key, { position, value: account }));
  }

  const addObjectRecords = (scope, collection) => {
    for (const [key, payload] of Object.entries(stateValue(collection))) {
      records.push(record(scope, key, payload));
    }
  };

  for (const [tenantId, tenantValue] of Object.entries(stateValue(state.tenants))) {
    const tenant = stateValue(tenantValue);
    const { entities = {}, sections = {}, ...tenantValues } = tenant;
    records.push(record("tenant", tenantId, tenantValues));
    for (const [section, value] of Object.entries(stateValue(sections))) {
      records.push(record("tenant_section", compositeKey(tenantId, section), { tenantId, section, value }));
    }
    for (const [entity, entityRecords] of Object.entries(stateValue(entities))) {
      for (const [entityId, value] of Object.entries(stateValue(entityRecords))) {
        records.push(record("tenant_entity", compositeKey(tenantId, entity, entityId), {
          tenantId,
          entity,
          entityId,
          value,
        }));
      }
    }
  }
  addObjectRecords("device", state.devices);
  addObjectRecords("user", state.users);
  addObjectRecords("session", state.sessions);
  addObjectRecords("catalog", state.barcodeCatalog);
  addObjectRecords("activation_code", state.activationCodes);
  addObjectRecords("activation", state.activations);
  for (const [key, cursor] of Object.entries(stateValue(state.accepted))) {
    records.push(record("accepted", key, { cursor: Number(cursor || 0) }));
  }
  for (const [index, change] of stateArray(state.changes).entries()) {
    const cursor = String(Number(change?.cursor || index)).padStart(16, "0");
    records.push(record("change", `${cursor}:${String(change?.id || index)}`, change));
  }
  return records;
}

export function recordsToState(rows = []) {
  const state = emptyState();
  const changes = [];
  const accounts = [];
  for (const row of rows) {
    const scope = String(row?.scope || "");
    const key = String(row?.record_key ?? row?.key ?? "");
    const payload = normalizePayload(row?.payload);
    if (scope === "meta" && key === "state") {
      state.schemaVersion = Number(payload?.schemaVersion || 4);
      state.cursor = Number(payload?.cursor || 0);
    } else if (scope === "system" && key === "state") state.system = stateValue(payload);
    else if (scope === "account") accounts.push({ position: Number(payload?.position || 0), value: stateValue(payload?.value) });
    else if (scope === "tenant") {
      const legacyTenant = stateValue(payload);
      state.tenants[key] = {
        ...legacyTenant,
        entities: stateValue(legacyTenant.entities),
        sections: stateValue(legacyTenant.sections),
      };
    }
    else if (scope === "tenant_section") {
      const tenantId = String(payload?.tenantId || "");
      const section = String(payload?.section || "");
      if (!tenantId || !section) continue;
      state.tenants[tenantId] ||= { entities: {}, sections: {} };
      state.tenants[tenantId].entities ||= {};
      state.tenants[tenantId].sections ||= {};
      state.tenants[tenantId].sections[section] = payload?.value;
    }
    else if (scope === "tenant_entity") {
      const tenantId = String(payload?.tenantId || "");
      const entity = String(payload?.entity || "");
      const entityId = String(payload?.entityId || "");
      if (!tenantId || !entity || !entityId) continue;
      state.tenants[tenantId] ||= { entities: {}, sections: {} };
      state.tenants[tenantId].entities ||= {};
      state.tenants[tenantId].sections ||= {};
      state.tenants[tenantId].entities[entity] ||= {};
      state.tenants[tenantId].entities[entity][entityId] = stateValue(payload?.value);
    }
    else if (scope === "device") state.devices[key] = stateValue(payload);
    else if (scope === "user") state.users[key] = stateValue(payload);
    else if (scope === "session") state.sessions[key] = stateValue(payload);
    else if (scope === "catalog") state.barcodeCatalog[key] = stateValue(payload);
    else if (scope === "activation_code") state.activationCodes[key] = stateValue(payload);
    else if (scope === "activation") state.activations[key] = stateValue(payload);
    else if (scope === "accepted") state.accepted[key] = Number(payload?.cursor || 0);
    else if (scope === "change") changes.push({ key, payload: stateValue(payload) });
  }
  state.changes = changes
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((entry) => entry.payload)
    .slice(-10000);
  state.system.cuentas = accounts
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.value);
  return state;
}

const recordsMap = (state) => new Map(stateToRecords(state).map((entry) => [
  recordId(entry.scope, entry.key),
  { ...entry, serialized: JSON.stringify(entry.payload) },
]));

export const cleanV2Seed = (seedValue, legacyValue) => {
  const seed = { ...emptyState(), ...stateValue(seedValue) };
  const legacy = stateValue(legacyValue);
  const legacyDevices = stateValue(legacy.devices);
  const legacyActivations = stateValue(legacy.activations);
  const adminDeviceIds = new Set(Object.entries(legacyDevices)
    .filter(([, device]) => String(device?.tenantId || "") === "system-admin" && !device?.revokedAt)
    .map(([deviceId]) => String(deviceId)));
  const preservedDevices = Object.fromEntries(Object.entries(legacyDevices)
    .filter(([deviceId]) => adminDeviceIds.has(String(deviceId))));
  const preservedActivations = Object.fromEntries(Object.entries(legacyActivations)
    .filter(([deviceId, activation]) => adminDeviceIds.has(String(deviceId)) && !activation?.revokedAt));
  return {
    ...emptyState(),
    users: stateValue(seed.users),
    devices: preservedDevices,
    activations: preservedActivations,
    system: {
      cloudGeneration: 2,
      initializedAt: new Date().toISOString(),
      cuentas: [],
    },
  };
};

const parseDatabaseUrl = (value) => {
  const url = String(value || "").trim();
  if (!/^postgres(ql)?:\/\//i.test(url)) throw new Error("DATABASE_URL no contiene una conexión PostgreSQL válida");
  return url;
};

export async function createPostgresStore(databaseUrl, { backupRetentionDays = 14 } = {}) {
  const connectionString = parseDatabaseUrl(databaseUrl);
  const { default: postgres } = await import("postgres");
  const retentionDays = Math.max(1, Math.min(90, Number(backupRetentionDays) || 14));
  const sql = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    query_timeout: 20,
    max_lifetime: 60 * 10,
    prepare: false,
    ssl: "require",
  });

  let initialized = false;
  let cachedState = null;
  let mutation = Promise.resolve();
  const retryDatabaseOperation = async (operation) => {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await operation(); }
      catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw lastError;
  };

  const createTables = async () => {
    await sql.begin(async (tx) => {
      await tx`CREATE SCHEMA IF NOT EXISTS kiosco_private`;
      await tx`REVOKE ALL ON SCHEMA kiosco_private FROM PUBLIC`;
      await tx`
        CREATE TABLE IF NOT EXISTS kiosco_private.cloud_records_v2 (
          scope text NOT NULL,
          record_key text NOT NULL,
          payload jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (scope, record_key)
        )
      `;
      await tx`
        CREATE INDEX IF NOT EXISTS cloud_records_v2_scope_idx
        ON kiosco_private.cloud_records_v2 (scope)
      `;
      await tx`
        CREATE TABLE IF NOT EXISTS kiosco_private.daily_record_backups_v2 (
          backup_day date NOT NULL,
          scope text NOT NULL,
          record_key text NOT NULL,
          existed boolean NOT NULL,
          payload jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (backup_day, scope, record_key)
        )
      `;
    });
  };

  const loadRows = async () => sql`
    SELECT scope, record_key, payload
    FROM kiosco_private.cloud_records_v2
    ORDER BY scope, record_key
  `;

  const insertRecords = async (tx, records) => {
    for (const entry of records) {
      await tx`
        INSERT INTO kiosco_private.cloud_records_v2 (scope, record_key, payload)
        VALUES (${entry.scope}, ${entry.key}, ${entry.payload})
        ON CONFLICT (scope, record_key) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = now()
      `;
    }
  };

  const initialize = async (seedValue) => {
    if (initialized) return;
    await createTables();
    const [{ count }] = await sql`SELECT count(*)::integer AS count FROM kiosco_private.cloud_records_v2`;
    if (!Number(count || 0)) {
      let legacy = null;
      try {
        const [legacyRow] = await sql`
          SELECT payload
          FROM kiosco_private.cloud_state
          WHERE id = 'primary'
        `;
        legacy = legacyRow?.payload || null;
      } catch {
        // Un proyecto nuevo no tiene la tabla anterior; se inicia vacío.
      }
      const initial = cleanV2Seed(seedValue, legacy);
      await sql.begin((tx) => insertRecords(tx, stateToRecords(initial)));
    }
    cachedState = recordsToState(await loadRows());
    initialized = true;
  };

  const read = async () => {
    if (!initialized || !cachedState) throw new Error("La persistencia PostgreSQL todavía no fue inicializada");
    return structuredClone(cachedState);
  };

  const persist = async (value) => {
    const nextState = { ...emptyState(), ...stateValue(value), schemaVersion: 4 };
    const before = recordsMap(cachedState || emptyState());
    const after = recordsMap(nextState);
    const changed = [...after.entries()]
      .filter(([id, entry]) => before.get(id)?.serialized !== entry.serialized)
      .map(([, entry]) => entry);
    const removed = [...before.entries()]
      .filter(([id]) => !after.has(id))
      .map(([, entry]) => entry);
    if (!changed.length && !removed.length) {
      cachedState = structuredClone(nextState);
      return;
    }

    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('kiosco-plus-cloud-records-v2'))`;
      for (const entry of [...changed, ...removed]) {
        const previous = before.get(recordId(entry.scope, entry.key));
        await tx`
          INSERT INTO kiosco_private.daily_record_backups_v2
            (backup_day, scope, record_key, existed, payload)
          VALUES
            (CURRENT_DATE, ${entry.scope}, ${entry.key}, ${Boolean(previous)}, ${previous?.payload ?? null})
          ON CONFLICT (backup_day, scope, record_key) DO NOTHING
        `;
      }
      await insertRecords(tx, changed);
      for (const entry of removed) {
        await tx`
          DELETE FROM kiosco_private.cloud_records_v2
          WHERE scope = ${entry.scope} AND record_key = ${entry.key}
        `;
      }
      await tx`
        DELETE FROM kiosco_private.daily_record_backups_v2
        WHERE backup_day < CURRENT_DATE - ${retentionDays}::integer
      `;
    });
    cachedState = structuredClone(nextState);
  };

  const write = async (value) => {
    // El pooler de Supabase puede cortar una conexión ociosa. Una transacción
    // fallida es atómica, por lo que un único reintento es seguro.
    const run = () => retryDatabaseOperation(() => persist(value));
    mutation = mutation.then(run, run);
    return mutation;
  };

  const replace = async (value) => {
    const nextState = { ...emptyState(), ...stateValue(value), schemaVersion: 4 };
    const run = async () => {
      await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext('kiosco-plus-cloud-records-v2'))`;
        await tx`DELETE FROM kiosco_private.cloud_records_v2`;
        await insertRecords(tx, stateToRecords(nextState));
      });
      cachedState = structuredClone(nextState);
    };
    mutation = mutation.then(run, run);
    return mutation;
  };

  const probe = async () => {
    const [row] = await sql`
      SELECT count(*)::integer AS record_count,
             COALESCE(sum(pg_column_size(payload)), 0)::bigint AS state_bytes,
             max(updated_at) AS updated_at
      FROM kiosco_private.cloud_records_v2
    `;
    return {
      ok: Number(row?.record_count || 0) > 0,
      storageGeneration: 2,
      recordCount: Number(row?.record_count || 0),
      stateBytes: Number(row?.state_bytes || 0),
      payloadType: "records",
      revision: Number(cachedState?.cursor || 0),
      updatedAt: row?.updated_at || null,
    };
  };

  const inspectSections = async () => {
    const rows = await sql`
      SELECT scope AS key,
             count(*)::integer AS record_count,
             COALESCE(sum(pg_column_size(payload)), 0)::bigint AS stored_bytes
      FROM kiosco_private.cloud_records_v2
      GROUP BY scope
      ORDER BY stored_bytes DESC
    `;
    return rows.map((row) => ({
      key: row.key,
      recordCount: Number(row.record_count || 0),
      storedBytes: Number(row.stored_bytes || 0),
    }));
  };

  const close = async () => sql.end({ timeout: 5 });
  return { initialize, read, write, replace, probe, inspectSections, close };
}

export const POSTGRES_RECORD_STORE_TABLE = RECORD_TABLE;
