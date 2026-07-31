import React, { useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { mergeImportedProducts, parseProductFile, productsToCsv, productsToExcelXml, downloadText } from "./productTransfer";
import { AppSelect } from "../../shared/controls";

export function ProductTransferModal({ products, setProducts, onClose }) {
  const [imported, setImported] = useState([]); const [filename, setFilename] = useState(""); const [mode, setMode] = useState("actualizar"); const [error, setError] = useState("");
  const read = async (event) => { const file = event.target.files?.[0]; if (!file) return; setError(""); try { if (/\.xlsx$/i.test(file.name)) throw new Error("Guardá el archivo como Excel 97-2003 (.xls) o CSV para importarlo."); const parsed = parseProductFile(await file.text(), file.name); if (!parsed.length) throw new Error("No encontramos productos ni encabezados compatibles."); setImported(parsed); setFilename(file.name); } catch (reason) { setError(reason.message || "No se pudo leer el archivo."); setImported([]); } };
  const apply = () => { const result = mergeImportedProducts(products, imported, mode); setProducts(result.products); onClose(`${result.added} agregado(s) y ${result.updated} actualizado(s)`); };
  const stamp = new Date().toISOString().slice(0,10);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
    <div className="max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-lg font-bold">Importar y exportar productos</h2><p className="text-xs text-gray-500">Usá la plantilla para conservar nombres y formatos de columnas.</p></div>
        <button onClick={() => onClose()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" aria-label="Cerrar"><X size={20}/></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => downloadText(productsToExcelXml(products), `productos-${stamp}.xls`, "application/vnd.ms-excel")} className="flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left"><FileSpreadsheet className="shrink-0 text-green-700"/><span className="min-w-0"><b className="block text-sm">Exportar para Excel</b><small className="text-gray-500">Archivo .xls formateado</small></span></button>
        <button onClick={() => downloadText(productsToCsv(products), `productos-${stamp}.csv`, "text/csv;charset=utf-8")} className="flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left"><Download className="shrink-0 text-blue-700"/><span className="min-w-0"><b className="block text-sm">Exportar CSV</b><small className="text-gray-500">Compatible con Excel y otros sistemas</small></span></button>
      </div>
      <label className="mt-5 flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm"><Upload size={18} className="shrink-0"/>Seleccionar archivo CSV o Excel .xls<input type="file" accept=".csv,.xls,text/csv,application/vnd.ms-excel" onChange={read} className="hidden"/></label>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {imported.length > 0 && <div className="mt-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{filename}</p><p className="text-xs text-gray-500">{imported.length} producto(s) válidos encontrados</p></div><AppSelect value={mode} onChange={setMode} className="w-full sm:w-72" options={[{ value: "actualizar", label: "Actualizar existentes y agregar nuevos" }, { value: "nuevos", label: "Agregar solamente nuevos" }]}/></div>
        <div className="max-h-48 overflow-auto rounded-lg border"><table className="min-w-[34rem] w-full text-left text-xs"><thead className="sticky top-0 bg-gray-100"><tr><th className="p-2">Nombre</th><th>Código</th><th>Categoría</th><th>Costo</th><th>Venta</th></tr></thead><tbody>{imported.slice(0,100).map((item) => <tr key={`${item.importRow}-${item.codigo}`} className="border-t"><td className="p-2 font-medium">{item.nombre}</td><td>{item.codigo || "—"}</td><td>{item.categoria}</td><td>{item.costo}</td><td>{item.venta}</td></tr>)}</tbody></table></div>
        <div className="mt-4"><button onClick={apply} className="min-h-11 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white sm:w-auto">Importar {imported.length} producto(s)</button></div>
      </div>}
    </div>
  </div>;
}
