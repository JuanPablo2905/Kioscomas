const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioscoDesktop", {
  openCashDrawer: (options) => ipcRenderer.invoke("kiosco:open-cash-drawer", options),
  captureScreenshot: () => ipcRenderer.invoke("kiosco:capture-screenshot"),
  localCloudUrl: "http://127.0.0.1:8787",
  updates: {
    getState: () => ipcRenderer.invoke("kiosco:updates:get-state"),
    check: () => ipcRenderer.invoke("kiosco:updates:check"),
    configure: (policy) => ipcRenderer.invoke("kiosco:updates:configure", policy),
    install: () => ipcRenderer.invoke("kiosco:updates:install"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("kiosco:update-state", listener);
      return () => ipcRenderer.removeListener("kiosco:update-state", listener);
    },
  },
});
