import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stopChildProcess } from "./test-child-process.mjs";

const port = 8821;
const dataDir = path.join(tmpdir(), `kiosco-shutdown-test-${Date.now()}`);
const child = spawn(process.execPath, ["server/cloud-server.mjs"], {
  env: {
    ...process.env,
    KIOSCO_CLOUD_PORT: String(port),
    KIOSCO_CLOUD_DB: path.join(dataDir, "database.json"),
    KIOSCO_CLOUD_DATA_DIR: dataDir,
    KIOSCO_LOCAL_MODE: "1",
  },
  stdio: "ignore",
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      ready = (await fetch(`http://127.0.0.1:${port}/v1/health`)).ok;
      if (ready) break;
    } catch {
      // El servidor todavía está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("FALLÓ: el servidor auxiliar no inició");

  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const result = await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("FALLÓ: SIGTERM no cerró el servidor auxiliar")), 7_000)),
  ]);
  const [exitCode, signal] = result;
  if (process.platform !== "win32" && exitCode !== 0) {
    throw new Error(`FALLÓ: el servidor terminó con código ${exitCode ?? signal}`);
  }
  console.log("OK: el servidor auxiliar cierra correctamente al recibir SIGTERM");
} finally {
  await stopChildProcess(child);
  await fs.rm(dataDir, { recursive: true, force: true });
}
