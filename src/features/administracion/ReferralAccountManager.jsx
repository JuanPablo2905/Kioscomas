import React, { useMemo, useState } from "react";
import { Ban, Gift, Plus, RotateCcw, Trash2 } from "lucide-react";
import { activeManualDiscounts, monthlyPriceFor, referralStatus } from "../../billing/referrals";
import { AppSelect } from "../../shared/controls";
import { KioscoDatePicker, datePickerHelpers } from "../../shared/KioscoDatePicker";

const statusLabels = {
  sin_referido: "No usó un código",
  pendiente: "Pendiente del primer pago",
  activo: "Activo: suma 20%",
  pausado: "Pausado: el abono no está vigente",
  invalidado: "Invalidado manualmente",
};

export function ReferralAccountManager({ account, accounts, onUpdate }) {
  const [discount, setDiscount] = useState({ percent: 10, reason: "", expiresAt: "" });
  const [invalidReason, setInvalidReason] = useState("");
  const status = referralStatus(account);
  const pricing = monthlyPriceFor(account, accounts);
  const activeManualIds = useMemo(() => new Set(activeManualDiscounts(account).map((item) => item.id)), [account.manualDiscounts]);
  const referrerOptions = [{ value: "", label: "Sin negocio referente" }, ...accounts.filter((candidate) => candidate.id !== account.id).map((candidate) => ({ value: String(candidate.id), label: `${candidate.nombreNegocio} · ${candidate.referralCode || "sin código"}` }))];

  const changeReferrer = (id) => {
    const referrer = accounts.find((candidate) => String(candidate.id) === String(id));
    onUpdate({
      referredByAccountId: referrer?.id || null,
      referredByCode: referrer?.referralCode || null,
      referralInvalidatedAt: null,
      referralInvalidatedReason: null,
    });
  };
  const invalidate = () => {
    if (!account.referredByAccountId) return;
    onUpdate({ referralInvalidatedAt: new Date().toISOString(), referralInvalidatedReason: invalidReason.trim() || "Invalidado por el administrador" });
    setInvalidReason("");
  };
  const restore = () => onUpdate({ referralInvalidatedAt: null, referralInvalidatedReason: null });
  const addDiscount = () => {
    const percent = Math.min(100, Math.max(1, Number(discount.percent) || 0));
    if (!discount.reason.trim()) return;
    const entry = {
      id: globalThis.crypto?.randomUUID?.() || `descuento-${Date.now()}`,
      percent,
      reason: discount.reason.trim(),
      startsAt: new Date().toISOString(),
      expiresAt: discount.expiresAt ? new Date(`${discount.expiresAt}T23:59:59`).toISOString() : null,
      createdAt: new Date().toISOString(),
      createdBy: "Administrador de Kiosco+",
      revokedAt: null,
    };
    onUpdate({ manualDiscounts: [entry, ...(account.manualDiscounts || [])] });
    setDiscount({ percent: 10, reason: "", expiresAt: "" });
  };
  const updateDiscount = (id, changes) => onUpdate({ manualDiscounts: (account.manualDiscounts || []).map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) });
  const revokeDiscount = (id) => updateDiscount(id, { revokedAt: new Date().toISOString(), revokedReason: "Quitado por el administrador" });

  return <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 text-sm font-bold"><Gift size={16}/>Referidos y descuentos</h3><p className="mt-1 text-xs text-gray-600">El 20% automático cuenta únicamente mientras el abono del referido esté vigente. Se pausa al vencer y vuelve cuando renueva.</p></div><span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#1C4A44]">Total actual: {pricing.discountPercent}%</span></div>

    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Código que usó este negocio</p>
        <div className="mt-2"><AppSelect value={String(account.referredByAccountId || "")} onChange={changeReferrer} options={referrerOptions}/></div>
        <p className="mt-2 text-xs"><b>Estado:</b> {statusLabels[status] || status}</p>
        {account.referralInvalidatedReason && <p className="mt-1 text-xs text-red-700">Motivo: {account.referralInvalidatedReason}</p>}
        {account.referredByAccountId && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={invalidReason} onChange={(event) => setInvalidReason(event.target.value)} placeholder="Motivo, si necesitás invalidarlo" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs"/>{status === "invalidado" ? <button type="button" onClick={restore} className="inline-flex items-center justify-center gap-1 rounded-lg border border-green-300 px-3 py-2 text-xs font-semibold text-green-700"><RotateCcw size={14}/>Restaurar</button> : <button type="button" onClick={invalidate} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><Ban size={14}/>Invalidar</button>}</div>}
      </div>

      <div className="rounded-xl border bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Agregar descuento manual</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[90px_minmax(0,1fr)]"><label className="rounded-lg border px-2 py-1"><span className="block text-[9px] font-bold uppercase text-gray-400">Porcentaje</span><input type="number" min="1" max="100" value={discount.percent} onChange={(event) => setDiscount({ ...discount, percent: event.target.value })} className="w-full bg-transparent text-sm outline-none"/></label><input value={discount.reason} onChange={(event) => setDiscount({ ...discount, reason: event.target.value })} placeholder="Motivo obligatorio" className="rounded-lg border px-3 py-2 text-xs"/><div className="sm:col-span-2"><span className="mb-1 block text-[10px] text-gray-500">Vence (opcional)</span><KioscoDatePicker value={discount.expiresAt} min={datePickerHelpers.dateValue(new Date())} onChange={(expiresAt) => setDiscount({ ...discount, expiresAt })}/></div><button type="button" disabled={!discount.reason.trim()} onClick={addDiscount} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#1C4A44] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 sm:col-span-2"><Plus size={14}/>Agregar descuento</button></div>
      </div>
    </div>

    {(account.manualDiscounts || []).length > 0 && <div className="mt-3 overflow-hidden rounded-xl border bg-white"><div className="bg-gray-50 px-3 py-2 text-xs font-bold">Descuentos manuales</div><div className="divide-y">{(account.manualDiscounts || []).map((item) => <div key={item.id} className={`grid gap-2 px-3 py-3 text-xs sm:grid-cols-[90px_minmax(0,1fr)_180px_auto] sm:items-center ${activeManualIds.has(item.id) ? "" : "opacity-50"}`}><label className="rounded-lg border px-2 py-1"><span className="block text-[9px] uppercase text-gray-400">Porcentaje</span><input type="number" min="1" max="100" disabled={!!item.revokedAt} value={item.percent} onChange={(event) => updateDiscount(item.id, { percent: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })} className="w-full bg-transparent outline-none"/></label><input disabled={!!item.revokedAt} value={item.reason} onChange={(event) => updateDiscount(item.id, { reason: event.target.value })} className="min-w-0 rounded-lg border px-3 py-2"/><KioscoDatePicker disabled={!!item.revokedAt} value={item.expiresAt ? String(item.expiresAt).slice(0, 10) : ""} onChange={(expiresAt) => updateDiscount(item.id, { expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null })}/>{!item.revokedAt ? <button type="button" onClick={() => revokeDiscount(item.id)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-600"><Trash2 size={13}/>Quitar</button> : <span className="text-center text-gray-500">Quitado</span>}</div>)}</div></div>}
  </div>;
}
