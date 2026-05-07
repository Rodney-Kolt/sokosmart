/**
 * Sokoni Chat – Service Worker v5 (cache-busting reset)
 * This version intentionally clears ALL previous caches and does NOT
 * cache JS/CSS assets — Vite's generated SW handles that separately.
 * Bumping the version forces all clients to get a fresh install.
 */

const CACHE_NAME = "sokoni-v5";

// ── Install: claim immediately, cache nothing ─────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ── Activate: delete ALL old caches ──────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: always go to network, no caching ───────────────────────────────
self.addEventListener("fetch", (event) => {
  // Let all requests pass through to the network normally.
  // Do NOT intercept — this prevents stale asset issues.
});
