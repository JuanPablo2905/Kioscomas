# Firmar, notarizar y publicar Kiosco+ para Mac

> Estado: el proceso automático está preparado. Sin la membresía y los secretos de Apple el workflow todavía genera un DMG de prueba sin firma; no debe presentarse como instalador final confiable.

## Credenciales necesarias

Para distribuir fuera del Mac App Store hace falta:

1. Membresía activa de Apple Developer Program.
2. Certificado **Developer ID Application** exportado como `.p12`.
3. Contraseña del `.p12`.
4. Apple ID, contraseña específica de aplicación y Team ID para notarización.

Guardar en GitHub, dentro de **Settings > Secrets and variables > Actions**:

```text
MACOS_CERTIFICATE
MACOS_CERTIFICATE_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

`MACOS_CERTIFICATE` puede contener el `.p12` codificado en base64 o una referencia compatible con `CSC_LINK`. Nunca se debe guardar el certificado ni las contraseñas en el repositorio.

## Qué hace el workflow

- Windows, Mac Intel y Mac Apple Silicon empiezan después de una única tanda de pruebas.
- La versión de GitHub se crea primero como borrador.
- Si están los secretos, electron-builder firma, activa Hardened Runtime, notariza y adjunta el ticket de Apple.
- Si faltan, deja una advertencia visible y genera sólo un instalador técnico de prueba.
- El release deja de ser borrador recién cuando terminaron Windows y las dos arquitecturas de Mac.

## Verificación antes de publicar

En una Mac con las variables estándar `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID`:

```bash
pnpm run release:verify -- --mac-production
pnpm run desktop:build:mac
codesign --verify --deep --strict --verbose=2 "release/mac/Kiosco+.app"
spctl --assess --type execute --verbose=2 "release/mac/Kiosco+.app"
xcrun stapler validate "release/KioscoPlus-Mac-arm64.dmg"
```

## Fuentes oficiales

- Firma de macOS en electron-builder: https://www.electron.build/v26/docs/features/code-signing/code-signing-mac
- Notarización: https://www.electron.build/v26/docs/notarization
- Certificados de Developer ID: https://developer.apple.com/help/account/certificates/create-developer-id-certificates/

