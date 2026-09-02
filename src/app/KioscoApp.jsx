import React, { useEffect, useRef, useState } from "react";
import { repository } from "../cloud/repository";
import { loadCloudConfig } from "../cloud/config";
import { ensureLocalCloudSession, loginCloud, logoutCloud, pairCloudDevice, registerCloudAccount } from "../cloud/cloudAuth";
import { clearLoginFailures, createSession, loginGuard, registerLoginFailure, secureAccounts, secureSubject, validSession, verifyPassword } from "../security/auth";
import { accountAccessMessage, canAccessAccount, formatAccessExpiration, trialAccessStatus } from "../security/trialAccess";
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
import { ActivationView } from "../features/autenticacion/ActivationView";
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
import { cleanOperationalDataset, exportCommercialArchive } from "../shared/archive";
import { PromptDialog } from "../shared/controls";
import { activateAdministratorInstallation, clearInstallationReceipt, loadInstallationReceipt, markLegacyInstallation, redeemInstallationCode, saveInstallationReceipt, verifyInstallationActivation } from "../security/installationActivation";
import { defaultDataset, migrarCuentasDemo, migrarDatosDemo, permisosDe, seedCuentas, seedDatos } from "./data";

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
  const [activationStatus, setActivationStatus] = useState("checking");
  const [activationDeviceId, setActivationDeviceId] = useState("");
  const [activationAppVersion, setActivationAppVersion] = useState("");
  const [cuentas, setCuentas] = useState(() => PUBLIC_DEMO_MODE ? seedCuentas() : []);
  const [datos, setDatos] = useState(() => PUBLIC_DEMO_MODE ? seedDatos() : {});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [identidad, setIdentidad] = useState(null); // { rol, nombre }
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [notasAdmin, setNotasAdmin] = useState([]);
  const [authSecurity, setAuthSecurity] = useState({});
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [reportesProblemas, setReportesProblemas] = useState([]);
  const [menuPreferences, setMenuPreferences] = useState({});
  const [userPreferences, setUserPreferences] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readOnlyNotice, setReadOnlyNotice] = useState(false);
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

  useEffect(() => {
    const updates = window.kioscoDesktop?.updates;
    if (!updates) return undefined;
    const applySavedUpdatePolicy = () => {
      const config = loadCloudConfig();
      updates.configure({
        channel: config.updateChannel,
        autoCheck: config.autoCheckUpdates,
      }).catch(() => {});
    };
    applySavedUpdatePolicy();
    window.addEventListener("kiosco-cloud-config-changed", applySavedUpdatePolicy);
    return () => window.removeEventListener("kiosco-cloud-config-changed", applySavedUpdatePolicy);
  }, []);

  // Cargar todo lo guardado al abrir la app.
  useEffect(() => {
    let activo = true;
    (async () => {
      await repository.initialize();
      const [cuentasGuardadas, datosGuardados, sesion, notas, security, reportes, menuPrefs, userPrefs] = await Promise.all([
        repository.get("cuentas", []), repository.get("datos", {}), repository.get("sesion", null), repository.get("notasAdmin", []), repository.get("authSecurity", {}), repository.get("reportesProblemas", []), repository.get("menuPreferences", {}), repository.get("userPreferences", {}),
      ]);
      if (!activo) return;
      let accountsToLoad = Array.isArray(cuentasGuardadas) ? cuentasGuardadas : [];
      if (!PUBLIC_DEMO_MODE) {
        const cleanedAccounts = [];
        for (const account of accountsToLoad) {
          const isBundledBusiness = (
            (String(account?.id) === "2" && String(account?.usuario || "").toLowerCase() === "sur" && /demo/i.test(String(account?.nombreNegocio || "")))
            || (String(account?.id) === "3" && String(account?.usuario || "").toLowerCase() === "pruebas" && /negocio de pruebas/i.test(String(account?.nombreNegocio || "")))
          );
          let isBundledAdmin = false;
          if (String(account?.id) === "1" && String(account?.usuario || "").toLowerCase() === "demo") {
            try { isBundledAdmin = await verifyPassword("1234", account); } catch {}
          }
          if (!isBundledBusiness && !isBundledAdmin) cleanedAccounts.push(account);
        }
        accountsToLoad = cleanedAccounts;
      }
      let requiresActivation = false;
      let runtime = null;
      if (!PUBLIC_DEMO_MODE && window.kioscoDesktop?.runtime?.get) {
        try { runtime = await window.kioscoDesktop.runtime.get(); } catch {}
      }
      if (runtime?.requiresActivation) {
        const config = loadCloudConfig();
        const receipt = loadInstallationReceipt();
        const hasExistingInstallation = Boolean(
          (validSession(sesion) && accountsToLoad.some((account) => String(account.id) === String(sesion.accountId)))
          || accountsToLoad.length
          || (datosGuardados && Object.keys(datosGuardados).some((id) => !["1", "2", "3"].includes(String(id)))),
        );
        setActivationDeviceId(config.deviceId);
        setActivationAppVersion(runtime.version || "");
        if (receipt?.activated && receipt.deviceId === config.deviceId) {
          if (receipt.mode === "legacy" && !hasExistingInstallation) {
            clearInstallationReceipt();
            requiresActivation = true;
          } else if (["code", "administrator"].includes(receipt.mode)) {
            try {
              const verified = await verifyInstallationActivation(config.apiUrl, config.deviceId, runtime.version);
              if (!verified.activated) {
                clearInstallationReceipt();
                requiresActivation = true;
              }
            } catch {
              // Una caída temporal de Internet no bloquea una PC que ya fue
              // activada correctamente. Se volverá a comprobar al abrirla.
            }
          }
        } else {
          let knownByCloud = false;
          try {
            const verified = await verifyInstallationActivation(config.apiUrl, config.deviceId, runtime.version);
            knownByCloud = Boolean(verified.activated);
            if (knownByCloud) saveInstallationReceipt({ activated: true, mode: "code", deviceId: config.deviceId, activationId: verified.activation?.id || null, activatedAt: verified.activation?.activatedAt || new Date().toISOString() });
          } catch {}
          if (!knownByCloud && hasExistingInstallation) markLegacyInstallation(config.deviceId);
          else if (!knownByCloud) requiresActivation = true;
        }
      }
      let loadedAccounts;
      try { loadedAccounts = await secureAccounts(migrarCuentasDemo(accountsToLoad, { includeSeeds: PUBLIC_DEMO_MODE })); } catch { loadedAccounts = PUBLIC_DEMO_MODE ? await secureAccounts(seedCuentas()) : []; }
      setCuentas(loadedAccounts);
      if (datosGuardados) {
        try {
          const guardados = { ...datosGuardados };
          if (PUBLIC_DEMO_MODE) {
            const demoActual = seedDatos()[2];
            if ((guardados?.[2]?.demoSeedVersion || 0) < demoActual.demoSeedVersion) guardados[2] = demoActual;
          } else {
            for (const id of ["1", "2", "3"]) {
              if (!loadedAccounts.some((account) => String(account.id) === id)) delete guardados[id];
            }
          }
          setDatos(migrarDatosDemo(guardados, { includeSeeds: PUBLIC_DEMO_MODE }));
        } catch {}
      }
      if (PUBLIC_DEMO_MODE) {
        setCurrentUserId(2);
        setIdentidad(PUBLIC_DEMO_IDENTITY);
        setSessionExpiresAt(null);
      } else {
        const sessionAccount = loadedAccounts.find((account) => String(account.id) === String(sesion?.accountId));
        if (validSession(sesion) && sessionAccount && (sesion.identity?.superAdmin || sesion.identity?.adminApp || canAccessAccount(sessionAccount))) {
          setCurrentUserId(sessionAccount.id);
          setIdentidad(sesion.identity);
          setSessionExpiresAt(sesion.expiresAt);
        } else await repository.delete("sesion");
      }
      setNotasAdmin(notas || []);
      setAuthSecurity(security || {});
      setReportesProblemas(reportes || []);
      setMenuPreferences(menuPrefs || {});
      setUserPreferences(Object.fromEntries(Object.entries(userPrefs || {}).map(([key, preferences]) => [key, migrateBrandPreferences(preferences)])));
      if (requiresActivation) {
        setActivationStatus("required");
        return;
      }
      setActivationStatus("activated");
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
      setDatos(migrarDatosDemo(remoteData, { includeSeeds: PUBLIC_DEMO_MODE }));
      const preparedAccounts = await secureAccounts(migrarCuentasDemo(remoteAccounts, { includeSeeds: PUBLIC_DEMO_MODE }));
      setCuentas((previous) => {
        const localAdmins = previous.filter((account) => account.superAdmin && !preparedAccounts.some((remote) => String(remote.id) === String(account.id)));
        return [...localAdmins, ...preparedAccounts];
      });
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
  const accountAccess = trialAccessStatus(cuentaActual);
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
  const closeTutorial = () => {
    // Cerrar también significa "ya lo vi". El progreso se guarda con
    // preferenceKey, que identifica a la cuenta o empleado actual y no a la
    // computadora; otra persona en esta misma PC recibirá su propia guía.
    markTutorialHandled(view);
    autoTutorialRef.current = false;
    setTutorialOpen(false);
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
    if (accountAccess.readOnly) {
      setReadOnlyNotice(true);
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
    if (accountAccess.readOnly) {
      setReadOnlyNotice(true);
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
    if (!tutorialOpen && accountAccess.readOnly) {
      setReadOnlyNotice(true);
      return;
    }
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
    }).then((session) => session || loginCloud(cloudConfig.apiUrl, username, password, cloudConfig.deviceId))
      .then(() => PUBLIC_DEMO_MODE ? null : repository.seedCurrentTenant())
      .catch((error) => repository.reportSyncError(error));
  };

  const prepareCloudAccount = async (account) => {
    if (!account) return null;
    const [prepared] = await secureAccounts(migrarCuentasDemo([account], { includeSeeds: false }));
    return prepared || null;
  };

  const saveCloudAccountLocally = (account) => {
    setCuentas((previous) => [...previous.filter((item) => String(item.id) !== String(account.id)), account]);
    setDatos((previous) => previous[account.id]
      ? previous
      : { ...previous, [account.id]: { ...defaultDataset(false), tenantId: String(account.id) } });
  };

  const startAuthenticatedCloudSync = (account) => {
    repository.setContext({ tenantId: String(account.id), isSystemAdmin: !!account.superAdmin });
    if (!PUBLIC_DEMO_MODE) repository.seedCurrentTenant().catch((error) => repository.reportSyncError(error));
  };

  const handleLogin = async ({ usuario, password }) => {
    const normalizedUser = String(usuario || "").trim();
    const normalizedPassword = String(password || "").trim();
    setLoginNotice("");
    const guard = loginGuard(authSecurity, normalizedUser);
    if (guard.blocked) { setLoginError(`Acceso bloqueado temporalmente. Probá nuevamente en ${Math.ceil(guard.remainingMs / 60000)} minuto(s).`); return; }
    const cuentaCandidate = cuentas.find((c) => String(c.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase());
    const cuenta = cuentaCandidate && await verifyPassword(normalizedPassword, cuentaCandidate) ? cuentaCandidate : null;
    if (cuenta) {
      let activeAccount = cuenta;
      let cloudReady = false;
      const cloudConfig = loadCloudConfig();
      if (!cuenta.superAdmin && cloudConfig.enabled && cloudConfig.apiUrl && navigator.onLine) {
        try {
          const remoteSession = await loginCloud(cloudConfig.apiUrl, normalizedUser, normalizedPassword, cloudConfig.deviceId);
          const remoteAccount = await prepareCloudAccount(remoteSession.account);
          if (remoteAccount) {
            activeAccount = remoteAccount;
            saveCloudAccountLocally(remoteAccount);
          }
          cloudReady = true;
        } catch (error) {
          if (!canAccessAccount(cuenta)) {
            setLoginError(error?.message || "No se pudo consultar si la cuenta ya fue habilitada.");
            return;
          }
          repository.reportSyncError(error);
        }
      }
      if (!activeAccount.superAdmin && !canAccessAccount(activeAccount)) {
        logoutCloud(cloudConfig.apiUrl).catch(() => {});
        setLoginError(accountAccessMessage(activeAccount));
        return;
      }
      setLoginError("");
      setView("home");
      setCurrentUserId(activeAccount.id);
      const identity = { usuarioId: `cuenta:${activeAccount.id}`, tenantId: String(activeAccount.id), rol: activeAccount.superAdmin ? "Administrador de la app" : "Dueño", nombre: activeAccount.nombre, superAdmin: !!activeAccount.superAdmin, adminId: activeAccount.superAdmin ? activeAccount.id : null };
      setIdentidad(identity);
      if (cloudReady) startAuthenticatedCloudSync(activeAccount);
      else connectLocalCloud({ businessId: activeAccount.id, username: normalizedUser, password: normalizedPassword, name: activeAccount.nombre, superAdmin: !!activeAccount.superAdmin });
      const session = createSession(activeAccount.id, identity);
      const trial = trialAccessStatus(activeAccount);
      setSessionExpiresAt(trial.active && new Date(trial.expiresAt) < new Date(session.expiresAt) ? trial.expiresAt : session.expiresAt);
      setAuthSecurity((prev) => clearLoginFailures(prev, normalizedUser));
      setDatos((prev) => ({ ...prev, [activeAccount.id]: { ...prev[activeAccount.id], auditoria: [...(prev[activeAccount.id]?.auditoria || []), { id: Date.now(), fecha: new Date().toISOString(), tenantId: String(activeAccount.id), usuario: activeAccount.nombre, usuarioId: identity.usuarioId, rol: identity.rol, origen: activeAccount.superAdmin ? "administracion_app" : "dueno", seccion: "seguridad", accion: "inicio_sesion", detalle: "Inicio de sesión", resultado: "exitoso" }] } }));
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

    const cloudConfig = loadCloudConfig();
    if (cloudConfig.enabled && cloudConfig.apiUrl && navigator.onLine) {
      try {
        const remoteSession = await loginCloud(cloudConfig.apiUrl, normalizedUser, normalizedPassword, cloudConfig.deviceId);
        let remoteAccount = await prepareCloudAccount(remoteSession.account);
        if (!remoteAccount && remoteSession.user?.role === "superAdmin") {
          remoteAccount = await secureSubject({
            id: remoteSession.user.businessId || "system-admin",
            tenantId: String(remoteSession.user.businessId || "system-admin"),
            nombre: remoteSession.user.name || "Administrador de Kiosco+",
            nombreNegocio: "Administración de Kiosco+",
            usuario: normalizedUser,
            password: normalizedPassword,
            superAdmin: true,
            tipo: "administrador_app",
            estado: "aprobada",
            modoNegocio: "equipo",
            roles: [],
            empleados: [],
          });
        }
        if (!remoteAccount) throw new Error("La cuenta existe en la nube, pero todavía no está asociada a un negocio.");
        saveCloudAccountLocally(remoteAccount);
        if (!remoteAccount.superAdmin && !canAccessAccount(remoteAccount)) {
          await logoutCloud(cloudConfig.apiUrl).catch(() => {});
          setLoginError(accountAccessMessage(remoteAccount));
          return;
        }
        const employee = remoteSession.user?.role === "employee"
          ? (remoteAccount.empleados || []).find((item) => String(item.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase())
          : null;
        const identity = employee
          ? { usuarioId: `empleado:${employee.id}`, tenantId: String(remoteAccount.id), rol: employee.rol, nombre: employee.nombre, superAdmin: false }
          : { usuarioId: `cuenta:${remoteAccount.id}`, tenantId: String(remoteAccount.id), rol: remoteAccount.superAdmin ? "Administrador de la app" : "Dueño", nombre: remoteAccount.nombre, superAdmin: !!remoteAccount.superAdmin, adminId: remoteAccount.superAdmin ? remoteAccount.id : null };
        setLoginError("");
        setView("home");
        setCurrentUserId(remoteAccount.id);
        setIdentidad(identity);
        startAuthenticatedCloudSync(remoteAccount);
        const session = createSession(remoteAccount.id, identity);
        const access = trialAccessStatus(remoteAccount);
        setSessionExpiresAt(access.active && new Date(access.expiresAt) < new Date(session.expiresAt) ? access.expiresAt : session.expiresAt);
        setAuthSecurity((previous) => clearLoginFailures(previous, normalizedUser));
        return;
      } catch (error) {
        setAuthSecurity((previous) => registerLoginFailure(previous, normalizedUser));
        setLoginError(error?.message || "Usuario o contraseña incorrectos.");
        return;
      }
    }

    setAuthSecurity((prev) => registerLoginFailure(prev, normalizedUser));
    setLoginError("Usuario o contraseña incorrectos.");
  };

  const handleRegister = async ({ nombre, usuario, password, nombreNegocio, modoNegocio = "solo", activationCode = "" }) => {
    const normalizedUser = String(usuario || "").trim();
    const normalizedPassword = String(password || "").trim();
    if (cuentas.some((c) => String(c.usuario || "").trim().toLowerCase() === normalizedUser.toLowerCase())) {
      setLoginError("Ese usuario ya existe, elegí otro.");
      return;
    }
    const cloudConfig = loadCloudConfig();
    if (!cloudConfig.enabled || !cloudConfig.apiUrl) {
      setLoginError("Esta instalación no está conectada a la nube. Revisá tu conexión e intentá nuevamente.");
      return;
    }
    if (!navigator.onLine) {
      setLoginError("Necesitás Internet para enviar la solicitud de cuenta.");
      return;
    }
    try {
      const receipt = loadInstallationReceipt();
      const deviceActivated = receipt?.activated && receipt.deviceId === cloudConfig.deviceId;
      if (!deviceActivated) {
        if (String(activationCode).replace(/[^A-Z0-9]/gi, "").length < 12) {
          throw new Error("Ingresá la clave que te dio el administrador para crear un negocio nuevo.");
        }
        await redeemInstallationCode(cloudConfig.apiUrl, activationCode, cloudConfig.deviceId, import.meta.env.VITE_APP_VERSION || "web");
      }
      const result = await registerCloudAccount(cloudConfig.apiUrl, {
        deviceId: cloudConfig.deviceId,
        name: nombre,
        username: normalizedUser,
        password: normalizedPassword,
        businessName: nombreNegocio,
        businessMode: modoNegocio,
      });
      const account = await prepareCloudAccount(result.account);
      if (!account) throw new Error("La nube no devolvió la cuenta creada.");
      saveCloudAccountLocally(account);
      setLoginError("");
      setLoginNotice("Solicitud enviada. La cuenta quedó pendiente; vas a poder entrar con este usuario y contraseña cuando el administrador la habilite.");
      return { ok: true };
    } catch (error) {
      if (error?.status === 403 && /dispositivo.*autoriza/i.test(String(error?.message || ""))) {
        clearInstallationReceipt();
      }
      setLoginNotice("");
      setLoginError(error?.message || "No se pudo enviar la solicitud de cuenta.");
      return { ok: false };
    }
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
    setCuentas(PUBLIC_DEMO_MODE ? await secureAccounts(seedCuentas()) : []);
    setDatos(PUBLIC_DEMO_MODE ? seedDatos() : {});
    setCurrentUserId(null);
    setIdentidad(null);
    setNotasAdmin([]);
    setAuthSecurity({});
    setSessionExpiresAt(null);
    setReportesProblemas([]);
    setMenuPreferences({});
    setUserPreferences({});
  };

  const handleInstallationActivation = async (code) => {
    const config = loadCloudConfig();
    const result = await redeemInstallationCode(config.apiUrl, code, activationDeviceId || config.deviceId, activationAppVersion);
    if (!result.activated) throw new Error("La nube no confirmó la activación.");
    setActivationStatus("activated");
    setCargando(false);
  };

  const handleAdministratorActivation = async (deviceKey) => {
    const config = loadCloudConfig();
    const deviceId = activationDeviceId || config.deviceId;
    const result = await activateAdministratorInstallation(config.apiUrl, deviceKey, deviceId, activationAppVersion);
    if (!result.activated) throw new Error("La nube no confirmó la activación administradora.");
    const remoteSession = await pairCloudDevice(config.apiUrl, deviceKey, deviceId);
    const adminAccount = await prepareCloudAccount({
      id: remoteSession.user?.businessId || "system-admin",
      tenantId: String(remoteSession.user?.businessId || "system-admin"),
      nombre: remoteSession.user?.name || "Administrador de Kiosco+",
      nombreNegocio: "Administración de Kiosco+",
      usuario: "administrador",
      superAdmin: true,
      tipo: "administrador_app",
      estado: "aprobada",
      modoNegocio: "equipo",
      roles: [],
      empleados: [],
    });
    if (!adminAccount) throw new Error("La nube autorizó el dispositivo, pero no devolvió la cuenta administradora.");
    const identity = {
      usuarioId: `cuenta:${adminAccount.id}`,
      tenantId: String(adminAccount.id),
      rol: "Administrador de la app",
      nombre: adminAccount.nombre,
      superAdmin: true,
      adminId: adminAccount.id,
    };
    saveCloudAccountLocally(adminAccount);
    setCurrentUserId(adminAccount.id);
    setIdentidad(identity);
    setSessionExpiresAt(createSession(adminAccount.id, identity).expiresAt);
    setView("home");
    startAuthenticatedCloudSync(adminAccount);
    setActivationStatus("activated");
    setCargando(false);
  };

  if (activationStatus === "required") {
    return <ActivationView deviceId={activationDeviceId} onActivate={handleInstallationActivation} onAdminActivate={handleAdministratorActivation}/>;
  }

  if (cargando) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50 text-sm text-gray-400">
        <img src={kioscoPlusLockup} alt="Kiosco+" className="h-14 w-auto max-w-[240px] object-contain"/>
        <span>Cargando...</span>
      </div>
    );
  }

  if (!currentUserId) {
    const cloudDeviceId = loadCloudConfig().deviceId;
    const installationReceipt = loadInstallationReceipt();
    return (
      <LoginView
        onLogin={handleLogin}
        onRegister={handleRegister}
        error={loginError}
        notice={loginNotice}
        onReset={handleReset}
        showDemoAccounts={PUBLIC_DEMO_MODE}
        requiresRegistrationCode={!PUBLIC_DEMO_MODE && !(installationReceipt?.activated && installationReceipt.deviceId === cloudDeviceId)}
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

  const permisos = permisosDe(identidad, cuentaActual);
  const esDueno = identidad?.rol === "Dueño" || !!(identidad?.adminApp && identidad?.operandoNegocio);
  const puede = (permiso) => esDueno || permisos.includes(permiso);

  const renderView = () => {
    if (view !== "home" && !permisos.includes(view)) {
      return <Home onNavigate={handleNavigate} cuenta={cuentaActual} identidad={identidad} data={data} onReportProblem={abrirReporteProblema} />;
    }
    switch (view) {
      case "notificaciones":
        return <NotificacionesView data={data} onNavigate={handleNavigate} />;
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
        {accountAccess.readOnly && <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><div><b>Abono vencido: modo consulta.</b> Podés revisar y exportar tus datos, pero los cambios quedan bloqueados hasta renovar.</div><span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold">Venció {formatAccessExpiration(cuentaActual)}</span></div>}
        <ViewErrorBoundary view={view} onRecover={() => setView("home")} onReport={abrirReporteProblema}>
          <div key={view} className="view-stage">{renderView()}</div>
        </ViewErrorBoundary>
      </div>
      {readOnlyNotice && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4" onMouseDown={() => setReadOnlyNotice(false)}><div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Modo consulta</p><h2 className="mt-1 text-xl font-bold">El abono está vencido</h2><p className="mt-3 text-sm leading-6 text-gray-600">La información sigue disponible y se puede exportar, pero no se guardarán ventas, cambios de stock ni otras modificaciones hasta registrar un nuevo pago.</p><button onClick={() => setReadOnlyNotice(false)} className="mt-5 w-full rounded-lg bg-[#1C4A44] px-4 py-3 text-sm font-semibold text-white">Entendido</button></div></div>}
      {settingsOpen && <SettingsModal preferences={currentPreferences} cuenta={cuentaActual} tenantId={currentUserId} onChange={updateCurrentPreferences} onUpdateAccount={updateCurrentAccount} canEditBusiness={esDueno} onCleanOperationalHistory={cleanOperationalHistory} onExportCommercialArchive={exportCurrentCommercialArchive} archiveStats={{count:data?.comprobantes?.length||0}} onClose={() => setSettingsOpen(false)}/>} 
      {PUBLIC_DEMO_MODE && tutorialPrompt && <DemoTutorialPrompt view={tutorialPrompt.view} declined={tutorialPrompt.declined} onStart={startDemoTutorial} onDecline={declineDemoTutorial} onClose={() => setTutorialPrompt(null)}/>} 
      {PUBLIC_DEMO_MODE && helpSpotlightOpen && <HelpButtonSpotlight onClose={() => setHelpSpotlightOpen(false)}/>} 
      <TutorialOverlay open={tutorialOpen} view={view} hasEmployees={hasEmployees} showCatalog={tutorialCatalog} onClose={closeTutorial} onComplete={completeTutorial}/>
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
