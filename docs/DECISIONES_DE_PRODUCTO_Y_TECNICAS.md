# Decisiones de producto y técnicas de Kiosco+

Este registro explica decisiones que surgieron durante el trabajo con Juan. Su objetivo es evitar que un asistente futuro cambie el comportamiento por no conocer el motivo original.

Cada decisión distingue lo acordado de lo que todavía está abierto. Si una necesidad nueva contradice una decisión, hablarla con Juan antes de reemplazarla.

## D-001 — Mirada del cliente antes que comodidad del código

**Decisión:** revisar recorridos como los vive el dueño, el empleado o el cliente antes de evaluar la implementación interna.

**Por qué:** una función puede pasar una prueba aislada y seguir siendo confusa, estar escondida, duplicar avisos o no informar qué debe hacer la persona.

**No se eligió:** considerar terminado un trabajo porque existe un componente, una ruta o una prueba textual.

**Consecuencia:** cada paquete visible requiere una comprobación de interfaz y estados reales, incluidos móvil y tamaños extremos.

## D-002 — Libertad en el editor de la pantalla del cliente

**Decisión:** todos los bloques importantes, incluida la bienvenida, pueden moverse y cambiar de tamaño libremente.

**Por qué:** aunque el resultado pueda ser poco recomendable, Juan quiere que el negocio decida qué hacer con su pantalla.

**No se eligió:** fijar la bienvenida o imponer una plantilla rígida “para proteger el diseño”.

**Consecuencia:** los componentes deben resistir tamaños exagerados, recortes, superposición y eliminación sin romper toda la pantalla.

## D-003 — Una tarjeta por red social

**Decisión:** WhatsApp, Instagram y cada red/contacto se representan en widgets separados.

**Por qué:** permite decidir posición, tamaño, jerarquía y presencia de cada canal.

**No se eligió:** un único cuadro compartido para todas las redes.

**Consecuencia:** las migraciones de diseños antiguos deben separar las redes sin superponerlas ni perder datos.

## D-004 — Adaptación por forma y contenido

**Decisión:** texto, ícono y QR se equilibran según ancho, alto, pantalla y longitud del mensaje.

**Por qué:** achicar siempre la letra produjo tarjetas ilegibles; mantener una disposición fija cortó contenido.

**No se eligió:** un font-size fijo ni reducir indefinidamente el texto para que “entre”.

**Consecuencia:** una tarjeta ancha/baja puede llevar el QR al costado; una alta lo conserva debajo; se mantiene un mínimo legible y se reparte el espacio.

## D-005 — Vista previa y pantalla real comparten interpretación

**Decisión:** reutilizar componentes/cálculos adaptables en editor y pantalla real.

**Por qué:** una vista previa distinta engaña al negocio y oculta errores que aparecen recién en la TV.

**No se eligió:** mantener una versión simplificada del widget sólo para el editor.

## D-006 — Promociones distintas por widget

**Decisión:** cada tira puede usar todas las promociones o una selección propia.

**Por qué:** dos franjas mostrando exactamente lo mismo desperdician espacio y no aportan variedad.

**No se eligió:** replicar automáticamente el mismo conjunto en todas las tiras.

**Consecuencia:** la configuración del widget guarda selección, cantidad visible, movimiento, dirección y velocidad.

## D-007 — Dirección adaptable del slider

**Decisión:** horizontal si el widget es más ancho que alto; vertical si es más alto que ancho, con control del negocio.

**Por qué:** una franja vertical necesita aprovechar su recorrido, y una horizontal no debe apilar contenido diminuto.

**No se eligió:** un carrusel siempre de izquierda a derecha.

## D-008 — Medios de pago con presencia proporcional

**Decisión:** el widget cambia entre filas, columnas y cuadrícula y usa el espacio disponible.

**Por qué:** el bloque anterior mostraba una línea pequeña dentro de una tarjeta grande.

**No se eligió:** conservar un único texto centrado independientemente del tamaño.

## D-009 — Pago combinado en una sola pantalla

**Decisión:** elegir, agregar, quitar y editar cada medio dentro del mismo modal de cobro.

**Por qué:** varios diálogos encadenados dificultan entender cuánto falta y aumentan errores.

**No se eligió:** un asistente de múltiples ventanas para cada parte del pago.

**Consecuencia:** la segunda pantalla y el celular muestran el reparto completo por medio.

## D-010 — Preferencias de Mercado Pago configurables

**Decisión:** el negocio puede elegir “preguntarme siempre” o un modo/destino predeterminado.

**Por qué:** algunos comercios quieren decidir en cada venta; otros repiten siempre QR dinámico, Point o el mismo dispositivo.

**No se eligió:** preguntar obligatoriamente siempre ni ocultar toda decisión detrás de una única configuración global.

## D-011 — Separar QR y Point en el backend

**Decisión:** aplicaciones OAuth, tokens, refresh y webhook separados por solución, aunque la interfaz los agrupe.

**Por qué:** es un requisito operativo de Mercado Pago y limita el alcance de una revocación o error.

**No se eligió:** una sola aplicación/credencial compartida para QR y Point.

**Consecuencia:** ambas conexiones deben corresponder al mismo vendedor del negocio.

## D-012 — OAuth en servidor con PKCE y secretos fuera del cliente

**Decisión:** OAuth Authorization Code con state de un uso, PKCE S256 y token cifrado en backend.

**Por qué:** el navegador, PWA o instalador no deben recibir ni conservar secretos del proveedor.

**No se eligió:** pegar un access token en la app, guardar credenciales en localStorage o usar un token de un plugin del asistente.

## D-013 — Sandbox con vendedor de prueba, no token TEST pedido por OAuth

**Decisión:** usar la aplicación OAuth y autorizar un vendedor sandbox; el servidor impide conectar una cuenta real cuando `TEST_MODE=1`.

**Por qué:** Orders rechazó las credenciales TEST obtenidas del modo anterior.

**No se eligió:** reutilizar tokens productivos o desactivar la validación de entorno para hacer pasar la prueba.

## D-014 — Una orden no es una venta confirmada

**Decisión:** QR dinámico y Point esperan acreditación real; después se vincula una única vez con el ticket.

**Por qué:** mostrar un QR o enviar un importe al Point no prueba que el cliente haya pagado.

**No se eligió:** descontar stock y cerrar caja al crear la orden.

**Consecuencia:** una acreditación sin ticket queda en conciliación y no se cobra de nuevo.

## D-015 — Idempotencia estable y reparación controlada

**Decisión:** reintentar la misma operación con la misma clave lógica; reparar caja/terminal desde datos verificados por el servidor.

**Por qué:** una red inestable no debe crear dos cobros y un ID enviado por el navegador puede estar viejo o manipulado.

**No se eligió:** generar una clave nueva por cada clic ni confiar en un ID editable del cliente.

## D-016 — QR estático con confirmación manual

**Decisión:** mostrar la imagen cargada y pedir confirmación manual.

**Por qué:** el QR estático por sí solo no entrega a Kiosco+ un estado inequívoco de acreditación.

**No se eligió:** presentar el QR estático como cobro conectado automáticamente.

## D-017 — Diagnóstico útil sin filtrar secretos

**Decisión:** conservar HTTP, código, campo, detalle saneado y request ID del proveedor.

**Por qué:** mensajes genéricos como `An error occurred when creating a Merchant Order` impidieron saber qué corregir.

**No se eligió:** ocultar todo bajo “algo salió mal” ni mostrar el cuerpo completo de la respuesta.

**Consecuencia:** tokens, secretos, headers de autorización y datos arbitrarios quedan fuera de interfaz, base y logs.

## D-018 — Un evento por producto/operación, no por unidad

**Decisión:** recibir o comprar 11 unidades de un producto produce un solo evento que expresa cantidad 11.

**Por qué:** once avisos idénticos no aportan información y vuelven inútil el centro de notificaciones.

**No se eligió:** emitir una notificación dentro del bucle por unidad.

**Consecuencia:** repeticiones históricas se agrupan visualmente sin perder cantidad total.

## D-019 — Avisos separados por propósito

**Decisión:** operación del negocio, cuenta/plan y novedades de Kiosco+ son categorías distintas.

**Por qué:** “reponer vitrina” es información interna del comercio, no un comunicado del administrador de la plataforma.

**No se eligió:** una lista plana con todas las fuentes mezcladas.

## D-020 — Auditoría legible

**Decisión:** mostrar nombres y contexto humano, no IDs internos.

**Por qué:** un registro como `#1789...` no le dice al dueño qué cambió.

**No se eligió:** exponer el identificador técnico como texto principal.

**Consecuencia:** los registros viejos intentan resolver nombres; si no pueden, usan una frase genérica segura.

## D-021 — Landing resumida con páginas de detalle

**Decisión:** la portada destaca beneficios y deriva a Funciones y Descargas.

**Por qué:** concentrar instaladores, explicaciones extensas, precios y legales en la portada la volvió pesada y confusa.

**No se eligió:** una sola página interminable para todo.

## D-022 — Mercado Pago visible pero comunicado con honestidad

**Decisión:** darle una tarjeta destacada y colores reconocibles, distinguiendo lo disponible de lo que está en preparación o requiere habilitación.

**Por qué:** es una función comercial importante, pero anunciar Point/QR dinámico como terminado antes de una prueba real sería engañoso.

**No se eligió:** esconderlo hasta el último día ni prometerlo como productivo antes de homologar.

## D-023 — Ruta sencilla para vincular pantallas

**Decisión:** usar `kioscomas.ar/pantalla`.

**Por qué:** se puede recordar y escribir desde una TV con facilidad.

**No se eligió:** una URL técnica larga o dependiente de parámetros manuales.

## D-024 — Local-first con sincronización por registro

**Decisión:** guardar localmente y sincronizar entidades/operaciones independientes.

**Por qué:** el comercio debe tolerar cortes y dos cajas no deben reemplazar el negocio completo con un JSON atrasado.

**No se eligió:** nube obligatoria para cada clic ni documento monolítico por tenant.

**Consecuencia:** conflictos, rebase, idempotencia y cola son partes críticas que requieren pruebas de concurrencia.

## D-025 — Configuraciones deben producir efectos reales

**Decisión:** no mostrar una opción si no cambia el comportamiento correspondiente.

**Por qué:** la auditoría detectó densidad, medio predeterminado, alertas, menú y otras opciones que antes parecían configurables sin estar conectadas.

**No se eligió:** mantener controles decorativos para “completar” la pantalla.

## D-026 — Acceso rápido multicuenta con PIN por perfil

**Estado:** decisión de diseño preliminar; no implementada.

**Decisión propuesta:** recordar varias cuentas válidas en un dispositivo, elegir el perfil y desbloquearlo con un PIN propio sin almacenar la contraseña.

**Por qué:** facilita el ingreso de varias personas/cuentas desde el mismo equipo.

**No se eligió:** una única sesión eterna o guardar usuarios y contraseñas reutilizables.

**Pendiente:** modelo de credencial renovable vinculada al dispositivo, cifrado local seguro, revocación, límites de intento y experiencia de recuperación.

## D-027 — Biometría como desbloqueo del dispositivo, no identidad de cuenta

**Estado:** idea acordada conceptualmente; no implementada.

**Decisión propuesta:** después de elegir una cuenta, Face ID/huella puede desbloquear su credencial segura como alternativa al PIN.

**Por qué:** el sistema operativo responde que alguna biometría habilitada validó. Un teléfono puede tener varias huellas/rostros y la app no sabe cuál fue.

**No se eligió:** usar la huella para decidir automáticamente qué empleado o cuenta ingresa.

## D-028 — Ubicación de Mercado Pago mediante selección controlada

**Estado:** pedido confirmado; no implementado.

**Decisión propuesta:** provincia y ciudad seleccionables desde opciones aceptadas/canónicas.

**Por qué:** el texto libre permite errores ortográficos y valores que Mercado Pago rechaza.

**No se eligió:** una lista escrita a mano dentro del componente que envejece sin aviso.

**Pendiente:** elegir fuente oficial o catálogo de servidor, códigos canónicos, caché y compatibilidad con cajas existentes.

## D-029 — Notas de versión técnicas y “En criollo”

**Decisión:** Codex/Claude redacta automáticamente ambos niveles en `release-notes/releases.json`.

**Por qué:** Juan no quiere escribirlas y los negocios necesitan entender los cambios sin conocer la arquitectura.

**No se eligió:** notas sólo con commits o sólo con términos técnicos.

**Consecuencia:** la prueba de lanzamiento debe impedir publicar una versión sin su entrada.

## D-030 — No etiquetar una versión conectada antes de la prueba real

**Decisión:** 0.2.30 permanece sin tag hasta comprobar QR dinámico publicado.

**Por qué:** el build y los mocks no pueden garantizar que Mercado Pago acepte la orden del vendedor sandbox.

**No se eligió:** crear instaladores primero y descubrir después que el proveedor sigue rechazando el flujo.

## D-031 — Una instancia de API hasta coordinar mutaciones

**Decisión:** mantener una sola instancia de `kiosco-plus-api`.

**Por qué:** hoy las mutaciones se ordenan en memoria dentro del proceso.

**No se eligió:** escalar a varias instancias suponiendo que PostgreSQL resolverá automáticamente la coordinación.

**Pendiente para escalar:** locks/advisory locks, cola o transacciones distribuidas según cada operación crítica.

## D-032 — No borrar documentación o builds históricos sin inventario

**Decisión:** marcar precedencia y estado antes de hacer una limpieza masiva.

**Por qué:** el repositorio contiene manuales, assets y builds de distintas etapas; algunos pueden seguir siendo referencia de marca, publicación o soporte.

**No se eligió:** eliminar carpetas porque “parecen viejas” durante otro arreglo.

**Pendiente:** una tarea específica de inventario, actualización y archivo después de cerrar Mercado Pago.
