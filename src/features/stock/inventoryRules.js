import { roundQuantity } from "../../shared/domain";

export const stockTotal = (product) => roundQuantity(Number(product.deposito || 0) + Number(product.vitrina || 0));

export function inventoryDifference(product, physical) {
  const esperado = stockTotal(product);
  const contado = roundQuantity(Number(physical) || 0);
  const diferencia = roundQuantity(contado - esperado);
  return { esperado, contado, diferencia, costoDiferencia: Math.round(diferencia * Number(product.costo || 0) * 100) / 100 };
}

export function applyInventory(products, entries) {
  const map = new Map(entries.map((entry) => [entry.productId, entry]));
  return products.map((product) => {
    const entry = map.get(product.id);
    if (!entry) return product;
    const physical = Math.max(0, Number(entry.contado) || 0);
    const vitrina = Math.min(Number(product.vitrina || 0), physical);
    return { ...product, vitrina: roundQuantity(vitrina), deposito: roundQuantity(physical - vitrina) };
  });
}
