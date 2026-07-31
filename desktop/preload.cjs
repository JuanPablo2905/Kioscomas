const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioscoDesktop", {
  openCashDrawer: (options) => ipcRenderer.invoke("kiosco:open-cash-drawer", options),
  captureScreenshot: () => ipcRenderer.invoke("kiosco:capture-screenshot"),
  localCloudUrl: "http://127.0.0.1:8787",
});
