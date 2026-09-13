import React from "react";
import ReactDOM from "react-dom/client";
import { RemoteDisplayScreen } from "./features/ventas/RemoteDisplayScreen.jsx";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
ReactDOM.createRoot(document.getElementById("root")).render(<RemoteDisplayScreen pairingCode={String(params.get("pair") || "")}/>);
