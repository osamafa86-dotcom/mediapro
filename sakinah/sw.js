/* سكينة — عامل الخدمة: عمل دون اتصال + إشعارات */
const VERSION = 'sakinah-v1.4.0';
const FONT_CACHE = 'sakinah-mushaf-fonts'; // خطوط صفحات المصحف (تُملأ عند الطلب أو بالتنزيل الكامل من الخيارات)
const AUDIO_CACHE = 'sakinah-audio'; // تلاوات نُزّلت صراحةً من مدير التنزيلات
const KEEP = new Set([FONT_CACHE, AUDIO_CACHE, 'sakinah-tafsir', 'sakinah-audio-meta']);
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './css/fonts.css', './js/boot-theme.js',
  './js/app.js', './js/ui/components.js', './js/ui/prayer-view.js', './js/ui/qibla-view.js', './js/ui/adhkar-view.js',
  './js/ui/hadith-view.js', './js/ui/settings-view.js',
  './js/core/astro.js', './js/core/prayer-times.js', './js/core/methods.js', './js/core/qibla.js', './js/core/geomag.js', './js/core/hijri.js',
  './js/platform/storage.js', './js/platform/location.js', './js/platform/compass.js', './js/platform/notifications.js',
  './js/data/adhkar.js', './js/data/hadith.js', './js/data/hadith/part-a.js', './js/data/hadith/part-b.js', './js/data/cities.js',
  './js/data/quran-meta.js', './js/core/quran.js', './js/platform/audio.js', './js/platform/speech.js', './js/ui/quran-view.js', './js/ui/more-view.js', './data/quran.json',
  './js/core/mushaf.js', './js/ui/mushaf-page.js', './js/ui/mushaf-reader.js', './js/platform/mushaf-fonts.js', './js/data/bismillah.js', './data/mushaf-layout.json', './js/data/world-land.js', './js/core/tafsir.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/fonts/AmiriQuran.woff2',
  ...['Tajawal-400', 'Tajawal-500', 'Tajawal-700', 'Tajawal-800', 'Tajawal-900', 'Amiri-400', 'Amiri-400i', 'Amiri-700'].flatMap((f) => [`./assets/fonts/${f}-arabic.woff2`, `./assets/fonts/${f}-latin.woff2`]),
];
// ملفات اختيارية تُخزَّن في الخلفية بعد التفعيل (لا تؤخر التثبيت ولا تفشله): التفسير الميسر لكل السور
const OPTIONAL = Array.from({ length: 114 }, (_, i) => `./data/tafsir/muyassar/${i + 1}.json`);
self.addEventListener('install', (e) => {
  // cache:'reload' يتجاوز كاش HTTP للمتصفح كي تُخزَّن النسخة الجديدة فعلًا عند رفع الإصدار
  // كل الأساسيات أو لا شيء: فشل أي ملف يُبقي النسخة القديمة الكاملة (لا نسخة ناقصة)؛ والتفعيل يقرّره التطبيق بعد موافقة المستخدم (رسالة «نسخة جديدة»)
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' }))))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !KEEP.has(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    .then(() => precacheOptional()));
});
// تخزين الملفات الاختيارية على دفعات صغيرة في الخلفية (تُتخطى الموجودة)
async function precacheOptional() {
  try {
    const c = await caches.open(VERSION);
    for (let i = 0; i < OPTIONAL.length; i += 6) {
      await Promise.allSettled(OPTIONAL.slice(i, i + 6).map(async (u) => { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } }));
    }
  } catch { /* لا اتصال: تُخزَّن عند أول طلب */ }
}

// استراتيجية: الملفات المحلية = الكاش أولًا مع تحديث بالخلفية؛ الخطوط = الكاش أولًا؛ الشبكة الخارجية الأخرى = الشبكة أولًا
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // خطوط صفحات المصحف: الكاش أولًا (كاش دائم لا يُحذف مع ترقية الإصدار)، وتُخزَّن عند أول تحميل
  if (url.hostname === 'cdn.jsdelivr.net' && /\/fonts\/quran\//.test(url.pathname)) {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res;
    }).catch(() => Response.error()));
    return;
  }
  // تفاسير quran.com: تخزّنها الصفحة نفسها في Cache API (tafsir.js) فلا نكرّرها هنا
  if (url.hostname === 'api.quran.com') return;
  // التلاوات: من كاش التنزيلات إن وُجدت (مع دعم طلبات Range التي يرسلها Safari لعناصر الصوت)، وإلا الشبكة كما هي دون تخزين
  if (url.hostname === 'verses.quran.com' || url.hostname === 'cdn.islamic.network') {
    e.respondWith(caches.open(AUDIO_CACHE).then(async (c) => {
      const hit = await c.match(req.url);
      if (!hit) return fetch(req);
      const range = req.headers.get('range');
      if (!range) return hit;
      const buf = await hit.arrayBuffer(); const size = buf.byteLength;
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? +m[1] : Math.max(0, size - (+m[2] || 0)); const end = m[2] && m[1] ? Math.min(size - 1, +m[2]) : size - 1;
      if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('content-type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
    }).catch(() => fetch(req)));
    return;
  }
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        // بيانات ثابتة (تفسير، مصحف): الكاش أولًا دون إعادة تحقق؛ وسائر الملفات: إعادة تحقق من الخادم (ETag/304) بدل الاكتفاء بكاش HTTP
        if (cached && /\/data\/(tafsir|mushaf-layout|quran)/.test(url.pathname)) return cached;
        const fetched = fetch(new Request(req, { cache: 'no-cache' })).then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
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
