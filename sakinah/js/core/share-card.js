/**
 * بطاقات المشاركة كصور: رسم نص (آية/حديث/ذكر) على Canvas بخطوط التطبيق نفسها، ثم مشاركة الصورة (Web Share بالملفات،
 * أو إضافة Share في التطبيق الأصلي، أو حفظها كملف). لفّ الأسطر دالة نقية تُختبر على حدة.
 */
export const CARD_THEMES = {
  green: { name: 'أخضر', bg1: '#11503d', bg2: '#07221a', text: '#f8f4ea', muted: 'rgba(248,244,234,.72)', accent: '#d8b76a', pattern: 'rgba(255,255,255,.055)' },
  night: { name: 'ليلي', bg1: '#151b26', bg2: '#080b10', text: '#eef1f6', muted: 'rgba(238,241,246,.7)', accent: '#c9a84c', pattern: 'rgba(255,255,255,.05)' },
  paper: { name: 'ورقي', bg1: '#f7f0e1', bg2: '#eadfc6', text: '#2a2418', muted: 'rgba(42,36,24,.66)', accent: '#8a6b2a', pattern: 'rgba(0,0,0,.05)' },
};

/** لفّ نص على أسطر لا يتجاوز عرضها maxWidth؛ measure(نص) → عرض بالبكسل. الفقرات (\n) تُحفظ، والكلمة الأطول من السطر تبقى وحدها */
export function wrapLines(measure, text, maxWidth) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean); let line = '';
    if (!words.length) { out.push(''); continue; }
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (!line || measure(cand) <= maxWidth) line = cand; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
/** حجم الخط بحسب طول النص كي تبقى البطاقة متوازنة */
export function fontSizeFor(len) { return len > 900 ? 30 : len > 600 ? 34 : len > 350 ? 38 : len > 180 ? 44 : len > 80 ? 50 : 56; }

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/** نمط نجمة ثمانية (مربعان متعامدان) على شبكة خفيفة */
function drawPattern(ctx, W, H, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; const step = 132, r = 30;
  for (let y = 0; y < H + step; y += step) for (let x = 0; x < W + step; x += step) {
    for (const rot of [0, Math.PI / 4]) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.restore(); }
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/**
 * @param {{kicker?:string,title?:string,text:string,footer?:string,theme?:string,quran?:boolean,width?:number}} o
 * @returns {Promise<Blob>} صورة PNG
 */
export async function renderShareCard({ kicker = 'سكينة', title = '', text, footer = '', theme = 'green', quran = false, width = 1080 }) {
  const th = CARD_THEMES[theme] || CARD_THEMES.green;
  const size = fontSizeFor(text.length);
  const family = quran ? "'Amiri Quran', 'Amiri', 'Scheherazade New', serif" : "'Amiri', 'Scheherazade New', 'Traditional Arabic', serif";
  const ui = "'Tajawal', 'Segoe UI', Tahoma, sans-serif";
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    try { await Promise.all([document.fonts.load(`${size}px ${quran ? "'Amiri Quran'" : "'Amiri'"}`), document.fonts.load(`700 32px 'Tajawal'`), document.fonts.load(`500 28px 'Tajawal'`)]); } catch { /* الخطوط البديلة */ }
  }
  const pad = 96, maxW = width - pad * 2, lh = Math.round(size * 1.95);
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = `${size}px ${family}`; ctx.direction = 'rtl';
  const lines = wrapLines((s) => ctx.measureText(s).width, text, maxW);
  const headH = 140 + (title ? 64 : 0), footH = footer ? 110 : 70;
  const textH = lines.length * lh;
  const H = Math.max(1080, Math.round(headH + 40 + textH + 40 + footH + 40));
  c.width = width; c.height = H;
  // الخلفية
  const g = ctx.createLinearGradient(0, 0, width * 0.4, H); g.addColorStop(0, th.bg1); g.addColorStop(1, th.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, H);
  drawPattern(ctx, width, H, th.pattern);
  ctx.strokeStyle = th.accent; ctx.lineWidth = 2; roundRect(ctx, 40, 40, width - 80, H - 80, 28); ctx.stroke();
  // الترويسة
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = th.accent; ctx.font = `700 34px ${ui}`; ctx.fillText(kicker, width - pad, 128);
  ctx.fillStyle = th.muted; ctx.font = `500 26px ${ui}`; ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillText('sakinah', pad, 128);
  ctx.direction = 'rtl'; ctx.textAlign = 'right';
  if (title) { ctx.fillStyle = th.muted; ctx.font = `700 30px ${ui}`; ctx.fillText(title, width - pad, 192); }
  ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(width - pad, headH + 8); ctx.lineTo(width - pad - 120, headH + 8); ctx.stroke(); ctx.globalAlpha = 1;
  // النص (يتوسط عموديًا إن بقي فراغ)
  const slack = Math.max(0, H - (headH + 40 + textH + 40 + footH + 40));
  let y = headH + 40 + slack / 2 + size;
  ctx.fillStyle = th.text; ctx.font = `${size}px ${family}`;
  for (const ln of lines) { if (ln) ctx.fillText(ln, width - pad, y); y += lh; }
  // التذييل
  if (footer) { ctx.fillStyle = th.muted; ctx.font = `500 28px ${ui}`; ctx.fillText(footer, width - pad, H - 84); }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

function blobToBase64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); }); }
/** يشارك الصورة: التطبيق الأصلي (Filesystem + Share)، ثم Web Share بالملفات، ثم حفظ كملف. يعيد 'shared' | 'downloaded' | 'cancelled' | 'failed' */
export async function shareImage(blob, { filename = 'sakinah.png', title = 'سكينة', text = '' } = {}) {
  try {
    const { isNative, plugin } = await import('../platform/native.js');
    if (isNative()) {
      const F = plugin('Filesystem'), Sh = plugin('Share');
      if (F && Sh) {
        try {
          const w = await F.writeFile({ path: `share/${filename}`, data: await blobToBase64(blob), directory: 'CACHE', recursive: true });
          await Sh.share({ title, text: text || undefined, files: [w.uri], dialogTitle: title });
          return 'shared';
        } catch (e) { if (/cancel/i.test(String(e && e.message || e))) return 'cancelled'; }
      }
    }
  } catch { /* ليس أصليًا */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text: text || undefined }); return 'shared'; }
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  try {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000); return 'downloaded';
  } catch { return 'failed'; }
}
/** هل يمكن مشاركة الصور مباشرة (لا حفظ فقط)؟ */
export function canShareFiles() {
  try { if (typeof navigator === 'undefined') return false; if (window.SAKINAH_NATIVE || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return true; if (!navigator.canShare || typeof File === 'undefined') return false; return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }); } catch { return false; }
}
