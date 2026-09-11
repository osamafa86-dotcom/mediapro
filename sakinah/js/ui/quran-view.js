/**
 * شاشة المصحف: فهرس السور/الأجزاء/العلامات مع البحث، وقارئ غامر بصفحات مصحف المدينة بدقة الطباعة (js/ui/mushaf-reader.js)،
 * تلاوة آية بآية مع تظليل وتكرار ومتابعة بقلب الصفحات، حفظ موضع القراءة والعلامات،
 * ووضع مراجعة الحفظ (إخفاء الكلمات وكشف المنطوق منها عبر التعرّف على الصوت أو النقر).
 */
import { h, icon, render, openSheet, closeSheet, toast, copyText, shareText, vibrate, switchEl } from './components.js';
import { openShareCardSheet } from './share-sheet.js';
import { MUSHAF_THEMES, THEME_GROUPS } from '../core/mushaf-themes.js';
import { loadTajweed, tajweedSpans, isTajweedLoaded, TAJWEED_LEGEND } from '../core/tajweed.js';
import { CHALLENGES, challengeById, challengeProgress, resolveRange, heatmap, estimateMinutes } from '../core/challenges.js';
import { loadQuran, isLoaded, pageAyahs, surahAyahs, surahInfo, pageLabel, getAyah, getAyahBySurah, tokenize, HifzMatcher, searchText, refLabel, SURAHS, JUZ_STARTS, TOTAL_PAGES , hizbStartPage } from '../core/quran.js';
import { loadMushafLayout, isMushafLoaded, fontsBundled } from '../core/mushaf.js';
import { foldDigits, normalizeForMatch } from '../core/quran.js';
import { createMushafReader } from './mushaf-reader.js';
import { wordEl } from './mushaf-page.js';
import { downloadAllPageFonts, offlineFontsCount } from '../platform/mushaf-fonts.js';
import { TAFSIR_SOURCES, getTafsir, tafsirSource } from '../core/tafsir.js';
import { AyahPlayer, RECITERS, hasWordTiming, reciterInfo } from '../platform/audio.js';
import { downloadSurah, deleteSurah, makeLocalResolver, fmtBytes, storedBytes } from '../platform/downloads.js';
import { makePlan, planStatus, streak, logPage, stats as readStats } from '../core/khatmah.js';
import { isNative } from '../platform/native.js';
import * as nativeNotif from '../platform/native-notifications.js';
import { SpeechListener, isSpeechSupported } from '../platform/speech.js';

const player = new AyahPlayer();

export function mount(container, app) {
  let indexTab = 'surahs'; let query = ''; let focusSearch = false;
  let playingAyah = null; let hifz = null; let speech = null; let saveTimer = null; let selected = null;
  const q = () => app.settings.quran;
  player.words = q().wordHighlight !== false;
  player.localResolver = makeLocalResolver(() => player.reciter);
  const saveQ = (patch) => app.update({ quran: patch });
  const page = () => reader.page;
  /** مطابقة اسم سورة بتطبيع موحّد (همزات، تاء مربوطة، ألف مقصورة) أو بالاسم الإنجليزي */
  const surahKey = (s) => normalizeForMatch(String(s || '').replace(/^سورة\s+/, ''));
  function matchSurahs(s) { const k = surahKey(s); if (!k) return []; const lk = s.toLowerCase(); return SURAHS.filter((x) => surahKey(x.name).includes(k) || surahKey(x.plain).includes(k) || x.en.toLowerCase().includes(lk)); }
  /** «الكهف 10»، «2:255»، «2 255»، «سورة البقرة آية 255» → {surah, ayah}؛ رقم وحده → صفحة يعالجها المستدعي */
  function parseRef(s) {
    const t = foldDigits(s).trim();
    let m = t.match(/^(\d{1,3})\s*[:\s]\s*(\d{1,3})$/);
    if (m) { const su = SURAHS[+m[1] - 1]; return su ? { surah: su, ayah: Math.max(1, +m[2]) } : null; }
    m = t.match(/^(.+?)\s*(?:[:\s]|آية|اية)\s*(\d{1,3})$/);
    if (m) { const hits = matchSurahs(m[1]); const exact = hits.find((x) => surahKey(x.name) === surahKey(m[1])) || (hits.length === 1 ? hits[0] : null); return exact ? { surah: exact, ayah: Math.max(1, +m[2]) } : null; }
    return null;
  }

  /* ---------- القارئ ---------- */
  const reader = createMushafReader(app, {
    onIndex: () => closeReader(),
    onSearch: () => { focusSearch = true; closeReader(); },
    onQuickNav: () => quickNav(),
    onAyahTap: (n) => { selectAyah(n); return true; },
    onAyahBarClosed: () => clearSelection(),
    onOptions: () => readerOptions(),
    onDisplay: () => displaySheet(),
    onHifzToggle: () => (hifz ? exitHifz() : startHifz(pageAyahs(page())[0].n)),
    onVeilToggle: () => (hifz ? exitHifz() : startVeil()),
    onBookmark: (p) => toggleBookmark((hifz ? null : selectedOnPage(p)) || pageAyahs(p)[0].n),
    onPageChange: (p, { fromScroll }) => { trackDwell(p); if (hifz && p !== hifz.page) { exitHifz(); toast('انتهت مراجعة الحفظ بتغيير الصفحة', 2500); } if (selected && getAyah(selected).page !== p) clearSelection(); scheduleSaveLastRead(); syncUrl(p); if (fromScroll) vibrate(6); },
    onTap: (w) => { if (hifz) { onHifzTap(); return true; } return false; },
    onLongPress: (n) => { selectAyah(n); ayahActions(getAyah(n)); },
    onPageReady: (p) => { if (playingAyah) reader.mark(playingAyah, 'hl'); if (hifz && hifz.page === p) applyHifzToPage(); },
    onInterim: () => { if (interimHinted || fontsBundled() || q().fontsOffline) return; interimHinted = true; setTimeout(() => { if (reader.isOpen) toast('يظهر النص فورًا بخط بديل ريثما يصل خط الصفحة. لعرض المصحف فورًا دائمًا ودون اتصال: الخيارات ← تنزيل خطوط الصفحات', 6000); }, 1500); },
    onFallback: (p) => { if (!fallbackWarned) { fallbackWarned = true; toast('تعذّر تحميل خط الصفحة — عُرض النص بخط بديل. تتوفر الخطوط عند الاتصال بالإنترنت أو بعد تنزيلها من الخيارات.', 5000); } },
  });
  app.quranReader = reader; // للاختبارات والتشخيص
  let fallbackWarned = false; let interimHinted = false;
  function selectedOnPage(p) { return selected && getAyah(selected).page === p ? selected : null; }
  /* ---------- تحديد آية وشريط خياراتها ---------- */
  function selectAyah(n) {
    selected = n; reader.clearMarks('sel'); reader.mark(n, 'sel');
    const a = getAyah(n);
    const act = (name, label, on, cls = '') => h('button', { class: cls, onclick: (e) => { e.stopPropagation(); on(); } }, h('span', { html: icon(name) }), label);
    reader.setAyahBar(h('div', { class: 'ayahbar' },
      h('div', { class: 'ab-head' }, h('b', {}, refLabel(a)), h('button', { class: 'icon-btn', 'aria-label': 'إغلاق', onclick: () => clearSelection() }, h('span', { html: icon('close') }))),
      h('div', { class: 'ab-actions' },
        act('book', 'تفسير', () => openTafsir(a)),
        act('play', 'استماع', () => openListen(a)),
        act('repeat', 'تكرار', () => { player.repeatAyah = 3; saveQ({ repeatAyah: 3 }); playFrom(a.n, 'single'); }),
        act('bookmark', isBookmarked(n) ? 'إزالة' : 'علامة', () => { toggleBookmark(n); selectAyah(n); }, isBookmarked(n) ? 'on' : ''),
        act('share', 'مشاركة', () => shareText('آية من القرآن الكريم', `${a.text} ﴿${a.ayah}﴾\n[${refLabel(a)}]`)),
        act('more', 'المزيد', () => ayahActions(a)))));
  }
  function clearSelection() { selected = null; reader.clearMarks('sel'); reader.setAyahBar(null); }

  /* ---------- التفسير ---------- */
  function openTafsir(a) {
    let src = q().tafsir || 'muyassar'; let cur = a; let token = 0;
    const ayahEl = h('div', { class: 'tafsir-ayah' }); const body = h('div', { class: 'tafsir-body' }); const foot = h('div', { class: 'tafsir-foot' }); const title = h('span', {});
    const chips = h('div', { class: 'tafsir-src' });
    const drawChips = () => render(chips, ...TAFSIR_SOURCES.map((t) => h('button', { class: `chip chip-btn ${t.id === src ? 'active' : ''}`, onclick: () => { src = t.id; saveQ({ tafsir: src }); drawChips(); load(); } }, t.short + (t.offline ? '' : ' ↓'))));
    const load = async () => {
      const my = ++token; render(ayahEl, `${cur.text} ﴿${app.num(cur.ayah)}﴾`); title.textContent = `تفسير ${refLabel(cur)}`; document.getElementById('sheet-title').textContent = title.textContent;
      render(body, h('div', { class: 'row', style: { justifyContent: 'center', padding: '20px' } }, h('span', { class: 'spinner' }), h('span', { class: 'tiny' }, ' جارٍ التحميل…')));
      try {
        const r = await getTafsir(src, cur.surah, cur.ayah);
        if (my !== token) return;
        body.innerHTML = r.html; render(foot, `${r.range ? `تفسير الآيات ${app.num(r.range.from)}–${app.num(r.range.to)} معًا · ` : ''}${r.source.name} — ${r.source.by}${r.offline ? ' · محفوظ على الجهاز' : ' · عبر quran.com'}`);
      } catch (e) {
        if (my !== token) return;
        render(body, h('div', { class: 'notice' }, h('span', { html: icon('warning') }), tafsirSource(src).offline ? 'تعذّر قراءة التفسير. أعد المحاولة.' : 'هذا التفسير يحتاج اتصالًا بالإنترنت أول مرة، ثم يُحفظ على الجهاز. التفسير الميسر متاح دون اتصال.'));
        render(foot);
      }
    };
    const step = (d) => { const nx = getAyah(cur.n + d); if (!nx) return; cur = nx; selectAyah(nx.n); if (nx.page !== page()) reader.goto(nx.page, { smooth: false }); load(); document.getElementById('sheet-body').scrollTop = 0; };
    openSheet({ title: `تفسير ${refLabel(cur)}`, content: h('div', { class: 'stack' }, chips, ayahEl, body, foot,
      h('div', { class: 'tafsir-nav' },
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => step(-1) }, '‹ الآية السابقة'),
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => { closeSheet(); playFrom(cur.n, 'single'); } }, h('span', { html: icon('play') }), ' استماع'),
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => step(1) }, 'الآية التالية ›'))) });
    drawChips(); load();
  }

  /* ---------- الاستماع: القارئ والمدى والتكرار ---------- */
  function openListen(a) {
    let scope = 'surah'; let repeat = q().repeatAyah || 1; let reciter = q().reciter;
    const list = h('div', { class: 'listen-reciters' });
    const drawList = () => render(list, ...RECITERS.map((r) => h('button', { class: `surah-row ${r.id === reciter ? 'on' : ''}`, onclick: () => { reciter = r.id; saveQ({ reciter }); drawList(); } },
      h('span', { class: 'num', html: icon(r.id === reciter ? 'check' : 'mic') }), h('span', {}, h('div', { class: 'nm' }, r.name), r.qdc ? h('div', { class: 'info' }, 'تظليل كلمة بكلمة' + ((q().downloads || {})[r.id] && Object.keys(q().downloads[r.id]).length ? ' · محفوظ جزئيًا' : '')) : null))));
    const seg = (opts, get, set) => { const el = h('div', { class: 'segmented' }); const draw = () => render(el, ...opts.map(([k, l]) => h('button', { class: get() === k ? 'active' : '', onclick: () => { set(k); draw(); } }, l))); draw(); return el; };
    openSheet({ title: `الاستماع — ${refLabel(a)}`, content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'المدى'), seg([['single', 'هذه الآية'], ['surah', 'من هنا حتى نهاية السورة'], ['page', 'الصفحة']], () => scope, (v) => { scope = v; })),
      h('div', { class: 'field' }, h('label', {}, 'تكرار كل آية'), seg([[1, '×1'], [2, '×2'], [3, '×3'], [5, '×5'], [10, '×10']], () => repeat, (v) => { repeat = v; saveQ({ repeatAyah: v }); })),
      h('div', { class: 'field' }, h('label', {}, 'القارئ'), list),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'تظليل الكلمة أثناء التلاوة'), h('div', { class: 'desc' }, 'للقرّاء الذين تتوفر توقيتات كلماتهم (مصدر quran.com)')), switchEl(q().wordHighlight !== false, (v) => { saveQ({ wordHighlight: v }); player.setWords(v); })),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn btn-primary', style: { flex: 1 }, onclick: () => { closeSheet(); player.repeatAyah = repeat; player.setReciter(reciter); playFrom(a.n, scope); } }, h('span', { html: icon('play') }), ' تشغيل'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); openDownloads(reciter, a.surah); } }, h('span', { html: icon('download') }), ' دون اتصال'))) });
    drawList();
  }
  function syncUrl(p) { const target = `#/quran?p=${p}`; if (location.hash !== target) history.replaceState(null, '', target); }
  async function openReader(p, ayah = null) {
    if (!(isLoaded() && isMushafLoaded()) && !(await ensureLoaded())) return;
    hifz = null; stopSpeech();
    if (!reader.isOpen) { if (!/^#\/quran\?p=/.test(location.hash)) history.pushState(null, '', `#/quran?p=${p}`); const showHint = !q().hintShown; reader.show(p, { showHint }); if (showHint) saveQ({ hintShown: true }); if (q().tajweed) applyTajweed(true); }
    else reader.goto(p, { smooth: false });
    if (ayah) setTimeout(() => flashAyah(ayah.n), 400);
    saveLastRead(ayah);
  }
  function closeReader() {
    if (!reader.isOpen) return;
    stopSpeech(); hifz = null; selected = null; reader.setHifz(false); reader.setPanel(null); reader.hide();
    if (/^#\/quran\?p=/.test(location.hash)) history.replaceState(null, '', '#/quran');
    indexScreen();
  }
  window.addEventListener('popstate', () => { if (reader.isOpen && !/^#\/quran\?p=/.test(location.hash)) { stopSpeech(); hifz = null; reader.setHifz(false); reader.setPanel(null); reader.hide(); if (app.current === 'quran') indexScreen(); } });
  function flashAyah(n) { reader.mark(n, 'sel'); setTimeout(() => reader.mark(n, 'sel', false), 1600); }
  function saveLastRead(ayah) {
    const a = ayah || (reader.isOpen ? pageAyahs(page())[0] : null); if (!a) return;
    saveQ({ lastRead: { page: a.page, surah: a.surah, ayah: a.ayah, at: Date.now() } });
  }
  function scheduleSaveLastRead() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveLastRead(null), 900); }
  function isBookmarked(n) { const a = getAyah(n); return (q().bookmarks || []).some((b) => b.surah === a.surah && b.ayah === a.ayah); }
  function toggleBookmark(n) {
    const a = getAyah(n); const bms = q().bookmarks || [];
    if (isBookmarked(n)) { saveQ({ bookmarks: bms.filter((b) => !(b.surah === a.surah && b.ayah === a.ayah)) }); toast('أُزيلت العلامة'); }
    else { saveQ({ bookmarks: [...bms, { surah: a.surah, ayah: a.ayah, page: a.page, at: Date.now() }] }); toast(`أُضيفت علامة عند ${refLabel(a)}`); vibrate(10); }
    reader.refreshBookmark();
  }

  /* ---------- تحميل ---------- */
  async function ensureLoaded() {
    if (isLoaded() && isMushafLoaded()) return true;
    render(container, h('div', { class: 'card', style: { textAlign: 'center', padding: '40px 16px' } }, h('span', { class: 'spinner' }), h('p', { class: 'muted', style: { marginTop: '10px' } }, 'جارٍ تحميل المصحف…')));
    try { await Promise.all([loadQuran(), loadMushafLayout()]); return true; }
    catch (e) { render(container, h('div', { class: 'card' }, h('div', { class: 'notice danger' }, h('span', { html: icon('warning') }), 'تعذّر تحميل بيانات المصحف. يلزم اتصال بالإنترنت لأول مرة فقط.'), h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '10px' }, onclick: build }, 'إعادة المحاولة'))); return false; }
  }

  /* ---------- الفهرس ---------- */
  function indexScreen() {
    if (!isLoaded()) loadQuran().then(() => { if (!reader.isOpen && app.current === 'quran') indexScreen(); }).catch(() => {}); // تُكمل البطاقات (الجزء…) بعد وصول البيانات
    const last = q().lastRead;
    const input = h('input', { class: 'input', type: 'search', placeholder: 'ابحث عن سورة أو آية أو رقم صفحة…', value: query });
    let debounce = null;
    input.addEventListener('input', () => { query = input.value; clearTimeout(debounce); debounce = setTimeout(async () => { if (query.trim().length >= 2 && !(isLoaded() && isMushafLoaded())) { await Promise.all([loadQuran(), loadMushafLayout()]).catch(() => {}); } drawList(); }, 120); });
    const listEl = h('div', {});
    const drawList = () => {
      const s = foldDigits(query.trim());
      const ref = parseRef(s);
      if (ref && ref.surah) { const a = getAyahBySurah(ref.surah.n, Math.min(ref.surah.ayahs, ref.ayah)); render(listEl, a ? h('button', { class: 'surah-row', onclick: () => openReader(a.page, a) }, h('span', { class: 'num' }, app.num(ref.surah.n)), h('span', {}, h('div', { class: 'nm' }, `سورة ${ref.surah.name} — الآية ${app.num(a.ayah)}`), h('div', { class: 'info' }, `الصفحة ${app.num(a.page)}`))) : h('div', { class: 'empty' }, isLoaded() ? 'لا نتائج' : 'جارٍ تحميل المصحف…')); return; }
      if (s.length >= 2 && !/^\d+$/.test(s)) {
        const surahHits = matchSurahs(s);
        const ayahHits = isLoaded() ? searchText(s, 30) : [];
        render(listEl,
          surahHits.map(surahRow),
          ayahHits.length ? h('div', { class: 'tiny', style: { margin: '10px 4px 4px' } }, `آيات (${app.num(ayahHits.length)}${ayahHits.length === 30 ? '+' : ''})`) : null,
          ayahHits.map((a) => h('button', { class: 'surah-row', onclick: () => openReader(a.page, a) },
            h('span', {}, h('div', { class: 'nm', style: { fontFamily: 'var(--font-text)', fontSize: '15px' } }, a.text.length > 90 ? a.text.slice(0, 90) + '…' : a.text), h('div', { class: 'info' }, refLabel(a))), h('span', { class: 'pg' }, `ص ${app.num(a.page)}`))),
          !surahHits.length && !ayahHits.length ? h('div', { class: 'empty' }, 'لا نتائج') : null);
        return;
      }
      if (/^\d+$/.test(s)) { const n = +s; if (n >= 1 && n <= TOTAL_PAGES) { render(listEl, h('button', { class: 'btn btn-outline btn-block', onclick: () => openReader(n) }, `الانتقال إلى الصفحة ${app.num(n)}`)); return; } }
      if (indexTab === 'surahs') render(listEl, SURAHS.map(surahRow));
      else if (indexTab === 'juz') render(listEl, JUZ_STARTS.map((j) => h('button', { class: 'surah-row', onclick: () => openReader(j.page) },
        h('span', { class: 'num' }, app.num(j.juz)), h('span', {}, h('div', { class: 'nm' }, `الجزء ${app.num(j.juz)}`), h('div', { class: 'info' }, `يبدأ من ${surahInfo(j.surah).name}: ${app.num(j.ayah)}`)), h('span', { class: 'pg' }, `ص ${app.num(j.page)}`))));
      else {
        const bms = q().bookmarks || [];
        render(listEl, bms.length ? bms.slice().reverse().map((b) => h('button', { class: 'surah-row', onclick: () => openReader(b.page, getAyahBySurah(b.surah, b.ayah)) },
          h('span', { class: 'num', html: icon('bookmarkFill'), style: { color: b.color === 'green' ? 'var(--ok)' : b.color === 'red' ? 'var(--danger)' : b.color === 'blue' ? '#2563eb' : 'var(--gold)' } }),
          h('span', {}, h('div', { class: 'nm' }, `${surahInfo(b.surah).name}: ${app.num(b.ayah)}`), b.note ? h('div', { class: 'bm-note' }, b.note) : h('div', { class: 'info' }, new Date(b.at).toLocaleDateString('ar', { day: 'numeric', month: 'long' }))),
          h('span', { class: 'pg' }, `ص ${app.num(b.page)}`),
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'تعديل الملاحظة', onclick: (e) => { e.stopPropagation(); const a = getAyahBySurah(b.surah, b.ayah); if (a) bookmarkSheet(a, () => drawList()); } }, h('span', { html: icon('edit') })),
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'حذف', onclick: (e) => { e.stopPropagation(); saveQ({ bookmarks: bms.filter((x) => !(x.surah === b.surah && x.ayah === b.ayah)) }); drawList(); } }, h('span', { html: icon('close') }))))
          : h('div', { class: 'empty' }, 'لا علامات بعد — اضغط زر العلامة في القارئ أو اضغط مطوّلًا على آية'));
      }
    };
    render(container,
      last ? h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'متابعة القراءة'), h('b', {}, `${surahInfo(last.surah).name} · آية ${app.num(last.ayah)}`), h('small', {}, `الصفحة ${app.num(last.page)}${isLoaded() ? ` · الجزء ${app.num(pageLabel(last.page).juz)}` : ''}`)),
        h('button', { class: 'btn btn-sm', onclick: () => openReader(last.page, getAyahBySurah(last.surah, last.ayah)) }, h('span', { html: icon('play') }), ' متابعة'))
        : h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'ابدأ القراءة'), h('b', {}, 'المصحف الشريف'), h('small', {}, 'مصحف المدينة النبوية · حفص عن عاصم · 604 صفحات')), h('button', { class: 'btn btn-sm', onclick: () => openReader(1) }, 'فتح')),
      khatmahCard(),
      readingCard(),
      h('div', { class: 'search' }, input, h('span', { html: icon('search') })),
      h('div', { class: 'segmented', style: { marginBottom: '10px' } },
        ...[['surahs', 'السور'], ['juz', 'الأجزاء'], ['bookmarks', 'العلامات']].map(([k, l]) => h('button', { class: indexTab === k ? 'active' : '', onclick: () => { indexTab = k; drawList(); container.querySelectorAll('.segmented button').forEach((b) => b.classList.toggle('active', b.textContent === l)); } }, l))),
      h('div', { class: 'card', style: { padding: '4px 10px' } }, listEl));
    drawList();
    if (focusSearch) { focusSearch = false; setTimeout(() => input.focus(), 50); }
  }
  const surahRow = (s) => h('button', { class: 'surah-row', onclick: () => openReader(s.page, getAyahBySurah(s.n, 1)) },
    h('span', { class: 'num' }, app.num(s.n)), h('span', {}, h('div', { class: 'nm' }, `سورة ${s.name}`), h('div', { class: 'info' }, `${s.type} · ${app.num(s.ayahs)} آية`)), h('span', { class: 'pg' }, `ص ${app.num(s.page)}`));

  /* ---------- قائمة الآية (ضغطة مطوّلة) ---------- */
  function ayahActions(a) {
    reader.clearMarks('sel'); reader.mark(a.n, 'sel');
    const txt = `${a.text} ﴿${a.ayah}﴾\n[${refLabel(a)}]`;
    openSheet({ title: refLabel(a), content: h('div', { class: 'stack' },
      h('p', { class: 'matn', style: { fontFamily: "'Amiri Quran', Amiri, serif", fontSize: '19px', lineHeight: '2.1' } }, a.text),
      h('div', { class: 'grid-2' },
        h('button', { class: 'btn btn-primary', onclick: () => { closeSheet(); openTafsir(a); } }, h('span', { html: icon('book') }), ' التفسير'),
        h('button', { class: 'btn btn-primary', onclick: () => { closeSheet(); openListen(a); } }, h('span', { html: icon('mic') }), ' استماع (اختيار القارئ)'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); playFrom(a.n, 'surah'); } }, h('span', { html: icon('play') }), ' تشغيل من هنا'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); player.repeatAyah = 3; saveQ({ repeatAyah: 3 }); playFrom(a.n, 'single'); } }, h('span', { html: icon('repeat') }), ' تكرار الآية ×3'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); bookmarkSheet(a); } }, h('span', { html: icon(isBookmarked(a.n) ? 'bookmarkFill' : 'bookmark') }), isBookmarked(a.n) ? ' تعديل العلامة' : ' علامة مع ملاحظة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); saveLastRead(a); toast(`حُفظ موضع القراءة عند ${refLabel(a)}`); } }, h('span', { html: icon('check') }), ' موضع القراءة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); startHifz(a.n); } }, h('span', { html: icon('eyeOff') }), ' مراجعة الحفظ من هنا'),
        h('button', { class: 'btn btn-outline', onclick: () => shareText('آية من القرآن الكريم', txt) }, h('span', { html: icon('share') }), ' مشاركة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); openShareCardSheet({ title: `القرآن الكريم · ${refLabel(a)}`, text: `${a.text} ﴿${a.ayah}﴾`, footer: refLabel(a), quran: true, filename: `ayah-${a.surah}-${a.ayah}.png`, shareText: txt }); } }, h('span', { html: icon('image') }), ' مشاركة كصورة'),
        h('button', { class: 'btn btn-outline', onclick: () => copyText(txt) }, h('span', { html: icon('copy') }), ' نسخ'))),
      onClose: () => { if (selected !== a.n) reader.clearMarks('sel'); } });
  }

  /* ---------- التنقل والبحث (نقرة مزدوجة أو زر البحث) ---------- */
  function quickNav() {
    const input = h('input', { class: 'input', type: 'search', placeholder: 'سورة، آية، نص، أو رقم صفحة…', autocomplete: 'off' });
    const results = h('div', { class: 'city-list' });
    const go = (p, ayah) => { closeSheet(); reader.goto(p, { smooth: false }); if (ayah) setTimeout(() => flashAyah(ayah.n), 350); saveLastRead(ayah || null); };
    const draw = () => {
      const s = foldDigits(input.value.trim());
      if (!s) { render(results, h('div', { class: 'chips', style: { padding: '6px 0' } }, ...JUZ_STARTS.map((j) => h('button', { class: `chip chip-btn ${pageLabel(page()).juz === j.juz ? 'active' : ''}`, onclick: () => go(j.page) }, `جزء ${app.num(j.juz)}`)))); return; }
      if (/^\d+$/.test(s)) { const n = +s; render(results, n >= 1 && n <= TOTAL_PAGES ? h('button', { class: 'surah-row', onclick: () => go(n) }, h('span', { class: 'num' }, app.num(n)), h('span', {}, h('div', { class: 'nm' }, `الصفحة ${app.num(n)}`), h('div', { class: 'info' }, `${surahInfo(pageAyahs(n)[0].surah).name} · الجزء ${app.num(pageLabel(n).juz)}`))) : h('div', { class: 'empty' }, 'رقم الصفحة بين 1 و604')); return; }
      const ref = parseRef(s); // «البقرة 255» أو «2:255» أو «٢ ٢٥٥»
      const m = ref && ref.surah ? [null, ref.surah.name, String(ref.ayah)] : null;
      const surahHits = m ? [ref.surah] : matchSurahs(s).slice(0, 8);
      const ayahHits = m ? [] : searchText(s, 20);
      render(results,
        surahHits.map((x) => { const a = m ? getAyahBySurah(x.n, Math.min(x.ayahs, +m[2])) : getAyahBySurah(x.n, 1); return h('button', { class: 'surah-row', onclick: () => go(a.page, a) }, h('span', { class: 'num' }, app.num(x.n)), h('span', {}, h('div', { class: 'nm' }, `سورة ${x.name}${m ? ` · آية ${app.num(a.ayah)}` : ''}`), h('div', { class: 'info' }, `${x.type} · ${app.num(x.ayahs)} آية`)), h('span', { class: 'pg' }, `ص ${app.num(a.page)}`)); }),
        ayahHits.length ? h('div', { class: 'tiny', style: { margin: '8px 4px 2px' } }, 'آيات') : null,
        ayahHits.map((a) => h('button', { class: 'surah-row', onclick: () => go(a.page, a) }, h('span', {}, h('div', { class: 'nm', style: { fontFamily: "'Amiri Quran', Amiri, serif", fontSize: '16px', fontWeight: 400 } }, a.text.length > 80 ? a.text.slice(0, 80) + '…' : a.text), h('div', { class: 'info' }, refLabel(a))), h('span', { class: 'pg' }, `ص ${app.num(a.page)}`))),
        !surahHits.length && !ayahHits.length ? h('div', { class: 'empty' }, 'لا نتائج') : null);
    };
    let navDebounce = null; input.addEventListener('input', () => { clearTimeout(navDebounce); navDebounce = setTimeout(draw, 120); });
    const pageIn = h('input', { class: 'input ltr', type: 'number', min: 1, max: TOTAL_PAGES, value: page(), 'aria-label': 'رقم الصفحة', style: { width: '90px' } });
    const pageRange = h('input', { class: 'range', type: 'range', min: 1, max: TOTAL_PAGES, value: page(), 'aria-label': 'شريط الصفحات' });
    const pageInfo = h('div', { class: 'tiny' });
    const describePage = (n) => { const a = pageAyahs(n)[0]; return a ? `${surahInfo(a.surah).name} · الجزء ${app.num(pageLabel(n).juz)} · الحزب ${app.num(pageLabel(n).hizb)}` : ''; };
    const syncPage = (n) => { n = Math.min(TOTAL_PAGES, Math.max(1, +n || 1)); pageIn.value = n; pageRange.value = n; pageInfo.textContent = `الصفحة ${app.num(n)} — ${describePage(n)}`; };
    pageIn.addEventListener('input', () => syncPage(pageIn.value)); pageRange.addEventListener('input', () => syncPage(pageRange.value)); syncPage(page());
    const cur = pageLabel(page());
    const searchPane = h('div', { class: 'stack' }, h('div', { class: 'search', style: { marginBottom: 0 } }, input, h('span', { html: icon('search') })), results);
    const juzPane = h('div', { class: 'goto-list city-list' }, ...JUZ_STARTS.map((j) => h('button', { class: `surah-row ${cur.juz === j.juz ? 'cur' : ''}`, onclick: () => go(j.page) }, h('span', { class: 'num' }, app.num(j.juz)), h('span', {}, h('div', { class: 'nm' }, `الجزء ${app.num(j.juz)}`), h('div', { class: 'info' }, `${surahInfo(j.surah).name} · آية ${app.num(j.ayah)}`)), h('span', { class: 'pg' }, `ص ${app.num(j.page)}`))));
    const hizbPane = h('div', { class: 'goto-list city-list' }, ...Array.from({ length: 60 }, (_, i) => i + 1).map((hz) => { const p = hizbStartPage(hz); return h('button', { class: `surah-row ${cur.hizb === hz ? 'cur' : ''}`, onclick: () => go(p) }, h('span', { class: 'num' }, app.num(hz)), h('span', {}, h('div', { class: 'nm' }, `الحزب ${app.num(hz)}`), h('div', { class: 'info' }, `الجزء ${app.num(Math.ceil(hz / 2))} · ${surahInfo(pageAyahs(p)[0].surah).name}`)), h('span', { class: 'pg' }, `ص ${app.num(p)}`)); }));
    const pagePane = h('div', { class: 'stack' }, h('div', { class: 'goto-page' }, pageIn, h('button', { class: 'btn btn-primary btn-sm', onclick: () => go(+pageIn.value) }, 'انتقال')), pageRange, pageInfo);
    const panes = { search: searchPane, juz: juzPane, hizb: hizbPane, page: pagePane };
    let navTab = 'search'; const paneHost = h('div', {});
    const tabs = h('div', { class: 'segmented goto-tabs' }, ...[['search', 'بحث وسور'], ['juz', 'الأجزاء'], ['hizb', 'الأحزاب'], ['page', 'صفحة']].map(([k, l]) => h('button', { class: k === navTab ? 'active' : '', onclick: (e) => { navTab = k; [...tabs.children].forEach((b) => b.classList.toggle('active', b === e.currentTarget)); render(paneHost, panes[k]); if (k !== 'search') { const c = panes[k].querySelector('.surah-row.cur'); if (c) c.scrollIntoView({ block: 'center' }); } } }, l)));
    render(paneHost, searchPane);
    openSheet({ title: 'التنقل والبحث', content: h('div', { class: 'stack' }, tabs, paneHost,
      h('div', { class: 'row' }, h('span', { style: { flex: 1 } }), h('button', { class: 'btn btn-soft btn-sm', onclick: () => { closeSheet(); closeReader(); } }, h('span', { html: icon('list') }), ' الفهرس'))) });
    draw(); setTimeout(() => input.focus(), 80);
  }

  /* ---------- خيارات القارئ ---------- */
  function readerOptions() {
    const s = q();
    const jump = (surah, ayah) => { const a = getAyahBySurah(surah, ayah) || getAyahBySurah(surah, 1); closeSheet(); openReader(a.page, a); };
    const surahSel = h('select', { class: 'input' }, ...SURAHS.map((x) => h('option', { value: x.n, selected: x.n === pageAyahs(page())[0].surah }, `${x.n}. ${x.name}`)));
    const ayahIn = h('input', { class: 'input ltr', type: 'number', min: 1, value: 1, placeholder: 'آية' });
    const pageIn = h('input', { class: 'input ltr', type: 'number', min: 1, max: TOTAL_PAGES, value: page(), 'aria-label': 'رقم الصفحة' });
    const fontsRow = h('div', {});
    const drawFonts = async () => {
      const n = await offlineFontsCount();
      render(fontsRow, h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'خطوط الصفحات دون اتصال'), h('div', { class: 'desc' }, n >= TOTAL_PAGES ? 'كل الصفحات محفوظة على الجهاز ✓' : `${app.num(n)} / ${app.num(TOTAL_PAGES)} صفحة محفوظة · الحجم الكلي ≈ ٣٥ م.ب`)),
        n >= TOTAL_PAGES ? null : h('button', { class: 'btn btn-outline btn-sm', onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { await downloadAllPageFonts((done, total) => { b.textContent = `${app.num(Math.round(done / total * 100))}٪`; }); toast('اكتمل تنزيل خطوط المصحف — يعمل المصحف الآن دون اتصال'); saveQ({ fontsOffline: true }); }
          catch { toast('تعذّر إكمال التنزيل — تحقق من الاتصال ثم أعد المحاولة', 4000); }
          drawFonts();
        } }, h('span', { html: icon('download') }), ' تنزيل')));
    };
    drawFonts();
    openSheet({ title: 'خيارات المصحف', content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'الانتقال إلى سورة وآية'), h('div', { class: 'row' }, surahSel, ayahIn, h('button', { class: 'btn btn-primary btn-sm', onclick: () => jump(+surahSel.value, +ayahIn.value || 1) }, 'انتقال'))),
      h('div', { class: 'field' }, h('label', {}, 'الانتقال إلى صفحة'), h('div', { class: 'row' }, pageIn, h('button', { class: 'btn btn-outline btn-sm', onclick: () => { closeSheet(); reader.goto(Math.min(TOTAL_PAGES, Math.max(1, +pageIn.value || 1)), { smooth: false }); } }, 'انتقال'))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'تشغيل تلاوة الصفحة'), h('div', { class: 'desc' }, 'من أول آية في الصفحة الحالية')), h('button', { class: 'btn btn-soft btn-sm', onclick: () => { closeSheet(); playFrom(pageAyahs(page())[0].n, 'page'); } }, h('span', { html: icon('play') }), ' تشغيل')),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'العرض والألوان'), h('div', { class: 'desc' }, 'لون الصفحة (كريمي، أبيض، سكري، تدرّجات، داكن)، التعتيم، حجم الخط وطريقة العرض')), h('button', { class: 'btn btn-soft btn-sm', onclick: () => { closeSheet(); displaySheet(); } }, h('span', { html: icon('sun') }), ' فتح')),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'متابعة التلاوة بقلب الصفحات'), h('div', { class: 'desc' }, 'الانتقال تلقائيًا إلى صفحة الآية الجارية')), switchEl(s.follow, (v) => saveQ({ follow: v }))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'في المراجعة: إظهار الكلمة الحالية فقط'), h('div', { class: 'desc' }, 'الكلمات السابقة تبقى مخفية كما في تطبيقات الحفظ')), switchEl(s.hifzOnlyCurrent, (v) => { saveQ({ hifzOnlyCurrent: v }); const el = reader.pageEl(page()); if (el) el.classList.toggle('only-current', v); })),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'تظليل الكلمة أثناء التلاوة'), h('div', { class: 'desc' }, 'كلمةً كلمة مع القرّاء الذين تتوفر توقيتاتهم (يُستخدم مصدر quran.com)')), switchEl(s.wordHighlight !== false, (v) => { saveQ({ wordHighlight: v }); player.setWords(v); })),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'التلاوات دون اتصال'), h('div', { class: 'desc' }, 'تنزيل سور كاملة لقارئك المفضّل لسماعها بلا إنترنت')), h('button', { class: 'btn btn-outline btn-sm', onclick: () => { closeSheet(); openDownloads(q().reciter, pageAyahs(page())[0].surah); } }, h('span', { html: icon('download') }), ' إدارة')),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'خطة الختمة'), h('div', { class: 'desc' }, q().khatmah ? `${app.num(q().khatmah.dailyPages)} صفحات يوميًا` : 'هدف يومي وتذكير ومتابعة التقدّم')), h('button', { class: 'btn btn-outline btn-sm', onclick: () => { closeSheet(); khatmahSheet(); } }, q().khatmah ? 'تعديل' : 'إنشاء')),
      fontsRow,
      h('p', { class: 'tiny' }, 'الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر. النص: Tanzil. التلاوات: Islamic Network. انقر الصفحة لإظهار الأدوات، وانقر مرتين للتنقل والبحث، واضغط مطوّلًا على آية لقائمتها.')) });
  }

  function applyTextFont() { const f = (q().textFont || 'amiri') === 'hafs' ? 'hafs' : 'amiri'; document.documentElement.style.setProperty('--quran-font', f === 'hafs' ? "'KFGQPC Hafs'" : "'Amiri Quran'"); reader.setTextFont(f); }
  function setLineHeight(d) { const vv = Math.min(2.8, Math.max(1.6, +((q().lineHeight || 2.15) + d).toFixed(2))); saveQ({ lineHeight: vv }); document.documentElement.style.setProperty('--quran-lh', String(vv)); reader.refit(); }
  /** العرض والألوان: سمة الصفحة (فاتح/تدرّجات/داكن)، تعتيم، إبقاء الشاشة مضاءة، طريقة العرض وحجم الخط */
  function displaySheet() {
    let rerender = () => {};
    const build = () => {
    const s = q();
    const swatches = [];
    const refreshSwatches = () => { for (const b of swatches) { const on = b.dataset.id === reader.theme; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
    const swatch = (t) => { const b = h('button', { class: 'theme-swatch', dataset: { id: t.id }, 'aria-label': `لون الصفحة: ${t.name}`, onclick: () => { reader.setTheme(t.id, true); refreshSwatches(); } }, h('span', { class: 'sw', style: { background: t.gradient || t.paper, color: t.ink } }, 'ق'), h('span', {}, t.name)); swatches.push(b); return b; };
    const grid = h('div', { class: 'theme-groups' }, ...THEME_GROUPS.map(([g, label]) => h('div', {}, h('div', { class: 'theme-group-title' }, label), h('div', { class: 'theme-grid' }, ...MUSHAF_THEMES.filter((t) => t.group === g).map(swatch)))));
    refreshSwatches();
    const dimLabel = h('label', {}, 'تعتيم الصفحة');
    const dim = h('input', { class: 'range', type: 'range', min: 0, max: 60, step: 5, value: Math.round((s.dim || 0) * 100), 'aria-label': 'تعتيم الصفحة' });
    const dimText = () => { dimLabel.textContent = +dim.value > 0 ? `تعتيم الصفحة (${app.num(+dim.value)}٪)` : 'تعتيم الصفحة'; };
    dim.addEventListener('input', () => { reader.setDim(dim.value / 100); dimText(); }); dim.addEventListener('change', () => saveQ({ dim: dim.value / 100 })); dimText();
    const isText = (s.view || 'pages') === 'text';
    const viewSeg = h('div', { class: 'segmented' }, ...[['pages', 'صفحات المصحف'], ['text', 'نص متدفق']].map(([k, l]) => h('button', { class: (s.view || 'pages') === k ? 'active' : '', onclick: () => { if ((q().view || 'pages') === k) return; saveQ({ view: k }); reader.setTextMode(k === 'text'); rerender(); } }, l)));
    return h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'لون الصفحة'), grid),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'الوضع الليلي يتبع النظام'), h('div', { class: 'desc' }, 'سمة داكنة مع الوضع الليلي للجهاز، وإلا آخر سمة فاتحة اخترتها')),
        switchEl(!!s.themeAuto, (on) => { saveQ({ themeAuto: on }); reader.setTheme(on && matchMedia('(prefers-color-scheme: dark)').matches ? (q().themeDark || 'dark') : (q().themeLight || 'cream')); refreshSwatches(); }, 'الوضع الليلي يتبع النظام')),
      h('div', { class: 'field' }, dimLabel, dim, h('div', { class: 'tiny' }, 'يخفّض إضاءة الصفحة للقراءة ليلًا دون تغيير سطوع الجهاز')),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'إبقاء الشاشة مضاءة'), h('div', { class: 'desc' }, 'لا تنطفئ الشاشة ما دام المصحف مفتوحًا')), switchEl(s.keepAwake !== false, (on) => { saveQ({ keepAwake: on }); reader.setKeepAwake(on); }, 'إبقاء الشاشة مضاءة')),
      h('div', { class: 'field' }, h('label', {}, 'طريقة العرض'), viewSeg, h('div', { class: 'tiny' }, isText ? 'نص متدفق بحجم خط وتباعد أسطر قابلين للتغيير' : 'صفحات مصحف المدينة كما في المطبوع سطرًا بسطر')),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'التجويد الملوّن'), h('div', { class: 'desc' }, isText ? 'تلوين أحكام المدّ والغنّة والقلقلة والإخفاء…' : 'يفعّل وضع النص المتدفق (خطوط الصفحات لا تسمح بالتلوين)')),
        h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'icon-btn', 'aria-label': 'ألوان التجويد', title: 'مفتاح الألوان', onclick: tajweedLegendSheet }, h('span', { html: icon('info') })), switchEl(!!s.tajweed, async (on) => { saveQ({ tajweed: on }); if (on && (q().view || 'pages') !== 'text') { saveQ({ view: 'text' }); reader.setTextMode(true); } await applyTajweed(on); rerender(); }, 'التجويد الملوّن'))),
      h('div', { class: 'field' }, h('label', {}, 'اتجاه التصفح'), h('div', { class: 'segmented' }, ...[['horizontal', 'أفقي (تقليب)'], ['vertical', 'رأسي (متصل)']].map(([k, l]) => h('button', { class: (s.scroll || 'horizontal') === k ? 'active' : '', onclick: () => { saveQ({ scroll: k }); reader.setVertical(k === 'vertical'); rerender(); } }, l)))),
      (isText || (s.scroll === 'vertical')) ? h('div', { class: 'field' }, h('label', {}, `سرعة التمرير التلقائي (${app.num(s.autoSpeed || 40)})`), (() => { const r = h('input', { class: 'range', type: 'range', min: 10, max: 160, step: 10, value: s.autoSpeed || 40, 'aria-label': 'سرعة التمرير التلقائي' }); r.addEventListener('input', () => reader.setAutoSpeed(+r.value)); r.addEventListener('change', () => saveQ({ autoSpeed: +r.value })); return r; })(), h('div', { class: 'tiny' }, 'زر ▶ في شريط الأدوات يبدأ التمرير؛ أي لمسة توقفه')) : null,
      isText ? h('div', { class: 'field' }, h('label', {}, 'خط النص'), h('div', { class: 'segmented' }, ...[['amiri', 'أميري قرآن'], ['hafs', 'حفص (مجمع الملك فهد)']].map(([k, l]) => h('button', { class: (s.textFont || 'amiri') === k ? 'active' : '', onclick: () => { saveQ({ textFont: k }); applyTextFont(); reader.refit(); rerender(); } }, l))), h('div', { class: 'tiny' }, 'خط حفص يُجلب مرة واحدة عند اختياره (88 ك.ب)')) : null,
      isText ? h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'ملاءمة الصفحة للشاشة'), h('div', { class: 'desc' }, 'تصغير الخط تلقائيًا كي تظهر الصفحة كاملة دون تمرير')), switchEl(s.fitText !== false, (on) => { saveQ({ fitText: on }); reader.setFitText(on); }, 'ملاءمة الصفحة للشاشة')) : null,
      isText ? h('div', { class: 'setting-row' }, h('div', { class: 'label' }, 'حجم الخط'), h('div', { class: 'text-scale-ctl' }, h('button', { onclick: () => setScale(-0.1), 'aria-label': 'تصغير الخط' }, 'أ-'), h('button', { onclick: () => setScale(0.1), 'aria-label': 'تكبير الخط' }, 'أ+'))) : null,
      isText ? h('div', { class: 'setting-row' }, h('div', { class: 'label' }, 'تباعد الأسطر'), h('div', { class: 'text-scale-ctl' }, h('button', { onclick: () => setLineHeight(-0.15), 'aria-label': 'تقليل التباعد' }, '−'), h('button', { onclick: () => setLineHeight(0.15), 'aria-label': 'زيادة التباعد' }, '+'))) : null,
      h('button', { class: 'btn btn-outline btn-block', onclick: () => { closeSheet(); readerOptions(); } }, h('span', { html: icon('settings') }), ' سائر خيارات المصحف'));
    };
    const { body } = openSheet({ title: 'العرض والألوان', content: build() });
    rerender = () => render(body, build()); // إعادة رسم في مكانها: إغلاق النافذة ثم فتحها يتعارض مع رجوع السجل
  }
  function setScale(d) { const v = Math.min(1.8, Math.max(0.7, +((q().fontScale || 1) + d).toFixed(2))); saveQ({ fontScale: v }); document.documentElement.style.setProperty('--quran-scale', String(v)); reader.relayout(); }

  /* ---------- العلامات مع ملاحظة ولون ---------- */
  function bookmarkSheet(a, onDone) {
    const bms = q().bookmarks || []; const cur = bms.find((b) => b.surah === a.surah && b.ayah === a.ayah) || null;
    let color = (cur && cur.color) || 'gold';
    const note = h('textarea', { class: 'input', rows: 3, placeholder: 'ملاحظة (اختياري): تدبّر، فائدة، تذكير…', maxlength: 500 }); note.value = (cur && cur.note) || '';
    const colors = h('div', { class: 'bm-colors' });
    const drawColors = () => render(colors, ...[['gold', 'var(--gold)'], ['green', 'var(--ok)'], ['red', 'var(--danger)'], ['blue', '#2563eb']].map(([k, c]) => h('button', { class: k === color ? 'on' : '', style: { background: c }, 'aria-label': `لون ${k}`, onclick: () => { color = k; drawColors(); } })));
    drawColors();
    const save = () => {
      const rest = bms.filter((b) => !(b.surah === a.surah && b.ayah === a.ayah));
      saveQ({ bookmarks: [...rest, { surah: a.surah, ayah: a.ayah, page: a.page, at: cur ? cur.at : Date.now(), note: note.value.trim() || undefined, color }] });
      app.replace('quran.bookmarks', app.settings.quran.bookmarks); // إزالة المفاتيح المحذوفة (note) دون دمج عميق
      reader.refreshBookmark(); closeSheet(); toast(cur ? 'حُدّثت العلامة' : `أُضيفت علامة عند ${refLabel(a)}`); vibrate(10); onDone && onDone();
    };
    openSheet({ title: `علامة — ${refLabel(a)}`, content: h('div', { class: 'stack' },
      h('p', { class: 'matn', style: { fontFamily: "'Amiri Quran', Amiri, serif", fontSize: '17px', lineHeight: '2' } }, a.text.length > 160 ? a.text.slice(0, 160) + '…' : a.text),
      h('div', { class: 'field' }, h('label', {}, 'اللون'), colors),
      h('div', { class: 'field' }, h('label', {}, 'ملاحظة'), note),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn btn-primary', style: { flex: 1 }, onclick: save }, cur ? 'حفظ' : 'إضافة العلامة'),
        cur ? h('button', { class: 'btn btn-outline', onclick: () => { saveQ({ bookmarks: bms.filter((b) => !(b.surah === a.surah && b.ayah === a.ayah)) }); app.replace('quran.bookmarks', app.settings.quran.bookmarks); reader.refreshBookmark(); closeSheet(); toast('أُزيلت العلامة'); onDone && onDone(); } }, 'إزالة') : null)) });
    setTimeout(() => note.focus({ preventScroll: true }), 350);
  }

  /* ---------- التلاوات دون اتصال ---------- */
  function openDownloads(reciterId, focusSurah) {
    let reciter = reciterId || q().reciter; const running = new Map(); // surah → AbortController
    const sel = h('select', { class: 'input' }, ...RECITERS.map((r) => h('option', { value: r.id, selected: r.id === reciter }, r.name + (r.qdc ? ' — كلمة بكلمة' : ''))));
    sel.addEventListener('change', () => { reciter = sel.value; draw(); });
    const summary = h('div', { class: 'tiny' }); const list = h('div', { class: 'card', style: { padding: '2px 10px' } });
    const dlOf = () => (q().downloads || {})[reciter] || {};
    const setDl = (surah, entry) => { const all = { ...(q().downloads || {}) }; const mine = { ...(all[reciter] || {}) }; if (entry) mine[surah] = entry; else delete mine[surah]; all[reciter] = mine; app.replace('quran.downloads', all); };
    const drawSummary = async () => { const mine = dlOf(); const n = Object.keys(mine).length; const b = Object.values(mine).reduce((t, e) => t + (e.bytes || 0), 0); render(summary, n ? `${app.num(n)} سورة محفوظة لهذا القارئ · ${fmtBytes(b)}` : 'لا سور محفوظة لهذا القارئ بعد'); };
    const row = (su) => {
      const mine = dlOf(); const e = mine[su.n]; const ctl = running.get(su.n);
      const prog = h('span', { class: 'prog' }, ctl ? ctl.label || '…' : '');
      const btn = h('button', { class: `btn btn-sm ${e ? 'btn-outline' : 'btn-soft'}`, onclick: async () => {
        if (ctl) { ctl.abort(); running.delete(su.n); draw(); return; }
        if (e) { await deleteSurah(reciter, su.n, surahAyahs(su.n), { words: q().wordHighlight !== false }); setDl(su.n, null); draw(); toast(`حُذفت تلاوة ${su.name}`); return; }
        if (!(isLoaded())) { await ensureLoaded(); }
        const ac = new AbortController(); ac.label = '0٪'; running.set(su.n, ac); draw();
        try {
          const r = await downloadSurah(reciter, su.n, surahAyahs(su.n), { signal: ac.signal, words: q().wordHighlight !== false, onProgress: (d, t) => { ac.label = `${app.num(Math.round(d / t * 100))}٪`; const p = list.querySelector(`[data-su="${su.n}"] .prog`); if (p) p.textContent = ac.label; } });
          setDl(su.n, { files: r.files, bytes: r.bytes, at: Date.now(), words: q().wordHighlight !== false }); toast(`اكتمل تنزيل ${su.name} (${fmtBytes(r.bytes)})`);
        } catch (err) { if (!/abort/i.test(String(err && err.message))) toast(err && err.message === 'unsupported' ? 'التنزيل غير متاح في هذا المتصفح' : 'تعذّر إكمال التنزيل — تحقق من الاتصال', 3500); }
        running.delete(su.n); draw();
      } }, ctl ? 'إيقاف' : e ? 'حذف' : 'تنزيل');
      return h('div', { class: 'dl-row', dataset: { su: String(su.n) } }, h('span', {}, h('div', { class: 'nm' }, `${app.num(su.n)}. ${su.name}`), h('div', { class: 'info' }, e ? `محفوظة · ${fmtBytes(e.bytes || 0)}${e.words ? ' · كلمة بكلمة' : ''}` : `${app.num(su.ayahs)} آية`)), h('span', { class: 'row', style: { gap: '6px' } }, prog, btn));
    };
    const draw = () => { drawSummary(); const ordered = focusSurah ? [SURAHS[focusSurah - 1], ...SURAHS.filter((x) => x.n !== focusSurah)] : SURAHS; render(list, ...ordered.map(row)); };
    draw();
    openSheet({ title: 'التلاوات دون اتصال', content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'القارئ'), sel), summary,
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn btn-outline btn-sm', onclick: async () => { const j = pageLabel(page()).juz || 1; const surahs = SURAHS.filter((x) => surahAyahs(x.n).some((a) => a.juz === j)); for (const su of surahs) { const el = list.querySelector(`[data-su="${su.n}"] button`); if (el && el.textContent === 'تنزيل') el.click(); } } }, `تنزيل سور الجزء ${app.num(pageLabel(page()).juz || 1)}`),
        h('button', { class: 'btn btn-outline btn-sm', onclick: async () => { if (!confirm('حذف كل التلاوات المحفوظة لكل القرّاء؟')) return; const { clearAllAudio } = await import('../platform/downloads.js'); await clearAllAudio(); app.replace('quran.downloads', {}); draw(); toast('حُذفت كل التلاوات المحفوظة'); } }, 'حذف الكل')),
      list,
      h('p', { class: 'tiny' }, isNative() ? 'تُحفظ الملفات داخل التطبيق وتُشغَّل تلقائيًا دون اتصال.' : 'تُحفظ الملفات في تخزين المتصفح ويقدّمها التطبيق تلقائيًا دون اتصال؛ قد يحذفها المتصفح إن ضاق التخزين.')), onClose: () => { for (const ac of running.values()) ac.abort(); } });
    storedBytes().then((r) => { if (r && r.files) render(summary, `${summary.textContent} · إجمالي المخزّن ${fmtBytes(r.bytes)}`); });
  }

  /* ---------- خطة الختمة وإحصاءات القراءة ---------- */
  let dwellTimer = null; let dwellPage = null;
  function trackDwell(p) {
    clearTimeout(dwellTimer); dwellPage = p;
    dwellTimer = setTimeout(() => { if (reader.isOpen && dwellPage === p) { const log = logPage(q().readLog, app.todayKey(), p); app.replace('quran.readLog', log); } }, 8000);
  }
  /* ---------- خريطة الحرارة والتحدّيات ---------- */
  function heatmapEl() {
    const today = app.todayKey(); const days = heatmap(q().readLog, today, 90); const max = Math.max(1, ...days.map((d) => d.count));
    const lvl = (c) => (c === 0 ? '' : c >= max * 0.75 ? 'l4' : c >= max * 0.5 ? 'l3' : c >= max * 0.25 ? 'l2' : 'l1');
    const total = days.reduce((n, d) => n + d.count, 0); const active = days.filter((d) => d.count).length;
    return h('div', {}, h('div', { class: 'heatmap', role: 'img', 'aria-label': `خريطة القراءة لآخر 90 يومًا: ${app.num(total)} صفحة في ${app.num(active)} يومًا` }, ...days.map((d) => h('i', { class: lvl(d.count), title: `${d.key}: ${app.num(d.count)} صفحة` }))),
      h('div', { class: 'heatmap-foot' }, h('span', {}, 'قبل 90 يومًا'), h('span', {}, `${app.num(total)} صفحة · ${app.num(active)} يوم قراءة`), h('span', {}, 'اليوم')));
  }
  function readingCard() {
    const today = app.todayKey(); const act = q().challenge; const pr = challengeProgress(act, q().readLog, today);
    const hasLog = Object.keys(q().readLog || {}).length > 0;
    if (!hasLog && !pr) return h('div', { class: 'challenge-card' }, h('div', { class: 'row between' }, h('b', {}, 'تحدّيات القراءة'), h('button', { class: 'btn btn-sm btn-soft', onclick: challengesSheet }, 'ابدأ تحدّيًا')), h('div', { class: 'tiny', style: { marginTop: '4px' } }, 'سورة الكهف يوم الجمعة، جزء عمّ في أسبوع، الملك كل ليلة… بمدة تقديرية وتقدّم يومي.'));
    return h('div', { class: 'challenge-card' },
      pr ? h('div', {}, h('div', { class: 'row between' }, h('b', {}, pr.finished ? `✓ أتممت: ${pr.name}` : pr.name), h('span', { class: 'tiny' }, pr.finished ? '' : pr.late ? 'انتهت المدة' : `اليوم ${app.num(pr.dayIndex + 1)} من ${app.num(challengeById(pr.id).days)}`)),
        h('div', { class: 'bar' }, h('i', { class: pr.late ? 'late' : '', style: { width: `${pr.pct}%` } })),
        h('div', { class: 'row between' }, h('span', { class: 'tiny' }, `${app.num(pr.done)} / ${app.num(pr.total)} صفحة${pr.finished ? '' : ` · يتبقى نحو ${app.num(pr.minutesLeft)} دقيقة`}`),
          h('div', { class: 'row', style: { gap: '6px' } },
            pr.finished ? h('button', { class: 'btn btn-sm btn-primary', onclick: challengesSheet }, 'تحدٍّ جديد') : h('button', { class: 'btn btn-sm btn-primary', onclick: () => { const done = new Set(); for (const [k, pages] of Object.entries(q().readLog || {})) if (k >= act.startedAt) pages.forEach((p) => done.add(p)); let p = pr.from; while (p < pr.to && done.has(p)) p++; openReader(p); } }, h('span', { html: icon('play') }), ' اقرأ'),
            h('button', { class: 'btn btn-sm btn-outline', onclick: () => { saveQ({ challenge: null }); indexScreen(); } }, 'إنهاء')))) : h('div', { class: 'row between' }, h('b', {}, 'قراءتك في 90 يومًا'), h('button', { class: 'btn btn-sm btn-soft', onclick: challengesSheet }, 'ابدأ تحدّيًا')),
      h('div', { style: { marginTop: '10px' } }, heatmapEl()));
  }
  function challengesSheet() {
    const last = q().lastRead; const startPage = last ? last.page : 1;
    openSheet({ title: 'تحدّيات القراءة', content: h('div', { class: 'stack' },
      h('p', { class: 'tiny' }, 'اختر تحدّيًا؛ تُحتسب الصفحات التي تقرؤها (ثماني ثوانٍ في الصفحة على الأقل) من لحظة البدء. الزمن التقديري بمتوسط دقيقتين للصفحة.'),
      h('div', { class: 'city-list' }, ...CHALLENGES.map((c) => { const { from, to } = resolveRange(c, startPage); const pages = to - from + 1; return h('button', { class: 'challenge-row', onclick: () => { saveQ({ challenge: { id: c.id, startedAt: app.todayKey(), startPage, from, to } }); closeSheet(); toast(`بدأ تحدّي «${c.name}»`); indexScreen(); } },
        h('span', { style: { flex: 1, textAlign: 'right' } }, h('div', { class: 'nm' }, c.name), h('div', { class: 'info' }, `${c.desc} · ص ${app.num(from)}–${app.num(to)} · ${app.num(pages)} صفحة ≈ ${app.num(estimateMinutes(pages))} دقيقة · ${c.days === 1 ? 'يوم واحد' : `${app.num(c.days)} أيام`}`)), h('span', { html: icon('chevron') })); }))) });
  }
  function khatmahCard() {
    const plan = q().khatmah; const today = app.todayKey(); const last = q().lastRead;
    if (!plan) {
      const st = readStats(q().readLog, today); const sk = streak(q().readLog, today);
      if (!st.month && !sk) return null;
      return h('div', { class: 'khatmah-card' }, h('div', { class: 'kh-head' }, h('b', {}, 'قراءتك'), h('button', { class: 'btn btn-sm btn-soft', onclick: khatmahSheet }, 'خطة ختمة')),
        h('div', { class: 'kh-meta' }, h('span', {}, 'سلسلة الأيام: ', h('b', {}, app.num(sk))), h('span', {}, 'هذا الأسبوع: ', h('b', {}, app.num(st.week)), ' صفحة'), h('span', {}, 'هذا الشهر: ', h('b', {}, app.num(st.month)), ' صفحة')));
    }
    const cur = last ? last.page : plan.startPage; const stt = planStatus(plan, cur, q().readLog, today); const sk = streak(q().readLog, today);
    const [ey, em, ed] = stt.etaKey.split('-').map(Number);
    return h('div', { class: 'khatmah-card' },
      h('div', { class: 'kh-head' }, h('b', {}, stt.finished ? 'تقبّل الله ✦ أتممت الختمة' : `خطة الختمة · ${app.num(plan.days)} يومًا`), h('button', { class: 'btn btn-sm btn-soft', onclick: khatmahSheet }, 'تعديل')),
      h('div', { class: 'kh-bar' }, h('i', { style: { width: `${stt.percent}%` } })),
      h('div', { class: 'kh-meta' },
        h('span', {}, h('b', {}, `${app.num(stt.percent)}٪`), ` · ${app.num(stt.done)} من ${app.num(604)} صفحة`),
        h('span', {}, 'اليوم: ', h('b', {}, `${app.num(stt.todayPages)} / ${app.num(stt.todayTarget)}`), ' صفحة'),
        stt.behind > 0 ? h('span', { style: { color: 'var(--danger)' } }, `متأخّر ${app.num(stt.behind)} صفحة`) : h('span', { style: { color: 'var(--ok)' } }, 'على الجدول ✓'),
        h('span', {}, 'سلسلة: ', h('b', {}, app.num(sk)), ' يوم'),
        h('span', {}, 'الإتمام المتوقع: ', h('b', {}, new Date(Date.UTC(ey, em - 1, ed)).toLocaleDateString('ar', { day: 'numeric', month: 'long', timeZone: 'UTC' })))),
      h('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } },
        h('button', { class: 'btn btn-sm btn-primary', onclick: () => openReader(last ? last.page : plan.startPage, last ? getAyahBySurah(last.surah, last.ayah) : null) }, h('span', { html: icon('play') }), stt.todayPages >= stt.todayTarget ? ' أكملت ورد اليوم — تابع' : ' اقرأ ورد اليوم')));
  }
  function khatmahSheet() {
    const plan = q().khatmah; let days = plan ? plan.days : 30; let fromCurrent = true; let reminder = plan ? plan.reminder : null;
    const daysIn = h('input', { class: 'input ltr', type: 'number', min: 1, max: 604, value: days, style: { width: '90px' } });
    const chips = h('div', { class: 'chips' });
    const drawChips = () => render(chips, ...[30, 60, 90, 120].map((d) => h('button', { class: `chip chip-btn ${days === d ? 'active' : ''}`, onclick: () => { days = d; daysIn.value = d; drawChips(); } }, `${app.num(d)} يومًا`)));
    drawChips(); daysIn.addEventListener('input', () => { days = Math.max(1, Math.min(604, +daysIn.value || 30)); drawChips(); });
    const timeIn = h('input', { class: 'input ltr', type: 'time', value: reminder || '' , style: { width: '130px' } });
    const start = h('div', { class: 'segmented' }); const drawStart = () => render(start, h('button', { class: fromCurrent ? 'active' : '', onclick: () => { fromCurrent = true; drawStart(); } }, 'من موضع قراءتي'), h('button', { class: !fromCurrent ? 'active' : '', onclick: () => { fromCurrent = false; drawStart(); } }, 'من الفاتحة')); drawStart();
    const save = () => {
      const last = q().lastRead; const startPage = fromCurrent && last ? last.page : 1;
      const p = makePlan({ startPage, startedAt: app.todayKey(), days, reminder: timeIn.value || null });
      app.replace('quran.khatmah', p); scheduleKhatmahReminder(p); closeSheet(); toast(`خطة الختمة: ${app.num(p.dailyPages)} صفحات يوميًا`); if (!reader.isOpen) indexScreen();
    };
    openSheet({ title: plan ? 'تعديل خطة الختمة' : 'خطة الختمة', content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'المدة'), chips, h('div', { class: 'row', style: { marginTop: '6px' } }, daysIn, h('span', { class: 'tiny' }, `≈ ${app.num(Math.ceil(604 / days))} صفحات يوميًا`))),
      h('div', { class: 'field' }, h('label', {}, 'البداية'), start),
      h('div', { class: 'field' }, h('label', {}, 'تذكير يومي (اختياري)'), h('div', { class: 'row' }, timeIn, h('span', { class: 'tiny' }, isNative() ? 'إشعار يومي من النظام' : 'يعمل ما دام التطبيق مفتوحًا'))),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'btn btn-primary', style: { flex: 1 }, onclick: save }, plan ? 'حفظ' : 'ابدأ الخطة'),
        plan ? h('button', { class: 'btn btn-outline', onclick: () => { app.replace('quran.khatmah', null); scheduleKhatmahReminder(null); closeSheet(); toast('أُنهيت الخطة'); if (!reader.isOpen) indexScreen(); } }, 'إنهاء') : null)) });
    daysIn.addEventListener('input', () => { const t = daysIn.parentElement.querySelector('.tiny'); if (t) t.textContent = `≈ ${app.num(Math.ceil(604 / days))} صفحات يوميًا`; });
  }
  const KHATMAH_NOTIF_ID = 900001;
  async function scheduleKhatmahReminder(plan) {
    const LN = nativeNotif.available() ? (await import('../platform/native.js')).plugin('LocalNotifications') : null;
    if (!LN) return;
    try { await LN.cancel({ notifications: [{ id: KHATMAH_NOTIF_ID }] }); } catch { /* تجاهل */ }
    if (!plan || !plan.reminder) return;
    const [hh, mm] = plan.reminder.split(':').map(Number);
    try { await LN.schedule({ notifications: [{ id: KHATMAH_NOTIF_ID, title: 'ورد اليوم من القرآن', body: `${app.num(plan.dailyPages)} صفحات تُبقيك على جدول الختمة`, schedule: { on: { hour: hh, minute: mm }, repeats: true, allowWhileIdle: true }, extra: { url: './index.html#/quran' } }] }); } catch { /* تجاهل */ }
  }

  /* ---------- التلاوة ---------- */
  function playFrom(n, scope) {
    const a = getAyah(n); let queue;
    if (scope === 'single') queue = [n];
    else if (scope === 'page') queue = pageAyahs(a.page).map((x) => x.n);
    else queue = surahAyahs(a.surah).filter((x) => x.n >= n).map((x) => x.n);
    player.reciter = q().reciter; player.repeatAyah = q().repeatAyah || 1; player.repeatRange = !!q().repeatRange; player.setRate(q().rate || 1);
    player.words = q().wordHighlight !== false;
    player.play(queue, 0, { label: (m) => refLabel(getAyah(m)), ayah: (m) => getAyah(m) });
    renderAudioBar(); // يظهر الشريط فورًا («جارٍ التحميل») دون انتظار جلب بيانات المصدر
  }
  player.on('ayah', ({ ayah }) => {
    reader.markWord(ayah, null);
    playingAyah = ayah; const a = getAyah(ayah);
    reader.clearMarks('hl'); reader.mark(ayah, 'hl');
    if (reader.isOpen && q().follow && a.page !== page() && !hifz) reader.goto(a.page, { smooth: true });
    renderAudioBar();
  });
  player.on('state', (st) => { if (st === 'stopped' || st === 'ended') { playingAyah = null; reader.clearMarks('hl'); reader.markWord(null, null); } renderAudioBar(); });
  player.on('time', ({ ayah, t, d, word }) => {
    const bar = document.querySelector('.audio-bar .bar i'); if (bar && d) bar.style.width = `${(t / d) * 100}%`;
    if (q().wordHighlight !== false && reader.isOpen) reader.markWord(ayah, word ? word - 1 : null);
  });
  player.on('sleep', (at) => { if (!at) toast('انتهى مؤقت النوم — توقفت التلاوة', 3000); renderAudioBar(); });
  player.on('error', ({ code, kind }) => {
    if (code === 'play') return;
    toast(kind === 'network' ? 'تعذّر تحميل التلاوة — تحقق من الاتصال بالإنترنت' : kind === 'unavailable' ? 'هذه التلاوة غير متاحة لهذه الآية من هذا القارئ — جرّب قارئًا آخر' : 'تعذّر تشغيل التلاوة — جرّب قارئًا آخر أو أعد المحاولة', 3800);
  });

  function renderAudioBar() {
    let bar = document.getElementById('audio-bar');
    if (!player.current) { if (bar) bar.remove(); document.body.classList.remove('has-audio'); reader.relayout(); return; }
    const a = getAyah(player.current); const rec = RECITERS.find((r) => r.id === player.reciter) || RECITERS[0];
    const content = h('div', {},
      h('div', { class: 'row1' },
        h('div', {}, h('div', { class: 'who' }, rec.name), h('div', { class: 'where' }, `${refLabel(a)} · ${app.num(player.index + 1)}/${app.num(player.queue.length)}${player.loading ? ' · جارٍ التحميل…' : ''}`)),
        h('div', { class: 'ctl' },
          h('button', { class: 'icon-btn', 'aria-label': 'الآية السابقة', onclick: () => player.prevAyah() }, h('span', { html: icon('skipNext') })),
          h('button', { class: 'icon-btn play', 'aria-label': player.playing ? 'إيقاف مؤقت' : 'تشغيل', onclick: () => player.toggle() }, h('span', { html: icon(player.playing ? 'pause' : 'play') })),
          h('button', { class: 'icon-btn', 'aria-label': 'الآية التالية', onclick: () => player.nextAyah() }, h('span', { html: icon('skipPrev') })),
          h('button', { class: 'icon-btn', 'aria-label': 'إغلاق', onclick: () => player.stop() }, h('span', { html: icon('close') })))),
      h('div', { class: 'bar' }, h('i')),
      h('div', { class: 'opts' },
        h('button', { class: 'chip chip-btn', onclick: pickReciter }, h('span', { html: icon('mic') }), ' القارئ'),
        h('button', { class: `chip chip-btn ${player.repeatAyah > 1 ? 'active' : ''}`, onclick: () => { const opts = [1, 2, 3, 5, 10]; const nx = opts[(opts.indexOf(player.repeatAyah) + 1) % opts.length]; player.repeatAyah = nx; saveQ({ repeatAyah: nx }); renderAudioBar(); } }, h('span', { html: icon('repeat') }), ` الآية ×${app.num(player.repeatAyah)}`),
        h('button', { class: `chip chip-btn ${player.repeatRange ? 'active' : ''}`, onclick: () => { player.repeatRange = !player.repeatRange; saveQ({ repeatRange: player.repeatRange }); renderAudioBar(); } }, 'تكرار المقطع'),
        h('button', { class: 'chip chip-btn', onclick: () => { const opts = [0.75, 1, 1.25, 1.5]; const nx = opts[(opts.indexOf(player.rate) + 1) % opts.length]; player.setRate(nx); saveQ({ rate: nx }); renderAudioBar(); } }, `السرعة ${app.num(player.rate, 2).replace(/\.?0+$/, '')}×`),
        h('button', { class: `chip chip-btn ${player.sleepAt ? 'active' : ''}`, title: 'مؤقت النوم', onclick: () => { const opts = [0, 15, 30, 45, 60]; const cur = player.sleepAt ? Math.round((player.sleepAt - Date.now()) / 60000) : 0; const nx = opts[(opts.findIndex((o) => o >= cur && (cur === 0 ? o === 0 : true)) + 1) % opts.length]; player.setSleep(nx); toast(nx ? `ستتوقف التلاوة بعد ${app.num(nx)} دقيقة` : 'أُلغي مؤقت النوم', 2500); } }, h('span', { html: icon('moon') }), player.sleepAt ? ` ${app.num(Math.max(1, Math.round((player.sleepAt - Date.now()) / 60000)))} د` : ' النوم'),
        reader.isOpen && a.page !== page() ? h('button', { class: 'chip chip-btn', onclick: () => reader.goto(a.page, { smooth: false }) }, `الانتقال إلى ص ${app.num(a.page)}`) : null,
        !reader.isOpen && app.current === 'quran' ? h('button', { class: 'chip chip-btn', onclick: () => openReader(a.page) }, 'فتح الصفحة') : null));
    if (!bar) { bar = h('div', { class: 'audio-bar', id: 'audio-bar', role: 'region', 'aria-label': 'مشغّل التلاوة' }); document.body.append(bar); }
    render(bar, content); document.body.classList.add('has-audio'); reader.relayout();
  }
  function pickReciter() {
    openSheet({ title: 'اختيار القارئ', content: h('div', { class: 'city-list' }, ...RECITERS.map((r) => h('button', { class: 'surah-row', onclick: () => { saveQ({ reciter: r.id }); player.setReciter(r.id); closeSheet(); renderAudioBar(); } },
      h('span', { class: 'num', html: icon(player.reciter === r.id ? 'check' : 'mic') }), h('span', {}, h('div', { class: 'nm' }, r.name))))) });
  }

  /* ---------- مراجعة الحفظ ---------- */
  /** إخفاء الآيات للحفظ: الصفحة كلها مخفية وتُكشف آيةً آية بالنقر (زر «العين») */
  function startVeil() {
    const p = page(); const first = pageAyahs(p)[0].n;
    startHifz(first, { silent: true }); if (!hifz) return;
    hifz.veil = true; stopSpeech(); drawHifzPanel();
    toast('انقر الصفحة لكشف الآية التالية', 2500);
  }
  function revealNextAyah() {
    const m = hifz.matcher; if (m.done) return; const cur = hifz.words[m.pos]; const idx = [];
    while (!m.done && hifz.words[m.pos].n === cur.n) idx.push(m.hint());
    hifz.hints += idx.length; reveal(idx);
  }
  async function applyTajweed(on) {
    if (!on) { reader.setTajweed(null); return; }
    try { if (!isTajweedLoaded()) await loadTajweed(); reader.setTajweed(tajweedSpans); }
    catch { toast('تعذّر تحميل بيانات التجويد — تحقق من الاتصال ثم أعد المحاولة', 3500); saveQ({ tajweed: false }); }
  }
  function tajweedLegendSheet() {
    openSheet({ title: 'ألوان التجويد', content: h('div', { class: 'stack' },
      h('div', { class: 'tj-legend' }, ...TAJWEED_LEGEND.map(([, name, cssVar]) => h('span', {}, h('i', { style: { background: getComputedStyle(reader.el).getPropertyValue(cssVar) || '#888' } }), name))),
      h('p', { class: 'tiny' }, 'الأحكام من طبعة «القرآن المجوّد» (alquran.cloud) مُسقطةً على رسم مصحف المدينة؛ تظهر في وضع النص المتدفق لأن خطوط الصفحات المطبوعة لا تسمح بتلوين جزء من الكلمة.')) });
  }
  function startHifz(fromAyah, { silent = false } = {}) {
    const p = getAyah(fromAyah).page;
    if (p !== page()) reader.goto(p, { smooth: false });
    const words = []; // { n, k, norm, raw }
    for (const a of pageAyahs(p)) {
      if (a.n < fromAyah) continue;
      tokenize(a.text).filter((w) => w.spoken).forEach((w, k) => words.push({ n: a.n, k, norm: w.norm, raw: w.raw }));
    }
    hifz = { page: p, from: fromAyah, words, matcher: new HifzMatcher(words), listening: false, heard: '', hints: 0 };
    player.stop();
    reader.setHifz(true);
    applyHifzToPage();
    drawHifzPanel();
    if (!isSpeechSupported() && !silent) toast('التعرّف على الصوت غير متاح في هذا المتصفح — انقر الصفحة لكشف الكلمة التالية', 4500);
  }
  function applyHifzToPage() {
    const el = reader.pageEl(hifz.page); if (!el) return;
    el.classList.add('hifz'); el.classList.toggle('only-current', !!q().hifzOnlyCurrent);
    // الآيات قبل البداية تبقى ظاهرة، والكلمات المكشوفة تبقى مكشوفة (عند إعادة الرسم)
    el.querySelectorAll('.mw[data-k]').forEach((w) => { if (+w.dataset.n < hifz.from) w.classList.add('revealed'); });
    for (let i = 0; i < hifz.matcher.pos; i++) { const w = hifzWordEl(i); if (w) w.classList.add('revealed'); }
    markLast(); highlightCurrent();
  }
  function exitHifz() { stopSpeech(); hifz = null; reader.setHifz(false); reader.setPanel(null); reader.clearMarks('revealed'); reader.clearMarks('current'); reader.clearMarks('last'); }
  /** آخر كلمة كُشفت تبقى ظاهرة في وضع «الكلمة الحالية فقط» */
  function markLast() { reader.clearMarks('last'); if (hifz.matcher.pos > 0) { const el = hifzWordEl(hifz.matcher.pos - 1); if (el) el.classList.add('last'); } }
  function hifzWordEl(i) { const w = hifz.words[i]; const el = reader.pageEl(hifz.page); return el ? wordEl(el, w.n, w.k) : null; }
  function highlightCurrent() {
    reader.clearMarks('current');
    if (hifz.matcher.done) return;
    const el = hifzWordEl(hifz.matcher.pos); if (el) el.classList.add('current');
  }
  function reveal(indices) {
    for (const i of indices) { const el = hifzWordEl(i); if (el) el.classList.add('revealed'); }
    if (indices.length) { vibrate(10); markLast(); }
    highlightCurrent(); drawHifzPanel();
    if (hifz.matcher.done) onHifzDone();
  }
  function onHifzTap() { if (!hifz) return; if (hifz.veil) { revealNextAyah(); return; } const i = hifz.matcher.hint(); if (i !== null) { hifz.hints++; reveal([i]); } }
  function onHifzDone() {
    stopSpeech();
    const m = hifz.matcher;
    if (hifz.veil) toast('أتممت الصفحة ✓', 2500); else toast(`أتممت الصفحة ✓ كلمات صحيحة: ${app.num(m.matched)} · تلميحات: ${app.num(hifz.hints)}`, 5000);
    drawHifzPanel(); // لا انتقال تلقائي: زر «الصفحة التالية» في اللوحة
  }
  function drawHifzPanel() {
    if (!hifz) return;
    const m = hifz.matcher; const cur = m.done ? null : hifz.words[m.pos];
    if (hifz.veil) {
      const ayahs = pageAyahs(hifz.page); const shown = new Set(); for (let i = 0; i < m.pos; i++) shown.add(hifz.words[i].n); const doneAyahs = ayahs.filter((a) => shown.has(a.n) && hifz.words.filter((w) => w.n === a.n).every((_, k, arr) => true)).length;
      reader.setPanel(h('div', { class: 'hifz-panel veil-panel' },
        h('div', { class: 'row between' }, h('b', {}, 'إخفاء الآيات'), h('span', { class: 'tiny' }, `${app.num(Math.min(doneAyahs, ayahs.length))} / ${app.num(ayahs.length)} آية`), h('button', { class: 'icon-btn', 'aria-label': 'إنهاء إخفاء الآيات', onclick: exitHifz }, h('span', { html: icon('close') }))),
        h('div', { class: 'hifz-progress' }, h('i', { style: { width: `${m.progress * 100}%` } })),
        h('div', { class: 'hifz-ctl' },
          m.done ? h('button', { class: 'btn btn-primary', onclick: () => { if (hifz.page < TOTAL_PAGES) { reader.goto(hifz.page + 1, { smooth: false }); setTimeout(startVeil, 350); } } }, 'الصفحة التالية') : h('button', { class: 'btn btn-primary', onclick: revealNextAyah }, h('span', { html: icon('eye') }), ' كشف الآية التالية'),
          h('button', { class: 'btn btn-outline', onclick: () => { const idx = []; while (!m.done) idx.push(m.hint()); reveal(idx); } }, 'كشف الكل'))));
      return;
    }
    const revealedLast = m.pos > 0 ? hifz.words[m.pos - 1] : null;
    const micBtn = h('button', { class: `btn ${hifz.listening ? 'btn-primary mic-btn listening' : 'btn-primary mic-btn'}`, onclick: toggleSpeech, disabled: !isSpeechSupported() },
      h('span', { html: icon(hifz.listening ? 'micOff' : 'mic') }), hifz.listening ? ' إيقاف' : ' ابدأ التسميع');
    reader.setPanel(h('div', { class: 'hifz-panel' },
      h('div', { class: 'row between' }, h('b', {}, 'مراجعة الحفظ'), h('span', { class: 'tiny' }, `${app.num(m.pos)} / ${app.num(hifz.words.length)} كلمة`), h('button', { class: 'icon-btn', 'aria-label': 'إنهاء المراجعة', onclick: exitHifz }, h('span', { html: icon('close') }))),
      h('div', { class: 'hifz-word' }, m.done ? h('span', {}, '✓ أحسنت', hifz.page < TOTAL_PAGES ? h('button', { class: 'btn btn-sm btn-primary', style: { marginInlineStart: '10px' }, onclick: () => startHifz(pageAyahs(hifz.page + 1)[0].n) }, 'الصفحة التالية') : null) : revealedLast ? h('span', {}, revealedLast.raw) : h('small', {}, hifz.listening ? 'استمع… ابدأ التلاوة' : 'اضغط «ابدأ التسميع» أو انقر الصفحة لكشف كلمة')),
      h('div', { class: 'hifz-heard' }, hifz.heard),
      h('div', { class: 'hifz-progress' }, h('i', { style: { width: `${m.progress * 100}%` } })),
      h('div', { class: 'hifz-ctl' }, micBtn,
        h('button', { class: 'btn btn-outline', onclick: () => { const i = m.hint(); if (i !== null) { hifz.hints++; reveal([i]); } } }, h('span', { html: icon('eye') }), ' تلميح'),
        h('button', { class: 'btn btn-outline', onclick: () => { if (cur) { const idx = []; while (!m.done && hifz.words[m.pos].n === cur.n) idx.push(m.hint()); hifz.hints += idx.length; reveal(idx); } } }, 'كشف الآية'))));
  }
  function toggleSpeech() {
    if (!hifz) return;
    if (hifz.listening) { stopSpeech(); drawHifzPanel(); return; }
    try {
      speech = new SpeechListener({
        onResult: ({ finals, interim }) => {
          if (!hifz) return;
          hifz.heard = interim || hifz.heard;
          // النتائج المؤقتة تراكمية: نغذّي المطابق بالكلمات الجديدة فقط (لا النص كله من جديد وإلا تقدّم المؤشر فوق كلمات لم تُقل)
          if (finals.length) {
            for (const alts of finals) { const words = alts[0].split(/\s+/).filter(Boolean); const fed = hifz.fed || 0; const fresh = words.slice(fed).join(' '); if (fresh) { /* الاختيار الأول وبدائله فرضيات لصوت واحد: يجرّبها المطابق بلا أثر ويعتمد أولى ما يكشف */ reveal(hifz.matcher.feedBest([fresh, ...alts.slice(1).map((a) => a.split(/\s+/).slice(fed).join(' '))])); } }
            hifz.fed = 0; hifz.heard = finals.map((a) => a[0]).join(' ');
          } else if (interim) {
            const words = interim.split(/\s+/).filter(Boolean); const fresh = words.slice(hifz.fed || 0).join(' ');
            if (fresh) { reveal(hifz.matcher.feed(fresh)); hifz.fed = words.length; }
          }
          drawHifzPanel();
        },
        onState: (st) => { if (hifz) { hifz.listening = st === 'listening'; drawHifzPanel(); } },
        onError: (code) => { const msg = code === 'not-allowed' || code === 'service-not-allowed' ? 'لم يُمنح إذن الميكروفون' : code === 'network' ? 'التعرّف على الصوت يحتاج اتصالًا بالإنترنت' : code === 'audio-capture' ? 'لا يوجد ميكروفون' : `خطأ: ${code}`; toast(msg, 4000); },
      });
      speech.start(); hifz.listening = true; drawHifzPanel();
    } catch (e) { toast('تعذّر تشغيل التعرّف على الصوت في هذا المتصفح', 3500); }
  }
  function stopSpeech() { if (speech) { speech.stop(true); speech = null; } if (hifz) hifz.listening = false; }

  /** تحميل بيانات المصحف (2.1 م.ب) عند الحاجة فقط: الفهرس يُعرض فورًا من البيانات الوصفية، والتحميل يبدأ عند فتح صفحة أو بحث، أو في وقت الخمول */
  let prefetchScheduled = false;
  function prefetchIdle() {
    if (prefetchScheduled || (isLoaded() && isMushafLoaded())) return; prefetchScheduled = true;
    // على شبكة بطيئة أو مع «توفير البيانات» لا نجلب شيئًا مسبقًا (يُحمَّل عند أول فتح فقط)
    const conn = typeof navigator !== 'undefined' && navigator.connection;
    if (conn && (conn.saveData || /(^|-)(slow-)?2g$|^3g$/.test(conn.effectiveType || ''))) return;
    const go = () => Promise.all([loadQuran(), loadMushafLayout()]).catch(() => { prefetchScheduled = false; });
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 15000 }); else setTimeout(go, 6000);
  }
  async function build() {
    document.documentElement.style.setProperty('--quran-scale', String(q().fontScale || 1));
    document.documentElement.style.setProperty('--quran-lh', String(q().lineHeight || 2.15));
    applyTextFont();
    const m = location.hash.match(/^#\/quran\?p=(\d+)/);
    if (m && +m[1] >= 1 && +m[1] <= TOTAL_PAGES) { if (!(await ensureLoaded())) return; indexScreen(); if (!reader.isOpen) { reader.show(+m[1]); saveLastRead(null); if (q().tajweed) applyTajweed(true); } }
    else if (reader.isOpen) reader.goto(reader.page, { smooth: false });
    else { indexScreen(); prefetchIdle(); }
  }
  app.on('change', () => { if (app.current === 'quran' && !reader.isOpen) indexScreen(); });
  build();
  return {
    refresh: build,
    show: () => { const m = location.hash.match(/^#\/quran\?p=(\d+)/); if (m && !reader.isOpen) build(); else if (!reader.isOpen) { indexScreen(); prefetchIdle(); } renderAudioBar(); },
    hide: () => { stopSpeech(); if (hifz) hifz.listening = false; if (reader.isOpen) { hifz = null; reader.setHifz(false); reader.setPanel(null); reader.hide(); } },
  };
}
