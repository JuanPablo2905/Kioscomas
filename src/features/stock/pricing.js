export function redondearPrecio(value, mode = "centavos") {
  const price = Number(value);
  if (!Number.isFinite(price)) return 0;
  const step = ({ centavos: 0.01, unidad: 1, decena: 10, centena: 100 })[mode] || 0.01;
  return Math.round(price / step) * step;
}

export function calcularPrecioSugerido(costoBase, factorVenta, margenPorcentaje, rounding = "unidad") {
  const costoUnitario = Number(costoBase) / (Number(factorVenta) || 1);
  const margen = Number(margenPorcentaje);

  if (!Number.isFinite(costoUnitario) || costoUnitario <= 0 || !Number.isFinite(margen) || margen < 0) {
    return null;
  }

  const raw = costoUnitario * (1 + margen / 100);
  if (rounding === "centavos") return Math.ceil(raw * 100) / 100;
  const step = ({ unidad: 1, decena: 10, centena: 100 })[rounding] || 1;
  return Math.ceil(raw / step) * step;
}
