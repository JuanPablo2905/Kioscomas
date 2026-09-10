const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioscoDesktop", {
  openCashDrawer: (options) => ipcRenderer.invoke("kiosco:open-cash-drawer", options),
  captureScreenshot: () => ipcRenderer.invoke("kiosco:capture-screenshot"),
  secondaryWindows: {
    openBusiness: (options) => ipcRenderer.invoke("kiosco:secondary-window:open-business", options),
  },
  customerDisplay: {
    listDisplays: () => ipcRenderer.invoke("kiosco:customer-display:list"),
    open: (options) => ipcRenderer.invoke("kiosco:customer-display:open", options),
    publish: (detail) => ipcRenderer.invoke("kiosco:customer-display:publish", detail),
    ready: () => ipcRenderer.invoke("kiosco:customer-display:ready"),
    close: () => ipcRenderer.invoke("kiosco:customer-display:close"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("kiosco:customer-display:state", listener);
      return () => ipcRenderer.removeListener("kiosco:customer-display:state", listener);
    },
  },
  localCloudUrl: "http://127.0.0.1:8787",
  runtime: {
    get: () => ipcRenderer.invoke("kiosco:runtime:get"),
  },
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
