import React from "react";
import ReactDOM from "react-dom/client";
import "./shared/pwaInstall";
import KioscoApp from "./app/KioscoApp";
import { NativeSelectBridge } from "./shared/controls";
import { secondaryWindowContext } from "./shared/secondaryWindows";
import { CustomerDisplayScreen } from "./features/ventas/CustomerDisplayScreen";
import "./styles.css";

const secondaryContext = secondaryWindowContext();
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {secondaryContext.mode === "customer-display"
      ? <CustomerDisplayScreen channelId={secondaryContext.channelId}/>
      : <KioscoApp />}
    <NativeSelectBridge />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD && window.location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
