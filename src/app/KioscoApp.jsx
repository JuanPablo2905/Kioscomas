import React, { useEffect, useRef, useState } from "react";
import { repository } from "../cloud/repository";
import { loadCloudConfig } from "../cloud/config";
import { ensureLocalCloudSession, logoutCloud } from "../cloud/cloudAuth";
import { clearLoginFailures, createSession, loginGuard, registerLoginFailure, secureAccounts, secureSubject, validSession, verifyPassword } from "../security/auth";
import { accountAccessMessage, canAccessAccount, grantTrialAccess, trialAccessStatus } from "../security/trialAccess";
import { Sidebar } from "../shared/layout";
import { ViewErrorBoundary } from "../shared/ViewErrorBoundary";
import { Home, ReportarProblemaModal } from "../features/inicio/Home";
import { StockView } from "../features/stock/StockView";
import { StockArea } from "../features/stock/StockArea";
import { VitrinaView } from "../features/vitrina/VitrinaView";
import { VentasView } from "../features/ventas/VentasView";
import { ComprasView } from "../features/compras/ComprasView";
import { ComprasArea } from "../features/compras/ComprasArea";
import { ProveedoresView } from "../features/proveedores/ProveedoresView";
import { VencimientosView } from "../features/vencimientos/VencimientosView";
import { NotificacionesView } from "../features/notificaciones/NotificacionesView";
import { GastosView } from "../features/gastos/GastosView";
import { ClientesView } from "../features/clientes/ClientesView";
import { ReportesView } from "../features/reportes/ReportesView";
import { AdministracionView } from "../features/administracion/AdministracionView";
import { AdminAppPanel } from "../features/administracion/AdminAppPanel";
import { GestionView } from "../features/gestion/GestionView";
import { LoginView } from "../features/autenticacion/LoginView";
import { SettingsModal, applyPreferences, DEFAULT_PREFERENCES, migrateBrandPreferences } from "../shared/SettingsModal";
import { useInteractionFeedback } from "../shared/useInteractionFeedback";
import { useMobileKeyboardViewport } from "../shared/useMobileKeyboardViewport";
import { useAutoContrast } from "../shared/useAutoContrast";
import { ScanModal } from "../shared/ScanModal";
import { GlobalScanResult } from "../shared/GlobalScanResult";
import { TutorialOverlay } from "../shared/TutorialOverlay";
import { parseTicketBarcode } from "../shared/ticketBarcode";
import { printTicket } from "../shared/ticketPrint";
import { anularTicket, restaurarStock } from "../features/ventas/salesRules";
import { unidadInfo } from "../shared/domain";
import { auditActor, createAuditEvent, describeAccountChange, enrichEntityHistory, hasMeaningfulChange } from "../shared/audit";
import { captureAppScreenshot } from "../shared/captureScreenshot";
import { lookupBarcode } from "../shared/productLookup";
import { cloudFetch, cloudSession } from "../cloud/cloudAuth";
import { CatalogoView } from "../features/catalogo/CatalogoView";
import { cleanOperationalDataset, exportCommercialArchive } from "../shared/archive";
import { PromptDialog } from "../shared/controls";
import { defaultDataset, migrarCuentasDemo, migrarDatosDemo, permisosDe, rolesPorDefecto, seedCuentas, seedDatos } from "./data";

const kioscoPlusLockup = `${import.meta.env.BASE_URL}kiosco-plus-lockup.svg`;
const PUBLIC_DEMO_MODE = import.meta.env.VITE_PUBLIC_DEMO === "true";
const PUBLIC_DEMO_IDENTITY = { usuarioId: "cuenta:2", tenantId: "2", rol: "Dueño", nombre: "María", superAdmin: false, publicDemo: true };
const DEMO_INTRO_TUTORIAL_KEY = "__demo_intro__";
const TUTORIAL_VIEW_NAMES = { home: "Inicio", notificaciones: "Notificaciones", stock: "Stock", vitrina: "Vitrina", ventas: "Ventas y caja", compras: "Compras", gastos: "Gastos", clientes: "Clientes", reportes: "Reportes", gestion: "Gestión", administracion: "Administración" };

function DemoTutorialPrompt({ view, declined, onStart, onDecline, onClose }) {
  const sectionName = TUTORIAL_VIEW_NAMES[view] || "esta sección";
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
      {declined ? <>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Demostración</p>
        <h2 className="mt-1 text-xl font-bold">Podés activarlo cuando quieras</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">Buscá el botón <b>Ayuda</b> con el signo <b>?</b> en la parte inferior del menú lateral. Ahí podés elegir y repetir los recorridos de cada sección.</p>
        <button onClick={onClose} className="mt-5 min-h-11 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Entendido</button>
      </> : <>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Demostración guiada</p>
        <h2 className="mt-1 text-xl font-bold">¿Querés conocer {sectionName}?</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">Podemos mostrarte un recorrido corto con las funciones principales. No modifica ninguno de los datos ficticios.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onDecline} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Ahora no</button>
          <button onClick={onStart} className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Sí, mostrarme</button>
        </div>
      </>}
    </div>
  </div>;
}

function HelpButtonSpotlight({ onClose }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    const locate = () => {
      const target = document.querySelector('[data-tour="help-button"]');
      if (!target) return;
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const next = target.getBoundingClientRect();
      setRect({ top: next.top, left: next.left, right: next.right, bottom: next.bottom });
    };
    locate();
    window.addEventListener("resize", locate);
    return () => window.removeEventListener("resize", locate);
  }, []);
  if (!rect) return null;
  return <div className="fixed inset-0 z-[205]">
    <div className="fixed inset-x-0 top-0 bg-black/65" style={{ height: rect.top }}/><div className="fixed inset-x-0 bottom-0 bg-black/65" style={{ top: rect.bottom }}/><div className="fixed left-0 bg-black/65" style={{ top: rect.top, width: rect.left, height: rect.bottom - rect.top }}/><div className="fixed right-0 bg-black/65" style={{ top: rect.top, left: rect.right, height: rect.bottom - rect.top }}/>
    <div className="pointer-events-none fixed rounded-xl border-[3px] border-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,.25),0_0_26px_rgba(251,191,36,.75)]" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.right - rect.left + 8, height: rect.bottom - rect.top + 8 }}/>
    <div className="fixed bottom-5 left-4 right-4 mx-auto max-w-sm rounded-2xl bg-white p-4 shadow-2xl sm:left-auto sm:right-6"><p className="font-bold">Este es el ícono de Ayuda</p><p className="mt-1 text-sm text-gray-600">Tocalo cuando quieras elegir o repetir un tutorial.</p><button onClick={onClose} className="mt-3 min-h-10 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">Entendido</button></div>
  </div>;
}

const TUTORIAL_PRODUCT = {
  id: "__tutorial_product__",
  nombre: "Producto de demostración",
  codigo: "0000000000000",
  costo: 500,
  venta: 1000,
  deposito: 10,
  vitrina: 5,
  minimo: 1,
  alertaVitrina: 1,
  categoria: "Ejemplo",
  unidad: "unidad",
  __tutorial: true,
};

const TUTORIAL_PURCHASE_SUPPLIER = {
  id: "__tutorial_purchase_supplier__",
  nombre: "Distribuidora de práctica",
  telefono: "11 0000-0000",
  contacto: "Pedido ficticio del recorrido",
  __tutorial: true,
};

const createTutorialPurchaseProducts = () => [{
  ...TUTORIAL_PRODUCT,
  id: "__tutorial_purchase_product__",
  nombre: "Galletitas de práctica",
  codigo: "0000000000001",
  costo: 850,
  deposito: 4,
  vitrina: 2,
  proveedorId: null,
}];

const createTutorialPurchaseItems = () => [];
const cloneForTutorial = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const createTutorialDataset = (source) => {
  const next = cloneForTutorial(source || defaultDataset(false));
  const now = new Date().toISOString();
  if (!(next.products || []).length) next.products = [{ ...TUTORIAL_PRODUCT }];
  if (!(next.products || []).some((product) => String(product.id) === "__tutorial_expiry_product__")) {
    next.products = [...next.products, {
      ...TUTORIAL_PRODUCT,
      id: "__tutorial_expiry_product__",
      nombre: "Producto con vencimiento · ejemplo ficticio",
      codigo: "0000000000099",
      deposito: 10,
      vitrina: 0,
      vencimiento: new Date(Date.now() + (7 * 86400000)).toISOString().slice(0, 10),
    }];
  }
  if (!(next.proveedores || []).length) next.proveedores = [{ ...TUTORIAL_PURCHASE_SUPPLIER }];
  if (!(next.tickets || []).length) next.tickets = [{
    id: "__tutorial_ticket__",
    fecha: now,
    medio: "Efectivo",
    total: 1000,
    quien: "Ejemplo del tutorial",
    items: [{ productId: next.products[0].id, nombre: next.products[0].nombre, cantidad: 1, precioUnitario: 1000, subtotal: 1000 }],
    __tutorial: true,
  }];
  if (!(next.clientes || []).length) next.clientes = [{
    id: "__tutorial_client__",
    nombre: "Cliente de práctica",
    telefono: "11 0000-0000",
    saldo: 1200,
    movimientos: [{ id: "__tutorial_client_move__", tipo: "deuda", monto: 1200, nota: "Compra ficticia del tutorial", fecha: new Date().toLocaleString("es-AR") }],
    __tutorial: true,
  }];
  if (!(next.gastos || []).length) next.gastos = [{
    id: "__tutorial_expense__",
    descripcion: "Luz del local · ejemplo",
    categoria: "Servicios",
    monto: 8500,
    fecha: now,
    vencimiento: now.slice(0, 10),
    medio: "Transferencia",
    estado: "pendiente",
    recurrente: true,
    __tutorial: true,
  }];
  if (!(next.perdidas || []).length) next.perdidas = [{
    id: "__tutorial_loss__",
    productId: next.products[0].id,
    nombre: next.products[0].nombre,
    cantidad: 1,
    unidad: next.products[0].unidad || "unidad",
    motivo: "Ejemplo ficticio del tutorial",
    costoTotal: Number(next.products[0].costo || 0),
    fecha: now,
    __tutorial: true,
  }];
  if (!(next.inventarios || []).length) next.inventarios = [{
    id: "__tutorial_inventory__",
    fecha: now,
    categoria: "Todas · ejemplo ficticio",
    responsable: "Tutorial",
    items: [{ productId: next.products[0].id, nombre: next.products[0].nombre, diferencia: 1 }],
    diferenciaCosto: Number(next.products[0].costo || 0),
    __tutorial: true,
  }];
  if (!(next.autoconsumos || []).length) next.autoconsumos = [{
    id: "__tutorial_self_use__",
    fecha: now,
    productId: next.products[0].id,
    producto: next.products[0].nombre,
    cantidad: 1,
    usuario: "Tutorial",
    nota: "Ejemplo ficticio",
    __tutorial: true,
  }];
  if (!(next.reservas || []).length) next.reservas = [{
    id: "__tutorial_order__",
    fecha: now,
    cliente: "Cliente ficticio",
    nota: "Retira por la tarde",
    items: [{ productId: next.products[0].id, nombre: next.products[0].nombre, cantidad: 2, precio: Number(next.products[0].venta || 0) }],
    total: Number(next.products[0].venta || 0) * 2,
    estado: "pendiente",
    __tutorial: true,
  }];
  if (!(next.presupuestos || []).length) next.presupuestos = [{
    id: "__tutorial_budget__",
    fecha: now,
    cliente: "Consumidor ficticio",
    items: [{ productId: next.products[0].id, nombre: next.products[0].nombre, cantidad: 3, precio: Number(next.products[0].venta || 0) }],
    total: Number(next.products[0].venta || 0) * 3,
    estado: "borrador",
    __tutorial: true,
  }];
  if (!(next.auditoria || []).length) next.auditoria = [{ id: "__tutorial_audit__", fecha: now, usuario: "Ejemplo del tutorial", rol: "Dueño", seccion: "stock", accion: "actualizar_products", detalle: "Producto de ejemplo: Stock en depósito 8 → 12", __tutorial: true }];
  return next;
};

export default function KioscoApp() {
  useMobileKeyboardViewport();
  useAutoContrast();
  const [view, setView] = useState("home");
  const [cargando, setCargando] = useState(true);
  const [cuentas, setCuentas] = useState(seedCuentas());
  const [datos, setDatos] = useState(seedDatos());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [identidad, setIdentidad] = useState(null); // { rol, nombre }
  const [loginError, setLoginError] = useState("");
  const [notasAdmin, setNotasAdmin] = useState([]);
  const [authSecurity, setAuthSecurity] = useState({});
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [reportesProblemas, setReportesProblemas] = useState([]);
  const [menuPreferences, setMenuPreferences] = useState({});
  const [userPreferences, setUserPreferences] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportDraft, setBugReportDraft] = useState({ captura: null, detalleTecnico: "", vista: null });
  const [globalScanOpen, setGlobalScanOpen] = useState(false);
  const [globalScanResult, setGlobalScanResult] = useState(null);
  const [voidTicketPrompt, setVoidTicketPrompt] = useState({ ticket: null, reason: "" });
  const [pendingStockProduct, setPendingStockProduct] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialCatalog, setTutorialCatalog] = useState(false);
  const [tutorialPrompt, setTutorialPrompt] = useState(null);
  const [helpSpotlightOpen, setHelpSpotlightOpen] = useState(false);
  const [tutorialCart, setTutorialCart] = useState([{ productId: TUTORIAL_PRODUCT.id, cantidad: 1 }]);
  const [tutorialPurchaseProducts, setTutorialPurchaseProducts] = useState(createTutorialPurchaseProducts);
  const [tutorialPurchaseItems, setTutorialPurchaseItems] = useState(createTutorialPurchaseItems);
  const [tutorialPurchaseOrders, setTutorialPurchaseOrders] = useState([]);
  const [tutorialData, setTutorialData] = useState(null);
  const [tutorialAccounts, setTutorialAccounts] = useState(null);
  const [tutorialPreferences, setTutorialPreferences] = useState(null);
  const [syncStatus, setSyncStatus] = useState(repository.getSyncStatus());
  const scannerBufferRef = useRef("");
  const scannerLastKeyRef = useRef(0);
  const autoTutorialRef = useRef(false);

  // Cargar todo lo guardado al abrir la app.
  useEffect(() => {
    let activo = true;
    (async () => {
      await repository.initialize();
      const [cuentasGuardadas, datosGuardados, sesion, notas, security, reportes, menuPrefs, userPrefs] = await Promise.all([
        repository.get("cuentas", []), repository.get("datos", {}), repository.get("sesion", null), repository.get("notasAdmin", []), repository.get("authSecurity", {}), repository.get("reportesProblemas", []), repository.get("menuPreferences", {}), repository.get("userPreferences", {}),
      ]);
      if (!activo) return;
      let loadedAccounts;
      try { loadedAccounts = await secureAccounts(migrarCuentasDemo(cuentasGuardadas)); } catch { loadedAccounts = await secureAccounts(seedCuentas()); }
      setCuentas(loadedAccounts);
      if (datosGuardados) {
        try {
          const guardados = datosGuardados;
          const demoActual = seedDatos()[2];
          if ((guardados?.[2]?.demoSeedVersion || 0) < demoActual.demoSeedVersion) {
            guardados[2] = demoActual;
          }
          setDatos(migrarDatosDemo(guardados));
        } catch {}
      }
      if (PUBLIC_DEMO_MODE) {
        setCurrentUserId(2);
        setIdentidad(PUBLIC_DEMO_IDENTITY);
        setSessionExpiresAt(null);
      } else if (validSession(sesion) && (sesion.identity?.superAdmin || sesion.identity?.adminApp || canAccessAccount(loadedAccounts.find((account) => account.id === sesion.accountId)))) { setCurrentUserId(sesion.accountId); setIdentidad(sesion.identity); setSessionExpiresAt(sesion.expiresAt); }
      else await repository.delete("sesion");
      setNotasAdmin(notas || []);
      setAuthSecurity(security || {});
      setReportesProblemas(reportes || []);
      setMenuPreferences(menuPrefs || {});
      setUserPreferences(Object.fromEntries(Object.entries(userPrefs || {}).map(([key, preferences]) => [key, migrateBrandPreferences(preferences)])));
      setCargando(false);
    })().catch((error) => {
      console.error("No se pudo iniciar Kiosco+", error);
      if (activo) {
        setLoginError(globalThis.isSecureContext ? "No se pudieron cargar los datos locales." : "Esta dirección no es segura. Abrí Kiosco+ usando el enlace HTTPS.");
        setCargando(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => repository.subscribe(setSyncStatus), []);
  useEffect(() => {
    repository.setContext({
      tenantId: currentUserId ? String(currentUserId) : null,
      isSystemAdmin: !!(identidad?.superAdmin || identidad?.adminApp),
    });
    if (currentUserId && !PUBLIC_DEMO_MODE) repository.syncNow().catch(() => {});
  }, [currentUserId, identidad?.superAdmin, identidad?.adminApp]);
  useEffect(() => {
    const reloadRemote = async () => {
      const [remoteData, remoteAccounts] = await Promise.all([repository.get("datos", {}), repository.get("cuentas", [])]);
      setDatos(migrarDatosDemo(remoteData));
      setCuentas(await secureAccounts(migrarCuentasDemo(remoteAccounts)));
    };
    window.addEventListener("kiosco-cloud-update", reloadRemote);
    return () => window.removeEventListener("kiosco-cloud-update", reloadRemote);
  }, []);
  useEffect(() => {
    if (PUBLIC_DEMO_MODE) return;
    const sync = () => repository.syncNow().catch(() => {});
    const cloudConfig = loadCloudConfig();
    const localCloud = /^(http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.|100\.)|https:\/\/[a-z0-9.-]+\.ts\.net:8443)/i.test(cloudConfig.apiUrl || "");
    const timer = setInterval(sync, localCloud ? 5000 : Number(cloudConfig.syncIntervalMs || 30000));
    window.addEventListener("online", sync);
    const configChanged = async () => { await repository.initialize(); sync(); };
    window.addEventListener("kiosco-cloud-config-changed", configChanged);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("kiosco-cloud-config-changed", configChanged); };
  }, []);

  // Guardar automáticamente cada vez que cambian cuentas, datos o sesión.
  // En modo demo pública no se persiste nada: los cambios quedan solo en
  // estado local de React y se pierden al recargar, manteniendo la demo
  // siempre con los datos que el administrador configuró en la app real.
  useEffect(() => {
    if (cargando || PUBLIC_DEMO_MODE) return;
    repository.set("cuentas", cuentas).catch(() => {});
  }, [cuentas, cargando]);

  useEffect(() => {
    if (cargando || PUBLIC_DEMO_MODE) return;
    repository.set("datos", datos).catch(() => {});
  }, [datos, cargando]);

  useEffect(() => {
    if (cargando || PUBLIC_DEMO_MODE) return;
    if (currentUserId && identidad && sessionExpiresAt) repository.set("sesion", { accountId: currentUserId, identity: identidad, expiresAt: sessionExpiresAt }).catch(() => {});
    else repository.delete("sesion").catch(() => {});
  }, [currentUserId, identidad, sessionExpiresAt, cargando]);

  useEffect(() => {
    if (cargando || PUBLIC_DEMO_MODE) return;
    repository.set("notasAdmin", notasAdmin).catch(() => {});
  }, [notasAdmin, cargando]);

  useEffect(() => { if (!cargando && !PUBLIC_DEMO_MODE) repository.set("authSecurity", authSecurity).catch(() => {}); }, [authSecurity, cargando]);
  useEffect(() => { if (!cargando && !PUBLIC_DEMO_MODE) repository.set("reportesProblemas", reportesProblemas).catch(() => {}); }, [reportesProblemas, cargando]);
  useEffect(() => { if (!cargando && !PUBLIC_DEMO_MODE) repository.set("menuPreferences", menuPreferences).catch(() => {}); }, [menuPreferences, cargando]);
  useEffect(() => { if (!cargando && !PUBLIC_DEMO_MODE) repository.set("userPreferences", userPreferences).catch(() => {}); }, [userPreferences, cargando]);
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const timer = setInterval(() => { if (Date.now() >= new Date(sessionExpiresAt).getTime()) { setCurrentUserId(null); setIdentidad(null); setSessionExpiresAt(null); setLoginError("La sesión venció. Ingresá nuevamente."); } }, 30000);
    return () => clearInterval(timer);
  }, [sessionExpiresAt]);
  useEffect(() => {
    if (cargando || !currentUserId || identidad?.superAdmin || identidad?.adminApp) return;
    const account = cuentas.find((item) => item.id === currentUserId);
    if (canAccessAccount(account)) return;
    setCurrentUserId(null);
    setIdentidad(null);
    setSessionExpiresAt(null);
    setLoginError(accountAccessMessage(account));
  }, [cuentas, cargando, currentUserId, identidad?.superAdmin, identidad?.adminApp]);
  useEffect(() => {
    if (identidad?.adminApp && identidad?.operandoNegocio && identidad.rol !== "Administrador de la app") {
      setIdentidad((previous) => ({ ...previous, rol: "Administrador de la app" }));
    }
  }, [identidad?.adminApp, identidad?.operandoNegocio, identidad?.rol]);

  const storedData = currentUserId ? datos[currentUserId] : null;
  const activeAccounts = tutorialOpen && tutorialAccounts ? tutorialAccounts : cuentas;
  const cuentaActual = activeAccounts.find((c) => c.id === currentUserId) || null;
  const data = tutorialOpen && tutorialData ? tutorialData : storedData;
  const activeAllBusinessData = tutorialOpen && data ? { ...datos, [currentUserId]: data } : datos;
  const preferenceKey = identidad?.usuarioId || `cuenta:${currentUserId}`;
  const syncedTutorialRecord = (storedData?.tutorialProgress || []).find((item) => item.id === preferenceKey);
  const localPreferences = { ...DEFAULT_PREFERENCES, ...(userPreferences[preferenceKey] || {}) };
  const savedPreferences = {
    ...localPreferences,
    tutorialsCompleted: syncedTutorialRecord
      ? [...new Set(syncedTutorialRecord.completed || [])]
      : [...new Set(localPreferences.tutorialsCompleted || [])],
  };
  const currentPreferences = tutorialOpen && tutorialPreferences ? tutorialPreferences : savedPreferences;
  const cleanOperationalHistory = (months = currentPreferences.operationalHistoryRetentionMonths || 12) => {
    if (!currentUserId || tutorialOpen) return { total: 0 };
    let summary = { total: 0 };
    setDatos((previous) => {
      const current = previous[currentUserId];
      if (!current) return previous;
      const result = cleanOperationalDataset(current, months);
      summary = result;
      if (!result.total) return previous;
      const event = createAuditEvent({ key: "historialLimpiezas", previousValue: current.historialLimpiezas || [], nextValue: [...(current.historialLimpiezas || []), result], identity: identidad, tenantId: currentUserId, view: "configuracion", deviceId: loadCloudConfig().deviceId, detail: `Limpieza segura: ${result.total} registros operativos anteriores a ${new Date(result.cutoff).toLocaleDateString("es-AR")}. Ventas, caja, auditoría y comprobantes preservados.` });
      return { ...previous, [currentUserId]: { ...result.dataset, historialLimpiezas: [...(current.historialLimpiezas || []), { id: event.id, fecha: event.fecha, meses: Number(months), eliminados: result.removed, total: result.total }], auditoria: [...(current.auditoria || []), event] } };
    });
    return summary;
  };
  const exportCurrentCommercialArchive = () => exportCommercialArchive({ businessName: cuentaActual?.nombreNegocio || "Kiosco+", comprobantes: data?.comprobantes || [] });
  useEffect(() => {
    if (!currentUserId || cargando || tutorialOpen || !currentPreferences.automaticOperationalCleanup) return;
    const key = `kiosco-cleanup-${preferenceKey}`;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    cleanOperationalHistory(currentPreferences.operationalHistoryRetentionMonths);
    localStorage.setItem(key, today);
  }, [currentUserId, cargando, tutorialOpen, currentPreferences.automaticOperationalCleanup, currentPreferences.operationalHistoryRetentionMonths, preferenceKey]);
  const hasEmployees = cuentaActual?.modoNegocio === "equipo";
  const stockTutorialActive = tutorialOpen && view === "stock";
  const ventasTutorialActive = tutorialOpen && view === "ventas";
  const comprasTutorialActive = tutorialOpen && view === "compras";
  const completedTutorialKey = (currentPreferences.tutorialsCompleted || []).join("|");
  useEffect(() => {
    const completed = localPreferences.tutorialsCompleted || [];
    if (!currentUserId || syncedTutorialRecord || completed.length === 0) return;
    setDatos((previous) => {
      const dataset = previous[currentUserId];
      if (!dataset || (dataset.tutorialProgress || []).some((item) => item.id === preferenceKey)) return previous;
      return {
        ...previous,
        [currentUserId]: {
          ...dataset,
          tutorialProgress: [
            ...(dataset.tutorialProgress || []),
            { id: preferenceKey, completed: [...new Set(completed)], updatedAt: new Date().toISOString() },
          ],
        },
      };
    });
  }, [currentUserId, preferenceKey, syncedTutorialRecord, (localPreferences.tutorialsCompleted || []).join("|")]);
  useEffect(() => {
    if (!tutorialOpen || !storedData) return;
    setTutorialData(createTutorialDataset(storedData));
    setTutorialAccounts(cloneForTutorial(cuentas));
    setTutorialPreferences(cloneForTutorial(savedPreferences));
  }, [tutorialOpen, view, currentUserId]);
  useEffect(() => { applyPreferences(currentPreferences); }, [currentPreferences]);
  useEffect(() => {
    if (!currentUserId || !identidad || (identidad.superAdmin && !identidad.operandoNegocio)) return;
    if (PUBLIC_DEMO_MODE) {
      if (view === "home" && !tutorialOpen && !tutorialPrompt && !(currentPreferences.tutorialsCompleted || []).includes(DEMO_INTRO_TUTORIAL_KEY)) {
        setTutorialPrompt({ view: "home", declined: false });
      }
      return;
    }
    if ((currentPreferences.tutorialsCompleted || []).includes(view)) {
      if (autoTutorialRef.current) {
        autoTutorialRef.current = false;
        setTutorialOpen(false);
      }
    } else {
      autoTutorialRef.current = true;
      setTutorialCatalog(false);
      setTutorialOpen(true);
    }
  }, [view, currentUserId, preferenceKey, completedTutorialKey, identidad?.superAdmin, identidad?.operandoNegocio]);
  useEffect(() => {
    if (ventasTutorialActive) setTutorialCart([{ productId: TUTORIAL_PRODUCT.id, cantidad: 1 }]);
  }, [ventasTutorialActive]);
  useEffect(() => {
    if (!comprasTutorialActive) return;
    setTutorialPurchaseProducts(createTutorialPurchaseProducts());
    setTutorialPurchaseItems(createTutorialPurchaseItems());
    setTutorialPurchaseOrders([]);
  }, [comprasTutorialActive]);
  useInteractionFeedback(currentPreferences.motion !== "ninguna");
  const saveTutorialProgress = (completed) => {
    const normalized = [...new Set(completed || [])];
    setDatos((previous) => {
      const dataset = previous[currentUserId];
      if (!dataset) return previous;
      const records = [...(dataset.tutorialProgress || [])];
      const recordIndex = records.findIndex((item) => item.id === preferenceKey);
      const nextRecord = { id: preferenceKey, completed: normalized, updatedAt: new Date().toISOString() };
      if (recordIndex >= 0) records[recordIndex] = nextRecord;
      else records.push(nextRecord);
      return { ...previous, [currentUserId]: { ...dataset, tutorialProgress: records } };
    });
  };
  const completeTutorial = (tutorialView) => {
    const completed = [...new Set([...(savedPreferences.tutorialsCompleted || []), tutorialView])];
    setUserPreferences((prev) => {
      const saved = { ...DEFAULT_PREFERENCES, ...(prev[preferenceKey] || {}) };
      return {
        ...prev,
        [preferenceKey]: {
          ...saved,
          tutorialsCompleted: completed,
        },
      };
    });
    saveTutorialProgress(completed);
    autoTutorialRef.current = false;
    setTutorialOpen(false);
  };
  const markTutorialHandled = (tutorialView) => {
    const completed = [...new Set([...(savedPreferences.tutorialsCompleted || []), tutorialView])];
    setUserPreferences((prev) => {
      const saved = { ...DEFAULT_PREFERENCES, ...(prev[preferenceKey] || {}) };
      return { ...prev, [preferenceKey]: { ...saved, tutorialsCompleted: completed } };
    });
    saveTutorialProgress(completed);
  };
  const startDemoTutorial = () => {
    markTutorialHandled(DEMO_INTRO_TUTORIAL_KEY);
    autoTutorialRef.current = false;
    setTutorialPrompt(null);
    setTutorialCatalog(false);
    setTutorialOpen(true);
  };
  const declineDemoTutorial = () => {
    markTutorialHandled(DEMO_INTRO_TUTORIAL_KEY);
    setTutorialPrompt(null);
    setHelpSpotlightOpen(true);
  };
  const reportarProblema = ({ descripcion, captura, detalleTecnico, vista: vistaReportada }) => setReportesProblemas((prev) => [{ id: Date.now(), fecha: new Date().toISOString(), estado: "nuevo", descripcion, captura: captura || null, detalleTecnico: detalleTecnico || "", negocioId: currentUserId, negocio: cuentaActual?.nombreNegocio || "Sin negocio", usuario: identidad?.nombre || "Sin identificar", vista: vistaReportada || view }, ...prev]);
  const abrirReporteProblema = async ({ detalleTecnico = "", vista: vistaReportada = view } = {}) => {
    const captura = await captureAppScreenshot();
    setBugReportDraft({ captura, detalleTecnico, vista: vistaReportada });
    setBugReportOpen(true);
  };

  const makeSetter = (key) => (updater) => {
    if (tutorialOpen) {
      setTutorialData((previous) => {
        const current = previous || createTutorialDataset(storedData);
        const nextValue = typeof updater === "function" ? updater(current[key]) : updater;
        return { ...current, [key]: nextValue };
      });
      return;
    }
    setDatos((prev) => {
      const cur = prev[currentUserId];
      if (!cur || String(cur.tenantId || currentUserId) !== String(currentUserId)) return prev;
      const rawNext =
        typeof updater === "function" ? updater(cur[key]) : updater;
      const nextVal = enrichEntityHistory(key, cur[key], rawNext, auditActor(identidad));
      if (!hasMeaningfulChange(cur[key], nextVal)) return prev;
      const auditar = !["cart"].includes(key);
      const evento = createAuditEvent({ key, previousValue: cur[key], nextValue: nextVal, identity: identidad, tenantId: currentUserId, view, deviceId: loadCloudConfig().deviceId });
      return { ...prev, [currentUserId]: { ...cur, tenantId: String(currentUserId), [key]: nextVal, auditoria: auditar ? [...(cur.auditoria || []), evento] : (cur.auditoria || []) } };
    });
  };
  const appendAudit = ({ key, previousValue, nextValue, detail, section = view }) => {
    if (tutorialOpen || !hasMeaningfulChange(previousValue, nextValue)) return;
    setDatos((previous) => {
      const current = previous[currentUserId];
      if (!current) return previous;
      const event = createAuditEvent({
        key,
        previousValue,
        nextValue,
        identity: identidad,
        tenantId: currentUserId,
        view: section,
        deviceId: loadCloudConfig().deviceId,
        detail,
      });
      return { ...previous, [currentUserId]: { ...current, auditoria: [...(current.auditoria || []), event] } };
    });
  };
  const updateCurrentAccount = (patch) => {
    if (tutorialOpen) {
      setTutorialAccounts((previous) => (previous || cloneForTutorial(cuentas)).map((item) => item.id === currentUserId ? { ...item, ...patch } : item));
      return;
    }
    const previousAccount = cuentas.find((item) => item.id === currentUserId);
    const nextAccount = previousAccount ? { ...previousAccount, ...patch } : patch;
    setCuentas((previous) => previous.map((item) => item.id === currentUserId ? nextAccount : item));
    appendAudit({
      key: "negocio",
      previousValue: previousAccount,
      nextValue: nextAccount,
      detail: describeAccountChange(patch, previousAccount),
      section: "configuracion",
    });
  };
  const updateCurrentPreferences = (value) => {
    if (tutorialOpen) {
      setTutorialPreferences(value);
      return;
    }
    setUserPreferences((previous) => ({ ...previous, [preferenceKey]: value }));
    if (JSON.stringify(value.tutorialsCompleted || []) !== JSON.stringify(savedPreferences.tutorialsCompleted || [])) {
      saveTutorialProgress(value.tutorialsCompleted || []);
    }
    appendAudit({
      key: "preferencias",
      previousValue: savedPreferences,
      nextValue: value,
      detail: "Preferencias de la aplicación modificadas",
      section: "configuracion",
    });
  };
  const updateAllBusinessData = (updater) => {
    if (!tutorialOpen) {
      setDatos(updater);
      return;
    }
    setTutorialData((previous) => {
      const currentDataset = previous || createTutorialDataset(storedData);
      const all = { ...datos, [currentUserId]: currentDataset };
      const nextAll = typeof updater === "function" ? updater(all) : updater;
      return nextAll?.[currentUserId] || currentDataset;
    });
  };

  const setProducts = makeSetter("products");
  const setCaja = makeSetter("caja");
  const setTickets = makeSetter("tickets");
  const setClientes = makeSetter("clientes");
  const setComprasItems = makeSetter("comprasItems");
  const setProveedores = makeSetter("proveedores");
  const setPerdidas = makeSetter("perdidas");
  const setSugerencias = makeSetter("sugerencias");
  const setPedidos = makeSetter("pedidos");
  const setGastos = makeSetter("gastos");
  const setVentasSuspendidas = makeSetter("ventasSuspendidas");
  const setInventarios = makeSetter("inventarios");
  const setCajaAbierta = makeSetter("cajaAbierta");
  const setCart = makeSetter("cart");
  const setTareas = makeSetter("tareas");
  const setMetas = makeSetter("metas");
  const setPromociones = makeSetter("promociones");
  const setReservas = makeSetter("reservas");
  const setPresupuestos = makeSetter("presupuestos");
  const setArqueos = makeSetter("arqueos");
  const setConfiguracionFiscal = makeSetter("configuracionFiscal");
  const setComprobantes = makeSetter("comprobantes");
  const setListaCompras = makeSetter("listaCompras");
  const setRetornables = makeSetter("retornables");
  const setCambioCaja = makeSetter("cambioCaja");
  const setAutoconsumos = makeSetter("autoconsumos");
  const setTurnos = makeSetter("turnos");
  const setRecordatoriosProveedor = makeSetter("recordatoriosProveedor");
  const setMovimientosStock = makeSetter("movimientosStock");
  const setLabelTemplates = makeSetter("labelTemplates");

  const resolveScannedCode = (rawCode) => {
    const code = String(rawCode || "").trim();
    const ticketId = parseTicketBarcode(code);
    if (ticketId != null) {
      const ticket = (data?.tickets || []).find((item) => String(item.id) === String(ticketId));
      return ticket ? { type: "ticket", ticket, code } : { type: "unknown", code };
    }
    const product = (data?.products || []).find((item) => String(item.codigo || "").trim() === code);
    return product ? { type: "product", product, code } : { type: "unknown", code };
  };

  const addScannedProductToSale = (product) => {
    if (!product || Number(product.vitrina || 0) <= 0) return false;
    const info = unidadInfo(product.unidad);
    const available = Number(product.vitrina || 0) * info.factor;
    const step = info.factor === 1 ? 1 : 100;
    setCart((previous = []) => {
      const existing = previous.find((item) => item.productId === product.id);
      if (!existing) return [...previous, { productId: product.id, cantidad: Math.min(step, available) }];
      if (Number(existing.cantidad || 0) + step > available) return previous;
      return previous.map((item) => item.productId === product.id ? { ...item, cantidad: Number(item.cantidad || 0) + step } : item);
    });
    setView("ventas");
    return true;
  };

  const handleGlobalCode = (rawCode, scanResolution = null) => {
    if (scanResolution?.catalogProduct) {
      setPendingStockProduct({ ...scanResolution.catalogProduct, codigo: String(rawCode).trim(), _resumeScanner: true });
      setGlobalScanOpen(false);
      setView("stock");
      return false;
    }
    const result = resolveScannedCode(rawCode);
    if (result.type === "product" && view === "ventas") {
      return addScannedProductToSale(result.product);
    }
    setGlobalScanResult(result);
    setGlobalScanOpen(false);
    return false;
  };

  const voidScannedTicket = (ticket) => {
    if (!ticket || ticket.estado === "anulado") return;
    setVoidTicketPrompt({ ticket, reason: "" });
  };

  const submitPendingVerification = async (code) => {
    const config = loadCloudConfig();
    const session = cloudSession();
    if (!config.enabled || !config.apiUrl || !config.deviceId) {
      return { ok: false, message: "No hay servidor conectado para registrar la verificación." };
    }
    try {
      const response = await cloudFetch(config.apiUrl, "/v1/catalog/verify-pending", {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": config.deviceId, "x-tenant-id": String(session?.user?.businessId || currentUserId) },
        body: JSON.stringify({ codigo: String(code || "").replace(/\D/g, "") }),
      });
      if (response.ok) return { ok: true, message: "Se envió a verificación. El administrador de Kiosco+ lo revisará." };
      return { ok: false, message: "No se pudo enviar. Revisá la conexión con el servidor." };
    } catch {
      return { ok: false, message: "No se pudo enviar. Revisá la conexión con el servidor." };
    }
  };

  const confirmVoidScannedTicket = () => {
    const ticket = voidTicketPrompt.ticket;
    const motivo = voidTicketPrompt.reason.trim();
    if (!ticket || !motivo) return;
    const fecha = new Date();
    const responsable = identidad?.nombre || identidad?.rol || "Sin identificar";
    setTickets((previous = []) => previous.map((item) => item.id === ticket.id ? anularTicket(item, motivo.trim(), responsable, fecha.toISOString()) : item));
    setProducts((previous = []) => restaurarStock(previous, ticket));
    if (ticket.medio === "Cuenta corriente" && ticket.clienteId) {
      setClientes((previous = []) => previous.map((cliente) => cliente.id === ticket.clienteId ? {
        ...cliente,
        saldo: Number(cliente.saldo || 0) - Number(ticket.total || 0),
        movimientos: [...(cliente.movimientos || []), { id: Date.now(), tipo: "anulacion", monto: Number(ticket.total || 0), nota: `Anulación ticket #${ticket.id}: ${motivo.trim()}`, fecha: fecha.toLocaleString("es-AR") }],
      } : cliente));
    }
    const cashAmount = ticket.medio === "Efectivo" ? Number(ticket.total || 0) : Number(ticket.pagos?.find((payment) => payment.metodo === "Efectivo")?.monto || 0);
    if (cashAmount > 0) {
      setCaja((previous) => ({
        ...previous,
        saldo: Number(previous.saldo || 0) - cashAmount,
        movimientos: [...(previous.movimientos || []), { id: Date.now(), tipo: "retiro", monto: cashAmount, nota: `Devolución ticket #${ticket.id}`, fecha: fecha.toLocaleString("es-AR") }],
      }));
    }
    setGlobalScanResult((current) => current?.ticket?.id === ticket.id ? { ...current, ticket: anularTicket(ticket, motivo.trim(), responsable, fecha.toISOString()) } : current);
    setVoidTicketPrompt({ ticket: null, reason: "" });
  };

  useEffect(() => {
    if (!data) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (editable || event.ctrlKey || event.altKey || event.metaKey) return;
      const now = performance.now();
      if (event.key === "Enter") {
        const value = scannerBufferRef.current;
        const elapsed = now - scannerLastKeyRef.current;
        scannerBufferRef.current = "";
        if (value.length >= 4 && elapsed < 120) {
          event.preventDefault();
          handleGlobalCode(value);
        }
        return;
      }
      if (event.key.length !== 1) return;
      if (now - scannerLastKeyRef.current > 90) scannerBufferRef.current = "";
      scannerBufferRef.current += event.key;
      scannerLastKeyRef.current = now;
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [data, view]);

  const connectLocalCloud = ({ businessId, username, password, name, superAdmin = false }) => {
    const cloudConfig = loadCloudConfig();
    repository.setContext({ tenantId: String(businessId), isSystemAdmin: superAdmin });
    ensureLocalCloudSession(cloudConfig.apiUrl, {
      businessId: String(businessId),
      username,
      password,
      name,
      superAdmin,
      deviceId: cloudConfig.deviceId,
    }).then(() => { if (!PUBLIC_DEMO_MODE) repository.seedCurrentTenant(); }).catch(() => {});
  };

  const handleLogin = async ({ usuario, password }) => {
    const normalizedUser = String(usuario || "").trim();
    const normalizedPassword = String(password || "").trim();
    const guard = loginGuard(authSecurity, normalizedUser);
    if (guard.blocked) { setLoginError(`Acceso bloqueado temporalmente. Probá nuevamente en ${Math.ceil(guard.remainingMs / 60000)} minuto(s).`); return; }
    const cuentaCandidate = cuentas.find((c) => String(c.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase());
    const cuenta = cuentaCandidate && await verifyPassword(normalizedPassword, cuentaCandidate) ? cuentaCandidate : null;
    if (cuenta) {
      if (!cuenta.superAdmin && !canAccessAccount(cuenta)) {
        setLoginError(accountAccessMessage(cuenta));
        return;
      }
      setLoginError("");
      setView("home");
      setCurrentUserId(cuenta.id);
      const identity = { usuarioId: `cuenta:${cuenta.id}`, tenantId: String(cuenta.id), rol: cuenta.superAdmin ? "Administrador de la app" : "Dueño", nombre: cuenta.nombre, superAdmin: !!cuenta.superAdmin, adminId: cuenta.superAdmin ? cuenta.id : null };
      setIdentidad(identity);
      connectLocalCloud({ businessId: cuenta.id, username: normalizedUser, password: normalizedPassword, name: cuenta.nombre, superAdmin: !!cuenta.superAdmin });
      const session = createSession(cuenta.id, identity);
      const trial = trialAccessStatus(cuenta);
      setSessionExpiresAt(trial.active && new Date(trial.expiresAt) < new Date(session.expiresAt) ? trial.expiresAt : session.expiresAt);
      setAuthSecurity((prev) => clearLoginFailures(prev, normalizedUser));
      setDatos((prev) => ({ ...prev, [cuenta.id]: { ...prev[cuenta.id], auditoria: [...(prev[cuenta.id]?.auditoria || []), { id: Date.now(), fecha: new Date().toISOString(), tenantId: String(cuenta.id), usuario: cuenta.nombre, usuarioId: identity.usuarioId, rol: identity.rol, origen: cuenta.superAdmin ? "administracion_app" : "dueno", seccion: "seguridad", accion: "inicio_sesion", detalle: "Inicio de sesión", resultado: "exitoso" }] } }));
      return;
    }

    // Buscar entre empleados de todos los negocios.
    for (const negocio of cuentas) {
      const candidate = (negocio.empleados || []).find((e) => String(e.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase());
      const empleado = candidate && await verifyPassword(normalizedPassword, candidate) ? candidate : null;
      if (empleado) {
        if (!canAccessAccount(negocio)) {
          setLoginError(accountAccessMessage(negocio));
          return;
        }
        setLoginError("");
        setView("home");
        setCurrentUserId(negocio.id);
        const identity = { usuarioId: `empleado:${empleado.id}`, tenantId: String(negocio.id), rol: empleado.rol, nombre: empleado.nombre, superAdmin: false };
        setIdentidad(identity);
        connectLocalCloud({ businessId: negocio.id, username: normalizedUser, password: normalizedPassword, name: empleado.nombre });
        const session = createSession(negocio.id, identity);
        const trial = trialAccessStatus(negocio);
        setSessionExpiresAt(trial.active && new Date(trial.expiresAt) < new Date(session.expiresAt) ? trial.expiresAt : session.expiresAt);
        setAuthSecurity((prev) => clearLoginFailures(prev, normalizedUser));
        return;
      }
    }

    setAuthSecurity((prev) => registerLoginFailure(prev, normalizedUser));
    setLoginError("Usuario o contraseña incorrectos.");
  };

  const handleRegister = async ({ nombre, usuario, password, nombreNegocio, modoNegocio = "solo" }) => {
    const normalizedUser = String(usuario || "").trim();
    const normalizedPassword = String(password || "").trim();
    if (cuentas.some((c) => String(c.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase())) {
      setLoginError("Ese usuario ya existe, elegí otro.");
      return;
    }
    const id = Date.now();
    const secured = grantTrialAccess(await secureSubject({
        id,
        tenantId: String(id),
        nombre,
        usuario: normalizedUser,
        password: normalizedPassword,
        nombreNegocio,
        modoNegocio,
        superAdmin: false,
        estado: "pendiente",
        roles: rolesPorDefecto(),
        empleados: [],
      }), 1);
    setCuentas((prev) => [
      ...prev,
      secured,
    ]);
    setDatos((prev) => ({ ...prev, [id]: { ...defaultDataset(false), tenantId: String(id) } }));
    const identity = { usuarioId: `cuenta:${id}`, tenantId: String(id), rol: "Dueño", nombre, superAdmin: false, trial: true };
    setLoginError("");
    setCurrentUserId(id);
    setIdentidad(identity);
    setView("home");
    connectLocalCloud({ businessId: id, username: normalizedUser, password: normalizedPassword, name: nombre });
    const session = createSession(id, identity);
    setSessionExpiresAt(new Date(secured.trialExpiresAt) < new Date(session.expiresAt) ? secured.trialExpiresAt : session.expiresAt);
  };

  const handleLogout = () => {
    if (PUBLIC_DEMO_MODE) {
      setDatos((previous) => ({ ...previous, 2: seedDatos()[2] }));
      setCurrentUserId(2);
      setIdentidad(PUBLIC_DEMO_IDENTITY);
      setSessionExpiresAt(null);
      setView("home");
      return;
    }
    const cloudConfig = loadCloudConfig();
    logoutCloud(cloudConfig.apiUrl).catch(() => {});
    setCurrentUserId(null);
    setIdentidad(null);
    setSessionExpiresAt(null);
    setView("home");
  };

  const handleReset = async () => {
    await Promise.allSettled([
      repository.delete("cuentas"), repository.delete("datos"), repository.delete("sesion"), repository.delete("identidad"), repository.delete("notasAdmin"), repository.delete("authSecurity"), repository.delete("reportesProblemas"), repository.delete("menuPreferences"), repository.delete("userPreferences"),
    ]);
    setCuentas(await secureAccounts(seedCuentas()));
    setDatos(seedDatos());
    setCurrentUserId(null);
    setIdentidad(null);
    setNotasAdmin([]);
    setAuthSecurity({});
    setSessionExpiresAt(null);
    setReportesProblemas([]);
    setMenuPreferences({});
    setUserPreferences({});
  };

  if (cargando) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50 text-sm text-gray-400">
        <img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[240px] object-contain"/>
        <span>Cargando...</span>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <LoginView
        onLogin={handleLogin}
        onRegister={handleRegister}
        error={loginError}
        onReset={handleReset}
      />
    );
  }

  if (cuentaActual?.superAdmin && identidad?.superAdmin && !identidad?.operandoNegocio) {
    return (
      <>
      <AdminAppPanel
        cuentas={cuentas}
        setCuentas={setCuentas}
        datos={datos}
        setDatos={setDatos}
        notas={notasAdmin}
        setNotas={setNotasAdmin}
        reportes={reportesProblemas}
        setReportes={setReportesProblemas}
        onOpenNegocio={(id) => {
          const negocio = cuentas.find((item) => item.id === id);
          if (!negocio || !canAccessAccount(negocio)) return;
          setCurrentUserId(id);
          setIdentidad((prev) => ({ ...prev, tenantId: String(id), operandoNegocio: true, adminApp: true, superAdmin: false, rol: "Administrador de la app" }));
          setView("home");
        }}
        onLogout={handleLogout}
        onOpenSettings={() => setSettingsOpen(true)}
        syncStatus={syncStatus}
        onSyncNow={() => repository.syncNow()}
      />
      {settingsOpen && <SettingsModal preferences={currentPreferences} cuenta={cuentaActual} tenantId={currentUserId} onChange={updateCurrentPreferences} onUpdateAccount={updateCurrentAccount} canEditBusiness onCleanOperationalHistory={cleanOperationalHistory} onExportCommercialArchive={exportCurrentCommercialArchive} archiveStats={{count:data?.comprobantes?.length||0}} onClose={() => setSettingsOpen(false)}/>}
      </>
    );
  }

  if (!data) {
    return <div className="h-screen flex items-center justify-center text-sm text-gray-500">No se encontraron datos para esta cuenta.</div>;
  }

  const permisos = PUBLIC_DEMO_MODE ? permisosDe(identidad, cuentaActual).filter((p) => p !== "catalogo") : permisosDe(identidad, cuentaActual);
  const esDueno = identidad?.rol === "Dueño" || !!(identidad?.adminApp && identidad?.operandoNegocio);
  const puede = (permiso) => esDueno || permisos.includes(permiso);

  const renderView = () => {
    if (view !== "home" && !permisos.includes(view)) {
      return <Home onNavigate={handleNavigate} cuenta={cuentaActual} identidad={identidad} data={data} onReportProblem={abrirReporteProblema} />;
    }
    switch (view) {
      case "notificaciones":
        return <NotificacionesView data={data} onNavigate={handleNavigate} />;
      case "catalogo":
        return (
          <CatalogoView
            products={data.products}
            setProducts={setProducts}
            tenantId={String(currentUserId)}
            setSugerencias={setSugerencias}
            identidad={identidad}
            preferences={currentPreferences}
          />
        );
      case "stock":
        return <StockArea products={data.products} setProducts={setProducts} proveedores={data.proveedores || []} puedeEditarPrecios={puede("editar_precios")} puedeEliminar={puede("eliminar_productos")} puedeCrearDirecto={esDueno} sugerencias={data.sugerencias || []} setSugerencias={setSugerencias} identidad={identidad} perdidas={data.perdidas || []} setPerdidas={setPerdidas} inventarios={data.inventarios || []} setInventarios={setInventarios} preferences={currentPreferences} autoconsumos={data.autoconsumos || []} setAutoconsumos={setAutoconsumos} tutorialMode={stockTutorialActive} initialProduct={pendingStockProduct} onInitialProductHandled={() => setPendingStockProduct(null)} />;
      case "vitrina":
        return <VitrinaView products={data.products} setProducts={setProducts} movimientosStock={data.movimientosStock || []} setMovimientosStock={setMovimientosStock} identidad={identidad} />;
      case "ventas":
        return (
          <VentasView
            products={ventasTutorialActive ? [TUTORIAL_PRODUCT, ...data.products] : data.products}
            setProducts={ventasTutorialActive ? () => {} : setProducts}
            caja={data.caja}
            setCaja={ventasTutorialActive ? () => {} : setCaja}
            setTickets={ventasTutorialActive ? () => {} : setTickets}
            tickets={data.tickets}
            cajaAbierta={ventasTutorialActive ? true : data.cajaAbierta}
            setCajaAbierta={ventasTutorialActive ? () => {} : setCajaAbierta}
            clientes={data.clientes}
            setClientes={ventasTutorialActive ? () => {} : setClientes}
            cart={ventasTutorialActive ? tutorialCart : data.cart}
            setCart={ventasTutorialActive ? setTutorialCart : setCart}
            identidad={identidad}
            ventasSuspendidas={data.ventasSuspendidas || []}
            setVentasSuspendidas={ventasTutorialActive ? () => {} : setVentasSuspendidas}
            promociones={data.promociones || []}
            puedeAplicarDescuentos={puede("aplicar_descuentos")}
            preferences={currentPreferences}
            ticketConfig={data.configuracionFiscal || {}}
            businessName={cuentaActual?.nombreNegocio || "Mi negocio"}
            supportData={{ reservas: data.reservas || [], presupuestos: data.presupuestos || [], cambioCaja: data.cambioCaja || {}, turnos: data.turnos || [], gastos: data.gastos || [] }}
            supportSetters={{ setReservas, setPresupuestos, setCambioCaja, setTurnos }}
            staffOptions={[cuentaActual?.nombre, ...(hasEmployees ? (cuentaActual?.empleados || []).filter((empleado) => empleado.estado !== "bloqueado").map((empleado) => empleado.nombre) : [])].filter(Boolean)}
            hasEmployees={hasEmployees}
            tutorialMode={ventasTutorialActive}
          />
        );
      case "compras":
        return (
          <ComprasArea
            products={comprasTutorialActive ? tutorialPurchaseProducts : data.products}
            setProducts={comprasTutorialActive ? setTutorialPurchaseProducts : setProducts}
            comprasItems={comprasTutorialActive ? tutorialPurchaseItems : data.comprasItems}
            setComprasItems={comprasTutorialActive ? setTutorialPurchaseItems : setComprasItems}
            proveedores={comprasTutorialActive ? [TUTORIAL_PURCHASE_SUPPLIER] : (data.proveedores || [])}
            setProveedores={comprasTutorialActive ? () => {} : setProveedores}
            pedidos={comprasTutorialActive ? tutorialPurchaseOrders : (data.pedidos || [])}
            setPedidos={comprasTutorialActive ? setTutorialPurchaseOrders : setPedidos}
            tickets={comprasTutorialActive ? [] : (data.tickets || [])}
            listaCompras={data.listaCompras || []}
            setListaCompras={setListaCompras}
            recordatoriosProveedor={data.recordatoriosProveedor || []}
            setRecordatoriosProveedor={setRecordatoriosProveedor}
            tutorialMode={comprasTutorialActive}
            businessName={cuentaActual?.nombreNegocio || "Kiosco+"}
          />
        );
      case "gastos":
        return <GastosView gastos={data.gastos || []} setGastos={setGastos} caja={data.caja} setCaja={setCaja} />;
      case "clientes":
        return (
          <ClientesView
            clientes={data.clientes}
            setClientes={setClientes}
            tickets={data.tickets}
            setTickets={setTickets}
            setCaja={setCaja}
            retornables={data.retornables || []}
            setRetornables={setRetornables}
          />
        );
      case "reportes":
        return (
          <ReportesView
            tickets={data.tickets}
            products={data.products}
            setTickets={setTickets}
            setCaja={setCaja}
            setProducts={setProducts}
            clientes={data.clientes}
            setClientes={setClientes}
            identidad={identidad}
            puedeEliminarTickets={puede("eliminar_tickets")}
            perdidas={data.perdidas || []}
            gastos={data.gastos || []}
            preferences={currentPreferences}
            ticketConfig={data.configuracionFiscal || {}}
            businessName={cuentaActual?.nombreNegocio || "Mi negocio"}
            hasEmployees={hasEmployees}
          />
        );
      case "gestion":
        return <GestionView data={data} identidad={identidad} preferences={currentPreferences} hasEmployees={hasEmployees} setters={{ setTareas, setMetas, setPromociones, setReservas, setPresupuestos, setArqueos, setConfiguracionFiscal, setComprobantes, setListaCompras, setRetornables, setCambioCaja, setAutoconsumos, setTurnos, setRecordatoriosProveedor, setProducts, setLabelTemplates, devolverTicket: (ticket) => {
          setProducts((prev) => prev.map((product) => { const item = ticket.items?.find((line) => line.productId === product.id); if (!item) return product; const factor = product.unidad === "unidad" ? 1 : 1000; return { ...product, vitrina: Number(product.vitrina || 0) + Number(item.cantidad || 0) / factor }; }));
          setTickets((prev) => prev.map((item) => item.id === ticket.id ? { ...item, devuelto: true, devolucionFecha: new Date().toISOString(), devolucionPor: identidad?.nombre } : item));
          const efectivoDevuelto = ticket.medio === "Efectivo" ? Number(ticket.total || 0) : Number(ticket.pagos?.find((pago) => pago.metodo === "Efectivo")?.monto || 0);
          if (efectivoDevuelto > 0) setCaja((prev) => ({ ...prev, saldo: Number(prev.saldo || 0) - efectivoDevuelto, movimientos: [{ id: Date.now(), tipo: "egreso", monto: efectivoDevuelto, nota: `Devolución ticket #${ticket.id}`, fecha: new Date().toLocaleString("es-AR") }, ...(prev.movimientos || [])] }));
        } }} />;
      case "administracion":
        return (
          <AdministracionView
            cuenta={cuentaActual}
            cuentas={activeAccounts}
            setCuentas={tutorialOpen ? setTutorialAccounts : setCuentas}
            datos={activeAllBusinessData}
            setDatos={updateAllBusinessData}
            identidad={identidad}
            sugerencias={data.sugerencias || []}
            setSugerencias={setSugerencias}
            setProducts={setProducts}
            hasEmployees={hasEmployees}
            onOpenNegocio={(id) => {
              setCurrentUserId(id);
              setView("home");
            }}
          />
        );
      default:
        return <Home onNavigate={handleNavigate} cuenta={cuentaActual} identidad={identidad} data={data} onReportProblem={abrirReporteProblema} />;
    }
  };

  const handleNavigate = (id) => {
    if (id === "proveedores") id = "compras";
    if (id === "vencimientos") id = "stock";
    if (id === "home" || permisos.includes(id)) setView(id);
  };

  return (
    <div className="kiosco-themed flex h-screen w-full bg-gray-50 font-sans text-gray-900 overflow-hidden">
      <Sidebar
        current={view}
        onNavigate={handleNavigate}
        cuenta={cuentaActual}
        identidad={identidad}
        permisos={permisos}
        onLogout={handleLogout}
        products={data.products}
        data={data}
        menuOrder={menuPreferences[identidad?.usuarioId || `cuenta:${currentUserId}`] || []}
        onMenuOrderChange={(order) => setMenuPreferences((prev) => ({ ...prev, [identidad?.usuarioId || `cuenta:${currentUserId}`]: order }))}
        onOpenSettings={() => setSettingsOpen(true)}
        onReportProblem={() => abrirReporteProblema()}
        onGlobalScan={() => setGlobalScanOpen(true)}
        onHelp={() => { autoTutorialRef.current = false; setTutorialPrompt(null); setTutorialCatalog(true); setTutorialOpen(true); }}
        syncStatus={syncStatus}
        onSyncNow={() => repository.syncNow()}
        onReturnAdmin={identidad?.operandoNegocio ? () => {
          setCurrentUserId(identidad.adminId || 1);
          setIdentidad((prev) => ({ ...prev, tenantId: String(prev.adminId || 1), operandoNegocio: false, adminApp: true, superAdmin: true, rol: "Administrador de la app" }));
          setView("home");
        } : null}
        demoMode={PUBLIC_DEMO_MODE}
      />
      <div className="app-content flex-1 overflow-y-auto bg-white">
        <ViewErrorBoundary view={view} onRecover={() => setView("home")} onReport={abrirReporteProblema}>
          <div key={view} className="view-stage">{renderView()}</div>
        </ViewErrorBoundary>
      </div>
      {settingsOpen && <SettingsModal preferences={currentPreferences} cuenta={cuentaActual} tenantId={currentUserId} onChange={updateCurrentPreferences} onUpdateAccount={updateCurrentAccount} canEditBusiness={esDueno} onCleanOperationalHistory={cleanOperationalHistory} onExportCommercialArchive={exportCurrentCommercialArchive} archiveStats={{count:data?.comprobantes?.length||0}} onClose={() => setSettingsOpen(false)}/>} 
      {PUBLIC_DEMO_MODE && tutorialPrompt && <DemoTutorialPrompt view={tutorialPrompt.view} declined={tutorialPrompt.declined} onStart={startDemoTutorial} onDecline={declineDemoTutorial} onClose={() => setTutorialPrompt(null)}/>} 
      {PUBLIC_DEMO_MODE && helpSpotlightOpen && <HelpButtonSpotlight onClose={() => setHelpSpotlightOpen(false)}/>} 
      <TutorialOverlay open={tutorialOpen} view={view} hasEmployees={hasEmployees} showCatalog={tutorialCatalog} onClose={() => { autoTutorialRef.current = false; setTutorialOpen(false); }} onComplete={completeTutorial}/>
      {bugReportOpen && <ReportarProblemaModal initialCapture={bugReportDraft.captura} errorContext={bugReportDraft.detalleTecnico} onCapture={captureAppScreenshot} canSystemCapture={Boolean(window.kioscoDesktop?.captureScreenshot)} onClose={() => { setBugReportOpen(false); setBugReportDraft({ captura: null, detalleTecnico: "", vista: null }); }} onSubmit={(payload) => { reportarProblema({ ...payload, vista: bugReportDraft.vista }); setBugReportOpen(false); setBugReportDraft({ captura: null, detalleTecnico: "", vista: null }); }}/>} 
      {globalScanOpen && <ScanModal
        continuous
        initialMode={window.matchMedia?.("(max-width: 767px)")?.matches ? "camera" : "manual"}
        products={data.products || []}
        preferences={currentPreferences}
        confirmationTitle="Confirmar código"
        confirmLabel="Procesar"
        allowAnyCode
        resolveCode={async (code) => {
          const result = resolveScannedCode(code);
          if (result.type === "ticket") return { kind: "ticket", displayName: `Ticket #${result.ticket.id}` };
          if (result.type === "product") return { kind: "product", displayName: result.product.nombre, product: result.product };
          const catalogProduct = await lookupBarcode(code);
          return catalogProduct
            ? { kind: "catalog", displayName: catalogProduct.nombre, catalogProduct }
            : { kind: "unknown", displayName: "Código no reconocido" };
        }}
        onClose={() => setGlobalScanOpen(false)}
        onDetected={handleGlobalCode}
      />}
      <GlobalScanResult
        result={globalScanResult}
        onClose={() => setGlobalScanResult(null)}
        onSale={() => { addScannedProductToSale(globalScanResult?.product); setGlobalScanResult(null); }}
        onStock={() => { setView("stock"); setGlobalScanResult(null); }}
        onPrint={() => printTicket(globalScanResult.ticket, { businessName: cuentaActual?.nombreNegocio || "Mi negocio", paper: currentPreferences.ticketPaper, template: data.configuracionFiscal?.ticket || {}, reprint: true })}
        onVoid={() => voidScannedTicket(globalScanResult?.ticket)}
        onVerifyPending={submitPendingVerification}
      />
      <PromptDialog open={Boolean(voidTicketPrompt.ticket)} title="Anular o devolver ticket" message={`Indicá el motivo para el ticket #${voidTicketPrompt.ticket?.id || ""}. Quedará registrado en el historial.`} value={voidTicketPrompt.reason} onChange={(reason)=>setVoidTicketPrompt((current)=>({...current,reason}))} placeholder="Ej.: devolución del cliente" confirmLabel="Confirmar anulación" onCancel={()=>setVoidTicketPrompt({ticket:null,reason:""})} onConfirm={confirmVoidScannedTicket}/>
    </div>
  );
}
