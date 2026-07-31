export function calcularPrecioSugerido(costoBase, factorVenta, margenPorcentaje) {
  const costoUnitario = Number(costoBase) / (Number(factorVenta) || 1);
  const margen = Number(margenPorcentaje);

  if (!Number.isFinite(costoUnitario) || costoUnitario <= 0 || !Number.isFinite(margen) || margen < 0) {
    return null;
  }

  return Math.ceil(costoUnitario * (1 + margen / 100));
}
