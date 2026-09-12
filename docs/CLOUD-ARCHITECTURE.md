# Nube de Kiosco+ — generación 2

## Objetivo

La aplicación sigue siendo *local-first*: primero guarda en el dispositivo y después sincroniza. La API HTTPS conserva el mismo contrato utilizado por las pantallas, pero la persistencia de producción ya no reescribe un único documento JSON con toda la aplicación.

## Persistencia en Supabase

Con `DATABASE_URL`, Render utiliza `kiosco_private.cloud_records_v2`. Cada fila tiene un alcance y una clave. Los alcances actuales son:

- `tenant`: valores generales independientes por negocio.
- `tenant_entity`: un registro por producto, venta u otra entidad sincronizable.
- `tenant_section`: un registro por cada sección restante del negocio.
- `account`: una cuenta comercial independiente por negocio.
- `user` y `session`: usuarios y sesiones separados.
- `device`, `activation` y `activation_code`: licencias y equipos separados.
- `change` y `accepted`: historial incremental e idempotencia por operación.
- `catalog`: un registro por código de barras.
- `platform_notification` y `notification_read`: avisos persistentes y recibos de lectura por usuario.
- `push_subscription`: dispositivos que autorizaron avisos Web Push; guarda el endpoint del navegador, no la clave privada VAPID.
- `reported_issue`: problemas enviados por los negocios al administrador.
- `payment_integration`, `payment_oauth_state` y `payment_attempt`: configuración cifrada y operaciones preparadas para cobros.
- `security_event`: intentos autorizados o rechazados que necesitan trazabilidad de seguridad.
- `system`: configuración administrativa que no pertenece a una cuenta.
- `meta`: versión del esquema y cursor de sincronización.

El servidor carga esos registros una vez al iniciar y mantiene una copia rápida en memoria. Cada petición persiste sólo las filas modificadas. Una venta no vuelve a escribir el negocio completo, los demás negocios, las sesiones, las claves ni todo el historial.

La API continúa procesando mutaciones en orden dentro de una única instancia de Render. No se debe aumentar a más de una instancia sin agregar coordinación distribuida.

## Corte limpio desde la generación anterior

La tabla nueva se crea automáticamente durante el primer despliegue. Si existe `kiosco_private.cloud_state`, solamente se intenta conservar la activación vigente de dispositivos administradores. No se importan negocios, usuarios comerciales, sesiones ni movimientos anteriores.

Esto es deliberado para la versión `0.2.0`: los datos existentes eran ficticios y la prioridad es comenzar con una base coherente.

No hace falta eliminar las tablas viejas. Se conservan como referencia hasta comprobar el funcionamiento de la generación 2.

## Copias de seguridad

Antes de modificar una fila por primera vez cada día, el servidor guarda su valor anterior en `kiosco_private.daily_record_backups_v2`. Los respaldos son por registro y se conservan 14 días por defecto.

La retención se configura mediante `KIOSCO_BACKUP_RETENTION_DAYS`, entre 1 y 90 días.

Antes de una restauración solicitada por el dueño se guarda además un punto de recuperación completo en `kiosco_private.manual_recovery_points_v2`. La restauración reemplaza únicamente los datos operativos del negocio elegido: no modifica credenciales, sesiones, dispositivos, estado del abono ni otros negocios.

## Autenticación y activaciones

- La cuenta central se define sólo en Render mediante `KIOSCO_SUPERADMIN_USERNAME` y `KIOSCO_SUPERADMIN_PASSWORD`.
- Un dispositivo comercial usa una clave `KIOSCO-...` generada por el administrador para instalar la app de escritorio o crear un negocio nuevo desde la web.
- Un dispositivo administrador que perdió su activación puede elegir **Este es mi dispositivo administrador** e ingresar la clave privada de Render.
- Los clientes no reciben secretos de Supabase ni de Render dentro del instalador.
- Una lista vacía enviada por una versión vieja no puede borrar el padrón de negocios.

## Diagnóstico

- `/v1/health`: confirma que Node/Render está funcionando y debe informar `schemaVersion: 8`.
- `/v1/ready`: comprueba PostgreSQL y debe informar `storageGeneration: 2` y `payloadType: "records"`.
- `/v1/ready/sections`: muestra cantidad y tamaño de registros por alcance sin exponer su contenido.

La URI `DATABASE_URL` contiene una contraseña. Nunca debe guardarse en Git, pegarse en el frontend ni incorporarse al instalador.

## Avisos y referidos

Los avisos importantes se guardan primero en PostgreSQL y luego se intenta enviarlos mediante Web Push. Una falla del proveedor push no elimina el mensaje: sigue disponible en el Centro de notificaciones. Las claves VAPID viven sólo en Render y se configuran según `docs/CONFIGURAR_NOTIFICACIONES_PUSH.md`.

Un referido cuenta 20% únicamente mientras su abono está vigente hasta el final del día en Argentina. Al vencer queda `pausado`; al renovar vuelve a `activo`. Los descuentos manuales tienen motivo, vigencia y revocación separados de los referidos para conservar una auditoría clara.

## Publicación

1. Subir el código de la versión preparada a `main`.
2. Esperar que Render termine de desplegar y comprobar `/v1/ready`.
3. Crear la etiqueta y release que coincida exactamente con `package.json`.
4. Esperar que la acción de Windows publique `KioscoPlus-Setup.exe`, `latest.yml` y el archivo `.blockmap`.
5. Probar una instalación administradora y una instalación comercial en equipos distintos antes de entregar el instalador.
