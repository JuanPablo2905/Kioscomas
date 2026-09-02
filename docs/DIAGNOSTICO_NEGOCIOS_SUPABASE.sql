-- SOLO LECTURA: esta consulta no modifica ni elimina nada.
-- Muestra cuántos negocios hay en el estado actual y en cada respaldo diario.

SELECT
  'actual' AS origen,
  updated_at,
  revision,
  COALESCE(jsonb_array_length(payload #> '{system,cuentas}'), 0) AS cantidad_negocios
FROM kiosco_private.cloud_state
WHERE id = 'primary'

UNION ALL

SELECT
  'respaldo ' || backup_day::text AS origen,
  updated_at,
  revision,
  COALESCE(jsonb_array_length(payload #> '{system,cuentas}'), 0) AS cantidad_negocios
FROM kiosco_private.daily_backups

ORDER BY updated_at DESC;

-- Detalle de los negocios que todavía figuran en el estado actual.
SELECT
  cuenta ->> 'id' AS id,
  cuenta ->> 'nombreNegocio' AS negocio,
  cuenta ->> 'nombre' AS responsable,
  cuenta ->> 'usuario' AS usuario,
  cuenta ->> 'estado' AS estado
FROM kiosco_private.cloud_state
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(payload #> '{system,cuentas}', '[]'::jsonb)
) AS cuenta
WHERE id = 'primary'
ORDER BY negocio NULLS LAST, usuario NULLS LAST;

-- Historial de listas de negocios enviado por las aplicaciones.
-- Sirve para localizar una copia recuperable aunque el respaldo diario ya
-- haya sido actualizado después del problema.
SELECT
  cambio ->> 'serverAt' AS fecha,
  cambio ->> 'deviceId' AS equipo,
  COALESCE(jsonb_array_length(cambio -> 'value'), 0) AS cantidad_negocios
FROM kiosco_private.cloud_state
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(payload -> 'changes', '[]'::jsonb)
) AS cambio
WHERE id = 'primary'
  AND cambio ->> 'type' = 'system_set'
  AND cambio ->> 'key' = 'cuentas'
ORDER BY fecha DESC;
