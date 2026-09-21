import React, { useMemo, useState } from "react";
import { BadgePercent, CalendarDays, Clock3, Copy, ImagePlus, Monitor, Pause, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react";
import { AppSelect, ConfirmDialog } from "../../shared/controls";
import { KioscoDatePicker } from "../../shared/KioscoDatePicker";
import { descripcionPromocion, etiquetaPromocion } from "../ventas/salesRules";

const TYPES = [
  { value: "porcentaje", label: "Descuento porcentual" },
  { value: "cantidad", label: "Descuento por cantidad" },
  { value: "nxm", label: "Promoción 2x1 / 3x2" },
  { value: "combo", label: "Combo a precio fijo" },
];

const DAYS = [
  { value: 1, label: "Lun" }, { value: 2, label: "Mar" }, { value: 3, label: "Mié" },
  { value: 4, label: "Jue" }, { value: 5, label: "Vie" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];

const emptyPromotion = () => ({
  nombre: "", tipo: "porcentaje", valor: 10, lleva: 2, paga: 1, cantidadMinima: 2,
  precioCombo: "", desde: "", hasta: "", horaDesde: "", horaHasta: "", diasSemana: [],
  productIds: [], mostrarEnPantalla: true, mensajePantalla: "", imagenPantalla: null,
});

const resizePromotionImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
    image.onload = () => {
      const max = 1280;
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

function promotionSchedule(promotion) {
  const dates = `${promotion.desde || "Ahora"} → ${promotion.hasta || "Sin límite"}`;
  const days = Array.isArray(promotion.diasSemana) && promotion.diasSemana.length
    ? DAYS.filter((day) => promotion.diasSemana.map(Number).includes(day.value)).map((day) => day.label).join(", ")
    : "Todos los días";
  const hours = promotion.horaDesde || promotion.horaHasta
    ? `${promotion.horaDesde || "00:00"}–${promotion.horaHasta || "23:59"}`
    : "Todo el día";
  return { dates, days, hours };
}

export function PromotionsManager({ products = [], promociones = [], setPromociones }) {
  const [form, setForm] = useState(emptyPromotion);
  const [editingId, setEditingId] = useState(null);
  const [productQuery, setProductQuery] = useState("");
  const [imageError, setImageError] = useState("");
  const [deletingPromotion, setDeletingPromotion] = useState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedProducts = useMemo(() => products.filter((product) => form.productIds.includes(product.id)), [products, form.productIds]);
  const visibleProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => [product.nombre, product.codigo, product.familia, product.variante, product.categoria].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [products, productQuery]);

  const changeType = (tipo) => setForm((current) => ({
    ...current,
    tipo,
    productIds: (tipo === "nxm" || tipo === "combo")
      ? current.productIds.filter((id) => (products.find((product) => product.id === id)?.unidad || "unidad") === "unidad")
      : current.productIds,
  }));
  const toggleProduct = (id) => set("productIds", form.productIds.includes(id) ? form.productIds.filter((item) => item !== id) : [...form.productIds, id]);
  const toggleDay = (day) => set("diasSemana", form.diasSemana.includes(day) ? form.diasSemana.filter((value) => value !== day) : [...form.diasSemana, day]);
  const validAmount = form.tipo === "combo" ? Number(form.precioCombo) > 0 : Number(form.valor) > 0;
  const validProducts = form.tipo === "combo" ? form.productIds.length >= 2 : form.tipo === "nxm" ? form.productIds.length >= 1 : true;
  const validHours = !form.horaDesde || !form.horaHasta || form.horaDesde !== form.horaHasta;
  const valid = Boolean(form.nombre.trim() && validAmount && validProducts && validHours);

  const reset = () => {
    setForm(emptyPromotion());
    setEditingId(null);
    setProductQuery("");
    setImageError("");
  };

  const normalizedForm = () => ({
    ...form,
    nombre: form.nombre.trim(),
    mensajePantalla: form.mensajePantalla.trim(),
    valor: Number(form.valor || 0),
    lleva: Math.max(2, Number(form.lleva) || 2),
    paga: Math.max(1, Math.min(Math.max(2, Number(form.lleva) || 2) - 1, Number(form.paga) || 1)),
    cantidadMinima: Math.max(2, Number(form.cantidadMinima) || 2),
    precioCombo: Number(form.precioCombo || 0),
    diasSemana: [...new Set(form.diasSemana.map(Number))],
  });

  const save = () => {
    if (!valid) return;
    const values = normalizedForm();
    if (editingId != null) {
      setPromociones((previous = []) => previous.map((promotion) => String(promotion.id) === String(editingId) ? { ...promotion, ...values, actualizado: new Date().toISOString() } : promotion));
    } else {
      setPromociones((previous = []) => [{ ...values, id: globalThis.crypto?.randomUUID?.() || Date.now(), activa: true, fecha: new Date().toISOString() }, ...previous]);
    }
    reset();
  };

  const edit = (promotion) => {
    setEditingId(promotion.id);
    setForm({ ...emptyPromotion(), ...promotion, precioCombo: promotion.precioCombo ?? (promotion.tipo === "combo" ? promotion.valor : ""), diasSemana: Array.isArray(promotion.diasSemana) ? promotion.diasSemana.map(Number) : [], productIds: [...(promotion.productIds || [])] });
    setProductQuery("");
    setImageError("");
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const duplicate = (promotion) => {
    const copy = { ...promotion, id: globalThis.crypto?.randomUUID?.() || Date.now(), nombre: `${promotion.nombre} (copia)`, activa: false, fecha: new Date().toISOString(), actualizado: undefined };
    setPromociones((previous = []) => [copy, ...previous]);
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      set("imagenPantalla", await resizePromotionImage(file));
      setImageError("");
    } catch (error) { setImageError(error?.message || "No se pudo guardar la imagen."); }
  };

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[440px_1fr]">
    <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><BadgePercent size={18} className="shrink-0"/><h3 className="min-w-0 break-words font-semibold">{editingId != null ? "Editar promoción" : "Nueva promoción o combo"}</h3></div>{editingId != null && <button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-2 text-xs font-semibold"><X size={14}/>Cancelar</button>}</div>
      <p className="mt-2 text-xs leading-5 text-gray-500">La promoción modifica el total de la venta. Si la mostrás en la segunda pantalla, el anuncio siempre coincidirá con lo que cobra la caja.</p>
      <div className="mt-4 grid gap-3">
        <input value={form.nombre} onChange={(event) => set("nombre", event.target.value.slice(0, 80))} placeholder="Nombre visible" className="rounded-lg border px-3 py-2 text-sm"/>
        <AppSelect value={form.tipo} onChange={changeType} options={TYPES}/>
        {(form.tipo === "porcentaje" || form.tipo === "cantidad") && <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><label className="min-w-0 text-xs opacity-70">Descuento %<input type="number" min="1" max="100" value={form.valor} onChange={(event) => set("valor", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>{form.tipo === "cantidad" && <label className="min-w-0 text-xs opacity-70">Cantidad mínima<input type="number" min="2" value={form.cantidadMinima} onChange={(event) => set("cantidadMinima", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>}</div>}
        {form.tipo === "nxm" && <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><label className="min-w-0 text-xs opacity-70">Lleva<input type="number" min="2" value={form.lleva} onChange={(event) => set("lleva", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label><label className="min-w-0 text-xs opacity-70">Paga<input type="number" min="1" max={Math.max(1, Number(form.lleva) - 1)} value={form.paga} onChange={(event) => set("paga", event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label></div>}
        {form.tipo === "combo" && <label className="text-xs opacity-70">Precio final del combo<input type="number" min="0" value={form.precioCombo} onChange={(event) => set("precioCombo", event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>}

        <div className="rounded-xl border bg-gray-50/70 p-3"><div className="flex items-center gap-2 text-xs font-bold"><CalendarDays size={14}/>Cuándo se aplica</div><div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><div className="min-w-0 text-xs opacity-70">Desde (opcional)<KioscoDatePicker value={form.desde} onChange={(fecha) => set("desde", fecha)} className="mt-1"/></div><div className="min-w-0 text-xs opacity-70">Hasta (opcional)<KioscoDatePicker value={form.hasta} onChange={(fecha) => set("hasta", fecha)} min={form.desde} className="mt-1"/></div></div><div className="mt-3 grid grid-cols-7 gap-1">{DAYS.map((day) => <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`min-h-9 rounded-lg border px-1 text-[10px] font-bold ${form.diasSemana.includes(day.value) ? "bg-gray-900 text-white" : "bg-white"}`}>{day.label}</button>)}</div><p className="mt-1 text-[10px] text-gray-500">Sin elegir días: se aplica todos los días.</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-gray-500">Desde la hora<input type="time" value={form.horaDesde} onChange={(event) => set("horaDesde", event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs"/></label><label className="text-[10px] font-semibold text-gray-500">Hasta la hora<input type="time" value={form.horaHasta} onChange={(event) => set("horaHasta", event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2 text-xs"/></label></div>{!validHours && <p className="mt-2 text-xs font-semibold text-red-600">Las horas no pueden ser iguales.</p>}</div>

        <div className="min-w-0"><p className="mb-2 text-xs font-medium opacity-70">Productos incluidos {form.tipo === "porcentaje" && "(vacío = todos)"}</p><div className="relative mb-2 min-w-0"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60"/><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar nombre, código o familia..." className="w-full min-w-0 rounded-lg border py-2 pl-9 pr-3 text-sm"/></div><div className="promotion-product-list max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-lg border p-2">{visibleProducts.map((product) => { const disabled = (form.tipo === "nxm" || form.tipo === "combo") && (product.unidad || "unidad") !== "unidad"; const selected = form.productIds.includes(product.id); return <label key={product.id} className={`promotion-product-option flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${selected ? "is-selected" : ""}`}><input type="checkbox" className="shrink-0" disabled={disabled} checked={selected} onChange={() => toggleProduct(product.id)}/><span className="min-w-0 flex-1"><b className="block truncate font-medium">{product.nombre}</b>{(product.codigo || product.familia || product.variante) && <small className="block truncate opacity-65">{[product.codigo, product.familia, product.variante].filter(Boolean).join(" · ")}</small>}</span></label>; })}{visibleProducts.length === 0 && <p className="p-5 text-center text-xs opacity-60">No hay productos que coincidan.</p>}</div><p className="mt-1 text-[11px] opacity-60">{selectedProducts.length} seleccionado(s) · {visibleProducts.length} de {products.length} visible(s)</p>{!validProducts && <p className="mt-1 text-xs font-semibold text-red-600">{form.tipo === "combo" ? "Elegí al menos dos productos para el combo." : "Elegí por lo menos un producto para esta promoción."}</p>}</div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><label className="flex cursor-pointer items-center justify-between gap-3"><span><b className="flex items-center gap-2 text-xs"><Monitor size={14}/>Anunciar en la segunda pantalla</b><small className="mt-1 block text-[10px] leading-4 text-gray-600">Se oculta sola cuando vence o cuando sus productos no tienen stock en vitrina.</small></span><input type="checkbox" checked={form.mostrarEnPantalla === true} onChange={(event) => set("mostrarEnPantalla", event.target.checked)} className="h-4 w-4 shrink-0"/></label>{form.mostrarEnPantalla && <div className="mt-3 grid gap-3"><textarea rows={2} value={form.mensajePantalla} onChange={(event) => set("mensajePantalla", event.target.value.slice(0, 180))} placeholder={descripcionPromocion(form)} className="w-full resize-y rounded-lg border bg-white px-3 py-2 text-xs"/><div className="flex flex-col gap-3 sm:flex-row sm:items-center">{form.imagenPantalla ? <img src={form.imagenPantalla} alt="Vista previa" className="h-24 w-full rounded-xl border bg-white object-cover sm:w-36"/> : <span className="grid h-20 w-full place-items-center rounded-xl border border-dashed bg-white text-[10px] text-gray-400 sm:w-36">Imagen opcional</span>}<div className="grid flex-1 gap-2"><label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1C4A44] px-3 text-xs font-bold text-white"><ImagePlus size={14}/>{form.imagenPantalla ? "Reemplazar imagen" : "Subir imagen"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} className="hidden"/></label>{form.imagenPantalla && <button type="button" onClick={() => set("imagenPantalla", null)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700"><Trash2 size={13}/>Quitar imagen</button>}</div></div>{imageError && <p className="text-xs font-semibold text-red-600">{imageError}</p>}<div className="rounded-xl bg-[#16433D] p-3 text-white"><span className="rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black text-amber-950">{etiquetaPromocion(form)}</span><b className="mt-2 block text-sm">{form.nombre || "Nombre de la promoción"}</b><p className="mt-1 text-[11px] text-emerald-100">{descripcionPromocion(form)}</p></div></div>}</div>

        <button disabled={!valid} onClick={save} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">{editingId != null ? <Pencil size={16}/> : <Plus size={16}/>} {editingId != null ? "Guardar cambios" : "Crear promoción"}</button>
      </div>
    </div>

    <div className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Promociones configuradas</h3><span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-800">{promociones.filter((promotion) => promotion.activa).length} activas</span></div><div className="grid gap-3 md:grid-cols-2">{promociones.map((promotion) => { const schedule = promotionSchedule(promotion); return <div key={promotion.id} className={`min-w-0 overflow-hidden rounded-xl border ${promotion.activa ? "border-green-200 bg-green-50" : "bg-gray-50"}`}>{promotion.imagenPantalla && <img src={promotion.imagenPantalla} alt="" className="h-32 w-full object-cover"/>}<div className="p-4"><div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="block break-words">{promotion.nombre}</b><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-[#1C4A44]">{etiquetaPromocion(promotion)}</span></div><p className="mt-1 break-words text-sm opacity-75">{descripcionPromocion(promotion)}</p><p className="mt-2 flex min-w-0 items-start gap-1 text-xs opacity-65"><CalendarDays size={13} className="mt-0.5 shrink-0"/><span className="min-w-0 break-words">{schedule.dates}</span></p><p className="mt-1 flex items-start gap-1 text-xs opacity-65"><Clock3 size={13} className="mt-0.5 shrink-0"/>{schedule.days} · {schedule.hours}</p><p className="mt-1 text-xs opacity-65">{promotion.productIds?.length ? `${promotion.productIds.length} producto(s)` : "Todos los productos"}</p>{promotion.mostrarEnPantalla === true && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800"><Monitor size={12}/>Visible en segunda pantalla</p>}</div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><button type="button" onClick={() => edit(promotion)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-semibold"><Pencil size={14}/>Editar</button><button type="button" onClick={() => duplicate(promotion)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-semibold"><Copy size={14}/>Duplicar</button><button type="button" onClick={() => setPromociones((previous) => previous.map((item) => item.id === promotion.id ? { ...item, activa: !item.activa } : item))} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-semibold">{promotion.activa ? <Pause size={14}/> : <Play size={14}/>} {promotion.activa ? "Pausar" : "Activar"}</button><button type="button" onClick={() => setDeletingPromotion(promotion)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700"><Trash2 size={14}/>Eliminar</button></div></div></div>; })}{promociones.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm opacity-60 sm:p-10 md:col-span-2">Todavía no hay promociones.</div>}</div></div>

    <ConfirmDialog open={Boolean(deletingPromotion)} title="Eliminar promoción" message={`Se eliminará la promoción "${deletingPromotion?.nombre || ""}". Esta acción no se puede deshacer.`} confirmLabel="Eliminar promoción" danger onCancel={() => setDeletingPromotion(null)} onConfirm={() => { setPromociones((previous) => previous.filter((item) => item.id !== deletingPromotion.id)); setDeletingPromotion(null); }}/>
  </div>;
}
