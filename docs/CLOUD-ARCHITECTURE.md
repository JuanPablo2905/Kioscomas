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

## Autenticación y activaciones

- La cuenta central se define sólo en Render mediante `KIOSCO_SUPERADMIN_USERNAME` y `KIOSCO_SUPERADMIN_PASSWORD`.
- Un dispositivo comercial usa una clave `KIOSCO-...` generada por el administrador para instalar la app de escritorio o crear un negocio nuevo desde la web.
- Un dispositivo administrador que perdió su activación puede elegir **Este es mi dispositivo administrador** e ingresar la clave privada de Render.
- Los clientes no reciben secretos de Supabase ni de Render dentro del instalador.
- Una lista vacía enviada por una versión vieja no puede borrar el padrón de negocios.

## Diagnóstico

- `/v1/health`: confirma que Node/Render está funcionando y debe informar `schemaVersion: 4`.
- `/v1/ready`: comprueba PostgreSQL y debe informar `storageGeneration: 2` y `payloadType: "records"`.
- `/v1/ready/sections`: muestra cantidad y tamaño de registros por alcance sin exponer su contenido.

La URI `DATABASE_URL` contiene una contraseña. Nunca debe guardarse en Git, pegarse en el frontend ni incorporarse al instalador.

## Publicación

1. Subir el código de `0.2.0` a `main`.
2. Esperar que Render termine de desplegar y comprobar `/v1/ready`.
3. Crear la etiqueta y release `v0.2.0`.
4. Esperar que la acción de Windows publique `KioscoPlus-Setup.exe`, `latest.yml` y el archivo `.blockmap`.
5. Probar una instalación administradora y una instalación comercial en equipos distintos antes de entregar el instalador.
