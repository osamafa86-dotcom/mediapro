/**
 * شاشة الأحاديث: مجموعتان — مختارات من الصحيحين (حديث اليوم، بحث، تصنيفات، مفضّلة) والأربعون النووية كاملة —
 * مع نسخ ومشاركة (نصًا أو صورة).
 */
import { h, icon, render, copyText, shareText } from './components.js';
import { HADITHS, HADITH_TOPICS, hadithOfDay, hadithReference } from '../data/hadith.js';
import { NAWAWI } from '../data/nawawi.js';
import { normalizeArabic } from '../core/arabic.js';
import { openShareCardSheet } from './share-sheet.js';

// تطبيع موحّد (نفس الذي تستخدمه اختبارات البيانات): البحث بـ«صلى الله عليه وسلم» يجد المتون المكتوبة بـ ﷺ والعكس
const strip = (s) => normalizeArabic(s).toLowerCase();

export function mount(container, app) {
  let book = 'sahih'; let topic = 'all'; let q = ''; let showAll = false;
  const favSet = () => new Set(app.settings.favorites || []);
  function toggleFav(id) { const list = favSet(); list.has(id) ? list.delete(id) : list.add(id); app.update({ favorites: [...list] }); }
  function actions(id, text, shareTitle, card) {
    const fav = favSet().has(id);
    return h('div', { class: 'hadith-actions' },
      h('button', { class: `icon-btn ${fav ? 'fav' : ''}`, 'aria-label': fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة', title: 'المفضلة', onclick: () => toggleFav(id) }, h('span', { html: icon(fav ? 'heartFill' : 'heart') })),
      h('button', { class: 'icon-btn', 'aria-label': 'نسخ', title: 'نسخ', onclick: () => copyText(text) }, h('span', { html: icon('copy') })),
      h('button', { class: 'icon-btn', 'aria-label': 'مشاركة', title: 'مشاركة', onclick: () => shareText(shareTitle, text) }, h('span', { html: icon('share') })),
      h('button', { class: 'icon-btn', 'aria-label': 'مشاركة كصورة', title: 'مشاركة كصورة', onclick: () => openShareCardSheet(card) }, h('span', { html: icon('image') })));
  }

  function card(hd, daily = false) {
    const text = `${hd.text}\n\nرواه ${hd.narrator} — ${hadithReference(hd)} (${hd.grade})`;
    return h('article', { class: `card hadith ${daily ? 'daily' : ''}` },
      daily ? h('div', { class: 'chip gold', style: { marginBottom: '8px' } }, '✦ حديث اليوم') : null,
      h('p', { class: 'matn', lang: 'ar' }, hd.text),
      h('div', { class: 'narr' }, `عن ${hd.narrator}`),
      h('div', { class: 'refline' },
        h('div', { class: 'chips' }, h('span', { class: `chip ${hd.grade === 'متفق عليه' ? 'ok' : ''}` }, hd.grade), h('span', { class: 'chip' }, hadithReference(hd)), h('span', { class: 'chip' }, hd.topic)),
        actions(hd.id, text, 'حديث شريف', { title: `حديث شريف · ${hd.grade}`, text: hd.text, footer: `عن ${hd.narrator} — ${hadithReference(hd)}`, filename: `hadith-${hd.id}.png`, shareText: text })),
      h('details', { class: 'more' }, h('summary', {}, 'الفائدة من الحديث'), h('div', { class: 'lesson' }, hd.lesson)));
  }
  function nawawiCard(n) {
    const id = `nawawi-${n.n}`; const text = `${n.text}\n\n${n.takhrij}\n— الأربعون النووية، ${n.title}`;
    return h('article', { class: 'card hadith nawawi' },
      h('div', { class: 'chip gold', style: { marginBottom: '8px' } }, n.title),
      h('p', { class: 'matn', lang: 'ar' }, ...n.text.split('\n').flatMap((p, i) => (i ? [h('br'), p] : [p]))),
      h('div', { class: 'narr' }, n.takhrij),
      h('div', { class: 'refline' }, h('div', { class: 'chips' }, h('span', { class: 'chip' }, 'الأربعون النووية')),
        actions(id, text, 'من الأربعين النووية', { title: `الأربعون النووية · ${n.title}`, text: n.text, footer: n.takhrij.length > 70 ? n.takhrij.slice(0, 70) + '…' : n.takhrij, filename: `${id}.png`, shareText: text })));
  }

  function filteredSahih() {
    const favs = favSet(); const qq = strip(q);
    return HADITHS.filter((hd) => (topic === 'all' || (topic === 'fav' ? favs.has(hd.id) : hd.topic === topic)) &&
      (!qq || strip(hd.text).includes(qq) || strip(hd.narrator).includes(qq) || strip(hd.lesson).includes(qq)));
  }
  function filteredNawawi() {
    const favs = favSet(); const qq = strip(q);
    return NAWAWI.filter((n) => (topic !== 'fav' || favs.has(`nawawi-${n.n}`)) && (!qq || strip(n.text).includes(qq) || strip(n.takhrij).includes(qq) || strip(n.title).includes(qq)));
  }

  function build() {
    const daily = hadithOfDay(new Date());
    const input = h('input', { class: 'input', type: 'search', placeholder: book === 'sahih' ? 'ابحث في نص الحديث أو الراوي…' : 'ابحث في الأربعين النووية…', value: q });
    input.addEventListener('input', () => { q = input.value; showAll = false; drawList(); });
    const seg = h('div', { class: 'segmented', style: { marginBottom: '10px' } },
      h('button', { class: book === 'sahih' ? 'active' : '', onclick: () => { book = 'sahih'; topic = 'all'; showAll = false; build(); } }, 'مختارات من الصحيحين'),
      h('button', { class: book === 'nawawi' ? 'active' : '', onclick: () => { book = 'nawawi'; topic = 'all'; showAll = false; build(); } }, 'الأربعون النووية'));
    const topics = book === 'sahih' ? [['all', 'الكل'], ['fav', '♥ المفضلة'], ...HADITH_TOPICS.map((t) => [t, t])] : [['all', 'الكل'], ['fav', '♥ المفضلة']];
    const chips = h('div', { class: 'chips-scroll' }, ...topics.map(([k, label]) =>
      h('button', { class: `chip chip-btn ${topic === k ? 'active' : ''}`, onclick: () => { topic = k; showAll = false; build(); } }, label)));
    const listEl = h('div', {}); const countEl = h('p', { class: 'tiny', style: { margin: '6px 4px 10px' } });
    const dailyEl = book === 'sahih' ? card(daily, true) : null;
    const drawList = () => {
      if (dailyEl) dailyEl.hidden = !!q || topic !== 'all';
      const l = book === 'sahih' ? filteredSahih() : filteredNawawi(); const shown = showAll ? l : l.slice(0, 20);
      countEl.textContent = book === 'sahih' ? `${app.num(l.length)} حديثًا · النصوص منقولة حرفيًا من الصحيحين بترقيم فتح الباري وعبد الباقي` : `${app.num(l.length)} حديثًا · الأربعون النووية للإمام النووي بزيادتي ابن رجب، بمتونها وتخريجها`;
      render(listEl, ...(shown.length ? shown.map((x) => (book === 'sahih' ? card(x) : nawawiCard(x))) : [h('div', { class: 'empty' }, topic === 'fav' ? 'لم تُضف أحاديث إلى المفضلة بعد' : 'لا نتائج')]),
        l.length > shown.length ? h('button', { class: 'btn btn-outline btn-block', onclick: () => { showAll = true; drawList(); } }, `عرض الكل (${app.num(l.length)})`) : null);
    };
    render(container, seg, dailyEl, h('div', { class: 'search' }, input, h('span', { html: icon('search') })), chips, countEl, listEl);
    drawList();
  }
  app.on('change', () => { if (app.current === 'hadith') build(); });
  build();
  return { refresh: build, /** فتح مجموعة معيّنة من شاشة أخرى */ open: (b) => { book = b === 'nawawi' ? 'nawawi' : 'sahih'; topic = 'all'; q = ''; showAll = false; build(); } };
}
