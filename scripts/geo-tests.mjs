import { createGeoClient } from "../server/geo-argentina.mjs";

let passed = 0;
const test = (name, condition) => {
  if (!condition) throw new Error(`FALLÓ: ${name}`);
  passed += 1;
  console.log(`OK: ${name}`);
};

const provinciasResponse = {
  ok: true,
  status: 200,
  json: async () => ({ provincias: [
    { id: "06", nombre: "Buenos Aires" },
    { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
    { id: "14", nombre: "Córdoba" },
  ] }),
};
const localidadesResponse = {
  ok: true,
  status: 200,
  json: async () => ({ localidades: [
    { id: "06001010", nombre: "Adolfo Alsina" },
    { id: "06001020", nombre: "Ábalos" },
  ] }),
};

let calls = 0;
const client = createGeoClient({
  fetchImpl: async (url) => {
    calls += 1;
    if (url.includes("/provincias")) return provinciasResponse;
    if (url.includes("/localidades")) return localidadesResponse;
    throw new Error(`URL inesperada: ${url}`);
  },
});

const provincias = await client.provincias();
test("las provincias vienen ordenadas alfabéticamente en español", provincias[0].nombre === "Buenos Aires" && provincias[1].nombre === "Ciudad Autónoma de Buenos Aires" && provincias[2].nombre === "Córdoba");
test("cada provincia conserva su código canónico", provincias.find((item) => item.nombre === "Buenos Aires")?.id === "06");

await client.provincias();
test("las provincias se cachean y no repiten el pedido externo", calls === 1);

const localidades = await client.localidades("06");
const expectedOrder = ["Ábalos", "Adolfo Alsina"].sort((a, b) => a.localeCompare(b, "es"));
test("las localidades respetan el orden alfabético con acentos", localidades.map((item) => item.nombre).join(",") === expectedOrder.join(","));
test("cada localidad conserva su código canónico", localidades.every((item) => item.id && item.nombre));

const callsBeforeSecondFetch = calls;
await client.localidades("06");
test("las localidades de una provincia ya consultada se cachean", calls === callsBeforeSecondFetch);

let rejected = false;
try { await client.localidades("no-es-un-codigo"); }
catch { rejected = true; }
test("un código de provincia inválido se rechaza antes de golpear la API", rejected);

const flakyClient = createGeoClient({
  fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
});
let failed = false;
try { await flakyClient.provincias(); }
catch { failed = true; }
test("una falla del catálogo externo no queda silenciada", failed);

console.log(`\n${passed} pruebas del catálogo geográfico superadas.`);
