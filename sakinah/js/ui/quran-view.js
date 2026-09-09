/**
 * شاشة المصحف: فهرس السور/الأجزاء/العلامات مع البحث، وقارئ غامر بصفحات مصحف المدينة بدقة الطباعة (js/ui/mushaf-reader.js)،
 * تلاوة آية بآية مع تظليل وتكرار ومتابعة بقلب الصفحات، حفظ موضع القراءة والعلامات،
 * ووضع مراجعة الحفظ (إخفاء الكلمات وكشف المنطوق منها عبر التعرّف على الصوت أو النقر).
 */
import { h, icon, render, openSheet, closeSheet, toast, copyText, shareText, vibrate, switchEl } from './components.js';
import { loadQuran, isLoaded, pageAyahs, surahAyahs, surahInfo, pageLabel, getAyah, getAyahBySurah, tokenize, HifzMatcher, searchText, refLabel, SURAHS, JUZ_STARTS, TOTAL_PAGES } from '../core/quran.js';
import { loadMushafLayout, isMushafLoaded } from '../core/mushaf.js';
import { foldDigits, normalizeForMatch } from '../core/quran.js';
import { createMushafReader } from './mushaf-reader.js';
import { wordEl } from './mushaf-page.js';
import { downloadAllPageFonts, offlineFontsCount } from '../platform/mushaf-fonts.js';
import { TAFSIR_SOURCES, getTafsir, tafsirSource } from '../core/tafsir.js';
import { AyahPlayer, RECITERS } from '../platform/audio.js';
import { SpeechListener, isSpeechSupported } from '../platform/speech.js';

const player = new AyahPlayer();

export function mount(container, app) {
  let indexTab = 'surahs'; let query = ''; let focusSearch = false;
  let playingAyah = null; let hifz = null; let speech = null; let saveTimer = null; let selected = null;
  const q = () => app.settings.quran;
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
    onHifzToggle: () => (hifz ? exitHifz() : startHifz(pageAyahs(page())[0].n)),
    onBookmark: (p) => toggleBookmark((hifz ? null : selectedOnPage(p)) || pageAyahs(p)[0].n),
    onPageChange: (p, { fromScroll }) => { if (hifz && p !== hifz.page) { exitHifz(); toast('انتهت مراجعة الحفظ بتغيير الصفحة', 2500); } if (selected && getAyah(selected).page !== p) clearSelection(); scheduleSaveLastRead(); syncUrl(p); if (fromScroll) vibrate(6); },
    onTap: (w) => { if (hifz) { onHifzTap(); return true; } return false; },
    onLongPress: (n) => { selectAyah(n); ayahActions(getAyah(n)); },
    onPageReady: (p) => { if (playingAyah) reader.mark(playingAyah, 'hl'); if (hifz && hifz.page === p) applyHifzToPage(); },
    onFallback: (p) => { if (!fallbackWarned) { fallbackWarned = true; toast('تعذّر تحميل خط الصفحة — عُرض النص بخط بديل. تتوفر الخطوط عند الاتصال بالإنترنت أو بعد تنزيلها من الخيارات.', 5000); } },
  });
  let fallbackWarned = false;
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
      h('span', { class: 'num', html: icon(r.id === reciter ? 'check' : 'mic') }), h('span', {}, h('div', { class: 'nm' }, r.name)))));
    const seg = (opts, get, set) => { const el = h('div', { class: 'segmented' }); const draw = () => render(el, ...opts.map(([k, l]) => h('button', { class: get() === k ? 'active' : '', onclick: () => { set(k); draw(); } }, l))); draw(); return el; };
    openSheet({ title: `الاستماع — ${refLabel(a)}`, content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'المدى'), seg([['single', 'هذه الآية'], ['surah', 'من هنا حتى نهاية السورة'], ['page', 'الصفحة']], () => scope, (v) => { scope = v; })),
      h('div', { class: 'field' }, h('label', {}, 'تكرار كل آية'), seg([[1, '×1'], [2, '×2'], [3, '×3'], [5, '×5'], [10, '×10']], () => repeat, (v) => { repeat = v; saveQ({ repeatAyah: v }); })),
      h('div', { class: 'field' }, h('label', {}, 'القارئ'), list),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { closeSheet(); player.repeatAyah = repeat; player.setReciter(reciter); playFrom(a.n, scope); } }, h('span', { html: icon('play') }), ' تشغيل')) });
    drawList();
  }
  function syncUrl(p) { const target = `#/quran?p=${p}`; if (location.hash !== target) history.replaceState(null, '', target); }
  async function openReader(p, ayah = null) {
    if (!(isLoaded() && isMushafLoaded()) && !(await ensureLoaded())) return;
    hifz = null; stopSpeech();
    if (!reader.isOpen) { if (!/^#\/quran\?p=/.test(location.hash)) history.pushState(null, '', `#/quran?p=${p}`); const showHint = !q().hintShown; reader.show(p, { showHint }); if (showHint) saveQ({ hintShown: true }); }
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
          h('span', { class: 'num', html: icon('bookmarkFill') }), h('span', {}, h('div', { class: 'nm' }, `${surahInfo(b.surah).name}: ${app.num(b.ayah)}`), h('div', { class: 'info' }, new Date(b.at).toLocaleDateString('ar', { day: 'numeric', month: 'long' }))),
          h('span', { class: 'pg' }, `ص ${app.num(b.page)}`),
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'حذف', onclick: (e) => { e.stopPropagation(); saveQ({ bookmarks: bms.filter((x) => !(x.surah === b.surah && x.ayah === b.ayah)) }); drawList(); } }, h('span', { html: icon('close') }))))
          : h('div', { class: 'empty' }, 'لا علامات بعد — اضغط زر العلامة في القارئ أو اضغط مطوّلًا على آية'));
      }
    };
    render(container,
      last ? h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'متابعة القراءة'), h('b', {}, `${surahInfo(last.surah).name} · آية ${app.num(last.ayah)}`), h('small', {}, `الصفحة ${app.num(last.page)} · الجزء ${app.num(pageLabel(last.page).juz)}`)),
        h('button', { class: 'btn btn-sm', onclick: () => openReader(last.page, getAyahBySurah(last.surah, last.ayah)) }, h('span', { html: icon('play') }), ' متابعة'))
        : h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'ابدأ القراءة'), h('b', {}, 'المصحف الشريف'), h('small', {}, 'مصحف المدينة النبوية · حفص عن عاصم · 604 صفحات')), h('button', { class: 'btn btn-sm', onclick: () => openReader(1) }, 'فتح')),
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
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); toggleBookmark(a.n); } }, h('span', { html: icon(isBookmarked(a.n) ? 'bookmarkFill' : 'bookmark') }), isBookmarked(a.n) ? ' إزالة العلامة' : ' إضافة علامة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); saveLastRead(a); toast(`حُفظ موضع القراءة عند ${refLabel(a)}`); } }, h('span', { html: icon('check') }), ' موضع القراءة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); startHifz(a.n); } }, h('span', { html: icon('eyeOff') }), ' مراجعة الحفظ من هنا'),
        h('button', { class: 'btn btn-outline', onclick: () => shareText('آية من القرآن الكريم', txt) }, h('span', { html: icon('share') }), ' مشاركة'),
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
    openSheet({ title: 'التنقل والبحث', content: h('div', { class: 'stack' },
      h('div', { class: 'search', style: { marginBottom: 0 } }, input, h('span', { html: icon('search') })),
      h('div', { class: 'row' }, h('span', { class: 'tiny' }, 'صفحة'), pageIn, h('button', { class: 'btn btn-outline btn-sm', onclick: () => go(Math.min(TOTAL_PAGES, Math.max(1, +pageIn.value || 1))) }, 'انتقال'),
        h('span', { style: { flex: 1 } }), h('button', { class: 'btn btn-soft btn-sm', onclick: () => { closeSheet(); closeReader(); } }, h('span', { html: icon('list') }), ' الفهرس')),
      results) });
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
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'الوضع الليلي للمصحف'), h('div', { class: 'desc' }, 'صفحة داكنة مريحة للعين')), switchEl(reader.isNight, (v) => reader.setNight(v, true))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'لون الورق'), h('div', { class: 'desc' }, 'كريمي كالمصحف المطبوع أو أبيض')), h('div', { class: 'segmented', style: { minWidth: '150px' } }, ...[['cream', 'كريمي'], ['white', 'أبيض']].map(([k, l]) => h('button', { class: (s.paper || 'cream') === k ? 'active' : '', onclick: (e) => { saveQ({ paper: k }); reader.setPaper(k); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.currentTarget)); } }, l)))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'متابعة التلاوة بقلب الصفحات'), h('div', { class: 'desc' }, 'الانتقال تلقائيًا إلى صفحة الآية الجارية')), switchEl(s.follow, (v) => saveQ({ follow: v }))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'في المراجعة: إظهار الكلمة الحالية فقط'), h('div', { class: 'desc' }, 'الكلمات السابقة تبقى مخفية كما في تطبيقات الحفظ')), switchEl(s.hifzOnlyCurrent, (v) => { saveQ({ hifzOnlyCurrent: v }); const el = reader.pageEl(page()); if (el) el.classList.toggle('only-current', v); })),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'طريقة العرض'), h('div', { class: 'desc' }, 'صفحات المصحف المطبوع، أو نص متدفق بحجم خط قابل للتغيير')), h('div', { class: 'segmented', style: { minWidth: '170px' } }, ...[['pages', 'صفحات'], ['text', 'نص']].map(([k, l]) => h('button', { class: (s.view || 'pages') === k ? 'active' : '', onclick: (e) => { saveQ({ view: k }); reader.setTextMode(k === 'text'); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.currentTarget)); const sr = document.getElementById('text-size-row'); if (sr) sr.hidden = k !== 'text'; } }, l)))),
      h('div', { class: 'setting-row', id: 'text-size-row', hidden: (s.view || 'pages') !== 'text' }, h('div', { class: 'label' }, 'حجم الخط (وضع النص)'), h('div', { class: 'text-scale-ctl' },
        h('button', { onclick: () => setScale(-0.1) }, 'أ-'), h('button', { onclick: () => setScale(0.1) }, 'أ+'))),
      fontsRow,
      h('p', { class: 'tiny' }, 'الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر. النص: Tanzil. التلاوات: Islamic Network. انقر الصفحة لإظهار الأدوات، وانقر مرتين للتنقل والبحث، واضغط مطوّلًا على آية لقائمتها.')) });
  }

  function setScale(d) { const v = Math.min(1.8, Math.max(0.7, +((q().fontScale || 1) + d).toFixed(2))); saveQ({ fontScale: v }); document.documentElement.style.setProperty('--quran-scale', String(v)); reader.relayout(); }

  /* ---------- التلاوة ---------- */
  function playFrom(n, scope) {
    const a = getAyah(n); let queue;
    if (scope === 'single') queue = [n];
    else if (scope === 'page') queue = pageAyahs(a.page).map((x) => x.n);
    else queue = surahAyahs(a.surah).filter((x) => x.n >= n).map((x) => x.n);
    player.reciter = q().reciter; player.repeatAyah = q().repeatAyah || 1; player.repeatRange = !!q().repeatRange; player.setRate(q().rate || 1);
    player.play(queue, 0, { label: (m) => refLabel(getAyah(m)) });
  }
  player.on('ayah', ({ ayah }) => {
    playingAyah = ayah; const a = getAyah(ayah);
    reader.clearMarks('hl'); reader.mark(ayah, 'hl');
    if (reader.isOpen && q().follow && a.page !== page() && !hifz) reader.goto(a.page, { smooth: true });
    renderAudioBar();
  });
  player.on('state', (st) => { if (st === 'stopped' || st === 'ended') { playingAyah = null; reader.clearMarks('hl'); } renderAudioBar(); });
  player.on('time', ({ t, d }) => { const bar = document.querySelector('.audio-bar .bar i'); if (bar && d) bar.style.width = `${(t / d) * 100}%`; });
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
        h('div', {}, h('div', { class: 'who' }, rec.name), h('div', { class: 'where' }, `${refLabel(a)} · ${app.num(player.index + 1)}/${app.num(player.queue.length)}`)),
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
  function startHifz(fromAyah) {
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
    if (!isSpeechSupported()) toast('التعرّف على الصوت غير متاح في هذا المتصفح — انقر الصفحة لكشف الكلمة التالية', 4500);
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
  function onHifzTap() { if (!hifz) return; const i = hifz.matcher.hint(); if (i !== null) { hifz.hints++; reveal([i]); } }
  function onHifzDone() {
    stopSpeech();
    const m = hifz.matcher;
    toast(`أتممت الصفحة ✓ كلمات صحيحة: ${app.num(m.matched)} · تلميحات: ${app.num(hifz.hints)}`, 5000);
    drawHifzPanel(); // لا انتقال تلقائي: زر «الصفحة التالية» في اللوحة
  }
  function drawHifzPanel() {
    if (!hifz) return;
    const m = hifz.matcher; const cur = m.done ? null : hifz.words[m.pos];
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
            for (const alts of finals) { const words = alts[0].split(/\s+/).filter(Boolean); const fresh = words.slice(hifz.fed || 0).join(' '); if (fresh) { const r = hifz.matcher.feed(fresh); if (!r.length && alts[1]) reveal(hifz.matcher.feed(alts[1].split(/\s+/).slice(hifz.fed || 0).join(' '))); else reveal(r); } }
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
    const m = location.hash.match(/^#\/quran\?p=(\d+)/);
    if (m && +m[1] >= 1 && +m[1] <= TOTAL_PAGES) { if (!(await ensureLoaded())) return; indexScreen(); if (!reader.isOpen) { reader.show(+m[1]); saveLastRead(null); } }
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
