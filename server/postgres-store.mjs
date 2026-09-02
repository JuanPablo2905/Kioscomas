const STATE_ID = "primary";

const parseDatabaseUrl = (value) => {
  const url = String(value || "").trim();
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error("DATABASE_URL no contiene una conexión PostgreSQL válida");
  }
  return url;
};

export async function createPostgresStore(databaseUrl, { backupRetentionDays = 7 } = {}) {
  const connectionString = parseDatabaseUrl(databaseUrl);
  const { default: postgres } = await import("postgres");
  const retentionDays = Math.max(1, Math.min(30, Number(backupRetentionDays) || 7));
  const sql = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // A dropped pooler connection must fail fast. Otherwise one request can
    // occupy the server mutation queue forever and make every client look
    // offline until Render restarts the process.
    query_timeout: 20,
    max_lifetime: 60 * 10,
    prepare: false,
    ssl: "require",
  });

  let initialized = false;

  const initialize = async (seedValue) => {
    if (initialized) return;
    await sql.begin(async (tx) => {
      await tx`CREATE SCHEMA IF NOT EXISTS kiosco_private`;
      await tx`REVOKE ALL ON SCHEMA kiosco_private FROM PUBLIC`;
      await tx`
        CREATE TABLE IF NOT EXISTS kiosco_private.cloud_state (
          id text PRIMARY KEY,
          schema_version integer NOT NULL DEFAULT 3,
          revision bigint NOT NULL DEFAULT 0,
          payload jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await tx`
        CREATE TABLE IF NOT EXISTS kiosco_private.daily_backups (
          backup_day date PRIMARY KEY,
          schema_version integer NOT NULL,
          revision bigint NOT NULL,
          payload jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await tx`
        INSERT INTO kiosco_private.cloud_state (id, schema_version, payload)
        VALUES (${STATE_ID}, ${Number(seedValue?.schemaVersion || 3)}, ${JSON.stringify(seedValue)}::jsonb)
        ON CONFLICT (id) DO NOTHING
      `;
    });
    initialized = true;
  };

  const read = async () => {
    const [row] = await sql`
      SELECT payload
      FROM kiosco_private.cloud_state
      WHERE id = ${STATE_ID}
    `;
    if (!row?.payload) throw new Error("La base PostgreSQL no contiene el estado inicial de Kiosco+");
    return row.payload;
  };

  const probe = async () => {
    const [row] = await sql`
      SELECT
        pg_column_size(payload)::bigint AS state_bytes,
        revision,
        updated_at
      FROM kiosco_private.cloud_state
      WHERE id = ${STATE_ID}
    `;
    return {
      ok: Boolean(row),
      stateBytes: Number(row?.state_bytes || 0),
      revision: Number(row?.revision || 0),
      updatedAt: row?.updated_at || null,
    };
  };

  const inspectSections = async () => {
    const rows = await sql`
      SELECT section_key AS key,
             pg_column_size(state.payload -> section_key)::bigint AS stored_bytes
      FROM kiosco_private.cloud_state state
      CROSS JOIN LATERAL jsonb_object_keys(state.payload) AS keys(section_key)
      WHERE state.id = ${STATE_ID}
      ORDER BY pg_column_size(state.payload -> section_key) DESC
    `;
    return rows.map((row) => ({
      key: row.key,
      storedBytes: Number(row.stored_bytes || 0),
    }));
  };

  const write = async (value) => {
    const serialized = JSON.stringify(value);
    await sql.begin(async (tx) => {
      // Render usa una sola instancia actualmente. Este bloqueo también evita
      // que dos instancias futuras escriban el snapshot al mismo tiempo.
      await tx`SELECT pg_advisory_xact_lock(hashtext('kiosco-plus-cloud-state'))`;
      const [saved] = await tx`
        UPDATE kiosco_private.cloud_state
        SET payload = ${serialized}::jsonb,
            schema_version = ${Number(value?.schemaVersion || 3)},
            revision = revision + 1,
            updated_at = now()
        WHERE id = ${STATE_ID}
        RETURNING revision
      `;
      if (!saved) throw new Error("No se pudo guardar el estado de Kiosco+ en PostgreSQL");
      await tx`
        INSERT INTO kiosco_private.daily_backups (backup_day, schema_version, revision, payload)
        VALUES (CURRENT_DATE, ${Number(value?.schemaVersion || 3)}, ${Number(saved.revision)}, ${serialized}::jsonb)
        ON CONFLICT (backup_day) DO UPDATE
        SET schema_version = EXCLUDED.schema_version,
            revision = EXCLUDED.revision,
            payload = EXCLUDED.payload,
            updated_at = now()
      `;
      await tx`
        DELETE FROM kiosco_private.daily_backups
        WHERE backup_day < CURRENT_DATE - ${retentionDays}::integer
      `;
    });
  };

  const replace = async (value) => {
    const serialized = JSON.stringify(value);
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('kiosco-plus-cloud-state'))`;
      const [saved] = await tx`
        UPDATE kiosco_private.cloud_state
        SET payload = ${serialized}::jsonb,
            schema_version = ${Number(value?.schemaVersion || 3)},
            revision = revision + 1,
            updated_at = now()
        WHERE id = ${STATE_ID}
        RETURNING revision
      `;
      if (!saved) throw new Error("No se pudo reemplazar el estado de Kiosco+ en PostgreSQL");
      await tx`
        INSERT INTO kiosco_private.daily_backups (backup_day, schema_version, revision, payload)
        VALUES (CURRENT_DATE, ${Number(value?.schemaVersion || 3)}, ${Number(saved.revision)}, ${serialized}::jsonb)
        ON CONFLICT (backup_day) DO UPDATE
        SET schema_version = EXCLUDED.schema_version,
            revision = EXCLUDED.revision,
            payload = EXCLUDED.payload,
            updated_at = now()
      `;
    });
  };

  const close = () => sql.end({ timeout: 5 });

  return { initialize, read, probe, inspectSections, write, replace, close };
}
