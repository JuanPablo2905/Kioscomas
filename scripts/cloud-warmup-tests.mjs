import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const { getCloudWarmupState, startCloudWarmup } = await import("../src/cloud/cloudWarmup.js");

try {
  let attempts = 0;
  globalThis.fetch = async (url, options) => {
    attempts += 1;
    assert.match(String(url), /\/v1\/ready$/);
    assert.equal(options.method, "GET");
    if (attempts === 1) return new Response(JSON.stringify({ ok: false, error: "starting" }), { status: 503 });
    return new Response(JSON.stringify({ ok: true, persistence: "postgresql" }), { status: 200 });
  };

  await startCloudWarmup("https://warmup-retry.example.com/", { retryDelayMs: 0, attemptTimeoutMs: 100, totalTimeoutMs: 1_000 });
  assert.equal(attempts, 2, "debe reintentar mientras Render se inicia");
  assert.equal(getCloudWarmupState().status, "ready");

  let releaseFetch;
  let concurrentAttempts = 0;
  globalThis.fetch = () => {
    concurrentAttempts += 1;
    return new Promise((resolve) => { releaseFetch = () => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })); });
  };
  const first = startCloudWarmup("https://warmup-dedupe.example.com", { attemptTimeoutMs: 500, totalTimeoutMs: 1_000 });
  const second = startCloudWarmup("https://warmup-dedupe.example.com", { attemptTimeoutMs: 500, totalTimeoutMs: 1_000 });
  assert.equal(first, second, "dos operaciones simultáneas deben compartir el mismo despertar");
  releaseFetch();
  await Promise.all([first, second]);
  assert.equal(concurrentAttempts, 1, "el inicio no debe duplicar tráfico");

  await startCloudWarmup("https://warmup-dedupe.example.com");
  assert.equal(concurrentAttempts, 1, "una nube recién comprobada no debe recibir otro ping");

  console.log("cloud-warmup-tests: 9 assertions passed");
} finally {
  globalThis.fetch = originalFetch;
}

