# Cobros conectados con Mercado Pago

## Estado de la implementación

El código de Kiosco+ ya cubre el circuito de QR estático, QR dinámico y Mercado Pago Point. La conexión real permanece apagada hasta que se creen las aplicaciones en Mercado Pago, se carguen los secretos exclusivamente en Render y se haga una prueba con una cuenta vendedora de prueba.

Mercado Pago requiere una aplicación diferente por cada solución: una para **Código QR** y otra para **Point**. Kiosco+ muestra ambas conexiones por separado y exige que el negocio autorice las dos con la misma cuenta vendedora. Cada access token y refresh token se cifra con AES-256-GCM en el servidor y nunca se envía al navegador, a la aplicación instalada ni al repositorio. Si Mercado Pago rota un refresh token, Kiosco+ persiste el nuevo antes de seguir; si una autorización vence o se revoca, la interfaz solicita reconectar sólo esa solución sin borrar sucursal, caja ni historial.

`MP_MCP_ACCESS_TOKEN` pertenece únicamente al conector local que usa Codex para consultar documentación y herramientas de prueba. No configura el backend de Kiosco+, no debe cargarse en el frontend ni reemplaza las credenciales OAuth de las aplicaciones QR y Point.

## Qué puede hacer Kiosco+

- Conectar QR y Point por separado con OAuth, `state` de un solo uso y PKCE S256, sin permitir que queden vinculados a vendedores distintos.
- Crear o recuperar una sucursal y una caja de Mercado Pago sin duplicarlas si se reintenta el asistente.
- Comprobar que la caja pertenezca a la cuenta actualmente conectada, convertirla a modo QR integrado `pdv` y repararla automáticamente si quedó desactualizada tras cambiar la autorización.
- Validar la dirección física completa exigida por Mercado Pago: calle, número, ciudad, provincia y coordenadas.
- Crear una order QR dinámica por el importe exacto, leer la trama vigente desde `type_response.qr_data` y mostrarla en la caja, la pantalla del cliente u otro celular del mismo negocio.
- Mostrar el QR estático cargado por el negocio, con confirmación manual.
- Descubrir terminales Point de la cuenta, comprobar que pertenezcan a la sucursal/caja elegida y activarlas en modo integrado PDV.
- Enviar una order al Point seleccionado y esperar la acreditación antes de registrar la venta.
- Repartir correctamente el importe de un pago combinado y mostrar ese detalle en la segunda pantalla o el celular.
- Consultar, cancelar y devolver orders con claves de idempotencia persistentes.
- Vincular de forma exclusiva el cobro aprobado con el ticket local y reintentar la conciliación al recuperar Internet.
- Recibir webhooks firmados, ignorar duplicados y avisar por acreditaciones, devoluciones externas o contracargos.
- Ejecutar primero el reintegro real en Mercado Pago y sólo después modificar stock, caja y estado del ticket local.
- Eliminar tokens cifrados, intentos y presentaciones al eliminar definitivamente un negocio.

Los empleados con permiso de Ventas pueden cobrar. Sólo el dueño puede conectar o desconectar la cuenta, crear la sucursal/caja, elegir el Point y devolver dinero.

## Lo que debe configurar el responsable de Kiosco+

No copiar credenciales en GitHub, en un archivo enviado por chat ni en variables `VITE_*`: son secretos exclusivos del servidor.

1. Crear en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app) una aplicación de **Pagos presenciales > Código QR** y otra de **Pagos presenciales > Mercado Pago Point**. Mercado Pago indica expresamente que debe existir una aplicación por cada solución integrada.
2. Activar el flujo OAuth `Authorization code` y PKCE en los detalles de ambas aplicaciones.
3. Registrar en ambas exactamente esta URL de redirección:

   `https://kiosco-plus-api.onrender.com/v1/payments/mercado-pago/oauth/callback`

4. En las notificaciones de cada aplicación, habilitar **Order (Mercado Pago)** y registrar exactamente:

   `https://kiosco-plus-api.onrender.com/v1/payments/mercado-pago/webhook`

5. Copiar por separado el secreto de firma del webhook de QR y el de Point.
6. Cargar en el servicio privado `kiosco-plus-api` de Render:

   - `KIOSCO_MERCADOPAGO_QR_CLIENT_ID`
   - `KIOSCO_MERCADOPAGO_QR_CLIENT_SECRET`
   - `KIOSCO_MERCADOPAGO_QR_WEBHOOK_SECRET`
   - `KIOSCO_MERCADOPAGO_POINT_CLIENT_ID`
   - `KIOSCO_MERCADOPAGO_POINT_CLIENT_SECRET`
   - `KIOSCO_MERCADOPAGO_POINT_WEBHOOK_SECRET`
   - `KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY`: secreto aleatorio de al menos 32 caracteres, distinto de todas las demás claves.
   - `KIOSCO_MERCADOPAGO_TEST_MODE=1` durante el desarrollo. Esta bandera hace que OAuth solicite credenciales sandbox y deja una advertencia visible en Configuración.

   Las variables antiguas `KIOSCO_MERCADOPAGO_CLIENT_ID`, `KIOSCO_MERCADOPAGO_CLIENT_SECRET` y `KIOSCO_MERCADOPAGO_WEBHOOK_SECRET` siguen funcionando sólo como compatibilidad para Código QR. No habilitan Point.

7. Cargar `KIOSCO_MERCADOPAGO_PLATFORM_ID`, `KIOSCO_MERCADOPAGO_INTEGRATOR_ID` o `KIOSCO_MERCADOPAGO_SPONSOR_ID` únicamente si Mercado Pago asignó esos valores a Kiosco+. No inventarlos ni usar el identificador de otra integración.
8. Cuando estén guardadas las credenciales de las soluciones que se van a probar y la clave de cifrado, establecer `KIOSCO_MERCADOPAGO_BACKEND_ENABLED=1` y volver a desplegar el backend.
9. Verificar `https://kiosco-plus-api.onrender.com/v1/health`: dentro de `paymentProviders.mercadoPago.solutions`, QR y Point deben informar `ready: true` y `webhookConfigured: true`. La respuesta sólo informa disponibilidad y no expone secretos.
10. Desde Kiosco+, entrar como dueño a **Configuración > Funcionamiento > Mercado Pago**, conectar primero Código QR y luego Point usando la misma cuenta vendedora de prueba. Después, ejecutar el asistente de sucursal/caja QR.

Para Point, además hay que vincular físicamente el lector con la misma cuenta, sucursal y caja desde Mercado Pago. Después Kiosco+ podrá encontrarlo, pasarlo a modo PDV y seleccionarlo. Mercado Pago admite un Point integrado por caja; tras cambiar el modo, hay que reiniciar el lector antes de la primera prueba.

Según la habilitación comercial de la aplicación, Mercado Pago puede exigir revisar o aprobar la integración antes de permitir que múltiples vendedores reales usen QR/Point. Eso no se resuelve con una variable ni desde Kiosco+: debe gestionarse en el panel o con soporte de Mercado Pago.

Antes de pasar a producción hay que cambiar `KIOSCO_MERCADOPAGO_TEST_MODE=0`, desplegar otra vez y reconectar QR y Point. Los tokens sandbox nunca se reutilizan para cobros reales.

## Orden de prueba recomendado

1. Usar las credenciales de las aplicaciones QR y Point y un usuario vendedor de prueba.
2. Conectar QR y Point desde Kiosco+ con ese mismo vendedor.
3. Crear la sucursal y la caja con una ubicación válida.
4. Probar un QR dinámico de importe pequeño; verificar acreditación, ticket y notificación.
5. Probar cancelar una order pendiente y devolver una acreditada.
6. Probar un pago combinado.
7. Si hay Point, asociarlo, activar PDV y probar aprobación, rechazo y cancelación.
8. Cerrar una caja durante un cobro y confirmar que el webhook reconcilia al volver a abrirla.
9. Recién después conectar una cuenta productiva.

No existe una prueba local que mueva dinero: la validación final requiere las credenciales de prueba y la infraestructura de Mercado Pago.

## Contrato HTTP interno

Todas las rutas autenticadas usan `Authorization`, `x-tenant-id` y `x-device-id`.

- `GET /v1/payments/providers`: disponibilidad, conexión, sucursal/caja y Point del negocio.
- `POST /v1/payments/mercado-pago/oauth/start`: inicia OAuth para la solución indicada en `solution` (`qr` o `point`).
- `GET /v1/payments/mercado-pago/oauth/callback`: consume el código OAuth en el servidor.
- `DELETE /v1/payments/mercado-pago/connection?solution=qr|point`: elimina sólo las credenciales cifradas de esa solución.
- `POST /v1/payments/mercado-pago/qr/setup`: crea o recupera sucursal y caja.
- `GET /v1/payments/mercado-pago/terminals`: lista los Point de la cuenta.
- `POST /v1/payments/mercado-pago/point/setup`: valida el Point y activa PDV.
- `POST /v1/payments/attempts`: crea una order `qr` o `point`; requiere `x-idempotency-key`.
- `GET /v1/payments/attempts`: lista conciliaciones recientes.
- `GET /v1/payments/attempts/:id`: lee un intento.
- `POST /v1/payments/attempts/:id/refresh`: consulta el estado real.
- `POST /v1/payments/attempts/:id/cancel`: cancela una order pendiente.
- `POST /v1/payments/attempts/:id/refund`: devuelve una order acreditada.
- `POST /v1/payments/attempts/:id/complete`: vincula el cobro aprobado con un único ticket.
- `POST /v1/payments/presentations`: publica temporalmente el QR en otro celular.
- `GET /v1/payments/presentations/active`: consulta cobros vigentes del negocio.
- `POST /v1/payments/presentations/:id/seen`: confirma que el celular abrió el cobro.
- `DELETE /v1/payments/presentations/:id`: retira la presentación remota.

## Comprobaciones sin dinero real

```powershell
pnpm test:payments
pnpm test:payment-ui
pnpm test:displays
pnpm run build:cloud-app
```

Las pruebas unitarias no llaman a Mercado Pago. Verifican cifrado, PKCE, firma y antigüedad de webhooks, payloads vigentes de QR/Point, dirección de sucursal, idempotencia, traducción de estados, envío al celular y conciliación con tickets.

## Referencias oficiales

- [OAuth con PKCE](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation)
- [Crear sucursal y caja](https://www.mercadopago.com.ar/developers/es/docs/qr-code/create-store-and-pos)
- [Crear order QR](https://www.mercadopago.com.ar/developers/es/reference/in-person-payments/qr-code/orders/create-order/post)
- [Crear order Point](https://www.mercadopago.com.ar/developers/es/reference/in-person-payments/point/orders/create-order/post)
- [Configurar terminal Point](https://www.mercadopago.com.ar/developers/es/docs/mp-point/configure-terminal)
- [Webhooks de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/notifications)
