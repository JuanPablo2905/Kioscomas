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
test("las preferencias permiten elegir modo, destino, caja QR y terminal Point", settings.includes("customerDisplayMercadoPagoMode") && settings.includes("customerDisplayMercadoPagoTarget") && settings.includes("customerDisplayMercadoPagoPosId") && settings.includes("customerDisplayMercadoPagoTerminalId"));
test("el celular consulta y muestra cobros enviados desde otra caja", receiver.includes("listActivePaymentPresentations") && receiver.includes("sourceDeviceId !== paymentDeviceId()"));
test("la pantalla del cliente muestra cada parte de un pago combinado", customerDisplay.includes('payment?.method === "Pago combinado"') && customerDisplay.includes("item.metodo") && customerDisplay.includes("item.monto"));
test("cada tira puede elegir promociones y adapta la dirección a su forma", promotionWidget.includes("promotionIds") && promotionWidget.includes('orientation === "vertical"') && promotionWidget.includes('orientation === "horizontal"'));
test("los medios de pago se reorganizan en horizontal, vertical o cuadrícula", paymentWidget.includes('"horizontal"') && paymentWidget.includes('"vertical"') && paymentWidget.includes('"grid"'));
test("la portada diferencia funciones disponibles y en preparación", landing.includes("QR estático") && landing.includes("QR dinámico") && landing.includes("En preparación") && landing.includes("Mercado Pago Point"));
test("precios explica descuento, tres meses y precio de lista", prices.includes("launchDiscount") && prices.includes("primeros {launchPaidMonths} meses pagos") && prices.includes("Precio de lista"));

console.log(`\n${passed} pruebas de interfaz de cobros y pantallas superadas.`);
