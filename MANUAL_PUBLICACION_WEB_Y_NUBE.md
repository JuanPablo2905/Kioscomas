# Manual de publicación web y nube para KioscoApp

## 1. Objetivo

Este documento sirve como guía de traspaso para continuar el proyecto en otro chat o con otro desarrollador.

El resultado buscado es tener:

1. Una página web pública de KioscoApp.
2. Un botón en esa página para descargar la aplicación de escritorio para Windows.
3. Una base de datos en la nube para la aplicación.
4. Inicio de sesión seguro para dueños y empleados.
5. Datos aislados por negocio.
6. Sincronización entre instalaciones de KioscoApp.
7. Funcionamiento local cuando se corta internet, con sincronización posterior.

## 2. Servicios elegidos

### Render

Se utilizará para publicar la página web.

- Plan inicial: Hobby / Free.
- Tipo de servicio: Static Site.
- Dirección inicial: una URL gratuita terminada en `.onrender.com`.
- Más adelante se podrá conectar un dominio propio, por ejemplo `kioscoapp.com.ar`.
- La publicación se hará desde un repositorio Git.

Página: https://render.com/

### Supabase

Se utilizará para la nube y el backend de KioscoApp.

- Base de datos PostgreSQL.
- Supabase Auth para usuarios y sesiones.
- Row Level Security para aislar cada negocio.
- Storage para archivos pequeños.
- Realtime si se necesita actualización inmediata entre equipos.
- Edge Functions para operaciones sensibles del servidor.

Plan inicial: Free.

Página: https://supabase.com/

### Repositorio Git

Render necesita normalmente un repositorio para realizar publicaciones automáticas. Se puede usar GitHub, GitLab o Bitbucket.

GitHub también puede utilizarse más adelante para distribuir las versiones de KioscoApp mediante Releases.

Página: https://github.com/

## 3. Arquitectura prevista

```text
Página pública
     │
     ▼
   Render
     │
     ├── Información de KioscoApp
     ├── Capturas y características
     ├── Contacto
     └── Botón para descargar el instalador


KioscoApp instalada en Windows
     │
     ▼
  Supabase
     ├── Autenticación
     ├── Negocios
     ├── Empleados y permisos
     ├── Productos y stock
     ├── Ventas y caja
     ├── Clientes y fiados
     ├── Compras y proveedores
     ├── Gastos
     ├── Auditoría
     └── Sincronización
```

Render publica la web. Supabase almacena y protege los datos. No es necesario contratar Vercel, Firebase u otro servidor si se mantiene esta combinación.

## 4. Límites iniciales importantes

Al momento de preparar este manual, el plan gratuito mostrado por Supabase incluye, entre otros límites:

- 500 MB de base de datos.
- 1 GB de almacenamiento de archivos.
- 5 GB de transferencia general.
- 5 GB de transferencia en caché.
- Hasta 50 MB por archivo subido.
- Pausa del proyecto después de una semana sin actividad.
- Sin backups automáticos incluidos.

Estos valores deben verificarse nuevamente en la página oficial antes de poner el sistema en producción:

https://supabase.com/pricing

El instalador portable de KioscoApp observado durante la revisión pesaba aproximadamente 41 MB. En este momento entra en el máximo gratuito de 50 MB por archivo de Supabase Storage, pero está cerca del límite.

Recomendación:

- Para una prueba inicial, el instalador puede estar en Supabase Storage.
- Para versiones públicas, conviene usar GitHub Releases.
- El botón de la web debe apuntar siempre a una URL de descarga controlada.

## 5. Advertencia sobre los planes gratuitos

Los planes gratuitos son adecuados para:

- Desarrollo.
- Demostraciones.
- Pruebas.
- Pilotos controlados.
- Primeros usuarios sin dependencia crítica.

No se debería depender solamente del plan gratuito cuando existan comercios reales trabajando todos los días, porque:

- El proyecto puede pausarse por inactividad.
- No hay garantía contractual de disponibilidad.
- No hay backups automáticos en el plan gratuito.
- Los límites de espacio y transferencia pueden agotarse.

Cuando existan clientes reales, se deberá evaluar el plan Pro de Supabase y una estrategia formal de backups.

## 6. Primera etapa: publicar la página en Render

### Requisitos

- Identificar la carpeta exacta de la página pública.
- Verificar que sea un proyecto separado o determinar si vive dentro de este repositorio.
- Confirmar que tenga su propio `package.json`.
- Ejecutar localmente el build antes de publicarlo.
- Subir el código a un repositorio Git.

### Configuración habitual para React con Vite

- Service Type: `Static Site`.
- Build Command: `pnpm build` o `npm run build`.
- Publish Directory: `dist`.

No copiar estos valores a ciegas. El siguiente chat debe inspeccionar el `package.json`, la configuración de Vite y la estructura real de la página.

### Pasos

1. Crear o elegir el repositorio.
2. Subir solamente archivos necesarios; no subir `node_modules`, secretos ni compilaciones viejas.
3. Crear un Static Site en Render.
4. Conectar el repositorio.
5. Elegir la rama de publicación.
6. Configurar el comando de build.
7. Configurar la carpeta `dist`.
8. Publicar.
9. Probar la web desde celular y computadora.
10. Configurar redirecciones de SPA si la web utiliza React Router.

### Validaciones mínimas

- La página carga por HTTPS.
- No hay pantalla blanca al recargar una ruta.
- Se ve correctamente en celular.
- Los botones funcionan.
- No se exponen claves privadas.
- El enlace de descarga funciona.
- El archivo descargado tiene la versión correcta.

## 7. Segunda etapa: crear Supabase

### Creación inicial

1. Crear una cuenta en Supabase.
2. Crear un proyecto.
3. Elegir una región razonablemente cercana a los usuarios.
4. Guardar la contraseña de la base de datos en un gestor seguro.
5. Copiar la URL del proyecto.
6. Copiar solamente la clave pública necesaria para el cliente.
7. No colocar jamás una `service_role` o clave secreta dentro de React o Electron.

### Variables previstas

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Los nombres exactos deben ajustarse al SDK vigente y a la estructura real del proyecto.

Reglas:

- El archivo `.env` no debe subirse al repositorio.
- Debe existir un `.env.example` sin valores secretos.
- Las claves de administración solamente pueden vivir en un entorno de servidor seguro.

## 8. Diseño recomendado de datos

Antes de crear tablas, el otro chat debe inspeccionar completamente:

- Estructura actual de cuentas.
- Dataset por negocio.
- Productos.
- Caja.
- Tickets.
- Clientes.
- Compras.
- Proveedores.
- Gastos.
- Vencimientos.
- Auditoría.
- Roles y permisos.
- Cualquier sistema local o de nube que ya se haya incorporado.

No se debe diseñar la base únicamente a partir de este manual.

### Tablas conceptuales

Como punto de partida:

```text
profiles
businesses
business_members
roles
role_permissions
products
inventory_movements
sales
sale_items
cash_sessions
cash_movements
customers
customer_account_movements
purchases
purchase_items
suppliers
expenses
expiration_batches
audit_events
sync_operations
app_releases
```

Todas las tablas que pertenezcan a un comercio deben incluir:

```text
business_id
created_at
updated_at
```

Los eventos auditables también deberían guardar:

```text
created_by
reason
previous_value
new_value
```

No todo debe guardarse como un JSON gigante. Los tickets, sus artículos y los movimientos de stock deben conservar relaciones y trazabilidad.

## 9. Autenticación

El login local actual no debe convertirse directamente en un login público sin revisar su seguridad.

Se recomienda:

- Supabase Auth para las credenciales.
- Una identidad de Auth por cada persona.
- Una tabla `profiles` vinculada con el usuario autenticado.
- Una tabla `business_members` para relacionar personas y negocios.
- Roles y permisos asociados a esa membresía.

No se deben guardar contraseñas en texto plano dentro de tablas propias.

El superadministrador de KioscoApp no debe identificarse mediante un valor manipulable desde el cliente. Sus privilegios deben validarse desde la base o desde funciones seguras.

## 10. Aislamiento obligatorio entre negocios

Esta es la parte más crítica.

Supabase debe tener Row Level Security habilitado en todas las tablas expuestas.

Una política conceptual debe permitir que una persona lea o modifique un registro solamente cuando:

1. Está autenticada.
2. Pertenece al negocio indicado en `business_id`.
3. Su rol posee el permiso necesario.

No alcanza con ocultar botones en React. Un usuario podría llamar directamente a la API si la base no tiene políticas.

### Pruebas obligatorias

Crear al menos:

- Negocio A.
- Negocio B.
- Dueño A.
- Empleado A.
- Dueño B.
- Superadministrador.

Verificar:

- Dueño A no puede leer datos de B.
- Dueño A no puede modificar datos de B.
- Empleado A no puede elevar sus permisos.
- Un usuario no autenticado no puede consultar datos privados.
- El superadministrador solamente accede mediante un mecanismo auditado.
- Ninguna clave secreta está incluida en el instalador.

## 11. Migración progresiva de KioscoApp

No conviene cambiar todos los módulos a la vez.

Orden recomendado:

1. Crear infraestructura y cliente de Supabase.
2. Migrar autenticación.
3. Migrar negocios, membresías, roles y permisos.
4. Migrar productos.
5. Migrar inventario y movimientos.
6. Migrar ventas y artículos de ventas.
7. Migrar caja y sesiones.
8. Migrar clientes y fiados.
9. Migrar compras y proveedores.
10. Migrar gastos y vencimientos.
11. Migrar auditoría.
12. Migrar reportes.
13. Agregar modo offline y sincronización.

Cada etapa debe incluir:

- Migración del modelo.
- Adaptación de lectura.
- Adaptación de escritura.
- Manejo de errores.
- Pruebas de aislamiento.
- Pruebas funcionales.
- Estrategia para datos locales existentes.

## 12. Estrategia offline

Un kiosco debe poder vender aunque se corte internet.

La aplicación de escritorio debería conservar:

- Base local o caché persistente.
- Cola de operaciones pendientes.
- Identificadores únicos generados localmente.
- Marca de fecha y versión de cada registro.
- Reintentos automáticos.
- Indicador visible del estado de sincronización.

Estados sugeridos:

```text
Sincronizado
Sin conexión
Cambios pendientes
Error de sincronización
Conflicto que requiere revisión
```

No se debe afirmar que la app funciona offline solamente porque muestra datos almacenados. También debe poder:

- Registrar ventas.
- Descontar stock.
- Abrir o cerrar caja según la política definida.
- Evitar duplicar operaciones al reconectar.
- Resolver conflictos.

Las operaciones monetarias deben ser idempotentes: repetir el envío no puede crear dos ventas o dos movimientos.

## 13. Descarga del instalador

La página pública tendrá un botón similar a:

```text
Descargar KioscoApp para Windows
```

Opciones:

### Supabase Storage

Útil para una prueba mientras el instalador sea menor al límite por archivo.

### GitHub Releases

Recomendado para versiones públicas:

- Historial de versiones.
- Notas de cada versión.
- Archivos separados por versión.
- Enlaces estables.

### Controles recomendados

- Mostrar número de versión.
- Mostrar fecha de publicación.
- Publicar hash SHA-256.
- Firmar digitalmente el ejecutable cuando el producto se comercialice.
- Evitar que el botón apunte accidentalmente a una compilación de desarrollo.
- Probar la descarga en una computadora limpia.

## 14. Actualizaciones de la aplicación

La descarga manual es suficiente al principio. Luego se puede implementar:

- Consulta de la última versión desde una tabla `app_releases`.
- Aviso dentro de KioscoApp.
- Descarga manual de la nueva versión.
- Actualizador automático cuando el empaquetado y la firma estén preparados.

No activar actualizaciones automáticas sin:

- HTTPS.
- Verificación de integridad.
- Versionado consistente.
- Firma de código.
- Posibilidad de volver a una versión anterior.

## 15. Backups

El plan gratuito de Supabase no debe considerarse un sistema de backup completo.

Durante las pruebas:

- Exportar periódicamente el esquema.
- Exportar los datos.
- Guardar copias fuera de Supabase.
- Probar restauraciones.

Cuando haya clientes reales:

- Usar backups automáticos del plan correspondiente o implementar una estrategia externa.
- Definir retención.
- Cifrar las copias.
- Documentar quién puede restaurar.
- Realizar simulacros de recuperación.

Un backup que nunca fue restaurado en una prueba no puede considerarse confiable.

## 16. Costos

Se puede comenzar con costo mensual de infraestructura cercano a cero:

- Render Hobby: página.
- Supabase Free: datos y autenticación.
- Repositorio gratuito.
- Subdominio gratuito de Render.

Posibles gastos posteriores:

- Dominio propio anual.
- Supabase Pro.
- Firma digital del ejecutable.
- Mayor almacenamiento o transferencia.
- Servicio de correo transaccional.
- Monitoreo y backups externos.

Los precios cambian. Confirmarlos siempre en las páginas oficiales.

## 17. Criterio para pasar a producción

No ofrecer la nube a comercios reales hasta cumplir:

- RLS habilitado y probado.
- Contraseñas gestionadas por Auth.
- Ningún secreto dentro del frontend.
- Backups y restauración probados.
- Sincronización sin duplicados.
- Manejo claro de caída de internet.
- Auditoría de acciones sensibles.
- Migración de datos probada.
- Política de privacidad y tratamiento de datos.
- Instalador probado en una computadora limpia.
- Plan de soporte y recuperación.

## 18. Plan de implementación recomendado

### Fase 1 — Web pública

- Inspeccionar la página existente.
- Corregir build.
- Crear repositorio.
- Publicar en Render.
- Agregar descarga temporal.

### Fase 2 — Base segura

- Crear proyecto Supabase.
- Diseñar esquema.
- Configurar Auth.
- Configurar RLS.
- Crear usuarios y negocios de prueba.

### Fase 3 — Primer módulo en nube

- Migrar productos y stock.
- Probar dos negocios.
- Mantener una forma segura de volver al almacenamiento local durante el desarrollo.

### Fase 4 — Operaciones comerciales

- Ventas.
- Caja.
- Clientes y fiado.
- Compras.
- Proveedores.
- Gastos.

### Fase 5 — Offline

- Cola local.
- Reintentos.
- Idempotencia.
- Conflictos.
- Indicador de sincronización.

### Fase 6 — Piloto

- Publicar instalador.
- Probar con un negocio controlado.
- Monitorear errores y crecimiento de datos.
- Corregir antes de incorporar más comercios.

## 19. Instrucción para el siguiente chat

Copiar este bloque junto con el archivo:

> Necesito continuar la publicación y migración a la nube de KioscoApp. La arquitectura elegida es Render para la página pública y Supabase para autenticación, PostgreSQL, Storage, Realtime y funciones de servidor. Leé primero `MANUAL_PUBLICACION_WEB_Y_NUBE.md`, inspeccioná el repositorio completo y verificá el estado real del proyecto antes de cambiar código. No asumas que la documentación histórica coincide con la implementación actual. Primero informame qué partes ya existen, qué falta y proponé un plan por etapas. No conectes datos reales ni desactives el almacenamiento actual hasta que estén implementadas y probadas las políticas RLS, la separación por negocio, los backups y la estrategia offline. Conservá los cambios existentes del repositorio y ejecutá las pruebas disponibles después de cada etapa.

## 20. Decisión final resumida

La combinación elegida es suficiente:

- Render: página pública.
- Supabase: nube de KioscoApp.
- Repositorio Git: publicación automática.
- Supabase Storage o GitHub Releases: descarga del instalador.

No hacen falta Firebase ni Vercel mientras se mantenga esta arquitectura.

