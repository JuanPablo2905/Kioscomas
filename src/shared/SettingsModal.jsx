import React, { useEffect, useState } from "react";
import { Archive, Cloud, Download, ImagePlus, LayoutPanelLeft, Palette, Printer, Settings, ShieldCheck, SlidersHorizontal, Store, Trash2, X } from "lucide-react";
import { loadCloudConfig, saveCloudConfig } from "../cloud/config";
import { bootstrapCloud, cloudSession, loginCloud, logoutCloud } from "../cloud/cloudAuth";
import { AppSelect, NumberInput } from "./controls";

const COLORS = [
  { id: "petroleo", label: "Petróleo", value: "#1C4A44" },
  { id: "mostaza", label: "Mostaza", value: "#E3A23C" },
  { id: "sello", label: "Sello", value: "#B8412F" },
  { id: "grafito", label: "Grafito", value: "#111827" }, { id: "azul", label: "Azul", value: "#2563eb" },
  { id: "violeta", label: "Violeta", value: "#7c3aed" }, { id: "verde", label: "Verde", value: "#15803d" },
  { id: "naranja", label: "Naranja", value: "#c2410c" }, { id: "rosa", label: "Rosa", value: "#be185d" },
  { id: "celeste", label: "Celeste", value: "#0284c7" }, { id: "turquesa", label: "Turquesa", value: "#0f766e" },
  { id: "lima", label: "Lima", value: "#4d7c0f" }, { id: "amarillo", label: "Dorado", value: "#ca8a04" },
  { id: "bordo", label: "Bordó", value: "#9f1239" }, { id: "indigo", label: "Índigo", value: "#4338ca" },
];
const COLOR_COMBOS = [
  { id: "kiosco-plus", label: "Kiosco+", type: "Marca", accent: "#1C4A44", background: "#F6F1E7", menu: "#FFFCF6", fontFamily: "marca" },
  { id: "kiosco-plus-noche", label: "Kiosco+ noche", type: "Marca oscura", accent: "#E3A23C", background: "#163A36", menu: "#1C4A44", fontFamily: "marca" },
  { id: "nieve-azul", label: "Nieve azul", type: "Claro", accent: "#2563eb", background: "#f1f5f9", menu: "#ffffff" },
  { id: "menta", label: "Menta", type: "Claro", accent: "#0f766e", background: "#ecfdf5", menu: "#ffffff" },
  { id: "arena", label: "Arena", type: "Claro", accent: "#b45309", background: "#fffbeb", menu: "#fff7ed" },
  { id: "lavanda", label: "Lavanda", type: "Claro", accent: "#7c3aed", background: "#f5f3ff", menu: "#ffffff" },
  { id: "grafito-combo", label: "Grafito", type: "Oscuro", accent: "#38bdf8", background: "#0f172a", menu: "#1e293b" },
  { id: "bosque", label: "Bosque", type: "Oscuro", accent: "#4ade80", background: "#071a12", menu: "#123326" },
  { id: "medianoche", label: "Medianoche", type: "Oscuro", accent: "#818cf8", background: "#09090b", menu: "#18181b" },
  { id: "vino", label: "Vino", type: "Oscuro", accent: "#fb7185", background: "#24090f", menu: "#3f121c" },
];

function rgbFromHex(hex) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean.padEnd(6, "f").slice(0, 6);
  return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16) || 0);
}

function relativeLuminance(hex) {
  const channels = rgbFromHex(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastText(background) {
  const luminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? "#ffffff" : "#0f172a";
}

function mixHex(first, second, firstWeight = 0.5) {
  const a = rgbFromHex(first);
  const b = rgbFromHex(second);
  return `#${a.map((value, index) => Math.round(value * firstWeight + b[index] * (1 - firstWeight)).toString(16).padStart(2, "0")).join("")}`;
}

function resizeBusinessImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("El archivo no es una imagen valida"));
      image.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.86));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const BRAND_VERSION = 2;
export const BRAND_APPEARANCE = {
  brandVersion: BRAND_VERSION,
  color: "petroleo",
  customAccent: "#1C4A44",
  backgroundColor: "#F6F1E7",
  menuColor: "#FFFCF6",
  colorScope: "completa",
  theme: "claro",
  fontFamily: "marca",
};
export const migrateBrandPreferences = (preferences = {}) => {
  const version = Number(preferences.brandVersion || 0);
  if (version >= BRAND_VERSION) return preferences;
  if (version < 1) return { ...preferences, ...BRAND_APPEARANCE };
  return { ...preferences, fontFamily: "marca", brandVersion: BRAND_VERSION };
};

export const DEFAULT_PREFERENCES = {
  ...BRAND_APPEARANCE, density: "normal", rounded: "suave", fontSize: "normal", sidebarSize: "normal", sidebarMode: "fijo", homeColumns: 3,
  motion: "completa", animationSpeed: "normal", confirmationSeconds: 2, sounds: false, volume: 70, hideSensitive: false,
  stockMinDefault: 3, vitrinaAlertDefault: 1, targetMargin: 50, maxDiscount: 100, inactivityMinutes: 0, sessionHours: 8, duplicateHours: 24, defaultPayment: "Efectivo", preferredCamera: "automatica", scanFeedback: true,
  requireCorrectionReason: true, allowNegativeStock: false, expiryDays: 7, ticketPrefix: "", ticketNumbering: true, rounding: "centavos", confirmDangerousActions: true,
  ticketPrintMode: "preguntar", ticketPaper: "80", printerName: "", hasCashDrawer: false, drawerOpenOnCash: true, drawerConnection: "impresora", printDailySummary: false,
  automaticOperationalCleanup: false, operationalHistoryRetentionMonths: 12, commercialArchiveRetentionYears: 10,
  tutorialsCompleted: [],
};

function Field({ label, hint, children }) {
  return <label className="settings-field grid min-w-0 gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center sm:gap-2"><span className="min-w-0"><b className="block break-words text-sm">{label}</b>{hint && <small className="block break-words text-xs text-gray-500">{hint}</small>}</span><span className="settings-field-control flex min-w-0 w-full items-center [&>.app-select]:w-full [&>code]:block [&>code]:w-full [&>div]:w-full [&>input]:w-full sm:w-[220px] sm:justify-end">{children}</span></label>;
}
function Select({ value, onChange, children }) { return <AppSelect value={value} onChange={onChange} className="w-full">{children}</AppSelect>; }
function NumberField({ value, onChange, min = 0, max, suffix }) { return <div className="flex w-full min-w-0 items-center gap-2"><NumberInput value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1" />{suffix && <span className="w-10 shrink-0 text-xs text-gray-500">{suffix}</span>}</div>; }
function Toggle({ value, onChange }) { return <button type="button" onClick={() => onChange(!value)} className={`ml-auto flex w-14 shrink-0 rounded-full p-1 ${value ? "bg-green-600 justify-end" : "bg-gray-300 justify-start"}`}><span className="h-5 w-5 rounded-full bg-white shadow" /></button>; }

function Preview({ current }) {
  const color = current.color === "personalizado" ? current.customAccent : (COLORS.find((item) => item.id === current.color)?.value || COLORS[0].value);
  const backgroundText = contrastText(current.backgroundColor);
  const menuText = contrastText(current.menuColor);
  const accentText = contrastText(color);
  const previewFont = current.fontFamily === "marca" ? "'Space Grotesk', sans-serif" : current.fontFamily === "serif" ? "Georgia, serif" : current.fontFamily === "mono" ? "monospace" : "system-ui";
  return <><div className="mt-5"><h3 className="mb-2 text-sm font-semibold">Combinaciones recomendadas</h3><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{COLOR_COMBOS.map((combo) => <button key={combo.id} onClick={() => window.dispatchEvent(new CustomEvent("kiosco-color-combo", { detail: combo }))} className="min-w-0 overflow-hidden rounded-xl border bg-white p-2 text-left"><span className="mb-2 flex h-8 overflow-hidden rounded-lg border"><i className="flex-1" style={{background:combo.background}}/><i className="w-1/3" style={{background:combo.menu}}/><i className="w-3" style={{background:combo.accent}}/></span><span className="block truncate text-xs font-semibold">{combo.label}</span><small className="text-[10px] text-gray-500">{combo.type}</small></button>)}</div></div><div className="mt-5 min-w-0 rounded-xl border p-3 sm:p-4" style={{ background: current.backgroundColor, color: backgroundText, fontFamily: previewFont }}><div className="mb-3 flex items-center justify-between gap-3"><b className="min-w-0 break-words" style={{ fontFamily: current.fontFamily === "marca" ? "'Fraunces', Georgia, serif" : previewFont }}>Vista previa</b><button className="shrink-0 rounded-lg px-3 py-1.5 text-xs" style={{ background: color, color: accentText }}>Guardar</button></div><div className={`grid gap-2 ${Number(current.homeColumns) >= 3 ? "grid-cols-3" : "grid-cols-2"}`}><div className="min-w-0 rounded-lg border p-2 text-xs sm:p-3" style={{background:current.menuColor,color:menuText}}>Ventas<br/><b className="mt-1 inline-block break-words rounded px-1.5 py-0.5" style={{ background: color, color: accentText, fontFamily: current.fontFamily === "marca" ? "'Space Mono', monospace" : previewFont }}>$24.500</b></div><div className="min-w-0 rounded-lg border p-2 text-xs sm:p-3" style={{background:current.menuColor,color:menuText}}>Stock<br/><b>128</b></div><div className="min-w-0 rounded-lg border p-2 text-xs sm:p-3" style={{background:current.menuColor,color:menuText}}>Alertas<br/><b>3</b></div></div></div></>;
}

export function SettingsModal({ preferences, onChange, onClose, cuenta, tenantId, onUpdateAccount, canEditBusiness = true, onCleanOperationalHistory, onExportCommercialArchive, archiveStats }) {
  const [section, setSection] = useState("apariencia");
  const [closing, setClosing] = useState(false);
  const [cloudConfig, setCloudConfig] = useState(loadCloudConfig());
  const [cloudTest, setCloudTest] = useState("");
  const [cloudUsername, setCloudUsername] = useState(cuenta?.usuario || "");
  const [cloudPassword, setCloudPassword] = useState("");
  const [businessName, setBusinessName] = useState(cuenta?.nombreNegocio || "");
  const [businessImageError, setBusinessImageError] = useState("");
  const current = { ...DEFAULT_PREFERENCES, ...preferences };
  const cloudConnected = Boolean(cloudSession());
  const set = (key, value) => onChange(key === "color" ? { ...current, color: value, customAccent: COLORS.find((item) => item.id === value)?.value || current.customAccent, ...(value === "petroleo" ? BRAND_APPEARANCE : {}) } : { ...current, [key]: value });
  const close = () => { setClosing(true); setTimeout(onClose, current.motion === "ninguna" ? 0 : 160); };
  useEffect(() => { const key = (event) => event.key === "Escape" && close(); const combo = (event) => onChange({ ...current, color: event.detail.id === "kiosco-plus" ? "petroleo" : "personalizado", customAccent: event.detail.accent, backgroundColor: event.detail.background, menuColor: event.detail.menu, colorScope: "completa", theme: "claro", fontFamily: event.detail.fontFamily || current.fontFamily, brandVersion: BRAND_VERSION }); window.addEventListener("keydown", key); window.addEventListener("kiosco-color-combo", combo); return () => { window.removeEventListener("keydown", key); window.removeEventListener("kiosco-color-combo", combo); }; });
  const saveCloud = (patch) => { const next = { ...cloudConfig, ...patch }; setCloudConfig(next); saveCloudConfig(next); window.dispatchEvent(new Event("kiosco-cloud-config-changed")); };
  const disconnectCloud = async () => { setCloudTest("Desconectando..."); try { await logoutCloud(cloudConfig.apiUrl); } finally { saveCloud({ enabled: false }); setCloudPassword(""); setCloudTest("Sesion del servidor cerrada"); } };
  const saveBusinessName = () => { const name = businessName.trim(); if (name && name !== cuenta?.nombreNegocio) onUpdateAccount?.({ nombreNegocio: name }); else setBusinessName(cuenta?.nombreNegocio || ""); };
  const selectBusinessImage = async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setBusinessImageError(""); if (!file.type.startsWith("image/")) { setBusinessImageError("Elegi un archivo de imagen."); return; } try { onUpdateAccount?.({ imagenNegocio: await resizeBusinessImage(file) }); } catch (error) { setBusinessImageError(error.message || "No se pudo procesar la imagen."); } };
  const testCloud = async () => { setCloudTest("Probando..."); try { const response = await fetch(`${cloudConfig.apiUrl.replace(/\/$/, "")}/v1/health`); if (!response.ok) throw new Error(); setCloudTest("Servidor disponible"); } catch { setCloudTest("No se pudo conectar"); } };
  const connectCloud = async () => { setCloudTest("Conectando..."); try { const bootstrap=await bootstrapCloud(cloudConfig.apiUrl,{businessId:String(tenantId),username:cloudUsername,password:cloudPassword,name:cuenta?.nombre}); if(!bootstrap.ok&&bootstrap.status!==409)throw new Error(); await loginCloud(cloudConfig.apiUrl,cloudUsername,cloudPassword,cloudConfig.deviceId); saveCloud({enabled:true});setCloudPassword("");setCloudTest("Sesión de nube conectada"); } catch { setCloudTest("No se pudo iniciar sesión en la nube"); } };
  const sections = [["negocio", "Negocio", Store], ["apariencia", "Apariencia", Palette], ["interfaz", "Interfaz", LayoutPanelLeft], ["respuestas", "Sonido y movimiento", SlidersHorizontal], ["operacion", "Funcionamiento", Store], ["impresion", "Impresión y cajón", Printer], ["datos", "Datos y archivo", Archive], ["seguridad", "Seguridad y tickets", ShieldCheck], ["nube", "Nube y dispositivos", Cloud]].filter(([id]) => id !== "negocio" || canEditBusiness);
  return <div className={`settings-overlay fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 p-0 sm:items-center sm:p-4 ${closing ? "is-closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="settings-panel flex h-[100dvh] w-full min-w-0 max-w-6xl flex-col overflow-hidden border bg-white shadow-2xl sm:h-[min(780px,94vh)] sm:flex-row sm:rounded-2xl"><aside className="w-full shrink-0 overflow-x-auto border-b bg-gray-50 p-2 sm:w-60 sm:overflow-x-visible sm:border-b-0 sm:border-r sm:p-4"><div className="mb-5 hidden items-center gap-2 px-2 sm:flex"><Settings size={19}/><b>Configuración</b></div><div className="flex min-w-max gap-1 sm:block sm:min-w-0 sm:space-y-1">{sections.map(([id, label, Icon]) => <button key={id} onClick={() => setSection(id)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm sm:w-full ${section === id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}><Icon className="shrink-0" size={16}/>{label}</button>)}</div></aside><main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-7"><div className="mb-5 flex items-start justify-between gap-3 sm:mb-6"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{sections.find(([id]) => id === section)?.[1]}</h2><p className="break-words text-sm text-gray-500">Los cambios se guardan automáticamente para este usuario.</p></div><button onClick={close} className="shrink-0 rounded-lg p-2"><X size={20}/></button></div>
    {section === "apariencia" && <><h3 className="mb-3 text-sm font-semibold">Color principal</h3><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{COLORS.map((item) => <button key={item.id} onClick={() => set("color", item.id)} className={`rounded-xl border p-2 text-xs ${current.color === item.id ? "ring-2 ring-gray-900" : ""}`}><span className="mx-auto mb-1 block h-7 w-7 rounded-full" style={{background:item.value}}/>{item.label}</button>)}</div><div className="mt-5 grid gap-3"><Field label="Color libre para botones y acentos"><div className="flex items-center gap-3"><input type="color" value={current.customAccent} onChange={(e) => { onChange({...current,color:"personalizado",customAccent:e.target.value}); }} className="h-10 w-16 cursor-pointer rounded-lg border p-1"/><code className="text-xs">{current.customAccent}</code></div></Field><Field label="Color del fondo"><div className="flex items-center gap-3"><input type="color" value={current.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border p-1"/><code className="text-xs">{current.backgroundColor}</code></div></Field><Field label="Color de menús y tarjetas"><div className="flex items-center gap-3"><input type="color" value={current.menuColor} onChange={(e) => set("menuColor", e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border p-1"/><code className="text-xs">{current.menuColor}</code></div></Field><Field label="Aplicación del color"><Select value={current.colorScope} onChange={(v) => set("colorScope", v)}><option value="acento">Sólo acentos</option><option value="completa">Toda la interfaz</option></Select></Field><Field label="Tema"><Select value={current.theme} onChange={(v) => set("theme", v)}><option value="claro">Claro</option><option value="oscuro">Oscuro</option><option value="automatico">Automático</option></Select></Field><Field label="Tipografía"><Select value={current.fontFamily} onChange={(v) => set("fontFamily", v)}><option value="marca">Marca Kiosco+</option><option value="sistema">Sistema</option><option value="serif">Serif</option><option value="mono">Monoespaciada</option></Select></Field><Field label="Tamaño general del texto"><Select value={current.fontSize} onChange={(v) => set("fontSize", v)}><option value="chico">Chico</option><option value="normal">Normal</option><option value="grande">Grande</option></Select></Field></div><Preview current={current}/></>}
    {section === "interfaz" && <div className="grid gap-3"><Field label="Densidad de la interfaz"><Select value={current.density} onChange={(v) => set("density", v)}><option value="comoda">Cómoda</option><option value="normal">Normal</option><option value="compacta">Compacta</option></Select></Field><Field label="Forma de controles"><Select value={current.rounded} onChange={(v) => set("rounded", v)}><option value="suave">Redondeados</option><option value="compacto">Más cuadrados</option></Select></Field><Field label="Tamaño del menú lateral"><Select value={current.sidebarSize} onChange={(v) => set("sidebarSize", v)}><option value="angosto">Angosto</option><option value="normal">Normal</option><option value="ancho">Ancho</option></Select></Field><Field label="Comportamiento del menú"><Select value={current.sidebarMode} onChange={(v) => set("sidebarMode", v)}><option value="fijo">Siempre visible</option><option value="plegable">Plegable</option></Select></Field><Field label="Columnas en Inicio"><Select value={current.homeColumns} onChange={(v) => set("homeColumns", Number(v))}><option value="2">2 columnas</option><option value="3">3 columnas</option><option value="4">4 columnas</option></Select></Field><Field label="Ocultar valores sensibles" hint="Permite ocultar importes al trabajar frente a terceros."><Toggle value={current.hideSensitive} onChange={(v) => set("hideSensitive", v)}/></Field><Field label="Tutoriales de ayuda" hint="Hace que las guías vuelvan a aparecer al entrar en cada sección."><button type="button" onClick={() => set("tutorialsCompleted", [])} className="min-h-10 w-full rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50">Volver a mostrar</button></Field><Preview current={current}/></div>}
    {section === "respuestas" && <div className="grid gap-3"><Field label="Nivel de animaciones"><Select value={current.motion} onChange={(v) => set("motion", v)}><option value="completa">Completas</option><option value="reducida">Sutiles</option><option value="ninguna">Desactivadas</option></Select></Field><Field label="Velocidad de animaciones"><Select value={current.animationSpeed} onChange={(v) => set("animationSpeed", v)}><option value="rapida">Rápida</option><option value="normal">Normal</option><option value="lenta">Lenta</option></Select></Field><Field label="Duración de confirmaciones"><NumberField value={current.confirmationSeconds} min={1} max={10} suffix="seg" onChange={(v) => set("confirmationSeconds", v)}/></Field><Field label="Sonidos de acciones"><Toggle value={current.sounds} onChange={(v) => set("sounds", v)}/></Field><Field label="Volumen"><NumberField value={current.volume} max={100} suffix="%" onChange={(v) => set("volume", v)}/></Field><Field label="Sonido o vibración al escanear"><Toggle value={current.scanFeedback} onChange={(v) => set("scanFeedback", v)}/></Field></div>}
    {section === "operacion" && <div className="grid gap-3"><Field label="Stock bajo predeterminado"><NumberField value={current.stockMinDefault} onChange={(v) => set("stockMinDefault", v)}/></Field><Field label="Alerta de vitrina predeterminada"><NumberField value={current.vitrinaAlertDefault} onChange={(v) => set("vitrinaAlertDefault", v)}/></Field><Field label="Margen de ganancia objetivo"><NumberField value={current.targetMargin} suffix="%" onChange={(v) => set("targetMargin", v)}/></Field><Field label="Descuento máximo sin autorización"><NumberField value={current.maxDiscount} max={100} suffix="%" onChange={(v) => set("maxDiscount", v)}/></Field><Field label="Método de pago predeterminado"><Select value={current.defaultPayment} onChange={(v) => set("defaultPayment", v)}><option>Efectivo</option><option>Mercado Pago</option><option>Transferencia</option><option>Tarjeta</option><option>Cuenta corriente</option></Select></Field><Field label="Cámara preferida"><Select value={current.preferredCamera} onChange={(v) => set("preferredCamera", v)}><option value="automatica">Automática</option><option value="frontal">Frontal</option><option value="trasera">Trasera</option></Select></Field><Field label="Permitir stock negativo"><Toggle value={current.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)}/></Field><Field label="Días para alertar vencimientos"><NumberField value={current.expiryDays} onChange={(v) => set("expiryDays", v)}/></Field></div>}
    {section === "seguridad" && <div className="grid gap-3"><Field label="Inactividad antes de cerrar sesión" hint="Cero mantiene la sesión activa hasta su duración máxima."><NumberField value={current.inactivityMinutes} suffix="min" onChange={(v) => set("inactivityMinutes", v)}/></Field><Field label="Duración máxima de sesión"><NumberField value={current.sessionHours} min={1} max={24} suffix="h" onChange={(v) => set("sessionHours", v)}/></Field><Field label="Ventana de tickets duplicados"><NumberField value={current.duplicateHours} min={1} max={168} suffix="h" onChange={(v) => set("duplicateHours", v)}/></Field><Field label="Pedir motivo para correcciones"><Toggle value={current.requireCorrectionReason} onChange={(v) => set("requireCorrectionReason", v)}/></Field><Field label="Confirmar eliminar, anular y cerrar caja"><Toggle value={current.confirmDangerousActions} onChange={(v) => set("confirmDangerousActions", v)}/></Field><Field label="Numeración visible de tickets"><Toggle value={current.ticketNumbering} onChange={(v) => set("ticketNumbering", v)}/></Field><Field label="Prefijo de tickets"><input value={current.ticketPrefix} onChange={(e) => set("ticketPrefix", e.target.value.slice(0, 8))} placeholder="Ej.: KS-" className="rounded-lg border px-3 py-2 text-sm"/></Field><Field label="Redondeo de precios"><Select value={current.rounding} onChange={(v) => set("rounding", v)}><option value="centavos">Con centavos</option><option value="unidad">Al peso</option><option value="decena">A la decena</option><option value="centena">A la centena</option></Select></Field></div>}
    {section === "nube" && <div className="grid min-w-0 gap-3"><div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 sm:p-4"><b>Modo seguro local-first</b><p className="mt-1 break-words">La app guarda primero en este dispositivo. Activá la nube únicamente con un servidor HTTPS de confianza. Para desarrollo local se puede usar <span className="break-all">http://127.0.0.1:8787</span>.</p></div><Field label="Activar sincronización"><Toggle value={cloudConfig.enabled} onChange={(v)=>saveCloud({enabled:v})}/></Field><Field label="Dirección del servidor"><input value={cloudConfig.apiUrl} onChange={(e)=>saveCloud({apiUrl:e.target.value})} placeholder="https://api.tudominio.com" className="min-w-0 rounded-lg border px-3 py-2 text-sm"/></Field><Field label="Identificador del dispositivo" hint="Permite reconocer desde qué equipo llegó cada cambio."><code className="truncate rounded-lg bg-gray-100 px-3 py-2 text-xs">{cloudConfig.deviceId}</code></Field><Field label="Canal de actualizaciones"><Select value={cloudConfig.updateChannel} onChange={(v)=>saveCloud({updateChannel:v})}><option value="stable">Estable</option><option value="beta">Pruebas</option></Select></Field><Field label="Comprobar actualizaciones automáticamente"><Toggle value={cloudConfig.autoCheckUpdates} onChange={(v)=>saveCloud({autoCheckUpdates:v})}/></Field><div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3"><span className={`break-words text-sm ${cloudTest.includes("disponible")?"text-green-600":cloudTest.includes("No")?"text-red-600":"text-gray-500"}`}>{cloudTest}</span><button disabled={!cloudConfig.apiUrl} onClick={testCloud} className="min-h-11 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40 sm:min-h-0 sm:w-auto">Probar conexión</button></div></div>}
    {section === "nube" && <div className="mt-4 min-w-0 rounded-xl border p-3 sm:p-4"><h3 className="text-sm font-semibold">Sesión del servidor local</h3><p className="mt-1 break-words text-xs text-gray-500">La primera conexión crea el dueño inicial; las siguientes validan sus credenciales.</p><div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2"><input value={cloudUsername} onChange={(e)=>setCloudUsername(e.target.value)} placeholder="Usuario" className="min-w-0 rounded-lg border px-3 py-2 text-sm"/><input type="password" value={cloudPassword} onChange={(e)=>setCloudPassword(e.target.value)} placeholder={cloudSession()?"Sesión conectada":"Contraseña"} className="min-w-0 rounded-lg border px-3 py-2 text-sm"/></div><div className="mt-3 flex justify-end"><button disabled={!cloudConfig.apiUrl||!cloudUsername||!cloudPassword} onClick={connectCloud} className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40 sm:min-h-0 sm:w-auto">Crear o conectar sesión local</button></div></div>}
    {section === "nube" && cloudConnected && <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 rounded-xl border border-green-200 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"><div className="min-w-0"><b className="text-sm text-green-800">Servidor conectado</b><p className="break-words text-xs text-green-700">Esta sesión puede sincronizar datos con el servidor configurado.</p></div><button onClick={disconnectCloud} className="min-h-11 w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-600 sm:min-h-0 sm:w-auto">Cerrar sesión del servidor</button></div>}
    {section === "negocio" && <div className="grid min-w-0 gap-4"><div className="min-w-0 rounded-2xl border p-4 sm:p-5"><div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-gray-50">{cuenta?.imagenNegocio ? <img src={cuenta.imagenNegocio} alt="Imagen del negocio" className="h-full w-full object-contain"/> : <Store size={34} className="text-gray-400"/>}</div><div className="min-w-0 w-full flex-1 text-center sm:text-left"><h3 className="font-semibold">Imagen del negocio</h3><p className="mt-1 break-words text-xs text-gray-500">La imagen se reduce automáticamente para que siga siendo liviana.</p><div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap"><label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white sm:min-h-0"><ImagePlus size={16}/>{cuenta?.imagenNegocio ? "Reemplazar imagen" : "Subir imagen"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectBusinessImage} className="hidden"/></label>{cuenta?.imagenNegocio && <button type="button" onClick={() => onUpdateAccount?.({ imagenNegocio: null })} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 sm:min-h-0"><Trash2 size={15}/>Quitar</button>}</div>{businessImageError && <p className="mt-2 break-words text-xs text-red-600">{businessImageError}</p>}</div></div></div><Field label="Nombre visible del negocio" hint="Aparece en el menú lateral y en las pantallas del negocio."><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} onBlur={saveBusinessName} onKeyDown={(event) => { if (event.key === "Enter") { saveBusinessName(); event.currentTarget.blur(); } }} maxLength={60} className="min-w-0 rounded-lg border px-3 py-2 text-sm"/></Field><Field label="Forma de trabajo" hint="Podés cambiarla después. Los empleados guardados no se borran al elegir Trabajo solo."><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onUpdateAccount?.({ modoNegocio: "solo" })} className={`min-h-11 rounded-lg border px-2 text-xs font-semibold ${cuenta?.modoNegocio !== "equipo" ? "border-blue-600 bg-blue-50 text-blue-800" : ""}`}>Trabajo solo</button><button type="button" onClick={() => onUpdateAccount?.({ modoNegocio: "equipo" })} className={`min-h-11 rounded-lg border px-2 text-xs font-semibold ${cuenta?.modoNegocio === "equipo" ? "border-blue-600 bg-blue-50 text-blue-800" : ""}`}>Tengo empleados</button></div></Field><div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 sm:p-4"><b>Guardado por cuenta</b><p className="mt-1 break-words">Esto cambia la identidad del negocio, no el nombre personal del dueño ni sus credenciales.</p></div></div>}
    {section === "impresion" && <div className="grid min-w-0 gap-3"><div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 sm:p-4"><b>Impresora térmica y cajón</b><p className="mt-1 break-words">El cajón suele conectarse a la impresora por RJ11/RJ12. La aplicación de escritorio puede enviar el pulso por la impresora configurada; en un navegador se prueba como simulación.</p></div><Field label="Acción después de cobrar" hint="Define si la app pregunta, prepara el envío, imprime o termina la venta sin mostrar el ticket."><Select value={current.ticketPrintMode} onChange={(v)=>set("ticketPrintMode",v)}><option value="preguntar">Preguntar en cada venta</option><option value="enviar">Preparar para enviar</option><option value="automatica">Imprimir automáticamente</option><option value="nunca">Finalizar sin hacer nada</option></Select></Field><Field label="Ancho del papel"><Select value={current.ticketPaper} onChange={(v)=>set("ticketPaper",v)}><option value="58">58 mm</option><option value="80">80 mm</option></Select></Field><Field label="Nombre de la impresora" hint="Debe coincidir con el nombre configurado en Windows."><input value={current.printerName} onChange={(e)=>set("printerName",e.target.value)} placeholder="Ej.: POS-80" className="min-w-0 rounded-lg border px-3 py-2 text-sm"/></Field><Field label="Tengo cajón registrador"><Toggle value={current.hasCashDrawer} onChange={(v)=>set("hasCashDrawer",v)}/></Field>{current.hasCashDrawer&&<><Field label="Conexión del cajón"><Select value={current.drawerConnection} onChange={(v)=>set("drawerConnection",v)}><option value="impresora">Conectado a impresora</option><option value="simulacion">Simulación / prueba</option></Select></Field><Field label="Abrir al cobrar en efectivo"><Toggle value={current.drawerOpenOnCash} onChange={(v)=>set("drawerOpenOnCash",v)}/></Field></>}<Field label="Permitir imprimir resumen diario"><Toggle value={current.printDailySummary} onChange={(v)=>set("printDailySummary",v)}/></Field></div>}
    {section === "datos" && <div className="grid gap-3"><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>Dos historiales separados</b><p className="mt-1">La limpieza sólo alcanza recordatorios, listas completadas y compras ya recibidas. Ventas, caja, auditoría y comprobantes quedan protegidos.</p></div><Field label="Limpieza automática del historial operativo"><Toggle value={current.automaticOperationalCleanup} onChange={(value)=>set("automaticOperationalCleanup",value)}/></Field><Field label="Conservar historial operativo"><Select value={current.operationalHistoryRetentionMonths} onChange={(value)=>set("operationalHistoryRetentionMonths",Number(value))}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="24">24 meses</option></Select></Field><Field label="Archivo comercial protegido" hint={`${archiveStats?.count || 0} comprobante(s). Se guardan como datos livianos y se imprimen o convierten a PDF cuando se necesitan.`}><span className="text-sm font-semibold">Mínimo 10 años</span></Field><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>onCleanOperationalHistory?.(current.operationalHistoryRetentionMonths)} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Trash2 size={15}/>Limpiar ahora</button><button type="button" onClick={()=>onExportCommercialArchive?.()} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white"><Download size={15}/>Exportar archivo</button></div><p className="text-xs text-gray-500">Los documentos internos de Kiosco+ siguen marcados como NO FISCAL · SIN CAE. Este archivo no reemplaza facturas oficiales emitidas ante ARCA.</p></div>}
  </main></div></div>;
}

export function applyPreferences(preferences = {}) {
  const value = { ...DEFAULT_PREFERENCES, ...preferences };
  const color = value.color === "personalizado" ? value.customAccent : (COLORS.find((item) => item.id === value.color)?.value || COLORS[0].value);
  const root = document.documentElement;
  root.style.setProperty("--brand-petroleo", "#1C4A44");
  root.style.setProperty("--brand-mostaza", "#E3A23C");
  root.style.setProperty("--brand-papel", "#F6F1E7");
  root.style.setProperty("--brand-tinta", "#2A241E");
  root.style.setProperty("--brand-sello", "#B8412F");
  root.style.setProperty("--app-accent", color);
  root.style.setProperty("--app-background", value.backgroundColor);
  root.style.setProperty("--app-menu", value.menuColor);
  const tone = (hex) => contrastText(hex) === "#ffffff" ? "dark" : "light";
  const menuTone = tone(value.menuColor); const backgroundTone = tone(value.backgroundColor); const accentTone = tone(color);
  const selectionColor = value.color === "petroleo" ? "#1C4A44" : mixHex(color, value.menuColor, accentTone === "dark" ? 0.78 : 0.9);
  const cardColor = mixHex(value.menuColor, value.backgroundColor, 0.82);
  const controlColor = mixHex(value.menuColor, value.backgroundColor, 0.68);
  const hoverColor = mixHex(value.menuColor, color, 0.82);
  const cardHoverColor = mixHex(cardColor, color, 0.84);
  root.dataset.menuTone = menuTone;
  root.dataset.backgroundTone = backgroundTone;
  root.dataset.accentTone = accentTone;
  root.dataset.cardTone = tone(cardColor);
  root.dataset.controlTone = tone(controlColor);
  root.style.setProperty("--app-menu-text", contrastText(value.menuColor));
  root.style.setProperty("--app-menu-muted", menuTone === "dark" ? "#cbd5e1" : "#64748b");
  root.style.setProperty("--app-background-text", contrastText(value.backgroundColor));
  root.style.setProperty("--app-background-muted", backgroundTone === "dark" ? "#cbd5e1" : "#64748b");
  root.style.setProperty("--app-accent-text", contrastText(color));
  root.style.setProperty("--app-selection", selectionColor);
  root.style.setProperty("--app-selection-text", contrastText(selectionColor));
  root.style.setProperty("--app-card", cardColor);
  root.style.setProperty("--app-card-text", contrastText(cardColor));
  root.style.setProperty("--app-control", controlColor);
  root.style.setProperty("--app-control-text", contrastText(controlColor));
  root.style.setProperty("--app-hover", hoverColor);
  root.style.setProperty("--app-hover-text", contrastText(hoverColor));
  root.style.setProperty("--app-card-hover", cardHoverColor);
  root.style.setProperty("--app-card-hover-text", contrastText(cardHoverColor));
  root.dataset.colorScope = value.colorScope;
  root.dataset.density = value.density;
  root.dataset.motion = value.motion;
  root.dataset.rounded = value.rounded;
  root.dataset.theme = value.theme;
  root.dataset.fontSize = value.fontSize;
  root.dataset.fontFamily = value.fontFamily;
  root.dataset.sidebarSize = value.sidebarSize;
  root.dataset.animationSpeed = value.animationSpeed;
  root.dataset.homeColumns = String(value.homeColumns);
  root.dataset.hideSensitive = value.hideSensitive ? "true" : "false";
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", value.color === "petroleo" ? "#1C4A44" : color);
  window.dispatchEvent(new CustomEvent("kiosco-contrast-refresh"));
}
