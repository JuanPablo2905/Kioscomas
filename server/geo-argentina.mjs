const GEOREF_URL = "https://apis.datos.gob.ar/georef/api";

const normalizeList = (items = []) => items
  .map((item) => ({ id: String(item?.id || ""), nombre: String(item?.nombre || "").trim() }))
  .filter((item) => item.id && item.nombre)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// Georef es el catálogo oficial de provincias y localidades de Argentina
// (apis.datos.gob.ar). Ninguna provincia supera las ~900 localidades
// (Buenos Aires, la más grande), así que un pedido por provincia alcanza
// sin paginar. Los datos prácticamente no cambian, por eso se cachean.
export const createGeoClient = ({ fetchImpl = fetch, ttlMs = 24 * 60 * 60 * 1000 } = {}) => {
  let provinciasCache = null;
  const localidadesCache = new Map();

  const request = async (pathname) => {
    const response = await fetchImpl(`${GEOREF_URL}${pathname}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Georef respondió HTTP ${response.status}`);
    return response.json();
  };

  const provincias = async () => {
    if (provinciasCache && Date.now() - provinciasCache.at < ttlMs) return provinciasCache.data;
    const data = await request("/provincias?campos=id,nombre&max=30");
    const list = normalizeList(data?.provincias);
    provinciasCache = { at: Date.now(), data: list };
    return list;
  };

  const localidades = async (provinciaId) => {
    const id = String(provinciaId || "").trim();
    if (!/^\d{2}$/.test(id)) throw new Error("La provincia indicada no es válida");
    const cached = localidadesCache.get(id);
    if (cached && Date.now() - cached.at < ttlMs) return cached.data;
    const data = await request(`/localidades?provincia=${id}&campos=id,nombre&max=5000`);
    const list = normalizeList(data?.localidades);
    localidadesCache.set(id, { at: Date.now(), data: list });
    return list;
  };

  return { provincias, localidades };
};
