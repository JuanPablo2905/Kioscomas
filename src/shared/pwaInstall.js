let deferredInstallPrompt = null;
const listeners = new Set();

export const isPwaStandalone = () => typeof window !== "undefined" && (
  window.matchMedia?.("(display-mode: standalone)").matches
  || window.navigator.standalone === true
);

export const getPwaInstallState = () => ({
  canInstall: Boolean(deferredInstallPrompt),
  standalone: isPwaStandalone(),
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
