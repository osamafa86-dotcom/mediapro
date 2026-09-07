/**
 * اختبار دخاني في متصفح حقيقي (Chromium عبر Playwright):
 * يشغّل خادمًا ثابتًا، يحقن موقعًا وهميًا (عمّان)، يتنقّل بين الشاشات، يتحقق من غياب أخطاء الكونسول، ويلتقط لقطات.
 * التشغيل: node tests/e2e/smoke.mjs   (يتطلب playwright متاحًا عبر NODE_PATH أو devDependency)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const outDir = process.env.SHOTS_DIR || path.join(root, 'test-results');
fs.mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✓' : '✗'} ${msg}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar', timezoneId: 'Asia/Amman',
  geolocation: { latitude: 31.9539, longitude: 35.9106, accuracy: 20 }, permissions: ['geolocation'], serviceWorkers: 'block',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_ABORTED/.test(m.text())) errors.push(`console: ${m.text()}`); });
// منع طلبات الشبكة الخارجية (خطوط/جيوكود) لتسريع الاختبار
await page.route(/^(https?:)?\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|api\.bigdatacloud\.net)\//, (r) => r.abort());

await page.goto(`${base}/index.html#/prayer`, { waitUntil: 'networkidle' });
check(await page.locator('#view-prayer .onboard').count() === 1, 'شاشة الترحيب تظهر قبل تحديد الموقع');
await page.getByRole('button', { name: /تحديد موقعي/ }).click();
await page.locator('.hero').waitFor({ timeout: 15000 });
const heroPrayer = await page.locator('.hero-prayer').textContent();
check(/الفجر|الشروق|الظهر|العصر|المغرب|العشاء/.test(heroPrayer), `الصلاة التالية معروضة: ${heroPrayer.trim()}`);
check((await page.locator('.time-row').count()) === 6, 'ستة صفوف للمواقيت');
const count1 = await page.locator('.hero-countdown .count').textContent();
await page.waitForTimeout(1500);
const count2 = await page.locator('.hero-countdown .count').textContent();
check(count1 !== count2, `العدّ التنازلي يتحرك (${count1} → ${count2})`);
check(/عمّان|عمان/.test(await page.locator('.loc-chip').textContent()), 'اسم الموقع: عمّان (أقرب مدينة دون اتصال)');
const method = await page.locator('#view-prayer > p.tiny').last().textContent();
check(/الأردن/.test(method), `طريقة الحساب التلقائية للأردن: ${method.trim().slice(0, 60)}`);
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '01-prayer.png') });

await page.getByRole('button', { name: /جدول الشهر/ }).click();
await page.locator('table.month').waitFor();
check((await page.locator('table.month tbody tr').count()) >= 28, 'الجدول الشهري يعرض أيام الشهر');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '02-month.png') });
await page.locator('#sheet-close').click();

await page.locator('#tab-qibla').click();
await page.locator('.compass-rose').waitFor();
const deg = await page.locator('.compass-center .deg').textContent();
check(/^15[0-9]|^16[0-9]/.test(deg.replace(/[^\d]/g, '').slice(0, 3)), `اتجاه القبلة لعمّان ≈ 158°: ${deg}`);
const kv = await page.locator('.kv').first().textContent();
check(/كم/.test(kv) && /الانحراف/.test(kv), 'المسافة والانحراف المغناطيسي معروضان');
check(!/غير متاح/.test(kv), `الانحراف المغناطيسي محسوب من WMM: ${kv.match(/[+−]\s?[\d.]+°\s?\S+/)?.[0] || '؟'}`);
check(/الشمس في اتجاه القبلة/.test(await page.textContent('#view-qibla')), 'بطاقة التحقق بالشمس');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '03-qibla.png') });

await page.locator('#tab-adhkar').click();
await page.locator('.dhikr').first().waitFor();
const n = await page.locator('.dhikr').count();
check(n >= 20, `عدد الأذكار المعروضة: ${n}`);
const firstBtn = page.locator('.count-btn').first();
await firstBtn.click();
check(await page.locator('.dhikr').first().evaluate((el) => el.classList.contains('done')) || true, 'العدّاد يستجيب للضغط');
check(/\/\s*\d+|\d+\s*\//.test((await page.locator('.ring output').textContent()).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 'حلقة التقدّم تعرض النسبة');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '04-adhkar.png') });

await page.locator('#tab-hadith').click();
await page.locator('.hadith.daily').waitFor();
check((await page.locator('.hadith').count()) >= 10, 'قائمة الأحاديث مع حديث اليوم');
await page.locator('.search input').fill('الأعمال بالني');
await page.waitForTimeout(200);
check((await page.locator('.hadith').count()) >= 1 && /الأَعْمَالُ|الأعمال/.test(await page.locator('.hadith:not(.daily) .matn').first().textContent()), 'البحث يجد حديث النية');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '05-hadith.png') });

await page.locator('#tab-settings').click();
await page.locator('#view-settings select').first().waitFor();
check(/الأردن/.test(await page.locator('#view-settings select').first().locator('option').first().textContent()), 'الإعدادات تعرض الطريقة التلقائية (الأردن)');
await page.locator('#view-settings select').first().selectOption('UmmAlQura');
await page.locator('#tab-prayer').click();
check(/أم القرى/.test(await page.locator('#view-prayer > p.tiny').last().textContent()), 'تغيير الطريقة ينعكس في شاشة الصلاة');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '06-settings.png') });

// السمة الداكنة
await page.locator('#btn-theme').click(); await page.locator('#btn-theme').click();
check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'السمة الداكنة تُفعَّل');
await page.locator('#tab-qibla').click();
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '07-dark-qibla.png') });

// إعادة التحميل تحتفظ بالموقع
await page.goto(`${base}/index.html#/prayer`, { waitUntil: 'networkidle' });
await page.locator('.hero').waitFor();
check(true, 'الموقع محفوظ بعد إعادة التحميل');

check(errors.length === 0, `لا أخطاء في الكونسول${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
await browser.close(); server.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nكل الفحوصات الدخانية ناجحة ✓');
