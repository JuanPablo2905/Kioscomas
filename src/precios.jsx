import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight, Check, ChevronDown, Gift, Share2, Sparkles, Store, UserPlus, Users, Wallet,
} from "lucide-react";
import "./landing.css";
import "./precios.css";

const base = import.meta.env.BASE_URL;
const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || "./";

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
  { icon: UserPlus, title: "Sumá descuentos", text: "Cada cuenta creada con tu código te descuenta un 20% de la suscripción." },
  { icon: Wallet, title: "Llegá a gratis", text: "Los descuentos se acumulan: con 5 referidos tu plan queda en $0." },
];

const faqs = [
  ["¿Los $30.000 son por negocio o por dispositivo?", "Son por negocio e incluyen dos dispositivos simultáneos para que puedas trabajar junto a quien te ayude en el mostrador."],
  ["¿Cómo sumo un tercer dispositivo?", "Cada dispositivo adicional suma $5.000 por mes. Lo sumás cuando lo necesites, sin permanencia."],
  ["¿El Plan Lanzamiento queda en $20.000 para siempre?", "Sí. Como agradecimiento por acompañarnos en el arranque, el primer mes es gratis y el plan queda en $20.000 por mes mientras sigas suscrito."],
  ["¿Cómo funcionan los referidos?", "Cada cuenta que se crea con tu código te descuenta un 20% de la suscripción. El descuento es acumulable: con 5 referidos llegás al 100% y pagás $0."],
  ["¿Puedo cancelar cuando quiera?", "Sí. No hay permanencia: podés dejar de suscribirte cuando quieras."],
];

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
    <nav className="nav"><a className="brand" href="./"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" /></a><div className="nav-links"><a href="./">Inicio</a><a href="./#funciones">Funciones</a><a href="./#como-funciona">Cómo funciona</a><a className="active" href="./precios.html">Precios</a><a href="./#preguntas">Preguntas</a></div><a className="nav-cta" href={appUrl}>Probar la app <ArrowRight size={16}/></a></nav>

    <section className="pricing-hero"><div className="eyebrow"><Sparkles size={15}/> Precios claros</div><h1>Un precio simple. <i>Sin sorpresas.</i></h1><p>Un solo plan, dos dispositivos incluidos y descuentos reales para quienes suman. Sin letra chica.</p></section>

    <section className="section plans" id="planes"><div className="plans-grid">
      <article className="plan-card main reveal"><span className="plan-badge">Lo que elige la mayoría</span><div className="plan-icon"><Store size={22}/></div><h3>Kiosco+</h3><div className="plan-price"><b>$30.000</b><span>/mes</span></div><p className="plan-note">Incluye <b>2 dispositivos simultáneos</b>. Cada dispositivo adicional suma <b>$5.000/mes</b>.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button primary" href={appUrl}>Probar demo <ArrowRight size={18}/></a></article>

      <article className="plan-card launch reveal"><span className="plan-badge alt">Lanzamiento</span><div className="plan-icon"><Sparkles size={22}/></div><h3>Plan Lanzamiento</h3><div className="plan-price"><b>$0</b><span>el primer mes</span></div><p className="plan-note">Después queda en <b>$20.000/mes por siempre</b>, como agradecimiento por ayudarnos a cerrar la app.</p><ul>{planFeatures.map((item)=><li key={item}><Check size={15}/>{item}</li>)}</ul><a className="button ghost" href={appUrl}>Empezar gratis <ArrowRight size={18}/></a></article>
    </div></section>

    <section className="section referrals" id="referidos"><div className="section-intro reveal"><span className="eyebrow"><Gift size={15}/> Referidos</span><h2>Recomendá Kiosco+ y pagá menos.</h2><p>Cada comercio que crea su cuenta con tu código te suma un 20% de descuento. Acumulá hasta que tu suscripción quede gratis.</p></div>
      <div className="referral-steps">{referralSteps.map(({icon: Icon, title, text}, index)=><div className="step reveal" key={title}><span>0{index+1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      <div className="referral-bar reveal">{[1,2,3,4,5].map((n)=><div className={n===5?"seg full":"seg"} key={n}><b>{n===5?"100%":"20%"}</b><span>{n===5?"Gratis":`${n} ${n===1?"cuenta":"cuentas"}`}</span></div>)}</div>
      <p className="referral-caption reveal">Con 5 referidos tu suscripción queda en <b>$0</b>.</p>
      <div className="referral-code reveal"><label htmlFor="codigo">Tu código de referido</label><div className="code-row"><input id="codigo" type="text" placeholder="Ej: KIOS-1234" /><button className="button ghost" type="button">Copiar</button></div><small>Próximamente vas a poder compartirlo directo desde la app.</small></div>
    </section>

    <section className="section faq" id="preguntas"><div className="section-intro"><span className="eyebrow">Preguntas frecuentes</span><h2>Precios sin letra chica.</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><button className={openFaq===i?"faq-item open":"faq-item"} onClick={()=>setOpenFaq(openFaq===i?null:i)} key={q}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div></section>

    <section className="closing"><div><span className="eyebrow">¿Listo para ordenar tu negocio?</span><h2>Empezá hoy. Sin permanencia.</h2><p>Probalo gratis y quedate con el plan que mejor se adapte a tu comercio.</p></div><a className="button light" href={appUrl}>Probar demo <ArrowRight size={18}/></a></section>
    <footer><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Gestión simple para comercios reales.</span><span>© {new Date().getFullYear()} Kiosco+</span></footer>
  </main>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
