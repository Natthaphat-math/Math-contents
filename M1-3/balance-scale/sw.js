/* Service worker: เก็บไฟล์ของแอปไว้ในเครื่อง เพื่อให้ใช้ต่อได้เมื่ออินเทอร์เน็ตหลุด
   ใช้ path แบบสัมพัทธ์ทั้งหมด จึงทำงานได้ใต้ sub-path ของ GitHub Pages (/<repo>/)
   เมื่อแก้ไขไฟล์ใด ๆ ให้เปลี่ยนเลขเวอร์ชันของ CACHE */
var CACHE = 'balance-scale-v1';
var ASSETS = [
  './',
  './index.html',
  './teacher-guide.html',
  './css/style.css',
  './js/model.js',
  './js/app.js',
  './icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// ใช้ไฟล์ในเครื่องก่อน (เร็ว/ออฟไลน์ได้) แล้วอัปเดตจากเซิร์ฟเวอร์เบื้องหลัง
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req.url.split('?')[0], res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    });
  }));
});
