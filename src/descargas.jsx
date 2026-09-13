import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowRight, Check, Download, Laptop, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import "./landing.css";
import "./landing-responsive.css";
import { PublicSiteNav } from "./shared/PublicSiteNav.jsx";

const base = import.meta.env.BASE_URL;
const demoUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./app.html";
const cloudAppUrl = import.meta.env.VITE_CLOUD_APP_URL || "https://app.kioscomas.ar";
const windowsUrl = import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Setup.exe";
const macArmUrl = import.meta.env.VITE_MAC_APPLE_SILICON_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-arm64.dmg";
const macIntelUrl = import.meta.env.VITE_MAC_INTEL_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-x64.dmg";
const version = import.meta.env.VITE_APP_VERSION;

function App() {
  return <main>
    <PublicSiteNav base={base} currentPage="descargas" demoUrl={demoUrl} cloudAppUrl={cloudAppUrl} preferredDownload={{ url: "./descargas.html", label: "Descargas" }}/>
    <section className="public-page-hero"><span className="eyebrow"><Download size={15}/> Centro de descargas</span><h1>Usá Kiosco+ donde trabajás.</h1><p>Elegí la versión correcta para tu computadora o abrí la app desde el celular. Tu cuenta y tus datos son los mismos en todos los dispositivos autorizados.</p><div className="version-chip">Versión actual: v{version}</div></section>

    <section className="section download-options">
      <article className="download-option featured"><span className="download-icon"><Monitor size={28}/></span><small>Windows 10 y 11</small><h2>Windows</h2><p>Instalador recomendado para la caja principal. Incluye actualización automática y soporte para impresora configurada.</p><a className="button primary" href={windowsUrl}><Download size={18}/> Descargar para Windows</a></article>
      <article className="download-option"><span className="download-icon"><Laptop size={28}/></span><small>Mac nuevas</small><h2>Mac Apple Silicon</h2><p>Para equipos que en “Acerca de esta Mac” indican chip Apple M1, M2, M3, M4 o posterior.</p><a className="button ghost" href={macArmUrl}><Download size={18}/> Descargar DMG</a></article>
      <article className="download-option"><span className="download-icon"><Laptop size={28}/></span><small>Mac anteriores</small><h2>Mac Intel</h2><p>Para equipos que en “Acerca de esta Mac” indican “Procesador Intel”.</p><a className="button ghost" href={macIntelUrl}><Download size={18}/> Descargar DMG</a></article>
      <article className="download-option mobile"><span className="download-icon"><Smartphone size={28}/></span><small>iPhone y Android</small><h2>App web instalable</h2><p>Abrila desde el navegador y elegí “Agregar a inicio” o “Instalar aplicación”. Se actualiza automáticamente.</p><a className="button ghost" href={cloudAppUrl}>Abrir la app <ArrowRight size={18}/></a></article>
    </section>

    <section className="download-help section"><div><ShieldCheck size={28}/><h2>Antes de instalar</h2><p>Descargá Kiosco+ únicamente desde esta página o desde las versiones oficiales de GitHub. En Mac, la primera apertura puede requerir Control + clic → Abrir mientras completamos la firma de Apple.</p></div><ul><li><Check size={16}/> La versión instalada y la web usan la misma cuenta.</li><li><Check size={16}/> Dos dispositivos están incluidos en el plan.</li><li><Check size={16}/> Las actualizaciones conservan los datos.</li></ul></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><a href="./funciones.html">Funciones</a><a href="./precios.html">Precios</a><a href="./terminos.html">Términos</a><a href="./privacidad.html">Privacidad</a></footer>
  </main>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
