/* SRXL OS — service worker
   Perf v3: trimmed SHELL to critical first-paint assets only.
   The previous v2 precached ~50 files on install, which saturated
   bandwidth on first visit and slowed the actual page load. Now only
   the files needed for first paint are precached; everything else
   (other CSS, Python chapters, blog posts, images) is runtime-cached
   on first use via the cache-first fallback below. Offline still works
   after first visit to each page. */
const CACHE = "srxl-os-v3";

/* Critical shell: only what's needed to render the boot screen + desktop
   + the About window (which opens by default). Everything else is
   runtime-cached on first fetch. */
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  /* Boot + desktop + taskbar CSS (first paint) */
  "/styles/01-tokens.css",
  "/styles/02-boot.css",
  "/styles/03-desktop.css",
  "/styles/04-windows.css",
  "/styles/10-taskbar.css",
  "/styles/12-responsive.css",
  /* Reading mode + doc CSS (needed by the About window that opens by default) */
  "/styles/05-doc.css",
  "/styles/15-reading.css",
  "/styles/16-headers.css",
  "/styles/17-light-theme.css",
  /* Default window content */
  "/apps/about.html",
  /* LCP wallpaper + avatar (about window) */
  "/pic/win_bag.webp",
  "/pic/1.webp",
  "/pic/favicon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () { /* tolerate missing assets */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  const url = new URL(req.url);
  const isHtml = req.destination === "document" || url.pathname.endsWith(".html") || url.pathname === "/";

  if (isHtml) {
    // Network-first for HTML so content updates propagate
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("/index.html");
        });
      })
    );
    return;
  }

  // Cache-first for everything else (CSS, JS, images, JSON, fonts)
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});
