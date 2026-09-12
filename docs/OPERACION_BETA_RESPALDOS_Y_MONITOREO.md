# Operación de la beta: respaldos, monitoreo y recuperación

## Qué queda automatizado

- Render ejecuta la API con el plan `starter`, para evitar el reposo de la instancia gratuita.
- GitHub Actions consulta cada 30 minutos la API, su conexión PostgreSQL y la aplicación web. Una ejecución fallida queda visible en **Actions > Monitorear producción** y utiliza las notificaciones configuradas en la cuenta de GitHub.
- PostgreSQL guarda, antes de cada cambio, la primera versión previa de cada registro modificada durante el día en `kiosco_private.daily_record_backups_v2`.
- Los respaldos diarios se conservan según `KIOSCO_BACKUP_RETENTION_DAYS` (actualmente 7 días).
- La batería local ejecuta un ensayo de serialización y restauración en seco con `pnpm run test:backup-restore`.

## Control semanal recomendado

1. Abrir `https://kiosco-plus-api.onrender.com/v1/ready` y comprobar `"ok": true`, `"persistence": "postgresql"` y una cantidad de registros mayor que cero.
2. En Supabase, ejecutar:

```sql
select backup_day, count(*) as registros, max(created_at) as ultima_copia
from kiosco_private.daily_record_backups_v2
group by backup_day
order by backup_day desc;
```

3. Abrir **GitHub > Actions > Monitorear producción** y revisar que las últimas ejecuciones estén verdes.
4. Ejecutar la batería completa antes de publicar una versión de escritorio.

## Si un cliente pierde o modifica datos por error

El dueño puede hacer una recuperación controlada desde **Configuración > Datos y seguridad > Archivo > Respaldo y recuperación**. El procedimiento recomendado es:

1. Anotar el negocio, la fecha aproximada y qué información falta.
2. Pedirle al comercio que deje de modificar esa sección hasta terminar el diagnóstico.
3. Descargar la copia completa actual y guardarla fuera de la app.
4. Elegir una fecha y usar **Comparar antes de recuperar** para revisar cuántos registros cambiarían por grupo.
5. Confirmar con el cliente que la fecha es correcta.
6. Escribir exactamente el nombre del negocio y recién entonces ejecutar la recuperación.

La tabla de respaldo es incremental: conserva el valor anterior de los registros que cambiaron ese día. El servidor reconstruye el estado por registros, crea primero un punto de recuperación manual y reemplaza sólo el espacio operativo de ese negocio. Usuarios, contraseñas, dispositivos y suscripción permanecen como están.

La exportación descargable omite hashes, sales y cualquier otra credencial. La recuperación exige una sesión de dueño o superadministrador; un empleado no puede ejecutarla aunque conozca la URL de la API.

## Límites conocidos de la beta

- El monitoreo comprueba disponibilidad, persistencia y la web, pero no simula una venta real.
- GitHub sólo avisa por los canales habilitados en la cuenta. Conviene activar notificaciones de fallos de Actions.
- Una caída de Supabase, Render, DNS o Internet puede afectar temporalmente la sincronización. La operación local sigue disponible después de un primer ingreso correcto.
