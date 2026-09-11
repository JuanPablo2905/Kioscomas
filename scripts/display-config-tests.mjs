import {
  DEFAULT_DISPLAY_CONFIG,
  applyDisplayPreset,
  normalizeDisplayConfig,
  normalizeDisplayPlacement,
  sanitizePublicDisplayContent,
} from "../src/features/ventas/displayConfig.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`FALLÓ: ${message}`);
  console.log(`OK: ${message}`);
};

const defaultConfig = normalizeDisplayConfig(DEFAULT_DISPLAY_CONFIG);
assert(defaultConfig.version === 3 && defaultConfig.placements.idle["promo-top"].width === 96, "el diseño nuevo usa un lienzo libre con ancho y alto independientes");
assert(["sale-items", "sale-total", "sale-payment"].every((id) => defaultConfig.placements.sale[id]), "la lista, el total y el pago son widgets editables durante la venta");

const legacy = normalizeDisplayConfig({
  layouts: {
    idle: { top: ["promo-top"], left: ["weather", "hours"], center: ["welcome"], right: ["socials"], bottom: ["promo-bottom"] },
    sale: { top: ["clock"], left: [], center: [], right: [], bottom: ["promo-sale"] },
    complete: { top: [], left: [], center: [], right: [], bottom: [] },
  },
  widgets: { weather: { size: "hero" }, hours: { size: "small" } },
});
assert(Boolean(legacy.placements.idle.weather) && legacy.placements.idle.weather.height > legacy.placements.idle.hours.height, "los diseños anteriores se convierten sin perder su distribución relativa");
assert(["sale-items", "sale-total", "sale-payment"].every((id) => legacy.placements.sale[id]), "la migración agrega los widgets de venta sin ocultar información existente");

const legacySocials = normalizeDisplayConfig({
  widgets: { socials: { type: "socials", items: [
    { platform: "whatsapp", value: "1122334455", label: "Pedidos" },
    { platform: "instagram", value: "@kiosco", label: "Novedades" },
  ] } },
  placements: { idle: { socials: { x: 74, y: 15, width: 24, height: 68, z: 3 } } },
});
const migratedSocials = Object.values(legacySocials.widgets).filter((item) => item.type === "social");
assert(migratedSocials.length === 2 && migratedSocials.every((item) => legacySocials.placements.idle[item.id]), "cada red del bloque anterior se convierte en un widget independiente");
assert(legacySocials.placements.idle[migratedSocials[0].id].y !== legacySocials.placements.idle[migratedSocials[1].id].y, "las redes migradas reciben cuadros separados sin superponerse");

const clamped = normalizeDisplayPlacement({ x: 92, y: 96, width: 40, height: 30, z: 999 });
assert(clamped.x === 60 && clamped.y === 70 && clamped.z === 100, "los widgets no pueden quedar fuera del lienzo");

const custom = normalizeDisplayConfig({ placements: { idle: { clock: { x: 11.5, y: 20, width: 37.5, height: 18, z: 4 } } } });
assert(custom.placements.idle.clock.x === 11.5 && custom.placements.idle.clock.width === 37.5 && Object.keys(custom.placements.sale).length === 0, "la posición libre se conserva y un modo vacío permanece vacío");

const preset = applyDisplayPreset(custom, "classic");
assert(preset.placements.idle["promo-top"].width === 96 && preset.placements.idle.welcome.height === 70, "un diseño rápido restaura también las posiciones libres");

const sanitized = sanitizePublicDisplayContent({ config: { placements: { idle: { notice: { x: -30, y: 95, width: 200, height: 40, z: -4 } } } } });
assert(sanitized.config.placements.idle.notice.x === 0 && sanitized.config.placements.idle.notice.width === 100, "la pantalla remota recibe solamente coordenadas válidas");

const sanitizedSocial = sanitizePublicDisplayContent({ config: {
  widgets: { "social-test": { id: "social-test", type: "social", platform: "whatsapp", value: "11 2233 4455", label: "Pedinos acá" } },
  placements: { idle: { "social-test": { x: 70, y: 10, width: 25, height: 30, z: 4 } } },
} });
assert(sanitizedSocial.config.widgets["social-test"].platform === "whatsapp" && sanitizedSocial.config.widgets["social-test"].value === "11 2233 4455", "cada pantalla remota conserva el dato de su red individual sin campos privados");

console.log("display-config-tests: lienzo libre verificado");
