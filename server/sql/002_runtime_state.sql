BEGIN;

CREATE SCHEMA IF NOT EXISTS kiosco_private;
REVOKE ALL ON SCHEMA kiosco_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS kiosco_private.cloud_state (
  id text PRIMARY KEY,
  schema_version integer NOT NULL DEFAULT 3,
  revision bigint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kiosco_private.daily_backups (
  backup_day date PRIMARY KEY,
  schema_version integer NOT NULL,
  revision bigint NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA kiosco_private FROM anon, authenticated;

COMMIT;
