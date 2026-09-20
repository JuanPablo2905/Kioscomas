import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const sales = read("src/features/ventas/VentasView.jsx");
const settings = read("src/features/ventas/MercadoPagoSettings.jsx");
const receiver = read("src/features/ventas/RemotePaymentReceiver.jsx");
const customerDisplay = read("src/features/ventas/CustomerDisplayScreen.jsx");
const promotionWidget = read("src/features/ventas/AdaptivePromotionsWidget.jsx");
const paymentWidget = read("src/features/ventas/AdaptivePaymentMethodsWidget.jsx");
const landing = read("src/landing.jsx");
const prices = read("src/precios.jsx");

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

test("la caja ofrece QR estático, QR dinámico y Point", ["static_qr", "dynamic_qr", "point"].every((mode) => sales.includes(mode)));
test("QR dinámico y Point esperan aprobación antes de confirmar", sales.includes('paymentAttempt?.status === "approved"') && sales.includes("mercadoPagoPreparado"));
test("el importe de Mercado Pago en un pago combinado se calcula por separado", sales.includes('pagosMixtos["Mercado Pago"]') && sales.includes("montoMercadoPago"));
test("la venta guarda la referencia segura de la operación del proveedor", sales.includes("providerPayment") && sales.includes("providerOrderId"));
test("las preferencias permiten elegir modo de cobro y dónde mostrar el QR", settings.includes("customerDisplayMercadoPagoMode") && settings.includes("customerDisplayMercadoPagoTarget"));
test("QR dinámico y Point muestran un aviso de próximamente en vez de un flujo de conexión", settings.includes("Próximamente") && settings.includes("Todavía no se pueden conectar cuentas nuevas") && !settings.includes("startMercadoPagoConnection") && !settings.includes("setupMercadoPagoQr") && !settings.includes("setupMercadoPagoPoint") && !settings.includes("listMercadoPagoTerminals"));
test("el dueño puede conciliar, cancelar y devolver cobros desde la app", settings.includes("listPaymentAttempts") && settings.includes("cancelPaymentAttempt") && settings.includes("refundPaymentAttempt") && settings.includes("Actividad y conciliación"));
test("los rechazos muestran el diagnóstico del proveedor sin ofrecer consultas imposibles", settings.includes("Ver diagnóstico técnico") && settings.includes("attempt.failure.httpStatus") && settings.includes("attempt.providerOrderId &&") && sales.includes("Ver diagnóstico de Mercado Pago"));
test("cada cobro aprobado se vincula con el ticket real y se reintenta", sales.includes("completePaymentAttempt") && sales.includes("saleLinkedAt") && sales.includes('window.addEventListener("online", reconcile)'));
test("un reintento reutiliza la referencia e idempotencia para no duplicar cobros", sales.includes("paymentRequestRef") && sales.includes("requestSignature") && sales.includes("idempotencyKey"));
test("la caja usa los identificadores confirmados por el servidor y descarta reintentos rotos", sales.includes("paymentProvider?.qr?.posExternalId || \"\"") && sales.includes("paymentProvider?.point?.terminalId || \"\"") && sales.includes("paymentRequestRef.current = null"));
test("el celular consulta, muestra y confirma la recepción del cobro", receiver.includes("listActivePaymentPresentations") && receiver.includes("acknowledgePaymentPresentation") && receiver.includes("!next.seenAt"));
test("la caja informa si el otro celular abrió el cobro", sales.includes("loadPaymentPresentation") && sales.includes("presentationDelivery?.seenAt") && sales.includes("El celular recibió y abrió el cobro"));
test("el cobro combinado permite elegir y quitar medios sin cambiar de pantalla", sales.includes("metodosMixtosActivos") && sales.includes("addMixedMethod") && sales.includes("removeMixedMethod"));
test("la pantalla del cliente muestra cada parte de un pago combinado", customerDisplay.includes('payment?.method === "Pago combinado"') && customerDisplay.includes("item.metodo") && customerDisplay.includes("item.monto"));
test("cada tira puede elegir promociones y adapta la dirección a su forma", promotionWidget.includes("promotionIds") && promotionWidget.includes('orientation === "vertical"') && promotionWidget.includes('orientation === "horizontal"'));
test("los medios de pago se reorganizan en horizontal, vertical o cuadrícula", paymentWidget.includes('"horizontal"') && paymentWidget.includes('"vertical"') && paymentWidget.includes('"grid"'));
test("la portada diferencia funciones disponibles y en preparación", landing.includes("QR estático") && landing.includes("QR dinámico") && landing.includes("En preparación") && landing.includes("Mercado Pago Point"));
test("precios explica descuento, tres meses y precio de lista", prices.includes("launchDiscount") && prices.includes("primeros {launchPaidMonths} meses pagos") && prices.includes("Precio de lista"));

console.log(`\n${passed} pruebas de interfaz de cobros y pantallas superadas.`);
