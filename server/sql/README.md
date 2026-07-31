# Migraciones PostgreSQL

Ejecutar los archivos por número dentro de una transacción. En producción, la API establece `app.business_id` por sesión y las políticas RLS comparan ese valor con `business_id`. Nunca se acepta el negocio enviado por el cliente sin validarlo contra la sesión.
