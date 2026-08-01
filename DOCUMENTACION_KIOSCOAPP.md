# Actualización operativa — 31 de julio de 2026

> Este bloque describe el estado real actual. El documento histórico que sigue conserva el contexto de la etapa inicial en Claude y ya no representa la arquitectura vigente.

## Enlaces activos

- Aplicación web pública / demo: https://kiosco-plus.onrender.com
- API de sincronización: https://kiosco-plus-api.onrender.com
- Estado de la API: https://kiosco-plus-api.onrender.com/v1/health
- Repositorio: https://github.com/JuanPablo2905/Kioscomas
- Acceso privado por Tailscale: https://compu-juampa.tailfb630f.ts.net

## Estado real del proyecto

- La aplicación ya es un proyecto React/Vite organizado en carpetas, con versión web, Electron para Windows y adaptación móvil.
- La web pública está desplegada como sitio estático en Render y sigue disponible aunque la computadora de desarrollo esté apagada.
- La API Node está desplegada como Web Service gratuito en Render. El plan gratuito puede dormir por inactividad y la primera conexión puede demorar unos 50 segundos.
- Se comprobó una sincronización real entre iPhone y la aplicación de escritorio: un cambio hecho desde el teléfono apareció rápidamente en la computadora.
- El escritorio usa el ejecutable `dev-launcher/KioscoPlus-Desarrollo.exe`. El antiguo `KioscoApp-Desarrollo.exe` no debe usarse.
- La demo pública se activa sólo con `VITE_PUBLIC_DEMO=true`; la compilación normal de escritorio ya no queda atrapada en la cuenta demo.
- La compilación pública usa `dist-public-source` y no pisa la versión local de escritorio.

## Lo que falta antes de producción

1. Migrar la persistencia del servidor desde archivos JSON efímeros de Render a PostgreSQL administrado.
2. Crear migraciones, copias automáticas y un procedimiento de restauración probado.
3. Repetir pruebas de aislamiento entre negocios, reinicios, reconexión y cambios simultáneos con la base persistente.
4. Verificar qué sitio estático de Render es el vigente (`Kioscomas` o `kiosco-plus`) y eliminar el duplicado sin afectar la URL pública.
5. Confirmar y subir los últimos cambios locales pendientes al repositorio.
6. Recién después, habilitar el uso con datos reales de clientes.

---

# Documentación Técnica Completa — KioscoApp

**Versión del documento:** 1.0
**Fecha de generación:** 15 de julio de 2026
**Propósito:** Documento de transferencia de conocimiento para que cualquier desarrollador o cualquier otro asistente de IA pueda continuar el desarrollo de este proyecto sin haber participado en las conversaciones previas.

**Estado del archivo fuente en el momento de escribir este documento:** `KioscoApp.jsx`, componente único de React, ~5.845 líneas.

---

## Cómo leer este documento

Este documento describe un proyecto que **hoy vive como un único archivo de React (`KioscoApp.jsx`)** ejecutado dentro del entorno de artefactos de Claude.ai (Anthropic). Esto no es un accidente ni un descuido: es una decisión consciente explicada en la sección 15 (Decisiones técnicas). El proyecto **todavía no existe como un proyecto de carpetas real** (no hay `package.json`, no hay `src/`, no hay build real) — todo el código corre como un componente React que Claude.ai compila al vuelo para mostrar una vista previa interactiva en el chat.

Esto tiene consecuencias importantes que cualquier desarrollador que continúe el proyecto debe entender de entrada:

1. **No hay persistencia real fuera de Claude.ai.** El sistema usa una API llamada `window.storage` que sólo existe dentro del entorno de artefactos de Claude.ai. Fuera de ahí (por ejemplo, si el archivo se abre en un proyecto Vite normal en una compu), `window.storage` no existe y el código de persistencia fallará. Este es el punto más importante que hay que resolver antes de considerar el proyecto "listo" para un cliente real.
2. **No hay backend.** Todo el estado vive en memoria de React (`useState`) y se serializa a `window.storage` como JSON. No hay servidor, no hay base de datos real, no hay autenticación real (las contraseñas se comparan en texto plano en el cliente).
3. **Es un solo archivo a propósito**, mientras se itera rápido dentro del chat de Claude.ai (que sólo puede previsualizar artefactos de React de un solo archivo). La migración a una estructura de carpetas (`components/Stock/`, `components/Caja/`, etc.) está planeada pero **no iniciada**, y se decidió posponerla hasta el momento de migrar a un entorno de desarrollo local real (ver sección 15 y 24).

---

# 1. Objetivo del proyecto

## 1.1 Qué problema resuelve

KioscoApp es una aplicación de gestión integral para kioscos, almacenes y comercios minoristas pequeños en Argentina. El dueño del proyecto (en adelante "el usuario" o "Juan", que es además quien encarna el rol de "Dueño" en la propia aplicación) trabaja en un kiosco (Mostaza, cadena de comida rápida, en su empleo real, y desarrolla esta app como proyecto personal/comercial paralelo) y quiere resolver, con una sola herramienta, los problemas operativos típicos de un comercio de este tipo:

- No saber en tiempo real cuánto stock queda de cada producto, ni en el depósito ni en la vitrina/exhibición.
- No tener un registro confiable de qué se vendió, cuándo, a quién, y por qué medio de pago.
- No poder controlar la caja (cuánto dinero debería haber vs. cuánto hay realmente).
- No tener un sistema de fiado (venta a cuenta corriente) ordenado — hoy esto se maneja "de memoria" o en un cuaderno.
- No tener trazabilidad de quién hizo qué cambio en el sistema (importante en cuanto se suman empleados).
- No poder gestionar más de un local con visión consolidada para el dueño.

## 1.2 Público objetivo

- Dueños de kioscos, almacenes, minimarkets y comercios de cercanía en Argentina (el diseño y las etiquetas están en español rioplatense: "Fiado", "Vuelto", "Depósito", moneda en pesos argentinos con formato `es-AR`).
- Negocios chicos que hoy no usan ningún sistema de gestión, o usan cuadernos/Excel.
- Comercios con más de un empleado, donde hace falta control de permisos (el dueño no quiere que un cajero pueda, por ejemplo, borrar tickets de venta o cambiar precios sin dejar rastro).
- A futuro: dueños con más de un local, que quieran una vista consolidada.

## 1.3 Filosofía del proyecto

Estas son decisiones de filosofía de producto tomadas explícitamente durante el desarrollo (documentadas también en la bitácora de Notion del proyecto):

- **Terminar la funcionalidad completa antes de optimizar el código.** Se decidió explícitamente no modularizar ni refactorizar el código hasta tener una versión funcionalmente completa. Esto es intencional, no negligencia — ver sección 15.
- **Validar que la aplicación resuelva problemas reales de un kiosco antes que perseguir elegancia técnica.**
- **Offline-first como meta final** (aunque todavía no implementado de verdad — ver sección 11 y 16): la aplicación tiene que poder funcionar sin conexión a internet en la computadora del cliente final.
- **Cada funcionalidad nueva debe cumplir al menos una de estas condiciones** (regla explícita acordada durante el desarrollo):
  - Ahorrar tiempo.
  - Evitar pérdidas de dinero.
  - Automatizar tareas repetitivas.
  - Reducir errores humanos.
- **Nada se cambia "en silencio".** Esta es una decisión de diseño central y reciente: cualquier corrección (a un movimiento de caja, a un producto) debe pedir un motivo, y debe quedar registrado quién la hizo, cuándo, y cuál era el valor antes y después. La razón explícita, dicha por el usuario, es que "nadie pueda decir que le cambiaste algo sin avisar".
- **Jerarquía de confianza clara:** el usuario (Juan) es el **Administrador de la aplicación completa** (super-admin, ve todos los negocios de todos los dueños, con fines de soporte/pruebas). Por debajo de él están los **Dueños** de cada negocio individual (cada uno ve sólo el suyo). Por debajo de cada Dueño están sus **empleados**, con roles y permisos configurables por ese Dueño.

## 1.4 Objetivos principales

1. Gestión de stock con doble ubicación (Depósito y Vitrina) y alertas de reposición configurables.
2. Ventas con caja registradora completa: apertura/cierre, conteo de billetes, múltiples medios de pago, cálculo de vuelto con desglose de billetes.
3. Sistema de compras a proveedores con lista inteligente de reposición.
4. Sistema de fiado (cuenta corriente) para clientes.
5. Reportes y estadísticas de ventas.
6. Sistema multi-negocio con roles y permisos granulares y personalizables.
7. Auditoría completa: qué pasó, quién lo hizo, cuándo, y por qué (cuando aplica corrección).

## 1.5 Objetivos secundarios

- Que en el futuro pueda distribuirse como una aplicación de escritorio portable (un `.exe` de doble clic, sin instalación) para repartir a clientes reales, usando Tauri.
- Que soporte productos vendidos por unidad, peso (kg/gramos) o volumen (litros/mililitros), con conversión automática de unidades.
- Que sea usable por un dueño solo, o por un dueño con varios empleados de distintos roles, sin fricción.

## 1.6 Qué diferencia esta aplicación de la competencia

(Esta sección refleja el análisis del propio usuario, no una investigación de mercado formal.) Los sistemas de gestión para comercios chicos que existen en el mercado argentino suelen:
- Ser genéricos y no pensados específicamente para kioscos (les faltan cosas como el manejo de vitrina separado del depósito, o el fiado).
- No tener onboarding simple para dueños sin experiencia técnica.
- Cobrar suscripciones mensuales que no siempre se justifican para un comercio muy chico.

KioscoApp busca diferenciarse con:
- Un flujo de "Vitrina vs. Depósito" pensado específicamente para el layout físico de un kiosco (heladera/estantería vs. depósito trasero).
- Un sistema de auditoría con motivo obligatorio en las correcciones, pensado para la confianza entre dueño y empleados.
- Ser eventualmente gratuita o de costo único (al distribuirse como ejecutable portable, sin necesidad de un backend pago).

## 1.7 Qué ventajas busca ofrecer

- Visibilidad en tiempo real del estado del negocio (dashboard).
- Prevención de fraude/errores mediante trazabilidad de acciones.
- Flexibilidad de roles (no es "todo o nada": el dueño define exactamente qué puede ver y hacer cada empleado, incluso creando roles personalizados).
- Cálculo automático de vuelto con sugerencia de billetes — algo que ahorra tiempo real en el mostrador.

---

# 2. Historia del proyecto

## 2.1 Cómo empezó

El proyecto comenzó como una migración. El usuario tenía una versión previa de la aplicación construida sobre **Base44** (una plataforma no-code/low-code). La decisión inicial y explícita fue: **migrar todo a código propio (React), para no depender de una plataforma de terceros y ser dueño real del producto final.**

Esta decisión de migración fue tomada con pleno conocimiento de que Base44 no ofrecía exportación de código — se investigó explícitamente esa posibilidad y se confirmó que no existía, lo cual reforzó la decisión de reconstruir desde cero en vez de exportar.

El desarrollo arrancó pidiendo, en este orden:
1. Una interfaz de navegación básica (sidebar + pantallas) que replicara *exactamente* el diseño visual que el usuario ya tenía en Base44 (a partir de capturas de pantalla que el usuario compartió, mostrando los módulos: Stock, Vitrina, Ventas/Caja, Reportes, Administración).
2. El módulo de Stock (alta, edición, baja, escaneo de código de barras).
3. El módulo de Vitrina (mover stock de depósito a vitrina, con alertas configurables).
4. El módulo de Ventas/Caja.
5. El módulo de Reportes.
6. Administración/Login (dejado deliberadamente para el final).

## 2.2 Evolución cronológica de decisiones importantes

Esta es la secuencia real de decisiones y ampliaciones, en el orden en que ocurrieron durante el desarrollo (reconstruida a partir del historial de la conversación y de la página de Notion del proyecto):

1. **Estructura base y navegación** — sidebar con ítems de menú, pantalla de Inicio con accesos directos en forma de tarjetas.
2. **Stock básico** — alta/edición/baja de productos, con campos: nombre, código de barras, precio de costo, precio de venta, stock en depósito, stock mínimo (para alertas), categoría.
3. **Vitrina** — pantalla para mover stock de depósito a vitrina, con alerta configurable por producto ("avisame cuando queden 2").
4. **Ventas/Caja** — apertura de caja con monto inicial, carrito de venta, cobro.
5. **Reportes** — filtros por período (Hoy/Semana/Quincena/Mes), ranking de productos, listado de tickets.
6. **Se armó un roadmap extenso en Notion**, en colaboración con ChatGPT (el usuario también usa ChatGPT en paralelo para pensar el producto), cubriendo: Stock avanzado, Compras, Caja avanzada, Usuarios/roles, Estadísticas, Auditoría, Clientes/Fiado, y una "Segunda etapa" (backups, importación/exportación, vencimientos, personalización) y un bloque de "Futuro" (dashboard inteligente, notificaciones, favoritos, venta rápida, atajos de teclado, proveedores).
7. **Compras** — módulo nuevo: lista de reposición automática por stock bajo, búsqueda de cualquier producto para agregar a la lista, alta de productos genuinamente nuevos desde esta pantalla, estados (pendiente → pedido realizado → recibido), copia del pedido a WhatsApp.
8. **Clientes / Fiado** — cuenta corriente, vinculación de tickets ya emitidos a un cliente, carga de deuda manual, registro de pagos.
9. **Caja avanzada** — medios de pago múltiples (Efectivo, Mercado Pago, Transferencia, Tarjeta, Cuenta corriente), cálculo de vuelto con desglose de billetes sugeridos, apertura/cierre de caja con conteo de billetes **opcional** (con anotación en el historial si no se contó), validación de que no se pueda retirar más dinero del que hay.
10. **Unidades de medida** — se agregó la posibilidad de vender productos por peso (Kg/gramos) o volumen (Litros/ml), con conversión automática entre la unidad en la que se guarda el stock (Kg o L) y la unidad en la que se vende (gramos o ml).
11. **Sistema de cuentas multi-negocio y login** — se reemplazó el acceso directo por una pantalla de login/registro. Cada cuenta (negocio) tiene su propio set de datos completamente aislado.
12. **Roles y permisos** — primero un sistema fijo (Dueño/Administrador/Cajero), después ampliado a **roles completamente personalizables** con un editor de permisos por casillas de verificación, por negocio.
13. **Jerarquía superAdmin** — corrección de diseño importante: originalmente cualquier "Dueño" veía la lista de todos los negocios (bug de diseño). Se corrigió para que **sólo la cuenta marcada como `superAdmin: true`** (la del propio usuario, Juan) vea el panel consolidado de todos los negocios; el resto de los Dueños ven únicamente el suyo.
14. **Auditoría en dos niveles** — separación de eventos en categorías "Operativo" (aperturas, cierres, ventas, reposiciones) y "Técnico" (ediciones, correcciones, eliminaciones, cambios de permisos), con un filtro visual.
15. **Autoría en todos los historiales** — se agregó el campo `quien` a absolutamente todos los registros de historial (producto, caja, tickets, movimientos, sugerencias, roles), guardando nombre + rol de quien hizo la acción.
16. **Persistencia real** — implementación de guardado/carga automático usando la API `window.storage` de Claude.ai, más un botón de "Borrar todos los datos guardados" para reiniciar el estado de pruebas.
17. **Dashboard en Inicio** — panel de indicadores en vivo (caja abierta/cerrada + saldo, ventas de hoy, productos críticos, productos a reponer en vitrina, valor total del stock), filtrado según los permisos del rol logueado.
18. **Estadísticas avanzadas en Reportes** — ganancia potencial estimada, evolución de ventas por día, ventas por hora, métodos de pago más usados, separación entre "Vendido", "Cobrado" y "En fiado (pendiente)".
19. **Flujo de recepción de compras mejorado** — al confirmar la recepción de un ítem de la lista de compras que no está vinculado a un producto real de Stock, ahora se pregunta explícitamente si se quiere (a) marcarlo como recibido sin más, o (b) crear el producto en Stock a partir de esa recepción.
20. **Empleados sólo pueden "sugerir" productos nuevos** — si un usuario logueado con un rol distinto de "Dueño" intenta crear un producto nuevo (desde Stock o desde Compras), la creación no se aplica directamente: se guarda como una "sugerencia" pendiente, visible sólo para el Dueño en Administración, quien puede aprobarla (se crea el producto real) o rechazarla.
21. **Motivo obligatorio en correcciones** — se extendió el requisito de "motivo" (que ya existía para eliminar movimientos de caja) también a la edición de productos: si se cambia cualquier campo de un producto ya existente, hay que escribir por qué.
22. **Eliminación "no destructiva" de movimientos de caja** — al eliminar un movimiento de caja, no desaparece de la lista: queda visualmente tachado, con el motivo y el monto original visibles, para que quede rastro.
23. **Corrección de bugs de props** — durante el desarrollo aparecieron (y se corrigieron) varios bugs de "propiedad de React faltante" (el típico `Cannot read properties of undefined`), documentados en la sección 16.

## 2.3 Ideas que aparecieron pero fueron descartadas o pospuestas (y por qué)

- **Separar el archivo en múltiples módulos ahora mismo**: se decidió explícitamente NO hacerlo todavía. El motivo técnico es que el entorno de vista previa de Claude.ai sólo puede renderizar artefactos de React de **un solo archivo**; separar en carpetas ahora significaría perder la vista previa en vivo dentro del chat. Se pospuso hasta el momento de migrar a un entorno de desarrollo local (Claude Code) para el empaquetado final con Tauri.
- **Persistencia con IndexedDB desde ya**: se decidió no implementarla todavía porque el entorno actual (dentro de Claude.ai) no lo necesita para las pruebas — se usó en cambio `window.storage`, sabiendo que es una solución transitoria válida sólo dentro de Claude.ai.
- **Ranking de clientes** (ideado en las charlas con ChatGPT): se descartó a favor del sistema de Fiado, que se consideró más útil para el tipo de comercio al que apunta la app.

---

# 3. Funcionalidades actuales

Esta sección describe, módulo por módulo, todo lo que está implementado y funcionando en `KioscoApp.jsx` al momento de escribir este documento. Para cada módulo se explica: cómo funciona, qué problema resuelve, cómo interactúa con el resto de la aplicación, y las decisiones de diseño relevantes.

## 3.1 Autenticación y sesión (Login / Registro)

**Componente:** `LoginView`
**Estado relacionado en el componente raíz:** `cuentas`, `currentUserId`, `identidad`, `loginError`

### Cómo funciona
Al abrir la aplicación (o al cerrar sesión), se muestra `LoginView`, que tiene dos modos alternables con dos botones ("Iniciar sesión" / "Crear cuenta"):

- **Iniciar sesión:** pide usuario y contraseña. `handleLogin` (definido en el componente raíz `KioscoApp`) busca primero entre las `cuentas` (los "Dueños") una coincidencia exacta de `usuario`+`password`. Si no encuentra, recorre el arreglo `empleados` de **cada** cuenta buscando coincidencia. Si el usuario es un Dueño, `identidad` se setea como `{ rol: "Dueño", nombre: cuenta.nombre, superAdmin: !!cuenta.superAdmin }`. Si es un empleado, `identidad` se setea como `{ rol: empleado.rol, nombre: empleado.nombre, superAdmin: false }`, y `currentUserId` apunta al `id` del **negocio** al que pertenece ese empleado (no se crea una sesión de datos separada para el empleado: opera sobre los mismos datos que su Dueño).
- **Crear cuenta:** pide nombre de la persona, nombre del negocio, usuario y contraseña. `handleRegister` crea una entrada nueva en `cuentas` con `superAdmin: false`, `roles: rolesPorDefecto()` (Administrador y Cajero con sus permisos por defecto) y `empleados: []`; y crea una entrada nueva en `datos` usando `defaultDataset(false)` (dataset vacío, sin productos de ejemplo).
- Hay un botón "Borrar todos los datos guardados" (con una confirmación de dos pasos) que llama a `handleReset`, el cual borra las claves de `window.storage` y reinicializa `cuentas`/`datos` a los valores semilla (`seedCuentas()` / `seedDatos()`).

### Cuentas de prueba precargadas (semillas)
- `demo` / `1234` — Juan, Dueño de "Mi Negocio de Pruebas", con `superAdmin: true`.
- `sur` / `1234` — María, Dueña de "Kiosco Sur (demo)", `superAdmin: false`. Este negocio viene precargado con productos, una caja abierta con saldo, y un ticket de ejemplo, para poder probar la vista de superAdmin con datos reales de otro negocio.
- `lucia` / `1234` — empleada de "Mi Negocio de Pruebas" con rol "Cajero" (para probar el menú restringido).

### Decisiones de diseño relevantes
- Las contraseñas se comparan en **texto plano**, guardadas tal cual se escriben, sin hash ni encriptación. Esto es aceptable únicamente porque hoy es un prototipo dentro de Claude.ai; **no es apto para producción real** (ver sección 16).
- No hay recuperación de contraseña ni verificación de email — no existe el concepto de email en el sistema.

## 3.2 Multi-negocio (cuentas aisladas)

### Cómo funciona
El estado se divide conceptualmente en dos partes:
- `cuentas`: array de objetos que representan la **identidad de login** de cada negocio (Dueño): `{ id, nombre, usuario, password, nombreNegocio, superAdmin, roles, empleados }`.
- `datos`: objeto (diccionario) donde cada clave es el `id` de una cuenta, y el valor es el **dataset completo de ese negocio**: `{ products, caja, tickets, clientes, comprasItems, cajaAbierta, cart, sugerenciasProductos }`.

Esta separación es la que permite que cada negocio tenga stock, caja, clientes, etc. completamente independientes del resto, incluso compartiendo el mismo navegador/sesión de Claude.ai.

Todos los "setters" que usan las pantallas (`setProducts`, `setCaja`, `setTickets`, `setClientes`, `setComprasItems`, `setCajaAbierta`, `setCart`, `setSugerencias`) están generados por una función fábrica llamada `makeSetter(key)`, definida en el componente raíz:

```js
const makeSetter = (key) => (updater) => {
  setDatos((prev) => {
    const cur = prev[currentUserId];
    const nextVal = typeof updater === "function" ? updater(cur[key]) : updater;
    return { ...prev, [currentUserId]: { ...cur, [key]: nextVal } };
  });
};
```

Esto significa que **cualquier pantalla que reciba, por ejemplo, `setProducts` como prop, en realidad está escribiendo dentro de `datos[currentUserId].products`**, sin necesidad de que la pantalla sepa nada sobre el sistema multi-negocio. Es el patrón central de todo el manejo de estado de la aplicación.

## 3.3 Roles y permisos (incluye roles personalizados)

**Componentes relacionados:** `EmpleadoModal`, la sección "Roles y permisos" dentro de `AdministracionView`.
**Helper central:** `permisosDe(identidad, cuenta)`.

### Jerarquía
1. **Administrador de la app (superAdmin)** — sólo la cuenta con `superAdmin: true` (hoy, sólo la cuenta `demo` de Juan). Ve el panel consolidado de *todos* los negocios en Administración, puede "entrar" a operar cualquier negocio, y ve alertas de auditoría cruzadas entre negocios.
2. **Dueño** — el rol implícito del titular de cada cuenta/negocio. Siempre tiene el permiso máximo (`PERMISOS_DUENO`, que es `PERMISOS_MENU` + `"administracion"`). En Administración, un Dueño normal (no superAdmin) ve únicamente el panel de su propio negocio, sin poder ver ni entrar a otros.
3. **Roles de empleado** — por defecto cada negocio nuevo (`rolesPorDefecto()`) tiene dos roles: "Administrador" (permisos: `stock, vitrina, ventas, compras, clientes, reportes` — todo menos Administración) y "Cajero" (permisos: `stock, vitrina, ventas`). Estos roles **son completamente editables**: el Dueño puede tildar o destildar cualquiera de los seis permisos de menú (`stock, vitrina, ventas, compras, clientes, reportes` — nunca `administracion`, que queda reservado exclusivamente al Dueño/superAdmin) para cada rol, y puede **crear roles nuevos con cualquier nombre** (por ejemplo, "Repositor"), que arrancan sin ningún permiso hasta que el Dueño se los asigna.

### Cómo se calculan los permisos en tiempo real
```js
const permisosDe = (identidad, cuenta) => {
  if (!identidad) return [];
  if (identidad.rol === "Dueño") return PERMISOS_DUENO;
  const rolDef = (cuenta?.roles || []).find((r) => r.nombre === identidad.rol);
  return rolDef?.permisos || [];
};
```
Este cálculo se hace **en cada render**, no se guarda una copia fija al momento del login. Esto significa que si el Dueño cambia los permisos de un rol mientras un empleado con ese rol está usando la app, el cambio se refleja de inmediato la próxima vez que ese empleado navegue (sin necesidad de volver a loguearse).

### Dónde se usan los permisos
- `Sidebar`: sólo muestra en el menú lateral los ítems de `NAV_ITEMS` cuyo `id` está incluido en `permisos`; el botón "Administración" sólo se muestra si `permisos.includes("administracion")`.
- `Home`: sólo muestra las tarjetas de acceso rápido (`HOME_CARDS`) permitidas, y sólo muestra las tarjetas del Dashboard (caja, ventas, stock, vitrina, valor de stock) según el permiso correspondiente.
- `KioscoApp.renderView()`: como capa de seguridad adicional (defensa en profundidad), si la vista actual (`view`) no está en la lista de `permisos` del usuario logueado, se fuerza el render de `Home` en vez de la vista pedida — esto evita que alguien llegue a una pantalla prohibida por URL/estado residual aunque el menú no se la muestre.
- `handleNavigate(id)`: función central de navegación que ignora los intentos de navegar a una vista fuera de los `permisos` actuales.

### Gestión de empleados (alta y baja)
Desde el panel del propio negocio en Administración (visible sólo cuando `negocioAbierto.id === cuenta?.id`, es decir, cuando el Dueño está viendo su propio negocio, no el de otro), hay una sección "Empleados de este negocio" con:
- Lista de empleados existentes (nombre, usuario, rol), con botón de eliminar.
- Botón "Agregar empleado" que abre `EmpleadoModal`, pidiendo nombre, usuario, contraseña y rol (elegido de un `<select>` poblado con los roles existentes del negocio, más una opción "+ Crear rol nuevo..." que revela un input de texto para el nombre del rol nuevo).
- Al crear un empleado con un rol que no existía todavía, el rol se crea automáticamente (con permisos vacíos) al mismo tiempo que el empleado.

## 3.4 Dashboard (pantalla de Inicio)

**Componentes:** `Home`, `DashboardCard`

### Cómo funciona
Es la pantalla que se muestra al loguearse. Tiene:
1. **Saludo dinámico** ("Buen día" / "Buenas tardes" / "Buenas noches" según la hora del sistema) con el nombre de quien está logueado (el nombre del empleado si aplica, o el del Dueño) y el nombre del negocio.
2. **Panel de indicadores en vivo** (hasta 5 tarjetas, cada una filtrada por permiso):
   - **Caja**: "Abierta"/"Cerrada", con el saldo actual si está abierta. Requiere permiso `ventas`.
   - **Ventas de hoy**: total vendido hoy (filtrando tickets con `isWithinRange(t.fecha, "Hoy")`), con la cantidad de tickets, y si hay ventas a cuenta corriente, se aclara el monto "Cobrado" por separado. Requiere permiso `ventas`.
   - **Productos críticos**: cantidad de productos con `deposito <= minimo` (en rojo si hay alguno). Requiere permiso `stock`.
   - **Reponer vitrina**: cantidad de productos con `vitrina <= alertaVitrina` (en ámbar si hay alguno). Requiere permiso `vitrina`.
   - **Valor del stock**: suma de `deposito * costo` de todos los productos (a precio de costo, no de venta). Requiere permiso `stock` — esto es intencional, ya que es información financiera sensible que el Dueño puede optar por ocultarle a un Cajero quitándole el permiso de Stock.
3. **Tarjetas de acceso rápido** (`HOME_CARDS`), filtradas también por permiso, que navegan a cada sección.

Cada tarjeta del dashboard es clickeable y navega directamente a la sección relacionada.

## 3.5 Stock

**Componentes:** `StockView`, `ProductModal`, `HistorialProductoModal`, `ScanModal`

### Modelo de datos de un producto
```js
{
  id: number,
  nombre: string,
  codigo: string,          // código de barras, puede estar vacío
  costo: number,           // precio de costo, por unidad base (ver unidades de medida)
  venta: number,           // precio de venta, por unidad de venta (ver unidades de medida)
  deposito: number,        // cantidad en depósito, en unidad base
  vitrina: number,         // cantidad en vitrina, en unidad base
  minimo: number,          // umbral de alerta de stock bajo en depósito
  alertaVitrina: number,   // umbral de alerta de reposición en vitrina
  categoria: string,       // una de CATEGORIES
  unidad: "unidad" | "peso" | "volumen",
  historial: [ { id, tipo, detalle, quien, fecha } ]
}
```

### Alta de producto (flujo en dos pasos)
`ProductModal`, cuando se usa para **crear** un producto nuevo (prop `initial` vacía), funciona como un asistente de dos pasos:
- **Paso 1:** nombre, código de barras, y selección de "¿Cómo se vende?" entre las tres opciones de `UNIDAD_GRUPOS` (Por unidad / Por peso / Por volumen). No se puede avanzar sin nombre.
- **Paso 2:** el formulario cambia según la unidad elegida:
  - Si es "unidad": precio de costo, precio de venta (ambos por unidad entera).
  - Si es "peso" o "volumen": se muestra un aviso aclaratorio, y los campos pasan a ser "Precio de costo por Kg/Litro" y "Precio de venta por gramo/ml" — y el stock (depósito/mínimo) se carga en la unidad base (Kg o Litros), aceptando decimales.
  - En ambos casos: stock en depósito, stock mínimo (alerta), alerta de reposición en vitrina, categoría.

Cuando `ProductModal` se abre en modo edición (`initial` con datos), se salta directo al paso 2 (ya se sabe la unidad), y el botón "Atrás" se reemplaza por "Cancelar".

### Sistema de unidades de medida y conversión automática
Este es uno de los sistemas más particulares del proyecto. La función central es:
```js
const unidadInfo = (grupo) => {
  if (grupo === "peso")   return { baseAbbr: "kg", baseLabel: "Kg",    ventaAbbr: "g",  ventaLabel: "gramo", factor: 1000 };
  if (grupo === "volumen") return { baseAbbr: "l",  baseLabel: "Litro", ventaAbbr: "ml", ventaLabel: "ml",    factor: 1000 };
  return                  { baseAbbr: "un", baseLabel: "Unidad", ventaAbbr: "un", ventaLabel: "unidad", factor: 1 };
};
```
La idea: el **stock siempre se guarda en la unidad grande** (Kg o Litros, con decimales), pero **se vende en la unidad chica** (gramos o ml). El `factor` (1000) es la conversión entre ambas. Ejemplo real usado durante el desarrollo: si hay 3.5 kg en vitrina y se vende 350 g, el sistema resta `350 / 1000 = 0.35` kg, dejando `3.15` kg — exactamente el caso de uso que motivó la funcionalidad.

Para productos "por unidad", `factor` es 1 y `baseAbbr === ventaAbbr === "un"`, por lo que toda la lógica de conversión es un caso particular donde no cambia nada (esto permite reutilizar el mismo código para los tres tipos sin ramas especiales en la mayoría de los lugares).

### Edición de producto y motivo obligatorio
Cuando se edita un producto existente y se detecta al menos un cambio real en alguno de estos campos: `nombre, costo, venta, deposito, minimo, alertaVitrina, categoria, unidad` (comparación campo por campo, ver `CAMPOS_HISTORIAL` en `StockView`), **el formulario exige un "Motivo del cambio"** antes de habilitar el botón Guardar. El motivo, junto con el detalle de qué campo cambió de qué valor a qué valor, se guarda en el historial del producto con el formato:
```
Motivo: <motivo>. <Campo>: <valor viejo> → <valor nuevo> · <Campo>: ...
```

### Historial por producto
Cada producto acumula un arreglo `historial` con entradas de tipo:
- `creacion` — al darlo de alta (incluye si fue creado directamente por un Dueño, aprobado desde una sugerencia, o creado al recibir una compra).
- `edicion` — al modificar cualquier campo (incluye motivo, ver arriba).
- `reposicion` — al confirmar la recepción de una compra vinculada a este producto (`+X unidad(es) recibidos por compra`).
- `venta` — al vender unidades de este producto (`-X unidad(es) vendidos (medio de pago)`).

Cada entrada tiene `{ id, tipo, detalle, quien, fecha }`, generada por el helper `historialEntry(tipo, detalle, quien)`. El campo `quien` se llena con `nombreIdentidad(identidad)`, que da como resultado una cadena como `"Juan (Dueño)"` o `"Lucía (Cajero)"`.

`HistorialProductoModal` muestra este historial completo, más reciente primero, con un ícono distinto según el tipo de evento, y la línea "Por {quien}" debajo de cada detalle.

### Escaneo de código de barras
`ScanModal` existe como flujo, pero **no usa la cámara real todavía** — es un placeholder que permite tipear el código a mano y simular el flujo de "escanear → completa el código → abre el formulario de alta". La integración con la cámara real del dispositivo queda pendiente (ver sección 16).

### Alertas de stock bajo
`StockView` calcula `lowStock = products.filter(p => p.deposito <= p.minimo)` y muestra un banner rojo con la cantidad. Este mismo cálculo se replica en el `Sidebar` (badge numérico rojo sobre el ítem "Stock" del menú) y en el Dashboard de Inicio.

## 3.6 Vitrina

**Componentes:** `VitrinaView`, `VitrinaRow`

### Cómo funciona
Lista todos los productos, mostrando por cada uno: cantidad en depósito, cantidad en vitrina, total, y dos campos editables lado a lado ("Vitrina" y "Alerta en"), con un botón "Guardar" que se habilita sólo si hubo cambios. Al guardar, la diferencia entre el nuevo valor de vitrina y el viejo se resta (o suma) al depósito, manteniendo el total constante — es decir, mover stock a vitrina no crea ni destruye unidades, sólo las traslada de una ubicación a otra dentro del mismo producto.

### Alerta de reposición configurable
Cada producto tiene su propio umbral `alertaVitrina`. Cuando `vitrina <= alertaVitrina`, la fila se resalta en ámbar con una etiqueta "Reponer", y el producto se cuenta en:
- El banner superior de `VitrinaView` ("X producto(s) necesita(n) reposición").
- El badge ámbar sobre el ítem "Vitrina" del `Sidebar`.
- La tarjeta "Reponer vitrina" del Dashboard.

## 3.7 Ventas / Caja

Este es el módulo más complejo de la aplicación. Componentes involucrados: `VentasView`, `CartQtyInput`, `CobrarModal`, `MercadoPagoBadge`, `AperturaModal`, `CierreModal`, `DenomCounter`, `MovimientoModal`, `MovimientosModal`, `HistorialCajaModal`, `EditarMovimientoModal` (este último vive dentro de `AdministracionView`).

### Apertura de caja
Al entrar a Ventas/Caja con la caja cerrada (`cajaAbierta === false`), en vez del menú de ventas se muestra una pantalla "¿Arrancamos?" con un botón "Abrir caja", que abre `AperturaModal`. Este modal tiene dos modos (implementados como una mejora posterior sobre una primera versión que obligaba a contar billetes siempre — ver `LegacyAperturaModal`, que quedó en el archivo como código muerto de una iteración anterior):
- **Contar billetes**: usa `DenomCounter`, un contador con un input por cada denominación de `DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10]`, sumando el total automáticamente.
- **Sin contar billetes**: simplemente se ingresa el monto total con el que se abre.

En ambos casos se registra en `caja.historial` una entrada `tipo: "apertura"` con el monto, si se contó o no, y quién la hizo; y también se agrega un movimiento de ingreso a `caja.movimientos`.

### Venta (carrito y cobro)
- El carrito (`cart`) **vive en el dataset del negocio**, no en estado local del componente — esto es deliberado: si el cajero navega a otra pantalla (por ejemplo, a Stock, para chequear algo) en medio de una venta, el carrito **no se pierde**. Esto fue un bug reportado y corregido explícitamente durante el desarrollo.
- Se agregan productos al carrito por búsqueda (por nombre o código) o por escaneo (simulado).
- La cantidad en el carrito se maneja con botones +/- (con un paso de 1 para productos "por unidad" y de 100 para "peso"/"volumen") y también con un input de texto libre (`CartQtyInput`) que permite tipear una cantidad exacta (por ejemplo, 350 gramos), con un mecanismo de "buffer" local que sólo confirma el valor final al perder el foco (`onBlur`), evitando que el ítem se borre del carrito mientras se está escribiendo un número nuevo.
- Al tocar "Cobrar", se abre `CobrarModal`, que tiene:
  - Un selector de **medio de pago** con botones tipo píldora, coloreados: Efectivo (verde, 💵), Mercado Pago (celeste, con un ícono SVG simplificado hecho a mano — no el logo oficial, por una limitación deliberada de no reproducir marcas registradas — más el emoji 🤝), Tarjeta (naranja, 💳), Transferencia (índigo, 🏦), Cuenta corriente (gris oscuro, 📒).
  - Si el medio es **Efectivo**: pide el monto recibido, calcula el vuelto, y muestra una combinación sugerida de billetes para dar el vuelto (algoritmo *greedy*, de la denominación más alta a la más baja — función `calcularVuelto`).
  - Si el medio es **Cuenta corriente**: exige elegir un cliente existente (de la lista de `clientes`) antes de poder confirmar.
  - Para los demás medios (Mercado Pago, Transferencia, Tarjeta): se confirma directo, sin pedir monto recibido (se asume el monto exacto).
- Al confirmar la venta (`handleCobrar`):
  1. Se descuenta `vitrina` de cada producto vendido (con la conversión de unidad correspondiente si es peso/volumen), y se agrega una entrada de historial `tipo: "venta"` a cada producto.
  2. Se crea un ticket nuevo en `tickets`, con `{ id, fecha (ISO), medio, clienteId, quien, items: [{nombre, cantidad, subtotal}], total }`.
  3. Si el medio fue "Efectivo", se suma el total a `caja.saldo` y se agrega un movimiento de ingreso.
  4. Si el medio fue "Cuenta corriente", se suma el total como deuda al cliente elegido (no afecta la caja física).
  5. Para los demás medios (MP, transferencia, tarjeta), **no se modifica el saldo físico de caja** (se asume que ese dinero no pasa por la caja registradora), pero el ticket sí queda registrado con el medio de pago correspondiente para las estadísticas.
  6. Se vacía el carrito.

### Movimientos de caja (ingreso/retiro manual)
Botón "Agregar / Retirar" abre `MovimientoModal`, que permite anotar un ingreso o un retiro manual con nota. **Valida que no se pueda retirar más dinero del que hay** en `caja.saldo` (bloqueando el botón de confirmar y mostrando el mensaje en rojo si se supera). Cada movimiento queda con `quien` y `fecha`.

### Cierre de caja
Botón "Cerrar caja" abre `CierreModal`, con la misma lógica de conteo opcional de billetes que la apertura. Si se cuentan los billetes, se calcula la diferencia entre lo contado y lo esperado (`caja.saldo` acumulado). Si `|diferencia| >= UMBRAL_DIFERENCIA_INUSUAL` (1000 pesos, constante fija), la entrada de historial se marca `inusual: true`, lo cual dispara:
- Un badge rojo "⚠️ Diferencia inusual" en `HistorialCajaModal`.
- Una entrada en el bloque de "Alertas" de `AdministracionView`, agregando el nombre del negocio y la diferencia.

Al cerrar, `caja.saldo` se resetea a 0 y `cajaAbierta` pasa a `false`.

### Historial de caja y movimientos
- `MovimientosModal` lista los movimientos manuales (ingresos/retiros), con quién y cuándo.
- `HistorialCajaModal` lista las aperturas y cierres, con el detalle de si se contaron billetes o no, y la diferencia si hubo cierre con conteo.


## 3.8 Compras

**Componentes:** `ComprasView`, `RecepcionGenericaModal`, `CopiarTextoModal`

### Cómo funciona
Es la lista de reposición a proveedores. Cada ítem de `comprasItems` tiene la forma:
```js
{
  id, productId, nombre, cantidad, estado, origen,
  recibidoPor, recibidoFecha, pendienteAprobacion
}
```
`estado` puede ser `"pendiente"`, `"pedido"` o `"recibido"`. `productId` puede ser `null` si el ítem es "genérico" (no vinculado a un producto real de Stock — por ejemplo, "bolsas de plástico").

### Fuentes para agregar ítems a la lista
1. **Sugeridos por stock bajo**: se calculan automáticamente (`products.filter(p => p.deposito <= p.minimo)`, excluyendo los que ya están en la lista), con un botón "Agregar a la lista" que precarga una cantidad sugerida (`minimo * 2 - deposito`, con un mínimo de 1).
2. **Buscador de cualquier producto existente**: un buscador por nombre/código que permite agregar a la lista cualquier producto de Stock, tenga o no stock bajo (esto se agregó específicamente porque antes sólo se podían agregar productos en falta, y el usuario quería poder pedir stock de productos que todavía no estaban en falta).
3. **Ítem genérico (texto libre)**: para cosas que no son productos de Stock (bolsas,它 insumos varios).
4. **Crear producto nuevo desde Compras**: un botón "¿No está en tu Stock? Creá un producto nuevo para pedirlo" que abre el mismo `ProductModal` de dos pasos que usa Stock. Si quien está logueado es el Dueño, el producto se crea directamente (con `deposito: 0`, ya que todavía no llegó) y se agrega a la lista de compras con la cantidad pedida. **Si quien está logueado no es el Dueño, la creación no se aplica: se guarda como sugerencia pendiente** (ver sección 3.3 de roles y la sección de sugerencias más abajo).

### Estados y flujo de recepción
- Botón "Marcar pedido" pasa el ítem de `pendiente` a `pedido`.
- Botón "Confirmar recepción" (`confirmarRecepcion`):
  - Si el ítem **tiene** `productId` (está vinculado a un producto real): suma la cantidad recibida al `deposito` de ese producto directamente, agrega una entrada de historial `tipo: "reposicion"` al producto, y marca el ítem como `recibido`, guardando `recibidoPor` y `recibidoFecha`.
  - Si el ítem **no tiene** `productId` (genérico): en vez de confirmar directo, se abre `RecepcionGenericaModal`, que pregunta explícitamente:
    - **"Solo marcar como recibido"** — no toca el Stock, sólo cambia el estado a `recibido` (útil para cosas como bolsas, que el dueño no quiere llevar como inventario).
    - **"Recibir y agregar a mi Stock"** — abre `ProductModal` con el nombre pre-cargado (usando la prop `nombreInicial`, que llena sólo el campo nombre sin saltar el paso 1 del asistente, a diferencia de pasar `initial`, que activaría el modo edición). Al guardar, se crea el producto con `deposito` igual a la cantidad que se había pedido, y se vincula `productId` al ítem de compra. **Si quien hace esto no es el Dueño, en vez de crear el producto se genera una sugerencia pendiente**, y el ítem de compra igual se marca como `recibido` pero con la bandera `pendienteAprobacion: true` (la mercadería físicamente llegó, pero el alta en Stock queda supeditada a la aprobación del Dueño).

### Copiar pedido a WhatsApp
Botón que arma un texto con todos los ítems activos (no recibidos) y su cantidad, e intenta copiarlo al portapapeles con `navigator.clipboard.writeText`. **Si falla** (situación real observada dentro del entorno de Claude.ai, donde el acceso al portapapeles puede estar restringido), se abre `CopiarTextoModal` como alternativa: muestra el texto en un `<textarea>` de sólo lectura para copiar a mano, más un enlace directo `https://wa.me/?text=...` para abrir WhatsApp con el texto precargado.

### "Recibidos recientemente"
Sección separada visualmente (con un borde superior punteado y fondo gris) del resto de la lista activa, mostrando cantidad, nombre, y quién lo recibió (`recibido por {nombre}`).

## 3.9 Clientes / Fiado (cuenta corriente)

**Componentes:** `ClienteModal`, `PagoModal`, `DeudaManualModal`, `VincularTicketModal`, `ClienteRow`, `ClientesView`

### Modelo de datos de un cliente
```js
{ id, nombre, telefono, saldo, movimientos: [{ id, tipo: "deuda"|"pago", monto, nota, quien, fecha }] }
```

### Funcionalidad
- **Alta de cliente** (`ClienteModal`): nombre y teléfono opcional.
- **Registrar pago** (`PagoModal`): resta del saldo del cliente, deja un movimiento `tipo: "pago"`.
- **Cargar deuda manual** (`DeudaManualModal`): suma al saldo directamente, sin pasar por una venta — pensado para casos donde el fiado se originó fuera del sistema (por ejemplo, antes de empezar a usar la app).
- **Vincular ticket** (`VincularTicketModal`): permite tomar un ticket de venta ya emitido (de cualquier medio de pago) que **todavía no esté vinculado a ningún cliente** (`!ticket.clienteId`) y asociarlo retroactivamente a un cliente como deuda. Esto resuelve el caso de "vendí algo y me olvidé de marcarlo como fiado en el momento".
- La fila de cada cliente (`ClienteRow`) muestra el saldo (rojo si es mayor a 0, verde si es 0), y un desplegable con el historial completo de movimientos.

### Integración con Ventas
Cuando se cobra una venta con el medio "Cuenta corriente" (ver sección 3.7), automáticamente se crea un movimiento `tipo: "deuda"` en el cliente elegido, con el total de la venta, sin pasar por `ClientesView` directamente — la lógica vive en `handleCobrar` dentro de `VentasView`.

## 3.10 Reportes y estadísticas

**Componentes:** `ReportesView`, `StatCard`, `MotivoBorradoModal`

### Filtros de período
Botones "Hoy", "Semana", "Quincena", "Mes", calculados por la función `isWithinRange(dateStr, range)`, que compara contra la fecha actual del sistema.

### Indicadores (tarjetas superiores)
- **Vendido** — suma total de los tickets del período (incluye ventas a cuenta corriente, aunque no se hayan cobrado).
- **Cobrado** — `Vendido - En fiado`, es decir, el dinero que realmente entró (excluye cuenta corriente).
- **En fiado (pendiente)** — suma de los tickets del período cuyo medio fue "Cuenta corriente".
- **Ganancia potencial** — suma, para cada ítem de cada ticket del período, de `subtotal - (costo_actual_del_producto / factor_de_unidad) * cantidad`. **Limitación conocida y documentada explícitamente durante el desarrollo:** esto usa el **costo actual** del producto (el que tiene ahora en Stock), no el costo que tenía en el momento exacto de la venta. Si el costo de un producto cambió después de una venta vieja, la ganancia calculada para esa venta ya no es exacta. El usuario pidió explícitamente solucionar esto guardando una "foto" del costo en cada venta, y quedó pendiente (ver sección 16 y 17).
- **Tickets** — cantidad de tickets del período.
- **Más vendido / Menos vendido** — por cantidad de unidades, calculado sobre un `ranking` armado agrupando todos los ítems de todos los tickets del período por nombre de producto.

### Paneles de detalle (con barras simples de CSS, sin librería de gráficos)
- **Evolución de ventas** — agrupa los tickets del período por día (usando el prefijo `YYYY-MM-DD` del campo `fecha` ISO del ticket), mostrando una barra horizontal por día con el total.
- **Ventas por hora** — agrupa por la hora del día (`new Date(t.fecha).getHours()`) en la que se emitió cada ticket.
- **Métodos de pago** — agrupa por `t.medio`, mostrando cantidad de tickets y total por cada medio.

### Tickets recientes y borrado con motivo
Lista de tickets del período, expandibles (mostrando el detalle línea por línea y quién hizo la venta: "Vendido por {quien}"). Cada ticket tiene un ícono de tacho que abre `MotivoBorradoModal`, el cual **exige escribir un motivo** antes de habilitar el botón de confirmar el borrado. Al confirmar (`handleBorrarTicket`):
1. Se quita el ticket de `tickets`.
2. Se agrega una entrada `tipo: "eliminacion_ticket"` al historial de caja (`caja.historial`), con el detalle `"Ticket #X ($monto) borrado. Motivo: ..."`, el `quien`, y la fecha — esto es lo que después aparece categorizado como evento "Técnico" en la Auditoría.

## 3.11 Administración (multi-nivel: superAdmin, Dueño, Auditoría, Roles)

**Componente:** `AdministracionView` (existe también `LegacyAdministracionView`, código muerto de una versión anterior, más simple, que ya no se usa).

Esta es la pantalla más compleja del proyecto. Su comportamiento cambia radicalmente según quién esté logueado:

### Vista del Administrador de la app (superAdmin = true)
- Ve un **grid de tarjetas**, una por cada negocio existente en `cuentas` (estilo similar a las tarjetas de Inicio), mostrando: nombre del negocio, si la caja está abierta o cerrada, ventas de hoy, cantidad de productos.
- Un total de "Ventas totales" sumando todos los negocios.
- Un bloque de **Alertas** con todos los cierres de caja marcados `inusual` de *todos* los negocios, indicando de cuál negocio es cada alerta.
- Al tocar una tarjeta, se abre el **panel de detalle de ese negocio** (mismo panel que ve un Dueño normal de su propio negocio, ver abajo), con la diferencia de que además aparece un botón **"Entrar al negocio"**, que llama a `onOpenNegocio(id)` — esto literalmente cambia `currentUserId` al `id` de ese otro negocio y navega a Inicio, permitiendo al superAdmin operar cualquier negocio como si fuera su Dueño (sin necesidad de conocer la contraseña de ese Dueño).

### Vista de un Dueño normal (superAdmin = false)
- **No ve el grid de otros negocios en absoluto.** El panel de detalle de su propio negocio se muestra directamente, sin necesidad de "elegir" nada (`negocioAbiertoId` se inicializa directamente en `cuenta.id`).
- No ve el botón "Entrar al negocio" (no tiene sentido, ya está operando el suyo).
- Las Alertas que ve están filtradas a **solamente su propio negocio**.

### Panel de detalle de un negocio (común a ambos casos)
Incluye, en este orden:
1. Cabecera con nombre del negocio, usuario, cantidad de ventas registradas.
2. Tres bloques: caja actual, productos cargados, y (sólo para superAdmin) el botón "Entrar al negocio".
3. **Movimientos de caja**, listados con posibilidad de editar (ícono de lápiz, abre `EditarMovimientoModal`) o eliminar cada uno.
4. **Auditoría**: ver sección 3.12 más abajo.
5. **Sugerencias de productos pendientes** (sólo visible cuando se está viendo el propio negocio): ver sección 3.13.
6. **Empleados de este negocio** (sólo visible en el propio negocio): alta/baja de empleados.
7. **Roles y permisos** (sólo visible en el propio negocio): editor de permisos por rol, con checkboxes, y creación de roles nuevos.

### Edición y eliminación de movimientos de caja (`EditarMovimientoModal`)
- **Editar**: cambia `monto` y/o `nota`. Si hubo algún cambio real, exige un campo "Motivo de la corrección" antes de habilitar Guardar. Al confirmar, se recalcula el saldo de caja considerando si el movimiento original era un ingreso o un retiro (bug corregido explícitamente: la primera versión no distinguía el signo correctamente para los retiros), y se agrega una entrada de historial `tipo: "correccion"` con el formato: `"Corrección de movimiento #X. Motivo: .... Antes: $A ("nota vieja"). Después: $B ("nota nueva")."`
- **Eliminar** (con confirmación de dos pasos dentro del mismo modal): **no borra el movimiento del arreglo**. Lo marca con `eliminado: true`, conservando el monto y la nota original. La UI lo muestra tachado (`line-through`), con la etiqueta "(eliminado)" y en gris. El saldo de caja se ajusta restando (o sumando, según el signo) la contribución original de ese movimiento. Se agrega una entrada de historial `tipo: "eliminacion_movimiento"`.

## 3.12 Sistema de Auditoría

**Vive dentro de `AdministracionView`.**

### Categorización
```js
const CATEGORIA_TECNICA = ["edicion", "correccion", "eliminacion_movimiento", "eliminacion_ticket", "auditoria_tecnica", "eliminacion"];
const categoriaEvento = (tipo) => CATEGORIA_TECNICA.includes(tipo) ? "Técnico" : "Operativo";
```
- **Operativo**: aperturas de caja, cierres de caja, ventas, reposiciones de stock, creación de productos.
- **Técnico**: ediciones de producto, correcciones de movimientos, eliminación de movimientos/tickets, y — agregado específicamente para este propósito — creación/eliminación de roles, cambios de permisos de un rol, y alta/baja de empleados (a través de la función auxiliar `registrarAuditoria(negocioId, detalle)`, que empuja una entrada `tipo: "auditoria_tecnica"` al historial de caja del negocio correspondiente).

### Vista
Un filtro de tres botones (Todo / Operativo / Técnico) que se aplica simultáneamente a dos listas paralelas:
- **"Caja y cuentas"**: eventos provenientes de `caja.historial` (aperturas, cierres, correcciones, eliminaciones, cambios técnicos de roles/empleados).
- **"Productos"**: eventos provenientes del `historial` de cada producto, aplanados en una sola lista (`eventosProductos`), mostrando `"{nombre del producto}: {detalle}"`.

Cada evento se muestra con: una etiqueta de categoría (azul para Operativo, violeta para Técnico), la fecha, el texto del detalle, y — desde la última ronda de trabajo — la línea "Por {quien}" debajo, mostrando nombre y rol de quien ejecutó la acción.

**Limitación de diseño conocida y aceptada explícitamente:** dado que las entradas de `caja.historial` usan un `id` incremental (`prev.historial.length + 1`, propio de cada negocio) y las de `historial` de producto usan `id: Date.now() + Math.random()` (un timestamp), **no existe un único timeline cronológicamente entrelazado entre ambas listas** — cada lista está ordenada correctamente puertas adentro, pero no se combinan en un solo feed. Esto se documentó como decisión consciente de simplicidad, no como bug.

## 3.13 Sugerencias de productos (control de creación por parte de empleados)

Este sistema resuelve la regla de negocio: *"un empleado que no es el Dueño no puede cargar un producto nuevo directamente — sólo puede sugerirlo, y el Dueño tiene que confirmarlo."*

### Modelo de datos
Cada negocio tiene un arreglo `sugerenciasProductos` en su dataset:
```js
{ id, data: { /* mismo payload que crearía un producto nuevo */ }, sugeridoPor, fecha }
```

### Puntos donde se genera una sugerencia (en vez de crear el producto directo)
1. `StockView.handleSave`, rama de creación (`else if (!esDueño)`), cuando el botón "Nuevo" (que cambia su etiqueta a "Sugerir producto" para quien no es Dueño) se usa.
2. `ComprasView.handleNuevoProducto`, cuando se usa el botón "Creá un producto nuevo para pedirlo" desde Compras.
3. `ComprasView.handleGuardarProductoDesdeRecepcion`, cuando se recibe un ítem genérico y se elige "Recibir y agregar a mi Stock".

En los tres casos, en vez de aplicar el cambio, se guarda la sugerencia y se muestra un banner azul de confirmación: *"Tu sugerencia fue enviada. El Dueño la tiene que confirmar antes de que se sume al Stock."* Además, `StockView` muestra un banner ámbar persistente con la cantidad de sugerencias propias pendientes.

### Aprobación / rechazo (sólo visible para el Dueño, en su propio negocio)
- **Aprobar y sumar a Stock** (`handleAprobarSugerencia`): crea el producto real (con un historial `creacion` que aclara *"(sugerido por {sugeridoPor})"*), y quita la sugerencia de la lista. Se registra en auditoría técnica.
- **Rechazar** (`handleRechazarSugerencia`): simplemente quita la sugerencia de la lista, sin crear nada. También se registra en auditoría técnica.

## 3.14 Persistencia (guardado y carga automáticos)

**Implementado con la API `window.storage`, exclusiva del entorno de artefactos de Claude.ai.**

### Carga inicial
Un único `useEffect` con `[]` de dependencias, ejecutado una vez al montar el componente raíz `KioscoApp`, que intenta leer en paralelo (`Promise.allSettled`) las claves `"cuentas"`, `"datos"`, `"sesion"` e `"identidad"`. Si alguna existe y se puede parsear como JSON, reemplaza el estado semilla correspondiente. Mientras esto ocurre, se muestra una pantalla mínima "Cargando KioscoApp..." controlada por el estado `cargando`.

### Guardado automático
Cuatro `useEffect` independientes, uno por cada pieza de estado (`cuentas`, `datos`, `currentUserId` bajo la clave `"sesion"`, `identidad`), cada uno disparándose cuando cambia su dependencia correspondiente (y sólo si `cargando` ya es `false`, para no pisar el storage con el estado semilla antes de terminar de cargar lo guardado).

### Reinicio de datos
`handleReset`: borra las cuatro claves de `window.storage` (usando `Promise.allSettled` para que el fallo de una — por ejemplo, por no existir todavía — no impida borrar las demás; esto corrigió un bug real donde el botón "parecía no funcionar" porque un `try/catch` envolvía las cuatro llamadas `await` secuenciales y la primera falla cortaba la ejecución de las siguientes) y reinicializa `cuentas`/`datos` a los valores semilla.

**Limitación crítica y documentada explícitamente:** esta persistencia **sólo funciona dentro de Claude.ai**. Si el archivo se ejecuta en un proyecto Vite/React normal (fuera del entorno de artefactos), `window.storage` no existirá y todo el guardado fallará silenciosamente (los `.catch(() => {})` tragan el error). Antes de usar este código fuera de Claude.ai hay que reemplazar esta capa por algo real (IndexedDB, `localStorage`, o un backend).


## 3.15 Ajustes de experiencia de usuario (UX) implementados

Estos son cambios transversales, no un módulo en sí, pero están documentados porque fueron pedidos explícitamente y consumieron trabajo real:

- **Inputs numéricos sin flechas de subir/bajar**: se inyecta un `<style>` global (dentro del JSX de retorno del componente raíz) que oculta las flechitas nativas del navegador en todos los `<input type="number">` de la aplicación (reglas `::-webkit-outer-spin-button`, `::-webkit-inner-spin-button` y `-moz-appearance: textfield`).
- **Selección automática al enfocar un input numérico** (`onFocus={(e) => e.target.select()}`), para poder escribir un valor nuevo sin tener que borrar manualmente el que ya estaba.
- **Los campos numéricos no fuerzan "0" mientras se escribe**: los estados de formulario que representan números se guardan como *strings* mientras se edita (no se hace `Number(valor) || 0` en cada tecla), y sólo se convierten a número al confirmar/guardar. Antes, varios inputs (por ejemplo, los de `VitrinaRow` y los del contador de billetes `DenomCounter`) hacían la conversión a número en cada `onChange`, lo que provocaba que el campo mostrara "0" apenas se borraba el contenido, interrumpiendo la escritura.

---

# 4. Funcionalidades futuras (planificadas, no implementadas)

Esta lista refleja el roadmap acumulado en la página de Notion del proyecto y en las conversaciones de desarrollo, incluyendo ideas surgidas en sesiones paralelas con ChatGPT. Se agrupan por bloque temático, y para cada una se indica qué se sabe sobre cómo debería implementarse (cuando se discutió) y cómo interactuaría con el resto del sistema.

## 4.1 Correcciones técnicas ya identificadas como necesarias

### Costo histórico por venta
**Problema:** hoy, "Ganancia potencial" en Reportes se calcula usando el **costo actual** del producto (`producto.costo`, leído en el momento de generar el reporte), no el costo que tenía el producto en el momento exacto de cada venta. Si el dueño sube o baja el costo de un producto después de haber vendido unidades, las ganancias históricas de esas ventas viejas se recalculan mal (retroactivamente, con el costo nuevo).

**Cómo debería implementarse:** al confirmar una venta (`handleCobrar` en `VentasView`), cada ítem del ticket debería guardar una copia congelada del costo del producto en ese momento, por ejemplo agregando un campo `costoUnitario` (o `costoEnVenta`) a cada entrada de `ticket.items`:
```js
items: cartItems.map((c) => ({
  nombre: c.product.nombre,
  cantidad: c.cantidad,
  subtotal: c.product.venta * c.cantidad,
  costoUnitario: c.product.costo, // <-- nuevo campo, "foto" del costo al momento de la venta
})),
```
Y el cálculo de `gananciaPotencial` en `ReportesView` debería usar `it.costoUnitario` en vez de buscar el producto en `products` y leer su costo actual. Esto es un cambio acotado y de bajo riesgo, ya identificado con precisión — se recomienda como primera tarea para quien continúe el proyecto.

## 4.2 Stock avanzado

- **Actualización masiva de precios**: por porcentaje, por monto fijo, por categoría, o por proveedor (cuando exista el concepto de proveedor). No hay diseño de UI decidido todavía.
- **Precio sugerido según % de ganancia deseado**: idea surgida en las charlas con ChatGPT — "podés ver las 'ganancias' tocás y te abre un menú donde ganancias totales y las de ventas totales, que sería restándole el valor del producto". La idea concreta discutida: un panel de Ganancias **clickeable** (a diferencia de las tarjetas actuales, que sólo muestran números), que al tocarse abre el detalle de ganancias por venta/producto, y a futuro también "pérdidas" por mercadería comprada que no se vendió, se venció, etc.
- **Productos relacionados o sustitutos.**
- **Importación de productos desde Excel/CSV.**
- **Historial de precios como vista propia** (hoy está cubierto parcialmente porque las ediciones ya quedan en el historial del producto, pero no hay una vista dedicada sólo a la evolución de precios).

## 4.3 Estadísticas avanzadas (lo que falta del bloque de Reportes)

- **Productos sin movimiento**: productos que no tuvieron ninguna venta en el período seleccionado (hoy sólo se calcula más vendido/menos vendido entre los que sí se vendieron).
- **Tiempo promedio en vitrina**: cuánto tiempo pasa, en promedio, un producto en la vitrina antes de venderse. Requeriría registrar cuándo se repuso en vitrina y cuándo se vendió, y no está diseñado todavía.

## 4.4 Auditoría (lo que falta)

- **Detección de tickets duplicados** (por ejemplo, dos ventas idénticas en un lapso muy corto, que podrían indicar un doble cobro accidental).
- **Vista de auditoría recortada para el rol "Administrador"**: hoy la pantalla completa de Administración (incluida la Auditoría) es exclusiva del Dueño/superAdmin. La idea discutida (tomada de la bitácora de ChatGPT) era que un empleado con rol "Administrador" pudiera ver al menos la parte "Operativa" de la auditoría de su propio negocio, sin acceso a lo "Técnico" ni a la gestión de roles/empleados. Esto requeriría replantear el modelo de permisos, ya que hoy `"administracion"` es un permiso monolítico reservado sólo al Dueño.
- **Colores distintivos por persona** en la auditoría (hoy el nombre aparece siempre en texto plano gris, sin un color consistente asignado a cada usuario).

## 4.5 Segunda etapa (planificada explícitamente para después de la portabilidad)

- **Backups**: automáticos (local y en la nube), manuales, con versionado e historial, y restauración. No hay ningún trabajo iniciado.
- **Importación/exportación a Excel/CSV** de productos, stock, caja, ventas y reportes.
- **Vencimientos de productos**: fecha de vencimiento, alertas de productos próximos a vencer o ya vencidos.
- **Personalización visual**: logo del negocio, colores, nombre del negocio reflejado en la interfaz (hoy el nombre del negocio ya se muestra en el sidebar, pero no hay theming ni logo).

## 4.6 Bloque "Futuro" (menor prioridad, ideas más abiertas)

- Dashboard "inteligente" (más allá del panel de indicadores actual).
- Centro de notificaciones centralizado.
- Productos favoritos.
- Venta rápida (botones de acceso directo a los productos más vendidos, para no tener que buscar).
- Atajos de teclado.
- Sistema de proveedores (hoy no existe el concepto de proveedor en el modelo de datos).
- **Animaciones/transiciones** entre pantallas (hoy los cambios de vista son instantáneos, sin ningún tipo de fade/slide).
- **Sugerencia de promociones según calendario/fechas** (idea de ChatGPT: sugerir promociones para fechas especiales del año).

## 4.7 Rediseño de la pantalla de Administración para el superAdmin

Idea pendiente, surgida en la última ronda de trabajo: hoy, cuando el superAdmin (Juan) entra a Administración, el diseño puede sentirse como si ya estuviera "dentro" de un negocio en particular. La idea es rediseñarlo para que por defecto sea un panel de control limpio y neutral (por ejemplo, con un bloc de ideas o notas de errores de la aplicación), y que sólo al elegir explícitamente un negocio se carguen los menús específicos de ese negocio. No se implementó todavía; quedó explícitamente pospuesta ("lo dejamos para después" fueron las palabras del usuario).

## 4.8 Empaquetado como aplicación de escritorio portable (Tauri)

Este es, en la visión del usuario, el paso final antes de poder repartir la aplicación a clientes reales. Discutido en detalle durante el desarrollo (ver sección 15 para la comparación técnica completa entre alternativas). Resumen de lo decidido:
- Se usará **Tauri**, no Electron, por generar un ejecutable mucho más liviano (~10-20 MB vs. ~150-200 MB), ya que Tauri usa el motor **WebView2** que Windows 10/11 ya trae instalado, en vez de empaquetar una copia completa de Chromium.
- El resultado debe ser un `.exe` en **modo portable**: el cliente lo descarga y hace doble clic, sin instalador, sin pedir permisos de administrador.
- Requisitos para el desarrollador (el usuario): tener **Node.js** y **Rust** instalados en su computadora.
- Requisito para el cliente final: Windows 10/11 con WebView2 (presente por defecto en la enorme mayoría de instalaciones actualizadas).
- **No hay actualización automática** prevista: cada vez que se agregue una función nueva habrá que volver a generar el `.exe` y volver a distribuirlo manualmente.
- Este paso requiere, como prerrequisito, tener el proyecto en una estructura de carpetas real (Vite + React), no como artefacto de un solo archivo dentro de Claude.ai — ver sección 15.


---

# 5. Arquitectura del proyecto

## 5.1 Framework y lenguaje

- **React** (funciones de componente + Hooks: `useState`, `useMemo`, `useEffect`). No usa clases en ningún lugar.
- **JavaScript (JSX)**, no TypeScript. No hay ningún tipo de anotación de tipos ni interfaces — todo el "contrato" de forma de los datos está documentado únicamente en comentarios y en la forma en que se usan los objetos (ver sección 6 para el detalle de cada estructura).
- Estilos con **Tailwind CSS** (clases utilitarias directamente en el JSX, sin archivos `.css` propios, salvo el `<style>` global embebido para ocultar las flechas de los inputs numéricos — ver 3.15).
- Íconos de la librería **`lucide-react`**.

## 5.2 Dependencias externas usadas

Del `import` en la cabecera del archivo:
```js
import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search, Plus,
  Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle, ArrowDownCircle,
  Clock, Lock, Users, ClipboardList, Wallet, CreditCard, MessageCircle, CheckCircle2,
  PackageCheck, History, UserPlus, Banknote, ChevronRight,
} from "lucide-react";
```
No se usa ninguna otra librería (no hay `recharts`, no hay `axios`, no hay `date-fns`, no hay librería de formularios, no hay router). Todo el formateo de fechas y moneda se hace con la API nativa de JavaScript `Intl` (a través de `toLocaleString("es-AR", ...)` y `toLocaleDateString`/`toLocaleTimeString`).

## 5.3 Por qué es un solo archivo (organización del proyecto)

Esta es la decisión arquitectónica más importante a entender antes de tocar el código. **No existe todavía una carpeta `src/`, ni `components/`, ni `hooks/`, ni `services/`.** Todo — cada componente, cada modal, cada helper, las constantes de configuración, y el componente raíz — vive en un único archivo `KioscoApp.jsx` de ~5.845 líneas.

**Motivo:** el desarrollo ocurre dentro del chat de Claude.ai, usando su sistema de "artefactos" de React, que **sólo puede compilar y previsualizar en vivo un componente si está contenido en un único archivo**. Separar el código en múltiples archivos ahora significaría perder la posibilidad de ver los cambios reflejados en tiempo real dentro de la conversación — habría que migrar a un proyecto de verdad (por ejemplo, con Claude Code, corriendo Vite localmente) para poder seguir separando en módulos y a la vez ver resultados.

**Se decidió explícitamente posponer la modularización** hasta el momento en que el proyecto se traslade a un entorno de desarrollo local real, coincidiendo con el trabajo de empaquetado con Tauri (sección 4.8). La estructura de carpetas que se planificó para ese momento (sugerida originalmente por ChatGPT y aceptada como buena práctica) es:
```
src/
  App.tsx
  components/
    Caja/
    Stock/
    Compras/
    Clientes/
    Reportes/
    Vitrina/
  hooks/
  services/
  utils/
  types/
  constants/
```
Nótese que esta estructura de referencia usa `.tsx` (TypeScript) — no se decidió formalmente migrar a TypeScript, pero la sugerencia original la incluía; queda como una decisión abierta para quien continúe el proyecto (ver sección 25, Recomendaciones).

## 5.4 Organización interna del archivo actual

Aunque es un solo archivo, tiene un orden interno consistente, de arriba hacia abajo:

1. **Imports** (React, íconos).
2. **Constantes de configuración de nivel de módulo**: `NAV_ITEMS`, `HOME_CARDS`, `CATEGORIES`, `UNIDAD_GRUPOS`, `DENOMINACIONES`, `UMBRAL_DIFERENCIA_INUSUAL`, `PERMISOS_MENU`, `PERMISOS_DUENO`, `CATEGORIA_TECNICA`, `MEDIOS_PAGO`.
3. **Funciones helper puras** (sin JSX): `unidadInfo`, `nowFecha`, `historialEntry`, `nombreIdentidad`, `money`, `isWithinRange`, `calcularVuelto`, `categoriaEvento`, `permisosDe`, `rolesPorDefecto`, `seedCuentas`, `seedDatos`, `defaultDataset`.
4. **Datos semilla**: `INITIAL_PRODUCTS`.
5. **Componentes de layout**: `Sidebar`, `Home`, `DashboardCard`, `SectionHeader`.
6. **Componentes de Stock**: `ProductModal`, `ScanModal`, `HistorialProductoModal`, `StockView`.
7. **Componentes de Vitrina**: `VitrinaRow`, `VitrinaView`.
8. **Componentes de Caja** (el bloque más largo): `DenomCounter`, `LegacyAperturaModal`, `LegacyCierreModal` (código muerto), `AperturaModal`, `CierreModal`, `HistorialCajaModal`, `MovimientoModal`, `MovimientosModal`, `MercadoPagoBadge`, `CobrarModal`, `CartQtyInput`.
9. **Componente de Ventas**: `VentasView` (el componente individual más grande del archivo).
10. **Componentes de Reportes**: `isWithinRange`, `StatCard`, `MotivoBorradoModal`, `ReportesView`.
11. **Componentes de Compras**: `CopiarTextoModal`, `RecepcionGenericaModal`, `ComprasView`.
12. **Componentes de Clientes/Fiado**: `ClienteModal`, `PagoModal`, `DeudaManualModal`, `VincularTicketModal`, `ClienteRow`, `ClientesView`.
13. **Componentes de Login**: `LoginView`.
14. **Componentes de Administración**: `LegacyAdministracionView` (código muerto), `EditarMovimientoModal`, `EmpleadoModal`, `AdministracionView`.
15. **Constantes y helpers de nivel superior relacionados con multi-negocio**: `defaultDataset`, `CATEGORIA_TECNICA`, `categoriaEvento`, `PERMISOS_MENU`, `PERMISOS_DUENO`, `permisosDe`, `rolesPorDefecto`, `seedCuentas`, `seedDatos`.
16. **Componente raíz**: `export default function KioscoApp()`, que contiene todo el estado global, los `useEffect` de persistencia, los `makeSetter`, los handlers de login/registro/logout/reset, el cálculo de permisos, el switch de navegación (`renderView`), y el JSX de layout final (`Sidebar` + panel de contenido).

## 5.5 Manejo del estado (no hay Context API, no hay Redux, no hay Zustand)

Todo el estado vive en el componente raíz `KioscoApp` usando `useState`, y se distribuye hacia abajo **exclusivamente por props** (prop drilling clásico, sin ningún Context Provider). Esto es coherente con el estilo del proyecto (simplicidad ante todo, mientras se valida la funcionalidad), pero es también una de las áreas candidatas a refactor cuando se modularice (ver sección 25).

Estados principales en `KioscoApp`:
```js
const [view, setView] = useState("home");              // vista actual (string: "home", "stock", "ventas", ...)
const [cargando, setCargando] = useState(true);         // true mientras se carga el storage
const [cuentas, setCuentas] = useState(seedCuentas());  // array de negocios/Dueños
const [datos, setDatos] = useState(seedDatos());        // diccionario { [cuentaId]: datasetCompleto }
const [currentUserId, setCurrentUserId] = useState(null); // id del negocio actualmente operado
const [identidad, setIdentidad] = useState(null);       // { rol, nombre, superAdmin }
const [loginError, setLoginError] = useState("");
```

No hay hooks personalizados (`useAlgo`) todavía — toda la lógica de negocio vive directamente dentro de cada componente de pantalla, como funciones `handleX` locales.

## 5.6 Navegación

No se usa ningún router (ni `react-router`, ni nada similar). La "navegación" es simplemente el estado `view` (un string) que determina, mediante un `switch` dentro de `renderView()`, qué componente de pantalla se muestra dentro del panel principal. `handleNavigate(id)` es la única función que cambia `view`, y aplica la verificación de permisos antes de aceptar el cambio.

## 5.7 Persistencia

Ver sección 3.14 para el detalle funcional. Técnicamente, se usa la API `window.storage` (get/set/delete, todas asíncronas y basadas en promesas), que **es específica del entorno de artefactos de Claude.ai** y no existe en un navegador o proyecto normal. No hay ninguna otra capa de persistencia (no hay `localStorage`, no hay IndexedDB, no hay backend).

## 5.8 Manejo de errores

- Prácticamente todo el manejo de errores del proyecto se reduce a `.catch(() => {})` alrededor de las llamadas a `window.storage`, y a `try { JSON.parse(...) } catch {}` al leer del storage. **No hay un sistema de manejo de errores de UI** (no hay error boundaries de React, no hay toasts de error genéricos, no hay logging).
- No hay validación de datos de entrada más allá de lo mínimo indispensable para la lógica de negocio (por ejemplo, no se puede guardar un producto sin nombre; no se puede confirmar un cobro en efectivo si el monto recibido es menor al total).

## 5.9 Rendimiento

- Se usa `useMemo` puntualmente para listas filtradas/calculadas costosas (por ejemplo, el `ranking` de productos en Reportes, los resultados de búsqueda en Stock/Ventas/Compras).
- No hay virtualización de listas largas (si un negocio tuviera miles de productos o tickets, el rendimiento de renderizado podría degradarse — no se probó a esa escala).
- No hay memoización de componentes (`React.memo`) en ningún lugar.

## 5.10 Escalabilidad (estado actual, honesto)

El proyecto **no está diseñado para escalar más allá de un uso de demostración/prototipo dentro de Claude.ai**. Los puntos que lo limitan explícitamente:
- Todo el estado de todos los negocios vive en la memoria de un único componente de React, en el navegador de quien tiene la sesión de Claude.ai abierta — no hay forma de que dos personas distintas, en dos dispositivos distintos, vean o modifiquen los mismos datos en tiempo real (no hay sincronización entre dispositivos, ver sección 11).
- El almacenamiento (`window.storage`) no tiene límite de tamaño documentado que se haya verificado, pero al guardar el objeto `datos` completo (todos los negocios, todos los productos, todos los tickets) en una sola clave cada vez que cambia cualquier cosa, el costo de cada guardado crece con el tamaño total de los datos — esto podría volverse lento con muchos negocios/productos/tickets acumulados.


---

# 6. Base de datos (estructuras de datos — no hay motor de base de datos real)

**Aclaración importante:** no existe una base de datos en el sentido tradicional (no hay SQL, no hay MongoDB, no hay Firebase). Lo que sigue es la descripción completa de **todas las estructuras de datos en memoria** que cumplen ese rol, ya que son la única fuente de verdad de la aplicación mientras corre.

## 6.1 `cuentas` (array) — identidad de cada negocio/Dueño

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Identificador único (se genera con `Date.now()` al crear, o fijo `1`/`2` para las cuentas semilla) |
| `nombre` | string | Nombre de la persona Dueña |
| `usuario` | string | Usuario de login (único entre cuentas y entre todos los empleados de todas las cuentas) |
| `password` | string | Contraseña en **texto plano** (sin hash) |
| `nombreNegocio` | string | Nombre comercial del negocio, se muestra en el sidebar |
| `superAdmin` | boolean | Si es `true`, esta cuenta ve el panel consolidado de todos los negocios en Administración |
| `roles` | array | Roles definidos para este negocio, ver 6.1.1 |
| `empleados` | array | Empleados de este negocio, ver 6.1.2 |

### 6.1.1 `roles` (dentro de una cuenta)
| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | string | Nombre del rol (ej. "Administrador", "Cajero", o uno personalizado) |
| `permisos` | array de string | Subconjunto de `PERMISOS_MENU` (`stock`, `vitrina`, `ventas`, `compras`, `clientes`, `reportes`) que este rol puede ver. Nunca incluye `"administracion"`. |

### 6.1.2 `empleados` (dentro de una cuenta)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Identificador único |
| `nombre` | string | Nombre de la persona |
| `usuario` | string | Usuario de login |
| `password` | string | Contraseña en texto plano |
| `rol` | string | Debe coincidir con el `nombre` de un rol existente en `cuentas[].roles` |

## 6.2 `datos` (diccionario, clave = `cuentas[].id`) — dataset completo por negocio

Cada valor tiene la forma que genera `defaultDataset(seed)`:

| Campo | Tipo | Descripción |
|---|---|---|
| `products` | array | Ver 6.3 |
| `caja` | objeto | Ver 6.4 |
| `tickets` | array | Ver 6.5 |
| `clientes` | array | Ver 6.6 |
| `comprasItems` | array | Ver 6.7 |
| `cajaAbierta` | boolean | Si la caja está abierta actualmente |
| `cart` | array | Carrito de venta en curso, persistente entre navegaciones. Cada ítem: `{ productId, cantidad }` |
| `sugerenciasProductos` | array | Ver 6.8 |

## 6.3 `products` (array, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Identificador único |
| `nombre` | string | — |
| `codigo` | string | Código de barras, puede ser cadena vacía |
| `costo` | number | Precio de costo por unidad base |
| `venta` | number | Precio de venta por unidad de venta |
| `deposito` | number | Cantidad en depósito, en unidad base (admite decimales si `unidad` es peso/volumen) |
| `vitrina` | number | Cantidad en vitrina, en unidad base |
| `minimo` | number | Umbral de alerta de stock bajo (comparado contra `deposito`) |
| `alertaVitrina` | number | Umbral de alerta de reposición en vitrina (comparado contra `vitrina`) |
| `categoria` | string | Uno de `CATEGORIES = ["Sin categoría", "Bebidas", "Golosinas", "Almacén", "Higiene"]` |
| `unidad` | string | `"unidad"` \| `"peso"` \| `"volumen"` |
| `historial` | array | Ver 6.3.1 |

### 6.3.1 `historial` (dentro de cada producto)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | `Date.now() + Math.random()` — timestamp con desempate aleatorio, sirve para ordenar cronológicamente |
| `tipo` | string | `"creacion"` \| `"edicion"` \| `"reposicion"` \| `"venta"` |
| `detalle` | string | Texto descriptivo del evento (incluye motivo cuando aplica) |
| `quien` | string | Nombre + rol de quien hizo la acción, o `"Sistema"` para eventos automáticos/semilla |
| `fecha` | string | Fecha/hora formateada con `toLocaleString("es-AR")` — **no es un ISO string**, ver limitación en 5.10/16 |

## 6.4 `caja` (objeto, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `saldo` | number | Saldo actual de la caja física |
| `movimientos` | array | Ver 6.4.1 |
| `historial` | array | Ver 6.4.2 |

### 6.4.1 `movimientos` (ingresos/retiros)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Incremental dentro de este negocio (`length + 1`) |
| `tipo` | string | `"ingreso"` \| `"retiro"` |
| `monto` | number | — |
| `nota` | string | Texto libre |
| `quien` | string | — |
| `fecha` | string | `toLocaleString("es-AR")` |
| `eliminado` | boolean (opcional) | Si es `true`, el movimiento se muestra tachado pero no se borra |

### 6.4.2 `historial` (aperturas, cierres, correcciones, auditoría técnica)
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Incremental dentro de este negocio |
| `tipo` | string | `"apertura"` \| `"cierre"` \| `"correccion"` \| `"eliminacion_movimiento"` \| `"eliminacion_ticket"` \| `"auditoria_tecnica"` |
| `monto` | number (opcional) | Monto de apertura o monto contado en el cierre |
| `esperado` | number (opcional) | Sólo en `"cierre"`: saldo que se esperaba encontrar |
| `diferencia` | number (opcional) | Sólo en `"cierre"` con conteo: `contado - esperado` |
| `detalle` | string/objeto (opcional) | Detalle de billetes contados, o texto descriptivo según el tipo |
| `contado` | boolean (opcional) | Si se contaron billetes o no, en apertura/cierre |
| `inusual` | boolean (opcional) | Sólo en `"cierre"`: `true` si `|diferencia| >= 1000` |
| `quien` | string | — |
| `fecha` | string | — |

## 6.5 `tickets` (array, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | Incremental (`tickets.length + 1` al momento de crearse) |
| `fecha` | string | **ISO 8601** (`new Date().toISOString()`) — a diferencia de los demás historiales, este sí es ISO, lo cual permite agrupar por día con `slice(0, 10)` y por hora con `new Date(fecha).getHours()` en Reportes |
| `medio` | string | `"Efectivo"` \| `"Mercado Pago"` \| `"Transferencia"` \| `"Tarjeta"` \| `"Cuenta corriente"` |
| `clienteId` | number \| null | Sólo si `medio === "Cuenta corriente"` |
| `quien` | string | Quien realizó la venta |
| `items` | array | `{ nombre, cantidad, subtotal }` por cada producto vendido (no guarda `productId` ni el costo — ver limitación de "costo histórico" en sección 4.1) |
| `total` | number | Suma de los `subtotal` de todos los ítems |

## 6.6 `clientes` (array, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | — |
| `nombre` | string | — |
| `telefono` | string (opcional) | — |
| `saldo` | number | Deuda actual (positivo = debe) |
| `movimientos` | array | `{ id, tipo: "deuda"\|"pago", monto, nota, quien, fecha }` |

## 6.7 `comprasItems` (array, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number/string | Generado con `nuevoItemId()` o `Date.now()` según el punto de creación |
| `productId` | number \| null | `null` si es un ítem genérico no vinculado a Stock |
| `nombre` | string | — |
| `cantidad` | number | Cantidad pedida |
| `estado` | string | `"pendiente"` \| `"pedido"` \| `"recibido"` |
| `origen` | string (opcional) | Por ejemplo `"nuevo-producto"` cuando se creó junto con un producto nuevo |
| `recibidoPor` | string (opcional) | Quién confirmó la recepción |
| `recibidoFecha` | string (opcional) | Cuándo se recibió |
| `pendienteAprobacion` | boolean (opcional) | `true` si se recibió pero el alta del producto en Stock quedó como sugerencia pendiente (empleado no-Dueño) |

## 6.8 `sugerenciasProductos` (array, dentro de cada negocio)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number | — |
| `data` | objeto | Mismo payload que se usaría para crear el producto directamente (nombre, código, costo, venta, depósito, mínimo, alertaVitrina, categoría, unidad) |
| `sugeridoPor` | string | Nombre + rol de quien la propuso |
| `fecha` | string | — |

## 6.9 Relaciones entre estructuras (equivalente a "claves foráneas")

Dado que no hay un motor de base de datos, las relaciones son simplemente números guardados como referencia, **sin integridad referencial garantizada por el sistema** (es decir, nada impide que quede un `productId` "huérfano" apuntando a un producto ya borrado):

- `comprasItems[].productId` → `products[].id`
- `sugerenciasProductos[].data` no tiene relación con nada (es un producto en potencia, todavía no existe)
- `tickets[].clienteId` → `clientes[].id`
- `datos` (clave) → `cuentas[].id`
- `empleados[].rol` → `roles[].nombre` (relación por nombre de texto, no por id — si se renombra un rol, los empleados que lo tenían asignado quedan con un nombre de rol que ya no existe en `roles`, perdiendo sus permisos; esto es una limitación conocida, ver sección 16)


---

# 7. Flujo completo de la aplicación

Esta sección describe, paso a paso, el recorrido completo de una sesión de uso típica, desde que se abre la aplicación hasta que se cierra, incluyendo los procesos internos que ocurren en cada paso.

## 7.1 Apertura de la aplicación

1. React monta el componente raíz `KioscoApp()`.
2. Se inicializan los estados con sus valores semilla por defecto (`seedCuentas()`, `seedDatos()`), **antes** de saber si hay algo guardado — esto es necesario porque los `useState` deben tener un valor inicial síncrono.
3. Se dispara el `useEffect` de carga inicial (dependencias `[]`), que llama en paralelo a `window.storage.get("cuentas")`, `"datos"`, `"sesion"`, `"identidad"`.
4. Mientras `cargando === true`, se renderiza únicamente el texto "Cargando KioscoApp...".
5. Cuando las cuatro promesas resuelven (con `Promise.allSettled`, así que ninguna bloquea a las demás si falla), cada resultado exitoso reemplaza el estado semilla correspondiente vía `JSON.parse`. Si no había nada guardado (primera vez), los valores semilla quedan tal cual.
6. `cargando` pasa a `false`.
7. Si `currentUserId` sigue siendo `null` (no había sesión guardada, o es la primera vez), se renderiza `LoginView`.
8. Si `currentUserId` tiene un valor recuperado del storage, se salta directo al paso 7.4 más abajo (sesión persistida).

## 7.2 Inicio de sesión (si no había sesión guardada)

1. El usuario elige "Iniciar sesión" o "Crear cuenta" en `LoginView`.
2. **Iniciar sesión:** completa usuario/contraseña, toca "Entrar". `handleLogin` busca coincidencia primero en `cuentas` (Dueños), después recorriendo `empleados` de cada cuenta.
   - Si no encuentra coincidencia: se muestra `loginError` ("Usuario o contraseña incorrectos.").
   - Si encuentra: se setea `currentUserId` (el `id` del negocio correspondiente), se setea `identidad` (`{rol, nombre, superAdmin}`), y `view` se fuerza a `"home"`.
3. **Crear cuenta:** completa nombre, nombre del negocio, usuario, contraseña, toca "Crear cuenta y entrar". `handleRegister` valida que el usuario no exista ya (entre cuentas Dueño), crea la cuenta nueva con `roles: rolesPorDefecto()` y `empleados: []`, crea el dataset vacío correspondiente en `datos`, y loguea automáticamente como Dueño de esa cuenta nueva.
4. En cualquiera de los dos casos, apenas cambia `cuentas`/`datos`/`currentUserId`/`identidad`, se disparan los `useEffect` de guardado automático, escribiendo el nuevo estado en `window.storage`.

## 7.3 Reinicio de datos (opcional, desde el login)

Si el usuario toca "Borrar todos los datos guardados" y confirma dos veces, `handleReset` borra las cuatro claves del storage y reinicializa todo a los valores semilla. Esto sirve, en la práctica, como el único mecanismo de "empezar de cero" del sistema.

## 7.4 Uso de la aplicación ya logueado

1. Se calcula `cuentaActual = cuentas.find(c => c.id === currentUserId)` y `data = datos[currentUserId]`.
2. Se calcula `permisos = permisosDe(identidad, cuentaActual)` — esto determina qué puede ver y hacer la persona logueada en esta sesión (recalculado en cada render, no una sola vez).
3. Se renderiza el layout: `Sidebar` (a la izquierda, con los ítems de menú filtrados por `permisos`, badges de alerta de Stock/Vitrina si corresponde, y el pie con nombre/rol/usuario y botón de Cerrar sesión) + el panel principal (a la derecha), que muestra el resultado de `renderView()`.
4. Por defecto, `view === "home"`, por lo que se muestra `Home` (el Dashboard), con las tarjetas de indicadores y los accesos rápidos.
5. Cada vez que el usuario toca un ítem del menú o una tarjeta, se llama a `handleNavigate(id)`, que valida el permiso y, si corresponde, cambia `view`.
6. Dentro de cada pantalla (Stock, Vitrina, Ventas, Compras, Clientes, Reportes, Administración), las acciones del usuario (crear un producto, cobrar una venta, editar un movimiento, etc.) llaman a los setters correspondientes (`setProducts`, `setCaja`, etc.), que **siempre** terminan escribiendo dentro de `datos[currentUserId]` a través del patrón `makeSetter`.
7. Cualquier cambio de estado en `cuentas` o `datos` dispara automáticamente el guardado a `window.storage` (ver 7.6).

## 7.5 Ejemplo de flujo interno completo: una venta de punta a punta

Para ilustrar cómo interactúan los módulos entre sí, este es el recorrido interno completo de una venta típica:

1. El cajero entra a "Ventas / Caja". Si la caja está cerrada, ve la pantalla "¿Arrancamos?" y toca "Abrir caja".
2. Se abre `AperturaModal`. El cajero elige contar o no los billetes, confirma. `handleAperturaConfirm` actualiza `caja.saldo`, agrega un movimiento de ingreso y una entrada de historial de apertura, y pone `cajaAbierta = true`.
3. El cajero busca un producto (por nombre o código) y lo agrega al carrito. El carrito (`cart`) se actualiza vía `setCart`, quedando persistido en `datos[currentUserId].cart` — si el cajero se va a otra pantalla y vuelve, el carrito sigue ahí.
4. El cajero ajusta la cantidad con los botones +/- o tipeando directamente en `CartQtyInput`.
5. El cajero toca "Cobrar". Se abre `CobrarModal`, elige el medio de pago (por ejemplo, Efectivo), tipea el monto recibido, ve el vuelto calculado y el desglose de billetes sugerido, y confirma.
6. `handleCobrar` ejecuta, en este orden:
   - Recorre cada producto del carrito y le resta la cantidad vendida a `vitrina` (con la conversión de unidad si corresponde), agregando una entrada de historial `"venta"` a cada producto.
   - Crea el ticket nuevo en `tickets`.
   - Si el medio fue Efectivo, suma el total a `caja.saldo` y agrega un movimiento de ingreso.
   - Vacía el carrito.
7. El cajero puede repetir el proceso para más ventas. Cada venta actualiza en tiempo real: el stock en Vitrina (visible en `VitrinaView` y en el Dashboard), el saldo de caja (visible en el header de `VentasView` y en el Dashboard), y las estadísticas de `ReportesView` (que recalcula todo a partir de `tickets` cada vez que se renderiza, sin necesidad de ningún paso adicional).
8. Al final del turno, el cajero (o el Dueño) toca "Cerrar caja". Se abre `CierreModal`, se cuenta o no el efectivo, se confirma. `handleCierreConfirm` calcula la diferencia (si se contó), marca `inusual` si corresponde, agrega la entrada de historial de cierre, resetea `caja.saldo` a 0, y pone `cajaAbierta = false`.
9. Todo esto queda visible después para el Dueño en Administración → Auditoría, categorizado como eventos "Operativo" (la venta en sí, la apertura, el cierre) — salvo que se haya necesitado corregir algo después, en cuyo caso esas correcciones aparecen como "Técnico".

## 7.6 Guardado continuo (en paralelo a todo lo anterior)

Cada vez que cambia `cuentas`, `datos`, `currentUserId` o `identidad`, el `useEffect` correspondiente escribe el nuevo valor (serializado con `JSON.stringify`) en la clave de `window.storage` correspondiente (`"cuentas"`, `"datos"`, `"sesion"`, `"identidad"`), de forma asincrónica y sin bloquear la interfaz. Si la escritura falla, el error se ignora silenciosamente (`.catch(() => {})`) — no hay reintento ni aviso al usuario.

## 7.7 Cierre de la aplicación / cierre de sesión

- **Cerrar sesión** (botón en el pie del `Sidebar`, `handleLogout`): pone `currentUserId` e `identidad` en `null`, y `view` vuelve a `"home"` — lo cual, al no haber `currentUserId`, hace que se renderice `LoginView` de nuevo. Los datos del negocio (`datos[currentUserId]`) **no se borran**, siguen en `window.storage` para la próxima vez que alguien inicie sesión en esa cuenta.
- **Cerrar la pestaña/conversación de Claude.ai**: no hay ningún evento explícito de "beforeunload" — simplemente, al haber persistencia automática en cada cambio de estado, todo lo que se haya hecho hasta el último cambio ya está guardado. No hay pérdida de datos por cierre abrupto, salvo que el guardado a `window.storage` de ese último cambio no haya llegado a completarse (condición de carrera teóricamente posible, no observada ni mitigada explícitamente).


---

# 8. Sistema de usuarios y permisos

(Complementa la sección 3.3, con foco en las reglas de identificación y auditoría de acciones.)

## 8.1 Todos los roles existentes

1. **Administrador de la app / superAdmin** — no es un "rol" en el sentido de `cuentas[].roles`; es un booleano (`cuenta.superAdmin`) sobre una cuenta de Dueño. Hoy sólo la cuenta semilla `demo` (Juan) lo tiene en `true`. Ve todos los negocios en Administración y puede operar cualquiera.
2. **Dueño** — rol implícito de cualquier cuenta en `cuentas` quien inicia sesión con las credenciales de la cuenta misma (no de un empleado). Siempre tiene acceso a las 7 secciones (`PERMISOS_DUENO`). Ve sólo su propio negocio en Administración, salvo que además sea `superAdmin`.
3. **Administrador** (rol de empleado, por defecto) — permisos por defecto: `stock, vitrina, ventas, compras, clientes, reportes`. No ve Administración.
4. **Cajero** (rol de empleado, por defecto) — permisos por defecto: `stock, vitrina, ventas`.
5. **Roles personalizados** — cualquier nombre que el Dueño decida, con cualquier combinación de los 6 permisos de menú. Se crean desde el editor de "Roles y permisos" en Administración, o directamente al dar de alta un empleado eligiendo "+ Crear rol nuevo...".

## 8.2 Permisos (los seis "permisos de menú" + el permiso de administración)

```js
const PERMISOS_MENU = ["stock", "vitrina", "ventas", "compras", "clientes", "reportes"];
const PERMISOS_DUENO = [...PERMISOS_MENU, "administracion"];
```
Cada permiso corresponde 1 a 1 con un ítem de `NAV_ITEMS` (y por lo tanto con una pantalla completa). **No existen permisos más granulares** (por ejemplo, no se puede dar acceso a "ver Stock pero no editar precios" — el permiso es de todo o nada por pantalla). Esta granularidad es una limitación conocida, discutida como posible mejora futura (ver sección 16 y 25).

## 8.3 Restricciones aplicadas en múltiples capas (defensa en profundidad)

1. **Sidebar**: no muestra en el menú los ítems fuera de `permisos`.
2. **Home**: no muestra las tarjetas de acceso rápido ni las tarjetas del Dashboard fuera de `permisos`.
3. **`handleNavigate`**: ignora los intentos de cambiar `view` a algo fuera de `permisos`.
4. **`renderView()`**: como última barrera, si por cualquier motivo `view` quedó en un valor no permitido (por ejemplo, estado residual de una navegación previa con otro rol), fuerza el render de `Home` en lugar de la vista pedida.
5. **Dentro de cada pantalla**: algunas decisiones adicionales de UI dependen del rol exacto, no sólo del permiso de sección — por ejemplo, en `StockView` y `ComprasView`, la variable `esDueño = identidad?.rol === "Dueño"` determina si la creación de un producto se aplica directo o se convierte en una sugerencia pendiente (ver 3.13). Este chequeo es **más estricto que el permiso de sección**: aunque un rol tenga el permiso `"stock"` habilitado, si esa persona no es el Dueño exacto, no puede dar de alta productos directamente.

## 8.4 Auditoría de acciones y cómo se identifica quién hizo cada cambio

El mecanismo central es la función:
```js
const nombreIdentidad = (identidad) => identidad ? `${identidad.nombre} (${identidad.rol})` : "Sistema";
```
Este string (por ejemplo, `"Lucía (Cajero)"`) se guarda en el campo `quien` de **absolutamente todos** los registros de historial del sistema:
- Historial de producto (creación, edición, reposición, venta).
- Historial de caja (apertura, cierre, correcciones, eliminaciones, auditoría técnica).
- Movimientos de caja (ingreso/retiro).
- Tickets de venta (`quien` a nivel del ticket completo).
- Movimientos de clientes (deuda/pago).
- Sugerencias de productos (`sugeridoPor`).
- Recepciones de compras (`recibidoPor`).

**No hay un registro separado de "sesiones" o "logins"** (no se guarda cuándo alguien inició sesión, sólo qué acciones hizo una vez logueado). Tampoco hay un log de intentos fallidos de login.


---

# 9. Sistema de auditoría (detalle ampliado)

(Complementa 3.12.)

## 9.1 Qué acciones se registran

| Acción | Dónde queda | Tipo | Categoría |
|---|---|---|---|
| Crear producto | `historial` del producto | `creacion` | Operativo |
| Editar producto (con motivo) | `historial` del producto | `edicion` | Técnico |
| Recibir compra vinculada a un producto | `historial` del producto | `reposicion` | Operativo |
| Vender un producto | `historial` del producto | `venta` | Operativo |
| Abrir caja | `caja.historial` | `apertura` | Operativo |
| Cerrar caja | `caja.historial` | `cierre` | Operativo |
| Corregir un movimiento de caja (con motivo) | `caja.historial` | `correccion` | Técnico |
| Eliminar un movimiento de caja | `caja.historial` | `eliminacion_movimiento` | Técnico |
| Eliminar un ticket (con motivo) | `caja.historial` | `eliminacion_ticket` | Técnico |
| Crear/eliminar un rol, cambiar permisos de un rol, alta/baja de un empleado | `caja.historial` | `auditoria_tecnica` | Técnico |
| Aprobar/rechazar una sugerencia de producto | `caja.historial` | `auditoria_tecnica` | Técnico |

## 9.2 Cómo se registran

Todos usan el mismo patrón: se agrega un objeto nuevo al final del arreglo correspondiente (`historial` de producto, o `caja.historial`), usando `[...arrayViejo, nuevoObjeto]` (inmutabilidad, como corresponde a `setState` de React). El `id` de cada entrada de `caja.historial` es incremental por negocio (`prev.historial.length + 1`); el `id` de cada entrada de `historial` de producto es `Date.now() + Math.random()`.

## 9.3 Qué datos guarda cada registro

Ver el detalle exacto de campos en la sección 6.3.1 y 6.4.2. En resumen, siempre incluye: tipo de evento, un texto descriptivo (`detalle`), quién lo hizo (`quien`), y cuándo (`fecha`). Las correcciones y eliminaciones, específicamente, incluyen además el **motivo** dentro del texto de `detalle`, y el valor "antes" y "después" cuando aplica.

## 9.4 Cómo se consultan

Desde `AdministracionView`, dentro del panel de detalle de un negocio, hay una sub-sección "Auditoría" con:
- Un filtro de tres botones: Todo / Operativo / Técnico.
- Dos columnas: "Caja y cuentas" (eventos de `caja.historial`) y "Productos" (eventos aplanados de todos los `historial` de producto).
- Cada evento muestra: badge de categoría, fecha, texto del detalle, y "Por {quien}".

Además, hay dos vistas de historial más específicas y locales a su contexto:
- `HistorialProductoModal`: el historial completo de un solo producto, accesible desde el ícono de reloj en cada fila de `StockView`.
- `HistorialCajaModal`: el historial de aperturas/cierres de caja, accesible desde el botón "Historial" en `VentasView`.

## 9.5 Cómo ayuda a evitar fraudes o detectar errores/robos

- **Motivo obligatorio en toda corrección**: nadie puede cambiar un precio, corregir un movimiento de caja, o borrar un ticket sin dejar escrito el porqué.
- **Eliminación no destructiva de movimientos de caja**: un movimiento "eliminado" sigue visible (tachado), con su monto original — no se puede hacer desaparecer un ingreso o retiro sin dejar rastro de que existió y de que alguien lo quitó.
- **Diferencias de caja marcadas como "inusuales"**: si al cerrar caja con conteo de billetes la diferencia contra lo esperado supera $1.000 (`UMBRAL_DIFERENCIA_INUSUAL`), se genera una alerta visible tanto en el historial de esa caja como en el panel de Alertas de Administración (y, si quien audita es el superAdmin, se ve consolidado entre todos los negocios).
- **Control de alta de productos por parte de empleados**: un empleado que no es el Dueño no puede agregar productos directamente al Stock; sólo puede "sugerirlos", quedando el alta real supeditada a la aprobación explícita del Dueño (sección 3.13). Esto evita que un empleado infle el catálogo, cargue productos con precios incorrectos, o — en un escenario malicioso — cree productos "fantasma" para manipular el stock.
- **Trazabilidad de nombre + rol en cada acción**, lo que permite reconstruir, ante una sospecha de error o fraude, exactamente quién hizo cada movimiento.

## 9.6 Limitaciones conocidas del sistema de auditoría (honestas)

- No hay un timeline único cronológicamente entrelazado entre eventos de caja y eventos de producto (ver 3.12).
- No hay ningún mecanismo que impida a un Dueño (o a alguien con acceso a esa cuenta) modificar directamente el historial de auditoría por fuera de la interfaz — al no haber backend ni control de integridad, toda "inmutabilidad" del historial es sólo una convención de la interfaz, no una garantía técnica real. Cualquiera con acceso a las herramientas de desarrollador del navegador podría, en teoría, alterar el estado de React directamente.
- No hay auditoría de **quién inició sesión y cuándo** (sólo de las acciones realizadas una vez dentro).
- La vista de Auditoría es exclusiva del Dueño/superAdmin — no existe todavía la "auditoría recortada para el rol Administrador" que se planificó (sección 4.4).


---

# 10. Sistema de stock (lógica completa)

## 10.1 Las dos ubicaciones: Depósito y Vitrina

Cada producto tiene dos cantidades independientes: `deposito` (el stock guardado, no exhibido) y `vitrina` (lo que está exhibido para la venta, por ejemplo en la heladera o estantería del mostrador). **La suma de ambas es el stock total real del producto.** Mover cantidad de una a otra (en `VitrinaView`) no crea ni destruye stock, sólo lo traslada.

## 10.2 Entradas de stock (qué hace que el depósito aumente)

1. **Recepción de una compra vinculada a un producto** (`confirmarRecepcion` en `ComprasView`): suma la cantidad recibida al `deposito`.
2. **Creación de un producto nuevo con stock inicial** (al llenar el campo "Stock en depósito" en el alta).
3. **Aprobación de una sugerencia de producto** por parte del Dueño (el producto se crea con el `deposito` que traía la sugerencia).
4. **Edición manual del campo "Stock en depósito"** desde `ProductModal` (edición directa, requiere motivo si cambia).

## 10.3 Salidas de stock (qué hace que el stock total baje)

1. **Venta**: descuenta de `vitrina` (nunca directamente de `deposito` — la lógica de negocio asume que sólo se vende lo que está exhibido).
2. **Edición manual a la baja** del campo "Stock en depósito" o mover manualmente de vitrina a depósito con un valor menor.

**No existe hoy un concepto de "merma" o "pérdida" registrada como tal** (por ejemplo, producto vencido, roto, robado) — sólo se puede simular editando manualmente el stock a la baja, con el motivo que se le quiera poner en el campo de corrección. La idea de un módulo de "pérdidas" está anotada como pendiente (sección 4.2).

## 10.4 Reposición (traslado de Depósito a Vitrina)

`VitrinaRow` permite tipear el nuevo valor de `vitrina` para un producto. Al guardar:
```js
const diff = numValue - product.vitrina;
onSave(product.id, { vitrina: numValue, deposito: product.deposito - diff, alertaVitrina: numAlerta });
```
Si `diff` es positivo (se aumentó lo exhibido), se resta esa diferencia del depósito. Si es negativo (se retiró de la vitrina), se suma al depósito. Se valida que el nuevo valor de vitrina no sea negativo ni supere el total (`deposito + vitrina` original).

## 10.5 Ajustes y correcciones

Cualquier edición de un producto existente que cambie alguno de sus campos numéricos (incluido el stock) pasa por el flujo de "motivo obligatorio" descripto en 3.5 y 8. No hay una pantalla separada de "ajuste de inventario" — el ajuste es, técnicam000, una edición de producto como cualquier otra.

## 10.6 Casos especiales: unidades de medida

Ver el detalle completo en 3.5. En resumen:
- Productos **"por unidad"**: todo entero, sin conversión (`factor = 1`).
- Productos **"por peso"**: el stock se guarda en Kg (con decimales), pero se vende por gramo. Al vender, la cantidad ingresada en el carrito está en gramos, y se convierte a Kg dividiendo por 1000 antes de descontar de `vitrina`.
- Productos **"por volumen"**: análogo, stock en Litros, venta por mililitro.
- **Nunca se mezclan las unidades entre depósito y vitrina** — ambos campos están siempre en la unidad base (Kg o L), nunca uno en base y otro en la unidad de venta.

## 10.7 Alertas de stock

- **Alerta de stock bajo en depósito**: `deposito <= minimo`. Visible en: banner de `StockView`, badge del `Sidebar`, tarjeta del Dashboard, lista de "Sugeridos por stock bajo" en `ComprasView`.
- **Alerta de reposición en vitrina**: `vitrina <= alertaVitrina`. Visible en: banner de `VitrinaView`, badge del `Sidebar`, tarjeta del Dashboard.
- Ambos umbrales son configurables **por producto** (no hay un umbral global).

---

# 11. Sistema de sincronización

## 11.1 Estado actual: no existe sincronización real

**Esta es una de las limitaciones más importantes del proyecto en su estado actual.** No hay ningún mecanismo de sincronización entre dispositivos, ni online ni offline en el sentido tradicional. Todo el estado vive en la memoria de una única instancia de React, corriendo en un único navegador/sesión de Claude.ai a la vez.

## 11.2 Funcionamiento "online" (dentro de Claude.ai)

En la práctica, "online" hoy significa simplemente: mientras la conversación de Claude.ai esté abierta y `window.storage` esté disponible, los cambios se guardan automáticamente (ver sección 7.6). No hay ningún servidor intermedio, ninguna sincronización con otro dispositivo, ni siquiera con otra pestaña del mismo navegador.

## 11.3 Funcionamiento "offline" (planificado, no implementado)

La visión original del proyecto (documentada en la bitácora de decisiones de Notion) es que la aplicación final, corriendo como ejecutable de escritorio (Tauri), sea **Offline First**: que funcione completamente sin conexión a internet en la computadora del cliente, usando una base de datos local real (se mencionó específicamente **IndexedDB** como la tecnología elegida para esa etapa). Esto **no está implementado todavía** — la persistencia actual (`window.storage`) es exclusiva de Claude.ai y no sirve como base para esto (ver sección 16).

## 11.4 Conflictos y resolución de conflictos

No aplica todavía, porque no hay sincronización entre dispositivos. Si en el futuro se agrega sincronización multi-dispositivo (por ejemplo, un celular y una computadora operando el mismo negocio), habrá que diseñar desde cero una estrategia de resolución de conflictos (las opciones típicas serían "último cambio gana", basado en timestamp, o fusión de campos específicos) — no hay ninguna decisión tomada al respecto todavía.

## 11.5 Orden de operaciones y manejo de fechas

- Los tickets de venta usan fechas en formato **ISO 8601** (`new Date().toISOString()`), lo que permite ordenar y agrupar de forma confiable (por ejemplo, agrupar por día tomando los primeros 10 caracteres del string).
- El resto de los historiales (producto, caja) usan `toLocaleString("es-AR")`, que produce un string **legible pero no ordenable de forma confiable como texto** (por ejemplo, "14/7/2026, 18:32" no se puede comparar alfabéticamente para saber cuál es más reciente). Por eso, el orden cronológico de esos historiales se resuelve usando el campo `id` (incremental o timestamp), **no** el campo `fecha`. Esto es una inconsistencia de diseño documentada (ver sección 16) que convendría unificar en algún momento (por ejemplo, guardando siempre un timestamp numérico además del string legible).

## 11.6 Manejo de múltiples dispositivos

No implementado. Hoy, "usar la app desde el celular y la computadora al mismo tiempo" no es un caso de uso soportado — cada sesión de Claude.ai tiene su propio estado en memoria, y aunque ambas leyeran el mismo `window.storage` (lo cual tampoco está garantizado que sea compartido entre dispositivos), no hay ningún mecanismo de fusión de cambios concurrentes.

---

# 12. Sistema de backups

## 12.1 Estado actual: no implementado

No existe ningún sistema de backups (ni local ni en la nube), ni manual ni automático, ni versionado, ni restauración, más allá de:
- El guardado automático continuo a `window.storage` (que no es un "backup" en sentido estricto — es simplemente el único lugar donde vive el dato, sin copia de seguridad separada).
- El botón "Borrar todos los datos guardados", que hace exactamente lo opuesto a un backup (destruye todo y reinicia a la semilla).

## 12.2 Qué se planificó (sin empezar a implementar)

De la bitácora de decisiones del proyecto:
- Backup automático local.
- Backup automático en la nube.
- Backup manual (a demanda).
- Versionado e historial de backups.
- Restauración desde un backup elegido.

No hay ningún diseño técnico decidido sobre cómo se implementaría esto (no se definió, por ejemplo, si el backup sería un archivo `.json` exportable manualmente, o una sincronización automática con algún servicio en la nube). Esto queda completamente abierto para quien continúe el proyecto.


---

# 13. Diseño de la interfaz

## 13.1 Paleta de colores

No hay un archivo de tema centralizado (no hay `tailwind.config.js` documentado con colores custom) — se usan directamente las clases de color por defecto de Tailwind CSS:

| Uso | Color Tailwind |
|---|---|
| Fondo general / tarjetas | `bg-white`, `bg-gray-50` |
| Texto principal | `text-gray-900` |
| Texto secundario | `text-gray-500`, `text-gray-400` |
| Acento principal / botones primarios | `bg-gray-900` (negro/gris muy oscuro) con texto blanco |
| Éxito / positivo / dinero a favor | `text-green-600`, `bg-green-100` |
| Alerta / atención | `text-amber-600`, `bg-amber-50`, `border-amber-200`/`300` |
| Error / negativo / stock crítico | `text-red-600`, `bg-red-50`, `border-red-200` |
| Categoría "Operativo" (auditoría) | `bg-blue-100 text-blue-700` |
| Categoría "Técnico" (auditoría) | `bg-purple-100 text-purple-700` |
| Medio de pago Efectivo | Verde (`bg-green-500`) |
| Medio de pago Mercado Pago | Celeste (`bg-sky-400`), con un ícono SVG propio (no el logo oficial) |
| Medio de pago Tarjeta | Naranja (`bg-orange-500`) |
| Medio de pago Transferencia | Índigo (`bg-indigo-500`) |
| Medio de pago Cuenta corriente | Gris oscuro (`bg-gray-800`) |

## 13.2 Tipografía

Fuente del sistema (`font-sans` de Tailwind, que hereda la fuente sans-serif por defecto del navegador/sistema operativo). No se importa ninguna tipografía externa (no hay Google Fonts ni `@font-face`).

## 13.3 Estilo visual general

Minimalista, con bordes redondeados (`rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` para badges), bordes finos grises (`border border-gray-200`), sombras suaves sólo en hover (`hover:shadow-sm`, `hover:shadow-md`), y mucho espacio en blanco. El estilo se mantuvo deliberadamente fiel al diseño original que el usuario ya tenía en su versión de Base44 (a partir de capturas de pantalla compartidas al inicio del proyecto), en lugar de proponer un rediseño visual desde cero.

## 13.4 Componentes de interfaz reutilizables

- **Tarjetas de acceso** (`HOME_CARDS`, panel de negocios en Administración): ícono + título + descripción corta, con hover que las eleva levemente (`hover:-translate-y-0.5`).
- **Modales**: patrón consistente en toda la app — fondo oscuro semitransparente (`bg-black/40`) + tarjeta blanca centrada con `X` de cerrar arriba a la derecha, botones "Cancelar"/acción primaria abajo.
- **Badges de estado**: píldoras (`rounded-full`) con fondo de color suave y texto del color fuerte correspondiente (patrón `bg-X-100 text-X-700`).
- **Barras de progreso/gráfico simples**: en los paneles de estadísticas de Reportes (evolución de ventas, ventas por hora, métodos de pago), se usan `<div>` con `width` en porcentaje calculado en JS, **no una librería de gráficos**.

## 13.5 Responsive

Se usan los breakpoints estándar de Tailwind (`md:`, `sm:`) en las grillas (`grid-cols-2 md:grid-cols-4`, por ejemplo), pero el diseño **no fue probado ni optimizado específicamente para pantallas de celular** — está pensado principalmente para una pantalla de mostrador/computadora, ya que su destino final es una aplicación de escritorio.

## 13.6 Tema oscuro / tema claro

**No implementado.** Sólo existe un tema (claro), sin ningún mecanismo de alternancia ni detección de preferencia del sistema operativo.

## 13.7 Iconografía

Toda la iconografía viene de la librería `lucide-react` (íconos de línea, consistentes en estilo y grosor). No hay íconos personalizados en formato de imagen, salvo el `MercadoPagoBadge`, un pequeño SVG dibujado a mano (un círculo celeste con una curva simulando un apretón de manos), creado deliberadamente para **no reproducir el logo oficial registrado de Mercado Pago**.

## 13.8 Animaciones

**No implementadas.** Los cambios de pantalla (`view`) son instantáneos — no hay transiciones de tipo fade, slide, ni ninguna librería de animación (no hay Framer Motion ni similar). Esto está anotado explícitamente como pendiente para el futuro (sección 4.6), y se decidió postergarlo a propósito porque no es prioritario frente a la funcionalidad.

---

# 14. Reglas de negocio

Esta es la lista consolidada de reglas de negocio que el sistema aplica activamente hoy (no ideas, sino comportamiento implementado):

1. **El stock total de un producto es `deposito + vitrina`.** Mover entre ambos no cambia el total.
2. **Una venta siempre descuenta de `vitrina`, nunca directamente de `deposito`.**
3. **No se puede vender más cantidad de la que hay en vitrina** (el carrito no permite cargar más de lo disponible, ni con los botones +/- ni tipeando directamente).
4. **No se puede retirar de la caja más dinero del que hay en el saldo actual** (`MovimientoModal` bloquea la confirmación si el monto de un retiro supera `caja.saldo`).
5. **Cualquier edición de un producto existente que cambie un valor real exige un motivo escrito antes de poder guardar.**
6. **Cualquier corrección de un movimiento de caja que cambie el monto o la nota exige un motivo escrito antes de poder guardar.**
7. **Cualquier eliminación de un ticket exige un motivo escrito antes de poder confirmar.**
8. **Un movimiento de caja eliminado no desaparece: queda marcado como eliminado, visible y tachado, con su valor original.**
9. **Un empleado que no es el Dueño de la cuenta no puede crear productos nuevos directamente** — la creación queda como una "sugerencia" pendiente de aprobación del Dueño, tanto si se origina desde Stock como desde Compras (incluyendo el caso de recibir un ítem genérico y decidir sumarlo a Stock).
10. **El permiso `"administracion"` nunca puede ser asignado a un rol de empleado** — es exclusivo del Dueño (y, para la vista consolidada de todos los negocios, exclusivo además de `superAdmin: true`).
11. **Sólo la cuenta con `superAdmin: true` puede ver el panel de todos los negocios y "entrar" a operar cualquiera de ellos.** Un Dueño normal sólo ve y opera el suyo.
12. **Una venta con medio "Cuenta corriente" exige elegir un cliente existente antes de poder confirmar**, y suma el total como deuda a ese cliente en vez de afectar el saldo físico de caja.
13. **Un ticket sólo puede vincularse retroactivamente a un cliente (Fiado) si todavía no tiene un `clienteId` asignado** (no se puede vincular dos veces el mismo ticket).
14. **Un cierre de caja con conteo de billetes cuya diferencia contra lo esperado sea mayor o igual a $1.000 (en valor absoluto) se marca automáticamente como "inusual"**, y genera una alerta visible para el Dueño/superAdmin.
15. **Contar los billetes al abrir o cerrar la caja es opcional**, pero si no se cuentan, queda anotado explícitamente en el historial que "no se contaron billetes".
16. **Los productos vendidos por peso o volumen siempre almacenan su stock en la unidad grande (Kg o Litros) y se venden en la unidad chica (gramos o ml)**, con conversión automática por un factor fijo de 1000.
17. **El carrito de venta en curso persiste aunque se navegue a otra pantalla** — no se pierde hasta que se confirma el cobro o se lo vacía explícitamente.
18. **Cualquier cambio de permisos de un rol se aplica de inmediato** a cualquier empleado logueado con ese rol, sin necesidad de que vuelva a iniciar sesión.


---

# 15. Decisiones técnicas

Esta sección explica las decisiones técnicas más importantes tomadas durante el desarrollo, con las alternativas que se consideraron y por qué se descartaron.

## 15.1 Un solo archivo de React, en vez de un proyecto con módulos separados

**Decisión:** mantener todo el código en `KioscoApp.jsx`, un único archivo.

**Alternativa considerada:** separar en una estructura de carpetas (`components/Stock/`, `components/Caja/`, etc.), sugerida explícitamente por ChatGPT en una sesión paralela de brainstorming del usuario, con el argumento de que así cualquier IA (incluido Claude) necesitaría leer menos código para hacer un cambio en un módulo puntual, ahorrando tokens/tiempo.

**Por qué se descartó (por ahora):** el entorno de artefactos de Claude.ai, donde ocurre todo el desarrollo, **sólo puede compilar y mostrar una vista previa en vivo de componentes de React contenidos en un único archivo**. Separar el código ahora significaría perder la posibilidad de ver los cambios reflejados en el chat en tiempo real — habría que migrar a un entorno de desarrollo real (Claude Code, corriendo Vite localmente) para poder separar en módulos sin perder esa capacidad. Se decidió posponer la separación hasta el momento de migrar a ese entorno local, que de todas formas es necesario para el empaquetado final con Tauri.

**Ventaja de la decisión tomada:** permite seguir iterando con vista previa instantánea dentro del chat, que es como se validó cada funcionalidad durante todo el desarrollo.

**Desventaja:** el archivo es gigantesco (~5.845 líneas) y cada vez que hay que editar algo, hay que ubicar el fragmento correcto dentro de un archivo enorme, lo cual consume más tokens/tiempo por cada edición de lo que consumiría en una estructura modular.

## 15.2 `window.storage` en vez de una base de datos real

**Decisión:** usar la API de almacenamiento persistente que ofrece el entorno de artefactos de Claude.ai.

**Alternativa considerada:** ninguna evaluada formalmente todavía (IndexedDB fue mencionado como la solución **final**, no como alternativa evaluada para el estado actual).

**Por qué se tomó esta decisión:** es la única opción de persistencia disponible dentro del entorno actual de desarrollo (Claude.ai). No requiere backend, no requiere configuración, y permite probar el flujo completo de "los datos no se pierden al recargar" sin salir del entorno de chat.

**Limitación aceptada explícitamente:** esta solución **no es portable** fuera de Claude.ai. Es un atajo deliberado para poder demostrar y probar el comportamiento de persistencia mientras el proyecto vive como artefacto, sabiendo que habrá que reemplazarla por completo (IndexedDB, o un backend) al migrar a un proyecto real.

## 15.3 Tauri en vez de Electron para el empaquetado final

**Decisión (planificada, no ejecutada todavía):** usar Tauri para generar el ejecutable de escritorio distribuible a clientes.

**Alternativa considerada y descartada:** Electron (lo que usan Spotify, Discord, VS Code).

**Comparación que se hizo explícitamente:**

| | Electron | Tauri (elegido) |
|---|---|---|
| Peso del instalador/ejecutable | ~150-200 MB | ~10-20 MB |
| Motor que usa | Empaqueta su propia copia de Chromium | Usa el WebView2 que Windows ya trae instalado |
| Requiere en la máquina del desarrollador | Node.js | Node.js + Rust |
| Requiere en la máquina del cliente | Nada adicional | Windows 10/11 con WebView2 (presente en la enorme mayoría de instalaciones actualizadas) |
| Modo portable (un solo ejecutable, sin instalador) | Sí, con `electron-builder` | Sí, y más liviano para repartir |

**Por qué se eligió Tauri:** el objetivo final es repartir la app a clientes reales de la forma más simple posible ("le doy el archivo, toca acá, y abre — sin instalarle nada"), y el tamaño/liviandad de Tauri lo hace más práctico para ese objetivo que Electron.

**Costo aceptado:** el desarrollador necesita aprender/instalar Rust (que no es parte de su stack habitual), y no habrá actualización automática — cada nueva versión requiere generar y redistribuir manualmente el ejecutable.

## 15.4 JavaScript (JSX) en vez de TypeScript

**Decisión implícita (por omisión):** todo el código se escribió en JavaScript puro con JSX, sin tipos.

**Contexto:** la estructura de carpetas sugerida por ChatGPT para la futura modularización usaba extensión `.tsx` (TypeScript), pero **nunca se tomó la decisión explícita de migrar a TypeScript** — quedó mencionado en una sugerencia de estructura, no como una decisión acordada. Se recomienda a quien continúe el proyecto decidir esto explícitamente antes de la modularización (ver sección 25).

## 15.5 No usar ninguna librería de gráficos

**Decisión:** los paneles de estadísticas de Reportes (evolución de ventas, ventas por hora, métodos de pago) se implementaron con `<div>` de ancho variable calculado en JavaScript, en vez de usar una librería de gráficos.

**Alternativas disponibles pero no usadas:** el entorno de artefactos de Claude.ai tiene disponibles librerías como `recharts`, `chart.js`, `d3` para componentes de React.

**Por qué se optó por la solución casera:** simplicidad y consistencia visual con el resto de la interfaz (que usa Tailwind puro en todos lados), y porque las visualizaciones necesarias eran simples (barras horizontales proporcionales), sin necesitar interactividad de gráfico real (tooltips, zoom, etc.).

## 15.6 Contraseñas en texto plano

**Decisión (de hecho, no deliberada como "buena práctica" sino como atajo de prototipo):** las contraseñas de cuentas y empleados se guardan y comparan tal cual se escriben, sin hash ni encriptación.

**Por qué es aceptable hoy:** el sistema es un prototipo funcional dentro de un entorno de demostración (Claude.ai), sin datos reales de clientes en juego.

**Por qué NO es aceptable para producción:** esto se documentó explícitamente como algo que **debe** resolverse (hasheo con algo como bcrypt, idealmente moviendo la autenticación a un backend real) antes de que la aplicación se use con datos reales de un negocio de verdad. Ver sección 16 y 25.

## 15.7 Sin Context API ni librería de manejo de estado global

**Decisión:** todo el estado vive en el componente raíz y se pasa hacia abajo por props.

**Alternativas no usadas:** Context API de React, Redux, Zustand, Jotai.

**Motivo:** simplicidad mientras el proyecto era más chico; a medida que creció (multi-negocio, roles, auditoría), el prop drilling se volvió más profundo, pero nunca se refactorizó. Esto es una de las recomendaciones de refactor más claras para quien continúe (sección 25).

## 15.8 Sugerencias de productos en vez de bloqueo total para empleados

**Decisión:** un empleado no-Dueño puede **proponer** un producto nuevo, no crearlo directamente, en vez de simplemente no poder hacer nada.

**Alternativa considerada implícitamente:** ocultar directamente el botón de "crear producto" a quien no es Dueño.

**Por qué se prefirió el modelo de sugerencia:** permite que el flujo de trabajo del empleado no se interrumpa (puede seguir usando la app con normalidad, dejando anotada la necesidad), mientras preserva el control del Dueño sobre qué entra finalmente al catálogo — mejor experiencia que un simple "no podés hacer esto".


---

# 16. Problemas conocidos

## 16.1 Bugs ya corregidos durante el desarrollo (documentados porque enseñan patrones de error a evitar)

1. **`VentasView` sin el prop `caja`**: en el render principal, se pasaba `setCaja` a `VentasView` pero no `caja` en sí, causando `Cannot read properties of undefined (reading 'saldo')` apenas la pantalla intentaba mostrar el saldo. Corregido agregando el prop faltante. **Lección para quien continúe:** al pasar props a componentes grandes con muchos parámetros, verificar sistemáticamente que la firma de la función (`function X({ a, b, c })`) coincida exactamente con lo que se pasa en cada instancia (`<X a={...} b={...} />`) — este tipo de bug fue recurrente.
2. **`ClienteRow` sin `onDeuda`/`onVincular`**: los botones de "Deuda manual" y "Vincular ticket" estaban dibujados en la interfaz pero no conectados a ninguna función, y los modales correspondientes ni siquiera se renderizaban. Corregido conectando ambos handlers y agregando los modales faltantes al render final de `ClientesView`.
3. **`handleReset` con `try/catch` envolviendo llamadas `await` secuenciales**: la primera implementación de "Borrar todos los datos guardados" envolvía las cuatro llamadas a `window.storage.delete(...)` en un único `try { await a; await b; await c; await d; } catch {}`. Si la primera fallaba (por ejemplo, porque esa clave no existía todavía), las siguientes tres nunca se ejecutaban, aunque el error quedara silenciado. Corregido usando `Promise.allSettled([...])` para que cada borrado se intente de forma independiente.
4. **Inputs numéricos que forzaban "0" mientras se escribía**: varios componentes (`VitrinaRow`, `DenomCounter`) hacían `Number(e.target.value) || 0` directamente en el `onChange`, lo que causaba que, al borrar el contenido de un input para escribir un valor nuevo, apareciera un "0" molesto en el medio de la edición. Corregido guardando el valor como string mientras se edita, y convirtiendo a número recién al confirmar/guardar.
5. **Cálculo de saldo incorrecto al editar un movimiento de caja de tipo "retiro"**: la primera versión de `handleEditarMovimiento` aplicaba la diferencia de monto sin considerar el signo (ingreso suma, retiro resta). Corregido calculando la "contribución" real del movimiento original y del nuevo, según su tipo, antes de aplicar la diferencia al saldo.
6. **El carrito de venta se perdía al navegar a otra pantalla**: originalmente `cart` era un `useState` local de `VentasView`, que se reseteaba cada vez que React desmontaba el componente (al cambiar de `view`). Corregido subiendo `cart` al dataset persistente del negocio (`datos[currentUserId].cart`), igual que el resto del estado.
7. **Cualquier "Dueño" veía el panel de todos los negocios en Administración** (bug de diseño, no de código): la primera versión de `AdministracionView` no distinguía entre el Dueño de un negocio individual y el Administrador de toda la aplicación. Corregido introduciendo el flag `superAdmin` y condicionando la vista completa a `identidad?.superAdmin`.

## 16.2 Limitaciones activas (no son bugs, son huecos funcionales conocidos)

1. **Costo histórico no se guarda por venta** — la "Ganancia potencial" de Reportes usa el costo *actual* del producto, no el costo vigente al momento exacto de cada venta pasada. Ver la solución propuesta con código en la sección 4.1.
2. **Persistencia sólo funciona dentro de Claude.ai** — `window.storage` no existe fuera de ese entorno.
3. **Contraseñas en texto plano, sin backend real de autenticación.**
4. **No hay integridad referencial entre `empleados[].rol` y `roles[].nombre`** — si se elimina o renombra un rol que tiene empleados asignados, esos empleados quedan con un nombre de rol "huérfano" (`permisosDe` devolverá un arreglo vacío para ellos, es decir, sin ningún permiso, en vez de mostrar un error explícito).
5. **No hay validación de que dos negocios distintos no compartan el mismo `usuario`** entre un Dueño y un empleado de otro negocio, más allá del chequeo que hace `handleRegister`/`handleAgregarEmpleado` en el momento de la creación — no hay una restricción a nivel de "modelo de datos" que lo garantice de forma centralizada.
6. **El escaneo de código de barras no usa la cámara real** — `ScanModal` es un placeholder que permite tipear el código a mano.
7. **No hay un timeline único cronológicamente entrelazado entre eventos de caja y eventos de producto en la vista de Auditoría** (ver 3.12 y 9.6).
8. **Fechas de historial de producto y de caja no son ISO** (usan `toLocaleString("es-AR")`, un string no ordenable de forma confiable), a diferencia de los tickets, que sí usan ISO. El orden se resuelve por `id`, no por `fecha`.
9. **No hay ningún mecanismo de recuperación de contraseña.**
10. **El módulo de "escaneo" en Ventas y Compras** (para agregar un producto al carrito o marcar recepción) también es un placeholder de tipeo manual, igual que en Stock.
11. **Hay código muerto en el archivo**: `LegacyAperturaModal`, `LegacyCierreModal` y `LegacyAdministracionView` son componentes de una iteración anterior que ya no se usan en ningún lado (fueron reemplazados por `AperturaModal`/`CierreModal` con el modo de conteo opcional, y por la nueva `AdministracionView` con soporte multi-negocio), pero **nunca se borraron del archivo**. No causan ningún problema funcional (simplemente no se invocan), pero agregan peso muerto y confusión potencial para quien lea el código por primera vez.
12. **No hay pruebas automatizadas de ningún tipo** (no hay tests unitarios, ni de integración, ni end-to-end).
13. **No hay control de que un mismo producto no pueda tener nombre duplicado** dentro del mismo negocio.
14. **El cálculo de "Ganancia potencial" busca el producto por `nombre` (string), no por `productId`** en los ítems del ticket — si se renombra un producto después de haberlo vendido, las ventas viejas de ese producto dejan de poder emparejarse correctamente con su costo actual (contribuyen $0 a la ganancia calculada, en vez de un valor incorrecto pero no nulo). Esto es una consecuencia directa de que `ticket.items` no guarda `productId`, sólo `nombre`.

## 16.3 Riesgos

- **Pérdida de datos si el usuario borra el historial de conversación de Claude.ai** o si Anthropic modifica/discontinúa la API `window.storage` — no hay backup independiente de esos datos.
- **Ningún control de acceso real** más allá de la interfaz — cualquiera con acceso a las herramientas de desarrollador del navegador podría leer o modificar el estado de React directamente, incluidas las contraseñas en texto plano.
- **Escalabilidad no probada**: no se sabe cómo se comporta el sistema con una cantidad grande de productos, tickets, o negocios (no hay virtualización de listas, y cada guardado en `window.storage` serializa el objeto `datos` completo).

## 16.4 Mejoras posibles (no urgentes, no bugs)

- Granularidad de permisos más fina (hoy es "toda la pantalla sí/no", no por acción dentro de la pantalla).
- Unificar el formato de fecha entre todos los historiales (todos ISO, con formateo a `es-AR` sólo en el momento de mostrarlos).
- Eliminar el código muerto (`Legacy*`).

---

# 17. Próximos pasos (orden recomendado)

Este orden refleja tanto la prioridad de impacto/riesgo como las dependencias técnicas entre tareas (algunas requieren que otra esté resuelta antes).

1. **Costo histórico por venta** — cambio acotado, de bajo riesgo, ya diseñado con precisión en la sección 4.1. Se recomienda como primera tarea porque no depende de nada más y corrige un dato que hoy es incorrecto (la ganancia potencial de ventas pasadas).
2. **Decidir y documentar la estrategia de persistencia real** (IndexedDB si se sigue dentro del navegador, o backend si se quiere sincronización multi-dispositivo) — es un prerrequisito conceptual para todo lo que sigue, aunque no se implemente todavía.
3. **Migrar el proyecto a un entorno de desarrollo local** (Vite + React), posiblemente con Claude Code, coincidiendo con el inicio de la modularización del archivo único.
4. **Modularizar el código** en la estructura de carpetas planificada (`components/Stock/`, `components/Caja/`, etc.), decidiendo en ese momento si se migra o no a TypeScript.
5. **Reemplazar la persistencia por la solución real decidida en el paso 2** (IndexedDB y/o backend).
6. **Endurecer la autenticación** (hash de contraseñas, como mínimo).
7. **Empaquetar con Tauri** en modo portable, generando el primer `.exe` distribuible.
8. **Completar las funcionalidades pendientes de mayor impacto para el usuario final**: actualización masiva de precios, precio sugerido por % de ganancia, estadísticas de productos sin movimiento, exportación a Excel.
9. **Auditoría recortada para el rol Administrador.**
10. **Backups reales.**
11. **Resto del roadmap** (vencimientos, personalización visual, animaciones, sistema de proveedores, etc.), en el orden que el usuario priorice según necesidad real de uso.

---

# 18. Convenciones del código

**Aclaración honesta:** el proyecto no tiene una guía de estilo formalmente escrita ni impuesta por herramientas (no hay ESLint ni Prettier configurados de forma visible en el archivo). Lo que sigue son las convenciones **observadas de forma consistente** en el código existente, que se recomienda mantener.

## 18.1 Nombres de funciones

- Los manejadores de eventos/acciones siempre empiezan con `handle`: `handleLogin`, `handleCobrar`, `handleAperturaConfirm`, `handleEliminarMovimiento`, `handleAgregarEmpleado`, etc.
- Las funciones que abren un modal o cambian a un modo de edición usan verbos directos: `openNew`, `openEdit`.
- Los helpers puros de cálculo/formato están en español y describen exactamente qué devuelven: `unidadInfo`, `nombreIdentidad`, `permisosDe`, `categoriaEvento`, `calcularVuelto`.
- Los "setters" siguen la convención estándar de React (`setX` para el estado `x`), incluso cuando en realidad son funciones fábrica (`makeSetter("caja")` produce algo que se sigue llamando `setCaja`).

## 18.2 Nombres de componentes

- `PascalCase`, siempre. Un componente por responsabilidad visual clara: cada modal es su propio componente (`ProductModal`, `EmpleadoModal`, `PagoModal`, etc.), nunca un modal genérico reutilizado con props condicionales para cambiar completamente su contenido.
- Las pantallas principales terminan en `View`: `StockView`, `VentasView`, `ComprasView`, `ClientesView`, `ReportesView`, `AdministracionView`, `VitrinaView`.
- Los componentes de fila dentro de una lista terminan en `Row`: `VitrinaRow`, `ClienteRow`.

## 18.3 Idioma

**Todo el código está en español** — nombres de variables, de funciones, de componentes, comentarios, strings de interfaz. Esto es consistente y deliberado (el producto es para el mercado argentino, y el propio usuario piensa y describe el negocio en español). No mezclar a inglés en nombres nuevos sería lo esperable para mantener consistencia, aunque el estándar de la industria para nombres de variables suele ser inglés — es una decisión de proyecto, no un descuido.

## 18.4 Estructura interna de un archivo/componente típico

Cada componente sigue, de forma bastante consistente, este orden interno:
1. Declaración de props (destructuradas en la firma de la función).
2. `useState` de estado local.
3. Cálculos derivados (`useMemo` cuando el cálculo es costoso o depende de listas grandes; variables `const` simples cuando no).
4. Funciones `handleX` (lógica de negocio de esa pantalla).
5. El `return (...)` con el JSX.

## 18.5 Estilos

Siempre con clases de Tailwind directamente en el JSX (`className="..."`), nunca con `style={{...}}` salvo casos puntuales de valores calculados dinámicamente (por ejemplo, el `width` en porcentaje de las barras de estadísticas). No hay archivos `.css` propios, salvo el bloque `<style>` embebido para las flechas de los inputs numéricos.

## 18.6 Comentarios

Escasos y en español, usados sólo quirúrgicamente para explicar un porqué no evidente (por ejemplo, la explicación de por qué `AperturaModal` recuerda si `isEdit` para decidir el paso inicial del asistente de producto). El código no está exhaustivamente comentado línea por línea — se apoya en nombres descriptivos en vez de comentarios.

## 18.7 Buenas prácticas ya en uso que conviene mantener

- **Inmutabilidad estricta en las actualizaciones de estado**: siempre `[...arrayViejo, nuevo]` o `array.map(...)`/`array.filter(...)`, nunca mutación directa de arreglos u objetos existentes.
- **Los `setState` que dependen del valor anterior usan la forma funcional** (`setX(prev => ...)`), evitando condiciones de carrera con el estado obsoleto.
- **Validación antes de habilitar botones** (deshabilitar en vez de solamente validar al hacer clic), consistente en todos los formularios.


---

# 19. Manual técnico

## 19.1 Estado actual: no es un proyecto instalable todavía

Es fundamental entender esto antes de intentar "instalar" el proyecto: **hoy no existe un `package.json`, ni un proyecto Vite/Create-React-App, ni ningún script de build.** El único artefacto real es el archivo `KioscoApp.jsx`, pensado para ejecutarse dentro del renderizador de artefactos de React de Claude.ai (que se encarga de todo el tooling — transpilado JSX, resolución de imports de `react` y `lucide-react` — de forma invisible).

## 19.2 Cómo "ejecutarlo" hoy (dentro de Claude.ai)

No requiere ninguna instalación: el archivo se sube o se pega en una conversación de Claude.ai como un artefacto de tipo React, y el entorno lo compila y muestra automáticamente. Cualquier edición del archivo (por ejemplo, con las herramientas de edición de archivos de Claude) se refleja en la vista previa la próxima vez que se solicite.

## 19.3 Cómo convertirlo en un proyecto real (primer paso para cualquier otro entorno)

Esto **no está hecho**, pero son los pasos concretos que hay que seguir, ya discutidos y acordados con el usuario en conversaciones previas sobre este tema:

```bash
# 1. Crear el proyecto base con Vite
npm create vite@latest kiosco-app -- --template react
cd kiosco-app
npm install

# 2. Instalar las dependencias que usa el código actual
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configurar `tailwind.config.js` para que analice los archivos del proyecto:
```js
content: ["./index.html", "./src/**/*.{js,jsx}"],
```

En `src/index.css`, reemplazar todo el contenido por:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Luego:
- Reemplazar el contenido de `src/App.jsx` por el contenido completo de `KioscoApp.jsx`.
- Verificar que `src/main.jsx` importe `App` desde `./App.jsx` (viene así por defecto en el template de Vite).
- **Reemplazar toda la capa de `window.storage`** por algo que exista de verdad en ese entorno (ver sección 16 — esto es indispensable, el código va a fallar silenciosamente si no se hace, porque todos los `.catch(() => {})` tragan el error de `window.storage is not defined`).

Ejecutar en desarrollo:
```bash
npm run dev
```
Esto levanta un servidor local (típicamente en `http://localhost:5173`) con recarga en caliente.

## 19.4 Cómo compilarlo para producción (una vez sea un proyecto Vite real)

```bash
npm run build
```
Genera una carpeta `dist/` con los archivos estáticos optimizados, lista para ser servida por cualquier servidor web estático, o para ser empaquetada por Tauri (ver siguiente sección).

## 19.5 Empaquetado como aplicación de escritorio (Tauri) — plan, no ejecutado

Requisitos en la máquina de desarrollo:
- Node.js instalado.
- Rust instalado (requerido por Tauri).

Pasos generales (a completar por quien continúe, siguiendo la documentación oficial de Tauri al momento de hacerlo, ya que no se llegó a ejecutar este paso durante el desarrollo):
1. Agregar Tauri al proyecto Vite ya migrado (`npm install --save-dev @tauri-apps/cli`, `npx tauri init`).
2. Configurar `tauri.conf.json` apuntando al build de Vite (`dist/`).
3. Configurar el modo de bundle como **portable** (un único ejecutable, sin instalador), según la documentación de Tauri para Windows.
4. Generar el ejecutable (`npx tauri build`), verificar el tamaño resultante (~10-20 MB esperado) y probarlo en una máquina Windows limpia con WebView2.

## 19.6 Variables de entorno

**No hay ninguna variable de entorno en uso hoy** (no hay claves de API, no hay URLs de backend — todo es estado local en memoria/`window.storage`). Cuando se agregue un backend real, este es el lugar donde documentar las variables necesarias (URL de la API, claves, etc.).

## 19.7 Scripts

No hay scripts personalizados definidos todavía (no hay `package.json`). Al migrar a Vite, los scripts estándar (`dev`, `build`, `preview`) son los que provee la plantilla por defecto.

## 19.8 Dependencias (resumen para instalación)

```json
{
  "dependencies": {
    "react": "...",
    "react-dom": "...",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "tailwindcss": "...",
    "postcss": "...",
    "autoprefixer": "...",
    "vite": "..."
  }
}
```
(Versiones exactas a determinar por quien migre el proyecto, usando las últimas estables compatibles entre sí al momento de hacerlo.)

## 19.9 Configuración

No hay archivo de configuración de la aplicación en sí (no hay `.env`, no hay `config.js`). Toda la "configuración" que existe está hardcodeada como constantes al principio del archivo (`CATEGORIES`, `DENOMINACIONES`, `UMBRAL_DIFERENCIA_INUSUAL`, `MEDIOS_PAGO`, `PERMISOS_MENU`, etc.) — cualquier cambio a estos valores requiere editar el código fuente directamente, no hay panel de configuración en la interfaz para ellos (salvo los umbrales de alerta por producto, `minimo` y `alertaVitrina`, que sí son configurables desde la interfaz, por producto).

---

# 20. Guía para otro desarrollador

Esta sección está escrita específicamente para que alguien (persona o IA) que nunca vio ninguna conversación anterior pueda arrancar a trabajar de inmediato.

## 20.1 Lo primero que hay que entender

1. Este es un **prototipo funcional avanzado**, no un producto en producción. Vive como un único archivo de React (`KioscoApp.jsx`) dentro del entorno de artefactos de Claude.ai.
2. **No hay backend.** Todo el estado vive en memoria de React y se persiste con una API (`window.storage`) que **sólo existe dentro de Claude.ai**. Si te piden trabajar sobre esto fuera de ese entorno, lo primero que hay que resolver es la persistencia (ver sección 19.3).
3. El modelo de datos central es: `cuentas` (identidades de login/Dueños, con sus roles y empleados) + `datos` (diccionario de datasets completos, uno por negocio, indexado por el `id` de la cuenta). **Nunca se mezclan los datos de dos negocios.**
4. Cualquier función que reciba `setProducts`, `setCaja`, etc. como prop, en realidad está escribiendo dentro del negocio actualmente logueado (`currentUserId`), gracias al patrón `makeSetter`. No hace falta que un componente de pantalla sepa nada sobre el sistema multi-negocio.
5. **Todo lo que cambia algo importante (precio, monto de un movimiento, o elimina algo) debe pedir un motivo, y debe registrar quién lo hizo.** Esta es una regla de negocio explícita y central del producto — no es opcional, y cualquier función nueva de edición/corrección debería seguir el mismo patrón (`historialEntry(tipo, detalle, quien)` para productos, o el patrón de `caja.historial` para todo lo relacionado a caja).

## 20.2 Cómo encontrar las cosas dentro del archivo único

Usá búsqueda de texto (`grep`, o el buscador del editor) por estos anclas, que son consistentes:
- `^function NombreDelComponente` para saltar directo a un componente.
- `const handleX = ` para encontrar la lógica de una acción específica.
- Los nombres de componentes siguen las convenciones de la sección 18.2 (`XView` para pantallas, `XModal` para modales, `XRow` para filas de listas).

## 20.3 Cómo agregar una funcionalidad nueva, paso a paso (ejemplo genérico)

1. Determiná si la funcionalidad pertenece a una pantalla existente o necesita una nueva.
2. Si es una pantalla nueva, hay que: (a) agregarla a `NAV_ITEMS` y `HOME_CARDS` con un `id` nuevo; (b) agregarla a `PERMISOS_MENU` si debe ser un permiso asignable a roles de empleado (o dejarla fuera de ahí y sumarla sólo a `PERMISOS_DUENO` si debe ser exclusiva del Dueño, como `"administracion"`); (c) agregar el `case` correspondiente en el `switch` de `renderView()` dentro del componente raíz, pasándole los props de estado/setters que necesite (siguiendo el patrón `data.loQueSea` + `setLoQueSea`).
3. Si la funcionalidad requiere guardar datos nuevos por negocio, agregá el campo correspondiente a `defaultDataset(seed)`, y creá su setter con `makeSetter("elNombreDelCampo")` en el componente raíz.
4. Si la funcionalidad debe dejar rastro de auditoría, seguí el patrón existente: para cosas relacionadas a productos, usá `historialEntry(tipo, detalle, nombreIdentidad(identidad))` y agregalo al arreglo `historial` del producto correspondiente; para cosas relacionadas a caja/negocio en general, agregá una entrada a `caja.historial` con `tipo: "auditoria_tecnica"` (o un tipo nuevo, sumándolo a `CATEGORIA_TECNICA` si corresponde categorizarlo como "Técnico").
5. Si la funcionalidad debe respetar permisos, usá el patrón ya existente: filtrá la UI según `permisos.includes("elPermisoQueSea")`, y si hace falta una restricción más fina que "toda la pantalla sí/no" (como el caso de `esDueño` en Stock/Compras), agregá el chequeo puntual dentro del componente.

## 20.4 Errores comunes a evitar (aprendidos durante el desarrollo, ver sección 16.1)

- **Verificar siempre que los props que espera un componente coincidan exactamente con los que se le pasan** en cada lugar donde se instancia — el error más recurrente del proyecto fue justamente un prop faltante causando `Cannot read properties of undefined`.
- **No envolver múltiples `await` independientes en un único `try/catch` secuencial** si querés que todos se intenten aunque uno falle — usá `Promise.allSettled`.
- **No hagas `Number(valor) || 0` directamente en el `onChange` de un input controlado** si el usuario necesita poder borrar el contenido para escribir un valor nuevo — guardá el valor como string mientras se edita.
- **Prestá atención al signo (ingreso vs. retiro) al recalcular saldos de caja** tras una corrección.

## 20.5 Qué NO tocar sin entender el contexto completo

- El patrón `makeSetter` y la separación `cuentas`/`datos` — es el corazón de todo el sistema multi-negocio; un cambio mal hecho ahí puede mezclar datos entre negocios.
- El cálculo de `permisosDe` y su uso en las tres capas de restricción (Sidebar, Home, `renderView`) — quitar cualquiera de las tres capas reintroduce el riesgo de que alguien llegue a una pantalla no permitida.
- El sistema de conversión de unidades (`unidadInfo`, el `factor` de 1000) — está usado de forma consistente en Stock, Vitrina y Ventas; cambiarlo en un solo lugar sin replicarlo en los demás rompe la coherencia del stock.


---

# 21. Contexto adicional

Esta sección recopila información mencionada durante el desarrollo que no encajaba con precisión en ninguna sección anterior, pero que puede ser relevante para quien continúe el proyecto.

## 21.1 Sobre el usuario y el contexto de uso real

- El usuario trabaja en un kiosco/local de comida rápida (Mostaza) en su empleo real, en Constitución/zona sur del Gran Buenos Aires, Argentina, y desarrolla esta aplicación como proyecto personal con intención de convertirla en un producto comercial (venderla o distribuirla a otros kiosqueros).
- El usuario piensa y comunica el proyecto en **español rioplatense**, y la aplicación entera (interfaz, mensajes, nombres de variables) está en ese registro — esto no es casual, es coherente con el público objetivo real.
- El usuario también usa **ChatGPT en paralelo**, en sesiones separadas, para pensar el producto (brainstorming de funcionalidades, arquitectura, y para escribir un roadmap detallado). Varias de las ideas documentadas en las secciones de "Funcionalidades futuras" (4) y en la bitácora de decisiones se originaron ahí, y fueron traídas a las conversaciones con Claude para implementarlas.
- El usuario mantiene una página de **Notion** como fuente de verdad del roadmap del proyecto, titulada *"KioscoApp — Roadmap y despliegue"*, con toggles organizados por tema (Roadmap detallado con checkboxes, bitácora de decisiones de ChatGPT, problemas a resolver). Esa página se fue actualizando en paralelo al desarrollo, tildando funcionalidades a medida que se completaban.

## 21.2 Sobre el entorno de desarrollo

- Todo el desarrollo hasta la fecha de este documento ocurrió **exclusivamente dentro de conversaciones de chat con Claude (Claude.ai)**, usando el sistema de artefactos de React para la vista previa en vivo.
- Se evaluó explícitamente, en una conversación dedicada a ese tema, la posibilidad de migrar a **Claude Code** (la herramienta de terminal/aplicación de escritorio de Anthropic para trabajar directamente sobre archivos de un proyecto local) para el trabajo de modularización y empaquetado futuro, entendiendo que es mucho más eficiente para ese tipo de tarea que seguir iterando dentro del chat.
- El usuario expresó, en múltiples ocasiones a lo largo del desarrollo, preocupación por quedarse sin presupuesto de tokens/mensajes para completar una tarea grande — esto influyó en cómo se priorizaron y agruparon las tandas de trabajo (se prefirió entregar en bloques completos y funcionales antes que dejar features a medio terminar).

## 21.3 Sobre el proceso de trabajo con Claude

- Hubo múltiples interrupciones de sesión (cortes de conversación) durante tandas de trabajo largas, lo que en algún momento generó una situación donde el usuario tenía, en paralelo, una versión del archivo más avanzada que la que Claude tenía como referencia (producto de trabajo hecho en otra sesión, probablemente con ChatGPT ayudando a razonar sobre el código, o con otra instancia de Claude). Esa versión más avanzada (`KioscoAppv3.jsx`) fue subida por el usuario y **adoptada como la nueva base de trabajo**, tras comparar explícitamente las diferencias. **Lección para quien continúe:** si en algún momento se recibe un archivo que parece más avanzado que la última versión conocida, vale la pena diffear con cuidado antes de decidir qué base usar, en vez de asumir que la propia es la más actualizada.
- El flujo típico de trabajo fue: el usuario pide una funcionalidad o corrección → Claude revisa el código relevante (usando herramientas de vista y búsqueda dentro del archivo) → hace la edición con reemplazos de texto puntuales → verifica el balance de llaves/paréntesis del archivo completo (chequeo mecánico de sanidad sintáctica) → entrega el archivo actualizado.

## 21.4 Sobre las imágenes y capturas de pantalla compartidas

Durante el desarrollo, el usuario compartió capturas de pantalla en varias oportunidades:
- Del diseño original en Base44, usadas como referencia visual exacta para replicar la interfaz inicial.
- De conversaciones con ChatGPT, mostrando ideas de roadmap organizadas en tarjetas por origen ("Origen: Claude" / "Origen: ChatGPT"), incluyendo ideas como: desactivar las flechas de los inputs numéricos, colores según quién hizo un movimiento, IDs en todas las operaciones, separar "vendido" de "cobrado" cuando hay fiado, que los empleados sólo puedan "sugerir" productos, un panel de Ganancias clickeable con detalle de pérdidas, sugerencia de promociones por calendario, rediseño del panel de Administración para el superAdmin, y notas completas y estructuradas en las correcciones (motivo, quién, cuándo, antes/después).
- De errores concretos de la aplicación en tiempo de ejecución (por ejemplo, capturas del error `Cannot read properties of undefined (reading 'saldo')`), usadas para diagnosticar bugs puntuales.

## 21.5 Nombres y apodos

El usuario tiene múltiples apodos usados en distintos contextos personales, ninguno de los cuales tiene relevancia técnica para el proyecto — se mencionan aquí únicamente por completitud, ya que fueron parte del contexto de las conversaciones: Juanpene, Juanpito, Juanpitulin, Wombat, Kp, Pablo, Danfos, Danfini, Pitu, Juanprepucio, Bradpitt, Brapi. En la aplicación, el usuario se representa a sí mismo como **"Juan"**, Dueño/Administrador de la app.

## 21.6 Proyectos paralelos del usuario (contexto, no parte de KioscoApp)

El usuario tiene otros proyectos e intereses en paralelo (estudios de música y tecnología, freelance de contenido técnico para una empresa de automatización industrial, intereses en producción musical y gaming) que **no tienen relación funcional con KioscoApp** y no deberían mezclarse en el desarrollo de este proyecto — se mencionan sólo para que quien lea este documento no se sorprenda si aparecen referencias a ellos en el historial de conversación completo, y entienda que son contextos separados.


---

# 22. Estructura completa del proyecto

## 22.1 Estructura actual (real, hoy)

```
KioscoApp.jsx        ← único archivo del proyecto. ~5.845 líneas. Contiene:
                        - Imports (React, lucide-react)
                        - Constantes de configuración (NAV_ITEMS, HOME_CARDS, CATEGORIES,
                          UNIDAD_GRUPOS, DENOMINACIONES, UMBRAL_DIFERENCIA_INUSUAL,
                          PERMISOS_MENU, PERMISOS_DUENO, CATEGORIA_TECNICA, MEDIOS_PAGO)
                        - Funciones helper (unidadInfo, nowFecha, historialEntry,
                          nombreIdentidad, money, isWithinRange, calcularVuelto,
                          categoriaEvento, permisosDe, rolesPorDefecto, seedCuentas,
                          seedDatos, defaultDataset)
                        - INITIAL_PRODUCTS (datos semilla de productos de ejemplo)
                        - ~50 componentes de React (ver listado completo en 5.4 y 23)
                        - export default function KioscoApp()  ← componente raíz
```

No existe ningún otro archivo del proyecto (no `package.json`, no `index.html`, no carpeta `public/`, no `.gitignore`) — todo eso lo provee implícitamente el entorno de artefactos de Claude.ai.

## 22.2 Estructura planificada para la migración a proyecto local (no creada todavía)

Esta es la estructura de referencia acordada como objetivo para cuando se modularice el proyecto (mencionada originalmente por ChatGPT y aceptada como buena práctica a seguir):

```
kiosco-app/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.jsx                  ← punto de entrada, monta <App />
│   ├── App.tsx                   ← componente raíz (equivalente a KioscoApp() de hoy)
│   ├── components/
│   │   ├── Caja/
│   │   │   ├── VentasView.tsx
│   │   │   ├── CobrarModal.tsx
│   │   │   ├── AperturaModal.tsx
│   │   │   ├── CierreModal.tsx
│   │   │   ├── DenomCounter.tsx
│   │   │   ├── MovimientoModal.tsx
│   │   │   ├── MovimientosModal.tsx
│   │   │   ├── HistorialCajaModal.tsx
│   │   │   └── CartQtyInput.tsx
│   │   ├── Stock/
│   │   │   ├── StockView.tsx
│   │   │   ├── ProductModal.tsx
│   │   │   ├── ScanModal.tsx
│   │   │   └── HistorialProductoModal.tsx
│   │   ├── Vitrina/
│   │   │   ├── VitrinaView.tsx
│   │   │   └── VitrinaRow.tsx
│   │   ├── Compras/
│   │   │   ├── ComprasView.tsx
│   │   │   ├── RecepcionGenericaModal.tsx
│   │   │   └── CopiarTextoModal.tsx
│   │   ├── Clientes/
│   │   │   ├── ClientesView.tsx
│   │   │   ├── ClienteRow.tsx
│   │   │   ├── ClienteModal.tsx
│   │   │   ├── PagoModal.tsx
│   │   │   ├── DeudaManualModal.tsx
│   │   │   └── VincularTicketModal.tsx
│   │   ├── Reportes/
│   │   │   ├── ReportesView.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── MotivoBorradoModal.tsx
│   │   ├── Administracion/
│   │   │   ├── AdministracionView.tsx
│   │   │   ├── EditarMovimientoModal.tsx
│   │   │   └── EmpleadoModal.tsx
│   │   ├── Auth/
│   │   │   └── LoginView.tsx
│   │   └── Layout/
│   │       ├── Sidebar.tsx
│   │       ├── Home.tsx
│   │       ├── DashboardCard.tsx
│   │       └── SectionHeader.tsx
│   ├── hooks/                    ← vacío hoy, candidato: useNegocioData, usePermisos
│   ├── services/                 ← vacío hoy, candidato: capa de persistencia (IndexedDB/API)
│   ├── utils/                    ← candidatos: unidadInfo, calcularVuelto, money, isWithinRange
│   ├── types/                    ← si se migra a TypeScript: Producto, Cuenta, Ticket, etc.
│   └── constants/                ← NAV_ITEMS, PERMISOS_MENU, DENOMINACIONES, etc.
└── src-tauri/                    ← generado por Tauri al inicializarlo, para el empaquetado de escritorio
```

**Aclaración importante:** esta estructura es una **propuesta de referencia, no un hecho consumado**. Nadie empezó a moverse hacia ella todavía — el archivo sigue siendo único. Se incluye acá para que quien continúe el proyecto tenga un punto de partida ya pensado, en vez de tener que diseñarlo desde cero.


---

# 23. Documentación del código (referencia de componentes y funciones)

Esta sección funciona como un índice de referencia rápida de cada pieza de código, complementando las explicaciones funcionales ya dadas en la sección 3.

## 23.1 Helpers puros (sin JSX)

| Función | Firma | Qué hace |
|---|---|---|
| `unidadInfo` | `(grupo) => { baseAbbr, baseLabel, ventaAbbr, ventaLabel, factor }` | Devuelve la información de conversión de unidades para `"unidad"`, `"peso"` o `"volumen"` |
| `nowFecha` | `() => string` | Devuelve la fecha/hora actual formateada `es-AR` |
| `historialEntry` | `(tipo, detalle, quien) => objeto` | Crea una entrada de historial de producto con `id`, `tipo`, `detalle`, `quien` (o `"Sistema"` si no se pasa), `fecha` |
| `nombreIdentidad` | `(identidad) => string` | Devuelve `"Nombre (Rol)"` o `"Sistema"` si `identidad` es `null` |
| `money` | `(n) => string` | Formatea un número como moneda `es-AR` (pesos argentinos) |
| `isWithinRange` | `(dateStr, range) => boolean` | Compara una fecha contra "Hoy"/"Semana"/"Quincena"/"Mes" desde la fecha actual del sistema |
| `calcularVuelto` | `(monto) => [{denominacion, cantidad, subtotal}]` | Algoritmo *greedy* de desglose de billetes para el vuelto, usando `DENOMINACIONES` |
| `categoriaEvento` | `(tipo) => "Operativo" \| "Técnico"` | Clasifica un tipo de evento de historial según `CATEGORIA_TECNICA` |
| `permisosDe` | `(identidad, cuenta) => string[]` | Calcula la lista de permisos de menú vigentes para quien está logueado |
| `rolesPorDefecto` | `() => [{nombre, permisos}]` | Devuelve los roles "Administrador" y "Cajero" con sus permisos iniciales, para un negocio nuevo |
| `seedCuentas` | `() => cuentas[]` | Devuelve las 3 cuentas de prueba precargadas (demo, sur, y el empleado lucia dentro de demo) |
| `seedDatos` | `() => datos{}` | Devuelve los datasets iniciales correspondientes a `seedCuentas()` |
| `defaultDataset` | `(seed) => dataset` | Estructura vacía (o con productos de ejemplo si `seed === true`) para un negocio nuevo |

## 23.2 Componentes de layout

| Componente | Props principales | Responsabilidad |
|---|---|---|
| `Sidebar` | `current, onNavigate, cuenta, identidad, permisos, onLogout, products` | Menú lateral, badges de alerta de Stock/Vitrina, pie con identidad y logout |
| `Home` | `onNavigate, cuenta, identidad, data` | Dashboard: saludo, tarjetas de indicadores en vivo, accesos rápidos |
| `DashboardCard` | `icon, label, value, sub, tono, onClick` | Tarjeta individual del Dashboard, reutilizable |
| `SectionHeader` | `title, subtitle, actions` | Encabezado estándar de cada pantalla (título + acciones a la derecha) |

## 23.3 Componentes de Stock

| Componente | Responsabilidad |
|---|---|
| `StockView` | Pantalla principal: lista, búsqueda, alta/edición/baja, banners de alerta y de sugerencias pendientes |
| `ProductModal` | Asistente de alta (2 pasos) / edición (1 paso, con motivo si hay cambios) de un producto |
| `ScanModal` | Placeholder de escaneo de código de barras (input manual) |
| `HistorialProductoModal` | Lista el historial completo de un producto, con ícono por tipo de evento y autoría |

## 23.4 Componentes de Vitrina

| Componente | Responsabilidad |
|---|---|
| `VitrinaView` | Lista de productos con banner de reposición pendiente |
| `VitrinaRow` | Fila individual: inputs de vitrina/alerta, botón guardar, resaltado ámbar si necesita reposición |

## 23.5 Componentes de Ventas / Caja

| Componente | Responsabilidad |
|---|---|
| `VentasView` | Pantalla principal, el componente más grande del proyecto: apertura/cierre, carrito, cobro, movimientos |
| `CartQtyInput` | Input de cantidad del carrito con buffer local (confirma en `onBlur`) |
| `CobrarModal` | Selección de medio de pago, cálculo de vuelto, confirmación de venta |
| `MercadoPagoBadge` | Ícono SVG propio para el medio de pago Mercado Pago |
| `AperturaModal` / `CierreModal` | Apertura/cierre de caja con conteo opcional de billetes |
| `DenomCounter` | Contador de billetes por denominación, reutilizado por Apertura y Cierre |
| `MovimientoModal` | Alta de un ingreso/retiro manual, con validación de saldo disponible |
| `MovimientosModal` | Lista de movimientos manuales |
| `HistorialCajaModal` | Lista de aperturas/cierres, con diferencia y marca de "inusual" |
| `LegacyAperturaModal` / `LegacyCierreModal` | **Código muerto**, no usado, de una iteración anterior sin modo "sin contar billetes" |

## 23.6 Componentes de Reportes

| Componente | Responsabilidad |
|---|---|
| `ReportesView` | Filtros de período, indicadores, paneles de evolución/hora/medios de pago, ranking, tickets |
| `StatCard` | Tarjeta individual de indicador, reutilizable |
| `MotivoBorradoModal` | Exige motivo antes de confirmar el borrado de un ticket |

## 23.7 Componentes de Compras

| Componente | Responsabilidad |
|---|---|
| `ComprasView` | Lista de compras, sugeridos, búsqueda, ítem genérico, creación de producto, WhatsApp |
| `RecepcionGenericaModal` | Elección "solo recibido" vs. "agregar a Stock" para ítems sin producto vinculado |
| `CopiarTextoModal` | Alternativa manual de copiado si falla el portapapeles |

## 23.8 Componentes de Clientes / Fiado

| Componente | Responsabilidad |
|---|---|
| `ClientesView` | Lista de clientes, alta, deuda total |
| `ClienteRow` | Fila de cliente con saldo, historial desplegable, acciones |
| `ClienteModal` | Alta de cliente |
| `PagoModal` | Registrar un pago |
| `DeudaManualModal` | Cargar deuda manual (sin venta asociada) |
| `VincularTicketModal` | Asociar retroactivamente un ticket existente a un cliente |

## 23.9 Componentes de Login

| Componente | Responsabilidad |
|---|---|
| `LoginView` | Login/registro, botón de reinicio de datos con confirmación |

## 23.10 Componentes de Administración

| Componente | Responsabilidad |
|---|---|
| `AdministracionView` | Panel completo: grid de negocios (superAdmin) o panel propio (Dueño), movimientos, auditoría, sugerencias, empleados, roles |
| `EditarMovimientoModal` | Edición/eliminación de un movimiento de caja con motivo obligatorio |
| `EmpleadoModal` | Alta de empleado, con selector de rol existente o creación de rol nuevo |
| `LegacyAdministracionView` | **Código muerto**, versión anterior sin soporte multi-negocio |

## 23.11 El componente raíz: `KioscoApp()`

Es el único componente exportado por defecto (`export default function KioscoApp()`). Concentra:
- Todo el `useState` de nivel superior (ver sección 5.5).
- Los cuatro `useEffect` de persistencia (carga inicial + 4 de guardado automático).
- `makeSetter` y todos los setters derivados (`setProducts`, `setCaja`, `setTickets`, `setClientes`, `setComprasItems`, `setCajaAbierta`, `setCart`, `setSugerencias`).
- `handleLogin`, `handleRegister`, `handleLogout`, `handleReset`.
- El cálculo de `cuentaActual`, `data`, `permisos`.
- `handleNavigate` (navegación con verificación de permisos).
- `renderView()` (el switch central de qué pantalla mostrar, con la capa extra de seguridad de permisos).
- El JSX final: el `<style>` global de los inputs numéricos, `Sidebar`, y el panel principal.


---

# 24. Roadmap

## 24.1 Terminado

| Módulo | Detalle |
|---|---|
| Navegación y layout | Sidebar, Home con dashboard, secciones completas |
| Stock | Alta/edición/baja, unidades de medida (unidad/peso/volumen), historial por producto con motivo y autoría |
| Vitrina | Traslado depósito↔vitrina, alerta configurable |
| Ventas/Caja | Medios de pago, apertura/cierre con conteo opcional, vuelto con billetes, movimientos validados, carrito persistente |
| Compras | Sugeridos, búsqueda, ítem genérico, creación de producto, estados, recepción con elección, WhatsApp, quién recibió |
| Clientes/Fiado | Cuenta corriente, vincular ticket, deuda manual, pagos |
| Reportes | Períodos, ranking, ganancia potencial (con limitación conocida), evolución, por hora, por medio de pago, vendido/cobrado/fiado, borrado con motivo |
| Login multi-cuenta | Cuentas, empleados, contraseñas en texto plano (limitación conocida) |
| Roles y permisos | Roles personalizados, editor de permisos, jerarquía superAdmin/Dueño/empleado |
| Auditoría | Categorización Operativo/Técnico, filtro, autoría en todos los historiales |
| Sugerencias de productos | Flujo completo de propuesta/aprobación/rechazo para empleados no-Dueño |
| Persistencia | Guardado/carga automáticos vía `window.storage`, botón de reinicio |
| Dashboard | Panel de indicadores en Inicio, filtrado por permisos |
| UX de inputs numéricos | Sin flechas, sin "0" forzado, selección automática al enfocar |

## 24.2 En progreso / parcialmente hecho

| Ítem | Qué falta |
|---|---|
| Auditoría | Falta timeline único cronológico entre caja y productos; falta colores por persona |
| Ganancia potencial | Falta el costo histórico por venta (usa costo actual, ver 4.1) |
| Estadísticas | Faltan "productos sin movimiento" y "tiempo promedio en vitrina" |

## 24.3 Pendiente — Prioridad alta

1. Costo histórico por venta (sección 4.1) — **dependencia: ninguna, listo para empezar**.
2. Migración a proyecto local (Vite) — **dependencia: decisión de si se hace con Claude Code u otra herramienta**.
3. Persistencia real fuera de Claude.ai (IndexedDB y/o backend) — **dependencia: proyecto migrado a local**.
4. Hasheo de contraseñas / autenticación real — **dependencia: preferentemente, tener backend**.

## 24.4 Pendiente — Prioridad media

5. Modularización del código en carpetas — **dependencia: proyecto migrado a local**.
6. Actualización masiva de precios y precio sugerido por % de ganancia — **sin dependencias técnicas, se puede hacer incluso dentro de Claude.ai**.
7. Auditoría recortada para el rol Administrador — **dependencia: repensar el modelo de permisos (hoy "administracion" es monolítico)**.
8. Empaquetado con Tauri — **dependencia: proyecto migrado a local, con Rust instalado**.

## 24.5 Pendiente — Prioridad baja / Segunda etapa

9. Backups (local y nube), versionado, restauración.
10. Importación/exportación Excel/CSV.
11. Vencimientos de productos.
12. Personalización visual (logo, colores, nombre del negocio en la interfaz).
13. Rediseño del panel de Administración del superAdmin (panel neutral por defecto).
14. Panel de "Ganancias" clickeable con detalle de pérdidas.
15. Sugerencia de promociones por calendario.

## 24.6 Pendiente — Futuro / baja prioridad

16. Centro de notificaciones, productos favoritos, venta rápida, atajos de teclado, sistema de proveedores, animaciones/transiciones, detección de tickets duplicados, productos relacionados/sustitutos, granularidad más fina de permisos.

---

# 25. Recomendaciones

## 25.1 Qué partes deberían refactorizarse

1. **El manejo de estado con prop drilling puro.** A medida que se agreguen más funcionalidades, pasar 8-10 props a cada pantalla se va a volver cada vez más difícil de mantener. Se recomienda introducir Context API de React (como mínimo) al momento de modularizar, agrupando por ejemplo un `NegocioContext` que exponga `data` y todos los setters, evitando tener que pasarlos manualmente por cada `<XView>`.
2. **La categorización de eventos de auditoría dispersos entre `caja.historial` y `historial` de cada producto.** Conviene unificar en una sola colección de "eventos de auditoría" por negocio, con una `entidad` (producto/caja/cliente/rol/etc.) y una referencia a qué se modificó, en vez de tener la lógica de "aplanar y combinar" repartida en `AdministracionView`.
3. **El formato de fecha inconsistente** entre `tickets` (ISO) y el resto de los historiales (`toLocaleString`). Se recomienda guardar siempre un timestamp numérico (`Date.now()`) además del string legible, para poder ordenar y comparar de forma confiable en cualquier parte del código sin depender del `id`.
4. **Eliminar el código muerto** (`LegacyAperturaModal`, `LegacyCierreModal`, `LegacyAdministracionView`) — no aporta nada y aumenta el tamaño del archivo y la confusión de cualquiera que lo lea por primera vez.

## 25.2 Qué partes pueden optimizarse

- El guardado a `window.storage` serializa el objeto `datos` **completo** en cada cambio, sin importar cuán chico sea el cambio. Si el volumen de datos crece (muchos negocios, muchos tickets), esto puede volverse lento. Al migrar a una persistencia real, conviene guardar de forma más granular (por ejemplo, una entrada de storage por negocio, o una base de datos real con escrituras parciales).
- No hay memoización de componentes (`React.memo`) — en pantallas con listas largas (Stock, Reportes) podría ayudar a evitar renders innecesarios, aunque no se detectaron problemas de rendimiento durante el desarrollo con el volumen de datos de prueba usado.

## 25.3 Qué riesgos se ven a futuro

1. **Seguridad**: contraseñas en texto plano y ausencia total de backend son inaceptables para un producto que vaya a manejar datos reales de negocios y clientes. Este es, con diferencia, el riesgo más importante a resolver antes de cualquier lanzamiento real.
2. **Dependencia de una API específica de Claude.ai** (`window.storage`) para toda la persistencia — si el proyecto se queda mucho tiempo más en este estado sin migrar, cualquier cambio en esa API por parte de Anthropic podría romper la aplicación sin aviso.
3. **Falta de pruebas automatizadas**: a medida que el archivo crece, el riesgo de romper algo existente al agregar una funcionalidad nueva aumenta, y hoy la única forma de detectarlo es probar manualmente. Se recomienda, al modularizar, introducir al menos pruebas unitarias para la lógica de negocio más crítica (cálculo de vuelto, conversión de unidades, cálculo de permisos, cálculo de saldo de caja).
4. **Falta de integridad referencial** entre roles y empleados (sección 16.2) podría generar comportamientos confusos (un empleado que "pierde" todos sus permisos silenciosamente si se borra su rol) sin ningún aviso al Dueño.

## 25.4 Qué mejoras implementaría antes de agregar nuevas funciones

Antes de seguir sumando funcionalidades nuevas, en este orden:
1. Costo histórico por venta (rápido, corrige un dato incorrecto hoy).
2. Decisión y arranque de la migración a un proyecto local real, con persistencia real — sin esto, cualquier funcionalidad nueva construida seguirá atada a las limitaciones de Claude.ai.
3. Hasheo de contraseñas, como mínimo mitigador de seguridad, incluso antes de tener un backend completo.
4. Recién después de eso, priorizaría las funcionalidades de mayor impacto visible para el usuario final: actualización masiva de precios y precio sugerido por ganancia (por ser las más pedidas explícitamente y no depender de nada más).

---

*Fin del documento. Generado íntegramente a partir del código fuente real (`KioscoApp.jsx`) y del historial completo de decisiones tomadas durante el desarrollo de KioscoApp, para servir como fuente de verdad ante la migración a otro asistente o desarrollador.*
