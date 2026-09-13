import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const main = read("src/main.jsx");
const app = read("src/app/KioscoApp.jsx");
const settings = read("src/shared/SettingsModal.jsx");
const sales = read("src/features/ventas/VentasView.jsx");
const notifications = read("src/features/notificaciones/notificationRules.js");
const reports = read("src/features/reportes/ReportesView.jsx");
const feedback = read("src/shared/useInteractionFeedback.js");
const sharing = read("src/shared/share.js");
const ticketPrint = read("src/shared/ticketPrint.js");
const styles = read("src/styles.css");
const sw = read("public/sw.js");
const vite = read("vite.config.js");
const release = read(".github/workflows/release-windows.yml");
const quality = read(".github/workflows/quality.yml");
const stores = read(".github/workflows/build-stores.yml");
const androidGradle = read("android/app/build.gradle");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const mac = read("electron-builder.mac.cjs");
const cloudServer = read("server/cloud-server.mjs");
const childProcessHelper = read("scripts/test-child-process.mjs");

const checks = [
  [pkg.version === "0.2.25", "el paquete usa la versión 0.2.25"],
  [cloudServer.includes("server.close") && cloudServer.includes('shutdown("SIGTERM")') && childProcessHelper.includes('child.kill("SIGKILL")'), "los servidores auxiliares cierran limpiamente y tienen salida de emergencia"],
  [app.includes("lazyNamed") && app.includes("Suspense") && app.includes('import("../shared/ScanModal")'), "las secciones pesadas y el escáner se cargan por demanda"],
  [main.includes('import("./features/ventas/CustomerDisplayScreen")') && main.includes('import("./features/ventas/RemoteDisplayScreen")') && main.includes("!isSecondaryDisplay && <PwaUpdateNotice"), "las pantallas secundarias cargan por demanda y no muestran avisos internos"],
  [app.includes("useAccessibleDialogs") && app.includes("skip-to-content"), "la navegación por teclado tiene atajo y control de diálogos"],
  [styles.includes(":focus-visible") && styles.includes("pointer: coarse"), "foco visible y objetivos táctiles están reforzados"],
  [styles.includes("sensitive-value") && app.includes("preferences={currentPreferences}"), "las preferencias llegan al menú y los valores sensibles se pueden ocultar"],
  [sales.includes("preferences.defaultPayment") && sales.includes("preferences.allowNegativeStock"), "medio predeterminado y stock negativo son opciones reales"],
  [notifications.includes("preferences.expiryDays"), "el plazo de vencimientos configurado se aplica"],
  [settings.includes("confirmationSeconds") && app.includes("currentPreferences.confirmationSeconds"), "la duración de confirmaciones se aplica"],
  [feedback.includes("soundOptions.enabled") && feedback.includes("soundOptions.volume"), "sonidos y volumen gobiernan la respuesta de las acciones"],
  [reports.includes("preferences.requireCorrectionReason") && reports.includes("preferences.confirmDangerousActions"), "motivos y confirmación gobiernan las anulaciones"],
  [sales.includes("presentacionTicket") && sales.includes("preferences.ticketNumbering") && sales.includes("preferences.ticketPrefix") && sharing.includes("presentacionTicket") && ticketPrint.includes("presentacionTicket"), "número y prefijo gobiernan tickets nuevos impresos y compartidos"],
  [sw.includes("__KIOSCO_BUILD__") && vite.includes("stampServiceWorker"), "el caché PWA cambia con cada versión"],
  [fs.existsSync("src/shared/PwaUpdateNotice.jsx"), "la PWA avisa cuando hay una actualización lista"],
  [release.includes("create-draft") && release.includes("needs: create-draft") && release.includes("needs: [release-windows, release-macos]"), "Windows y Mac parten del mismo borrador y publican juntos"],
  [!release.includes("release-macos:\n    needs: release-windows"), "Mac ya no espera a que termine Windows"],
  [quality.includes("pull_request") && quality.includes("test:all"), "pushes y pull requests ejecutan pruebas"],
  [stores.includes("microsoft-store") && stores.includes("google-play"), "las dos tiendas tienen builds manuales reproducibles"],
  [mac.includes("notarize") && mac.includes("NSCameraUsageDescription") && fs.existsSync("build/entitlements.mac.plist"), "Mac tiene firma, notarización y permiso de cámara condicionales"],
  [androidGradle.includes("kioscoVersionCode") && androidGradle.includes("ANDROID_KEYSTORE_PATH"), "Android hereda versión y firma externa"],
  [androidManifest.includes("android.permission.CAMERA") && androidManifest.includes("android.permission.POST_NOTIFICATIONS") && androidManifest.includes('android:allowBackup="false"'), "Android declara cámara y notificaciones sin copiar datos privados al respaldo del sistema"],
  [fs.existsSync("android/app/src/main/res/values/colors.xml"), "Android incluye los colores nativos referenciados por su tema"],
  [fs.existsSync("docs/PUBLICAR_EN_GOOGLE_PLAY.md") && fs.existsSync("docs/PUBLICAR_EN_MAC.md"), "la publicación tiene guías operativas"],
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(`Falta: ${message}`);
  console.log(`OK: ${message}`);
}
