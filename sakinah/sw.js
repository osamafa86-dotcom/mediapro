/* سكينة — عامل الخدمة: عمل دون اتصال + إشعارات */
const VERSION = 'sakinah-v1.3.0';
const FONT_CACHE = 'sakinah-mushaf-fonts'; // خطوط صفحات المصحف (تُملأ عند الطلب أو بالتنزيل الكامل من الخيارات)
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/ui/components.js', './js/ui/prayer-view.js', './js/ui/qibla-view.js', './js/ui/adhkar-view.js',
  './js/ui/hadith-view.js', './js/ui/settings-view.js',
  './js/core/astro.js', './js/core/prayer-times.js', './js/core/methods.js', './js/core/qibla.js', './js/core/geomag.js', './js/core/hijri.js',
  './js/platform/storage.js', './js/platform/location.js', './js/platform/compass.js', './js/platform/notifications.js',
  './js/data/adhkar.js', './js/data/hadith.js', './js/data/hadith/part-a.js', './js/data/hadith/part-b.js', './js/data/cities.js',
  './js/data/quran-meta.js', './js/core/quran.js', './js/platform/audio.js', './js/platform/speech.js', './js/ui/quran-view.js', './js/ui/more-view.js', './data/quran.json',
  './js/core/mushaf.js', './js/ui/mushaf-page.js', './js/ui/mushaf-reader.js', './js/platform/mushaf-fonts.js', './js/data/bismillah.js', './data/mushaf-layout.json', './js/data/world-land.js', './js/core/tafsir.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/fonts/AmiriQuran.woff2',
];
// ورقة أنماط الخطوط (ملفات الخطوط نفسها تُخزَّن عند أول طلب عبر معالج fetch)
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap';

self.addEventListener('install', (e) => {
  // cache:'reload' يتجاوز كاش HTTP للمتصفح كي تُخزَّن النسخة الجديدة فعلًا عند رفع الإصدار
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled([
    ...CORE.map((u) => c.add(new Request(u, { cache: 'reload' }))),
    c.add(new Request(FONT_CSS, { cache: 'reload' })).catch(() => {}),
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE && k !== 'sakinah-tafsir').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// استراتيجية: الملفات المحلية = الكاش أولًا مع تحديث بالخلفية؛ الخطوط = الكاش أولًا؛ الشبكة الخارجية الأخرى = الشبكة أولًا
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  // خطوط صفحات المصحف: الكاش أولًا (كاش دائم لا يُحذف مع ترقية الإصدار)، وتُخزَّن عند أول تحميل
  if (url.hostname === 'cdn.jsdelivr.net' && /\/fonts\/quran\//.test(url.pathname)) {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res;
    }).catch(() => Response.error()));
    return;
  }
  // تفاسير quran.com: الشبكة أولًا ثم الكاش (الصفحة تخزّنها أيضًا عبر Cache API)
  if (url.hostname === 'api.quran.com') {
    e.respondWith(caches.open('sakinah-tafsir').then(async (c) => {
      try { const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res; }
      catch { return (await c.match(req)) || Response.error(); }
    }));
    return;
  }
  if (sameOrigin || isFont) {
    e.respondWith(
      caches.match(req).then((cached) => {
        // إعادة التحقق من الخادم (ETag/304) بدل الاكتفاء بكاش HTTP
        const fetched = fetch(sameOrigin ? new Request(req, { cache: 'no-cache' }) : req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(async () => {
          // دون اتصال ولا نسخة مخزّنة: صفحة التطبيق للتنقل، وخطأ شبكة صريح (فوري) لغير ذلك بدل تعليق الطلب
          if (cached) return cached;
          if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
          return Response.error();
        });
        return cached || fetched;
      })
    );
  }
});

// إشعار مطلوب من الصفحة (يعمل حتى لو كانت الصفحة في الخلفية)
self.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'show-notification') {
    e.waitUntil(self.registration.showNotification(msg.title, {
      body: msg.body, tag: msg.tag || 'sakinah', renotify: true, icon: './assets/icons/icon-192.png', badge: './assets/icons/icon-192.png',
      lang: 'ar', dir: 'rtl', vibrate: msg.vibrate ? [200, 100, 200, 100, 400] : undefined, data: { url: msg.url || './index.html#/prayer' },
      requireInteraction: !!msg.sticky, silent: !!msg.silent,
    }));
  } else if (msg.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './index.html#/prayer';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
