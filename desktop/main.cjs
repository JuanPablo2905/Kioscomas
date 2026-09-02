const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile, spawn } = require("child_process");

let localCloudProcess = null;
let desktopUpdater = null;
let updateCheckTimer = null;
let updateNoticeShownFor = "";
let updatePolicy = { autoCheck: true, channel: "stable" };
let updateState = {
  supported: false,
  status: "unavailable",
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: 0,
  error: null,
  channel: "stable",
};

function publishUpdateState(patch = {}) {
  updateState = { ...updateState, ...patch };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("kiosco:update-state", updateState);
  }
  return updateState;
}

function readableUpdateError(error) {
  const message = String(error?.message || error || "No se pudo comprobar la actualización.");
  if (/net::|ENOTFOUND|ECONN|timeout|timed out/i.test(message)) return "No se pudo consultar la actualización. Se volverá a intentar más tarde.";
  return message.replace(/https?:\/\/\S+/g, "servidor de actualizaciones").slice(0, 240);
}

async function checkDesktopUpdates({ manual = false } = {}) {
  if (!desktopUpdater) return updateState;
  if (["checking", "downloading"].includes(updateState.status)) return updateState;
  publishUpdateState({ status: "checking", error: null, manual });
  try {
    await desktopUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateState({ status: "error", error: readableUpdateError(error), manual: false });
  }
  return updateState;
}

function applyUpdatePolicy(policy = {}) {
  updatePolicy = {
    autoCheck: typeof policy.autoCheck === "boolean" ? policy.autoCheck : updatePolicy.autoCheck,
    channel: policy.channel === "beta" ? "beta" : "stable",
  };
  if (desktopUpdater) {
    desktopUpdater.channel = updatePolicy.channel === "beta" ? "beta" : "latest";
    desktopUpdater.allowPrerelease = updatePolicy.channel === "beta";
  }
  publishUpdateState({ channel: updatePolicy.channel });
  return updateState;
}

function configureDesktopUpdater() {
  if (!app.isPackaged || isDevelopmentLauncher()) {
    publishUpdateState({ supported: false, status: "development" });
    return;
  }
  try {
    ({ autoUpdater: desktopUpdater } = require("electron-updater"));
  } catch (error) {
    publishUpdateState({ supported: false, status: "error", error: readableUpdateError(error) });
    return;
  }

  desktopUpdater.autoDownload = true;
  desktopUpdater.autoInstallOnAppQuit = true;
  applyUpdatePolicy(updatePolicy);
  publishUpdateState({ supported: true, status: "idle", currentVersion: app.getVersion(), error: null });

  desktopUpdater.on("checking-for-update", () => publishUpdateState({ status: "checking", error: null }));
  desktopUpdater.on("update-available", (info) => publishUpdateState({
    status: "available",
    availableVersion: info?.version || null,
    releaseDate: info?.releaseDate || null,
    error: null,
  }));
  desktopUpdater.on("update-not-available", () => publishUpdateState({
    status: "up-to-date",
    availableVersion: null,
    percent: 0,
    error: null,
  }));
  desktopUpdater.on("download-progress", (progress) => publishUpdateState({
    status: "downloading",
    percent: Math.max(0, Math.min(100, Number(progress?.percent || 0))),
    error: null,
  }));
  desktopUpdater.on("update-downloaded", (info) => {
    const version = info?.version || updateState.availableVersion || "nueva";
    publishUpdateState({ status: "downloaded", availableVersion: version, percent: 100, error: null });
    if (updateNoticeShownFor === version || !Notification.isSupported()) return;
    updateNoticeShownFor = version;
    new Notification({
      title: "Actualización de Kiosco+ lista",
      body: `La versión ${version} se instalará cuando cierres la aplicación.`,
      icon: path.join(__dirname, "icon.png"),
    }).show();
  });
  desktopUpdater.on("error", (error) => publishUpdateState({ status: "error", error: readableUpdateError(error) }));

  setTimeout(() => {
    if (updatePolicy.autoCheck) checkDesktopUpdates();
  }, 15000);
  updateCheckTimer = setInterval(() => {
    if (updatePolicy.autoCheck) checkDesktopUpdates();
  }, 4 * 60 * 60 * 1000);
}

function isDevelopmentLauncher() {
  return !app.isPackaged
    || /Desarrollo/i.test(path.basename(process.execPath))
    || process.env.KIOSCO_USE_EXTERNAL_PROJECT === "1";
}

function localCloudPaths() {
  const executableDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const developmentRoot = path.resolve(executableDir, "..");
  const externalServer = path.join(developmentRoot, "server", "cloud-server.mjs");
  const usesExternalProject = app.isPackaged
    && isDevelopmentLauncher()
    && fs.existsSync(path.join(developmentRoot, "dist", "index.html"))
    && fs.existsSync(externalServer);
  const dataDir = app.isPackaged
    ? (usesExternalProject ? path.join(developmentRoot, "cloud-dev-data") : path.join(executableDir, "KioscoApp-Datos"))
    : path.join(__dirname, "..", "cloud-dev-data");
  const serverFile = app.isPackaged
    ? (usesExternalProject ? externalServer : path.join(process.resourcesPath, "app.asar.unpacked", "server", "cloud-server.mjs"))
    : path.join(__dirname, "..", "server", "cloud-server.mjs");
  return { dataDir, serverFile };
}

function startLocalCloud() {
  const { dataDir, serverFile } = localCloudPaths();
  if (!fs.existsSync(serverFile)) {
    console.error("[local-cloud] No se encontró el servidor:", serverFile);
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  localCloudProcess = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      KIOSCO_LOCAL_MODE: "1",
      KIOSCO_CLOUD_DB: path.join(dataDir, "database.json"),
      KIOSCO_CLOUD_DATA_DIR: dataDir,
      KIOSCO_CLOUD_PORT: "8787",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  localCloudProcess.stdout?.on("data", (chunk) => console.log("[local-cloud]", String(chunk).trim()));
  localCloudProcess.stderr?.on("data", (chunk) => console.error("[local-cloud]", String(chunk).trim()));
  localCloudProcess.once("exit", (code) => {
    if (code && code !== 0) console.error("[local-cloud] finalizó con código", code);
    localCloudProcess = null;
  });
}

function stopLocalCloud() {
  if (localCloudProcess && !localCloudProcess.killed) localCloudProcess.kill();
  localCloudProcess = null;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Kiosco+",
    icon: path.join(__dirname, "icon.ico"),
    // Mostrar el marco inmediatamente evita que un fallo o una demora del
    // renderer deje el proceso abierto sin ninguna ventana visible.
    show: true,
    autoHideMenuBar: true,
    backgroundColor: "#F6F1E7",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.once("ready-to-show", () => {
    window.focus();
  });

  window.webContents.on("console-message", (...args) => {
    console.log("[renderer]", ...args.map((item) => item?.message || item));
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("[did-fail-load]", code, description);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[render-process-gone]", details);
  });
  window.webContents.on("did-finish-load", async () => {
    if (process.env.KIOSCO_LOGIN_SMOKE_TEST === "1") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await window.webContents.executeJavaScript(`(() => {
        const setValue = (element, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(element, value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const inputs = document.querySelectorAll("input");
        setValue(inputs[0], "sur");
        setValue(inputs[1], "1234");
        [...document.querySelectorAll("button")].find((button) => button.innerText === "Entrar")?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const state = await window.webContents.executeJavaScript(`({
        text: document.body.innerText.slice(0, 500),
        hasHome: document.body.innerText.includes("Kiosco Sur (demo)"),
        hasError: document.body.innerText.includes("incorrectos")
      })`);
      console.log("[login-smoke-test]", JSON.stringify(state));
      fs.writeFileSync(path.join(__dirname, "login-smoke-result.json"), JSON.stringify(state, null, 2));
      app.quit();
      return;
    }
    if (process.env.KIOSCO_SMOKE_TEST === "1") {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const state = await window.webContents.executeJavaScript(`({
        title: document.title,
        text: document.body.innerText.slice(0, 300),
        rootChildren: document.getElementById("root")?.childElementCount || 0
      })`);
      console.log("[smoke-test]", JSON.stringify(state));
      fs.writeFileSync(path.join(__dirname, "smoke-result.json"), JSON.stringify(state, null, 2));
      app.quit();
    }
  });

  const executableDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const externalCandidates = [
    path.join(executableDir, "dist", "index.html"),
    path.resolve(executableDir, "..", "dist", "index.html"),
    path.resolve(executableDir, "..", "..", "dist", "index.html"),
  ];
  const externalIndex = isDevelopmentLauncher()
    ? externalCandidates.find((candidate) => fs.existsSync(candidate))
    : null;
  const bundledIndex = path.join(__dirname, "..", "dist", "index.html");
  const indexToLoad = externalIndex || bundledIndex;

  window.loadFile(indexToLoad).catch((error) => {
    console.error("[startup] No se pudo cargar la aplicación", error);
    if (window.isDestroyed()) return;
    const message = String(error?.message || error || "Error desconocido");
    const escapedMessage = message.replace(/[&<>]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
    })[char]);
    const errorPage = `
      <!doctype html>
      <html lang="es">
        <meta charset="utf-8">
        <title>Kiosco+ - Error al iniciar</title>
        <body style="font-family:Arial,sans-serif;background:#f6f1e7;color:#172033;padding:48px">
          <h1>Kiosco+ no pudo cargar la aplicación</h1>
          <p>Cerrá esta ventana y compartí este detalle para poder corregirlo:</p>
          <pre style="white-space:pre-wrap;background:#fff;padding:16px;border:1px solid #ddd;border-radius:8px">${escapedMessage}</pre>
        </body>
      </html>
    `;
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`).catch(console.error);
  });
}

ipcMain.handle("kiosco:updates:get-state", () => updateState);
ipcMain.handle("kiosco:runtime:get", () => ({
  requiresActivation: app.isPackaged && !isDevelopmentLauncher(),
  version: app.getVersion(),
}));
ipcMain.handle("kiosco:updates:check", () => checkDesktopUpdates({ manual: true }));
ipcMain.handle("kiosco:updates:configure", (_event, policy) => applyUpdatePolicy(policy));
ipcMain.handle("kiosco:updates:install", () => {
  if (!desktopUpdater || updateState.status !== "downloaded") return { ok: false };
  setImmediate(() => desktopUpdater.quitAndInstall(false, true));
  return { ok: true };
});

ipcMain.handle("kiosco:open-cash-drawer", async (_event, { printerName = "" } = {}) => new Promise((resolve) => {
  if (process.platform !== "win32") return resolve({ ok: false, error: "El pulso ESC/POS está disponible en Windows." });
  const encodedPrinter = Buffer.from(String(printerName), "utf8").toString("base64");
  const script = `$ErrorActionPreference='Stop';Add-Type @'\nusing System;using System.Runtime.InteropServices;public class RawPrinter{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]public class DOCINFOA{[MarshalAs(UnmanagedType.LPStr)]public string pDocName;[MarshalAs(UnmanagedType.LPStr)]public string pOutputFile;[MarshalAs(UnmanagedType.LPStr)]public string pDataType;}[DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Ansi)]static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);[DllImport("winspool.drv",SetLastError=true)]static extern bool ClosePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Ansi)]static extern bool StartDocPrinter(IntPtr h,int l,DOCINFOA d);[DllImport("winspool.drv",SetLastError=true)]static extern bool EndDocPrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]static extern bool StartPagePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]static extern bool EndPagePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);public static bool Send(string n,byte[] b){IntPtr h;if(!OpenPrinter(n,out h,IntPtr.Zero))return false;var d=new DOCINFOA{pDocName="Kiosco+ - abrir cajon",pDataType="RAW"};int w=0;bool ok=StartDocPrinter(h,1,d)&&StartPagePrinter(h)&&WritePrinter(h,b,b.Length,out w);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);return ok&&w==b.Length;}}\n'@;$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPrinter}'));if([string]::IsNullOrWhiteSpace($p)){$p=(Get-CimInstance Win32_Printer|Where-Object Default|Select-Object -First 1 -ExpandProperty Name)};if(-not $p){throw 'No hay impresora configurada'};if(-not [RawPrinter]::Send($p,[byte[]](27,112,0,25,250))){throw 'La impresora rechazó el pulso'}`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { windowsHide: true, timeout: 8000 }, (error) => resolve(error ? { ok: false, error: error.message } : { ok: true }));
}));

ipcMain.handle("kiosco:capture-screenshot", async (event) => {
  try {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (!sourceWindow || sourceWindow.isDestroyed()) {
      return { ok: false, error: "No se encontró la ventana de la aplicación." };
    }
    const image = await sourceWindow.webContents.capturePage();
    return { ok: true, dataUrl: image.toDataURL() };
  } catch (error) {
    console.error("[capture-screenshot]", error);
    return { ok: false, error: error?.message || "No se pudo tomar la captura." };
  }
});

app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("com.kioscoplus.desktop");
  if (isDevelopmentLauncher() || process.env.KIOSCO_ENABLE_LOCAL_CLOUD === "1") startLocalCloud();
  createWindow();
  configureDesktopUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  stopLocalCloud();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
