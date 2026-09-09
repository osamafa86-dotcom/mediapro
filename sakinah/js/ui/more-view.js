/** شاشة "المزيد": مداخل الأحاديث وحصن المسلم والمسبحة والإعدادات، وحديث اليوم. */
import { h, icon, render } from './components.js';
import { hadithOfDay, hadithReference } from '../data/hadith.js';

export function mount(container, app) {
  const tile = (label, sub, ic, onclick) => h('button', { class: 'more-tile', onclick }, h('span', { html: icon(ic) }), label, h('small', {}, sub));
  function build() {
    const hd = hadithOfDay(new Date());
    render(container,
      h('div', { class: 'more-grid' },
        tile('الأحاديث', 'الصحيحان والأربعون النووية', 'hadith', () => app.navigate('hadith')),
        tile('حصن المسلم', 'الكتاب كاملًا: 132 بابًا', 'book', () => app.navigate('hisn')),
        tile('المسبحة', 'عدّاد التسبيح والإحصاء', 'tasbih', () => app.navigate('tasbih')),
        tile('الإعدادات', 'الموقع والحساب والتنبيهات', 'settings', () => app.navigate('settings'))),
      h('article', { class: 'card hadith daily', style: { marginTop: '14px', cursor: 'pointer' }, onclick: () => app.navigate('hadith') },
        h('div', { class: 'chip gold', style: { marginBottom: '8px' } }, '✦ حديث اليوم'),
        h('p', { class: 'matn', lang: 'ar' }, hd.text.length > 220 ? hd.text.slice(0, 220) + '…' : hd.text),
        h('div', { class: 'narr' }, `عن ${hd.narrator} — ${hadithReference(hd)}`)),
      h('p', { class: 'tiny', style: { textAlign: 'center', marginTop: '8px' } }, `سكينة ${app.version} · يعمل دون اتصال · لا حساب ولا تتبّع؛ الشبكة تُستخدم فقط لجلب التلاوات والتفاسير وخطوط المصحف، ولتسمية مدينتك بإحداثيات مقرّبة (يمكن إيقافها من الإعدادات)`));
  }
  app.on('change', () => { if (app.current === 'more') build(); });
  build();
  return { refresh: build, show: build };
}
