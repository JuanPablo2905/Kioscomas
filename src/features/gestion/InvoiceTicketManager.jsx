import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Mail, Printer, ReceiptText, Save, XCircle } from "lucide-react";
import { money } from "../../shared/domain";
import { CustomSelect } from "../../shared/CustomSelect";
import { ConfirmDialog } from "../../shared/controls";
import { TicketBarcode } from "../../shared/TicketBarcodeView";
import {
  allowedDocumentTypes,
  buildCommercialDocument,
  formatCuit,
  suggestedDocumentType,
  validateDocumentDraft,
} from "./invoiceRules";

const fiscalDefaults = {
  razonSocial: "",
  cuit: "",
  domicilio: "",
  condicionFiscal: "Monotributista",
  puntoVenta: "0001",
  ingresosBrutos: "",
  inicioActividades: "",
  alicuotaIva: 21,
  ticket: {
    paper: "80",
    header: "¡Gracias por tu compra!",
    footer: "Conservá este ticket",
    showBusiness: true,
    showAddress: true,
    showCashier: true,
    showCustomer: true,
    showPayment: true,
    showBarcode: true,
    fontSize: 12,
    background: "#F6F1E7",
    textColor: "#2A241E",
    accent: "#1C4A44",
  },
};

const field = "w-full min-w-0 rounded-lg border px-3 py-2 text-sm";
const receiverConditions = ["Consumidor final", "Responsable inscripto", "Monotributista", "Exento"];

function TicketPreview({ config, ticket, business }) {
  const template = config.ticket;
  const items = ticket?.items || [{ nombre: "Producto de ejemplo", cantidad: 2, precio: 1250 }];
  const lineTotal = (item) => Number(item.subtotal ?? Number(item.precioUnitario || item.precio || 0) * Number(item.cantidad || 1));
  const total = ticket?.total ?? items.reduce((sum, item) => sum + lineTotal(item), 0);
  return (
    <div className="ticket-brand-preview mx-auto border p-4 shadow-sm" style={{ width: `${template.paper}mm`, maxWidth: "100%", background: template.background, color: template.textColor, fontSize: template.fontSize }}>
      <div className="text-center" style={{ color: template.accent }}>
        <b>{template.header}</b>
        {template.showBusiness && <><h3 className="mt-2 text-lg font-black">{business.razonSocial || "MI NEGOCIO"}</h3>{template.showAddress && <p className="text-[10px]">{business.domicilio || "Domicilio del negocio"}</p>}</>}
      </div>
      <div className="my-3 border-y border-dashed py-2 text-[10px]">
        <p>Ticket #{ticket?.id || "000123"}</p>
        <p>{new Date(ticket?.fecha || Date.now()).toLocaleString("es-AR")}</p>
        {template.showCashier && <p>Atendió: {ticket?.quien || "Usuario"}</p>}
        {template.showCustomer && <p>Cliente: {ticket?.clienteNombre || "Consumidor final"}</p>}
      </div>
      <div className="space-y-1">
        {items.map((item, index) => <div key={index} className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words">{item.cantidad || 1} × {item.nombre}<small className="block text-[9px] opacity-70">{money(item.precioUnitario || item.precio || 0)} c/u</small></span><b className="shrink-0">{money(lineTotal(item))}</b></div>)}
      </div>
      <div className="mt-3 flex justify-between border-t pt-2 text-base font-black"><span>TOTAL</span><span>{money(total)}</span></div>
      {template.showPayment && <p className="mt-1 text-[10px]">Pago: {ticket?.medio || ticket?.pagos?.map((payment) => payment.metodo).join(" + ") || "Efectivo"}</p>}
      {template.showBarcode && <TicketBarcode ticketId={ticket?.id || "000123"} color={template.textColor} className="my-3"/>}
      <p className="text-center text-[10px]">{template.footer}</p>
    </div>
  );
}

function DocumentPreview({ document }) {
  if (!document) return null;
  const issuer = document.emisor || {};
  const receiver = typeof document.receptor === "object" ? document.receptor : { nombre: document.receptor };
  return (
    <article className={`invoice-print min-w-0 rounded-xl border bg-white p-4 text-gray-900 sm:p-7 ${document.estado === "anulado" ? "opacity-70" : ""}`}>
      {document.estado === "anulado" && <div className="mb-4 border-4 border-red-600 p-2 text-center text-xl font-black text-red-600">ANULADO</div>}
      <div className="flex flex-col items-start gap-4 border-b-2 border-gray-900 pb-4 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-black">{issuer.razonSocial || "MI NEGOCIO"}</h2>
          <p className="break-words text-sm">CUIT: {issuer.cuit || "Sin configurar"}</p>
          <p className="break-words text-sm">{issuer.domicilio}</p>
          <p className="text-sm">{issuer.condicionFiscal}</p>
          {issuer.ingresosBrutos && <p className="text-xs">Ingresos Brutos: {issuer.ingresosBrutos}</p>}
          {issuer.inicioActividades && <p className="text-xs">Inicio de actividades: {new Date(`${issuer.inicioActividades}T12:00:00`).toLocaleDateString("es-AR")}</p>}
        </div>
        <div className="min-w-0 sm:text-right">
          <div className="inline-flex h-14 w-14 items-center justify-center border-2 border-gray-900 text-3xl font-black">{document.tipo}</div>
          <p className="mt-2 text-sm font-black">COMPROBANTE COMERCIAL</p>
          <p className="break-words font-mono text-sm">{document.numero}</p>
          <p className="text-xs">{new Date(document.fecha).toLocaleString("es-AR")}</p>
        </div>
      </div>

      <div className="my-4 border-2 border-red-600 p-3 text-center text-red-700">
        <b className="block">NO FISCAL · SIN CAE</b>
        <span className="text-xs">No es una factura fiscal ni acredita autorización de ARCA.</span>
      </div>

      <div className="grid gap-2 border-b py-3 text-sm sm:grid-cols-2">
        <p className="break-words"><b>Receptor:</b> {receiver.nombre || "Consumidor final"}</p>
        <p className="break-words"><b>CUIT/DNI:</b> {receiver.documento || "No informado"}</p>
        <p className="break-words"><b>Condición:</b> {receiver.condicionFiscal || "Consumidor final"}</p>
        <p className="break-words"><b>Domicilio:</b> {receiver.domicilio || "No informado"}</p>
      </div>

      <div className="overflow-x-auto py-4">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead><tr className="border-b"><th className="py-2">Producto</th><th className="px-2 text-right">Cantidad</th><th className="px-2 text-right">Precio unitario</th><th className="py-2 text-right">Importe</th></tr></thead>
          <tbody>{(document.items || []).map((item, index) => <tr key={`${item.productId || item.nombre}-${index}`} className="border-b"><td className="break-words py-2">{item.nombre}</td><td className="px-2 text-right">{item.cantidad}</td><td className="px-2 text-right">{money(item.precioUnitario)}</td><td className="py-2 text-right font-semibold">{money(item.subtotal)}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="ml-auto grid max-w-sm gap-1 border-t pt-3 text-sm">
        {Number(document.descuento || 0) > 0 && <div className="flex justify-between gap-4"><span>Descuento incluido</span><span>-{money(document.descuento)}</span></div>}
        {document.tipo === "A" && <><div className="flex justify-between gap-4"><span>Neto gravado</span><span>{money(document.netoGravado)}</span></div><div className="flex justify-between gap-4"><span>IVA {document.alicuotaIva}%</span><span>{money(document.iva)}</span></div></>}
        <div className="flex justify-between gap-4 border-t pt-2 text-xl font-black"><span>TOTAL</span><span>{money(document.total)}</span></div>
      </div>

      <div className="mt-6 grid gap-1 border-t pt-3 text-xs">
        <p><b>Venta origen:</b> #{document.ticketId}</p>
        <p><b>Medio de pago:</b> {document.medioPago}</p>
        <p><b>Código interno:</b> {document.codigoInterno}</p>
        <p><b>Emitido por:</b> {document.emitidoPor}</p>
      </div>
      <p className="mt-4 text-center text-[11px] font-semibold">Documento interno sin validez fiscal. Para emitir una factura oficial se requiere CAE de ARCA.</p>
    </article>
  );
}

export function InvoiceTicketManager({ data, setters, identidad }) {
  const [mode, setMode] = useState("facturas");
  const config = { ...fiscalDefaults, ...(data.configuracionFiscal || {}), ticket: { ...fiscalDefaults.ticket, ...(data.configuracionFiscal?.ticket || {}) } };
  const latest = data.tickets?.filter((ticket) => !ticket.anulado).slice(-50).reverse() || [];
  const [draft, setDraft] = useState({
    tipo: "C",
    ticketId: latest[0]?.id || "",
    receptor: "Consumidor final",
    receptorCuit: "",
    condicionReceptor: "Consumidor final",
    domicilio: "",
    email: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const generating = useRef(false);
  const ticket = useMemo(() => data.tickets?.find((item) => String(item.id) === String(draft.ticketId)), [data.tickets, draft.ticketId]);
  const documentTypes = allowedDocumentTypes(config.condicionFiscal);

  useEffect(() => {
    const suggested = suggestedDocumentType(config.condicionFiscal, draft.condicionReceptor);
    if (draft.tipo !== suggested) setDraft((previous) => ({ ...previous, tipo: suggested }));
  }, [config.condicionFiscal, draft.condicionReceptor]);

  useEffect(() => {
    if (!ticket?.clienteId) return;
    const customer = data.clientes?.find((item) => String(item.id) === String(ticket.clienteId));
    if (customer) setDraft((previous) => ({ ...previous, receptor: customer.nombre || previous.receptor }));
  }, [ticket?.id]);

  const errors = useMemo(() => validateDocumentDraft({ config, draft, ticket, existing: data.comprobantes || [] }), [config, draft, ticket, data.comprobantes]);
  const previewDocument = useMemo(() => {
    if (selectedDocument) return selectedDocument;
    if (!ticket) return null;
    return buildCommercialDocument({ config, draft, ticket, existing: data.comprobantes || [], identity: identidad });
  }, [selectedDocument, ticket, config, draft, data.comprobantes, identidad]);

  const setFiscal = (key, value) => setters.setConfiguracionFiscal((previous) => ({ ...(previous || {}), [key]: value }));
  const setTicket = (key, value) => setters.setConfiguracionFiscal((previous) => ({ ...(previous || {}), ticket: { ...fiscalDefaults.ticket, ...(previous?.ticket || {}), [key]: value } }));

  const generateDocument = () => {
    if (errors.length || !ticket || generating.current) return;
    generating.current = true;
    const document = buildCommercialDocument({ config, draft, ticket, existing: data.comprobantes || [], identity: identidad });
    setters.setComprobantes((previous) => [document, ...(previous || [])]);
    setSelectedDocument(document);
    setShowPreview(true);
    window.setTimeout(() => { generating.current = false; }, 0);
  };

  const openDraftPreview = () => {
    setSelectedDocument(null);
    setShowPreview(true);
  };

  const openSavedDocument = (savedDocument) => {
    setSelectedDocument(savedDocument);
    setShowPreview(true);
    window.setTimeout(() => globalThis.document.querySelector?.(".invoice-print")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  };

  const annulDocument = () => {
    if (!voidTarget) return;
    setters.setComprobantes((previous) => previous.map((item) => item.id === voidTarget.id ? { ...item, estado: "anulado", anuladaFecha: new Date().toISOString(), anuladaPor: identidad?.nombre || identidad?.rol || "Sin identificar" } : item));
    if (selectedDocument?.id === voidTarget.id) setSelectedDocument({ ...selectedDocument, estado: "anulado" });
    setVoidTarget(null);
  };

  const openEmail = (document = previewDocument) => {
    const recipient = document?.receptor?.email || draft.email;
    if (!document || !recipient) return;
    const subject = encodeURIComponent(`Comprobante comercial ${document.tipo} ${document.numero} - ${document.emisor?.razonSocial || "Mi negocio"}`);
    const body = encodeURIComponent(`Hola ${document.receptor?.nombre || ""},\n\nComprobante comercial NO FISCAL ${document.tipo} ${document.numero} por ${money(document.total)}.\nCódigo interno: ${document.codigoInterno}.\n\nEste documento no posee CAE y no es una factura fiscal autorizada por ARCA.\n\n${document.emisor?.razonSocial || "Mi negocio"}`);
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  return (
    <div>
      <div data-tour="invoice-ticket-tabs" className="mb-4 grid grid-cols-2 gap-2 sm:flex">
        <button data-tour="invoice-tab-invoices" onClick={() => setMode("facturas")} className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-sm sm:px-3 ${mode === "facturas" ? "bg-gray-900 text-white" : "bg-white"}`}><ReceiptText size={15} className="mr-2 shrink-0"/><span className="min-w-0 break-words">Comprobantes</span></button>
        <button data-tour="invoice-tab-ticket" onClick={() => setMode("tickets")} className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-sm sm:px-3 ${mode === "tickets" ? "bg-gray-900 text-white" : "bg-white"}`}><Printer size={15} className="mr-2 shrink-0"/><span className="min-w-0 break-words">Diseño del ticket</span></button>
      </div>

      {mode === "tickets" ? (
        <div data-tour="ticket-designer-page" className="grid min-w-0 gap-5 xl:grid-cols-[430px_1fr]">
          <div className="min-w-0 rounded-xl border bg-white p-4">
            <h3 className="font-semibold">Ticket personalizado</h3>
            <p className="mb-4 text-sm text-gray-500">Elegí qué muestra y cómo se imprime el comprobante de venta.</p>
            <div className="space-y-3">
              <label className="text-sm">Encabezado<input value={config.ticket.header} onChange={(event) => setTicket("header", event.target.value)} className={`${field} mt-1`}/></label>
              <label className="text-sm">Pie del ticket<input value={config.ticket.footer} onChange={(event) => setTicket("footer", event.target.value)} className={`${field} mt-1`}/></label>
              <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <fieldset className="min-w-0"><legend className="text-sm">Papel</legend><div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg border">{["58", "80"].map((paper) => <button type="button" key={paper} onClick={() => setTicket("paper", paper)} className={`min-h-10 px-2 py-2 text-sm ${config.ticket.paper === paper ? "bg-gray-900 text-white" : ""}`}>{paper} mm</button>)}</div></fieldset>
                <label className="min-w-0 text-sm">Texto<input type="number" min="9" max="18" value={config.ticket.fontSize} onChange={(event) => setTicket("fontSize", Number(event.target.value))} className={`${field} mt-1 min-w-0`}/></label>
              </div>
              <div className="ticket-color-grid grid gap-2 sm:grid-cols-3">{[["background", "Fondo"], ["textColor", "Texto"], ["accent", "Acento"]].map(([key, label]) => <label key={key} className="min-w-0 rounded-lg border p-2 text-xs"><span className="block truncate">{label}</span><input type="color" value={config.ticket[key]} onChange={(event) => setTicket(key, event.target.value)} className="mt-1 h-9 w-full min-w-0"/></label>)}</div>
              <div className="grid grid-cols-2 gap-2">{[["showBusiness", "Negocio"], ["showAddress", "Dirección"], ["showCashier", "Cajero"], ["showCustomer", "Cliente"], ["showPayment", "Forma de pago"], ["showBarcode", "Código"]].map(([key, label]) => <label key={key} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" className="shrink-0" checked={config.ticket[key]} onChange={(event) => setTicket(key, event.target.checked)}/><span className="min-w-0 break-words">{label}</span></label>)}</div>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border bg-gray-50 p-4 sm:p-5"><p className="mb-3 text-center text-xs font-semibold text-gray-500">VISTA PREVIA</p><TicketPreview config={config} ticket={latest[0]} business={config}/><button onClick={() => window.print()} className="mx-auto mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white sm:w-auto"><Printer size={16}/>Imprimir prueba</button></div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0"><h3 className="font-semibold text-amber-900">Comprobantes comerciales internos</h3><p className="mt-1 text-sm text-amber-800">Tienen numeración, datos completos e historial, pero no son facturas fiscales porque no solicitan CAE a ARCA.</p></div>
              <span className="shrink-0 rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">NO FISCAL · SIN CAE</span>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border bg-white p-4">
              <h3 className="font-semibold">Datos del emisor</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Razón social<input value={config.razonSocial} onChange={(event) => setFiscal("razonSocial", event.target.value)} className={`${field} mt-1`}/></label>
                <label className="text-sm">CUIT<input value={config.cuit} inputMode="numeric" onChange={(event) => setFiscal("cuit", formatCuit(event.target.value))} placeholder="20-12345678-3" className={`${field} mt-1`}/></label>
                <label className="text-sm sm:col-span-2">Domicilio<input value={config.domicilio} onChange={(event) => setFiscal("domicilio", event.target.value)} className={`${field} mt-1`}/></label>
                <label className="text-sm">Punto de venta<input value={config.puntoVenta} inputMode="numeric" onChange={(event) => setFiscal("puntoVenta", event.target.value.replace(/\D/g, "").slice(0, 5))} className={`${field} mt-1`}/></label>
                <label className="text-sm">Ingresos Brutos<input value={config.ingresosBrutos} onChange={(event) => setFiscal("ingresosBrutos", event.target.value)} className={`${field} mt-1`}/></label>
                <label className="text-sm">Inicio de actividades<input type="date" value={config.inicioActividades} onChange={(event) => setFiscal("inicioActividades", event.target.value)} className={`${field} mt-1`}/></label>
                <label className="text-sm">Condición fiscal<CustomSelect className="mt-1" value={config.condicionFiscal} onChange={(value) => setFiscal("condicionFiscal", value)} options={["Monotributista", "Responsable inscripto", "Exento"]}/></label>
                {config.condicionFiscal === "Responsable inscripto" && <label className="text-sm">Alícuota de IVA<input type="number" min="0" max="100" value={config.alicuotaIva} onChange={(event) => setFiscal("alicuotaIva", Number(event.target.value))} className={`${field} mt-1`}/></label>}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4">
              <h3 className="font-semibold">Nuevo comprobante</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm">Tipo<CustomSelect className="mt-1" value={draft.tipo} onChange={(value) => setDraft((previous) => ({ ...previous, tipo: value }))} options={documentTypes.map((type) => ({ value: type, label: `Comprobante ${type}` }))}/></label>
                <label className="min-w-0 text-sm">Venta origen<CustomSelect className="mt-1" value={String(draft.ticketId)} onChange={(value) => { setSelectedDocument(null); setDraft((previous) => ({ ...previous, ticketId: value })); }} options={[{ value: "", label: "Elegí una venta" }, ...latest.map((item) => ({ value: String(item.id), label: `#${item.id} · ${money(item.total)}` }))]}/></label>
                <label className="min-w-0 text-sm">Condición del receptor<CustomSelect className="mt-1" value={draft.condicionReceptor} onChange={(value) => setDraft((previous) => ({ ...previous, condicionReceptor: value }))} options={receiverConditions}/></label>
                <label className="min-w-0 text-sm">Cliente / razón social<input value={draft.receptor} onChange={(event) => setDraft((previous) => ({ ...previous, receptor: event.target.value }))} className={`${field} mt-1`}/></label>
                <label className="min-w-0 text-sm">CUIT o DNI<input value={draft.receptorCuit} inputMode="numeric" onChange={(event) => setDraft((previous) => ({ ...previous, receptorCuit: event.target.value }))} className={`${field} mt-1`}/></label>
                <label className="min-w-0 text-sm">Domicilio<input value={draft.domicilio} onChange={(event) => setDraft((previous) => ({ ...previous, domicilio: event.target.value }))} className={`${field} mt-1`}/></label>
                <label className="min-w-0 text-sm sm:col-span-2">Correo<input type="email" value={draft.email} onChange={(event) => setDraft((previous) => ({ ...previous, email: event.target.value }))} className={`${field} mt-1`}/></label>
              </div>

              {errors.length > 0 ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={15}/>Falta completar</div><ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700"><CheckCircle2 size={16}/>Listo para generar el comprobante interno.</div>}

              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                <button disabled={!ticket} onClick={openDraftPreview} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40 sm:w-auto"><Eye size={15}/>Vista previa</button>
                <button disabled={errors.length > 0} onClick={generateDocument} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40 sm:w-auto"><Save size={15}/>Generar comprobante</button>
                <button disabled={!previewDocument || !draft.email} onClick={() => openEmail()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40 sm:w-auto"><Mail size={15}/>Abrir correo</button>
              </div>
            </section>
          </div>

          {showPreview && previewDocument && <section>
            <DocumentPreview document={previewDocument}/>
            <div className="mt-3 flex flex-col justify-end gap-2 print:hidden sm:flex-row">
              <p className="mr-auto self-center text-xs text-gray-500">Para obtener un PDF elegí “Guardar como PDF” en la ventana de impresión.</p>
              <button onClick={() => openEmail(previewDocument)} disabled={!previewDocument.receptor?.email} className="flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><Mail size={15}/>Correo</button>
              <button onClick={() => window.print()} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white"><Printer size={15}/>Imprimir / PDF</button>
            </div>
          </section>}

          {(data.comprobantes || []).length > 0 && <section className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold">Historial de comprobantes</h3>
            <p className="mt-1 text-xs text-gray-500">Los números utilizados se conservan aunque un comprobante sea anulado.</p>
            <div className="mt-3 space-y-2">{data.comprobantes.map((document) => <div key={document.id} className={`flex min-w-0 flex-col items-start gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${document.estado === "anulado" ? "border-red-200 bg-red-50" : ""}`}>
              <span className="min-w-0 break-words"><b>{document.tipo} {document.numero}</b> · {document.receptor?.nombre || document.receptor || "Consumidor final"}<small className="mt-1 block text-gray-500">{new Date(document.fecha).toLocaleString("es-AR")} · Venta #{document.ticketId}</small></span>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"><b className="mr-auto sm:mr-1">{money(document.total)}</b><span className={`rounded-full px-2 py-1 text-xs font-semibold ${document.estado === "anulado" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{document.estado === "anulado" ? "ANULADO" : "NO FISCAL"}</span><button onClick={() => openSavedDocument(document)} className="min-h-9 rounded-lg border px-3 text-xs">Ver</button>{document.estado !== "anulado" && <button onClick={() => setVoidTarget(document)} className="flex min-h-9 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs text-red-600"><XCircle size={13}/>Anular</button>}</div>
            </div>)}</div>
          </section>}
        </div>
      )}

      <ConfirmDialog open={Boolean(voidTarget)} title="Anular comprobante" message={`Se marcará como anulado el comprobante ${voidTarget?.tipo || ""} ${voidTarget?.numero || ""}. Su número no volverá a utilizarse.`} confirmLabel="Anular comprobante" danger onCancel={() => setVoidTarget(null)} onConfirm={annulDocument}/>
    </div>
  );
}
