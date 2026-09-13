import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.error?.code === "ENOENT") throw new Error(`No se encontró ${command}. Instalá Android Studio con JDK 21 y volvé a intentar.`);
  if (result.status !== 0) process.exit(result.status || 1);
};

run("pnpm", ["run", "mobile:android:sync"]);
const windows = process.platform === "win32";
if (!existsSync(`android/${windows ? "gradlew.bat" : "gradlew"}`)) throw new Error("Falta el wrapper de Gradle dentro de android/.");
// Invocarlo con bash evita depender del bit ejecutable, que puede perderse al
// preparar el repositorio desde Windows antes de construirlo en GitHub Linux.
run(windows ? "gradlew.bat" : "bash", windows ? ["bundleRelease"] : ["gradlew", "bundleRelease"], { cwd: "android" });
console.log("AAB generado en android/app/build/outputs/bundle/release/app-release.aab");
