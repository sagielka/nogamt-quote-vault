function isQuoteVaultCache(name) {
  if (name === "html-shell" || name === "hashed-assets") return true;
  const isWorkboxCache = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return isWorkboxCache && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

// Cleanup-only worker: wipe legacy caches and unregister. It must NOT navigate
// clients — the page-level purge script owns the single reload, otherwise the
// user sees two refreshes before getting the final build.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCaches = cacheNames.filter(isQuoteVaultCache);
        await Promise.allSettled(appCaches.map((name) => caches.delete(name)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

// Never serve anything from cache while this worker is alive.
self.addEventListener("fetch", () => {});
