/**
 * شاشة المصحف: فهرس السور/الأجزاء/العلامات، قارئ بصفحات مصحف المدينة، تلاوة آية بآية مع تظليل وتكرار،
 * حفظ موضع القراءة والعلامات، ووضع مراجعة الحفظ (إخفاء الصفحة وكشف الكلمات المنطوقة عبر التعرّف على الصوت أو النقر).
 */
import { h, icon, render, openSheet, closeSheet, toast, copyText, shareText, vibrate, switchEl } from './components.js';
import { loadQuran, isLoaded, pageAyahs, surahAyahs, surahInfo, surahsStartingOn, pageLabel, getAyah, getAyahBySurah, tokenize, HifzMatcher, searchText, refLabel, ayahMarker, SURAHS, JUZ_STARTS, TOTAL_PAGES, BASMALA } from '../core/quran.js';
import { AyahPlayer, RECITERS } from '../platform/audio.js';
import { SpeechListener, isSpeechSupported } from '../platform/speech.js';

const player = new AyahPlayer();

export function mount(container, app) {
  let mode = 'index'; let page = 1; let indexTab = 'surahs'; let query = '';
  let selectedAyah = null; let playingAyah = null; let hifz = null; let speech = null;
  let els = {}; let touchX = null;
  const q = () => app.settings.quran;
  const saveQ = (patch) => app.update({ quran: patch });

  /* ---------- تحميل ---------- */
  async function ensureLoaded() {
    if (isLoaded()) return true;
    render(container, h('div', { class: 'card', style: { textAlign: 'center', padding: '40px 16px' } }, h('span', { class: 'spinner' }), h('p', { class: 'muted', style: { marginTop: '10px' } }, 'جارٍ تحميل نص المصحف…')));
    try { await loadQuran(); return true; }
    catch (e) { render(container, h('div', { class: 'card' }, h('div', { class: 'notice danger' }, h('span', { html: icon('warning') }), 'تعذّر تحميل نص المصحف. يلزم اتصال بالإنترنت لأول مرة فقط.'), h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '10px' }, onclick: build }, 'إعادة المحاولة'))); return false; }
  }

  /* ---------- الفهرس ---------- */
  function indexScreen() {
    const last = q().lastRead;
    const input = h('input', { class: 'input', type: 'search', placeholder: 'ابحث عن سورة أو آية…', value: query });
    input.addEventListener('input', () => { query = input.value; drawList(); });
    const listEl = h('div', {});
    const drawList = () => {
      const s = query.trim();
      if (s.length >= 2 && !/^\d+$/.test(s)) {
        const surahHits = SURAHS.filter((x) => x.plain.includes(s.replace(/[أإآ]/g, 'ا')) || x.name.includes(s) || x.en.toLowerCase().includes(s.toLowerCase()));
        const ayahHits = searchText(s, 30);
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
          : h('div', { class: 'empty' }, 'لا علامات بعد — اضغط على آية في القارئ ثم «إضافة علامة»'));
      }
    };
    render(container,
      last ? h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'متابعة القراءة'), h('b', {}, `${surahInfo(last.surah).name} · آية ${app.num(last.ayah)}`), h('small', {}, `الصفحة ${app.num(last.page)} · الجزء ${app.num(pageLabel(last.page).juz)}`)),
        h('button', { class: 'btn btn-sm', onclick: () => openReader(last.page, getAyahBySurah(last.surah, last.ayah)) }, h('span', { html: icon('play') }), ' متابعة'))
        : h('div', { class: 'resume-card' }, h('div', {}, h('small', {}, 'ابدأ القراءة'), h('b', {}, 'المصحف الشريف'), h('small', {}, 'رواية حفص عن عاصم · 604 صفحات')), h('button', { class: 'btn btn-sm', onclick: () => openReader(1) }, 'فتح')),
      h('div', { class: 'search' }, input, h('span', { html: icon('search') })),
      h('div', { class: 'segmented', style: { marginBottom: '10px' } },
        ...[['surahs', 'السور'], ['juz', 'الأجزاء'], ['bookmarks', 'العلامات']].map(([k, l]) => h('button', { class: indexTab === k ? 'active' : '', onclick: () => { indexTab = k; drawList(); container.querySelectorAll('.segmented button').forEach((b) => b.classList.toggle('active', b.textContent === l)); } }, l))),
      h('div', { class: 'card', style: { padding: '4px 10px' } }, listEl));
    drawList();
  }
  const surahRow = (s) => h('button', { class: 'surah-row', onclick: () => openReader(s.page, getAyahBySurah(s.n, 1)) },
    h('span', { class: 'num' }, app.num(s.n)), h('span', {}, h('div', { class: 'nm' }, `سورة ${s.name}`), h('div', { class: 'info' }, `${s.type} · ${app.num(s.ayahs)} آية`)), h('span', { class: 'pg' }, `ص ${app.num(s.page)}`));

  /* ---------- القارئ ---------- */
  function openReader(p, ayah = null) { mode = 'reader'; page = p; selectedAyah = ayah ? ayah.n : null; hifz = null; stopSpeech(); readerScreen(); if (ayah) setTimeout(() => scrollToAyah(ayah.n), 60); saveLastRead(ayah); }
  function saveLastRead(ayah) {
    const a = ayah || pageAyahs(page)[0]; if (!a) return;
    saveQ({ lastRead: { page: a.page, surah: a.surah, ayah: a.ayah, at: Date.now() } });
  }
  function gotoPage(p, { keepHifz = false } = {}) {
    if (p < 1 || p > TOTAL_PAGES) return;
    page = p; selectedAyah = null;
    if (!keepHifz) { hifz = null; stopSpeech(); }
    readerScreen(); saveLastRead(null); window.scrollTo({ top: 0 });
  }
  function isBookmarked(n) { const a = getAyah(n); return (q().bookmarks || []).some((b) => b.surah === a.surah && b.ayah === a.ayah); }
  function toggleBookmark(n) {
    const a = getAyah(n); const bms = q().bookmarks || [];
    if (isBookmarked(n)) { saveQ({ bookmarks: bms.filter((b) => !(b.surah === a.surah && b.ayah === a.ayah)) }); toast('أُزيلت العلامة'); }
    else { saveQ({ bookmarks: [...bms, { surah: a.surah, ayah: a.ayah, page: a.page, at: Date.now() }] }); toast(`أُضيفت علامة عند ${refLabel(a)}`); }
    readerScreen();
  }

  function renderAyah(a) {
    const words = tokenize(a.text);
    const span = h('span', { class: `ayah ${playingAyah === a.n ? 'playing' : ''} ${selectedAyah === a.n ? 'selected' : ''}`, dataset: { n: String(a.n) }, onclick: () => ayahActions(a) });
    let spokenIdx = 0;
    words.forEach((w, i) => {
      const cls = w.spoken ? 'w spoken' : 'w mark';
      const el = h('span', { class: cls }, w.raw);
      if (w.spoken) { el.dataset.k = String(spokenIdx++); }
      span.append(el, i < words.length - 1 ? ' ' : '');
    });
    if (a.sajda) span.append(h('span', { class: 'sajda-mark', title: 'سجدة تلاوة' }, '۩'));
    span.append(' ', h('span', { class: 'end' }, `۝${ayahMarker(a.ayah, 'arab')}`), ' ');
    return span;
  }

  function readerScreen() {
    const ayahs = pageAyahs(page); if (!ayahs.length) return;
    const starts = surahsStartingOn(page); const lbl = pageLabel(page);
    const first = ayahs[0];
    // العنوان: سورة الآية المقصودة إن فُتحت الصفحة من الفهرس، وإلا سورة أول آية في الصفحة
    const titleSurah = selectedAyah && getAyah(selectedAyah) && getAyah(selectedAyah).page === page ? getAyah(selectedAyah).surah : first.surah;
    const title = `سورة ${surahInfo(titleSurah).name}`;
    const mushaf = h('div', { class: `mushaf ${hifz ? 'hifz' : ''} ${hifz && q().hifzOnlyCurrent ? 'only-current' : ''}` });
    let currentSurah = null;
    for (const a of ayahs) {
      if (a.ayah === 1 && starts.includes(a.surah)) {
        const s = surahInfo(a.surah);
        mushaf.append(h('div', { class: 'surah-head' }, `سورة ${s.name}`, h('small', {}, `${s.type} · ${app.num(s.ayahs)} آية`)));
        if (a.surah !== 1 && a.surah !== 9) mushaf.append(h('div', { class: 'basmala' }, BASMALA));
      }
      currentSurah = a.surah;
      mushaf.append(renderAyah(a));
    }
    const wrap = h('div', { class: 'mushaf-wrap' }, mushaf,
      h('div', { class: 'page-foot' }, h('span', {}, `الجزء ${app.num(lbl.juz)} · الحزب ${app.num(lbl.hizb)}`), h('span', {}, `صفحة ${app.num(page)} / ${app.num(TOTAL_PAGES)}`)));
    wrap.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 70) gotoPage(dx > 0 ? page + 1 : page - 1, { keepHifz: false }); }, { passive: true });
    const pageInput = h('input', { class: 'input ltr', type: 'number', min: 1, max: TOTAL_PAGES, value: page, 'aria-label': 'رقم الصفحة' });
    pageInput.addEventListener('change', () => gotoPage(Math.min(TOTAL_PAGES, Math.max(1, +pageInput.value || 1))));
    els = {};
    els.hifzPanel = h('div', {});
    render(container,
      h('div', { class: 'quran-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'الفهرس', onclick: () => { mode = 'index'; stopSpeech(); hifz = null; indexScreen(); } }, h('span', { html: icon('list') })),
        h('div', { style: { flex: 1, textAlign: 'center' } }, h('div', { class: 'title' }, title), h('div', { class: 'sub' }, `الجزء ${app.num(lbl.juz)} · صفحة ${app.num(page)}`)),
        h('div', { class: 'actions' },
          h('button', { class: `icon-btn ${hifz ? 'fav' : ''}`, 'aria-label': 'وضع مراجعة الحفظ', title: 'مراجعة الحفظ', style: hifz ? { color: 'var(--primary)', borderColor: 'var(--primary)' } : null, onclick: () => (hifz ? exitHifz() : startHifz(ayahs[0].n)) }, h('span', { html: icon(hifz ? 'eye' : 'eyeOff') })),
          h('button', { class: 'icon-btn', 'aria-label': 'خيارات', onclick: readerOptions }, h('span', { html: icon('settings') })))),
      els.hifzPanel, wrap,
      h('div', { class: 'page-nav' },
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => gotoPage(page - 1) }, '‹ السابقة'),
        h('div', { class: 'row', style: { gap: '6px' } }, pageInput, h('button', { class: 'btn btn-soft btn-sm', onclick: () => playFrom(ayahs[0].n, 'page') }, h('span', { html: icon('play') }), ' الصفحة')),
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => gotoPage(page + 1) }, 'التالية ›')));
    els.mushaf = mushaf;
    if (hifz) drawHifzPanel();
    renderAudioBar();
  }
  function scrollToAyah(n) { const el = container.querySelector(`.ayah[data-n="${n}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  function ayahActions(a) {
    if (hifz) return; // في وضع المراجعة النقر يكشف الكلمة
    selectedAyah = a.n; container.querySelectorAll('.ayah.selected').forEach((e) => e.classList.remove('selected'));
    const el = container.querySelector(`.ayah[data-n="${a.n}"]`); if (el) el.classList.add('selected');
    const txt = `${a.text} ﴿${a.ayah}﴾\n[${refLabel(a)}]`;
    openSheet({ title: refLabel(a), content: h('div', { class: 'stack' },
      h('p', { class: 'matn', style: { fontFamily: "'Amiri Quran', Amiri, serif", fontSize: '19px', lineHeight: '2.1' } }, a.text),
      h('div', { class: 'grid-2' },
        h('button', { class: 'btn btn-primary', onclick: () => { closeSheet(); playFrom(a.n, 'surah'); } }, h('span', { html: icon('play') }), ' تشغيل من هنا'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); player.repeatAyah = 3; saveQ({ repeatAyah: 3 }); playFrom(a.n, 'single'); } }, h('span', { html: icon('repeat') }), ' تكرار الآية ×3'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); toggleBookmark(a.n); } }, h('span', { html: icon(isBookmarked(a.n) ? 'bookmarkFill' : 'bookmark') }), isBookmarked(a.n) ? ' إزالة العلامة' : ' إضافة علامة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); saveLastRead(a); toast(`حُفظ موضع القراءة عند ${refLabel(a)}`); } }, h('span', { html: icon('check') }), ' موضع القراءة'),
        h('button', { class: 'btn btn-outline', onclick: () => { closeSheet(); startHifz(a.n); } }, h('span', { html: icon('eyeOff') }), ' مراجعة الحفظ من هنا'),
        h('button', { class: 'btn btn-outline', onclick: () => shareText('آية من القرآن الكريم', txt) }, h('span', { html: icon('share') }), ' مشاركة'),
        h('button', { class: 'btn btn-outline', onclick: () => copyText(txt) }, h('span', { html: icon('copy') }), ' نسخ'))),
      onClose: () => { const e2 = container.querySelector(`.ayah[data-n="${a.n}"]`); if (e2 && !hifz) e2.classList.remove('selected'); } });
  }

  function readerOptions() {
    const s = q();
    const jump = (surah, ayah) => { const a = getAyahBySurah(surah, ayah) || getAyahBySurah(surah, 1); closeSheet(); openReader(a.page, a); };
    const surahSel = h('select', { class: 'input' }, ...SURAHS.map((x) => h('option', { value: x.n }, `${x.n}. ${x.name}`)));
    const ayahIn = h('input', { class: 'input ltr', type: 'number', min: 1, value: 1, placeholder: 'آية' });
    const juzSel = h('select', { class: 'input' }, h('option', { value: '' }, 'الجزء…'), ...JUZ_STARTS.map((j) => h('option', { value: j.page }, `الجزء ${j.juz}`)));
    juzSel.addEventListener('change', () => { if (juzSel.value) { closeSheet(); gotoPage(+juzSel.value); } });
    openSheet({ title: 'خيارات المصحف', content: h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, 'الانتقال إلى سورة وآية'), h('div', { class: 'row' }, surahSel, ayahIn, h('button', { class: 'btn btn-primary btn-sm', onclick: () => jump(+surahSel.value, +ayahIn.value || 1) }, 'انتقال'))),
      h('div', { class: 'field' }, h('label', {}, 'الانتقال إلى جزء'), juzSel),
      h('div', { class: 'setting-row' }, h('div', { class: 'label' }, 'حجم الخط'), h('div', { class: 'text-scale-ctl' },
        h('button', { onclick: () => setScale(-0.1) }, 'أ-'), h('button', { onclick: () => setScale(0.1) }, 'أ+'))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'متابعة التلاوة بقلب الصفحات'), h('div', { class: 'desc' }, 'الانتقال تلقائيًا إلى صفحة الآية الجارية')), switchEl(s.follow, (v) => saveQ({ follow: v }))),
      h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, 'في المراجعة: إظهار الكلمة الحالية فقط'), h('div', { class: 'desc' }, 'الكلمات السابقة تبقى مخفية كما في تطبيقات الحفظ')), switchEl(s.hifzOnlyCurrent, (v) => { saveQ({ hifzOnlyCurrent: v }); if (els.mushaf) els.mushaf.classList.toggle('only-current', v); })),
      h('p', { class: 'tiny' }, 'النص: مصحف المدينة برواية حفص عن عاصم (Tanzil.net). التلاوات: Islamic Network. اسحب الصفحة يمينًا ويسارًا للتنقل.')) });
  }
  function setScale(d) { const v = Math.min(1.8, Math.max(0.7, +((q().fontScale || 1) + d).toFixed(2))); saveQ({ fontScale: v }); document.documentElement.style.setProperty('--quran-scale', String(v)); }

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
    if (mode === 'reader' && q().follow && a.page !== page && !hifz) { page = a.page; readerScreen(); }
    container.querySelectorAll('.ayah.playing').forEach((e) => e.classList.remove('playing'));
    const el = container.querySelector(`.ayah[data-n="${ayah}"]`); if (el) { el.classList.add('playing'); if (mode === 'reader') el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    renderAudioBar();
  });
  player.on('state', (st) => { if (st === 'stopped' || st === 'ended') { playingAyah = null; container.querySelectorAll('.ayah.playing').forEach((e) => e.classList.remove('playing')); } renderAudioBar(); });
  player.on('time', ({ t, d }) => { const bar = document.querySelector('.audio-bar .bar i'); if (bar && d) bar.style.width = `${(t / d) * 100}%`; });
  player.on('error', ({ ayah, code }) => { if (code !== 'play') toast('تعذّر تحميل التلاوة — تحقق من الاتصال بالإنترنت', 3500); });

  function renderAudioBar() {
    let bar = document.getElementById('audio-bar');
    if (!player.current) { if (bar) bar.remove(); document.body.classList.remove('has-audio'); return; }
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
        mode === 'reader' && a.page !== page ? h('button', { class: 'chip chip-btn', onclick: () => gotoPage(a.page) }, `الانتقال إلى ص ${app.num(a.page)}`) : null));
    if (!bar) { bar = h('div', { class: 'audio-bar', id: 'audio-bar', role: 'region', 'aria-label': 'مشغّل التلاوة' }); document.body.append(bar); }
    render(bar, content); document.body.classList.add('has-audio');
  }
  function pickReciter() {
    openSheet({ title: 'اختيار القارئ', content: h('div', { class: 'city-list' }, ...RECITERS.map((r) => h('button', { class: 'surah-row', onclick: () => { saveQ({ reciter: r.id }); player.setReciter(r.id); closeSheet(); renderAudioBar(); } },
      h('span', { class: 'num', html: icon(player.reciter === r.id ? 'check' : 'mic') }), h('span', {}, h('div', { class: 'nm' }, r.name))))) });
  }

  /* ---------- مراجعة الحفظ ---------- */
  function startHifz(fromAyah) {
    const ayahs = pageAyahs(page);
    // جمع الكلمات المنطوقة من آية البداية حتى نهاية الصفحة
    const words = []; // { n, k, norm, raw }
    for (const a of ayahs) {
      if (a.n < fromAyah) continue;
      const toks = tokenize(a.text).filter((w) => w.spoken);
      toks.forEach((w, k) => words.push({ n: a.n, k, norm: w.norm, raw: w.raw }));
    }
    hifz = { from: fromAyah, words, matcher: new HifzMatcher(words), listening: false, heard: '', hints: 0 };
    player.stop();
    readerScreen();
    // الآيات قبل البداية تبقى ظاهرة
    els.mushaf.querySelectorAll('.ayah').forEach((el) => { if (+el.dataset.n < fromAyah) el.querySelectorAll('.w.spoken').forEach((w) => w.classList.add('revealed')); });
    els.mushaf.addEventListener('click', onHifzTap);
    highlightCurrent();
    drawHifzPanel();
    if (!isSpeechSupported()) toast('التعرّف على الصوت غير متاح في هذا المتصفح — اضغط على الصفحة لكشف الكلمة التالية', 4500);
  }
  function exitHifz() { stopSpeech(); hifz = null; readerScreen(); }
  function wordEl(i) { const w = hifz.words[i]; return els.mushaf.querySelector(`.ayah[data-n="${w.n}"] .w.spoken[data-k="${w.k}"]`); }
  function highlightCurrent() {
    els.mushaf.querySelectorAll('.w.current').forEach((e) => e.classList.remove('current'));
    if (hifz.matcher.done) return;
    const el = wordEl(hifz.matcher.pos); if (el) el.classList.add('current');
  }
  function reveal(indices) {
    for (const i of indices) { const el = wordEl(i); if (el) { el.classList.add('revealed'); } }
    if (indices.length) { const last = wordEl(indices[indices.length - 1]); if (last) last.scrollIntoView({ block: 'center', behavior: 'smooth' }); vibrate(10); }
    highlightCurrent(); drawHifzPanel();
    if (hifz.matcher.done) onHifzDone();
  }
  function onHifzTap(e) { if (!hifz) return; e.preventDefault(); const i = hifz.matcher.hint(); if (i !== null) { hifz.hints++; reveal([i]); } }
  function onHifzDone() {
    stopSpeech();
    const m = hifz.matcher;
    toast(`أتممت الصفحة ✓ كلمات صحيحة: ${app.num(m.matched)} · تلميحات: ${app.num(hifz.hints)}`, 5000);
    if (page < TOTAL_PAGES) setTimeout(() => { if (hifz && page < TOTAL_PAGES) { const next = page + 1; gotoPage(next, { keepHifz: true }); startHifz(pageAyahs(next)[0].n); } }, 2500);
  }
  function drawHifzPanel() {
    if (!hifz || !els.hifzPanel) return;
    const m = hifz.matcher; const cur = m.done ? null : hifz.words[m.pos];
    const revealedLast = m.pos > 0 ? hifz.words[m.pos - 1] : null;
    const micBtn = h('button', { class: `btn ${hifz.listening ? 'btn-primary mic-btn listening' : 'btn-primary mic-btn'}`, onclick: toggleSpeech, disabled: !isSpeechSupported() },
      h('span', { html: icon(hifz.listening ? 'micOff' : 'mic') }), hifz.listening ? ' إيقاف الاستماع' : ' ابدأ التسميع');
    render(els.hifzPanel, h('div', { class: 'hifz-panel' },
      h('div', { class: 'row between' }, h('b', {}, 'مراجعة الحفظ'), h('span', { class: 'tiny' }, `${app.num(m.pos)} / ${app.num(hifz.words.length)} كلمة`)),
      h('div', { class: 'hifz-word' }, m.done ? h('span', {}, '✓ أحسنت') : revealedLast ? h('span', {}, revealedLast.raw) : h('small', {}, hifz.listening ? 'استمع… ابدأ التلاوة' : 'اضغط «ابدأ التسميع» أو انقر الصفحة لكشف كلمة')),
      h('div', { class: 'hifz-heard' }, hifz.heard),
      h('div', { class: 'hifz-progress' }, h('i', { style: { width: `${m.progress * 100}%` } })),
      h('div', { class: 'hifz-ctl' }, micBtn,
        h('button', { class: 'btn btn-outline', onclick: () => { const i = m.hint(); if (i !== null) { hifz.hints++; reveal([i]); } } }, h('span', { html: icon('eye') }), ' تلميح'),
        h('button', { class: 'btn btn-outline', onclick: () => { if (cur) { const idx = []; while (!m.done && hifz.words[m.pos].n === cur.n) idx.push(m.hint()); hifz.hints += idx.length; reveal(idx); } } }, 'كشف الآية')),
      !isSpeechSupported() ? h('div', { class: 'notice', style: { marginTop: '8px' } }, h('span', { html: icon('info') }), 'التعرّف على الصوت متاح في Chrome وSafari مع اتصال بالإنترنت. يمكنك المراجعة بالنقر على الصفحة لكشف الكلمة التالية.') : null));
  }
  function toggleSpeech() {
    if (!hifz) return;
    if (hifz.listening) { stopSpeech(); drawHifzPanel(); return; }
    try {
      speech = new SpeechListener({
        onResult: ({ finals, interim }) => {
          if (!hifz) return;
          hifz.heard = interim || hifz.heard;
          if (finals.length) { for (const alts of finals) { const r = hifz.matcher.feed(alts[0]); if (!r.length && alts[1]) reveal(hifz.matcher.feed(alts[1])); else reveal(r); } hifz.heard = finals.map((a) => a[0]).join(' '); }
          else if (interim) { // نستخدم النتائج المؤقتة لكشف أسرع (الكلمات المطابقة فقط)
            reveal(hifz.matcher.feed(interim));
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

  async function build() {
    if (!(await ensureLoaded())) return;
    document.documentElement.style.setProperty('--quran-scale', String(q().fontScale || 1));
    if (mode === 'reader') readerScreen(); else indexScreen();
  }
  app.on('change', () => { if (app.current === 'quran' && mode === 'index' && isLoaded()) indexScreen(); });
  build();
  return { refresh: build, show: () => { if (isLoaded()) { if (mode === 'index') indexScreen(); renderAudioBar(); } else build(); }, hide: () => { stopSpeech(); if (hifz) hifz.listening = false; } };
}
