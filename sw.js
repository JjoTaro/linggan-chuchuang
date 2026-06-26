// 灵感橱窗 Service Worker —— 让弱网/断网也不白屏。
// 策略：HTML 走「网络优先」(保证能拿到更新，不会被旧缓存卡死)，
//       同源静态资源走「缓存优先 + 后台更新」，跨域请求(AI 代理/同步)一律不拦截。
// 升级页面只需改动 index.html 即可（HTML 永远先走网络）；
// 若更换了图标/manifest 等静态资源，把下面的版本号 +1。
const CACHE = "iw-cache-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（AI 代理 / 同步）不拦截

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0;
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(function (resp) { const cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); return resp; })
        .catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./index.html"); }); })
    );
    return;
  }

  // 其他同源静态资源：缓存优先，后台顺手更新
  e.respondWith(
    caches.match(req).then(function (m) {
      const fetchP = fetch(req)
        .then(function (resp) { if (resp && resp.status === 200) { const cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } return resp; })
        .catch(function () { return m; });
      return m || fetchP;
    })
  );
});
