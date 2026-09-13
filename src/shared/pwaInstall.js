let deferredInstallPrompt = null;
let waitingWorker = null;
let updateReady = false;
const listeners = new Set();

export const isPwaStandalone = () => typeof window !== "undefined" && (
  window.matchMedia?.("(display-mode: standalone)").matches
  || window.navigator.standalone === true
);

export const getPwaInstallState = () => ({
  canInstall: Boolean(deferredInstallPrompt),
  standalone: isPwaStandalone(),
  updateReady,
});

const notify = () => {
  const state = getPwaInstallState();
  listeners.forEach((listener) => listener(state));
};

export const subscribePwaInstall = (listener) => {
  listeners.add(listener);
  listener(getPwaInstallState());
  return () => listeners.delete(listener);
};

export const requestPwaInstall = async () => {
  const prompt = deferredInstallPrompt;
  if (!prompt) return { available: false, outcome: "unavailable" };

  // El aviso del navegador sólo puede usarse una vez. Lo conservamos desde
  // que carga la página para que no se pierda mientras Kiosco+ inicia.
  deferredInstallPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  return { available: true, outcome: choice?.outcome || "dismissed" };
};

export const markPwaUpdateReady = (worker = null) => {
  waitingWorker = worker || waitingWorker;
  updateReady = true;
  notify();
};

export const applyPwaUpdate = () => {
  if (!waitingWorker || !navigator.serviceWorker) {
    window.location.reload();
    return;
  }
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  window.setTimeout(reload, 1500);
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notify();
  });
}
