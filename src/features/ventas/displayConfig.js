export const DISPLAY_MODES = {
  saleAndAds: "sale-and-ads",
  adsOnly: "ads-only",
  saleOnly: "sale-only",
};

export const DISPLAY_ZONES = ["top", "left", "center", "right", "bottom"];

export const DISPLAY_WIDGET_SIZE_MIN = 60;
export const DISPLAY_WIDGET_SIZE_MAX = 180;
const LEGACY_WIDGET_SIZES = { small: 75, medium: 100, large: 130, hero: 160 };

export function normalizeDisplayWidgetSize(value) {
  const migrated = Object.prototype.hasOwnProperty.call(LEGACY_WIDGET_SIZES, value)
    ? LEGACY_WIDGET_SIZES[value]
    : Number(value);
  if (!Number.isFinite(migrated)) return 100;
  return Math.max(DISPLAY_WIDGET_SIZE_MIN, Math.min(DISPLAY_WIDGET_SIZE_MAX, Math.round(migrated)));
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
  promotions: { label: "Promociones", description: "Hasta 3 quedan fijas; desde 4 rotan automáticamente." },
  welcome: { label: "Bienvenida", description: "Mensaje principal del negocio." },
  clock: { label: "Hora y fecha", description: "Reloj actualizado en pantalla." },
  weather: { label: "Clima", description: "Temperatura actual de la ciudad elegida." },
  socials: { label: "Redes y contacto", description: "WhatsApp, Instagram, web y otros accesos listos." },
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

const widget = (id, type, extra = {}) => ({ id, type, enabled: true, sizePercent: 100, ...extra });

export const DEFAULT_DISPLAY_CONFIG = {
  version: 1,
  operationMode: DISPLAY_MODES.saleAndAds,
  preset: "classic",
  layouts: {
    idle: {
      top: ["promo-top"],
      left: ["weather"],
      center: ["welcome"],
      right: ["socials"],
      bottom: ["promo-bottom"],
    },
    sale: { top: ["clock"], left: [], center: [], right: [], bottom: ["promo-sale", "socials"] },
    complete: { top: ["clock"], left: [], center: [], right: [], bottom: ["socials"] },
  },
  widgets: {
    "promo-top": widget("promo-top", "promotions", { style: "strip" }),
    "promo-bottom": widget("promo-bottom", "promotions", { style: "strip" }),
    "promo-sale": widget("promo-sale", "promotions", { style: "strip" }),
    welcome: widget("welcome", "welcome"),
    clock: widget("clock", "clock"),
    weather: widget("weather", "weather", { city: "", latitude: null, longitude: null }),
    socials: widget("socials", "socials", { items: [] }),
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
      sale: { top: ["promo-sale"], left: [], center: [], right: [], bottom: ["socials"] },
      complete: { top: ["promo-top"], left: [], center: [], right: [], bottom: ["socials"] },
    },
  },
  information: {
    label: "Información útil",
    layouts: {
      idle: { top: ["promo-top"], left: ["weather", "hours"], center: ["welcome"], right: ["socials", "payments"], bottom: ["promo-bottom"] },
      sale: { top: ["clock", "weather"], left: [], center: [], right: [], bottom: ["payments", "socials"] },
      complete: { top: ["clock"], left: [], center: [], right: [], bottom: ["socials"] },
    },
  },
  minimal: {
    label: "Minimalista",
    layouts: {
      idle: { top: [], left: [], center: ["welcome"], right: [], bottom: ["socials"] },
      sale: { top: ["clock"], left: [], center: [], right: [], bottom: [] },
      complete: { top: [], left: [], center: [], right: [], bottom: ["socials"] },
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

export function normalizeDisplayConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = clone(DEFAULT_DISPLAY_CONFIG);
  normalized.operationMode = Object.values(DISPLAY_MODES).includes(source.operationMode) ? source.operationMode : normalized.operationMode;
  normalized.preset = DISPLAY_PRESETS[source.preset] ? source.preset : normalized.preset;
  for (const [id, item] of Object.entries(source.widgets || {})) {
    if (!normalized.widgets[id] || !item || typeof item !== "object") continue;
    normalized.widgets[id] = { ...normalized.widgets[id], ...item, id, type: normalized.widgets[id].type };
    normalized.widgets[id].sizePercent = normalizeDisplayWidgetSize(item.sizePercent ?? item.size);
    delete normalized.widgets[id].size;
  }
  normalized.widgets.hours.schedule = normalizeDisplaySchedule(normalized.widgets.hours.schedule);
  for (const mode of ["idle", "sale", "complete"]) {
    for (const zone of DISPLAY_ZONES) {
      const ids = source.layouts?.[mode]?.[zone];
      if (Array.isArray(ids)) normalized.layouts[mode][zone] = [...new Set(ids.map(String).filter((id) => normalized.widgets[id]))].slice(0, 8);
    }
  }
  return normalized;
}

export function applyDisplayPreset(config, preset) {
  const normalized = normalizeDisplayConfig(config);
  const selected = DISPLAY_PRESETS[preset] || DISPLAY_PRESETS.classic;
  return { ...normalized, preset: DISPLAY_PRESETS[preset] ? preset : "classic", layouts: clone(selected.layouts) };
}

export function moveDisplayWidget(config, mode, widgetId, destination, position = null) {
  const next = normalizeDisplayConfig(config);
  if (!next.layouts[mode] || !DISPLAY_ZONES.includes(destination) || !next.widgets[widgetId]) return next;
  for (const zone of DISPLAY_ZONES) next.layouts[mode][zone] = next.layouts[mode][zone].filter((id) => id !== widgetId);
  const items = next.layouts[mode][destination];
  const index = position == null ? items.length : Math.max(0, Math.min(items.length, Number(position) || 0));
  items.splice(index, 0, widgetId);
  next.preset = "custom";
  return next;
}

export function sanitizePublicDisplayContent(value = {}) {
  const config = normalizeDisplayConfig(value.config || value);
  const widgets = {};
  for (const [id, raw] of Object.entries(config.widgets)) {
    const type = DISPLAY_WIDGET_CATALOG[raw?.type] ? raw.type : "notice";
    widgets[id] = {
      id: cleanText(id, 80), type, enabled: raw?.enabled !== false,
      sizePercent: normalizeDisplayWidgetSize(raw?.sizePercent ?? raw?.size),
      style: raw?.style === "card" ? "card" : "strip",
      city: cleanText(raw?.city, 100),
      latitude: raw?.latitude !== null && raw?.latitude !== "" && Number.isFinite(Number(raw?.latitude)) ? Number(raw.latitude) : null,
      longitude: raw?.longitude !== null && raw?.longitude !== "" && Number.isFinite(Number(raw?.longitude)) ? Number(raw.longitude) : null,
      text: cleanText(raw?.text, 300), title: cleanText(raw?.title, 100),
      productId: cleanText(raw?.productId, 100), src: safeImage(raw?.src), alt: cleanText(raw?.alt, 100),
      schedule: type === "hours" ? normalizeDisplaySchedule(raw?.schedule) : [],
      items: Array.isArray(raw?.items) ? raw.items.slice(0, 12).map((item) => typeof item === "string"
        ? cleanText(item, 80)
        : { platform: SOCIAL_PLATFORMS[item?.platform] ? item.platform : "web", value: cleanText(item?.value, 180), label: cleanText(item?.label, 80) }) : [],
    };
  }
  config.widgets = widgets;
  return {
    version: 1,
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
