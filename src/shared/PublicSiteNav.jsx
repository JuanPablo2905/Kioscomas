import React, { useEffect, useState } from "react";
import { ArrowRight, Download, LogIn, Menu, X } from "lucide-react";

const links = [
  { id: "inicio", label: "Inicio", href: "./" },
  { id: "funciones", label: "Funciones", href: "./#funciones" },
  { id: "como-funciona", label: "Cómo funciona", href: "./#como-funciona" },
  { id: "sin-internet", label: "Sin Internet", href: "./#sin-internet" },
  { id: "precios", label: "Precios", href: "./precios.html" },
  { id: "preguntas", label: "Preguntas", href: "./#preguntas" },
];

export function PublicSiteNav({
  base,
  currentPage = "inicio",
  demoUrl,
  cloudAppUrl,
  preferredDownload,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 1020) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, []);

  const close = () => setOpen(false);
  const downloadIsAppLink = preferredDownload?.url === cloudAppUrl;

  return (
    <nav className="nav public-site-nav" aria-label="Navegación principal">
      <a className="brand" href="./" onClick={close}>
        <img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" />
      </a>

      <div className="nav-links">
        {links.filter((item) => item.id !== "inicio").map((item) => (
          <a className={currentPage === item.id ? "active" : ""} href={item.href} key={item.id}>{item.label}</a>
        ))}
        <a href={demoUrl}>Probar demo</a>
      </div>

      <div className="nav-actions">
        <a className="nav-cta nav-login" href={cloudAppUrl}><LogIn size={16}/> Ingresar</a>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-public-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>

      {open && (
        <div className="mobile-nav-panel" id="mobile-public-menu">
          <div className="mobile-nav-links">
            {links.map((item) => (
              <a className={currentPage === item.id ? "active" : ""} href={item.href} onClick={close} key={item.id}>
                <span>{item.label}</span><ArrowRight size={16}/>
              </a>
            ))}
          </div>
          <div className="mobile-nav-actions">
            <a className="button primary" href={cloudAppUrl} onClick={close}><LogIn size={17}/> Ingresar a mi cuenta</a>
            <a className="button ghost" href={demoUrl} onClick={close}>Probar demo <ArrowRight size={17}/></a>
            {preferredDownload && !downloadIsAppLink && (
              <a className="button ghost" href={preferredDownload.url} onClick={close}><Download size={17}/> {preferredDownload.label}</a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
