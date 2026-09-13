# Backend de cobros con Mercado Pago

## Estado actual

La infraestructura del servidor y la interfaz están implementadas, pero la conexión real queda apagada por defecto. El QR estático funciona sin credenciales; los botones de QR dinámico y Point explican que falta habilitar el backend y no pueden iniciar cobros reales mientras la bandera permanezca apagada.

El diseño separa cada conexión por negocio: el dueño autoriza su propia cuenta de Mercado Pago mediante OAuth y Kiosco+ conserva los tokens cifrados en el servidor. Nunca se guardan tokens en el navegador, en la app instalada ni en GitHub.

## Funciones preparadas

- conexión OAuth con `state` de un solo uso y PKCE;
- cifrado AES-256-GCM de access token y refresh token;
- creación idempotente de QR dinámico;
- creación idempotente de órdenes para terminales Mercado Pago Point;
- consulta del estado de una orden;
- cancelación y devolución completa;
- webhook firmado para actualizar cobros aunque la caja se cierre;
- registro interno de intentos, estado, importe, ticket, equipo y usuario;
- notificación al negocio cuando el webhook confirma la acreditación;
- presentación temporal del importe y el QR en otro celular del mismo negocio;
- detalle de cada importe cuando la venta usa pago combinado;
- permisos: sólo dueño/administrador conecta la cuenta y sólo usuarios con acceso a Ventas pueden cobrar.

No se implementaron integraciones con terminales de otras empresas: cada marca exige contrato, credenciales, equipos y API propios. El modelo interno de `paymentAttempts` permite sumar otros proveedores sin mezclar sus credenciales con Mercado Pago.

## Activación futura en Render

No activar hasta contar con una aplicación creada en Mercado Pago y haber probado primero sus credenciales de prueba.

1. Completar en Render:
   - `KIOSCO_MERCADOPAGO_CLIENT_ID`
   - `KIOSCO_MERCADOPAGO_CLIENT_SECRET`
   - `KIOSCO_MERCADOPAGO_TOKEN_ENCRYPTION_KEY` (secreto aleatorio de al menos 32 caracteres)
   - `KIOSCO_MERCADOPAGO_WEBHOOK_SECRET`
2. Confirmar que el callback registrado en Mercado Pago sea exactamente:
   `https://kiosco-plus-api.onrender.com/v1/payments/mercado-pago/oauth/callback`
3. Registrar el webhook:
   `https://kiosco-plus-api.onrender.com/v1/payments/mercado-pago/webhook`
4. Recién después cambiar `KIOSCO_MERCADOPAGO_BACKEND_ENABLED` a `1`.
5. Verificar `/v1/health`: `paymentProviders.mercadoPago.ready` debe ser `true`.

La interfaz no habilita el proveedor por sí sola: siempre consulta la disponibilidad real del servidor. Mientras `KIOSCO_MERCADOPAGO_BACKEND_ENABLED` esté apagada, solamente se puede usar el QR estático cargado por el negocio.

## Contrato HTTP preparado para la interfaz

Todas las rutas autenticadas requieren los encabezados habituales `Authorization`, `x-tenant-id` y `x-device-id`.

- `GET /v1/payments/providers`: disponibilidad y conexión del negocio.
- `POST /v1/payments/mercado-pago/oauth/start`: genera la URL de autorización.
- `DELETE /v1/payments/mercado-pago/connection`: elimina las credenciales locales.
- `POST /v1/payments/attempts`: crea una orden `qr` o `point`. Requiere `x-idempotency-key` estable.
- `GET /v1/payments/attempts`: lista los últimos intentos del negocio.
- `GET /v1/payments/attempts/:id`: consulta el registro local.
- `POST /v1/payments/attempts/:id/refresh`: confirma el estado con Mercado Pago.
- `POST /v1/payments/attempts/:id/cancel`: cancela la orden.
- `POST /v1/payments/attempts/:id/refund`: devuelve un cobro acreditado.
- `POST /v1/payments/presentations`: publica temporalmente un QR para la app abierta en otro dispositivo.
- `GET /v1/payments/presentations/active`: consulta presentaciones vigentes del mismo negocio.
- `DELETE /v1/payments/presentations/:id`: retira la presentación de los demás dispositivos.

Para QR se enviarán `amount`, `ticketId` o `externalReference` y `externalPosId`. Para Point se enviarán `amount`, `ticketId` o `externalReference` y `terminalId`.

## Pruebas sin dinero real

Ejecutar:

```powershell
pnpm test:payments
pnpm test:payment-ui
```

Las pruebas verifican cifrado, PKCE, payloads de QR/Point, idempotencia, traducción de estados y rechazo de webhooks falsos o vencidos. No llaman a Mercado Pago.

Documentación oficial de referencia:

- [Procesamiento de pagos QR](https://www.mercadopago.com.ar/developers/es/docs/qr-code/payment-processing)
- [Crear una orden Point](https://www.mercadopago.com.ar/developers/es/reference/in-person-payments/point/orders/create-order/post)
- [OAuth y PKCE](https://www.mercadopago.com.ar/developers/es/docs/security/oauth/creation)
- [Webhooks de Orders](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/notifications)
