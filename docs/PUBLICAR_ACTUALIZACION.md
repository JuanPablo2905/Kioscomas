# Publicar una actualización de Kiosco+

El instalador y las actualizaciones se distribuyen mediante GitHub Releases. La página siempre descarga `KioscoPlus-Setup.exe` desde la versión más reciente.

## Primera publicación

1. Confirmar que el repositorio desde el que se sirven las versiones sea público. Una aplicación instalada no debe llevar un token privado de GitHub.
2. Guardar y subir todos los cambios de la versión.
3. En la página del repositorio, entrar a **Releases** y elegir **Draft a new release**.
4. En **Choose a tag**, escribir la versión indicada en `package.json`, elegir crear esa etiqueta desde `main` y usar el mismo número en el título. Por ejemplo: etiqueta `v0.1.7` y título `Kiosco+ 0.1.7`.
5. Publicar la versión. La acción **Publicar Kiosco+ para Windows** ejecutará las pruebas, creará el instalador y agregará los archivos de actualización automáticamente.
6. Entrar a **Actions** y esperar a que la acción termine en verde. A partir de ese momento funcionará el botón de descarga de la página.

Para la versión `0.1.7`, primero hay que esperar que Render termine de publicar el commit en verde y recién después crear la etiqueta. Así el servidor de activaciones estará disponible antes que el instalador nuevo.

## Versiones siguientes

1. Cambiar `version` en `package.json`, por ejemplo de `0.1.6` a `0.1.7`.
2. Hacer commit y push del cambio terminado.
3. Crear y subir la etiqueta con la misma versión, por ejemplo `v0.1.7`.
4. GitHub publicará el nuevo instalador. Las computadoras con Kiosco+ lo descargarán en segundo plano y lo instalarán al cerrar la aplicación.

No se debe reutilizar una etiqueta ni publicar dos contenidos distintos con el mismo número de versión.

## Autorizar una instalación nueva

1. Entrar con la cuenta personal administradora de Kiosco+.
2. En **Claves para instalar Kiosco+**, escribir para quién es la clave, elegir cuánto tiempo estará disponible y cuántas PC puede activar.
3. Presionar **Generar clave** y copiarla. La clave completa se muestra una sola vez.
4. La persona descarga el instalador desde la página, abre Kiosco+ y pega esa clave.

La clave queda asociada a la PC. Las actualizaciones no vuelven a pedirla. Desde el mismo panel se puede desactivar una clave que todavía no se usó o una PC ya activada. Este cambio se guarda dentro de la base existente de Supabase y no necesita ejecutar otro archivo SQL.

## Firma de Windows

Sin un certificado, Windows puede mostrar una advertencia de editor desconocido. Cuando exista un certificado de firma de código, cargarlo como secretos del repositorio:

- `WINDOWS_CERTIFICATE`: certificado PFX codificado en Base64.
- `WINDOWS_CERTIFICATE_PASSWORD`: contraseña del certificado.

El flujo ya está preparado para usar esos secretos sin guardar el certificado dentro del código.
