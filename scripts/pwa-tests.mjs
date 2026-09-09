import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
const index = fs.readFileSync("index.html", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");
const login = fs.readFileSync("src/features/autenticacion/LoginView.jsx", "utf8");
const app = fs.readFileSync("src/app/KioscoApp.jsx", "utf8");
const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
const terms = fs.readFileSync("src/terminos.jsx", "utf8");
const notificationService = fs.readFileSync("src/features/notificaciones/notificationService.js", "utf8");

const checks = [
  [manifest.display === "standalone", "La app móvil debe abrir sin interfaz del navegador."],
  [manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"), "Falta el ícono móvil de 192 px."],
  [manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"), "Falta el ícono móvil de 512 px."],
  [manifest.icons.some((icon) => icon.purpose === "maskable"), "Falta el ícono adaptable de Android."],
  [manifest.icons.every((icon) => fs.existsSync(`public/${icon.src.replace(/^\.\//, "")}`)), "Algún ícono declarado no existe."],
  [index.includes("apple-touch-icon.png"), "Falta el ícono de instalación para iPhone."],
  [main.includes('import "./shared/pwaInstall"'), "La captura del aviso de instalación debe comenzar antes de renderizar."],
  [login.includes("requestPwaInstall"), "El botón móvil debe invocar la instalación nativa del navegador."],
  [login.includes("requiresRegistrationCode"), "La web debe ofrecer la clave al crear un negocio desde un dispositivo nuevo."],
  [app.includes("await redeemInstallationCode") && app.includes("activationCode"), "La clave móvil debe autorizar el dispositivo antes de registrar el negocio."],
  [serviceWorker.includes("pwa-icon-maskable-512.png"), "Los íconos deben estar disponibles sin conexión."],
  [app.includes("Modo sin conexión: podés seguir trabajando") && app.includes('window.addEventListener("offline"'), "La app debe avisar claramente que puede seguir trabajando sin conexión."],
  [fs.existsSync("terminos.html") && terms.includes("BOTÓN DE BAJA DE SERVICIO") && terms.includes("BOTÓN DE ARREPENTIMIENTO"), "El sitio debe publicar los términos y los accesos de baja y arrepentimiento."],
  [login.includes("termsAccepted") && login.includes("Términos y Condiciones"), "El registro debe pedir aceptación expresa de los términos."],
  [serviceWorker.includes('addEventListener("push"') && serviceWorker.includes("showNotification"), "El service worker debe mostrar avisos push."],
  [serviceWorker.includes('addEventListener("notificationclick"') && serviceWorker.includes("openWindow"), "Los avisos deben abrir Kiosco+ al tocarlos."],
  [notificationService.includes("Notification.requestPermission") && notificationService.includes("pushManager.subscribe"), "La app debe pedir permiso antes de registrar el dispositivo para avisos."],
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

console.log(`✓ PWA móvil: ${checks.length} comprobaciones superadas`);
