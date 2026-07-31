import React from "react";
import { AlertTriangle, Package, Printer, ReceiptText, ShoppingCart, Warehouse, X } from "lucide-react";
import { money } from "./domain";
import { TicketBarcode } from "./TicketBarcodeView";

export function GlobalScanResult({ result, onClose, onSale, onStock, onPrint, onVoid }) {
  if (!result) return null;
  const { type, product, ticket, code } = result;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true">
      <div className="mobile-dialog max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {type === "ticket" ? "Ticket detectado" : type === "product" ? "Producto detectado" : "Código desconocido"}
            </p>
            <h2 className="mt-1 break-words text-xl font-bold text-gray-900">
              {ticket ? `Ticket #${ticket.id}` : product?.nombre || code}
            </h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={20}/></button>
        </div>

        {type === "product" && product && (
          <>
            <div className="mt-4 rounded-xl border bg-gray-50 p-4">
              <Package className="mb-2 text-blue-600" size={24}/>
              <p className="font-semibold">{money(product.venta)} / {product.unidad === "unidad" ? "unidad" : product.unidad}</p>
              <p className="mt-1 text-sm text-gray-500">Vitrina: {product.vitrina || 0} · Depósito: {product.deposito || 0}</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-400">{code}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onStock} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Warehouse size={17}/>Ver stock</button>
              <button onClick={onSale} disabled={Number(product.vitrina || 0) <= 0} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><ShoppingCart size={17}/>Agregar a venta</button>
            </div>
          </>
        )}

        {type === "ticket" && ticket && (
          <>
            <div className="mt-4 rounded-xl border bg-gray-50 p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>{new Date(ticket.fecha).toLocaleString("es-AR")}</span>
                <b>{money(ticket.total)}</b>
              </div>
              <p className="mt-1 text-xs text-gray-500">Pago: {ticket.medio || "Sin informar"} · Atendió: {ticket.quien || "Sin identificar"}</p>
              {ticket.estado === "anulado" && <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">Este ticket ya está anulado.</p>}
              <div className="mt-3 space-y-2 border-y py-3">
                {(ticket.items || []).map((item, index) => {
                  const lineTotal = Number(item.subtotal ?? Number(item.precioUnitario || item.precio || 0) * Number(item.cantidad || 0));
                  return <div key={`${item.productId || item.nombre}-${index}`} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.cantidad} × {item.nombre}<small className="block text-gray-500">{money(item.precioUnitario || item.precio || 0)} c/u</small></span><b className="shrink-0">{money(lineTotal)}</b></div>;
                })}
              </div>
              <TicketBarcode ticketId={ticket.id} className="mt-3"/>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onPrint} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Printer size={17}/>Reimprimir</button>
              <button onClick={onVoid} disabled={ticket.estado === "anulado"} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><ReceiptText size={17}/>Anular / devolver</button>
            </div>
          </>
        )}

        {type === "unknown" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={24}/>
            <p className="mt-2 font-semibold">No coincide con un producto ni con un ticket de este negocio.</p>
            <p className="mt-1 break-all font-mono text-xs">{code}</p>
          </div>
        )}
      </div>
    </div>
  );
}
