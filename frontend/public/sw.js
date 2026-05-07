/**
 * Sokoni Chat – Service Worker v6
 * Clears all old caches, takes control immediately, then reloads
 * any clients still running under the old SW so they get fresh assets.
 */

const CACHE_NAME = "sokoni-v6";

self.addEventListener("install", () => {
  self.skipWaiting(); // activate immediately without waiting
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // take control of all open tabs
      .then(() => {
        // Tell every open client to reload so they get the fresh JS bundle
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED" });
            client.navigate(client.url); // force reload
          });
        });
      })
  );
});

// Pass all fetches straight to the network — no caching
self.addEventListener("fetch", () => {});
