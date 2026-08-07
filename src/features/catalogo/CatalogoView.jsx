import React, { useEffect, useMemo, useState } from "react";
import { Barcode, CheckCircle2, Image, Pencil, Plus, Search, Store, X } from "lucide-react";
import { cloudFetch, cloudSession, loginCloud } from "../../cloud/cloudAuth";
import { loadCloudConfig } from "../../cloud/config";
import { clearBarcodeCache, rememberBarcode } from "../../shared/productLookup";
import { historialEntry } from "../../shared/domain";

const EMPTY = { codigo: "", nombre: "", categoria: "Sin categoría", familia: "", variante: "", unidad: "unidad", descripcionCatalogo: "", imagenUrl: "" };
const FILTERS = [
  ["all", "Todos"], ["stock", "En stock"], ["pending", "Pendientes"], ["unidentified", "Sin identificar"],
];

function requestContext() {
  const config = loadCloudConfig();
  const session = cloudSession();
  return { config, session, tenantId: session?.user?.businessId };
}

export function CatalogoView({ products, setProducts, tenantId, setSugerencias, identidad, preferences = {} }) {
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [serverItems, setServerItems] = useState(null);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cloudUsername, setCloudUsername] = useState("demo");
  const [cloudPassword, setCloudPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setDeferredQuery(query); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const isAdminSession = requestContext()?.session?.user?.role === "superAdmin";

  const load = async () => {
    const context = requestContext();
    if (!context.config.enabled || !context.config.apiUrl || !context.config.deviceId) {
      setServerItems([]);
      setServerError("Sin conexión al catálogo compartido. Activá la sincronización y configurá el servidor en Nube y dispositivos.");
      return;
    }
    setLoading(true); setServerError("");
    try {
      const response = await cloudFetch(context.config.apiUrl, "/v1/catalog", { headers: { "x-device-id": context.config.deviceId, "x-tenant-id": String(tenantId || context.tenantId || "") } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "No se pudo leer el catálogo compartido");
      setServerItems(json.items || []);
    } catch (cause) {
      setServerItems([]);
      setServerError(cause.message || "No se pudo leer el catálogo compartido");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sessionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const allRows = useMemo(() => {
    const stockByCode = new Map();
    (products || []).forEach((product) => {
      if (!product?.codigo) return;
      const key = String(product.codigo).replace(/\D/g, "");
      if (key.length >= 6) stockByCode.set(key, product);
    });
    const map = new Map();
    (serverItems || []).forEach((item) => {
      const code = String(item.codigo || "").replace(/\D/g, "");
      if (!code) return;
      const local = stockByCode.get(code);
      map.set(code, {
        codigo: code,
        product: item.product || null,
        status: item.product ? "verified" : (item.pendingVerification ? "pending" : "unresolved"),
        pendingVerification: !!item.pendingVerification,
        updatedAt: item.updatedAt || null,
        inStock: !!local,
        stockProduct: local || null,
      });
    });
    stockByCode.forEach((local, code) => {
      if (!map.has(code)) {
        map.set(code, { codigo: code, product: null, status: "local", pendingVerification: false, updatedAt: null, inStock: true, stockProduct: local });
      }
    });
    return [...map.values()].sort((left, right) => String(left.codigo).localeCompare(String(right.codigo)));
  }, [serverItems, products]);

  const rows = useMemo(() => {
    let list = allRows;
    const q = deferredQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => [row.codigo, row.product?.nombre, row.product?.variante, row.stockProduct?.nombre, row.stockProduct?.variante].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
    }
    if (filter === "stock") list = list.filter((row) => row.inStock);
    if (filter === "pending") list = list.filter((row) => row.status === "pending");
    if (filter === "unidentified") list = list.filter((row) => row.status === "unresolved" || row.status === "pending");
    return list;
  }, [allRows, deferredQuery, filter]);

  const counts = useMemo(() => ({
    stock: allRows.filter((row) => row.inStock).length,
    pending: allRows.filter((row) => row.status === "pending").length,
    unidentified: allRows.filter((row) => row.status === "unresolved" || row.status === "pending").length,
  }), [allRows]);

  const connectAdministrator = async () => {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl || !config.deviceId) {
      setError("Primero activá la sincronización y configurá el servidor en Nube y dispositivos.");
      return;
    }
    if (!cloudUsername.trim() || !cloudPassword) return;
    setConnecting(true); setError("");
    try {
      const session = await loginCloud(config.apiUrl, cloudUsername.trim(), cloudPassword, config.deviceId);
      if (session.user?.role !== "superAdmin") throw new Error("Esta cuenta pertenece a un negocio y no administra Kiosco+.");
      setCloudPassword("");
      setNotice("Cuenta administradora conectada.");
      setSessionVersion((value) => value + 1);
    } catch (cause) {
      setError(cause.message || "No se pudo conectar la cuenta administradora.");
    } finally { setConnecting(false); }
  };

  const openNew = () => { setForm(EMPTY); setEditor("new"); setError(""); setNotice(""); };
  const openEdit = (row) => {
    const base = row.product || row.stockProduct || {};
    setForm({
      ...EMPTY,
      ...(base.nombre ? { nombre: base.nombre, categoria: base.categoria || "Sin categoría", familia: base.familia || "", variante: base.variante || "", unidad: base.unidad || "unidad", descripcionCatalogo: base.descripcionCatalogo || "", imagenUrl: base.imagenUrl || "" } : {}),
      codigo: row.codigo,
    });
    setEditor(row.codigo);
    setError("");
    setNotice("");
  };
  const closeEditor = () => { if (!saving) { setEditor(null); setError(""); } };

  const save = async () => {
    const context = requestContext();
    const codigo = String(form.codigo || "").replace(/\D/g, "");
    if (codigo.length < 6) return setError("Ingresá un código de barras válido (mínimo 6 dígitos).");
    if (!form.nombre.trim()) return setError("Completá el nombre del producto.");
    if (!isAdminSession) return setError("Se requiere la cuenta administradora de Kiosco+ para modificar el catálogo compartido.");
    setSaving(true); setError(""); setNotice("");
    try {
      const product = { codigo, nombre: form.nombre.trim(), categoria: form.categoria || "Sin categoría", familia: form.familia || "", variante: form.variante || "", unidad: form.unidad || "unidad", descripcionCatalogo: form.descripcionCatalogo || "", imagenUrl: form.imagenUrl || "" };
      const response = await cloudFetch(context.config.apiUrl, `/v1/admin/catalog/${codigo}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-device-id": context.config.deviceId, "x-tenant-id": String(context.tenantId || tenantId || "") },
        body: JSON.stringify({ product }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "No se pudo guardar el producto en el catálogo");
      clearBarcodeCache(codigo);
      rememberBarcode(codigo, product);
      const local = (products || []).find((item) => item.codigo && String(item.codigo).replace(/\D/g, "") === codigo);
      if (local) {
        setSugerencias((prev) => [...prev, { id: Date.now(), tipo: "actualizar_producto", estado: "pendiente", data: { codigo, nombre: product.nombre, categoria: product.categoria, familia: product.familia, variante: product.variante, unidad: product.unidad, imagenUrl: product.imagenUrl, descripcionCatalogo: product.descripcionCatalogo }, autor: identidad?.nombre || "Catálogo de Kiosco+", fecha: new Date().toISOString() }]);
      }
      setEditor(null);
      setNotice(local ? "Producto guardado en el catálogo. Se generó una sugerencia para actualizarlo en este negocio (Administración)." : "Producto guardado en el catálogo compartido.");
      await load();
    } catch (cause) { setError(cause.message || "No se pudo guardar."); }
    finally { setSaving(false); }
  };

  const applyToBusiness = (row) => {
    const info = row.product;
    if (!info?.nombre) return;
    const local = (products || []).find((item) => item.codigo && String(item.codigo).replace(/\D/g, "") === row.codigo);
    setError(""); setNotice("");
    if (local) {
      setProducts((prev) => prev.map((item) => item.id === local.id ? {
        ...item,
        nombre: info.nombre,
        categoria: info.categoria || item.categoria,
        familia: info.familia ?? item.familia,
        variante: info.variante ?? item.variante,
        unidad: info.unidad || item.unidad || "unidad",
        imagenUrl: info.imagenUrl ?? item.imagenUrl,
        descripcionCatalogo: info.descripcionCatalogo ?? item.descripcionCatalogo,
        historial: [...(item.historial || []), historialEntry("actualizacion", "Datos actualizados desde el catálogo de Kiosco+")],
      } : item));
      setNotice("Se actualizaron los datos del producto en este negocio.");
    } else {
      setProducts((prev) => [...prev, {
        id: Date.now(),
        nombre: info.nombre,
        codigo: row.codigo,
        categoria: info.categoria || "Sin categoría",
        familia: info.familia || "",
        variante: info.variante || "",
        unidad: info.unidad || "unidad",
        imagenUrl: info.imagenUrl || "",
        descripcionCatalogo: info.descripcionCatalogo || "",
        costo: 0,
        venta: 0,
        deposito: 0,
        vitrina: 0,
        minimo: Number(preferences.stockMinDefault ?? 3),
        alertaVitrina: Number(preferences.vitrinaAlertDefault ?? 1),
        vencimiento: "",
        historial: [historialEntry("creacion", "Producto agregado desde el catálogo de Kiosco+")],
      }]);
      setNotice("Producto agregado al stock de este negocio. Cargá precio y stock desde Stock.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">Catálogo de Kiosco+</h1>
        <p className="text-sm text-gray-500">Productos y códigos de barras compartidos. Crear o corregir un producto acá lo deja disponible para todos los negocios.</p>
      </div>

      {!isAdminSession && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">Conectar administración central</p>
          <p className="mt-1 text-sm text-amber-800">La sesión de un negocio no permite modificar el catálogo compartido. Iniciá sesión con la cuenta administradora de Kiosco+ (demo / 1234).</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={cloudUsername} onChange={(event) => setCloudUsername(event.target.value)} placeholder="Usuario administrador" className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
            <input type="password" value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && connectAdministrator()} placeholder="Contraseña del servidor" className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
            <button onClick={connectAdministrator} disabled={connecting || !cloudPassword} className="rounded-lg bg-[#1C4A44] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{connecting ? "Conectando..." : "Conectar"}</button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <Search size={18} className="text-gray-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, nombre o variante..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
        </label>
        <button onClick={openNew} disabled={!isAdminSession} className="flex items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Plus size={17}/>Agregar producto</button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? "border-[#1C4A44] bg-[#1C4A44] text-white" : "border-gray-200 bg-white text-gray-600"}`}>
            {label}{value !== "all" && counts[value] !== undefined ? ` (${counts[value]})` : ""}
          </button>
        ))}
      </div>

      {error && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
      {notice && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
      {serverError && <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{serverError}</div>}

      <div className="mt-4 space-y-2">
        {loading && <p className="py-8 text-center text-sm text-gray-500">Cargando catálogo...</p>}
        {!loading && serverItems !== null && rows.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">No hay productos para este filtro.</p>}
        {!loading && rows.map((row) => {
          const info = row.product || row.stockProduct || {};
          const nombre = info.nombre || "Producto sin identificar";
          return (
            <article key={row.codigo} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[52px_1fr_auto] sm:items-center">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-gray-100">{info.imagenUrl ? <img src={info.imagenUrl} alt="" className="h-full w-full object-contain"/> : <Barcode size={23} className="text-gray-400"/>}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{nombre}</p>
                  {row.status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Pendiente de verificar</span>}
                  {row.status === "unresolved" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">No identificado</span>}
                  {row.status === "local" && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Solo en este negocio</span>}
                  {row.status === "verified" && row.inStock && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">En este negocio</span>}
                  {row.status === "verified" && !row.inStock && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">En catálogo</span>}
                </div>
                <p className="mt-0.5 font-mono text-xs text-gray-500">{row.codigo}</p>
                <p className="mt-1 text-xs text-gray-500">{[info.categoria, info.variante].filter(Boolean).join(" · ") || "Sin categoría"}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end">
                {row.status === "local" && (
                  <button onClick={() => openEdit(row)} disabled={!isAdminSession} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"><Plus size={14}/>Guardar en catálogo</button>
                )}
                {row.status !== "local" && (
                  <button onClick={() => openEdit(row)} disabled={!isAdminSession} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"><Pencil size={14}/>{row.product ? "Editar" : "Completar"}</button>
                )}
                {row.product && row.inStock && (
                  <button onClick={() => applyToBusiness(row)} className="flex items-center justify-center gap-2 rounded-lg border border-[#1C4A44] bg-[#1C4A44]/5 px-3 py-2 text-xs font-semibold text-[#1C4A44]"><Store size={14}/>Actualizar negocio</button>
                )}
                {row.product && !row.inStock && (
                  <button onClick={() => applyToBusiness(row)} className="flex items-center justify-center gap-2 rounded-lg bg-[#1C4A44] px-3 py-2 text-xs font-semibold text-white"><Store size={14}/>Agregar a este negocio</button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {editor && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/60 p-3" onMouseDown={closeEditor}><div className="my-auto w-full max-w-2xl rounded-2xl bg-[#FFFCF6] p-4 shadow-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xl font-bold">{editor === "new" ? "Agregar al catálogo" : (allRows.find((row) => row.codigo === editor)?.product ? "Editar producto del catálogo" : "Identificar producto del catálogo")}</p><p className="mt-1 text-sm text-gray-500">Esta corrección quedará disponible para todos los negocios.</p></div>
          <button onClick={closeEditor} className="rounded-lg border p-2"><X size={18}/></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Código de barras<input value={form.codigo} disabled={editor !== "new"} onChange={(event) => setForm({ ...form, codigo: event.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 disabled:bg-gray-100" inputMode="numeric"/></label>
          <label className="text-sm font-medium">Nombre del producto<input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Categoría<input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Unidad<input value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })} placeholder="unidad, kg, litro..." className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Familia<input value={form.familia} onChange={(event) => setForm({ ...form, familia: event.target.value })} placeholder="Ej: Coca-Cola" className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Variante<input value={form.variante} onChange={(event) => setForm({ ...form, variante: event.target.value })} placeholder="Ej: Zero 1,5 L" className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">Descripción<input value={form.descripcionCatalogo} onChange={(event) => setForm({ ...form, descripcionCatalogo: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">URL de la imagen<div className="mt-1 flex gap-2"><input value={form.imagenUrl} onChange={(event) => setForm({ ...form, imagenUrl: event.target.value })} placeholder="https://..." className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2"/><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border bg-white">{form.imagenUrl ? <img src={form.imagenUrl} alt="Vista previa" className="h-full w-full object-contain"/> : <Image size={18}/>}</div></div></label>
        </div>
        {error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={closeEditor} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button>
          <button onClick={save} disabled={saving || !isAdminSession} className="flex items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : <><CheckCircle2 size={17}/>Guardar en catálogo</>}</button>
        </div>
      </div></div>}
    </div>
  );
}
