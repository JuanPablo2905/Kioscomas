import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Receipt, Trash2, X } from "lucide-react";
import { money } from "../../shared/domain";
import { SectionHeader } from "../../shared/layout";
import { AppSelect, DateInput, NumberInput } from "../../shared/controls";
import { isExpenseOverdue } from "./expenseRules";

const CATEGORIES = ["Mercadería", "Servicios", "Alquiler", "Transporte", "Mantenimiento", "Impuestos", "Sueldos", "Otro"];

function GastoModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    descripcion: "",
    categoria: "Servicios",
    monto: "",
    vencimiento: new Date().toISOString().slice(0, 10),
    medio: "Efectivo",
    estado: "pagado",
    recurrente: false,
  });
  const set = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div data-tour="expense-dialog" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">Registrar gasto</h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div data-tour="expense-form" className="space-y-3">
          <input autoFocus value={form.descripcion} onChange={set("descripcion")} placeholder="Descripción" className="w-full min-w-0 rounded-lg border px-3 py-2" />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <AppSelect value={form.categoria} onChange={(value) => setForm((current) => ({ ...current, categoria: value }))}>
              {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </AppSelect>
            <NumberInput value={form.monto} min={0} onChange={set("monto")} placeholder="Monto" />
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <DateInput value={form.vencimiento} onChange={set("vencimiento")} />
            <AppSelect value={form.medio} onChange={(value) => setForm((current) => ({ ...current, medio: value }))}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
              <option>Mercado Pago</option>
              <option>Otro</option>
            </AppSelect>
          </div>
          <div data-tour="expense-status" className="grid grid-cols-2 gap-2 sm:gap-3">
            <label className="flex min-h-11 items-center rounded-lg border p-2 text-sm sm:p-3">
              <input type="radio" name="estado" value="pagado" checked={form.estado === "pagado"} onChange={set("estado")} className="mr-2 shrink-0" />
              Ya pagado
            </label>
            <label className="flex min-h-11 items-center rounded-lg border p-2 text-sm sm:p-3">
              <input type="radio" name="estado" value="pendiente" checked={form.estado === "pendiente"} onChange={set("estado")} className="mr-2 shrink-0" />
              Pendiente
            </label>
          </div>
          <label data-tour="expense-recurring" className="flex min-h-11 items-center gap-2 rounded-lg py-1 text-sm text-gray-600">
            <input type="checkbox" checked={form.recurrente} onChange={set("recurrente")} className="shrink-0" />
            Es un gasto recurrente
          </label>
          {form.recurrente && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              <b>Recurrente:</b> identifica algo que suele repetirse, como alquiler, Internet o sueldos. Queda marcado para encontrarlo fácilmente; no crea un gasto nuevo automáticamente.
            </p>
          )}
          <p data-tour="expense-impact" className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
            Este gasto se descontará de la ganancia en Reportes, pero no modificará la caja.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="min-h-11 rounded-lg border px-3 py-2 text-sm">Cancelar</button>
          <button
            data-tour="expense-save"
            disabled={!form.descripcion.trim() || Number(form.monto) <= 0}
            onClick={() => onSave({ ...form, monto: Number(form.monto), descripcion: form.descripcion.trim() })}
            className="min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Guardar gasto
          </button>
        </div>
      </div>
    </div>
  );
}

export function GastosView({ gastos, setGastos }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("todos");
  const visible = gastos.filter((item) => filter === "todos" || item.estado === filter);
  const paid = gastos.filter((item) => item.estado === "pagado").reduce((sum, item) => sum + item.monto, 0);
  const pending = gastos.filter((item) => item.estado === "pendiente").reduce((sum, item) => sum + item.monto, 0);
  const save = (form) => {
    const expense = {
      id: Date.now(),
      ...form,
      fecha: new Date().toISOString(),
      pagadoFecha: form.estado === "pagado" ? new Date().toISOString() : null,
    };
    setGastos((previous) => [expense, ...previous]);
    setModalOpen(false);
  };
  const pay = (expense) => setGastos((previous) => previous.map((item) =>
    item.id === expense.id ? { ...item, estado: "pagado", pagadoFecha: new Date().toISOString() } : item
  ));

  return (
    <div className="min-w-0 p-4 sm:p-6 md:p-8">
      <SectionHeader
        title="Gastos del negocio"
        subtitle="Afectan la ganancia real, pero no modifican automáticamente el saldo de caja."
        actions={(
          <button data-tour="expense-new" onClick={() => setModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white sm:w-auto">
            <Plus size={16} />
            Registrar gasto
          </button>
        )}
      />

      <div data-tour="expense-summary" className="mb-5 grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl border p-4"><p className="text-xs text-gray-500">Pagado</p><p className="break-words text-xl font-bold sm:text-2xl">{money(paid)}</p></div>
        <div className="min-w-0 rounded-xl border p-4"><p className="text-xs text-gray-500">Pendiente</p><p className="break-words text-xl font-bold text-amber-600 sm:text-2xl">{money(pending)}</p></div>
        <div className="min-w-0 rounded-xl border p-4"><p className="text-xs text-gray-500">Impacto en ganancia</p><p className="break-words text-xl font-bold text-red-600 sm:text-2xl">-{money(paid)}</p></div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[["todos", "Todos"], ["pagado", "Pagados"], ["pendiente", "Pendientes"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`min-h-10 rounded-full border px-4 py-1.5 text-xs ${filter === id ? "bg-gray-900 text-white" : "bg-white"}`}>{label}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-400 sm:p-12">
          <Receipt className="mx-auto mb-2" />
          No hay gastos en este grupo.
        </div>
      ) : (
        <div data-tour="expense-list" className="space-y-2">
          {visible.map((expense) => {
            const overdue = isExpenseOverdue(expense);
            return (
              <div key={expense.id} className={`flex min-w-0 flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${overdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                <div className="flex min-w-0 items-start gap-3">
                  {overdue && <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-600" />}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 break-words font-semibold">
                      <span>{expense.descripcion}</span>
                      {expense.__tutorial && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">EJEMPLO FICTICIO</span>}
                      {expense.recurrente && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">RECURRENTE</span>}
                    </p>
                    <p className="break-words text-xs leading-relaxed text-gray-500">
                      {expense.categoria} · vence {new Date(`${expense.vencimiento}T00:00:00`).toLocaleDateString("es-AR")} · {expense.medio}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">{money(expense.monto)}</p>
                    <p className={`text-xs ${expense.estado === "pagado" ? "text-green-600" : overdue ? "text-red-600" : "text-amber-600"}`}>
                      {expense.estado === "pagado" ? "Pagado" : overdue ? "Vencido" : "Pendiente"}
                    </p>
                  </div>
                  {expense.estado === "pendiente" && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => pay(expense)} className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-600 text-white" title="Marcar pagado" aria-label={`Marcar pagado ${expense.descripcion}`}><CheckCircle2 size={17} /></button>
                      <button onClick={() => setGastos((previous) => previous.filter((item) => item.id !== expense.id))} className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label={`Eliminar ${expense.descripcion}`}><Trash2 size={17} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modalOpen && <GastoModal onClose={() => setModalOpen(false)} onSave={save} />}
    </div>
  );
}
