import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./shared/pwaInstall";
import KioscoApp from "./app/KioscoApp";
import { NativeSelectBridge } from "./shared/controls";
import { secondaryWindowContext } from "./shared/secondaryWindows";
import { PwaUpdateNotice } from "./shared/PwaUpdateNotice";
import { markPwaUpdateReady } from "./shared/pwaInstall";
import "./styles.css";

const secondaryContext = secondaryWindowContext();
const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const CustomerDisplayScreen = lazyNamed(() => import("./features/ventas/CustomerDisplayScreen"), "CustomerDisplayScreen");
const RemoteDisplayScreen = lazyNamed(() => import("./features/ventas/RemoteDisplayScreen"), "RemoteDisplayScreen");
const isSecondaryDisplay = secondaryContext.mode === "customer-display" || secondaryContext.mode === "remote-display";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[#F7F2E8] p-6 text-center font-semibold text-[#1C4A44]">Cargando Kiosco+…</div>}>
      {secondaryContext.mode === "customer-display"
        ? <CustomerDisplayScreen channelId={secondaryContext.channelId}/>
        : secondaryContext.mode === "remote-display"
          ? <RemoteDisplayScreen pairingCode={secondaryContext.pairingCode}/>
          : <KioscoApp />}
    </Suspense>
    <NativeSelectBridge />
    {!isSecondaryDisplay && <PwaUpdateNotice />}
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD && window.location.protocol !== "file:") {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      if (registration.waiting) markPwaUpdateReady(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) markPwaUpdateReady(worker);
        });
      });
      const check = () => registration.update().catch(() => {});
      // En una PWA instalada (iOS en particular) rara vez ocurre una transición
      // de "oculta a visible": cada apertura arranca ya visible. Sin este chequeo
      // al cargar, la detección de actualización dependía únicamente de esa
      // transición o de una hora seguida con la app abierta.
      check();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      window.setInterval(check, 60 * 60 * 1000);
    } catch {}
  });
}
