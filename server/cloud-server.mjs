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
import { passwordPolicyError } from "../src/security/passwordPolicy.js";
import {
  buildMercadoPagoAuthorizationUrl,
  buildMercadoPagoPosPayload,
  buildMercadoPagoStorePayload,
  buildPointOrderPayload,
  buildQrOrderPayload,
  createMercadoPagoClient,
  createPkcePair,
  decryptPaymentSecret,
  encryptPaymentSecret,
  mercadoPagoAvailability,
  mercadoPagoConfig,
  mercadoPagoConfigFor,
  mercadoPagoProviderMessage,
  mercadoPagoQrData,
  isMercadoPagoMissingPosError,
  isMercadoPagoSandboxSeller,
  normalizedPaymentStatus,
  verifyMercadoPagoWebhookSignature,
} from "./mercado-pago.mjs";

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
const configuredAccessTokenHours = Number(process.env.KIOSCO_ACCESS_TOKEN_HOURS || (localMode ? 24 : 2));
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
const mercadoPago = mercadoPagoConfig(process.env);
const mercadoPagoClients = {
  qr: createMercadoPagoClient({ config: mercadoPagoConfigFor(mercadoPago, "qr") }),
  point: createMercadoPagoClient({ config: mercadoPagoConfigFor(mercadoPago, "point") }),
};
const mercadoPagoClientFor = (solution) => mercadoPagoClients[solution === "point" ? "point" : "qr"];
const vapidPublicKey = String(process.env.KIOSCO_VAPID_PUBLIC_KEY || "").trim();
const vapidPrivateKey = String(process.env.KIOSCO_VAPID_PRIVATE_KEY || "").trim();
const vapidSubject = String(process.env.KIOSCO_VAPID_SUBJECT || "mailto:soporte@kioscomas.ar").trim();
const pushDeliveryConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushDeliveryConfigured) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const accessTokenExpiresAt = () => new Date(Date.now() + accessTokenTtlMs).toISOString();
const refreshTokenExpiresAt = () => new Date(Date.now() + refreshTokenTtlMs).toISOString();
const emptyDb = () => ({ schemaVersion: 9, cursor: 0, accepted: {}, system: {}, tenants: {}, changes: [], devices: {}, users: {}, sessions: {}, barcodeCatalog: {}, activationCodes: {}, activations: {}, passwordResetTokens: {}, passwordResetRateLimits: {}, platformNotifications: {}, notificationReads: {}, pushSubscriptions: {}, reportedIssues: {}, businessDisplays: {}, displayPairingCodes: {}, displayTokens: {}, paymentIntegrations: {}, paymentOauthStates: {}, paymentAttempts: {}, paymentPresentations: {}, securityEvents: {} });
const compactChangeLog = (changes = []) => {
  // "set" y "system_set" reemplazan por completo el valor de una clave (ver
  // isRedundantBootstrapOperation en syncEngine.js: un cliente que se pone al
  // día sólo necesita la versión vigente). Sin esto, cada guardado de
  // preferencias de apariencia (userPreferences puede pesar cientos de KB por
  // incluir la imagen del negocio) queda para siempre en el log de cambios y
  // se vuelve a cargar entero en memoria en cada pedido al servidor.
  const keptDedupeKeys = new Set();
  return [...changes].reverse().filter((change) => {
    const dedupeKey = change?.type === "set" ? `set:${change.tenantId}:${change.key}`
      : (change?.type === "system_set" && change?.key === "cuentas") ? "system_set:cuentas"
      : null;
    if (!dedupeKey) return true;
    if (keptDedupeKeys.has(dedupeKey)) return false;
    keptDedupeKeys.add(dedupeKey);
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
    const values = Object.values(records || {})
      .filter((record) => !record?.deletedAt && record?.value)
      .map((record) => ({ ...record.value, _syncVersion: Number(record.version || 0) }));
    const cajaKey = entity === "cajaMovimientos" ? "movimientos" : entity === "cajaHistorial" ? "historial" : null;
    if (entity === "cajaEstado") {
      const state = values.find((value) => String(value.id) === "actual");
      if (state) dataset.caja = { ...(dataset.caja || {}), saldo: Number(state.saldo || 0), _syncSaldoVersion: Number(state._syncVersion || 0) };
      continue;
    }
    if (cajaKey) {
      const merged = new Map((dataset.caja?.[cajaKey] || []).map((item) => [String(item.id), item]));
      for (const value of values) merged.set(String(value.id), value);
      dataset.caja = { ...(dataset.caja || {}), [cajaKey]: [...merged.values()] };
    } else {
      dataset[entity] = values;
    }
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
  return ensureReferralMetadata(applyConfiguredSuperAdmin(hydrateBarcodeCatalog({
    ...emptyDb(), ...saved, system: saved.system || {}, barcodeCatalog: saved.barcodeCatalog || {},
    activationCodes: saved.activationCodes || {}, activations: saved.activations || {},
    // Compactar acá (no sólo al recibir un cambio nuevo) libera de inmediato la
    // memoria que ya está acumulada por versiones viejas, sin esperar a que
    // alguien vuelva a tocar esa clave para que se guarde la limpieza.
    changes: compactChangeLog(saved.changes || []),
  })));
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
    const snapshot = materializeTenantSnapshot(tenant);
    await writeJson(path.join(dataDirectory, "negocios", safeName(tenantId), "datos.json"), {
      tenantId,
      updatedAt: new Date().toISOString(),
      ...snapshot.dataset,
    });
  }
  const day = new Date().toISOString().slice(0, 10);
  await writeJson(path.join(dataDirectory, "backups", day, "database.json"), db);
};
const writeDb = async (db) => {
  db.schemaVersion = 9;
  ensureReferralMetadata(db);
  db.sessions = compactSessions(db.sessions);
  db.passwordResetTokens = compactPasswordResetTokens(db.passwordResetTokens);
  db.passwordResetRateLimits = compactPasswordResetRateLimits(db.passwordResetRateLimits);
  const displayRetentionLimit = Date.now() - 30 * 86400000;
  db.displayPairingCodes = Object.fromEntries(Object.entries(db.displayPairingCodes || {}).filter(([, entry]) => !entry?.usedAt ? Date.parse(entry?.expiresAt || "") > Date.now() - 86400000 : Date.parse(entry.usedAt) > displayRetentionLimit));
  db.displayTokens = Object.fromEntries(Object.entries(db.displayTokens || {}).filter(([, entry]) => !entry?.revokedAt || Date.parse(entry.revokedAt) > displayRetentionLimit));
  const paymentPresentationRetention = Date.now() - 86400000;
  db.paymentPresentations = Object.fromEntries(Object.entries(db.paymentPresentations || {}).filter(([, entry]) => Date.parse(entry?.expiresAt || entry?.createdAt || "") > paymentPresentationRetention));
  compactNotificationData(db);
  if (postgresStore) {
    await postgresStore.write(db);
    return;
  }
  await writeJson(databasePath, db);
  await writeMirrors(db);
};
const listRecoveryBackups = async () => {
  if (postgresStore?.listBackups) return postgresStore.listBackups();
  try {
    const entries = await fs.readdir(path.join(dataDirectory, "backups"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => ({ day: entry.name, changedRecords: null, createdAt: null, moment: "latest_local_copy" }))
      .sort((left, right) => right.day.localeCompare(left.day));
  } catch { return []; }
};
const readRecoveryBackup = async (day) => {
  if (postgresStore?.readBackup) return postgresStore.readBackup(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return null;
  try {
    const saved = JSON.parse(await fs.readFile(path.join(dataDirectory, "backups", String(day), "database.json"), "utf8"));
    return { ...emptyDb(), ...saved };
  } catch { return null; }
};
const createManualRecoveryPoint = async (db, tenantId) => {
  if (postgresStore?.createRecoveryPoint) return postgresStore.createRecoveryPoint(tenantId, "before_restore");
  const id = crypto.randomUUID();
  await writeJson(path.join(dataDirectory, "recovery-points", safeName(tenantId), `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}.json`), db);
  return { id, tenantId: String(tenantId), reason: "before_restore" };
};
const tenantRecoveryCounts = (tenant = {}) => {
  const entities = Object.fromEntries(Object.entries(tenant?.entities || {}).map(([name, records]) => [name, Object.values(records || {}).filter((record) => !record?.deletedAt).length]));
  return {
    entities,
    totalRecords: Object.values(entities).reduce((total, count) => total + Number(count || 0), 0),
    sections: Object.keys(tenant?.sections || {}).length,
  };
};
const recoveryComparison = (currentTenant = {}, backupTenant = {}) => {
  const current = tenantRecoveryCounts(currentTenant);
  const backup = tenantRecoveryCounts(backupTenant);
  const entityNames = new Set([...Object.keys(current.entities), ...Object.keys(backup.entities)]);
  return {
    current,
    backup,
    differences: [...entityNames].map((entity) => ({ entity, current: Number(current.entities[entity] || 0), backup: Number(backup.entities[entity] || 0) }))
      .filter((entry) => entry.current !== entry.backup),
  };
};
const withoutCredentialFields = (subject = {}) => {
  const { password: _password, passwordHash: _passwordHash, passwordSalt: _passwordSalt, salt: _salt, adminSecretSalt: _adminSecretSalt, ...safe } = subject || {};
  return safe;
};
const recoveryExport = (db, tenantId) => {
  const account = tenantAccount(db, tenantId);
  const snapshot = materializeTenantSnapshot(db.tenants?.[tenantId] || {});
  return {
    format: "kiosco-plus-business-export",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    business: account ? { ...withoutCredentialFields(account), empleados: (account.empleados || []).map(withoutCredentialFields) } : null,
    data: snapshot.dataset,
    additionalValues: snapshot.values,
  };
};
const configuredAllowedOrigins = String(process.env.KIOSCO_ALLOWED_ORIGINS || "https://app.kioscomas.ar,https://kioscomas.ar,https://www.kioscomas.ar")
  .split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
const isLocalWebOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
const allowedCorsOrigin = (req) => {
  const origin = String(req?.headers?.origin || "").trim().replace(/\/$/, "");
  if (!origin) return "";
  // La app de escritorio usa un origen opaco (null), Capacitor usa localhost y
  // el entorno de desarrollo también parte de localhost. La autenticación real
  // sigue dependiendo del token, negocio y dispositivo, no de CORS.
  if (configuredAllowedOrigins.includes(origin) || isLocalWebOrigin(origin) || origin === "capacitor://localhost" || origin === "null") return origin;
  return "";
};
const send = (res, status, value) => {
  const requestOrigin = String(res.kioscoRequest?.headers?.origin || "").trim();
  const corsOrigin = allowedCorsOrigin(res.kioscoRequest);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-headers": "content-type,x-device-id,x-tenant-id,authorization,x-idempotency-key,x-request-id,x-signature",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    vary: "Origin",
    ...(corsOrigin ? { "access-control-allow-origin": corsOrigin } : {}),
  };
  if (requestOrigin && !corsOrigin) return res.writeHead(403, headers).end(JSON.stringify({ error: "Origen web no autorizado" }));
  res.writeHead(status, headers);
  res.end(status === 204 ? "" : JSON.stringify(value));
};
const body = async (req) => {
  const chunks = [];
  const maximumBytes = req.url?.startsWith("/v1/sync") ? 8 * 1024 * 1024 : 1280 * 1024;
  let receivedBytes = 0;
  for await (const chunk of req) {
    receivedBytes += chunk.length;
    if (receivedBytes > maximumBytes) {
      const error = new Error("El contenido enviado supera el tamaño permitido");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch {
    const error = new Error("El contenido enviado no es JSON válido");
    error.statusCode = 400;
    throw error;
  }
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
const sendPaymentPresentationPush = async (db, presentation) => {
  if (!pushDeliveryConfigured || !presentation) return 0;
  const payload = JSON.stringify({
    id: `payment-presentation-${presentation.id}`,
    title: "Cobro listo para mostrar",
    body: `Abrí Kiosco+ para mostrar el QR de $${Number(presentation.amount || 0).toLocaleString("es-AR")}.`,
    level: "importante",
    url: "/?view=ventas",
  });
  let sent = 0;
  await Promise.all(Object.values(db.pushSubscriptions || {}).map(async (entry) => {
    // Es una acción solicitada en ese momento por la persona que está cobrando,
    // no un aviso automático: no se demora por horarios silenciosos.
    if (!entry || entry.revokedAt || String(entry.businessId || "") !== String(presentation.tenantId || "") || String(entry.deviceId || "") === String(presentation.sourceDeviceId || "")) return;
    try {
      await webpush.sendNotification(entry.subscription, payload, { TTL: 15 * 60 });
      entry.lastSuccessAt = new Date().toISOString();
      sent += 1;
    } catch (error) {
      entry.lastErrorAt = new Date().toISOString();
      entry.lastError = String(error?.message || error).slice(0, 180);
      if ([404, 410].includes(Number(error?.statusCode))) entry.revokedAt = entry.lastErrorAt;
    }
  }));
  presentation.pushDeliveryCount = sent;
  presentation.pushDispatchedAt = new Date().toISOString();
  return sent;
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
const argentinaScheduleIso = (dateKey, timeValue) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) || !/^\d{2}:\d{2}$/.test(String(timeValue || ""))) return null;
  const timestamp = Date.parse(`${dateKey}T${timeValue}:00-03:00`);
  if (!Number.isFinite(timestamp) || argentinaDateKey(timestamp) !== dateKey) return null;
  return new Date(timestamp).toISOString();
};
const tenantEntityValues = (db, tenantId, entity) => Object.values(db.tenants?.[String(tenantId)]?.entities?.[entity] || {}).map((record) => record?.value || record);
const customerOrderNotificationValues = (account, order, publishAt) => {
  const items = Array.isArray(order?.items) ? order.items.filter(Boolean) : [];
  const client = cleanCatalogText(order?.cliente || "Cliente sin identificar", 100);
  const itemSummary = items.slice(0, 4).map((item) => `${Math.max(1, Number(item?.cantidad) || 1)} × ${cleanCatalogText(item?.nombre || "Producto", 80)}`).join(", ");
  const remaining = Math.max(0, items.length - 4);
  return {
    title: `Pedido de ${client} para entregar`,
    message: `${order.fechaRetiro} · ${order.horaRetiro} h${itemSummary ? ` · ${itemSummary}` : ""}${remaining ? ` y ${remaining} producto${remaining === 1 ? "" : "s"} más` : ""}.`,
    level: "importante",
    category: "orders",
    audience: { type: "business", businessIds: [account.id] },
    action: { view: "ventas" },
    publishAt,
  };
};
const reconcileAutomaticNotificationSet = (db, prefix, definitions, changed) => {
  const activeKeys = new Set(definitions.map((entry) => entry.sourceKey));
  for (const notification of Object.values(db.platformNotifications || {})) {
    if (!String(notification?.sourceKey || "").startsWith(prefix) || activeKeys.has(notification.sourceKey) || notification.archivedAt) continue;
    notification.archivedAt = new Date().toISOString();
    changed.push(notification);
  }
  for (const definition of definitions) {
    const existing = Object.values(db.platformNotifications || {}).find((notification) => notification?.sourceKey === definition.sourceKey);
    if (existing) {
      const { sourceKey: _sourceKey, ...values } = definition;
      Object.assign(existing, values);
      if (existing.archivedAt) {
        existing.archivedAt = null;
        existing.pushDispatchedAt = null;
        existing.pushDeliveryCount = 0;
        db.notificationReads = Object.fromEntries(Object.entries(db.notificationReads || {}).filter(([, read]) => String(read?.notificationId || "") !== String(existing.id)));
        changed.push(existing);
      }
      continue;
    }
    const result = createPlatformNotification(db, definition);
    if (result.created) changed.push(result.notification);
  }
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
    const supplierNotificationPrefix = `order-delivery:${account.id}:`;
    const supplierNotifications = tenantEntityValues(db, account.id, "pedidos").flatMap((order) => {
      if (!order || ["recibido", "cancelado"].includes(order.estado) || !order.fechaEntregaEsperada) return [];
      const deliveryKey = argentinaDateKey(order.fechaEntregaEsperada);
      if (!deliveryKey) return [];
      const days = argentinaDayNumber(deliveryKey) - argentinaDayNumber(todayKey);
      if (![1, 0].includes(days) && days >= 0) return [];
      const bucket = days < 0 ? "demorado" : days === 0 ? "hoy" : "manana";
      const provider = cleanCatalogText(order.proveedorNombre || "tu proveedor", 100);
      return [{
        sourceKey: `${supplierNotificationPrefix}${order.id}:${deliveryKey}:${bucket}`,
        title: days < 0 ? "Entrega demorada" : days === 0 ? "Hoy llega un pedido" : "Mañana llega un pedido",
        message: days < 0
          ? `El pedido de ${provider} estaba previsto para el ${deliveryKey} y todavía figura pendiente.`
          : `${provider}${order.horaEntregaEsperada ? ` · ${order.horaEntregaEsperada} h` : ""}.`,
        level: days < 0 ? "importante" : "info",
        category: "orders",
        audience: { type: "business", businessIds: [account.id] },
        action: { view: "compras" },
      }];
    });
    reconcileAutomaticNotificationSet(db, supplierNotificationPrefix, supplierNotifications, created);

    const customerOrderPrefix = `customer-order:${account.id}:`;
    const activeCustomerOrders = tenantEntityValues(db, account.id, "reservas").flatMap((order) => {
      if (!order || ["entregado", "cancelado"].includes(order.estado)) return [];
      const publishAt = argentinaScheduleIso(order.fechaRetiro, order.horaRetiro);
      if (!publishAt) return [];
      const sourceKey = `${customerOrderPrefix}${order.id}:${order.fechaRetiro}:${order.horaRetiro}`;
      return [{ sourceKey, ...customerOrderNotificationValues(account, order, publishAt) }];
    });
    reconcileAutomaticNotificationSet(db, customerOrderPrefix, activeCustomerOrders, created);

    const stockPrefix = `product-stock:${account.id}:`;
    const vitrinePrefix = `product-vitrine:${account.id}:`;
    const expirationPrefix = `product-expiration:${account.id}:`;
    const stockNotifications = [];
    const vitrineNotifications = [];
    const expirationNotifications = [];
    for (const product of tenantEntityValues(db, account.id, "products")) {
      if (!product || product.id == null) continue;
      const name = cleanCatalogText(product.nombre || "Producto sin nombre", 100);
      const deposit = Number(product.deposito);
      const minimum = Number(product.minimo);
      if (product.deposito != null && product.minimo != null && Number.isFinite(deposit) && Number.isFinite(minimum) && deposit <= minimum) {
        stockNotifications.push({
          sourceKey: `${stockPrefix}${product.id}`,
          title: "Stock bajo",
          message: `${name} · quedan ${deposit} y el mínimo configurado es ${minimum}.`,
          level: deposit <= 0 ? "urgente" : "importante",
          category: "stock",
          audience: { type: "business", businessIds: [account.id] },
          action: { view: "stock" },
        });
      }
      const vitrine = Number(product.vitrina);
      const vitrineMinimum = Number(product.alertaVitrina);
      if (product.vitrina != null && product.alertaVitrina != null && Number.isFinite(vitrine) && Number.isFinite(vitrineMinimum) && vitrine <= vitrineMinimum) {
        vitrineNotifications.push({
          sourceKey: `${vitrinePrefix}${product.id}`,
          title: "Reponer vitrina",
          message: `${name} · quedan ${vitrine} en exhibición.`,
          level: "importante",
          category: "stock",
          audience: { type: "business", businessIds: [account.id] },
          action: { view: "vitrina" },
        });
      }
      const expirationKey = argentinaDateKey(product.vencimiento);
      if (!expirationKey) continue;
      const days = argentinaDayNumber(expirationKey) - argentinaDayNumber(todayKey);
      const bucket = days < 0 ? "vencido" : days === 0 ? "hoy" : days === 1 ? "manana" : days <= 7 ? "esta-semana" : days <= 30 ? "proximo" : null;
      if (!bucket) continue;
      expirationNotifications.push({
        sourceKey: `${expirationPrefix}${product.id}:${expirationKey}:${bucket}`,
        title: days < 0 ? "Producto vencido" : days === 0 ? "Producto que vence hoy" : "Producto próximo a vencer",
        message: `${name} · ${days < 0 ? `venció el ${expirationKey}` : days === 0 ? "vence hoy" : `vence en ${days} día${days === 1 ? "" : "s"}`}.`,
        level: days <= 0 ? "urgente" : "importante",
        category: "expirations",
        audience: { type: "business", businessIds: [account.id] },
        action: { view: "vencimientos" },
      });
    }
    reconcileAutomaticNotificationSet(db, stockPrefix, stockNotifications, created);
    reconcileAutomaticNotificationSet(db, vitrinePrefix, vitrineNotifications, created);
    reconcileAutomaticNotificationSet(db, expirationPrefix, expirationNotifications, created);
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
  const role = (account.roles || []).find((entry) => entry?.nombre === employee?.rol);
  const canManageTeam = (role?.permisos || []).includes("gestionar_personal");
  if (!canManageTeam) return { ...safeAccount, empleados: employee ? [employee] : [] };
  return {
    ...safeAccount,
    empleados: (account.empleados || []).map((entry) => {
      if (String(entry?.id) === String(employee?.id)) return entry;
      const { passwordHash: _hash, passwordSalt: _salt, password: _password, ...safeEmployee } = entry || {};
      return safeEmployee;
    }),
  };
};
const TEAM_PERMISSIONS = new Set([
  "notificaciones", "stock", "vitrina", "ventas", "compras", "proveedores", "vencimientos", "gastos", "clientes", "reportes", "gestion",
  "administracion", "editar_precios", "eliminar_productos", "eliminar_tickets", "aplicar_descuentos", "corregir_caja", "gestionar_personal",
]);
const credentialFingerprint = (subject = {}) => `${String(subject.passwordVersion || "")}:${String(subject.passwordSalt || "")}:${String(subject.passwordHash || "")}`;
const cloudUsersForBusiness = (db, businessId) => Object.entries(db.users || {}).filter(([, user]) => String(user?.businessId) === String(businessId));
const revokeUserSessions = (db, userId, reason) => {
  const now = new Date().toISOString();
  for (const candidate of Object.values(db.sessions || {})) {
    if (String(candidate?.userId) === String(userId) && !candidate.revokedAt) {
      candidate.revokedAt = now;
      candidate.revokedReason = reason;
      candidate.refreshGraceUntil = null;
    }
  }
};
const removeCloudCredential = (db, businessId, username, reason) => {
  const normalized = String(username || "").trim().toLowerCase();
  for (const [key, user] of cloudUsersForBusiness(db, businessId)) {
    if (String(user?.username || "").trim().toLowerCase() !== normalized) continue;
    revokeUserSessions(db, user.id, reason);
    delete db.users[key];
  }
};
const revokeChangedAccountSubjects = (db, previousAccount, nextAccount, reasonPrefix = "account_updated") => {
  if (!previousAccount) return;
  const businessId = String(previousAccount.id);
  if (String(previousAccount.usuario || "").trim().toLowerCase() !== String(nextAccount?.usuario || "").trim().toLowerCase()
    || credentialFingerprint(previousAccount) !== credentialFingerprint(nextAccount || {})) {
    removeCloudCredential(db, businessId, previousAccount.usuario, `${reasonPrefix}_owner_credentials`);
  }
  const nextEmployees = new Map((nextAccount?.empleados || []).map((employee) => [String(employee.id), employee]));
  for (const employee of previousAccount.empleados || []) {
    const next = nextEmployees.get(String(employee.id));
    const accessChanged = !next
      || String(employee.usuario || "").trim().toLowerCase() !== String(next.usuario || "").trim().toLowerCase()
      || credentialFingerprint(employee) !== credentialFingerprint(next)
      || String(employee.rol || "") !== String(next.rol || "")
      || String(employee.estado || "") !== String(next.estado || "");
    if (accessChanged) removeCloudCredential(db, businessId, employee.usuario, `${reasonPrefix}_employee_access`);
  }
};
const sanitizeBusinessTeam = (db, account, payload = {}) => {
  const incomingRoles = Array.isArray(payload.roles) ? payload.roles : [];
  const incomingEmployees = Array.isArray(payload.employees) ? payload.employees : [];
  if (incomingRoles.length > 30 || incomingEmployees.length > 100) throw Object.assign(new Error("El equipo supera el máximo permitido"), { status: 400 });
  const roleNames = new Set();
  const roles = incomingRoles.map((role) => {
    const nombre = cleanCatalogText(role?.nombre, 60);
    if (!nombre || roleNames.has(nombre.toLowerCase())) throw Object.assign(new Error("Cada rol necesita un nombre único"), { status: 400 });
    roleNames.add(nombre.toLowerCase());
    return { nombre, permisos: [...new Set((Array.isArray(role?.permisos) ? role.permisos : []).filter((permission) => TEAM_PERMISSIONS.has(permission)))] };
  });
  const previousById = new Map((account.empleados || []).map((employee) => [String(employee.id), employee]));
  const usedUsers = new Set();
  const usedEmails = new Set();
  const employees = incomingEmployees.map((incoming) => {
    const id = cleanCatalogText(incoming?.id, 100);
    const previous = previousById.get(String(id));
    const nombre = cleanCatalogText(incoming?.nombre, 100);
    const usuario = cleanCatalogText(incoming?.usuario, 80);
    const email = normalizeEmail(incoming?.email);
    const rol = cleanCatalogText(incoming?.rol, 60);
    const userKey = usuario.toLowerCase();
    if (!id || !nombre || !usuario || (!previous && !isValidEmail(email)) || (email && !isValidEmail(email)) || !roleNames.has(rol.toLowerCase())) throw Object.assign(new Error("Revisá nombre, usuario, correo y rol de cada empleado"), { status: 400 });
    if (usedUsers.has(userKey) || (email && usedEmails.has(email))) throw Object.assign(new Error("No puede haber empleados con el mismo usuario o correo"), { status: 409 });
    usedUsers.add(userKey); if (email) usedEmails.add(email);
    const passwordHash = String(incoming?.passwordHash || previous?.passwordHash || "");
    const passwordSalt = String(incoming?.passwordSalt || previous?.passwordSalt || "");
    const passwordVersion = Number(incoming?.passwordVersion || previous?.passwordVersion || 1);
    if (!passwordHash || !passwordSalt) throw Object.assign(new Error(`Falta preparar la contraseña de @${usuario}`), { status: 400 });
    return { ...previous, id, nombre, usuario, email, rol, estado: incoming?.estado === "bloqueado" ? "bloqueado" : "activo", passwordHash, passwordSalt, passwordVersion };
  });
  const reservedUsers = new Set();
  const reservedEmails = new Set();
  for (const candidate of db.system?.cuentas || []) {
    if (String(candidate?.id) === String(account.id)) {
      reservedUsers.add(String(candidate.usuario || "").trim().toLowerCase());
      if (normalizeEmail(candidate.email)) reservedEmails.add(normalizeEmail(candidate.email));
      continue;
    }
    reservedUsers.add(String(candidate?.usuario || "").trim().toLowerCase());
    if (normalizeEmail(candidate?.email)) reservedEmails.add(normalizeEmail(candidate?.email));
    for (const employee of candidate?.empleados || []) {
      reservedUsers.add(String(employee?.usuario || "").trim().toLowerCase());
      if (normalizeEmail(employee?.email)) reservedEmails.add(normalizeEmail(employee?.email));
    }
  }
  if (employees.some((employee) => reservedUsers.has(employee.usuario.toLowerCase()) || (employee.email && reservedEmails.has(employee.email)))) {
    throw Object.assign(new Error("Un usuario o correo ya pertenece a otra cuenta"), { status: 409 });
  }
  return { roles, employees, businessMode: payload.businessMode === "solo" ? "solo" : "equipo" };
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
const publicDisplayEntryUrl = () => String(process.env.KIOSCO_PUBLIC_DISPLAY_URL || "https://kioscomas.ar/pantalla").replace(/\/+$/, "");
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
  return { code, expiresAt: db.displayPairingCodes[displaySecretHash(code)].expiresAt, pairingUrl: `${publicDisplayEntryUrl()}?pair=${encodeURIComponent(code)}` };
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
const accessTokenHash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const tenantAccount = (db, tenantId) => (db.system?.cuentas || []).find((account) => String(account.id) === String(tenantId));
const cloudUserForSession = (db, session) => Object.values(db.users || {}).find(
  (user) => String(user?.id) === String(session?.userId),
);
const sessionSubjectIsActive = (db, session) => {
  if (!session) return false;
  const user = cloudUserForSession(db, session);
  if (!user || user.status !== "active") return false;
  if (String(user.businessId) !== String(session.businessId) || user.role !== session.role) return false;
  if (session.role === "superAdmin") return true;
  const account = tenantAccount(db, session.businessId);
  // Las rutas de bootstrap/register-local crean usuarios aislados sólo para el
  // servidor local y las pruebas. En producción todo usuario comercial debe
  // seguir teniendo una cuenta vigente en el padrón central.
  if (!account) return localMode;
  if (account.estado === "bloqueada") return false;
  if (session.role !== "employee") return true;
  return (account.empleados || []).some((employee) => (
    (String(employee?.id) === String(user.id)
      || String(employee?.usuario || "").trim().toLowerCase() === String(user.username || "").trim().toLowerCase())
    && employee?.estado !== "bloqueado"
  ));
};
const activeSession = (db, req) => {
  const rawToken = bearer(req);
  const session = db.sessions[accessTokenHash(rawToken)] || db.sessions[rawToken];
  return session && !session.revokedAt && new Date(session.expiresAt) > new Date() && sessionSubjectIsActive(db, session)
    ? session
    : null;
};
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
const sessionCanTakePayments = (db, session, tenantId) => {
  if (!session) return false;
  if (["owner", "superAdmin"].includes(session.role)) return true;
  const account = tenantAccount(db, tenantId);
  const user = cloudUserForSession(db, session);
  const employee = (account?.empleados || []).find((item) => (
    String(item?.id) === String(user?.id)
    || String(item?.usuario || "").trim().toLowerCase() === String(user?.username || "").trim().toLowerCase()
  ));
  const role = (account?.roles || []).find((item) => item?.nombre === employee?.rol);
  return employee?.estado !== "bloqueado" && (role?.permisos || []).includes("ventas");
};
const SYNC_ENTITY_PERMISSIONS = {
  products: ["stock", "vitrina"], tickets: ["ventas"], clientes: ["clientes"],
  comprasItems: ["compras"], proveedores: ["proveedores"], perdidas: ["vencimientos", "stock"],
  sugerencias: ["stock"], pedidos: ["compras"], gastos: ["gastos"], ventasSuspendidas: ["ventas"],
  inventarios: ["stock"], tareas: ["gestion"], metas: ["gestion"], promociones: ["gestion"],
  reservas: ["clientes"], presupuestos: ["gestion"], arqueos: ["ventas"], comprobantes: ["gestion", "ventas"],
  listaCompras: ["compras"], retornables: ["clientes"], autoconsumos: ["gestion"], turnos: ["gestion"],
  recordatoriosProveedor: ["proveedores"], movimientosStock: ["stock", "ventas"], historialLimpiezas: ["stock"],
  labelTemplates: ["stock"], tutorialProgress: [], cajaMovimientos: ["ventas"], cajaHistorial: ["ventas"], cajaEstado: ["ventas"],
};
const SYNC_SECTION_PERMISSIONS = {
  caja: ["ventas"], cajaAbierta: ["ventas"], cart: ["ventas"], cambioCaja: ["ventas"],
  configuracionFiscal: ["administracion"],
};
const employeeSecurityContext = (db, session, tenantId) => {
  if (!session || session.role !== "employee") return null;
  const account = tenantAccount(db, tenantId);
  const user = cloudUserForSession(db, session);
  const employee = (account?.empleados || []).find((item) => (
    String(item?.id) === String(user?.id)
    || String(item?.usuario || "").trim().toLowerCase() === String(user?.username || "").trim().toLowerCase()
  ));
  const role = (account?.roles || []).find((item) => item?.nombre === employee?.rol);
  return { account, user, employee, role, permissions: new Set(role?.permisos || []) };
};
const includesAnyPermission = (permissions, required = []) => !required.length || required.some((permission) => permissions.has(permission));
const syncOperationAuthorization = (db, session, tenantId, operation) => {
  if (!session || session.role !== "employee") return { allowed: true };
  const context = employeeSecurityContext(db, session, tenantId);
  if (!context?.employee || context.employee.estado === "bloqueado" || !context.role) {
    return { allowed: false, reason: "employee_role_inactive", requiredPermissions: [] };
  }
  if (operation.type === "system_set") return { allowed: false, reason: "system_admin_required", requiredPermissions: ["superAdmin"] };
  if (["set", "delete"].includes(operation.type)) {
    if (operation.key === "datos") return { allowed: false, reason: "legacy_snapshot_not_allowed", requiredPermissions: [] };
    if (["menuPreferences", "userPreferences", "reportesProblemas"].includes(operation.key)) return { allowed: true };
    return { allowed: false, reason: "unsupported_snapshot", requiredPermissions: [] };
  }
  if (["section_set", "section_delete"].includes(operation.type)) {
    const required = SYNC_SECTION_PERMISSIONS[operation.section];
    if (!required) return { allowed: false, reason: "section_not_allowed", requiredPermissions: [] };
    return includesAnyPermission(context.permissions, required)
      ? { allowed: true }
      : { allowed: false, reason: "permission_required", requiredPermissions: required };
  }
  if (!["entity_upsert", "entity_delete"].includes(operation.type)) {
    return { allowed: false, reason: "operation_not_allowed", requiredPermissions: [] };
  }
  const entity = String(operation.entity || "");
  const current = db.tenants?.[tenantId]?.entities?.[entity]?.[String(operation.entityId)]?.value;
  if (entity === "auditoria") {
    return operation.type === "entity_upsert" && !current
      ? { allowed: true }
      : { allowed: false, reason: "audit_append_only", requiredPermissions: [] };
  }
  if (entity === "products") {
    if (operation.type === "entity_delete" && !context.permissions.has("eliminar_productos")) {
      return { allowed: false, reason: "permission_required", requiredPermissions: ["eliminar_productos"] };
    }
    const priceFields = ["precio", "costo", "margen", "precioMayorista"];
    const changesPrice = operation.type === "entity_upsert" && current
      && priceFields.some((field) => Number(current?.[field] || 0) !== Number(operation.value?.[field] || 0));
    if (changesPrice && !context.permissions.has("editar_precios")) {
      return { allowed: false, reason: "permission_required", requiredPermissions: ["editar_precios"] };
    }
    if (current && operation.type === "entity_upsert" && includesAnyPermission(context.permissions, ["ventas", "compras", "vencimientos"]) && !includesAnyPermission(context.permissions, ["stock", "vitrina"])) {
      const stockFields = new Set(["deposito", "vitrina", "historial"]);
      const keys = new Set([...Object.keys(current || {}), ...Object.keys(operation.value || {})]);
      const changedFields = [...keys].filter((field) => JSON.stringify(current?.[field]) !== JSON.stringify(operation.value?.[field]));
      return changedFields.every((field) => stockFields.has(field))
        ? { allowed: true }
        : { allowed: false, reason: "permission_required", requiredPermissions: ["stock", "vitrina"] };
    }
  }
  if (entity === "tickets" && operation.type === "entity_delete" && !context.permissions.has("eliminar_tickets")) {
    return { allowed: false, reason: "permission_required", requiredPermissions: ["eliminar_tickets"] };
  }
  if (entity === "tickets" && current && operation.type === "entity_upsert") {
    if (!context.permissions.has("eliminar_tickets")) {
      return { allowed: false, reason: "permission_required", requiredPermissions: ["eliminar_tickets"] };
    }
  }
  if (["cajaMovimientos", "cajaHistorial"].includes(entity) && current && operation.type !== "entity_delete" && !context.permissions.has("corregir_caja")) {
    return { allowed: false, reason: "permission_required", requiredPermissions: ["corregir_caja"] };
  }
  if (["cajaMovimientos", "cajaHistorial"].includes(entity) && operation.type === "entity_delete" && !context.permissions.has("corregir_caja")) {
    return { allowed: false, reason: "permission_required", requiredPermissions: ["corregir_caja"] };
  }
  const required = SYNC_ENTITY_PERMISSIONS[entity];
  if (!required) return { allowed: false, reason: "entity_not_allowed", requiredPermissions: [] };
  return includesAnyPermission(context.permissions, required)
    ? { allowed: true }
    : { allowed: false, reason: "permission_required", requiredPermissions: required };
};
const recordSecurityEvent = (db, session, tenantId, deviceId, values = {}) => {
  const id = crypto.randomUUID();
  db.securityEvents ||= {};
  db.securityEvents[id] = {
    id, tenantId: String(tenantId), userId: session?.userId || null, role: session?.role || null,
    deviceId: String(deviceId || ""), at: new Date().toISOString(), ...values,
  };
  const retained = Object.values(db.securityEvents)
    .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
    .slice(0, 5000);
  db.securityEvents = Object.fromEntries(retained.map((entry) => [entry.id, entry]));
  return db.securityEvents[id];
};
const mercadoPagoIntegration = (db, tenantId) => db.paymentIntegrations?.[String(tenantId)]?.mercadoPago || null;
const normalizePaymentSolution = (value) => value === "point" ? "point" : "qr";
const mercadoPagoConnection = (integration, solution) => {
  if (!integration) return null;
  const normalized = normalizePaymentSolution(solution);
  if (integration.connections?.[normalized]) return integration.connections[normalized];
  // Before separate QR/Point applications, credentials lived at the root. They
  // represented the QR application and are read only as a migration fallback.
  if (normalized === "qr" && integration.credentialsEncrypted) return integration;
  return null;
};
const paymentConnectionView = (connection, availability = {}) => ({
  ...availability,
  connected: connection?.status === "connected",
  status: connection?.status || "disconnected",
  sellerId: connection?.sellerId || null,
  sellerNickname: connection?.sellerNickname || null,
  connectedAt: connection?.connectedAt || null,
  updatedAt: connection?.updatedAt || null,
  tokenExpiresAt: connection?.tokenExpiresAt || null,
});
const paymentIntegrationView = (integration, config = mercadoPago) => {
  const availability = mercadoPagoAvailability(config);
  const qrConnection = paymentConnectionView(mercadoPagoConnection(integration, "qr"), availability.solutions.qr);
  const pointConnection = paymentConnectionView(mercadoPagoConnection(integration, "point"), availability.solutions.point);
  const primary = qrConnection.connected ? qrConnection : pointConnection.connected ? pointConnection : qrConnection;
  return {
    provider: "mercado_pago",
    connected: qrConnection.connected || pointConnection.connected,
    status: qrConnection.connected || pointConnection.connected ? "connected" : (qrConnection.status === "reauthorization_required" || pointConnection.status === "reauthorization_required" ? "reauthorization_required" : "disconnected"),
    sellerId: primary.sellerId || null,
    sellerNickname: primary.sellerNickname || null,
    connectedAt: primary.connectedAt || null,
    updatedAt: integration?.updatedAt || primary.updatedAt || null,
    tokenExpiresAt: primary.tokenExpiresAt || null,
    solutions: { qr: qrConnection, point: pointConnection },
    qr: integration?.qr ? {
    configured: Boolean(integration.qr.storeId && integration.qr.posId && integration.qr.posExternalId),
    storeId: integration.qr.storeId || null,
    storeName: integration.qr.storeName || null,
    storeExternalId: integration.qr.storeExternalId || null,
    posId: integration.qr.posId || null,
    posName: integration.qr.posName || null,
    posExternalId: integration.qr.posExternalId || null,
    configuredAt: integration.qr.configuredAt || null,
    } : { configured: false },
    point: integration?.point ? {
    configured: Boolean(integration.point.terminalId),
    terminalId: integration.point.terminalId || null,
    operatingMode: integration.point.operatingMode || null,
    configuredAt: integration.point.configuredAt || null,
    } : { configured: false },
  };
};
const paymentOrderStatus = (order = {}) => order.status || order.transactions?.payments?.[0]?.status || "pending";
const paymentProviderSnapshot = (order = {}) => ({
  id: order.id || null,
  status: paymentOrderStatus(order),
  statusDetail: order.status_detail || order.transactions?.payments?.[0]?.status_detail || null,
  externalReference: order.external_reference || null,
  totalAmount: Number(order.total_amount || order.transactions?.payments?.[0]?.amount || 0),
  qrData: mercadoPagoQrData(order),
  createdAt: order.created_date || order.date_created || null,
  lastUpdatedAt: order.last_updated_date || order.date_last_updated || null,
});
const paymentAttemptView = (attempt = {}) => ({
  id: attempt.id,
  provider: attempt.provider,
  type: attempt.type,
  ticketId: attempt.ticketId || null,
  ticketNumber: attempt.ticketNumber || null,
  externalReference: attempt.externalReference,
  amount: attempt.amount,
  currency: attempt.currency || "ARS",
  status: attempt.status,
  providerStatus: attempt.providerStatus || null,
  providerStatusDetail: attempt.providerStatusDetail || null,
  providerOrderId: attempt.providerOrderId || null,
  qrData: attempt.qrData || null,
  createdAt: attempt.createdAt,
  updatedAt: attempt.updatedAt,
  approvedAt: attempt.approvedAt || null,
  canceledAt: attempt.canceledAt || null,
  refundedAt: attempt.refundedAt || null,
  saleRecordedAt: attempt.saleRecordedAt || null,
  saleTotal: attempt.saleTotal || null,
  reconciliationStatus: attempt.status === "approved" && !attempt.ticketId ? "sale_pending" : attempt.ticketId ? "linked" : "not_applicable",
  lastProviderSyncAt: attempt.lastProviderSyncAt || null,
  history: Array.isArray(attempt.history) ? attempt.history.slice(-12) : [],
  failure: attempt.failure || null,
});
const paymentPresentationView = (presentation = {}, db = {}) => {
  const linkedAttempt = presentation.attemptId ? db.paymentAttempts?.[presentation.attemptId] : null;
  const attempt = linkedAttempt?.tenantId === presentation.tenantId ? linkedAttempt : null;
  return {
    id: presentation.id,
    target: presentation.target,
    mode: presentation.mode,
    method: presentation.method,
    amount: Number(presentation.amount || 0),
    payments: Array.isArray(presentation.payments) ? presentation.payments : [],
    qrData: attempt?.qrData || presentation.qrData || null,
    qrImage: presentation.qrImage || null,
    attemptId: presentation.attemptId || null,
    status: attempt?.status || presentation.status || "active",
    sourceDeviceId: presentation.sourceDeviceId || null,
    seenAt: presentation.seenAt || null,
    seenDeviceId: presentation.seenDeviceId || null,
    pushDeliveryCount: Number(presentation.pushDeliveryCount || 0),
    createdAt: presentation.createdAt,
    expiresAt: presentation.expiresAt,
  };
};
const cleanPaymentPresentationImage = (value) => {
  const source = String(value || "");
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(source) && source.length <= 800_000 ? source : null;
};
const saveMercadoPagoCredentials = (connection, tokens) => {
  let previous = {};
  if (connection.credentialsEncrypted && (!tokens.access_token || !tokens.refresh_token)) {
    try { previous = decryptPaymentSecret(connection.credentialsEncrypted, mercadoPago.tokenEncryptionKey) || {}; }
    catch { previous = {}; }
  }
  const accessToken = tokens.access_token || previous.accessToken;
  const refreshToken = tokens.refresh_token || previous.refreshToken;
  if (!accessToken) throw new Error("Mercado Pago no devolvió un token de acceso");
  connection.credentialsEncrypted = encryptPaymentSecret({ accessToken, refreshToken }, mercadoPago.tokenEncryptionKey);
  const expiresIn = Math.max(60, Number(tokens.expires_in || 21600));
  connection.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  connection.updatedAt = new Date().toISOString();
  return connection;
};
const mercadoPagoAccessToken = async (db, integration, solution) => {
  const normalized = normalizePaymentSolution(solution);
  const connection = mercadoPagoConnection(integration, normalized);
  const client = mercadoPagoClientFor(normalized);
  if (!connection || connection.status !== "connected") throw new Error(`El negocio todavía no conectó Mercado Pago para ${normalized === "point" ? "Point" : "Código QR"}`);
  const credentials = decryptPaymentSecret(connection.credentialsEncrypted, mercadoPago.tokenEncryptionKey) || {};
  if (!credentials.accessToken) throw new Error("La conexión con Mercado Pago no tiene una credencial válida");
  if (Date.parse(connection.tokenExpiresAt || "") > Date.now() + 5 * 60 * 1000) return credentials.accessToken;
  if (!credentials.refreshToken) return credentials.accessToken;
  let refreshed;
  try {
    refreshed = await client.refreshAccessToken(credentials.refreshToken);
  } catch (error) {
    if ([400, 401].includes(Number(error?.status))) {
      connection.status = "reauthorization_required";
      connection.authorizationFailure = paymentFailure(error);
      connection.updatedAt = new Date().toISOString();
      await writeDb(db);
      const expired = new Error(`La autorización de Mercado Pago para ${normalized === "point" ? "Point" : "Código QR"} venció o fue revocada. El dueño debe conectarla nuevamente.`);
      expired.providerCode = "reauthorization_required";
      throw expired;
    }
    throw error;
  }
  saveMercadoPagoCredentials(connection, refreshed);
  delete connection.authorizationFailure;
  // Mercado Pago puede rotar el refresh token. Persistirlo antes de continuar evita
  // que una consulta de sólo lectura deje la cuenta inutilizable en el siguiente pedido.
  await writeDb(db);
  return decryptPaymentSecret(connection.credentialsEncrypted, mercadoPago.tokenEncryptionKey).accessToken;
};
const updatePaymentAttemptFromOrder = (attempt, order) => {
  const snapshot = paymentProviderSnapshot(order);
  const status = normalizedPaymentStatus(snapshot.status);
  Object.assign(attempt, {
    providerOrderId: snapshot.id || attempt.providerOrderId,
    providerStatus: snapshot.status,
    providerStatusDetail: snapshot.statusDetail,
    qrData: snapshot.qrData || attempt.qrData || null,
    status,
    updatedAt: new Date().toISOString(),
    lastProviderSyncAt: new Date().toISOString(),
    failure: status === "failed" ? { code: snapshot.statusDetail || "provider_rejected", message: "Mercado Pago rechazó el cobro" } : null,
  });
  if (status === "approved") attempt.approvedAt ||= attempt.updatedAt;
  if (status === "canceled" || status === "expired") attempt.canceledAt ||= attempt.updatedAt;
  if (status === "refunded") attempt.refundedAt ||= attempt.updatedAt;
  return attempt;
};
const paymentFailure = (error) => {
  const details = (Array.isArray(error?.providerDetails) ? error.providerDetails : [])
    .map((detail) => ({
      code: cleanCatalogText(detail?.code || "", 80) || null,
      field: cleanCatalogText(detail?.field || detail?.property || "", 120) || null,
      message: cleanCatalogText(detail?.message || detail?.description || detail?.detail || detail?.error || "", 240) || null,
    }))
    .filter((detail) => detail.code || detail.field || detail.message)
    .slice(0, 4);
  const failure = {
    code: cleanCatalogText(error?.providerCode || "provider_error", 80),
    message: mercadoPagoProviderMessage(error).slice(0, 300),
  };
  const httpStatus = Number(error?.status);
  if (Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599) failure.httpStatus = httpStatus;
  const requestId = cleanCatalogText(error?.providerRequestId || "", 120);
  if (requestId) failure.requestId = requestId;
  if (details.length) failure.details = details;
  return failure;
};
const paymentSetupExternalIds = (tenantId) => {
  const suffix = crypto.createHash("sha256").update(String(tenantId || "negocio")).digest("hex").slice(0, 16).toUpperCase();
  return { storeExternalId: `KIOSCO${suffix}`, posExternalId: `CAJA${suffix}` };
};
const providerResultList = (payload, key) => {
  if (Array.isArray(payload)) {
    if (payload[0] && Array.isArray(payload[0]?.[key])) return payload[0][key];
    return payload;
  }
  return Array.isArray(payload?.[key]) ? payload[key] : [];
};
const paymentTerminalView = (terminal = {}) => ({
  id: cleanCatalogText(terminal.id || "", 80),
  posId: cleanCatalogText(terminal.pos_id || "", 80) || null,
  storeId: cleanCatalogText(terminal.store_id || "", 80) || null,
  externalPosId: cleanCatalogText(terminal.external_pos_id || "", 60) || null,
  operatingMode: cleanCatalogText(terminal.operating_mode || "UNDEFINED", 40),
});
const reconcileMercadoPagoQrSetup = async ({ integration, tenantId, connection, accessToken, payload = {}, createStoreIfMissing = false, forcePosRecreate = false }) => {
  integration.qr ||= {};
  const ids = paymentSetupExternalIds(tenantId);
  const client = mercadoPagoClientFor("qr");
  const storeExternalId = ids.storeExternalId;
  const posExternalId = ids.posExternalId;
  const storeSearch = await client.searchStores({ accessToken, userId: connection.sellerId, externalId: storeExternalId }).catch((error) => {
    if (Number(error?.status) === 404) return { results: [] };
    throw error;
  });
  let store = providerResultList(storeSearch, "results")[0] || null;
  if (!store && createStoreIfMissing) {
    const storePayload = buildMercadoPagoStorePayload({
      name: payload.storeName || integration.qr.storeName || "Kiosco+",
      externalId: storeExternalId,
      streetName: payload.streetName,
      streetNumber: payload.streetNumber,
      cityName: payload.cityName,
      stateName: payload.stateName,
      latitude: payload.latitude,
      longitude: payload.longitude,
      reference: payload.reference,
    });
    store = await client.createStore({ accessToken, userId: connection.sellerId, payload: storePayload });
  }
  if (!store?.id) return { repaired: false, reason: "store_missing" };

  const posSearch = await client.searchPos({ accessToken, externalId: posExternalId }).catch((error) => {
    if (Number(error?.status) === 404) return { data: [] };
    throw error;
  });
  let pos = providerResultList(posSearch, "data")[0] || null;
  if (pos && forcePosRecreate) {
    // Mercado Pago a veces deja una caja en un estado que "Comprobar y reparar"
    // (sólo corrige operating_mode) no detecta ni arregla. Borrarla acá permite
    // que el bloque de abajo cree una caja nueva con el mismo external_id.
    await client.deletePos({ accessToken, posId: pos.id, idempotencyKey: crypto.randomUUID() });
    pos = null;
  }
  if (!pos) {
    const posPayload = buildMercadoPagoPosPayload({
      name: payload.posName || integration.qr.posName || "Caja principal",
      storeId: String(store.id),
      externalId: posExternalId,
    });
    pos = await client.createPos({ accessToken, payload: posPayload, idempotencyKey: crypto.randomUUID() });
  } else if (String(pos?.config?.qr?.operating_mode || "").toLowerCase() !== "pdv") {
    pos = await client.updatePos({
      accessToken,
      posId: pos.id,
      payload: { config: { qr: { operating_mode: "pdv" } } },
      idempotencyKey: crypto.randomUUID(),
    });
  }
  if (!pos?.id) throw new Error("Mercado Pago no devolvió el identificador de la caja creada");
  const now = new Date().toISOString();
  integration.qr = {
    ...integration.qr,
    storeId: String(store.id),
    storeName: cleanCatalogText(payload.storeName || integration.qr.storeName || store.name || "Kiosco+", 60),
    storeExternalId,
    posId: String(pos.id),
    posName: cleanCatalogText(payload.posName || integration.qr.posName || pos.name || "Caja principal", 60),
    posExternalId: String(pos.external_id || posExternalId),
    configuredAt: integration.qr.configuredAt || now,
    verifiedAt: now,
  };
  delete integration.qr.setupFailure;
  integration.updatedAt = now;
  return { repaired: true, createdPos: !providerResultList(posSearch, "data")[0] };
};
const invalidateMercadoPagoQrSetup = (integration, error) => {
  if (!integration?.qr) return;
  integration.qr = {
    storeName: integration.qr.storeName || "Kiosco+",
    posName: integration.qr.posName || "Caja principal",
    setupFailure: paymentFailure(error),
    invalidatedAt: new Date().toISOString(),
  };
  integration.updatedAt = new Date().toISOString();
};
const paymentReturnUrl = (status, reason = "", solution = "qr") => {
  try {
    const url = new URL(mercadoPago.returnUri);
    url.searchParams.set("payment_connection", status);
    url.searchParams.set("payment_solution", normalizePaymentSolution(solution));
    if (reason) url.searchParams.set("payment_reason", reason.slice(0, 80));
    return url.toString();
  } catch {
    return `https://app.kioscomas.ar/?payment_connection=${encodeURIComponent(status)}&payment_solution=${encodeURIComponent(normalizePaymentSolution(solution))}`;
  }
};
const redirect = (res, location) => {
  res.writeHead(302, { location, "cache-control": "no-store" });
  res.end();
};
const isLoopback = (req) => {
  const address = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
};
const displayPairAttempts = new Map();
const sensitiveRequestAttempts = new Map();
const requestAddress = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
const pruneAttemptMap = (map, cutoff) => {
  if (map.size < 2000) return;
  for (const [key, timestamps] of map) if (!(timestamps || []).some((at) => at > cutoff)) map.delete(key);
  while (map.size > 5000) map.delete(map.keys().next().value);
};
const enforceSensitiveRequestLimit = (req, res) => {
  if (localMode) return true;
  const rules = {
    "POST /v1/auth/login": { maximum: 12, windowMs: 15 * 60 * 1000 },
    "POST /v1/auth/register": { maximum: 6, windowMs: 60 * 60 * 1000 },
    "POST /v1/auth/pair-device": { maximum: 8, windowMs: 15 * 60 * 1000 },
    "POST /v1/auth/bootstrap": { maximum: 4, windowMs: 60 * 60 * 1000 },
    "POST /v1/auth/password/forgot": { maximum: 10, windowMs: 60 * 60 * 1000 },
    "POST /v1/payments/mercado-pago/oauth/start": { maximum: 10, windowMs: 60 * 60 * 1000 },
    "POST /v1/payments/mercado-pago/qr/setup": { maximum: 6, windowMs: 60 * 60 * 1000 },
    "POST /v1/payments/mercado-pago/point/setup": { maximum: 12, windowMs: 60 * 60 * 1000 },
  };
  const routeKey = `${req.method} ${String(req.url || "").split("?")[0]}`;
  const rule = rules[routeKey];
  if (!rule) return true;
  const now = Date.now();
  pruneAttemptMap(sensitiveRequestAttempts, now - 60 * 60 * 1000);
  const key = `${routeKey}:${requestAddress(req)}`;
  const attempts = (sensitiveRequestAttempts.get(key) || []).filter((at) => at > now - rule.windowMs);
  if (attempts.length >= rule.maximum) {
    const retryAfter = Math.max(1, Math.ceil((attempts[0] + rule.windowMs - now) / 1000));
    res.setHeader("retry-after", String(retryAfter));
    send(res, 429, { error: "Hubo demasiados intentos. Esperá unos minutos antes de volver a probar." });
    return false;
  }
  attempts.push(now);
  sensitiveRequestAttempts.set(key, attempts);
  return true;
};

const handleRequest = async (req, res) => {
  res.kioscoRequest = req;
  try {
    if (!enforceSensitiveRequestLimit(req, res)) return;
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.url === "/v1/health") return send(res, 200, {
      ok: true,
      service: "kiosco-cloud-local",
      schemaVersion: 9,
      localMode,
      deviceActivationRequired: requireDeviceActivation,
      emailDeliveryConfigured: emailService.configured && !emailTestMode,
      pushDeliveryConfigured,
      paymentProviders: { mercadoPago: mercadoPagoAvailability(mercadoPago) },
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
    if (req.method === "GET" && req.url?.startsWith("/v1/payments/mercado-pago/oauth/callback")) {
      const url = new URL(req.url, "http://localhost");
      const rawState = String(url.searchParams.get("state") || "");
      const providerErrorCode = String(url.searchParams.get("error") || "");
      const db = await readDb();
      const stateKey = sha256(rawState);
      const pending = db.paymentOauthStates?.[stateKey];
      const solution = normalizePaymentSolution(pending?.solution);
      const solutionConfig = mercadoPagoConfigFor(mercadoPago, solution);
      const client = mercadoPagoClientFor(solution);
      if (!solutionConfig.ready || !pending || pending.usedAt || Date.parse(pending.expiresAt || "") <= Date.now()) {
        return redirect(res, paymentReturnUrl("error", "invalid_or_expired_state", solution));
      }
      if (providerErrorCode) {
        pending.usedAt = new Date().toISOString();
        pending.result = "provider_denied";
        await writeDb(db);
        return redirect(res, paymentReturnUrl("canceled", providerErrorCode, solution));
      }
      try {
        const codeVerifier = decryptPaymentSecret(pending.codeVerifierEncrypted, mercadoPago.tokenEncryptionKey)?.value;
        const tokens = await client.exchangeAuthorizationCode({ code: url.searchParams.get("code"), codeVerifier });
        const profile = await client.currentUser(tokens.access_token);
        if (solutionConfig.testMode && !isMercadoPagoSandboxSeller({ tokens, profile })) {
          const unsafeSeller = new Error("El modo de prueba sólo permite conectar un usuario vendedor de prueba de Mercado Pago");
          unsafeSeller.providerCode = "production_seller_in_test_mode";
          throw unsafeSeller;
        }
        const now = new Date().toISOString();
        db.paymentIntegrations ||= {};
        db.paymentIntegrations[pending.tenantId] ||= {};
        const previousIntegration = db.paymentIntegrations[pending.tenantId].mercadoPago || {};
        const previousConnection = mercadoPagoConnection(previousIntegration, solution) || {};
        const otherSolution = solution === "point" ? "qr" : "point";
        const otherConnection = mercadoPagoConnection(previousIntegration, otherSolution);
        const nextSellerId = String(profile?.id || tokens.user_id || "") || null;
        if (!nextSellerId) throw new Error("Mercado Pago no informó qué cuenta fue autorizada");
        if (otherConnection?.status === "connected" && otherConnection.sellerId && otherConnection.sellerId !== nextSellerId) {
          const mismatch = new Error("QR y Point deben autorizarse con la misma cuenta vendedora de Mercado Pago");
          mismatch.providerCode = "seller_account_mismatch";
          throw mismatch;
        }
        const connection = {
          ...previousConnection,
          status: "connected",
          sellerId: nextSellerId,
          sellerNickname: cleanCatalogText(profile?.nickname || "", 120) || null,
          connectedAt: previousConnection.connectedAt || now,
          connectedBy: pending.userId,
          updatedAt: now,
        };
        saveMercadoPagoCredentials(connection, tokens);
        const integration = {
          ...previousIntegration,
          provider: "mercado_pago",
          connections: { ...(previousIntegration.connections || {}), [solution]: connection },
          updatedAt: now,
        };
        if (previousConnection.sellerId && previousConnection.sellerId !== nextSellerId) {
          if (solution === "qr") delete integration.qr;
          if (solution === "point") delete integration.point;
        }
        // Remove the pre-v0.2.27 root credential after migrating QR.
        if (solution === "qr") {
          delete integration.credentialsEncrypted;
          delete integration.tokenExpiresAt;
          delete integration.status;
          delete integration.sellerId;
          delete integration.sellerNickname;
        }
        db.paymentIntegrations[pending.tenantId].mercadoPago = integration;
        pending.usedAt = now;
        pending.result = "connected";
        await writeDb(db);
        return redirect(res, paymentReturnUrl("connected", "", solution));
      } catch (error) {
        pending.usedAt = new Date().toISOString();
        pending.result = "exchange_failed";
        pending.failure = paymentFailure(error);
        await writeDb(db);
        return redirect(res, paymentReturnUrl("error", error?.providerCode || "token_exchange_failed", solution));
      }
    }
    if (req.method === "POST" && req.url?.startsWith("/v1/payments/mercado-pago/webhook")) {
      if (!mercadoPago.enabled) return send(res, 503, { error: "Mercado Pago no está habilitado" });
      const url = new URL(req.url, "http://localhost");
      const payload = await body(req);
      const dataId = String(url.searchParams.get("data.id") || payload?.data?.id || "");
      const db = await readDb();
      const attempt = Object.values(db.paymentAttempts || {}).find((item) => String(item?.providerOrderId) === dataId);
      const solution = normalizePaymentSolution(attempt?.type);
      const candidateConfigs = (attempt ? [solution] : ["qr", "point"])
        .map((candidate) => mercadoPagoConfigFor(mercadoPago, candidate))
        .filter((candidate) => candidate?.webhookConfigured);
      if (!candidateConfigs.length) return send(res, 503, { error: "Webhook de Mercado Pago no configurado" });
      const valid = candidateConfigs.some((candidate) => verifyMercadoPagoWebhookSignature({
          signature: req.headers["x-signature"],
          requestId: req.headers["x-request-id"],
          dataId,
          secret: candidate.webhookSecret,
        }));
      if (!valid) return send(res, 401, { error: "Firma de webhook inválida" });
      if (!attempt) return send(res, 200, { ok: true, ignored: true });
      const webhookRequestId = cleanCatalogText(req.headers["x-request-id"] || "", 160);
      if (webhookRequestId && attempt.lastWebhookRequestId === webhookRequestId) return send(res, 200, { ok: true, duplicate: true });
      const integration = mercadoPagoIntegration(db, attempt.tenantId);
      if (!integration) return send(res, 200, { ok: true, ignored: true });
      try {
        const accessToken = await mercadoPagoAccessToken(db, integration, solution);
        const previousStatus = attempt.status;
        const order = await mercadoPagoClientFor(solution).getOrder({ accessToken, orderId: dataId });
        updatePaymentAttemptFromOrder(attempt, order);
        attempt.lastWebhookAt = new Date().toISOString();
        attempt.lastWebhookRequestId = webhookRequestId || null;
        if (attempt.status !== previousStatus) attempt.history.push({ status: attempt.status, providerStatus: attempt.providerStatus, action: "webhook", at: attempt.updatedAt });
        if (attempt.status === "approved" && previousStatus !== "approved") {
          const notification = createPlatformNotification(db, {
            sourceKey: `payment-approved:${attempt.id}`,
            title: "Cobro acreditado",
            message: attempt.ticketId
              ? `Se acreditaron $${Number(attempt.amount || 0).toLocaleString("es-AR")} para el ticket ${attempt.ticketNumber || attempt.ticketId}.`
              : `Se acreditaron $${Number(attempt.amount || 0).toLocaleString("es-AR")}. La caja terminará de vincular la venta automáticamente.`,
            level: "info",
            category: "payments",
            audience: { type: "business", businessIds: [String(attempt.tenantId)] },
            action: { view: "ventas" },
          }).notification;
          await sendPushNotification(db, notification);
        } else if (attempt.status === "charged_back" && previousStatus !== "charged_back") {
          const notification = createPlatformNotification(db, {
            sourceKey: `payment-charged-back:${attempt.id}`,
            title: "Mercado Pago informó un contracargo",
            message: `Revisá el cobro de $${Number(attempt.amount || 0).toLocaleString("es-AR")}${attempt.ticketNumber ? ` vinculado al ticket ${attempt.ticketNumber}` : ""}.`,
            level: "critica",
            category: "payments",
            audience: { type: "business", businessIds: [String(attempt.tenantId)] },
            action: { view: "ventas" },
          }).notification;
          await sendPushNotification(db, notification);
        } else if (attempt.status === "refunded" && previousStatus !== "refunded") {
          const notification = createPlatformNotification(db, {
            sourceKey: `payment-refunded:${attempt.id}`,
            title: "Cobro devuelto en Mercado Pago",
            message: `Se registró la devolución de $${Number(attempt.amount || 0).toLocaleString("es-AR")}${attempt.ticketNumber ? ` del ticket ${attempt.ticketNumber}` : ""}.`,
            level: "info",
            category: "payments",
            audience: { type: "business", businessIds: [String(attempt.tenantId)] },
            action: { view: "ventas" },
          }).notification;
          await sendPushNotification(db, notification);
        }
        await writeDb(db);
        return send(res, 200, { ok: true });
      } catch (error) {
        return send(res, 502, { error: "No se pudo confirmar el estado del cobro" });
      }
    }
    if (req.method === "POST" && req.url === "/v1/displays/pairing-request") {
      const remoteAddress = requestAddress(req);
      pruneAttemptMap(displayPairAttempts, Date.now() - 10 * 60 * 1000);
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
      const remoteAddress = requestAddress(req);
      pruneAttemptMap(displayPairAttempts, Date.now() - 10 * 60 * 1000);
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
      const resetPasswordError = passwordPolicyError(password);
      if (resetPasswordError) return send(res, 400, { error: resetPasswordError });
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
      if (!deviceId || !username || !name || !businessName || !isValidEmail(email)) {
        return send(res, 400, { error: "Completá el nombre, negocio, correo y usuario" });
      }
      const registrationPasswordError = passwordPolicyError(password);
      if (registrationPasswordError) return send(res, 400, { error: registrationPasswordError });
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
      db.sessions[accessTokenHash(accessToken)] = {
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
      if (!sessionSubjectIsActive(db, { userId: user.id, businessId: user.businessId, role: user.role })) {
        return send(res, 403, { error: "Esta cuenta fue bloqueada, eliminada o ya no pertenece al negocio" });
      }
      const activation = db.activations?.[deviceId];
      if (requireDeviceActivation && (!activation || activation.revokedAt)) {
        return send(res, 403, { error: "Este dispositivo todavía no fue autorizado. Ingresá una clave de activación antes de iniciar sesión." });
      }
      if (activation) activation.lastSeenAt = new Date().toISOString();
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = accessTokenExpiresAt();
      db.sessions[accessTokenHash(accessToken)] = {
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
      if (!sessionSubjectIsActive(db, old)) return send(res, 401, { error: "La cuenta ya no está habilitada" });
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
      db.sessions[accessTokenHash(accessToken)] = {
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

    if (req.url === "/v1/account") {
      const account = tenantAccount(db, tenantId);
      if (!account || account.superAdmin) return send(res, 404, { error: "El negocio no existe" });
      if (req.method === "GET") {
        const user = cloudUserForSession(db, session);
        return send(res, 200, { account: accountForLogin(db, user), teamRevision: Number(account.teamRevision || 0) });
      }
      if (req.method === "PUT") {
        const teamSecurity = employeeSecurityContext(db, session, tenantId);
        if (!session || (session.role === "employee" && !teamSecurity?.permissions.has("gestionar_personal"))) return send(res, 403, { error: "No tenés permiso para administrar empleados y roles" });
        const requestingUser = cloudUserForSession(db, session);
        const payload = await body(req);
        const expectedRevision = Number(account.teamRevision || 0);
        if (Number(payload.teamRevision || 0) !== expectedRevision) {
          return send(res, 409, {
            error: "El equipo cambió desde otro dispositivo. Volvé a abrir Administración antes de guardar.",
            account: accountForLogin(db, requestingUser),
            teamRevision: expectedRevision,
          });
        }
        let team;
        try { team = sanitizeBusinessTeam(db, account, payload); }
        catch (error) { return send(res, Number(error?.status || 400), { error: error?.message || "No se pudo validar el equipo" }); }
        const nextAccount = {
          ...account,
          roles: team.roles,
          empleados: team.employees,
          modoNegocio: team.businessMode,
          teamRevision: expectedRevision + 1,
          teamUpdatedAt: new Date().toISOString(),
        };
        revokeChangedAccountSubjects(db, account, nextAccount, "team_updated");
        db.system.cuentas = (db.system.cuentas || []).map((candidate) => String(candidate?.id) === tenantId ? nextAccount : candidate);
        recordSecurityEvent(db, session, tenantId, deviceId, {
          type: "business_team_updated", outcome: "accepted",
          employeeCount: nextAccount.empleados.length, roleCount: nextAccount.roles.length,
        });
        await writeDb(db);
        return send(res, 200, { ok: true, account: accountForLogin(db, requestingUser) || nextAccount, teamRevision: nextAccount.teamRevision });
      }
      return send(res, 405, { error: "Método no permitido" });
    }
    if (req.method === "GET" && req.url?.startsWith("/v1/security/events")) {
      const securityContext = employeeSecurityContext(db, session, tenantId);
      if (!session || (session.role === "employee" && !securityContext?.permissions.has("gestionar_personal"))) {
        return send(res, 403, { error: "No tenés permiso para consultar los accesos rechazados" });
      }
      const limit = Math.min(200, Math.max(10, Number(new URL(req.url, "http://localhost").searchParams.get("limit") || 50)));
      const events = Object.values(db.securityEvents || {})
        .filter((event) => String(event?.tenantId) === tenantId)
        .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
        .slice(0, limit);
      return send(res, 200, { events });
    }
    if (req.url?.startsWith("/v1/recovery")) {
      if (!session || !["owner", "superAdmin"].includes(session.role)) return send(res, 403, { error: "Sólo el dueño puede exportar o recuperar los datos" });
      const account = tenantAccount(db, tenantId);
      if (!account || account.superAdmin) return send(res, 404, { error: "El negocio no existe" });
      if (req.method === "GET" && req.url === "/v1/recovery/export") {
        return send(res, 200, { export: recoveryExport(db, tenantId) });
      }
      if (req.method === "GET" && req.url === "/v1/recovery/backups") {
        const backups = await listRecoveryBackups();
        return send(res, 200, { backups, retentionDays: Number(process.env.KIOSCO_BACKUP_RETENTION_DAYS || 14) });
      }
      if (req.method === "POST" && req.url === "/v1/recovery/preview") {
        const payload = await body(req);
        const backupDay = String(payload.backupDay || "");
        const backup = await readRecoveryBackup(backupDay);
        const historicTenant = backup?.tenants?.[tenantId];
        if (!backup || !historicTenant) return send(res, 404, { error: "Ese respaldo no contiene datos de este negocio" });
        return send(res, 200, {
          backupDay,
          businessName: account.nombreNegocio,
          ...recoveryComparison(db.tenants?.[tenantId], historicTenant),
          warning: "La recuperación reemplazará los datos del negocio, pero conservará el abono, usuarios, contraseñas y dispositivos actuales.",
        });
      }
      if (req.method === "POST" && req.url === "/v1/recovery/restore") {
        const payload = await body(req);
        const backupDay = String(payload.backupDay || "");
        if (String(payload.confirmation || "").trim() !== String(account.nombreNegocio || "").trim()) {
          return send(res, 400, { error: "Escribí exactamente el nombre del negocio para confirmar" });
        }
        const backup = await readRecoveryBackup(backupDay);
        const historicTenant = backup?.tenants?.[tenantId];
        if (!backup || !historicTenant) return send(res, 404, { error: "Ese respaldo no contiene datos de este negocio" });
        const before = recoveryComparison(db.tenants?.[tenantId], historicTenant);
        const recoveryPoint = await createManualRecoveryPoint(db, tenantId);
        db.tenants[tenantId] = structuredClone(historicTenant);
        db.cursor += 1;
        const now = new Date().toISOString();
        db.changes.push({
          id: `tenant-restore:${tenantId}:${crypto.randomUUID()}`,
          tenantId, deviceId: "kiosco-cloud-recovery", type: "tenant_restore",
          backupDay, cursor: db.cursor, serverAt: now,
        });
        db.changes = compactChangeLog(db.changes);
        recordSecurityEvent(db, session, tenantId, deviceId, {
          type: "tenant_backup_restored", outcome: "accepted", backupDay,
          recoveryPointId: recoveryPoint.id, previousRecords: before.current.totalRecords, restoredRecords: before.backup.totalRecords,
        });
        await writeDb(db);
        return send(res, 200, { ok: true, backupDay, cursor: db.cursor, recoveryPointId: recoveryPoint.id, comparison: before });
      }
      return send(res, 404, { error: "Ruta de recuperación inexistente" });
    }

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

    if (req.url?.startsWith("/v1/payments")) {
      db.paymentIntegrations ||= {};
      db.paymentOauthStates ||= {};
      db.paymentAttempts ||= {};
      db.paymentPresentations ||= {};
      const integration = () => mercadoPagoIntegration(db, tenantId);
      const ownerRequired = () => ["owner", "superAdmin"].includes(session?.role);

      if (req.method === "GET" && req.url.startsWith("/v1/payments/presentations/active")) {
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para ver cobros" });
        const now = Date.now();
        const presentations = Object.values(db.paymentPresentations)
          .filter((entry) => entry.tenantId === tenantId && entry.target === "mobile" && entry.status !== "closed" && Date.parse(entry.expiresAt || "") > now)
          .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
          .slice(0, 5)
          .map((entry) => paymentPresentationView(entry, db));
        return send(res, 200, { presentations });
      }

      if (req.method === "POST" && req.url === "/v1/payments/presentations") {
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para mostrar cobros" });
        const payload = await body(req);
        const target = String(payload.target || "");
        if (target !== "mobile") return send(res, 400, { error: "El destino remoto debe ser la app de otro dispositivo" });
        const mode = ["static_qr", "dynamic_qr", "point"].includes(payload.mode) ? payload.mode : "static_qr";
        const qrImage = cleanPaymentPresentationImage(payload.qrImage);
        const qrData = cleanCatalogText(payload.qrData || "", 4096) || null;
        if (mode !== "point" && !qrImage && !qrData) return send(res, 400, { error: "Falta el código QR que se mostrará en el otro dispositivo" });
        const amount = Math.max(0, Math.round(Number(payload.amount || 0) * 100) / 100);
        if (!(amount > 0)) return send(res, 400, { error: "El importe del cobro debe ser mayor a cero" });
        const attemptId = cleanCatalogText(payload.attemptId || "", 120) || null;
        const linkedAttempt = attemptId ? db.paymentAttempts[attemptId] : null;
        if (attemptId && (!linkedAttempt || linkedAttempt.tenantId !== tenantId)) return send(res, 400, { error: "El intento de cobro no pertenece a este negocio" });
        const payments = Array.isArray(payload.payments) ? payload.payments.slice(0, 8).map((item) => ({
          metodo: cleanCatalogText(item?.metodo || item?.method || "", 60),
          monto: Math.max(0, Math.round(Number(item?.monto ?? item?.amount ?? 0) * 100) / 100),
        })).filter((item) => item.metodo && item.monto > 0) : [];
        const now = new Date();
        for (const entry of Object.values(db.paymentPresentations)) {
          if (entry.tenantId === tenantId && entry.sourceDeviceId === deviceId && entry.status !== "closed") entry.status = "closed";
        }
        const id = crypto.randomUUID();
        const presentation = {
          id, tenantId, target, mode,
          method: cleanCatalogText(payload.method || "Mercado Pago", 60),
          amount,
          payments, qrData, qrImage,
          attemptId,
          sourceDeviceId: deviceId,
          createdBy: session.userId,
          status: "active",
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + Math.max(60, Math.min(1800, Number(payload.ttlSeconds) || 900)) * 1000).toISOString(),
        };
        db.paymentPresentations[id] = presentation;
        await sendPaymentPresentationPush(db, presentation);
        await writeDb(db);
        return send(res, 201, { presentation: paymentPresentationView(presentation, db) });
      }

      const presentationSeenMatch = req.url.match(/^\/v1\/payments\/presentations\/([^/?]+)\/seen$/);
      if (req.method === "POST" && presentationSeenMatch) {
        const presentation = db.paymentPresentations[decodeURIComponent(presentationSeenMatch[1])];
        if (!presentation || presentation.tenantId !== tenantId || presentation.status === "closed") return send(res, 404, { error: "Presentación de cobro inexistente" });
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para ver cobros" });
        presentation.seenAt ||= new Date().toISOString();
        presentation.seenDeviceId ||= deviceId;
        await writeDb(db);
        return send(res, 200, { presentation: paymentPresentationView(presentation, db) });
      }

      const presentationMatch = req.url.match(/^\/v1\/payments\/presentations\/([^/?]+)$/);
      if (req.method === "GET" && presentationMatch) {
        const presentation = db.paymentPresentations[decodeURIComponent(presentationMatch[1])];
        if (!presentation || presentation.tenantId !== tenantId) return send(res, 404, { error: "Presentación de cobro inexistente" });
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para ver cobros" });
        return send(res, 200, { presentation: paymentPresentationView(presentation, db) });
      }
      if (req.method === "DELETE" && presentationMatch) {
        const presentation = db.paymentPresentations[decodeURIComponent(presentationMatch[1])];
        if (!presentation || presentation.tenantId !== tenantId) return send(res, 404, { error: "Presentación de cobro inexistente" });
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para cerrar cobros" });
        presentation.status = "closed";
        presentation.closedAt = new Date().toISOString();
        presentation.expiresAt = presentation.closedAt;
        await writeDb(db);
        return send(res, 200, { ok: true });
      }

      if (req.method === "GET" && req.url === "/v1/payments/providers") {
        return send(res, 200, {
          providers: [{
            ...mercadoPagoAvailability(mercadoPago),
            ...paymentIntegrationView(integration(), mercadoPago),
            capabilities: ["dynamic_qr", "qr_setup", "point_terminal", "point_setup", "status", "reconciliation", "cancel", "refund", "webhooks"],
          }],
        });
      }

      if (req.method === "POST" && req.url === "/v1/payments/mercado-pago/oauth/start") {
        if (!ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede conectar la cuenta de Mercado Pago" });
        const payload = await body(req);
        const solution = normalizePaymentSolution(payload.solution);
        const solutionConfig = mercadoPagoConfigFor(mercadoPago, solution);
        if (!solutionConfig.ready) return send(res, 503, { error: `Mercado Pago para ${solution === "point" ? "Point" : "Código QR"} todavía no fue habilitado o configurado en el servidor` });
        const now = Date.now();
        db.paymentOauthStates = Object.fromEntries(Object.entries(db.paymentOauthStates).filter(([, item]) => !item?.usedAt && Date.parse(item?.expiresAt || "") > now));
        const state = token();
        const pkce = createPkcePair();
        db.paymentOauthStates[sha256(state)] = {
          provider: "mercado_pago",
          solution,
          tenantId,
          userId: session.userId,
          deviceId,
          codeVerifierEncrypted: encryptPaymentSecret({ value: pkce.verifier }, mercadoPago.tokenEncryptionKey),
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
          usedAt: null,
        };
        await writeDb(db);
        return send(res, 201, {
          authorizationUrl: buildMercadoPagoAuthorizationUrl(solutionConfig, { state, codeChallenge: pkce.challenge }),
          solution,
          expiresAt: db.paymentOauthStates[sha256(state)].expiresAt,
        });
      }

      if (req.method === "POST" && req.url === "/v1/payments/mercado-pago/qr/setup") {
        if (!ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede crear el local y la caja QR de Mercado Pago" });
        if (!mercadoPagoConfigFor(mercadoPago, "qr").ready) return send(res, 503, { error: "El backend de Mercado Pago para Código QR todavía no está habilitado" });
        const current = integration();
        const connection = mercadoPagoConnection(current, "qr");
        if (!connection || connection.status !== "connected" || !connection.sellerId) return send(res, 409, { error: "Primero conectá Mercado Pago para Código QR" });
        const payload = await body(req);
        const account = tenantAccount(db, tenantId);
        const storeName = cleanCatalogText(payload.storeName || account?.nombreNegocio || "Kiosco+", 60);
        const posName = cleanCatalogText(payload.posName || "Caja principal", 60);
        if (!storeName || !posName) return send(res, 400, { error: "Indicá el nombre del local y de la caja" });
        current.qr ||= {};
        try {
          const accessToken = await mercadoPagoAccessToken(db, current, "qr");
          const setupResult = await reconcileMercadoPagoQrSetup({
            integration: current,
            tenantId,
            connection,
            accessToken,
            payload: { ...payload, storeName, posName },
            createStoreIfMissing: payload.repairOnly !== true,
            forcePosRecreate: payload.repairOnly === true && payload.forcePosRecreate === true,
          });
          if (!setupResult.repaired) {
            const missing = new Error("La caja anterior no pertenece al acceso actual. Completá nuevamente la dirección para crearla en la cuenta de Mercado Pago conectada.");
            missing.providerCode = "qr_setup_requires_address";
            invalidateMercadoPagoQrSetup(current, missing);
            await writeDb(db);
            return send(res, 409, { error: missing.message, integration: paymentIntegrationView(current, mercadoPago), needsAddress: true });
          }
          recordSecurityEvent(db, session, tenantId, deviceId, {
            type: payload.repairOnly === true ? "mercado_pago_qr_repaired" : "mercado_pago_qr_configured", outcome: "accepted",
            storeId: current.qr.storeId, posExternalId: current.qr.posExternalId,
          });
          await writeDb(db);
          return send(res, payload.repairOnly === true ? 200 : 201, { ok: true, repaired: payload.repairOnly === true, integration: paymentIntegrationView(current, mercadoPago) });
        } catch (error) {
          current.updatedAt = new Date().toISOString();
          current.qrSetupFailure = paymentFailure(error);
          await writeDb(db);
          return send(res, Number(error?.status) >= 400 && Number(error?.status) < 500 ? 400 : 502, { error: paymentFailure(error).message, integration: paymentIntegrationView(current, mercadoPago) });
        }
      }

      if (req.method === "GET" && req.url === "/v1/payments/mercado-pago/terminals") {
        if (!ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede configurar terminales Point" });
        const current = integration();
        const connection = mercadoPagoConnection(current, "point");
        if (!mercadoPagoConfigFor(mercadoPago, "point").ready || !connection || connection.status !== "connected") return send(res, 409, { error: "Primero conectá Mercado Pago para Point" });
        if (!current.qr?.storeId || !current.qr?.posId) return send(res, 409, { error: "Primero creá el local y la caja de Mercado Pago" });
        try {
          const accessToken = await mercadoPagoAccessToken(db, current, "point");
          const response = await mercadoPagoClientFor("point").listTerminals({ accessToken });
          const terminals = providerResultList(response?.data || response, "terminals")
            .map(paymentTerminalView)
            .filter((item) => item.id)
            .map((item) => ({ ...item, assignedToCurrentPos: item.storeId === String(current.qr.storeId) && item.posId === String(current.qr.posId) }));
          return send(res, 200, { terminals, configuredTerminalId: current.point?.terminalId || null });
        } catch (error) {
          return send(res, 502, { error: paymentFailure(error).message });
        }
      }

      if (req.method === "POST" && req.url === "/v1/payments/mercado-pago/point/setup") {
        if (!ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede configurar terminales Point" });
        const current = integration();
        const connection = mercadoPagoConnection(current, "point");
        if (!mercadoPagoConfigFor(mercadoPago, "point").ready || !connection || connection.status !== "connected") return send(res, 409, { error: "Primero conectá Mercado Pago para Point" });
        if (!current.qr?.storeId || !current.qr?.posId) return send(res, 409, { error: "Primero creá el local y la caja de Mercado Pago" });
        const payload = await body(req);
        const terminalId = cleanCatalogText(payload.terminalId || "", 80);
        if (!/^[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/.test(terminalId)) return send(res, 400, { error: "El identificador de Point no tiene el formato esperado" });
        try {
          const accessToken = await mercadoPagoAccessToken(db, current, "point");
          const listed = await mercadoPagoClientFor("point").listTerminals({ accessToken });
          const terminals = providerResultList(listed?.data || listed, "terminals").map(paymentTerminalView).filter((item) => item.id);
          const terminal = terminals.find((item) => item.id === terminalId);
          if (!terminal) return send(res, 404, { error: "Ese Point no pertenece a la cuenta de Mercado Pago conectada" });
          if (terminal.storeId !== String(current.qr.storeId) || terminal.posId !== String(current.qr.posId)) {
            return send(res, 409, { error: "Primero asociá este Point con el local y la caja creados por Kiosco+ desde la configuración de Mercado Pago" });
          }
          let configured = terminal;
          if (String(terminal.operatingMode).toUpperCase() !== "PDV") {
            const response = await mercadoPagoClientFor("point").setupTerminals({ accessToken, terminalIds: [terminalId] });
            configured = providerResultList(response, "terminals").map(paymentTerminalView).find((item) => item.id === terminalId)
              || { ...terminal, operatingMode: "PDV" };
          }
          current.point = { terminalId, operatingMode: configured.operatingMode || "PDV", configuredAt: new Date().toISOString(), configuredBy: session.userId };
          current.updatedAt = new Date().toISOString();
          recordSecurityEvent(db, session, tenantId, deviceId, { type: "mercado_pago_point_configured", outcome: "accepted", terminalId });
          await writeDb(db);
          return send(res, 200, { ok: true, terminal: paymentTerminalView(configured), integration: paymentIntegrationView(current, mercadoPago) });
        } catch (error) {
          return send(res, 502, { error: paymentFailure(error).message });
        }
      }

      if (req.method === "DELETE" && req.url.startsWith("/v1/payments/mercado-pago/connection")) {
        if (!ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede desconectar la cuenta de Mercado Pago" });
        const current = integration();
        if (current) {
          const url = new URL(req.url, "http://localhost");
          const requested = String(url.searchParams.get("solution") || "all").toLowerCase();
          const targets = requested === "all" ? ["qr", "point"] : [normalizePaymentSolution(requested)];
          const now = new Date().toISOString();
          for (const solution of targets) {
            const connection = mercadoPagoConnection(current, solution);
            if (!connection) continue;
            delete connection.credentialsEncrypted;
            connection.status = "disconnected";
            connection.disconnectedAt = now;
            connection.updatedAt = now;
            connection.disconnectedBy = session.userId;
          }
          current.updatedAt = now;
          await writeDb(db);
        }
        return send(res, 200, { ok: true, integration: paymentIntegrationView(current, mercadoPago) });
      }

      if (req.method === "POST" && req.url === "/v1/payments/attempts") {
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para cobrar ventas" });
        const payload = await body(req);
        const type = String(payload.type || "").trim().toLowerCase();
        if (!["qr", "point"].includes(type)) return send(res, 400, { error: "El tipo debe ser qr o point" });
        const solutionConfig = mercadoPagoConfigFor(mercadoPago, type);
        if (!solutionConfig.ready) return send(res, 503, { error: `El backend de Mercado Pago para ${type === "point" ? "Point" : "Código QR"} todavía no está habilitado` });
        const currentIntegration = integration();
        const connection = mercadoPagoConnection(currentIntegration, type);
        if (!connection || connection.status !== "connected") return send(res, 409, { error: `Primero conectá Mercado Pago para ${type === "point" ? "Point" : "Código QR"}` });
        const providerTargetId = type === "qr" ? currentIntegration?.qr?.posExternalId : currentIntegration?.point?.terminalId;
        if (!providerTargetId) {
          return send(res, 409, { error: type === "qr"
            ? "Primero creá y vinculá la caja QR desde Configuración > Mercado Pago"
            : "Primero elegí y vinculá el Point desde Configuración > Mercado Pago" });
        }
        const idempotencyKey = cleanCatalogText(req.headers["x-idempotency-key"] || payload.idempotencyKey || "", 120);
        if (idempotencyKey.length < 8) return send(res, 400, { error: "El cobro requiere una clave de idempotencia estable" });
        let amount, orderPayload;
        try {
          orderPayload = type === "qr"
            ? buildQrOrderPayload({ ...payload, externalPosId: providerTargetId, externalReference: payload.externalReference || payload.ticketId }, solutionConfig)
            : buildPointOrderPayload({ ...payload, terminalId: providerTargetId, externalReference: payload.externalReference || payload.ticketId }, solutionConfig);
          amount = Number(orderPayload.total_amount || orderPayload.transactions?.payments?.[0]?.amount);
        }
        catch (error) { return send(res, 400, { error: error.message }); }
        const requestFingerprint = sha256(JSON.stringify(orderPayload));
        const existingAttempt = Object.values(db.paymentAttempts).find((item) => item.tenantId === tenantId && item.provider === "mercado_pago" && item.idempotencyKey === idempotencyKey);
        if (existingAttempt && existingAttempt.requestFingerprint !== requestFingerprint) {
          return send(res, 409, { error: "La clave de reintento ya pertenece a otro cobro" });
        }
        if (existingAttempt?.providerOrderId || (existingAttempt && !["creating", "failed"].includes(existingAttempt.status))) {
          return send(res, 200, { attempt: paymentAttemptView(existingAttempt), replayed: true });
        }
        const id = existingAttempt?.id || crypto.randomUUID();
        const externalReference = orderPayload.external_reference;
        const now = new Date().toISOString();
        const attempt = existingAttempt || {
          id,
          tenantId,
          provider: "mercado_pago",
          type,
          ticketId: null,
          externalReference,
          amount,
          currency: "ARS",
          status: "creating",
          providerStatus: null,
          providerOrderId: null,
          idempotencyKey,
          requestFingerprint,
          createdBy: session.userId,
          deviceId,
          createdAt: now,
          updatedAt: now,
          history: [{ status: "creating", at: now }],
        };
        if (existingAttempt) {
          attempt.status = "creating";
          attempt.failure = null;
          attempt.updatedAt = now;
          attempt.retryCount = Number(attempt.retryCount || 0) + 1;
          attempt.history.push({ status: "creating", action: "idempotent_retry", at: now });
        }
        db.paymentAttempts[id] = attempt;
        // Guardar el intento antes de hablar con el proveedor permite recuperar una
        // respuesta interrumpida repitiendo exactamente la misma clave, sin duplicar cobros.
        await writeDb(db);
        try {
          const accessToken = await mercadoPagoAccessToken(db, currentIntegration, type);
          let order;
          try {
            order = await mercadoPagoClientFor(type).createOrder({ accessToken, payload: orderPayload, idempotencyKey });
          } catch (error) {
            if (type !== "qr" || !isMercadoPagoMissingPosError(error)) throw error;
            const repair = await reconcileMercadoPagoQrSetup({
              integration: currentIntegration,
              tenantId,
              connection,
              accessToken,
              createStoreIfMissing: false,
            });
            if (!repair.repaired) {
              invalidateMercadoPagoQrSetup(currentIntegration, error);
              throw error;
            }
            recordSecurityEvent(db, session, tenantId, deviceId, {
              type: "mercado_pago_qr_auto_repaired", outcome: "accepted",
              storeId: currentIntegration.qr.storeId, posExternalId: currentIntegration.qr.posExternalId,
            });
            await writeDb(db);
            if (currentIntegration.qr.posExternalId !== orderPayload.config.qr.external_pos_id) throw error;
            await new Promise((resolve) => setTimeout(resolve, 300));
            try {
              order = await mercadoPagoClientFor(type).createOrder({ accessToken, payload: orderPayload, idempotencyKey });
            } catch (retryError) {
              if (isMercadoPagoMissingPosError(retryError)) invalidateMercadoPagoQrSetup(currentIntegration, retryError);
              throw retryError;
            }
          }
          updatePaymentAttemptFromOrder(attempt, order);
          attempt.history.push({ status: attempt.status, providerStatus: attempt.providerStatus, at: attempt.updatedAt });
          await writeDb(db);
          return send(res, 201, { attempt: paymentAttemptView(attempt) });
        } catch (error) {
          attempt.status = "failed";
          attempt.failure = paymentFailure(error);
          attempt.updatedAt = new Date().toISOString();
          attempt.history.push({ status: "failed", code: attempt.failure.code, at: attempt.updatedAt });
          console.warn("[mercado-pago] orden rechazada", JSON.stringify({
            attemptId: attempt.id,
            type: attempt.type,
            externalReference: attempt.externalReference,
            failure: attempt.failure,
          }));
          await writeDb(db);
          return send(res, 502, { error: attempt.failure.message, attempt: paymentAttemptView(attempt), integration: paymentIntegrationView(currentIntegration, mercadoPago) });
        }
      }

      if (req.method === "GET" && (req.url === "/v1/payments/attempts" || req.url.startsWith("/v1/payments/attempts?"))) {
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para ver cobros" });
        const url = new URL(req.url, "http://localhost");
        const status = String(url.searchParams.get("status") || "");
        const attempts = Object.values(db.paymentAttempts)
          .filter((item) => item.tenantId === tenantId && (!status || item.status === status))
          .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
          .slice(0, 100)
          .map(paymentAttemptView);
        return send(res, 200, { attempts });
      }

      const attemptMatch = req.url.match(/^\/v1\/payments\/attempts\/([^/?]+)(?:\/(refresh|cancel|refund|complete))?$/);
      if (attemptMatch) {
        const attempt = db.paymentAttempts[decodeURIComponent(attemptMatch[1])];
        if (!attempt || attempt.tenantId !== tenantId) return send(res, 404, { error: "Cobro inexistente" });
        if (req.method === "GET" && !attemptMatch[2]) {
          if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para ver cobros" });
          return send(res, 200, { attempt: paymentAttemptView(attempt) });
        }
        if (req.method !== "POST" || !attemptMatch[2]) return send(res, 405, { error: "Operación no permitida" });
        if (!sessionCanTakePayments(db, session, tenantId)) return send(res, 403, { error: "La cuenta no tiene permiso para administrar cobros" });
        if (attemptMatch[2] === "complete") {
          if (attempt.status !== "approved") return send(res, 409, { error: "El cobro debe estar acreditado antes de vincular la venta" });
          const payload = await body(req);
          const ticketId = cleanCatalogText(payload.ticketId || "", 120);
          const ticketNumber = cleanCatalogText(payload.ticketNumber || ticketId, 80);
          const saleTotal = Math.round(Number(payload.saleTotal || 0) * 100) / 100;
          const mercadoPagoAmount = Math.round(Number(payload.mercadoPagoAmount || attempt.amount || 0) * 100) / 100;
          if (!ticketId || !ticketNumber || !(saleTotal > 0)) return send(res, 400, { error: "Faltan los datos del ticket que completa este cobro" });
          if (Math.abs(mercadoPagoAmount - Number(attempt.amount || 0)) > 0.01) return send(res, 409, { error: "El importe de Mercado Pago no coincide con el cobro acreditado" });
          if (attempt.ticketId && attempt.ticketId !== ticketId) return send(res, 409, { error: "Este cobro ya está vinculado a otro ticket" });
          const linkedElsewhere = Object.values(db.paymentAttempts).find((item) => item.tenantId === tenantId && item.id !== attempt.id && item.ticketId === ticketId);
          if (linkedElsewhere) return send(res, 409, { error: "Ese ticket ya está vinculado a otro cobro" });
          const replayed = attempt.ticketId === ticketId;
          attempt.ticketId = ticketId;
          attempt.ticketNumber = ticketNumber;
          attempt.saleTotal = saleTotal;
          attempt.saleRecordedAt ||= new Date().toISOString();
          attempt.completedBy ||= session.userId;
          attempt.updatedAt = new Date().toISOString();
          if (!replayed) attempt.history.push({ status: attempt.status, action: "sale_linked", ticketId, at: attempt.updatedAt });
          await writeDb(db);
          return send(res, 200, { ok: true, replayed, attempt: paymentAttemptView(attempt) });
        }
        const currentIntegration = integration();
        const solution = normalizePaymentSolution(attempt.type);
        if (!mercadoPagoConfigFor(mercadoPago, solution).ready || !mercadoPagoConnection(currentIntegration, solution) || !attempt.providerOrderId) return send(res, 409, { error: "El cobro todavía no tiene una orden operable en Mercado Pago" });
        if (attemptMatch[2] === "refund" && !ownerRequired()) return send(res, 403, { error: "Sólo el dueño puede devolver un cobro de Mercado Pago" });
        if (attemptMatch[2] === "refund" && attempt.status === "refunded") return send(res, 200, { attempt: paymentAttemptView(attempt), replayed: true });
        if (attemptMatch[2] === "cancel" && ["canceled", "expired"].includes(attempt.status)) return send(res, 200, { attempt: paymentAttemptView(attempt), replayed: true });
        if (attemptMatch[2] === "cancel" && ["approved", "refunded", "charged_back"].includes(attempt.status)) return send(res, 409, { error: "Ese cobro ya no se puede cancelar; si fue acreditado corresponde devolverlo" });
        try {
          const accessToken = await mercadoPagoAccessToken(db, currentIntegration, solution);
          const client = mercadoPagoClientFor(solution);
          let order;
          if (attemptMatch[2] === "refresh") order = await client.getOrder({ accessToken, orderId: attempt.providerOrderId });
          if (attemptMatch[2] === "cancel") {
            attempt.cancelIdempotencyKey ||= crypto.randomUUID();
            order = await client.cancelOrder({ accessToken, orderId: attempt.providerOrderId, idempotencyKey: attempt.cancelIdempotencyKey });
          }
          if (attemptMatch[2] === "refund") {
            if (attempt.status !== "approved") return send(res, 409, { error: "Sólo se puede devolver un cobro acreditado" });
            attempt.refundIdempotencyKey ||= crypto.randomUUID();
            order = await client.refundOrder({ accessToken, orderId: attempt.providerOrderId, idempotencyKey: attempt.refundIdempotencyKey });
          }
          updatePaymentAttemptFromOrder(attempt, order);
          attempt.history.push({ status: attempt.status, providerStatus: attempt.providerStatus, action: attemptMatch[2], at: attempt.updatedAt });
          if (["cancel", "refund"].includes(attemptMatch[2])) recordSecurityEvent(db, session, tenantId, deviceId, {
            type: `mercado_pago_${attemptMatch[2]}`, outcome: "accepted", attemptId: attempt.id, ticketId: attempt.ticketId || null,
          });
          await writeDb(db);
          return send(res, 200, { attempt: paymentAttemptView(attempt) });
        } catch (error) {
          return send(res, 502, { error: paymentFailure(error).message, attempt: paymentAttemptView(attempt) });
        }
      }

      return send(res, 404, { error: "Ruta de pagos inexistente" });
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
        delete db.paymentIntegrations?.[accountId];
        for (const [key, oauth] of Object.entries(db.paymentOauthStates || {})) {
          if (String(oauth?.tenantId || "") === accountId) delete db.paymentOauthStates[key];
        }
        for (const [key, attempt] of Object.entries(db.paymentAttempts || {})) {
          if (String(attempt?.tenantId || "") === accountId) delete db.paymentAttempts[key];
        }
        for (const [key, presentation] of Object.entries(db.paymentPresentations || {})) {
          if (String(presentation?.tenantId || "") === accountId) delete db.paymentPresentations[key];
        }
        for (const [key, event] of Object.entries(db.securityEvents || {})) {
          if (String(event?.tenantId || "") === accountId) delete db.securityEvents[key];
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
        const authorization = syncOperationAuthorization(db, session, tenantId, operation);
        if (!authorization.allowed) {
          const rejection = {
            operationId: operation.id,
            reason: authorization.reason,
            requiredPermissions: authorization.requiredPermissions,
          };
          rejected.push(rejection);
          recordSecurityEvent(db, session, tenantId, deviceId, {
            type: "sync_operation_denied",
            outcome: "denied",
            operationType: String(operation.type || ""),
            target: String(operation.entity || operation.section || operation.key || ""),
            entityId: operation.entityId == null ? null : String(operation.entityId),
            reason: authorization.reason,
            requiredPermissions: authorization.requiredPermissions,
          });
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
          if (operation.key === "cuentas") {
            const previousById = new Map((db.system?.cuentas || []).map((account) => [String(account?.id), account]));
            for (const nextAccount of operation.value || []) {
              revokeChangedAccountSubjects(db, previousById.get(String(nextAccount?.id)), nextAccount, "administrator_updated");
            }
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
        && ((Number.isFinite(oldestAvailableCursor) && since < oldestAvailableCursor - 1)
          || db.changes.some((item) => item.type === "tenant_restore" && item.tenantId === tenantId && Number(item.cursor || 0) > since));
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
      if (!session || !["owner", "superAdmin"].includes(session.role)) return send(res, 403, { error: "Sólo el dueño puede consultar los dispositivos" });
      return send(res, 200, { devices: Object.entries(db.devices).filter(([, device]) => device.tenantId === tenantId).map(([id, device]) => ({ id, ...device })) });
    }
    if (req.method === "POST" && req.url?.startsWith("/v1/devices/revoke")) {
      if (!session || !["owner", "superAdmin"].includes(session.role)) return send(res, 403, { error: "Sólo el dueño puede desactivar dispositivos" });
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
    const statusCode = Number(error?.statusCode);
    if ([400, 413].includes(statusCode)) return send(res, statusCode, { error: error.message });
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
  }, 60 * 1000);
  reminderTimer.unref();
};

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  const forceExit = setTimeout(() => process.exit(1), 5_000);
  forceExit.unref();
  try {
    await new Promise((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
      server.closeIdleConnections?.();
    });
    await postgresStore?.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error(`No se pudo cerrar el servidor después de ${signal}`, error);
    process.exit(1);
  }
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

startServer().catch((error) => {
  console.error("No se pudo iniciar la persistencia cloud", error);
  process.exit(1);
});
