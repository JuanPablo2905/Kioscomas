# Seguridad y respuesta ante incidentes

Este documento resume qué protege Kiosco+, qué puede ocurrir ante un acceso indebido y cómo responder. No reemplaza una auditoría externa ni las obligaciones legales aplicables.

## Datos y límites

- Cada petición autenticada se vincula con un negocio, un usuario y un dispositivo. El servidor vuelve a comprobar esos tres datos y los permisos vigentes antes de leer o modificar información.
- Las contraseñas se guardan derivadas con sal y las credenciales de Mercado Pago se cifran con una clave exclusiva del servidor. Los códigos de vinculación, recuperación y acceso se guardan mediante hash.
- Desde 0.2.26 los tokens de acceso nuevos tampoco se conservan en texto legible. Duran dos horas en producción; el token de renovación rota al utilizarse.
- Las pantallas remotas reciben solamente una copia saneada del contenido público. No reciben costos, credenciales, caja, clientes ni datos administrativos.
- Kiosco+ no guarda datos de tarjetas. Los cobros conectados deben completarse en la infraestructura del proveedor de pagos.

## Controles activos

- HTTPS obligatorio en producción, cabeceras contra interpretación de contenido y restricciones de origen web.
- Límite de tamaño para peticiones y límites de intentos en acceso, alta, recuperación y vinculación de dispositivos.
- Revocación de sesiones al bloquear una cuenta, retirar un empleado, cambiar permisos, recuperar una contraseña o desactivar un dispositivo.
- Separación por negocio en la base, registro de operaciones rechazadas y copias de recuperación antes de restaurar información.
- Secretos fuera del repositorio: las claves de PostgreSQL, correo, notificaciones, firma y Mercado Pago se configuran en el proveedor de infraestructura.

## Alcance posible de un ataque

1. **Cuenta de un comercio comprometida:** el atacante podría ver o modificar los datos permitidos para ese usuario hasta revocar su sesión. Se debe desactivar el dispositivo, cambiar la contraseña y revisar los eventos y movimientos.
2. **Cuenta administradora comprometida:** podría afectar altas, estados de cuenta y soporte. Se deben rotar inmediatamente sus credenciales, cerrar sesiones, revisar cambios y restaurar sólo cuando exista evidencia.
3. **Servidor o base comprometidos:** podría existir acceso a información de varios negocios. Se deben aislar los servicios, revocar tokens, rotar todos los secretos, preservar registros, evaluar el alcance y notificar a los afectados cuando corresponda.
4. **Proveedor externo comprometido:** el alcance depende de su función. Se debe revocar la credencial de ese proveedor, consultar sus registros y mantener deshabilitada la integración hasta confirmar la contención.
5. **Dispositivo físico perdido:** puede contener una copia operativa local. Se debe desautorizar desde la cuenta y cambiar credenciales si el equipo no tenía bloqueo o cifrado del sistema.

## Procedimiento inmediato

1. No borrar registros ni restaurar copias antes de conservar evidencia.
2. Anotar hora, usuario, negocio, dispositivo y acciones sospechosas.
3. Bloquear el acceso afectado y rotar los secretos relacionados, empezando por administrador, base, correo, push y pagos.
4. Determinar qué negocios, períodos y tipos de datos estuvieron expuestos o modificados.
5. Recuperar desde una copia verificada, controlar integridad y reabrir por etapas.
6. Comunicar el incidente con hechos confirmados, medidas tomadas y acciones que debe realizar cada cliente.

## Pendientes del titular antes de una expansión pública

- Activar segundo factor en GitHub, Render, Supabase, Resend, Mercado Pago, Apple, Microsoft y Google.
- Usar un gestor de contraseñas, cuentas separadas y el mínimo permiso necesario.
- Configurar alertas de acceso y consumo, revisar mensualmente sesiones y secretos, y ensayar recuperación trimestralmente.
- Contratar una revisión independiente de seguridad antes de procesar cobros conectados a gran escala.
