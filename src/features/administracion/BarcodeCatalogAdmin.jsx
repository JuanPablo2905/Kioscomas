import React, { useEffect, useState } from "react";
import { Barcode, CheckCircle2, Clock3, Image, Pencil, Plus, Search, X } from "lucide-react";
import { cloudFetch, cloudSession, loginCloud } from "../../cloud/cloudAuth";
import { loadCloudConfig } from "../../cloud/config";
import { clearBarcodeCache } from "../../shared/productLookup";

const EMPTY = { codigo: "", nombre: "", categoria: "", familia: "", variante: "", unidad: "unidad", descripcionCatalogo: "", imagenUrl: "" };
const FILTERS = [
  ["all", "Todos"], ["unresolved", "No reconocidos"], ["pending", "Pendientes"], ["verified", "Verificados"],
  ["incomplete", "Incompletos"], ["conflict", "Con variantes"],
];
const STATUS = {
  unresolved: ["No reconocido", "bg-amber-100 text-amber-800"],
  pending: ["Pendiente de verificar", "bg-violet-100 text-violet-800"],
  verified: ["Verificado", "bg-green-100 text-green-800"],
  incomplete: ["Incompleto", "bg-orange-100 text-orange-800"],
  conflict: ["A revisar", "bg-violet-100 text-violet-800"],
  learned: ["Aprendido", "bg-blue-100 text-blue-800"],
};

function requestContext() {
  const config = loadCloudConfig();
  const session = cloudSession();
  return { config, session, tenantId: session?.user?.businessId };
}

export function BarcodeCatalogAdmin() {
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, stats: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cloudUsername, setCloudUsername] = useState("kiosco-admin");
  const [cloudPassword, setCloudPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setDeferredQuery(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = async () => {
    const context = requestContext();
    if (!context.config.enabled || !context.config.apiUrl || !context.config.deviceId) {
      setError("Activa la sincronizacion y configura la direccion del servidor en Nube y dispositivos.");
      return;
    }
    if (!context.session || context.session.user?.role !== "superAdmin") {
      setError("");
      return;
    }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ query: deferredQuery, status: filter, page: String(page), limit: "30" });
      const response = await cloudFetch(context.config.apiUrl, `/v1/admin/catalog?${params}`, { headers: { "x-device-id": context.config.deviceId, "x-tenant-id": String(context.tenantId) } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "No se pudo abrir el catalogo");
      setData(json);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [deferredQuery, filter, page, sessionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectAdministrator = async () => {
    const config = loadCloudConfig();
    if (!config.enabled || !config.apiUrl || !config.deviceId) {
      setError("Primero activa la sincronizacion y configura el servidor en Nube y dispositivos.");
      return;
    }
    if (!cloudUsername.trim() || !cloudPassword) return;
    setConnecting(true); setError("");
    try {
      const session = await loginCloud(config.apiUrl, cloudUsername.trim(), cloudPassword, config.deviceId);
      if (session.user?.role !== "superAdmin") throw new Error("Esta cuenta pertenece a un negocio y no administra Kiosco+.");
      setCloudPassword("");
      setSessionVersion((value) => value + 1);
    } catch (cause) {
      setError(cause.message || "No se pudo conectar la cuenta administradora.");
    } finally { setConnecting(false); }
  };

  const openNew = () => { setForm(EMPTY); setEditor("new"); setError(""); };
  const openEdit = (item) => { setForm({ ...EMPTY, ...(item.product || {}), codigo: item.codigo }); setEditor(item); setError(""); };
  const closeEditor = () => { if (!saving) setEditor(null); };
  const save = async () => {
    const context = requestContext();
    const codigo = String(form.codigo || "").replace(/\D/g, "");
    if (codigo.length < 6 || !form.nombre.trim()) return setError("Completa un codigo valido y el nombre del producto.");
    setSaving(true); setError("");
    try {
      const response = await cloudFetch(context.config.apiUrl, `/v1/admin/catalog/${codigo}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-device-id": context.config.deviceId, "x-tenant-id": String(context.tenantId) },
        body: JSON.stringify({ product: { ...form, codigo } }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "No se pudo guardar el producto");
      clearBarcodeCache(codigo);
      setEditor(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {(() => {
        const context = requestContext();
        if (context.session?.user?.role === "superAdmin") return null;
        return <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">Conectar administracion central</p>
          <p className="mt-1 text-sm text-amber-800">La sesion de un negocio no permite modificar el catalogo compartido. Inicia sesion con la cuenta administradora configurada en el servidor.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={cloudUsername} onChange={(event) => setCloudUsername(event.target.value)} placeholder="Usuario administrador" className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
            <input type="password" value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && connectAdministrator()} placeholder="Contraseña del servidor" className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
            <button onClick={connectAdministrator} disabled={connecting || !cloudPassword} className="rounded-lg bg-[#1C4A44] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{connecting ? "Conectando..." : "Conectar"}</button>
          </div>
        </div>;
      })()}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <Search size={18} className="text-gray-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por codigo, nombre, categoria o familia..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
        </label>
        <button onClick={openNew} className="flex items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>Agregar producto</button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([value, label]) => <button key={value} onClick={() => { setFilter(value); setPage(1); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? "border-[#1C4A44] bg-[#1C4A44] text-white" : "border-gray-200 bg-white text-gray-600"}`}>{label}{value !== "all" && data.stats?.[value] !== undefined ? ` (${data.stats[value]})` : ""}</button>)}
      </div>
      {error && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
      <div className="mt-4 space-y-2">
        {loading && <p className="py-8 text-center text-sm text-gray-500">Cargando catalogo...</p>}
        {!loading && !error && data.items.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">No hay productos para este filtro.</p>}
        {!loading && data.items.map((item) => {
          const badge = STATUS[item.status] || STATUS.learned;
          return <article key={item.codigo} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[52px_1fr_auto] sm:items-center">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-gray-100">{item.product?.imagenUrl ? <img src={item.product.imagenUrl} alt="" className="h-full w-full object-contain"/> : <Barcode size={23} className="text-gray-400"/>}</div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{item.product?.nombre || "Producto sin identificar"}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge[1]}`}>{badge[0]}</span></div><p className="mt-0.5 font-mono text-xs text-gray-500">{item.codigo}</p><p className="mt-1 text-xs text-gray-500">{item.product?.categoria || "Sin categoria"} · {item.lookupCount} consulta(s){item.lastLookupAt ? ` · ultima ${new Date(item.lastLookupAt).toLocaleString("es-AR")}` : ""}</p></div>
            <button onClick={() => openEdit(item)} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><Pencil size={14}/>{item.product ? "Editar" : "Completar"}</button>
          </article>;
        })}
      </div>
      {data.total > 30 && <div className="mt-4 flex items-center justify-center gap-3"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-30">Anterior</button><span className="text-xs text-gray-500">Pagina {page}</span><button disabled={page * 30 >= data.total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-30">Siguiente</button></div>}

      {editor && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/60 p-3" onMouseDown={closeEditor}><div className="my-auto w-full max-w-2xl rounded-2xl bg-[#FFFCF6] p-4 shadow-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xl font-bold">{editor === "new" ? "Agregar al catalogo" : "Editar producto del catalogo"}</p><p className="mt-1 text-sm text-gray-500">Esta correccion se usara en todos los negocios.</p></div><button onClick={closeEditor} className="rounded-lg border p-2"><X size={18}/></button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Codigo de barras<input value={form.codigo} disabled={editor !== "new"} onChange={(event) => setForm({ ...form, codigo: event.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 disabled:bg-gray-100" inputMode="numeric"/></label>
          <label className="text-sm font-medium">Nombre del producto<input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Categoria<input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Unidad<input value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })} placeholder="unidad, kg, litro..." className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Familia<input value={form.familia} onChange={(event) => setForm({ ...form, familia: event.target.value })} placeholder="Ej: Coca-Cola" className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium">Variante<input value={form.variante} onChange={(event) => setForm({ ...form, variante: event.target.value })} placeholder="Ej: Zero 1,5 L" className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">Descripcion<input value={form.descripcionCatalogo} onChange={(event) => setForm({ ...form, descripcionCatalogo: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
          <label className="text-sm font-medium sm:col-span-2">URL de la imagen<div className="mt-1 flex gap-2"><input value={form.imagenUrl} onChange={(event) => setForm({ ...form, imagenUrl: event.target.value })} placeholder="https://..." className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2"/><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border bg-white">{form.imagenUrl ? <img src={form.imagenUrl} alt="Vista previa" className="h-full w-full object-contain"/> : <Image size={18}/>}</div></div></label>
        </div>
        {editor !== "new" && editor.history?.length > 0 && <details className="mt-4 rounded-xl border bg-white p-3 text-xs"><summary className="cursor-pointer font-semibold">Historial de correcciones ({editor.history.length})</summary><div className="mt-2 space-y-2">{editor.history.map((entry, index) => <p key={`${entry.at}-${index}`}><Clock3 size={12} className="mr-1 inline"/>{new Date(entry.at).toLocaleString("es-AR")} · {entry.action === "created" ? "creado" : "editado"}</p>)}</div></details>}
        <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={closeEditor} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button onClick={save} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : <><CheckCircle2 size={17}/>Guardar correccion</>}</button></div>
      </div></div>}
    </div>
  );
}
