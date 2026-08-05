/**
 * Minimal service worker: network-first for navigations & API (so content is
 * fresh online), falling back to a runtime cache when offline. Lets previously
 * visited study pages open without a connection. Zero cost.
 */
const CACHE = "dryrun-ai-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Don't cache auth or mutations.
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a copy of successful GETs for offline fallback.
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        // Network failed (offline, or a transient blip). Serve whatever
        // we have cached, in order of usefulness — but always resolve
        // to a real Response: resolving `undefined` here makes the
        // browser treat the whole navigation as a hard failure (a blank
        // "This page couldn't load" screen), even when the network is
        // actually fine and this was just a one-off timeout.
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          const dashboard = await caches.match("/dashboard");
          if (dashboard) return dashboard;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return fetch(req);
      })
  );
});
