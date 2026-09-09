/**
 * قارئ المصحف الغامر (شاشة كاملة فوق التطبيق): شريط أسماء السور بخط المصحف مع إطار مثمّن للسورة الحالية،
 * عرض دوّار للصفحات (تمرير أفقي بانطباق، مع ظهور طرفَي الصفحتين المجاورتين)، شريط الجزء مع زرّي العلامة والوضع الليلي،
 * شريط نجوم الأجزاء الثلاثين، وضع الشاشة الكاملة بالنقر، الضغط المطوّل لقائمة الآية، وقفل الشاشة أثناء القراءة.
 * يعرض الصفحات عبر js/ui/mushaf-page.js (خطوط الصفحات)، وعند تعذّر الخط يعرض البديل النصي.
 */
import { h, icon, render, vibrate } from './components.js';
import { renderMushafPage, mountMushafPage, renderTextPage, preloadPageFonts, ensureSurahNamesFont, surahNameText, markAyah, clearMarks } from './mushaf-page.js';
import { juzName } from '../core/mushaf.js';
import { pageAyahs, pageLabel, surahInfo, SURAHS, JUZ_STARTS, TOTAL_PAGES } from '../core/quran.js';

const PAGE_RATIO = 1.27; // ارتفاع بطاقة الصفحة نسبةً إلى عرضها (الرأس + 15 سطرًا + رقم الصفحة)
const PEEK = 22; // ما يظهر من الصفحتين المجاورتين (بكسل) من كل جانب
const GAP = 10;
const arabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const OCTAGON_SVG = `<svg viewBox="0 0 240 70" aria-hidden="true"><path d="M22 4h196l18 18v26l-18 18H134l-14 12-14-12H22L4 48V22z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const STAR_POINTS = (() => { const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 36 : 50; const a = (Math.PI / 8) * i; pts.push(`${(50 + r * Math.sin(a)).toFixed(1)}% ${(50 - r * Math.cos(a)).toFixed(1)}%`); } return pts.join(','); })();

/**
 * @param {object} app
 * @param {object} cb ردود: onIndex, onSearch, onOptions, onHifzToggle, onPageChange(p), onTap(target, ev), onLongPress(n, el), onBookmark(p), onPlay(p)
 */
export function createMushafReader(app, cb = {}) {
  const root = h('div', { class: 'mreader', hidden: true, role: 'region', 'aria-label': 'المصحف' });
  document.documentElement.style.setProperty('--mr-star', STAR_POINTS);
  let page = 0; let open = false; let filled = new Map(); let slideW = 300; let wakeLock = null; let scrollTimer = null; let programmatic = 0;
  let hifz = false; let stripUser = false; let starUser = false;

  /* ---------- الأعلى: الأزرار وشريط السور ---------- */
  const btn = (name, label, on, cls = '') => h('button', { class: `mr-btn ${cls}`, 'aria-label': label, title: label, onclick: on }, h('span', { html: icon(name) }));
  const topBar = h('div', { class: 'mr-topbar' },
    h('div', { class: 'mr-group' }, btn('list', 'الفهرس', () => cb.onIndex && cb.onIndex()), btn('search', 'بحث', () => cb.onSearch && cb.onSearch())),
    h('div', { class: 'mr-group' }, btn('eyeOff', 'مراجعة الحفظ', () => cb.onHifzToggle && cb.onHifzToggle(), 'mr-hifz-btn'), btn('settings', 'خيارات', () => cb.onOptions && cb.onOptions())));
  const strip = h('div', { class: 'mr-surahs', role: 'listbox', 'aria-label': 'السور' });
  for (const s of SURAHS) {
    strip.append(h('button', { class: 'mr-sname', role: 'option', dataset: { surah: String(s.n) }, 'aria-label': `سورة ${s.name}`, onclick: () => { if (surahOfPage(page) !== s.n || pageAyahs(page)[0].ayah !== 1) goto(s.page, { smooth: true }); } },
      h('span', { class: 'glyph' }, surahNameText(s.n)), h('span', { class: 'plain' }, `سورة ${s.name}`)));
  }
  const octagon = h('div', { class: 'mr-octagon', 'aria-hidden': 'true', html: OCTAGON_SVG });
  const panel = h('div', { class: 'mr-panel' });
  const top = h('div', { class: 'mr-top' }, topBar, h('div', { class: 'mr-strip-wrap' }, strip, octagon), panel);

  /* ---------- المنتصف: الصفحات ---------- */
  const track = h('div', { class: 'mr-track', 'aria-live': 'polite' });
  for (let p = 1; p <= TOTAL_PAGES; p++) track.append(h('div', { class: 'mr-slide', dataset: { page: String(p) } }, h('div', { class: 'mr-ph' }, arabicDigits(p))));
  const stage = h('div', { class: 'mr-stage' }, track);

  /* ---------- الأسفل: الجزء والعلامة والليل، ونجوم الأجزاء ---------- */
  const bmBtn = h('button', { class: 'mr-round', 'aria-label': 'علامة', onclick: () => cb.onBookmark && cb.onBookmark(page) }, h('span', { html: icon('bookmark') }));
  const nightBtn = h('button', { class: 'mr-round', 'aria-label': 'الوضع الليلي', onclick: () => setNight(!root.classList.contains('night'), true) }, h('span', { html: icon('moon') }));
  const juzEl = h('div', { class: 'mr-juz' });
  const stars = h('div', { class: 'mr-stars', role: 'listbox', 'aria-label': 'الأجزاء' });
  for (const j of JUZ_STARTS) stars.append(h('button', { class: 'mr-star', role: 'option', dataset: { juz: String(j.juz) }, 'aria-label': `الجزء ${j.juz}`, onclick: () => goto(j.page, { smooth: true }) }, h('i'), h('b', {}, arabicDigits(j.juz))));
  const bottom = h('div', { class: 'mr-bottom' }, h('div', { class: 'mr-bar' }, bmBtn, juzEl, nightBtn), h('div', { class: 'mr-stars-wrap' }, stars, h('div', { class: 'mr-star-sel', 'aria-hidden': 'true' })));
  root.append(top, stage, bottom);

  /* ---------- الحسابات ---------- */
  const surahOfPage = (p) => pageAyahs(p)[0].surah;
  function layout() {
    const r = stage.getBoundingClientRect(); if (r.width < 50 || r.height < 50) return;
    const w = Math.max(200, Math.min(r.width - PEEK * 2, (r.height - 8) / PAGE_RATIO));
    if (Math.abs(w - slideW) < 0.5) return;
    slideW = w;
    track.style.setProperty('--slide-w', `${w.toFixed(1)}px`);
    track.style.setProperty('--mr-gap', `${GAP}px`);
    if (page) scrollToPage(page, 'instant');
  }
  const slideOf = (p) => track.children[p - 1];
  function scrollToPage(p, behavior = 'smooth') {
    const s = slideOf(p); if (!s) return;
    programmatic++;
    s.scrollIntoView({ inline: 'center', block: 'nearest', behavior });
    setTimeout(() => { programmatic = Math.max(0, programmatic - 1); }, behavior === 'instant' ? 50 : 600);
  }
  function pageFromScroll() {
    const idx = Math.round(Math.abs(track.scrollLeft) / (slideW + GAP));
    return Math.min(TOTAL_PAGES, Math.max(1, idx + 1));
  }
  function onScrollSettled() {
    if (!open) return;
    const p = pageFromScroll();
    if (p !== page) setPage(p, { fromScroll: true });
  }
  track.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollSettled, 120); }, { passive: true });
  track.addEventListener('scrollend', () => { clearTimeout(scrollTimer); onScrollSettled(); });

  /* ---------- ملء الصفحات (نافذة حول الصفحة الحالية) ---------- */
  function fill(p) {
    if (p < 1 || p > TOTAL_PAGES || filled.has(p)) return;
    const slide = slideOf(p);
    const el = renderMushafPage(p);
    if (root.classList.contains('night')) el.classList.add('night');
    if (hifz) el.classList.add('hifz');
    render(slide, el);
    const entry = { el, text: false }; filled.set(p, entry);
    mountMushafPage(el).catch(() => {
      if (!filled.has(p) || filled.get(p) !== entry) return;
      const alt = renderTextPage(p); if (root.classList.contains('night')) alt.classList.add('night'); if (hifz) alt.classList.add('hifz');
      render(slide, alt); entry.el = alt; entry.text = true;
      cb.onFallback && cb.onFallback(p);
    }).then(() => cb.onPageReady && cb.onPageReady(p, entry.el));
  }
  function unfill(p) {
    const e = filled.get(p); if (!e) return;
    if (e.el._ro) { e.el._ro.disconnect(); e.el._ro = null; }
    render(slideOf(p), h('div', { class: 'mr-ph' }, arabicDigits(p))); filled.delete(p);
  }
  function refreshWindow() {
    for (const p of [...filled.keys()]) if (Math.abs(p - page) > 3) unfill(p);
    fill(page); fill(page + 1); fill(page - 1);
    preloadPageFonts([page + 2, page - 2]);
  }

  /* ---------- تغيير الصفحة ---------- */
  function setPage(p, { fromScroll = false } = {}) {
    page = p;
    refreshWindow();
    updateChrome();
    cb.onPageChange && cb.onPageChange(p, { fromScroll });
  }
  function goto(p, { smooth = true } = {}) {
    p = Math.min(TOTAL_PAGES, Math.max(1, p));
    if (!open) { page = p; return; }
    if (p === page) { scrollToPage(p, smooth ? 'smooth' : 'instant'); return; }
    // نملأ الوجهة قبل الانتقال حتى لا تظهر فارغة
    fill(p);
    scrollToPage(p, smooth && Math.abs(p - page) <= 2 ? 'smooth' : 'instant');
    setPage(p);
  }
  function updateChrome() {
    const s = surahOfPage(page); const lbl = pageLabel(page);
    juzEl.textContent = juzName(lbl.juz);
    for (const el of strip.children) el.classList.toggle('cur', +el.dataset.surah === s);
    for (const el of stars.children) el.classList.toggle('cur', +el.dataset.juz === lbl.juz);
    centerIn(strip, strip.querySelector('.mr-sname.cur'), stripUser ? 'smooth' : 'auto');
    centerIn(stars, stars.querySelector('.mr-star.cur'), 'smooth');
    refreshBookmark();
    root.dataset.page = String(page);
  }
  function centerIn(container, el, behavior) {
    if (!el) return;
    const left = el.offsetLeft + el.offsetWidth / 2 - container.clientWidth / 2;
    try { container.scrollTo({ left, behavior }); } catch { container.scrollLeft = left; }
  }
  // تمرير المستخدم لشريط السور: عند الاستقرار نذهب إلى السورة التي في المنتصف
  let stripTimer = null;
  const centeredIn = (container, sel) => { const cx = container.getBoundingClientRect().left + container.clientWidth / 2; let best = null, bd = Infinity; for (const el of container.querySelectorAll(sel)) { const b = el.getBoundingClientRect(); const d = Math.abs(b.left + b.width / 2 - cx); if (d < bd) { bd = d; best = el; } } return best; };
  strip.addEventListener('pointerdown', () => { stripUser = true; }, { passive: true });
  strip.addEventListener('wheel', () => { stripUser = true; }, { passive: true });
  strip.addEventListener('scroll', () => { if (!stripUser) return; clearTimeout(stripTimer); stripTimer = setTimeout(() => { const el = centeredIn(strip, '.mr-sname'); stripUser = false; if (el && +el.dataset.surah !== surahOfPage(page)) goto(surahInfo(+el.dataset.surah).page, { smooth: true }); }, 220); }, { passive: true });
  stars.addEventListener('pointerdown', () => { starUser = true; }, { passive: true });
  stars.addEventListener('scroll', () => { if (!starUser) return; clearTimeout(stripTimer); stripTimer = setTimeout(() => { const el = centeredIn(stars, '.mr-star'); starUser = false; if (el && +el.dataset.juz !== pageLabel(page).juz) goto(JUZ_STARTS[+el.dataset.juz - 1].page, { smooth: true }); }, 220); }, { passive: true });

  /* ---------- اللمس: نقرة = إظهار/إخفاء الأطر (أو كشف كلمة في التسميع)، ضغطة مطوّلة = قائمة الآية ---------- */
  let press = null;
  track.addEventListener('contextmenu', (e) => e.preventDefault());
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    press = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, fired: false };
    press.timer = setTimeout(() => {
      if (!press || press.moved) return;
      const target = document.elementFromPoint(press.x, press.y); const w = target && target.closest && target.closest('.mw, .me');
      press.fired = true; if (w && cb.onLongPress) { vibrate(15); cb.onLongPress(+w.dataset.n, w); }
    }, 480);
  });
  const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
  track.addEventListener('pointermove', (e) => { if (press && !press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { press.moved = true; clearTimeout(press.timer); } }, { passive: true });
  track.addEventListener('pointerup', (e) => {
    if (!press) return; const pr = press; cancelPress();
    if (pr.moved || pr.fired || Date.now() - pr.t > 400) return;
    const target = document.elementFromPoint(e.clientX, e.clientY); const w = target && target.closest && target.closest('.mw, .me');
    if (cb.onTap && cb.onTap(w, e) === true) return; // المستهلك (وضع التسميع) تولّى النقرة
    setZen(!root.classList.contains('zen'));
  });
  track.addEventListener('pointercancel', cancelPress);
  track.addEventListener('scroll', () => { if (press) { press.moved = true; clearTimeout(press.timer); } }, { passive: true });

  /* ---------- أوضاع العرض ---------- */
  function setZen(on) { root.classList.toggle('zen', on); setTimeout(layout, 320); }
  function setNight(on, persist = false) {
    root.classList.toggle('night', on); nightBtn.innerHTML = icon(on ? 'sun' : 'moon');
    for (const e of filled.values()) e.el.classList.toggle('night', on);
    if (persist) app.update({ quran: { night: on } });
  }
  function setHifz(on) { hifz = on; root.classList.toggle('hifz', on); for (const e of filled.values()) e.el.classList.toggle('hifz', on); topBar.querySelector('.mr-hifz-btn').classList.toggle('active', on); }
  function refreshBookmark() {
    const bms = app.settings.quran.bookmarks || []; const has = bms.some((b) => b.page === page);
    bmBtn.innerHTML = icon(has ? 'bookmarkFill' : 'bookmark'); bmBtn.classList.toggle('active', has);
  }
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { wakeLock = null; }
  }
  const onVisibility = () => { if (open && document.visibilityState === 'visible' && !wakeLock) requestWakeLock(); };
  const onKey = (e) => {
    if (!open || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { goto(page + 1); e.preventDefault(); } else if (e.key === 'ArrowRight') { goto(page - 1); e.preventDefault(); }
    else if (e.key === 'Escape') { if (root.classList.contains('zen')) setZen(false); else cb.onIndex && cb.onIndex(); }
  };
  let ro = null;

  /* ---------- الفتح والإغلاق ---------- */
  function show(p) {
    if (!root.isConnected) document.body.append(root);
    root.hidden = false; open = true; document.body.classList.add('mreader-open');
    setNight(!!app.settings.quran.night);
    ensureSurahNamesFont().then(() => root.classList.add('snames')).catch(() => {});
    if (!ro && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(layout); ro.observe(stage); }
    layout();
    page = 0; fill(p); scrollToPage(p, 'instant'); setPage(p);
    requestWakeLock();
    document.addEventListener('visibilitychange', onVisibility); document.addEventListener('keydown', onKey);
  }
  function hide() {
    open = false; root.hidden = true; document.body.classList.remove('mreader-open'); root.classList.remove('zen');
    if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; }
    document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('keydown', onKey);
    for (const p of [...filled.keys()]) unfill(p);
  }

  return {
    el: root, track,
    get page() { return page; }, get isOpen() { return open; }, get isNight() { return root.classList.contains('night'); },
    show, hide, goto, setZen, setNight, setHifz, refreshBookmark,
    setPanel(el) { render(panel, el); root.classList.toggle('has-panel', !!el); setTimeout(layout, 50); },
    pageEl(p) { const e = filled.get(p); return e ? e.el : null; },
    isTextPage(p) { const e = filled.get(p); return !!e && e.text; },
    mark(n, cls, on = true) { markAyah(track, n, cls, on); },
    clearMarks(cls) { clearMarks(track, cls); },
    relayout: layout,
  };
}
