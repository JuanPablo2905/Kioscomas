import fs from "node:fs/promises";

const read = (file) => fs.readFile(file, "utf8");
const [landing, landingStyles, prices, privacy, responsive, navigation, adminPanel, cloudApp, cloudServer, publicEnv, cloudEnv, releaseWorkflow, packageManifest, downloads, functionsPage, screenPage, redirects, renderConfig] = await Promise.all([
  read("src/landing.jsx"),
  read("src/landing.css"),
  read("src/precios.jsx"),
  read("src/privacidad.jsx"),
  read("src/landing-responsive.css"),
  read("src/shared/PublicSiteNav.jsx"),
  read("src/features/administracion/AdminAppPanel.jsx"),
  read("src/app/KioscoApp.jsx"),
  read("server/cloud-server.mjs"),
  read(".env.public"),
  read(".env.cloud"),
  read(".github/workflows/release-windows.yml"),
  read("package.json"),
  read("src/descargas.jsx"),
  read("src/funciones.jsx"),
  read("src/pantalla.jsx"),
  read("public/_redirects"),
  read("render.yaml"),
]);

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

test("la landing diferencia la demo de la aplicación real", landing.includes("demoUrl") && landing.includes("cloudAppUrl"));
test("la portada conserva su diseño base completo", landingStyles.length > 10000 && [".nav{", ".hero{", ".button{", ".demo-window{", ".feature-grid{"].every((selector) => landingStyles.includes(selector)));
test("las descargas viven en una página propia y separan los dos tipos de Mac", downloads.includes("Mac Apple Silicon") && downloads.includes("Mac Intel") && navigation.includes('label: "Descargas"'));
test("la página de precios enlaza la aplicación real", prices.includes("cloudAppUrl") && prices.includes("Ingresar a Kiosco+"));
test("la beta publica precio, duración y ausencia de tarjeta", prices.includes("betaTrialDays") && prices.includes("launchPaidMonths") && prices.includes("sin tarjeta"));
test("el precio diferencia lanzamiento y lista con una línea de tiempo", prices.includes("launchDiscount") && prices.includes("price-timeline") && prices.includes("Desde el cuarto mes pago"));
test("la portada destaca Mercado Pago sin anunciar como activas funciones pendientes", landing.includes('id="mercado-pago"') && landing.includes("QR estático") && landing.includes("Integración de cobros en preparación") && landing.includes("En preparación"));
test("el sitio publica una política de privacidad completa", privacy.includes("Datos que pueden tratarse") && privacy.includes("Proveedores tecnológicos") && privacy.includes("Derechos del titular"));
test("landing y precios enlazan la política de privacidad", landing.includes("./privacidad.html") && prices.includes("./privacidad.html"));
test("el menú móvil incluye precios, demo e ingreso", navigation.includes('label: "Precios"') && navigation.includes("Probar demo") && navigation.includes("Ingresar a mi cuenta"));
test("el menú móvil es accesible", navigation.includes("aria-expanded") && navigation.includes("aria-controls") && navigation.includes("closeOnEscape"));
test("la demostración no puede superar el ancho disponible", responsive.includes(".demo-window") && responsive.includes("max-width: 100%"));
test("la landing bloquea el desbordamiento horizontal", responsive.includes("overflow-x: hidden"));
test("hay reglas específicas para teléfonos horizontales", responsive.includes("orientation: landscape") && responsive.includes("max-height: 600px"));
test("editar y eliminar tienen etiquetas visibles", adminPanel.includes("<Pencil size={14}/>Editar") && adminPanel.includes("<Trash2 size={14}/>Eliminar"));
test("la app real exige activación y la demo puede omitirla", cloudApp.includes("REQUIRE_DEVICE_ACTIVATION") && cloudApp.includes("PUBLIC_DEMO_MODE"));
test("el servidor verifica la activación al iniciar y renovar sesión", cloudServer.includes("requireDeviceActivation") && cloudServer.includes("Este dispositivo todavía no fue autorizado") && cloudServer.includes("Este dispositivo ya no está autorizado"));
test("el sitio público conoce la URL de la aplicación real", publicEnv.includes("VITE_CLOUD_APP_URL=https://app.kioscomas.ar"));
test("la portada quedó limpia y lleva al centro de descargas", landing.includes('./descargas.html') && !landing.includes('id="descargas-mac"'));
test("las funciones diferenciadoras tienen una página detallada", functionsPage.includes('{ id: "pantallas"') && functionsPage.includes('{ id: "mercado-pago"') && functionsPage.includes('{ id: "offline"'));
test("la pantalla remota tiene una entrada pública independiente y fácil de recordar", screenPage.includes("RemoteDisplayScreen") && redirects.includes("/pantalla") && renderConfig.includes("source: /pantalla"));
test("el entorno público apunta a los dos instaladores Mac", publicEnv.includes("KioscoPlus-Mac-arm64.dmg") && publicEnv.includes("KioscoPlus-Mac-x64.dmg"));
test("la publicación de Mac separa Apple Silicon e Intel", releaseWorkflow.includes("arch: arm64") && releaseWorkflow.includes("arch: x64") && !releaseWorkflow.includes("--universal"));
test("cada instalador Mac usa el equipo nativo correcto", releaseWorkflow.includes("runner: macos-15") && releaseWorkflow.includes("runner: macos-15-intel") && releaseWorkflow.includes("runs-on: ${{ matrix.runner }}"));
test("los instaladores Mac tienen órdenes separadas", packageManifest.includes("desktop:build:mac:arm64") && packageManifest.includes("desktop:build:mac:x64"));
test("la compilación de nube activa el control de dispositivos", cloudEnv.includes("VITE_REQUIRE_DEVICE_ACTIVATION=true"));

console.log(`Sitio público y acceso: ${passed} comprobaciones superadas`);
