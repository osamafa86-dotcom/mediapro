/**
 * حصن المسلم كاملًا: أقسام وأبواب مع بحث في العناوين والنصوص، وباب بعدّاد لكل ذكر وتلاوة صوتية ونسخ ومشاركة (نصًا أو صورة).
 * البيانات (js/data/hisn.js، نحو 65 KB) تُحمَّل كسولًا عند أول فتح، وتبقى متاحة دون اتصال عبر عامل الخدمة.
 */
import { h, icon, render, toast, vibrate, copyText, shareText } from './components.js';
import { normalizeArabic } from '../core/arabic.js';
import { openShareCardSheet } from './share-sheet.js';

let data = null;
async function loadData() { if (!data) data = await import('../data/hisn.js'); return data; }

export function mount(container, app) {
  let chapterId = null; let q = ''; let counts = {}; // counts: عدّ الجلسة لكل ذكر (لا يُحفظ)
  let audio = null; let playingId = null; let lastSig = '';
  const favs = () => new Set(app.settings.hisnFavorites || []);
  const totalItems = () => data.HISN_CHAPTERS.reduce((n, c) => n + c.items.length, 0);
  const sig = () => JSON.stringify([app.settings.hisnFavorites, app.numerals, app.settings.textScale]);

  function chapterFromHash() { const m = location.hash.match(/[?&]c=(\d+)/); return m ? Number(m[1]) : null; }
  function setHash(id) { const hash = id ? `#/hisn?c=${id}` : '#/hisn'; if (location.hash !== hash) history.replaceState(null, '', hash); }

  /* ---------- الصوت (تلاوة الذكر من موقع الكتاب، عند الطلب) ---------- */
  function paintAudioBtn(btn, on) { btn.classList.toggle('playing', on); btn.setAttribute('aria-label', on ? 'إيقاف التلاوة' : 'استماع'); render(btn, h('span', { html: icon(on ? 'pause' : 'play') })); }
  function clearPlaying() { playingId = null; container.querySelectorAll('.audio-btn.playing').forEach((b) => paintAudioBtn(b, false)); }
  function stopAudio() { if (audio) { try { audio.pause(); } catch { /* تجاهل */ } } clearPlaying(); }
  function toggleAudio(item, btn) {
    if (playingId === item.id) { stopAudio(); return; }
    stopAudio();
    if (!audio) {
      audio = new Audio(); audio.preload = 'none';
      audio.addEventListener('ended', clearPlaying);
      audio.addEventListener('error', () => { if (playingId) toast('تعذّر تشغيل التلاوة — تحقق من الاتصال بالإنترنت', 3000); clearPlaying(); });
    }
    audio.src = data.hisnAudioUrl(item.id); playingId = item.id; paintAudioBtn(btn, true);
    audio.play().catch(() => clearPlaying());
  }

  function richText(t) { const frag = document.createDocumentFragment(); for (const part of t.split(/(﴿[^﴾]*﴾)/g)) { if (!part) continue; frag.append(part.startsWith('﴿') ? h('span', { class: 'ayah' }, part) : part); } return frag; }
  const repeatLabel = (n) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : n <= 10 ? `${app.num(n)} مرات` : `${app.num(n)} مرة`);
  const countLabel = (n) => (n === 1 ? 'ذكر واحد' : n === 2 ? 'ذكران' : n <= 10 ? `${app.num(n)} أذكار` : `${app.num(n)} ذكرًا`);

  /* ---------- بطاقة ذكر ---------- */
  function itemCard(item, chapter) {
    const tgt = item.repeat; let count = counts[item.id] || 0;
    const btn = h('button', { class: `count-btn ${count >= tgt ? 'done' : ''}`, 'aria-label': 'عدّ' });
    const paint = () => render(btn, count >= tgt ? h('span', { html: icon('check') }) : h('span', {}, app.num(Math.max(0, tgt - count)), h('small', {}, tgt === 1 ? 'مرة' : 'متبقٍ')));
    paint();
    const card = h('article', { class: `card dhikr ${count >= tgt ? 'done' : ''}` });
    const tap = () => {
      if (count >= tgt) { count = 0; counts[item.id] = 0; card.classList.remove('done'); paint(); return; } // نقرة بعد الاكتمال تعيد العدّ
      count++; counts[item.id] = count; vibrate(count >= tgt ? [40, 40, 40] : 15); paint(); if (count >= tgt) card.classList.add('done');
    };
    btn.addEventListener('click', tap);
    const shareTxt = `${item.text}\n\n— حصن المسلم: ${chapter.title}`;
    let audioBtn = null;
    if (item.audio !== false) { audioBtn = h('button', { class: 'icon-btn audio-btn', title: 'استماع' }); paintAudioBtn(audioBtn, false); audioBtn.addEventListener('click', () => toggleAudio(item, audioBtn)); }
    render(card,
      h('p', { class: 'text', lang: 'ar' }, richText(item.text)),
      h('div', { class: 'dhikr-foot' },
        h('div', {},
          h('div', { class: 'tiny' }, `يُقال ${repeatLabel(tgt)}`),
          h('div', { class: 'dhikr-actions' },
            audioBtn,
            h('button', { class: 'icon-btn', 'aria-label': 'نسخ', title: 'نسخ', onclick: () => copyText(shareTxt) }, h('span', { html: icon('copy') })),
            h('button', { class: 'icon-btn', 'aria-label': 'مشاركة', title: 'مشاركة', onclick: () => shareText('من حصن المسلم', shareTxt) }, h('span', { html: icon('share') })),
            h('button', { class: 'icon-btn', 'aria-label': 'مشاركة كصورة', title: 'مشاركة كصورة', onclick: () => openShareCardSheet({ title: `حصن المسلم · ${chapter.title}`, text: item.text, footer: tgt > 1 ? `يُقال ${repeatLabel(tgt)}` : '', filename: `hisn-${item.id}.png`, shareText: shareTxt }) }, h('span', { html: icon('image') })))),
        btn));
    card.addEventListener('click', (e) => { if (e.target === card || e.target.classList.contains('text') || e.target.classList.contains('ayah')) tap(); });
    return card;
  }

  /* ---------- شاشة الباب ---------- */
  function chapterScreen(id) {
    const ch = data.hisnChapter(id); if (!ch) { chapterId = null; listScreen(); return; }
    const idx = data.HISN_CHAPTERS.indexOf(ch); const prev = data.HISN_CHAPTERS[idx - 1], next = data.HISN_CHAPTERS[idx + 1];
    const fav = favs().has(ch.id);
    render(container,
      h('div', { class: 'hisn-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'رجوع إلى الأبواب', onclick: openList }, h('span', { html: icon('back') })),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('h2', { class: 'hisn-title' }, ch.title), h('div', { class: 'tiny' }, `الباب ${app.num(ch.id)} · ${countLabel(ch.items.length)}`)),
        h('button', { class: `icon-btn ${fav ? 'fav' : ''}`, 'aria-label': fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة', onclick: () => { const s = favs(); if (s.has(ch.id)) { s.delete(ch.id); toast('أُزيل الباب من المفضلة'); } else { s.add(ch.id); toast('أُضيف الباب إلى المفضلة'); } app.replace('hisnFavorites', [...s]); } }, h('span', { html: icon(fav ? 'heartFill' : 'heart') }))),
      ch.id === 27 ? h('button', { class: 'btn btn-soft btn-block', style: { marginBottom: '12px' }, onclick: () => app.navigate('adhkar') }, 'شاشة أذكار الصباح والمساء بعدّاد يومي محفوظ') : null,
      ...ch.items.map((it) => itemCard(it, ch)),
      h('div', { class: 'grid-2 hisn-nav', style: { marginTop: '4px' } },
        prev ? h('button', { class: 'btn btn-outline', onclick: () => openChapter(prev.id) }, h('span', { html: icon('back') }), h('span', { class: 'lbl' }, prev.title)) : h('span'),
        next ? h('button', { class: 'btn btn-outline', onclick: () => openChapter(next.id) }, h('span', { class: 'lbl' }, next.title), h('span', { html: icon('chevron') })) : h('span')),
      h('p', { class: 'tiny', style: { textAlign: 'center', marginTop: '10px' } }, 'حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني. التلاوة الصوتية تُجلب من موقع الكتاب عند الطلب فقط.'));
    window.scrollTo({ top: 0 });
  }

  /* ---------- شاشة الأبواب والبحث ---------- */
  function chapterRow(c) {
    return h('button', { class: 'surah-row hisn-row', onclick: () => openChapter(c.id) },
      h('span', { class: 'num' }, app.num(c.id)),
      h('span', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'nm' }, c.title), h('div', { class: 'tiny' }, countLabel(c.items.length))),
      favs().has(c.id) ? h('span', { class: 'hisn-fav', html: icon('heartFill') }) : null);
  }
  function sectionsList() {
    const f = [...favs()].map((id) => data.hisnChapter(id)).filter(Boolean);
    const out = [];
    if (f.length) out.push(h('div', { class: 'card hisn-sec' }, h('div', { class: 'hisn-sec-title' }, h('span', { html: icon('heartFill') }), ' المفضلة'), ...f.map(chapterRow)));
    for (const s of data.HISN_SECTIONS) out.push(h('div', { class: 'card hisn-sec' }, h('div', { class: 'hisn-sec-title' }, s.title), ...s.chapters.map((id) => chapterRow(data.hisnChapter(id)))));
    out.push(h('p', { class: 'tiny', style: { textAlign: 'center' } }, `${app.num(data.HISN_CHAPTERS.length)} بابًا و${app.num(totalItems())} ذكرًا من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بنصوص الطبعة الرسمية وتشكيلها.`));
    return out;
  }
  function listScreen() {
    const input = h('input', { class: 'input', type: 'search', placeholder: 'ابحث في الأبواب والأذكار…', value: q, 'aria-label': 'بحث في حصن المسلم' });
    input.addEventListener('input', () => { q = input.value; drawResults(); });
    const results = h('div', {});
    const drawResults = () => {
      const nq = normalizeArabic(q);
      if (nq.length < 2) { render(results, ...sectionsList()); return; }
      const chapters = data.HISN_CHAPTERS.filter((c) => normalizeArabic(c.title).includes(nq));
      const items = []; for (const c of data.HISN_CHAPTERS) for (const it of c.items) { if (items.length >= 60) break; if (normalizeArabic(it.text).includes(nq)) items.push({ it, c }); }
      render(results,
        chapters.length ? h('div', { class: 'card hisn-sec' }, h('div', { class: 'hisn-sec-title' }, `أبواب (${app.num(chapters.length)})`), ...chapters.map(chapterRow)) : null,
        items.length ? h('div', { class: 'card hisn-sec' }, h('div', { class: 'hisn-sec-title' }, `أذكار (${app.num(items.length)}${items.length >= 60 ? '+' : ''})`),
          ...items.map(({ it, c }) => h('button', { class: 'surah-row hisn-row', onclick: () => openChapter(c.id) }, h('span', { class: 'num' }, app.num(it.id)), h('span', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'nm hisn-snippet', lang: 'ar' }, it.text.length > 110 ? it.text.slice(0, 110) + '…' : it.text), h('div', { class: 'tiny' }, c.title))))) : null,
        !chapters.length && !items.length ? h('div', { class: 'empty' }, 'لا نتائج — جرّب كلمة أخرى') : null);
    };
    render(container, h('div', { class: 'search' }, input, h('span', { html: icon('search') })), results);
    drawResults();
  }

  async function openChapter(id) { await loadData(); stopAudio(); chapterId = Number(id); counts = {}; setHash(chapterId); chapterScreen(chapterId); }
  async function openList() { await loadData(); stopAudio(); chapterId = null; setHash(null); listScreen(); }
  async function build() {
    if (!data) {
      render(container, h('div', { class: 'empty' }, 'جارٍ تحميل حصن المسلم…'));
      try { await loadData(); } catch { render(container, h('div', { class: 'empty' }, 'تعذّر تحميل حصن المسلم'), h('button', { class: 'btn btn-outline btn-block', onclick: build }, 'إعادة المحاولة')); return; }
    }
    lastSig = sig();
    if (chapterId) chapterScreen(chapterId); else listScreen();
  }
  app.on('change', () => { if (app.current !== 'hisn' || !data) return; const s = sig(); if (s !== lastSig) { lastSig = s; if (chapterId) chapterScreen(chapterId); else listScreen(); } });
  return {
    refresh: build,
    show: () => { const c = chapterFromHash(); if (c) chapterId = c; build(); },
    hide: stopAudio,
    /** زر الرجوع (Android): من الباب إلى القائمة */
    back: () => { if (chapterId) { openList(); return true; } return false; },
    openChapter,
  };
}
