import { INITIAL_PRODUCTS } from "../shared/domain";

export const defaultDataset = (seed) => ({
  products: seed ? INITIAL_PRODUCTS : [],
  caja: { saldo: 0, movimientos: [], historial: [] },
  tickets: [],
  clientes: [],
  comprasItems: [],
  proveedores: [],
  perdidas: [],
  sugerencias: [],
  pedidos: [],
  gastos: [],
  ventasSuspendidas: [],
  auditoria: [],
  inventarios: [],
  cajaAbierta: false,
  cart: [],
  tareas: [],
  metas: [],
  promociones: [],
  reservas: [],
  presupuestos: [],
  arqueos: [],
  configuracionFiscal: {},
  comprobantes: [],
  listaCompras: [],
  retornables: [],
  cambioCaja: {},
  autoconsumos: [],
  turnos: [],
  recordatoriosProveedor: [],
  movimientosStock: [],
  historialLimpiezas: [],
  labelTemplates: [],
});

const CATEGORIA_TECNICA = [
  "edicion",
  "correccion",
  "eliminacion_movimiento",
  "eliminacion_ticket",
  "auditoria_tecnica",
  "eliminacion",
];
export const categoriaEvento = (tipo) => (CATEGORIA_TECNICA.includes(tipo) ? "Técnico" : "Operativo");

export const PERMISOS_MENU = ["notificaciones", "stock", "vitrina", "ventas", "compras", "proveedores", "vencimientos", "gastos", "clientes", "reportes", "gestion"];
export const PERMISOS_ACCION = [
  { id: "administracion", label: "Ver administración operativa" },
  { id: "editar_precios", label: "Editar precios y costos" },
  { id: "eliminar_productos", label: "Eliminar productos" },
  { id: "eliminar_tickets", label: "Eliminar tickets" },
  { id: "aplicar_descuentos", label: "Aplicar descuentos en ventas" },
  { id: "corregir_caja", label: "Corregir movimientos de caja" },
  { id: "gestionar_personal", label: "Gestionar empleados, roles y permisos" },
];
const PERMISOS_DUENO = [...PERMISOS_MENU, "administracion"];

export const permisosDe = (identidad, cuenta) => {
  if (!identidad) return [];
  if (identidad.adminApp && identidad.operandoNegocio) return PERMISOS_DUENO;
  if (identidad.rol === "Dueño") return PERMISOS_DUENO;
  const rolDef = (cuenta?.roles || []).find((r) => r.nombre === identidad.rol);
  return rolDef?.permisos || [];
};

export const rolesPorDefecto = () => [
  { nombre: "Administrador", permisos: ["notificaciones", "stock", "vitrina", "ventas", "compras", "proveedores", "vencimientos", "gastos", "clientes", "reportes", "gestion", "administracion", "editar_precios", "corregir_caja", "aplicar_descuentos"] },
  { nombre: "Cajero", permisos: ["stock", "vitrina", "ventas"] },
];

export const seedCuentas = () => [
  {
    id: 1,
    nombre: "Juan",
    usuario: "demo",
    password: "1234",
    nombreNegocio: "Administración de Kiosco+",
    superAdmin: true,
    tipo: "administrador_app",
    estado: "aprobada",
    modoNegocio: "equipo",
    roles: [],
    empleados: [],
  },
  {
    id: 3,
    nombre: "Juan",
    usuario: "pruebas",
    password: "1234",
    nombreNegocio: "Mi Negocio de Pruebas",
    superAdmin: false,
    estado: "aprobada",
    modoNegocio: "equipo",
    roles: rolesPorDefecto(),
    empleados: [
      {
        id: 101,
        nombre: "Lucía Gómez",
        usuario: "lucia",
        password: "1234",
        rol: "Cajero",
      },
    ],
  },
  {
    id: 2,
    nombre: "María",
    usuario: "sur",
    password: "1234",
    nombreNegocio: "Kiosco Sur (demo)",
    superAdmin: false,
    estado: "aprobada",
    demoAccountVersion: 2,
    modoNegocio: "equipo",
    roles: rolesPorDefecto(),
    empleados: [
      { id: 201, nombre: "Sofía Ramírez", usuario: "sofia.sur", password: "1234", rol: "Cajero" },
      { id: 202, nombre: "Diego Luna", usuario: "diego.sur", password: "1234", rol: "Administrador" },
    ],
  },
];

export const migrarCuentasDemo = (cuentasGuardadas, { includeSeeds = true } = {}) => {
  const cuentas = Array.isArray(cuentasGuardadas) ? cuentasGuardadas : [];
  const seeds = seedCuentas();
  const admin = seeds.find((cuenta) => cuenta.id === 1);
  const sur = seeds.find((cuenta) => cuenta.id === 2);
  const pruebas = seeds.find((cuenta) => cuenta.id === 3);
  const anteriores = cuentas.filter((cuenta) => ![1, 2, 3].includes(cuenta.id));
  const adminGuardada = cuentas.find((cuenta) => cuenta.id === 1);
  const surGuardada = cuentas.find((cuenta) => cuenta.id === 2);
  const pruebasGuardada = cuentas.find((cuenta) => cuenta.id === 3);
  const normalizar = (cuenta) => ({
    ...cuenta,
    estado: cuenta.estado || "aprobada",
    modoNegocio: cuenta.modoNegocio || ((cuenta.empleados || []).length > 0 ? "equipo" : "solo"),
    roles: (Array.isArray(cuenta.roles) && cuenta.roles.length ? cuenta.roles : rolesPorDefecto()).map((rol) =>
      rol.nombre === "Administrador"
        ? { ...rol, permisos: [...new Set([...(rol.permisos || []), "notificaciones", "gastos", "administracion", "editar_precios", "corregir_caja", "aplicar_descuentos"])] }
        : rol
    ),
  });
  if (!includeSeeds) {
    return cuentas
      .filter((cuenta) => !(
        (String(cuenta.id) === "2" && String(cuenta.usuario || "").toLowerCase() === "sur" && /demo/i.test(String(cuenta.nombreNegocio || "")))
        || (String(cuenta.id) === "3" && String(cuenta.usuario || "").toLowerCase() === "pruebas" && /negocio de pruebas/i.test(String(cuenta.nombreNegocio || "")))
      ))
      .map(normalizar);
  }
  const adminNormalizada = { ...admin, ...adminGuardada, superAdmin: true, tipo: "administrador_app" };
  if (adminNormalizada.passwordHash) delete adminNormalizada.password;
  return [
    // La cuenta administradora también debe conservarse. Reemplazarla por la
    // semilla en cada arranque volvía a introducir la contraseña en texto
    // plano; secureAccounts la cifraba con una sal nueva y la nube interpretaba
    // ese hash aleatorio como una edición real en cada apertura.
    normalizar(adminNormalizada),
    normalizar({ ...sur, ...surGuardada, ...((surGuardada?.demoAccountVersion || 0) < sur.demoAccountVersion ? sur : {}), superAdmin: false }),
    normalizar({ ...pruebas, ...pruebasGuardada, superAdmin: false }),
    ...anteriores.map(normalizar),
  ];
};

const migrarCodigosConocidos = (products = []) => products.map((product) =>
  String(product.id) === "212" && String(product.codigo) === "7790895008478"
    ? { ...product, nombre: "Sprite Lima-Limón Original 2,25 l", codigo: "7790895001000", familia: "Sprite", variante: "Original 2,25 L" }
    : product
);

export const migrarDatosDemo = (datosGuardados, { includeSeeds = true } = {}) => {
  const datos = datosGuardados && typeof datosGuardados === "object" ? { ...datosGuardados } : {};
  if (includeSeeds) {
    if (!datos[3] && datos[1]) datos[3] = datos[1];
    delete datos[1];
  }
  const combinados = includeSeeds ? { ...seedDatos(), ...datos } : datos;
  return Object.fromEntries(Object.entries(combinados).map(([id, dataset]) => {
    const savedProducts = migrarCodigosConocidos(dataset.products || []);
    const products = id === "2"
      ? [...savedProducts, ...productosSur.filter((seed) => !savedProducts.some((item) => item.id === seed.id || (seed.codigo && item.codigo === seed.codigo)))]
      : savedProducts;
    return [id, { ...defaultDataset(false), ...dataset, products, tenantId: String(dataset.tenantId || id), proveedores: dataset.proveedores || [], perdidas: dataset.perdidas || [], sugerencias: dataset.sugerencias || [], pedidos: dataset.pedidos || [], gastos: dataset.gastos || [], ventasSuspendidas: dataset.ventasSuspendidas || [], auditoria: dataset.auditoria || [], inventarios: dataset.inventarios || [], tareas: dataset.tareas || [], metas: dataset.metas || [], promociones: dataset.promociones || [], reservas: dataset.reservas || [], presupuestos: dataset.presupuestos || [], arqueos: dataset.arqueos || [], configuracionFiscal: dataset.configuracionFiscal || {}, labelTemplates: dataset.labelTemplates || [] }];
  }));
};

const productosSur = [
  { id: 201, nombre: "Coca-Cola 500 ml", codigo: "7790895001011", costo: 900, venta: 1600, deposito: 24, vitrina: 8, minimo: 8, alertaVitrina: 4, categoria: "Bebidas", unidad: "unidad" },
  { id: 202, nombre: "Agua mineral 500 ml", codigo: "7790315000440", costo: 430, venta: 900, deposito: 18, vitrina: 6, minimo: 6, alertaVitrina: 3, categoria: "Bebidas", unidad: "unidad" },
  { id: 203, nombre: "Alfajor triple", codigo: "7790040123456", costo: 520, venta: 1100, deposito: 35, vitrina: 12, minimo: 10, alertaVitrina: 5, categoria: "Golosinas", unidad: "unidad" },
  { id: 204, nombre: "Papas fritas 90 g", codigo: "7798123456789", costo: 850, venta: 1700, deposito: 15, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Golosinas", unidad: "unidad" },
  { id: 205, nombre: "Yerba mate 1 kg", codigo: "7790387012345", costo: 2800, venta: 4200, deposito: 9, vitrina: 3, minimo: 4, alertaVitrina: 2, categoria: "Almacén", unidad: "unidad" },
  { id: 206, nombre: "Caramelos surtidos", codigo: "", costo: 4800, venta: 9, deposito: 3.2, vitrina: 1.1, minimo: 1, alertaVitrina: 0.5, categoria: "Golosinas", unidad: "peso" },
  { id: 207, nombre: "Jugo suelto", codigo: "", costo: 1900, venta: 4, deposito: 6, vitrina: 2.5, minimo: 2, alertaVitrina: 1, categoria: "Bebidas", unidad: "volumen" },
  { id: 208, nombre: "Pasta dental", codigo: "7509546690285", costo: 1300, venta: 2400, deposito: 7, vitrina: 2, minimo: 3, alertaVitrina: 1, categoria: "Higiene", unidad: "unidad" },
  { id: 209, nombre: "Coca-Cola 1,25 l", codigo: "7790895004067", costo: 1550, venta: 2600, deposito: 18, vitrina: 6, minimo: 6, alertaVitrina: 3, categoria: "Bebidas", unidad: "unidad" },
  { id: 210, nombre: "Coca-Cola 2,25 l", codigo: "7790895006030", costo: 2350, venta: 3900, deposito: 14, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 211, nombre: "Coca-Cola Zero 1,5 l", codigo: "7790895067574", costo: 1900, venta: 3200, deposito: 12, vitrina: 4, minimo: 4, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 212, nombre: "Sprite Lima-Limón Original 2,25 l", codigo: "7790895001000", costo: 2200, venta: 3700, deposito: 11, vitrina: 4, minimo: 4, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad", familia: "Sprite", variante: "Original 2,25 L" },
  { id: 213, nombre: "Fanta Naranja 2,25 l", codigo: "7790895008447", costo: 2200, venta: 3700, deposito: 10, vitrina: 4, minimo: 4, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 214, nombre: "Pepsi 1,5 l", codigo: "7791813423113", costo: 1750, venta: 3000, deposito: 13, vitrina: 5, minimo: 4, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 215, nombre: "Monster Energy Original 473 ml", codigo: "070847811169", costo: 2100, venta: 3500, deposito: 18, vitrina: 6, minimo: 6, alertaVitrina: 3, categoria: "Bebidas", unidad: "unidad" },
  { id: 216, nombre: "Monster Mango Loco 473 ml", codigo: "070847036563", costo: 2200, venta: 3700, deposito: 15, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 217, nombre: "Monster Ultra White 473 ml", codigo: "070847012481", costo: 2200, venta: 3700, deposito: 14, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 218, nombre: "Monster Pipeline Punch 473 ml", codigo: "070847031568", costo: 2250, venta: 3800, deposito: 12, vitrina: 4, minimo: 4, alertaVitrina: 2, categoria: "Bebidas", unidad: "unidad" },
  { id: 219, nombre: "Red Bull 250 ml", codigo: "9002490100070", costo: 1800, venta: 3100, deposito: 16, vitrina: 6, minimo: 5, alertaVitrina: 3, categoria: "Bebidas", unidad: "unidad" },
  { id: 220, nombre: "Agua mineral 1,5 l", codigo: "7790315001157", costo: 750, venta: 1400, deposito: 22, vitrina: 8, minimo: 7, alertaVitrina: 4, categoria: "Bebidas", unidad: "unidad" },
  { id: 221, nombre: "Galletitas Oreo 118 g", codigo: "7790040991123", costo: 850, venta: 1550, deposito: 20, vitrina: 7, minimo: 6, alertaVitrina: 3, categoria: "Golosinas", unidad: "unidad" },
  { id: 222, nombre: "Galletitas Chocolinas 170 g", codigo: "7790040115673", costo: 1050, venta: 1850, deposito: 16, vitrina: 6, minimo: 5, alertaVitrina: 3, categoria: "Almacén", unidad: "unidad" },
  { id: 223, nombre: "Arroz largo fino 1 kg", codigo: "7790070412345", costo: 1250, venta: 2100, deposito: 14, vitrina: 4, minimo: 5, alertaVitrina: 2, categoria: "Almacén", unidad: "unidad" },
  { id: 224, nombre: "Fideos spaghetti 500 g", codigo: "7790070506785", costo: 780, venta: 1400, deposito: 19, vitrina: 6, minimo: 6, alertaVitrina: 3, categoria: "Almacén", unidad: "unidad" },
  { id: 225, nombre: "Aceite de girasol 900 ml", codigo: "7790272000132", costo: 2100, venta: 3400, deposito: 10, vitrina: 3, minimo: 4, alertaVitrina: 2, categoria: "Almacén", unidad: "unidad" },
  { id: 226, nombre: "Azúcar 1 kg", codigo: "7798077101018", costo: 900, venta: 1550, deposito: 17, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Almacén", unidad: "unidad" },
  { id: 227, nombre: "Harina 000 1 kg", codigo: "7792180001133", costo: 850, venta: 1450, deposito: 15, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Almacén", unidad: "unidad" },
  { id: 228, nombre: "Leche entera 1 l", codigo: "7790742034506", costo: 1200, venta: 2050, deposito: 13, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Lácteos", unidad: "unidad" },
  { id: 229, nombre: "Atún al natural 170 g", codigo: "7790150123458", costo: 1900, venta: 3200, deposito: 9, vitrina: 3, minimo: 3, alertaVitrina: 1, categoria: "Almacén", unidad: "unidad" },
  { id: 230, nombre: "Papas fritas 150 g", codigo: "7798123456796", costo: 1350, venta: 2400, deposito: 14, vitrina: 5, minimo: 5, alertaVitrina: 2, categoria: "Golosinas", unidad: "unidad" },
];

const fechaDemo = (diasAtras, hora) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  fecha.setHours(hora, (diasAtras * 7) % 60, 0, 0);
  return fecha.toISOString();
};

const itemDemo = (productId, cantidad, incluirCosto = true) => {
  const product = productosSur.find((p) => p.id === productId);
  const factor = product.unidad === "unidad" ? 1 : 1000;
  const item = {
    productId,
    nombre: product.nombre,
    cantidad,
    unidad: product.unidad,
    precioUnitario: product.venta,
    subtotal: product.venta * cantidad,
  };
  if (incluirCosto) {
    item.costoUnitario = product.costo / factor;
    item.costoTotal = item.costoUnitario * cantidad;
  }
  return item;
};

const ticketDemo = (id, diasAtras, hora, medio, lineas, incluirCosto = true) => {
  const items = lineas.map(([productId, cantidad]) => itemDemo(productId, cantidad, incluirCosto));
  return {
    id,
    fecha: fechaDemo(diasAtras, hora),
    medio,
    clienteId: null,
    quien: id % 3 === 0 ? "Sofía (Cajera)" : "María (Dueño)",
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
};

const ticketsSur = [
  ticketDemo(1, 0, 9, "Efectivo", [[201, 2], [203, 3]]),
  ticketDemo(2, 0, 11, "Mercado Pago", [[204, 1], [202, 2]]),
  ticketDemo(3, 0, 14, "Tarjeta", [[206, 180], [207, 500]]),
  ticketDemo(4, 1, 10, "Efectivo", [[205, 1], [203, 2]]),
  ticketDemo(5, 2, 18, "Transferencia", [[201, 1], [204, 2], [208, 1]]),
  ticketDemo(6, 3, 16, "Mercado Pago", [[203, 5], [202, 1]]),
  ticketDemo(7, 5, 12, "Efectivo", [[206, 250], [201, 2]]),
  ticketDemo(8, 7, 20, "Tarjeta", [[207, 1000], [204, 1]]),
  ticketDemo(9, 10, 8, "Efectivo", [[202, 4], [203, 4]]),
  ticketDemo(10, 14, 17, "Transferencia", [[205, 2], [208, 1]]),
  ticketDemo(11, 20, 13, "Mercado Pago", [[201, 3], [204, 2]]),
  ticketDemo(12, 25, 19, "Efectivo", [[203, 2], [202, 2]], false),
  ticketDemo(13, 0, 9, "Efectivo", [[201, 2], [203, 3]]),
  ...Array.from({ length: 78 }, (_, index) => {
    const id = index + 14;
    const combinaciones = [[[201, 1], [203, 2]], [[209, 1], [221, 1]], [[215, 1], [204, 1]], [[202, 2], [230, 1]], [[223, 1], [224, 2]], [[210, 1], [203, 1]], [[228, 2], [221, 1]], [[214, 1], [222, 1]], [[219, 1], [204, 1]], [[205, 1], [226, 1]], [[207, 750], [206, 120]], [[216, 1], [230, 1]]];
    const ticket = ticketDemo(id, 1 + (index % 58), 8 + (index % 13), ["Efectivo", "Mercado Pago", "Tarjeta", "Transferencia"][index % 4], combinaciones[index % combinaciones.length]);
    return index % 11 === 0 ? { ...ticket, medio: "Cuenta corriente", clienteId: 1, clienteNombre: "Carlos Medina", fiado: true } : ticket;
  }),
];

const fechaSoloDemo = (diasDesdeHoy) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasDesdeHoy);
  return fecha.toISOString().slice(0, 10);
};

const productosSurCompletos = productosSur.map((producto, index) => ({
  ...producto,
  proveedorId: index < 9 ? 1 : index < 19 ? 2 : 3,
  vencimiento: fechaSoloDemo([-2, 7, 16, 45, 120][index % 5]),
}));

const datosSurDemo = () => ({
  demoSeedVersion: 5,
  products: productosSurCompletos,
  caja: { saldo: 186400, movimientos: [{ id: 1, tipo: "ingreso", monto: 65000, nota: "Apertura de caja", fecha: fechaDemo(0, 8) }, { id: 2, tipo: "ingreso", monto: 88400, nota: "Ventas en efectivo acumuladas", fecha: fechaDemo(0, 19) }, { id: 3, tipo: "egreso", monto: 12000, nota: "Pago a proveedor", fecha: fechaDemo(1, 12) }, { id: 4, tipo: "ingreso", monto: 45000, nota: "Cobro de fiado", fecha: fechaDemo(3, 17) }], historial: [] },
  tickets: ticketsSur,
  clientes: [
    { id: 1, nombre: "Carlos Medina", telefono: "11 5555-1842", saldo: 12400, movimientos: [{ id: "deuda-1", tipo: "deuda", monto: 18200, nota: "Compras de la semana", fecha: fechaDemo(4, 18) }, { id: "pago-1", tipo: "pago", monto: 5800, nota: "Pago recibido (Efectivo)", fecha: fechaDemo(1, 10) }] },
    { id: 2, nombre: "Ana Torres", telefono: "11 5555-9210", saldo: 6800, movimientos: [{ id: "deuda-2", tipo: "deuda", monto: 6800, nota: "Fiado del mes", fecha: fechaDemo(2, 15) }] },
    { id: 3, nombre: "Roberto Pérez", telefono: "11 5555-0744", saldo: 0, movimientos: [{ id: "pago-3", tipo: "pago", monto: 9600, nota: "Cuenta saldada", fecha: fechaDemo(6, 11) }] },
  ],
  proveedores: [
    { id: 1, nombre: "Distribuidora Río", contacto: "Natalia Suárez", telefono: "11 4444-1234", email: "pedidos@rio.demo", notas: "Bebidas y energizantes. Reparte martes y viernes." },
    { id: 2, nombre: "Mayorista Central", contacto: "Martín López", telefono: "11 4444-5648", email: "ventas@central.demo", notas: "Almacén y golosinas. Pedido mínimo $80.000." },
    { id: 3, nombre: "Lácteos del Barrio", contacto: "Verónica Gil", telefono: "11 4444-8877", email: "reparto@lacteos.demo", notas: "Entrega diaria por la mañana." },
  ],
  comprasItems: [{ id: 1, productId: 201, nombre: "Coca-Cola 500 ml", cantidad: 24, costoCompra: 900, proveedorId: 1, estado: "pedido", pedidoId: 11 }, { id: 2, productId: 215, nombre: "Monster Energy Original 473 ml", cantidad: 12, costoCompra: 2100, proveedorId: 1, estado: "pendiente" }, { id: 3, productId: 225, nombre: "Aceite de girasol 900 ml", cantidad: 8, costoCompra: 2100, proveedorId: 3, estado: "pedido", pedidoId: 12 }, { id: 4, productId: 221, nombre: "Galletitas Oreo 118 g", cantidad: 18, costoCompra: 850, proveedorId: 3, estado: "recibido", pedidoId: 10 }],
  pedidos: [{ id: 10, proveedorId: 3, proveedorNombre: "Lácteos del Barrio", fecha: fechaDemo(5, 9), estado: "recibido", items: [{ productId: 221, cantidad: 18 }] }, { id: 11, proveedorId: 1, proveedorNombre: "Distribuidora Río", fecha: fechaDemo(1, 18), estado: "parcial", items: [{ productId: 201, cantidad: 24 }] }, { id: 12, proveedorId: 3, proveedorNombre: "Lácteos del Barrio", fecha: fechaDemo(0, 17), estado: "pedido", items: [{ productId: 225, cantidad: 8 }] }],
  gastos: [{ id: 1, descripcion: "Alquiler del local", categoria: "Alquiler", monto: 280000, vencimiento: fechaSoloDemo(3), medio: "Transferencia", estado: "pendiente", recurrente: true, fecha: fechaDemo(0, 9) }, { id: 2, descripcion: "Internet y telefonía", categoria: "Servicios", monto: 24500, vencimiento: fechaSoloDemo(-2), medio: "Mercado Pago", estado: "pendiente", recurrente: true, fecha: fechaDemo(30, 12) }, { id: 3, descripcion: "Luz del local", categoria: "Servicios", monto: 38600, vencimiento: fechaSoloDemo(-4), medio: "Transferencia", estado: "pagado", recurrente: true, fecha: fechaDemo(7, 14) }, { id: 4, descripcion: "Limpieza y bolsas", categoria: "Mantenimiento", monto: 17200, vencimiento: fechaSoloDemo(0), medio: "Efectivo", estado: "pagado", recurrente: false, fecha: fechaDemo(0, 10) }],
  perdidas: [{ id: 1, productId: 228, nombre: "Leche entera 1 l", cantidad: 2, unidad: "unidad", motivo: "Vencimiento", costoTotal: 2400, fecha: fechaDemo(3, 16) }, { id: 2, productId: 204, nombre: "Papas fritas 90 g", cantidad: 1, unidad: "unidad", motivo: "Producto roto", costoTotal: 850, fecha: fechaDemo(10, 11) }],
  sugerencias: [{ id: 1, texto: "Incorporar agua saborizada sin azúcar", estado: "nueva", fecha: fechaDemo(2, 13) }],
  ventasSuspendidas: [{ id: 1, nombre: "Pedido de oficina", items: [{ productId: 223, cantidad: 2 }], fecha: fechaDemo(0, 11) }],
  auditoria: [{ id: 1, fecha: fechaDemo(0, 8), usuario: "María", rol: "Dueño", seccion: "caja", accion: "apertura", detalle: "Apertura de caja registrada" }, { id: 2, fecha: fechaDemo(1, 18), usuario: "Sofía Ramírez", rol: "Cajero", seccion: "ventas", accion: "venta", detalle: "Venta registrada con Mercado Pago" }, { id: 3, fecha: fechaDemo(2, 10), usuario: "Diego Luna", rol: "Administrador", seccion: "stock", accion: "actualizar_products", detalle: "Reposición de bebidas" }],
  inventarios: [{ id: 1, fecha: fechaDemo(12, 9), categoria: "Bebidas", responsable: "Diego Luna", diferenciaCosto: -4850, items: [{ productId: 201, nombre: "Coca-Cola 500 ml", diferencia: -3, costoDiferencia: -2700 }, { productId: 215, nombre: "Monster Energy Original 473 ml", diferencia: -1, costoDiferencia: -2100 }] }],
  cajaAbierta: true, cart: [],
  tareas: [{ id: 1, titulo: "Controlar vencimientos de lácteos", completa: false }, { id: 2, titulo: "Actualizar precios de bebidas", completa: true }],
  metas: [{ id: 1, tipo: "diaria", objetivo: 180000 }],
  promociones: [{ id: 1, nombre: "Combo merienda", tipo: "combo", valor: 2500, productIds: [203, 202], activa: true, desde: fechaSoloDemo(-10), hasta: fechaSoloDemo(20) }, { id: 2, nombre: "Energizantes 10%", tipo: "porcentaje", valor: 10, productIds: [215, 216, 217, 218, 219], activa: true, desde: fechaSoloDemo(-3), hasta: fechaSoloDemo(7) }],
  reservas: [{ id: 1, fecha: fechaDemo(0, 10), cliente: "Club Social", items: [{ productId: 201, cantidad: 12 }, { productId: 203, cantidad: 20 }], total: 41200, estado: "pendiente" }],
  presupuestos: [{ id: 1, fecha: fechaDemo(1, 16), cliente: "Oficina Norte", items: [{ productId: 209, cantidad: 6 }, { productId: 221, cantidad: 8 }], total: 28000, estado: "borrador" }],
  arqueos: [{ id: 1, fecha: fechaDemo(1, 20), esperado: 171000, contado: 169500, diferencia: -1500, responsable: "María" }],
  configuracionFiscal: { tipoComprobante: "Ticket", puntoVenta: "0001", cuit: "30-12345678-9", condicionIva: "Responsable monotributo" }, comprobantes: [],
  listaCompras: [{ id: 1, texto: "Bolsas camiseta grandes", cantidad: 3, completo: false, fecha: fechaDemo(0, 9) }, { id: 2, texto: "Rollos para ticket", cantidad: 4, completo: true, fecha: fechaDemo(5, 10) }],
  retornables: [{ id: 1, persona: "Carlos Medina", detalle: "Cajón de gaseosas", cantidad: 1, devuelto: false, fecha: fechaDemo(2, 18) }, { id: 2, persona: "Ana Torres", detalle: "Botellas retornables", cantidad: 6, devuelto: true, fecha: fechaDemo(9, 15) }],
  cambioCaja: { 10: 0, 20: 1, 50: 2, 100: 4, 200: 7, 500: 9, 1000: 13, 2000: 8, 10000: 4, 20000: 2 },
  autoconsumos: [{ id: 1, fecha: fechaDemo(0, 13), productId: 203, producto: "Alfajor triple", cantidad: 1, usuario: "Sofía Ramírez", nota: "Colación de turno" }],
  turnos: [{ id: 1, persona: "Sofía Ramírez", inicio: fechaDemo(1, 8), fin: fechaDemo(1, 16), ventasInicio: 0, ventas: 146800 }, { id: 2, persona: "Diego Luna", inicio: fechaDemo(2, 8), fin: fechaDemo(2, 15), ventasInicio: 0, ventas: 119400 }],
  recordatoriosProveedor: [{ id: 1, texto: "Confirmar pedido de bebidas", para: fechaSoloDemo(1), hora: "09:30", completo: false }, { id: 2, texto: "Pedir lácteos", para: fechaSoloDemo(-1), hora: "08:00", completo: true }],
  movimientosStock: [],
  historialLimpiezas: [],
});

export const seedDatos = () => ({
  3: defaultDataset(true),
  2: datosSurDemo(),
});
