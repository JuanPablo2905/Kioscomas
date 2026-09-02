# Publicar una actualización de Kiosco+

El instalador y las actualizaciones se distribuyen mediante GitHub Releases. La página siempre descarga `KioscoPlus-Setup.exe` desde la versión más reciente.

## Primera publicación

1. Confirmar que el repositorio desde el que se sirven las versiones sea público. Una aplicación instalada no debe llevar un token privado de GitHub.
2. Guardar y subir todos los cambios de la versión.
3. En la página del repositorio, entrar a **Releases** y elegir **Draft a new release**.
4. En **Choose a tag**, escribir `v0.1.4`, elegir crear esa etiqueta desde `main` y usar como título `Kiosco+ 0.1.4`. La etiqueta debe coincidir exactamente con la versión de `package.json`.
5. Publicar la versión. La acción **Publicar Kiosco+ para Windows** ejecutará las pruebas, creará el instalador y agregará los archivos de actualización automáticamente.
6. Entrar a **Actions** y esperar a que la acción termine en verde. A partir de ese momento funcionará el botón de descarga de la página.

## Versiones siguientes

1. Cambiar `version` en `package.json`, por ejemplo de `0.1.4` a `0.1.5`.
2. Hacer commit y push del cambio terminado.
3. Crear y subir la etiqueta con la misma versión, por ejemplo `v0.1.5`.
4. GitHub publicará el nuevo instalador. Las computadoras con Kiosco+ lo descargarán en segundo plano y lo instalarán al cerrar la aplicación.

No se debe reutilizar una etiqueta ni publicar dos contenidos distintos con el mismo número de versión.

## Firma de Windows

Sin un certificado, Windows puede mostrar una advertencia de editor desconocido. Cuando exista un certificado de firma de código, cargarlo como secretos del repositorio:

- `WINDOWS_CERTIFICATE`: certificado PFX codificado en Base64.
- `WINDOWS_CERTIFICATE_PASSWORD`: contraseña del certificado.

El flujo ya está preparado para usar esos secretos sin guardar el certificado dentro del código.
