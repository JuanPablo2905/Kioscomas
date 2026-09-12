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

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  let quoted = false; let commas = 0; let semicolons = 0;
  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"') quoted = !quoted;
    else if (!quoted && firstLine[index] === ",") commas += 1;
    else if (!quoted && firstLine[index] === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; } else if (char === delimiter && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row); return rows;
}

const normalizeHeader = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = { nombre: "nombre", codigo: "codigo", categoria: "categoria", unidad: "unidad", costo: "costo", venta: "venta", precioventa: "venta", deposito: "deposito", stock: "deposito", vitrina: "vitrina", stockminimo: "minimo", minimo: "minimo", alertavitrina: "alertaVitrina", vencimiento: "vencimiento", familia: "familia", variante: "variante" };
const numericFields = new Set(["costo", "venta", "deposito", "vitrina", "minimo", "alertaVitrina"]);

export function parseLocaleNumber(value) {
  const original = String(value ?? "").trim().replace(/[\s\u00A0]/g, "");
  if (!original) return null;
  const negative = /^-/.test(original);
  const text = original.replace(/[^0-9.,-]/g, "").replace(/-/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    normalized = text.replace(thousands, "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(/,/g, ".");
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, "");
  }
  const number = Number(`${negative ? "-" : ""}${normalized}`);
  return Number.isFinite(number) ? number : null;
}

export function rowsToProducts(rows) {
  if (rows.length < 2) return [];
  const keys = rows[0].map((header) => aliases[normalizeHeader(header)] || null);
  return rows.slice(1).map((row, index) => {
    const item = {};
    const importedFields = [];
    keys.forEach((key, col) => {
      if (!key) return;
      const raw = String(row[col] ?? "").trim();
      if (!raw) return;
      const value = numericFields.has(key) ? parseLocaleNumber(raw) : raw;
      if (value === null) return;
      item[key] = value;
      importedFields.push(key);
    });
    if (item.nombre !== undefined) item.nombre = String(item.nombre).trim();
    if (item.codigo !== undefined) item.codigo = String(item.codigo).trim();
    if (item.unidad !== undefined) item.unidad = ["unidad", "peso", "volumen"].includes(String(item.unidad).toLowerCase()) ? String(item.unidad).toLowerCase() : "unidad";
    item.importRow = index + 2;
    Object.defineProperty(item, "importedFields", { value: importedFields, enumerable: false });
    return item;
  }).filter((item) => item.nombre || item.codigo);
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
  const next = [...current]; let added = 0; let updated = 0; let skipped = 0;
  imported.forEach((item) => {
    const code = String(item.codigo || "").trim();
    const name = String(item.nombre || "").trim();
    const index = code
      ? next.findIndex((product) => String(product.codigo || "").trim() === code)
      : next.findIndex((product) => name && String(product.nombre || "").trim().toLowerCase() === name.toLowerCase());
    const fields = item.importedFields || Object.keys(item).filter((key) => key !== "importRow");
    const clean = Object.fromEntries(fields.filter((key) => item[key] !== undefined).map((key) => [key, item[key]]));
    if (index >= 0 && mode === "actualizar") {
      next[index] = { ...next[index], ...clean };
      updated += 1;
    } else if (index < 0 && name) {
      const id = `producto-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${added}-${Math.random().toString(36).slice(2, 10)}`}`;
      next.push({ categoria: "Sin categoría", unidad: "unidad", costo: 0, venta: 0, deposito: 0, vitrina: 0, minimo: 0, alertaVitrina: 0, ...clean, id, historial: [] });
      added += 1;
    } else skipped += 1;
  });
  return { products: next, added, updated, skipped };
}

export function downloadText(content, filename, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
