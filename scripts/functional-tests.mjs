import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
let passed = 0;
const test = (name, condition) => { if (!condition) throw new Error(`FALLÓ: ${name}`); passed += 1; console.log(`OK: ${name}`); };

try {
  const domain = await vite.ssrLoadModule("/src/shared/domain.js");
  const pricing = await vite.ssrLoadModule("/src/features/stock/pricing.js");
  const metrics = await vite.ssrLoadModule("/src/features/reportes/reportMetrics.js");
  const dataModule = await vite.ssrLoadModule("/src/app/data.js");
  const notificationsModule = await vite.ssrLoadModule("/src/features/notificaciones/notificationRules.js");
  const ranges = await vite.ssrLoadModule("/src/shared/dateRanges.js");
  const expenseRules = await vite.ssrLoadModule("/src/features/gastos/expenseRules.js");
  const salesRules = await vite.ssrLoadModule("/src/features/ventas/salesRules.js");
  const auth = await vite.ssrLoadModule("/src/security/auth.js");
  const inventory = await vite.ssrLoadModule("/src/features/stock/inventoryRules.js");
  const transfer = await vite.ssrLoadModule("/src/features/stock/productTransfer.js");
  const ean = await vite.ssrLoadModule("/src/shared/eanDecoder.js");
  const cloudProtocol = await vite.ssrLoadModule("/src/cloud/protocol.js");
  const updates = await vite.ssrLoadModule("/src/updates/updateService.js");
  const entitySync = await vite.ssrLoadModule("/src/cloud/entitySync.js");
  const conflictMerge = await vite.ssrLoadModule("/src/cloud/conflictMerge.js");
  const replenishment = await vite.ssrLoadModule("/src/features/compras/replenishmentRules.js");
  const ticketBarcode = await vite.ssrLoadModule("/src/shared/ticketBarcode.js");
  const invoices = await vite.ssrLoadModule("/src/features/gestion/invoiceRules.js");
  const autoContrast = await vite.ssrLoadModule("/src/shared/useAutoContrast.js");
  const audit = await vite.ssrLoadModule("/src/shared/audit.js");
  const productLookup = await vite.ssrLoadModule("/src/shared/productLookup.js");
  const archive = await vite.ssrLoadModule("/src/shared/archive.js");
  const share = await vite.ssrLoadModule("/src/shared/share.js");
  const dataStorageLock = await vite.ssrLoadModule("/src/cloud/dataStorageLock.js");

  test("redondeo de gramos", domain.roundQuantity(4.1000000000000005) === 4.1);
  test("precio sugerido por margen", pricing.calcularPrecioSugerido(1000, 1, 50) === 1500);
  const encodedTicket = ticketBarcode.ticketBarcodeValue(123);
  test("código de ticket es identificable", encodedTicket === "KAT-123" && ticketBarcode.parseTicketBarcode(encodedTicket) === "123");
  test("código de ticket genera barras reales", ticketBarcode.code39Bars(encodedTicket).some((bar) => bar.black) && ticketBarcode.code39Bars(encodedTicket).some((bar) => !bar.black));
  test("validador de CUIT para comprobantes", invoices.isValidCuit("20-12345678-6") && !invoices.isValidCuit("20-12345678-1"));
  test("tipos de comprobante dependen de condición fiscal", invoices.allowedDocumentTypes("Monotributista").join("") === "C" && invoices.allowedDocumentTypes("Responsable inscripto").join("") === "AB");
  test("numeración de comprobantes es correlativa por letra", invoices.nextDocumentSequence([{ tipo: "B", puntoVenta: "0001", secuencia: 2 }, { tipo: "A", puntoVenta: "0001", secuencia: 8 }], "1", "B") === 3);
  const invoiceTicket = { id: 44, total: 1210, subtotal: 1300, descuento: 90, medio: "Efectivo", items: [{ productId: 1, nombre: "Producto", cantidad: 2, precioUnitario: 650, subtotal: 1210 }] };
  const invoiceDocument = invoices.buildCommercialDocument({ config: { razonSocial: "Prueba", cuit: "20-12345678-6", domicilio: "Calle 1", condicionFiscal: "Responsable inscripto", puntoVenta: "1", alicuotaIva: 21 }, draft: { tipo: "A", receptor: "Cliente", receptorCuit: "20-12345678-6", condicionReceptor: "Responsable inscripto", domicilio: "", email: "" }, ticket: invoiceTicket, existing: [], identity: { nombre: "Juan" } });
  test("comprobante congela importes y desglosa IVA", invoiceDocument.numero === "0001-00000001" && invoiceDocument.netoGravado === 1000 && invoiceDocument.iva === 210 && invoiceDocument.items[0].precioUnitario === 605);
  test("comprobante interno queda marcado sin CAE", invoiceDocument.sinCae && invoiceDocument.clase === "comprobante-comercial-no-fiscal" && invoiceDocument.estado === "emitido-no-fiscal");
  const darkSurface = autoContrast.parseCssColor("#111827");
  const lightSurface = autoContrast.parseCssColor("#ffffff");
  test("contraste automático elige texto según el fondo", autoContrast.bestContrastColor(darkSurface) === "#ffffff" && autoContrast.bestContrastColor(lightSurface) === "#0f172a");
  test("contraste automático cumple nivel legible", autoContrast.contrastRatio(autoContrast.parseCssColor(autoContrast.bestContrastColor(darkSurface)), darkSurface) >= 4.5 && autoContrast.contrastRatio(autoContrast.parseCssColor(autoContrast.bestContrastColor(lightSurface)), lightSurface) >= 4.5);
  const adminIdentity = { nombre: "Juan", usuarioId: "cuenta:1", rol: "Dueño", adminApp: true, operandoNegocio: true };
  const adminActor = audit.auditActor(adminIdentity);
  test("auditoría reconoce al administrador de la app", adminActor.usuario === "Juan" && adminActor.rol === "Administrador de la app" && adminActor.origen === "administracion_app");
  const oldProduct = { id: 8, nombre: "Alfajor", costo: 520, venta: 1100, deposito: 36, historial: [] };
  const historyEntry = { id: 99, tipo: "edicion", detalle: "Precio editado", fecha: "28/7/2026" };
  const enrichedProducts = audit.enrichEntityHistory("products", [oldProduct], [{ ...oldProduct, costo: 1000, historial: [historyEntry] }], adminActor);
  test("historial de producto conserva autor y rol", enrichedProducts[0].historial[0].usuario === "Juan" && enrichedProducts[0].historial[0].rol === "Administrador de la app");
  const auditEvent = audit.createAuditEvent({ key: "products", previousValue: [oldProduct], nextValue: enrichedProducts, identity: adminIdentity, tenantId: 2, view: "stock", deviceId: "equipo-prueba" });
  test("evento central describe el cambio y su origen", auditEvent.detalle.includes("Precio de costo: 520 → 1000") && auditEvent.seccion === "stock" && auditEvent.dispositivoId === "equipo-prueba");

  const tickets = [
    { id: 1, fecha: "2026-07-18T23:00:00Z", medio: "Efectivo", clienteId: null, total: 200, items: [{ productId: 7, cantidad: 2, precioUnitario: 100, subtotal: 200, costoTotal: 120 }] },
    { id: 2, fecha: "2026-07-18T23:00:00Z", medio: "Efectivo", clienteId: null, total: 200, items: [{ productId: 7, cantidad: 2, precioUnitario: 100, subtotal: 200, costoTotal: 120 }] },
    { id: 3, fecha: "2026-07-20T09:00:01Z", medio: "Efectivo", clienteId: null, total: 200, items: [{ productId: 7, cantidad: 2, precioUnitario: 100, subtotal: 200, costoTotal: 120 }] },
  ];
  const duplicates = metrics.detectarTicketsDuplicados(tickets);
  test("duplicado rojo dentro de 24 horas", duplicates.get(1)?.nivel === "rojo" && duplicates.get(2)?.nivel === "rojo");
  const reviewedTickets = tickets.map((ticket) => ticket.id === 1 ? { ...ticket, revisionDuplicado: { estado: "ventas_validas", parejaId: 2 } } : ticket);
  test("un par confirmado como válido deja de alertar", metrics.detectarTicketsDuplicados(reviewedTickets).size === 0);
  test("un ticket anulado deja de alertar como duplicado", metrics.detectarTicketsDuplicados([{ ...tickets[0], estado: "anulado" }, tickets[1]]).size === 0);
  test("ticket fuera de 24 horas", !duplicates.has(3));
  const similarOtherTime = metrics.detectarTicketsDuplicados([tickets[0], { ...tickets[0], id: 4, fecha: "2026-07-18T23:01:00Z" }]);
  test("misma venta en otro horario no alerta", similarOtherTime.size === 0);
  const mixedBase = { ...tickets[0], id: 20, medio: "Pago combinado", pagos: [{ metodo: "Efectivo", monto: 100 }, { metodo: "Tarjeta", monto: 100 }] };
  const mixedDifferent = { ...mixedBase, id: 21, pagos: [{ metodo: "Efectivo", monto: 50 }, { metodo: "Tarjeta", monto: 150 }] };
  test("pagos combinados diferentes no son duplicados", metrics.detectarTicketsDuplicados([mixedBase, mixedDifferent]).size === 0);

  const profit = metrics.calcularRentabilidadHistorica([tickets[0]]);
  test("ganancia histórica congelada", profit.gananciaHistorica === 80);

  const migratedAccounts = dataModule.migrarCuentasDemo([{ id: 99, nombre: "Real", usuario: "real", estado: "pendiente", roles: dataModule.rolesPorDefecto() }]);
  test("migración conserva cuentas reales", migratedAccounts.some((account) => account.id === 99 && account.estado === "pendiente"));
  const storedAdmin = { id: 1, nombre: "Juan", usuario: "demo", passwordHash: "hash-existente", passwordSalt: "sal-existente", superAdmin: true, roles: [], empleados: [] };
  const migratedStoredAdmin = dataModule.migrarCuentasDemo([storedAdmin]).find((account) => account.id === 1);
  test("abrir la app conserva la credencial cifrada del administrador", migratedStoredAdmin?.passwordHash === "hash-existente" && migratedStoredAdmin?.passwordSalt === "sal-existente" && !migratedStoredAdmin?.password);
  const migratedSprite = dataModule.migrarDatosDemo({
    2: {
      products: [{ id: 212, nombre: "Sprite 2,25 l", codigo: "7790895008478" }],
    },
  });
  test("migración corrige el código real de Sprite", migratedSprite[2].products.find((product) => String(product.id) === "212")?.codigo === "7790895001000");
  const knownRexona = await productLookup.lookupBarcode("7891150089983");
  test("catálogo verificado reconoce Rexona Clinical", knownRexona?.categoria === "Higiene" && knownRexona?.nombre.includes("Rexona"));
  const knownFernet = await productLookup.lookupBarcode("7790290101794");
  test("catálogo argentino reconoce Fernet Branca aniversario", knownFernet?.categoria === "Bebidas" && knownFernet?.nombre.includes("180"));

  const today = new Date().toISOString().slice(0, 10);
  const notifications = notificationsModule.buildNotifications({ products: [{ id: 1, nombre: "Prueba", deposito: 0, minimo: 1, vitrina: 0, alertaVitrina: 1, vencimiento: today }], tickets: [], sugerencias: [{ estado: "pendiente" }], caja: { historial: [] } });
  test("notificaciones combinan alertas", notifications.some((n) => n.type === "stock") && notifications.some((n) => n.type === "vencimiento") && notifications.some((n) => n.type === "sugerencias"));

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
  test("comparación contra período anterior", ranges.isWithinPreviousRange(yesterday.toISOString(), "Hoy") && !ranges.isWithinRange(yesterday.toISOString(), "Hoy"));

  const expense = { id: 1, descripcion: "Luz", monto: 300, medio: "Efectivo" };
  const paidExpense = expenseRules.applyExpensePayment({ saldo: 1000, movimientos: [] }, expense);
  test("gasto no modifica la caja", paidExpense.ok && paidExpense.caja.saldo === 1000 && paidExpense.caja.movimientos.length === 0);
  test("gasto se registra aunque la caja no tenga saldo", expenseRules.applyExpensePayment({ saldo: 100, movimientos: [] }, expense).ok);

  test("descuento porcentual", salesRules.calcularDescuento(1000, "porcentaje", 15) === 150);
  test("descuento nunca supera el total", salesRules.calcularDescuento(1000, "fijo", 1500) === 1000);
  const promoCart = [{ cantidad: 3, product: { id: 10, venta: 100 } }];
  test("promoción 3x2 calcula una unidad gratis", salesRules.calcularPromocion(promoCart, { activa: true, tipo: "nxm", lleva: 3, paga: 2, productIds: [10] }) === 100);
  test("elige la promoción automática más conveniente", salesRules.calcularMejorPromocion(promoCart, [{ id: 1, activa: true, tipo: "porcentaje", valor: 10 }, { id: 2, activa: true, tipo: "nxm", lleva: 3, paga: 2, productIds: [10] }]).promocion.id === 2);
  const replenishmentResult = replenishment.buildReplenishmentSuggestions([{ id: 10, nombre: "Bebida", unidad: "unidad", deposito: 1, vitrina: 1, minimo: 3 }], [{ fecha: new Date().toISOString(), items: [{ productId: 10, cantidad: 30 }] }]);
  test("reposición inteligente considera ventas recientes", replenishmentResult.length === 1 && replenishmentResult[0].recomendada >= 8);
  const restored = salesRules.restaurarStock([{ id: 7, vitrina: 1, unidad: "peso" }], { items: [{ productId: 7, cantidad: 250, unidad: "peso" }] });
  test("anulación devuelve gramos a vitrina", restored[0].vitrina === 1.25);
  const annulled = salesRules.anularTicket(tickets[0], "Error", "Juan", "2026-07-19T10:00:00Z");
  test("ticket anulado conserva venta y auditoría", annulled.estado === "anulado" && annulled.items.length === 1 && annulled.anulacion.motivo === "Error");
  const secured = await auth.secureSubject({ usuario: "demo", password: "1234" });
  test("contraseña se guarda protegida", !secured.password && !!secured.passwordHash && await auth.verifyPassword("1234", secured));
  const locked = [1,2,3,4,5].reduce((state) => auth.registerLoginFailure(state, "demo", 1000), {});
  test("bloqueo tras cinco intentos", auth.loginGuard(locked, "demo", 1001).blocked);
  const session = auth.createSession(2, { nombre: "Juan" }, 1000);
  test("sesión tiene vencimiento", auth.validSession(session, 1001) && !auth.validSession(session, new Date(session.expiresAt).getTime() + 1));
  const difference = inventory.inventoryDifference({ deposito: 5, vitrina: 2, costo: 100 }, 6);
  test("conteo calcula faltante y costo", difference.diferencia === -1 && difference.costoDiferencia === -100);
  const adjusted = inventory.applyInventory([{ id: 1, deposito: 5, vitrina: 2 }], [{ productId: 1, contado: 4 }]);
  test("conteo aprobado ajusta stock total", adjusted[0].deposito === 2 && adjusted[0].vitrina === 2);
  const importedProducts = transfer.parseProductFile("Nombre,Código,Categoría,Unidad,Costo,Venta,Depósito,Vitrina,Stock mínimo,Alerta vitrina,Vencimiento\nYerba,7791,Almacén,unidad,100,180,4,2,1,1,2026-12-01", "productos.csv");
  test("importación CSV reconoce productos", importedProducts.length === 1 && importedProducts[0].codigo === "7791" && importedProducts[0].deposito === 4);
  const mergedProducts = transfer.mergeImportedProducts([{ id: 1, nombre: "Yerba", codigo: "7791", venta: 150 }], importedProducts, "actualizar");
  test("importación actualiza por código", mergedProducts.updated === 1 && mergedProducts.products[0].venta === 180);
  test("exportación Excel genera libro compatible", transfer.productsToExcelXml(importedProducts).includes("<Workbook") && transfer.productsToExcelXml(importedProducts).includes("Yerba"));
  test("validador de código EAN-13", ean.validEanCheckDigit("4006381333931") && !ean.validEanCheckDigit("4006381333932"));

  const sampleEanBits = ["101","0001101","0100111","0101111","0111101","0001001","0110011","01010","1000010","1000010","1000010","1110100","1000010","1100110","101"].join("");
  const sampleLine = [255,255,255,255,255, ...[...sampleEanBits].flatMap((bit) => Array(4).fill(bit === "1" ? 0 : 255)), 255,255,255,255,255];
  test("lector visual decodifica EAN-13", ean.decodeEanLine(sampleLine) === "4006381333931");
  test("lector visual acepta código invertido", ean.decodeEanLine([...sampleLine].reverse()) === "4006381333931");
  const cloudOperation = cloudProtocol.normalizeOperation({ id:"op-1", deviceId:"pc-1", tenantId:2, type:"set", key:"datos", value:{products:[]} });
  test("nube exige negocio y operación válida", cloudOperation?.tenantId === "2" && cloudProtocol.normalizeOperation({id:"x",deviceId:"pc",type:"set",key:"datos"}) === null);
  const isolated = cloudProtocol.mergeTenantDataset({1:{products:[1]}},2,{products:[2]});
  test("sincronización conserva separación por negocio", isolated[1].products[0] === 1 && isolated[2].products[0] === 2);
  test("comparación de versiones para actualizaciones", updates.isNewerVersion("0.2.0","0.1.9") && !updates.isNewerVersion("0.1.0","0.1.0"));
  const entityOps=entitySync.diffTenantEntities({products:[{id:1,nombre:"A",_syncVersion:2}],proveedores:[{id:5,nombre:"P"}]},{products:[{id:1,nombre:"B",_syncVersion:2},{id:2,nombre:"C"}],proveedores:[]},"negocio-1","pc-1",()=>"2026-01-01");
  test("sincronización incremental detecta altas, cambios y bajas", entityOps.filter((x)=>x.type==="entity_upsert").length===2 && entityOps.filter((x)=>x.type==="entity_delete").length===1);
  test("cambio incremental conserva base para resolver conflictos", entityOps.find((x)=>x.entity==="products"&&x.entityId==="1")?.baseVersion===2 && entityOps.find((x)=>x.entity==="products"&&x.entityId==="1")?.baseValue?.nombre==="A");
  const remoteApplied=entitySync.applyEntityOperations({products:[{id:1,nombre:"A"}]},[{type:"entity_upsert",entity:"products",entityId:"1",value:{id:1,nombre:"B"},version:3}]);
  test("cambio remoto conserva versión del registro", remoteApplied.products[0].nombre==="B" && remoteApplied.products[0]._syncVersion===3);
  const burstDataset = { products: [{ id: 1, nombre: "Alfajor", deposito: 25, _syncVersion: 4 }] };
  const burstQueue = [{ id: "venta-nueva", tenantId: "2", entity: "products", entityId: "1", baseVersion: 3, baseValue: { id: 1, deposito: 30 }, value: { id: 1, deposito: 25 } }];
  const burstAck = [{ operationId: "venta-anterior", entity: "products", entityId: "1", version: 4, value: { id: 1, nombre: "Alfajor", deposito: 29 } }];
  const burstSent = [{ id: "venta-anterior", tenantId: "2", type: "entity_upsert", entity: "products", entityId: "1", value: { id: 1, nombre: "Alfajor", deposito: 29 } }];
  const burstConfirmed = entitySync.applyAcceptedEntityVersions(burstDataset, burstQueue, burstAck, ["venta-anterior"], "2", burstSent);
  test("una confirmación atrasada no pisa una venta más nueva", burstConfirmed.products[0].deposito === 25 && burstConfirmed.products[0]._syncVersion === 4);
  const queueRaceConfirmed = entitySync.applyAcceptedEntityVersions(burstDataset, [], burstAck, ["venta-anterior"], "2", burstSent);
  test("una venta nueva se conserva aunque todavía no aparezca en la cola", queueRaceConfirmed.products[0].deposito === 25);
  const rebasedBurst = entitySync.rebasePendingEntityOperations(burstQueue, burstAck);
  test("la ráfaga pendiente se rebasa sobre la última versión confirmada", rebasedBurst[0].baseVersion === 4 && rebasedBurst[0].baseValue.deposito === 29);
  const serializedOrder = [];
  await Promise.all([
    dataStorageLock.withDataStorageLock(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); serializedOrder.push("venta-1"); }),
    dataStorageLock.withDataStorageLock(async () => { serializedOrder.push("venta-2"); }),
    dataStorageLock.withDataStorageLock(async () => { serializedOrder.push("venta-3"); }),
  ]);
  test("los guardados de una ráfaga mantienen el orden", serializedOrder.join(",") === "venta-1,venta-2,venta-3");
  const mergedStressSale = conflictMerge.mergeConcurrentEntity({
    type: "entity_upsert",
    entity: "products",
    baseValue: { id: 1, vitrina: 10, historial: [{ id: "base" }, { id: "confirmada" }] },
    value: { id: 1, vitrina: 5, historial: [{ id: "base" }, { id: "local" }] },
  }, { id: 1, vitrina: 7, historial: [{ id: "base" }, { id: "confirmada" }, { id: "remota" }] });
  test("cinco ventas rápidas se acumulan sobre el stock remoto", mergedStressSale.value?.vitrina === 2);
  test("el historial desfasado se une sin crear un conflicto falso", mergedStressSale.value?.historial?.map((item) => item.id).join(",") === "base,confirmada,remota,local");
  const realEditConflict = conflictMerge.mergeConcurrentEntity({
    type: "entity_upsert",
    entity: "products",
    baseValue: { id: 1, venta: 1000 },
    value: { id: 1, venta: 1200 },
  }, { id: 1, venta: 1300 });
  test("dos ediciones reales del mismo precio siguen pidiendo revisión", !realEditConflict.value && realEditConflict.conflictingFields?.includes("venta"));
  const cleanup = archive.cleanOperationalDataset({
    tickets: [{ id: 1, fecha: "2020-01-01" }],
    comprobantes: [{ id: 2, fecha: "2020-01-01" }],
    auditoria: [{ id: 3, fecha: "2020-01-01" }],
    comprasItems: [{ id: 4, estado: "recibido", recibidoFecha: "2020-01-01" }],
  }, 12);
  test("limpieza operativa protege ventas, comprobantes y auditoría", cleanup.total === 1 && cleanup.dataset.tickets.length === 1 && cleanup.dataset.comprobantes.length === 1 && cleanup.dataset.auditoria.length === 1);
  test("WhatsApp normaliza números argentinos", share.normalizeWhatsAppPhone("011 15-5555-1234") === "541155551234");
  test("mensaje de pedido incluye negocio, proveedor y cantidades", share.purchaseMessage({ businessName: "Kiosco+", providerName: "Distribuidora", items: [{ nombre: "Yerba", cantidad: 3 }] }).includes("3 x Yerba"));

  console.log(`\n${passed} pruebas funcionales superadas.`);
} finally {
  await vite.close();
}
