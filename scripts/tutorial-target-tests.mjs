import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const tutorialPath = path.join(root, "shared", "TutorialOverlay.jsx");
const tutorial = fs.readFileSync(tutorialPath, "utf8");
const app = fs.readFileSync(path.join(root, "app", "KioscoApp.jsx"), "utf8");
const sourceFiles = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(js|jsx)$/.test(entry.name)) sourceFiles.push(file);
  }
}

collect(root);
const allSource = sourceFiles.filter((file) => file !== tutorialPath).map((file) => fs.readFileSync(file, "utf8")).join("\n");
const assertions = [];
const check = (condition, message) => assertions.push({ condition, message });

check(tutorial.includes("pointer-events-none fixed left-0 right-0 top-0"), "La capa oscura superior no debe bloquear el control resaltado.");
check(tutorial.includes("pointer-events-none fixed inset-0"), "La capa oscura sin destino no debe bloquear la interfaz.");
check(tutorial.includes("performHighlightedAction"), "El boton alternativo debe ejecutar la accion resaltada antes de avanzar.");
check(app.includes("const preferenceKey = identidad?.usuarioId || `cuenta:${currentUserId}`"), "El progreso debe pertenecer a la cuenta o empleado actual, no al dispositivo.");
check(app.includes("markTutorialHandled(view);"), "Cerrar un tutorial debe marcar esa sección como vista.");
check(app.includes("onClose={closeTutorial}"), "Todos los cierres del tutorial deben guardar el progreso.");

check(!/\{\s*text\s*:/.test(tutorial), "Los recorridos no deben buscar controles por texto ambiguo.");
check(!/selector:\s*["'][^"']*(?:\.grid|\.rounded-xl|\.stock-row)/.test(tutorial), "Los recorridos no deben usar selectores visuales genéricos.");

const targetNames = [...tutorial.matchAll(/\[data-tour="([^"]+)"\]/g)].map((match) => match[1]);
const dynamicTargetPrefixes = new Map([
  ["purchase-tab-", 'data-tour={`purchase-tab-${id}`}'],
  ["purchase-content-", 'data-tour={`purchase-content-${tab}`}'],
  ["clients-content-", 'data-tour={`clients-content-${areaTab}`}'],
  ["stock-tab-", 'data-tour={`stock-tab-${id}`}'],
  ["stock-content-", 'data-tour={`stock-content-${tab}`}'],
  ["sales-tab-", 'data-tour={`sales-tab-${id}`}'],
  ["sales-content-", 'data-tour={`sales-content-${salesArea}`}'],
  ["management-tab-", 'data-tour={`management-tab-${id}`}'],
  ["management-content-", 'data-tour={`management-content-${tab}`}'],
]);
for (const name of new Set(targetNames)) {
  const literal = `data-tour="${name}"`;
  const dynamicExists = [...dynamicTargetPrefixes].some(([prefix, expression]) => name.startsWith(prefix) && allSource.includes(expression));
  check(
    allSource.includes(literal) || dynamicExists,
    `Falta el control real data-tour="${name}".`,
  );
}

const failed = assertions.filter((assertion) => !assertion.condition);
if (failed.length) {
  for (const failure of failed) console.error(`✗ ${failure.message}`);
  process.exit(1);
}

console.log(`✓ Tutoriales: ${new Set(targetNames).size} destinos estables verificados`);
