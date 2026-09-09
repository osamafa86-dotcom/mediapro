/** نافذة «مشاركة كصورة»: معاينة البطاقة، اختيار السمة، ثم مشاركة أو حفظ. */
import { h, openSheet, closeSheet, toast, icon } from './components.js';
import { renderShareCard, shareImage, canShareFiles, CARD_THEMES } from '../core/share-card.js';
import * as store from '../platform/storage.js';

/** @param {{title?:string,text:string,footer?:string,quran?:boolean,filename?:string,shareText?:string}} o */
export function openShareCardSheet({ title = '', text, footer = '', quran = false, filename = 'sakinah.png', shareText = '' }) {
  let theme = store.get('shareTheme') || 'green'; let blob = null; let url = null; let seq = 0;
  const img = h('img', { class: 'share-preview', alt: 'معاينة بطاقة المشاركة' });
  const status = h('div', { class: 'tiny', style: { textAlign: 'center', minHeight: '18px' } }, 'جارٍ إنشاء البطاقة…');
  const keys = Object.keys(CARD_THEMES);
  const chips = h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px' } }, ...keys.map((k) => h('button', { class: `chip chip-btn ${theme === k ? 'active' : ''}`, onclick: () => { theme = k; store.set('shareTheme', k); [...chips.children].forEach((c, i) => c.classList.toggle('active', keys[i] === k)); draw(); } }, CARD_THEMES[k].name)));
  const direct = canShareFiles();
  const btn = h('button', { class: 'btn btn-primary btn-block', disabled: true, onclick: async () => {
    if (!blob) return; btn.disabled = true;
    const r = await shareImage(blob, { filename, title: title || 'سكينة', text: shareText });
    btn.disabled = false;
    if (r === 'shared') closeSheet(); else if (r === 'downloaded') toast('حُفظت الصورة في التنزيلات'); else if (r === 'failed') toast('تعذّرت مشاركة الصورة', 3000);
  } }, h('span', { html: icon(direct ? 'share' : 'download') }), direct ? ' مشاركة الصورة' : ' حفظ الصورة');
  const draw = async () => {
    const my = ++seq; status.textContent = 'جارٍ إنشاء البطاقة…'; btn.disabled = true;
    try {
      const b = await renderShareCard({ title, text, footer, theme, quran });
      if (my !== seq) return;
      blob = b; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(b); img.src = url; status.textContent = ''; btn.disabled = false;
    } catch { if (my === seq) status.textContent = 'تعذّر إنشاء الصورة في هذا المتصفح'; }
  };
  openSheet({ title: 'مشاركة كصورة', content: h('div', { class: 'stack' }, img, status, chips, btn), onClose: () => { seq++; if (url) URL.revokeObjectURL(url); } });
  draw();
}
