import React, { useEffect, useState } from "react";
import { ArchiveRestore, Download, RefreshCw, ShieldAlert } from "lucide-react";
import { repository } from "../../cloud/repository";

const backupLabel = (backup) => {
  const date = new Date(`${backup.day}T12:00:00`);
  const formatted = Number.isNaN(date.getTime()) ? backup.day : date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  return `${formatted}${backup.moment === "start_of_day" ? " · inicio del día" : " · última copia local"}`;
};

export function DataRecoveryPanel({ account, enabled = false }) {
  const [backups, setBackups] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!enabled) return;
    setBusy(true); setStatus("");
    try {
      const result = await repository.listRecoveryBackups();
      setBackups(result.backups || []);
      setSelectedDay((current) => current || result.backups?.[0]?.day || "");
    } catch (error) { setStatus(error?.message || "No se pudieron consultar los respaldos."); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, [enabled]);

  const exportData = async () => {
    setBusy(true); setStatus("");
    try {
      const result = await repository.exportBusinessData();
      const blob = new Blob([JSON.stringify(result.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kiosco-plus-${String(account?.nombreNegocio || "negocio").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Exportación completa descargada. Guardala en un lugar seguro.");
    } catch (error) { setStatus(error?.message || "No se pudo exportar la información."); }
    finally { setBusy(false); }
  };

  const inspect = async () => {
    if (!selectedDay) return;
    setBusy(true); setStatus(""); setPreview(null); setConfirmation("");
    try { setPreview(await repository.previewRecovery(selectedDay)); }
    catch (error) { setStatus(error?.message || "No se pudo comparar el respaldo."); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    if (!preview || confirmation.trim() !== String(account?.nombreNegocio || "").trim()) return;
    setBusy(true); setStatus("Recuperando y descargando la copia elegida...");
    try {
      await repository.restoreRecovery(selectedDay, confirmation);
      setPreview(null); setConfirmation("");
      await load();
      setStatus("Recuperación terminada. La app ya cargó la copia elegida.");
    } catch (error) { setStatus(error?.message || "No se pudo recuperar la copia."); setBusy(false); }
  };

  if (!enabled) return <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600"><b>Respaldo administrado por el dueño</b><p className="mt-1 text-xs leading-5">La exportación completa y la recuperación de copias sólo están disponibles para el dueño del negocio.</p></div>;

  return <section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold text-emerald-950">Respaldo y recuperación</h3><p className="mt-1 text-xs leading-5 text-emerald-900">Descargá una copia completa o compará un respaldo del servidor antes de recuperarlo. Usuarios, contraseñas, abono y dispositivos actuales no se reemplazan.</p></div><button type="button" onClick={exportData} disabled={busy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1C4A44] px-4 text-xs font-bold text-white disabled:opacity-50"><Download size={16}/>Descargar copia completa</button></div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><select value={selectedDay} onChange={(event) => { setSelectedDay(event.target.value); setPreview(null); }} className="min-h-11 min-w-0 rounded-xl border bg-white px-3 text-sm"><option value="">No hay copias disponibles</option>{backups.map((backup) => <option key={backup.day} value={backup.day}>{backupLabel(backup)}</option>)}</select><button type="button" onClick={inspect} disabled={busy || !selectedDay} className="min-h-11 rounded-xl border bg-white px-4 text-xs font-bold disabled:opacity-45">Comparar antes de recuperar</button><button type="button" onClick={load} disabled={busy} aria-label="Actualizar respaldos" className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white disabled:opacity-45"><RefreshCw size={16} className={busy ? "animate-spin" : ""}/></button></div>
    {preview && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-start gap-2"><ShieldAlert size={19} className="mt-0.5 shrink-0"/><div><b>Copia del {new Date(`${preview.backupDay}T12:00:00`).toLocaleDateString("es-AR")}</b><p className="mt-1 text-xs leading-5">Ahora hay {preview.current?.totalRecords || 0} registros; la copia tiene {preview.backup?.totalRecords || 0}. Se detectaron {preview.differences?.length || 0} grupos con cantidades distintas.</p></div></div><label className="mt-3 block text-xs font-semibold">Para confirmar, escribí exactamente: <b>{account?.nombreNegocio}</b></label><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm"/><button type="button" onClick={restore} disabled={busy || confirmation.trim() !== String(account?.nombreNegocio || "").trim()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-xs font-bold text-white disabled:bg-gray-300"><ArchiveRestore size={16}/>Recuperar esta copia</button></div>}
    {status && <p className={`rounded-lg px-3 py-2 text-xs leading-5 ${/terminada|descargada/i.test(status) ? "bg-white text-emerald-800" : "bg-white text-gray-700"}`}>{status}</p>}
  </section>;
}
