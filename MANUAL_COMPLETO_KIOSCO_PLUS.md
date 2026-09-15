# Manual completo de Kiosco+

> **Manual general desactualizado respecto del desarrollo actual.** Sigue siendo útil para comprender los recorridos del producto, pero fue documentado en 0.2.3. El estado operativo, las decisiones recientes y los próximos pasos de 0.2.30 están en `CLAUDE.md`, `docs/TRASPASO_CLAUDE_CODE.md` y `docs/DECISIONES_DE_PRODUCTO_Y_TECNICAS.md`.

**Versión documentada:** 0.2.3  
**Última revisión:** 7 de septiembre de 2026  
**Repositorio:** https://github.com/JuanPablo2905/Kioscomas  
**Aplicación web:** https://kiosco-plus.onrender.com  
**API de nube:** https://kiosco-plus-api.onrender.com  

Este documento reúne dos manuales en uno:

1. **Manual de uso**, para dueños, administradores y empleados del comercio.
2. **Manual técnico**, para la persona que deba mantener, modificar, probar o publicar Kiosco+.

La aplicación cambia con el tiempo. Ante una contradicción entre este manual y el código, el código y las pruebas automatizadas son la fuente técnica definitiva. Actualizá la versión y la fecha de este archivo en cada publicación importante.

---

## Índice

### Parte I — Manual de uso

1. Qué es Kiosco+
2. Formas de usar la aplicación
3. Conceptos que no deben confundirse
4. Primer ingreso y activación
5. Recorrido general
6. Inicio y notificaciones
7. Stock, vencimientos e inventario
8. Vitrina
9. Ventas y caja
10. Compras y proveedores
11. Gastos
12. Clientes y fiado
13. Reportes
14. Gestión y herramientas
15. Usuarios, roles y permisos
16. Configuración
17. Tutoriales
18. Trabajo sin Internet y sincronización
19. Datos, exportaciones y copias de seguridad
20. Actualizaciones
21. Solución de problemas
22. Límites importantes del producto

### Parte II — Manual técnico

23. Arquitectura general
24. Tecnologías y versiones
25. Estructura del proyecto
26. Entradas web, pública, legal y de escritorio
27. Modelo de datos
28. Persistencia local
29. Nube y sincronización
30. Autenticación, sesiones y dispositivos
31. Servidor y API
32. PostgreSQL y Supabase
33. Variables de entorno
34. Preparar el entorno de desarrollo
35. Comandos del proyecto
36. Pruebas automatizadas
37. PWA y funcionamiento móvil
38. Aplicación de escritorio
39. Versionado, instaladores y actualizaciones
40. Despliegue en Render
41. Cambios frecuentes paso a paso
42. Seguridad y privacidad
43. Diagnóstico técnico
44. Lista de control antes de publicar
45. Reglas de mantenimiento

---

# Parte I — Manual de uso

## 1. Qué es Kiosco+

Kiosco+ es una aplicación de gestión para comercios. Centraliza stock, vencimientos, ventas, caja, compras, proveedores, gastos, clientes, fiado, reportes y tareas de operación diaria.

La misma cuenta puede utilizarse desde la web y desde aplicaciones de escritorio autorizadas. Los datos se guardan primero en el dispositivo y, cuando hay conexión y una sesión válida, se sincronizan con la nube.

Kiosco+ está pensado para ayudar a administrar el negocio. No reemplaza el criterio del responsable del comercio, una copia de seguridad propia ni un sistema homologado de facturación fiscal.

## 2. Formas de usar la aplicación

### Web en computadora

Abrí https://kiosco-plus.onrender.com y elegí entrar a la aplicación. No requiere instalación. Recibe las versiones nuevas al actualizar la página.

### Web en celular o tablet

Se usa desde el mismo enlace. En navegadores compatibles puede instalarse como aplicación desde la opción **Agregar a pantalla de inicio** o **Instalar aplicación**.

La aplicación instalada de esta forma sigue siendo la versión web: ocupa poco espacio, se actualiza desde el sitio y puede abrir parte de su interfaz sin conexión una vez cargada.

### Windows

Descargá `KioscoPlus-Setup.exe` desde la última versión publicada en GitHub. El instalador crea el acceso directo y abre Kiosco+ al terminar.

### macOS

Descargá `KioscoPlus-Mac-arm64.dmg` para una Mac con chip Apple M1 o posterior, o `KioscoPlus-Mac-x64.dmg` para una Mac Intel. Para comprobar el modelo, abrí el menú Apple  y elegí **Acerca de esta Mac**. Después arrastrá Kiosco+ a **Applications** y abrila desde allí. Mientras la aplicación no esté firmada por Apple, macOS puede mostrar una advertencia. En ese caso se debe usar **Control + clic → Abrir** y confirmar.

## 3. Conceptos que no deben confundirse

### Clave de instalación

Autoriza un dispositivo nuevo. Se utiliza una sola vez por instalación o perfil de navegador. No es el usuario ni la contraseña del comercio.

### Cuenta de Kiosco+

Identifica al negocio. Tiene un usuario y una contraseña. El dueño puede crear empleados y permisos dentro de su cuenta.

### Dispositivo

Es una instalación de escritorio o un perfil de navegador. Un celular usado desde la web también cuenta como dispositivo si el sistema exige activación.

### Servidor de nube

Es la API alojada en Render. Recibe las solicitudes, valida sesiones y transmite los datos.

### Base de datos

Es PostgreSQL en Supabase. El navegador y la aplicación de escritorio no deben conectarse directamente con credenciales privadas a Supabase; lo hacen a través de la API.

## 4. Primer ingreso y activación

### 4.1 Obtener una clave

El administrador general de Kiosco+ genera una clave desde su panel. Puede definir una descripción, vencimiento y cantidad de dispositivos admitidos.

### 4.2 Activar el dispositivo

1. Abrí Kiosco+.
2. Pegá la clave con formato `KIOSCO-XXXX-XXXX-XXXX-XXXX`.
3. Tocá **Activar este dispositivo**.
4. Esperá la confirmación antes de cerrar.

La primera validación requiere Internet. Si la clave venció, fue revocada o alcanzó el límite de dispositivos, hay que generar otra.

### 4.3 Crear una cuenta

1. Elegí **Crear cuenta**.
2. Completá los datos del responsable y del negocio.
3. Elegí un usuario y una contraseña que no compartas fuera del comercio.
4. Ingresá el código de referido si corresponde.
5. Leé y aceptá los Términos y Condiciones.
6. Enviá la solicitud.

La aceptación queda registrada con fecha y versión de los términos. La cuenta puede quedar pendiente hasta que el administrador habilite la prueba o suscripción.

### 4.4 Iniciar sesión

Ingresá el usuario y la contraseña de la cuenta. Si es un dispositivo nuevo, debe estar activado. Una vez autenticado, Kiosco+ descarga la información disponible del negocio y conservará el acceso mientras la sesión pueda renovarse.

Si aparece **la cuenta existe en la nube, pero todavía no está asociada a un negocio**, el registro está incompleto o pendiente de aprobación. Debe revisarlo el administrador general.

## 5. Recorrido general

La barra lateral permite entrar a:

- Inicio.
- Stock y vencimientos.
- Notificaciones.
- Vitrina.
- Ventas / Caja.
- Compras y proveedores.
- Gastos.
- Clientes / Fiado.
- Reportes.
- Gestión y herramientas.
- Administración, si el rol tiene permiso.

En pantallas pequeñas el menú puede contraerse. La configuración, ayuda, modo de pantalla y estado de nube aparecen en la parte inferior.

Flujo diario recomendado:

1. Revisar el estado de nube.
2. Abrir la caja.
3. Leer las notificaciones críticas.
4. Registrar ventas, gastos, compras y movimientos de stock durante el día.
5. Controlar productos a reponer o vencer.
6. Hacer el arqueo y cerrar la caja.
7. Confirmar que no queden cambios pendientes de sincronización.

## 6. Inicio y notificaciones

### Inicio

Resume la operación del negocio: estado de caja, ventas del día, productos críticos, valor del stock y accesos rápidos. Los valores dependen de los datos cargados y de los permisos del usuario.

### Notificaciones

Agrupa alertas de stock mínimo, vitrina, vencimientos, tareas y otras situaciones que requieren atención. Entrá en cada aviso para ver el origen antes de corregir o descartar algo.

La sección **Novedades de Kiosco+** conserva los mensajes enviados por el administrador, incluso si el navegador no tiene permiso para mostrar avisos fuera de la aplicación. Cuando Web Push está configurado, cada persona puede tocar **Avisarme en este dispositivo**. En iPhone o iPad primero debe agregar la app web a la pantalla de inicio y abrirla desde ese ícono.

Una alerta es una ayuda operativa; no garantiza que el conteo físico coincida. Confirmá siempre los casos sensibles en el comercio.

## 7. Stock, vencimientos e inventario

El área de stock contiene cuatro secciones principales.

### 7.1 Productos

Permite:

- Crear y editar productos.
- Buscar por nombre, código, familia o variante.
- Escanear códigos de barras.
- Registrar costo, precio de venta, categoría y proveedor.
- Elegir unidad, peso o volumen.
- Separar existencias entre depósito y vitrina.
- Definir mínimo de stock y alerta de vitrina.
- Marcar favoritos.
- Duplicar productos como variantes.
- Aplicar cambios masivos de precios.
- Agrupar productos sin borrarlos.
- Consultar el historial de movimientos.

Antes de eliminar un producto, verificá que no sea necesario para auditoría o reportes históricos. El permiso para borrar y modificar precios puede restringirse por rol.

### 7.2 Vencimientos y pérdidas

Registrá fechas de vencimiento y pérdidas por rotura, vencimiento, consumo u otro motivo. Al confirmar una pérdida, revisá qué cantidad se descuenta y desde qué ubicación.

### 7.3 Conteo físico

1. Elegí el alcance o categoría.
2. Contá físicamente cada producto.
3. Ingresá la cantidad real.
4. Revisá las diferencias.
5. Aprobá los ajustes.

El conteo deja historial. No conviene hacerlo simultáneamente con ventas activas si la mercadería se está moviendo.

### 7.4 Autoconsumo

Registra mercadería retirada para uso interno sin confundirla con una venta. Debe quedar indicado quién la retiró y qué cantidad.

## 8. Vitrina

La vitrina separa lo exhibido de lo guardado en depósito. Sirve para:

- Ver qué productos necesitan reposición.
- Mover cantidades del depósito a la vitrina.
- Evitar vender mercadería que existe en depósito pero no está disponible en exhibición.
- Mantener alertas independientes.

Una transferencia interna no cambia el total del producto: sólo redistribuye su ubicación.

## 9. Ventas y caja

### 9.1 Abrir la caja

Ingresá el efectivo inicial y confirmá la apertura. Ese monto no es una venta; es el fondo con el que comienza el turno.

### 9.2 Registrar una venta

1. Buscá o escaneá productos.
2. Revisá cantidades y precios.
3. Aplicá promociones o descuentos sólo si tu rol lo permite.
4. Elegí el cliente si es una venta fiada.
5. Seleccioná el medio de pago.
6. Confirmá la venta.
7. Imprimí, enviá o cerrá el ticket.

La venta descuenta stock y registra el movimiento de caja correspondiente. También se admiten medios como efectivo, Mercado Pago o transferencia, según la configuración disponible.

### 9.3 Pantalla para clientes

El dueño puede activarla en **Configuración > Funcionamiento > Operación > Pantallas del negocio**. El menú está dividido en cuatro pasos plegables: datos y funcionamiento; diseño visual, bloques y redes; promociones y QR; y pantallas remotas. El diseño se ordena sobre una vista previa 16:9: en una computadora los bloques se pueden arrastrar y, tanto en computadora como en celular, se pueden tocar para moverlos de zona, adelantarlos, atrasarlos o quitarlos viendo el resultado. La configuración y el QR se guardan para el negocio, de modo que sus cajas autorizadas comparten el mismo criterio. Durante una venta muestra únicamente nombre y cantidad de productos, precio original, promoción aplicada a cada producto, ahorro, precio final, descuentos generales, total, medio de pago, efectivo recibido y vuelto. Si el negocio carga un QR estático de Mercado Pago o transferencia, aparece al elegir ese medio; el vendedor debe comprobar el pago manualmente.

Cada pantalla local puede trabajar en uno de tres modos: **Ventas + publicidad**, **Sólo publicidad** o **Sólo ventas**. En Sólo publicidad, la aplicación elimina productos, pago y totales antes de enviar el estado a la ventana; sirve para una TV alejada de la caja aun cuando esté conectada por HDMI. En Sólo ventas, mientras no haya un carrito muestra únicamente que está esperando la próxima operación.

Cuando no hay una venta, la pantalla puede funcionar como vidriera digital. El diseño usa zonas controladas —arriba, izquierda, centro, derecha y abajo— para evitar que un bloque tape otro. Se pueden aplicar diseños rápidos o mover y ordenar bloques. Hay bloques de promociones, bienvenida, hora y fecha, clima, redes, horarios, medios de pago, aviso propio, producto destacado e imagen. En venta y agradecimiento sólo se personalizan las franjas superior e inferior; la información esencial de la operación no se puede ocultar ni reemplazar.

Las promociones activas que tengan marcada la opción **Anunciar en la segunda pantalla** alimentan las franjas publicitarias. Con hasta tres promociones se muestran fijas; desde cuatro comienzan a rotar según el tiempo configurado. Los tiempos permiten dejar el campo vacío mientras se escribe, usar botones más/menos o elegir valores rápidos. Los botones **Probar publicidad** y **Simular venta** permiten revisar el resultado sin registrar una operación.

La publicidad no constituye un descuento separado. Se alimenta de las mismas promociones comerciales que calcula la caja, por lo que lo anunciado y lo cobrado coinciden. Una promoción vencida, pausada o cuyos productos seleccionados ya no están disponibles se oculta automáticamente de la vidriera. El ticket y el historial conservan el nombre y el ahorro de la promoción aplicada.

En la aplicación de escritorio Kiosco+ detecta los monitores y puede abrirla automáticamente en la pantalla secundaria. En la versión web se abre una ventana independiente que debe moverse manualmente. Esta ventana no inicia otra sesión, no consume otra activación y no recibe stock, costos, usuarios ni información administrativa. Si una compra contiene muchos artículos, solamente se desplaza la lista interna y se sigue el último producto agregado; el total, el QR y las franjas permanecen dentro de la altura del monitor.

### 9.3.1 Pantallas remotas

Una pantalla remota es una TV, tablet o computadora que abre el enlace indicado en **Configuración > Funcionamiento > Operación > TVs y pantallas remotas** y queda asociada al negocio sólo para publicidad. La TV no necesita cámara: al abrir el enlace genera y muestra su propio QR y un código de ocho caracteres. Desde el celular, el dueño puede escanear el QR con la cámara normal —Kiosco+ se abre con el código ya escrito— o ingresar el código manualmente, elegir la pantalla publicitaria y tocar **Autorizar**. El código vence a los diez minutos, funciona una sola vez y la TV detecta la autorización automáticamente.

Después de vincularse, el dispositivo recibe una credencial exclusiva de pantalla. No sirve para iniciar sesión, consultar stock, leer ventas ni modificar el negocio. En el servidor se guardan únicamente sus huellas criptográficas, nunca el código ni la credencial legible. Desde Configuración el dueño puede actualizar el contenido de una pantalla concreta, crear varias con contenidos independientes, desvincular todos sus equipos o eliminarla.

La pantalla descarga una copia pública con el diseño, el nombre, el logo, las promociones, los contactos y los productos elegidos como destacados. La copia queda guardada localmente. Si se corta Internet mientras la página ya está cargada, continúa mostrando esa última versión y el último clima obtenido. Sin conexión no recibe cambios, no actualiza el clima y una pantalla nueva no puede vincularse. Al volver la conexión se actualiza automáticamente.

Los accesos de WhatsApp, Instagram, Facebook, TikTok, web, Maps, correo y teléfono aplican un estilo reconocible y generan el QR dentro de Kiosco+; esos datos no se envían a un generador externo. El clima utiliza Open-Meteo y se renueva de forma periódica, conservando una copia de respaldo.

### 9.4 Venta suspendida

Usala para guardar temporalmente un carrito y atender otra operación. Al recuperarla, revisá si reemplazará la venta actual.

### 9.5 Pedidos y presupuestos

Los pedidos reservan una lista para seguimiento y los presupuestos calculan importes sin descontar existencias. No equivalen a una venta hasta que se confirme la operación correspondiente.

### 9.6 Anular o devolver

Una anulación debe pedir un motivo, revertir el cobro y restaurar el stock cuando corresponda. El ticket permanece visible para auditoría. No borres manualmente movimientos para corregir una venta: usá la acción específica.

### 9.7 Cerrar la caja

1. Contá el dinero y medios de cobro.
2. Compará el total esperado con el real.
3. Registrá diferencias y observaciones.
4. Confirmá el arqueo y cierre.

## 10. Compras y proveedores

### Compras y pedidos

Armá listas de reposición, asigná proveedor, cantidades y costo. Al recibir mercadería, confirmá únicamente lo recibido para actualizar stock y costos correctamente.

### Proveedores

Guardá nombre, contacto, teléfono, correo y productos relacionados. Desde la lista de compra se puede preparar un mensaje para WhatsApp o correo.

### Lista y recordatorios

La lista de compras reúne faltantes manuales o sugeridos. Los recordatorios ayudan a registrar fechas, compromisos y contactos pendientes con proveedores.

## 11. Gastos

Registrá descripción, categoría, importe, fecha, estado y forma de pago. Los gastos se consideran en la ganancia de Reportes, pero actualmente no modifican automáticamente el saldo de caja. Si además debe salir dinero de caja, registrá el movimiento de caja que corresponda.

## 12. Clientes y fiado

Permite crear clientes, registrar compras fiadas, consultar saldo y cobrar pagos parciales o totales.

Buenas prácticas:

- Identificar al cliente antes de fiar.
- Confirmar importe y fecha.
- Registrar cada pago con su medio.
- No editar saldos directamente para ocultar un error.
- Revisar el historial antes de reclamar una deuda.

## 13. Reportes

Los reportes consolidan ventas, ganancias estimadas, gastos, rentabilidad, medios de pago, productos y desempeño por período. El resultado depende de la calidad de costos, precios, anulaciones y gastos cargados.

Si el costo histórico no estaba registrado correctamente cuando se hizo una venta, la rentabilidad será estimada. Antes de tomar decisiones contables o impositivas, exportá y contrastá la información con documentación válida.

## 14. Gestión y herramientas

### Tareas y metas

Creá tareas operativas y una meta diaria de ventas. Marcar una tarea como completa no modifica otras áreas.

### Promociones

Configurá reglas porcentuales, por cantidad, 2×1/3×2 o combos a precio fijo y revisá su aplicación antes de usarlas en caja. Cada regla puede limitarse por fecha, días de la semana y franja horaria. También puede editarse, duplicarse, pausarse o eliminarse.

Kiosco+ puede aplicar promociones distintas a productos diferentes dentro del mismo carrito. Cuando dos reglas compiten por el mismo producto, no las acumula: elige la combinación vigente que produzca el mayor ahorro total. El carrito identifica cada producto alcanzado, la regla aplicada, su ahorro y el precio resultante; un descuento manual aparece separado en el resumen.

Para convertir una regla en publicidad, activá **Anunciar en la segunda pantalla** y, si querés, agregá un texto y una imagen. La imagen se reduce antes de guardarse. No cargues información confidencial: este contenido está pensado para ser visible por cualquier cliente frente a la caja.

### Etiquetas

Elegí productos, tamaño, contenido, colores, copias y distribución. La vista previa no altera el precio real del producto. Verificá medidas de papel e impresora antes de una tirada grande.

### Facturación y comprobantes internos

Permite preparar, imprimir, compartir y anular documentos internos marcados como **NO FISCAL**. No genera CAE, no emite comprobantes fiscales ante ARCA y no reemplaza un sistema autorizado.

### Otras herramientas operativas

Según la sección y los permisos pueden aparecer:

- Lista de compras.
- Retornables.
- Control de cambio.
- Autoconsumo.
- Turnos.
- Recordatorios.
- Resumen diario para copiar o imprimir.
- Reservas, pedidos y presupuestos.

## 15. Usuarios, roles y permisos

El dueño o un usuario con permiso de gestión puede crear empleados y asignar roles.

Los permisos se dividen entre acceso a menús y acciones sensibles, por ejemplo:

- Ver administración operativa.
- Editar precios y costos.
- Eliminar productos o tickets.
- Aplicar descuentos.
- Corregir caja.
- Gestionar personal, roles y permisos.

Aplicá el principio de mínimo acceso: cada empleado debe ver y modificar sólo lo necesario. No compartas la cuenta del dueño para operar la caja.

El administrador general de Kiosco+ es distinto del dueño de un negocio. Puede aprobar cuentas, administrar pruebas y pagos, generar claves de instalación, revocar dispositivos y gestionar el catálogo global. El botón **Otra pantalla** abre un negocio sin abandonar el panel central: en escritorio elige otro monitor automáticamente y en navegador abre una ventana independiente. Esa vista conserva la identidad administrativa, no crea otra activación y no reemplaza la sesión principal guardada.

## 16. Configuración

La ventana de Configuración se organiza en cinco grupos principales para evitar una lista extensa de menús:

### Negocio

Nombre, datos visibles y preferencias propias del comercio. Sólo aparece a quienes pueden editarlo.

### Apariencia

Reúne Colores, Interfaz y Sonido y movimiento. Incluye tema, identidad visual, distribución, densidad, confirmaciones, animaciones y respuesta sonora.

### Notificaciones

Permite activar o desactivar avisos en el dispositivo, probar su entrega y elegir por grupos qué eventos se reciben. La configuración detallada y el horario silencioso quedan dentro del mismo grupo.

### Funcionamiento

Reúne Operación e Impresión y caja. Contiene reglas de operación, comportamiento de ventas, funciones automáticas, papel, tickets, resúmenes y cajón de dinero. También configura la pantalla para clientes y su QR estático. El pulso directo ESC/POS está disponible en la aplicación de Windows y requiere una impresora compatible.

### Datos y seguridad

Reúne Archivo, Seguridad y Nube y dispositivos: exportación, limpieza controlada, opciones sensibles, sesiones, tickets, sincronización, dispositivos y actualizaciones.

**Ayuda y versión** queda como acceso separado: muestra la versión instalada, permite repetir tutoriales, copiar un diagnóstico seguro, informar un problema y abrir los documentos legales.

### Nube y dispositivos

Estado de sincronización, identificador del dispositivo, canal de actualizaciones, conexión y pruebas de servidor.

## 17. Tutoriales

Los tutoriales se registran por cuenta y por recorrido. Una vez cerrados o completados no deben reaparecer al volver al menú. Si una persona distinta inicia sesión en el mismo dispositivo con otra cuenta, verá sus propios tutoriales iniciales.

La opción de ayuda permite volver a consultar recorridos cuando sea necesario.

## 18. Trabajo sin Internet y sincronización

Kiosco+ sigue un enfoque **local primero**:

1. La acción se guarda en el dispositivo.
2. Se agrega una operación a la cola de sincronización.
3. Cuando hay conexión y sesión válida, la API recibe los cambios.
4. El dispositivo descarga cambios hechos desde otros equipos.

### Estados habituales

- **Nube sincronizada:** no hay cambios locales pendientes conocidos.
- **Sincronizando:** está enviando o recibiendo datos.
- **Pendiente:** hay cambios guardados localmente que todavía no llegaron.
- **Sin conexión:** se puede seguir trabajando con los datos ya disponibles.
- **Conflicto:** dos dispositivos modificaron el mismo registro y se requiere revisar.
- **Nube con error:** falló la sesión, el servidor o la autorización.

### Qué funciona sin conexión

Después de una primera carga correcta, la mayoría de las operaciones habituales puede guardarse localmente. La activación inicial, el primer inicio de sesión en un dispositivo, la recuperación de datos que nunca se descargaron y la sincronización requieren Internet.

### Qué hacer al recuperar conexión

1. Dejá la aplicación abierta.
2. Confirmá que el estado cambie a sincronizando.
3. Esperá hasta ver nube sincronizada.
4. Si quedan pendientes, abrí el detalle y revisá cada cambio.

No borres los datos del navegador, no reinstales ni descartes en masa cambios pendientes antes de tener una copia y entender el problema.

### Conflictos

Los registros con identidad propia se sincronizan por entidad. Cuando dos dispositivos cambian el mismo elemento, el sistema intenta combinar cambios compatibles. Si no puede, permite conservar la versión local o la de nube. Revisá el contenido y la fecha antes de decidir.

## 19. Datos, exportaciones y copias de seguridad

La nube no elimina la necesidad de copias controladas.

- Exportá datos antes de limpiezas, migraciones o pruebas destructivas.
- Guardá las exportaciones fuera del mismo dispositivo.
- No importes archivos de origen desconocido.
- Confirmá que la copia corresponda al negocio correcto.
- En producción, verificá también las copias de Supabase y la política de retención del servidor.

Desinstalar la aplicación de escritorio no borra necesariamente los datos locales porque el instalador está configurado para conservarlos. Borrar datos del navegador sí puede eliminar la copia local y la activación de ese perfil.

## 20. Actualizaciones

### Web y PWA

La versión nueva llega al recargar una vez publicado el sitio. Si se mantiene una versión anterior, cerrá todas las pestañas, volvé a abrir y recargá. El navegador puede tardar una apertura adicional en reemplazar el service worker.

### Windows

La aplicación comprueba actualizaciones, descarga la versión publicada y la instala al cerrar o al elegir **Reiniciar y actualizar**. El número en Configuración debe coincidir con la versión de GitHub.

### macOS

Mientras el paquete no tenga firma de Apple, la actualización es manual: descargá el DMG nuevo, cerrá Kiosco+ y reemplazá la aplicación en `Applications`.

## 21. Solución de problemas

### “La clave no se pudo comprobar”

- Confirmá Internet.
- Abrí https://kiosco-plus-api.onrender.com/v1/ready.
- Revisá que la clave esté completa, activa y dentro de su vencimiento.
- Confirmá que no alcanzó el límite de dispositivos.

### “El servidor tardó demasiado en responder”

El servicio puede estar iniciándose. Abrí `/v1/ready`, esperá a que responda con `"ok": true` y volvé a intentar. Si persiste, revisá Render y Supabase.

### “La sesión venció”

Cerrá sesión y volvé a ingresar. Si se repite en pocos minutos, el administrador técnico debe revisar `KIOSCO_ACCESS_TOKEN_HOURS`, el refresh token y los registros del servidor.

### “La cuenta no está asociada a un negocio”

La cuenta existe, pero le falta un negocio o una aprobación válida. Revisala desde el panel del administrador general.

### Cambios pendientes que no bajan

No los descartes automáticamente. Comprobá sesión, conexión, dispositivo activo y `/v1/ready`. Abrí el detalle para identificar la entidad afectada.

### La aplicación instalada vuelve a pedir activación

Puede haberse usado otro perfil de navegador, borrado el almacenamiento local o cambiado el identificador del dispositivo. Compará el final del ID mostrado con **PC/dispositivos activados** en el panel de administración.

### La aplicación no abre o queda cargando

Esperá el primer arranque, cerrá por completo y reabrí. En escritorio, verificá que no haya otra instancia bloqueada y que el antivirus no haya aislado archivos. Si continúa, guardá una captura y los registros antes de reinstalar.

### Cámara o escáner no funcionan

Concedé permiso de cámara al sitio, usá HTTPS y cerrá otras aplicaciones que estén usando la cámara. Un lector USB que actúa como teclado no necesita permiso de cámara.

## 22. Límites importantes del producto

- Kiosco+ no emite facturas fiscales ni realiza presentaciones ante ARCA.
- La información de reportes depende de lo que cargan los usuarios.
- Trabajar sin conexión sirve con datos previamente descargados; no crea Internet ni valida servicios remotos.
- Un navegador puede borrar almacenamiento por acción del usuario, políticas del sistema o falta de espacio.
- Las versiones sin firma digital pueden mostrar advertencias de Windows o macOS.
- La disponibilidad del servicio depende también de Render, Supabase, Internet y los dispositivos del usuario.

---

# Parte II — Manual técnico

## 23. Arquitectura general

```text
Landing / precios / términos
              │
              ├── app web o PWA ───────────────┐
              │                                 │
              └── Electron Windows/macOS ──┐    │
                                           ▼    ▼
                                  React + KioscoApp
                                           │
                           almacenamiento local + cola
                                           │
                                 motor de sincronización
                                           │ HTTPS/JSON
                                           ▼
                              API Node.js alojada en Render
                                           │
                                           ▼
                                  PostgreSQL en Supabase
```

Principios:

- **Local primero:** la interfaz no espera a la red para cada operación normal.
- **API como frontera:** los clientes no reciben credenciales privadas de base de datos.
- **Separación por negocio:** cada conjunto de datos lleva un `tenantId`.
- **Sincronización incremental:** registros con ID viajan como operaciones y versiones.
- **Cuenta y dispositivo son conceptos distintos:** la cuenta autoriza identidad; la activación autoriza una instalación.

## 24. Tecnologías y versiones

Las versiones de referencia están fijadas en `package.json`:

- Node.js 22 en integración continua.
- pnpm 11.9.0.
- React 19.2.7 y React DOM 19.2.7.
- Vite 8.1.5.
- Electron 43.1.1.
- electron-builder 26.15.3.
- electron-updater 6.8.9.
- PostgreSQL mediante `postgres` 3.4.9.
- Lucide React para íconos.
- ZXing Browser para lectura de códigos.
- Tailwind CSS 3.4.17 más CSS propio.

No actualices dependencias mayores junto con un cambio funcional. Hacé una rama o publicación separada y ejecutá todas las pruebas.

## 25. Estructura del proyecto

```text
Kioscomas/
├─ .github/workflows/       Automatización de publicaciones
├─ desktop/                 Proceso principal y puente seguro de Electron
├─ docs/                    Documentación complementaria
├─ public/                  Manifest, service worker y archivos estáticos
├─ scripts/                 Compilación, migraciones y pruebas
├─ server/                  API de nube y almacenamiento PostgreSQL
├─ src/
│  ├─ app/                  Estado raíz, cuentas y datos iniciales
│  ├─ billing/              Referidos y reglas comerciales
│  ├─ cloud/                Sesión, repositorio, protocolo y sincronización
│  ├─ features/             Módulos funcionales
│  ├─ legal/                Versión de Términos y Condiciones
│  ├─ security/             Autenticación, prueba y activación
│  ├─ shared/               Componentes y utilidades reutilizables
│  └─ updates/              Estado de actualización
├─ app.html                 Entrada de la aplicación en build público
├─ index.html               Entrada principal en build cloud/escritorio
├─ landing.html             Landing pública
├─ precios.html             Página comercial
├─ terminos.html            Términos y Condiciones
├─ render.yaml              Servicios declarados para Render
├─ vite.config.js           Entradas y compilación web
└─ package.json             Versiones, comandos y empaquetado
```

Documentos históricos como `DOCUMENTACION_KIOSCOAPP.md`, `MANUAL_TECNICO.md` y `MANUAL_PUBLICACION_WEB_Y_NUBE.md` sirven como antecedente, pero este archivo debe mantenerse como manual unificado actual.

## 26. Entradas web, pública, legal y de escritorio

- `src/main.jsx`: monta la aplicación principal.
- `src/app/KioscoApp.jsx`: orquesta sesión, negocio activo, datos, navegación y sincronización.
- `src/landing.jsx`: landing, demo, descargas y argumentos comerciales.
- `src/precios.jsx`: planes, referidos y llamadas a la acción.
- `src/terminos.jsx`: página legal.
- `src/legal/terms.js`: versión única de términos aceptada por cliente y servidor.
- `vite.config.js`: registra las entradas HTML de la compilación multipágina.
- `desktop/main.cjs`: ventana, actualizador, cajón de dinero y servidor local de desarrollo.
- `desktop/preload.cjs`: única API de Electron expuesta al renderer.
- `server/cloud-server.mjs`: API HTTP.

Cuando agregues una página pública, incorporala también al input de Vite, al service worker si debe funcionar sin red y a las pruebas PWA.

## 27. Modelo de datos

El dataset inicial se define en `src/app/data.js`. Cada negocio tiene, entre otros:

- `products`
- `caja`
- `tickets`
- `clientes`
- `comprasItems`
- `proveedores`
- `perdidas`
- `sugerencias`
- `pedidos`
- `gastos`
- `ventasSuspendidas`
- `auditoria`
- `inventarios`
- `tareas`
- `metas`
- `promociones`
- `reservas`
- `presupuestos`
- `arqueos`
- `configuracionFiscal`
- `comprobantes`
- `listaCompras`
- `retornables`
- `cambioCaja`
- `autoconsumos`
- `turnos`
- `recordatoriosProveedor`
- `movimientosStock`
- `historialLimpiezas`
- `labelTemplates`
- `tutorialProgress`

No todos los campos viajan igual. `src/cloud/protocol.js` define las entidades que se sincronizan por registro y las claves que se sincronizan como secciones o valores.

### Identidad y versiones

Cada entidad sincronizable necesita un ID estable. Las operaciones incluyen `tenantId`, `deviceId`, fecha, versión de esquema y, cuando corresponde, versión base. No reutilices IDs de registros eliminados.

### Migraciones

Las migraciones de datos locales existentes viven cerca de `migrarCuentasDemo` y `migrarDatosDemo`. Deben ser:

- Idempotentes: ejecutarlas dos veces no vuelve a modificar el resultado.
- Compatibles con datos parciales.
- Conservadoras: nunca reemplazar datos reales por semillas de demo.
- Probadas con una copia de un dataset viejo.

## 28. Persistencia local

`src/shared/storage.js` presenta una interfaz asíncrona `get`, `set` y `delete`. En navegadores normales usa `localStorage`; si existe `window.storage`, usa ese adaptador.

Claves importantes:

- `cuentas`: cuentas visibles localmente.
- `datos`: datasets separados por `tenantId`.
- `kiosco_cloud_config`: URL, ID de dispositivo y preferencias de nube.
- `__cloud_sync_queue_v1`: operaciones pendientes.
- `__cloud_sync_meta_v1`: cursores y última sincronización.
- `__cloud_sync_conflicts_v1`: conflictos pendientes.

El almacenamiento del navegador no es una base transaccional completa. El código usa bloqueos y mutaciones serializadas para evitar sobrescrituras dentro de la misma pestaña. Antes de aumentar mucho el volumen de datos, evaluar migrar el adaptador local a IndexedDB sin cambiar su contrato público.

## 29. Nube y sincronización

Archivos centrales:

- `src/cloud/syncEngine.js`
- `src/cloud/protocol.js`
- `src/cloud/entitySync.js`
- `src/cloud/conflictMerge.js`
- `src/cloud/repository.js`
- `src/cloud/dataStorageLock.js`

### Ciclo

1. El repositorio actualiza la copia local.
2. `enqueue` normaliza y compacta la operación.
3. `flush` envía lotes de hasta 20 operaciones a `/v1/sync/push`.
4. El servidor acepta, rechaza o informa conflictos.
5. El cliente actualiza versiones confirmadas.
6. `/v1/sync/pull?since=cursor` descarga novedades.
7. El cursor y la hora se guardan localmente.

La cola conserva como máximo 5000 operaciones; los conflictos, 500. Operaciones sucesivas sobre el mismo destino se compactan.

### Bootstrap

`/v1/sync/bootstrap` descarga una foto inicial del negocio. Las operaciones locales reales se reaplican encima. Las semillas redundantes se retiran para evitar que una instalación limpia reemplace una nube existente.

### Conflictos

La combinación automática compara entidad, campos y versión base. La resolución manual puede:

- Conservar nube y aplicar el valor del servidor localmente.
- Conservar local y reenviar con la versión actual del servidor.

No implementes una política global “último gana” para todo el dataset: dos cajas creando ventas diferentes no deben reemplazarse entre sí.

### Datos globales

Las cuentas globales usan operaciones `system_set` y sólo pueden publicarse desde una sesión de superadministrador. El motor descarta reemplazos inseguros que contengan únicamente el administrador local.

## 30. Autenticación, sesiones y dispositivos

Archivos centrales:

- `src/cloud/cloudAuth.js`
- `src/security/auth.js`
- `src/security/installationActivation.js`
- `src/security/trialAccess.js`
- `src/features/autenticacion/LoginView.jsx`
- `src/features/autenticacion/ActivationView.jsx`
- `src/features/autenticacion/PasswordResetView.jsx`
- `server/email-service.mjs`

### Registro

`POST /v1/auth/register` exige correo válido y aceptación explícita de la versión vigente de términos. El servidor normaliza el correo y guarda `termsAcceptedAt` y `termsVersion` en la cuenta. Las cuentas históricas sin correo continúan funcionando, pero deben completarlo desde el panel administrativo para usar la recuperación automática.

### Sesión

El servidor entrega token de acceso y token de renovación. El tiempo del token se controla con `KIOSCO_ACCESS_TOKEN_HOURS`. El cliente debe intentar renovar antes de obligar a iniciar sesión otra vez.

### Recuperación de contraseña y correos

`POST /v1/auth/password/forgot` siempre responde con un mensaje neutro. Cuando el correo identifica exactamente un usuario, genera un token aleatorio, guarda solamente SHA-256 y envía mediante Resend un enlace hacia `KIOSCO_PUBLIC_APP_URL`. `POST /v1/auth/password/reset` exige una contraseña de 8 a 128 caracteres, acepta el token una sola vez, actualiza la credencial local y cloud y revoca las sesiones anteriores.

El límite predeterminado es un envío cada 2 minutos y cinco por hora para un mismo correo, además de diez solicitudes cada 15 minutos por IP. Las plantillas transaccionales viven en `server/email-service.mjs`; la guía de dominio, DNS y variables está en `docs/CONFIGURAR_CORREOS_RESEND.md`.

### Activación

El dispositivo tiene un UUID local. La clave se canjea en `/v1/activation/redeem`. El administrador puede ver y revocar activaciones. Una activación no sustituye la autenticación del usuario.

La aplicación real exige esta autorización tanto en escritorio como en cada perfil de navegador usado para acceder a la nube. El cliente la habilita con `VITE_REQUIRE_DEVICE_ACTIVATION=true` y el servidor la exige con `KIOSCO_REQUIRE_DEVICE_ACTIVATION=1`; el servidor publicado también la considera obligatoria por defecto salvo una desactivación explícita. La demo pública es una experiencia separada, usa datos ficticios y no se conecta a las cuentas reales, por lo que no solicita clave.

### Superadministrador

Las credenciales maestras provienen únicamente de variables privadas del servidor. Nunca deben compilarse dentro de Vite, almacenarse en `.env.public` ni enviarse al cliente.

## 31. Servidor y API

`server/cloud-server.mjs` usa el servidor HTTP nativo de Node. Rutas principales:

### Estado

- `GET /v1/health`: proceso activo y metadatos básicos.
- `GET /v1/ready`: confirma almacenamiento disponible y cantidad de registros.
- `GET /v1/ready/sections`: diagnóstico de secciones.
- `GET /v1/releases/latest`: versión disponible según canal.

### Catálogo

- `GET /v1/catalog/providers`
- `GET /v1/catalog/lookup/:codigo`
- `GET /v1/catalog/barcodes/:codigo`
- `POST /v1/catalog/verify-pending`
- `GET/POST /v1/admin/catalog...`

### Activación

- `POST /v1/activation/status`
- `POST /v1/activation/redeem`
- `POST /v1/activation/admin`
- `GET/POST /v1/admin/activation-codes...`
- `GET/POST /v1/admin/activations...`

### Autenticación

- `POST /v1/auth/register`
- `POST /v1/auth/password/forgot`
- `POST /v1/auth/password/reset`
- `POST /v1/auth/register-local`
- `POST /v1/auth/pair-device`
- `POST /v1/auth/bootstrap`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

### Sincronización y dispositivos

- `GET /v1/sync/bootstrap`
- `POST /v1/sync/push`
- `GET /v1/sync/pull`
- `GET /v1/devices`
- `POST /v1/devices/revoke`

### Notificaciones y reportes

- `GET /v1/notifications`: bandeja del usuario autenticado.
- `POST /v1/notifications/:id/read`: recibo de lectura individual.
- `GET /v1/notifications/push-public-key`: clave pública para autorizar Web Push.
- `POST/DELETE /v1/notifications/push-subscriptions`: alta o baja de un dispositivo para avisos.
- `GET/POST /v1/admin/notifications`: consulta y publicación administrativa individual, múltiple o masiva.
- `POST /v1/admin/notifications/:id/archive`: retira un aviso de las bandejas sin destruir su registro inmediatamente.
- `POST /v1/issues`: envía un problema del negocio y genera un aviso al administrador.
- `GET/POST /v1/admin/issues...`: consulta, resolución y archivo de reportes.

Los avisos de alta pendiente, vencimiento de abono y pausa de un referido se generan automáticamente con una clave de origen que evita duplicados. Todos quedan dentro de la app aunque el destinatario no autorice notificaciones del sistema. La configuración de las claves está en `docs/CONFIGURAR_NOTIFICACIONES_PUSH.md`.

Las rutas privadas validan sesión, negocio y dispositivo. Toda escritura de una cuenta no administradora también valida que la suscripción o prueba permita escribir.

## 32. PostgreSQL y Supabase

En producción, `DATABASE_URL` apunta al PostgreSQL de Supabase. El servidor selecciona el almacenamiento PostgreSQL cuando existe esa variable. `/v1/ready` debe responder con `"persistence": "postgresql"`.

Reglas:

- Usar la cadena de conexión del servidor, nunca la clave `service_role` en el frontend.
- Activar SSL según la cadena provista por Supabase.
- No cambiar manualmente datos de producción sin respaldo.
- Probar migraciones contra una base separada.
- Revisar capacidad, pausas, límites y copias del plan de Supabase.
- Mantener índices adecuados si crece el historial de operaciones.

El servidor conserva datos lógicos como registros y reconstruye datasets por negocio. Las pruebas de `postgres-record-store` son obligatorias antes de tocar ese almacenamiento.

## 33. Variables de entorno

### Variables públicas de Vite

Todo lo que comienza con `VITE_` puede quedar visible en el navegador. No debe contener secretos.

```dotenv
VITE_PUBLIC_API_URL=https://kiosco-plus-api.onrender.com
VITE_CLOUD_AUTO_CONNECT=true
VITE_PUBLIC_APP_URL=./app.html
VITE_PUBLIC_DEMO=true
VITE_SALES_WHATSAPP=1122502706
VITE_PLAN_PRICE=30000
VITE_LAUNCH_PRICE=20000
VITE_EXTRA_DEVICE_PRICE=5000
VITE_WINDOWS_DOWNLOAD_URL=https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Setup.exe
VITE_MAC_APPLE_SILICON_DOWNLOAD_URL=https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-arm64.dmg
VITE_MAC_INTEL_DOWNLOAD_URL=https://github.com/JuanPablo2905/Kioscomas/releases/latest/download/KioscoPlus-Mac-x64.dmg
VITE_LEGAL_NAME=
VITE_LEGAL_CUIT=
VITE_LEGAL_ADDRESS=
VITE_LEGAL_EMAIL=
```

Los cuatro datos legales deben completarse antes de ofrecer comercialmente el servicio.

### Variables privadas del servidor

```dotenv
DATABASE_URL=
KIOSCO_SUPERADMIN_USERNAME=
KIOSCO_SUPERADMIN_PASSWORD=
KIOSCO_SUPERADMIN_EMAIL=
KIOSCO_ACCESS_TOKEN_HOURS=24
KIOSCO_BACKUP_RETENTION_DAYS=7
KIOSCO_RESEND_API_KEY=
KIOSCO_EMAIL_FROM="Kiosco+ <notificaciones@correo.kioscomas.ar>"
KIOSCO_EMAIL_REPLY_TO=
KIOSCO_PUBLIC_APP_URL=https://app.kioscomas.ar
KIOSCO_PASSWORD_RESET_MINUTES=30
KIOSCO_VAPID_PUBLIC_KEY=
KIOSCO_VAPID_PRIVATE_KEY=
KIOSCO_VAPID_SUBJECT=mailto:soporte@kioscomas.ar
KIOSCO_UPCITEMDB_KEY=
KIOSCO_GO_UPC_API_KEY=
KIOSCO_BARCODE_LOOKUP_API_KEY=
PORT=8787
```

Variables de desarrollo local adicionales:

- `KIOSCO_LOCAL_MODE`
- `KIOSCO_CLOUD_DB`
- `KIOSCO_CLOUD_DATA_DIR`
- `KIOSCO_CLOUD_PORT`
- `KIOSCO_ENABLE_LOCAL_CLOUD`

Los archivos `.env.example`, `.env.public` y `.env.cloud` sólo deben llevar configuración pública o valores vacíos. Los secretos reales se cargan en Render/GitHub y no se suben.

## 33.1 Referidos y descuentos manuales

El código se vincula al registrarse. Antes del primer pago el referido está `pendiente`; con un pago válido y abono vigente pasa a `activo`; al vencer queda `pausado` y deja de descontar; una renovación lo reactiva. El administrador puede corregir el negocio referente o invalidar la relación dejando el motivo.

Los descuentos comerciales especiales se guardan en `manualDiscounts` con porcentaje, motivo, inicio, vencimiento opcional y revocación. No aumentan la cantidad de referidos. Al registrar un pago se congela el precio base, el porcentaje automático, el manual y el total aplicado; los cambios posteriores sólo afectan el siguiente cobro.

La edición general de una cuenta no cambia contraseñas. El precio puede heredar el valor general, usar uno especial o marcarse explícitamente como cuenta gratuita. Las contraseñas temporales se administran en la sección **Cuentas**.

## 34. Preparar el entorno de desarrollo

Requisitos:

- Git.
- Node.js 22.
- pnpm 11.9.0 mediante Corepack.
- Windows para probar NSIS y cajón de dinero.
- macOS o GitHub Actions para generar los DMG de Apple Silicon e Intel.
- Una base PostgreSQL de prueba para pruebas de integración reales.

Preparación:

```powershell
git clone https://github.com/JuanPablo2905/Kioscomas.git
cd Kioscomas
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
```

Copiá las variables necesarias a un archivo local ignorado por Git. No modifiques las credenciales de producción para desarrollar.

## 35. Comandos del proyecto

```powershell
pnpm dev                 # app y servidor local coordinados
pnpm dev:web             # Vite solamente
pnpm cloud:dev           # API local
pnpm build               # compilación general
pnpm build:public        # landing y sitio público preparado
pnpm build:cloud-app     # aplicación web conectada a nube
pnpm preview             # vista previa de build
pnpm mobile:preview      # prueba accesible en la red local
pnpm desktop             # Electron en desarrollo
pnpm desktop:build       # instalador Windows sin publicar
pnpm desktop:portable    # ejecutable portable Windows
pnpm desktop:build:mac         # DMG y ZIP para la arquitectura del Mac actual
pnpm desktop:build:mac:arm64   # DMG y ZIP para Apple Silicon
pnpm desktop:build:mac:x64     # DMG y ZIP para Mac Intel
```

No uses el ejecutable portable de desarrollo como producto final. El instalador oficial es el asset publicado por GitHub Actions.

## 36. Pruebas automatizadas

```powershell
pnpm test:cloud-config
pnpm test:postgres-records
pnpm test:tutorials
pnpm test:pwa
pnpm test:views
pnpm test:functions
pnpm test:cloud
pnpm test:all
```

`test:all` ejecuta configuración cloud, almacenamiento PostgreSQL, tutoriales, PWA, vistas, funciones, build, navegación pública, control de activaciones y recuperación de contraseña. `test:cloud` levanta un servidor temporal y comprueba autenticación, activaciones y sincronización. `test:public-site` verifica que la landing diferencie la demo de la aplicación real y que su navegación sea adaptable. `test:device-activation` comprueba que un navegador nuevo no pueda iniciar sesión en la nube hasta canjear una clave válida. `test:password-recovery` comprueba tokens de un uso, hash persistido, revocación de sesiones, límites y plantillas de Resend sin enviar correos reales.

Al modificar términos, registro o versión legal, ejecutar como mínimo:

```powershell
pnpm test:pwa
pnpm test:cloud
pnpm build:public
pnpm build:cloud-app
```

Una prueba verde no reemplaza la verificación manual en celular, navegador, Windows y, para una versión Mac, macOS.

## 37. PWA y funcionamiento móvil

Archivos centrales:

- `public/manifest.webmanifest`
- `public/sw.js`
- `src/shared/pwaInstall.js`
- `scripts/pwa-tests.mjs`

El service worker cachea la estructura de la aplicación para permitir el arranque sin red. No debe cachear respuestas privadas de la API como si fueran públicas. Al cambiar archivos críticos, incrementá la versión del caché para forzar renovación.

Pruebas manuales:

1. Abrir la web con conexión.
2. Instalarla en inicio.
3. Iniciar sesión y cargar un negocio.
4. Activar modo avión.
5. Cerrar y volver a abrir.
6. Registrar un cambio no destructivo.
7. Volver a conectar.
8. Confirmar que la cola llega a cero en otro dispositivo.

Safari/iOS y Chrome/Android no se comportan igual. Probar ambos.

## 38. Aplicación de escritorio

Electron carga `dist/index.html` dentro de una ventana con:

- `contextIsolation: true`
- `nodeIntegration: false`
- `preload.cjs` como puente permitido

El renderer sólo recibe funciones concretas para actualizaciones, captura y cajón. No expongas `ipcRenderer`, sistema de archivos o ejecución de comandos de forma genérica.

El servidor local incluido existe para desarrollo o modos habilitados explícitamente. Una compilación cloud publicada debe usar la URL de `.env.cloud` y migrar configuraciones antiguas que apunten a localhost.

Datos de instalación Windows:

- Instalación por usuario.
- Un clic.
- Acceso directo de escritorio y menú Inicio.
- Inicia al terminar.
- Desinstalar no borra automáticamente los datos de usuario.

## 39. Versionado, instaladores y actualizaciones

La versión de `package.json` y la etiqueta Git deben coincidir exactamente.

Flujo recomendado:

1. Confirmar cambios y pruebas.
2. Subir `package.json` con la nueva versión, por ejemplo `0.2.4`.
3. Hacer commit y push a `main`.
4. Crear y subir la etiqueta exacta:

```powershell
git tag v0.2.4
git push origin v0.2.4
```

5. Seguir **Actions → Publicar Kiosco+ para Windows y Mac**.
6. Confirmar que la release contiene:
   - `KioscoPlus-Setup.exe`
   - `KioscoPlus-Setup.exe.blockmap`
   - `latest.yml`
   - `KioscoPlus-Mac-arm64.dmg`
   - `KioscoPlus-Mac-arm64.zip`
   - `KioscoPlus-Mac-x64.dmg`
   - `KioscoPlus-Mac-x64.zip`
7. Instalar en un equipo limpio.

Windows usa `electron-updater`, descarga automáticamente y aplica al salir. macOS está configurado en modo de actualización manual mientras no haya firma.

Certificados opcionales:

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

El workflow puede compilar sin firma si no están configurados, pero Windows mostrará más advertencias. Para distribuir Mac sin advertencias normales se necesita Apple Developer, firma y notarización.

## 40. Despliegue en Render

`render.yaml` define:

1. Servicio estático `Kioscomas`, generado con `pnpm run build:cloud-app`.
2. Servicio Node `kiosco-plus-api`, iniciado con `node server/cloud-server.mjs`.

Variables privadas que deben cargarse en el panel del servicio API:

- `DATABASE_URL`
- `KIOSCO_SUPERADMIN_PASSWORD`
- `KIOSCO_RESEND_API_KEY`
- `KIOSCO_EMAIL_FROM`
- `KIOSCO_EMAIL_REPLY_TO`
- Las claves opcionales de catálogos.

Después de desplegar:

1. Abrir `/v1/health`.
2. Abrir `/v1/ready` y confirmar `ok: true` y `persistence: postgresql`.
3. Abrir la landing, precios y términos.
4. Crear una clave de prueba.
5. Activar un perfil limpio.
6. Registrar una cuenta aceptando términos.
7. Confirmar el correo de bienvenida, aprobarla y comprobar el aviso de habilitación.
8. Probar **Olvidé mi contraseña** y verificar que el enlace funcione una sola vez.
9. Entrar, crear un producto y una venta.
10. Confirmar el cambio desde otro dispositivo.

## 41. Cambios frecuentes paso a paso

### Agregar un campo a una entidad existente

1. Definir valor por defecto sin romper registros viejos.
2. Actualizar formulario y validaciones.
3. Confirmar que la entidad ya figura en `SYNCABLE_ENTITIES`.
4. Revisar combinación de conflictos si el campo puede editarse en paralelo.
5. Agregar prueba funcional y cloud.

### Agregar una entidad nueva

1. Agregar la colección al dataset por defecto.
2. Incorporarla a `SYNCABLE_ENTITIES`.
3. Crear setters a través del repositorio sincronizable.
4. Definir ID estable.
5. Revisar bootstrap, push, pull y conflicto.
6. Probar dos dispositivos con cambios simultáneos.

### Agregar un módulo al menú

1. Crear el componente en `src/features/<modulo>`.
2. Agregar permiso de menú si corresponde.
3. Incorporar navegación en `KioscoApp.jsx`.
4. Añadir versión móvil.
5. Añadir tutorial y prueba de destino.
6. Añadir límites de error si el módulo es grande.

### Cambiar precios comerciales

Modificar `VITE_PLAN_PRICE`, `VITE_LAUNCH_PRICE` y `VITE_EXTRA_DEVICE_PRICE` en el entorno que construye el sitio. Verificar landing, página de precios, mensajes de WhatsApp y reglas del servidor si llegan a cobrar automáticamente en el futuro.

### Cambiar Términos y Condiciones

1. Modificar `src/terminos.jsx`.
2. Cambiar `TERMS_VERSION` en `src/legal/terms.js`.
3. Revisar el texto con un profesional.
4. Ejecutar pruebas PWA y cloud.
5. Publicar cliente y servidor juntos.

Una versión nueva obliga a decidir si usuarios existentes deben aceptar otra vez. Actualmente el registro inicial guarda la aceptación; si se requiere reaceptación, debe implementarse un flujo explícito de migración y bloqueo proporcional.

### Cambiar la versión de la aplicación

Modificar `version` en `package.json`, actualizar este manual cuando corresponda y crear una etiqueta Git coincidente. No reutilizar una etiqueta ni reemplazar assets de una release consumida por auto-update.

## 42. Seguridad y privacidad

Lista mínima:

- Nunca subir contraseñas, cadenas PostgreSQL ni claves de proveedor.
- Rotar cualquier secreto que haya aparecido en chat, captura, commit o log.
- Usar HTTPS en producción.
- Guardar contraseñas con hash y sal; nunca texto plano.
- Aplicar límite de tamaño a cuerpos JSON.
- Validar `tenantId`, sesión y rol en servidor, no sólo en React.
- Revocar tokens al cerrar sesión y dispositivos cuando corresponda.
- No registrar contraseñas ni tokens completos en logs.
- Mantener `contextIsolation` y `nodeIntegration: false` en Electron.
- Escapar contenido al imprimir o construir HTML.
- Limitar permisos de cámara al propio origen.
- Revisar dependencias y alertas de GitHub.
- Probar restauración de backups, no sólo su creación.

Datos personales:

- Informar qué se recolecta, finalidad, conservación y derechos.
- Recoger sólo datos necesarios.
- Proteger datos de clientes, empleados y proveedores.
- Permitir solicitudes de acceso, corrección o eliminación donde corresponda.
- Documentar incidentes y respuesta.

Los Términos y Condiciones no sustituyen una Política de Privacidad completa. Antes de comercializar, conviene publicar también esa política y someter ambos documentos a revisión profesional.

## 43. Diagnóstico técnico

### Orden recomendado

1. Reproducir sin borrar datos.
2. Guardar texto exacto, hora, usuario, negocio, dispositivo y versión.
3. Consultar `/v1/health`.
4. Consultar `/v1/ready`.
5. Revisar estado de sesión y activación.
6. Revisar cola y conflictos.
7. Revisar logs de Render en esa hora.
8. Revisar disponibilidad y conexiones de Supabase.
9. Reproducir con un usuario de prueba y datos no sensibles.
10. Crear una prueba que falle antes de corregir.

### Síntomas típicos

| Síntoma | Causa probable | Verificación |
|---|---|---|
| `health` responde y `ready` falla | base o almacenamiento no disponible | logs y `DATABASE_URL` |
| tarda en login | servicio frío, consulta lenta o conexión agotada | tiempos en Render/Supabase |
| sesión vence rápido | token/refresh o reloj | variable de horas y respuesta `/refresh` |
| sólo falla escritorio | versión vieja, URL guardada o activación | versión y `kiosco_cloud_config` |
| pendientes permanentes | 401/403, conflicto o operación rechazada | detalle de cola y logs de push |
| datos diferentes por equipo | pull detenido o tenant incorrecto | cursor, tenant y dispositivo |
| vuelve tutorial | progreso no asociado a cuenta | `tutorialProgress` y tenant |
| actualización vuelve a versión vieja | release/version/tag incorrectos | `latest.yml` y versión instalada |

No “soluciones” un fallo vaciando Supabase o borrando toda la cola sin identificar la causa.

## 44. Lista de control antes de publicar

### Producto

- [ ] Registro, aceptación legal, activación e inicio de sesión funcionan.
- [ ] Una venta descuenta stock una sola vez.
- [ ] Anulación restaura stock y caja.
- [ ] Fiado y pagos conservan historial.
- [ ] Cierre de caja coincide con movimientos.
- [ ] Tutoriales no reaparecen en la misma cuenta.
- [ ] La app móvil cabe sin controles ocultos.

### Nube

- [ ] `/v1/health` y `/v1/ready` están verdes.
- [ ] `persistence` indica PostgreSQL.
- [ ] Dos dispositivos intercambian cambios.
- [ ] La cola offline se vacía al volver.
- [ ] Un dispositivo revocado pierde acceso.
- [ ] Los datos de un negocio no aparecen en otro.

### Legal y comercial

- [ ] Nombre o razón social, CUIT, domicilio y correo están completos.
- [ ] Términos revisados por profesional.
- [ ] Botones de baja y arrepentimiento visibles y operativos.
- [ ] Precio mostrado coincide con el ofrecido.
- [ ] Documentos internos dicen NO FISCAL.
- [ ] Política de Privacidad publicada.

### Técnica

- [ ] `pnpm test:all` termina correctamente.
- [ ] `pnpm test:cloud` termina correctamente.
- [ ] Build público y cloud compilan.
- [ ] `package.json` y tag coinciden.
- [ ] Release tiene todos los assets.
- [ ] Instalación limpia probada en Windows.
- [ ] DMG probado en Mac Intel o Apple Silicon según disponibilidad.
- [ ] No hay secretos ni datos de clientes en Git.

## 45. Reglas de mantenimiento

1. Mantener este manual junto al código y actualizarlo en el mismo commit que cambia un flujo importante.
2. No introducir datos demo en builds de producción salvo dentro de la demo pública aislada.
3. No convertir errores de red en borrados automáticos.
4. No permitir que el cliente decida por sí solo permisos, suscripciones o `tenantId`.
5. Versionar protocolos y migraciones.
6. Conservar compatibilidad razonable entre servidor y la versión anterior del cliente durante una actualización.
7. Publicar cambios de autenticación y servidor antes o junto con el cliente que depende de ellos.
8. Medir fallos repetidos: tiempo de login, refresh, push, pull y activación.
9. Usar cuentas y bases de prueba para desarrollo.
10. Documentar cada incidente importante y agregar una prueba que evite su regreso.

---

## Contacto y traspaso

Antes de entregar el mantenimiento a otra persona, proporcionar por un canal seguro:

- Acceso al repositorio GitHub.
- Acceso limitado a Render.
- Acceso limitado al proyecto Supabase.
- Ubicación de backups y procedimiento de restauración.
- Titular de dominios y certificados.
- Cuenta de firma Windows/Apple si se incorporan.
- Credenciales de prueba, nunca contraseñas personales.
- Historial de incidentes y versiones actualmente instaladas.

No guardar esos secretos dentro de este manual ni en el repositorio.
