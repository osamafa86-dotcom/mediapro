/**
 * شاشة الأحاديث: حديث اليوم، بحث، تصنيفات، مفضّلة، نسخ ومشاركة.
 */
import { h, icon, render, copyText, shareText } from './components.js';
import { HADITHS, HADITH_TOPICS, hadithOfDay, hadithReference } from '../data/hadith.js';

import { normalizeArabic } from '../core/arabic.js';

// تطبيع موحّد (نفس الذي تستخدمه اختبارات البيانات): البحث بـ«صلى الله عليه وسلم» يجد المتون المكتوبة بـ ﷺ والعكس
const strip = (s) => normalizeArabic(s).toLowerCase();

export function mount(container, app) {
  let topic = 'all'; let q = ''; let showAll = false;

  function card(hd, daily = false) {
    const fav = (app.settings.favorites || []).includes(hd.id);
    const text = `${hd.text}\n\nرواه ${hd.narrator} — ${hadithReference(hd)} (${hd.grade})`;
    return h('article', { class: `card hadith ${daily ? 'daily' : ''}` },
      daily ? h('div', { class: 'chip gold', style: { marginBottom: '8px' } }, '✦ حديث اليوم') : null,
      h('p', { class: 'matn', lang: 'ar' }, hd.text),
      h('div', { class: 'narr' }, `عن ${hd.narrator}`),
      h('div', { class: 'refline' },
        h('div', { class: 'chips' }, h('span', { class: `chip ${hd.grade === 'متفق عليه' ? 'ok' : ''}` }, hd.grade), h('span', { class: 'chip' }, hadithReference(hd)), h('span', { class: 'chip' }, hd.topic)),
        h('div', { class: 'hadith-actions' },
          h('button', { class: `icon-btn ${fav ? 'fav' : ''}`, 'aria-label': 'إضافة إلى المفضلة', title: 'المفضلة', onclick: (e) => {
            const list = new Set(app.settings.favorites || []); list.has(hd.id) ? list.delete(hd.id) : list.add(hd.id);
            app.update({ favorites: [...list] });
          } }, h('span', { html: icon(fav ? 'heartFill' : 'heart') })),
          h('button', { class: 'icon-btn', 'aria-label': 'نسخ', title: 'نسخ', onclick: () => copyText(text) }, h('span', { html: icon('copy') })),
          h('button', { class: 'icon-btn', 'aria-label': 'مشاركة', title: 'مشاركة', onclick: () => shareText('حديث شريف', text) }, h('span', { html: icon('share') })))),
      h('details', { class: 'more' }, h('summary', {}, 'الفائدة من الحديث'), h('div', { class: 'lesson' }, hd.lesson)));
  }

  function filtered() {
    const favs = new Set(app.settings.favorites || []);
    const qq = strip(q);
    return HADITHS.filter((hd) => (topic === 'all' || (topic === 'fav' ? favs.has(hd.id) : hd.topic === topic)) &&
      (!qq || strip(hd.text).includes(qq) || strip(hd.narrator).includes(qq) || strip(hd.lesson).includes(qq)));
  }

  function build() {
    const daily = hadithOfDay(new Date());
    const list = filtered();
    const input = h('input', { class: 'input', type: 'search', placeholder: 'ابحث في نص الحديث أو الراوي…', value: q });
    input.addEventListener('input', () => { q = input.value; showAll = false; drawList(); });
    const chips = h('div', { class: 'chips-scroll' },
      ...[['all', 'الكل'], ['fav', '♥ المفضلة'], ...HADITH_TOPICS.map((t) => [t, t])].map(([k, label]) =>
        h('button', { class: `chip chip-btn ${topic === k ? 'active' : ''}`, onclick: () => { topic = k; showAll = false; build(); } }, label)));
    const listEl = h('div', {});
    const dailyEl = card(daily, true);
    const drawList = () => {
      dailyEl.hidden = !!q || topic !== 'all';
      const l = filtered(); const shown = showAll ? l : l.slice(0, 20);
      render(listEl, ...(shown.length ? shown.map((hd) => card(hd)) : [h('div', { class: 'empty' }, topic === 'fav' ? 'لم تُضف أحاديث إلى المفضلة بعد' : 'لا نتائج')]),
        l.length > shown.length ? h('button', { class: 'btn btn-outline btn-block', onclick: () => { showAll = true; drawList(); } }, `عرض الكل (${app.num(l.length)})`) : null);
    };
    render(container,
      dailyEl,
      h('div', { class: 'search' }, input, h('span', { html: icon('search') })),
      chips,
      h('p', { class: 'tiny', style: { margin: '6px 4px 10px' } }, `${app.num(list.length)} حديثًا · النصوص منقولة حرفيًا من الصحيحين بترقيم فتح الباري وعبد الباقي`),
      listEl);
    drawList();
  }
  app.on('change', () => { if (app.current === 'hadith') build(); });
  build();
  return { refresh: build };
}
