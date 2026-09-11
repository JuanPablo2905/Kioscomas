import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight, BarChart3, Check, ChevronDown, Clock3, Cloud, CreditCard,
  Download, HardDrive, Package, RefreshCw, ShieldCheck, ShoppingCart,
  Smartphone, Sparkles, Store, Users, WifiOff,
} from "lucide-react";
import "./landing.css";
import "./landing-animations.css";
import "./landing-responsive.css";
import { normalizeWhatsAppPhone } from "./shared/share.js";
import { PublicSiteNav } from "./shared/PublicSiteNav.jsx";

const base = import.meta.env.BASE_URL;
const demoUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./app.html";
const cloudAppUrl = import.meta.env.VITE_CLOUD_APP_URL || "https://app.kioscomas.ar";
const contactEmail = String(import.meta.env.VITE_LEGAL_EMAIL || "juan@kioscomas.ar").trim();
const windowsDownloadUrl = import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Setup.exe";
const macAppleSiliconDownloadUrl = import.meta.env.VITE_MAC_APPLE_SILICON_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-arm64.dmg";
const macIntelDownloadUrl = import.meta.env.VITE_MAC_INTEL_DOWNLOAD_URL || "https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-x64.dmg";
const whatsappNumber = normalizeWhatsAppPhone(import.meta.env.VITE_SALES_WHATSAPP || "1122502706");
const wa = (message) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
const visitorPlatform = typeof navigator === "undefined" ? "" : `${navigator.platform || ""} ${navigator.userAgent || ""}`;
const visitorUsesMac = /Mac/i.test(visitorPlatform) && !/iPhone|iPad|iPod/i.test(visitorPlatform);
const visitorUsesMobile = /Android|iPhone|iPad|iPod/i.test(visitorPlatform);
const preferredDownload = visitorUsesMobile
  ? { url: cloudAppUrl, label: "Abrir app" }
  : visitorUsesMac
    ? { url: "#descargas-mac", label: "Elegir versión para Mac" }
    : { url: windowsDownloadUrl, label: "Descargar" };

const features = [
  { icon: Package, title: "Stock bajo control", text: "Sabé qué mercadería tenés guardada y qué falta en el mostrador. La app te avisa antes de que un producto se termine." },
  { icon: ShoppingCart, title: "Vendé sin fricción", text: "Elegí los productos, cobrá en efectivo, tarjeta, transferencia o Mercado Pago y entregá el vuelto desde una sola pantalla." },
  { icon: CreditCard, title: "Caja clara", text: "Abrí la caja al empezar el día, registrá ingresos y gastos, y comprobá al cierre si el dinero coincide." },
  { icon: BarChart3, title: "Decidí con datos", text: "Mirá cuánto vendiste, cuáles son tus productos más elegidos y qué mercadería está quieta para saber qué conviene reponer." },
  { icon: Users, title: "Equipo con permisos", text: "Si trabajás con otras personas, podés crearles un usuario y decidir qué tareas puede hacer cada una dentro de la app." },
  { icon: ShieldCheck, title: "Todo queda registrado", text: "Podés revisar quién hizo cada cambio importante —como una venta, un ajuste de stock o un movimiento de caja— y cuándo lo hizo." },
];

const faqs = [
  ["¿Sirve para un kiosco chico?", "Sí. Kiosco+ está pensado para kioscos, almacenes, minimarkets y comercios de barrio argentinos."],
  ["¿Puedo usarlo sin internet?", "Sí. Después de abrir la app e iniciar sesión una vez con conexión, podés seguir vendiendo y registrando movimientos sin Internet. Los cambios quedan guardados en el dispositivo y se envían a la nube cuando vuelve la conexión."],
  ["¿Qué cosas necesitan conexión?", "La primera carga, la activación o creación de una cuenta, la sincronización entre dispositivos y las consultas externas necesitan Internet."],
  ["¿Puedo tener empleados?", "Sí. Podés crear roles, elegir permisos y conservar un historial de las acciones importantes."],
  ["¿Qué versión tengo que descargar en una Mac?", "Si en Acerca de esta Mac dice Chip Apple M1, M2, M3, M4 o posterior, elegí Apple Silicon. Si dice Procesador Intel, elegí Intel. Después abrí el DMG, arrastrá Kiosco+ a Aplicaciones y, como todavía no tiene firma de Apple, usá Control + clic → Abrir la primera vez."],
  ["¿Tengo que descargar algo en el celular?", "No. En iPhone y Android abrís la aplicación web y elegís Agregar a inicio o Instalar aplicación. Queda con su ícono y recibe las actualizaciones automáticamente."],
];

function DemoPanel() {
  const screens = [
    { menu: "Inicio", greeting: "Buenas tardes, María", title: "Así está tu negocio hoy", action: "+ Nueva venta" },
    { menu: "Stock", greeting: "Control de mercadería", title: "Productos para revisar", action: "+ Cargar producto" },
    { menu: "Vitrina", greeting: "Mostrador", title: "Reposición pendiente", action: "Reponer ahora" },
    { menu: "Ventas / Caja", greeting: "Caja abierta", title: "Vendé rápido y claro", action: "+ Nueva venta" },
    { menu: "Compras", greeting: "Próximo pedido", title: "Lo que falta reponer", action: "Ver pedido" },
    { menu: "Reportes", greeting: "Resumen del negocio", title: "Tus números de la semana", action: "Ver reporte" },
  ];
  const [activeScreen, setActiveScreen] = useState(0);
  const [demoPaused, setDemoPaused] = useState(false);
  useEffect(() => {
    if (demoPaused) return undefined;
    const interval = window.setInterval(() => setActiveScreen((current) => (current + 1) % screens.length), 2800);
    return () => window.clearInterval(interval);
  }, [demoPaused, screens.length]);
  const screen = screens[activeScreen];
  return (
    <div className="demo-window" aria-label="Vista interactiva de Kiosco Plus" onPointerEnter={() => setDemoPaused(true)} onPointerLeave={() => setDemoPaused(false)}>
      <div className="demo-sidebar">
        <img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" />
        {screens.map((item, index) => (
          <button type="button" aria-pressed={index === activeScreen} className={index === activeScreen ? "demo-nav active" : "demo-nav"} onClick={() => setActiveScreen(index)} onFocus={() => setDemoPaused(true)} onBlur={() => setDemoPaused(false)} key={item.menu}>{item.menu}</button>
        ))}
        <div className="demo-user"><span>MS</span><div><b>María</b><small>Dueña</small></div></div>
      </div>
      <div className="demo-content" aria-live="polite"><div className="demo-head" key={screen.menu}><div><small>{screen.greeting}</small><h3>{screen.title}</h3></div><button type="button">{screen.action}</button></div><DemoScreen menu={screen.menu}/></div>
    </div>
  );
}

function Metric({ label, value, sub, accent }) { return <div className={`metric ${accent}`}><small>{label}</small><b>{value}</b><span>{sub}</span></div>; }

function DemoScreen({ menu }) {
  if (menu === "Stock") return <div className="demo-screen" key={menu}><div className="demo-search">⌕ &nbsp; Buscar por nombre o código</div><div className="demo-table"><div><b>Coca-Cola 500 ml</b><span>24 en depósito · 8 en vitrina</span><i>OK</i></div><div><b>Alfajor triple</b><span>35 en depósito · 12 en vitrina</span><i>OK</i></div><div><b>Papas fritas 90 g</b><span>15 en depósito · 2 en vitrina</span><i className="warn">Reponer</i></div></div><p className="demo-caption">Productos, cantidades y alertas de reposición.</p></div>;
  if (menu === "Vitrina") return <div className="demo-screen" key={menu}><div className="demo-showcase"><div><span>Heladera</span><b>Coca-Cola 500 ml</b><small>8 disponibles</small></div><div><span>Mostrador</span><b>Alfajor triple</b><small>12 disponibles</small></div><div className="low"><span>Góndola</span><b>Papas fritas 90 g</b><small>Quedan 2 · reponer</small></div></div><p className="demo-caption">Lo que está a la vista y necesita reposición.</p></div>;
  if (menu === "Ventas / Caja") return <div className="demo-screen demo-sale" key={menu}><div className="demo-product-list"><b>Productos</b><span>Coca-Cola 500 ml <i>$1.600</i></span><span>Alfajor triple <i>$1.100</i></span><span>Papas fritas 90 g <i>$1.700</i></span></div><div className="demo-cart"><b>Venta actual</b><span>2 × Coca-Cola</span><span>1 × Alfajor</span><strong>Total &nbsp; $4.300</strong><button>Cobrar</button></div></div>;
  if (menu === "Compras") return <div className="demo-screen" key={menu}><div className="demo-order"><div><b>Distribuidora Río</b><span>3 productos para pedir</span></div><i>Pedido</i></div><div className="demo-order"><div><b>Mayorista Central</b><span>Compra recibida ayer</span></div><i className="done">Recibido</i></div><div className="demo-order"><div><b>Lácteos del Barrio</b><span>Entrega mañana · 09:00</span></div><i>Programado</i></div><p className="demo-caption">Pedidos agrupados por proveedor.</p></div>;
  if (menu === "Reportes") return <div className="demo-screen" key={menu}><div className="demo-report-metrics"><Metric label="Vendiste" value="$184.300" accent="green" sub="Esta semana"/><Metric label="Ganancia est." value="$64.505" accent="blue" sub="35% de margen"/></div><div className="demo-report-chart"><span/><span/><span/><span/><span/><span/><span/></div><p className="demo-caption">Ventas y productos que mejor rindieron.</p></div>;
  return <div className="demo-screen" key={menu}><div className="demo-metrics"><Metric label="Caja" value="Abierta" accent="green" sub="$ 42.500" /><Metric label="Ventas de hoy" value="$ 13.620" accent="blue" sub="3 tickets" /><Metric label="Productos críticos" value="2" accent="orange" sub="Revisar stock" /></div><div className="demo-grid"><div className="demo-card"><div className="demo-card-head"><b>Lo más vendido</b><span>Esta semana</span></div><div className="bar-row"><span>Alfajor triple</span><i style={{width:"88%"}} /></div><div className="bar-row"><span>Coca-Cola 500 ml</span><i style={{width:"66%"}} /></div><div className="bar-row"><span>Papas fritas</span><i style={{width:"45%"}} /></div></div><div className="demo-card alerts"><div className="demo-card-head"><b>Atención hoy</b><span className="dot" /></div><p><em>2</em> productos para reponer</p><p><em>1</em> compra pendiente</p></div></div></div>;
}

function App() {
  const [openFaq, setOpenFaq] = useState(null);
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.14 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <main>
    <PublicSiteNav base={base} currentPage="inicio" demoUrl={demoUrl} cloudAppUrl={cloudAppUrl} preferredDownload={preferredDownload}/>

    <section className="hero" id="inicio"><div className="hero-copy hero-enter"><div className="eyebrow"><Sparkles size={15}/> Hecha para comercios reales</div><h1>Tu negocio, <i>más claro</i> todos los días.</h1><p>Stock, ventas, caja, compras y clientes en una sola herramienta simple de usar. Pensada para kioscos y comercios de barrio.</p><div className="hero-actions" style={{flexWrap:"wrap"}}><a className="button primary" href={cloudAppUrl}>Ingresar a mi cuenta <ArrowRight size={18}/></a><a className="button ghost" href={demoUrl}>Probar demo <ArrowRight size={18}/></a><a className="button ghost" href={windowsDownloadUrl}><Download size={18}/> Windows</a><a className="button ghost" href="#descargas-mac"><Download size={18}/> Mac</a></div><div className="hero-trust"><span><Check size={15}/> Windows 10 y 11</span><span><Check size={15}/> Mac Intel y Apple Silicon</span><span><Check size={15}/> Celular y computadora</span><span><Check size={15}/> Hecha en Argentina</span></div></div><div className="hero-visual hero-device-enter"><div className="glow"/><DemoPanel/><div className="demo-hint"><span><Sparkles size={14}/> Tocá las secciones para recorrer la app</span><a href={demoUrl}>Abrir la demo completa <ArrowRight size={15}/></a></div></div></section>

    <section className="strip"><p>Menos planillas, menos cuentas de memoria, <b>más control.</b></p><div><Store/> Kioscos <span/> Almacenes <span/> Minimarkets <span/> Comercios de barrio</div></section>

    <section className="consumer-actions" aria-label="Gestiones de contratación"><span>Gestiones directas, sin iniciar sesión</span><div><a href="./terminos.html">Términos y condiciones</a><a href="./privacidad.html">Privacidad</a><a href={wa("Hola Kiosco+, solicito la baja de mi servicio. Necesito el código de identificación de la solicitud.")} target="_blank" rel="noopener noreferrer">BOTÓN DE BAJA DE SERVICIO</a><a href={wa("Hola Kiosco+, quiero ejercer el derecho de arrepentimiento respecto de la contratación del servicio. Necesito el código de identificación de la solicitud.")} target="_blank" rel="noopener noreferrer">BOTÓN DE ARREPENTIMIENTO</a></div></section>

    <section className="mac-downloads section" id="descargas-mac"><div className="mac-download-copy"><span className="eyebrow"><Download size={15}/> Descarga para macOS</span><h2>Elegí el instalador de tu Mac.</h2><p>En el menú Apple  abrí <b>Acerca de esta Mac</b>. Si aparece “Chip Apple”, usá Apple Silicon. Si aparece “Procesador Intel”, usá Intel.</p></div><div className="mac-download-grid"><a className="mac-download-card recommended" href={macAppleSiliconDownloadUrl}><span>La mayoría de las Mac nuevas</span><h3>Apple Silicon</h3><p>M1, M2, M3, M4 y posteriores.</p><strong><Download size={18}/> Descargar DMG</strong></a><a className="mac-download-card" href={macIntelDownloadUrl}><span>Modelos anteriores</span><h3>Intel</h3><p>Mac que indican “Procesador Intel”.</p><strong><Download size={18}/> Descargar DMG</strong></a></div></section>

    <section className="section features" id="funciones"><div className="section-intro reveal"><span className="eyebrow">Todo en un solo lugar</span><h2>La información que necesitás, cuando la necesitás.</h2><p>Kiosco+ acompaña el ritmo real del mostrador y te ayuda a detectar lo importante antes de que se convierta en un problema.</p></div><div className="feature-grid">{features.map(({icon: Icon, title, text}, index)=><article className="feature reveal" style={{"--delay":`${index * 80}ms`}} key={title}><div className="feature-icon"><Icon size={22}/></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="section workflow" id="como-funciona"><div className="workflow-copy"><span className="eyebrow">Simple desde el primer día</span><h2>Tu negocio ordenado en tres pasos.</h2><div className="steps"><Step n="01" title="Cargá tus productos" text="Ingresá tu stock, precios y alertas. También podés usar los datos de demo para conocer la app."/><Step n="02" title="Trabajá como siempre" text="Vendé, mové stock, recibí compras y registrá los movimientos de caja."/><Step n="03" title="Tomá mejores decisiones" text="Consultá reportes y alertas para saber qué reponer, qué revisar y qué está funcionando."/></div></div><div className="workflow-card"><Clock3 size={30}/><h3>Una pantalla que te acompaña</h3><p>La vista de inicio reúne caja, ventas, alertas y accesos rápidos para no perder tiempo buscando información.</p><div className="mini-chart"><span/><span/><span/><span/><span/><span/><span/></div></div></section>

    <section className="section offline-section" id="sin-internet"><div className="offline-copy reveal"><span className="eyebrow"><WifiOff size={15}/> Preparada para los cortes</span><h2>Si se corta Internet, el negocio sigue.</h2><p>Después de ingresar una vez con conexión, la operación diaria queda disponible en el dispositivo. Podés seguir trabajando y Kiosco+ se ocupa de enviar los cambios cuando vuelve la red.</p><div className="offline-points"><span><Check size={17}/> Ventas, caja y stock siguen disponibles</span><span><Check size={17}/> Los cambios quedan guardados localmente</span><span><Check size={17}/> La sincronización se retoma automáticamente</span></div><small>La primera carga, la activación y el alta de una cuenta nueva sí requieren Internet.</small></div><div className="offline-flow reveal" aria-label="Cómo funciona Kiosco Plus sin conexión"><article><div><HardDrive size={22}/></div><span>1</span><h3>Guardado en el dispositivo</h3><p>La venta no se pierde aunque la conexión se corte.</p></article><ArrowRight className="offline-arrow"/><article><div><RefreshCw size={22}/></div><span>2</span><h3>Vuelve Internet</h3><p>No hace falta repetir ni volver a cargar los datos.</p></article><ArrowRight className="offline-arrow"/><article><div><Cloud size={22}/></div><span>3</span><h3>Nube sincronizada</h3><p>Los demás dispositivos reciben los cambios.</p></article><div className="offline-device"><Smartphone size={20}/><b>También desde el celular</b></div></div></section>

    <section className="section testimonial"><blockquote>“La idea es que nadie tenga que acordarse de todo de memoria. Que el negocio te muestre qué necesita.”</blockquote><p>— La filosofía detrás de Kiosco+</p></section>

    <section className="section faq" id="preguntas"><div className="section-intro"><span className="eyebrow">Preguntas frecuentes</span><h2>Hecha para que sea fácil empezar.</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><button className={openFaq===i?"faq-item open":"faq-item"} onClick={()=>setOpenFaq(openFaq===i?null:i)} key={q}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div></section>

    <section className="closing"><div><span className="eyebrow">Empezá a ordenar tu negocio</span><h2>Menos vueltas. Más tiempo para vender.</h2><p>Instalá Kiosco+ en Windows o Mac. En iPhone y Android podés abrir la aplicación web y agregarla a la pantalla de inicio.</p></div><div className="hero-actions" style={{margin:0,flexWrap:"wrap"}}><a className="button light" href={cloudAppUrl}>Ingresar a mi cuenta <ArrowRight size={18}/></a><a className="button light" href={windowsDownloadUrl}><Download size={18}/> Windows</a><a className="button light" href="#descargas-mac"><Download size={18}/> Mac</a><a className="button ghost" href={demoUrl} style={{background:"#fff0e8"}}>Probar demo <ArrowRight size={18}/></a></div></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><a href={`mailto:${contactEmail}`} aria-label={`Enviar un correo a ${contactEmail}`}>{contactEmail}</a><a href="./terminos.html">Términos y condiciones</a><a href="./privacidad.html">Privacidad</a><span>© {new Date().getFullYear()} Kiosco+</span></footer>
  </main>;
}
function Step({n,title,text}) { return <div className="step"><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
