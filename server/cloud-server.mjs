import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { mergeConcurrentEntity } from "../src/cloud/conflictMerge.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const databasePath = process.env.KIOSCO_CLOUD_DB || path.join(root, "cloud-dev-data", "database.json");
const dataDirectory = process.env.KIOSCO_CLOUD_DATA_DIR || path.dirname(databasePath);
// Render and most cloud hosts provide the public port through PORT.
// KIOSCO_CLOUD_PORT remains available for the local desktop server.
const port = Number(process.env.PORT || process.env.KIOSCO_CLOUD_PORT || 8787);
const localMode = process.env.KIOSCO_LOCAL_MODE !== "0";
const configuredSuperAdminUsername = String(process.env.KIOSCO_SUPERADMIN_USERNAME || "").trim();
const configuredSuperAdminPassword = String(process.env.KIOSCO_SUPERADMIN_PASSWORD || "");
const emptyDb = () => ({ schemaVersion: 3, cursor: 0, accepted: {}, system: {}, tenants: {}, changes: [], devices: {}, users: {}, sessions: {}, barcodeCatalog: {} });
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
const readDb = async () => {
  try {
    const saved = JSON.parse(await fs.readFile(databasePath, "utf8"));
    return applyConfiguredSuperAdmin(hydrateBarcodeCatalog({ ...emptyDb(), ...saved, system: saved.system || {}, barcodeCatalog: saved.barcodeCatalog || {} }));
  } catch {
    return applyConfiguredSuperAdmin(emptyDb());
  }
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
      schemaVersion: 3,
      localMode,
      revision: String(process.env.RENDER_GIT_COMMIT || "local").slice(0, 12),
      time: new Date().toISOString(),
    });
    if (req.url?.startsWith("/v1/releases/latest")) {
      const channel = new URL(req.url, "http://localhost").searchParams.get("channel") || "stable";
      return send(res, 200, {
        channel,
        version: "0.1.0",
        mandatory: false,
        notes: ["Respaldo central local", "Sincronización por negocio"],
        downloadUrl: null,
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
      const user = db.users[payload.username];
      if (!user || user.status !== "active" || !verifyPassword(payload.password, user)) return send(res, 401, { error: "Credenciales incorrectas" });
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.sessions[accessToken] = {
        userId: user.id,
        businessId: user.businessId,
        deviceId: payload.deviceId,
        role: user.role,
        expiresAt,
        refreshHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null,
      };
      db.devices[payload.deviceId] = { tenantId: user.businessId, userId: user.id, lastSeenAt: new Date().toISOString(), revokedAt: null };
      await writeDb(db);
      return send(res, 200, { accessToken, refreshToken, expiresAt, user: { id: user.id, name: user.name, role: user.role, businessId: user.businessId } });
    }
    if (req.method === "POST" && req.url === "/v1/auth/refresh") {
      const payload = await body(req);
      const db = await readDb();
      const hash = crypto.createHash("sha256").update(String(payload.refreshToken || "")).digest("hex");
      const entry = Object.entries(db.sessions).find(([, session]) => session.refreshHash === hash && !session.revokedAt);
      if (!entry) return send(res, 401, { error: "Sesión inválida" });
      const [, old] = entry;
      old.revokedAt = new Date().toISOString();
      const accessToken = token();
      const refreshToken = token();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.sessions[accessToken] = {
        ...old,
        expiresAt,
        refreshHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null,
      };
      await writeDb(db);
      return send(res, 200, { accessToken, refreshToken, expiresAt });
    }
    if (req.method === "POST" && req.url === "/v1/auth/logout") {
      const db = await readDb();
      const session = activeSession(db, req);
      if (session) {
        session.revokedAt = new Date().toISOString();
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
      db.changes = db.changes.slice(-10000);
      await writeDb(db);
      return send(res, 200, { acceptedIds, acceptedEntityVersions, conflicts, rejected, cursor: db.cursor });
    }
    if (req.method === "GET" && req.url?.startsWith("/v1/sync/pull")) {
      const since = Number(new URL(req.url, "http://localhost").searchParams.get("since") || 0);
      return send(res, 200, {
        cursor: db.cursor,
        operations: db.changes.filter((item) => item.tenantId === tenantId && item.cursor > since && item.deviceId !== deviceId),
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
    return send(res, 500, { error: "Error interno del servidor local" });
  }
};

// The current persistence adapter stores the whole database as JSON. Two HTTP
// requests that read the same snapshot and then write concurrently can lose an
// accepted sale even if their entity merge is correct. Serialize every request
// that may read or mutate that database until PostgreSQL replaces this adapter.
// Public health/metadata endpoints stay outside the queue.
let databaseRequestMutation = Promise.resolve();
const bypassDatabaseQueue = (req) => req.method === "OPTIONS"
  || req.url === "/v1/health"
  || req.url?.startsWith("/v1/releases/latest")
  || req.url === "/v1/catalog/providers";

const server = http.createServer((req, res) => {
  const run = () => handleRequest(req, res);
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
server.listen(port, "0.0.0.0", () => {
  console.log(`Kiosco Cloud activo en el puerto ${port} · datos: ${dataDirectory}`);
});
