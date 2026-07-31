import { loadCloudConfig } from "../cloud/config";

export const CURRENT_VERSION = "0.1.0";
const parts = (value) => String(value).split(".").map((item) => Number(item) || 0);
export function isNewerVersion(candidate, current = CURRENT_VERSION) {
  const a=parts(candidate), b=parts(current);
  for(let i=0;i<Math.max(a.length,b.length);i++){ if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false; }
  return false;
}
export async function checkForUpdates() {
  const config=loadCloudConfig();
  if(!config.apiUrl)return {currentVersion:CURRENT_VERSION,available:false,reason:"server_not_configured"};
  const response=await fetch(`${config.apiUrl.replace(/\/$/,"")}/v1/releases/latest?channel=${encodeURIComponent(config.updateChannel)}`);
  if(!response.ok)throw new Error(`No se pudo comprobar la versión (${response.status})`);
  const release=await response.json();
  return {currentVersion:CURRENT_VERSION,available:isNewerVersion(release.version),release};
}
