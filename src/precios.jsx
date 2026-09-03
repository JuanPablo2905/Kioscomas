import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Gift, Share2, Sparkles, Store, UserPlus, Wallet, ArrowRight, Check, ChevronDown } from "lucide-react";
import "./landing.css";
import "./precios.css";
import { normalizeWhatsAppPhone } from "./shared/share.js";
import { DEFAULT_MONTHLY_PLAN_PRICE } from "./billing/referrals.js";

const base = import.meta.env.BASE_URL;
const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./";
const whatsappNumber = normalizeWhatsAppPhone(import.meta.env.VITE_SALES_WHATSAPP || "1122502706");
const envNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const monthlyPrice = envNumber(import.meta.env.VITE_PLAN_PRICE, DEFAULT_MONTHLY_PLAN_PRICE);
const launchPrice = envNumber(import.meta.env.VITE_LAUNCH_PRICE, 20000);
const extraDevicePrice = envNumber(import.meta.env.VITE_EXTRA_DEVICE_PRICE, 5000);
const money = (value) => `$${Number(value).toLocaleString("es-AR")}`;
const wa = (text) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

const planFeatures = [
  "Stock y control de mercadería",
  "Ventas, caja y cierre de caja",
  "Compras y reposición",
  "Reportes y alertas",
  "Usuarios con permisos",
  "Soporte directo",
];

const referralSteps = [
  { icon: Share2, title: "Compartí tu código", text: "Cada comercio tiene su código de referido listo para compartir." },
  { icon: UserPlus, title: "Sumá descuentos", text: "Cuando el comercio referido activa su primer abono, sumás un 20% de descuento." },
  { icon: Wallet, title: "Llegá a gratis", text: "Los descuentos se acumulan: con 5 referidos tu plan queda en $0." },
];

const faqs = [
  [`¿Los ${money(monthlyPrice)} son por negocio o por dispositivo?`, "Son por negocio e incluyen dos dispositivos simultáneos para que puedas trabajar junto a quien te ayude en el mostrador."],
  ["¿Cómo sumo un tercer dispositivo?", `Cada dispositivo adicional suma ${money(extraDevicePrice)} por mes. Lo sumás cuando lo necesites, sin permanencia.`],
  [`¿El Plan Lanzamiento queda en ${money(launchPrice)} para siempre?`, `Sí. Como agradecimiento por acompañarnos en el arranque, el primer mes es gratis y el plan queda en ${money(launchPrice)} por mes mientras sigas suscrito.`],
  ["¿Cómo funcionan los referidos?", "El nuevo comercio ingresa tu código al crear su cuenta. Cuando activa su primer abono, obtenés un 20% de descuento. Es acumulable: con 5 referidos activos llegás al 100% y pagás $0."],
  ["¿Puedo cancelar cuando quiera?", "Sí. No hay permanencia: podés dejar de suscribirte cuando quieras."],
];

function App() {
  const [openFaq, setOpenFaq] = useState(null);
  const [hoverPlans, setHoverPlans] = useState(null);
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.14 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <main>
    <nav className="nav"><a className="brand" href="./"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" /></a><div className="nav-links"><a href="./">Inicio</a><a href="./#funciones">Funciones</a><a href="./#como-funciona">Cómo funciona</a><a className="active" href="./precios.html">Precios</a><a href="./#preguntas">Preguntas</a></div><a className="nav-cta" href={appUrl}>Probar la app <ArrowRight size={16}/></a></nav>

    <section className="pricing-hero"><div className="eyebrow"><Sparkles size={15}/> Precios claros</div><h1>Un precio simple. <i>Sin sorpresas.</i></h1><p>Un solo plan, dos dispositivos incluidos y descuentos reales para quienes suman. Sin letra chica.</p></section>

    <section className="section plans" id="planes"><div className="plans-grid">
      <article className={"plan-card reveal" + (hoverPlans === "main" ? " hovered" : "")} onMouseEnter={() => setHoverPlans("main")} onMouseLeave={() => setHoverPlans(null)}><span className="plan-badge">Lo que elige la mayoría</span><div className="plan-icon"><Store size={22}/></div><h3>Kiosco+</h3><div className="plan-price"><b>{money(monthlyPrice)}</b><span>/mes</span></div><p className="plan-note">Incluye <b>2 dispositivos simultáneos</b>. Cada dispositivo adicional suma <b>{money(extraDevicePrice)}/mes</b>.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button ghost" href={wa(`Hola Kiosco+, me interesa el plan de ${money(monthlyPrice)}/mes con 2 dispositivos incluidos. ¿Cómo lo contrato?`)} target="_blank" rel="noopener noreferrer">Quiero este plan <ArrowRight size={18}/></a></article>

      <article className={"plan-card reveal" + (hoverPlans === "launch" ? " hovered" : "")} onMouseEnter={() => setHoverPlans("launch")} onMouseLeave={() => setHoverPlans(null)}><span className="plan-badge">Lanzamiento</span><div className="plan-icon"><Sparkles size={22}/></div><h3>Plan Lanzamiento</h3><div className="plan-price"><b>$0</b><span>el primer mes</span></div><p className="plan-note">Después queda en <b>{money(launchPrice)}/mes por siempre</b>, como agradecimiento por ayudarnos a cerrar la app.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button ghost" href={wa(`Hola Kiosco+, me interesa el Plan Lanzamiento (primer mes gratis, después ${money(launchPrice)}/mes). ¿Cómo lo contrato?`)} target="_blank" rel="noopener noreferrer">Quiero el plan lanzamiento <ArrowRight size={18}/></a></article>
    </div></section>

    <section className="section referrals" id="referidos"><div className="section-intro reveal"><span className="eyebrow"><Gift size={15}/> Referidos</span><h2>Recomendá Kiosco+ y pagá menos.</h2><p>Cada comercio que se registra con tu código y activa su primer abono te suma un 20% de descuento. Acumulá hasta que tu suscripción quede gratis.</p></div>
      <div className="referral-steps">{referralSteps.map(({icon: Icon, title, text}, index)=><div className="step reveal" key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      <div className="referral-bar reveal">{[1,2,3,4,5].map((n)=><div className={n===5?"seg full":"seg"} key={n}><b>{n * 20}%</b><span>{n===5?"Gratis":`${n} ${n===1?"cuenta":"cuentas"}`}</span></div>)}</div>
      <p className="referral-caption reveal">Con 5 referidos tu suscripción queda en <b>$0</b>.</p>
      <div className="referral-code reveal"><label>Tu código se genera automáticamente</label><p>Lo encontrás dentro de Kiosco+ en <b>Configuración → Negocio</b>, listo para copiar y compartir.</p><div className="code-row"><a className="button ghost" href={appUrl}>Abrir Kiosco+ <ArrowRight size={16}/></a></div><small>El comercio referido debe ingresarlo al crear su cuenta.</small></div>
    </section>

    <section className="section faq" id="preguntas"><div className="section-intro"><span className="eyebrow">Preguntas frecuentes</span><h2>Precios sin letra chica.</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><button className={openFaq===i?"faq-item open":"faq-item"} onClick={()=>setOpenFaq(openFaq===i?null:i)} key={q}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div></section>

    <section className="closing"><div><span className="eyebrow">¿Listo para ordenar tu negocio?</span><h2>Empezá hoy. Sin permanencia.</h2><p>Probalo gratis y quedate con el plan que mejor se adapte a tu comercio.</p></div><a className="button light" href={wa("Hola Kiosco+, quiero probar la app. ¿Cómo arranco?")} target="_blank" rel="noopener noreferrer">Escribime por WhatsApp <ArrowRight size={18}/></a></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><span>© {new Date().getFullYear()} Kiosco+</span></footer>
  </main>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
