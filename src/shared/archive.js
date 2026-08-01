export function downloadTextFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCommercialArchive({ businessName = "Kiosco+", comprobantes = [], year = "todos" }) {
  const selected = year === "todos" ? comprobantes : comprobantes.filter((item) => String(new Date(item.fecha).getFullYear()) === String(year));
  const payload = {
    formato: "kiosco-plus-archivo-comercial-v1",
    negocio: businessName,
    exportadoEn: new Date().toISOString(),
    advertencia: "Comprobantes comerciales internos. No sustituyen comprobantes fiscales con CAE de ARCA.",
    comprobantes: selected,
  };
  const suffix = year === "todos" ? "completo" : year;
  downloadTextFile(`kiosco-plus-archivo-${suffix}.json`, JSON.stringify(payload, null, 2));
  return selected.length;
}

export function cleanOperationalDataset(dataset, months = 12) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Math.max(1, Number(months) || 12));
  const isRecent = (value) => !value || Number.isNaN(new Date(value).getTime()) || new Date(value) >= cutoff;
  const next = { ...dataset };
  const removed = {};
  const clean = (key, predicate) => {
    const source = dataset[key] || [];
    next[key] = source.filter((item) => !predicate(item) || isRecent(item.recibidoFecha || item.fecha || item.updatedAt || item.para));
    removed[key] = source.length - next[key].length;
  };
  clean("comprasItems", (item) => item.estado === "recibido");
  clean("listaCompras", (item) => item.completo === true);
  clean("recordatoriosProveedor", (item) => item.completo === true);
  clean("sugerencias", (item) => ["resuelta", "aprobada", "rechazada"].includes(item.estado));
  const total = Object.values(removed).reduce((sum, value) => sum + value, 0);
  return { dataset: next, removed, total, cutoff: cutoff.toISOString() };
}
