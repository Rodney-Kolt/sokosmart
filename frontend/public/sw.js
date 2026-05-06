/**
 * Sokoni Chat – Service Worker v2
 * Handles offline caching and navigation fallback.
 * Version bumped to force replacement of old cached SW.
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

const CACHE_NAME = "sokoni-v2";  // bumped from v1 to force cache refresh
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  "/",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install: precache shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with offline fallback ────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Cache-first for static assets
  if (event.request.destination === "style" ||
      event.request.destination === "script" ||
      event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return resp;
        })
      )
    );
  }
});

// ── Message: skip waiting ─────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
