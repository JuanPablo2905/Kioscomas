# Base de nube de KioscoApp

## Estado actual

La aplicación usa un repositorio híbrido *local-first*. Cada cambio se guarda primero en el dispositivo. Si la nube está habilitada, también se agrega a una cola persistente y se reintenta cuando vuelve la conexión.

La nube permanece desactivada hasta configurar una URL HTTPS. Ningún dato actual sale de la computadora.

## Contrato inicial del servidor

### `POST /v1/sync/push`

Recibe `{ "operations": [...] }`. Cada operación incluye `id`, `deviceId`, `createdAt`, `schemaVersion`, `type`, `key` y opcionalmente `value`.

Responde `{ "acceptedIds": ["..."] }`. El servidor debe hacer `id` único para que un reintento nunca duplique ventas o movimientos.

## Requisitos antes de producción

- PostgreSQL con `tenant_id` obligatorio en cada tabla operativa.
- Autenticación mediante tokens cortos y renovación segura.
- Autorización por rol del lado del servidor.
- HTTPS, rate limiting, auditoría y copias de seguridad.
- Conflictos resueltos por versión de registro, no reemplazando todo el negocio.
- Separar entornos de desarrollo, pruebas y producción.
- Migraciones versionadas y reversibles.

## Próxima etapa

Implementar el servidor de desarrollo, sincronización incremental de productos/proveedores y descarga de cambios remotos.

## Prueba local completa

1. Ejecutar `INICIAR-NUBE-LOCAL.cmd`.
2. Abrir Configurar → Nube y dispositivos.
3. Usar `http://127.0.0.1:8787` y Probar conexión.
4. Para ejecutar la batería del backend: `npm run test:cloud` (o el runtime Node incluido si npm no está disponible).

Productos y proveedores se sincronizan como operaciones por registro. Las ventas y caja siguen locales hasta completar el protocolo inmutable de movimientos.

## Actualizaciones

`GET /v1/releases/latest?channel=stable` entrega el manifiesto de versión. La descarga e instalación permanecerán deshabilitadas hasta contar con HTTPS, firma de código y verificación SHA-256. Habrá canales `stable` y `beta`.
