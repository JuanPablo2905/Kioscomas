import React, { useState, useMemo, useEffect } from "react";
import {
  Package, Store, ShoppingCart, BarChart3, Shield, LogOut, ScanLine, Search,
  Plus, Pencil, Trash2, X, AlertTriangle, Save, Bell, Minus, ArrowUpCircle,
  ArrowDownCircle, Clock, Lock, Users, ClipboardList, Wallet, CreditCard,
  MessageCircle, Mail, Copy, CheckCircle2, PackageCheck, History, UserPlus, Banknote,
  ChevronRight,
} from "lucide-react";
import { CATEGORIES, UNIDAD_GRUPOS, unidadInfo, nowFecha, historialEntry, money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect } from "../../shared/controls";
import { buildAutomaticLowStockItems, buildReplenishmentSuggestions } from "./replenishmentRules";
import { copyText, openEmailDraft, openWhatsApp, purchaseMessage } from "../../shared/share";

function CompartirPedidoModal({ pedido, onClose }) {
  const [phone, setPhone] = useState(pedido.phone || "");
  const [email, setEmail] = useState(pedido.email || "");
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Compartir pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">La app prepara el mensaje; vos revisás y confirmás el envío.</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp" className="rounded-lg border px-3 py-2 text-sm"/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo" className="rounded-lg border px-3 py-2 text-sm"/></div>
        <textarea
          readOnly
          value={pedido.text}
          onFocus={(e) => e.target.select()}
          className="w-full h-40 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        <div className="grid gap-2 sm:grid-cols-3"><button onClick={() => openWhatsApp({ phone, text: pedido.text })} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white"><MessageCircle size={16}/>WhatsApp</button><button onClick={() => openEmailDraft({ to: email, subject: `Pedido para ${pedido.providerName}`, body: pedido.text })} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Mail size={16}/>Correo</button><button onClick={async () => { try { await copyText(pedido.text); setCopied(true); } catch {} }} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold"><Copy size={16}/>{copied ? "Copiado" : "Copiar"}</button></div>
      </div>
    </div>
  );
}

export function ComprasView({ products, setProducts, comprasItems, setComprasItems, proveedores = [], pedidos = [], setPedidos, tickets = [], tutorialMode = false, businessName = "Kiosco+" }) {
  const [manualNombre, setManualNombre] = useState("");
  const [buscarProducto, setBuscarProducto] = useState("");
  const [pedidoParaCompartir, setPedidoParaCompartir] = useState(null);
  const [nuevoProductoOpen, setNuevoProductoOpen] = useState(false);
  const tieneCompraActiva = (productId, items = comprasItems) =>
    items.some((item) => item.productId === productId && item.estado !== "recibido");
  const nuevoItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const proveedorDeItem = (item) => {
    const product = products.find((p) => p.id === item.productId);
    const proveedorId = item.proveedorId ?? product?.proveedorId;
    return proveedores.find((p) => String(p.id) === String(proveedorId)) || null;
  };

  const crearPedido = (items) => {
    if (!items.length || !setPedidos) return;
    const proveedor = proveedorDeItem(items[0]);
    const pedidoId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPedidos((prev) => [{ id: pedidoId, proveedorId: proveedor?.id || null, proveedorNombre: proveedor?.nombre || "Sin proveedor", estado: "pedido", fecha: new Date().toISOString(), items: items.map((item) => ({ itemId: item.id, productId: item.productId, nombre: item.nombre, cantidad: item.cantidad })) }, ...prev]);
    const ids = new Set(items.map((item) => item.id));
    setComprasItems((prev) => prev.map((item) => ids.has(item.id) ? { ...item, estado: "pedido", pedidoId } : item));
  };

  const generarPedidosPorProveedor = () => {
    const pending = comprasItems.filter((item) => item.estado === "pendiente");
    const groups = new Map();
    pending.forEach((item) => { const key = proveedorDeItem(item)?.id || "sin-proveedor"; groups.set(key, [...(groups.get(key) || []), item]); });
    groups.forEach((items) => crearPedido(items));
  };

  const sugeridos = buildReplenishmentSuggestions(products, tickets).filter(
    ({ product }) => !tieneCompraActiva(product.id)
  );

  const resultadosBusqueda = useMemo(() => {
    const q = buscarProducto.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        (p.nombre.toLowerCase().includes(q) ||
          String(p.codigo || "").toLowerCase().includes(q)) &&
        !tieneCompraActiva(p.id)
    );
  }, [products, buscarProducto, comprasItems]);

  const addSugerido = (suggestion) => {
    const product = suggestion.product;
    setComprasItems((prev) => [
      ...prev,
      {
        id: nuevoItemId(),
        productId: product.id,
        nombre: product.nombre,
        cantidad: suggestion.recomendada,
        costoCompra: product.costo || 0,
        estado: "pendiente",
        origen: "sugerido-inteligente",
      },
    ]);
    setBuscarProducto("");
  };

  useEffect(() => {
    if (tutorialMode) return;
    setComprasItems((prev) => {
      const automaticos = buildAutomaticLowStockItems(products, tickets, prev);
      if (!automaticos.length) return prev;
      return [
        ...prev,
        ...automaticos.map(({ product, recomendada }) => ({
          id: nuevoItemId(),
          productId: product.id,
          nombre: product.nombre,
          cantidad: recomendada,
          costoCompra: product.costo || 0,
          proveedorId: product.proveedorId || "",
          estado: "pendiente",
          origen: "stock-bajo-automatico",
        })),
      ];
    });
  }, [products, tickets, tutorialMode]);

  const addDesdeBusqueda = (product) => {
    setComprasItems((prev) => {
      if (tieneCompraActiva(product.id, prev)) return prev;
      return [
        ...prev,
        {
          id: nuevoItemId(),
          productId: product.id,
          nombre: product.nombre,
          cantidad: 1,
          costoCompra: product.costo || 0,
          proveedorId: product.proveedorId || "",
          estado: "pendiente",
          origen: "manual",
          __tutorial: tutorialMode || undefined,
        },
      ];
    });
    setBuscarProducto("");
  };

  const addManual = () => {
    if (!manualNombre.trim()) return;
    setComprasItems((prev) => [
      ...prev,
      {
        id: nuevoItemId(),
        productId: null,
        nombre: manualNombre.trim(),
        cantidad: 1,
        estado: "pendiente",
        origen: "manual",
      },
    ]);
    setManualNombre("");
  };

  const handleNuevoProducto = (data) => {
    const nuevoId = Date.now();
    const cantidadPedido = data.deposito > 0 ? data.deposito : Math.max(data.minimo, 1);
    setProducts((prev) => [
      ...prev,
      {
        id: nuevoId,
        vitrina: 0,
        ...data,
        deposito: 0,
        historial: [
          historialEntry("creacion", "Producto creado desde Compras"),
        ],
      },
    ]);
    setComprasItems((prev) => [
      ...prev,
      {
        id: nuevoItemId(),
        productId: nuevoId,
        nombre: data.nombre,
        cantidad: cantidadPedido,
        costoCompra: data.costo || 0,
        estado: "pendiente",
        origen: "nuevo-producto",
      },
    ]);
    setNuevoProductoOpen(false);
  };

  const changeCantidad = (id, delta) => {
    setComprasItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, cantidad: Math.max(1, Number(i.cantidad || 0) + delta) } : i
      )
    );
  };

  const editCantidad = (id, value) => {
    setComprasItems((prev) => prev.map((item) => item.id === id
      ? { ...item, cantidad: value === "" ? "" : Math.max(0, Number(value) || 0) }
      : item));
  };

  const normalizeCantidad = (id, value) => {
    setComprasItems((prev) => prev.map((item) => item.id === id
      ? { ...item, cantidad: Math.max(1, Number(value) || 1) }
      : item));
  };

  const changeCosto = (id, value) => setComprasItems((prev) => prev.map((item) => item.id === id ? { ...item, costoCompra: Math.max(0, Number(value) || 0) } : item));
  const changeProveedor = (id, proveedorId) => setComprasItems((prev) => prev.map((item) => item.id === id ? { ...item, proveedorId } : item));

  const avanzarEstado = (id) => {
    const item = comprasItems.find((i) => i.id === id && i.estado === "pendiente");
    if (item) crearPedido([item]);
  };

  const confirmarRecepcion = (item) => {
    const cantidadRecibida = Math.max(1, Number(item.cantidad) || 1);
    if (item.productId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.productId
            ? {
                ...p,
                costo: Number(item.costoCompra) || p.costo,
                deposito: Number(p.deposito || 0) + cantidadRecibida,
                historial: [
                  ...(p.historial || []),
                  ...(Number(item.costoCompra) > 0 && Number(item.costoCompra) !== Number(p.costo) ? [historialEntry("edicion", `Costo actualizado al recibir compra: ${money(p.costo)} → ${money(item.costoCompra)}`)] : []),
                  historialEntry(
                    "reposicion",
                    `+${cantidadRecibida} ${unidadInfo(p.unidad).baseAbbr} recibidos por compra`
                  ),
                ],
              }
            : p
        )
      );
    }
    setComprasItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, estado: "recibido", recibidoFecha: new Date().toISOString() } : i))
    );
    if (item.pedidoId && setPedidos) {
      const quedan = comprasItems.some((other) => other.pedidoId === item.pedidoId && other.id !== item.id && other.estado !== "recibido");
      setPedidos((prev) => prev.map((pedido) => pedido.id === item.pedidoId ? { ...pedido, estado: quedan ? "parcial" : "recibido", recibidoFecha: quedan ? pedido.recibidoFecha : new Date().toISOString() } : pedido));
    }
  };

  const removeItem = (id) =>
    setComprasItems((prev) => prev.filter((i) => i.id !== id));

  const activos = comprasItems.filter((i) => i.estado !== "recibido");
  const recibidos = comprasItems.filter((i) => i.estado === "recibido");
  const gruposActivos = useMemo(() => {
    const groups = new Map();
    activos.forEach((item) => { const proveedor = proveedorDeItem(item); const key = proveedor?.id || "sin-proveedor"; if (!groups.has(key)) groups.set(key, { proveedor, items: [] }); groups.get(key).items.push(item); });
    return [...groups.values()];
  }, [activos, products, proveedores]);

  const compartirGrupo = (grupo) => {
    const providerName = grupo.proveedor?.nombre || "proveedor a definir";
    setPedidoParaCompartir({ providerName, phone: grupo.proveedor?.telefono || "", email: grupo.proveedor?.email || "", text: purchaseMessage({ businessName, providerName, items: grupo.items }) });
  };

  const compartirTodo = () => setPedidoParaCompartir({ providerName: "proveedores", phone: "", email: "", text: purchaseMessage({ businessName, providerName: "", items: activos }) });

  return (
    <div className="min-w-0 p-4 sm:p-6 md:p-8">
      <SectionHeader
        title="Lista de Compras"
        subtitle={tutorialMode ? "Práctica guiada: este pedido ficticio no modifica el stock real." : "Productos a reponer con el proveedor."}
        actions={
          activos.length > 0 && (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <button onClick={compartirTodo} className="flex min-w-0 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"><MessageCircle size={16} className="shrink-0"/><span className="truncate">Compartir todo</span></button>
              {activos.some((item) => item.estado === "pendiente") && <button data-tour="purchase-generate" onClick={generarPedidosPorProveedor} className="flex min-w-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"><PackageCheck size={16} className="shrink-0"/><span className="truncate">Generar pedidos</span></button>}
            </div>
          )
        }
      />

      <div className="relative mb-6">
        <label className="text-sm font-semibold text-gray-900 block mb-2">
          Buscar en tu Stock para agregar a la lista
        </label>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            data-tour="purchase-search"
            value={buscarProducto}
            onChange={(e) => setBuscarProducto(e.target.value)}
            placeholder="Buscar por nombre o código de barras..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
          {resultadosBusqueda.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-h-56 overflow-y-auto">
              {resultadosBusqueda.map((p) => (
                <button
                  data-tour="purchase-search-result"
                  key={p.id}
                  onClick={() => addDesdeBusqueda(p)}
                  className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block break-words">{p.nombre}</span>
                    <span className="block text-gray-500 text-xs mt-0.5">
                      Depósito: {p.deposito} {unidadInfo(p.unidad).baseAbbr}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-gray-700">Agregar</span>
                </button>
              ))}
            </div>
          )}
          {buscarProducto.trim() && resultadosBusqueda.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              No se encontró ningún producto con ese nombre o código.
            </p>
          )}
        </div>
      </div>

      {sugeridos.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-sm font-semibold text-gray-900">Reposición inteligente</h2><p className="text-xs text-gray-500">Combina stock mínimo, vitrina y ventas de los últimos 30 días.</p></div><button onClick={() => sugeridos.forEach(addSugerido)} className="shrink-0 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium">Agregar todos</button></div>
          <div className="space-y-2">
            {sugeridos.map((suggestion) => { const p = suggestion.product; return (
              <div
                key={p.id}
                className="flex flex-col items-stretch gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                  <p className="text-xs text-gray-500">
                    Stock total: {suggestion.stock} · Vendido 30 días: {suggestion.ventas30} · {suggestion.coberturaDias === null ? "Sin consumo reciente" : `${suggestion.coberturaDias.toFixed(1)} días de cobertura`}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">Sugerido: {suggestion.recomendada} {unidadInfo(p.unidad).baseAbbr}</p>
                </div>
                <button
                  onClick={() => addSugerido(suggestion)}
                  className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 sm:w-auto sm:py-1.5"
                >
                  <Plus size={13} />
                  Agregar a la lista
                </button>
              </div>
            );})}
          </div>
        </div>
      )}

      <div className="mb-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={manualNombre}
          onChange={(e) => setManualNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addManual();
          }}
          placeholder="Item genérico (ej: bolsas, cambio...)"
          className="min-w-0 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={addManual}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:w-auto"
        >
          <Plus size={16} />
          Agregar
        </button>
      </div>
      <button
        onClick={() => setNuevoProductoOpen(true)}
        className="mb-4 flex w-full items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 sm:w-auto sm:bg-transparent sm:px-0"
      >
        <PackageCheck size={15} className="mt-0.5 shrink-0" />
        ¿No está en tu Stock? Creá un producto nuevo para pedirlo
      </button>

      {gruposActivos.length > 0 && (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gruposActivos.map((grupo) => <div key={grupo.proveedor?.id || "sin"} className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium uppercase text-blue-600">Proveedor</p><p className="break-words font-semibold">{grupo.proveedor?.nombre || "Sin proveedor asignado"}</p><p className="text-xs text-gray-500">{grupo.items.length} producto(s)</p></div><button onClick={() => compartirGrupo(grupo)} className="shrink-0 rounded-lg border border-blue-200 bg-white p-2 text-blue-700" title="Compartir pedido con este proveedor"><MessageCircle size={15}/></button></div>{grupo.proveedor?.telefono && <p className="mt-3 break-all text-xs text-gray-500">{grupo.proveedor.telefono}</p>}</div>)}
        </div>
      )}

      {activos.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
          No hay items pendientes en la lista de compras.
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {activos.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 flex-col items-stretch gap-4 rounded-xl border border-gray-200 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-3 md:py-3"
            >
              <div className="min-w-0">
                <p className="break-words font-medium text-gray-900">{item.nombre}</p>
                {item.__tutorial && <span className="mr-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Práctica del tutorial</span>}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.estado === "pendiente"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {item.estado === "pendiente" ? "Pendiente" : "Pedido realizado"}
                </span>
              </div>
              <div className="grid min-w-0 gap-3 md:flex md:w-auto md:flex-wrap md:items-center md:justify-end">
                {item.productId && <div data-tour="purchase-supplier" className="min-w-0 md:w-52"><span className="mb-1 block text-xs text-gray-500">Proveedor</span><AppSelect value={item.proveedorId ?? products.find((product) => product.id === item.productId)?.proveedorId ?? ""} onChange={(value) => changeProveedor(item.id, value)} placeholder="Elegir proveedor" options={[{ value: "", label: "Sin proveedor asignado" }, ...proveedores.map((proveedor) => ({ value: proveedor.id, label: proveedor.nombre }))]}/></div>}
                <div data-tour="purchase-order-values" className="grid min-w-0 gap-3 sm:grid-cols-2 md:flex md:items-end">
                {item.productId && <label data-tour="purchase-received-cost" className="flex min-w-0 items-center justify-between gap-3 text-xs text-gray-500 md:block md:whitespace-nowrap">{item.estado === "pendiente" ? "Costo previsto" : "Costo recibido"}<input type="number" value={item.costoCompra ?? ""} onChange={(e) => changeCosto(item.id, e.target.value)} className="min-w-0 w-32 rounded-lg border px-2 py-2 text-sm text-gray-900 md:ml-2 md:w-24 md:py-1.5"/></label>}
                <div>
                  <span className="mb-1 block text-xs text-gray-500">{item.estado === "pendiente" ? "Cantidad a comprar" : "Cantidad recibida"}</span>
                  <div className="flex items-center justify-center gap-2 md:justify-start">
                  <button
                    onClick={() => changeCantidad(item.id, -1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 md:h-7 md:w-7"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.cantidad}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => editCantidad(item.id, event.target.value)}
                    onBlur={(event) => normalizeCantidad(item.id, event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                    aria-label={`Cantidad a comprar de ${item.nombre}`}
                    className="h-10 w-20 rounded-lg border border-gray-300 bg-white px-1 text-center text-sm font-semibold text-gray-900 md:h-8 md:w-16"
                  />
                  <button
                    onClick={() => changeCantidad(item.id, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 md:h-7 md:w-7"
                  >
                    <Plus size={14} />
                  </button>
                  </div>
                </div>
                </div>
                {item.estado === "pendiente" && (
                  <button
                    onClick={() => avanzarEstado(item.id)}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium hover:bg-gray-50 md:min-h-0 md:w-auto md:py-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Marcar pedido
                  </button>
                )}
                <button
                  data-tour="purchase-confirm"
                  onClick={() => confirmarRecepcion(item)}
                  className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 md:min-h-0 md:w-auto md:py-1.5"
                >
                  <PackageCheck size={14} />
                  Confirmar recepción
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="justify-self-end rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Eliminar ${item.nombre} de la lista`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recibidos.length > 0 && (
        <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            ✓ Recibidos recientemente
          </h2>
          <div className="space-y-1 bg-gray-50 rounded-lg p-2">
            {recibidos.map((item) => (
              <div
                key={item.id}
                className="flex flex-col items-start gap-1 px-3 py-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:py-1.5"
              >
                <span>
                  {item.cantidad} x {item.nombre}
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  <PackageCheck size={13} />
                  Recibido
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-3 text-sm font-semibold">Historial de pedidos</h2>
          <div className="space-y-2">{pedidos.slice(0, 20).map((pedido) => <div key={pedido.id} className="flex flex-col items-start gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium">{pedido.proveedorNombre}</p><p className="text-xs text-gray-400">{new Date(pedido.fecha).toLocaleString("es-AR")} · {pedido.items.length} producto(s)</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${pedido.estado === "recibido" ? "bg-green-100 text-green-700" : pedido.estado === "parcial" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{pedido.estado === "recibido" ? "Recibido" : pedido.estado === "parcial" ? "Recepción parcial" : "Pedido realizado"}</span></div>)}</div>
        </div>
      )}

      {nuevoProductoOpen && (
        <ProductModal
          onClose={() => setNuevoProductoOpen(false)}
          onSave={handleNuevoProducto}
        />
      )}

      {pedidoParaCompartir && (
        <CompartirPedidoModal
          pedido={pedidoParaCompartir}
          onClose={() => setPedidoParaCompartir(null)}
        />
      )}
    </div>
  );
}
