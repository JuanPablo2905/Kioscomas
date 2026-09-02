import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { mergeConcurrentEntity } from "../src/cloud/conflictMerge.js";
import { createPostgresStore } from "./postgres-record-store.mjs";

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
const accessTokenExpiresAt = () => new Date(Date.now() + accessTokenTtlMs).toISOString();
const refreshTokenExpiresAt = () => new Date(Date.now() + refreshTokenTtlMs).toISOString();
const emptyDb = () => ({ schemaVersion: 4, cursor: 0, accepted: {}, system: {}, tenants: {}, changes: [], devices: {}, users: {}, sessions: {}, barcodeCatalog: {}, activationCodes: {}, activations: {} });
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
  return applyConfiguredSuperAdmin(hydrateBarcodeCatalog({ ...emptyDb(), ...saved, system: saved.system || {}, barcodeCatalog: saved.barcodeCatalog || {}, activationCodes: saved.activationCodes || {}, activations: saved.activations || {} }));
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
  db.sessions = compactSessions(db.sessions);
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
    role: "superAdmin",
    salt: secured.salt,
    adminSecretSalt: secured.salt,
    passwordHash: secured.hash,
    status: "active",
  };
  return db;
};
const token = () => crypto.randomBytes(32).toString("base64url");
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
  const subscriptionExpiresAt = Date.parse(account.subscriptionExpiresAt || "");
  if (Number.isFinite(subscriptionExpiresAt)) return subscriptionExpiresAt > Date.now();
  const trialExpiresAt = Date.parse(account.trialExpiresAt || "");
  if (Number.isFinite(trialExpiresAt) && trialExpiresAt > Date.now()) return true;
  return account.estado === "aprobada";
};
const isLoopback = (req) => {
  const address = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
};

const handleRequest = async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.url === "/v1/health") return send(res, 200, {
      ok: true,
      service: "kiosco-cloud-local",
      schemaVersion: 4,
      localMode,
      persistence: postgresStore ? "postgresql" : "json",
      revision: String(process.env.RENDER_GIT_COMMIT || "local").slice(0, 12),
      time: new Date().toISOString(),
    });
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
    if (req.method === "POST" && req.url === "/v1/auth/register") {
      const payload = await body(req);
      const deviceId = cleanActivationDeviceId(payload.deviceId);
      const username = cleanCatalogText(payload.username, 80);
      const password = String(payload.password || "");
      const name = cleanCatalogText(payload.name, 100);
      const businessName = cleanCatalogText(payload.businessName, 140);
      const businessMode = payload.businessMode === "equipo" ? "equipo" : "solo";
      if (!deviceId || !username || password.length < 4 || !name || !businessName) {
        return send(res, 400, { error: "Completá el nombre, negocio, usuario y una contraseña de al menos 4 caracteres" });
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

      const businessId = crypto.randomUUID();
      const now = new Date().toISOString();
      const account = {
        id: businessId,
        tenantId: businessId,
        nombre: name,
        usuario: username,
        nombreNegocio: businessName,
        modoNegocio: businessMode,
        superAdmin: false,
        estado: "pendiente",
        roles: [],
        empleados: [],
        pagos: [],
        createdAt: now,
        registrationDeviceId: deviceId,
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
      await writeDb(db);
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
    }
    db.devices[deviceId] = { ...(db.devices[deviceId] || {}), tenantId, lastSeenAt: new Date().toISOString() };

    if (!["GET", "OPTIONS"].includes(req.method) && session?.role !== "superAdmin" && !req.url.startsWith("/v1/admin/") && !accountCanWrite(db, tenantId)) {
      return send(res, 403, { error: "El abono está vencido. La cuenta se encuentra en modo consulta." });
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
            const operationCreatedAt = Date.parse(operation.createdAt || "") || Date.now();
            const incomingAccounts = operation.value.filter((account) => account && !account.superAdmin);
            const incomingIds = new Set(incomingAccounts.map((account) => String(account.id)));
            const removedIds = new Set(
              (Array.isArray(operation.removedAccountIds) ? operation.removedAccountIds : [])
                .map((id) => String(id)),
            );
            // Las versiones viejas publicaban la lista completa y una PC sin
            // datos podía mandar un arreglo vacío. Sólo se elimina un negocio
            // cuando la operación nueva declara su id expresamente.
            const preservedAccounts = (db.system.cuentas || []).filter((account) => {
              const id = String(account?.id);
              if (account?.superAdmin || incomingIds.has(id)) return false;
              const registeredAfterOperation = account?.registrationDeviceId
                && Date.parse(account.createdAt || "") > operationCreatedAt;
              return !removedIds.has(id) || registeredAfterOperation;
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
      await writeDb(db);
      return send(res, 200, { acceptedIds, acceptedEntityVersions, conflicts, rejected, cursor: db.cursor });
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
  server.listen(port, "0.0.0.0", () => {
    console.log(`Kiosco Cloud activo en el puerto ${port} · persistencia: ${postgresStore ? "PostgreSQL" : dataDirectory}`);
  });
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
