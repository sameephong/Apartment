/* ดูแลตึก · Service Worker — ทำให้เปิดเป็นแอปได้ เปิดเร็ว และเปิดได้แม้เน็ตหลุด
 * - หน้าเว็บ (.html): ดึงใหม่ก่อน ถ้าเน็ตหลุดใช้ตัวที่จำไว้ (อัปเดตแล้วเห็นทันที)
 * - ไฟล์ที่มี ?v= (css/js): ใช้ตัวที่จำไว้ทันที (เปลี่ยนเวอร์ชันเมื่ออัปเดต)
 * - config.js: ดึงใหม่ก่อนเสมอ
 * - ข้อมูลจาก Google Apps Script: ไม่แตะ (ส่งตรงทุกครั้ง) */
const CACHE = 'dulaetuek-v5.6';
const CORE = ['./', './index.html', './admin.html', './tenant.html', './bill.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const same = url.origin === self.location.origin, cdn = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!same && !cdn) return; // Apps Script / LINE ฯลฯ ไม่แคช
  const isPage = req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
  const isConfig = same && /config\.js$/.test(url.pathname);
  if (isPage || isConfig) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(isConfig ? new Request(url.origin + url.pathname) : req, cp)); } return res; })
      .catch(() => caches.match(isConfig ? url.origin + url.pathname : req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
