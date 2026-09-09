# Configurar avisos al celular

Kiosco+ guarda todos los avisos en su centro de notificaciones. Web Push agrega el aviso del sistema en celulares y computadoras que dieron permiso.

## 1. Generar las claves una sola vez

Desde la carpeta del proyecto ejecutar:

```text
pnpm run push:generate-keys
```

Copiar los tres valores mostrados. No guardar la clave privada en el repositorio ni compartirla por chat.

## 2. Configurar Render

En `kiosco-plus-api` > `Environment`, crear:

```text
KIOSCO_VAPID_PUBLIC_KEY=<clave pública generada>
KIOSCO_VAPID_PRIVATE_KEY=<clave privada generada>
KIOSCO_VAPID_SUBJECT=mailto:soporte@kioscomas.ar
```

Guardar y esperar que la API termine de desplegar. En `/v1/health` debe aparecer `"pushDeliveryConfigured": true`.

## 3. Autorizar el dispositivo

- En Android o computadora, abrir el Centro de notificaciones y tocar **Avisarme en este dispositivo**.
- En iPhone o iPad, primero agregar Kiosco+ a la pantalla de inicio desde Safari, abrirla desde ese icono y recién entonces tocar el botón.
- El permiso se solicita por dispositivo y por navegador.

Si el usuario no habilita el permiso, los mensajes igual quedan disponibles dentro de Kiosco+.
