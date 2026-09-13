# Publicar Kiosco+ en Google Play

> Estado: proyecto Android preparado. La publicación real queda pendiente de crear la cuenta de Google Play Console, la ficha y la clave de firma definitiva.

## Qué quedó listo

- El proyecto nativo está en `android/` y usa Capacitor.
- El identificador permanente es `com.kioscoapp.mobile`.
- El nombre visible es **Kiosco+**.
- `versionName` y `versionCode` se calculan desde la versión de `package.json`; no hay que cambiarlos a mano.
- La app declara Internet, cámara y notificaciones.
- El workflow **Preparar paquetes para tiendas** puede generar un `.aab` firmado sin guardar la clave dentro del repositorio.

## Preparar la computadora

1. Instalar Android Studio.
2. Desde Android Studio, instalar Android SDK 36 y JDK 21.
3. En la raíz del proyecto ejecutar:

```powershell
pnpm install
pnpm run mobile:assets
pnpm run mobile:android:sync
pnpm run mobile:android:open
```

`mobile:assets` regenera los iconos y las pantallas de inicio desde `desktop/icon.png`, centrando la marca sobre los fondos oficiales. El último comando abre el proyecto en Android Studio. Desde allí se puede probar en un teléfono conectado o un emulador.

## Crear una clave de publicación

La clave de carga debe crearse una sola vez, guardarse en al menos dos lugares seguros y nunca subirse a GitHub. Google Play App Signing puede custodiar la clave final de firma; Kiosco+ conserva una clave de carga para enviar versiones nuevas.

Variables usadas por el proyecto:

```text
ANDROID_KEYSTORE_PATH
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Para GitHub Actions se guarda además el archivo `.jks` codificado en base64 como el secreto `ANDROID_KEYSTORE_BASE64`. Los demás valores se guardan como secretos con los mismos nombres.

## Generar el Android App Bundle

Con JDK 21 disponible y las variables anteriores cargadas:

```powershell
pnpm run release:verify -- --google-play
pnpm run mobile:android:bundle
```

El archivo queda en:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

También se puede ir a **Actions > Preparar paquetes para tiendas > Run workflow**, elegir `google-play` y descargar el artefacto generado.

## Primera prueba recomendada

1. Crear la aplicación en Play Console con el identificador `com.kioscoapp.mobile`.
2. Completar acceso a la app, seguridad de datos, política de privacidad, clasificación y ficha.
3. Subir el `.aab` al canal de **prueba interna**, no a producción.
4. Instalarla desde el enlace de testers y comprobar alta, login, sincronización, cámara, notificaciones, modo sin conexión y actualización.
5. Mantener el mismo identificador y la misma clave de carga en todas las versiones futuras.

## Qué todavía depende del titular

- Alta y verificación de la cuenta de Play Console.
- Aceptación de acuerdos y pago de registro que Google muestre para el país de la cuenta.
- Creación y custodia de la clave de carga.
- Capturas, descripción, correo de soporte y URL pública de privacidad.
- Respuestas legales de **Seguridad de datos** según el funcionamiento definitivo.
- Envío manual a prueba interna, cerrada o producción.

## Fuentes oficiales

- Capacitor Android: https://capacitorjs.com/docs/android
- Flujo de desarrollo de Capacitor: https://capacitorjs.com/docs/basics/workflow
- Preparar una versión: https://developer.android.com/studio/publish/preparing
- Firmar una aplicación: https://developer.android.com/studio/publish/app-signing
- Subir a Play Console: https://support.google.com/googleplay/android-developer/answer/9859152
