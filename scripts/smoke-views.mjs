import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });

try {
  const { seedCuentas, seedDatos } = await vite.ssrLoadModule("/src/app/data.js");
  const cuentas = seedCuentas();
  const datos = seedDatos();
  const cuenta = cuentas.find((item) => item.usuario === "sur");
  const data = datos[cuenta.id];
  const noop = () => {};
  const { detectarTicketsDuplicados } = await vite.ssrLoadModule("/src/features/reportes/reportMetrics.js");
  const baseFecha = "2026-07-18T10:00:00.000Z";
  const ticketsSemaforo = [
    { id: "a", fecha: baseFecha, medio: "Efectivo", clienteId: null, total: 20, items: [{ productId: 1, cantidad: 2 }] },
    { id: "b", fecha: baseFecha, medio: "Efectivo", clienteId: null, total: 20, items: [{ productId: 1, cantidad: 2 }] },
    { id: "c", fecha: "2026-07-20T11:00:01.000Z", medio: "Efectivo", clienteId: null, total: 20, items: [{ productId: 1, cantidad: 2 }] },
  ];
  const alertasSemaforo = detectarTicketsDuplicados(ticketsSemaforo);
  if (alertasSemaforo.get("a")?.nivel !== "rojo" || alertasSemaforo.has("c")) throw new Error("Falló la detección exacta de tickets");
  console.log("OK: Detección exacta de tickets duplicados");

  const cases = [
    ["Inicio", "/src/features/inicio/Home.jsx", "Home", { cuenta, identidad: { rol: "Dueño" }, data, onNavigate: noop }],
    ["Notificaciones", "/src/features/notificaciones/NotificacionesView.jsx", "NotificacionesView", { data, onNavigate: noop }],
    ["Stock", "/src/features/stock/StockView.jsx", "StockView", { products: data.products, setProducts: noop, proveedores: data.proveedores || [] }],
    ["Nuevo producto", "/src/features/stock/StockView.jsx", "ProductModal", { initial: null, onClose: noop, onSave: noop, proveedores: [] }],
    ["Área Stock", "/src/features/stock/StockArea.jsx", "StockArea", { products: data.products, setProducts: noop, proveedores: data.proveedores || [], sugerencias: [], setSugerencias: noop, perdidas: [], setPerdidas: noop, inventarios: [], setInventarios: noop }],
    ["Conteo físico", "/src/features/stock/InventoryView.jsx", "InventoryView", { products: data.products, setProducts: noop, inventarios: [], setInventarios: noop, identidad: { nombre: "Prueba" } }],
    ["Vitrina", "/src/features/vitrina/VitrinaView.jsx", "VitrinaView", { products: data.products, setProducts: noop }],
    ["Ventas", "/src/features/ventas/VentasView.jsx", "VentasView", { ...data, setProducts: noop, setCaja: noop, setTickets: noop, setCajaAbierta: noop, setClientes: noop, setCart: noop }],
    ["Compras", "/src/features/compras/ComprasView.jsx", "ComprasView", { products: data.products, setProducts: noop, comprasItems: data.comprasItems, setComprasItems: noop, proveedores: data.proveedores || [] }],
    ["Área Compras", "/src/features/compras/ComprasArea.jsx", "ComprasArea", { products: data.products, setProducts: noop, comprasItems: data.comprasItems, setComprasItems: noop, proveedores: data.proveedores || [], setProveedores: noop, pedidos: [], setPedidos: noop }],
    ["Proveedores", "/src/features/proveedores/ProveedoresView.jsx", "ProveedoresView", { proveedores: data.proveedores || [], setProveedores: noop, products: data.products, setProducts: noop }],
    ["Vencimientos", "/src/features/vencimientos/VencimientosView.jsx", "VencimientosView", { products: data.products, setProducts: noop, perdidas: data.perdidas || [], setPerdidas: noop }],
    ["Gastos", "/src/features/gastos/GastosView.jsx", "GastosView", { gastos: data.gastos || [], setGastos: noop, caja: data.caja, setCaja: noop }],
    ["Clientes", "/src/features/clientes/ClientesView.jsx", "ClientesView", { clientes: data.clientes, tickets: data.tickets, setClientes: noop, setTickets: noop, setCaja: noop }],
    ["Reportes", "/src/features/reportes/ReportesView.jsx", "ReportesView", { tickets: data.tickets, products: data.products, setTickets: noop, setCaja: noop }],
    ["Administración", "/src/features/administracion/AdministracionView.jsx", "AdministracionView", { cuenta, cuentas, setCuentas: noop, datos, setDatos: noop, identidad: { rol: "Dueño" }, onOpenNegocio: noop }],
    ["Panel administrador", "/src/features/administracion/AdminAppPanel.jsx", "AdminAppPanel", { cuentas, setCuentas: noop, datos, setDatos: noop, notas: [], setNotas: noop, onOpenNegocio: noop, onLogout: noop }],
    ["Configuración", "/src/shared/SettingsModal.jsx", "SettingsModal", { preferences: {}, onChange: noop, onClose: noop }],
    ["Importar productos", "/src/features/stock/ProductTransferModal.jsx", "ProductTransferModal", { products: data.products, setProducts: noop, onClose: noop }],
    ["Lector de códigos", "/src/shared/ScanModal.jsx", "ScanModal", { onClose: noop, onDetected: noop }],
  ];

  for (const [name, path, exportName, props] of cases) {
    const module = await vite.ssrLoadModule(path);
    renderToString(React.createElement(module[exportName], props));
    console.log(`OK: ${name}`);
  }
} finally {
  await vite.close();
}
