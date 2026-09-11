import { readFileSync } from "node:fs";
import { calculateAdaptiveWelcomeLayout } from "../src/features/ventas/adaptiveWelcomeLayout.js";

const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`OK: ${message}`);
};

const normal = calculateAdaptiveWelcomeLayout({ width: 620, height: 410, titleLength: 10, subtitleLength: 22 });
check(normal.orientation === "vertical", "la bienvenida normal conserva su composición vertical");
check(normal.maximumTitle >= 70, "la bienvenida aprovecha un cuadro grande sin quedar diminuta");

const banner = calculateAdaptiveWelcomeLayout({ width: 620, height: 125, titleLength: 10, subtitleLength: 22 });
check(banner.orientation === "horizontal", "la bienvenida ancha y baja reorganiza el ícono al costado");
check(banner.iconSize < normal.iconSize, "el ícono acompaña el tamaño libre del bloque");

const longCopy = calculateAdaptiveWelcomeLayout({ width: 360, height: 210, titleLength: 46, subtitleLength: 95 });
check(longCopy.maximumTitle < calculateAdaptiveWelcomeLayout({ width: 360, height: 210, titleLength: 10, subtitleLength: 12 }).maximumTitle, "los mensajes largos reservan más espacio para el texto");

const tiny = calculateAdaptiveWelcomeLayout({ width: 45, height: 30, titleLength: 80, subtitleLength: 120, preview: true });
check(Object.values(tiny).every((value) => typeof value === "string" || Number.isFinite(value)), "un bloque mínimo siempre produce medidas válidas");

const realScreen = readFileSync(new URL("../src/features/ventas/CustomerDisplayScreen.jsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/features/ventas/CustomerDisplayLayoutEditor.jsx", import.meta.url), "utf8");
check(realScreen.includes("<AdaptiveWelcomeCard") && editor.includes("<AdaptiveWelcomeCard"), "la pantalla real y su vista previa usan la misma bienvenida adaptable");
check(!realScreen.includes('type === "welcome") return <div'), "la bienvenida ya no conserva el bloque visual rígido anterior");

console.log("adaptive-welcome-card-tests: bienvenida libre verificada");
