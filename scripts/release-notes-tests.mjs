import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releases = JSON.parse(fs.readFileSync("release-notes/releases.json", "utf8"));
const app = fs.readFileSync("src/app/KioscoApp.jsx", "utf8");
const settings = fs.readFileSync("src/shared/SettingsModal.jsx", "utf8");
const component = fs.readFileSync("src/updates/ReleaseNotes.jsx", "utf8");
const workflow = fs.readFileSync(".github/workflows/release-windows.yml", "utf8");

const versions = releases.map((release) => release.version);
if (new Set(versions).size !== versions.length) throw new Error("Hay versiones repetidas en las notas.");
if (releases[0]?.version !== packageJson.version) throw new Error(`La primera nota debe corresponder a la versión actual ${packageJson.version}.`);
for (const release of releases) {
  if (!release.version || !release.date || !release.title || !release.summary) throw new Error(`La versión ${release.version || "sin identificar"} tiene datos incompletos.`);
  if (!Array.isArray(release.sections) || !release.sections.length || release.sections.some((section) => !section.title || !Array.isArray(section.items) || !section.items.length)) throw new Error(`La versión ${release.version} necesita secciones con cambios.`);
}
if (!app.includes("ReleaseNotesAnnouncement")) throw new Error("La app no muestra las novedades al abrir una versión nueva.");
if (!settings.includes("ReleaseNotesHistory")) throw new Error("Ayuda y versión no incluye el historial de novedades.");
if (!component.includes("kiosco:release-notes:last-seen")) throw new Error("No se registra qué nota ya vio el usuario.");
if (!workflow.includes("generate-release-notes.mjs") || !workflow.includes("gh release edit")) throw new Error("El release de GitHub no publica automáticamente las notas.");

console.log(`✓ Notas de versión: ${releases.length} versión(es), incluida ${packageJson.version}`);
