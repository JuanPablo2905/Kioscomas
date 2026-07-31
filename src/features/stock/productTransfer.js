const HEADERS = ["nombre", "codigo", "categoria", "unidad", "costo", "venta", "deposito", "vitrina", "minimo", "alertaVitrina", "vencimiento", "familia", "variante"];
const LABELS = ["Nombre", "Código", "Categoría", "Unidad", "Costo", "Venta", "Depósito", "Vitrina", "Stock mínimo", "Alerta vitrina", "Vencimiento", "Familia", "Variante"];
const escapeCsv = (value) => { const text = String(value ?? ""); return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const escapeXml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const productColumns = HEADERS;

export function productsToCsv(products) {
  return `\uFEFF${[LABELS.join(","), ...products.map((product) => HEADERS.map((key) => escapeCsv(product[key])).join(","))].join("\r\n")}`;
}

export function productsToExcelXml(products) {
  const rows = [LABELS, ...products.map((product) => HEADERS.map((key) => product[key] ?? ""))];
  const body = rows.map((row, rowIndex) => `<Row>${row.map((value, col) => { const numeric = rowIndex > 0 && [4,5,6,7,8,9].includes(col); return `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="${numeric ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`; }).join("")}</Row>`).join("");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F2937" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Productos"><Table>${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>`;
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; } else if ((char === "," || char === ";") && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row); return rows;
}

const normalizeHeader = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = { nombre: "nombre", codigo: "codigo", categoria: "categoria", unidad: "unidad", costo: "costo", venta: "venta", precioventa: "venta", deposito: "deposito", stock: "deposito", vitrina: "vitrina", stockminimo: "minimo", minimo: "minimo", alertavitrina: "alertaVitrina", vencimiento: "vencimiento", familia: "familia", variante: "variante" };

export function rowsToProducts(rows) {
  if (rows.length < 2) return [];
  const keys = rows[0].map((header) => aliases[normalizeHeader(header)] || null);
  return rows.slice(1).map((row, index) => { const item = {}; keys.forEach((key, col) => { if (key) item[key] = row[col] ?? ""; }); ["costo","venta","deposito","vitrina","minimo","alertaVitrina"].forEach((key) => { item[key] = Number(String(item[key] ?? 0).replace(",", ".")) || 0; }); item.nombre = String(item.nombre || "").trim(); item.codigo = String(item.codigo || "").trim(); item.categoria = item.categoria || "Sin categoría"; item.unidad = ["unidad","peso","volumen"].includes(item.unidad) ? item.unidad : "unidad"; item.importRow = index + 2; return item; }).filter((item) => item.nombre);
}

export function parseProductFile(text, filename = "") {
  if (/\.xls$/i.test(filename) || text.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    const documentXml = new DOMParser().parseFromString(text, "application/xml");
    const rows = [...documentXml.getElementsByTagNameNS("urn:schemas-microsoft-com:office:spreadsheet", "Row")].map((row) => [...row.getElementsByTagNameNS("urn:schemas-microsoft-com:office:spreadsheet", "Data")].map((cell) => cell.textContent || ""));
    return rowsToProducts(rows);
  }
  return rowsToProducts(parseCsv(text.replace(/^\uFEFF/, "")));
}

export function mergeImportedProducts(current, imported, mode = "actualizar") {
  const next = [...current]; let added = 0; let updated = 0;
  imported.forEach((item) => { const index = item.codigo ? next.findIndex((product) => String(product.codigo) === item.codigo) : next.findIndex((product) => product.nombre.toLowerCase() === item.nombre.toLowerCase()); const clean = { ...item }; delete clean.importRow; if (index >= 0 && mode === "actualizar") { next[index] = { ...next[index], ...clean }; updated += 1; } else if (index < 0) { next.push({ id: Date.now() + added, ...clean, historial: [] }); added += 1; } });
  return { products: next, added, updated };
}

export function downloadText(content, filename, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
