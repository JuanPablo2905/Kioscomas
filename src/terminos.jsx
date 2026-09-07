import React from "react";
import ReactDOM from "react-dom/client";
import { ArrowLeft, ExternalLink, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { normalizeWhatsAppPhone } from "./shared/share.js";
import { TERMS_VERSION } from "./legal/terms.js";
import "./landing.css";
import "./terminos.css";

const base = import.meta.env.BASE_URL;
const whatsappNumber = normalizeWhatsAppPhone(import.meta.env.VITE_SALES_WHATSAPP || "1122502706");
const whatsappUrl = (message) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
const provider = {
  name: String(import.meta.env.VITE_LEGAL_NAME || "").trim(),
  cuit: String(import.meta.env.VITE_LEGAL_CUIT || "").trim(),
  address: String(import.meta.env.VITE_LEGAL_ADDRESS || "").trim(),
  email: String(import.meta.env.VITE_LEGAL_EMAIL || "").trim(),
};
const missingProviderDetails = Object.values(provider).some((value) => !value);

function Section({ number, title, children }) {
  return <section className="legal-section" id={`clausula-${number}`}><span className="legal-number">{String(number).padStart(2, "0")}</span><div><h2>{title}</h2>{children}</div></section>;
}

function App() {
  const cancellationUrl = whatsappUrl("Hola Kiosco+, solicito la baja de mi servicio. Necesito el código de identificación de la solicitud.");
  const withdrawalUrl = whatsappUrl("Hola Kiosco+, quiero ejercer el derecho de arrepentimiento respecto de la contratación del servicio. Necesito el código de identificación de la solicitud.");
  return <main>
    <nav className="nav legal-nav"><a className="brand" href="./"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+" /></a><a className="nav-cta legal-back" href="./"><ArrowLeft size={16}/> Volver al inicio</a></nav>

    <header className="legal-hero"><span className="eyebrow"><FileText size={15}/> Documento contractual</span><h1>Términos y Condiciones de Uso</h1><p>Regulan el acceso, la contratación y el uso de Kiosco+ en la web, Windows y Mac.</p><div><span>Versión {TERMS_VERSION}</span><span>Vigentes desde el 7 de septiembre de 2026</span></div></header>

    <div className="legal-shell">
      <aside className="legal-index"><b>Contenido</b>{["Identificación", "Aceptación", "Servicio", "Cuenta y dispositivos", "Planes y pagos", "Pruebas y referidos", "Datos y sincronización", "Responsabilidades", "Disponibilidad", "Propiedad intelectual", "Baja y arrepentimiento", "Privacidad", "Cambios", "Ley aplicable", "Contacto"].map((title, index)=><a key={title} href={`#clausula-${index + 1}`}>{String(index + 1).padStart(2, "0")} {title}</a>)}</aside>

      <article className="legal-document">
        {missingProviderDetails && <div className="legal-pending"><b>Información del proveedor pendiente de completar</b><p>Antes de iniciar contrataciones pagas deben cargarse razón social o nombre completo, CUIT, domicilio y correo de atención en las variables legales del sitio.</p></div>}

        <div className="legal-summary"><ShieldCheck size={25}/><div><b>Resumen en lenguaje simple</b><p>Kiosco+ es una herramienta de gestión comercial. El usuario conserva la responsabilidad sobre sus precios, ventas, inventario, obligaciones fiscales, credenciales y copias. La aplicación puede trabajar localmente y sincroniza cuando hay conexión, pero ningún sistema puede garantizar disponibilidad absoluta.</p></div></div>

        <Section number={1} title="Identificación del proveedor"><p>El servicio Kiosco+ es ofrecido por <b>{provider.name || "[COMPLETAR NOMBRE O RAZÓN SOCIAL]"}</b>, CUIT <b>{provider.cuit || "[COMPLETAR CUIT]"}</b>, con domicilio en <b>{provider.address || "[COMPLETAR DOMICILIO]"}</b> y correo de atención <b>{provider.email || "[COMPLETAR CORREO]"}</b>, en adelante, “Kiosco+” o el “Proveedor”.</p><p>Canal adicional de atención: WhatsApp <a href={whatsappUrl("Hola Kiosco+, necesito realizar una consulta.")} target="_blank" rel="noopener noreferrer">+{whatsappNumber}<ExternalLink size={13}/></a>.</p></Section>

        <Section number={2} title="Aceptación y capacidad"><p>Estos términos forman un contrato entre el Proveedor y la persona humana o jurídica que crea una cuenta, contrata o utiliza Kiosco+ (el “Usuario”). Al marcar la casilla de aceptación o utilizar una cuenta ya contratada, el Usuario declara que leyó y aceptó la versión informada.</p><p>Quien actúe en nombre de un comercio o una persona jurídica declara contar con facultades suficientes. No debe utilizar el servicio quien no pueda asumir obligaciones legales.</p></Section>

        <Section number={3} title="Descripción y alcance del servicio"><p>Kiosco+ permite administrar, entre otras funciones, productos, stock, vitrina, ventas, caja, compras, proveedores, gastos, clientes, fiado, reportes, usuarios, permisos y registros de auditoría. Algunas funciones pueden cambiar según el plan, el tipo de cuenta, el dispositivo o la etapa de desarrollo.</p><p>La demo pública utiliza datos ficticios y no debe emplearse para operar un negocio real.</p><p><b>Importante:</b> los comprobantes internos de Kiosco+ no reemplazan facturas fiscales, no generan CAE y no realizan presentaciones ante ARCA u otro organismo.</p></Section>

        <Section number={4} title="Cuenta, credenciales y dispositivos"><p>El Usuario debe proporcionar datos correctos, mantener sus credenciales en secreto y limitar el acceso a personas autorizadas. Las acciones realizadas desde una cuenta se consideran efectuadas por su titular o por los usuarios que este habilite.</p><p>La instalación o creación inicial puede requerir una clave de activación. Los límites de dispositivos simultáneos dependen del plan informado al contratar. No se permite eludir controles de activación, copiar credenciales entre terceros ni alterar mecanismos de seguridad.</p></Section>

        <Section number={5} title="Planes, precios, facturación y pagos"><p>Los precios, moneda, impuestos incluidos o aplicables, cantidad de dispositivos, duración y modalidad de pago serán los publicados en la página de precios o informados antes de contratar. En caso de diferencia, prevalecerá la oferta particular confirmada al Usuario.</p><p>La suscripción se habilita por el período abonado. Al vencer, Kiosco+ puede pasar a modo consulta hasta la renovación: los datos continúan visibles y exportables, pero pueden bloquearse nuevas modificaciones.</p><p>No existe permanencia mínima salvo que una oferta individual lo indique expresamente. Los cambios de precio se informarán antes de aplicarse al siguiente período.</p></Section>

        <Section number={6} title="Pruebas, promociones y referidos"><p>Las pruebas gratuitas, planes de lanzamiento y promociones se rigen por las condiciones y fechas publicadas al ofrecerlas. Pueden limitarse a cuentas nuevas y no son canjeables por dinero.</p><p>En el programa de referidos, cada comercio referido computa cuando registra su primer pago válido. Cada referido activo otorga el descuento publicado, hasta el máximo informado. Los beneficios pueden anularse ante pagos revertidos, cuentas duplicadas, fraude, auto-referidos o abuso del sistema.</p></Section>

        <Section number={7} title="Datos, funcionamiento local y sincronización"><p>Kiosco+ guarda primero la información operativa en el dispositivo y luego intenta sincronizarla con la nube. Esto permite continuar ciertas tareas sin conexión después de una primera carga e inicio de sesión correctos.</p><p>La primera activación, el alta de una cuenta, la recepción de cambios de otros dispositivos y algunas consultas externas requieren Internet. Mientras existan cambios pendientes, el Usuario no debe borrar datos del navegador, desinstalar la aplicación ni eliminar su perfil local.</p><p>El Usuario debe revisar el indicador de sincronización, resolver conflictos cuando se le solicite y conservar exportaciones o copias razonables de la información crítica.</p></Section>

        <Section number={8} title="Responsabilidades del Usuario y usos prohibidos"><p>El Usuario es responsable de la exactitud de productos, costos, precios, impuestos, stock, movimientos de caja, datos de clientes y decisiones tomadas con base en reportes.</p><p>No se permite usar Kiosco+ para actividades ilícitas, vulnerar derechos de terceros, cargar malware, intentar acceder a otros negocios, interferir con el servicio, realizar ingeniería inversa prohibida por la ley, revender accesos sin autorización ni sobrecargar deliberadamente la infraestructura.</p></Section>

        <Section number={9} title="Disponibilidad, soporte y actualizaciones"><p>El Proveedor procura mantener el servicio operativo y seguro, pero no garantiza funcionamiento ininterrumpido ni ausencia total de errores. Puede haber interrupciones por mantenimiento, actualizaciones, proveedores externos, conectividad, fuerza mayor o incidentes técnicos.</p><p>Las actualizaciones pueden corregir errores, mejorar seguridad, adaptar compatibilidad o modificar funciones. Las versiones antiguas pueden dejar de recibir soporte cuando resulte necesario para proteger el servicio.</p><p>El soporte atiende por los canales y horarios publicados. Los tiempos de respuesta informados son estimativos salvo compromiso expreso.</p></Section>

        <Section number={10} title="Propiedad intelectual y licencia"><p>El software, marca, diseño, textos, documentación y demás componentes de Kiosco+ pertenecen al Proveedor o a sus licenciantes. Se concede al Usuario una licencia limitada, revocable, no exclusiva y no transferible para usar el servicio durante la vigencia de su cuenta y conforme a estos términos.</p><p>Los datos comerciales cargados por el Usuario siguen siendo del Usuario. Este autoriza su tratamiento técnico únicamente en la medida necesaria para prestar, proteger, respaldar y mejorar el servicio.</p></Section>

        <Section number={11} title="Baja, arrepentimiento y reembolsos"><p>El Usuario puede solicitar la baja sin exigir permanencia, salvo períodos ya contratados o una oferta particular expresamente aceptada. La baja evita renovaciones futuras; no elimina automáticamente la información, que podrá conservarse durante el plazo informado o legalmente necesario.</p><p>Cuando resulte aplicable la normativa de consumo y contratación a distancia, el Usuario podrá ejercer el derecho de revocación dentro del plazo legal. Las excepciones previstas por la normativa vigente también resultan aplicables.</p><div className="legal-actions"><a href={cancellationUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/><span><b>BOTÓN DE BAJA DE SERVICIO</b><small>Solicitar la baja sin iniciar sesión</small></span></a><a href={withdrawalUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/><span><b>BOTÓN DE ARREPENTIMIENTO</b><small>Solicitar la revocación sin iniciar sesión</small></span></a></div><p>El Proveedor informará un código de identificación de la solicitud dentro del plazo legal aplicable. Los reintegros, si correspondieran, se realizarán por un medio compatible con el pago original y conforme a la normativa obligatoria.</p></Section>

        <Section number={12} title="Privacidad y datos personales"><p>Para crear y operar cuentas pueden tratarse datos de identificación, contacto, negocio, usuarios autorizados, dispositivos, seguridad, soporte y actividad de sincronización. La finalidad es prestar el servicio, autenticar accesos, prevenir fraude, brindar soporte y cumplir obligaciones legales.</p><p>El Usuario debe contar con una base legal adecuada para cargar datos de empleados, clientes o terceros. Podrá solicitar acceso, rectificación, actualización o supresión de sus datos personales mediante el correo de atención indicado en la cláusula 1, sujeto a las excepciones y plazos legales.</p><p>No se comercializan datos personales como producto. La infraestructura puede apoyarse en proveedores tecnológicos, actualmente incluyendo servicios de alojamiento, base de datos y distribución de software, bajo medidas razonables de seguridad y acceso restringido.</p></Section>

        <Section number={13} title="Modificaciones de los términos"><p>El Proveedor podrá actualizar estos términos por cambios legales, técnicos o comerciales. Las modificaciones relevantes se informarán con antelación razonable dentro de la aplicación, por el canal registrado o en el sitio. La fecha y versión estarán siempre visibles.</p><p>Si el Usuario no acepta un cambio que altere sustancialmente la contratación, podrá solicitar la baja antes de su entrada en vigencia, sin afectar derechos inderogables.</p></Section>

        <Section number={14} title="Ley aplicable y resolución de conflictos"><p>Estos términos se interpretan conforme a las leyes de la República Argentina. Ninguna cláusula limita derechos irrenunciables reconocidos por la normativa de defensa del consumidor y protección de datos personales.</p><p>Cuando exista una relación de consumo, será competente la autoridad o jurisdicción que corresponda según el domicilio del consumidor y la normativa aplicable. Antes de iniciar una controversia, las partes procurarán resolverla mediante el canal de atención.</p><p>El Usuario puede consultar información oficial en <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noopener noreferrer">Defensa del Consumidor<ExternalLink size={13}/></a> y sobre datos personales en la <a href="https://www.argentina.gob.ar/aaip/datospersonales" target="_blank" rel="noopener noreferrer">Agencia de Acceso a la Información Pública<ExternalLink size={13}/></a>.</p></Section>

        <Section number={15} title="Contacto y constancia"><p>Consultas, reclamos, ejercicio de derechos sobre datos, bajas o arrepentimiento:</p><ul><li>Correo: <b>{provider.email || "[COMPLETAR CORREO DE ATENCIÓN]"}</b></li><li>WhatsApp: <a href={whatsappUrl("Hola Kiosco+, necesito asistencia.")} target="_blank" rel="noopener noreferrer">+{whatsappNumber}<ExternalLink size={13}/></a></li><li>Domicilio: <b>{provider.address || "[COMPLETAR DOMICILIO]"}</b></li></ul><p>Se recomienda al Usuario guardar o imprimir una copia de estos términos y de la oferta aceptada.</p></Section>
      </article>
    </div>

    <footer className="legal-footer"><img src={`${base}kiosco-plus-lockup-principal.svg`} alt="Kiosco+"/><span>Versión contractual {TERMS_VERSION}</span><a href="./">Volver a Kiosco+</a></footer>
  </main>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);

