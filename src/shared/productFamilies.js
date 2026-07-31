const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function inferredFamily(product) {
  if (product?.familia?.trim()) return product.familia.trim();
  const name = String(product?.nombre || "").trim();
  if (/^coca[ -]?cola\b/i.test(name)) return "Coca-Cola";
  if (/^monster(?: energy)?\b/i.test(name)) return "Monster Energy";
  return name
    .replace(/\b(zero|light|sin azucar|original)\b/gi, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ml|cc|l|lt|lts|g|gr|kg)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || name;
}

export function productVariant(product, family = inferredFamily(product)) {
  if (product?.variante?.trim()) return product.variante.trim();
  const remainder = String(product?.nombre || "").replace(new RegExp(`^${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "").trim();
  return remainder || product?.nombre || "Presentación única";
}

export function groupProductFamilies(products = []) {
  const groups = new Map();
  products.forEach((product) => {
    const name = inferredFamily(product);
    const key = normalize(name).toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, name, products: [] });
    groups.get(key).products.push(product);
  });
  return [...groups.values()];
}
