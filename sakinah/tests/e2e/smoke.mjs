/**
 * اختبار دخاني في متصفح حقيقي (Chromium عبر Playwright):
 * يشغّل خادمًا ثابتًا، يحقن موقعًا وهميًا (عمّان)، يتنقّل بين الشاشات، يتحقق من غياب أخطاء الكونسول، ويلتقط لقطات.
 * التشغيل: node tests/e2e/smoke.mjs   (يتطلب playwright متاحًا عبر NODE_PATH أو devDependency)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
const firstDone = await page.locator('.dhikr').first().evaluate((el) => el.classList.contains('done'));
const firstBtnText = await page.locator('.count-btn').first().textContent();
check(firstDone || /^\s*[٠-٩\d]+/.test(firstBtnText), `العدّاد يستجيب للضغط (${firstDone ? 'اكتمل' : 'تناقص: ' + firstBtnText.trim()})`);
check(/\/\s*\d+|\d+\s*\//.test((await page.locator('.ring output').textContent()).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 'حلقة التقدّم تعرض النسبة');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '04-adhkar.png') });

// ---- المصحف ----
// خطوط صفحات المصحف من jsDelivr: تُقدَّم من كاش محلي (تُنزَّل بـ curl عند الحاجة)؛ وإن تعذّر يُختبر البديل النصي
const fontCache = path.join(outDir, 'font-cache'); fs.mkdirSync(fontCache, { recursive: true });
let fontsServed = 0;
await page.route(/^https:\/\/cdn\.jsdelivr\.net\//, (route) => {
  const url = route.request().url(); const f = path.join(fontCache, url.split('/').slice(-2).join('_'));
  try { if (!fs.existsSync(f)) execFileSync('curl', ['-sS', '-f', '-m', '60', '-o', f, url]); fontsServed++; route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } }); }
  catch { route.abort(); }
});
await page.locator('#tab-quran').click();
await page.locator('.surah-row').first().waitFor({ timeout: 20000 });
check((await page.locator('#view-quran .surah-row').count()) === 114, 'فهرس السور: 114 سورة');
await page.locator('#view-quran .search input').fill('الكهف');
await page.waitForTimeout(150);
check(/الكهف/.test(await page.locator('#view-quran .surah-row').first().textContent()), 'البحث عن سورة الكهف');
await page.locator('#view-quran .surah-row').first().click();
await page.locator('.mreader:not([hidden])').waitFor();
await page.locator('.mr-slide[data-page="293"] .mp.ready').waitFor({ timeout: 30000 });
const mushafMode = await page.evaluate(() => document.querySelector('.mr-slide[data-page="293"] .mp').classList.contains('mp-text') ? 'text' : 'qcf');
check(true, `القارئ يفتح سورة الكهف في الصفحة 293 (العرض: ${mushafMode === 'qcf' ? 'خطوط المصحف' : 'بديل نصي'})`);
check(/^#\/quran\?p=293$/.test(await page.evaluate(() => location.hash)), 'رابط الصفحة #/quran?p=293');
// الصفحة 293 تبدأ بخواتيم الإسراء وتحوي ترويسة الكهف في سطرها العاشر (كما في المصحف المطبوع)؛ الشريط يعرض سورة أول الصفحة
check((await page.locator('.mr-sname.cur').getAttribute('data-surah')) === '17' && /الإسراء/.test(await page.locator('.mr-sname.cur').getAttribute('aria-label')), 'شريط السور يضع سورة أول الصفحة (الإسراء) في الإطار');
check(/الخَامِسَ عَشَرَ/.test(await page.locator('.mr-juz').textContent()) && (await page.locator('.mr-star.cur').getAttribute('data-juz')) === '15', 'شريط الجزء والنجوم: الجزء الخامس عشر');
if (mushafMode === 'qcf') {
  const lines = await page.evaluate(() => [...document.querySelectorAll('.mr-slide[data-page="293"] .mp .ml')].map((l) => l.className));
  check(lines.length === 15 && lines[9].includes('mh') && lines[10].includes('mb') && lines.filter((c) => c.includes('mt')).length === 13, 'صفحة 293: 15 سطرًا — ترويسة الكهف في السطر العاشر ثم البسملة و13 سطر كلمات');
  check((await page.locator('.mr-slide[data-page="293"] .mh[data-surah="18"] .sname').count()) === 1, 'ترويسة سورة الكهف بخط أسماء السور');
  const fit = await page.evaluate(() => { const body = document.querySelector('.mr-slide[data-page="293"] .mp-body'); const W = body.clientWidth; const ws = [...body.querySelectorAll('.mlw')].map((l) => l.getBoundingClientRect().width); return { W, max: Math.max(...ws), min: Math.min(...ws) }; });
  check(fit.max <= fit.W + 1 && fit.max >= fit.W * 0.97, `الأسطر تملأ عرض الصفحة (${Math.round(fit.max)}/${Math.round(fit.W)}px)`);
  check((await page.locator('.mr-slide[data-page="293"] .mw[data-n][data-k]').count()) > 100 && (await page.locator('.mr-slide[data-page="293"] .me').count()) === (await page.evaluate(() => document.querySelectorAll('.mr-slide[data-page="293"] .me').length)), 'الكلمات تحمل رقم الآية وفهرس الكلمة');
}
await page.locator('.mr-slide[data-page="294"] .mp.ready').waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(outDir, '08-quran.png') });
// الانتقال بالأسهم (لوحة المفاتيح) وبالنجوم
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(700);
check((await page.locator('.mreader').getAttribute('data-page')) === '294', 'السهم الأيسر ينتقل إلى الصفحة التالية 294');
await page.evaluate(() => document.querySelector('.mr-star[data-juz="16"]').click());
await page.waitForTimeout(700);
check((await page.locator('.mreader').getAttribute('data-page')) === '302', 'نجمة الجزء 16 تنتقل إلى صفحته 302');
await page.evaluate(() => document.querySelector('.mr-sname[data-surah="18"]').click());
await page.waitForTimeout(700);
check((await page.locator('.mreader').getAttribute('data-page')) === '293', 'النقر على اسم السورة يعود إلى أولها');
// النقر يخفي الأطر (شاشة كاملة) ثم يعيدها
await page.locator('.mr-slide[data-page="293"] .mp-body').tap();
await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelector('.mreader').classList.contains('zen')), 'النقر على الصفحة يخفي الأطر');
await page.locator('.mr-slide[data-page="293"] .mp-body').tap();
await page.waitForTimeout(500);
check(!(await page.evaluate(() => document.querySelector('.mreader').classList.contains('zen'))), 'النقر مجددًا يعيد الأطر');
// الوضع الليلي
await page.locator('.mr-round[aria-label="الوضع الليلي"]').click();
check(await page.evaluate(() => document.querySelector('.mreader').classList.contains('night') && document.querySelector('.mr-slide[data-page="293"] .mp').classList.contains('night')), 'الوضع الليلي يطبَّق على القارئ والصفحة');
await page.screenshot({ path: path.join(outDir, '08b-quran-night.png') });
await page.locator('.mr-round[aria-label="الوضع الليلي"]').click();
// علامة عبر زر العلامة ثم عبر قائمة الآية (ضغطة مطوّلة)
await page.locator('.mr-round[aria-label="علامة"]').click();
await page.waitForTimeout(300);
check(/أُضيفت علامة/.test(await page.locator('#toast').textContent()) && (await page.locator('.mr-round[aria-label="علامة"].active').count()) === 1, 'زر العلامة يضيف علامة للصفحة');
const w0 = page.locator('.mr-slide[data-page="293"] .mw[data-k]').nth(3); const bb = await w0.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
await page.locator('#sheet:not([hidden])').waitFor({ timeout: 3000 }).catch(() => {});
check(/الإسراء: \d+/.test(await page.locator('#sheet-title').textContent()) && (await page.locator('.mw.sel').count()) > 3, 'الضغط المطوّل على كلمة يفتح قائمة الآية ويظلّلها');
if (!(await page.evaluate(() => document.getElementById('sheet').hidden))) { await page.getByRole('button', { name: /موضع القراءة/ }).click(); await page.waitForTimeout(300); }
// وضع مراجعة الحفظ: الكلمات مخفية ثم تُكشف بالنقر
await page.locator('.mr-hifz-btn').click();
await page.locator('.hifz-panel').waitFor();
const hiddenBefore = await page.locator('.mr-slide[data-page="293"] .mp.hifz .mw[data-k]:not(.revealed)').count();
check(hiddenBefore > 20, `وضع المراجعة يخفي الكلمات (${hiddenBefore} كلمة)`);
await page.getByRole('button', { name: /تلميح/ }).click();
await page.getByRole('button', { name: /تلميح/ }).click();
check((await page.locator('.mr-slide[data-page="293"] .mw.revealed').count()) === 2, 'التلميح يكشف الكلمة التالية بالترتيب');
await page.locator('.mr-slide[data-page="293"] .mp-body').tap();
check((await page.locator('.mr-slide[data-page="293"] .mw.revealed').count()) === 3, 'النقر على الصفحة في المراجعة يكشف كلمة');
check(/3\s*\/|٣\s*\//.test(await page.locator('.hifz-panel .tiny').textContent()), 'عدّاد التقدّم يعرض 3 كلمات');
await page.screenshot({ path: path.join(outDir, '09-hifz.png') });
await page.locator('.mr-hifz-btn').click(); // خروج من وضع المراجعة
check((await page.locator('.mp.hifz').count()) === 0 && (await page.locator('.hifz-panel').count()) === 0, 'الخروج من وضع المراجعة');
// التشغيل من الخيارات: يظهر شريط التلاوة (الصوت محجوب في الاختبار)
await page.route(/cdn\.islamic\.network/, (r) => r.abort());
await page.locator('.mr-btn[aria-label="خيارات"]').click();
await page.getByRole('button', { name: /تشغيل/ }).click();
await page.locator('#audio-bar').waitFor({ timeout: 5000 });
check(/العفاسي/.test(await page.locator('#audio-bar .who').textContent()), 'شريط التلاوة يعرض القارئ الافتراضي');
await page.locator('#audio-bar').getByRole('button', { name: 'إغلاق' }).click();
check((await page.locator('#audio-bar').count()) === 0, 'إغلاق شريط التلاوة');
// العودة للفهرس: بطاقة المتابعة تعرض آخر موضع، والعلامة في قائمة العلامات
await page.locator('.mr-btn[aria-label="الفهرس"]').click();
await page.locator('.resume-card').waitFor();
check(/الإسراء/.test(await page.locator('.resume-card').textContent()) && /293/.test(await page.locator('.resume-card').textContent()), 'بطاقة متابعة القراءة تحفظ الموضع (الإسراء، ص 293)');
check((await page.locator('.mreader').getAttribute('hidden')) !== null && (await page.evaluate(() => location.hash)) === '#/quran', 'إغلاق القارئ يعيد الرابط #/quran');
console.log(`  (خطوط المصحف المقدَّمة من الكاش: ${fontsServed})`);

await page.locator('#tab-more').click();
await page.getByRole('button', { name: /الأحاديث/ }).first().click();
await page.locator('#view-hadith .hadith.daily').waitFor();
check((await page.locator('#view-hadith .hadith').count()) >= 10, 'قائمة الأحاديث مع حديث اليوم');
await page.locator('#view-hadith .search input').fill('الأعمال بالني');
await page.waitForTimeout(200);
check((await page.locator('#view-hadith .hadith').count()) >= 1 && /الأَعْمَالُ|الأعمال/.test(await page.locator('#view-hadith .hadith:not(.daily) .matn').first().textContent()), 'البحث يجد حديث النية');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '05-hadith.png') });

await page.locator('#btn-settings').click();
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
check(/عمّان|عمان/.test(await page.locator('.loc-chip').textContent()) && (await page.locator('.time-row').count()) === 6, 'الموقع محفوظ بعد إعادة التحميل');

check(errors.length === 0, `لا أخطاء في الكونسول${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
await browser.close(); server.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nكل الفحوصات الدخانية ناجحة ✓');
