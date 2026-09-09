import { haptic } from '../platform/native.js';
/**
 * مكوّنات واجهة مشتركة: بناء عناصر DOM، أيقونات SVG، الورقة السفلية، التنبيهات، تنسيق الأرقام.
 */

/** بناء عنصر: h('div', {class:'x', onclick: fn}, child1, 'text') */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function render(el, ...children) { clear(el); append(el, children); return el; }

const I = (paths, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;
export const ICONS = {
  prayer: I('<path d="M12 3c-1.2 2.2-2 3.6-2 5.5a2 2 0 0 0 4 0c0-1.9-.8-3.3-2-5.5Z"/><path d="M4 20v-6a8 8 0 0 1 16 0v6"/><path d="M2 20h20"/><path d="M9 20v-3a3 3 0 0 1 6 0v3"/>'),
  qibla: I('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor"/>'),
  adhkar: I('<path d="M12 21c-4.5 0-8-3.6-8-8a8 8 0 0 1 8-8c4.4 0 8 3.6 8 8"/><circle cx="12" cy="13" r="2"/><path d="M12 3v2M18 19l2 2"/><path d="M7.8 7.8l.7.7M16.2 7.8l-.7.7"/>'),
  hadith: I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  location: I('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  gps: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>'),
  bell: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  bellOff: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="m3 3 18 18"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  sunrise: I('<path d="M12 2v6M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M22 22H2M8 6l4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
  sunset: I('<path d="M12 10V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M22 22H2M16 6l-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
  noon: I('<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'),
  dawn: I('<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M22 22H2"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  calendar: I('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  share: I('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  copy: I('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  heart: I('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7Z"/>'),
  heartFill: I('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5c0 2.3 1.5 4 3 5.5l7 7Z" fill="currentColor"/>'),
  search: I('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  refresh: I('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  info: I('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  warning: I('<path d="m10.3 3.9-8.5 14.6A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>'),
  compass: I('<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z"/>'),
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>'),
  install: I('<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><rect x="3" y="15" width="18" height="6" rx="2"/>'),
  close: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  chevron: I('<path d="m15 18-6-6 6-6"/>'),
  theme: I('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/>'),
  play: I('<path d="m6 4 14 8-14 8Z" fill="currentColor"/>'),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  kaaba: I('<path d="M4 8 12 4l8 4v10l-8 4-8-4Z"/><path d="M4 8l8 4 8-4M12 12v10"/><path d="M4 11.5l8 4 8-4"/>'),
  book: I('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>'),
  filter: I('<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>'),
  reset: I('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'),
  globe: I('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>'),
  more: I('<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>'),
  mic: I('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>'),
  micOff: I('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/><path d="m3 3 18 18"/>'),
  bookmark: I('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>'),
  bookmarkFill: I('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" fill="currentColor"/>'),
  pause: I('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
  skipNext: I('<path d="m5 4 10 8-10 8Z" fill="currentColor"/><rect x="17" y="4" width="3" height="16" fill="currentColor"/>'),
  skipPrev: I('<path d="m19 4-10 8 10 8Z" fill="currentColor"/><rect x="4" y="4" width="3" height="16" fill="currentColor"/>'),
  repeat: I('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: I('<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a17 17 0 0 1 4.1-4.9M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="m3 3 18 18"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  hand: I('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L2.5 15.4a2 2 0 0 1 3-2.6L7 14.5"/>'),
};
export const icon = (name) => ICONS[name] || '';
export const iconEl = (name, cls) => { const s = document.createElement('span'); s.className = cls || ''; s.innerHTML = icon(name); return s.firstChild; };

/** الأرقام العربية المشرقية */
export function arabicDigits(str) {
  return String(str).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}
export function fmtNum(n, numerals = 'latn', digits = 0, group = false) {
  const s = Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: group });
  return numerals === 'arab' ? arabicDigits(s) : s;
}
export function pad2(n) { return String(n).padStart(2, '0'); }

/** صيغة العدّ التنازلي ‎HH:MM:SS */
export function fmtCountdown(ms, numerals = 'latn') {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const out = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  return numerals === 'arab' ? arabicDigits(out) : out;
}
/** صيغة مدة بالكلمات: "بعد ساعتين و١٢ دقيقة" */
export function fmtDurationWords(ms, numerals = 'latn') {
  const m = Math.max(0, Math.round(ms / 60000));
  const hh = Math.floor(m / 60), mm = m % 60;
  const n = (v) => (numerals === 'arab' ? arabicDigits(String(v)) : String(v));
  const hours = hh === 0 ? '' : hh === 1 ? 'ساعة' : hh === 2 ? 'ساعتين' : hh <= 10 ? `${n(hh)} ساعات` : `${n(hh)} ساعة`;
  const mins = mm === 0 ? '' : mm === 1 ? 'دقيقة' : mm === 2 ? 'دقيقتين' : mm <= 10 ? `${n(mm)} دقائق` : `${n(mm)} دقيقة`;
  if (!hours && !mins) return 'الآن';
  return [hours, mins].filter(Boolean).join(' و');
}

/* ---------- الورقة السفلية ---------- */
let sheetOnClose = null; let sheetOpener = null;
let sheetOpenedAt = 0;
export function openSheet({ title, content, onClose }) {
  const sheet = document.getElementById('sheet'), back = document.getElementById('sheet-backdrop');
  document.getElementById('sheet-title').textContent = title || '';
  const body = document.getElementById('sheet-body');
  render(body, content);
  body.scrollTop = 0;
  sheet.hidden = false; back.hidden = false; sheetOpenedAt = performance.now();
  requestAnimationFrame(() => { sheet.classList.add('show'); back.classList.add('show'); });
  sheetOnClose = onClose || null;
  sheetOpener = document.activeElement;
  document.body.style.overflow = 'hidden';
  // زر الرجوع (Android/المتصفح) يغلق النافذة بدل مغادرة الشاشة: ندفع حالة سجل واحدة ونغلق عند popstate
  if (!(history.state && history.state.sakinahSheet)) { try { history.pushState({ sakinahSheet: true }, ''); } catch { /* تجاهل */ } }
  setTimeout(() => { const first = body.querySelector('input, button, select, [tabindex]'); (first || document.getElementById('sheet-close')).focus({ preventScroll: true }); }, 320);
  return { close: closeSheet, body };
}
export function closeSheet({ fromHistory = false } = {}) {
  const sheet = document.getElementById('sheet'), back = document.getElementById('sheet-backdrop');
  if (sheet.hidden) return;
  if (!fromHistory && history.state && history.state.sakinahSheet) { try { history.back(); return; } catch { /* نتابع الإغلاق المباشر */ } }
  sheet.classList.remove('show'); back.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(() => { sheet.hidden = true; back.hidden = true; document.getElementById('sheet-body').scrollTop = 0; }, 300);
  if (sheetOpener && typeof sheetOpener.focus === 'function' && document.contains(sheetOpener)) { try { sheetOpener.focus({ preventScroll: true }); } catch {} }
  sheetOpener = null;
  if (sheetOnClose) { const fn = sheetOnClose; sheetOnClose = null; fn(); }
}
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { const sheet = document.getElementById('sheet'); if (sheet && !sheet.hidden) closeSheet({ fromHistory: true }); });
export function initSheet() {
  document.getElementById('sheet-close').innerHTML = icon('close');
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  // نقرة اللمس المُركَّبة بعد فتح الورقة مباشرة (نقرة مزدوجة/ضغطة مطوّلة على الصفحة) تقع على الخلفية؛ نتجاهلها لبرهة
  document.getElementById('sheet-backdrop').addEventListener('click', () => { if (performance.now() - sheetOpenedAt < 400) return; closeSheet(); });
  document.addEventListener('keydown', (e) => {
    const sheet = document.getElementById('sheet');
    if (sheet.hidden) return;
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') { // حصر التنقّل داخل الورقة
      const f = [...sheet.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------- التنبيه العابر ---------- */
let toastTimer = null;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** زر تبديل */
export function switchEl(checked, onChange, ariaLabel = '') {
  const input = h('input', { type: 'checkbox', 'aria-label': ariaLabel });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, input, h('span'));
}
/** عدّاد ± */
export function stepper(value, { min = -60, max = 60, step = 1, format = (v) => v, onChange }) {
  const out = h('output', {}, format(value));
  let v = value;
  const setV = (nv) => { v = Math.min(max, Math.max(min, nv)); out.textContent = format(v); onChange(v); };
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'زيادة', onclick: () => setV(v + step) }, '+'),
    out,
    h('button', { type: 'button', 'aria-label': 'إنقاص', onclick: () => setV(v - step) }, '−'));
}
export function settingRow(label, desc, control) {
  return h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'label' }, label), desc ? h('div', { class: 'desc' }, desc) : null), control);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch { toast('تعذّر النسخ'); }
}
export async function shareText(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(text);
}
export function vibrate(pattern) {
  try {
    const strong = Array.isArray(pattern) ? pattern.length > 1 : pattern > 20;
    if (haptic(strong ? 'success' : 'light')) return; // iOS/Android الأصلي
    navigator.vibrate && navigator.vibrate(pattern);
  } catch { /* لا اهتزاز */ }
}
