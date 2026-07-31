import { cp, copyFile, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceDir = resolve(projectRoot, "dist");
const publicDir = resolve(projectRoot, "dist-public");

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(sourceDir, publicDir, { recursive: true });

await copyFile(resolve(publicDir, "index.html"), resolve(publicDir, "app.html"));
await copyFile(resolve(publicDir, "landing.html"), resolve(publicDir, "index.html"));
await unlink(resolve(publicDir, "landing.html"));

const manifestPath = resolve(publicDir, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.id = "./app.html";
manifest.start_url = "./app.html";
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const serviceWorkerPath = resolve(publicDir, "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
await writeFile(
  serviceWorkerPath,
  serviceWorker.replace('    "./",', '    "./",\n    "./app.html",'),
  "utf8",
);

console.log("Sitio público preparado en dist-public:");
console.log("- / abre la landing");
console.log("- /app.html abre la demo");
