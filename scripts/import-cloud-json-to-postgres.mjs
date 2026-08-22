import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createPostgresStore } from "../server/postgres-store.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.resolve(
  process.env.KIOSCO_IMPORT_FILE || path.join(root, "cloud-dev-data", "database.json"),
);
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const replaceExisting = process.argv.includes("--replace");

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Configurala sólo en esta terminal; no la guardes en archivos ni la pegues en el chat.");
}

const raw = await fs.readFile(sourcePath, "utf8");
const source = JSON.parse(raw);
if (!source || typeof source !== "object" || !Number.isFinite(Number(source.schemaVersion))) {
  throw new Error(`El archivo ${sourcePath} no parece una base válida de Kiosco+`);
}

const store = await createPostgresStore(databaseUrl, {
  backupRetentionDays: process.env.KIOSCO_BACKUP_RETENTION_DAYS,
});

try {
  await store.initialize(source);
  const current = await store.read();
  const wasSeeded = isDeepStrictEqual(current, source);

  if (!wasSeeded && !replaceExisting) {
    throw new Error("PostgreSQL ya contiene otros datos. No se reemplazaron. Revisá el destino o repetí conscientemente con --replace.");
  }
  if (!wasSeeded && replaceExisting) await store.replace(source);

  const imported = await store.read();
  console.log(JSON.stringify({
    ok: true,
    source: sourcePath,
    schemaVersion: imported.schemaVersion,
    cursor: imported.cursor,
    businesses: Object.keys(imported.tenants || {}).length,
    users: Object.keys(imported.users || {}).length,
    catalogProducts: Object.keys(imported.barcodeCatalog || {}).length,
  }, null, 2));
} finally {
  await store.close();
}
