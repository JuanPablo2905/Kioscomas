# Configurar correos y recuperación de contraseña

Kiosco+ envía únicamente correos transaccionales: bienvenida, habilitación de cuenta, recuperación de contraseña y confirmación de cambio de contraseña. Nunca envía la contraseña actual ni la nueva.

## 1. Preparar Resend

1. Crear o abrir la cuenta de Resend.
2. En **Domains**, agregar un dominio o subdominio propio. Se recomienda `correo.kioscomas.ar` para separar la reputación del correo de la web principal.
3. Copiar en el proveedor DNS los registros SPF y DKIM mostrados por Resend.
4. Esperar que el dominio figure como **Verified**.
5. Crear una API key con permiso para enviar correos. Copiarla una sola vez y no guardarla en GitHub, Vite ni archivos públicos.

El remitente debe pertenecer exactamente al dominio verificado. Si se verifica `correo.kioscomas.ar`, un ejemplo válido es `Kiosco+ <notificaciones@correo.kioscomas.ar>`.

## 2. Variables privadas en Render

En el servicio `kiosco-plus-api`, abrir **Environment** y configurar:

```text
KIOSCO_RESEND_API_KEY=re_...
KIOSCO_EMAIL_FROM=Kiosco+ <notificaciones@correo.kioscomas.ar>
KIOSCO_EMAIL_REPLY_TO=kkioscomas@gmail.com
KIOSCO_PUBLIC_APP_URL=https://app.kioscomas.ar
KIOSCO_PASSWORD_RESET_MINUTES=30
KIOSCO_SUPERADMIN_EMAIL=correo-del-administrador
```

`KIOSCO_SUPERADMIN_EMAIL` es opcional, pero necesario si también se quiere recuperar automáticamente la cuenta administradora central. `KIOSCO_EMAIL_REPLY_TO` es la dirección que recibirá las respuestas de los clientes.

No crear variables que empiecen con `VITE_` para la API key. Todo valor `VITE_` puede terminar dentro de los archivos descargados por el navegador.

Después de guardar, volver a desplegar la API. En `https://kiosco-plus-api.onrender.com/v1/health` debe aparecer:

```json
"emailDeliveryConfigured": true
```

El valor sólo confirma que existen un remitente y una API key; la prueba final debe hacerse con una dirección real.

## 3. Cuentas anteriores

Las cuentas creadas antes de esta versión pueden no tener correo. Continúan iniciando sesión normalmente, pero la recuperación automática no funcionará hasta completar el dato.

1. Entrar al panel de administración de Kiosco+.
2. Buscar el negocio.
3. Presionar **Editar**.
4. Completar **Correo electrónico** y guardar.
5. Para empleados nuevos, cargar un correo diferente al crear cada usuario.

Un correo no debe pertenecer a dos usuarios. Si existen duplicados históricos, la API no enviará un enlace hasta corregirlos para evitar restablecer la cuenta equivocada.

## 4. Flujo que verá el cliente

1. En el inicio de sesión toca **Olvidé mi contraseña**.
2. Escribe el correo.
3. Kiosco+ muestra siempre la misma confirmación, exista o no la cuenta.
4. El correo contiene el botón **Crear una nueva contraseña**.
5. El enlace abre `app.kioscomas.ar` y permite escribir dos veces la contraseña nueva.
6. Al guardar, el enlace queda usado, la contraseña anterior deja de funcionar y se revocan las sesiones anteriores.
7. Kiosco+ envía una confirmación del cambio.

El enlace de recuperación puede abrirse antes de activar ese navegador. Para iniciar sesión desde un dispositivo nuevo sigue siendo necesaria la clave de activación correspondiente.

## 5. Protecciones incluidas

- Token aleatorio de alta entropía.
- Sólo se guarda SHA-256 del token; la base nunca conserva el enlace utilizable.
- Vencimiento configurable, 30 minutos por defecto.
- Un único uso.
- Una solicitud nueva invalida los enlaces anteriores del mismo usuario.
- Respuesta neutra para no revelar qué correos están registrados.
- Máximo de un envío cada 2 minutos por correo y 5 por hora.
- Máximo de 10 solicitudes cada 15 minutos por IP.
- Idempotencia en Resend para evitar correos duplicados durante reintentos.
- Escape de nombres y datos insertados en las plantillas HTML.
- Revocación de sesiones al cambiar la contraseña.

## 6. Prueba antes de publicar

1. Crear una cuenta con un correo al que se tenga acceso.
2. Confirmar que llegue el correo de bienvenida.
3. Aprobar la cuenta y confirmar que llegue el aviso de habilitación.
4. Cerrar sesión y usar **Olvidé mi contraseña**.
5. Abrir el enlace y guardar una contraseña de al menos 8 caracteres.
6. Confirmar que el mismo enlace ya no funcione.
7. Confirmar que la contraseña anterior sea rechazada y la nueva funcione.
8. Revisar en Resend los estados `Delivered`, `Bounced` o `Complained`.

Para publicar la aplicación web y la API basta con subir el commit y esperar Render. Sólo hace falta una GitHub Release si también se quiere distribuir el nuevo formulario en las aplicaciones de escritorio ya instaladas.
