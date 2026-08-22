# Registro de despliegue y nube — 31 de julio de 2026

## Enlaces activos

- Aplicación pública: https://kiosco-plus.onrender.com
- API: https://kiosco-plus-api.onrender.com
- Salud del servidor: https://kiosco-plus-api.onrender.com/v1/health
- Código fuente: https://github.com/JuanPablo2905/Kioscomas
- Acceso móvil privado: https://compu-juampa.tailfb630f.ts.net

## Hito alcanzado

La web y la API quedaron publicadas en Render. Se conectó la aplicación de escritorio al servidor HTTPS y se abrió la interfaz desde un iPhone mediante Tailscale. Un cambio realizado desde el teléfono se reflejó rápidamente en la computadora, validando el circuito completo de autenticación y sincronización entre dispositivos.

## Implementación relevante

- `server/cloud-server.mjs` usa el puerto asignado por Render y escucha en `0.0.0.0`.
- `render.yaml` define el sitio estático y el servicio Node `kiosco-plus-api`.
- El modo demo público depende de `VITE_PUBLIC_DEMO=true`; no está fijo en el código.
- La compilación pública se genera en `dist-public-source` y luego prepara `public-build`, sin sobrescribir `dist`.
- El ejecutable de desarrollo vigente es `dev-launcher/KioscoPlus-Desarrollo.exe`.

## Pendiente crítico

La API funciona, pero sus archivos JSON viven en almacenamiento efímero de Render. Antes de usar datos reales hay que migrar a PostgreSQL persistente, agregar migraciones y copias, probar restauración y repetir las pruebas multiempresa y de reconexión. El servicio gratuito también puede dormir y tardar alrededor de 50 segundos en despertar.

---

# Manual integral de Kiosco+

Actualizado: 29 de julio de 2026  
Versión técnica del proyecto: `0.1.0`  
Nombre público de la aplicación: **Kiosco+**

> Este es el documento vigente para entender el producto, su funcionamiento, su estado técnico y su comunicación pública. Puede entregarse a otro programador o a una IA como Claude para crear documentación, publicaciones, guiones, carruseles o videos sin inventar funciones.

## 1. Resumen del producto

Kiosco+ es una aplicación de gestión pensada para kioscos, almacenes y comercios de barrio, especialmente negocios atendidos por su dueño o por equipos pequeños.

Centraliza en una sola herramienta:

- Productos, precios y códigos de barras.
- Stock de depósito y mercadería expuesta en vitrina.
- Ventas, caja, tickets y medios de pago.
- Compras, pedidos a proveedores y recepción de mercadería.
- Gastos, clientes, fiado y reportes.
- Alertas, auditoría, usuarios, roles y permisos.
- Herramientas complementarias como promociones, etiquetas, presupuestos y tareas.

La idea central de Kiosco+ es reemplazar anotaciones dispersas, cálculos manuales y controles de memoria por información ordenada y fácil de consultar.

### Propuesta de valor breve

**Kiosco+ ayuda a saber qué se vendió, cuánto stock queda, qué hay que reponer y cómo está funcionando el negocio, desde una misma aplicación.**

### Frase de marca

**Tu negocio, bajo control.**

## 2. A quién está dirigido

Público principal:

- Kioscos.
- Almacenes.
- Despensas.
- Minimercados pequeños.
- Drugstores.
- Comercios de barrio con uno o pocos empleados.

Situaciones que busca resolver:

- No saber con precisión cuánto stock queda.
- Olvidar reponer la vitrina o hacer un pedido.
- Perder el seguimiento de gastos, fiados o movimientos de caja.
- No tener historial de quién modificó un producto o realizó una operación.
- Cobrar lentamente por tener que buscar productos de manera manual.
- Usar varias herramientas separadas para administrar el mismo negocio.

Kiosco+ tiene dos formas de trabajo:

- **Trabajo solo:** simplifica la interfaz cuando el dueño no tiene empleados.
- **Tengo empleados:** habilita roles, permisos, turnos, rendimiento por persona y controles adicionales.

El modo puede cambiarse más adelante sin eliminar los empleados ni los datos guardados.

## 3. Estado real del proyecto

Esta distinción debe respetarse al crear contenido público.

### Disponible y utilizable hoy

- Aplicación web responsive.
- Aplicación de escritorio para Windows.
- Uso desde celular mediante navegador o instalación como aplicación web.
- Datos locales por negocio.
- Servidor central local ejecutado en la computadora.
- Sincronización de desarrollo entre dispositivos conectados al mismo servidor.
- Funciones operativas detalladas en este documento.
- Tutoriales interactivos dentro de la aplicación.

### En etapa de prueba o preparación

- Acceso remoto mediante Tailscale.
- Túneles públicos temporales mediante Cloudflare.
- Sincronización central alojada en la computadora del administrador.
- Apertura de cajón registrador según impresora y configuración.
- Base de futuras actualizaciones automáticas.
- Configuración inicial para una futura aplicación móvil empaquetada.

### No disponible todavía como servicio de producción

- Servidor comercial público permanente.
- Base de datos PostgreSQL alojada en una nube real.
- Aplicación nativa publicada en App Store o Google Play.
- Actualizaciones automáticas firmadas y distribuidas a clientes.
- Facturación fiscal oficial integrada con ARCA.
- CAE, vencimiento de CAE o envío automático de facturas a ARCA.

## 4. Recorrido funcional completo

### 4.1 Inicio de sesión y cuentas

La aplicación permite:

- Iniciar sesión como dueño, empleado o administrador de Kiosco+.
- Crear una cuenta de negocio.
- Elegir si el negocio trabaja solo o con empleados.
- Mantener cada negocio aislado mediante un identificador `tenantId`.
- Aprobar, bloquear, editar o eliminar cuentas desde el panel del administrador de la app.
- Entrar a un negocio desde la cuenta administradora para asistirlo o revisarlo.
- Configurar vencimiento de sesión, inactividad y bloqueo por intentos fallidos.

### 4.2 Inicio

El panel principal resume:

- Estado de la caja.
- Ventas del día.
- Productos con stock crítico.
- Productos que necesitan reposición en vitrina.
- Valor del stock.
- Accesos a las principales secciones.

También contiene:

- Ayuda contextual.
- Escáner global.
- Acceso a Configuración.
- Reporte de problemas.

### 4.3 Notificaciones

El centro de notificaciones reúne alertas del negocio y las diferencia por prioridad:

- Críticas.
- Altas.
- Medias.
- Bajas o informativas.

Puede avisar sobre:

- Stock bajo.
- Reposición de vitrina.
- Productos vencidos o próximos a vencer.
- Posibles tickets duplicados.
- Diferencias de caja.
- Gastos pendientes vencidos.
- Sugerencias que esperan aprobación.

Las tarjetas usan color, icono y descripción para que cada aviso se distinga del fondo. Cuando corresponde, la notificación lleva a la sección relacionada.

### 4.4 Stock y vencimientos

El área de Stock está dividida en cuatro submenús.

#### Productos

Permite:

- Crear, editar y eliminar productos según permisos.
- Guardar nombre, categoría, código de barras, costo, precio de venta, stock, mínimo y alerta de vitrina.
- Vender por unidad, peso o volumen.
- Registrar fechas de vencimiento.
- Asignar un proveedor habitual.
- Agrupar variantes dentro de una familia, por ejemplo Coca-Cola 500 ml, 1,25 L, 2,25 L o Zero.
- Crear grupos personalizados como Heladera, Mostrador o Promociones.
- Consultar el historial de un producto.
- Copiar un producto.
- Buscar por nombre o código.
- Importar y exportar productos mediante Excel o CSV.
- Modificar precios de muchos productos a la vez.

#### Vencimientos y pérdidas

Permite:

- Ver productos vencidos o próximos a vencer.
- Registrar roturas, faltantes, robos o vencimientos.
- Descontar la cantidad correspondiente.
- Calcular la pérdida estimada a costo.
- Conservar un historial con producto, cantidad, motivo, fecha y responsable.

#### Conteo físico

Permite:

- Contar todo el inventario o una categoría.
- Comparar la cantidad real con la registrada.
- Calcular la diferencia física y su impacto a costo.
- Aprobar ajustes.
- Guardar un historial de conteos y responsables.

#### Autoconsumo

Descuenta productos utilizados dentro del propio negocio sin registrarlos como venta ni como pérdida. Conserva producto, cantidad, responsable y nota.

### 4.5 Escáner y catálogo por código de barras

El escáner unifica:

- Lectores USB que funcionan como teclado.
- Cámara del celular o de la computadora.
- Lectura continua para escanear varios productos sin cerrar el menú.
- Confirmación del producto detectado.
- Posibilidad de escanear un código al crear o editar un producto.

Cuando un código todavía no está cargado en el negocio, Kiosco+ consulta las fuentes en este orden:

- Catálogo compartido aprendido por el servidor local de Kiosco+.
- Open Facts universal, incluyendo alimentos, higiene, mascotas y productos generales.
- UPCitemdb.
- Pricely Argentina, como respaldo para productos y ediciones que circulan en el mercado local.

El servidor también incluye conectores opcionales para UPCitemdb comercial, Go-UPC y Barcode Lookup. Se activan mediante `KIOSCO_UPCITEMDB_KEY`, `KIOSCO_GO_UPC_API_KEY` y `KIOSCO_BARCODE_LOOKUP_API_KEY`. Las claves se conservan exclusivamente en el servidor y nunca se envían al navegador. Estos servicios requieren una cuenta propia y están sujetos a los límites o costos de cada proveedor.

No se descarga ni se copia de forma masiva ninguna base privada. Las consultas se realizan por código, respetando las interfaces y límites publicados por cada proveedor. Los resultados útiles se incorporan al catálogo compartido de Kiosco+ para no consumir nuevamente una consulta externa.

Si encuentra información, puede sugerir nombre, categoría, tamaño e imagen. La cobertura depende de que el producto exista en esas bases colaborativas; no todos los códigos comerciales están disponibles.

El catálogo compartido aprende automáticamente de los productos con código que los usuarios confirman y sincronizan. Esa ficha puede reutilizarse después desde otros dispositivos y negocios conectados al mismo servidor. Sólo guarda código, nombre, categoría, unidad, familia, variante, descripción e imagen pública: nunca comparte costo, precio de venta, stock, proveedor, usuario ni identidad del negocio. También reconoce equivalencias frecuentes entre UPC de 12 dígitos y EAN de 13 dígitos.

Los resultados externos encontrados se guardan en una caché local de hasta 2.000 códigos. Un resultado positivo se conserva durante 30 días y una búsqueda sin resultado se vuelve a intentar después de una hora, para que un código incorporado recientemente no permanezca bloqueado.

Cuando está disponible el servidor local de Kiosco+, la consulta a catálogos externos se realiza también desde ese servidor. Esto evita los bloqueos CORS habituales de los navegadores y permite guardar automáticamente el resultado en el catálogo compartido para los siguientes dispositivos y negocios. Si el servidor no está disponible, la app conserva como respaldo la consulta directa desde el navegador y la carga manual.

El escáner global funciona desde cualquier sección:

- Si detecta un producto, ofrece abrirlo en Venta o Stock.
- Si el producto no está todavía en el negocio, consulta el catálogo compartido y las fuentes externas antes de declararlo desconocido.
- Cuando encuentra una ficha externa, abre Nuevo producto en Stock con código, nombre, categoría, familia y variante ya completados; el usuario confirma los datos comerciales.
- Si detecta un ticket de Kiosco+, abre su información y las acciones permitidas.
- Si el código es desconocido, permite usarlo para crear un producto.

### 4.6 Vitrina

Separa la mercadería expuesta de la guardada en depósito.

Permite:

- Indicar cuántas unidades están exhibidas.
- Mover mercadería del depósito a la vitrina.
- Definir el nivel que genera una alerta de reposición.
- Buscar productos, códigos, variantes o grupos.
- Ver familias con sus variantes desplegables.
- Crear y usar grupos personalizados compartidos con Stock.

El total del producto se conserva como la suma de depósito y vitrina.

### 4.7 Ventas y caja

#### Caja

Permite:

- Abrir la caja con un saldo inicial.
- Registrar ingresos y retiros con motivo.
- Consultar movimientos e historial.
- Calcular el efectivo esperado.
- Cerrar la caja comparando el importe esperado con el contado.
- Guardar diferencias y responsable.
- Imprimir un resumen diario cuando está habilitado.

#### Venta

Permite:

- Buscar o escanear productos.
- Mostrar familias y elegir una variante.
- Armar un carrito.
- Cambiar cantidades.
- Eliminar líneas.
- Aplicar descuentos según permisos.
- Suspender una venta y retomarla.
- Elegir favoritos y productos frecuentes para Venta rápida.
- Cobrar con efectivo, Mercado Pago, tarjeta, transferencia, cuenta corriente o pago combinado.
- Calcular monto recibido y vuelto.
- Guardar ticket, stock, caja y responsable.

Atajo de teclado:

- Dos pulsaciones rápidas de Enter abren el cobro cuando hay un carrito válido.
- Dentro del cobro, Enter permite avanzar con el medio seleccionado cuando el formulario es válido.

#### Submenús de Ventas

- **Pedidos de clientes:** encargos con varios productos, cantidades, retiro y estado.
- **Presupuestos:** cotizaciones previas a una operación real.
- **Cambio:** cálculo rápido de vuelto sin registrar una venta.
- **Turnos:** disponible cuando el negocio tiene empleados.
- **Resumen diario:** información principal del día y opción de impresión.

### 4.8 Tickets

Los tickets guardan:

- Número.
- Fecha y hora.
- Productos.
- Cantidad.
- Precio unitario.
- Subtotal por línea.
- Total.
- Medio o combinación de pagos.
- Cliente, cuando corresponde.
- Persona que atendió.
- Estado y anulaciones.

Pueden imprimirse en 58 mm u 80 mm y personalizar:

- Encabezado.
- Pie.
- Colores.
- Tamaño del texto.
- Datos visibles.
- Código de barras interno.

El código de barras del ticket sirve para volver a encontrarlo rápidamente. Al escanearlo se muestra la información completa y, si el usuario tiene permiso, se puede reimprimir o anular/devolver. La anulación no borra el historial: registra una operación inversa y restaura lo que corresponda.

La detección de posibles duplicados compara tickets dentro de una ventana configurable, originalmente de 24 horas. Sólo alerta cuando coinciden los datos importantes de la operación, no simplemente por vender productos similares. En Reportes se revisa cada par y se puede:

- Confirmar que son dos ventas válidas, conservando ambos tickets y descartando la alerta.
- Anular el ticket repetido mediante el circuito normal, restaurando stock y corrigiendo caja.
- Volver a revisar una pareja marcada como válida por error.

La revisión guarda fecha y responsable. Los tickets anulados dejan de generar alertas de duplicación, pero permanecen visibles para auditoría.

### 4.9 Compras y proveedores

#### Compras y pedidos

Permite:

- Buscar productos del stock.
- Agregar productos a una lista de compra.
- Crear ítems genéricos que todavía no están en Stock.
- Recibir sugerencias de reposición según stock, vitrina y ventas recientes.
- Elegir proveedor.
- Definir cantidad y costo esperado.
- Generar pedidos agrupados por proveedor.
- Marcar pedidos realizados.
- Modificar cantidad y costo al recibir.
- Confirmar la recepción y aumentar el depósito.
- Conservar historial.
- Copiar el pedido para compartirlo.

#### Proveedores

Permite:

- Crear y editar proveedores.
- Guardar contacto y datos útiles.
- Asignar productos al proveedor.
- Ver productos relacionados e historial.
- Usar la asociación para preparar pedidos.

#### Lista y recordatorios

Permite organizar pendientes de compra y recordatorios con fecha y hora.

### 4.10 Gastos

Permite:

- Registrar descripción, categoría, importe, fecha y medio de pago.
- Marcar un gasto como pagado o pendiente.
- Marcarlo como recurrente.
- Filtrar y revisar historial.

Un gasto recurrente identifica un pago que suele repetirse, por ejemplo alquiler o un servicio. Sirve para reconocerlo y darle seguimiento; no significa que la aplicación lo descuente automáticamente de la caja.

Los gastos afectan el cálculo de ganancia real en Reportes, pero no modifican automáticamente el saldo físico de caja. Esto evita mezclar rentabilidad con efectivo disponible.

### 4.11 Clientes y fiado

Permite:

- Crear clientes.
- Guardar contacto y notas.
- Registrar ventas en cuenta corriente.
- Consultar saldo y movimientos.
- Registrar pagos parciales o totales.
- Gestionar envases o productos retornables.

### 4.12 Reportes

Incluye filtros por período e indicadores como:

- Ventas.
- Costos.
- Ganancia.
- Gastos.
- Resultado real.
- Rentabilidad por categoría.
- Ranking de productos.
- Productos sin movimiento.
- Rendimiento por persona cuando hay empleados.
- Tickets recientes.
- Posibles tickets duplicados.

Las secciones aparecen como tarjetas desplegables y pueden resaltar cuando contienen algo que revisar.

### 4.13 Gestión y herramientas

Incluye:

- Tareas y metas.
- Promociones por porcentaje, cantidad, 2x1/3x2 o combo.
- Buscador de productos para crear promociones.
- Diseñador de etiquetas.
- Comprobantes comerciales internos.
- Diseño del ticket.

#### Etiquetas

El diseñador permite:

- Elegir datos visibles.
- Incluir código de barras.
- Cambiar colores.
- Cambiar tamaño de cada texto.
- Ajustar el diseño y la ubicación de elementos.
- Ver una vista previa editable antes de imprimir.

#### Comprobantes comerciales internos

Los comprobantes:

- Tienen numeración.
- Guardan datos de emisor y receptor.
- Se relacionan con una venta.
- Validan campos como CUIT.
- Conservan historial.
- Pueden abrir una vista previa y prepararse para imprimir o enviar por correo.

**No son facturas fiscales oficiales.** Se identifican como `NO FISCAL - SIN CAE`, no se comunican con ARCA y no deben publicitarse como Factura A, B o C autorizada.

### 4.14 Administración del negocio

Para dueños y usuarios autorizados:

- Crear, editar o quitar empleados.
- Asignar y modificar roles.
- Definir permisos.
- Revisar movimientos.
- Consultar auditoría.
- Ver quién hizo una operación.
- Corregir acciones según permisos y dejando motivo.

La auditoría debe registrar acciones relevantes como ventas, cambios de stock, ediciones de producto, movimientos de caja, anulaciones y cambios administrativos.

### 4.15 Administración de Kiosco+

La cuenta administradora de la aplicación no representa un negocio propio. Tiene un panel para:

- Ver cuentas y negocios.
- Aprobar cuentas.
- Bloquearlas.
- Editarlas o eliminarlas.
- Entrar a un negocio para asistirlo.
- Revisar problemas reportados.
- Marcar reportes como resueltos o reabrirlos.
- Ver capturas y datos técnicos adjuntos.
- Acceder a Configuración, servidor y sesión.

### 4.16 Reporte de problemas

El usuario puede:

- Describir qué estaba haciendo.
- Adjuntar manualmente una captura de pantalla.
- En escritorio compatible, intentar una captura desde la aplicación.
- Enviar pantalla, negocio, usuario y contexto técnico.

El administrador de Kiosco+ recibe el reporte y puede ver la captura, resolverlo, reabrirlo o eliminarlo.

## 5. Tutoriales interactivos

Kiosco+ incluye un centro de ayuda con recorridos guiados.

Cada recorrido:

- Oscurece el resto de la interfaz.
- Resalta el control real que se está explicando.
- Ubica una tarjeta a una distancia limpia del objetivo.
- Puede abrir y cerrar submenús o ventanas.
- Permite interactuar con botones y formularios de práctica.
- Usa copias temporales para no modificar datos reales.
- Puede mostrar historiales ficticios, siempre marcados como ejemplo.
- Guarda en la cuenta qué recorridos se completaron para no repetirlos en cada dispositivo.

Los recorridos importantes enseñan circuitos completos, por ejemplo:

- Crear un producto.
- Registrar pérdidas y conteos.
- Administrar vitrina.
- Abrir caja, vender y cobrar.
- Preparar y recibir una compra.
- Registrar gastos.
- Consultar reportes.
- Administrar empleados.
- Configurar la aplicación.

La ayuda puede abrirse otra vez desde el botón correspondiente y los tutoriales pueden restablecerse en Configuración.

## 6. Configuración

### Negocio

- Nombre visible.
- Imagen o logo del negocio.
- Trabajo solo o con empleados.

### Apariencia

- Identidad visual Kiosco+.
- Temas claros y oscuros.
- Colores personalizados.
- Tamaño general del texto.
- Vista previa.

La personalización sigue disponible durante el desarrollo, aunque la identidad oficial de Kiosco+ tiene prioridad.

### Interfaz

- Densidad.
- Forma de controles.
- Tamaño y comportamiento del menú.
- Columnas de Inicio.
- Ocultar valores sensibles.
- Restablecer tutoriales.

### Sonido y movimiento

- Nivel y velocidad de animaciones.
- Duración de confirmaciones.
- Sonidos y volumen.
- Sonido o vibración al escanear.

### Funcionamiento

- Alertas y valores predeterminados.
- Stock negativo.
- Categorías, unidades y reglas operativas.

### Impresión y cajón

- Preguntar, imprimir automáticamente o no imprimir después de cobrar.
- Papel de 58 u 80 mm.
- Nombre de impresora.
- Cajón registrador conectado a la impresora o en simulación.
- Apertura al cobrar en efectivo.
- Impresión del resumen diario.

### Seguridad y tickets

- Tiempo de inactividad.
- Duración máxima de la sesión.
- Ventana de tickets duplicados.
- Motivo para correcciones.
- Confirmación de acciones peligrosas.
- Numeración y prefijo de tickets.
- Redondeo.

### Nube y dispositivos

- Activar sincronización.
- Dirección del servidor.
- Identificador del dispositivo.
- Canal de actualizaciones.
- Comprobación de conexión.
- Inicio y cierre de sesión del servidor.

## 7. Funcionamiento local, sincronización y copias

Kiosco+ es **local-first**:

1. La operación se guarda primero en el dispositivo.
2. Si hay servidor configurado, se genera una operación de sincronización.
3. La operación queda en cola si no se puede enviar.
4. Cuando vuelve la conexión, se reintenta.

### Persistencia cloud con PostgreSQL/Supabase

Desde agosto de 2026, `server/cloud-server.mjs` selecciona automáticamente el almacenamiento:

- `DATABASE_URL` configurada: usa `server/postgres-store.mjs` y PostgreSQL.
- Sin `DATABASE_URL`: conserva el servidor JSON local anterior.

La primera migración usa un estado `jsonb` compatible con toda la app dentro del esquema privado `kiosco_private`. Cada escritura aumenta una revisión y mantiene una copia diaria con retención configurable. El importador `scripts/import-cloud-json-to-postgres.mjs` permite sembrar Supabase desde la base JSON existente sin reemplazar por accidente una base que ya contiene otros datos. La normalización por productos, ventas, caja y auditoría queda como segunda fase.

La computadora principal puede ejecutar un servidor central local en:

```text
http://127.0.0.1:8787
```

Los datos centrales de desarrollo se guardan en:

```text
cloud-dev-data/
├─ database.json
├─ catalogo/
│  └─ codigos-de-barras.json
├─ sistema/
│  ├─ cuentas.json
│  └─ dispositivos.json
├─ negocios/
│  └─ <tenantId>/
│     └─ datos.json
└─ backups/
   └─ AAAA-MM-DD/
      └─ database.json
```

Cada negocio conserva un dataset separado. El servidor usa operaciones incrementales, identificadores únicos y versiones para reducir duplicados y detectar conflictos.

El archivo `catalogo/codigos-de-barras.json` es global para la instalación local y contiene únicamente las fichas reutilizables de productos. Los datos comerciales sensibles continúan aislados dentro de la carpeta de cada negocio.

### Acceso remoto actual

- **Tailscale:** conecta dispositivos autorizados dentro de una red privada.
- **Cloudflare Quick Tunnel:** crea un enlace público temporal para demostraciones.

Estos métodos sirven para desarrollo y pruebas. No reemplazan todavía un alojamiento comercial permanente.

### Limitación de las copias actuales

Los backups se guardan en la misma computadora. Protegen ante errores de datos, pero no ante pérdida o rotura del disco completo. Antes de una distribución real debe existir una segunda copia cifrada fuera del equipo.

## 8. Identidad de marca

### Nombre

Siempre escribir **Kiosco+**.

No usar como nombre público:

- KioscoApp.
- Kiosco Plus.
- Kiosco App.

`KioscoApp` puede aparecer internamente en nombres históricos de archivos, claves o código, pero no en piezas públicas nuevas.

### Logotipos

- Logotipo completo: `Kiosco+`.
- Monograma: `K+`.
- El signo `+` debe aparecer inmediatamente junto a la letra anterior, no separado.

Archivos oficiales:

- `docs/marca/logos/kiosco-plus-logotipo-oficial-principal.svg`
- `docs/marca/logos/kiosco-plus-logotipo-oficial-claro.svg`
- `docs/marca/logos/kiosco-plus-monograma-maestro.svg`
- `docs/marca/logos/kiosco-plus-monograma-claro.svg`

### Paleta

| Uso | Color | Código |
| --- | --- | --- |
| Petróleo principal | Marca, fondos oscuros | `#1C4A44` |
| Mostaza | Acentos positivos y destacados | `#E3A23C` |
| Papel | Fondo claro | `#F6F1E7` |
| Tinta | Texto oscuro | `#2A241E` |
| Rojo sello | Alertas, contraste del `+` | `#B8412F` |

### Tipografías

- **Fraunces:** logotipo y títulos.
- **Space Grotesk:** interfaz, botones, descripciones y textos.
- **Space Mono:** precios, cantidades, tickets, códigos y datos.

No debe usarse Fraunces para todos los textos de la interfaz.

### Tono de comunicación

- Claro.
- Directo.
- Cercano.
- Rioplatense sin exagerar.
- Útil antes que grandilocuente.
- Orientado a problemas reales de un comercio chico.

Conviene usar verbos como:

- Sabé.
- Controlá.
- Registrá.
- Vendé.
- Reponé.
- Revisá.

Evitar promesas como:

- “Nunca más vas a perder plata”.
- “Control total garantizado”.
- “La mejor app del mercado”.
- “Facturación oficial”.
- “Funciona siempre desde cualquier lugar”.

## 9. Guía para contenidos de Instagram y TikTok

### 9.1 Mensaje principal

Kiosco+ reúne la operación diaria de un comercio de barrio en una herramienta simple: ventas, caja, stock, vitrina, compras, gastos, clientes y reportes.

### 9.2 Diferenciales comunicables

- Diseñada alrededor del funcionamiento real de un negocio chico.
- Stock separado entre depósito y vitrina.
- Venta rápida con buscador, favoritos y escáner.
- Familias y variantes para ordenar productos similares.
- Alertas que indican qué necesita atención.
- Compras conectadas con proveedores y recepción de mercadería.
- Trabajo solo o con empleados.
- Roles, permisos e historial de acciones.
- Tutoriales interactivos que enseñan dentro de la propia app.
- Interfaz adaptable a computadora y celular.
- Operación local-first.

### 9.3 Pilares de contenido

#### Problema y solución

Mostrar una situación cotidiana y cómo Kiosco+ la ordena.

Ejemplos:

- “¿No sabés cuánto quedó realmente en la heladera?”
- “¿Anotás los fiados en papeles distintos?”
- “¿Recién descubrís que un producto se terminó cuando te lo piden?”

#### Demostraciones

Grabar una acción completa:

- Escanear y cobrar.
- Crear un producto.
- Reponer vitrina.
- Preparar un pedido.
- Recibir mercadería.
- Cerrar caja.
- Consultar un cliente con saldo.

#### Educación para comerciantes

Explicar conceptos:

- Diferencia entre caja y ganancia.
- Por qué un gasto no debe alterar automáticamente la caja.
- Stock mínimo.
- Conteo físico.
- Vitrina y depósito.
- Costo, precio y margen.

#### Construcción del producto

Mostrar:

- Antes y después de una pantalla.
- Pruebas desde celular.
- Decisiones de diseño.
- Errores encontrados y cómo se resolvieron.
- Nuevas funciones en desarrollo.

#### Confianza y transparencia

Aclarar:

- Qué funciones ya están listas.
- Qué se encuentra en prueba.
- Qué falta antes de una versión comercial.
- Por qué los comprobantes actuales no son fiscales.

### 9.4 Estructura sugerida para un video corto

1. **Gancho de 1 a 3 segundos:** problema concreto.
2. **Demostración:** una sola función, sin recorrer toda la app.
3. **Resultado:** qué información queda guardada o qué tarea se simplifica.
4. **Cierre:** pregunta, invitación a seguir el desarrollo o pedido de opinión.

Ejemplo:

> “¿Tenés mercadería en depósito pero la heladera queda vacía? En Kiosco+ separás depósito y vitrina. Cuando la cantidad expuesta llega al mínimo, aparece una alerta y sabés exactamente qué reponer.”

### 9.5 Estructura sugerida para un carrusel

1. Problema.
2. Qué suele pasar en un comercio.
3. Función de Kiosco+.
4. Cómo se usa.
5. Qué dato queda registrado.
6. Cierre o pregunta.

### 9.6 Afirmaciones permitidas

- “Permite registrar ventas y controlar stock.”
- “Incluye lectura de códigos de barras.”
- “Se adapta a computadora y celular.”
- “Permite separar stock de depósito y vitrina.”
- “Incluye roles y permisos para negocios con empleados.”
- “Tiene tutoriales interactivos.”
- “Actualmente se encuentra en desarrollo y prueba.”

### 9.7 Afirmaciones que requieren aclaración

- **Nube:** decir “servidor local de prueba” o “bases preparadas para la nube”, no “nube comercial disponible”.
- **Celular:** decir “versión web adaptable o instalable como PWA”, no “app nativa de App Store”.
- **Facturas:** decir “comprobantes comerciales internos no fiscales”, no “facturación oficial”.
- **Códigos de barras:** decir “consulta varios catálogos”, no “reconoce cualquier producto”.
- **Backups:** decir “copias locales automáticas”, no “respaldo seguro en la nube”.
- **Acceso remoto:** decir “pruebas mediante Tailscale o enlaces temporales”, no “acceso público permanente”.

## 10. Arquitectura técnica

| Área | Tecnología |
| --- | --- |
| Interfaz | React |
| Construcción web | Vite |
| Estilos | Tailwind CSS y `src/styles.css` |
| Escritorio | Electron |
| Iconos | Lucide React |
| Códigos de barras | ZXing Browser y apoyo EAN-13 propio |
| Persistencia local | abstracción en `src/shared/storage.js` |
| Servidor central local | Node.js con módulo HTTP nativo |
| Base central de desarrollo | JSON dentro de `cloud-dev-data` |
| Móvil actual | PWA responsive; base inicial de Capacitor |
| Pruebas | scripts de Node, vistas y reglas funcionales |

### Estructura principal

```text
kiosco app/
├─ desktop/               Electron, splash e iconos
├─ docs/                  Marca y arquitectura
├─ public/                PWA, service worker y logos públicos
├─ scripts/               Inicio, pruebas y acceso remoto
├─ server/                Servidor central y esquema SQL futuro
├─ src/
│  ├─ app/                Coordinación, cuentas y datos
│  ├─ assets/             Recursos visuales
│  ├─ cloud/              Repositorio y sincronización
│  ├─ features/           Funciones separadas por área
│  ├─ security/           Sesiones y autenticación
│  ├─ shared/             Controles, escáner y utilidades
│  └─ updates/            Base de actualizaciones
├─ cloud-dev-data/        Datos centrales locales
└─ package.json
```

`src/app/KioscoApp.jsx` coordina sesión, negocio activo, datos, navegación, guardado, escáner global, Configuración y tutoriales.

Las funciones viven en carpetas separadas:

| Carpeta | Responsabilidad |
| --- | --- |
| `features/autenticacion` | Ingreso y registro |
| `features/inicio` | Panel y reporte de problemas |
| `features/notificaciones` | Alertas |
| `features/stock` | Productos, conteo, importación y precios |
| `features/vencimientos` | Pérdidas y vencimientos |
| `features/vitrina` | Exhibición y reposición |
| `features/ventas` | Caja, carrito, cobro y herramientas |
| `features/compras` | Lista, pedidos y recepción |
| `features/proveedores` | Proveedores |
| `features/gastos` | Gastos |
| `features/clientes` | Clientes, fiado y retornables |
| `features/reportes` | Métricas y revisión |
| `features/gestion` | Promociones, etiquetas y comprobantes |
| `features/administracion` | Roles, auditoría y panel general |

## 11. Datos y seguridad

Cada negocio tiene un dataset independiente con secciones como:

- `products`
- `caja`
- `tickets`
- `clientes`
- `comprasItems`
- `proveedores`
- `perdidas`
- `gastos`
- `auditoria`
- `inventarios`
- `promociones`
- `presupuestos`
- `comprobantes`
- `autoconsumos`
- `turnos`

La seguridad actual incluye:

- Migración de contraseñas protegidas.
- Control de intentos fallidos.
- Bloqueo temporal.
- Sesiones con vencimiento.
- Roles y permisos.
- Separación por `tenantId`.
- Contraseñas derivadas con `scrypt` en el servidor local.
- Access token y refresh token.
- Identificación y revocación de dispositivos.
- Conflictos por versión.

Antes de un lanzamiento comercial debe realizarse una auditoría de seguridad independiente.

## 12. Ejecución para desarrollo

```powershell
pnpm dev
```

Inicia el entorno completo.

```powershell
pnpm dev:web
```

Inicia sólo la versión web.

```powershell
pnpm desktop
```

Abre Electron.

```powershell
pnpm cloud:dev
```

Inicia el servidor central local.

Accesos para uso no técnico:

- `INICIAR-NUBE-LOCAL.cmd`
- `Abrir-App-en-Celular.cmd`
- `Abrir-App-en-iPhone.cmd`
- `ABRIR-ACCESO-REMOTO.cmd`
- `CONFIGURAR-TAILSCALE-HTTPS.cmd`
- `ABRIR-TUNEL-PUBLICO.cmd`

Ejecutable de desarrollo reutilizable:

```text
dev-launcher/KioscoPlus-Desarrollo.exe
```

Ese mismo lanzador abre el código actual del proyecto; no hace falta generar un ejecutable nuevo después de cada cambio de desarrollo.

## 13. Pruebas y control de calidad

Comandos:

```powershell
pnpm test:tutorials
pnpm test:views
pnpm test:functions
pnpm test:cloud
pnpm build
```

Las pruebas cubren:

- Objetivos de tutorial.
- Renderizado de pantallas.
- Reglas funcionales.
- Integración con la nube local.
- Compilación de producción.

Las pruebas de vistas detectan pantallas que no renderizan, pero no reemplazan una prueba manual completa en computadora y celular.

## 14. Limitaciones antes de producción

Antes de vender o distribuir Kiosco+ como servicio terminado:

- Migrar la base central a PostgreSQL.
- Alojar el servidor detrás de HTTPS.
- Separar desarrollo, pruebas y producción.
- Guardar secretos fuera del código.
- Añadir monitoreo y alertas.
- Crear backups externos cifrados y probar restauraciones.
- Versionar migraciones de datos.
- Auditar permisos y operaciones administrativas.
- Firmar ejecutables y actualizaciones.
- Completar pruebas automáticas en navegadores y dispositivos reales.
- Definir soporte, privacidad y condiciones de uso.
- Integrar ARCA únicamente si se decide ofrecer facturación fiscal.

## 15. Problemas frecuentes

### Un cambio no aparece en otro dispositivo

Comprobar:

- Misma dirección de servidor.
- Sesión del servidor iniciada.
- Sincronización activada.
- Mismo `tenantId`.
- Servidor local encendido.
- Ausencia de conflicto pendiente.

### El túnel devuelve 502

El enlace existe, pero no encuentra la aplicación local. Debe mantenerse encendido el servidor web al que apunta.

### La cámara no lee un código

Mejorar iluminación, evitar reflejos, mover el código lentamente y comprobar que el formato sea compatible.

### Un código no encuentra el producto

El producto puede no estar publicado todavía en los catálogos externos ni en el catálogo compartido. Se puede crear manualmente y confirmar su código: al sincronizarse, el servidor aprende la ficha para futuras búsquedas sin compartir precios ni stock.

### Aparece una pantalla de recuperación

La sección produjo un error, pero la aplicación principal sigue funcionando. Volver a Inicio y enviar un reporte con descripción y captura.

## 16. Reglas para mantener este documento

Actualizar este archivo cuando:

- Se agregue o elimine una función visible.
- Cambie el nombre, marca o público.
- Una función pase de prueba a producción.
- Cambie la arquitectura de datos.
- Se agregue una plataforma.
- Se integre un servicio externo.
- Cambien afirmaciones que pueden hacerse en publicaciones.

Principios:

1. No presentar una simulación como función oficial.
2. No llamar nube a un servidor local sin aclararlo.
3. No llamar factura fiscal a un comprobante sin CAE.
4. No prometer cobertura universal de códigos de barras.
5. Diferenciar función implementada, base de prueba e idea futura.
6. Conservar compatibilidad con datos anteriores.
7. No borrar historial para corregir operaciones.
8. Mantener cada negocio aislado.
9. Priorizar una interfaz entendible para comercios chicos.

## 17. Documentos relacionados

- `docs/marca/manual-marca-kiosco-plus-v2.html`: manual de identidad vigente.
- `docs/CLOUD-ARCHITECTURE.md`: arquitectura de migración a nube.
- `server/sql/001_initial.sql`: esquema inicial para PostgreSQL.
- `DOCUMENTACION_KIOSCOAPP.md`: documentación histórica heredada.
- `DOCUMENTACION_KIOSCOAPP.docx`: contexto histórico del desarrollo anterior; no es el estado actual.

---

### Nota para Claude u otra IA

Al crear contenido sobre Kiosco+:

1. Usar este archivo como fuente funcional principal.
2. Usar el manual de marca para decisiones visuales.
3. Preguntar si una afirmación no aparece documentada.
4. No convertir planes en funciones disponibles.
5. Mantener el nombre escrito como `Kiosco+`.
6. Priorizar una función por publicación.
7. Explicar beneficios concretos sin ocultar el estado de desarrollo.
