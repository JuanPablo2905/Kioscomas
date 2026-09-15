# Publicar Kiosco+ en Microsoft Store y Google Play

Repo: https://github.com/JuanPablo2905/Kioscomas
Sitio: kioscomas.ar (app en app.kioscomas.ar)

Estado de partida:
- Escritorio: ya empaquetado con **Electron**, instalador NSIS funcionando, distribuido hoy por **GitHub Releases** con auto-actualización vía `electron-updater` y sistema propio de claves de activación por dispositivo.
- Celular: solo existe la **web responsive**. Hay un `capacitor.config.json` en el repo, pero es un archivo suelto — Capacitor no está instalado como dependencia ni existe carpeta `android/` generada.
- `electron-builder` ya tiene target Mac (dmg/zip) configurado además de Windows (nsis).

Decisión: mantener el flujo de GitHub Releases + certificado OV **guardado para el futuro** (sin usarlo por ahora), y publicar mientras tanto en **Microsoft Store** (Windows) y **Google Play** (Android), que firman los paquetes sin costo de certificado propio.

---

## PARTE 1 — Microsoft Store (Windows)

### Administrativo (Microsoft)
- [ ] Crear cuenta de desarrollador **individual** en partner.microsoft.com/dashboard (gratis).
- [ ] Verificar identidad con documento oficial (DNI/pasaporte) + selfie.
- [ ] Reservar el nombre **"Kiosco+"** en el Partner Center.
- [ ] Completar la ficha del producto: descripción, categoría, capturas de pantalla, precio (o gratis con suscripción interna), política de privacidad (URL pública).
- [ ] Revisar las políticas actuales de Microsoft Store antes de enviar, por si hay restricciones específicas para apps de tipo punto de venta / manejo de datos comerciales.

### Técnico (código)
- [ ] **Agregar target `appx` a `electron-builder`** en `package.json` (hoy la sección `"win": { "target": ["nsis"] }` solo genera el instalador NSIS). Sumar `"appx"` como target adicional, sin sacar `"nsis"` (para no romper la build de GitHub Releases).
- [ ] **Completar identidad del paquete MSIX**: agregar el bloque `appx` en la config de `electron-builder` con el `identityName`, `publisher` y `publisherDisplayName` que asigna Microsoft al reservar el nombre en el Partner Center.
- [ ] **Generar los íconos en los tamaños que exige MSIX** (44x44, 150x150, 310x150, etc. — distintos de los que ya existen en `desktop/icon.ico` y `desktop/icon.png`, hay que revisar cuáles faltan).
- [ ] **Desactivar el auto-updater en la build de Store.** En `desktop/main.cjs`, la función `configureDesktopUpdater()` activa `electron-updater` cuando `app.isPackaged` es true. Agregar una condición para que, si la build es de tipo Store (por ejemplo detectando una variable de entorno `KIOSCO_BUILD_TARGET=store` seteada en el script de build), la función retorne temprano sin activar `desktopUpdater` — la Store no permite auto-actualización por fuera de su propio mecanismo.
- [ ] **Agregar un script de build específico** en `package.json` (ej. `"desktop:build:store": "vite build --mode cloud && electron-builder --win appx --publish never"`), separado de `desktop:build` (que sigue generando el NSIS para GitHub Releases).
- [ ] Revisar que el `appId` (`com.kioscoplus.desktop`) y el nombre del producto (`Kiosco+`) coincidan exactamente con lo declarado en el Partner Center.
- [ ] Generar el `.appx`/`.msix` localmente o vía GitHub Actions y verificarlo con `signtool` o herramientas de Windows App SDK antes de subir (opcional, para detectar errores antes de la certificación).

### Publicación
- [ ] Subir el `.appx` desde el Partner Center.
- [ ] Esperar la certificación (automática y a veces manual).
- [ ] Una vez aprobado, Microsoft firma el paquete y lo publica — no se necesita certificado propio.
- [ ] De ahí en más, las actualizaciones de esta build específica se suben al Partner Center (no por tags de Git, ese flujo queda reservado para la build de GitHub Releases).

---

## PARTE 2 — Google Play (Android)

### Administrativo (Google)
- [ ] Crear cuenta de desarrollador **Personal** en Google Play Console.
- [ ] Pagar la tarifa única de **$25 USD** (tarjeta de crédito/débito, no acepta prepagas).
- [ ] Verificar identidad con documento oficial.
- [ ] Planificar la **prueba cerrada obligatoria**: cuentas Personales nuevas necesitan al menos **12 testers durante 14 días continuos** antes de que Google habilite la publicación pública. Conviene arrancar esto con anticipación (por ejemplo, algunos de los kioscos/clientes potenciales como testers).
- [ ] Completar ficha de la app en Play Console: descripción, categoría, capturas, ícono, política de privacidad, clasificación de contenido, declaración de manejo de datos.

### Técnico (código)
- [ ] **Instalar Capacitor como dependencia** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) — hoy no está en `package.json`.
- [ ] **Generar el proyecto Android nativo** con `npx cap add android`, usando el `capacitor.config.json` ya existente en el repo como base (revisar que `webDir: "dist"` apunte al build correcto — probablemente haya que usar el build de modo `cloud` o uno específico para mobile, no el de `public`).
- [ ] Verificar que la app funcione correctamente dentro del WebView de Capacitor: revisar específicamente el lector de códigos de barra (`@zxing/browser`), las notificaciones push (`web-push`) y el modo offline, porque el comportamiento dentro de un WebView nativo puede diferir del navegador de escritorio/celular.
- [ ] Ajustar el manifest de Android (`AndroidManifest.xml`, generado por Capacitor) con permisos necesarios: cámara (para escaneo de código de barras), notificaciones, almacenamiento si aplica.
- [ ] Adaptar íconos y splash screen para Android (tamaños distintos a los de Electron/desktop).
- [ ] Revisar el sistema de activación por dispositivo: confirmar que funcione igual en la versión Android contra el backend (`server/cloud-server.mjs`) sin cambios adicionales.
- [ ] Generar el **Android App Bundle (AAB)** firmado (Google Play exige AAB, no APK, para publicaciones nuevas) usando Android Studio o Gradle desde el proyecto generado por Capacitor.
- [ ] Configurar **Play App Signing**: Google gestiona la firma final del paquete subido — no hay que comprar ni administrar un certificado propio, pero sí hay que subir una clave de firma de subida (upload key) que se genera localmente la primera vez.

### Publicación
- [ ] Subir el AAB firmado a Play Console.
- [ ] Completar el cuestionario de clasificación de contenido y declaración de privacidad.
- [ ] Arrancar la prueba cerrada de 12 testers / 14 días.
- [ ] Una vez cumplido el período de prueba, promover a producción.

---

## Notas generales
- Las firmas de Microsoft Store y Google Play son **independientes entre sí** y de la firma que necesitaría la descarga directa desde kioscomas.ar (esa sigue pendiente de un certificado OV, guardada para el futuro).
- macOS ya tiene target configurado en `electron-builder` (dmg/zip), pero no fue parte de este plan — evaluar aparte si se quiere publicar también ahí (Apple exige su propio proceso de firma y notarización, con cuenta de desarrollador de pago anual, ~$99 USD/año).
