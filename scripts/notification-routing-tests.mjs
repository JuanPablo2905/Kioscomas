import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const view = read("src/features/notificaciones/NotificacionesView.jsx");
const service = read("src/features/notificaciones/notificationService.js");
const settings = read("src/features/notificaciones/NotificationSettingsPanel.jsx");
const contrast = read("src/shared/useAutoContrast.js");
const styles = read("src/styles.css");

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

test("los avisos se separan entre negocio, cuenta y novedades", ["Avisos de tu negocio", "Cuenta y plan", "Novedades de Kiosco+"].every((text) => view.includes(text)));
test("un aviso sincronizado reemplaza su copia local", view.includes("SOURCE_TO_LOCAL_TYPE") && view.includes("serverCoveredTypes") && view.includes("!serverCoveredTypes.has(item.type)"));
test("los cobros tienen una categoría configurable", service.includes('["payments", "Cobros y Mercado Pago"]') && settings.includes('["cash", "payments"]'));
test("el contraste ya no se recalcula al mover el puntero", !contrast.includes('addEventListener("pointerover"') && !contrast.includes('addEventListener("pointerout"'));
test("la barra de las pestañas no muestra un falso slider", styles.includes(".desktop-section-tabs::-webkit-scrollbar { display: none; }"));

console.log(`\n${passed} pruebas de avisos e interfaz superadas.`);
