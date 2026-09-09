/**
 * عارض صفحة مصحف المدينة النبوية بدقة الطباعة: 15 سطرًا ثابتة (8 للصفحتين الأوليين) بخطوط الصفحات QCF v1 لمجمع الملك فهد،
 * ترويسة السورة بخط أسماء السور، البسملة رسمًا، ورأس الصفحة (السورة/الجزء) ورقمها بالأرقام المشرقية.
 * كل كلمة عنصر .mw يحمل data-n (رقم الآية العام) وdata-k (فهرس الكلمة المنطوقة) للتظليل والتسميع؛ وعلامة نهاية الآية .me.
 */
import { h } from './components.js';
import { pageLines, pageFontUrl, pageFontFamily, SURAH_NAMES_FONT_URL, surahNameGlyph, juzName } from '../core/mushaf.js';
import { pageAyahs, surahInfo, pageLabel, tokenize, ayahMarker } from '../core/quran.js';
import { BISMILLAH_SVG } from '../data/bismillah.js';

/** عرض السطر الكامل في خطوط QCF (بوحدة em) — ثابت في كل الصفحات (14.69–14.83em)؛ يُصحَّح بالقياس عند الحاجة */
const FULL_LINE_EM = 14.85;
export const ROW_EM = 1.09; // ارتفاع السطر نسبةً إلى حجم الخط كما في المصحف المطبوع
const LINES = 15;

const fontPromises = new Map();
/** تحميل خط عبر FontFace (مرة واحدة لكل عائلة) */
export function ensureFont(family, url) {
  if (fontPromises.has(family)) return fontPromises.get(family);
  const run = (async () => {
    if (typeof FontFace === 'undefined' || !document.fonts) throw new Error('FontFace unsupported');
    if ([...document.fonts].some((f) => f.family === family && f.status === 'loaded')) return family;
    const face = new FontFace(family, `url(${url}) format('woff2')`, { display: 'block' });
    await face.load();
    document.fonts.add(face);
    return family;
  })();
  run.catch(() => fontPromises.delete(family));
  fontPromises.set(family, run);
  return run;
}
export function ensurePageFont(p) { return ensureFont(pageFontFamily(p), pageFontUrl(p)); }
export function ensureSurahNamesFont() { return ensureFont('surahnames', SURAH_NAMES_FONT_URL); }
export function isPageFontReady(p) { const f = fontPromises.get(pageFontFamily(p)); return !!f && [...document.fonts].some((x) => x.family === pageFontFamily(p) && x.status === 'loaded'); }
/** تحميل مسبق لخطوط صفحات مجاورة دون انتظار */
export function preloadPageFonts(pages) { for (const p of pages) if (p >= 1 && p <= 604) ensurePageFont(p).catch(() => {}); }

const arabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
/** نص اسم السورة بخط أسماء السور: رمز الاسم ثم كلمة «سورة» (الخط يحوّل "surah" إلى رسم الكلمة؛ وبترتيب LTR تظهر «سورة» على اليمين) */
export function surahNameText(surah, { prefix = true } = {}) { return prefix ? `${surahNameGlyph(surah)} surah` : surahNameGlyph(surah); }

/**
 * بناء عنصر الصفحة. لا يُحمِّل الخطوط بنفسه؛ استدعِ mountMushafPage بعد إدراجه في الشجرة.
 * @param {number} p رقم الصفحة
 * @param {{ onTapAyah?: (n:number, ev:Event) => void, showChrome?: boolean }} opts
 */
export function renderMushafPage(p, opts = {}) {
  const lines = pageLines(p); const ayahs = pageAyahs(p); const first = ayahs[0]; const lbl = pageLabel(p);
  const short = lines.length < LINES;
  const body = h('div', { class: `mp-body ${short ? 'short' : ''}`, style: { fontFamily: `'${pageFontFamily(p)}'` } });
  lines.forEach((line, i) => {
    let el;
    if (line.type === 'header') el = h('div', { class: 'ml mh', dataset: { surah: String(line.surah) } }, h('div', { class: 'sframe' }, h('span', { class: 'sname', 'aria-label': `سورة ${surahInfo(line.surah).name}` }, surahNameText(line.surah))));
    else if (line.type === 'basmala') el = h('div', { class: 'ml mb', role: 'img', 'aria-label': 'بسم الله الرحمن الرحيم', html: BISMILLAH_SVG });
    else {
      const wrap = h('span', { class: 'mlw' });
      for (const w of line.words) {
        const span = h('span', { class: w.end ? 'me' : 'mw', dataset: { n: String(w.n) } }, w.glyph);
        if (!w.end && w.k >= 0) span.dataset.k = String(w.k);
        wrap.append(span);
      }
      el = h('div', { class: 'ml mt' }, wrap);
    }
    if (short) el.style.gridRow = String(i + 4); // الفاتحة وأول البقرة: 8 أسطر في وسط الصفحة داخل إطار
    body.append(el);
  });
  if (short) body.append(h('div', { class: 'mframe', 'aria-hidden': 'true' }));
  const page = h('article', { class: 'mp', dataset: { page: String(p) }, 'aria-label': `صفحة ${p}` },
    opts.showChrome === false ? null : h('div', { class: 'mp-head' }, h('span', { class: 'mp-surah' }, `سُورَةُ ${surahInfo(first.surah).vocalized}`), h('span', { class: 'mp-juz' }, juzName(lbl.juz))),
    body,
    opts.showChrome === false ? null : h('div', { class: 'mp-foot' }, arabicDigits(p)));
  if (opts.onTapAyah) page.addEventListener('click', (ev) => { const t = ev.target.closest('.mw, .me'); if (t) opts.onTapAyah(+t.dataset.n, ev); });
  return page;
}

/**
 * بعد إدراج الصفحة في المستند: تحميل خطوطها ثم ضبط حجم الخط ليملأ السطر الكامل عرض الصفحة، مع إعادة الضبط عند تغيّر العرض.
 * يعيد وعدًا يكتمل عند جاهزية الصفحة (أو يُرفض إن تعذّر تحميل الخط).
 */
export async function mountMushafPage(page) {
  const p = +page.dataset.page;
  page.classList.add('loading');
  try {
    await Promise.all([ensurePageFont(p), page.querySelector('.mh') ? ensureSurahNamesFont() : null]);
  } catch (e) { page.classList.remove('loading'); page.classList.add('font-error'); throw e; }
  fitMushafPage(page);
  page.classList.remove('loading'); page.classList.add('ready');
  if (typeof ResizeObserver !== 'undefined' && !page._ro) { page._ro = new ResizeObserver(() => fitMushafPage(page)); page._ro.observe(page); }
  return page;
}

/** ضبط حجم الخط: السطر الكامل (≈14.8em) يملأ عرض الجسم؛ ثم تصحيح بالقياس إن تجاوز أي سطر العرض */
export function fitMushafPage(page) {
  const body = page.querySelector('.mp-body'); if (!body) return;
  const W = body.clientWidth - parseFloat(getComputedStyle(body).paddingLeft || 0) - parseFloat(getComputedStyle(body).paddingRight || 0);
  if (W <= 0) return;
  let size = W / FULL_LINE_EM;
  body.style.fontSize = size.toFixed(2) + 'px';
  let maxW = 0;
  for (const l of body.querySelectorAll('.mlw')) maxW = Math.max(maxW, l.getBoundingClientRect().width);
  if (maxW > W + 0.5) { size *= W / maxW; body.style.fontSize = size.toFixed(2) + 'px'; }
  page.style.setProperty('--mp-size', size.toFixed(2) + 'px');
}

/** تظليل آية (تشغيل/تحديد) داخل صفحة أو حاوية صفحات */
export function markAyah(root, n, cls, on = true) {
  root.querySelectorAll(`.mw[data-n="${n}"], .me[data-n="${n}"]`).forEach((el) => el.classList.toggle(cls, on));
}
export function clearMarks(root, cls) { root.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls)); }
export function wordEl(root, n, k) { return root.querySelector(`.mw[data-n="${n}"][data-k="${k}"]`); }

/**
 * بديل نصي عند تعذّر تحميل خط الصفحة (دون اتصال قبل تخزين الخطوط): الصفحة نفسها بخط Amiri Quran بالبنية ذاتها
 * (.mw[data-n][data-k] و.me) كي يعمل التظليل والتسميع، مع ترويسات السور والبسملة.
 */
export function renderTextPage(p, opts = {}) {
  const ayahs = pageAyahs(p); const first = ayahs[0]; const lbl = pageLabel(p);
  const body = h('div', { class: 'mp-body text' });
  for (const a of ayahs) {
    if (a.ayah === 1) {
      body.append(h('div', { class: 'ml mh' }, h('div', { class: 'sframe' }, h('span', { class: 'sname plain' }, `سورة ${surahInfo(a.surah).name}`))));
      if (a.surah !== 1 && a.surah !== 9) body.append(h('div', { class: 'ml mb', role: 'img', 'aria-label': 'بسم الله الرحمن الرحيم', html: BISMILLAH_SVG }));
    }
    const span = h('span', { class: 'ayah-text' }); let k = 0;
    tokenize(a.text).forEach((t, i, arr) => {
      const el = h('span', { class: t.spoken ? 'mw' : 'mw mark', dataset: { n: String(a.n) } }, t.raw);
      if (t.spoken) el.dataset.k = String(k++);
      span.append(el, i < arr.length - 1 ? ' ' : '');
    });
    span.append(' ', h('span', { class: 'me', dataset: { n: String(a.n) } }, `۝${ayahMarker(a.ayah, 'arab')}`), ' ');
    body.append(span);
  }
  const page = h('article', { class: 'mp mp-text ready', dataset: { page: String(p) }, 'aria-label': `صفحة ${p}` },
    opts.showChrome === false ? null : h('div', { class: 'mp-head' }, h('span', { class: 'mp-surah' }, `سُورَةُ ${surahInfo(first.surah).vocalized}`), h('span', { class: 'mp-juz' }, juzName(lbl.juz))),
    body,
    opts.showChrome === false ? null : h('div', { class: 'mp-foot' }, arabicDigits(p)));
  if (opts.onTapAyah) page.addEventListener('click', (ev) => { const t = ev.target.closest('.mw, .me'); if (t) opts.onTapAyah(+t.dataset.n, ev); });
  return page;
}
