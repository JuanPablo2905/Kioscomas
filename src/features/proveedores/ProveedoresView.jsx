import React, { useMemo, useState } from "react";
import { Link2, Pencil, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { SectionHeader } from "../../shared/layout";

const VACIO = { nombre: "", contacto: "", telefono: "", email: "", notas: "" };

function ProveedorModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || VACIO);
  const field = (key) => ({
    value: form[key] || "",
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-lg font-bold">
            {initial ? "Editar proveedor" : "Nuevo proveedor"}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <input {...field("nombre")} autoFocus placeholder="Nombre del proveedor" className="w-full min-w-0 rounded-lg border px-3 py-2" />
          <input {...field("contacto")} placeholder="Persona de contacto" className="w-full min-w-0 rounded-lg border px-3 py-2" />
          <input {...field("telefono")} placeholder="Teléfono / WhatsApp" className="w-full min-w-0 rounded-lg border px-3 py-2" />
          <input {...field("email")} placeholder="Email" className="w-full min-w-0 rounded-lg border px-3 py-2" />
          <textarea {...field("notas")} placeholder="Notas, días de reparto, condiciones..." className="h-24 w-full min-w-0 resize-y rounded-lg border px-3 py-2" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="min-h-11 rounded-lg border px-3 py-2 text-sm">Cancelar</button>
          <button
            disabled={!form.nombre.trim()}
            onClick={() => onSave({ ...form, nombre: form.nombre.trim() })}
            className="min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function AsignarProductosModal({ proveedor, products, setProducts, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    products.filter((product) => product.proveedorId === proveedor.id).map((product) => product.id)
  );
  const visible = products.filter((product) =>
    `${product.nombre} ${product.codigo || ""}`.toLowerCase().includes(query.toLowerCase())
  );
  const guardar = () => {
    setProducts((previous) => previous.map((product) =>
      selected.includes(product.id)
        ? { ...product, proveedorId: proveedor.id }
        : product.proveedorId === proveedor.id
          ? { ...product, proveedorId: null }
          : product
    ));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold">Productos de {proveedor.nombre}</h2>
            <p className="text-sm text-gray-500">Marcá todos los productos que entrega este proveedor.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar producto..."
          className="mt-4 w-full min-w-0 rounded-lg border px-3 py-2"
        />
        <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
          {visible.map((product) => (
            <label
              key={product.id}
              className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 ${selected.includes(product.id) ? "border-blue-500 bg-blue-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(product.id)}
                onChange={() => setSelected((previous) => previous.includes(product.id)
                  ? previous.filter((id) => id !== product.id)
                  : [...previous, product.id])}
                className="shrink-0"
              />
              <span className="min-w-0">
                <b className="block truncate text-sm">{product.nombre}</b>
                <small className="block truncate text-gray-500">
                  {product.proveedorId && product.proveedorId !== proveedor.id ? "Asignado a otro proveedor" : product.codigo || "Sin código"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid shrink-0 gap-2 sm:grid-cols-[auto_auto] sm:justify-end">
          <button onClick={onClose} className="min-h-11 rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={guardar} className="min-h-11 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
            Guardar {selected.length} producto(s)
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProveedoresView({ proveedores, setProveedores, products, setProducts }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(undefined);
  const [assigning, setAssigning] = useState(null);
  const filtered = useMemo(
    () => proveedores.filter((provider) => `${provider.nombre} ${provider.contacto} ${provider.telefono}`.toLowerCase().includes(query.toLowerCase())),
    [proveedores, query]
  );
  const save = (data) => {
    setProveedores((previous) => editing?.id
      ? previous.map((provider) => provider.id === editing.id ? { ...provider, ...data } : provider)
      : [...previous, { id: Date.now(), ...data }]);
    setEditing(undefined);
  };
  const remove = (id) => {
    setProveedores((previous) => previous.filter((provider) => provider.id !== id));
    setProducts((previous) => previous.map((product) => product.proveedorId === id ? { ...product, proveedorId: null } : product));
  };

  return (
    <div className="min-w-0 p-4 sm:p-6 md:p-8">
      <SectionHeader
        title="Proveedores"
        subtitle="Contactos y productos asociados."
        actions={(
          <button onClick={() => setEditing(null)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white sm:w-auto">
            <Plus size={16} />
            Nuevo
          </button>
        )}
      />
      <div className="relative mb-5 min-w-0">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proveedor..." className="w-full min-w-0 rounded-lg border py-2 pl-9 pr-3 text-sm" />
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((provider) => {
          const asociados = products.filter((product) => product.proveedorId === provider.id).length;
          return (
            <div key={provider.id} className="min-w-0 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <Truck size={20} className="shrink-0 text-gray-400" />
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(provider)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-50" aria-label={`Editar ${provider.nombre}`}><Pencil size={15} /></button>
                  <button onClick={() => remove(provider.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label={`Eliminar ${provider.nombre}`}><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="mt-3 break-words font-semibold">{provider.nombre}</p>
              <p className="break-words text-sm text-gray-500">{provider.contacto || "Sin contacto"}</p>
              <p className="break-all text-sm text-gray-500">{provider.telefono || provider.email || "Sin datos de contacto"}</p>
              <p className="mt-3 text-xs font-medium text-gray-400">{asociados} producto(s) asociado(s)</p>
              {provider.notas && <p className="mt-2 break-words text-xs text-gray-500">{provider.notas}</p>}
              <button onClick={() => setAssigning(provider)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Link2 size={15} />
                Asignar productos
              </button>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-400 sm:p-10">No hay proveedores cargados.</p>
      )}
      {editing !== undefined && <ProveedorModal initial={editing} onClose={() => setEditing(undefined)} onSave={save} />}
      {assigning && <AsignarProductosModal proveedor={assigning} products={products} setProducts={setProducts} onClose={() => setAssigning(null)} />}
    </div>
  );
}
