/* Plot works offline: the app's own files are kept on the device. Notes are never here: they live in IndexedDB. */
const CACHE = "plot-1.0.1";
const FILES = ["./", "index.html", "plot.css", "plot.js", "manifest.webmanifest", "fonts/space-grotesk.woff2", "icons/favicon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  const key = r.mode === "navigate" ? "index.html" : r;
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
    if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => hit)));
});
