import React, { useState } from "react";
import { CalendarClock, ClipboardCheck, Package, RotateCcw } from "lucide-react";
import { StockView } from "./StockView";
import { VencimientosView } from "../vencimientos/VencimientosView";
import { InventoryView } from "./InventoryView";
import { SmallBusinessTools } from "../gestion/SmallBusinessTools";
import { AppSelect } from "../../shared/controls";

export function StockArea({ products, setProducts, proveedores, puedeEditarPrecios, puedeEliminar, puedeCrearDirecto, sugerencias, setSugerencias, identidad, perdidas, setPerdidas, inventarios, setInventarios, preferences, autoconsumos = [], setAutoconsumos, tutorialMode = false, initialProduct = null, onInitialProductHandled }) {
  const [tab, setTab] = useState("stock");
  const tabs = [["stock", "Productos", Package], ["vencimientos", "Vencimientos y pérdidas", CalendarClock], ["inventario", "Conteo físico", ClipboardCheck], ["autoconsumo", "Autoconsumo", RotateCcw]];
  return <div>
    <div data-tour="stock-tabs" className="desktop-section-tabs stock-area-tabs flex gap-2 border-b bg-gray-50 px-8 pt-4">{tabs.map(([id, label, Icon]) => <button data-tour={`stock-tab-${id}`} key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium ${tab === id ? "-mb-px border border-b-white bg-white text-gray-900" : "text-gray-500"}`}><Icon size={16}/>{label}</button>)}</div>
    <div data-tour="stock-tabs" className="mobile-section-select"><span>Sección de Stock</span><AppSelect value={tab} onChange={setTab} options={tabs.map(([value, label]) => ({ value, label }))}/></div>
    <div data-tour={`stock-content-${tab}`}>
      {tab === "stock" ? <StockView products={products} setProducts={setProducts} proveedores={proveedores} puedeEditarPrecios={puedeEditarPrecios} puedeEliminar={puedeEliminar} puedeCrearDirecto={puedeCrearDirecto} sugerencias={sugerencias} setSugerencias={setSugerencias} identidad={identidad} preferences={preferences} tutorialMode={tutorialMode} initialProduct={initialProduct} onInitialProductHandled={onInitialProductHandled}/> : tab === "vencimientos" ? <VencimientosView products={products} setProducts={setProducts} perdidas={perdidas} setPerdidas={setPerdidas}/> : tab === "inventario" ? <InventoryView products={products} setProducts={setProducts} inventarios={inventarios} setInventarios={setInventarios} identidad={identidad}/> : <div className="p-4 sm:p-8"><SmallBusinessTools data={{ products, autoconsumos, tickets: [], gastos: [] }} setters={{ setProducts, setAutoconsumos }} identidad={identidad} sectionsAllowed={["autoconsumo"]}/></div>}
    </div>
  </div>;
}
