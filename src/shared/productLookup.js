import { cloudFetch, cloudSession } from "../cloud/cloudAuth";
import { loadCloudConfig } from "../cloud/config";

const CACHE_KEY = "kioscoapp-barcode-catalog-v2";
const HIT_TTL = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL = 60 * 60 * 1000;
const MAX_CACHE_ITEMS = 2000;
const ARGENTINA_VERIFIED = {
  "7790895001000": {
    codigo: "7790895001000",
    nombre: "Sprite Lima-Limón Original 2,25 L",
    categoria: "Bebidas",
    descripcionCatalogo: "2,25 L",
    familia: "Sprite",
    variante: "Original 2,25 L",
    unidad: "unidad",
    fuenteCatalogo: "Catálogo argentino verificado de Kiosco+",
  },
  "7891150089983": {
    codigo: "7891150089983",
    nombre: "Rexona Men Clinical Intense Fresh Aerosol 150 ml",
    categoria: "Higiene",
    descripcionCatalogo: "Antitranspirante aerosol 96 h · 150 ml",
    familia: "Rexona Clinical",
    variante: "Men Intense Fresh 150 ml",
    unidad: "unidad",
    fuenteCatalogo: "Catálogo verificado de Kiosco+",
  },
  "7790290101794": {
    codigo: "7790290101794",
    nombre: "Fernet Branca 180.º Aniversario 750 ml",
    categoria: "Bebidas",
    descripcionCatalogo: "Edición limitada · 750 ml",
    familia: "Fernet Branca",
    variante: "180.º Aniversario 750 ml",
    unidad: "unidad",
    fuenteCatalogo: "Catálogo argentino verificado de Kiosco+",
  },
};

const categoryFrom = (product = {}) => {
  const text = `${product.product_type || ""} ${product.category || ""} ${product.categories || ""} ${(product.categories_tags || []).join(" ")}`.toLowerCase();
  if (/beauty|cosmetic|personal care|tooth|soap|shampoo|deodor|hygiene|higiene|dent|jab[oó]n/.test(text)) return "Higiene";
  if (/petfood|pet food|dog|cat|mascota|perro|gato/.test(text)) return "Mascotas";
  if (/clean|detergent|laundry|household|limpieza|lavandina|limpiador/.test(text)) return "Limpieza";
  if (/drink|beverage|water|juice|soda|alcohol|beer|wine|bebida|agua|jugo|gaseosa|fernet|aperitivo|cerveza|vino/.test(text)) return "Bebidas";
  if (/candy|chocolate|snack|sweet|biscuit|cookie|golosina|alfajor|caramelo|gallet/.test(text)) return "Golosinas";
  return "Almacén";
};

function readCache() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}

function cached(code) {
  const entry = readCache()[code];
  if (!entry) return undefined;
  const ttl = entry.value ? HIT_TTL : MISS_TTL;
  return Date.now() - Number(entry.savedAt || 0) < ttl ? entry.value : undefined;
}

function saveCache(code, value) {
  if (typeof window === "undefined") return;
  try {
    const cache = readCache();
    cache[code] = { value, savedAt: Date.now() };
    const entries = Object.entries(cache).sort((a, b) => Number(b[1].savedAt || 0) - Number(a[1].savedAt || 0)).slice(0, MAX_CACHE_ITEMS);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* El catálogo sigue funcionando aunque el navegador no permita caché. */ }
}

export function clearBarcodeCache(code = "") {
  if (typeof window === "undefined") return;
  try {
    if (!code) return window.localStorage.removeItem(CACHE_KEY);
    const cache = readCache();
    delete cache[String(code).replace(/\D/g, "")];
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* La correccion del catalogo no depende de la cache local. */ }
}

function normalizeOpenFacts(product, code, source = "Open Facts") {
  const baseName = product.product_name_es || product.product_name || product.generic_name_es || product.generic_name || "";
  const brand = String(product.brands || "").split(",")[0].trim();
  if (!baseName && !brand) return null;
  return {
    codigo: code,
    nombre: [baseName, brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? brand : ""].filter(Boolean).join(" · ") || `Producto ${code}`,
    categoria: categoryFrom(product),
    imagenUrl: product.image_front_small_url || product.image_front_url || "",
    descripcionCatalogo: product.quantity || "",
    fuenteCatalogo: source,
  };
}

async function lookupOpenFactsUniversal(code) {
  const fields = "code,product_name,product_name_es,generic_name,generic_name_es,brands,categories,categories_tags,image_front_small_url,image_front_url,quantity,product_type";
  const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?product_type=all&cc=ar&lc=es&tags_lc=es&fields=${fields}`);
  if (!response.ok) return null;
  const json = await response.json();
  return normalizeOpenFacts(json.product || json.result?.product, code, "Open Facts universal");
}

async function lookupUpcItemDb(code) {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const json = await response.json();
  const item = json.items?.[0];
  if (!item?.title && !item?.brand) return null;
  const title = String(item.title || "").trim();
  const brand = String(item.brand || "").trim();
  return {
    codigo: code,
    nombre: [title, brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand : ""].filter(Boolean).join(" · ") || `Producto ${code}`,
    categoria: categoryFrom({ category: item.category }),
    imagenUrl: item.images?.[0] || "",
    descripcionCatalogo: item.description || item.size || "",
    fuenteCatalogo: "UPCitemdb",
  };
}

const barcodeCandidates = (code) => {
  const values = [code];
  if (code.length === 12) values.push(`0${code}`);
  if ((code.length === 13 || code.length === 14) && code.startsWith("0")) values.push(code.slice(1));
  return [...new Set(values)];
};

async function lookupSharedCatalog(code) {
  const config = loadCloudConfig();
  const session = cloudSession();
  const tenantId = session?.user?.businessId;
  if (!config.enabled || !config.apiUrl || !session?.accessToken || !tenantId || !config.deviceId) return null;
  const response = await cloudFetch(config.apiUrl, `/v1/catalog/barcodes/${encodeURIComponent(code)}`, {
    headers: {
      "x-device-id": config.deviceId,
      "x-tenant-id": String(tenantId),
    },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.product || null;
}

async function lookupThroughKioscoServer(code) {
  const config = loadCloudConfig();
  if (!config.enabled || !config.apiUrl) return null;
  const response = await fetch(`${String(config.apiUrl).replace(/\/+$/, "")}/v1/catalog/lookup/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.product || null;
}

export async function lookupBarcode(code) {
  const clean = String(code || "").replace(/\D/g, "");
  if (!clean) return null;

  const candidates = barcodeCandidates(clean);
  for (const candidate of candidates) {
    try {
      const learned = await lookupSharedCatalog(candidate);
      if (learned) {
        const found = { ...learned, codigo: clean };
        saveCache(clean, found);
        return found;
      }
    } catch { /* El catálogo local no bloquea las demás fuentes. */ }
  }

  for (const candidate of candidates) {
    if (ARGENTINA_VERIFIED[candidate]) {
      const found = { ...ARGENTINA_VERIFIED[candidate], codigo: clean };
      saveCache(clean, found);
      return found;
    }
  }

  for (const candidate of candidates) {
    try {
      const foundByServer = await lookupThroughKioscoServer(candidate);
      if (foundByServer) {
        const found = { ...foundByServer, codigo: clean };
        saveCache(clean, found);
        return found;
      }
    } catch { /* Si el servidor local no está disponible se prueban las fuentes del navegador. */ }
  }

  const fromCache = cached(clean);
  if (fromCache !== undefined) return fromCache;

  for (const candidate of candidates) {
    for (const source of [lookupOpenFactsUniversal, lookupUpcItemDb]) {
      try {
        const found = await source(candidate);
        if (found) {
          const normalized = { ...found, codigo: clean };
          saveCache(clean, normalized);
          return normalized;
        }
      } catch { /* Si un catálogo falla, se prueba automáticamente el siguiente. */ }
    }
  }
  saveCache(clean, null);
  return null;
}
