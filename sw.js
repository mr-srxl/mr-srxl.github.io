/* SRXL OS — service worker */
const CACHE = "srxl-os-v1";

const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/styles/01-tokens.css",
  "/styles/02-boot.css",
  "/styles/03-desktop.css",
  "/styles/04-windows.css",
  "/styles/05-doc.css",
  "/styles/06-code.css",
  "/styles/07-blog.css",
  "/styles/08-gallery.css",
  "/styles/09-terminal.css",
  "/styles/10-taskbar.css",
  "/styles/11-syntax.css",
  "/styles/12-responsive.css",
  "/styles/13-settings.css",
  "/styles/99-custom.css",
  "/apps/about.html",
  "/apps/learning.html",
  "/apps/skills.html",
  "/apps/settings.html",
  "/apps/python/index.html",
  "/apps/blog/index.html",
  "/apps/gallery.html",
  "/apps/blog/posts.json"
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