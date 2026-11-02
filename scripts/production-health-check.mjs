const apiUrl = String(process.env.KIOSCO_MONITOR_API_URL || "https://kiosco-plus-api.onrender.com").replace(/\/$/, "");
const appUrl = String(process.env.KIOSCO_MONITOR_APP_URL || "https://app.kioscomas.ar").replace(/\/$/, "");
const timeoutMs = Math.max(3000, Number(process.env.KIOSCO_MONITOR_TIMEOUT_MS || 20000));

const check = async (label, url, validate) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "KioscoPlus-Production-Monitor/1.0" } });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const detail = validate(text, response);
    console.log(`OK ${label} · ${Date.now() - startedAt} ms${detail ? ` · ${detail}` : ""}`);
  } finally { clearTimeout(timer); }
};

const failures = [];
for (const [label, url, validate] of [
  ["API /v1/health", `${apiUrl}/v1/health`, (text) => {
    const detail = JSON.parse(text);
    if (!detail.ok || detail.persistence !== "postgresql" || detail.localMode !== false) throw new Error("La API no está en modo PostgreSQL de producción");
    return `revisión ${detail.revision ?? "—"}`;
  }],
  ["API /v1/ready", `${apiUrl}/v1/ready`, (text) => {
    const detail = JSON.parse(text);
    if (!detail.ok || detail.persistence !== "postgresql") throw new Error("La persistencia no está lista");
    return `${detail.recordCount || 0} registros`;
  }],
  ["Aplicación web", appUrl, (text, response) => {
    if (!String(response.headers.get("content-type") || "").includes("text/html") || !/Kiosco\+|<div id="root"/i.test(text)) throw new Error("La aplicación no devolvió su HTML");
    return "HTML disponible";
  }],
]) {
  try { await check(label, url, validate); }
  catch (error) { failures.push(`${label}: ${error?.name === "AbortError" ? `superó ${timeoutMs} ms` : error.message}`); }
}

if (failures.length) {
  console.error("FALLÓ EL MONITOREO DE KIOSCO+");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Producción responde correctamente.");
}
