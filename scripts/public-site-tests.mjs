import fs from "node:fs/promises";

const read = (file) => fs.readFile(file, "utf8");
const [landing, prices, responsive, navigation, adminPanel, cloudApp, cloudServer, publicEnv, cloudEnv] = await Promise.all([
  read("src/landing.jsx"),
  read("src/precios.jsx"),
  read("src/landing-responsive.css"),
  read("src/shared/PublicSiteNav.jsx"),
  read("src/features/administracion/AdminAppPanel.jsx"),
  read("src/app/KioscoApp.jsx"),
  read("server/cloud-server.mjs"),
  read(".env.public"),
  read(".env.cloud"),
]);

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

test("la landing diferencia la demo de la aplicación real", landing.includes("demoUrl") && landing.includes("cloudAppUrl"));
test("la página de precios enlaza la aplicación real", prices.includes("cloudAppUrl") && prices.includes("Ingresar a Kiosco+"));
test("el menú móvil incluye precios, demo e ingreso", navigation.includes('label: "Precios"') && navigation.includes("Probar demo") && navigation.includes("Ingresar a mi cuenta"));
test("el menú móvil es accesible", navigation.includes("aria-expanded") && navigation.includes("aria-controls") && navigation.includes("closeOnEscape"));
test("la demostración no puede superar el ancho disponible", responsive.includes(".demo-window") && responsive.includes("max-width: 100%"));
test("la landing bloquea el desbordamiento horizontal", responsive.includes("overflow-x: hidden"));
test("hay reglas específicas para teléfonos horizontales", responsive.includes("orientation: landscape") && responsive.includes("max-height: 600px"));
test("editar y eliminar tienen etiquetas visibles", adminPanel.includes("<Pencil size={14}/>Editar") && adminPanel.includes("<Trash2 size={14}/>Eliminar"));
test("la app real exige activación y la demo puede omitirla", cloudApp.includes("REQUIRE_DEVICE_ACTIVATION") && cloudApp.includes("PUBLIC_DEMO_MODE"));
test("el servidor verifica la activación al iniciar y renovar sesión", cloudServer.includes("requireDeviceActivation") && cloudServer.includes("Este dispositivo todavía no fue autorizado") && cloudServer.includes("Este dispositivo ya no está autorizado"));
test("el sitio público conoce la URL de la aplicación real", publicEnv.includes("VITE_CLOUD_APP_URL=https://app.kioscomas.ar"));
test("la compilación de nube activa el control de dispositivos", cloudEnv.includes("VITE_REQUIRE_DEVICE_ACTIVATION=true"));

console.log(`Sitio público y acceso: ${passed} comprobaciones superadas`);
