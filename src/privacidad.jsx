import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowLeft, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import "./landing.css";
import "./terminos.css";

const base = import.meta.env.BASE_URL;
const controller = {
  name: String(import.meta.env.VITE_LEGAL_NAME || "Juan Pablo Rodriguez").trim(),
  cuit: String(import.meta.env.VITE_LEGAL_CUIT || "20-48102588-6").trim(),
  address: String(import.meta.env.VITE_LEGAL_ADDRESS || "Av. Caseros 1490").trim(),
  email: String(import.meta.env.VITE_LEGAL_EMAIL || "juan@kioscomas.ar").trim(),
};
const PRIVACY_VERSION = "2026-09-10";

function Section({ number, title, children }) {
  return <section className="legal-section" id={`privacidad-${number}`}><span className="legal-number">{String(number).padStart(2, "0")}</span><div><h2>{title}</h2>{children}</div></section>;
}

function App() {
  return <main>
    <nav className="nav legal-nav"><a className="brand" href="./"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" /></a><a className="nav-cta legal-back" href="./"><ArrowLeft size={16}/> Volver al inicio</a></nav>
    <header className="legal-hero"><span className="eyebrow"><LockKeyhole size={15}/> Tus datos y tu negocio</span><h1>Política de Privacidad</h1><p>Explica qué información utiliza Kiosco+, para qué la necesita, dónde se procesa y cómo podés ejercer tus derechos.</p><div><span>Versión {PRIVACY_VERSION}</span><span>Vigente desde el 10 de septiembre de 2026</span></div></header>
    <div className="legal-shell">
      <aside className="legal-index"><b>Contenido</b>{["Responsable", "Datos tratados", "Finalidades", "Base y alcance", "Proveedores", "Conservación", "Seguridad", "Notificaciones", "Derechos", "Datos de terceros", "Cambios", "Contacto"].map((title, index)=><a key={title} href={`#privacidad-${index + 1}`}>{String(index + 1).padStart(2, "0")} {title}</a>)}</aside>
      <article className="legal-document">
        <div className="legal-summary"><ShieldCheck size={25}/><div><b>Resumen en lenguaje simple</b><p>Los datos del negocio se usan para operar, sincronizar, respaldar y dar soporte a Kiosco+. No se venden como producto. Cada negocio mantiene la responsabilidad sobre los datos de empleados, clientes y proveedores que decide cargar.</p></div></div>
        <Section number={1} title="Responsable del tratamiento"><p>El responsable es <b>{controller.name}</b>, CUIT/CUIL <b>{controller.cuit}</b>, domicilio <b>{controller.address}</b>. El canal para consultas y ejercicio de derechos es <a href={`mailto:${controller.email}`}>{controller.email}</a>.</p></Section>
        <Section number={2} title="Datos que pueden tratarse"><p>Kiosco+ puede tratar datos de identificación y contacto; nombre del comercio; usuarios, roles y correos; identificadores técnicos de dispositivos; registros de acceso, seguridad, sincronización y soporte; y la información operativa que el Usuario carga, como productos, ventas, caja, compras, proveedores, clientes y reportes.</p><p>Las contraseñas se almacenan mediante funciones criptográficas. Kiosco+ no envía contraseñas por correo y los enlaces de recuperación son temporales y de un solo uso.</p></Section>
        <Section number={3} title="Finalidades"><ul><li>Crear cuentas, autenticar usuarios y autorizar dispositivos.</li><li>Guardar, sincronizar, respaldar y recuperar la información del negocio.</li><li>Prevenir fraude, abuso, accesos no autorizados e incidentes.</li><li>Enviar correos transaccionales, alertas solicitadas y avisos operativos.</li><li>Atender soporte, analizar errores y mejorar la estabilidad del servicio.</li><li>Administrar pruebas, suscripciones, descuentos y obligaciones legales.</li></ul></Section>
        <Section number={4} title="Base, alcance y decisiones"><p>El tratamiento se realiza para prestar el servicio solicitado, cumplir obligaciones legales, proteger la seguridad del sistema y, cuando corresponda, sobre la base del consentimiento del Usuario. Kiosco+ no utiliza decisiones exclusivamente automatizadas que produzcan efectos legales sobre el Usuario.</p></Section>
        <Section number={5} title="Proveedores tecnológicos"><p>Para prestar el servicio se utilizan proveedores especializados que procesan datos según su función: Render para la aplicación del servidor, Supabase para la base PostgreSQL, Resend para correo transaccional, GitHub y las tiendas de Microsoft o Google para distribución. Mercado Pago sólo será utilizado cuando se habiliten cobros y su política se informará antes de conectar una cuenta.</p><p>Algunos proveedores pueden operar infraestructura fuera de Argentina. Se aplican configuraciones de acceso restringido, cifrado en tránsito y los mecanismos contractuales disponibles en cada servicio.</p></Section>
        <Section number={6} title="Conservación y eliminación"><p>La información se conserva mientras la cuenta esté activa y durante el tiempo razonable necesario para permitir recuperación, atender reclamos, prevenir fraude o cumplir obligaciones. Los respaldos técnicos pueden permanecer durante su ciclo de rotación aun después de una eliminación.</p><p>Cuando el administrador elimina definitivamente un negocio, se desvinculan sus usuarios, correos, dispositivos y datos operativos del servicio activo. Ciertas constancias mínimas de seguridad, soporte, pagos o aceptación contractual pueden conservarse cuando exista una obligación o interés legítimo aplicable.</p></Section>
        <Section number={7} title="Medidas de seguridad"><p>Se aplican controles de acceso por negocio, sesiones con vencimiento, credenciales protegidas, autorización de dispositivos, comunicaciones HTTPS, copias de seguridad, registros de cambios y límites contra abuso. Ningún sistema es invulnerable; ante un incidente relevante se adoptarán medidas de contención y las comunicaciones legalmente exigibles.</p></Section>
        <Section number={8} title="Correos y notificaciones"><p>Los correos de bienvenida, recuperación y seguridad son transaccionales. Las notificaciones push requieren permiso del dispositivo y pueden administrarse desde Kiosco+. Desactivar avisos externos no elimina los mensajes críticos que queden visibles en el centro de notificaciones de la aplicación.</p></Section>
        <Section number={9} title="Derechos del titular"><p>El titular puede solicitar acceso, actualización, rectificación, supresión o confidencialidad escribiendo a <a href={`mailto:${controller.email}`}>{controller.email}</a>. La solicitud podrá requerir verificación de identidad y estará sujeta a excepciones legales.</p><p>La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, recibe denuncias y reclamos. Más información en <a href="https://www.argentina.gob.ar/aaip/datospersonales" target="_blank" rel="noopener noreferrer">argentina.gob.ar/aaip<ExternalLink size={13}/></a>.</p></Section>
        <Section number={10} title="Datos de empleados, clientes y terceros"><p>El Usuario decide qué datos de terceros carga y debe informarles el tratamiento, usar sólo lo necesario y contar con una base legítima. Kiosco+ actúa como proveedor técnico respecto de esa información y no autoriza su carga para fines incompatibles o ilícitos.</p></Section>
        <Section number={11} title="Cambios a esta política"><p>Los cambios relevantes se informarán en la aplicación, por correo o en el sitio antes de entrar en vigencia cuando corresponda. La versión y fecha permanecerán visibles.</p></Section>
        <Section number={12} title="Contacto"><p>Consultas de privacidad y solicitudes: <a href={`mailto:${controller.email}`}>{controller.email}</a>. También podés consultar los <a href="./terminos.html">Términos y Condiciones</a> que regulan el servicio.</p></Section>
      </article>
    </div>
    <footer className="legal-footer"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Versión de privacidad {PRIVACY_VERSION}</span><a href="./terminos.html">Términos y condiciones</a><a href="./">Volver a Kiosco+</a></footer>
  </main>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
