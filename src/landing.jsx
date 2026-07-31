import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight, BarChart3, Check, ChevronDown, Clock3, CreditCard,
  Package, ShieldCheck, ShoppingCart, Sparkles, Store, Users,
} from "lucide-react";
import "./landing.css";
import "./landing-animations.css";

const base = import.meta.env.BASE_URL;
const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./";

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
  ["¿Puedo usarlo sin internet?", "La app está diseñada para que puedas seguir trabajando localmente aun sin conexión."],
  ["¿Puedo tener empleados?", "Sí. Podés crear roles, elegir permisos y conservar un historial de las acciones importantes."],
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
  useEffect(() => {
    const interval = window.setInterval(() => setActiveScreen((current) => (current + 1) % screens.length), 2800);
    return () => window.clearInterval(interval);
  }, [screens.length]);
  const screen = screens[activeScreen];
  return (
    <div className="demo-window" aria-label="Vista de ejemplo de Kiosco Plus">
      <div className="demo-sidebar">
        <img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" />
        {screens.map((item, index) => (
          <div className={index === activeScreen ? "demo-nav active" : "demo-nav"} key={item.menu}>{item.menu}</div>
        ))}
        <div className="demo-user"><span>MS</span><div><b>María</b><small>Dueña</small></div></div>
      </div>
      <div className="demo-content"><div className="demo-head" key={screen.menu}><div><small>{screen.greeting}</small><h3>{screen.title}</h3></div><button>{screen.action}</button></div><DemoScreen menu={screen.menu}/></div>
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
    <nav className="nav"><a className="brand" href="#inicio"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" /></a><div className="nav-links"><a href="#funciones">Funciones</a><a href="#como-funciona">Cómo funciona</a><a href="#preguntas">Preguntas</a></div><a className="nav-cta" href={appUrl}>Probar la app <ArrowRight size={16}/></a></nav>

    <section className="hero" id="inicio"><div className="hero-copy hero-enter"><div className="eyebrow"><Sparkles size={15}/> Hecha para comercios reales</div><h1>Tu negocio, <i>más claro</i> todos los días.</h1><p>Stock, ventas, caja, compras y clientes en una sola herramienta simple de usar. Pensada para kioscos y comercios de barrio.</p><div className="hero-actions"><a className="button primary" href={appUrl}>Probar demo <ArrowRight size={18}/></a><a className="button ghost" href="#funciones">Conocer funciones</a></div><div className="hero-trust"><span><Check size={15}/> Sin instalaciones complicadas</span><span><Check size={15}/> Hecha en Argentina</span></div></div><div className="hero-visual hero-device-enter"><div className="glow"/><DemoPanel/></div></section>

    <section className="strip"><p>Menos planillas, menos cuentas de memoria, <b>más control.</b></p><div><Store/> Kioscos <span/> Almacenes <span/> Minimarkets <span/> Comercios de barrio</div></section>

    <section className="section features" id="funciones"><div className="section-intro reveal"><span className="eyebrow">Todo en un solo lugar</span><h2>La información que necesitás, cuando la necesitás.</h2><p>Kiosco+ acompaña el ritmo real del mostrador y te ayuda a detectar lo importante antes de que se convierta en un problema.</p></div><div className="feature-grid">{features.map(({icon: Icon, title, text}, index)=><article className="feature reveal" style={{"--delay":`${index * 80}ms`}} key={title}><div className="feature-icon"><Icon size={22}/></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="section workflow" id="como-funciona"><div className="workflow-copy"><span className="eyebrow">Simple desde el primer día</span><h2>Tu negocio ordenado en tres pasos.</h2><div className="steps"><Step n="01" title="Cargá tus productos" text="Ingresá tu stock, precios y alertas. También podés usar los datos de demo para conocer la app."/><Step n="02" title="Trabajá como siempre" text="Vendé, mové stock, recibí compras y registrá los movimientos de caja."/><Step n="03" title="Tomá mejores decisiones" text="Consultá reportes y alertas para saber qué reponer, qué revisar y qué está funcionando."/></div></div><div className="workflow-card"><Clock3 size={30}/><h3>Una pantalla que te acompaña</h3><p>La vista de inicio reúne caja, ventas, alertas y accesos rápidos para no perder tiempo buscando información.</p><div className="mini-chart"><span/><span/><span/><span/><span/><span/><span/></div></div></section>

    <section className="section testimonial"><blockquote>“La idea es que nadie tenga que acordarse de todo de memoria. Que el negocio te muestre qué necesita.”</blockquote><p>— La filosofía detrás de Kiosco+</p></section>

    <section className="section faq" id="preguntas"><div className="section-intro"><span className="eyebrow">Preguntas frecuentes</span><h2>Hecha para que sea fácil empezar.</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><button className={openFaq===i?"faq-item open":"faq-item"} onClick={()=>setOpenFaq(openFaq===i?null:i)} key={q}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div></section>

    <section className="closing"><div><span className="eyebrow">Empezá a ordenar tu negocio</span><h2>Menos vueltas. Más tiempo para vender.</h2><p>Conocé Kiosco+ y descubrí una forma más simple de llevar el día a día de tu comercio.</p></div><a className="button light" href={appUrl}>Abrir la demo <ArrowRight size={18}/></a></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><span>© {new Date().getFullYear()} Kiosco+</span></footer>
  </main>;
}
function Step({n,title,text}) { return <div className="step"><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
