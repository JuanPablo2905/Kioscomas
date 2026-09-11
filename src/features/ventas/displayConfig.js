export const DISPLAY_MODES = {
  saleAndAds: "sale-and-ads",
  adsOnly: "ads-only",
  saleOnly: "sale-only",
};

export const DISPLAY_ZONES = ["top", "left", "center", "right", "bottom"];

const LEGACY_WIDGET_SIZES = { small: 75, medium: 100, large: 130, hero: 160 };
export const DISPLAY_PLACEMENT_MIN_WIDTH = 4;
export const DISPLAY_PLACEMENT_MIN_HEIGHT = 5;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const rounded = (value) => Math.round(value * 10) / 10;

export function normalizeDisplayPlacement(value = {}, fallback = {}) {
  const source = value && typeof value === "object" ? value : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const number = (key, legacyKey, defaultValue) => {
    const parsed = Number(source[key] ?? source[legacyKey] ?? base[key] ?? base[legacyKey] ?? defaultValue);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };
  const width = rounded(clamp(number("width", "w", 30), DISPLAY_PLACEMENT_MIN_WIDTH, 100));
  const height = rounded(clamp(number("height", "h", 20), DISPLAY_PLACEMENT_MIN_HEIGHT, 100));
  return {
    x: rounded(clamp(number("x", "left", 0), 0, Math.max(0, 100 - width))),
    y: rounded(clamp(number("y", "top", 0), 0, Math.max(0, 100 - height))),
    width,
    height,
    z: Math.round(clamp(number("z", "order", 1), 1, 100)),
  };
}

export const DISPLAY_SCHEDULE_DAYS = [
  { id: "monday", label: "Lunes", shortLabel: "Lun", jsDay: 1 },
  { id: "tuesday", label: "Martes", shortLabel: "Mar", jsDay: 2 },
  { id: "wednesday", label: "Miércoles", shortLabel: "Mié", jsDay: 3 },
  { id: "thursday", label: "Jueves", shortLabel: "Jue", jsDay: 4 },
  { id: "friday", label: "Viernes", shortLabel: "Vie", jsDay: 5 },
  { id: "saturday", label: "Sábado", shortLabel: "Sáb", jsDay: 6 },
  { id: "sunday", label: "Domingo", shortLabel: "Dom", jsDay: 0 },
];

const safeScheduleTime = (value, fallback) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;

export function normalizeDisplaySchedule(value = []) {
  const entries = Array.isArray(value) ? value : [];
  return DISPLAY_SCHEDULE_DAYS.map((day) => {
    const current = entries.find((entry) => entry?.day === day.id) || {};
    return {
      day: day.id,
      enabled: current.enabled === true,
      open: safeScheduleTime(current.open, "08:00"),
      close: safeScheduleTime(current.close, "20:00"),
    };
  });
}

export const DISPLAY_WIDGET_CATALOG = {
  saleItems: { label: "Lista de la compra", description: "Productos, cantidades y promoción aplicada.", modes: ["sale"] },
  saleTotal: { label: "Total y descuentos", description: "Subtotal, descuentos, ahorro y total a pagar.", modes: ["sale"] },
  salePayment: { label: "Pago y QR", description: "Medio de pago, efectivo, vuelto y código QR.", modes: ["sale"] },
  promotions: { label: "Promociones", description: "Hasta 3 quedan fijas; desde 4 rotan automáticamente." },
  welcome: { label: "Bienvenida", description: "Mensaje principal del negocio." },
  clock: { label: "Hora y fecha", description: "Reloj actualizado en pantalla." },
  weather: { label: "Clima", description: "Temperatura actual de la ciudad elegida." },
  social: { label: "Red social o contacto", description: "Un acceso individual con su color y código QR." },
  hours: { label: "Horarios", description: "Días y horarios de atención." },
  payments: { label: "Medios de pago", description: "Formas de pago aceptadas." },
  notice: { label: "Aviso", description: "Un mensaje breve y personalizado." },
  featuredProduct: { label: "Producto destacado", description: "Un producto elegido con su precio." },
  image: { label: "Imagen", description: "Logo, banner o pieza publicitaria propia." },
};

export const SOCIAL_PLATFORMS = {
  whatsapp: { label: "WhatsApp", color: "#25D366", foreground: "#062a15", prefix: "wa.me/" },
  instagram: { label: "Instagram", color: "#8a3ab9", foreground: "#ffffff", prefix: "instagram.com/" },
  facebook: { label: "Facebook", color: "#1877F2", foreground: "#ffffff", prefix: "facebook.com/" },
  tiktok: { label: "TikTok", color: "#111111", foreground: "#ffffff", prefix: "tiktok.com/@" },
  web: { label: "Sitio web", color: "#2563EB", foreground: "#ffffff", prefix: "" },
  maps: { label: "Ubicación", color: "#EA4335", foreground: "#ffffff", prefix: "" },
  email: { label: "Correo", color: "#D96B32", foreground: "#ffffff", prefix: "" },
  phone: { label: "Teléfono", color: "#1C4A44", foreground: "#ffffff", prefix: "" },
};

const widget = (id, type, extra = {}) => ({ id, type, enabled: true, ...extra });

export const DEFAULT_DISPLAY_CONFIG = {
  version: 3,
  operationMode: DISPLAY_MODES.saleAndAds,
  preset: "classic",
  layouts: {
    idle: {
      top: ["promo-top"],
      left: ["weather"],
      center: ["welcome"],
      right: [],
      bottom: ["promo-bottom"],
    },
    sale: { top: ["clock"], left: [], center: [], right: [], bottom: ["promo-sale"] },
    complete: { top: ["clock"], left: [], center: [], right: [], bottom: [] },
  },
  placements: {
    idle: {
      "promo-top": { x: 2, y: 2, width: 96, height: 10, z: 1 },
      weather: { x: 2, y: 14, width: 21, height: 31, z: 2 },
      welcome: { x: 25, y: 14, width: 50, height: 70, z: 1 },
      "promo-bottom": { x: 2, y: 88, width: 96, height: 10, z: 1 },
    },
    sale: {
      clock: { x: 2, y: 2, width: 22, height: 11, z: 2 },
      "sale-items": { x: 2, y: 15, width: 61, height: 67, z: 1 },
      "sale-total": { x: 65, y: 15, width: 33, height: 30, z: 1 },
      "sale-payment": { x: 65, y: 47, width: 33, height: 35, z: 1 },
      "promo-sale": { x: 2, y: 84, width: 70, height: 14, z: 2 },
    },
    complete: {
      clock: { x: 2, y: 2, width: 24, height: 12, z: 2 },
    },
  },
  widgets: {
    "promo-top": widget("promo-top", "promotions", { style: "strip" }),
    "promo-bottom": widget("promo-bottom", "promotions", { style: "strip" }),
    "promo-sale": widget("promo-sale", "promotions", { style: "strip" }),
    "sale-items": widget("sale-items", "saleItems"),
    "sale-total": widget("sale-total", "saleTotal"),
    "sale-payment": widget("sale-payment", "salePayment"),
    welcome: widget("welcome", "welcome"),
    clock: widget("clock", "clock"),
    weather: widget("weather", "weather", { city: "", latitude: null, longitude: null }),
    hours: widget("hours", "hours", { text: "", schedule: normalizeDisplaySchedule() }),
    payments: widget("payments", "payments", { items: ["Efectivo", "Mercado Pago", "Tarjeta"] }),
    notice: widget("notice", "notice", { title: "", text: "" }),
    featured: widget("featured", "featuredProduct", { productId: "" }),
    image: widget("image", "image", { src: "", alt: "Publicidad" }),
  },
};

export const DISPLAY_PRESETS = {
  classic: {
    label: "Clásica",
    layouts: DEFAULT_DISPLAY_CONFIG.layouts,
  },
  promotions: {
    label: "Promociones protagonistas",
    layouts: {
      idle: { top: ["promo-top"], left: [], center: ["welcome"], right: [], bottom: ["promo-bottom"] },
      sale: { top: ["promo-sale"], left: [], center: [], right: [], bottom: [] },
      complete: { top: ["promo-top"], left: [], center: [], right: [], bottom: [] },
    },
  },
  information: {
    label: "Información útil",
    layouts: {
      idle: { top: ["promo-top"], left: ["weather", "hours"], center: ["welcome"], right: ["payments"], bottom: ["promo-bottom"] },
      sale: { top: ["clock", "weather"], left: [], center: [], right: [], bottom: ["payments"] },
      complete: { top: ["clock"], left: [], center: [], right: [], bottom: [] },
    },
  },
  minimal: {
    label: "Minimalista",
    layouts: {
      idle: { top: [], left: [], center: ["welcome"], right: [], bottom: [] },
      sale: { top: ["clock"], left: [], center: [], right: [], bottom: [] },
      complete: { top: [], left: [], center: [], right: [], bottom: [] },
    },
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const cleanText = (value, max = 160) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
const safeImage = (value) => {
  const source = String(value || "");
  if (source.startsWith("data:image/") && source.length <= 1_500_000) return source;
  if (/^https:\/\//i.test(source) && source.length <= 800) return source;
  return "";
};

const zoneBounds = (mode, zone) => {
  if (mode !== "idle") {
    if (zone === "top") return { x: 2, y: 2, width: 96, height: 12 };
    if (zone === "bottom") return { x: 2, y: 82, width: 96, height: 16 };
  }
  return {
    top: { x: 2, y: 2, width: 96, height: 10 },
    left: { x: 2, y: 14, width: 21, height: 70 },
    center: { x: 25, y: 14, width: 50, height: 70 },
    right: { x: 77, y: 14, width: 21, height: 70 },
    bottom: { x: 2, y: 88, width: 96, height: 10 },
  }[zone] || { x: 25, y: 25, width: 50, height: 40 };
};

function placementsFromLayouts(layouts, widgets) {
  const placements = { idle: {}, sale: {}, complete: {} };
  for (const mode of Object.keys(placements)) {
    let z = 1;
    for (const zone of DISPLAY_ZONES) {
      const ids = Array.isArray(layouts?.[mode]?.[zone]) ? layouts[mode][zone].filter((id) => widgets[id]) : [];
      if (!ids.length) continue;
      const bounds = zoneBounds(mode, zone);
      const horizontal = zone === "top" || zone === "bottom";
      const gap = ids.length > 1 ? 1.5 : 0;
      const weights = ids.map((id) => {
        const legacy = widgets[id]?.legacySizePercent ?? widgets[id]?.sizePercent ?? LEGACY_WIDGET_SIZES[widgets[id]?.size] ?? 100;
        return Math.max(1, Number(legacy) || 100);
      });
      const weightTotal = weights.reduce((total, weight) => total + weight, 0);
      const available = (horizontal ? bounds.width : bounds.height) - gap * (ids.length - 1);
      let cursor = horizontal ? bounds.x : bounds.y;
      ids.forEach((id, index) => {
        const extent = available * (weights[index] / weightTotal);
        placements[mode][id] = normalizeDisplayPlacement(horizontal
          ? { x: cursor, y: bounds.y, width: extent, height: bounds.height, z }
          : { x: bounds.x, y: cursor, width: bounds.width, height: extent, z });
        cursor += extent + gap;
        z += 1;
      });
    }
  }
  return placements;
}

const normalizeSocialWidget = (id, item = {}) => ({
  id,
  type: "social",
  enabled: item.enabled !== false,
  platform: SOCIAL_PLATFORMS[item.platform] ? item.platform : "whatsapp",
  value: String(item.value || "").slice(0, 180),
  label: String(item.label || "").slice(0, 80),
});

const availableSocialId = (widgets, item, index) => {
  const platform = SOCIAL_PLATFORMS[item?.platform] ? item.platform : "web";
  const base = `social-${platform}-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (widgets[id]) { id = `${base}-${suffix}`; suffix += 1; }
  return id;
};

function splitLegacySocialPlacement(value, ids) {
  const base = normalizeDisplayPlacement(value);
  if (ids.length <= 1) return ids.length ? { [ids[0]]: base } : {};
  const columns = base.width > base.height * 1.2 ? Math.min(3, ids.length) : ids.length > 4 ? 2 : 1;
  const rows = Math.ceil(ids.length / columns);
  const gap = 1;
  const cellWidth = (base.width - gap * (columns - 1)) / columns;
  const cellHeight = (base.height - gap * (rows - 1)) / rows;
  return Object.fromEntries(ids.map((id, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return [id, normalizeDisplayPlacement({
      x: base.x + column * (cellWidth + gap),
      y: base.y + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      z: Math.min(100, base.z + index),
    })];
  }));
}

export function normalizeDisplayConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = clone(DEFAULT_DISPLAY_CONFIG);
  normalized.version = 3;
  normalized.operationMode = Object.values(DISPLAY_MODES).includes(source.operationMode) ? source.operationMode : normalized.operationMode;
  normalized.preset = source.preset === "custom" || DISPLAY_PRESETS[source.preset] ? source.preset : normalized.preset;
  for (const [id, item] of Object.entries(source.widgets || {})) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "social") {
      normalized.widgets[id] = normalizeSocialWidget(id, item);
      continue;
    }
    if (!normalized.widgets[id]) continue;
    normalized.widgets[id] = { ...normalized.widgets[id], ...item, id, type: normalized.widgets[id].type };
    if (item.sizePercent != null || item.size != null) normalized.widgets[id].legacySizePercent = Object.prototype.hasOwnProperty.call(LEGACY_WIDGET_SIZES, item.size)
      ? LEGACY_WIDGET_SIZES[item.size]
      : Math.max(1, Number(item.sizePercent) || 100);
    delete normalized.widgets[id].sizePercent;
    delete normalized.widgets[id].size;
  }
  const legacySocialIds = [];
  const legacySocialItems = Array.isArray(source.widgets?.socials?.items) ? source.widgets.socials.items.slice(0, 12) : [];
  for (const [index, item] of legacySocialItems.entries()) {
    if (!item || typeof item !== "object") continue;
    const id = availableSocialId(normalized.widgets, item, index);
    normalized.widgets[id] = normalizeSocialWidget(id, item);
    legacySocialIds.push(id);
  }
  normalized.widgets.hours.schedule = normalizeDisplaySchedule(normalized.widgets.hours.schedule);
  for (const mode of ["idle", "sale", "complete"]) {
    for (const zone of DISPLAY_ZONES) {
      const ids = source.layouts?.[mode]?.[zone];
      if (Array.isArray(ids)) normalized.layouts[mode][zone] = [...new Set(ids.flatMap((id) => String(id) === "socials" ? legacySocialIds : [String(id)]).filter((id) => normalized.widgets[id]))].slice(0, 16);
    }
  }
  const hasFreeLayout = source.placements && typeof source.placements === "object";
  if (hasFreeLayout) {
    normalized.placements = { idle: {}, sale: {}, complete: {} };
    for (const mode of Object.keys(normalized.placements)) {
      for (const [id, placement] of Object.entries(source.placements?.[mode] || {})) {
        if (id === "socials") {
          Object.assign(normalized.placements[mode], splitLegacySocialPlacement(placement, legacySocialIds));
          continue;
        }
        if (!normalized.widgets[id]) continue;
        normalized.placements[mode][id] = normalizeDisplayPlacement(placement);
      }
    }
  } else if (source.layouts && typeof source.layouts === "object") {
    normalized.placements = placementsFromLayouts(normalized.layouts, normalized.widgets);
    for (const id of ["sale-items", "sale-total", "sale-payment"]) normalized.placements.sale[id] = clone(DEFAULT_DISPLAY_CONFIG.placements.sale[id]);
  }
  for (const item of Object.values(normalized.widgets)) delete item.legacySizePercent;
  return normalized;
}

export function applyDisplayPreset(config, preset) {
  const normalized = normalizeDisplayConfig(config);
  const selected = DISPLAY_PRESETS[preset] || DISPLAY_PRESETS.classic;
  const layouts = clone(selected.layouts);
  const placements = preset === "classic" || !DISPLAY_PRESETS[preset]
    ? clone(DEFAULT_DISPLAY_CONFIG.placements)
    : placementsFromLayouts(layouts, normalized.widgets);
  for (const id of ["sale-items", "sale-total", "sale-payment"]) placements.sale[id] = clone(DEFAULT_DISPLAY_CONFIG.placements.sale[id]);
  const socialIds = Object.values(normalized.widgets).filter((item) => item.type === "social").map((item) => item.id);
  for (const mode of ["idle", "sale", "complete"]) {
    for (const id of socialIds) {
      if (!normalized.placements?.[mode]?.[id]) continue;
      placements[mode][id] = clone(normalized.placements[mode][id]);
      const zone = mode === "idle" ? "right" : "bottom";
      if (!layouts[mode][zone].includes(id)) layouts[mode][zone].push(id);
    }
  }
  return { ...normalized, preset: DISPLAY_PRESETS[preset] ? preset : "classic", layouts, placements };
}

export function moveDisplayWidget(config, mode, widgetId, destination, position = null) {
  const next = normalizeDisplayConfig(config);
  if (!next.layouts[mode] || !DISPLAY_ZONES.includes(destination) || !next.widgets[widgetId]) return next;
  for (const zone of DISPLAY_ZONES) next.layouts[mode][zone] = next.layouts[mode][zone].filter((id) => id !== widgetId);
  const items = next.layouts[mode][destination];
  const index = position == null ? items.length : Math.max(0, Math.min(items.length, Number(position) || 0));
  items.splice(index, 0, widgetId);
  next.preset = "custom";
  next.placements = placementsFromLayouts(next.layouts, next.widgets);
  return next;
}

export function sanitizePublicDisplayContent(value = {}) {
  const config = normalizeDisplayConfig(value.config || value);
  const widgets = {};
  for (const [id, raw] of Object.entries(config.widgets)) {
    const type = DISPLAY_WIDGET_CATALOG[raw?.type] ? raw.type : "notice";
    widgets[id] = {
      id: cleanText(id, 80), type, enabled: raw?.enabled !== false,
      style: raw?.style === "card" ? "card" : "strip",
      city: cleanText(raw?.city, 100),
      latitude: raw?.latitude !== null && raw?.latitude !== "" && Number.isFinite(Number(raw?.latitude)) ? Number(raw.latitude) : null,
      longitude: raw?.longitude !== null && raw?.longitude !== "" && Number.isFinite(Number(raw?.longitude)) ? Number(raw.longitude) : null,
      text: cleanText(raw?.text, 300), title: cleanText(raw?.title, 100),
      productId: cleanText(raw?.productId, 100), src: safeImage(raw?.src), alt: cleanText(raw?.alt, 100),
      platform: type === "social" && SOCIAL_PLATFORMS[raw?.platform] ? raw.platform : "",
      value: type === "social" ? cleanText(raw?.value, 180) : "",
      label: type === "social" ? cleanText(raw?.label, 80) : "",
      schedule: type === "hours" ? normalizeDisplaySchedule(raw?.schedule) : [],
      items: Array.isArray(raw?.items) ? raw.items.slice(0, 12).map((item) => typeof item === "string"
        ? cleanText(item, 80)
        : { platform: SOCIAL_PLATFORMS[item?.platform] ? item.platform : "web", value: cleanText(item?.value, 180), label: cleanText(item?.label, 80) }) : [],
    };
  }
  config.widgets = widgets;
  return {
    version: 3,
    config,
    businessName: cleanText(value.businessName, 100),
    businessImage: safeImage(value.businessImage),
    welcomeMessage: cleanText(value.welcomeMessage, 100),
    thanksMessage: cleanText(value.thanksMessage, 120),
    contactLine: cleanText(value.contactLine, 160),
    slideSeconds: Math.max(4, Math.min(60, Number(value.slideSeconds) || 8)),
    rotation: value.rotation === "random" ? "random" : "ordered",
    promotions: Array.isArray(value.promotions) ? value.promotions.slice(0, 30).map((entry) => ({
      id: cleanText(entry?.id, 100), title: cleanText(entry?.title, 100), description: cleanText(entry?.description, 220),
      badge: cleanText(entry?.badge, 30), image: safeImage(entry?.image), productNames: Array.isArray(entry?.productNames) ? entry.productNames.slice(0, 8).map((name) => cleanText(name, 80)) : [],
    })) : [],
    featuredProducts: Array.isArray(value.featuredProducts) ? value.featuredProducts.slice(0, 20).map((entry) => ({ id: cleanText(entry?.id, 100), name: cleanText(entry?.name, 100), price: Math.max(0, Number(entry?.price) || 0), image: safeImage(entry?.image) })) : [],
  };
}

export function socialDestination(item = {}) {
  const value = String(item.value || "").trim();
  if (!value) return "";
  if (item.platform === "whatsapp") return `https://wa.me/${value.replace(/\D/g, "")}`;
  if (item.platform === "instagram") return `https://instagram.com/${value.replace(/^@/, "")}`;
  if (item.platform === "facebook") return /^https?:\/\//i.test(value) ? value : `https://facebook.com/${value.replace(/^@/, "")}`;
  if (item.platform === "tiktok") return `https://tiktok.com/@${value.replace(/^@/, "")}`;
  if (item.platform === "email") return `mailto:${value}`;
  if (item.platform === "phone") return `tel:${value.replace(/[^+\d]/g, "")}`;
  if (item.platform === "maps") return /^https?:\/\//i.test(value) ? value : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
