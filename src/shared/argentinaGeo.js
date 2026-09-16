import { cloudFetch } from "../cloud/cloudAuth";
import { loadCloudConfig } from "../cloud/config";

const read = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo consultar el catálogo geográfico.");
  return payload;
};

const apiUrl = () => {
  const config = loadCloudConfig();
  if (!config.enabled || !config.apiUrl) throw new Error("Necesitás la nube de Kiosco+ para usar el selector de ubicación.");
  return config.apiUrl;
};

export const fetchArgentinaProvincias = async () => {
  const payload = await read(await cloudFetch(apiUrl(), "/v1/geo/provincias"));
  return payload.provincias || [];
};

export const fetchArgentinaLocalidades = async (provinciaId) => {
  const payload = await read(await cloudFetch(apiUrl(), `/v1/geo/localidades?provincia=${encodeURIComponent(provinciaId)}`));
  return payload.localidades || [];
};
