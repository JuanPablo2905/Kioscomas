# Guía impositiva y legal para cobrar suscripciones de Kiosco+

> Estado de esta guía: septiembre de 2026. Es una guía operativa para preparar el lanzamiento, no reemplaza la revisión particular de un contador ni el asesoramiento jurídico.

## Resumen ejecutivo

Cuando Kiosco+ empiece a cobrar suscripciones, los ingresos deberán declararse y cada cobro deberá estar respaldado por una factura. Google Pay, Mercado Pago o cualquier otra pasarela solamente procesan el pago: no reemplazan la inscripción impositiva ni la facturación.

Para comenzar con pocos clientes, el camino normalmente más simple es operar como persona humana bajo Monotributo, siempre que la actividad y la facturación permanezcan dentro de los límites vigentes. No hace falta crear inicialmente una SAS, SRL u otra sociedad.

Antes de cobrar al primer cliente se debe consultar con un contador para confirmar dos puntos especialmente importantes:

1. El código de actividad económica que corresponde al servicio de software por suscripción.
2. Si corresponde Monotributo Unificado de CABA o Convenio Multilateral, considerando que Kiosco+ puede tener clientes de distintas provincias.

## Camino recomendado para empezar

1. Utilizar el CUIT de la persona que prestará y facturará el servicio.
2. Declarar el domicilio afectado a la actividad.
3. Dar de alta la actividad económica correcta en ARCA.
4. Adherirse al Monotributo en la categoría correspondiente.
5. Resolver la inscripción en Ingresos Brutos.
6. Dar de alta un punto de venta electrónico.
7. Configurar la cuenta de la pasarela de pago con la misma titularidad fiscal.
8. Emitir una factura electrónica por cada período de suscripción cobrado.
9. Conservar facturas, reportes de la pasarela, devoluciones y notas de crédito.

## Facturación de las suscripciones

Si el prestador es monotributista, normalmente emitirá Factura C por sus operaciones.

Ejemplo:

- Precio publicado de la suscripción: $50.000.
- Comisión descontada por la pasarela: $3.000.
- Dinero depositado: $47.000.
- Importe de la factura al cliente: $50.000.

La comisión de la pasarela es el costo de cobrar. No transforma una suscripción de $50.000 en una venta de $47.000. Para el Monotributo se debe controlar la facturación bruta acumulada y recategorizarse cuando corresponda.

Si se devuelve un pago ya facturado, la corrección normalmente se respalda con una nota de crédito. Si se aplica un descuento antes del cobro, la factura debe reflejar el importe que realmente correspondía cobrar.

## Implementación inicial sin integración automática con ARCA

No es necesario conectar Kiosco+ con los web services de ARCA antes de recibir a los primeros clientes. Se puede comenzar con un procedimiento manual controlado:

1. La pasarela confirma el pago.
2. El servidor de Kiosco+ activa o renueva el negocio.
3. El administrador emite la Factura C desde Comprobantes en Línea o el facturador de ARCA.
4. Se envía el comprobante al cliente por correo.
5. Se registra en el panel administrativo el número y estado de la factura.

Cuando el volumen de clientes lo justifique, este procedimiento podrá automatizarse mediante los servicios de facturación electrónica de ARCA.

## Monotributo e Ingresos Brutos

El Monotributo integra obligaciones nacionales como IVA, Ganancias, aportes jubilatorios y obra social, dentro de sus condiciones y límites.

En CABA existe desde el 1 de enero de 2026 el Monotributo Unificado, que permite integrar el Monotributo nacional con el Régimen Simplificado de Ingresos Brutos de la Ciudad en un único pago mensual, siempre que el contribuyente cumpla sus condiciones.

Kiosco+ puede prestar servicios a clientes ubicados en varias provincias. Por eso un contador debe determinar si la actividad se considera ejercida exclusivamente en CABA o si corresponde Convenio Multilateral. No se debe elegir un régimen únicamente por el domicilio del proveedor o del cliente.

Descripción sugerida para la consulta al contador:

> Voy a cobrar una suscripción mensual por el acceso a un software en la nube. El desarrollo y la administración se realizan desde CABA, pero los clientes pueden estar ubicados en distintas provincias.

## Período de prueba gratuito

Mientras no exista un cobro real, no hay un ingreso de suscripción que facturar. Se pueden entregar cuentas o períodos gratuitos para probar altas, vencimientos, renovaciones y soporte.

Cuando se reciba el primer pago, aunque provenga de una persona conocida, conviene tener terminada la inscripción y emitir el comprobante correspondiente. No se recomienda mantener durante meses cobros habituales en una cuenta personal sin facturar.

## Requisitos visibles en la landing y el proceso de compra

Antes de habilitar el cobro público, el sitio debería informar claramente:

- Identidad del prestador del servicio.
- CUIT, domicilio y correo de contacto.
- Características y limitaciones de Kiosco+.
- Precio final en pesos, incluidos los impuestos aplicables.
- Periodicidad de la suscripción.
- Existencia de renovación automática, si la hubiera.
- Momento o fecha del próximo cobro.
- Condiciones de la prueba gratuita.
- Procedimiento de cancelación.
- Política de devoluciones y reembolsos.
- Qué ocurre con los datos al cancelar la suscripción.
- Términos y condiciones de contratación.
- Política de privacidad.
- Acceso claro al Botón de baja y al Botón de arrepentimiento cuando corresponda.
- Formulario 960/D – Data Fiscal visible en la página principal.

El alta de una suscripción debe requerir una aceptación clara de las condiciones. No se deben ocultar el precio, la periodicidad ni la renovación automática.

## Botón de arrepentimiento y cancelación

Para contrataciones a distancia se debe contemplar el Botón de arrepentimiento en un lugar destacado y accesible desde el primer acceso al sitio. Su utilización no debe requerir iniciar sesión ni completar trámites innecesarios.

La cancelación de una suscripción también debe ser sencilla. Se debe generar una constancia de la solicitud y explicar desde qué fecha deja de cobrarse y hasta cuándo continúa disponible el servicio.

## Formulario 960/D – Data Fiscal

Los sitios web que comercializan bienes o prestan servicios deben exhibir el Formulario 960/D – Data Fiscal con el enlace generado por ARCA. Debe ubicarse de forma visible en la página principal y actualizarse cuando cambien datos relevantes del contribuyente.

## Protección de datos personales

Kiosco+ trata nombres, correos, usuarios, información de negocios y posiblemente información de empleados. Por lo tanto se debe:

- Informar qué datos se recopilan y con qué finalidad.
- Identificar al responsable del tratamiento.
- Permitir que las personas soliciten acceso, rectificación o supresión.
- Aplicar controles de acceso, confidencialidad, copias de seguridad y medidas de seguridad.
- Documentar los proveedores externos utilizados, por ejemplo Render, Supabase, Resend y la pasarela de pago.
- Revisar las transferencias internacionales derivadas del uso de servicios de nube.
- Evaluar la inscripción del responsable y de las bases alcanzadas ante el Registro Nacional de Bases de Datos Personales.

## Diseño recomendado del futuro sistema de pagos

1. La aplicación o landing abre un checkout seguro de la pasarela.
2. La pasarela procesa el medio de pago; Kiosco+ no almacena números completos de tarjeta.
3. La pasarela envía una notificación firmada al servidor de Kiosco+.
4. El servidor verifica la autenticidad, el importe, la moneda y el identificador del negocio.
5. Recién entonces se activa o renueva el negocio.
6. El evento se procesa de forma idempotente para no duplicar renovaciones.
7. Los pagos rechazados, cancelados o devueltos actualizan el estado de la suscripción.
8. El administrador puede aplicar bonificaciones y correcciones manuales dejando un registro de auditoría.

Nunca se debe habilitar un negocio basándose únicamente en que el navegador regresó a una página de “pago exitoso”. La confirmación válida debe provenir directamente de la pasarela y ser verificada por el servidor.

## Lista previa al primer cliente pago

- [ ] Consulta con contador realizada.
- [ ] Actividad económica confirmada y declarada.
- [ ] Alta en Monotributo o régimen general resuelta.
- [ ] Ingresos Brutos: CABA simplificado/unificado o Convenio Multilateral confirmado.
- [ ] Punto de venta electrónico creado.
- [ ] Procedimiento de Factura C probado.
- [ ] Pasarela registrada con titularidad y condición fiscal correctas.
- [ ] Precio final, periodicidad y renovación claramente informados.
- [ ] Términos y política de privacidad publicados.
- [ ] Baja, arrepentimiento y reembolso definidos.
- [ ] Formulario 960/D publicado.
- [ ] Procedimiento de conciliación entre pagos y facturas definido.
- [ ] Política de conservación y eliminación de datos revisada.

## Fuentes oficiales consultadas

- ARCA – Monotributo: https://arca.gob.ar/monotributo/
- ARCA – Alta de domicilios, actividades e impuestos: https://www.arca.gob.ar/inscripcion/abm/
- ARCA – Facturación para monotributistas: https://www.arca.gob.ar/monotributo/ayuda/facturacion.asp
- ARCA – Formulario 960/D – Data Fiscal: https://arca.gob.ar/960/formulario-960/obligados.asp
- AGIP – Ingresos Brutos y Monotributo Unificado: https://www.agip.gob.ar/impuestos/ingresos-brutos
- Argentina.gob.ar – Normas de comercio electrónico: https://www.argentina.gob.ar/normativa/nacional/norma-341934/texto
- Argentina.gob.ar – Disposición 954/2025, Botón de arrepentimiento: https://www.argentina.gob.ar/normativa/nacional/norma-417152
- AAIP – Obligaciones de responsables de bases de datos: https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones

