/* ═══════════════════════════════════════════════════════════════════════════
   Outlet Intelligence — Offline-First Service Worker
   Cache strategy: cache-first for same-origin GETs; network fallback; nav
   requests fall back to cached index.html. No imports, plain JS.
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = "outlet-intel-v1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
];

// ─── Install: precache shell + skipWaiting ────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old versioned caches, claim clients ──────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: cache-first with runtime caching of successful same-origin GETs ──
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Pass through cross-origin requests and API calls unchanged
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Network fallback with runtime caching
      return fetch(request)
        .then((networkResponse) => {
          // Cache successful same-origin responses at runtime
          if (
            networkResponse.ok &&
            url.origin === self.location.origin
          ) {
            const responseToCache = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // Navigation requests fall back to the cached index.html shell
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          // For other failed fetches return an empty 503
          return new Response("Service unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        });
    })
  );
});
