import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import webpush from "web-push";
import { fileURLToPath } from "node:url";
import { mergeConcurrentEntity } from "../src/cloud/conflictMerge.js";
import { TERMS_VERSION } from "../src/legal/terms.js";
import { createPostgresStore } from "./postgres-record-store.mjs";
import { createEmailService, isValidEmail, normalizeEmail } from "./email-service.mjs";
import { argentinaDateKey, referralStats, referralStatus } from "../src/billing/referrals.js";
import { sanitizePublicDisplayContent } from "../src/features/ventas/displayConfig.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let appVersion = "0.0.0";
try { appVersion = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version || appVersion; } catch {}
const windowsInstallerUrl = "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Setup.exe";
const databasePath = process.env.KIOSCO_CLOUD_DB || path.join(root, "cloud-dev-data", "database.json");
const dataDirectory = process.env.KIOSCO_CLOUD_DATA_DIR || path.dirname(databasePath);
// Render and most cloud hosts provide the public port through PORT.
// KIOSCO_CLOUD_PORT remains available for the local desktop server.
const port = Number(process.env.PORT || process.env.KIOSCO_CLOUD_PORT || 8787);
const localMode = process.env.KIOSCO_LOCAL_MODE !== "0";
const requireDeviceActivation = process.env.KIOSCO_REQUIRE_DEVICE_ACTIVATION === "1"
  || (!localMode && process.env.KIOSCO_REQUIRE_DEVICE_ACTIVATION !== "0");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
let postgresStore = null;
const configuredSuperAdminUsername = String(process.env.KIOSCO_SUPERADMIN_USERNAME || "").trim();
const configuredSuperAdminPassword = String(process.env.KIOSCO_SUPERADMIN_PASSWORD || "");
const configuredAccessTokenHours = Number(process.env.KIOSCO_ACCESS_TOKEN_HOURS || 24);
const accessTokenTtlMs = (Number.isFinite(configuredAccessTokenHours) && configuredAccessTokenHours > 0
  ? Math.min(configuredAccessTokenHours, 24 * 30)
  : 24) * 60 * 60 * 1000;
const refreshTokenTtlMs = 30 * 24 * 60 * 60 * 1000;
const refreshRetryGraceMs = 5 * 60 * 1000;
const configuredResetMinutes = Number(process.env.KIOSCO_PASSWORD_RESET_MINUTES || 30);
const passwordResetTtlMinutes = Number.isFinite(configuredResetMinutes)
  ? Math.max(10, Math.min(120, configuredResetMinutes))
  : 30;
const passwordResetTtlMs = passwordResetTtlMinutes * 60 * 1000;
const emailTestMode = localMode && process.env.KIOSCO_EMAIL_TEST_MODE === "1";
const emailService = createEmailService({
  apiKey: process.env.KIOSCO_RESEND_API_KEY || process.env.RESEND_API_KEY,
  from: process.env.KIOSCO_EMAIL_FROM || "Kiosco+ <notificaciones@kioscomas.ar>",
  replyTo: process.env.KIOSCO_EMAIL_REPLY_TO || process.env.VITE_LEGAL_EMAIL || "soporte@kioscomas.ar",
  appUrl: process.env.KIOSCO_PUBLIC_APP_URL || "https://app.kioscomas.ar",
  testMode: emailTestMode,
});
const vapidPublicKey = String(process.env.KIOSCO_VAPID_PUBLIC_KEY || "").trim();
const vapidPrivateKey = String(process.env.KIOSCO_VAPID_PRIVATE_KEY || "").trim();
const vapidSubject = String(process.env.KIOSCO_VAPID_SUBJECT || "mailto:soporte@kioscomas.ar").trim();
const pushDeliveryConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushDeliveryConfigured) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const accessTokenExpiresAt = () => new Date(Date.now() + accessTokenTtlMs).toISOString();
const refreshTokenExpiresAt = () => new Date(Date.now() + refreshTokenTtlMs).toISOString();
const emptyDb = () => ({ schemaVersion: 6, cursor: 0, accepted: {}, system: {}, tenants: {}, changes: [], devices: {}, users: {}, sessions: {}, barcodeCatalog: {}, activationCodes: {}, activations: {}, passwordResetTokens: {}, passwordResetRateLimits: {}, platformNotifications: {}, notificationReads: {}, pushSubscriptions: {}, reportedIssues: {}, businessDisplays: {}, displayPairingCodes: {}, displayTokens: {} });
const compactChangeLog = (changes = []) => {
  let latestAccountDirectoryKept = false;
  return [...changes].reverse().filter((change) => {
    const accountDirectory = change?.type === "system_set" && change?.key === "cuentas";
    if (!accountDirectory) return true;
    if (latestAccountDirectoryKept) return false;
    latestAccountDirectoryKept = true;
    return true;
  }).reverse().slice(-10000);
};
const compactAcceptedOperations = (accepted = {}, cursor = 0) => {
  const oldestUsefulCursor = Math.max(0, Number(cursor || 0) - 20000);
  return Object.fromEntries(Object.entries(accepted).filter(([, acceptedCursor]) => Number(acceptedCursor || 0) >= oldestUsefulCursor));
};
const compactSessions = (sessions = {}, now = Date.now()) => Object.fromEntries(
  Object.entries(sessions).filter(([, session]) => {
    if (!session) return false;
    if (!session.revokedAt) return !session.refreshExpiresAt || Date.parse(session.refreshExpiresAt) > now;
    return session.revokedReason === "refreshed" && Date.parse(session.refreshGraceUntil || "") > now;
  }),
);
const compactPasswordResetTokens = (tokens = {}, now = Date.now()) => Object.fromEntries(
  Object.entries(tokens).filter(([, entry]) => {
    const expiresAt = Date.parse(entry?.expiresAt || "");
    const completedAt = Date.parse(entry?.usedAt || entry?.revokedAt || "");
    if (Number.isFinite(completedAt)) return completedAt > now - 24 * 60 * 60 * 1000;
    return Number.isFinite(expiresAt) && expiresAt > now - 24 * 60 * 60 * 1000;
  }),
);
const compactPasswordResetRateLimits = (limits = {}, now = Date.now()) => Object.fromEntries(
  Object.entries(limits).map(([key, entry]) => [key, {
    requests: (Array.isArray(entry?.requests) ? entry.requests : []).filter((timestamp) => Number(timestamp) > now - 60 * 60 * 1000),
  }]).filter(([, entry]) => entry.requests.length),
);
const cleanBarcode = (value) => String(value || "").replace(/\D/g, "").slice(0, 18);
const cleanCatalogText = (value, max = 160) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
const externalLookupInFlight = new Map();
const categoryFromCatalog = (product = {}) => {
  const text = `${product.product_type || ""} ${product.category || ""} ${product.categories || ""} ${(product.categories_tags || []).join(" ")}`.toLowerCase();
  if (/beauty|cosmetic|personal care|tooth|soap|shampoo|deodor|hygiene|higiene|dent|jab[oó]n/.test(text)) return "Higiene";
  if (/petfood|pet food|dog|cat|mascota|perro|gato/.test(text)) return "Mascotas";
  if (/clean|detergent|laundry|household|limpieza|lavandina|limpiador/.test(text)) return "Limpieza";
  if (/drink|beverage|water|juice|soda|alcohol|beer|wine|bebida|agua|jugo|gaseosa|fernet|aperitivo|cerveza|vino/.test(text)) return "Bebidas";
  if (/candy|chocolate|snack|sweet|biscuit|cookie|golosina|alfajor|caramelo|gallet/.test(text)) return "Golosinas";
  return "Almacén";
};
const fetchJson = async (url, extraHeaders = {}) => {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "KioscoPlus/0.1 barcode-catalog", ...extraHeaders },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) return null;
  return response.json();
};
const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "KioscoPlus/0.1 barcode-catalog" },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) return "";
  return response.text();
};
const decodeHtml = (value) => String(value || "")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, " ")
  .replace(/&deg;/gi, "°");
const catalogTitleFromHtml = (html) => {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const jsonName = html.match(/"name"\s*:\s*"([^"]{2,180})"/i);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return cleanCatalogText(decodeHtml(og?.[1] || jsonName?.[1] || title?.[1] || "").replace(/\s*[·|–-]\s*Pricely.*$/i, ""), 120);
};
const normalizedExternalProduct = ({ codigo, nombre, marca = "", categoria = "", imagenUrl = "", descripcion = "", fuente }) => {
  const title = cleanCatalogText(nombre, 120);
  const brand = cleanCatalogText(marca, 60);
  if (!title && !brand) return null;
  return {
    codigo,
    nombre: [title, brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand : ""].filter(Boolean).join(" · "),
    categoria: categoryFromCatalog({ category: categoria || `${title} ${brand}` }),
    imagenUrl: /^https?:\/\//i.test(String(imagenUrl || "")) ? String(imagenUrl).slice(0, 500) : "",
    descripcionCatalogo: cleanCatalogText(descripcion, 180),
    unidad: "unidad",
    fuenteCatalogo: fuente,
  };
};
const lookupCommercialProviders = async (codigo) => {
  const providers = [];
  const upcItemDbKey = String(process.env.KIOSCO_UPCITEMDB_KEY || "").trim();
  const goUpcKey = String(process.env.KIOSCO_GO_UPC_API_KEY || "").trim();
  const barcodeLookupKey = String(process.env.KIOSCO_BARCODE_LOOKUP_API_KEY || "").trim();

  if (upcItemDbKey) providers.push((async () => {
    const json = await fetchJson(`https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(codigo)}`, {
      user_key: upcItemDbKey,
      key_type: "3scale",
    });
    const item = json?.items?.[0];
    return normalizedExternalProduct({
      codigo,
      nombre: item?.title,
      marca: item?.brand,
      categoria: item?.category,
      imagenUrl: item?.images?.[0],
      descripcion: item?.description || item?.size,
      fuente: "UPCitemdb comercial vía Kiosco+",
    });
  })());

  if (goUpcKey) providers.push((async () => {
    const json = await fetchJson(`https://go-upc.com/api/v1/code/${encodeURIComponent(codigo)}`, {
      authorization: `Bearer ${goUpcKey}`,
    });
    const product = json?.product;
    return normalizedExternalProduct({
      codigo,
      nombre: product?.name,
      marca: product?.brand,
      categoria: product?.category,
      imagenUrl: product?.imageUrl,
      descripcion: product?.description,
      fuente: "Go-UPC vía Kiosco+",
    });
  })());

  if (barcodeLookupKey) providers.push((async () => {
    const json = await fetchJson(`https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(codigo)}&formatted=y&key=${encodeURIComponent(barcodeLookupKey)}`);
    const product = json?.products?.[0];
    return normalizedExternalProduct({
      codigo,
      nombre: product?.title || product?.product_name,
      marca: product?.brand,
      categoria: product?.category,
      imagenUrl: product?.images?.[0],
      descripcion: product?.description,
      fuente: "Barcode Lookup vía Kiosco+",
    });
  })());

  if (!providers.length) return null;
  const results = await Promise.allSettled(providers);
  return results.find((result) => result.status === "fulfilled" && result.value)?.value || null;
};
const lookupExternalBarcode = async (codigo) => {
  if (externalLookupInFlight.has(codigo)) return externalLookupInFlight.get(codigo);
  const request = (async () => {
    try {
      const fields = "code,product_name,product_name_es,generic_name,generic_name_es,brands,categories,categories_tags,image_front_small_url,image_front_url,quantity,product_type";
      const facts = await fetchJson(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(codigo)}?product_type=all&cc=ar&lc=es&tags_lc=es&fields=${fields}`);
      const product = facts?.product || facts?.result?.product;
      const baseName = cleanCatalogText(product?.product_name_es || product?.product_name || product?.generic_name_es || product?.generic_name, 120);
      const brand = cleanCatalogText(String(product?.brands || "").split(",")[0], 60);
      if (baseName || brand) {
        return {
          codigo,
          nombre: [baseName, brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? brand : ""].filter(Boolean).join(" · "),
          categoria: categoryFromCatalog(product),
          imagenUrl: product.image_front_small_url || product.image_front_url || "",
          descripcionCatalogo: cleanCatalogText(product.quantity, 180),
          unidad: "unidad",
          fuenteCatalogo: "Open Facts universal vía Kiosco+",
        };
      }
    } catch { /* Se continúa con el siguiente catálogo. */ }
    try {
      const upc = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(codigo)}`);
      const item = upc?.items?.[0];
      const title = cleanCatalogText(item?.title, 120);
      const brand = cleanCatalogText(item?.brand, 60);
      if (title || brand) {
        return {
          codigo,
          nombre: [title, brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand : ""].filter(Boolean).join(" · "),
          categoria: categoryFromCatalog({ category: item.category }),
          imagenUrl: /^https?:\/\//i.test(String(item.images?.[0] || "")) ? item.images[0] : "",
          descripcionCatalogo: cleanCatalogText(item.description || item.size, 180),
          unidad: "unidad",
          fuenteCatalogo: "UPCitemdb vía Kiosco+",
        };
      }
    } catch { /* Sin coincidencias externas. */ }
    try {
      const html = await fetchText(`https://pricely.ar/product/${encodeURIComponent(codigo)}`);
      const title = catalogTitleFromHtml(html);
      if (title && !/^pricely$/i.test(title) && !/no encontrad|not found|404/i.test(title)) {
        return {
          codigo,
          nombre: title,
          categoria: categoryFromCatalog({ category: title }),
          imagenUrl: "",
          descripcionCatalogo: "",
          unidad: "unidad",
          fuenteCatalogo: "Pricely Argentina vía Kiosco+",
        };
      }
    } catch { /* El producto seguirá pudiéndose cargar manualmente. */ }
    try {
      const commercial = await lookupCommercialProviders(codigo);
      if (commercial) return commercial;
    } catch { /* Los proveedores opcionales nunca bloquean la carga manual. */ }
    return null;
  })().finally(() => externalLookupInFlight.delete(codigo));
  externalLookupInFlight.set(codigo, request);
  return request;
};
const catalogCandidate = (product = {}) => {
  const codigo = cleanBarcode(product.codigo || product.code);
  const nombre = cleanCatalogText(product.nombre || product.name, 120);
  if (codigo.length < 6 || !nombre) return null;
  return {
    codigo,
    nombre,
    categoria: cleanCatalogText(product.categoria, 60),
    imagenUrl: /^https?:\/\//i.test(String(product.imagenUrl || "")) ? String(product.imagenUrl).slice(0, 500) : "",
    descripcionCatalogo: cleanCatalogText(product.descripcionCatalogo, 180),
    familia: cleanCatalogText(product.familia, 80),
    variante: cleanCatalogText(product.variante, 80),
    unidad: cleanCatalogText(product.unidad, 24),
  };
};
const learnBarcode = (db, product, contributionId = "") => {
  const candidate = catalogCandidate(product);
  if (!candidate) return false;
  db.barcodeCatalog ||= {};
  const current = db.barcodeCatalog[candidate.codigo] || { codigo: candidate.codigo, candidates: {}, contributions: {}, confirmations: 0 };
  if (contributionId && current.contributions?.[contributionId]) return false;
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(candidate)).digest("hex").slice(0, 20);
  const previous = current.candidates?.[fingerprint] || {};
  current.candidates ||= {};
  current.contributions ||= {};
  current.candidates[fingerprint] = {
    ...candidate,
    confirmations: Number(previous.confirmations || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  if (contributionId) current.contributions[contributionId] = fingerprint;
  current.confirmations = Number(current.confirmations || 0) + 1;
  current.updatedAt = new Date().toISOString();
  const ranked = Object.values(current.candidates)
    .sort((a, b) => Number(b.confirmations || 0) - Number(a.confirmations || 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 10);
  current.candidates = Object.fromEntries(ranked.map((item) => [
    crypto.createHash("sha256").update(JSON.stringify({
      codigo: item.codigo, nombre: item.nombre, categoria: item.categoria, imagenUrl: item.imagenUrl,
      descripcionCatalogo: item.descripcionCatalogo, familia: item.familia, variante: item.variante, unidad: item.unidad,
    })).digest("hex").slice(0, 20),
    item,
  ]));
  const selected = ranked[0];
  if (!current.manualOverride) current.product = selected ? {
    ...selected,
    fuenteCatalogo: "Catálogo compartido de Kiosco+",
    confirmacionesCatalogo: current.confirmations,
  } : null;
  if (!current.manualOverride) current.status = current.product ? "learned" : "unresolved";
  db.barcodeCatalog[candidate.codigo] = current;
  return true;
};
const catalogStatus = (entry = {}) => {
  if (entry.status === "pending") return "pending";
  if (!entry.product) return "unresolved";
  if (entry.manualOverride || entry.status === "verified") return "verified";
  if (!entry.product.categoria || !entry.product.imagenUrl) return "incomplete";
  if (Object.keys(entry.candidates || {}).length > 1) return "conflict";
  return "learned";
};
const touchCatalogLookup = (db, codigo, found = false) => {
  db.barcodeCatalog ||= {};
  const entry = db.barcodeCatalog[codigo] || { codigo, candidates: {}, contributions: {}, confirmations: 0 };
  entry.lookupCount = Number(entry.lookupCount || 0) + 1;
  entry.lastLookupAt = new Date().toISOString();
  if (!found && !entry.product) entry.status = "unresolved";
  db.barcodeCatalog[codigo] = entry;
  return entry;
};
const catalogAdminView = (entry = {}) => ({
  codigo: entry.codigo,
  product: entry.product || null,
  status: catalogStatus(entry),
  lookupCount: Number(entry.lookupCount || 0),
  lastLookupAt: entry.lastLookupAt || null,
  confirmations: Number(entry.confirmations || 0),
  candidateCount: Object.keys(entry.candidates || {}).length,
  updatedAt: entry.updatedAt || null,
  requestedAt: entry.requestedAt || null,
  requestedBy: Array.isArray(entry.requestedBy) ? entry.requestedBy.slice(0, 20) : [],
  history: Array.isArray(entry.history) ? entry.history.slice(0, 20) : [],
});
const saveManualCatalogProduct = (db, codigo, rawProduct, actor = {}) => {
  const candidate = catalogCandidate({ ...rawProduct, codigo });
  if (!candidate) return null;
  db.barcodeCatalog ||= {};
  const now = new Date().toISOString();
  const current = db.barcodeCatalog[codigo] || { codigo, candidates: {}, contributions: {}, confirmations: 0 };
  const previous = current.product || null;
  const product = {
    ...candidate,
    fuenteCatalogo: "Catalogo verificado por Kiosco+",
    confirmacionesCatalogo: Number(current.confirmations || 0),
    estadoCatalogo: "verificado",
    catalogVersion: Number(previous?.catalogVersion || 0) + 1,
    updatedAt: now,
  };
  current.product = product;
  current.manualOverride = true;
  current.status = "verified";
  current.updatedAt = now;
  current.history = [{ action: previous ? "updated" : "created", at: now, by: actor.userId || "admin", previous, next: product }, ...(Array.isArray(current.history) ? current.history : [])].slice(0, 50);
  db.barcodeCatalog[codigo] = current;
  return current;
};
const hydrateBarcodeCatalog = (db) => {
  db.barcodeCatalog ||= {};
  for (const [tenantId, tenant] of Object.entries(db.tenants || {})) {
    for (const [entityId, record] of Object.entries(tenant.entities?.products || {})) {
      if (!record?.deletedAt && record?.value) learnBarcode(db, record.value, `bootstrap:${tenantId}:${entityId}:${record.version || 0}`);
    }
  }
  return db;
};
const materializeTenantSnapshot = (tenant = {}) => {
  const dataset = { ...(tenant.sections || {}) };
  for (const [entity, records] of Object.entries(tenant.entities || {})) {
    dataset[entity] = Object.values(records || {})
      .filter((record) => !record?.deletedAt && record?.value)
      .map((record) => ({ ...record.value, _syncVersion: Number(record.version || 0) }));
  }
  const values = {};
  for (const [key, record] of Object.entries(tenant || {})) {
    if (key === "entities" || key === "sections") continue;
    if (record && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, "value")) values[key] = record.value;
  }
  const entityCount = Object.values(tenant.entities || {}).reduce((total, records) => total + Object.keys(records || {}).length, 0);
  const hasData = entityCount > 0 || Object.keys(tenant.sections || {}).length > 0 || Object.keys(values).length > 0;
  return { dataset, values, hasData };
};
const readJsonDb = async () => {
  try {
    const saved = JSON.parse(await fs.readFile(databasePath, "utf8"));
    return applyConfiguredSuperAdmin(hydrateBarcodeCatalog({ ...emptyDb(), ...saved, system: saved.system || {}, barcodeCatalog: saved.barcodeCatalog || {}, activationCodes: saved.activationCodes || {}, activations: saved.activations || {} }));
  } catch {
    return applyConfiguredSuperAdmin(emptyDb());
  }
};
const readDb = async () => {
  const saved = postgresStore ? await postgresStore.read() : await readJsonDb();
  return ensureReferralMetadata(applyConfiguredSuperAdmin(hydrateBarcodeCatalog({ ...emptyDb(), ...saved, system: saved.system || {}, barcodeCatalog: saved.barcodeCatalog || {}, activationCodes: saved.activationCodes || {}, activations: saved.activations || {} })));
};
const safeName = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
};
const writeMirrors = async (db) => {
  await writeJson(path.join(dataDirectory, "sistema", "cuentas.json"), db.system?.cuentas || []);
  await writeJson(path.join(dataDirectory, "sistema", "dispositivos.json"), db.devices || {});
  await writeJson(path.join(dataDirectory, "catalogo", "codigos-de-barras.json"), Object.fromEntries(
    Object.entries(db.barcodeCatalog || {}).map(([codigo, item]) => [codigo, item.product || null]),
  ));
  for (const [tenantId, tenant] of Object.entries(db.tenants || {})) {
    const entities = {};
    for (const [entity, records] of Object.entries(tenant.entities || {})) {
      entities[entity] = Object.values(records || {})
        .filter((item) => !item.deletedAt)
        .map((item) => ({ ...item.value, _syncVersion: item.version }));
    }
    await writeJson(path.join(dataDirectory, "negocios", safeName(tenantId), "datos.json"), {
      tenantId,
      updatedAt: new Date().toISOString(),
      ...(tenant.sections || {}),
      ...entities,
    });
  }
  const day = new Date().toISOString().slice(0, 10);
  await writeJson(path.join(dataDirectory, "backups", day, "database.json"), db);
};
const writeDb = async (db) => {
  db.schemaVersion = 6;
  ensureReferralMetadata(db);
  db.sessions = compactSessions(db.sessions);
  db.passwordResetTokens = compactPasswordResetTokens(db.passwordResetTokens);
  db.passwordResetRateLimits = compactPasswordResetRateLimits(db.passwordResetRateLimits);
  const displayRetentionLimit = Date.now() - 30 * 86400000;
  db.displayPairingCodes = Object.fromEntries(Object.entries(db.displayPairingCodes || {}).filter(([, entry]) => !entry?.usedAt ? Date.parse(entry?.expiresAt || "") > Date.now() - 86400000 : Date.parse(entry.usedAt) > displayRetentionLimit));
  db.displayTokens = Object.fromEntries(Object.entries(db.displayTokens || {}).filter(([, entry]) => !entry?.revokedAt || Date.parse(entry.revokedAt) > displayRetentionLimit));
  compactNotificationData(db);
  if (postgresStore) {
    await postgresStore.write(db);
    return;
  }
  await writeJson(databasePath, db);
  await writeMirrors(db);
};
const send = (res, status, value) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-device-id,x-tenant-id,authorization",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(status === 204 ? "" : JSON.stringify(value));
};
const body = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  hash: crypto.scryptSync(String(password), salt, 64).toString("hex"),
});
const verifyPassword = (password, user) => crypto.timingSafeEqual(
  Buffer.from(hashPassword(password, user.salt).hash, "hex"),
  Buffer.from(user.passwordHash, "hex"),
);
const safeEqual = (left, right) => {
  const first = Buffer.from(String(left || ""));
  const second = Buffer.from(String(right || ""));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
};
const activationAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const normalizeActivationCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const activationCodeHash = (value) => crypto.createHash("sha256").update(normalizeActivationCode(value)).digest("hex");
const generateActivationCode = () => {
  const bytes = crypto.randomBytes(16);
  const characters = Array.from(bytes, (value) => activationAlphabet[value % activationAlphabet.length]).join("");
  return `KIOSCO-${characters.match(/.{1,4}/g).join("-")}`;
};
const referralAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const normalizeReferralCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const generateReferralCode = (accounts = []) => {
  const used = new Set(accounts.map((account) => normalizeReferralCode(account?.referralCode)).filter(Boolean));
  for (;;) {
    const bytes = crypto.randomBytes(6);
    const token = Array.from(bytes, (value) => referralAlphabet[value % referralAlphabet.length]).join("");
    const code = `KIOS-${token}`;
    if (!used.has(normalizeReferralCode(code))) return code;
  }
};
const ensureReferralMetadata = (db) => {
  db.system ||= {};
  const accounts = Array.isArray(db.system.cuentas) ? db.system.cuentas : [];
  const seenCodes = new Set();
  for (const account of accounts) {
    if (!account || account.superAdmin) continue;
    const normalized = normalizeReferralCode(account.referralCode);
    if (!normalized || seenCodes.has(normalized)) account.referralCode = generateReferralCode(accounts);
    seenCodes.add(normalizeReferralCode(account.referralCode));
  }
  const ids = new Set(accounts.map((account) => String(account?.id || "")));
  for (const account of accounts) {
    if (!account || account.superAdmin) continue;
    if (account.referredByAccountId && (!ids.has(String(account.referredByAccountId)) || String(account.referredByAccountId) === String(account.id))) {
      account.referredByAccountId = null;
      account.referredByCode = null;
    }
    account.referralStats = referralStats(accounts, account.id);
    account.referralStatus = referralStatus(account);
  }
  db.system.cuentas = accounts;
  return db;
};
const notificationAudienceMatches = (notification, subject = {}) => {
  const targetRoles = Array.isArray(notification?.targetRoles) ? notification.targetRoles : [];
  if (targetRoles.length && !targetRoles.includes(subject.role)) return false;
  const audience = notification?.audience || { type: "all" };
  if (audience.type === "all") return true;
  if (audience.type === "admin") return subject.role === "superAdmin";
  if (audience.type === "business") {
    return (audience.businessIds || []).map(String).includes(String(subject.businessId || ""));
  }
  return false;
};
const notificationSubjectForRequest = (db, req, session) => {
  const previewBusinessId = cleanCatalogText(req.headers["x-kiosco-preview-business"], 100);
  if (!previewBusinessId || session?.role !== "superAdmin") return session;
  const accountExists = (db.system?.cuentas || []).some((account) => !account?.superAdmin && String(account?.id) === String(previewBusinessId));
  if (!accountExists) return session;
  return { ...session, businessId: String(previewBusinessId), role: "owner", adminPreview: true };
};
const notificationView = (db, notification, session) => ({
  ...notification,
  readAt: db.notificationReads?.[`${notification.id}:${session.userId}`]?.readAt || null,
});
const safeNotificationAction = (value) => {
  if (!value || typeof value !== "object") return null;
  const view = cleanCatalogText(value.view, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  const requestedUrl = String(value.url || "").trim();
  const url = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl.slice(0, 300) : "";
  return view || url ? { ...(view ? { view } : {}), ...(url ? { url } : {}) } : null;
};
const createPlatformNotification = (db, values = {}) => {
  db.platformNotifications ||= {};
  const sourceKey = String(values.sourceKey || "").trim();
  const existing = sourceKey && Object.values(db.platformNotifications).find((entry) => entry.sourceKey === sourceKey);
  if (existing) return { notification: existing, created: false };
  const now = new Date().toISOString();
  const notification = {
    id: crypto.randomUUID(),
    title: cleanCatalogText(values.title, 120),
    message: cleanCatalogText(values.message, 700),
    level: ["info", "importante", "urgente", "mantenimiento"].includes(values.level) ? values.level : "info",
    category: cleanCatalogText(values.category || "maintenance", 40).replace(/[^a-z0-9_-]/gi, "") || "maintenance",
    targetRoles: Array.isArray(values.targetRoles) ? values.targetRoles.filter((role) => ["superAdmin", "owner", "employee"].includes(role)) : [],
    audience: values.audience || { type: "all" },
    action: safeNotificationAction(values.action),
    sourceKey: sourceKey || null,
    createdAt: now,
    publishAt: values.publishAt || now,
    expiresAt: values.expiresAt || null,
    createdBy: values.createdBy || "kiosco-cloud",
    archivedAt: null,
  };
  db.platformNotifications[notification.id] = notification;
  return { notification, created: true };
};
const notificationPreferenceAllows = (entry, notification) => {
  const preferences = entry?.preferences || {};
  if (preferences.mode === "none") return false;
  if (preferences.mode === "important" && !["importante", "urgente"].includes(notification.level)) return false;
  if (preferences.categories?.[notification.category] === false) return false;
  if (!preferences.quietHoursEnabled || notification.level === "urgente") return true;
  const hourMinute = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const current = Number(hourMinute.slice(0, 2)) * 60 + Number(hourMinute.slice(3, 5));
  const minutes = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  };
  const start = minutes(preferences.quietStart, "22:00");
  const end = minutes(preferences.quietEnd, "08:00");
  const quiet = start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
  return !quiet;
};
const visiblePlatformNotifications = (db, session) => {
  const now = Date.now();
  return Object.values(db.platformNotifications || {}).filter((entry) => {
    if (!entry || entry.archivedAt || !notificationAudienceMatches(entry, session)) return false;
    const publishAt = Date.parse(entry.publishAt || entry.createdAt || "");
    const expiresAt = Date.parse(entry.expiresAt || "");
    return (!Number.isFinite(publishAt) || publishAt <= now) && (!Number.isFinite(expiresAt) || expiresAt > now);
  }).sort((left, right) => String(right.publishAt || right.createdAt).localeCompare(String(left.publishAt || left.createdAt)));
};
const sendPushNotification = async (db, notification) => {
  if (!notification || notification.archivedAt) return { sent: 0, skipped: true };
  if (notification.pushDispatchedAt) return { sent: Number(notification.pushDeliveryCount || 0), alreadyDispatched: true };
  const publishAt = Date.parse(notification.publishAt || notification.createdAt || "");
  const expiresAt = Date.parse(notification.expiresAt || "");
  if (Number.isFinite(publishAt) && publishAt > Date.now()) return { sent: 0, scheduled: true };
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return { sent: 0, expired: true };
  if (!pushDeliveryConfigured) return { sent: 0, unavailable: true };
  const actionView = cleanCatalogText(notification.action?.view, 80);
  let sent = 0;
  const payload = JSON.stringify({
    id: notification.id,
    title: notification.title,
    body: notification.message,
    level: notification.level,
    url: notification.action?.url || (actionView ? `/?view=${encodeURIComponent(actionView)}` : "/?view=notificaciones"),
  });
  await Promise.all(Object.values(db.pushSubscriptions || {}).map(async (entry) => {
    if (!entry || entry.revokedAt || !notificationAudienceMatches(notification, entry) || !notificationPreferenceAllows(entry, notification)) return;
    try {
      await webpush.sendNotification(entry.subscription, payload, { TTL: 60 * 60 * 24 });
      entry.lastSuccessAt = new Date().toISOString();
      sent += 1;
    } catch (error) {
      entry.lastErrorAt = new Date().toISOString();
      entry.lastError = String(error?.message || error).slice(0, 180);
      if ([404, 410].includes(Number(error?.statusCode))) entry.revokedAt = entry.lastErrorAt;
    }
  }));
  notification.pushDispatchedAt = new Date().toISOString();
  notification.pushDeliveryCount = sent;
  return { sent, unavailable: false };
};
const duePushNotifications = (db, now = Date.now()) => Object.values(db.platformNotifications || {}).filter((notification) => {
  if (!notification || notification.archivedAt || notification.pushDispatchedAt) return false;
  const publishAt = Date.parse(notification.publishAt || notification.createdAt || "");
  const expiresAt = Date.parse(notification.expiresAt || "");
  return (!Number.isFinite(publishAt) || publishAt <= now) && (!Number.isFinite(expiresAt) || expiresAt > now);
});
const argentinaDayNumber = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const ensureAutomaticNotifications = (db) => {
  const accounts = (db.system?.cuentas || []).filter((account) => account && !account.superAdmin);
  const todayKey = argentinaDateKey(Date.now());
  const created = [];
  for (const account of accounts) {
    const expirationKey = argentinaDateKey(account.subscriptionExpiresAt);
    if (expirationKey) {
      const days = argentinaDayNumber(expirationKey) - argentinaDayNumber(todayKey);
      if ([3, 1, 0].includes(days) || days < 0) {
        const bucket = days < 0 ? "vencido" : `faltan-${days}`;
        const result = createPlatformNotification(db, {
          sourceKey: `subscription:${account.id}:${expirationKey}:${bucket}`,
          title: days < 0 ? `Abono vencido: ${account.nombreNegocio}` : `Abono por vencer: ${account.nombreNegocio}`,
          message: days < 0 ? `El abono venció el ${expirationKey}. Revisá el pago y el acceso de la cuenta.` : `El abono vence ${days === 0 ? "hoy" : `en ${days} día${days === 1 ? "" : "s"}`}.`,
          level: days <= 0 ? "urgente" : "importante",
          category: "subscription",
          audience: { type: "admin" },
          action: { view: "administracion" },
        });
        if (result.created) created.push(result.notification);
      }
      if ([2, 0].includes(days) || days < 0) {
        const bucket = days < 0 ? "vencido" : `faltan-${days}`;
        const result = createPlatformNotification(db, {
          sourceKey: `business-subscription:${account.id}:${expirationKey}:${bucket}`,
          title: days < 0 ? "Tu suscripción está vencida" : days === 0 ? "Tu suscripción vence hoy" : "Tu suscripción vence en 2 días",
          message: days < 0
            ? `Venció el ${expirationKey}. Tus datos siguen disponibles en modo consulta; contactanos para renovar.`
            : `El acceso vigente finaliza el ${expirationKey}. Podés renovarlo sin perder información.`,
          level: days <= 0 ? "urgente" : "importante",
          category: "subscription",
          audience: { type: "business", businessIds: [account.id] },
          targetRoles: ["owner"],
          action: { view: "notificaciones" },
        });
        if (result.created) created.push(result.notification);
      }
    }
    if (referralStatus(account) === "pausado") {
      const referrer = accounts.find((candidate) => String(candidate.id) === String(account.referredByAccountId));
      const result = createPlatformNotification(db, {
        sourceKey: `referral-paused:${account.id}:${expirationKey || "sin-vencimiento"}`,
        title: "Descuento por referido pausado",
        message: `${account.nombreNegocio} dejó de tener un abono vigente${referrer ? `; ya no suma descuento a ${referrer.nombreNegocio}` : ""}.`,
        level: "importante",
        category: "subscription",
        audience: { type: "admin" },
        action: { view: "administracion" },
      });
      if (result.created) created.push(result.notification);
    }
    if (!expirationKey) {
      const trialExpirationKey = argentinaDateKey(account.trialExpiresAt);
      if (trialExpirationKey) {
        const trialDays = argentinaDayNumber(trialExpirationKey) - argentinaDayNumber(todayKey);
        if ([2, 0].includes(trialDays) || trialDays < 0) {
          const bucket = trialDays < 0 ? "vencida" : `faltan-${trialDays}`;
          const result = createPlatformNotification(db, {
            sourceKey: `business-trial:${account.id}:${trialExpirationKey}:${bucket}`,
            title: trialDays < 0 ? "Tu beta finalizó" : trialDays === 0 ? "Tu beta termina hoy" : "Tu beta termina en 2 días",
            message: trialDays < 0
              ? "Tus datos siguen guardados. Contactanos si querés continuar con el plan Kiosco+."
              : `Podés seguir probando hasta el ${trialExpirationKey}. No se realizará ningún cobro automático.`,
            level: trialDays <= 0 ? "urgente" : "importante",
            category: "subscription",
            audience: { type: "business", businessIds: [account.id] },
            targetRoles: ["owner"],
            action: { view: "notificaciones" },
          });
          if (result.created) created.push(result.notification);
        }
      }
    }
    const orders = Object.values(db.tenants?.[String(account.id)]?.entities?.pedidos || {}).map((record) => record?.value || record);
    for (const order of orders) {
      if (!order || ["recibido", "cancelado"].includes(order.estado) || !order.fechaEntregaEsperada) continue;
      const deliveryKey = argentinaDateKey(order.fechaEntregaEsperada);
      const days = argentinaDayNumber(deliveryKey) - argentinaDayNumber(todayKey);
      if (![1, 0].includes(days) && days >= 0) continue;
      const bucket = days < 0 ? "demorado" : days === 0 ? "hoy" : "manana";
      const provider = cleanCatalogText(order.proveedorNombre || "tu proveedor", 100);
      const result = createPlatformNotification(db, {
        sourceKey: `order-delivery:${account.id}:${order.id}:${deliveryKey}:${bucket}`,
        title: days < 0 ? "Entrega demorada" : days === 0 ? "Hoy llega un pedido" : "Mañana llega un pedido",
        message: days < 0
          ? `El pedido de ${provider} estaba previsto para el ${deliveryKey} y todavía figura pendiente.`
          : `${provider}${order.horaEntregaEsperada ? ` · ${order.horaEntregaEsperada} h` : ""}.`,
        level: days < 0 ? "importante" : "info",
        category: "orders",
        audience: { type: "business", businessIds: [account.id] },
        action: { view: "compras" },
      });
      if (result.created) created.push(result.notification);
    }
  }
  return created;
};
const compactNotificationData = (db, now = Date.now()) => {
  const retainedNotifications = Object.values(db.platformNotifications || {}).filter((item) => {
    const archivedAt = Date.parse(item?.archivedAt || "");
    const expiresAt = Date.parse(item?.expiresAt || "");
    return (!Number.isFinite(archivedAt) || archivedAt > now - 90 * 86400000)
      && (!Number.isFinite(expiresAt) || expiresAt > now - 90 * 86400000);
  }).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || ""))).slice(0, 2000);
  const notificationIds = new Set(retainedNotifications.map((item) => String(item.id)));
  db.platformNotifications = Object.fromEntries(retainedNotifications.map((item) => [item.id, item]));
  db.notificationReads = Object.fromEntries(Object.entries(db.notificationReads || {}).filter(([, item]) => notificationIds.has(String(item?.notificationId || ""))));
  db.pushSubscriptions = Object.fromEntries(Object.entries(db.pushSubscriptions || {}).filter(([, item]) => !item?.revokedAt || Date.parse(item.revokedAt) > now - 30 * 86400000));
  db.reportedIssues = Object.fromEntries(Object.entries(db.reportedIssues || {}).filter(([, item]) => !item?.archivedAt || Date.parse(item.archivedAt) > now - 90 * 86400000));
};
const activationCodeView = (entry = {}) => ({
  id: entry.id,
  maskedCode: entry.maskedCode,
  label: entry.label || "",
  createdAt: entry.createdAt,
  expiresAt: entry.expiresAt,
  maxUses: Number(entry.maxUses || 1),
  uses: Number(entry.uses || 0),
  revokedAt: entry.revokedAt || null,
  createdBy: entry.createdBy || null,
});
const activationView = (entry = {}) => ({
  id: entry.id,
  deviceId: entry.deviceId,
  codeId: entry.codeId,
  activatedAt: entry.activatedAt,
  lastSeenAt: entry.lastSeenAt || entry.activatedAt,
  appVersion: entry.appVersion || null,
  revokedAt: entry.revokedAt || null,
});
const cleanActivationDeviceId = (value) => String(value || "").trim().slice(0, 160);
const verifyAppPassword = (password, subject) => {
  try {
    if (subject?.passwordHash && subject?.passwordSalt) {
      const candidate = crypto.pbkdf2Sync(
        String(password),
        Buffer.from(subject.passwordSalt, "base64"),
        210000,
        32,
        "sha256",
      ).toString("base64");
      return safeEqual(candidate, subject.passwordHash);
    }
    return typeof subject?.password === "string" && safeEqual(password, subject.password);
  } catch { return false; }
};
const appPasswordFields = (password) => {
  const salt = crypto.randomBytes(16);
  return {
    passwordHash: crypto.pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("base64"),
    passwordSalt: salt.toString("base64"),
    passwordVersion: 1,
  };
};
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const passwordResetGenericMessage = "Si el correo corresponde a una cuenta, te enviaremos un enlace para crear una contraseña nueva.";
const passwordResetIpAttempts = new Map();
const passwordResetSubjectKey = ({ businessId, role, subjectId, username }) => [
  String(businessId || ""),
  String(role || ""),
  String(subjectId || username || ""),
].join(":");
const credentialFromSubject = (subject, businessId, role) => ({
  subject,
  businessId: String(businessId),
  role,
  subjectId: String(subject?.id || subject?.usuario || ""),
  username: String(subject?.usuario || "").trim(),
  name: String(subject?.nombre || subject?.usuario || "").trim(),
  email: normalizeEmail(subject?.email || subject?.correo),
});
const passwordResetCredentials = (db) => {
  const credentials = [];
  for (const account of db.system?.cuentas || []) {
    if (!account) continue;
    credentials.push(credentialFromSubject(account, account.id, account.superAdmin ? "superAdmin" : "owner"));
    for (const employee of account.empleados || []) credentials.push(credentialFromSubject(employee, account.id, "employee"));
  }
  const configuredAdminEmail = normalizeEmail(process.env.KIOSCO_SUPERADMIN_EMAIL);
  const configuredAdmin = db.users?.[configuredSuperAdminUsername];
  if (configuredAdmin && isValidEmail(configuredAdminEmail)) {
    credentials.push({
      subject: configuredAdmin,
      businessId: configuredAdmin.businessId,
      role: "superAdmin",
      subjectId: configuredAdmin.id,
      username: configuredAdmin.username,
      name: configuredAdmin.name,
      email: configuredAdminEmail,
      cloudOnly: true,
    });
  }
  return credentials.filter((credential) => credential.username && isValidEmail(credential.email));
};
const passwordResetCredentialByEmail = (db, email) => {
  const normalized = normalizeEmail(email);
  const matches = passwordResetCredentials(db).filter((credential) => credential.email === normalized);
  const unique = new Map(matches.map((credential) => [passwordResetSubjectKey(credential), credential]));
  return unique.size === 1 ? [...unique.values()][0] : null;
};
const passwordResetEmailInUse = (db, email) => passwordResetCredentials(db)
  .some((credential) => credential.email === normalizeEmail(email));
const passwordResetCredentialBySubjectKey = (db, subjectKey) => passwordResetCredentials(db)
  .find((credential) => passwordResetSubjectKey(credential) === subjectKey) || null;
const findCloudUserEntry = (db, credential) => Object.entries(db.users || {}).find(([, user]) => (
  (credential.cloudUserId && String(user?.id) === String(credential.cloudUserId))
  || String(user?.username || "").trim().toLowerCase() === credential.username.toLowerCase()
));
const updatePasswordResetCredential = (db, credential, password) => {
  const securedCloudPassword = hashPassword(password);
  const currentEntry = findCloudUserEntry(db, credential);
  const currentKey = currentEntry?.[0];
  const current = currentEntry?.[1];
  const userId = current?.id || crypto.randomUUID();
  const user = {
    ...current,
    id: userId,
    businessId: credential.businessId,
    username: credential.username,
    name: credential.name || credential.username,
    email: credential.email,
    role: credential.role,
    salt: securedCloudPassword.salt,
    passwordHash: securedCloudPassword.hash,
    status: "active",
    passwordUpdatedAt: new Date().toISOString(),
  };
  if (currentKey && currentKey !== credential.username) delete db.users[currentKey];
  db.users[credential.username] = user;
  if (!credential.cloudOnly && credential.subject) {
    Object.assign(credential.subject, appPasswordFields(password), {
      email: credential.email,
      passwordUpdatedAt: user.passwordUpdatedAt,
    });
    delete credential.subject.password;
    delete credential.subject.correo;
  }
  return user;
};
const requestClientIp = (req) => String(
  req.headers["cf-connecting-ip"]
  || String(req.headers["x-forwarded-for"] || "").split(",")[0]
  || req.socket.remoteAddress
  || "unknown",
).trim().slice(0, 128);
const consumePasswordResetIpLimit = (req, now = Date.now()) => {
  const key = sha256(requestClientIp(req));
  const recent = (passwordResetIpAttempts.get(key) || []).filter((timestamp) => timestamp > now - 15 * 60 * 1000);
  recent.push(now);
  passwordResetIpAttempts.set(key, recent);
  if (passwordResetIpAttempts.size > 2000) {
    for (const [candidate, attempts] of passwordResetIpAttempts) {
      if (!attempts.some((timestamp) => timestamp > now - 15 * 60 * 1000)) passwordResetIpAttempts.delete(candidate);
    }
  }
  return recent.length <= 10;
};
const consumePasswordResetEmailLimit = (db, email, now = Date.now()) => {
  db.passwordResetRateLimits ||= {};
  const key = sha256(normalizeEmail(email));
  const recent = (db.passwordResetRateLimits[key]?.requests || []).filter((timestamp) => Number(timestamp) > now - 60 * 60 * 1000);
  const last = Math.max(0, ...recent.map(Number));
  const allowed = recent.length < 5 && (!last || now - last >= 2 * 60 * 1000);
  if (allowed) recent.push(now);
  db.passwordResetRateLimits[key] = { requests: recent };
  return allowed;
};
const passwordResetUrl = (rawToken) => {
  const url = new URL(emailService.appUrl);
  url.searchParams.set("reset_token", rawToken);
  return url.toString();
};
const sendEmailBestEffort = async (event, operation) => {
  try { return await operation(); }
  catch (error) {
    console.error(`No se pudo enviar el correo ${event}`, error?.message || error?.name || "email_error");
    return null;
  }
};
const accountForLogin = (db, user) => {
  const account = tenantAccount(db, user?.businessId);
  if (!account) return null;
  if (user.role !== "employee") return account;
  const normalizedUsername = String(user.username || "").trim().toLowerCase();
  const employee = (account.empleados || []).find(
    (entry) => String(entry?.usuario || "").trim().toLowerCase() === normalizedUsername,
  );
  const { passwordHash: _ownerHash, passwordSalt: _ownerSalt, password: _ownerPassword, ...safeAccount } = account;
  return { ...safeAccount, empleados: employee ? [employee] : [] };
};
const accountCredential = (db, username) => {
  const normalized = String(username || "").trim().toLowerCase();
  for (const account of db.system?.cuentas || []) {
    if (account?.estado === "bloqueada") continue;
    if (String(account?.usuario || "").trim().toLowerCase() === normalized) {
      return {
        subject: account,
        businessId: String(account.id),
        name: account.nombre || account.usuario,
        role: account.superAdmin ? "superAdmin" : "owner",
      };
    }
    const employee = (account?.empleados || []).find(
      (item) => String(item?.usuario || "").trim().toLowerCase() === normalized,
    );
    if (employee) return {
      subject: employee,
      businessId: String(account.id),
      name: employee.nombre || employee.usuario,
      role: "employee",
    };
  }
  return null;
};
const migrateAppUser = (db, username, password) => {
  const credential = accountCredential(db, username);
  if (!credential || !verifyAppPassword(password, credential.subject)) return null;
  const existingEntry = Object.entries(db.users || {}).find(
    ([, user]) => String(user?.username || "").trim().toLowerCase() === String(username).trim().toLowerCase(),
  );
  const existing = existingEntry?.[1];
  if (existing && existing.status !== "active") return null;
  const secured = hashPassword(password);
  const canonicalUsername = String(username).trim();
  const migrated = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    businessId: credential.businessId,
    username: canonicalUsername,
    name: credential.name || canonicalUsername,
    email: normalizeEmail(credential.subject?.email || credential.subject?.correo || existing?.email),
    role: credential.role,
    salt: secured.salt,
    passwordHash: secured.hash,
    status: "active",
  };
  if (existingEntry?.[0] && existingEntry[0] !== canonicalUsername) delete db.users[existingEntry[0]];
  db.users[canonicalUsername] = migrated;
  return migrated;
};
const applyConfiguredSuperAdmin = (db) => {
  if (!configuredSuperAdminUsername || configuredSuperAdminPassword.length < 10) return db;
  const existing = db.users[configuredSuperAdminUsername];
  const secured = hashPassword(configuredSuperAdminPassword, existing?.adminSecretSalt || existing?.salt);
  db.users[configuredSuperAdminUsername] = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    businessId: "system-admin",
    username: configuredSuperAdminUsername,
    name: existing?.name || "Administrador de Kiosco+",
    email: normalizeEmail(process.env.KIOSCO_SUPERADMIN_EMAIL || existing?.email),
    role: "superAdmin",
    salt: secured.salt,
    adminSecretSalt: secured.salt,
    passwordHash: secured.hash,
    status: "active",
  };
  return db;
};
const token = () => crypto.randomBytes(32).toString("base64url");
const displaySecretHash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const displayCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const displayPairingCode = () => Array.from(crypto.randomBytes(8), (byte) => displayCodeAlphabet[byte % displayCodeAlphabet.length]).join("");
const publicDisplayUrl = () => String(process.env.KIOSCO_PUBLIC_APP_URL || "https://app.kioscomas.ar").replace(/\/+$/, "");
const displayTokenFromRequest = (req) => String(req.headers.authorization || "").replace(/^Display\s+/i, "").trim();
const activeDisplayToken = (db, req) => {
  const raw = displayTokenFromRequest(req);
  const entry = raw && db.displayTokens?.[displaySecretHash(raw)];
  if (!entry || entry.revokedAt || !db.businessDisplays?.[entry.displayId] || db.businessDisplays[entry.displayId].status !== "active") return null;
  return entry;
};
const displayView = (entry = {}) => ({
  id: entry.id, name: entry.name, status: entry.status, contentVersion: Number(entry.contentVersion || 1),
  createdAt: entry.createdAt, updatedAt: entry.updatedAt, lastSeenAt: entry.lastSeenAt || null,
  pairedDevices: Number(entry.pairedDevices || 0), content: entry.content || null,
});
const createDisplayPairing = (db, display) => {
  db.displayPairingCodes ||= {};
  for (const [key, entry] of Object.entries(db.displayPairingCodes)) {
    if (entry.displayId === display.id && !entry.usedAt) delete db.displayPairingCodes[key];
  }
  const code = displayPairingCode();
  db.displayPairingCodes[displaySecretHash(code)] = {
    displayId: display.id, businessId: display.businessId, createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), usedAt: null,
  };
  return { code, expiresAt: db.displayPairingCodes[displaySecretHash(code)].expiresAt, pairingUrl: `${publicDisplayUrl()}/?window=remote-display&pair=${encodeURIComponent(code)}` };
};
const createDisplayPairingRequest = (db, deviceId) => {
  db.displayPairingCodes ||= {};
  const now = Date.now();
  for (const [key, entry] of Object.entries(db.displayPairingCodes)) {
    if (Date.parse(entry.expiresAt || "") <= now || (entry.requestTokenHash && entry.deviceId === deviceId && !entry.approvedAt)) delete db.displayPairingCodes[key];
  }
  let code = displayPairingCode();
  while (db.displayPairingCodes[displaySecretHash(code)]) code = displayPairingCode();
  const requestToken = token();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
  db.displayPairingCodes[displaySecretHash(code)] = {
    requestTokenHash: displaySecretHash(requestToken), deviceId, createdAt, expiresAt,
    displayId: null, businessId: null, approvedAt: null, usedAt: null,
  };
  return {
    code, requestToken, expiresAt,
    authorizationUrl: `${publicDisplayUrl()}/?displayPair=${encodeURIComponent(code)}`,
  };
};
const bearer = (req) => String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
const activeSession = (db, req) => {
  const session = db.sessions[bearer(req)];
  return session && !session.revokedAt && new Date(session.expiresAt) > new Date() ? session : null;
};
const tenantAccount = (db, tenantId) => (db.system?.cuentas || []).find((account) => String(account.id) === String(tenantId));
const accountCanWrite = (db, tenantId) => {
  const account = tenantAccount(db, tenantId);
  if (!account || account.superAdmin) return true;
  if (account.estado === "bloqueada") return false;
  const subscriptionExpirationDay = argentinaDateKey(account.subscriptionExpiresAt);
  if (subscriptionExpirationDay) return subscriptionExpirationDay >= argentinaDateKey(Date.now());
  const trialExpiresAt = Date.parse(account.trialExpiresAt || "");
  if (Number.isFinite(trialExpiresAt) && trialExpiresAt > Date.now()) return true;
  return account.estado === "aprobada";
};
const isLoopback = (req) => {
  const address = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
};
const displayPairAttempts = new Map();

const handleRequest = async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.url === "/v1/health") return send(res, 200, {
      ok: true,
      service: "kiosco-cloud-local",
      schemaVersion: 6,
      localMode,
      deviceActivationRequired: requireDeviceActivation,
      emailDeliveryConfigured: emailService.configured && !emailTestMode,
      pushDeliveryConfigured,
      persistence: postgresStore ? "postgresql" : "json",
      revision: String(process.env.RENDER_GIT_COMMIT || "local").slice(0, 12),
      time: new Date().toISOString(),
    });
    if (req.method === "GET" && req.url === "/v1/notifications/push-public-key") {
      return send(res, pushDeliveryConfigured ? 200 : 503, {
        configured: pushDeliveryConfigured,
        publicKey: pushDeliveryConfigured ? vapidPublicKey : null,
      });
    }
    if (req.method === "POST" && req.url === "/v1/displays/pairing-request") {
      const remoteAddress = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
      const attempts = (displayPairAttempts.get(`request:${remoteAddress}`) || []).filter((at) => at > Date.now() - 10 * 60 * 1000);
      if (attempts.length >= 12) return send(res, 429, { error: "Se solicitaron demasiados códigos. Esperá unos minutos." });
      attempts.push(Date.now()); displayPairAttempts.set(`request:${remoteAddress}`, attempts);
      const payload = await body(req);
      const deviceId = cleanCatalogText(payload.deviceId || crypto.randomUUID(), 120);
      const db = await readDb();
      const pairing = createDisplayPairingRequest(db, deviceId);
      await writeDb(db);
      return send(res, 201, { ok: true, pairing: { code: pairing.code, requestToken: pairing.requestToken, expiresAt: pairing.expiresAt, authorizationUrl: pairing.authorizationUrl } });
    }
    if (req.method === "POST" && req.url === "/v1/displays/pairing-status") {
      const payload = await body(req);
      const requestToken = String(payload.requestToken || "").trim();
      if (requestToken.length < 20) return send(res, 400, { error: "Solicitud de vinculación inválida." });
      const requestTokenHash = displaySecretHash(requestToken);
      const db = await readDb();
      const activeCredential = db.displayTokens?.[requestTokenHash];
      if (activeCredential && !activeCredential.revokedAt) {
        const display = db.businessDisplays?.[activeCredential.displayId];
        if (display?.status === "active") return send(res, 200, { ok: true, status: "approved", displayToken: requestToken, display: displayView(display) });
      }
      const pairingEntry = Object.entries(db.displayPairingCodes || {}).find(([, entry]) => entry.requestTokenHash === requestTokenHash);
      if (!pairingEntry) return send(res, 404, { error: "La solicitud ya no existe. Generá un código nuevo." });
      const [codeHash, pairing] = pairingEntry;
      if (Date.parse(pairing.expiresAt || "") <= Date.now()) {
        delete db.displayPairingCodes[codeHash]; await writeDb(db);
        return send(res, 410, { error: "El código venció. Generando uno nuevo…" });
      }
      return send(res, 202, { ok: true, status: "pending", expiresAt: pairing.expiresAt });
    }
    if (req.method === "POST" && req.url === "/v1/displays/pair") {
      const remoteAddress = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
      const attempts = (displayPairAttempts.get(remoteAddress) || []).filter((at) => at > Date.now() - 10 * 60 * 1000);
      if (attempts.length >= 12) return send(res, 429, { error: "Hubo demasiados intentos. Esperá unos minutos." });
      attempts.push(Date.now()); displayPairAttempts.set(remoteAddress, attempts);
      const payload = await body(req);
      const pairingCode = String(payload.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const codeHash = displaySecretHash(pairingCode);
      const db = await readDb();
      const pairing = db.displayPairingCodes?.[codeHash];
      const display = pairing ? db.businessDisplays?.[pairing.displayId] : null;
      if (!pairing || pairing.usedAt || Date.parse(pairing.expiresAt || "") <= Date.now() || !display || display.status !== "active") {
        return send(res, 400, { error: "El código no existe, ya fue usado o venció." });
      }
      const rawToken = token(); const hash = displaySecretHash(rawToken); const now = new Date().toISOString();
      db.displayTokens ||= {}; db.displayTokens[hash] = {
        id: crypto.randomUUID(), displayId: display.id, businessId: display.businessId,
        deviceId: cleanCatalogText(payload.deviceId || crypto.randomUUID(), 120), createdAt: now, lastSeenAt: now, revokedAt: null,
      };
      pairing.usedAt = now; display.lastSeenAt = now;
      await writeDb(db);
      return send(res, 201, { ok: true, displayToken: rawToken, display: displayView(display) });
    }
    if (req.method === "GET" && req.url === "/v1/displays/content") {
      const db = await readDb(); const credential = activeDisplayToken(db, req);
      const display = credential ? db.businessDisplays?.[credential.displayId] : null;
      if (!credential || !display || display.status !== "active") return send(res, 401, { error: "Esta pantalla ya no está autorizada." });
      const now = new Date().toISOString(); credential.lastSeenAt = now; display.lastSeenAt = now;
      await writeDb(db);
      return send(res, 200, { ok: true, display: displayView(display) });
    }
    if (req.method === "GET" && req.url === "/v1/ready") {
      if (!postgresStore) return send(res, 200, { ok: true, persistence: "json" });
      try {
        const database = await postgresStore.probe();
        return send(res, database.ok ? 200 : 503, { ...database, persistence: "postgresql" });
      } catch (error) {
        console.error("PostgreSQL no respondió a la comprobación", error);
        return send(res, 503, {
          ok: false,
          persistence: "postgresql",
          error: error?.code || error?.name || "database_unavailable",
        });
      }
    }
    if (req.method === "GET" && req.url === "/v1/ready/sections") {
      if (!postgresStore) return send(res, 200, { ok: true, sections: [] });
      try {
        return send(res, 200, { ok: true, sections: await postgresStore.inspectSections() });
      } catch (error) {
        console.error("No se pudo medir el estado PostgreSQL", error);
        return send(res, 503, {
          ok: false,
          error: error?.code || error?.name || "database_unavailable",
          detail: String(error?.message || "").slice(0, 180),
        });
      }
    }
    if (req.url?.startsWith("/v1/releases/latest")) {
      const channel = new URL(req.url, "http://localhost").searchParams.get("channel") || "stable";
      return send(res, 200, {
        channel,
        version: appVersion,
        mandatory: false,
        notes: ["Actualización automática y mejoras de estabilidad"],
        downloadUrl: windowsInstallerUrl,
        sha256: null,
        publishedAt: new Date().toISOString(),
      });
    }
    if (req.method === "GET" && req.url === "/v1/catalog/providers") {
      return send(res, 200, {
        providers: [
          { id: "open-facts", name: "Open Facts universal", enabled: true, type: "gratuito" },
          { id: "upcitemdb-trial", name: "UPCitemdb gratuito", enabled: true, type: "gratuito-limitado" },
          { id: "pricely", name: "Pricely Argentina", enabled: true, type: "gratuito" },
          { id: "shared", name: "Catálogo compartido de Kiosco+", enabled: true, type: "propio" },
          { id: "upcitemdb", name: "UPCitemdb comercial", enabled: !!process.env.KIOSCO_UPCITEMDB_KEY, type: "opcional" },
          { id: "go-upc", name: "Go-UPC", enabled: !!process.env.KIOSCO_GO_UPC_API_KEY, type: "opcional" },
          { id: "barcode-lookup", name: "Barcode Lookup", enabled: !!process.env.KIOSCO_BARCODE_LOOKUP_API_KEY, type: "opcional" },
        ],
      });
    }
    if (req.method === "GET" && req.url?.startsWith("/v1/catalog/lookup/")) {
      const codigo = cleanBarcode(decodeURIComponent(req.url.split("/").pop()?.split("?")[0] || ""));
      if (codigo.length < 6) return send(res, 400, { error: "Código inválido" });
      const db = await readDb();
      const savedEntry = db.barcodeCatalog?.[codigo];
      const saved = savedEntry?.status === "archived" ? null : savedEntry?.product || null;
      if (saved) {
        touchCatalogLookup(db, codigo, true);
        await writeDb(db);
        return send(res, 200, { product: saved, found: true, cached: true });
      }
      const found = await lookupExternalBarcode(codigo);
      if (found) {
        learnBarcode(db, found, `external:${codigo}`);
      }
      touchCatalogLookup(db, codigo, !!found);
      await writeDb(db);
      return send(res, 200, { product: found, found: !!found, cached: false });
    }
    if (req.method === "POST" && req.url === "/v1/activation/status") {
      const payload = await body(req);
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      if (deviceId.length < 3) return send(res, 400, { error: "El identificador del dispositivo no es válido" });
      const db = await readDb();
      db.activations ||= {};
      let current = db.activations[deviceId];
      const knownDevice = db.devices?.[deviceId];
      if (!current && knownDevice && !knownDevice.revokedAt) {
        const now = new Date().toISOString();
        current = {
          id: crypto.randomUUID(),
          deviceId,
          codeId: null,
          activatedAt: now,
          lastSeenAt: now,
          appVersion: cleanCatalogText(payload.appVersion || "", 40) || null,
          legacy: true,
          revokedAt: null,
        };
        db.activations[deviceId] = current;
      }
      if (!current || current.revokedAt) return send(res, 200, { activated: false });
      current.lastSeenAt = new Date().toISOString();
      current.appVersion = cleanCatalogText(payload.appVersion || current.appVersion || "", 40) || null;
      await writeDb(db);
      return send(res, 200, { activated: true, activation: activationView(current) });
    }
    if (req.method === "POST" && req.url === "/v1/activation/redeem") {
      const payload = await body(req);
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      const normalizedCode = normalizeActivationCode(payload.code);
      if (deviceId.length < 3) return send(res, 400, { error: "El identificador del dispositivo no es válido" });
      const db = await readDb();
      db.activationCodes ||= {};
      db.activations ||= {};
      const existingActivation = db.activations[deviceId];
      if (existingActivation && !existingActivation.revokedAt) {
        existingActivation.lastSeenAt = new Date().toISOString();
        await writeDb(db);
        return send(res, 200, { activated: true, activation: activationView(existingActivation) });
      }
      if (normalizedCode.length < 12) return send(res, 400, { error: "La clave de instalación no es válida" });
      const codeHash = activationCodeHash(normalizedCode);
      const code = Object.values(db.activationCodes).find((entry) => safeEqual(entry?.hash, codeHash));
      if (!code) return send(res, 401, { error: "La clave de instalación no existe" });
      if (code.revokedAt) return send(res, 403, { error: "Esta clave fue desactivada" });
      if (Date.parse(code.expiresAt || "") <= Date.now()) return send(res, 403, { error: "Esta clave ya venció" });
      if (Number(code.uses || 0) >= Number(code.maxUses || 1)) return send(res, 409, { error: "Esta clave ya fue utilizada" });
      const now = new Date().toISOString();
      code.uses = Number(code.uses || 0) + 1;
      code.lastUsedAt = now;
      const activation = {
        id: crypto.randomUUID(),
        deviceId,
        codeId: code.id,
        activatedAt: now,
        lastSeenAt: now,
        appVersion: cleanCatalogText(payload.appVersion || "", 40) || null,
        revokedAt: null,
      };
      db.activations[deviceId] = activation;
      await writeDb(db);
      return send(res, 200, { activated: true, activation: activationView(activation) });
    }
    if (req.method === "POST" && req.url === "/v1/activation/admin") {
      const payload = await body(req);
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      if (!configuredSuperAdminUsername || configuredSuperAdminPassword.length < 10) {
        return send(res, 503, { error: "La cuenta administradora todavía no está configurada en Render" });
      }
      if (deviceId.length < 3) return send(res, 400, { error: "El identificador del dispositivo no es válido" });
      if (!safeEqual(payload.deviceKey, configuredSuperAdminPassword)) {
        return send(res, 401, { error: "La clave privada de administrador no es correcta" });
      }
      const db = await readDb();
      const admin = db.users[configuredSuperAdminUsername];
      if (!admin || admin.role !== "superAdmin") {
        return send(res, 503, { error: "La cuenta administradora de nube no está disponible" });
      }
      const now = new Date().toISOString();
      const activation = {
        id: db.activations?.[deviceId]?.id || crypto.randomUUID(),
        deviceId,
        codeId: null,
        activatedAt: db.activations?.[deviceId]?.activatedAt || now,
        lastSeenAt: now,
        appVersion: cleanCatalogText(payload.appVersion || "", 40) || null,
        administrator: true,
        revokedAt: null,
      };
      db.activations ||= {};
      db.activations[deviceId] = activation;
      db.devices[deviceId] = {
        tenantId: "system-admin",
        userId: admin.id,
        lastSeenAt: now,
        revokedAt: null,
      };
      await writeDb(db);
      return send(res, 200, { activated: true, activation: activationView(activation) });
    }
    if (req.method === "POST" && req.url === "/v1/auth/password/forgot") {
      const payload = await body(req);
      const email = normalizeEmail(payload.email);
      const ipAllowed = consumePasswordResetIpLimit(req);
      if (!isValidEmail(email)) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return send(res, 202, { ok: true, message: passwordResetGenericMessage });
      }
      const db = await readDb();
      const emailAllowed = consumePasswordResetEmailLimit(db, email);
      const credential = emailAllowed && ipAllowed ? passwordResetCredentialByEmail(db, email) : null;
      let rawToken = "";
      if (credential && emailService.configured) {
        const now = Date.now();
        const subjectKey = passwordResetSubjectKey(credential);
        for (const candidate of Object.values(db.passwordResetTokens || {})) {
          if (candidate.subjectKey === subjectKey && !candidate.usedAt && !candidate.revokedAt) {
            candidate.revokedAt = new Date(now).toISOString();
            candidate.revokedReason = "replaced";
          }
        }
        rawToken = token();
        const requestId = crypto.randomUUID();
        db.passwordResetTokens ||= {};
        db.passwordResetTokens[sha256(rawToken)] = {
          id: requestId,
          subjectKey,
          businessId: credential.businessId,
          role: credential.role,
          username: credential.username,
          emailHash: sha256(email),
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + passwordResetTtlMs).toISOString(),
          usedAt: null,
          revokedAt: null,
        };
        await writeDb(db);
        void sendEmailBestEffort("de recuperación", () => emailService.sendPasswordReset({
          to: email,
          name: credential.name,
          resetUrl: passwordResetUrl(rawToken),
          expiresInMinutes: passwordResetTtlMinutes,
          requestId,
        }));
        await new Promise((resolve) => setTimeout(resolve, 120));
      } else {
        await writeDb(db);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return send(res, 202, {
        ok: true,
        message: passwordResetGenericMessage,
        ...(emailTestMode && isLoopback(req) && rawToken ? { testResetToken: rawToken } : {}),
      });
    }
    if (req.method === "POST" && req.url === "/v1/auth/password/reset") {
      const payload = await body(req);
      const rawToken = String(payload.token || "").trim();
      const password = String(payload.password || "");
      if (password.length < 8 || password.length > 128) {
        return send(res, 400, { error: "La contraseña nueva debe tener entre 8 y 128 caracteres." });
      }
      const db = await readDb();
      const entry = rawToken.length >= 30 ? db.passwordResetTokens?.[sha256(rawToken)] : null;
      const now = Date.now();
      const tokenExpiresAt = Date.parse(entry?.expiresAt || "");
      if (!entry || entry.usedAt || entry.revokedAt || !Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= now) {
        return send(res, 400, { error: "El enlace de recuperación es inválido, ya fue usado o venció." });
      }
      const credential = passwordResetCredentialBySubjectKey(db, entry.subjectKey);
      if (!credential) return send(res, 400, { error: "El enlace de recuperación ya no corresponde a una cuenta activa." });
      const user = updatePasswordResetCredential(db, credential, password);
      entry.usedAt = new Date(now).toISOString();
      for (const candidate of Object.values(db.passwordResetTokens || {})) {
        if (candidate.subjectKey === entry.subjectKey && candidate.id !== entry.id && !candidate.usedAt && !candidate.revokedAt) {
          candidate.revokedAt = entry.usedAt;
          candidate.revokedReason = "password_changed";
        }
      }
      for (const session of Object.values(db.sessions || {})) {
        if (String(session?.userId) === String(user.id) && !session.revokedAt) {
          session.revokedAt = entry.usedAt;
          session.revokedReason = "password_reset";
          session.refreshGraceUntil = null;
        }
      }
      await writeDb(db);
      if (emailService.configured) {
        void sendEmailBestEffort("de confirmación de contraseña", () => emailService.sendPasswordChanged({
          to: credential.email,
          name: credential.name,
          requestId: entry.id,
        }));
      }
      return send(res, 200, { ok: true, message: "La contraseña fue actualizada. Ya podés iniciar sesión nuevamente." });
    }
    if (req.method === "POST" && req.url === "/v1/auth/register") {
      const payload = await body(req);
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      const username = cleanCatalogText(payload.username, 80);
      const password = String(payload.password || "");
      const name = cleanCatalogText(payload.name, 100);
      const email = normalizeEmail(payload.email);
      const businessName = cleanCatalogText(payload.businessName, 140);
      const businessMode = payload.businessMode === "equipo" ? "equipo" : "solo";
      const requestedReferralCode = normalizeReferralCode(payload.referralCode);
      if (!deviceId || !username || password.length < 4 || !name || !businessName || !isValidEmail(email)) {
        return send(res, 400, { error: "Completá el nombre, negocio, correo, usuario y una contraseña de al menos 4 caracteres" });
      }
      if (payload.termsAccepted !== true || String(payload.termsVersion || "") !== TERMS_VERSION) {
        return send(res, 400, { error: "Leé y aceptá la versión vigente de los Términos y Condiciones para crear la cuenta." });
      }
      const db = await readDb();
      const activation = db.activations?.[deviceId];
      if (!activation || activation.revokedAt) {
        return send(res, 403, { error: "Este dispositivo todavía no fue autorizado. Ingresá la clave del administrador para crear un negocio nuevo." });
      }
      const normalizedUsername = username.toLowerCase();
      const usernameExists = Object.values(db.users || {}).some(
        (entry) => String(entry?.username || "").trim().toLowerCase() === normalizedUsername,
      ) || (db.system?.cuentas || []).some((account) => (
        String(account?.usuario || "").trim().toLowerCase() === normalizedUsername
        || (account?.empleados || []).some((employee) => String(employee?.usuario || "").trim().toLowerCase() === normalizedUsername)
      ));
      if (usernameExists) return send(res, 409, { error: "Ese usuario ya existe, elegí otro" });
      if (passwordResetEmailInUse(db, email)) return send(res, 409, { error: "Ese correo ya está asociado a otra cuenta" });

      const referrer = requestedReferralCode
        ? (db.system?.cuentas || []).find((candidate) => normalizeReferralCode(candidate?.referralCode) === requestedReferralCode)
        : null;
      if (requestedReferralCode && !referrer) {
        return send(res, 400, { error: "El código de referido no existe. Revisalo o dejá el campo vacío." });
      }

      const businessId = crypto.randomUUID();
      const now = new Date().toISOString();
      const trialExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      const account = {
        id: businessId,
        tenantId: businessId,
        nombre: name,
        usuario: username,
        email,
        nombreNegocio: businessName,
        modoNegocio: businessMode,
        superAdmin: false,
        estado: "pendiente",
        trialStartedAt: now,
        trialExpiresAt,
        trialDays: 30,
        roles: [],
        empleados: [],
        pagos: [],
        referralCode: generateReferralCode(db.system?.cuentas || []),
        referredByAccountId: referrer?.id || null,
        referredByCode: referrer?.referralCode || null,
        createdAt: now,
        registrationDeviceId: deviceId,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        ...appPasswordFields(password),
      };
      const secured = hashPassword(password);
      db.system ||= {};
      db.system.cuentas = [...(db.system.cuentas || []), account];
      db.users[username] = {
        id: crypto.randomUUID(),
        businessId,
        username,
        name,
        email,
        role: "owner",
        salt: secured.salt,
        passwordHash: secured.hash,
        status: "active",
      };
      db.tenants[businessId] ||= { entities: {}, sections: {} };
      db.devices[deviceId] = { ...(db.devices[deviceId] || {}), tenantId: businessId, userId: db.users[username].id, lastSeenAt: now, revokedAt: null };
      db.cursor += 1;
      db.changes.push({
        id: `registration:${businessId}`,
        deviceId: "kiosco-cloud",
        tenantId: "system-admin",
        type: "system_set",
        key: "cuentas",
        value: db.system.cuentas,
        cursor: db.cursor,
        serverAt: now,
      });
      db.changes = compactChangeLog(db.changes);
      const registrationNotice = createPlatformNotification(db, {
        sourceKey: `registration:${businessId}`,
        title: "Nueva cuenta pendiente",
        message: `${businessName} (${name}) creó su cuenta y está esperando aprobación.`,
        level: "urgente",
        category: "accounts",
        audience: { type: "admin" },
        action: { view: "administracion" },
      }).notification;
      await sendPushNotification(db, registrationNotice);
      await writeDb(db);
      if (emailService.configured) {
        void sendEmailBestEffort("de bienvenida", () => emailService.sendWelcome({
          to: email,
          name,
          businessName,
          accountId: businessId,
        }));
      }
      return send(res, 201, { ok: true, businessId, account });
    }
    if (req.method === "POST" && req.url === "/v1/auth/register-local") {
      if (!localMode || !isLoopback(req)) return send(res, 404, { error: "Ruta inexistente" });
      const payload = await body(req);
      const db = await readDb();
      const username = String(payload.username || "").trim();
      if (!username || !payload.password || !payload.businessId) return send(res, 400, { error: "Faltan credenciales o negocio" });
      const secured = hashPassword(payload.password);
      const existing = db.users[username];
      db.users[username] = {
        id: existing?.id || crypto.randomUUID(),
        businessId: String(payload.businessId),
        username,
        name: payload.name || existing?.name || username,
        email: normalizeEmail(payload.email || existing?.email),
        role: payload.superAdmin ? "superAdmin" : "owner",
        salt: secured.salt,
        passwordHash: secured.hash,
        status: "active",
      };
      await writeDb(db);
      return send(res, 200, { ok: true, businessId: String(payload.businessId) });
    }
    if (req.method === "POST" && req.url === "/v1/auth/pair-device") {
      const payload = await body(req);
      const deviceId = String(payload.deviceId || "").trim();
      if (!configuredSuperAdminUsername || configuredSuperAdminPassword.length < 10) {
        return send(res, 503, { error: "La clave privada del dispositivo no está configurada en Render" });
      }
      if (!deviceId || !safeEqual(payload.deviceKey, configuredSuperAdminPassword)) {
        return send(res, 401, { error: "La clave privada del dispositivo no es correcta" });
      }
      const db = await readDb();
      const user = db.users[configuredSuperAdminUsername];
      if (!user || user.status !== "active" || user.role !== "superAdmin") {
        return send(res, 503, { error: "La cuenta administradora de nube no está disponible" });
      }
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = accessTokenExpiresAt();
      db.sessions[accessToken] = {
        userId: user.id,
        businessId: user.businessId,
        deviceId,
        role: user.role,
        expiresAt,
        refreshExpiresAt: refreshTokenExpiresAt(),
        refreshHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null,
      };
      db.devices[deviceId] = { tenantId: user.businessId, userId: user.id, lastSeenAt: new Date().toISOString(), revokedAt: null };
      await writeDb(db);
      return send(res, 200, {
        accessToken,
        refreshToken,
        expiresAt,
        user: { id: user.id, name: user.name, role: user.role, businessId: user.businessId },
      });
    }
    if (req.method === "POST" && req.url === "/v1/auth/bootstrap") {
      const payload = await body(req);
      const db = await readDb();
      if (Object.values(db.users).some((user) => user.role !== "superAdmin")) return send(res, 409, { error: "El administrador inicial ya existe" });
      const secured = hashPassword(payload.password);
      const businessId = String(payload.businessId || crypto.randomUUID());
      db.users[payload.username] = {
        id: crypto.randomUUID(),
        businessId,
        username: payload.username,
        name: payload.name || "Administrador",
        role: "owner",
        salt: secured.salt,
        passwordHash: secured.hash,
        status: "active",
      };
      await writeDb(db);
      return send(res, 201, { businessId });
    }
    if (req.method === "POST" && req.url === "/v1/auth/login") {
      const payload = await body(req);
      const db = await readDb();
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      if (deviceId.length < 3) return send(res, 400, { error: "El identificador del dispositivo no es válido" });
      if (db.devices?.[deviceId]?.revokedAt) return send(res, 403, { error: "Este dispositivo fue bloqueado por el administrador" });
      const username = String(payload.username || "").trim();
      const existingUser = Object.values(db.users || {}).find(
        (entry) => String(entry?.username || "").trim().toLowerCase() === username.toLowerCase(),
      );
      let user = existingUser;
      let cloudPasswordIsValid = false;
      try { cloudPasswordIsValid = !!user && user.status === "active" && verifyPassword(payload.password, user); } catch {}
      if (!cloudPasswordIsValid) user = migrateAppUser(db, username, payload.password);
      if (!user) return send(res, 401, { error: "Credenciales incorrectas" });
      const activation = db.activations?.[deviceId];
      if (requireDeviceActivation && (!activation || activation.revokedAt)) {
        return send(res, 403, { error: "Este dispositivo todavía no fue autorizado. Ingresá una clave de activación antes de iniciar sesión." });
      }
      if (activation) activation.lastSeenAt = new Date().toISOString();
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = accessTokenExpiresAt();
      db.sessions[accessToken] = {
        userId: user.id,
        businessId: user.businessId,
        deviceId,
        role: user.role,
        expiresAt,
        refreshExpiresAt: refreshTokenExpiresAt(),
        refreshHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null,
      };
      db.devices[deviceId] = { tenantId: user.businessId, userId: user.id, lastSeenAt: new Date().toISOString(), revokedAt: null };
      await writeDb(db);
      return send(res, 200, {
        accessToken,
        refreshToken,
        expiresAt,
        user: { id: user.id, name: user.name, role: user.role, businessId: user.businessId },
        account: accountForLogin(db, user),
      });
    }
    if (req.method === "POST" && req.url === "/v1/auth/refresh") {
      const payload = await body(req);
      const db = await readDb();
      const hash = crypto.createHash("sha256").update(String(payload.refreshToken || "")).digest("hex");
      const now = Date.now();
      const entry = Object.entries(db.sessions).find(([, session]) => {
        if (session.refreshHash !== hash) return false;
        if (session.refreshExpiresAt && Date.parse(session.refreshExpiresAt) <= now) return false;
        if (!session.revokedAt) return true;
        return session.revokedReason === "refreshed" && Date.parse(session.refreshGraceUntil || "") > now;
      });
      if (!entry) return send(res, 401, { error: "Sesión inválida" });
      const [, old] = entry;
      if (db.devices[old.deviceId]?.revokedAt) return send(res, 403, { error: "Dispositivo bloqueado" });
      const activation = db.activations?.[old.deviceId];
      if (requireDeviceActivation && (!activation || activation.revokedAt)) {
        return send(res, 403, { error: "Este dispositivo ya no está autorizado" });
      }
      if (activation) activation.lastSeenAt = new Date(now).toISOString();
      if (!old.revokedAt) {
        old.revokedAt = new Date(now).toISOString();
        old.revokedReason = "refreshed";
        old.refreshGraceUntil = new Date(now + refreshRetryGraceMs).toISOString();
      }
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = accessTokenExpiresAt();
      db.sessions[accessToken] = {
        ...old,
        expiresAt,
        refreshExpiresAt: refreshTokenExpiresAt(),
        refreshHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null,
        revokedReason: null,
        refreshGraceUntil: null,
      };
      await writeDb(db);
      return send(res, 200, { accessToken, refreshToken, expiresAt });
    }
    if (req.method === "POST" && req.url === "/v1/auth/logout") {
      const db = await readDb();
      const session = activeSession(db, req);
      if (session) {
        session.revokedAt = new Date().toISOString();
        session.revokedReason = "logout";
        session.refreshGraceUntil = null;
        await writeDb(db);
      }
      return send(res, 204, {});
    }

    const tenantId = String(req.headers["x-tenant-id"] || "");
    const deviceId = String(req.headers["x-device-id"] || "");
    if (!tenantId || !deviceId) return send(res, 400, { error: "x-tenant-id y x-device-id son obligatorios" });
    const db = await readDb();
    let session = null;
    if (Object.keys(db.users).length) {
      session = activeSession(db, req);
      const canAccessTenant = session && (session.businessId === tenantId || session.role === "superAdmin");
      if (!canAccessTenant || session.deviceId !== deviceId) return send(res, 401, { error: "Sesión o dispositivo no autorizados" });
      if (db.devices[deviceId]?.revokedAt) return send(res, 403, { error: "Dispositivo bloqueado" });
      if (requireDeviceActivation && (!db.activations?.[deviceId] || db.activations[deviceId].revokedAt)) {
        return send(res, 403, { error: "Este dispositivo ya no está autorizado" });
      }
    }
    db.devices[deviceId] = { ...(db.devices[deviceId] || {}), tenantId, lastSeenAt: new Date().toISOString() };

    if (req.url?.startsWith("/v1/business-displays")) {
      if (!session || !["owner", "superAdmin"].includes(session.role)) return send(res, 403, { error: "Sólo el dueño puede administrar las pantallas remotas." });
      db.businessDisplays ||= {}; db.displayPairingCodes ||= {}; db.displayTokens ||= {};
      const visible = () => Object.values(db.businessDisplays).filter((entry) => String(entry.businessId) === tenantId);
      if (req.method === "GET" && req.url === "/v1/business-displays") {
        return send(res, 200, { displays: visible().map((entry) => ({ ...displayView(entry), pairedDevices: Object.values(db.displayTokens).filter((tokenEntry) => tokenEntry.displayId === entry.id && !tokenEntry.revokedAt).length, lastSeenAt: entry.lastSeenAt || null })) });
      }
      if (req.method === "POST" && req.url === "/v1/business-displays") {
        if (visible().length >= 12) return send(res, 409, { error: "Alcanzaste el máximo de 12 pantallas para este negocio." });
        const payload = await body(req); const id = crypto.randomUUID(); const now = new Date().toISOString();
        const content = sanitizePublicDisplayContent(payload.content || {});
        content.config.operationMode = "ads-only";
        const display = { id, businessId: tenantId, name: cleanCatalogText(payload.name || `Pantalla ${visible().length + 1}`, 80), status: "active", content, contentVersion: 1, createdAt: now, updatedAt: now, lastSeenAt: null };
        db.businessDisplays[id] = display;
        const pairing = createDisplayPairing(db, display);
        await writeDb(db);
        return send(res, 201, { display: displayView(display), pairing });
      }
      const pairingMatch = req.url.match(/^\/v1\/business-displays\/([^/?]+)\/pairing-code$/);
      if (req.method === "POST" && pairingMatch) {
        const id = decodeURIComponent(pairingMatch[1]); const display = db.businessDisplays[id];
        if (!display || String(display.businessId) !== tenantId) return send(res, 404, { error: "Pantalla inexistente." });
        for (const entry of Object.values(db.displayPairingCodes)) if (entry.displayId === id && !entry.usedAt) entry.usedAt = new Date().toISOString();
        const pairing = createDisplayPairing(db, display);
        await writeDb(db); return send(res, 201, { pairing });
      }
      const approvePairingMatch = req.url.match(/^\/v1\/business-displays\/([^/?]+)\/pair$/);
      if (req.method === "POST" && approvePairingMatch) {
        const id = decodeURIComponent(approvePairingMatch[1]); const display = db.businessDisplays[id];
        if (!display || String(display.businessId) !== tenantId) return send(res, 404, { error: "Pantalla inexistente." });
        const payload = await body(req);
        const pairingCode = String(payload.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const codeHash = displaySecretHash(pairingCode);
        const pairing = db.displayPairingCodes[codeHash];
        if (!pairing?.requestTokenHash || pairing.approvedAt || pairing.usedAt || Date.parse(pairing.expiresAt || "") <= Date.now()) {
          return send(res, 400, { error: "El código no existe, ya fue usado o venció." });
        }
        const now = new Date().toISOString();
        db.displayTokens[pairing.requestTokenHash] = {
          id: crypto.randomUUID(), displayId: display.id, businessId: display.businessId,
          deviceId: cleanCatalogText(pairing.deviceId || crypto.randomUUID(), 120), createdAt: now, lastSeenAt: now, revokedAt: null,
        };
        display.lastSeenAt = now; display.updatedAt = now;
        pairing.displayId = display.id; pairing.businessId = display.businessId; pairing.approvedAt = now; pairing.usedAt = now;
        delete db.displayPairingCodes[codeHash];
        await writeDb(db);
        return send(res, 201, { ok: true, display: displayView(display) });
      }
      const revokeMatch = req.url.match(/^\/v1\/business-displays\/([^/?]+)\/revoke$/);
      if (req.method === "POST" && revokeMatch) {
        const id = decodeURIComponent(revokeMatch[1]); const display = db.businessDisplays[id];
        if (!display || String(display.businessId) !== tenantId) return send(res, 404, { error: "Pantalla inexistente." });
        const now = new Date().toISOString();
        for (const entry of Object.values(db.displayTokens)) if (entry.displayId === id && !entry.revokedAt) entry.revokedAt = now;
        display.lastSeenAt = null; display.updatedAt = now;
        await writeDb(db); return send(res, 200, { ok: true });
      }
      const displayMatch = req.url.match(/^\/v1\/business-displays\/([^/?]+)$/);
      if (displayMatch) {
        const id = decodeURIComponent(displayMatch[1]); const display = db.businessDisplays[id];
        if (!display || String(display.businessId) !== tenantId) return send(res, 404, { error: "Pantalla inexistente." });
        if (req.method === "PUT") {
          const payload = await body(req);
          if (payload.name !== undefined) display.name = cleanCatalogText(payload.name, 80) || display.name;
          if (payload.content) { display.content = sanitizePublicDisplayContent(payload.content); display.content.config.operationMode = "ads-only"; display.contentVersion = Number(display.contentVersion || 0) + 1; }
          if (["active", "paused"].includes(payload.status)) display.status = payload.status;
          display.updatedAt = new Date().toISOString(); await writeDb(db);
          return send(res, 200, { display: displayView(display) });
        }
        if (req.method === "DELETE") {
          delete db.businessDisplays[id];
          for (const [key, entry] of Object.entries(db.displayTokens)) if (entry.displayId === id) delete db.displayTokens[key];
          for (const [key, entry] of Object.entries(db.displayPairingCodes)) if (entry.displayId === id) delete db.displayPairingCodes[key];
          await writeDb(db); return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: "Ruta de pantallas inexistente." });
    }

    if (!["GET", "OPTIONS"].includes(req.method) && session?.role !== "superAdmin" && !req.url.startsWith("/v1/admin/") && !req.url.startsWith("/v1/notifications") && req.url !== "/v1/issues" && !accountCanWrite(db, tenantId)) {
      return send(res, 403, { error: "El abono está vencido. La cuenta se encuentra en modo consulta." });
    }

    if (req.url?.startsWith("/v1/admin/accounts")) {
      if (session?.role !== "superAdmin") return send(res, 403, { error: "Se requiere la cuenta administradora de Kiosco+" });
      if (req.method === "GET" && req.url === "/v1/admin/accounts") {
        return send(res, 200, {
          accounts: (db.system?.cuentas || []).filter((account) => account && !account.superAdmin),
          cursor: Number(db.cursor || 0),
        });
      }
      const accountDeleteMatch = req.url.match(/^\/v1\/admin\/accounts\/([^/?]+)$/);
      if (req.method === "DELETE" && accountDeleteMatch) {
        const accountId = decodeURIComponent(accountDeleteMatch[1]);
        const account = (db.system?.cuentas || []).find((candidate) => String(candidate?.id) === accountId && !candidate?.superAdmin);
        if (!account) return send(res, 404, { error: "El negocio ya no existe en el servidor" });
        const removedUserIds = new Set(Object.values(db.users || {})
          .filter((user) => String(user?.businessId) === accountId)
          .map((user) => String(user?.id || "")));
        db.system.cuentas = (db.system.cuentas || []).filter((candidate) => String(candidate?.id) !== accountId);
        for (const [key, user] of Object.entries(db.users || {})) {
          if (String(user?.businessId) === accountId) delete db.users[key];
        }
        for (const [key, active] of Object.entries(db.sessions || {})) {
          if (String(active?.businessId) === accountId) delete db.sessions[key];
        }
        for (const [key, device] of Object.entries(db.devices || {})) {
          if (String(device?.tenantId) === accountId) delete db.devices[key];
        }
        for (const [key, subscription] of Object.entries(db.pushSubscriptions || {})) {
          if (String(subscription?.businessId) === accountId) delete db.pushSubscriptions[key];
        }
        for (const [key, receipt] of Object.entries(db.notificationReads || {})) {
          if (String(receipt?.businessId) === accountId || removedUserIds.has(String(receipt?.userId || ""))) delete db.notificationReads[key];
        }
        for (const [key, reset] of Object.entries(db.passwordResetTokens || {})) {
          if (String(reset?.businessId) === accountId) delete db.passwordResetTokens[key];
        }
        for (const [key, issue] of Object.entries(db.reportedIssues || {})) {
          if (String(issue?.businessId || issue?.negocioId) === accountId) delete db.reportedIssues[key];
        }
        const removedDisplayIds = new Set(Object.values(db.businessDisplays || {}).filter((entry) => String(entry?.businessId) === accountId).map((entry) => String(entry.id)));
        for (const [key, display] of Object.entries(db.businessDisplays || {})) if (removedDisplayIds.has(String(display?.id))) delete db.businessDisplays[key];
        for (const [key, entry] of Object.entries(db.displayPairingCodes || {})) if (removedDisplayIds.has(String(entry?.displayId))) delete db.displayPairingCodes[key];
        for (const [key, entry] of Object.entries(db.displayTokens || {})) if (removedDisplayIds.has(String(entry?.displayId))) delete db.displayTokens[key];
        delete db.tenants?.[accountId];
        const now = new Date().toISOString();
        db.system.accountTombstones ||= {};
        db.system.accountTombstones[accountId] = {
          deletedAt: now,
          deletedByUserId: session.userId || null,
        };
        ensureReferralMetadata(db);
        db.cursor += 1;
        db.changes.push({
          id: `account-delete:${accountId}:${crypto.randomUUID()}`,
          deviceId,
          tenantId,
          type: "system_set",
          key: "cuentas",
          value: db.system.cuentas,
          removedAccountIds: [accountId],
          createdAt: now,
          cursor: db.cursor,
          serverAt: now,
        });
        db.changes = compactChangeLog(db.changes);
        await writeDb(db);
        return send(res, 200, {
          ok: true,
          removedAccountId: accountId,
          accounts: db.system.cuentas.filter((candidate) => candidate && !candidate.superAdmin),
        });
      }
      return send(res, 404, { error: "Ruta administrativa de negocios inexistente" });
    }

    if (req.method === "GET" && req.url === "/v1/notifications") {
      const notificationSubject = notificationSubjectForRequest(db, req, session);
      return send(res, 200, {
        notifications: visiblePlatformNotifications(db, notificationSubject).map((entry) => notificationView(db, entry, session)),
        pushConfigured: pushDeliveryConfigured,
        preview: Boolean(notificationSubject.adminPreview),
      });
    }
    const notificationReadMatch = req.url?.match(/^\/v1\/notifications\/([^/?]+)\/read$/);
    if (req.method === "POST" && notificationReadMatch) {
      const notificationId = decodeURIComponent(notificationReadMatch[1]);
      const notification = db.platformNotifications?.[notificationId];
      const notificationSubject = notificationSubjectForRequest(db, req, session);
      if (!notification || !notificationAudienceMatches(notification, notificationSubject)) return send(res, 404, { error: "Notificación inexistente" });
      db.notificationReads ||= {};
      const key = `${notificationId}:${session.userId}`;
      db.notificationReads[key] = { notificationId, userId: session.userId, businessId: session.businessId, readAt: new Date().toISOString() };
      await writeDb(db);
      return send(res, 200, { ok: true, readAt: db.notificationReads[key].readAt });
    }
    if (req.method === "POST" && req.url === "/v1/notifications/push-subscriptions") {
      if (!pushDeliveryConfigured) return send(res, 503, { error: "Los avisos al celular todavía no están configurados en el servidor" });
      const payload = await body(req);
      const subscription = payload.subscription;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return send(res, 400, { error: "La suscripción del dispositivo no es válida" });
      const id = crypto.createHash("sha256").update(String(subscription.endpoint)).digest("hex");
      db.pushSubscriptions ||= {};
      db.pushSubscriptions[id] = {
        id,
        subscription,
        userId: session.userId,
        businessId: session.businessId,
        role: session.role,
        deviceId,
        userAgent: cleanCatalogText(req.headers["user-agent"], 240),
        preferences: {
          mode: ["all", "important", "none"].includes(payload.preferences?.mode) ? payload.preferences.mode : "all",
          quietHoursEnabled: payload.preferences?.quietHoursEnabled !== false,
          quietStart: /^\d{2}:\d{2}$/.test(payload.preferences?.quietStart || "") ? payload.preferences.quietStart : "22:00",
          quietEnd: /^\d{2}:\d{2}$/.test(payload.preferences?.quietEnd || "") ? payload.preferences.quietEnd : "08:00",
          categories: Object.fromEntries(Object.entries(payload.preferences?.categories || {}).map(([key, value]) => [cleanCatalogText(key, 40), value !== false])),
        },
        createdAt: db.pushSubscriptions[id]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revokedAt: null,
      };
      await writeDb(db);
      return send(res, 201, { ok: true, id });
    }
    if (req.method === "POST" && req.url === "/v1/notifications/test") {
      if (!pushDeliveryConfigured) return send(res, 503, { error: "Los avisos al celular todavía no están configurados en el servidor" });
      const entries = Object.values(db.pushSubscriptions || {}).filter((entry) => !entry?.revokedAt && entry.userId === session.userId && String(entry.deviceId || "") === String(deviceId || ""));
      if (!entries.length) return send(res, 409, { error: "Primero activá los avisos en este dispositivo" });
      const payload = JSON.stringify({
        id: `test-${Date.now()}`,
        title: "Kiosco+ está conectado",
        body: "Las notificaciones funcionan correctamente en este dispositivo.",
        level: "info",
        url: "/?view=notificaciones",
      });
      let sent = 0;
      for (const entry of entries) {
        try {
          await webpush.sendNotification(entry.subscription, payload, { TTL: 300 });
          entry.lastSuccessAt = new Date().toISOString();
          sent += 1;
        } catch (error) {
          entry.lastErrorAt = new Date().toISOString();
          entry.lastError = String(error?.message || error).slice(0, 180);
          if ([404, 410].includes(Number(error?.statusCode))) entry.revokedAt = entry.lastErrorAt;
        }
      }
      await writeDb(db);
      if (!sent) return send(res, 502, { error: "El servicio no pudo entregar el aviso de prueba" });
      return send(res, 200, { ok: true, sent });
    }
    if (req.method === "DELETE" && req.url === "/v1/notifications/push-subscriptions") {
      const payload = await body(req);
      const endpoint = String(payload.endpoint || "");
      const id = endpoint ? crypto.createHash("sha256").update(endpoint).digest("hex") : "";
      if (id && db.pushSubscriptions?.[id]?.userId === session.userId) db.pushSubscriptions[id].revokedAt = new Date().toISOString();
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (req.url?.startsWith("/v1/admin/notifications")) {
      if (session?.role !== "superAdmin") return send(res, 403, { error: "Se requiere la cuenta administradora de Kiosco+" });
      if (req.method === "GET" && req.url === "/v1/admin/notifications") {
        return send(res, 200, {
          notifications: Object.values(db.platformNotifications || {}).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
          pushConfigured: pushDeliveryConfigured,
          activePushDevices: Object.values(db.pushSubscriptions || {}).filter((entry) => !entry.revokedAt).length,
        });
      }
      if (req.method === "POST" && req.url === "/v1/admin/notifications") {
        const payload = await body(req);
        if (!String(payload.title || "").trim() || !String(payload.message || "").trim()) return send(res, 400, { error: "Escribí un título y un mensaje" });
        const publishAt = Date.parse(payload.publishAt || "");
        const expiresAt = Date.parse(payload.expiresAt || "");
        if (Number.isFinite(publishAt) && Number.isFinite(expiresAt) && expiresAt <= publishAt) return send(res, 400, { error: "La fecha para ocultar el aviso debe ser posterior a su publicación" });
        const audienceType = ["all", "admin", "business"].includes(payload.audienceType) ? payload.audienceType : "all";
        const businessIds = [...new Set((Array.isArray(payload.businessIds) ? payload.businessIds : []).map(String).filter(Boolean))];
        if (audienceType === "business" && !businessIds.length) return send(res, 400, { error: "Elegí al menos un negocio" });
        const result = createPlatformNotification(db, {
          title: payload.title,
          message: payload.message,
          level: payload.level,
          category: payload.category || "maintenance",
          audience: { type: audienceType, businessIds },
          publishAt: payload.publishAt,
          expiresAt: payload.expiresAt,
          action: payload.action,
          createdBy: session.userId,
        });
        const delivery = await sendPushNotification(db, result.notification);
        await writeDb(db);
        return send(res, 201, { notification: result.notification, delivery });
      }
      const archiveMatch = req.url.match(/^\/v1\/admin\/notifications\/([^/?]+)\/archive$/);
      if (req.method === "POST" && archiveMatch) {
        const id = decodeURIComponent(archiveMatch[1]);
        if (!db.platformNotifications?.[id]) return send(res, 404, { error: "Notificación inexistente" });
        db.platformNotifications[id].archivedAt = new Date().toISOString();
        await writeDb(db);
        return send(res, 200, { ok: true, notification: db.platformNotifications[id] });
      }
      return send(res, 404, { error: "Ruta administrativa inexistente" });
    }
    if (req.method === "POST" && req.url === "/v1/issues") {
      const payload = await body(req);
      const description = cleanCatalogText(payload.description || payload.descripcion, 1200);
      if (description.length < 5) return send(res, 400, { error: "Describí el problema con un poco más de detalle" });
      const recentIssueCount = Object.values(db.reportedIssues || {}).filter((item) => (
        item?.userId === session.userId && Date.parse(item.fecha || "") > Date.now() - 60 * 60 * 1000
      )).length;
      if (recentIssueCount >= 5) return send(res, 429, { error: "Ya enviaste varios reportes. Esperá un rato antes de mandar otro." });
      const account = tenantAccount(db, session.businessId);
      const id = crypto.randomUUID();
      const capture = String(payload.capture || payload.captura || "");
      const issue = {
        id,
        businessId: session.businessId,
        negocioId: session.businessId,
        negocio: account?.nombreNegocio || "Sin negocio",
        userId: session.userId,
        usuario: cleanCatalogText(payload.userName || payload.usuario || "Usuario", 100),
        descripcion: description,
        detalleTecnico: cleanCatalogText(payload.technicalDetail || payload.detalleTecnico, 4000),
        captura: capture.startsWith("data:image/") && capture.length <= 3_000_000 ? capture : null,
        vista: cleanCatalogText(payload.view || payload.vista || "", 80),
        fecha: new Date().toISOString(),
        estado: "nuevo",
        archivedAt: null,
      };
      db.reportedIssues ||= {};
      db.reportedIssues[id] = issue;
      const notification = createPlatformNotification(db, {
        sourceKey: `issue:${id}`,
        title: `Problema reportado por ${issue.negocio}`,
        message: description,
        level: "urgente",
        audience: { type: "admin" },
        action: { view: "administracion" },
      }).notification;
      await sendPushNotification(db, notification);
      await writeDb(db);
      return send(res, 201, { ok: true, issue });
    }
    if (req.url?.startsWith("/v1/admin/issues")) {
      if (session?.role !== "superAdmin") return send(res, 403, { error: "Se requiere la cuenta administradora de Kiosco+" });
      if (req.method === "GET" && req.url === "/v1/admin/issues") {
        return send(res, 200, { issues: Object.values(db.reportedIssues || {}).filter((item) => !item.archivedAt).sort((left, right) => String(right.fecha).localeCompare(String(left.fecha))) });
      }
      const statusMatch = req.url.match(/^\/v1\/admin\/issues\/([^/?]+)\/status$/);
      if (req.method === "POST" && statusMatch) {
        const id = decodeURIComponent(statusMatch[1]);
        const issue = db.reportedIssues?.[id];
        if (!issue) return send(res, 404, { error: "Reporte inexistente" });
        const payload = await body(req);
        issue.estado = payload.status === "resuelto" ? "resuelto" : "nuevo";
        issue.updatedAt = new Date().toISOString();
        await writeDb(db);
        return send(res, 200, { ok: true, issue });
      }
      const archiveIssueMatch = req.url.match(/^\/v1\/admin\/issues\/([^/?]+)\/archive$/);
      if (req.method === "POST" && archiveIssueMatch) {
        const id = decodeURIComponent(archiveIssueMatch[1]);
        const issue = db.reportedIssues?.[id];
        if (!issue) return send(res, 404, { error: "Reporte inexistente" });
        issue.archivedAt = new Date().toISOString();
        await writeDb(db);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "Ruta administrativa inexistente" });
    }

    if (req.method === "GET" && req.url === "/v1/sync/bootstrap") {
      const snapshot = materializeTenantSnapshot(db.tenants[tenantId] || {});
      return send(res, 200, {
        cursor: Number(db.cursor || 0),
        ...snapshot,
        accounts: session?.role === "superAdmin" ? (db.system?.cuentas || []) : undefined,
      });
    }

    if (req.method === "POST" && req.url === "/v1/catalog/verify-pending") {
      const payload = await body(req);
      const codigo = cleanBarcode(payload.codigo);
      if (codigo.length < 6) return send(res, 400, { error: "El codigo debe tener al menos 6 digitos" });
      db.barcodeCatalog ||= {};
      const now = new Date().toISOString();
      const current = db.barcodeCatalog[codigo] || { codigo, candidates: {}, contributions: {}, confirmations: 0 };
      current.lookupCount = Number(current.lookupCount || 0) + 1;
      current.lastLookupAt = now;
      current.requestedAt = now;
      current.requestedBy = [
        { tenantId, deviceId, userId: session?.userId || null, at: now },
        ...(Array.isArray(current.requestedBy) ? current.requestedBy : []),
      ].slice(0, 20);
      if (!current.product) current.status = "pending";
      current.updatedAt = now;
      db.barcodeCatalog[codigo] = current;
      await writeDb(db);
      return send(res, current.product ? 200 : 202, {
        ok: true,
        alreadyKnown: !!current.product,
        item: catalogAdminView(current),
      });
    }

    if (req.url?.startsWith("/v1/admin/activation-codes") || req.url?.startsWith("/v1/admin/activations")) {
      if (session?.role !== "superAdmin") return send(res, 403, { error: "Se requiere la cuenta administradora de Kiosco+" });
      db.activationCodes ||= {};
      db.activations ||= {};
      if (req.method === "GET" && req.url === "/v1/admin/activation-codes") {
        const codes = Object.values(db.activationCodes).map(activationCodeView).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
        const activations = Object.values(db.activations).map(activationView).sort((left, right) => String(right.activatedAt || "").localeCompare(String(left.activatedAt || "")));
        return send(res, 200, { codes, activations });
      }
      if (req.method === "POST" && req.url === "/v1/admin/activation-codes") {
        const payload = await body(req);
        const expiresInDays = Math.min(90, Math.max(1, Number(payload.expiresInDays) || 7));
        const maxUses = Math.min(25, Math.max(1, Number(payload.maxUses) || 1));
        const rawCode = generateActivationCode();
        const id = crypto.randomUUID();
        const now = new Date();
        db.activationCodes[id] = {
          id,
          hash: activationCodeHash(rawCode),
          maskedCode: `${rawCode.slice(0, 11)}-••••-••••`,
          label: cleanCatalogText(payload.label || "", 80),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
          maxUses,
          uses: 0,
          revokedAt: null,
          createdBy: session.userId,
        };
        await writeDb(db);
        return send(res, 201, { code: rawCode, item: activationCodeView(db.activationCodes[id]) });
      }
      const codeRevokeMatch = req.url.match(/^\/v1\/admin\/activation-codes\/([^/?]+)\/revoke$/);
      if (req.method === "POST" && codeRevokeMatch) {
        const id = decodeURIComponent(codeRevokeMatch[1]);
        if (!db.activationCodes[id]) return send(res, 404, { error: "Clave inexistente" });
        db.activationCodes[id].revokedAt = db.activationCodes[id].revokedAt || new Date().toISOString();
        await writeDb(db);
        return send(res, 200, { ok: true, item: activationCodeView(db.activationCodes[id]) });
      }
      const activationRevokeMatch = req.url.match(/^\/v1\/admin\/activations\/([^/?]+)\/revoke$/);
      if (req.method === "POST" && activationRevokeMatch) {
        const deviceIdToRevoke = cleanActivationDeviceId(decodeURIComponent(activationRevokeMatch[1]));
        if (!db.activations[deviceIdToRevoke]) return send(res, 404, { error: "Dispositivo inexistente" });
        const revokedAt = db.activations[deviceIdToRevoke].revokedAt || new Date().toISOString();
        db.activations[deviceIdToRevoke].revokedAt = revokedAt;
        if (db.devices?.[deviceIdToRevoke]) db.devices[deviceIdToRevoke].revokedAt = revokedAt;
        for (const session of Object.values(db.sessions || {})) {
          if (session.deviceId === deviceIdToRevoke && !session.revokedAt) {
            session.revokedAt = revokedAt;
            session.revokedReason = "device_revoked";
          }
        }
        await writeDb(db);
        return send(res, 200, { ok: true, activation: activationView(db.activations[deviceIdToRevoke]) });
      }
      return send(res, 404, { error: "Ruta administrativa inexistente" });
    }

    if (req.url?.startsWith("/v1/admin/catalog")) {
      if (session?.role !== "superAdmin") return send(res, 403, { error: "Se requiere la cuenta administradora de Kiosco+" });
      if (req.method === "GET" && (req.url === "/v1/admin/catalog" || req.url.startsWith("/v1/admin/catalog?"))) {
        const url = new URL(req.url, "http://localhost");
        const query = String(url.searchParams.get("query") || "").trim().toLowerCase();
        const status = String(url.searchParams.get("status") || "all");
        const page = Math.max(1, Number(url.searchParams.get("page") || 1));
        const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || 30)));
        const all = Object.values(db.barcodeCatalog || {}).map(catalogAdminView);
        const filtered = all.filter((item) => {
          const haystack = `${item.codigo} ${item.product?.nombre || ""} ${item.product?.categoria || ""} ${item.product?.familia || ""}`.toLowerCase();
          return (!query || haystack.includes(query)) && (status === "all" || item.status === status);
        }).sort((left, right) => {
          const priority = { pending: 0, unresolved: 1 };
          const leftPriority = priority[left.status] ?? 2;
          const rightPriority = priority[right.status] ?? 2;
          if (leftPriority !== rightPriority) return leftPriority - rightPriority;
          return Number(right.lookupCount) - Number(left.lookupCount) || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
        });
        const stats = all.reduce((result, item) => ({ ...result, [item.status]: Number(result[item.status] || 0) + 1 }), { total: all.length });
        return send(res, 200, { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, stats });
      }
      const match = req.url.match(/^\/v1\/admin\/catalog\/([^/?]+)$/);
      if (req.method === "GET" && match) {
        const codigo = cleanBarcode(decodeURIComponent(match[1]));
        const entry = db.barcodeCatalog?.[codigo];
        return entry ? send(res, 200, catalogAdminView(entry)) : send(res, 404, { error: "Codigo inexistente" });
      }
      if (req.method === "PUT" && match) {
        const codigo = cleanBarcode(decodeURIComponent(match[1]));
        const payload = await body(req);
        if (codigo.length < 6) return send(res, 400, { error: "El codigo debe tener al menos 6 digitos" });
        const saved = saveManualCatalogProduct(db, codigo, payload.product || payload, session || {});
        if (!saved) return send(res, 400, { error: "El nombre del producto es obligatorio" });
        await writeDb(db);
        return send(res, 200, catalogAdminView(saved));
      }
      return send(res, 404, { error: "Ruta administrativa inexistente" });
    }

    if (req.method === "GET" && req.url?.startsWith("/v1/catalog/barcodes/")) {
      const codigo = cleanBarcode(decodeURIComponent(req.url.split("/").pop()?.split("?")[0] || ""));
      if (!codigo) return send(res, 400, { error: "Código inválido" });
      const entry = db.barcodeCatalog?.[codigo];
      const found = entry?.status === "archived" ? null : entry?.product || null;
      return send(res, 200, { product: found, found: !!found });
    }

    if (req.method === "POST" && req.url === "/v1/sync/push") {
      const payload = await body(req);
      const acceptedIds = [];
      const acceptedEntityVersions = [];
      const conflicts = [];
      const rejected = [];
      const accountReadyEmails = [];
      for (const incomingOperation of payload.operations || []) {
        let operation = incomingOperation;
        if (!operation.id || db.accepted[operation.id] || String(operation.tenantId) !== tenantId) {
          if (db.accepted[operation.id]) acceptedIds.push(operation.id);
          continue;
        }
        if (operation.type === "system_set") {
          if (session?.role !== "superAdmin") {
            rejected.push({ operationId: operation.id, reason: "system_admin_required" });
            continue;
          }
          db.cursor += 1;
          if (operation.key === "cuentas" && Array.isArray(operation.value)) {
            const currentById = new Map((db.system.cuentas || []).map((account) => [String(account?.id), account]));
            const tombstonedIds = new Set(Object.keys(db.system?.accountTombstones || {}));
            const incomingAccounts = operation.value
              .filter((account) => account && !account.superAdmin && !tombstonedIds.has(String(account.id)))
              .map((account) => {
                const current = currentById.get(String(account.id));
                const supplied = (key) => Object.prototype.hasOwnProperty.call(account, key);
                const next = {
                  ...account,
                  referralCode: current?.referralCode || account.referralCode,
                  referredByAccountId: supplied("referredByAccountId") ? account.referredByAccountId : (current?.referredByAccountId || null),
                  referredByCode: supplied("referredByCode") ? account.referredByCode : (current?.referredByCode || null),
                  referralInvalidatedAt: supplied("referralInvalidatedAt") ? account.referralInvalidatedAt : (current?.referralInvalidatedAt || null),
                  referralInvalidatedReason: supplied("referralInvalidatedReason") ? account.referralInvalidatedReason : (current?.referralInvalidatedReason || null),
                  manualDiscounts: supplied("manualDiscounts") ? account.manualDiscounts : (current?.manualDiscounts || []),
                  termsAcceptedAt: current?.termsAcceptedAt || account.termsAcceptedAt || null,
                  termsVersion: current?.termsVersion || account.termsVersion || null,
                };
                if (current && current.estado !== "aprobada" && next.estado === "aprobada" && isValidEmail(next.email)) {
                  accountReadyEmails.push({
                    to: normalizeEmail(next.email),
                    name: next.nombre,
                    businessName: next.nombreNegocio,
                    accountId: next.id,
                    eventId: operation.id,
                  });
                }
                return next;
              });
            const incomingIds = new Set(incomingAccounts.map((account) => String(account.id)));
            // Las listas globales sólo actualizan y agregan. Las bajas pasan
            // exclusivamente por DELETE /v1/admin/accounts/:id, que también
            // limpia accesos y deja una marca para impedir resurrecciones.
            // Esto neutraliza tanto arreglos vacíos como removedAccountIds
            // atrasados enviados por versiones anteriores de la aplicación.
            const preservedAccounts = (db.system.cuentas || []).filter((account) => {
              const id = String(account?.id);
              if (account?.superAdmin || incomingIds.has(id)) return false;
              return true;
            });
            operation = { ...operation, value: [...incomingAccounts, ...preservedAccounts] };
          }
          db.system[operation.key] = operation.value;
          db.accepted[operation.id] = db.cursor;
          acceptedIds.push(operation.id);
          db.changes.push({ ...operation, cursor: db.cursor, serverAt: new Date().toISOString() });
          continue;
        }
        if (["entity_upsert", "entity_delete"].includes(operation.type)) {
          db.tenants[tenantId] ||= {};
          db.tenants[tenantId].entities ||= {};
          db.tenants[tenantId].entities[operation.entity] ||= {};
          const current = db.tenants[tenantId].entities[operation.entity][String(operation.entityId)];
          if (operation.seedOnly && current) {
            db.accepted[operation.id] = db.cursor;
            acceptedIds.push(operation.id);
            acceptedEntityVersions.push({ operationId: operation.id, entity: operation.entity, entityId: operation.entityId, version: current.version || 0, value: current.value });
            continue;
          }
          const versionMismatch = Number(operation.baseVersion ?? 0) !== Number(current?.version || 0);
          const baseMismatch = !!(operation.baseValue && current?.value && JSON.stringify(operation.baseValue) !== JSON.stringify(current.value));
          if (current && (versionMismatch || baseMismatch)) {
            const merge = mergeConcurrentEntity(operation, current?.value);
            if (!merge.value) {
              conflicts.push({ operationId: operation.id, entity: operation.entity, entityId: operation.entityId, serverVersion: current?.version || 0, serverValue: current?.value || null, reason: merge.reason, conflictingFields: merge.conflictingFields });
              continue;
            }
            operation = { ...operation, value: merge.value, autoMerged: true };
          }
          db.cursor += 1;
          const version = Number(current?.version || 0) + 1;
          const stored = {
            value: operation.type === "entity_delete" ? current?.value : operation.value,
            version,
            deletedAt: operation.type === "entity_delete" ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
            deviceId,
          };
          db.tenants[tenantId].entities[operation.entity][String(operation.entityId)] = stored;
          if (operation.type === "entity_upsert" && operation.entity === "products") {
            learnBarcode(db, operation.value, `${tenantId}:${operation.entityId}:${version}`);
          }
          const change = { ...operation, value: stored.value, version, cursor: db.cursor, serverAt: stored.updatedAt };
          db.accepted[operation.id] = db.cursor;
          acceptedIds.push(operation.id);
          acceptedEntityVersions.push({ operationId: operation.id, entity: operation.entity, entityId: operation.entityId, version, value: stored.value, autoMerged: !!operation.autoMerged });
          db.changes.push(change);
          continue;
        }
        if (["section_set", "section_delete"].includes(operation.type)) {
          db.cursor += 1;
          db.tenants[tenantId] ||= {};
          db.tenants[tenantId].sections ||= {};
          if (operation.seedOnly && operation.section in db.tenants[tenantId].sections) {
            db.accepted[operation.id] = db.cursor;
            acceptedIds.push(operation.id);
            continue;
          }
          if (operation.type === "section_delete") delete db.tenants[tenantId].sections[operation.section];
          else db.tenants[tenantId].sections[operation.section] = operation.value;
          db.accepted[operation.id] = db.cursor;
          acceptedIds.push(operation.id);
          db.changes.push({ ...operation, cursor: db.cursor, serverAt: new Date().toISOString() });
          continue;
        }
        db.cursor += 1;
        db.accepted[operation.id] = db.cursor;
        acceptedIds.push(operation.id);
        db.tenants[tenantId] ||= {};
        if (operation.type === "delete") delete db.tenants[tenantId][operation.key];
        else db.tenants[tenantId][operation.key] = { value: operation.value, version: db.cursor, updatedAt: new Date().toISOString(), deviceId };
        db.changes.push({ ...operation, cursor: db.cursor, serverAt: new Date().toISOString() });
      }
      db.changes = compactChangeLog(db.changes);
      db.accepted = compactAcceptedOperations(db.accepted, db.cursor);
      ensureReferralMetadata(db);
      ensureAutomaticNotifications(db);
      for (const notification of duePushNotifications(db)) await sendPushNotification(db, notification);
      await writeDb(db);
      send(res, 200, { acceptedIds, acceptedEntityVersions, conflicts, rejected, cursor: db.cursor });
      for (const email of accountReadyEmails) {
        if (emailService.configured) void sendEmailBestEffort("de cuenta habilitada", () => emailService.sendAccountReady(email));
      }
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/v1/sync/pull")) {
      const since = Number(new URL(req.url, "http://localhost").searchParams.get("since") || 0);
      const oldestAvailableCursor = db.changes.reduce(
        (oldest, item) => Math.min(oldest, Number(item?.cursor || Number.POSITIVE_INFINITY)),
        Number.POSITIVE_INFINITY,
      );
      const resetRequired = since > 0
        && Number.isFinite(oldestAvailableCursor)
        && since < oldestAvailableCursor - 1;
      return send(res, 200, {
        cursor: db.cursor,
        resetRequired,
        operations: db.changes.filter((item) => (
          !resetRequired
          &&
          (item.tenantId === tenantId || (session?.role === "superAdmin" && item.type === "system_set"))
          && item.cursor > since
          && item.deviceId !== deviceId
        )),
      });
    }
    if (req.method === "GET" && req.url === "/v1/devices") {
      return send(res, 200, { devices: Object.entries(db.devices).filter(([, device]) => device.tenantId === tenantId).map(([id, device]) => ({ id, ...device })) });
    }
    if (req.method === "POST" && req.url?.startsWith("/v1/devices/revoke")) {
      const id = String((await body(req)).deviceId || "");
      if (db.devices[id]?.tenantId !== tenantId) return send(res, 404, { error: "Dispositivo inexistente" });
      db.devices[id].revokedAt = new Date().toISOString();
      for (const candidate of Object.values(db.sessions)) {
        if (candidate.deviceId === id && candidate.businessId === tenantId) candidate.revokedAt = new Date().toISOString();
      }
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "Ruta inexistente" });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: localMode ? "Error interno del servidor local" : "La nube tuvo un problema temporal al guardar. Intentá nuevamente." });
  }
};

// The API still applies each operation against a coherent snapshot. Keeping
// this queue also protects the local JSON fallback and prevents two requests
// in the same Render instance from calculating over stale state.
let databaseRequestMutation = Promise.resolve();
const DATABASE_REQUEST_TIMEOUT_MS = 50_000;
const bypassDatabaseQueue = (req) => req.method === "OPTIONS"
  || req.url === "/v1/health"
  || req.url === "/v1/ready"
  || req.url === "/v1/ready/sections"
  || req.url?.startsWith("/v1/releases/latest")
  || req.url === "/v1/catalog/providers";

const runQueuedRequest = async (req, res) => {
  let timeoutId;
  let timedOut = false;
  try {
    await Promise.race([
      handleRequest(req, res),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("database_request_timeout")), DATABASE_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    timedOut = error?.message === "database_request_timeout";
    console.error("La petición a la base excedió el tiempo permitido", {
      method: req.method,
      url: req.url,
      error: error?.message || String(error),
    });
    if (!res.headersSent && !res.destroyed) {
      send(res, 503, { error: "La nube está tardando demasiado. Intentá nuevamente en unos segundos." });
    }
  } finally {
    clearTimeout(timeoutId);
    // Promise.race cannot cancel an already running PostgreSQL mutation. If
    // that operation did not settle, continuing could leave zombie writes and
    // an ever-growing queue. Render restarts failed services automatically;
    // exiting is the safest way to discard the poisoned pool and reconnect.
    if (timedOut && postgresStore && !localMode) {
      setTimeout(() => process.exit(1), 100).unref();
    }
  }
};

const server = http.createServer((req, res) => {
  const run = () => runQueuedRequest(req, res);
  if (bypassDatabaseQueue(req)) {
    run();
    return;
  }
  const pending = databaseRequestMutation.then(run, run);
  databaseRequestMutation = pending.catch(() => {});
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Kiosco Cloud Local ya estaba activo en http://127.0.0.1:${port}`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});
const startServer = async () => {
  if (databaseUrl) {
    postgresStore = await createPostgresStore(databaseUrl, {
      backupRetentionDays: process.env.KIOSCO_BACKUP_RETENTION_DAYS,
    });
    const seed = await readJsonDb();
    await postgresStore.initialize(seed);
  }
  const notificationDb = await readDb();
  ensureAutomaticNotifications(notificationDb);
  const dueNotifications = duePushNotifications(notificationDb);
  for (const notification of dueNotifications) await sendPushNotification(notificationDb, notification);
  // La escritura inicial también deja persistidos los códigos de referido que
  // se asignan a cuentas creadas con versiones anteriores.
  await writeDb(notificationDb);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Kiosco Cloud activo en el puerto ${port} · persistencia: ${postgresStore ? "PostgreSQL" : dataDirectory}`);
  });
  const reminderTimer = setInterval(() => {
    const runSweep = async () => {
      const db = await readDb();
      const automaticNotifications = ensureAutomaticNotifications(db);
      const dueNotifications = duePushNotifications(db);
      for (const notification of dueNotifications) await sendPushNotification(db, notification);
      if (automaticNotifications.length || dueNotifications.length) await writeDb(db);
    };
    const pending = databaseRequestMutation.then(runSweep, runSweep);
    databaseRequestMutation = pending.catch((error) => console.error("No se pudieron revisar los avisos automáticos", error));
  }, 30 * 60 * 1000);
  reminderTimer.unref();
};

const shutdown = async () => {
  try { await postgresStore?.close(); } catch { /* El proceso ya está terminando. */ }
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

startServer().catch((error) => {
  console.error("No se pudo iniciar la persistencia cloud", error);
  process.exit(1);
});
