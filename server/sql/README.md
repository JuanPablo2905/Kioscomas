# Migraciones PostgreSQL

Ejecutar los archivos por número dentro de una transacción. En producción, la API establece `app.business_id` por sesión y las políticas RLS comparan ese valor con `business_id`. Nunca se acepta el negocio enviado por el cliente sin validarlo contra la sesión.

## Migración inicial de Supabase

La primera puesta en marcha usa `002_runtime_state.sql`. El servidor también crea estas tablas de forma idempotente al iniciar, pero conservar el archivo permite auditar y reproducir el esquema.

- `kiosco_private.cloud_state`: estado operativo persistente de la API actual.
- `kiosco_private.daily_backups`: una copia diaria con retención configurable (7 días por defecto).

El esquema es privado y no se expone mediante la Data API de Supabase. Sólo el backend de Render accede utilizando `DATABASE_URL`. El archivo `001_initial.sql` documenta la normalización futura por entidades; no debe ejecutarse todavía sobre datos reales porque la API actual conserva compatibilidad mediante el snapshot JSONB.
