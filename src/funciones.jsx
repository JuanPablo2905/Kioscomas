import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowRight, BarChart3, BellRing, Check, CloudOff, CreditCard, MonitorUp, Package, ScanLine, ShieldCheck, ShoppingCart, Users } from "lucide-react";
import "./landing.css";
import "./landing-responsive.css";
import { PublicSiteNav } from "./shared/PublicSiteNav.jsx";

const base = import.meta.env.BASE_URL;
const demoUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./app.html";
const cloudAppUrl = import.meta.env.VITE_CLOUD_APP_URL || "https://app.kioscomas.ar";
const groups = [
  { id: "ventas", icon: ShoppingCart, title: "Ventas y caja", summary: "Armá el ticket, aplicá promociones, dividí pagos y controlá el vuelto.", points: ["Promociones identificadas en cada producto", "Efectivo, tarjeta, transferencia, cuenta corriente y pago combinado", "Tickets, devoluciones, anulaciones y caja auditables"] },
  { id: "pantallas", icon: MonitorUp, title: "Pantalla para clientes", summary: "Usá un segundo monitor en la caja o una pantalla publicitaria remota.", points: ["Editor libre de widgets, tamaños y posiciones", "Promociones, clima, horarios, redes, medios de pago y contenido propio", "Pantalla publicitaria vinculada desde kioscomas.ar/pantalla"] },
  { id: "mercado-pago", icon: CreditCard, title: "Mercado Pago", summary: "Mostrá tu QR estático hoy y prepará cobros conectados sin salir de la venta.", points: ["QR en la caja, pantalla del cliente u otro celular", "QR dinámico por el total exacto, en integración", "Envío de importe a Point, en integración"] },
  { id: "stock", icon: Package, title: "Stock, vitrina y compras", summary: "Separá depósito de exhibición y recibí mercadería sin perder el historial.", points: ["Alertas de mínimo, reposición y vencimiento", "Pedidos y entregas por proveedor", "Importación, familias, variantes y códigos de barras"] },
  { id: "avisos", icon: BellRing, title: "Avisos que sirven", summary: "Diferenciá lo que pasa en tu comercio de los mensajes generales de Kiosco+.", points: ["Avisos del negocio", "Cuenta y suscripción", "Novedades, mantenimiento y versiones"] },
  { id: "reportes", icon: BarChart3, title: "Reportes claros", summary: "Entendé ventas, margen, caja y movimiento de productos sin armar planillas.", points: ["Períodos comparables", "Productos más vendidos y mercadería quieta", "Valores sensibles ocultables frente a terceros"] },
  { id: "equipo", icon: Users, title: "Equipo y permisos", summary: "Cada persona entra con su usuario y sólo puede hacer lo que le corresponde.", points: ["Roles personalizables", "Sesiones revocables", "Auditoría con nombres legibles"] },
  { id: "offline", icon: CloudOff, title: "Trabajo sin conexión", summary: "La operación diaria sigue guardándose en el dispositivo durante un corte.", points: ["Ventas, stock y caja locales", "Cola visible de cambios pendientes", "Sincronización automática al recuperar Internet"] },
  { id: "seguridad", icon: ShieldCheck, title: "Datos y seguridad", summary: "Acceso aislado por negocio, recuperación y respaldos controlados.", points: ["Contraseñas protegidas", "Dispositivos autorizados", "Exportación y restauración del negocio"] },
  { id: "scanner", icon: ScanLine, title: "Escáner y etiquetas", summary: "Buscá productos y tickets con cámara o lector, y generá etiquetas válidas.", points: ["EAN-8, UPC-A, EAN-13 y Code 39", "Cámara del celular", "Diseños de etiquetas personalizables"] },
];

function App() {
  return <main>
    <PublicSiteNav base={base} currentPage="funciones" demoUrl={demoUrl} cloudAppUrl={cloudAppUrl} preferredDownload={{ url: "./descargas.html", label: "Descargas" }}/>
    <section className="public-page-hero"><span className="eyebrow"><Check size={15}/> Funciones de Kiosco+</span><h1>Todo lo que necesitás, explicado sin vueltas.</h1><p>Esta página reúne el detalle. En la portada sólo mostramos un resumen para que sea fácil entender qué distingue a Kiosco+.</p><div className="hero-actions"><a className="button primary" href={cloudAppUrl}>Ingresar <ArrowRight size={18}/></a><a className="button ghost" href={demoUrl}>Probar demo</a></div></section>
    <section className="section function-directory">{groups.map(({ id, icon: Icon, title, summary, points }) => <article className="function-detail" id={id} key={id}><span className="feature-icon"><Icon size={24}/></span><div><h2>{title}</h2><p>{summary}</p><ul>{points.map((point) => <li key={point}><Check size={16}/>{point}</li>)}</ul></div></article>)}</section>
    <section className="closing"><div><span className="eyebrow">¿Querés verlo funcionando?</span><h2>Recorré una cuenta de demostración.</h2><p>No modifica datos reales y podés conocer las áreas principales antes de instalar.</p></div><a className="button light" href={demoUrl}>Abrir demostración <ArrowRight size={18}/></a></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><a href="./descargas.html">Descargas</a><a href="./precios.html">Precios</a><a href="./terminos.html">Términos</a><a href="./privacidad.html">Privacidad</a></footer>
  </main>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
