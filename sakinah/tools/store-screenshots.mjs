/**
 * لقطات المتجر آليًا (Playwright/Chromium): شاشات التطبيق بمقاسات App Store وGoogle Play، بموقع محدد مسبقًا (عمّان)
 * وبتجاوز تهيئة أول تشغيل. الناتج: dist/store/<المقاس>/NN-<الشاشة>.png
 * التشغيل: node tools/store-screenshots.mjs   (يتطلب playwright عبر NODE_PATH كما في اختبار التصفح)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const out = path.join(root, 'dist/store');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// المقاسات المطلوبة: iPhone 6.7″ (1290×2796)، 6.5″ (1284×2778)، 5.5″ (1242×2208)، iPad 12.9″ (2048×2732)
const SIZES = [
  { name: 'iphone-6.7', w: 430, h: 932, scale: 3 },
  { name: 'iphone-6.5', w: 428, h: 926, scale: 3 },
  { name: 'iphone-5.5', w: 414, h: 736, scale: 3 },
  { name: 'ipad-12.9', w: 1024, h: 1366, scale: 2, tablet: true },
];
const SEED = { seenIntro: true, hour12: true, numerals: 'latn', location: { lat: 31.9539, lon: 35.9106, tz: 'Asia/Amman', name: 'عمّان', countryCode: 'JO', countryAr: 'الأردن', cityId: null, source: 'gps', accuracy: 20, updatedAt: Date.now() }, quran: { lastRead: { page: 293, surah: 18, ayah: 1, at: Date.now() } } };

const browser = await chromium.launch({ executablePath: process.env.SAKINAH_CHROME || undefined });
for (const s of SIZES) {
  const dir = path.join(out, s.name); fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.scale, isMobile: !s.tablet, hasTouch: true, locale: 'ar', timezoneId: 'Asia/Amman', serviceWorkers: 'block' });
  await ctx.addInitScript((seed) => { try { localStorage.setItem('sakinah:v1', JSON.stringify(seed)); } catch { /* تجاهل */ } }, SEED);
  const page = await ctx.newPage();
  // خطوط المصحف من كاش محلي (كما في اختبار التصفح) كي لا تعتمد اللقطات على سرعة الشبكة
  const fontCache = path.join(root, '.cache/fonts'); fs.mkdirSync(fontCache, { recursive: true });
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, (route) => {
    const url = route.request().url(); const f = path.join(fontCache, url.split('/').slice(-2).join('_'));
    try { if (!fs.existsSync(f)) execFileSync('curl', ['-sS', '-f', '-m', '60', '-o', f, url]); route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } }); }
    catch { route.abort(); }
  });
  await page.route(/api\.bigdatacloud\.net|cdn\.islamic\.network|api\.quran\.com/, (r) => r.abort());
  const shot = async (n, name, ready) => { await ready(); await page.waitForTimeout(400); await page.screenshot({ animations: 'disabled', path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) }); console.log(`${s.name}/${n} ${name}`); };
  await page.goto(`${base}/index.html#/prayer`, { waitUntil: 'networkidle' });
  await shot(1, 'prayer', () => page.locator('.hero').waitFor());
  await page.locator('#tab-quran').click();
  await shot(2, 'mushaf-index', () => page.locator('#view-quran .surah-row').first().waitFor());
  await page.goto(`${base}/index.html#/quran?p=293`, { waitUntil: 'networkidle' });
  await shot(3, 'mushaf-page', () => page.locator('.mr-slide[data-page="293"] .mp.ready').waitFor({ timeout: 60000 }));
  await page.goto(`${base}/index.html#/qibla`, { waitUntil: 'networkidle' });
  await page.locator('#tab-qibla').click();
  await shot(4, 'qibla', () => page.locator('.compass-wrap, .qibla-head').first().waitFor());
  await page.locator('#tab-adhkar').click();
  await shot(5, 'adhkar', () => page.locator('.dhikr').first().waitFor());
  await page.locator('#view-adhkar .more-tile', { hasText: 'حصن المسلم' }).click();
  await shot(6, 'hisn', () => page.locator('.hisn-row').first().waitFor());
  await page.locator('#tab-adhkar').click();
  await page.locator('#view-adhkar .more-tile', { hasText: 'المسبحة' }).click();
  await shot(7, 'tasbih', () => page.locator('.tasbih-btn').waitFor());
  await page.locator('#tab-more').click();
  await page.getByRole('button', { name: /الأحاديث/ }).first().click();
  await shot(8, 'hadith', () => page.locator('#view-hadith .hadith.daily').waitFor());
  await ctx.close();
}
await browser.close(); server.close();
console.log(`الناتج في ${out}`);
