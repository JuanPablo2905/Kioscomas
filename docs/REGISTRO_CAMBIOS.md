# Registro de cambios — Menú "Catálogo" de Kiosco+

Fecha: 03/08/2026

## Objetivo
- Agregar el menú "Catálogo" del escáner en Kiosco+.
- Arreglar el bug de productos verificados que no se detectan en la App local/escritorio.
- Dejar un registro revertible de todos los cambios.

## Cambios realizados

### 1. Fix de detección de productos (App local/escritorio y demo pública)
- `src/shared/productLookup.js`
  - `saveCache`: ya no sobrescribe un acierto (hit) con un miss posterior (antes un `null` tiraba el valor correcto guardado antes).
  - `lookupThroughKioscoServer`: ahora usa `VITE_PUBLIC_API_URL` como fallback aunque `config.enabled` sea falso (arregla la demo pública en Render, que no consultaba el catálogo del servidor).
  - Nueva exportación `rememberBarcode(code, product)` que escribe la ficha directamente en la caché local.
- `.env.public`: agregado `VITE_PUBLIC_API_URL=https://kiosco-plus-api.onrender.com`.

### 2. Servidor (`server/cloud-server.mjs`)
- `catalogStatus`: una entrada sin producto con `pendingVerification` ahora devuelve `"pending"`.
- `catalogAdminView`: agregado el campo `pendingVerification`.
- `POST /v1/admin/catalog/:codigo`: al guardar, limpia `current.pendingVerification`.
- Nuevo `GET /v1/catalog`: lista entradas con `product` o `pendingVerification`, ordenadas por `updatedAt` descendente (accesible con sesión de cualquier negocio).
- Nuevo `POST /v1/catalog/verify-pending`: registra `pendingVerification=true`, `pendingSince` y `pendingCount`.

### 3. Escáner global — flujo "Enviar a verificar"
- `src/shared/GlobalScanResult.jsx`: prop `onVerifyPending`, botón "Enviar a verificar" en el bloque `type==="unknown"`, estados `verifying`/`verifyResult`.
- `src/app/KioscoApp.jsx`: función `submitPendingVerification` (POST `/v1/catalog/verify-pending`) y cableado de `onVerifyPending` en el render de `GlobalScanResult`.

### 4. Nuevo menú "Catálogo"
- `src/features/catalogo/CatalogoView.jsx` (nuevo):
  - Listado unificado: stock local con código + `GET /v1/catalog`.
  - Tarjeta con imagen, nombre, variante, código y badges (En este negocio / Pendiente de verificar / No identificado / Solo en este negocio / En catálogo).
  - Filtros: Todos / En stock / Pendientes / Sin identificar + búsqueda.
  - Editor: crear nuevo producto → se guarda en el catálogo compartido (`POST /v1/admin/catalog/:codigo` con sesión superAdmin). Editar uno ya reconocido → además genera una sugerencia `actualizar_producto` hacia el stock del negocio.
  - "Agregar a este negocio" / "Actualizar negocio": aplica los datos del catálogo al stock local.
  - Si la sesión no es administradora, ofrece conectar la cuenta central (demo / 1234) y bloquea la edición.
- `src/app/KioscoApp.jsx`: `case "catalogo"` en `renderView` renderizando `CatalogoView`.
- `src/shared/domain.js`: entrada `catalogo` en `NAV_ITEMS` (icono `ScanBarcode`) y tarjeta en `HOME_CARDS`.
- `src/app/data.js`: permiso `catalogo` agregado a `PERMISOS_MENU` (consecuentemente en `PERMISOS_DUENO`).

### 5. Sugerencias de actualización desde el catálogo
- `src/features/administracion/AdministracionView.jsx`:
  - `resolverSugerencia`: nueva resolución para tipo `actualizar_producto` (funde los datos aprobados en el producto local por código).
  - El bloque de sugerencias pendientes ahora muestra también las de tipo `actualizar_producto`, se muestra sin depender de `hasEmployees`, y permite aprobar al Dueño o al administrador operando un negocio.

### 6. Panel administrativo de catálogos
- `src/features/administracion/BarcodeCatalogAdmin.jsx`: filtro "Pendientes" y badge "Pendiente de verificar" para entradas con `pendingVerification`.

## Verificación
- `pnpm build` (vite build): OK (2074 módulos).
- `pnpm test:cloud`: 33 pruebas superadas.
- Comprobación manual de endpoints nuevos: 11 comprobaciones superadas (GET /v1/catalog, POST /v1/catalog/verify-pending, publish limpia pending, escáner recibe producto).
- `pnpm test:views` (smoke-views): 21 vistas OK.
- `pnpm test:functions`: 76 pruebas funcionales superadas.

## Nota de entorno
- `node`/`pnpm` no están en el PATH de la máquina; se usó el ejecutable de Electron como runtime Node (`ELECTRON_RUN_AS_NODE=1 dev-launcher\KioscoApp-Desarrollo.exe`).
- La tienda virtual de dependencias en `%TEMP%\kiosco-plus-virtual-store` tenía extraída de forma incompleta la librería `@zxing/library@0.21.3` (faltaban `esm/browser/HTMLVisualMediaElement.*` y `esm/browser/DecodeContinuouslyCallback.*`). Se repusieron esos 4 archivos desde el paquete original para desbloquear el build.

## Cómo revertir
1. Quitar `src/features/catalogo/CatalogoView.jsx` y la entrada `catalogo` de `NAV_ITEMS` y `HOME_CARDS` (`src/shared/domain.js`) y de `PERMISOS_MENU` (`src/app/data.js`).
2. Quitar el `case "catalogo"` y el import de `CatalogoView` en `src/app/KioscoApp.jsx`, más `submitPendingVerification` y `onVerifyPending`.
3. En `server/cloud-server.mjs`: revertir `catalogStatus`, `catalogAdminView`, la limpieza de `pendingVerification` en el publish y quitar los endpoints `GET /v1/catalog` y `POST /v1/catalog/verify-pending`.
4. En `src/shared/productLookup.js`: restaurar `saveCache` sin la protección de hit, quitar el fallback de `VITE_PUBLIC_API_URL` y `rememberBarcode` (y su uso en `CatalogoView`).
5. En `GlobalScanResult.jsx`, `AdministracionView.jsx` y `BarcodeCatalogAdmin.jsx`: revertir los puntos 3, 5 y 6.
6. Quitar `VITE_PUBLIC_API_URL` de `.env.public`.

---

# DOCUMENTO DE ENTREGA (para retomar con otra IA)

Fecha: 03/08/2026. Proyecto: `C:\Users\juanp\OneDrive\Escritorio\kiosco app`.

## Estado real del proyecto
- NO se creó ningún ejecutable nuevo. Solo se regeneró el build web en `dist\`.
- El usuario usa `dev-launcher\KioscoPlus-Desarrollo.exe` (29/07), que **NO trae `dist` dentro de su `app.asar`**: siempre carga el `dist\index.html` del proyecto (`kiosco app\dist\index.html`) vía la lógica `externalCandidates` de `desktop/main.cjs`. Por lo tanto, los cambios de código entran en vigor con solo recompilar `dist` y reabrir la app.
- `release\KioscoApp-0.1.0-portable.exe` (17/07) es el portable viejo; también carga `dist` externo si se ejecuta dentro de la carpeta del proyecto. No se tocó.

## Inventario de archivos (todos con ruta absoluta)

### Creados
- `src\features\catalogo\CatalogoView.jsx` — vista del menú Catálogo (listado unificado, búsqueda, filtros, editor, "Agregar a este negocio"/"Actualizar negocio", bloqueo de edición sin sesión admin).
- `REGISTRO_CAMBIOS.md` — este documento.
- (Ayuda temporal, borrar/ignorar) `%TEMP%\opencode\asar-ls.cjs`, `asar-extract.cjs`, `asar-listing.txt` — herramientas para inspeccionar el asar.

### Modificados
- `src\shared\productLookup.js` — `saveCache` no sobrescribe acierto con miss; fallback `VITE_PUBLIC_API_URL` aunque `config.enabled` sea falso; exportado `rememberBarcode(code, product)`.
- `.env.public` — `VITE_PUBLIC_API_URL=https://kiosco-plus-api.onrender.com`.
- `server\cloud-server.mjs` — `catalogStatus` devuelve `"pending"`; `catalogAdminView` expone `pendingVerification`; publish limpia `pendingVerification`; nuevos `GET /v1/catalog` y `POST /v1/catalog/verify-pending`.
- `src\app\KioscoApp.jsx` — `case "catalogo"` en `renderView`; `submitPendingVerification` y `onVerifyPending` en `GlobalScanResult`.
- `src\shared\domain.js` — `catalogo` en `NAV_ITEMS` y `HOME_CARDS` (icono `ScanBarcode`).
- `src\app\data.js` — `catalogo` en `PERMISOS_MENU` (y por ende en `PERMISOS_DUENO`).
- `src\shared\GlobalScanResult.jsx` — prop `onVerifyPending`, botón "Enviar a verificar", estados `verifying`/`verifyResult`.
- `src\features\administracion\AdministracionView.jsx` — `resolverSugerencia` resuelve `actualizar_producto`; bloque de sugerencias pendientes independiente de `hasEmployees`, aprobable por Dueño/admin.
- `src\features\administracion\BarcodeCatalogAdmin.jsx` — filtro "Pendientes" y badge "Pendiente de verificar".

### Regenerados (no manuales)
- `dist\` — build web (vite build). Última compilación 04:12; `dist\index.html` referencia `assets\app-CapCslIe.js`, que contiene "Catálogo de Kiosco" y "Enviar a verificar".

## Entorno (IMPORTANTE para reproducir)
- `node`, `pnpm`, `git` NO están en el PATH de esta máquina.
- Para correr scripts Node se usa el binario de Electron como runtime:
  `$env:ELECTRON_RUN_AS_NODE="1"; & "C:\Users\juanp\OneDrive\Escritorio\kiosco app\dev-launcher\KioscoApp-Desarrollo.exe" <script>` (Node v24.18.0).
- Build web: `$env:ELECTRON_RUN_AS_NODE="1"; & "...\KioscoApp-Desarrollo.exe" "C:\Users\juanp\OneDrive\Escritorio\kiosco app\node_modules\vite\bin\vite.js" build`.
- La tienda virtual de dependencias (`%TEMP%\kiosco-plus-virtual-store`) tenía la librería `@zxing/library@0.21.3` extraída de forma incompleta: faltaban `esm\browser\DecodeContinuouslyCallback.js/.d.ts` y `esm\browser\HTMLVisualMediaElement.js/.d.ts`. Se repusieron desde el CDN para desbloquear el build.

## Verificación ejecutada (todo en verde)
- Build vite: OK (2074 módulos).
- `scripts\cloud-integration-tests.mjs`: 33 pruebas OK.
- Check manual endpoints nuevos: 11 OK.
- `scripts\smoke-views.mjs`: 21 vistas OK.
- `scripts\functional-tests.mjs`: 76 pruebas OK.

## Notas para quien retome
- El usuario no quedó conforme con la implementación del menú Catálogo; quiere rehacerla con otra IA partiendo de estos registros.
- El bug de detección de productos (caché de miss tapando aciertos y fallback de API pública) SÍ quedó arreglado y verificado; conviene conservar ese fix al rediseñar.
- Pendiente/no resuelto por deseo del usuario: reconstruir un ejecutable portable nuevo (`pnpm desktop:build` → electron-builder `--win portable`). El usuario trabaja sobre `dev-launcher\KioscoPlus-Desarrollo.exe` y no lo requiere.
