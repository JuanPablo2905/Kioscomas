const CACHE_NAME = "kioscoplus-shell-v6";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([
    "./",
    "./manifest.webmanifest",
    "./terminos.html",
    "./pwa-icon.svg",
    "./pwa-icon-192.png",
    "./pwa-icon-512.png",
    "./pwa-icon-maskable-512.png",
    "./apple-touch-icon.png",
    "./kiosco-plus-mark.svg",
    "./kiosco-plus-lockup.svg",
    "./kiosco-plus-lockup-principal.svg",
    "./fraunces-brand.woff2",
  ])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("./"))));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; } catch { payload = { body: event.data?.text?.() || "Tenés una novedad en Kiosco+." }; }
  const title = payload.title || "Kiosco+";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "Tenés una novedad en Kiosco+.",
    icon: "./pwa-icon-192.png",
    badge: "./pwa-icon-192.png",
    tag: payload.id || "kioscoplus-notification",
    renotify: payload.level === "urgente",
    data: { url: payload.url || "./?view=notificaciones", id: payload.id || null },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "./?view=notificaciones", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const current = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (current) {
      await current.focus();
      if ("navigate" in current) await current.navigate(destination);
      return;
    }
    await self.clients.openWindow(destination);
  }));
});
