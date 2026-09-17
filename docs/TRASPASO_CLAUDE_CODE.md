# Traspaso completo de Kiosco+ a Claude Code

**Corte de información:** 15 de septiembre de 2026

**Versión en código:** 0.2.30

**Rama:** `main`

**Commit funcional:** `72c4bfc` (sobre la base de `dfb8b90619bd8f5d40b2a0cc8a7bcb532532d080`, más tres commits del 15-16/09: captura de `detail.data` en errores de Mercado Pago, `forcePosRecreate` en el repair de la caja QR, y el fix real: `platform_id=mp` en la URL de autorización OAuth)

**Última etiqueta existente:** `v0.2.29`

**Estado de 0.2.30:** subida a `main`, control de calidad aprobado y backend desplegado. **La causa raíz del bug de QR dinámico quedó identificada y corregida (16/09/2026).** Falta re-conectar Código QR con el fix aplicado y confirmar en vivo que la orden se crea y acredita bien antes de etiquetar — ver sección 1.

## 0. Cambio de entorno (15/09/2026, sesión de la tarde)

- El proyecto vive ahora en `kiosco app\Kioscomas` directamente (antes estaba anidado en `kiosco app\PARA_SUBIR_A_GITHUB\Kioscomas`). La carpeta raíz se reordenó: todo lo viejo/duplicado quedó en `kiosco app\_ARCHIVO_HISTORICO\`, documentado en `kiosco app\README.md`.
- Esta máquina ahora tiene instalados de forma persistente: Git, GitHub CLI (`gh`, sin autenticar todavía), Node.js LTS y pnpm 11.9.0 (activado vía `corepack`/npm global, no vía el instalador oficial). Antes ninguno de los cuatro estaba disponible.
- Conectores activos en esta sesión de Claude Code: Mercado Pago (conector con OAuth ya autorizado, 11 herramientas: `application_list`, `get_credentials`, `create_test_user`, `add_money_test_user`, `notifications_history`, `save_webhook`, `search_documentation`, etc.), Render, Supabase, Resend.
- Además se instaló el **plugin oficial `mercadopago@claude-plugins-official`** (distinto del conector de arriba — son dos integraciones separadas). Trae comandos `/mp-connect`, `/mp-test-cards`, un agente `mercadopago:mp-integration-expert` y skills (`mp-connect`, `mp-integrate`, `mp-review`, `mp-test-setup`, `mp-webhooks`). **Todavía no está autorizado** (pide OAuth interactivo); hay que correr `/mp-connect` o el equivalente para activarlo. Puede tener herramientas más específicas para lo que sigue pendiente.

## 1. Continuación inmediata: no perder este punto

**La causa raíz del bug de QR dinámico se encontró y se corrigió el 16/09/2026.** No sigas leyendo esto como "diagnóstico abierto" — leé primero "Causa raíz encontrada y corregida" más abajo, y sólo hace falta confirmar la verificación final en vivo.

### Qué ocurrió antes de 0.2.30

1. QR y Point se prepararon en el backend y la interfaz.
2. El OAuth de QR se conectó correctamente con un vendedor sandbox.
3. Se creó y reparó una sucursal/caja QR de prueba. La interfaz llegó a informar que la caja estaba vinculada y en el modo integrado correcto.
4. Un intento anterior falló con `External POS id not found`. La versión 0.2.29 corrigió el origen: el servidor dejó de confiar en IDs escritos por el cliente, volvió a verificar la caja y la preparó con `config.qr.operating_mode: pdv`.
5. Después de esa reparación, Mercado Pago aceptó la caja pero rechazó la creación de la orden con el mensaje genérico `An error occurred when creating a Merchant Order`.
6. El rechazo ocurría antes de que Mercado Pago entregara un ID de orden. Por eso no había nada real que consultar, cancelar o pagar.
7. Se confirmó que Mercado Pago no tenía una caída general y que la petición usaba Orders v1, OAuth e idempotencia.

### Qué cambió en 0.2.30

- La orden QR incluye un único `item` resumen con cantidad 1 e importe igual al total. No se envía el catálogo ni datos privados. Se agregó porque algunas cuentas sandbox todavía atraviesan internamente Merchant Orders y pueden fallar sin un renglón de ítem aunque el contrato moderno de Orders acepte un total.
- `platform_id`, `integrator_id` y `sponsor_id` sólo se envían si cumplen los formatos que Mercado Pago asigna. Un ID de aplicación pegado por error deja de contaminar la orden.
- El servidor conserva, de forma saneada, HTTP, código, campo, detalle y request/correlation ID del proveedor.
- El modal de cobro y **Actividad y conciliación** permiten desplegar el diagnóstico técnico.
- Si el proveedor no llegó a crear una orden, no se muestra el botón **Consultar**.
- El servidor registra una línea segura `[mercado-pago] orden rechazada` sin tokens, secretos ni cuerpo arbitrario.
- Si falla el QR, la venta y el stock siguen sin modificarse.

### Estado operativo verificado

- GitHub Actions **Control de calidad continuo**, ejecución correspondiente al commit `dfb8b90`: completada con éxito.
- Backend de Render: revisión `dfb8b90619bd` observada en `/v1/health`.
- Salud del backend: PostgreSQL, OAuth, webhooks y configuración de QR/Point aparecen disponibles; `testMode` continúa activo.
- La app publicada mostró la actualización de PWA y se recargó.
- Esa recarga cerró o venció la sesión del navegador y dejó la pantalla de ingreso. No se copiaron ni inspeccionaron credenciales.

### Qué se descubrió en la sesión del 15/09 (tarde)

El error dejó de ser el genérico `An error occurred when creating a Merchant Order` y pasó a ser uno más específico y **estable en todos los reintentos**: `código: property_value · HTTP 400 · property_value: Invalid value for property`, sin que Mercado Pago indique nunca el campo (`field`/`property`/`data` vienen vacíos en la respuesta real — se confirmó con logs de Render). Cuatro request ID distintos, mismo resultado: `6e2345d5-e7ef-4c4f-9f16-62467cb8abd5`, `f685921b-9edc-4e31-aa96-535256513534`, `75fdef2b-f995-430c-8e77-8e3c9a429745`, `c78658f4-e44b-4f5a-927d-712d42a3d744`.

Se descartaron, en orden, estas hipótesis:

1. **`integration_data` (platform_id/integrator_id/sponsor_id) con un valor inventado.** Se blanquearon las tres variables en Render (`KIOSCO_MERCADOPAGO_PLATFORM_ID`, `_INTEGRATOR_ID`, `_SPONSOR_ID`) y el error persistió idéntico. Descartado.
2. **Un bug de parseo en `providerDetailEvidence`** que no miraba `detail.data`. Se corrigió (commit `df2f059`), pasaron las 35 pruebas de `test:payments`, se desplegó y se repitió la prueba: el mensaje siguió exactamente igual. Confirma que Mercado Pago realmente no manda el nombre del campo en este caso — no era un bug de Kiosco+.
3. **La caja QR conectada (`CAJAE6237BCF51ACD9CA`) estaba rota.** Se probó reproduciendo el mismo payload que genera `buildQrOrderPayload` directamente contra la API de Mercado Pago (fuera de Kiosco+), primero contra una tienda/caja nueva creada bajo la cuenta dueña de la aplicación "Kioscomas QR" (un vendedor distinto del conectado): **la orden se creó perfecta, con QR incluido.** Eso probó que el payload/código está bien. Después se agregó al backend la capacidad de borrar y recrear la caja QR (`client.deletePos` + flag `forcePosRecreate` en `reconcileMercadoPagoQrSetup`, sólo activable por el Dueño vía `repairOnly && forcePosRecreate` en el body de `/v1/payments/mercado-pago/qr/setup`; commit `2d6c177`), se ejecutó contra la cuenta real conectada (nueva caja: `posId 138202645`), y **el error volvió a aparecer idéntico con la caja completamente nueva.** Descartado: no es la caja.

En ese momento la conclusión de trabajo era "el problema está en la cuenta vendedora sandbox conectada" — **esa conclusión quedó descartada** por lo que sigue.

### Causa raíz encontrada y corregida (16/09/2026)

Se conectó Código QR con la **cuenta real** de Juan (no sandbox) para descartar de una vez la variable "cuenta de prueba". Con la cuenta real conectada por OAuth, **el error `property_value` volvió a aparecer, idéntico** (nuevo request ID `193d2186-ed55-43aa-a5ad-c16bfe424b8e`). Eso tiró abajo la conclusión anterior: no era la cuenta ni sandbox-vs-producción.

El dato clave: el mismo payload exacto, con la **misma cuenta**,
- usando el **Access Token fijo de producción** del panel de la app → funciona perfecto (crea la orden, devuelve QR real).
- usando el **Access Token obtenido por el flujo OAuth `authorization_code`** (como hace Kiosco+ al conectar un vendedor) → falla siempre con `property_value`.

Eso aisló el problema al token OAuth en sí, no a la cuenta ni al payload. Se le preguntó directamente al asistente de soporte de Mercado Pago (`developers/panel/app/.../metrics`, widget "Asistente"), y confirmó: **la URL de autorización (`auth.mercadopago.com/authorization`) requiere el parámetro `platform_id=mp`**. Sin él, el token resultante queda limitado y no puede operar correctamente con funcionalidades de MP In-store/QR, aunque la cuenta conectada sea válida. El asistente también aclaró explícitamente que **no** hay que agregar un parámetro `scope` — no está soportado en este flujo y sería un camino equivocado.

`buildMercadoPagoAuthorizationUrl` en `server/mercado-pago.mjs` nunca mandaba `platform_id=mp` (no confundir con `integration_data.platform_id`, que es un concepto distinto — atribución opcional de partner, ya cubierta por `integrationData()` en el mismo archivo). Se agregó en el commit `72c4bfc`, con las 35+23+19 pruebas relevantes en verde y build limpio.

**Importante:** las cuentas ya conectadas antes de este fix (incluida la real que se conectó durante el diagnóstico) tienen un token obtenido *sin* `platform_id=mp` — van a seguir fallando hasta que se desconecten y se vuelvan a conectar para obtener un token nuevo correctamente habilitado.

### El fix de `platform_id=mp` era necesario pero NO fue suficiente (16/09/2026, noche)

Se confirmó el deploy live del commit `72c4bfc` en `/v1/health` (revision `b510bb54e35f`). Juan desconectó y reconectó Código QR con la misma cuenta real, con la URL de autorización ya incluyendo `platform_id=mp` (confirmado). `/v1/health` mostró `backendEnabled`/`oauthConfigured`/`webhookConfigured`/`ready` todos `true` y `testMode:false`.

Al generar la orden QR dinámico, **el error volvió a ocurrir exactamente igual**: HTTP 400, código `property_value`, `Invalid value for property`, `details[].field` sigue `null`. Nuevo request ID: `b315d0d1-9f11-4e85-a15e-65cc384c1b7b`.

Se le planteó esta actualización al asistente de soporte de Mercado Pago, que respondió con tres hipótesis adicionales a validar antes de escalar a un ticket humano:

1. **Que el token OAuth no esté quedando asociado al mismo "usuario efectivo" que el token fijo**, aunque se haya autorizado con la misma cuenta. Validación sugerida: `GET /users/me` con ambos tokens (fijo vs OAuth) y comparar el `id` devuelto.
2. **Confirmado: no hay parámetro `scope` documentado** para forzar más permisos en la URL de autorización del flujo `authorization_code` — insistir por ahí no es un camino real.
3. **Validar que el token OAuth realmente puede ver/operar los recursos "in-store" (POS/sucursal/terminal)** que usa para armar la orden: listar/obtener la POS con el mismo token OAuth con el que falla la creación de la orden, y comparar contra lo que devuelve el token fijo.

El propio asistente calificó el caso (misma cuenta, mismo payload, `details[].field` siempre `null`, dos intentos con y sin `platform_id=mp`) como más compatible con **un caso para revisión interna de Mercado Pago** que con un parámetro faltante del lado de Kiosco+, y se ofreció a abrir un ticket con toda la evidencia (request IDs incluidos). Juan confirmó abrirlo así, sin esperar el chequeo adicional de `GET /users/me`/POS.

### Ticket abierto a soporte de Mercado Pago (16/09/2026, noche)

Se le pidió al asistente que abriera la consulta con el resumen completo (Producto: QR Code; Tema: Orders API con Access Token OAuth; descripción con la comparación token fijo vs OAuth, confirmación de `platform_id=mp` presente y el problema persistiendo, y los tres request IDs de fallos: `6e2345d5-e7ef-4c4f-9f16-62467cb8abd5`, `193d2186-ed55-43aa-a5ad-c16bfe424b8e`, `b315d0d1-9f11-4e85-a15e-65cc384c1b7b`), más el AppID (`7595655096885201`) y la aclaración de que la cuenta vendedora conectada es la cuenta real de producción del dueño de la app, no una de prueba.

El asistente confirmó: **"¡Listo! Abrí una consulta para el soporte y pronto recibirás la confirmación en tu e-mail con el título que contiene el número de ticket en el siguiente formato: WCS-XXXXX"**. El ticket es **WCS-50768**. Se puede seguir el estado en el Centro de atención de Mercado Pago (`https://www.mercadopago.com.ar/developers/es/support/center/tickets/detail/WCS-50768`) o por e-mail.

### Respuesta de soporte humano y datos adicionales enviados (16/09/2026, noche)

Un agente humano (SUP_IXEXPERT_02) respondió el ticket: confirmó que el patrón (mismo payload, mismo token de cuenta, falla sólo con el token OAuth, `field: null`) **"no es consistente con un problema de scopes... ni con un payload inválido"** y que **"ha sido identificado internamente como un tema recurrente en la combinación Orders API + QR dinámico + token OAuth"**. Pidió tres datos para escalarlo: el body exacto de `POST /v1/orders`, si se envía `X-Idempotency-Key` y si cambia entre reintentos, y el prefijo del access token OAuth usado (para confirmar que es de producción).

Se armaron las tres respuestas a partir del código (`buildQrOrderPayload` en `server/mercado-pago.mjs` para el body exacto — confirma que no se envían `sponsor`, `cash_out` ni `integration_data` porque esas variables están vacías; la ruta `POST /v1/payments/attempts` en `server/cloud-server.mjs` para la idempotencia — la clave es estable durante toda la vida de un intento y no se regenera en los reintentos automáticos). Para el prefijo del token se agregó temporalmente una ruta de diagnóstico de sólo lectura (`GET /v1/payments/mercado-pago/qr/token-prefix-diagnostic`, protegida para el dueño, nunca expuso el token completo) y se confirmó **`APP_USR-7595`** — token de producción real. Esa ruta ya se retiró del backend (commit `f8497d8`) apenas se obtuvo el dato.

Importante para futuras sesiones: la conexión real de Mercado Pago para probar este bug vive en el negocio **Hidraulic shop** (tenantId `3a45375b-fbfc-4b3c-95fc-4d4b15a51296`), no en "Kiosco+ (no oficial)" — ese otro negocio quedó con una cuenta de prueba vieja y desconectada (`TESTUSER7499875603086904321`) de una etapa anterior del diagnóstico.

Las tres respuestas se enviaron al ticket el 16/09/2026 a la noche. Queda esperando la próxima respuesta de soporte.

### Nueva ronda de soporte (17/09/2026): tres datos más pedidos

Soporte volvió a responder el ticket `WCS-50768` pidiendo, para aislar la propiedad exacta que Mercado Pago rechaza:

1. El `curl` completo del `POST /v1/orders` (headers, path y body reales; token enmascarado con `***`).
2. El `config.qr.external_pos_id` exacto usado en una prueba fallida reciente, junto con la respuesta del GET con el que se valida esa POS antes de crear la orden.
3. El `user_id` que devuelve `GET /users/me` usando el mismo access token OAuth con el que falla.

Ninguno de los tres estaba capturado de antes (el log de rechazo sólo guardaba `externalReference` y el error traducido; Kiosco+ tampoco valida la POS con un GET antes de crear la orden en el camino normal — sólo lo hace como reparación si el error es `External POS id not found`, que no es este caso).

Primer intento: se agregó un log ampliado más una ruta de diagnóstico separada (`GET /v1/payments/mercado-pago/qr/oauth-context-diagnostic`, sólo dueño) que Juan tenía que llamar aparte con su propio token de sesión. Juan no la entendía como paso — pidió que lo hiciera Claude Code directamente. No es posible: la red de esta sesión tiene bloqueado `kiosco-plus-api.onrender.com` (confirmado con `curl`, `connect_rejected` por política de organización del proxy de egreso), y llamar a Mercado Pago con el token OAuth requiere ejecutar la lógica de desencriptado del servidor, no una consulta de sólo lectura a la base.

**Se simplificó (17/09/2026, noche):** en vez de una ruta separada, el mismo bloque `catch` que registra `[mercado-pago] orden rechazada` ahora también llama, en el momento del fallo y sólo si el tipo es `qr`, a `GET /users/me` y `GET /v2/pos?external_id=...` con el mismo token OAuth ya obtenido para esa orden (nunca se registra el token; si este diagnóstico falla no afecta la respuesta real al cajero). El log queda con:

```
{ attemptId, type, externalReference, failure,
  request: { method, path, idempotencyKey, body },
  oauthContext: { externalPosId, oauthUserId, posSearch } }
```

Con esto Juan sólo tiene que repetir la acción que ya sabe hacer (apretar **Generar QR dinámico** desde Ventas/Caja) y Claude Code saca los tres datos leyendo los logs de Render (`mcp__Render__list_logs`, `resource: srv-d9mdoclbedkc73dh42b0`, texto `"orden rechazada"`) — no hace falta DevTools, curl manual ni tokens pegados en el chat. Se retiró la ruta separada.

**Dato 1 ya obtenido (17/09/2026, noche), del intento con solicitud `65668936-f9f0-4a5b-9860-9329ec8159f2`:** `external_pos_id: CAJAE6237BCF51ACD9CA`, `idempotencyKey: 10a120fa-2170-4b31-991a-1aa4b2a23489`, importe `14300.00`. Body completo en el log de Render de esa fecha. Faltan los datos 2 y 3 (`oauthContext`): ese intento fue anterior a este cambio, así que no los tiene — hace falta un intento más, posterior al deploy de este commit.

Pasaron las 35 pruebas de `test:payments` y las 7 de `test:server-security` antes de este commit. Es temporal, igual que el diagnóstico anterior de prefijo del token (commit `c29a565`/`f8497d8`): retirar el bloque `oauthContext` de `server/cloud-server.mjs` cuando el ticket se resuelva.

### Próxima acción exacta

1. Confirmar el deploy de este commit en `/v1/health` (`revision`).
2. Pedirle a Juan que genere un intento real de QR dinámico desde Ventas/Caja del negocio **Hidraulic shop** (va a fallar igual que antes — no generar el QR ni completar el pago desde la sesión de Claude Code). Después, leer los logs de Render (`[mercado-pago] orden rechazada`) para sacar los tres datos (`request` + `oauthContext`) de una sola vez.
3. Armar la respuesta al ticket `WCS-50768` con los tres datos y enviarla.
4. Retirar el bloque `oauthContext` del log apenas se obtengan los datos, igual que se hizo con el diagnóstico de prefijo del token.
5. Una vez que Mercado Pago indique la causa real, aplicar el fix correspondiente, correr `pnpm test:payments`, `pnpm test:payment-ui`, `pnpm test:displays`, desplegar, y volver a pedirle a Juan que reconecte Código QR y genere el QR real él mismo desde Ventas/Caja (no generar el QR ni completar el pago desde la sesión de Claude Code).
6. Sólo si ese punto se confirma en vivo por Juan se puede considerar cerrado el bug y evaluar etiquetar 0.2.30 (ver criterio abajo).
7. No tocar el flujo de Point todavía — este diagnóstico fue sólo sobre Código QR. Point comparte la misma función `buildMercadoPagoAuthorizationUrl`, así que el fix de `platform_id=mp` ya le aplica, pero la causa adicional (si la hay) conviene verificarla por separado antes de darlo por bueno ahí también.

### Criterio para cerrar 0.2.30

Sólo etiquetar 0.2.30 si:

- se crea un QR sandbox visible por el importe correcto;
- la orden queda pendiente o aprobada según el flujo real;
- una falla no registra la venta ni descuenta stock;
- no se exponen datos privados en interfaz o registros;
- GitHub y el backend continúan sanos.

Si 0.2.30 vuelve a fallar y necesita cambios de código, comprobar primero con Juan si el número ya fue publicado. Si ya fue publicado, el arreglo pertenece a 0.2.31. Nunca sobrescribir silenciosamente una versión cerrada.

## 1.5. Desconexiones intermitentes del servidor — causa encontrada (16/09/2026)

Juan reportó que el backend de Render "pega unas desconexiones a veces". Se investigó con métricas y logs de Render y con una consulta de sólo lectura a Supabase.

**No es un problema de red ni de cold start.** El plan del servicio `kiosco-plus-api` es `starter`, con **límite de memoria de 512 MB** por instancia (`memory_limit` confirmado vía métricas: `536870900` bytes). El 15/09/2026 a las 21:08 UTC, memoria y CPU subieron de golpe: de ~220 MB estables a 389 MB en apenas 4 minutos, con CPU saltando de ~0.3% a ~26%. A las 21:12:04 UTC el proceso murió con:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

Render reinició la instancia automáticamente (`Instance ... restarted`), y volvió a crashear casi de inmediato con el mismo error. Esa ventana coincide con una sesión de pruebas intensas contra Mercado Pago (muchos pedidos seguidos al backend). Las métricas de `http_request_count` confirman picos de `502`/`499` exactamente en ese horario — eso es lo que Juan percibió como "desconexión".

**Causa estructural probable:** `readDb()`/`writeDb()` en `server/cloud-server.mjs` cargan y vuelven a escribir **la base completa de todos los negocios juntos** en memoria en cada pedido que necesita leer o mutar algo — no sólo los datos del negocio que hizo el pedido. Esto ya está documentado como limitación conocida en la sección "Disciplina de cambios" de `CLAUDE.md` ("las mutaciones se serializan dentro de una única instancia"), pero no se había medido el costo real en memoria. Se confirmó por consulta de sólo lectura a Supabase (tabla `kiosco_private.cloud_records_v2`): 28 MB totales, 2411 filas — el dato en sí es chico, pero varios pedidos simultáneos cargando su propia copia completa al mismo tiempo pueden sumar más de lo que entra en 512 MB, sobre todo con `scope = "change"` (bitácora de sincronización): 836 filas, 22 MB, una fila de hasta 470 KB.

### Arreglado y verificado en producción (16/09/2026)

Se confirmaron al menos **tres** episodios del mismo crash (`FATAL ERROR: Reached heap limit ... heap out of memory` seguido de reinicio automático de la instancia): 14/09 23:43, 15/09 02:43 y 15/09 21:12 (hora Argentina) — un patrón recurrente, no un evento aislado.

Se identificó la causa exacta con una consulta de sólo lectura a Supabase: las operaciones de sincronización `type: "set"` (ej. `userPreferences`, que en algún momento llegó a pesar ~470 KB por fila, probablemente por incluir la imagen del negocio) reemplazan por completo el valor de una clave, pero `db.changes` guardaba **todas** las versiones históricas en vez de sólo la última — a diferencia de `system_set`/`cuentas`, que ya tenía esa deduplicación. Sólo en el negocio Hidraulic shop se habían acumulado 195 copias de `userPreferences` (12 MB de los 22 MB totales del log de cambios), cargado entero en memoria en cada pedido al servidor vía `readDb()`.

**Fix (commit `b1bd7df`):** se generalizó `compactChangeLog()` en `server/cloud-server.mjs` para deduplicar también `type: "set"` por `(tenantId, key)`, igual que ya hacía con `cuentas` — un cliente que se pone al día sólo necesita la versión vigente de una clave (`isRedundantBootstrapOperation` en `src/cloud/syncEngine.js` ya trata `"set"` como reemplazo completo, así que esto no cambia el comportamiento de sincronización). También se aplicó la compactación dentro de `readDb()`, no sólo al recibir un cambio nuevo, para liberar de inmediato la memoria ya acumulada.

Pasaron 104 pruebas de nube y 35 de pagos antes de desplegar. Verificado en producción después del deploy (disparando un `/v1/sync/push` con `operations: []`, el mismo patrón ya usado en las pruebas automáticas, para forzar la persistencia de la limpieza): la base de `kiosco_private.cloud_records_v2` pasó de **28 MB a 8,2 MB** (-70%), de 2411 a 2126 filas, y cada clave quedó con una sola fila vigente.

### Si vuelve a ocurrir

Confirmar primero con `get_metrics` (Render MCP, `metricTypes: ["memory_usage", "memory_limit"]`) si coincide con memoria alta antes de asumir que es la misma causa — puede haber otro contribuyente distinto de `userPreferences`. Revisar también si el plan de Render (`starter`, 512 MB) sigue siendo suficiente a medida que crece el uso real; subirlo a `standard` es una mitigación de corto plazo válida si hiciera falta (tiene costo, pedir aprobación a Juan antes).

## 2. Qué es Kiosco+

Kiosco+ es una aplicación de gestión para kioscos, almacenes, despensas, minimercados y comercios pequeños de Argentina. Está diseñada para una persona que administra el negocio y para equipos chicos con permisos diferenciados.

La propuesta no es ser una suma de formularios técnicos, sino una herramienta cotidiana que responda preguntas simples:

- qué se vendió;
- cuánto stock queda;
- qué debe reponerse;
- cuánto debería haber en caja;
- qué mercadería vence;
- qué se pidió y qué se recibió;
- quién hizo una operación;
- cómo está funcionando el negocio.

El lenguaje visible debe ser claro, argentino y comprensible para una persona sin formación técnica.

## 3. Plataformas y servicios

### Aplicaciones y sitios

- Aplicación real: `https://app.kioscomas.ar/`.
- Landing pública: `https://kioscomas.ar/`.
- Pantalla remota fácil de escribir: `https://kioscomas.ar/pantalla`.
- Páginas públicas separadas: funciones, descargas, precios, términos y privacidad.
- Repositorio: `https://github.com/JuanPablo2905/Kioscomas`.
- API: `https://kiosco-plus-api.onrender.com`.
- Salud: `/v1/health`.
- Preparación de base: `/v1/ready`.
- Diagnóstico de secciones: `/v1/ready/sections`.

### Tecnología

- React 19 y JSX.
- Vite 8.
- Tailwind más estilos propios.
- Node.js para la API.
- PostgreSQL de Supabase en producción.
- Render para el sitio/app y la API.
- Electron para Windows y macOS.
- Capacitor para el proyecto Android.
- GitHub Actions para pruebas, monitoreo e instaladores.
- Resend para correo transaccional.
- Web Push con VAPID para avisos del sistema.
- Mercado Pago para QR estático, QR dinámico y Point.
- `@zxing/browser` para lectura de códigos.

Las versiones concretas están fijadas en `package.json`. CI usa Node 22 y pnpm 11.9.0. El monitoreo usa Node 24.

## 4. Arquitectura actual

### Principio local-first

La app guarda primero en el dispositivo y sincroniza después. Este comportamiento permite seguir operando ante una interrupción temporal de Internet después de un primer acceso válido.

La cola de sincronización vive en el cliente. Las entidades importantes viajan como registros independientes, no como un único JSON que pueda reemplazar todo el negocio. El motor hace rebase de ráfagas, conserva altas locales todavía no confirmadas y abre una revisión visible cuando existen conflictos reales.

Archivos principales:

- `src/cloud/config.js`: configuración de nube y dispositivo.
- `src/cloud/cloudAuth.js`: sesión y solicitudes autenticadas.
- `src/cloud/protocol.js`: contrato de operaciones.
- `src/cloud/entitySync.js`: sincronización por entidad.
- `src/cloud/conflictMerge.js`: resolución y combinación.
- `src/cloud/syncEngine.js`: cola, push/pull, rebase y estado visible.
- `src/cloud/dataStorageLock.js`: coordinación de escritura local.

### Backend

`server/cloud-server.mjs` es la API principal. Todavía concentra muchas rutas y exige cambios cuidadosos. Cada solicitud sensible vuelve a validar sesión, tenant, dispositivo y permiso.

La persistencia de producción usa `server/postgres-record-store.mjs` y la tabla privada `kiosco_private.cloud_records_v2`. Hay registros independientes para cuentas, usuarios, sesiones, dispositivos, activaciones, operaciones, catálogo, avisos, pagos, seguridad y estado del sistema.

Antes de modificar por primera vez un registro en un día se conserva su valor anterior. Las copias automáticas y los puntos de recuperación manual están descritos en `CLOUD-ARCHITECTURE.md` y `OPERACION_BETA_RESPALDOS_Y_MONITOREO.md`.

Las mutaciones se procesan en orden dentro de una sola instancia. Escalar horizontalmente sin bloqueo distribuido podría romper este supuesto.

### Frontend

`src/app/KioscoApp.jsx` coordina el estado general, la identidad, la navegación y la carga diferida de las áreas. Las vistas grandes viven en `src/features` y se cargan por demanda.

Áreas actuales:

- Inicio y resumen.
- Stock, productos, precios, códigos, inventario y transferencias.
- Vitrina y reposición.
- Ventas, caja, tickets, anulaciones, devoluciones y cobros combinados.
- Compras, proveedores, pedidos y recordatorios.
- Vencimientos y pérdidas.
- Gastos.
- Clientes, fiado y pedidos de clientes.
- Reportes.
- Gestión: promociones, etiquetas, comprobantes, tareas y herramientas.
- Usuarios, roles, permisos y administración central.
- Configuración, nube, dispositivos, copias, notificaciones y ayuda.

### Seguridad

- Contraseñas derivadas con sal.
- Tokens de acceso nuevos almacenados mediante hash.
- Access token corto y refresh token rotativo.
- Revocación al bloquear, eliminar, cambiar permisos, recuperar contraseña o desactivar dispositivo.
- Códigos temporales y recuperación almacenados mediante hash.
- Tokens de Mercado Pago cifrados con AES-256-GCM y clave exclusiva del servidor.
- CORS limitado, cabeceras defensivas, tamaño máximo de cuerpo y rate limits.
- Pantallas remotas reciben únicamente datos públicos saneados.
- Kiosco+ no almacena números de tarjeta.

No presentar esto como seguridad absoluta. Antes de escalar públicamente siguen recomendados segundo factor en todos los proveedores, gestor de contraseñas, alertas, rotación, simulacros y una auditoría externa.

## 5. Funciones y decisiones consolidadas

### Pantalla para clientes

- El editor es un lienzo libre. El negocio puede mover, cambiar tamaño, superponer u ocultar widgets, incluso si el resultado no es el diseño recomendado.
- WhatsApp, Instagram y cada red social son widgets separados. No volver a unir todas las redes en un único cuadro.
- Cada tarjeta social equilibra texto y QR según ancho, alto, tamaño de pantalla y cantidad de palabras.
- En tarjetas anchas y bajas el QR pasa al costado; en tarjetas altas permanece debajo.
- La bienvenida también es libre y adaptable. No fijarla al centro.
- Promociones y medios de pago deben tener participación visual proporcional al tamaño del widget, no quedar como una línea diminuta dentro de un bloque enorme.
- Cada tira de promociones puede mostrar una selección distinta. No duplicar automáticamente la misma promoción en todas.
- La dirección del movimiento se adapta a la forma: horizontal cuando predomina el ancho y vertical cuando predomina el alto. El negocio puede configurar contenido, movimiento, velocidad y cantidad visible.
- El widget de medios de pago cambia entre horizontal, vertical o cuadrícula.
- Los pagos combinados muestran en la segunda pantalla cada medio y su importe.
- La vista previa del editor y la pantalla real deben usar los mismos componentes y cálculos. No mantener dos interpretaciones visuales distintas.

### Pantallas remotas

- La TV entra por `kioscomas.ar/pantalla`.
- La pantalla muestra QR y código temporal; no se autoriza a sí misma.
- El dueño autoriza desde su app.
- La credencial remota sólo permite descargar contenido público.
- El dueño puede listar y revocar pantallas.
- El código y las credenciales no se almacenan en texto legible.

### Notificaciones y auditoría

- Una operación sobre un producto genera un aviso/evento por producto, no uno por cada unidad. Recibir 11 unidades de un mismo producto debe producir una sola notificación que diga 11.
- Los avisos viejos repetidos pueden agruparse para no abrumar, sin perder el total real.
- Los avisos se separan en operación del negocio, cuenta/plan y novedades de Kiosco+. Stock o compras no deben aparecer como mensajes del administrador de la plataforma.
- Una copia entregada por la nube reemplaza su duplicado local mediante claves de origen.
- La auditoría visible muestra nombres de producto, proveedor, pedido, meta o modo; no identificadores internos.
- Si un registro antiguo sólo conserva un ID, intentar resolver el nombre desde los datos del negocio. Si ya no existe, mostrar una descripción genérica, nunca el código crudo.

### Pedidos y WhatsApp

- Los pedidos de clientes reservan varios productos y cantidades sin descontar stock hasta la operación correspondiente.
- Fecha y hora de retiro usan controles de calendario/horario y generan un único recordatorio por pedido/producto según las reglas, no por unidad.
- Las funciones de compartir normalizan números argentinos y arman mensajes legibles para proveedor o cliente.
- La conexión actual con WhatsApp es un enlace/mensaje preparado; no asumir que existe una API empresarial con envío silencioso.

### Ventas y caja

- El ID interno de una venta es distinto del número corto visible del ticket.
- Anular/devolver conserva historial y auditoría; no borra la venta como si nunca hubiera existido.
- El stock vuelve sólo cuando corresponde y los movimientos de caja se ajustan según el medio.
- Tarjeta, transferencia u otro proveedor externo no deben marcar un reintegro como realizado hasta confirmarlo fuera o dentro de la integración correspondiente.
- Un pago combinado se configura en una única pantalla, con filas editables, en vez de encadenar varios modales.
- La forma de cobro de Mercado Pago puede preguntarse en cada venta o tomar una preferencia: QR estático, QR dinámico o Point.
- El destino del QR puede preguntarse o quedar predeterminado: este dispositivo, pantalla del cliente u otro celular con la app abierta.

### Sitio público

- La portada debe ser limpia y resumir, no contener todos los detalles.
- Descargas vive en una página propia, con Windows, Mac Apple Silicon y Mac Intel.
- Funciones diferenciadoras se resumen en la portada y llevan a una página de detalle.
- Mercado Pago debe destacarse visualmente, pero sin anunciar como lista una solución todavía no comprobada.
- Precios deben explicar con claridad beta, meses iniciales, precio de lista, dispositivos incluidos y referidos.
- Términos y privacidad deben identificar al proveedor sin frases colgantes o ambiguas como “en adelante...” fuera de contexto.

## 6. Mercado Pago: diseño, configuración y límites

### Por qué QR y Point están separados

Mercado Pago exige una aplicación por solución presencial. Por eso Kiosco+ conserva:

- credenciales OAuth separadas;
- conexión y renovación separadas;
- secreto de webhook separado;
- estado de preparación separado;
- una condición adicional: ambas soluciones deben pertenecer a la misma cuenta vendedora del negocio.

No volver a una sola credencial global sólo para simplificar la interfaz. La interfaz puede mostrarlas juntas, pero el backend debe mantener la separación.

### Circuito QR dinámico

1. El dueño conecta Código QR mediante OAuth con PKCE.
2. El backend cifra tokens; el navegador nunca recibe el access token.
3. Se crea o recupera sucursal y caja con dirección y coordenadas.
4. El servidor verifica que la caja pertenezca al vendedor conectado y la deja en modo `pdv`.
5. La caja crea un `payment_attempt` con referencia e idempotencia estables.
6. El backend envía `/v1/orders` a Mercado Pago.
7. La trama QR se obtiene de `type_response.qr_data`, con compatibilidad de lectura anterior.
8. El intento espera estado real; el QR puede mostrarse en el dispositivo elegido.
9. Webhook y consultas normalizan el estado.
10. Sólo una aprobación permite vincular un ticket.

### Circuito Point

1. Conectar la aplicación Point con el mismo vendedor.
2. Descubrir terminales de esa cuenta.
3. Elegir una terminal asociada a la sucursal/caja.
4. Activar modo integrado PDV.
5. Reiniciar físicamente el Point antes de la primera prueba.
6. Enviar el importe a la terminal y esperar la aprobación.

El backend está preparado, pero no declarar Point validado de punta a punta hasta probar con un dispositivo físico real y confirmar aprobación, rechazo, cancelación y conciliación.

### QR estático

El negocio carga su imagen QR. Kiosco+ la muestra y la confirmación es manual. No fingir que existe una acreditación automática para el QR estático.

### Envío a otro celular

El dispositivo de caja publica temporalmente una presentación con importe, QR y reparto del pago. Otro dispositivo autenticado del mismo negocio consulta presentaciones activas, la abre y confirma `seen`. La caja puede informar que llegó. Al finalizar o cancelar, la presentación se elimina.

El bug original era que “mandar al celular” no daba ninguna señal. La decisión fue agregar acuse de recibo y aviso push, no mantener un envío silencioso imposible de diagnosticar.

### Variables

Los nombres completos están en `.env.example`, `render.yaml` y `MERCADO_PAGO_BACKEND.md`. Nunca documentar los valores.

Familias:

- interruptor general y modo de prueba;
- URI de callback y retorno;
- clave de cifrado de tokens;
- client ID, client secret y webhook secret de QR;
- client ID, client secret y webhook secret de Point;
- variables antiguas compatibles sólo con QR;
- IDs opcionales de plataforma, integrador o sponsor.

No inventar los IDs opcionales ni usar el ID de la aplicación. Si Mercado Pago no los asignó expresamente, se dejan vacíos.

### Sandbox y producción

- Durante pruebas, `KIOSCO_MERCADOPAGO_TEST_MODE=1`.
- El OAuth usa una aplicación productiva autorizada por un vendedor de prueba. Pedir un token TEST directamente resultó incompatible con Orders y fue corregido en 0.2.28.
- El backend rechaza una cuenta real mientras está en modo prueba.
- Para producción se cambia a 0, se despliega y se reconectan ambas soluciones. Nunca reutilizar tokens sandbox.
- Mercado Pago puede exigir homologación o revisión comercial para conectar múltiples vendedores reales. Ningún cambio de código reemplaza esa aprobación.

### MCP/plugin del asistente

Se probó el plugin/MCP oficial de Mercado Pago para documentación y diagnóstico. La autorización del MCP quedó asociada a una aplicación de prueba distinta de la aplicación QR creada para Kiosco+, por lo que no pudo inspeccionar la aplicación real. Esto no afecta al runtime de Kiosco+.

No confundir `MP_MCP_ACCESS_TOKEN` con las credenciales OAuth del backend. El MCP es una herramienta del asistente; no forma parte del producto ni configura los cobros de los clientes.

## 7. Variables y secretos

### Variables públicas de compilación

`.env.cloud` contiene URLs y datos legales públicos de la app real. `.env.public` contiene datos públicos de landing/demo, precios, descargas y contacto. Las variables `VITE_*` quedan dentro del JavaScript entregado al navegador; nunca colocar un secreto allí.

### Secretos del backend

Render administra, entre otros:

- `DATABASE_URL`;
- credenciales de superadministrador;
- Resend y correo;
- VAPID privado;
- credenciales y firmas de Mercado Pago;
- clave de cifrado de tokens.

`render.yaml` marca los secretos con `sync: false`. Los valores pueden desaparecer si se recrea un servicio o se aplica mal un Blueprint; comprobarlos por sus indicadores públicos, no imprimiéndolos.

### Secretos de publicación

GitHub Secrets puede contener certificados de Windows, Apple, notarización y firma Android. Las guías específicas explican los nombres.

Juan debe ingresar los secretos directamente en los paneles. No pedir que los pegue en el chat ni almacenarlos en este documento.

## 8. Pruebas y calidad

### Batería principal

`pnpm run test:all` prueba configuración cloud, warmup, persistencia, copias, cierre de procesos, seguridad, permisos, tutoriales, pantallas, PWA, notas de versión, preparación de lanzamiento, pagos, avisos, sitio público, activaciones, recuperación, vistas, funciones y build de Vite.

El workflow de calidad agrega `pnpm run test:cloud`.

### Último resultado comprobado en 0.2.30

- 32 aserciones de configuración cloud.
- 9 de warmup.
- almacenamiento PostgreSQL por registro verificado.
- restauración en seco de 9 registros.
- 24 pruebas de seguridad y recuperación.
- 7 límites del servidor.
- 124 destinos de tutoriales.
- configuración de pantallas libre y migraciones verificadas.
- tarjetas sociales y bienvenida adaptables verificadas.
- 42 comprobaciones PWA.
- 12 entradas de notas, incluida 0.2.30.
- 35 pruebas del backend de pagos.
- 23 pruebas de interfaz de pagos y pantallas.
- 5 pruebas de avisos e interfaz.
- 27 comprobaciones del sitio público y acceso.
- 122 pruebas funcionales.
- build de producción: 2156 módulos transformados y salida exitosa.
- GitHub CI: exitoso, incluido `test:cloud`.

### Advertencia conocida

Vite puede mostrar advertencias amarillas indicando que sourcemaps de `@zxing/browser` apuntan a fuentes fuera de su paquete. Provienen de la dependencia y ya aparecían con compilación exitosa. No detener un release sólo por esas líneas si la salida termina en éxito, pero volver a evaluar al actualizar ZXing.

### Pruebas desde la vista del usuario

Para cambios visibles no alcanza con buscar texto en archivos. Probar, según corresponda:

- teléfono angosto y teléfono horizontal;
- iPhone con teclado abierto/cerrado;
- computadora;
- PWA actualizada y caché anterior;
- modal con poco y mucho contenido;
- foco por teclado y Escape;
- hover/focus/active/disabled;
- tema y contraste;
- red lenta o sin red;
- dos dispositivos cuando la función es remota;
- datos extremos: nombres largos, muchas unidades, widgets muy chatos o altos.

## 9. Historial de paquetes trabajados

El historial completo visible comienza en `release-notes/releases.json`. Este resumen explica el hilo de decisiones más reciente.

### 0.2.16–0.2.17

- Redes sociales separadas en widgets independientes.
- Mejoras de migración y límites del lienzo.
- Pedidos, avisos y auditoría empezaron a mostrar datos humanos y a evitar repeticiones por unidad.
- Ajustes visuales para que los cuadros no se cortaran en tamaños extremos.

### 0.2.18

- Adaptación real de texto y QR según forma del widget.
- QR al costado en cuadros anchos/bajos.
- Inicio del sistema automático de notas de versión.

### 0.2.19

- Bienvenida libre, movible y adaptable.
- Reparación de la landing cuando cargó sin estilos.
- Auditoría de pedidos con nombres en vez de IDs.

### 0.2.20

- Ventas, devoluciones, caja e importaciones reforzadas.
- Códigos EAN/UPC reales para etiquetas.
- IDs resistentes a operaciones simultáneas.
- Primera base del backend de Mercado Pago, todavía apagada.

### 0.2.21

- Permisos validados en servidor.
- Revocación real de sesiones ante cambios de equipo.
- Exportación, comparación y recuperación aislada.

### 0.2.22

Juan informó que esta versión ya existía. El repositorio actual no conserva etiqueta ni notas para ella. El número se considera consumido y no debe rellenarse ni reutilizarse.

### 0.2.23

- Flujo visible de QR estático, QR dinámico y Point.
- Preferencia de método y destino del QR.
- Pago combinado visible en segunda pantalla.
- Promociones seleccionables por widget y medios de pago adaptables.
- Precios y destaque responsable de Mercado Pago en la landing.

### 0.2.24

- Configuraciones conectadas a comportamiento real.
- Carga diferida de áreas pesadas.
- Accesibilidad, foco, PWA con caché por versión.
- Preparación de Windows, Mac, Microsoft Store, Google Play y Android.

### 0.2.25

- Corrección del proceso de pruebas que quedaba vivo y hacía esperar 35 minutos.
- Cierre limpio de servidores auxiliares y salida de emergencia.

### 0.2.26

- Confirmación de que el QR llegó al otro celular.
- Modal de cobro unificado.
- Avisos separados por naturaleza y deduplicados.
- Landing limpia, páginas de Funciones/Descargas y ruta `/pantalla`.
- Corrección del falso slider y colores que parpadeaban con el mouse.
- Más límites y defensas del servidor.

### 0.2.27

- Backend completo de Orders v1 para QR y Point.
- OAuth, webhooks y tokens separados por solución.
- Sucursal/caja QR, descubrimiento de Point, conciliación, cancelación y devolución.
- Integración real preparada detrás de interruptores.

### 0.2.28

- OAuth sandbox corregido para no solicitar tokens TEST incompatibles.
- Bloqueo preventivo de vendedor real en modo de prueba.
- Franja gris del teclado de iPhone corregida.

### 0.2.29

- Caja QR verificada desde servidor y convertida a `pdv`.
- Reparación automática de `External POS id not found`.
- ID de caja sólo lectura en interfaz.

### 0.2.30

- Ítem resumen para compatibilidad con Merchant Orders interno.
- Omisión de IDs opcionales inválidos.
- Diagnóstico seguro y visible de rechazos del proveedor.
- No consultar órdenes que nunca fueron creadas.
- Pendiente: prueba real final de QR y etiqueta.

## 10. Trabajo pendiente acordado

### Prioridad 1: cerrar QR dinámico

Es el punto inmediato descrito al principio. No saltarlo para construir funciones nuevas.

### Prioridad 2: selector de ubicación aceptada por Mercado Pago

Juan pidió que ciudad y provincia dejen de ser texto libre. El objetivo es ofrecer opciones admitidas por Mercado Pago para impedir errores por ortografía o nombres no aceptados.

Diseño recomendado:

- provincia primero y ciudad dependiente;
- fuente oficial o catálogo controlado del servidor, no una lista improvisada en JSX;
- guardar código canónico y etiqueta visible;
- conservar compatibilidad con configuraciones existentes;
- mostrar un estado claro si la API externa no está disponible;
- pruebas de nombres con acentos, CABA y localidades homónimas.

No se implementó todavía.

### Prioridad 3: cuentas recordadas con PIN

Idea debatida, no implementada:

- un dispositivo puede recordar varias cuentas que ya iniciaron sesión correctamente;
- al abrir, se elige un perfil visual y se ingresa un PIN corto propio de ese perfil;
- no guardar la contraseña original;
- el PIN desbloquea una credencial renovable cifrada/vinculada al dispositivo;
- permitir quitar una cuenta recordada y revocar el dispositivo desde el servidor;
- aplicar límites de intentos y borrado/reautenticación después de demasiados fallos;
- mostrar claramente negocio, usuario y rol para evitar entrar en la cuenta equivocada.

Biometría debe ser opcional y posterior. Face ID o huella verifican que el sistema operativo reconoció a alguna persona autorizada en ese dispositivo; no identifican qué empleado es ni qué cuenta debe abrirse. Por eso no reemplazan el selector de cuenta ni el PIN por perfil. Pueden desbloquear el almacén seguro del dispositivo después de elegir la cuenta.

### Prioridad 4: Point físico y producción

- Crear/verificar la aplicación Point independiente si fue borrada o reemplazada.
- Confirmar que las variables de Point pertenecen a una aplicación vigente, no sólo que están presentes.
- Conectar el mismo vendedor que QR.
- Vincular terminal física, activar PDV y reiniciar.
- Probar aprobación, rechazo, cancelación, devolución y conciliación.
- Pasar a producción sólo después de homologación y cambio consciente de `TEST_MODE`.

### Prioridad 5: revisión integral desde el cliente

Juan pidió repetir una auditoría completa después de estas implementaciones. Debe revisar:

- recorridos completos, no componentes aislados;
- funciones visibles que no hacen nada;
- información que falta para tomar decisiones;
- duplicaciones, nombres técnicos y mensajes sin salida;
- móvil, escritorio, PWA, segunda pantalla y landing;
- consistencia con el lenguaje y el diseño actuales;
- permisos reales de dueño/empleado;
- vacíos, errores, carga, offline y recuperación;
- accesibilidad y estilo moderno;
- seguridad observable para el cliente.

Primero entregar hallazgos y propuestas. Si Juan pide sólo análisis, no arreglarlos hasta su confirmación.

## 11. Ideas debatidas que no deben confundirse con funciones hechas

- Huella/Face ID para acceso: posible, todavía no implementado; no identifica cuentas individuales.
- Cuentas recordadas con PIN: propuesta acordada en principio, sin código.
- Selector de ciudades/provincias de Mercado Pago: pedido confirmado, sin código.
- Point real: backend e interfaz preparados; prueba con hardware pendiente.
- QR dinámico productivo para clientes: requiere cerrar sandbox, homologación y reconexión productiva.
- Cobro de la suscripción de Kiosco+ por Mercado Pago: la landing/configuración pueden mostrar estado o enlace, pero no confundirlo con cobrar las ventas del negocio.
- Integración con otras marcas de posnet: fue preguntada como posibilidad. No se eligió proveedor ni contrato y no está implementada. Mantener una capa de proveedor antes de sumar otro, sin forzar todos los equipos al modelo de Mercado Pago.

## 12. Publicación y distribución

### Push a main

Dispara `.github/workflows/quality.yml`, que ejecuta pruebas completas y la integración cloud. Render está conectado a la rama y publica servicios según su configuración.

### Tag de versión

Un tag `v*` dispara `.github/workflows/release-windows.yml`:

1. comprueba que tag y `package.json` coincidan;
2. corre pruebas;
3. genera notas desde `release-notes/releases.json`;
4. crea release borrador;
5. compila Windows, Mac Intel y Mac Apple Silicon;
6. publica el release sólo si todos terminaron.

No crear un tag para “ver si compila”. Probar antes en `main`.

### PWA

El service worker incorpora la versión de `package.json` al nombre de caché. La app avisa cuando hay una versión nueva. Una recarga puede obligar a renovar o repetir la sesión; no confundirlo con pérdida de datos.

### Tiendas

- Microsoft Store y Google Play tienen workflows/manuales preparados, no publicación automática completa.
- Mac puede compilar sin firma, pero la distribución sin advertencias requiere certificado Developer ID y notarización.
- Windows sin certificado puede mostrar editor desconocido.

## 13. Operación y diagnóstico

### Si Render parece trabado

- mirar `/v1/health` y `revision`;
- mirar `/v1/ready` para PostgreSQL;
- revisar que el commit esperado haya llegado;
- distinguir el tiempo de build de un proceso auxiliar que no cierra;
- el problema de pruebas colgadas fue corregido en 0.2.25.

### Si la landing carga sin estilos

El incidente anterior mostró HTML con enlaces y tipografía gigante. La causa estaba en la publicación de recursos/estilos, no en el contenido. Existen pruebas de que la portada conserve CSS, rutas, ancho y diseño base. Comprobar build público y rutas antes de retocar el diseño.

### Si una pantalla no muestra QR ni código

- verificar que la compilación pública conozca `VITE_PUBLIC_API_URL` y `VITE_PUBLIC_DISPLAY_URL`;
- comprobar `/pantalla` y su reescritura en `render.yaml`;
- confirmar que la API genera el vínculo y no que la pantalla intenta autorizarse sola.

### Si las notificaciones se duplican

- comprobar `sourceKey`/clave de origen entre local y nube;
- distinguir unidades de producto de operaciones;
- una recepción de 11 unidades es un evento con cantidad 11;
- revisar que el aviso pertenezca a negocio, cuenta o plataforma correctos;
- no borrar historial para esconder la duplicación.

### Si Mercado Pago falla

- comprobar modo prueba y cuenta sandbox;
- comprobar conexión por solución;
- comprobar caja verificada y `pdv`;
- no usar IDs opcionales inventados;
- reutilizar idempotencia en el mismo intento;
- abrir diagnóstico técnico;
- usar request ID para soporte;
- no marcar la venta como cobrada.

## 14. Riesgos y deuda consciente

- `server/cloud-server.mjs` y `src/app/KioscoApp.jsx` siguen siendo grandes. Modularizar por dominios es deseable, pero no durante un arreglo urgente sin cobertura equivalente.
- La aplicación es JavaScript, no TypeScript. Agregar tipos de golpe ampliaría demasiado el cambio; si se migra, hacerlo por bordes y con pruebas.
- La sincronización multiinstancia no está resuelta.
- La validación de proveedores externos sólo puede simularse parcialmente; hacen falta pruebas reales controladas.
- Los manuales generales quedaron atrasados respecto de las versiones recientes. Este traspaso define la precedencia, pero conviene regenerarlos después de cerrar Mercado Pago.
- El repositorio contiene carpetas de builds y documentación histórica. No borrar masivamente sin revisar qué usa publicación o soporte.
- Los importes y condiciones comerciales de la landing pueden cambiar. Verificarlos con Juan antes de publicarlos; no inferir precios desde una captura antigua.

## 15. Cómo continuar sin romper el producto

1. Leer `CLAUDE.md` y este documento.
2. Confirmar versión, rama, estado y despliegue.
3. Reproducir el problema desde el recorrido del usuario.
4. Identificar qué capa falla: interfaz, almacenamiento local, sincronización, API, proveedor o publicación.
5. Escribir o ampliar una prueba que represente el fallo.
6. Hacer el cambio mínimo que preserve decisiones existentes.
7. Ejecutar pruebas enfocadas.
8. Ejecutar `test:all`, `test:cloud` y `git diff --check` antes de cerrar una versión.
9. Probar visualmente lo que el cliente ve.
10. Agregar notas técnicas y **En criollo**.
11. Commit y push; esperar CI y backend.
12. Comprobar la revisión publicada.
13. Recién entonces etiquetar si el paquete está cerrado.

## 16. Documentos relacionados

- `CLAUDE.md`: reglas automáticas y mapa rápido.
- `docs/DECISIONES_DE_PRODUCTO_Y_TECNICAS.md`: motivos de decisiones A/B.
- `docs/MERCADO_PAGO_BACKEND.md`: contrato y configuración de pagos.
- `docs/CLOUD-ARCHITECTURE.md`: persistencia y sincronización de servidor.
- `docs/SEGURIDAD_Y_RESPUESTA_A_INCIDENTES.md`: amenazas y respuesta.
- `docs/OPERACION_BETA_RESPALDOS_Y_MONITOREO.md`: copias y controles.
- `docs/PUBLICAR_ACTUALIZACION.md`: reglas de versiones.
- `docs/PUBLICAR_EN_MAC.md`, `PUBLICAR_EN_MICROSOFT_STORE.md`, `PUBLICAR_EN_GOOGLE_PLAY.md`: distribución.
- `docs/CONFIGURAR_CORREOS_RESEND.md`: correo.
- `docs/CONFIGURAR_NOTIFICACIONES_PUSH.md`: avisos al sistema.
- `release-notes/releases.json`: descripción exacta de cada paquete reciente.

## 17. Resumen en criollo para el próximo asistente

Kiosco+ ya es una app real, con web, escritorio, celular, nube, base, usuarios, permisos, copias y muchísimas pruebas. No es el prototipo viejo que describen algunos manuales históricos.

Lo más delicado ahora es Mercado Pago. Ya se conectó la cuenta de prueba, se creó la caja y se corrigieron varios problemas reales. La versión 0.2.30 acaba de agregar compatibilidad y un diagnóstico que muestra qué rechaza Mercado Pago sin filtrar secretos. Está subida y desplegada, pero todavía nadie pudo volver a generar el QR porque al actualizar la app se cerró la sesión. El primer trabajo es entrar, probar ese QR sin confirmar la venta y decidir con evidencia si 0.2.30 se etiqueta o si el arreglo siguiente debe ir a 0.2.31.

Después vienen el selector de ciudad/provincia admitida por Mercado Pago, el acceso rápido con varias cuentas y PIN, la biometría sólo como ayuda del dispositivo, la prueba física de Point y una auditoría completa desde la mirada del cliente.
