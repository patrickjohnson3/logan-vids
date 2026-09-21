"use strict";

const CACHE_NAME = "repeat-logan-vids-shell-ea96233b06d5";
const CACHE_PREFIX = "repeat-logan-vids-shell-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./youtube.js",
  "./state.js",
  "./speech.js",
  "./render-parent.js",
  "./render-kid.js",
  "./player.js",
  "./toml.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
const APP_SHELL_URLS = new Set(
  APP_SHELL.map((asset) => new URL(asset, self.location.href).href)
);

self.addEventListener("install", (event) => {
  const shellRequests = APP_SHELL.map((asset) => new Request(asset, { cache: "reload" }));
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(shellRequests))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!APP_SHELL_URLS.has(event.request.url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      return cached || fetch(event.request);
    })
  );
});
