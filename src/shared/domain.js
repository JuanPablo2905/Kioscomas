import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Truck, CalendarClock, Receipt, LayoutDashboard, ScanBarcode,
} from "lucide-react";
export const NAV_ITEMS = [
  { id: "stock", label: "Stock y vencimientos", mobileLabel: "Stock", icon: Package },
  { id: "catalogo", label: "Catálogo", mobileLabel: "Catálogo", icon: ScanBarcode },
  { id: "notificaciones", label: "Notificaciones", mobileLabel: "Alertas", icon: Bell },
  { id: "vitrina", label: "Vitrina", icon: Store },
  { id: "ventas", label: "Ventas / Caja", mobileLabel: "Ventas", icon: ShoppingCart },
  { id: "compras", label: "Compras y proveedores", mobileLabel: "Compras", icon: ClipboardList },
  { id: "gastos", label: "Gastos", icon: Receipt },
  { id: "clientes", label: "Clientes / Fiado", mobileLabel: "Clientes", icon: Users },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "gestion", label: "Gestión y herramientas", mobileLabel: "Herramientas", icon: LayoutDashboard },
];

export const HOME_CARDS = [
  {
    id: "stock",
    icon: Package,
    title: "Stock y vencimientos",
    desc: "Productos, códigos, vencimientos y pérdidas",
  },
  {
    id: "catalogo",
    icon: ScanBarcode,
    title: "Catálogo",
    desc: "Códigos de barras y productos escaneados",
  },
  {
    id: "vitrina",
    icon: Store,
    title: "Vitrina",
    desc: "Controlar exhibición",
  },
  {
    id: "ventas",
    icon: ShoppingCart,
    title: "Ventas / Caja",
    desc: "Vender y gestionar caja",
  },
  {
    id: "compras",
    icon: ClipboardList,
    title: "Compras y proveedores",
    desc: "Reposición, pedidos y proveedores",
  },
  {
    id: "clientes",
    icon: Users,
    title: "Clientes / Fiado",
    desc: "Cuentas corrientes y deudas",
  },
  {
    id: "reportes",
    icon: BarChart3,
    title: "Reportes",
    desc: "Analizar ventas",
  },
];

export const CATEGORIES = ["Sin categoría", "Bebidas", "Golosinas", "Almacén", "Higiene", "Limpieza", "Mascotas"];

export const UNIDAD_GRUPOS = [
  { id: "unidad", label: "Por unidad" },
  { id: "peso", label: "Por peso (Kg / gramos)" },
  { id: "volumen", label: "Por volumen (Litros / ml)" },
];

// Para "unidad": todo se maneja en unidades enteras (factor 1).
// Para "peso": el depósito/vitrina se maneja en Kg, pero se vende por gramo (factor 1000).
// Para "volumen": el depósito/vitrina se maneja en Litros, pero se vende por ml (factor 1000).
export const unidadInfo = (grupo) => {
  if (grupo === "peso")
    return {
      baseAbbr: "kg",
      baseLabel: "Kg",
      ventaAbbr: "g",
      ventaLabel: "gramo",
      factor: 1000,
    };
  if (grupo === "volumen")
    return {
      baseAbbr: "l",
      baseLabel: "Litro",
      ventaAbbr: "ml",
      ventaLabel: "ml",
      factor: 1000,
    };
  return {
    baseAbbr: "un",
    baseLabel: "Unidad",
    ventaAbbr: "un",
    ventaLabel: "unidad",
    factor: 1,
  };
};

export const nowFecha = () => new Date().toLocaleString("es-AR");

export const historialEntry = (tipo, detalle) => ({
  id: Date.now() + Math.random(),
  tipo,
  detalle,
  fecha: nowFecha(),
});

export const INITIAL_PRODUCTS = [
  {
    id: 1,
    nombre: "Sky Cosmic",
    codigo: "",
    costo: 3000,
    venta: 10000,
    deposito: 16,
    vitrina: 2,
    minimo: 3,
    alertaVitrina: 2,
    categoria: "Bebidas",
    unidad: "unidad",
    historial: [historialEntry("creacion", "Carga inicial de demostración")],
  },
  {
    id: 2,
    nombre: "Fernet Branca",
    codigo: "",
    costo: 3000,
    venta: 12000,
    deposito: 7,
    vitrina: 2,
    minimo: 2,
    alertaVitrina: 2,
    categoria: "Bebidas",
    unidad: "unidad",
    historial: [historialEntry("creacion", "Carga inicial de demostración")],
  },
  {
    id: 3,
    nombre: "Colgate Sensitive",
    codigo: "7509546690285",
    costo: 1000,
    venta: 2000,
    deposito: 7,
    vitrina: 1,
    minimo: 2,
    alertaVitrina: 1,
    categoria: "Higiene",
    unidad: "unidad",
    historial: [historialEntry("creacion", "Carga inicial de demostración")],
  },
  {
    id: 4,
    nombre: "Pititos de Goma",
    codigo: "",
    costo: 10000,
    venta: 100000,
    deposito: 0,
    vitrina: 0,
    minimo: 1,
    alertaVitrina: 1,
    categoria: "Golosinas",
    unidad: "unidad",
    historial: [historialEntry("creacion", "Carga inicial de demostración")],
  },
];

export const money = (n) =>
  Number(n || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });

export const roundQuantity = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 1000) / 1000;
};

export const formatQuantity = (value) =>
  roundQuantity(value).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
