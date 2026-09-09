/**
 * قارئ المصحف بملء الشاشة: كل صفحة تملأ الشاشة كاملة (15 سطرًا موزّعة على الارتفاع كما في تطبيقات المصحف)،
 * والتنقل بالسحب يمينًا ويسارًا. الأدوات مخفية أثناء القراءة وتظهر بنقرة واحدة على الصفحة (طبقة علوية: أسماء السور
 * بخط المصحف مع الإطار المثمّن، الأزرار؛ وطبقة سفلية: الجزء والعلامة والوضع الليلي ونجوم الأجزاء)، والنقر المزدوج يفتح
 * التنقل والبحث، والضغط المطوّل يفتح قائمة الآية. يعرض الصفحات عبر js/ui/mushaf-page.js وعند تعذّر الخط يعرض البديل النصي.
 */
import { h, icon, render, vibrate } from './components.js';
import { themeById, isDarkTheme, themeVars, migrateTheme } from '../core/mushaf-themes.js';
import { renderMushafPage, mountMushafPage, renderTextPage, fitMushafPage, preloadPageFonts, releasePageFonts, ensureSurahNamesFont, surahNameText, markAyah, clearMarks, wordEl } from './mushaf-page.js';
import { juzName } from '../core/mushaf.js';
import { pageAyahs, pageLabel, surahInfo, SURAHS, JUZ_STARTS, TOTAL_PAGES } from '../core/quran.js';

const arabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const OCTAGON_SVG = `<svg viewBox="0 0 240 70" aria-hidden="true"><path d="M22 4h196l18 18v26l-18 18H134l-14 12-14-12H22L4 48V22z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const STAR_POINTS = (() => { const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 36 : 50; const a = (Math.PI / 8) * i; pts.push(`${(50 + r * Math.sin(a)).toFixed(1)}% ${(50 - r * Math.cos(a)).toFixed(1)}%`); } return pts.join(','); })();
const CHROME_AUTOHIDE_MS = 6000;

/**
 * @param {object} app
 * @param {object} cb ردود: onIndex, onSearch, onOptions, onHifzToggle, onQuickNav, onPageChange(p, {fromScroll}), onTap(wordEl, ev) → true إن استهلك النقرة (التسميع), onAyahTap(n, wordEl) → true إن عُرضت قائمة الآية,
 *   onLongPress(n, el), onBookmark(p), onPageReady(p, el), onFallback(p)
 */
export function createMushafReader(app, cb = {}) {
  const root = h('div', { class: 'mreader', hidden: true, role: 'region', 'aria-label': 'المصحف' });
  document.documentElement.style.setProperty('--mr-star', STAR_POINTS);
  let page = 0; let open = false; const filled = new Map(); let wakeLock = null; let scrollTimer = null; let hideTimer = null;
  let hifz = false; let stripUser = false; let starUser = false; let ro = null; let textMode = false;

  /* ---------- الطبقة العلوية ---------- */
  const btn = (name, label, on, cls = '') => h('button', { class: `mr-btn ${cls}`, 'aria-label': label, title: label, onclick: on }, h('span', { html: icon(name) }));
  const topBar = h('div', { class: 'mr-topbar' },
    h('div', { class: 'mr-group' }, btn('close', 'العودة إلى التطبيق', () => cb.onIndex && cb.onIndex(), 'mr-close'), btn('list', 'الفهرس', () => cb.onIndex && cb.onIndex()), btn('search', 'الانتقال والبحث', () => cb.onQuickNav && cb.onQuickNav())),
    h('div', { class: 'mr-group' }, btn('sun', 'العرض والألوان', () => cb.onDisplay && cb.onDisplay(), 'mr-display-btn'), btn('eyeOff', 'مراجعة الحفظ', () => cb.onHifzToggle && cb.onHifzToggle(), 'mr-hifz-btn'), btn('settings', 'خيارات', () => cb.onOptions && cb.onOptions())));
  const strip = h('div', { class: 'mr-surahs', role: 'listbox', 'aria-label': 'السور' });
  for (const s of SURAHS) {
    strip.append(h('button', { class: 'mr-sname', role: 'option', dataset: { surah: String(s.n) }, 'aria-label': `سورة ${s.name}`, onclick: () => { touchChrome(); if (surahOfPage(page) !== s.n || pageAyahs(page)[0].ayah !== 1) goto(s.page, { smooth: true }); } },
      h('span', { class: 'glyph' }, surahNameText(s.n)), h('span', { class: 'plain' }, `سورة ${s.name}`)));
  }
  const octagon = h('div', { class: 'mr-octagon', 'aria-hidden': 'true', html: OCTAGON_SVG });
  const panel = h('div', { class: 'mr-panel' });
  const top = h('div', { class: 'mr-top' }, topBar, h('div', { class: 'mr-strip-wrap' }, strip, octagon), panel);

  /* ---------- الصفحات ---------- */
  const track = h('div', { class: 'mr-track' });
  for (let p = 1; p <= TOTAL_PAGES; p++) track.append(h('div', { class: 'mr-slide', dataset: { page: String(p) } }, h('div', { class: 'mr-ph' }, arabicDigits(p))));
  const stage = h('div', { class: 'mr-stage' }, track);

  /* ---------- الطبقة السفلية ---------- */
  const bmBtn = h('button', { class: 'mr-round', 'aria-label': 'علامة', onclick: () => { touchChrome(); cb.onBookmark && cb.onBookmark(page); } }, h('span', { html: icon('bookmark') }));
  const nightBtn = h('button', { class: 'mr-round', 'aria-label': 'الوضع الليلي', onclick: () => { touchChrome(); setNight(!root.classList.contains('night'), true); } }, h('span', { html: icon('moon') }));
  const veilBtn = h('button', { class: 'mr-round mr-veil', 'aria-label': 'إخفاء الآيات للحفظ', title: 'إخفاء الآيات للحفظ', onclick: () => { touchChrome(); cb.onVeilToggle && cb.onVeilToggle(); } }, h('span', { html: icon('eyeOff') }));
  const autoBtn = h('button', { class: 'mr-round mr-auto', 'aria-label': 'تمرير تلقائي', title: 'تمرير تلقائي', onclick: () => { touchChrome(); if (auto) stopAutoScroll(); else startAutoScroll(); } }, h('span', { html: icon('play') }));
  const juzEl = h('div', { class: 'mr-juz' });
  const stars = h('div', { class: 'mr-stars', role: 'listbox', 'aria-label': 'الأجزاء' });
  for (const j of JUZ_STARTS) stars.append(h('button', { class: 'mr-star', role: 'option', dataset: { juz: String(j.juz) }, 'aria-label': `الجزء ${j.juz}`, onclick: () => { touchChrome(); goto(j.page, { smooth: true }); } }, h('i'), h('b', {}, arabicDigits(j.juz))));
  const bottom = h('div', { class: 'mr-bottom' }, h('div', { class: 'mr-bar' }, bmBtn, veilBtn, juzEl, autoBtn, nightBtn), h('div', { class: 'mr-stars-wrap' }, stars, h('div', { class: 'mr-star-sel', 'aria-hidden': 'true' })));
  const hint = h('div', { class: 'mr-hint', hidden: true }, 'زر «رجوع» أعلى الصفحة يعيدك إلى التطبيق · انقر آيةً لخياراتها (تفسير، استماع…) · انقر هامش الصفحة لإظهار الأدوات · انقر مرتين للانتقال');
  const ayahBar = h('div', { class: 'mr-ayahbar', hidden: true });
  const exitBtn = h('button', { class: 'mr-exit', 'aria-label': 'العودة إلى التطبيق', onclick: () => cb.onIndex && cb.onIndex() }, h('span', { html: icon('close') }), h('span', { class: 'lbl' }, 'رجوع'));
  const dimmer = h('div', { class: 'mr-dim', 'aria-hidden': 'true' });
  root.append(stage, dimmer, top, bottom, ayahBar, hint, exitBtn);
  let exitTimer = null; let keepAwake = true; let themeId = 'cream';
  let vertical = false; let auto = null; let autoSpeed = 40; let tajweedFn = null; let pull = null;
  const pullHint = h('div', { class: 'mr-pull', 'aria-hidden': 'true' }, 'اسحب لأسفل للإغلاق');
  root.append(pullHint);
  /** زر الرجوع يبقى ظاهرًا دائمًا ويخفت بعد ثوانٍ كي لا يشغل عن القراءة */
  function scheduleExitFade() { clearTimeout(exitTimer); exitBtn.classList.remove('faded'); exitTimer = setTimeout(() => exitBtn.classList.add('faded'), 4000); }
  for (const el of [top, bottom]) el.addEventListener('pointerdown', touchChrome, { passive: true });

  /* ---------- الحسابات ---------- */
  const surahOfPage = (p) => pageAyahs(p)[0].surah;
  const slideOf = (p) => track.children[p - 1];
  const slideW = () => track.clientWidth || 1;
  const slideH = () => track.clientHeight || 1;
  function scrollToPage(p, behavior = 'smooth') { const s = slideOf(p); if (s) s.scrollIntoView(vertical ? { block: 'start', inline: 'nearest', behavior } : { inline: 'center', block: 'nearest', behavior }); }
  function pageFromScroll() { return Math.min(TOTAL_PAGES, Math.max(1, Math.round(vertical ? track.scrollTop / slideH() : Math.abs(track.scrollLeft) / slideW()) + 1)); }
  /** اتجاه التصفح: أفقي (تقليب صفحات) أو رأسي متصل كما في Quran.com */
  function setVertical(on) { on = !!on; if (vertical === on) return; vertical = on; root.classList.toggle('vertical', on); if (open) { stopAutoScroll(); requestAnimationFrame(() => scrollToPage(page, 'instant')); } }
  /* ---------- التمرير التلقائي (وضع النص أو الرأسي) ---------- */
  function autoTarget() { if (textMode) { const e = filled.get(page); return e ? e.el.querySelector('.mp-body.text') : null; } return vertical ? track : null; }
  function startAutoScroll(speed = autoSpeed) {
    const t = autoTarget(); if (!t) return false; stopAutoScroll();
    auto = { speed, last: performance.now(), acc: 0 }; root.classList.add('autoscroll'); autoBtn.innerHTML = icon('pause'); autoBtn.setAttribute('aria-label', 'إيقاف التمرير التلقائي'); setChrome(false);
    const step = (now) => {
      if (!auto) return; const dt = Math.min(0.1, (now - auto.last) / 1000); auto.last = now;
      const el = autoTarget();
      if (el) {
        auto.acc += auto.speed * dt; const px = Math.floor(auto.acc);
        if (px >= 1) { el.scrollTop += px; auto.acc -= px; }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          // بلوغ نهاية الصفحة: مهلة قصيرة (أو مدة قراءة صفحة لا تحتاج تمريرًا) ثم الصفحة التالية
          if (!auto.endAt) auto.endAt = now;
          const wait = el.scrollHeight <= el.clientHeight + 1 ? Math.max(4000, (el.clientHeight / auto.speed) * 1000) : 1200;
          if (now - auto.endAt >= wait) {
            auto.endAt = 0;
            if (textMode && page < TOTAL_PAGES) { goto(page + 1, { smooth: false }); const nx = autoTarget(); if (nx) nx.scrollTop = 0; }
            else { stopAutoScroll(); return; }
          }
        } else auto.endAt = 0;
      }
      auto.raf = requestAnimationFrame(step);
    };
    auto.raf = requestAnimationFrame(step); return true;
  }
  function stopAutoScroll() { if (!auto) return; cancelAnimationFrame(auto.raf); auto = null; root.classList.remove('autoscroll'); autoBtn.innerHTML = icon('play'); autoBtn.setAttribute('aria-label', 'تمرير تلقائي'); }
  function setAutoSpeed(v) { autoSpeed = Math.max(10, Math.min(200, Number(v) || 40)); if (auto) auto.speed = autoSpeed; }
  /** التجويد الملوّن في وضع النص: دالة تعيد أحكام الآية أو null؛ تُعاد تعبئة الصفحات النصية */
  function setTajweed(fn) { tajweedFn = fn || null; if (open && textMode) { for (const p of [...filled.keys()]) unfill(p); refreshWindow(); } }
  let animTarget = null, animSince = 0; // هدف تمرير ناعم جارٍ: لا نُرجع الصفحة إلى السابقة إن تأخر إطار (أجهزة بطيئة)
  function onScrollSettled() {
    if (!open) return; const p = pageFromScroll();
    if (animTarget != null) {
      if (p === animTarget || Date.now() - animSince > 1500) animTarget = null;
      else { clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollSettled, 120); return; }
    }
    if (p !== page) setPage(p, { fromScroll: true });
  }
  track.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollSettled, 120); }, { passive: true });
  track.addEventListener('scrollend', () => { clearTimeout(scrollTimer); onScrollSettled(); });

  /* ---------- ملء الصفحات (نافذة حول الصفحة الحالية) ---------- */
  function decorate(el) { el.classList.toggle('night', root.classList.contains('night')); if (hifz) el.classList.add('hifz'); }
  function fill(p) {
    if (p < 1 || p > TOTAL_PAGES || filled.has(p)) return;
    const slide = slideOf(p);
    if (textMode) {
      const el = renderTextPage(p, { full: true, tajweed: tajweedFn }); decorate(el); render(slide, el);
      filled.set(p, { el, text: true }); requestAnimationFrame(() => fitMushafPage(el));
      cb.onPageReady && cb.onPageReady(p, el); return;
    }
    const el = renderMushafPage(p, { full: true }); decorate(el);
    render(slide, el);
    const entry = { el, text: false }; filled.set(p, entry);
    mountMushafPage(el).catch(() => {
      if (filled.get(p) !== entry) return;
      const alt = renderTextPage(p, { full: true, tajweed: tajweedFn }); decorate(alt);
      render(slide, alt); entry.el = alt; entry.text = true;
      cb.onFallback && cb.onFallback(p);
    }).then(() => { if (filled.get(p) === entry) cb.onPageReady && cb.onPageReady(p, entry.el); });
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
    releasePageFonts([page - 3, page - 2, page - 1, page, page + 1, page + 2, page + 3]);
  }

  /* ---------- تغيير الصفحة ---------- */
  function setPage(p, { fromScroll = false } = {}) {
    page = p; refreshWindow(); updateChrome(); scheduleExitFade();
    cb.onPageChange && cb.onPageChange(p, { fromScroll });
  }
  function goto(p, { smooth = true } = {}) {
    p = Math.min(TOTAL_PAGES, Math.max(1, p));
    if (!open) { page = p; return; }
    if (p === page) { scrollToPage(p, 'instant'); return; }
    fill(p);
    const anim = smooth && Math.abs(p - page) <= 2; animTarget = anim ? p : null; animSince = Date.now();
    scrollToPage(p, anim ? 'smooth' : 'instant');
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
  let stripTimer = null;
  const centeredIn = (container, sel) => { const cx = container.getBoundingClientRect().left + container.clientWidth / 2; let best = null, bd = Infinity; for (const el of container.querySelectorAll(sel)) { const b = el.getBoundingClientRect(); const d = Math.abs(b.left + b.width / 2 - cx); if (d < bd) { bd = d; best = el; } } return best; };
  strip.addEventListener('pointerdown', () => { stripUser = true; }, { passive: true });
  strip.addEventListener('wheel', () => { stripUser = true; }, { passive: true });
  strip.addEventListener('scroll', () => { if (!stripUser) return; touchChrome(); clearTimeout(stripTimer); stripTimer = setTimeout(() => { const el = centeredIn(strip, '.mr-sname'); stripUser = false; if (el && +el.dataset.surah !== surahOfPage(page)) goto(surahInfo(+el.dataset.surah).page, { smooth: true }); }, 220); }, { passive: true });
  stars.addEventListener('pointerdown', () => { starUser = true; }, { passive: true });
  stars.addEventListener('scroll', () => { if (!starUser) return; touchChrome(); clearTimeout(stripTimer); stripTimer = setTimeout(() => { const el = centeredIn(stars, '.mr-star'); starUser = false; if (el && +el.dataset.juz !== pageLabel(page).juz) goto(JUZ_STARTS[+el.dataset.juz - 1].page, { smooth: true }); }, 220); }, { passive: true });

  /* ---------- اللمس: نقرة = الأدوات، نقرتان = التنقل، ضغطة مطوّلة = قائمة الآية ---------- */
  let press = null; let tapTimer = null; let lastTapAt = 0;
  track.addEventListener('contextmenu', (e) => e.preventDefault());
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (auto) stopAutoScroll(); // أي لمسة توقف التمرير التلقائي
    press = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, fired: false };
    press.timer = setTimeout(() => {
      if (!press || press.moved) return;
      const target = document.elementFromPoint(press.x, press.y); const w = target && target.closest && target.closest('.mw, .me');
      press.fired = true; if (w && cb.onLongPress) { vibrate(15); cb.onLongPress(+w.dataset.n, w); }
    }, 480);
  });
  const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
  const endPull = (close) => { if (!pull) return; stage.classList.remove('pulling'); stage.style.transform = ''; pullHint.classList.remove('on'); pull = null; if (close) cb.onIndex && cb.onIndex(); };
  track.addEventListener('pointermove', (e) => {
    if (press && !press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { press.moved = true; clearTimeout(press.timer); }
    if (!press) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!pull && !vertical && !hifz && e.pointerType !== 'mouse' && dy > 28 && Math.abs(dx) < dy * 0.6) { pull = { y: press.y }; stage.classList.add('pulling'); pullHint.classList.add('on'); }
    if (pull) { const d = Math.max(0, e.clientY - pull.y); stage.style.transform = `translateY(${Math.min(220, d * 0.55)}px)`; pullHint.textContent = d > 150 ? 'اترك للإغلاق' : 'اسحب لأسفل للإغلاق'; }
  }, { passive: true });
  track.addEventListener('pointercancel', () => { cancelPress(); endPull(false); });
  track.addEventListener('pointerup', (e) => {
    if (pull) { const d = e.clientY - pull.y; cancelPress(); endPull(d > 150); return; }
    if (!press) return; const pr = press; cancelPress();
    if (pr.moved || pr.fired) return; // الضغطة المطوّلة تُعلَّم fired؛ لا منطقة ميتة بين 400 و480 مللي ثانية
    const target = document.elementFromPoint(e.clientX, e.clientY); const w = target && target.closest && target.closest('.mw, .me');
    if (hifz) { if (cb.onTap && cb.onTap(w, e) === true) return; }
    const now = Date.now();
    if (now - lastTapAt < 300 && tapTimer) { // نقرة مزدوجة
      clearTimeout(tapTimer); tapTimer = null; lastTapAt = 0;
      setChrome(false); cb.onQuickNav && cb.onQuickNav();
      return;
    }
    lastTapAt = now;
    const wordN = w ? +w.dataset.n : null;
    const delay = e.pointerType === 'mouse' ? 0 : 280; // الفأرة لا تحتاج مهلة تمييز النقر المزدوج
    tapTimer = setTimeout(() => {
      tapTimer = null;
      // نقرة على كلمة = قائمة الآية (تفسير/استماع/…)؛ نقرة على الهامش = إظهار/إخفاء الأدوات
      if (wordN && cb.onAyahTap && cb.onAyahTap(wordN, w) === true) { setChrome(false); return; }
      if (!ayahBar.hidden) { setAyahBar(null); cb.onAyahBarClosed && cb.onAyahBarClosed(); return; }
      setChrome(!root.classList.contains('chrome'));
    }, delay);
  });
  track.addEventListener('pointercancel', cancelPress);
  track.addEventListener('scroll', () => { if (press) { press.moved = true; clearTimeout(press.timer); } }, { passive: true });

  /* ---------- أوضاع العرض ---------- */
  function setChrome(on) {
    root.classList.toggle('chrome', on);
    if (on && !ayahBar.hidden) { setAyahBar(null); cb.onAyahBarClosed && cb.onAyahBarClosed(); }
    clearTimeout(hideTimer); hideTimer = null;
    if (on) { hideTimer = setTimeout(() => { if (!hifz) setChrome(false); }, CHROME_AUTOHIDE_MS); if (hint && !hint.hidden) hint.hidden = true; }
  }
  function setAyahBar(el) { render(ayahBar, el); ayahBar.hidden = !el; }
  function touchChrome() { if (root.classList.contains('chrome')) { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!hifz) setChrome(false); }, CHROME_AUTOHIDE_MS); } }
  /** تطبيق سمة الصفحة (core/mushaf-themes.js) على جذر القارئ؛ persist يحفظها ويذكر آخر سمة فاتحة/داكنة للتبديل السريع */
  function setTheme(id, persist = false) {
    const t = themeById(id); themeId = t.id; const dark = isDarkTheme(t.id);
    for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
    root.dataset.theme = t.id; root.classList.toggle('night', dark); nightBtn.innerHTML = icon(dark ? 'sun' : 'moon');
    for (const e of filled.values()) e.el.classList.toggle('night', dark);
    if (persist) app.update({ quran: { theme: t.id, night: dark, ...(dark ? { themeDark: t.id } : { themeLight: t.id }) } });
  }
  /** تبديل سريع فاتح/داكن (زر القمر): آخر سمة داكنة أو فاتحة اختارها المستخدم */
  function setNight(on, persist = false) { const qs = app.settings.quran; setTheme(on ? (qs.themeDark || 'dark') : (qs.themeLight || 'cream'), persist); }
  function resolveTheme(qs) { return qs.themeAuto && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? (qs.themeDark || 'dark') : migrateTheme(qs); }
  const onScheme = () => { if (open && app.settings.quran.themeAuto) setTheme(resolveTheme(app.settings.quran)); };
  function setPaper() { /* قديم: استُبدل بالسمات */ }
  /** تعتيم الصفحة (0..0.7) للقراءة الليلية دون تغيير سطوع الجهاز */
  function setDim(v) { dimmer.style.opacity = String(Math.min(0.7, Math.max(0, Number(v) || 0))); }
  function setKeepAwake(on) { keepAwake = on !== false; if (!open) return; if (keepAwake) requestWakeLock(); else if (wakeLock) { try { wakeLock.release(); } catch { /* تجاهل */ } wakeLock = null; } }
  function setTextMode(on) { if (textMode === on) return; textMode = on; root.classList.toggle('text-mode', on); if (open) { for (const p of [...filled.keys()]) unfill(p); refreshWindow(); } }
  function setHifz(on) { hifz = on; root.classList.toggle('hifz', on); for (const e of filled.values()) e.el.classList.toggle('hifz', on); topBar.querySelector('.mr-hifz-btn').classList.toggle('active', on); if (on) setChrome(false); }
  function refreshBookmark() {
    const bms = app.settings.quran.bookmarks || []; const has = bms.some((b) => b.page === page);
    bmBtn.innerHTML = icon(has ? 'bookmarkFill' : 'bookmark'); bmBtn.classList.toggle('active', has);
  }
  let lastW = 0;
  /** إعادة ملاءمة الصفحات عند تغيّر الأبعاد؛ التمرير إلى الصفحة فقط إن تغيّر العرض (وإلا قطع حركةً جارية أو سحبةً بيد المستخدم) */
  function relayout({ scroll = false } = {}) { for (const e of filled.values()) fitMushafPage(e.el); const W = stage.clientWidth; if (page && (scroll || W !== lastW)) scrollToPage(page, 'instant'); lastW = W; }
  async function requestWakeLock() {
    if (!keepAwake) return;
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { wakeLock = null; }
  }
  const onVisibility = () => { if (open && document.visibilityState === 'visible' && !wakeLock) requestWakeLock(); };
  const onKey = (e) => {
    if (!open || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { goto(page + 1); e.preventDefault(); } else if (e.key === 'ArrowRight') { goto(page - 1); e.preventDefault(); }
    else if (e.key === 'Escape') { if (root.classList.contains('chrome')) setChrome(false); else cb.onIndex && cb.onIndex(); }
  };

  /* ---------- الفتح والإغلاق ---------- */
  function show(p, { showHint = false } = {}) {
    if (!root.isConnected) document.body.append(root);
    root.hidden = false; open = true; document.body.classList.add('mreader-open');
    const qs = app.settings.quran; keepAwake = qs.keepAwake !== false; setTheme(resolveTheme(qs)); setDim(qs.dim || 0); scheduleExitFade(); setChrome(false);
    root.classList.add('veil-ok'); autoSpeed = Math.max(10, Math.min(200, Number(qs.autoSpeed) || 40)); vertical = qs.scroll === 'vertical'; root.classList.toggle('vertical', vertical);
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onScheme); } catch { /* تجاهل */ } textMode = app.settings.quran.view === 'text'; root.classList.toggle('text-mode', textMode);
    ensureSurahNamesFont().then(() => root.classList.add('snames')).catch(() => {});
    if (!ro && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => relayout()); ro.observe(stage); }
    page = 0; fill(p); scrollToPage(p, 'instant'); setPage(p);
    hint.hidden = !showHint; if (showHint) setTimeout(() => { hint.hidden = true; }, 6000);
    requestWakeLock();
    document.addEventListener('visibilitychange', onVisibility); document.addEventListener('keydown', onKey);
  }
  function hide() {
    open = false; root.hidden = true; document.body.classList.remove('mreader-open'); root.classList.remove('chrome'); clearTimeout(hideTimer); setAyahBar(null);
    if (wakeLock) { try { wakeLock.release(); } catch {} wakeLock = null; }
    document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('keydown', onKey);
    try { matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', onScheme); } catch { /* تجاهل */ }
    clearTimeout(exitTimer); stopAutoScroll(); endPull(false);
    for (const p of [...filled.keys()]) unfill(p);
  }

  return {
    el: root, track,
    get page() { return page; }, get isOpen() { return open; }, get isNight() { return root.classList.contains('night'); }, get chromeShown() { return root.classList.contains('chrome'); },
    show, hide, goto, setChrome, setNight, setPaper, setTheme, setDim, setKeepAwake, setTextMode, setHifz, refreshBookmark, relayout, setAyahBar,
    get theme() { return themeId; }, get vertical() { return vertical; }, get autoscrolling() { return !!auto; },
    setVertical, startAutoScroll, stopAutoScroll, setAutoSpeed, setTajweed,
    get textMode() { return textMode; },
    setPanel(el) { render(panel, el); root.classList.toggle('has-panel', !!el); },
    pageEl(p) { const e = filled.get(p); return e ? e.el : null; },
    isTextPage(p) { const e = filled.get(p); return !!e && e.text; },
    mark(n, cls, on = true) { markAyah(track, n, cls, on); },
    clearMarks(cls) { clearMarks(track, cls); },
    /** تظليل كلمة واحدة (n: رقم الآية العام، k: فهرس الكلمة المنطوقة 0..) — تُزال السابقة */
    markWord(n, k) { const prev = track.querySelector('.mw.wl'); const el = k === null || k === undefined ? null : wordEl(track, n, k); if (prev === el) return; if (prev) prev.classList.remove('wl'); if (el) el.classList.add('wl'); },
  };
}
