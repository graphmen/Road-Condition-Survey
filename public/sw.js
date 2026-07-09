const CACHE_NAME = "zim-roads-dashboard-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/coat_of_arms.png",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// Install Event - cache core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - network-first falling back to cache
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip POST, PUT, DELETE requests (only cache GET requests)
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const url = new URL(event.request.url);
          const isStaticAsset = ASSETS_TO_CACHE.includes(url.pathname) || 
                                url.pathname.startsWith("/_next/") ||
                                url.pathname.endsWith(".js") ||
                                url.pathname.endsWith(".css") ||
                                url.pathname.endsWith(".png") ||
                                url.pathname.endsWith(".json");

          if (isStaticAsset) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
        });
      })
  );
});
