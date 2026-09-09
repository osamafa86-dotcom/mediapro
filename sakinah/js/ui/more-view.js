/** شاشة "المزيد": مداخل الأحاديث والإعدادات وحول التطبيق. */
import { h, icon, render } from './components.js';
import { hadithOfDay, hadithReference } from '../data/hadith.js';

export function mount(container, app) {
  function build() {
    const hd = hadithOfDay(new Date());
    render(container,
      h('div', { class: 'more-grid' },
        h('button', { class: 'more-tile', onclick: () => app.navigate('hadith') }, h('span', { html: icon('hadith') }), 'الأحاديث', h('small', {}, 'مختارات من الصحيحين')),
        h('button', { class: 'more-tile', onclick: () => app.navigate('settings') }, h('span', { html: icon('settings') }), 'الإعدادات', h('small', {}, 'الموقع والحساب والتنبيهات'))),
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
