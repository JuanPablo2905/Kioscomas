import React, { useState } from "react";
import { BellRing, ClipboardList, Truck } from "lucide-react";
import { ComprasView } from "./ComprasView";
import { ProveedoresView } from "../proveedores/ProveedoresView";
import { SmallBusinessTools } from "../gestion/SmallBusinessTools";
import { AppSelect } from "../../shared/controls";

export function ComprasArea({ products, setProducts, comprasItems, setComprasItems, proveedores, setProveedores, pedidos, setPedidos, tickets = [], listaCompras = [], setListaCompras, recordatoriosProveedor = [], setRecordatoriosProveedor, tutorialMode = false }) {
  const [tab, setTab] = useState("compras");
  const tabs = [["compras","Compras y pedidos",ClipboardList],["proveedores","Proveedores",Truck],["avisos","Lista y recordatorios",BellRing]];
  return <div className="min-w-0">
    <div data-tour="purchase-tabs" className="desktop-section-tabs flex gap-2 overflow-x-auto border-b bg-gray-50 px-8 pt-4">{tabs.map(([id,label,Icon]) => <button data-tour={`purchase-tab-${id}`} key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium ${tab === id ? "border border-b-white bg-white text-gray-900 -mb-px" : "text-gray-500"}`}><Icon size={16}/>{label}</button>)}</div>
    <div data-tour="purchase-mobile-tabs" className="mobile-section-select"><span>Sección de Compras</span><AppSelect value={tab} onChange={setTab} options={tabs.map(([value, label]) => ({ value, label }))}/></div>
    <div data-tour={`purchase-content-${tab}`}>
      {tab === "compras" ? <ComprasView products={products} setProducts={setProducts} comprasItems={comprasItems} setComprasItems={setComprasItems} proveedores={proveedores} pedidos={pedidos} setPedidos={setPedidos} tickets={tickets} tutorialMode={tutorialMode}/> : tab === "proveedores" ? <ProveedoresView proveedores={proveedores} setProveedores={setProveedores} products={products} setProducts={setProducts}/> : <div className="min-w-0 p-4 sm:p-6 md:p-8"><SmallBusinessTools data={{ listaCompras, recordatoriosProveedor, products: [], tickets: [], gastos: [] }} setters={{ setListaCompras, setRecordatoriosProveedor }} sectionsAllowed={["lista","recordatorios"]}/></div>}
    </div>
  </div>;
}
