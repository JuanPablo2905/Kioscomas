import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight, Percent, FileSpreadsheet, Copy, FolderPlus,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money, formatQuantity } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { calcularPrecioSugerido } from "./pricing";
import { ScanModal } from "../../shared/ScanModal";
import { CustomSelect } from "../../shared/CustomSelect";
import { lookupBarcode } from "../../shared/productLookup";
import { ProductTransferModal } from "./ProductTransferModal";
import { NumberInput } from "../../shared/controls";
import { groupProductFamilies } from "../../shared/productFamilies";

const emptyForm = {
  nombre: "", codigo: "", costo: "", venta: "", deposito: "", minimo: "",
  alertaVitrina: "", categoria: "Sin categoría", unidad: "unidad", vencimiento: "", familia: "", variante: "",
};

function PreciosMasivosModal({ products, onClose, onApply }) {
  const [campo, setCampo] = useState("venta");
  const [modo, setModo] = useState("porcentaje");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const numero = Number(valor);
  const categorias = ["Todas", ...new Set(products.map((p) => p.categoria || "Sin categoría"))];
  const seleccionados = products.filter((p) => categoria === "Todas" || p.categoria === categoria);
  const calcular = (actual) => Math.max(0, Math.round((modo === "porcentaje" ? actual * (1 + numero / 100) : actual + numero) * 100) / 100);
  const preview = Number.isFinite(numero) ? seleccionados.slice(0, 5).map((p) => ({ ...p, nuevo: calcular(Number(p[campo]) || 0) })) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Actualización masiva de precios</h2><button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" aria-label="Cerrar"><X size={20}/></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-600">Precio a modificar<CustomSelect value={campo} onChange={setCampo} className="mt-1" options={[{value:"venta",label:"Precio de venta"},{value:"costo",label:"Precio de costo"}]}/></label>
          <label className="text-sm text-gray-600">Productos<CustomSelect value={categoria} onChange={setCategoria} className="mt-1" options={categorias}/></label>
          <label className="text-sm text-gray-600">Tipo de cambio<CustomSelect value={modo} onChange={setModo} className="mt-1" options={[{value:"porcentaje",label:"Por porcentaje"},{value:"monto",label:"Por monto fijo"}]}/></label>
          <label className="text-sm text-gray-600">{modo === "porcentaje" ? "Porcentaje (puede ser negativo)" : "Monto (puede ser negativo)"}<NumberInput value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 w-full" placeholder={modo === "porcentaje" ? "Ej: 10" : "Ej: 500"}/></label>
        </div>
        <div className="mt-5 rounded-lg bg-gray-50 p-3"><p className="mb-2 text-xs font-semibold text-gray-500">VISTA PREVIA · {seleccionados.length} PRODUCTO(S)</p>{preview.length === 0 ? <p className="text-sm text-gray-400">Ingresá un valor para ver los cambios.</p> : preview.map((p) => <div key={p.id} className="flex flex-col gap-0.5 py-1 text-sm sm:flex-row sm:justify-between sm:gap-3"><span className="min-w-0 truncate">{p.nombre}</span><span className="shrink-0">{money(p[campo])} → <b>{money(p.nuevo)}</b></span></div>)}{seleccionados.length > 5 && <p className="mt-1 text-xs text-gray-400">y {seleccionados.length - 5} producto(s) más...</p>}</div>
        <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={onClose} className="min-h-11 rounded-lg border px-3 py-2 text-sm">Cancelar</button><button disabled={!Number.isFinite(numero) || valor === "" || seleccionados.length === 0} onClick={() => onApply({ campo, modo, numero, categoria })} className="min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Aplicar cambios</button></div>
      </div>
    </div>
  );
}

export function ProductModal({ initial, onClose, onSave, proveedores = [], puedeEditarPrecios = true, preferences = {}, tutorialMode = false }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [margenDeseado, setMargenDeseado] = useState("30");
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false);
  // Los productos nuevos también reciben valores iniciales (mínimos, unidad,
  // código escaneado, etc.). Sólo es edición cuando ya existe un id.
  const isEdit = initial?.id !== undefined && initial?.id !== null;
  // Si ya es edición, vamos directo al paso 2 (ya sabemos la unidad).
  // Si es nuevo, arrancamos por el paso simple: nombre, código y unidad.
  const [step, setStep] = useState(isEdit ? 2 : 1);

  const info = unidadInfo(form.unidad);
  const precioSugerido = calcularPrecioSugerido(
    form.costo,
    info.factor,
    margenDeseado
  );
  const costoPorUnidadVenta = Number(form.costo) / info.factor;
  const margenActual =
    costoPorUnidadVenta > 0
      ? ((Number(form.venta) - costoPorUnidadVenta) / costoPorUnidadVenta) * 100
      : null;

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.nombre.trim()) return;
    onSave({
      ...form,
      costo: Number(form.costo) || 0,
      venta: Number(form.venta) || 0,
      deposito: Number(form.deposito) || 0,
      minimo: Number(form.minimo) || 0,
      alertaVitrina: Number(form.alertaVitrina) || 0,
      unidad: form.unidad || "unidad",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:max-h-[92vh] sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Editar producto" : "Nuevo producto"}
            {!isEdit && (
              <span className="text-sm font-normal text-gray-400"> · Paso {step} de 2</span>
            )}
          </h2>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {form.fuenteCatalogo && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            {form.imagenUrl && <img src={form.imagenUrl} alt="" className="h-12 w-12 rounded object-contain bg-white" />}
            <div><p className="text-sm font-semibold text-blue-900">Producto encontrado automáticamente</p><p className="text-xs text-blue-700">Fuente: {form.fuenteCatalogo}{form.descripcionCatalogo ? ` · ${form.descripcionCatalogo}` : ""}</p></div>
          </div>
        )}
        {form.productoNoEncontrado && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">El código no figura en el catálogo. Podés completar el producto manualmente y guardarlo normalmente.</div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div data-tour="product-name">
              <label className="text-sm text-gray-700 block mb-1">Nombre</label>
              <input
                autoFocus
                value={form.nombre}
                onChange={set("nombre")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div data-tour="product-code">
              <label className="text-sm text-gray-700 block mb-1">
                Código de barras
              </label>
              <input
                value={form.codigo}
                onChange={set("codigo")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div data-tour="product-family" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-sm text-gray-700">Familia</label><input value={form.familia || ""} onChange={set("familia")} placeholder="Ej: Coca-Cola" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/></div>
              <div><label className="mb-1 block text-sm text-gray-700">Variante</label><input value={form.variante || ""} onChange={set("variante")} placeholder="Ej: 1,25 L" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/></div>
            </div>

            <div data-tour="product-unit">
              <label className="text-sm text-gray-700 block mb-1">
                ¿Cómo se vende?
              </label>
              <div className="space-y-2">
                {UNIDAD_GRUPOS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setForm((f) => ({ ...f, unidad: u.id }))}
                    className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      form.unidad === u.id
                        ? "border-gray-900 bg-gray-50 font-medium text-gray-900"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <button
                onClick={onClose}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                data-tour="product-next"
                onClick={() => (form.nombre.trim() || tutorialMode) && setStep(2)}
                disabled={!form.nombre.trim() && !tutorialMode}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="space-y-4">
              {isEdit && <div>
                <label className="mb-1 block text-sm text-gray-700">Código de barras</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={form.codigo || ""} onChange={set("codigo")} inputMode="numeric" placeholder="Sin código" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"/>
                  <button type="button" onClick={() => setBarcodeScanOpen(true)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"><ScanLine size={16}/>Escanear</button>
                </div>
              </div>}
              {form.unidad === "unidad" ? (
                <div data-tour="product-prices" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-gray-700 block mb-1">
                      Precio de costo
                    </label>
                    <input
                      type="number"
                      disabled={!puedeEditarPrecios}
                      onFocus={(e) => e.target.select()}
                      value={form.costo}
                      onChange={set("costo")}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 block mb-1">
                      Precio de venta
                    </label>
                    <input
                      type="number"
                      disabled={!puedeEditarPrecios}
                      onFocus={(e) => e.target.select()}
                      value={form.venta}
                      onChange={set("venta")}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                    Este producto se compra por {info.baseLabel.toLowerCase()} y
                    se vende por {info.ventaLabel}. El stock se guarda en{" "}
                    {info.baseAbbr}, con decimales (ej: 3.5 {info.baseAbbr}).
                  </div>
                  <div data-tour="product-prices" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-gray-700 block mb-1">
                        Precio de costo por {info.baseLabel}
                      </label>
                      <input
                        type="number"
                        disabled={!puedeEditarPrecios}
                        onFocus={(e) => e.target.select()}
                        value={form.costo}
                        onChange={set("costo")}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-700 block mb-1">
                        Precio de venta por {info.ventaLabel}
                      </label>
                      <input
                        type="number"
                        disabled={!puedeEditarPrecios}
                        onFocus={(e) => e.target.select()}
                        value={form.venta}
                        onChange={set("venta")}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              <div data-tour="product-margin" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                  <div className="w-full sm:w-36">
                    <label className="text-xs font-medium text-emerald-900 block mb-1">
                      Margen deseado (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      onFocus={(e) => e.target.select()}
                      value={margenDeseado}
                      onChange={(e) => setMargenDeseado(e.target.value)}
                      className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-emerald-800">Precio sugerido</p>
                    <p className="text-lg font-bold text-emerald-900">
                      {precioSugerido === null ? "Cargá un costo válido" : money(precioSugerido)}
                      {form.unidad !== "unidad" && ` /${info.ventaAbbr}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={precioSugerido === null}
                    onClick={() =>
                      precioSugerido !== null &&
                      setForm((current) => ({ ...current, venta: String(precioSugerido) }))
                    }
                    className="min-h-11 rounded-lg border border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                  >
                    Aplicar
                  </button>
                </div>
                {margenActual !== null && (
                  <p className="text-[11px] text-emerald-800 mt-2">
                    Margen actual: {margenActual.toFixed(1)}%.
                  </p>
                )}
              </div>

              <div data-tour="product-stock" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-gray-700 block mb-1">
                    Stock en depósito ({info.baseAbbr})
                  </label>
                  <input
                    type="number"
                    onFocus={(e) => e.target.select()}
                    step="any"
                    value={form.deposito}
                    onChange={set("deposito")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 block mb-1">
                    Stock mínimo ({info.baseAbbr}, alerta)
                  </label>
                  <input
                    type="number"
                    onFocus={(e) => e.target.select()}
                    step="any"
                    value={form.minimo}
                    onChange={set("minimo")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div data-tour="product-showcase-alert">
                <label className="text-sm text-gray-700 block mb-1">
                  Alerta de reposición en vitrina ({info.baseAbbr})
                </label>
                <input
                  type="number"
                  onFocus={(e) => e.target.select()}
                  step="any"
                  value={form.alertaVitrina}
                  onChange={set("alertaVitrina")}
                  placeholder="Ej: 2"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div data-tour="product-details">
                <label className="text-sm text-gray-700 block mb-1">Categoría</label>
                <CustomSelect value={form.categoria} onChange={(value) => setForm((current) => ({ ...current, categoria: value }))} options={CATEGORIES}/>
              </div>
              {isEdit && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm text-gray-700">Familia</label><input value={form.familia || ""} onChange={set("familia")} placeholder="Ej: Coca-Cola" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/></div><div><label className="mb-1 block text-sm text-gray-700">Variante</label><input value={form.variante || ""} onChange={set("variante")} placeholder="Ej: 1,25 L" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/></div></div>}
              <div data-tour="product-details">
                <label className="text-sm text-gray-700 block mb-1">Proveedor habitual</label>
                <CustomSelect value={form.proveedorId || ""} onChange={(value) => setForm((current) => ({ ...current, proveedorId: value ? Number(value) : null }))} options={[{value:"",label:"Sin proveedor asociado"}, ...proveedores.map((proveedor) => ({value:proveedor.id,label:proveedor.nombre}))]}/>
              </div>
              <div data-tour="product-details">
                <label className="text-sm text-gray-700 block mb-1">Fecha de vencimiento</label>
                <input type="date" value={form.vencimiento || ""} onChange={set("vencimiento")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-gray-400">Dejala vacía si el producto no vence.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6">
              {!isEdit ? (
                <button
                  onClick={() => setStep(1)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Atrás
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
              <button
                data-tour="product-save"
                onClick={handleSave}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
      {barcodeScanOpen && <ScanModal confirmationTitle="Usar código de barras" confirmLabel="Usar este código" preferences={preferences} onClose={() => setBarcodeScanOpen(false)} onDetected={(code) => { setForm((current) => ({ ...current, codigo: String(code).trim() })); setBarcodeScanOpen(false); return true; }}/>} 
    </div>
  );
}

function LegacyScanModal({ onClose, onDetected }) {
  const [manualCode, setManualCode] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 text-center sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Escanear código</h2>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center mb-4">
          <ScanLine size={32} className="text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-3">
          El acceso a la cámara real lo conectamos en el próximo paso. Por
          ahora, cargá el código a mano para probar el flujo.
        </p>
        <input
          autoFocus
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Código de barras"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={() => onDetected(manualCode)}
          disabled={!manualCode.trim()}
          className="w-full bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
        >
          Usar código
        </button>
      </div>
    </div>
  );
}

function HistorialProductoModal({ producto, onClose }) {
  const historial = producto.historial || [];
  const iconos = {
    creacion: <Plus size={13} className="text-gray-500" />,
    edicion: <Pencil size={13} className="text-blue-600" />,
    reposicion: <PackageCheck size={13} className="text-green-600" />,
    venta: <ShoppingCart size={13} className="text-orange-600" />,
    eliminacion: <Trash2 size={13} className="text-red-600" />,
  };
  const etiquetas = {
    creacion: "Creación",
    edicion: "Edición",
    reposicion: "Reposición",
    venta: "Venta",
    eliminacion: "Eliminación",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Historial de {producto.nombre}
          </h2>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {historial.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              Todavía no hay movimientos registrados para este producto.
            </p>
          )}
          {[...historial].reverse().map((h) => (
            <div key={h.id} className="border border-gray-200 rounded-lg px-3 py-2">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                {iconos[h.tipo]}
                <p className="text-sm font-medium text-gray-900">
                  {etiquetas[h.tipo] || h.tipo}
                </p>
                <span className="w-full text-xs text-gray-400 sm:ml-auto sm:w-auto">{h.fecha}</span>
              </div>
              <p className="text-xs text-gray-600">{h.detalle}</p>
              <p className="mt-1 text-[11px] text-gray-400">
                {h.usuario ? `${h.usuario} · ${h.rol || "Rol sin registrar"}` : "Autor no registrado · movimiento anterior a la auditoría completa"}
              </p>
              {h.origen === "administracion_app" && <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Administración de la app</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StockView({ products, setProducts, proveedores = [], puedeEditarPrecios = true, puedeEliminar = true, puedeCrearDirecto = true, sugerencias = [], setSugerencias, identidad, preferences = {}, tutorialMode = false, initialProduct = null, onInitialProductHandled }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanInitialMode, setScanInitialMode] = useState("manual");
  const [resumeScannerAfterProduct, setResumeScannerAfterProduct] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historialProducto, setHistorialProducto] = useState(null);
  const [preciosMasivosOpen, setPreciosMasivosOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferNotice, setTransferNotice] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState(() => new Set());
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupProductQuery, setGroupProductQuery] = useState("");
  const [groupSelection, setGroupSelection] = useState(() => new Set());

  useEffect(() => {
    if (!initialProduct) return;
    setResumeScannerAfterProduct(Boolean(initialProduct._resumeScanner));
    const { _resumeScanner, ...catalogProduct } = initialProduct;
    setEditing({
      ...emptyForm,
      minimo: String(preferences.stockMinDefault ?? 3),
      alertaVitrina: String(preferences.vitrinaAlertDefault ?? 1),
      ...catalogProduct,
    });
    setModalOpen(true);
    onInitialProductHandled?.();
  }, [initialProduct]);

  const lowStock = products.filter((p) => p.deposito <= p.minimo);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) || String(p.codigo || "").toLowerCase().includes(q) || String(p.familia || "").toLowerCase().includes(q) || String(p.variante || "").toLowerCase().includes(q) || String(p.vitrinaGrupo || "").toLowerCase().includes(q)
    );
  }, [products, query]);
  const customGroups = useMemo(() => [...new Set(products.map((product) => product.vitrinaGrupo).filter(Boolean))].map((name) => ({ name, products: filtered.filter((product) => product.vitrinaGrupo === name) })).filter((group) => group.products.length), [products, filtered]);
  const productFamilies = useMemo(() => groupProductFamilies(filtered.filter((product) => !product.vitrinaGrupo)), [filtered]);
  const visibleRows = useMemo(() => [...customGroups.flatMap((group) => {
    const key = `custom:${group.name}`;
    return [{ __customGroup: true, key, name: group.name, products: group.products }, ...(expandedFamilies.has(key) ? group.products.map((product) => ({ ...product, __customGroupName: group.name })) : [])];
  }), ...productFamilies.flatMap((family) => family.products.length === 1
    ? family.products
    : [{ __family: true, ...family }, ...(expandedFamilies.has(family.key) ? family.products.map((product) => ({ ...product, __familyName: family.name })) : [])])], [customGroups, productFamilies, expandedFamilies]);
  const toggleFamily = (key) => setExpandedFamilies((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const groupPickerProducts = useMemo(() => {
    const value = groupProductQuery.trim().toLocaleLowerCase("es");
    return value ? products.filter((product) => [product.nombre, product.codigo, product.familia, product.variante, product.vitrinaGrupo].some((field) => String(field || "").toLocaleLowerCase("es").includes(value))) : products;
  }, [products, groupProductQuery]);
  const saveCustomGroup = () => {
    const name = groupName.trim();
    if (!name || groupSelection.size === 0) return;
    setProducts((previous) => previous.map((product) => groupSelection.has(product.id) ? { ...product, vitrinaGrupo: name } : product));
    setExpandedFamilies((previous) => new Set(previous).add(`custom:${name}`));
    setGroupName("");
    setGroupProductQuery("");
    setGroupSelection(new Set());
    setGroupEditorOpen(false);
  };
  const removeCustomGroup = (name) => setProducts((previous) => previous.map((product) => product.vitrinaGrupo === name ? { ...product, vitrinaGrupo: "" } : product));

  const openNew = () => {
    setResumeScannerAfterProduct(false);
    setEditing({ ...emptyForm, minimo: String(preferences.stockMinDefault ?? 3), alertaVitrina: String(preferences.vitrinaAlertDefault ?? 1) });
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setResumeScannerAfterProduct(false);
    setEditing(product);
    setModalOpen(true);
  };

  const openDuplicate = (product) => {
    setResumeScannerAfterProduct(false);
    const { id, historial, codigo, deposito, vitrina, _syncVersion, _syncDeletedAt, ...base } = product;
    setEditing({ ...emptyForm, ...base, nombre: `${product.nombre} - nueva variante`, codigo: "", deposito: "0", vitrina: 0, familia: product.familia || product.nombre, variante: "" });
    setModalOpen(true);
  };

  const CAMPOS_HISTORIAL = [
    ["nombre", "Nombre"],
    ["codigo", "Código de barras"],
    ["costo", "Precio de costo"],
    ["venta", "Precio de venta"],
    ["deposito", "Stock en depósito"],
    ["minimo", "Stock mínimo"],
    ["alertaVitrina", "Alerta de vitrina"],
    ["categoria", "Categoría"],
    ["familia", "Familia"],
    ["variante", "Variante"],
    ["unidad", "Unidad"],
  ];

  const finishProductFlow = () => {
    setModalOpen(false);
    setEditing(null);
    if (resumeScannerAfterProduct) {
      setResumeScannerAfterProduct(false);
      setScanInitialMode("camera");
      window.setTimeout(() => setScanOpen(true), 0);
    }
  };

  const handleSave = (data) => {
    if (editing && !puedeEditarPrecios) {
      data = { ...data, costo: editing.costo, venta: editing.venta };
    }
    if (!editing?.id && !puedeCrearDirecto && setSugerencias) {
      setSugerencias((prev) => [...prev, { id: Date.now(), tipo: "nuevo_producto", estado: "pendiente", data, autor: identidad?.nombre || identidad?.rol || "Empleado", fecha: new Date().toISOString() }]);
      finishProductFlow(); return;
    }
    if (editing && editing.id) {
      const cambios = CAMPOS_HISTORIAL.filter(
        ([campo]) => String(editing[campo]) !== String(data[campo])
      ).map(([campo, label]) => `${label}: ${editing[campo]} → ${data[campo]}`);

      setProducts((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? {
                ...p,
                ...data,
                historial:
                  cambios.length > 0
                    ? [
                        ...(p.historial || []),
                        historialEntry("edicion", cambios.join(" · ")),
                      ]
                    : p.historial || [],
              }
            : p
        )
      );
    } else {
      setProducts((prev) => [
        ...prev,
        {
          id: Date.now(),
          vitrina: 0,
          ...data,
          historial: [historialEntry("creacion", "Producto creado")],
        },
      ]);
    }
    finishProductFlow();
  };

  const handleDelete = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleScanned = (code) => {
    setResumeScannerAfterProduct(true);
    const existing = products.find((product) => String(product.codigo) === String(code).trim());
    if (existing) {
      setScanOpen(false); setEditing(existing); setModalOpen(true); return;
    }
    return lookupBarcode(code).then((found) => {
      setScanOpen(false);
      setEditing({ ...emptyForm, codigo: String(code).trim(), ...(found || {}), productoNoEncontrado: !found });
      setModalOpen(true);
    });
  };

  const handlePreciosMasivos = ({ campo, modo, numero, categoria }) => {
    setProducts((prev) => prev.map((product) => {
      if (categoria !== "Todas" && product.categoria !== categoria) return product;
      const anterior = Number(product[campo]) || 0;
      const nuevo = Math.max(0, Math.round((modo === "porcentaje" ? anterior * (1 + numero / 100) : anterior + numero) * 100) / 100);
      if (nuevo === anterior) return product;
      return { ...product, [campo]: nuevo, historial: [...(product.historial || []), historialEntry("edicion", `Actualización masiva · ${campo === "venta" ? "Precio de venta" : "Precio de costo"}: ${anterior} → ${nuevo}`)] };
    }));
    setPreciosMasivosOpen(false);
  };

  return (
    <div className="p-4 sm:p-8">
      <SectionHeader
        title="Gestión de Stock"
        actions={
          <div className="stock-header-actions grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button data-tour="stock-transfer" onClick={() => setTransferOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"><FileSpreadsheet size={16}/>Excel / CSV</button>
            {puedeEditarPrecios && <button
              data-tour="stock-prices"
              onClick={() => setPreciosMasivosOpen(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Percent size={16} />
              Precios masivos
            </button>}
            <button
              data-tour="stock-groups"
              onClick={() => setGroupEditorOpen((value) => !value)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <FolderPlus size={16} />
              Grupos
            </button>
            <button
              data-tour="stock-scan"
              onClick={() => setScanOpen(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <ScanLine size={16} />
              Escanear
            </button>
            <button
              data-tour="stock-new"
              onClick={openNew}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Plus size={16} />
              Nuevo
            </button>
          </div>
        }
      />

      {groupEditorOpen && (
        <div className="vitrina-group-editor mb-4 rounded-xl border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Crear grupo personalizado</h3>
              <p className="mt-1 text-xs opacity-65">El grupo se comparte con Stock y Vitrina.</p>
            </div>
            <button type="button" onClick={() => setGroupEditorOpen(false)} className="rounded-lg p-2 opacity-55 hover:bg-black/5" aria-label="Cerrar"><X size={17}/></button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nombre del grupo" className="min-h-11 rounded-lg border px-3 text-sm"/>
            <button type="button" onClick={saveCustomGroup} disabled={!groupName.trim() || !groupSelection.size} className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40">Guardar grupo</button>
          </div>
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"/>
            <input value={groupProductQuery} onChange={(event) => setGroupProductQuery(event.target.value)} placeholder="Buscar productos por nombre, código, familia o grupo..." className="min-h-11 w-full rounded-lg border bg-[var(--app-control)] py-2 pl-9 pr-9 text-sm text-[var(--app-control-text)]"/>
            {groupProductQuery && <button type="button" onClick={() => setGroupProductQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-50" aria-label="Limpiar búsqueda"><X size={15}/></button>}
          </div>
          <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {groupPickerProducts.map((product) => (
              <label key={product.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${groupSelection.has(product.id) ? "bg-blue-50" : ""}`}>
                <input type="checkbox" checked={groupSelection.has(product.id)} onChange={() => setGroupSelection((previous) => { const next = new Set(previous); next.has(product.id) ? next.delete(product.id) : next.add(product.id); return next; })}/>
                <span className="min-w-0 flex-1 truncate">{product.nombre}</span>
                {product.vitrinaGrupo && <small className="shrink-0 opacity-60">{product.vitrinaGrupo}</small>}
              </label>
            ))}
            {groupPickerProducts.length === 0 && <p className="col-span-full p-4 text-center text-sm opacity-60">No hay coincidencias.</p>}
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
          <AlertTriangle size={15} />
          {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con
          stock bajo
        </div>
      )}
      {transferNotice && <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Importación completada: {transferNotice}.</div>}

      {!puedeCrearDirecto && sugerencias.filter((s) => s.estado === "pendiente").length > 0 && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">Tenés {sugerencias.filter((s) => s.estado === "pendiente").length} sugerencia(s) esperando aprobación del dueño.</div>
      )}

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o código de barras..."
          className="min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
            No se encontraron productos.
          </div>
        )}

        {visibleRows.map((p) => {
          if (p.__customGroup) return <div key={p.key} className="stock-family-card flex min-h-12 items-stretch overflow-hidden rounded-xl border bg-white">
            <button type="button" onClick={() => toggleFamily(p.key)} className="product-family-trigger flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="min-w-0"><b className="block break-words sm:inline">{p.name}</b><small className="mt-0.5 block text-gray-500 sm:ml-2 sm:mt-0 sm:inline">{p.products.length} producto{p.products.length === 1 ? "" : "s"} · {formatQuantity(p.products.reduce((sum, item) => sum + Number(item.deposito || 0), 0))} en depósito</small></span>
              <ChevronRight size={18} className={`shrink-0 transition-transform ${expandedFamilies.has(p.key) ? "rotate-90" : ""}`}/>
            </button>
            <button type="button" onClick={() => removeCustomGroup(p.name)} className="border-l px-3 text-xs font-medium text-red-600 hover:bg-red-50" title="Quitar el grupo sin borrar sus productos">Desarmar</button>
          </div>;
          if (p.__family) return <button key={`family-${p.key}`} onClick={() => toggleFamily(p.key)} className="stock-family-card product-family-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left">
            <span className="min-w-0"><b className="block break-words sm:inline">{p.name}</b><small className="mt-0.5 block text-gray-500 sm:ml-2 sm:mt-0 sm:inline">{p.products.length} variantes · {formatQuantity(p.products.reduce((sum, item) => sum + Number(item.deposito || 0), 0))} en depósito</small></span>
            <ChevronRight size={18} className={`transition-transform ${expandedFamilies.has(p.key) ? "rotate-90" : ""}`}/>
          </button>;
          const isLow = p.deposito <= p.minimo;
          return (
            <div
              key={p.id}
              className={`stock-product-row grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-l-4 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex sm:items-center sm:justify-between sm:gap-0 ${
                isLow ? "is-low border-red-200 bg-red-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className={`stock-product-identity col-span-2 flex min-w-0 items-start gap-3 sm:min-w-[190px] ${p.__familyName || p.__customGroupName ? "ml-3 sm:ml-5" : ""}`}>
                <span className={`stock-product-icon mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${isLow ? "is-low" : ""}`}>
                  {isLow ? <AlertTriangle size={17}/> : <Package size={17}/>}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-gray-900">{p.nombre}</p>
                  <p className="text-xs text-gray-500">
                    {p.codigo || "Sin código"}
                  </p>
                  {p.__customGroupName && <p className="mt-1 text-[11px] font-medium text-violet-600">{p.__customGroupName}</p>}
                  {(p.familia || p.variante) && <p className="mt-1 text-[11px] font-medium text-blue-600">{[p.familia, p.variante].filter(Boolean).join(" · ")}</p>}
                </div>
              </div>
              <div className="stock-product-field min-w-0 text-sm text-gray-600 sm:min-w-[110px]">
                Costo: {money(p.costo)}
                {p.unidad !== "unidad" && (
                  <span className="text-gray-400">
                    /{unidadInfo(p.unidad).baseAbbr}
                  </span>
                )}
              </div>
              <div className="stock-product-field min-w-0 text-sm text-gray-600 sm:min-w-[110px]">
                Venta: {money(p.venta)}
                {p.unidad !== "unidad" && (
                  <span className="text-gray-400">
                    /{unidadInfo(p.unidad).ventaAbbr}
                  </span>
                )}
              </div>
              <div className="stock-product-field min-w-0 text-sm text-gray-600 sm:min-w-[90px]">
                Vitrina: {formatQuantity(p.vitrina)} {unidadInfo(p.unidad).baseAbbr}
              </div>
              <div
                className={`stock-product-stock flex min-w-0 items-center gap-1 text-sm font-bold sm:min-w-[70px] ${
                  isLow ? "text-red-600" : "text-gray-900"
                }`}
              >
                {formatQuantity(p.deposito)} {unidadInfo(p.unidad).baseAbbr}
                {isLow && <AlertTriangle size={14} />}
              </div>
              <div data-tour="stock-product-actions" className="stock-product-actions col-span-2 flex justify-end gap-1 border-t pt-2 sm:border-0 sm:pt-0">
                <button onClick={() => openDuplicate(p)} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-blue-600" title="Duplicar como variante"><Copy size={16} /></button>
                <button
                  onClick={() => setHistorialProducto(p)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900"
                  title="Ver historial"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900"
                >
                  <Pencil size={16} />
                </button>
                {puedeEliminar && <button
                  onClick={() => handleDelete(p.id)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ProductModal
          initial={editing}
          onClose={() => {
            finishProductFlow();
          }}
          onSave={handleSave}
          proveedores={proveedores}
          puedeEditarPrecios={puedeEditarPrecios}
          preferences={preferences}
          tutorialMode={tutorialMode}
        />
      )}

      {scanOpen && (
        <ScanModal initialMode={scanInitialMode} products={products} preferences={preferences} onClose={() => { setScanOpen(false); setScanInitialMode("manual"); }} onDetected={handleScanned} />
      )}

      {historialProducto && (
        <HistorialProductoModal
          producto={historialProducto}
          onClose={() => setHistorialProducto(null)}
        />
      )}

      {preciosMasivosOpen && (
        <PreciosMasivosModal products={products} onClose={() => setPreciosMasivosOpen(false)} onApply={handlePreciosMasivos} />
      )}
      {transferOpen && <ProductTransferModal products={products} setProducts={setProducts} onClose={(notice) => { setTransferOpen(false); if (notice) setTransferNotice(notice); }}/>} 
    </div>
  );
}
