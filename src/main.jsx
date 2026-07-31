import React from "react";
import ReactDOM from "react-dom/client";
import KioscoApp from "./app/KioscoApp";
import { NativeSelectBridge } from "./shared/controls";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><KioscoApp /><NativeSelectBridge /></React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD && window.location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
