import { calculateAdaptiveSocialLayout } from "../src/features/ventas/adaptiveSocialLayout.js";

const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`OK: ${message}`);
};

const whatsapp = calculateAdaptiveSocialLayout({ width: 300, height: 135, contentLength: 46, wordCount: 8, hasQr: true });
check(whatsapp.orientation === "horizontal", "una tarjeta ancha coloca el QR al costado");
check(whatsapp.maximumTitle >= 18, "el texto normal conserva un tamaño visible en una tarjeta ancha");
check(whatsapp.qrSize <= 110 && whatsapp.qrSize >= 80, "texto y QR comparten el ancho sin invadirse");

const longText = calculateAdaptiveSocialLayout({ width: 300, height: 135, contentLength: 92, wordCount: 15, hasQr: true });
check(longText.orientation === "horizontal", "un mensaje largo aprovecha la disposición horizontal");
check(longText.qrSize < whatsapp.qrSize, "un mensaje largo recibe más espacio sin volver ilegible el QR");

const vertical = calculateAdaptiveSocialLayout({ width: 170, height: 300, contentLength: 35, wordCount: 5, hasQr: true });
check(vertical.orientation === "vertical", "una tarjeta alta conserva el QR debajo");
check(vertical.qrSize <= 160 && vertical.qrSize > 80, "el QR vertical se adapta al espacio disponible");

const largeScreen = calculateAdaptiveSocialLayout({ width: 620, height: 270, contentLength: 46, wordCount: 8, hasQr: true });
check(largeScreen.maximumTitle > whatsapp.maximumTitle, "el texto crece cuando el widget ocupa más pantalla");
check(largeScreen.maximumTitle <= 30 && largeScreen.qrSize <= 160, "una pantalla grande mantiene proporciones cómodas");

const tiny = calculateAdaptiveSocialLayout({ width: 70, height: 42, contentLength: 70, wordCount: 12, hasQr: true, preview: true });
check(Object.values(tiny).every((value) => typeof value === "string" || Number.isFinite(value)), "un widget mínimo siempre produce medidas válidas");

console.log("adaptive-social-card-tests: adaptación de redes verificada");
