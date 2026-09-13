import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Gift, Share2, Sparkles, Store, UserPlus, Wallet, ArrowRight, Check, ChevronDown } from "lucide-react";
import "./landing.css";
import "./precios.css";
import "./landing-responsive.css";
import { normalizeWhatsAppPhone } from "./shared/share.js";
import { BETA_TRIAL_DAYS, DEFAULT_MONTHLY_PLAN_PRICE, INTRODUCTORY_MONTHLY_PLAN_PRICE, INTRODUCTORY_PAID_MONTHS } from "./billing/referrals.js";
import { PublicSiteNav } from "./shared/PublicSiteNav.jsx";

const base = import.meta.env.BASE_URL;
const demoUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./app.html";
const cloudAppUrl = import.meta.env.VITE_CLOUD_APP_URL || "https://app.kioscomas.ar";
const contactEmail = String(import.meta.env.VITE_LEGAL_EMAIL || "juan@kioscomas.ar").trim();
const whatsappNumber = normalizeWhatsAppPhone(import.meta.env.VITE_SALES_WHATSAPP || "1122502706");
const envNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const monthlyPrice = envNumber(import.meta.env.VITE_PLAN_PRICE, DEFAULT_MONTHLY_PLAN_PRICE);
const launchPrice = envNumber(import.meta.env.VITE_LAUNCH_PRICE, INTRODUCTORY_MONTHLY_PLAN_PRICE);
const betaTrialDays = envNumber(import.meta.env.VITE_BETA_TRIAL_DAYS, BETA_TRIAL_DAYS);
const launchPaidMonths = envNumber(import.meta.env.VITE_LAUNCH_PAID_MONTHS, INTRODUCTORY_PAID_MONTHS);
const extraDevicePrice = envNumber(import.meta.env.VITE_EXTRA_DEVICE_PRICE, 5000);
const launchDiscount = monthlyPrice > 0 ? Math.round((1 - launchPrice / monthlyPrice) * 100) : 0;
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
  { icon: UserPlus, title: "Sumá descuentos", text: "Cada comercio referido con el abono vigente te suma un 20% de descuento." },
  { icon: Wallet, title: "Llegá a gratis", text: "Los descuentos se acumulan: con 5 referidos tu plan queda en $0." },
];

const faqs = [
  [`¿Los ${money(monthlyPrice)} son por negocio o por dispositivo?`, "Son por negocio e incluyen dos dispositivos simultáneos para que puedas trabajar junto a quien te ayude en el mostrador."],
  ["¿Cómo sumo un tercer dispositivo?", `Cada dispositivo adicional suma ${money(extraDevicePrice)} por mes. Lo sumás cuando lo necesites, sin permanencia.`],
  ["¿Necesito cargar una tarjeta para probar?", `No. La beta incluye ${betaTrialDays} días sin cargo y no pide tarjeta ni débito automático.`],
  [`¿Cuánto pago después de la beta?`, `Los primeros ${launchPaidMonths} meses pagos quedan en ${money(launchPrice)} por mes. Desde el cuarto mes rige el precio de lista de ${money(monthlyPrice)} por mes, salvo descuentos vigentes.`],
  ["¿Cómo funcionan los referidos?", "El nuevo comercio ingresa tu código al crear su cuenta. Mientras mantiene su abono vigente, obtenés un 20% de descuento. Si vence, el beneficio se pausa y vuelve cuando renueva. Con 5 referidos activos llegás al 100% y pagás $0."],
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
    <PublicSiteNav base={base} currentPage="precios" demoUrl={demoUrl} cloudAppUrl={cloudAppUrl}/>

    <section className="pricing-hero"><div className="eyebrow"><Sparkles size={15}/> Precios claros</div><h1>Probalo primero. <i>Decidí después.</i></h1><p>{betaTrialDays} días de beta sin cargo ni tarjeta. Después, un solo plan con dos dispositivos incluidos y condiciones visibles.</p></section>

    <section className="consumer-actions" aria-label="Gestiones de contratación"><span>Gestiones directas, sin iniciar sesión</span><div><a href="./terminos.html">Términos y condiciones</a><a href={wa("Hola Kiosco+, solicito la baja de mi servicio. Necesito el código de identificación de la solicitud.")} target="_blank" rel="noopener noreferrer">BOTÓN DE BAJA DE SERVICIO</a><a href={wa("Hola Kiosco+, quiero ejercer el derecho de arrepentimiento respecto de la contratación del servicio. Necesito el código de identificación de la solicitud.")} target="_blank" rel="noopener noreferrer">BOTÓN DE ARREPENTIMIENTO</a></div></section>

    <section className="section plans" id="planes"><div className="plans-grid">
      <article className={"plan-card reveal" + (hoverPlans === "launch" ? " hovered" : "")} onMouseEnter={() => setHoverPlans("launch")} onMouseLeave={() => setHoverPlans(null)}><span className="plan-badge">Beta para clientes</span><div className="plan-icon"><Sparkles size={22}/></div><h3>Probá Kiosco+</h3><div className="plan-price"><b>$0</b><span>por {betaTrialDays} días</span></div><p className="plan-note">Sin tarjeta y sin débito automático. Conservás tus datos si decidís continuar.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button ghost" href={wa(`Hola Kiosco+, quiero probar la beta gratis durante ${betaTrialDays} días. ¿Cómo empiezo?`)} target="_blank" rel="noopener noreferrer">Quiero probarla <ArrowRight size={18}/></a></article>

      <article className={"plan-card reveal" + (hoverPlans === "main" ? " hovered" : "")} onMouseEnter={() => setHoverPlans("main")} onMouseLeave={() => setHoverPlans(null)}><span className="plan-badge">Después de la beta</span><div className="plan-icon"><Store size={22}/></div><h3>Plan Kiosco+</h3><div className="launch-discount"><span>Precio de lista <del>{money(monthlyPrice)}</del></span><b>{launchDiscount}% de descuento por lanzamiento</b></div><div className="plan-price"><b>{money(launchPrice)}</b><span>/mes</span></div><p className="plan-note">Pagás <b>{money(launchPrice)} por mes durante los primeros {launchPaidMonths} meses pagos</b>. Desde el cuarto mes, el precio pasa a <b>{money(monthlyPrice)}/mes</b>. Incluye <b>2 dispositivos simultáneos</b>; cada adicional suma <b>{money(extraDevicePrice)}/mes</b>.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button ghost" href={wa(`Hola Kiosco+, quiero conocer el plan: ${launchPaidMonths} meses a ${money(launchPrice)} y luego ${money(monthlyPrice)}. ¿Cómo funciona?`)} target="_blank" rel="noopener noreferrer">Consultar el plan <ArrowRight size={18}/></a></article>
    </div></section>

    <section className="price-timeline reveal" aria-label="Cómo cambia el precio de Kiosco Plus"><article><span>1</span><div><b>Primeros {betaTrialDays} días</b><strong>$0</strong><small>Beta sin tarjeta</small></div></article><i/><article><span>2</span><div><b>Primeros {launchPaidMonths} meses pagos</b><strong>{money(launchPrice)}/mes</strong><small>{launchDiscount}% de descuento de lanzamiento</small></div></article><i/><article><span>3</span><div><b>Desde el cuarto mes pago</b><strong>{money(monthlyPrice)}/mes</strong><small>Precio de lista</small></div></article></section>

    <section className="section referrals" id="referidos"><div className="section-intro reveal"><span className="eyebrow"><Gift size={15}/> Referidos</span><h2>Recomendá Kiosco+ y pagá menos.</h2><p>Cada comercio que se registra con tu código y mantiene su abono vigente te suma un 20% de descuento. Acumulá hasta que tu suscripción quede gratis.</p></div>
      <div className="referral-steps">{referralSteps.map(({icon: Icon, title, text}, index)=><div className="step reveal" key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      <div className="referral-bar reveal">{[1,2,3,4,5].map((n)=><div className={n===5?"seg full":"seg"} key={n}><b>{n * 20}%</b><span>{n===5?"Gratis":`${n} ${n===1?"cuenta":"cuentas"}`}</span></div>)}</div>
      <p className="referral-caption reveal">Con 5 referidos tu suscripción queda en <b>$0</b>.</p>
      <div className="referral-code reveal"><label>Tu código se genera automáticamente</label><p>Lo encontrás dentro de Kiosco+ en <b>Configuración → Negocio</b>, listo para copiar y compartir.</p><div className="code-row"><a className="button ghost" href={cloudAppUrl}>Ingresar a Kiosco+ <ArrowRight size={16}/></a></div><small>El comercio referido debe ingresarlo al crear su cuenta.</small></div>
    </section>

    <section className="section faq" id="preguntas"><div className="section-intro"><span className="eyebrow">Preguntas frecuentes</span><h2>Precios sin letra chica.</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><button className={openFaq===i?"faq-item open":"faq-item"} onClick={()=>setOpenFaq(openFaq===i?null:i)} key={q}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div></section>

    <section className="closing"><div><span className="eyebrow">¿Listo para ordenar tu negocio?</span><h2>Empezá hoy. Sin permanencia.</h2><p>Probalo {betaTrialDays} días sin tarjeta. Los cobros automáticos todavía no están habilitados durante la beta.</p></div><a className="button light" href={wa("Hola Kiosco+, quiero probar la beta. ¿Cómo arranco?")} target="_blank" rel="noopener noreferrer">Escribime por WhatsApp <ArrowRight size={18}/></a></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><a href={`mailto:${contactEmail}`} aria-label={`Enviar un correo a ${contactEmail}`}>{contactEmail}</a><a href="./terminos.html">Términos y condiciones</a><a href="./privacidad.html">Privacidad</a><span>© {new Date().getFullYear()} Kiosco+</span></footer>
  </main>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
