const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile, spawn } = require("child_process");

let localCloudProcess = null;

function localCloudPaths() {
  const executableDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const developmentRoot = path.resolve(executableDir, "..");
  const externalServer = path.join(developmentRoot, "server", "cloud-server.mjs");
  const usesExternalProject = app.isPackaged
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
    show: false,
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
    window.show();
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
  const externalIndex = externalCandidates.find((candidate) => fs.existsSync(candidate));
  const bundledIndex = path.join(__dirname, "..", "dist", "index.html");
  const indexToLoad = externalIndex || bundledIndex;

  window.loadFile(indexToLoad).catch(console.error);
}

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
  startLocalCloud();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", stopLocalCloud);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
