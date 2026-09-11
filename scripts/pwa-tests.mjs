import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
const index = fs.readFileSync("index.html", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");
const login = fs.readFileSync("src/features/autenticacion/LoginView.jsx", "utf8");
const app = fs.readFileSync("src/app/KioscoApp.jsx", "utf8");
const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
const terms = fs.readFileSync("src/terminos.jsx", "utf8");
const privacy = fs.readFileSync("src/privacidad.jsx", "utf8");
const notificationService = fs.readFileSync("src/features/notificaciones/notificationService.js", "utf8");
const settings = fs.readFileSync("src/shared/SettingsModal.jsx", "utf8");
const customerDisplay = fs.readFileSync("src/features/ventas/CustomerDisplayScreen.jsx", "utf8");
const customerDisplaySettings = fs.readFileSync("src/features/ventas/CustomerDisplaySettings.jsx", "utf8");
const customerDisplayLayout = fs.readFileSync("src/features/ventas/CustomerDisplayLayoutEditor.jsx", "utf8");
const remoteDisplayScreen = fs.readFileSync("src/features/ventas/RemoteDisplayScreen.jsx", "utf8");
const remoteDisplays = fs.readFileSync("src/features/ventas/remoteDisplays.js", "utf8");
const promotionsManager = fs.readFileSync("src/features/gestion/PromotionsManager.jsx", "utf8");
const salesView = fs.readFileSync("src/features/ventas/VentasView.jsx", "utf8");
const adminNotifications = fs.readFileSync("src/features/administracion/AdminNotificationCenter.jsx", "utf8");
const adminPanel = fs.readFileSync("src/features/administracion/AdminAppPanel.jsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const desktopMain = fs.readFileSync("desktop/main.cjs", "utf8");

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
  [fs.existsSync("privacidad.html") && privacy.includes("Política de Privacidad") && serviceWorker.includes('"./privacidad.html"'), "La política de privacidad debe publicarse y quedar disponible sin conexión."],
  [login.includes("termsAccepted") && login.includes("Términos y Condiciones"), "El registro debe pedir aceptación expresa de los términos."],
  [serviceWorker.includes('addEventListener("push"') && serviceWorker.includes("showNotification"), "El service worker debe mostrar avisos push."],
  [serviceWorker.includes('addEventListener("notificationclick"') && serviceWorker.includes("openWindow"), "Los avisos deben abrir Kiosco+ al tocarlos."],
  [notificationService.includes("Notification.requestPermission") && notificationService.includes("pushManager.subscribe"), "La app debe pedir permiso antes de registrar el dispositivo para avisos."],
  [settings.includes("VITE_APP_VERSION") && settings.includes("Versión actual:") && settings.includes("Aplicación web instalada"), "Configuración debe mostrar claramente la versión y el tipo de aplicación."],
  [settings.includes("Buscar actualizaciones") && settings.includes("Reiniciar e instalar actualización") && desktopMain.includes("quitAndInstall(true, true)"), "Ayuda debe permitir buscar una versión y reiniciar la aplicación para instalarla."],
  [settings.includes("settings-mobile-safe-header") && styles.includes("(display-mode: standalone)") && styles.includes("env(safe-area-inset-top) + .75rem") && styles.includes("backdrop-filter: none"), "Las pestañas de Configuración deben quedar debajo del área segura de iPhone sin arrastrar el degradado."],
  [settings.includes('id: "notificaciones"') && settings.includes("NotificationSettingsPanel") && settings.includes("Ayuda y versión"), "Configuración debe agrupar los avisos y la ayuda sin volver a mostrar una lista extensa de menús."],
  [main.includes('mode === "customer-display"') && customerDisplay.includes("Tu compra") && customerDisplay.includes("Total a pagar"), "La pantalla para clientes debe tener una entrada aislada y mostrar sólo la información de la venta."],
  [customerDisplaySettings.includes("QR estático") && customerDisplaySettings.includes("no confirma el pago automáticamente"), "La configuración debe explicar que el QR estático requiere confirmación del vendedor."],
  [customerDisplay.includes("Ahorraste") && customerDisplay.includes("item.promotion.badge") && salesView.includes("descuentosPorProducto"), "La segunda pantalla debe identificar la promoción y el ahorro de cada producto."],
  [customerDisplay.includes("h-screen max-h-screen") && customerDisplay.includes("overflow-y-auto overscroll-contain") && customerDisplay.includes("scrollHeight"), "Una venta extensa debe desplazarse dentro de la lista sin agrandar la pantalla."],
  [customerDisplayLayout.includes("Ventas + publicidad") && customerDisplayLayout.includes("Sólo publicidad") && customerDisplayLayout.includes("Sólo ventas"), "Cada monitor local debe permitir elegir si recibe ventas, publicidad o ambos."],
  [customerDisplayLayout.includes("Vista previa en vivo") && customerDisplayLayout.includes("Mover a:") && customerDisplayLayout.includes("Diseños rápidos"), "Los bloques deben ordenarse sobre una vista previa y cambiar de zona."],
  [customerDisplayLayout.includes("Tamaño manual") && customerDisplayLayout.includes('type="range"') && customerDisplayLayout.includes("normalizeDisplayWidgetSize") && customerDisplay.includes("normalizeDisplayWidgetSize"), "Cada bloque debe poder reordenarse y usar un tamaño porcentual manual en la pantalla real."],
  [customerDisplayLayout.includes("Horarios del negocio") && customerDisplayLayout.includes('type="time"') && customerDisplay.includes("Abierto ahora") && customerDisplay.includes("DISPLAY_SCHEDULE_DAYS"), "Los horarios deben configurarse por día y mostrarse como una lista con estado actual."],
  [customerDisplayLayout.includes("Zona donde agregar el bloque") && customerDisplayLayout.includes("No abre el teclado ni menús del teléfono") && !customerDisplayLayout.includes("<select value={addZone}"), "El editor táctil debe agregar bloques sin abrir selectores nativos del teléfono."],
  [main.includes('mode === "remote-display"') && remoteDisplayScreen.includes("Vinculá esta pantalla") && remoteDisplayScreen.includes("authorizationUrl") && remoteDisplays.includes("kiosco:remote-display-cache"), "La pantalla remota debe mostrar su QR, vincularse de forma aislada y conservar contenido sin conexión."],
  [promotionsManager.includes("Anunciar en la segunda pantalla") && promotionsManager.includes("Editar promoción") && promotionsManager.includes("diasSemana"), "Gestión debe permitir editar y programar la publicidad de las promociones."],
  [customerDisplaySettings.includes("Probar publicidad") && customerDisplaySettings.includes("Simular venta") && customerDisplaySettings.includes("Contacto o redes"), "La pantalla para clientes debe ofrecer contenido comercial y vistas de prueba."],
  [adminNotifications.includes("admin-notification-tab") && styles.includes(".admin-notification-tab.is-active") && styles.includes("color: #16433d !important"), "Las pestañas de avisos deben mantener contraste legible con cualquier tema."],
  [adminPanel.includes("Otra pantalla"), "El administrador debe poder abrir un negocio en otra pantalla sin abandonar el panel."],
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

console.log(`✓ PWA móvil: ${checks.length} comprobaciones superadas`);
