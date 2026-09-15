# Publicar Kiosco+ en Microsoft Store

> Estado: proyecto y workflow preparados. La generación real del paquete queda pendiente de copiar la identidad que Partner Center asigne al producto.

## Decisiones de publicación

- Kiosco+ se publicará como aplicación gratuita en Microsoft Store.
- La prueba y la suscripción de Kiosco+ se administrarán con el sistema propio del servicio.
- Microsoft Store instalará y actualizará el paquete de Store.
- El instalador NSIS de GitHub Releases seguirá existiendo como canal separado.
- La aplicación detecta cuando fue instalada desde Microsoft Store y desactiva `electron-updater` para no mezclar los dos canales.

## Paso 1 — Crear la cuenta y reservar el producto

1. Entrar en https://storedeveloper.microsoft.com/
2. Crear una cuenta de desarrollador de tipo **Empresa**. Microsoft incluye en esta categoría a desarrolladores independientes y freelancers que publican como parte de una actividad comercial o profesional; Kiosco+ cobrará una suscripción.
3. Iniciar sesión con una cuenta Microsoft personal o una cuenta Microsoft Entra admitida para Empresa.
4. Verificar la actividad mediante un número D-U-N-S o elegir **Cargar un documento empresarial**. El D-U-N-S acelera la verificación, pero se puede solicitar revisión manual con documentación oficial.
5. Para una persona humana inscripta, elegir **Documento fiscal** o la opción equivalente y cargar la constancia de inscripción de ARCA en PDF. El nombre legal, CUIT y domicilio deben coincidir exactamente con el formulario. Kiosco+ puede utilizarse como marca o nombre comercial, pero no debe reemplazar el nombre legal del titular.
6. Entrar en **Apps & games**.
7. Elegir **New product**.
8. Elegir una aplicación empaquetada de tipo **MSIX/PWA**.
9. Comprobar y reservar el nombre **Kiosco+**.

La reserva del nombre es importante porque crea la identidad oficial del producto. No se deben inventar manualmente los valores de identidad.

## Paso 2 — Copiar la identidad asignada por Microsoft

Dentro del producto reservado, abrir:

**Product management > Product identity**

Guardar exactamente estos valores:

- **Package/Identity/Name**: se utilizará como `MICROSOFT_STORE_IDENTITY_NAME`.
- **Package/Identity/Publisher**: se utilizará como `MICROSOFT_STORE_PUBLISHER`.
- **Publisher display name**: se utilizará como `MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME`.

No son contraseñas ni claves privadas, pero deben copiarse sin cambiar espacios, mayúsculas, signos ni el contenido del `CN=`. Si el `Publisher` del paquete no coincide exactamente, Partner Center rechazará la carga.

## Paso 3 — Generar los recursos visuales

Los recursos ya se generan desde el ícono oficial de Kiosco+ con:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-microsoft-store-assets.ps1
```

Se crean en `build/appx/`:

- `StoreLogo.png`
- `Square44x44Logo.png`
- `Square150x150Logo.png`
- `Wide310x150Logo.png`
- `LargeTile.png`
- `SmallTile.png`
- `SplashScreen.png`

## Paso 4 — Generar el paquete de Microsoft Store

Abrir PowerShell en la raíz del repositorio y establecer los tres valores copiados desde Partner Center:

```powershell
$env:MICROSOFT_STORE_IDENTITY_NAME = "VALOR_EXACTO_DE_PACKAGE_IDENTITY_NAME"
$env:MICROSOFT_STORE_PUBLISHER = "VALOR_EXACTO_DE_PACKAGE_IDENTITY_PUBLISHER"
$env:MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME = "VALOR_EXACTO_DEL_NOMBRE_DEL_PUBLICADOR"
pnpm run desktop:build:store
```

El resultado quedará en `release-store/` con un nombre parecido a:

```text
KioscoPlus-Store-0.2.30-x64.appx
```

El paquete se genera sin certificado comercial propio. Partner Center valida el paquete y Microsoft lo vuelve a firmar cuando supera la certificación.

Como alternativa, después de guardar los tres valores anteriores como secretos de GitHub, se puede ejecutar **Actions > Preparar paquetes para tiendas**, elegir `microsoft-store` y descargar el `.appx` sin compilarlo en la PC local.

## Paso 5 — Crear la presentación en Partner Center

Completar las secciones solicitadas:

- **Pricing and availability**: aplicación gratuita y países donde estará disponible.
- **Properties**: categoría de productividad o negocios y capacidades declaradas.
- **Age ratings**: cuestionario de clasificación.
- **Packages**: subir el archivo `.appx` de `release-store/`.
- **Store listings**: nombre, descripción, características, palabras clave, íconos y capturas.
- **Privacy policy URL**: URL pública de la política de privacidad de Kiosco+.
- **Support contact**: canal público de soporte.
- **Submission options**: notas para certificación y fecha de publicación.

## Pruebas imprescindibles antes de enviar

- [ ] Instalación limpia en Windows 10.
- [ ] Instalación limpia en Windows 11.
- [ ] Pantalla de activación de dispositivo.
- [ ] Inicio y cierre de sesión.
- [ ] Recuperación de contraseña.
- [ ] Sincronización con Render/Supabase.
- [ ] Funcionamiento de impresora y cajón, cuando haya hardware disponible.
- [ ] Lector de códigos de barras por teclado y cámara.
- [ ] Notificaciones de la aplicación.
- [ ] Visualización correcta de la versión instalada.
- [ ] Confirmar que la versión de Store no busca actualizaciones en GitHub.
- [ ] Desinstalar y volver a instalar sin pérdida inesperada de la cuenta remota.

## Actualizaciones posteriores

Para actualizar a los usuarios de Microsoft Store:

1. Incrementar la versión de `package.json`.
2. Ejecutar las pruebas.
3. Generar un paquete nuevo con `pnpm run desktop:build:store`.
4. Crear una nueva presentación del mismo producto en Partner Center.
5. Subir el paquete nuevo y enviarlo a certificación.

No se debe crear un producto nuevo para cada versión. El producto reservado y su identidad deben mantenerse.

## Fuentes técnicas

- Primer publicación de una aplicación Windows: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/publish-first-app
- Proceso de envío: https://learn.microsoft.com/en-us/windows/apps/publish/faq/submit-your-app
- Requisitos de paquetes MSIX/AppX: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements
- Carga de paquetes: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/upload-app-packages
- Detección de instalación MSIX en Electron: https://www.electronjs.org/docs/latest/api/process#processwindowsstore-readonly
- Configuración AppX de electron-builder: https://www.electron.build/appx/
