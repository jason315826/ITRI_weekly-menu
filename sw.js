// 呷奔 PWA Service Worker
// 目的：安裝到主畫面後可離線開啟、加快載入速度。
// 菜單資料（menu.json）一律優先連網抓最新版本，只有離線時才退回快取，
// 確保「即時更新」功能不會被快取卡住。

const CACHE_VERSION = 'v1';
const CACHE_NAME = `chiaben-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n.startsWith('chiaben-') && n !== CACHE_NAME)
             .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只處理 GET；其他方法（例如 admin 頁面呼叫 GitHub API 的 PUT/POST）完全不攔截。
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 非本站的請求（例如 GitHub API、字型 CDN）交給瀏覽器原生處理，不快取、不攔截。
  if (url.origin !== self.location.origin) return;

  // menu.json：network-first，離線時才退回快取，確保資料最新。
  if (url.pathname.endsWith('menu.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 其他本站資源（頁面、圖示等）：cache-first，同時背景更新快取。
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
