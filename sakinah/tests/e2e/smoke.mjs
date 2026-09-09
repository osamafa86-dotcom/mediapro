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
  if (p === '/__axe.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return fs.createReadStream(path.join(root, 'node_modules/axe-core/axe.min.js')).pipe(res); }
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
/** فحص إتاحة (axe-core) للشاشة الحالية: لا مخالفات حرجة أو خطيرة */
let axeLoaded = false;
const a11y = async (name) => {
  if (!axeLoaded) { await page.addScriptTag({ url: base + '/__axe.js' }); axeLoaded = true; }
  // حركات الدخول تُمزج ألوانها مؤقتًا؛ نُنهيها قبل قياس التباين
  await page.waitForTimeout(150); await page.evaluate(() => document.getAnimations().forEach((an) => { try { an.finish(); } catch { /* تجاهل */ } }));
  const r = await page.evaluate(async () => { const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'], rules: { 'color-contrast': { enabled: true } } }); return res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`); });
  check(r.length === 0, `إتاحة ${name}: ${r.length ? r.join(' ؛ ') : 'لا مخالفات حرجة'}`);
};
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✓' : '✗'} ${msg}`); };
const browser = await chromium.launch({ executablePath: process.env.SAKINAH_CHROME || undefined });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar', timezoneId: 'Asia/Amman',
  geolocation: { latitude: 31.9539, longitude: 35.9106, accuracy: 20 }, permissions: ['geolocation'], serviceWorkers: 'block',
});
const page = await ctx.newPage();
// بديل لـ page.waitForFunction: مُنفِّذه يُحقن عبر eval فتحجبه سياسة أمان المحتوى (script-src 'self')؛ نستطلع عبر page.evaluate (CDP)
const waitFor = async (fn, arg = null, { timeout = 8000 } = {}) => { const t0 = Date.now(); for (;;) { if (await page.evaluate(fn, arg)) return true; if (Date.now() - t0 > timeout) throw new Error('waitFor timeout'); await page.waitForTimeout(100); } };
const document_page = () => page.evaluate(() => document.querySelector('.mreader').dataset.page);
const chromeOn = () => page.evaluate(() => { const r = document.querySelector('.mreader'); return !!r && r.classList.contains('chrome'); });
const showTools = async () => {
  if (!(await page.evaluate(() => document.querySelector('.mr-ayahbar')?.hidden ?? true))) { await page.locator('.mr-ayahbar .icon-btn[aria-label="إغلاق"]').click(); await page.waitForTimeout(300); }
  for (let i = 0; i < 3 && !(await chromeOn()); i++) { await page.touchscreen.tap(6, 422); await page.waitForTimeout(500); }
  if (!(await chromeOn())) console.log('DBG showTools failed', await page.evaluate(() => ({ cls: document.querySelector('.mreader').className, at: document.elementFromPoint(6, 422)?.className, sheet: document.getElementById('sheet').hidden })));
};
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_ABORTED/.test(m.text())) errors.push(`console: ${m.text()}`); });
// منع طلبات الشبكة الخارجية (خطوط/جيوكود) لتسريع الاختبار
await page.route(/^(https?:)?\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|api\.bigdatacloud\.net)\//, (r) => r.abort());

await page.goto(`${base}/index.html#/prayer`, { waitUntil: 'networkidle' });
check(await page.locator('#view-prayer .onboard').count() === 1, 'شاشة الترحيب تظهر قبل تحديد الموقع');
// تهيئة أول تشغيل (شاشة كاملة): ترحيب → الموقع (GPS) → التذكير → جاهز؛ تُسجَّل مرة واحدة
await page.locator('#onboard').waitFor();
check(/سكينة/.test(await page.locator('#onboard h1').textContent()) && (await page.locator('#onboard .ob-list li').count()) === 4, 'تهيئة أول تشغيل: شاشة الترحيب بأربع ميزات');
await a11y('التهيئة');
await page.locator('#onboard').getByRole('button', { name: 'ابدأ' }).click();
await page.locator('#onboard h2', { hasText: 'أين أنت' }).waitFor();
await page.locator('#onboard').getByRole('button', { name: /تحديد موقعي/ }).click();
await page.locator('#onboard h2', { hasText: 'التذكير' }).waitFor({ timeout: 15000 });
check(true, 'تحديد الموقع ينقل تلقائيًا إلى خطوة التذكير');
await page.locator('#onboard').getByRole('button', { name: 'متابعة' }).click();
await page.locator('#onboard h2', { hasText: 'كل شيء جاهز' }).waitFor();
check(/عمّان|عمان/.test(await page.locator('#onboard .ob-list').textContent()) && /الأردن/.test(await page.locator('#onboard .ob-list').textContent()), 'ملخص التهيئة يعرض الموقع وطريقة الحساب');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '00-onboarding.png') });
await page.locator('#onboard').getByRole('button', { name: /إلى شاشة الصلاة/ }).click();
await page.locator('#onboard').waitFor({ state: 'detached' });
check((await page.evaluate(() => window.sakinah.settings.seenIntro)) === true, 'التهيئة تُسجَّل مرة واحدة (seenIntro)');
await page.locator('.hero').waitFor({ timeout: 15000 });
await a11y('الصلاة');
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
await page.locator('.compass-wrap').waitFor();
await page.waitForTimeout(300);
const big = await page.locator('.big-num').textContent();
check(/^15[0-9]|^16[0-9]/.test(big.replace(/[^\d]/g, '').slice(0, 3)), `اتجاه القبلة لعمّان ≈ 158° (بلا مستشعر يُعرض الاتجاه من الشمال): ${big}`);
check((await page.locator('.compass-wrap .needle').count()) === 1 && (await page.locator('.compass-wrap .start-overlay[hidden]').count()) === 1, 'سهم واحد، وتشغيل تلقائي دون زرّ حيث لا يلزم إذن');
// محاكاة مستشعر أندرويد (deviceorientationabsolute): alpha = 360 − الاتجاه المغناطيسي
const fire = (alpha, beta = 0, gamma = 0) => page.evaluate(([a, b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a, beta: b, gamma: g, absolute: true })), [alpha, beta, gamma]);
for (let i = 0; i < 12; i++) { await fire(300, 3, -2); await page.waitForTimeout(30); }
await page.waitForTimeout(250);
check(/أدر الهاتف يمينًا/.test(await page.locator('.turn-hint').textContent()) && !(await page.locator('.compass-wrap.aligned').count()), `تعليمة واحدة عند الانحراف: ${(await page.locator('.turn-hint').textContent()).trim()}`);
check((await page.locator('.compass-wrap .level:not([hidden]).flat').count()) === 1, 'فقاعة الاستواء خضراء والهاتف مستوٍ');
// عمّان: القبلة ≈ 160.6° حقيقي والانحراف ≈ +5° → اتجاه مغناطيسي ≈ 155.6 → alpha ≈ 204.4
for (let i = 0; i < 25; i++) { await fire(204.4, 2, 1); await page.waitForTimeout(30); }
await page.waitForTimeout(350);
check((await page.locator('.compass-wrap.aligned').count()) === 1 && /أنت متجه إلى القبلة/.test(await page.locator('.turn-hint').textContent()), 'حالة المحاذاة الخضراء عند مطابقة الاتجاه (مع تصحيح الانحراف المغناطيسي)');
for (let i = 0; i < 12; i++) { await fire(204.4, 55, 10); await page.waitForTimeout(30); }
await page.waitForTimeout(250);
check(/أفقيًا/.test(await page.locator('.turn-hint').textContent()), 'طلب وضع الهاتف أفقيًا عند الميل الكبير');
await page.locator('.icon-btn[aria-label="تفاصيل"]').click();
const det = await page.locator('#sheet-body').textContent();
check(/كم/.test(det) && /الانحراف/.test(det) && !/غير متاح/.test(det), `التفاصيل: المسافة والانحراف المغناطيسي من WMM: ${det.match(/[+−]\s?[\d.]+°\s?\S+/)?.[0] || '؟'}`);
await page.locator('#sheet-close').click();
await page.getByRole('button', { name: /الشمس/ }).click();
check(/الشمس في اتجاه القبلة/.test(await page.textContent('#view-qibla')) && (await page.locator('.sun-dial').count()) === 1, 'وضع الشمس: اللحظتان اليوميتان وقرص الشمس/القبلة');
await page.getByRole('button', { name: /الخريطة/ }).click();
check((await page.locator('.qmap svg .land').count()) === 1 && /^M/.test(await page.locator('.qmap svg .arc').getAttribute('d')) && (await page.locator('.map-mode .legend').count()) === 1, 'وضع الخريطة: اليابسة دون اتصال وقوس الدائرة العظمى إلى الكعبة');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '03b-qibla-map.png') });
await page.getByRole('button', { name: /البوصلة/ }).click();
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '03-qibla.png') });
// قرب الكعبة: اختيار «مكة المكرمة» من قائمة المدن (إحداثياتها عند الكعبة نفسها) → لوحة القرب بدل اتجاه عشوائي، وزر GPS يعيد الموقع الفعلي
await page.locator('#view-qibla .qibla-head .chip-btn').click();
await page.locator('#sheet-body input[type="search"]').fill('مكة');
await page.locator('#sheet-body .city-item').first().click();
await page.locator('.near-kaaba').waitFor();
const nearTxt = await page.locator('.near-kaaba').textContent();
check(/عند الكعبة نفسها/.test(nearTxt) && (await page.locator('.compass-wrap').count()) === 0, `موقع «مكة المكرمة» المحفوظ عند الكعبة: لوحة القرب بدل بوصلة عشوائية: ${nearTxt.trim().slice(0, 50)}`);
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '03c-qibla-near.png') });
await page.locator('.near-kaaba .btn').click();
await page.locator('.compass-wrap').waitFor();
check(/عمّان|عمان/.test(await page.locator('#view-qibla .qibla-head .chip-btn').textContent()) && (await page.locator('.calib.uncertain').count()) === 0, 'زر «تحديد موقعي بدقة» يأخذ قراءة GPS جديدة ويعيد البوصلة (عمّان: لا تنبيه هامش)');
// موقع GPS بدقة ±60 م على بعد 240 م من الكعبة → تنبيه «الاتجاه تقريبي (±18°)» مع البوصلة
await page.evaluate(() => window.sakinah.update({ location: { lat: 21.4210, lon: 39.8273, tz: 'Asia/Riyadh', name: 'مكة المكرمة', countryCode: 'SA', countryAr: 'السعودية', cityId: null, source: 'gps', accuracy: 60, updatedAt: Date.now() } }));
await page.locator('.calib.uncertain').waitFor();
const unc = await page.locator('.calib.uncertain').textContent();
check(/الاتجاه تقريبي \(±1[7-8]°\)/.test(unc) && /205 م/.test(await page.locator('.qibla-foot').textContent()), `تنبيه هامش الخطأ قرب الكعبة مع المسافة بالأمتار: ${unc.trim().slice(0, 40)}`);
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '03d-qibla-uncertain.png') });
await page.evaluate(() => window.sakinah.update({ location: { lat: 31.95390, lon: 35.91060, tz: 'Asia/Amman', name: 'عمّان', countryCode: 'JO', countryAr: 'الأردن', cityId: null, source: 'gps', accuracy: 20, updatedAt: Date.now() } }));
await page.locator('.compass-wrap').waitFor();

await page.locator('#tab-adhkar').click();
await page.locator('.dhikr').first().waitFor();
const n = await page.locator('.dhikr').count();
check(n >= 20, `عدد الأذكار المعروضة: ${n}`);
await a11y('الأذكار');
const firstBtn = page.locator('.count-btn').first();
await firstBtn.click();
const firstDone = await page.locator('.dhikr').first().evaluate((el) => el.classList.contains('done'));
const firstBtnText = await page.locator('.count-btn').first().textContent();
check(firstDone || /^\s*[٠-٩\d]+/.test(firstBtnText), `العدّاد يستجيب للضغط (${firstDone ? 'اكتمل' : 'تناقص: ' + firstBtnText.trim()})`);
check(/\/\s*\d+|\d+\s*\//.test((await page.locator('.ring output').textContent()).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 'حلقة التقدّم تعرض النسبة');
// حصن المسلم كاملًا: الأقسام والأبواب، البحث، فتح باب والعدّ، ثم المسبحة
await page.locator('#view-adhkar .more-tile', { hasText: 'حصن المسلم' }).click();
await page.locator('.hisn-row').first().waitFor();
check((await page.locator('.hisn-row').count()) === 132, `حصن المسلم: ${await page.locator('.hisn-row').count()} بابًا في الأقسام`);
await a11y('حصن المسلم');
await page.locator('#view-hisn .search input').fill('السفر');
await page.waitForTimeout(200);
check((await page.locator('.hisn-row').count()) >= 4, `البحث في حصن المسلم يجد أبواب السفر وأذكاره (${await page.locator('.hisn-row').count()} نتائج)`);
await page.locator('#view-hisn .search input').fill('');
await page.waitForTimeout(200);
await page.locator('.hisn-row', { hasText: 'دعاء السفر' }).first().click();
await page.locator('#view-hisn .dhikr').first().waitFor();
{ const bare = (s) => s.replace(/[\u064B-\u0652\u0670]/g, ''); const ttl = await page.locator('.hisn-title').textContent(); const body = await page.locator('#view-hisn .dhikr .text').first().textContent();
  check(/دعاء السفر/.test(ttl) && (await page.locator('#view-hisn .dhikr').count()) === 1 && /سخر لنا/.test(bare(body)), `باب «دعاء السفر» يعرض الذكر بنصه (${ttl.trim()} · ${bare(body).slice(0, 40)})`); }
check(/#\/hisn\?c=96$/.test(await page.evaluate(() => location.hash)), 'رابط الباب #/hisn?c=96');
await page.locator('#view-hisn .count-btn').first().click();
check((await page.locator('#view-hisn .dhikr.done').count()) === 1, 'عدّاد الذكر يكتمل بنقرة (يُقال مرة واحدة)');
await page.locator('#view-hisn .icon-btn[aria-label="رجوع إلى الأبواب"]').click();
await page.locator('.hisn-row').first().waitFor();
check((await page.evaluate(() => location.hash)) === '#/hisn', 'الرجوع إلى الأبواب يعيد الرابط #/hisn');
await page.locator('#tab-adhkar').click();
await page.locator('#view-adhkar .more-tile', { hasText: 'المسبحة' }).click();
await page.locator('.tasbih-btn').waitFor();
for (let i = 0; i < 3; i++) await page.locator('.tasbih-btn').click();
check(/^\s*[3٣]\s*$/.test(await page.locator('.tasbih-count').textContent()), 'المسبحة تعدّ ثلاث نقرات');
await a11y('المسبحة');
check((await page.evaluate(() => window.sakinah.settings.tasbih.count)) === 3, 'عدّ المسبحة محفوظ في الإعدادات');
await page.screenshot({ path: path.join(outDir, '10-tasbih.png') });
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
await a11y('فهرس المصحف');
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
  check(fit.max <= fit.W + 1 && fit.max >= fit.W * 0.95, `الأسطر تملأ عرض الصفحة (${Math.round(fit.max)}/${Math.round(fit.W)}px)`);
  check((await page.locator('.mr-slide[data-page="293"] .mw[data-n][data-k]').count()) > 100 && (await page.locator('.mr-slide[data-page="293"] .me').count()) === (await page.evaluate(() => document.querySelectorAll('.mr-slide[data-page="293"] .me').length)), 'الكلمات تحمل رقم الآية وفهرس الكلمة');
}
await page.locator('.mr-slide[data-page="294"] .mp.ready').waitFor({ timeout: 30000 });
await page.screenshot({ path: path.join(outDir, '08-quran.png') });
// الانتقال بالأسهم (لوحة المفاتيح) وبالنجوم
// الصفحة تُثبت بعد انتهاء التمرير الناعم (قد يطول على أجهزة CI البطيئة): ننتظر الوصول لا مدة ثابتة
const pageSettled = async (p) => { try { await waitFor((x) => document.querySelector('.mreader').dataset.page === x && !document.querySelector('.mreader').dataset.anim, p); } catch { /* الفحص أدناه يُبلغ */ } await page.waitForTimeout(300); return (await page.locator('.mreader').getAttribute('data-page')) === p; };
await page.keyboard.press('ArrowLeft');
check(await pageSettled('294'), 'السهم الأيسر ينتقل إلى الصفحة التالية 294');
// خط الصفحة بطيء (شبكة): النص يظهر فورًا بخط أميري قرآن، ثم تحلّ صفحة المصحف محلّه عند وصول الخط
if (mushafMode === 'qcf') {
  await page.route(/\/woff2\/p289\.woff2$/, async (route) => { await new Promise((r) => setTimeout(r, 1500)); const f = path.join(fontCache, 'woff2_p289.woff2'); try { if (!fs.existsSync(f)) execFileSync('curl', ['-sS', '-f', '-m', '60', '-o', f, route.request().url()]); await route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } }); } catch { await route.abort(); } });
  await page.evaluate(() => window.sakinah.quranReader.goto(289, { smooth: false }));
  await page.waitForTimeout(400);
  const interim = await page.evaluate(() => { const s = document.querySelector('.mr-slide[data-page="289"]'); const t = s.querySelector('.mp.mp-text.interim'); return { interim: !!t, words: t ? t.querySelectorAll('.mw').length : 0, ready: t ? t.classList.contains('ready') : false }; });
  check(interim.interim && interim.words > 50, `الخط بطيء: النص يظهر فورًا بخط بديل (${interim.words} كلمة خلال 400 م.ث)`);
  await page.locator('.mr-slide[data-page="289"] .mp.ready:not(.mp-text)').waitFor({ timeout: 10000 });
  const swapped = await page.evaluate(() => { const s = document.querySelector('.mr-slide[data-page="289"]'); return { qcf: !!s.querySelector('.mp.ready:not(.mp-text) .mlw'), interim: !!s.querySelector('.mp.interim'), n: s.querySelectorAll('.mp').length }; });
  check(swapped.qcf && !swapped.interim && swapped.n === 1, 'عند وصول الخط تحلّ صفحة المصحف محلّ النص المؤقت');
  const cached = await page.evaluate(async () => { try { const c = await caches.open('sakinah-mushaf-fonts'); const keys = await c.keys(); return keys.some((k) => /p289\.woff2$/.test(k.url)); } catch { return null; } });
  check(cached !== false, `خط الصفحة يُحفظ في كاش الجهاز من الصفحة نفسها دون عامل خدمة (${cached})`);
  await page.unroute(/\/woff2\/p289\.woff2$/);
  await page.evaluate(() => window.sakinah.quranReader.goto(294, { smooth: false }));
  await pageSettled('294');
}
await page.evaluate(() => document.querySelector('.mr-star[data-juz="16"]').click());
check(await pageSettled('302'), 'نجمة الجزء 16 تنتقل إلى صفحته 302');
await page.evaluate(() => document.querySelector('.mr-sname[data-surah="18"]').click());
check(await pageSettled('293'), 'النقر على اسم السورة يعود إلى أولها');
// زر رجوع دائم أعلى الصفحة (لا يحتاج إظهار الأدوات)
check(await page.locator('.mr-exit').isVisible() && (await page.locator('.mr-exit').textContent()).includes('رجوع'), 'زر «رجوع» دائم أعلى الصفحة');
// النقر يخفي الأطر (شاشة كاملة) ثم يعيدها
// القراءة بملء الشاشة: الأدوات مخفية افتراضيًا، نقرة تُظهرها، نقرة أخرى تخفيها، ونقرتان تفتحان التنقل والبحث
check(!(await page.evaluate(() => document.querySelector('.mreader').classList.contains('chrome'))), 'القارئ يفتح بملء الشاشة دون أدوات');
const full = await page.evaluate(() => { const mp = document.querySelector('.mr-slide[data-page="293"] .mp'); const r = mp.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, rows: mp.querySelector('.mp-body').clientHeight / 15 / parseFloat(mp.style.getPropertyValue('--mp-size')) }; });
check(full.w === full.vw && full.h === full.vh && full.rows >= 1.12 && full.rows <= 2.0, `الصفحة تملأ الشاشة ${full.w}×${full.h} وتباعد الأسطر ${full.rows.toFixed(2)}em`);
await page.touchscreen.tap(6, 422);
await page.waitForTimeout(450);
check(await page.evaluate(() => document.querySelector('.mreader').classList.contains('chrome')), 'النقر على هامش الصفحة يُظهر الأدوات');
await page.touchscreen.tap(6, 422);
await page.waitForTimeout(450);
check(!(await page.evaluate(() => document.querySelector('.mreader').classList.contains('chrome'))), 'النقر مجددًا يخفي الأدوات');
await page.touchscreen.tap(6, 422); await page.touchscreen.tap(6, 422);
await page.locator('#sheet:not([hidden])').waitFor({ timeout: 3000 });
check(/التنقل والبحث/.test(await page.locator('#sheet-title').textContent()), 'النقر المزدوج يفتح التنقل والبحث');
await page.locator('#sheet-body input[type=search]').fill('الكهف 10');
await page.waitForTimeout(200);
check(/الكهف · آية 10|الكهف · آية ١٠/.test(await page.locator('#sheet-body .surah-row .nm').first().textContent()), 'البحث «الكهف 10» يقترح الآية العاشرة');
await page.locator('#sheet-close').click();
// تبويبات الانتقال: الأحزاب → الحزب 31 (بداية الجزء 16) → الصفحة 302 ثم العودة
await showTools();
await page.locator('.mr-btn[aria-label="الانتقال والبحث"]').click();
await page.locator('.goto-tabs button', { hasText: 'الأحزاب' }).click();
check((await page.locator('#sheet-body .goto-list .surah-row').count()) === 60, 'تبويب الأحزاب يعرض 60 حزبًا');
await page.locator('#sheet-body .goto-list .surah-row', { hasText: 'الحزب 31' }).first().click();
check(await pageSettled('302'), 'الحزب 31 ينتقل إلى الصفحة 302');
await showTools();
await page.locator('.mr-btn[aria-label="الانتقال والبحث"]').click();
await page.locator('.goto-tabs button', { hasText: 'صفحة' }).click();
await page.locator('#sheet-body .goto-page input[type=number]').fill('293');
await page.locator('#sheet-body .goto-page .btn').click();
check(await pageSettled('293'), 'تبويب الصفحة ينتقل إلى 293');
// العرض والألوان: سمة سكري (ورق #f3e6c9)، تدرّج، داكن، ثم العودة إلى الكريمي
await showTools();
await page.locator('.mr-btn[aria-label="العرض والألوان"]').click();
await page.locator('#sheet-body .theme-swatch').first().waitFor();
check((await page.locator('#sheet-body .theme-swatch').count()) >= 12, `نافذة العرض تعرض ${await page.locator('#sheet-body .theme-swatch').count()} سمة للصفحة`);
await page.locator('#sheet-body .theme-swatch[data-id="sugar"]').click();
await page.waitForTimeout(150);
const sugarBg = await page.evaluate(() => getComputedStyle(document.querySelector('.mr-slide[data-page="293"] .mp')).backgroundColor);
check((await page.locator('.mreader').getAttribute('data-theme')) === 'sugar' && sugarBg === 'rgb(243, 230, 201)' && (await page.evaluate(() => window.sakinah.settings.quran.theme)) === 'sugar', `سمة «سكري» تُطبَّق على الصفحة وتُحفظ (${sugarBg})`);
await page.locator('#sheet-body .theme-swatch[data-id="dawn"]').click();
await page.waitForTimeout(150);
check(/linear-gradient/.test(await page.evaluate(() => getComputedStyle(document.querySelector('.mr-slide[data-page="293"] .mp')).backgroundImage)), 'سمة «تدرّج الفجر» تُظهر تدرّجًا هادئًا على الصفحة');
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '08b-quran-display-sheet.png') });
await page.locator('#sheet-body .theme-swatch[data-id="midnight"]').click();
await page.waitForTimeout(150);
check((await page.evaluate(() => document.querySelector('.mreader').classList.contains('night') && document.querySelector('.mr-slide[data-page="293"] .mp').classList.contains('night'))) && (await page.evaluate(() => window.sakinah.settings.quran.themeDark)) === 'midnight', 'سمة «أزرق ليلي» داكنة وتُذكر للتبديل السريع');
await page.locator('#sheet-body .theme-swatch[data-id="cream"]').click();
await page.locator('#sheet-body input[type=range][aria-label="تعتيم الصفحة"]').fill('30');
await page.waitForTimeout(100);
check((await page.evaluate(() => Number(document.querySelector('.mr-dim').style.opacity))) === 0.3 && (await page.evaluate(() => window.sakinah.settings.quran.dim)) === 0.3, 'التعتيم يُطبَّق طبقةً فوق الصفحة ويُحفظ');
await page.locator('#sheet-body input[type=range][aria-label="تعتيم الصفحة"]').fill('0');
await page.locator('#sheet-close').click();
// التجويد الملوّن: يفعّل وضع النص ويلوّن الأحكام؛ خط حفص؛ التمرير التلقائي؛ التصفح الرأسي؛ ثم العودة إلى الصفحات
await showTools();
await page.locator('.mr-btn[aria-label="العرض والألوان"]').click();
await page.locator('#sheet-body .theme-swatch').first().waitFor();
await page.waitForTimeout(400);
await page.locator('#sheet-body label.switch:has(input[aria-label="التجويد الملوّن"])').click();
await page.locator('.mr-slide[data-page="293"] .mp-text .tj').first().waitFor({ timeout: 20000 });
const tjCount = await page.locator('.mr-slide[data-page="293"] .mp-text .tj').count();
check(tjCount > 40 && (await page.evaluate(() => window.sakinah.settings.quran.view)) === 'text' && (await page.evaluate(() => window.sakinah.settings.quran.tajweed)) === true, `التجويد الملوّن: ${tjCount} مقطعًا ملوّنًا في وضع النص`);
await page.waitForTimeout(300);
const fit = await page.evaluate(() => { const b = document.querySelector('.mr-slide[data-page="293"] .mp-body.text'); return { sh: b.scrollHeight, ch: b.clientHeight, fs: parseFloat(getComputedStyle(b).fontSize) }; });
check(fit.sh <= fit.ch + 1 && fit.fs >= 12, `وضع النص يلائم الشاشة دون تمرير (${fit.sh}/${fit.ch}px، خط ${fit.fs.toFixed(1)}px)`);
// الصفحة الملائمة لا تكون حاوية تمرير (فلا يتسرّب السحب الرأسي إلى المستند خلف القارئ على iOS)
const fitCss = await page.evaluate(() => { const b = document.querySelector('.mr-slide[data-page="293"] .mp-body.text'); const cs = getComputedStyle(b); return { ov: cs.overflowY, ta: cs.touchAction, cls: b.closest('.mp').classList.contains('overflow') }; });
check(fitCss.ov === 'hidden' && fitCss.ta === 'pan-x' && !fitCss.cls, `الصفحة الملائمة بلا تمرير داخلي ولمسها أفقي فقط (${fitCss.ov}/${fitCss.ta})`);
// اسم السورة داخل إطاره: مركز الحبر يطابق مركز الإطار (خط أميري قرآن صاعده أعلى من نازله فيهبط النص بلا تصحيح)
const snc = await page.evaluate(() => {
  const sn = document.querySelector('.mr-slide[data-page="293"] .mp-text .sname.plain'); if (!sn) return null;
  const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(sn); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; c.direction = 'rtl'; const m = c.measureText(sn.textContent);
  const pr = document.createElement('span'); pr.style.cssText = 'display:inline-block;width:0;height:0'; sn.append(pr); const bl = pr.getBoundingClientRect().bottom; pr.remove();
  const f = sn.parentElement.getBoundingClientRect(); return { d: Math.abs(bl - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 - (f.top + f.height / 2)), t: sn.style.transform };
});
check(snc && snc.d < 1 && /translateY/.test(snc.t), `اسم السورة في منتصف إطاره بصريًا (انحراف ${snc && snc.d.toFixed(2)}px، ${snc && snc.t})`);
await page.locator('#sheet-body .segmented button', { hasText: 'حفص' }).waitFor();
await page.locator('#sheet-body .segmented button', { hasText: 'حفص' }).click();
await page.locator('.mr-slide[data-page="293"] .mp-text .mw').first().waitFor({ timeout: 20000 });
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
check(/KFGQPC Hafs/.test(await page.evaluate(() => document.documentElement.style.getPropertyValue('--quran-font'))), 'خط حفص (مجمع الملك فهد) يُختار لوضع النص');
const hafs = await page.evaluate(() => { const b = document.querySelector('.mr-slide[data-page="293"] .mp-body.text'); const w = b.querySelector('.mw'); const me = b.querySelector('.me'); return { ff: getComputedStyle(w).fontFamily, zero: /[\u06DF\u06EB\u06E3]/.test(b.textContent), marker: me.textContent, sh: b.scrollHeight, ch: b.clientHeight, loaded: document.fonts.check('20px "KFGQPC Hafs"') }; });
check(/KFGQPC Hafs/.test(hafs.ff) && !hafs.zero && !/۝/.test(hafs.marker) && hafs.sh <= hafs.ch + 1, `خط حفص يُطبَّق فعلًا على الكلمات، بلا علامات لا يرسمها الخط، ورقم الآية بزخرفة الخط (${hafs.marker})، والصفحة تلائم الشاشة (${hafs.sh}/${hafs.ch}، محمَّل: ${hafs.loaded})`);
await page.locator('#sheet-body .segmented button', { hasText: 'أميري' }).click();
await page.waitForTimeout(200);
await page.locator('#sheet-body .segmented button', { hasText: 'رأسي' }).click();
await page.waitForTimeout(300);
check((await page.evaluate(() => document.querySelector('.mreader').classList.contains('vertical'))) && (await page.evaluate(() => window.sakinah.settings.quran.scroll)) === 'vertical', 'التصفح الرأسي المتصل يُفعَّل');
await page.locator('#sheet-body .segmented button', { hasText: 'أفقي' }).click();
await page.waitForTimeout(300);
await page.locator('#sheet-close').click();
await showTools();
check(await page.locator('.mr-round.mr-auto').isVisible(), 'زر التمرير التلقائي يظهر في وضع النص');
await page.locator('.mr-round.mr-auto').click();
await page.waitForTimeout(400);
const autoOn = await page.evaluate(() => document.querySelector('.mreader').classList.contains('autoscroll'));
await page.touchscreen.tap(6, 422); // أي لمسة للصفحة توقف التمرير
await page.waitForTimeout(300);
check(autoOn && !(await page.evaluate(() => document.querySelector('.mreader').classList.contains('autoscroll'))) && (await page.locator('.mreader').getAttribute('data-page')) === '293', 'التمرير التلقائي يبدأ بالزر وتوقفه لمسة الصفحة دون قلبها');
await showTools();
await page.locator('.mr-btn[aria-label="العرض والألوان"]').click();
await page.locator('#sheet-body .theme-swatch').first().waitFor();
await page.waitForTimeout(400);
await page.locator('#sheet-body label.switch:has(input[aria-label="التجويد الملوّن"])').click();
await page.locator('#sheet-body .segmented button', { hasText: 'صفحات المصحف' }).waitFor();
await page.locator('#sheet-body .segmented button', { hasText: 'صفحات المصحف' }).click();
await page.locator('.mr-slide[data-page="293"] .mp.ready:not(.mp-text)').waitFor({ timeout: 30000 });
check((await page.evaluate(() => window.sakinah.settings.quran.view)) === 'pages' && (await page.evaluate(() => window.sakinah.settings.quran.tajweed)) === false, 'العودة إلى صفحات المصحف بلا تجويد');
await page.locator('#sheet-close').click();
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '08b-quran-themes.png') });
await page.waitForTimeout(500);
await page.touchscreen.tap(6, 422); await page.waitForTimeout(450); // إظهار الأدوات للزرّ الليلي
await showTools();
await page.locator('.mr-round[aria-label="الوضع الليلي"]').click();
await page.waitForTimeout(250);
check(await page.evaluate(() => document.querySelector('.mreader').classList.contains('night') && document.querySelector('.mr-slide[data-page="293"] .mp').classList.contains('night')), 'الوضع الليلي يطبَّق على القارئ والصفحة');
await page.screenshot({ path: path.join(outDir, '08b-quran-night.png') });
// علامة عبر زر العلامة ثم عبر قائمة الآية (ضغطة مطوّلة)
await showTools();
await page.locator('.mr-round[aria-label="علامة"]').click();
await page.waitForTimeout(300);
check(/أُضيفت علامة/.test(await page.locator('#toast').textContent()) && (await page.locator('.mr-round[aria-label="علامة"].active').count()) === 1, 'زر العلامة يضيف علامة للصفحة');
// نقرة على آية: شريط الخيارات، ثم التفسير الميسر دون اتصال، ثم الاستماع بعدة قراء
const wa = page.locator('.mr-slide[data-page="293"] .mw[data-k]').nth(40); const wb = await wa.boundingBox();
await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2); await page.waitForTimeout(500);
check(!(await page.evaluate(() => document.querySelector('.mr-ayahbar').hidden)) && /الإسراء: \d+/.test(await page.locator('.ayahbar .ab-head b').textContent()) && (await page.locator('.mw.sel').count()) > 3, 'النقر على آية يحدّدها ويعرض شريط خياراتها');
await page.locator('.ayahbar .ab-actions button', { hasText: 'تفسير' }).click();
await page.locator('.tafsir-body p, .tafsir-body').first().waitFor({ timeout: 8000 });
await waitFor(() => (document.querySelector('.tafsir-body')?.innerText || '').length > 40, null, { timeout: 8000 });
check(/محفوظ على الجهاز/.test(await page.locator('.tafsir-foot').textContent()) && (await page.locator('.tafsir-src .chip').count()) === 7, 'التفسير الميسر يُعرض من الجهاز مع 7 مصادر');
await page.locator('.tafsir-nav button').last().click(); await page.waitForTimeout(600);
check(/تفسير الإسراء: \d+/.test(await page.locator('#sheet-title').textContent()), 'التنقل إلى تفسير الآية التالية');
await page.locator('#sheet-close').click(); await page.waitForTimeout(500);
await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2); await page.waitForTimeout(500);
await page.locator('.ayahbar .ab-actions button', { hasText: 'استماع' }).click(); await page.waitForTimeout(400);
check((await page.locator('.listen-reciters .surah-row').count()) === 21 && /الاستماع/.test(await page.locator('#sheet-title').textContent()), 'نافذة الاستماع تعرض 21 قارئًا مع المدى والتكرار');
await page.locator('#sheet-close').click(); await page.waitForTimeout(500);
await page.locator('.ayahbar .icon-btn[aria-label="إغلاق"]').click(); await page.waitForTimeout(300);
check(await page.evaluate(() => document.querySelector('.mr-ayahbar').hidden) && (await page.locator('.mw.sel').count()) === 0, 'إغلاق شريط الآية يزيل التحديد');
await page.touchscreen.tap(6, 422); await page.waitForTimeout(450); // إخفاء الأدوات قبل الضغط المطوّل
const w0 = page.locator('.mr-slide[data-page="293"] .mw[data-k]').nth(60); const bb = await w0.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
await page.locator('#sheet:not([hidden])').waitFor({ timeout: 3000 }).catch(() => {});
check(/الإسراء: \d+/.test(await page.locator('#sheet-title').textContent()) && (await page.locator('.mw.sel').count()) > 3, 'الضغط المطوّل على كلمة يفتح قائمة الآية ويظلّلها');
if (!(await page.evaluate(() => document.getElementById('sheet').hidden))) { await page.getByRole('button', { name: /موضع القراءة/ }).click(); await page.waitForTimeout(300); }
// وضع مراجعة الحفظ: الكلمات مخفية ثم تُكشف بالنقر (الزر في الطبقة العلوية؛ نُظهرها بنقرة)
await page.waitForTimeout(500);
await showTools();
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
await page.locator('.hifz-panel .icon-btn[aria-label="إنهاء المراجعة"]').click(); // خروج من وضع المراجعة
check((await page.locator('.mp.hifz').count()) === 0 && (await page.locator('.hifz-panel').count()) === 0, 'الخروج من وضع المراجعة');
// إخفاء الآيات (زر العين): الصفحة كلها مخفية، والنقر يكشف آيةً كاملة
await showTools();
await page.locator('.mr-round.mr-veil').click();
await page.locator('.veil-panel').waitFor();
const hiddenAll = await page.locator('.mr-slide[data-page="293"] .mw[data-k]:not(.revealed)').count();
const firstN = await page.evaluate(() => document.querySelector('.mr-slide[data-page="293"] .mw[data-k]').dataset.n);
const firstWords = await page.locator(`.mr-slide[data-page="293"] .mw[data-k][data-n="${firstN}"]`).count();
await page.locator('.mr-slide[data-page="293"] .mp-body').tap();
await page.waitForTimeout(350);
const revealedNow = await page.locator('.mr-slide[data-page="293"] .mw.revealed').count();
check(hiddenAll > 100 && revealedNow === firstWords, `إخفاء الآيات: ${hiddenAll} كلمة مخفية، والنقرة تكشف الآية الأولى كاملة (${revealedNow} كلمة)`);
await page.locator('.veil-panel .icon-btn[aria-label="إنهاء إخفاء الآيات"]').click();
check((await page.locator('.mp.hifz').count()) === 0 && (await page.locator('.veil-panel').count()) === 0, 'إنهاء إخفاء الآيات');
// التشغيل من الخيارات: يظهر شريط التلاوة (الصوت محجوب في الاختبار)
await page.route(/cdn\.islamic\.network|api\.quran\.com|verses\.quran\.com/, (r) => r.abort()); // الصوت وبياناته محجوبة: الاختبار لا يعتمد على الشبكة
await showTools();
await page.locator('.mr-btn[aria-label="خيارات"]').click();
await page.getByRole('button', { name: /تشغيل/ }).click();
await page.locator('#audio-bar').waitFor({ timeout: 5000 });
check(/العفاسي/.test(await page.locator('#audio-bar .who').textContent()), 'شريط التلاوة يعرض القارئ الافتراضي');
await page.locator('#audio-bar').getByRole('button', { name: 'إغلاق' }).click();
check((await page.locator('#audio-bar').count()) === 0, 'إغلاق شريط التلاوة');
// العودة للفهرس: بطاقة المتابعة تعرض آخر موضع، والعلامة في قائمة العلامات
if (await chromeOn()) { await page.touchscreen.tap(6, 422); await page.waitForTimeout(400); }
await page.locator('.mr-exit').click();
await page.locator('.resume-card').waitFor();
check(/الإسراء/.test(await page.locator('.resume-card').textContent()) && /293/.test(await page.locator('.resume-card').textContent()), `بطاقة متابعة القراءة تحفظ الموضع (الإسراء، ص 293): ${(await page.locator('.resume-card').textContent()).replace(/\s+/g, ' ').trim()}`);
check((await page.locator('.mreader').getAttribute('hidden')) !== null && (await page.evaluate(() => location.hash)) === '#/quran', 'إغلاق القارئ يعيد الرابط #/quran');
// التحدّيات وخريطة الحرارة في الفهرس
await page.locator('#view-quran .challenge-card .btn', { hasText: 'ابدأ تحدّيًا' }).click();
await page.locator('#sheet-body .challenge-row', { hasText: 'سورة الكهف' }).click();
await page.locator('#view-quran .challenge-card .bar').waitFor();
check(/سورة الكهف/.test(await page.locator('#view-quran .challenge-card').textContent()) && (await page.locator('#view-quran .heatmap i').count()) === 90 && (await page.evaluate(() => window.sakinah.settings.quran.challenge && window.sakinah.settings.quran.challenge.id)) === 'kahf', 'تحدّي «سورة الكهف» يبدأ ويعرض التقدّم وخريطة 90 يومًا');
await page.locator('#view-quran .challenge-card .btn', { hasText: 'إنهاء' }).click();
check((await page.evaluate(() => window.sakinah.settings.quran.challenge)) === null, 'إنهاء التحدّي');
console.log(`  (خطوط المصحف المقدَّمة من الكاش: ${fontsServed})`);

await page.locator('#tab-more').click();
await page.getByRole('button', { name: /الأحاديث/ }).first().click();
await page.locator('#view-hadith .hadith.daily').waitFor();
check((await page.locator('#view-hadith .hadith').count()) >= 10, 'قائمة الأحاديث مع حديث اليوم');
await a11y('الأحاديث');
await page.locator('#view-hadith .search input').fill('الأعمال بالني');
await page.waitForTimeout(200);
check((await page.locator('#view-hadith .hadith').count()) >= 1 && /الأَعْمَالُ|الأعمال/.test(await page.locator('#view-hadith .hadith:not(.daily) .matn').first().textContent()), 'البحث يجد حديث النية');
// الأربعون النووية
await page.locator('#view-hadith .search input').fill('');
await page.locator('#view-hadith .segmented button', { hasText: 'الأربعون' }).click();
await page.locator('#view-hadith .hadith.nawawi').first().waitFor();
check((await page.locator('#view-hadith .hadith.nawawi').count()) === 20 && /الْأَعْمَالُ بِالنِّيَّاتِ/.test(await page.locator('#view-hadith .hadith.nawawi .matn').first().textContent()), 'الأربعون النووية: الحديث الأول «إنما الأعمال بالنيات»');
await page.locator('#view-hadith .search input').fill('الحلال بين');
await page.waitForTimeout(200);
check((await page.locator('#view-hadith .hadith.nawawi').count()) === 1 && /السادس/.test(await page.locator('#view-hadith .hadith.nawawi .chip').first().textContent()), 'البحث في الأربعين يجد الحديث السادس');
// بطاقة المشاركة كصورة تُرسم على Canvas بخطوط التطبيق
const cardBytes = await page.evaluate(async () => { const m = await import('./js/core/share-card.js'); const b = await m.renderShareCard({ title: 'تجربة', text: 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى', footer: 'رواه البخاري' }); return b.size; });
check(cardBytes > 20000, `بطاقة المشاركة PNG (${Math.round(cardBytes / 1024)} KB)`);
await page.screenshot({ animations: 'disabled', path: path.join(outDir, '05-hadith.png') });

await page.locator('#btn-settings').click();
await page.locator('#view-settings select').first().waitFor();
check(/الأردن/.test(await page.locator('#view-settings select').first().locator('option').first().textContent()), 'الإعدادات تعرض الطريقة التلقائية (الأردن)');
check((await page.locator('#view-settings .card-title', { hasText: 'تذكير الأذكار' }).count()) === 1, 'قسم تذكير الأذكار وحديث اليوم في الإعدادات');
await a11y('الإعدادات');
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
