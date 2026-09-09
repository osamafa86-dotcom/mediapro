/**
 * شاشة القبلة — تجربة مبسطة: سهم واحد كبير وتعليمة واحدة («أدر الهاتف يمينًا ٣٥°» → «✓ أنت متجه إلى القبلة»)،
 * تشغيل تلقائي للمستشعر (زرّ واحد فقط حيث يلزم إذن iOS)، حالة محاذاة خضراء مع اهتزاز، فقاعة استواء، تنبيه معايرة،
 * ووضع «الشمس» بلا بوصلة، ووضع «الخريطة» (يابسة العالم دون اتصال وقوس الدائرة العظمى إلى الكعبة). التفاصيل الفنية (الدرجات الدقيقة، المسافة، الانحراف المغناطيسي WMM2025، مصدر المستشعر) خلف زر (i).
 * الاتجاه جيوديسي (Vincenty على WGS‑84) من الشمال الحقيقي؛ قراءات الهاتف مغناطيسية فيُضاف الانحراف المغناطيسي.
 */
import { h, icon, render, vibrate, openSheet } from './components.js';
import { qiblaInfo, sunQiblaMoments, kaabaZenithEvents, signedDifference, sunPosition, greatCirclePoints, bearingUncertainty, KAABA } from '../core/qibla.js';
import { WORLD_LAND_PATH } from '../data/world-land.js';
import { startCompass, accuracyLabel, magneticToTrue, needsPermissionGesture, compassSupported } from '../platform/compass.js';
import { copyText, toast } from './components.js';
import { civilDate } from '../core/prayer-times.js';
import { describeLocation } from '../platform/location.js';

let geomagMod = null;
async function loadGeomag() {
  if (geomagMod) return geomagMod;
  try { geomagMod = await import('../core/geomag.js'); } catch (e) { console.warn('geomag unavailable', e); geomagMod = false; }
  return geomagMod;
}

const ALIGN_DEG = 3; // نطاق الدخول في حالة المحاذاة
const ALIGN_EXIT_DEG = 5; // نطاق الخروج منها (تخلّف يمنع رفرفة اللون والاهتزاز عند الحد)
const STALE_MS = 2500; // بلا قراءة جديدة طوال هذه المدة نعتبر المستشعر متوقفًا
const TILT_DEG = 35; // ميل يستدعي طلب وضع الهاتف أفقيًا
const NEAR_KAABA_M = 120;   // ضمن هذه المسافة أنت في المسجد الحرام: توجّه إلى الكعبة مباشرة ولا معنى لبوصلة تعتمد على الموقع
const UNCERTAIN_DEG = 6;    // فوق هذا الهامش نُظهر «الاتجاه تقريبي» مع زر تحديد الموقع بدقة عالية
const CITY_RADIUS_M = 8000; // موقع محفوظ كمدينة: الإحداثيات مركزها والمستخدم في أي مكان منها (مدينة «مكة» المحفوظة تقع عند الكعبة نفسها)

/** خطأ الموقع التقديري بالأمتار حسب مصدره — يحدّد هامش خطأ الاتجاه قرب الكعبة */
export function locationErrorM(loc) {
  if (!loc) return null;
  if (loc.source === 'gps') return Math.max(10, loc.accuracy || 50);
  if (loc.source === 'city') return CITY_RADIUS_M;
  return 300; // إحداثيات يدوية
}

function roseSVG(bearing) {
  const ticks = [];
  for (let a = 0; a < 360; a += 5) {
    const major = a % 90 === 0, mid = a % 30 === 0;
    const r1 = major ? 80 : mid ? 84 : 88, r2 = 93;
    const rad = (a - 90) * Math.PI / 180;
    ticks.push(`<line x1="${(100 + r1 * Math.cos(rad)).toFixed(2)}" y1="${(100 + r1 * Math.sin(rad)).toFixed(2)}" x2="${(100 + r2 * Math.cos(rad)).toFixed(2)}" y2="${(100 + r2 * Math.sin(rad)).toFixed(2)}" stroke="currentColor" stroke-opacity="${major ? .9 : mid ? .5 : .22}" stroke-width="${major ? 2.2 : 1.1}" />`);
  }
  const labels = [['ش', 0], ['ق', 90], ['ج', 180], ['غ', 270]].map(([t, a]) => {
    const rad = (a - 90) * Math.PI / 180; return `<text x="${100 + 70 * Math.cos(rad)}" y="${100 + 70 * Math.sin(rad) + 5.5}" text-anchor="middle" font-size="15" font-weight="900" font-family="Tajawal, sans-serif" fill="${a === 0 ? 'var(--danger)' : 'currentColor'}" fill-opacity="${a === 0 ? 1 : .7}">${t}</text>`;
  }).join('');
  return `<svg class="compass-rose" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="97" fill="var(--bg-elev)" stroke="var(--line)" stroke-width="2"/>
    ${ticks.join('')}${labels}
    <g class="kaaba-mark" transform="rotate(${bearing} 100 100)">
      <g transform="translate(100 15)">
        <circle r="13" fill="var(--paper, #f7f2e4)" stroke="var(--gold)" stroke-width="1.5"/>
        <rect x="-7.5" y="-7.5" width="15" height="15" rx="2" fill="#1c1917" stroke="var(--gold)" stroke-width="1.6"/>
        <rect x="-7.5" y="-2.5" width="15" height="3" fill="var(--gold)"/>
      </g>
    </g>
  </svg>`;
}
const NEEDLE_SVG = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><filter id="ns" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".25"/></filter></defs>
  <path class="needle-body" d="M100 34 L118 78 L106 71 L106 150 L94 150 L94 71 L82 78 Z" fill="currentColor" filter="url(#ns)"/>
  <circle cx="100" cy="100" r="9" fill="var(--bg-elev)" stroke="currentColor" stroke-width="3"/></svg>`;
const FIG8_SVG = `<svg viewBox="0 0 64 32" aria-hidden="true" class="fig8"><path d="M16 16c0-7 6-12 12-8s8 12 16 8 4-14-2-12-10 12-4 14 12-6 12-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle class="dot" r="3.5" fill="currentColor"><animateMotion dur="2.4s" repeatCount="indefinite" path="M16 16c0-7 6-12 12-8s8 12 16 8 4-14-2-12-10 12-4 14 12-6 12-10"/></circle></svg>`;

export function mount(container, app) {
  let mode = 'compass'; let compass = null; let reading = null; let decl = null; let declSource = ''; let info = null;
  let sensor = 'idle'; // idle | starting | live | none | denied | insecure | unsupported
  let els = {}; let generation = 0; let wasAligned = false; let sunTimer = null;
  let locErr = null; let uncert = 0; let nearKaaba = false; let refining = false; let declOutOfRange = false;
  let roseDeg = 0, needleDeg = 0; // زوايا متراكمة غير ملفوفة كي لا يدور السهم دورة كاملة عند عبور الشمال
  let paintReq = 0, lastBig = '', lastHint = '', calibKey = null, staleTimer = null;

  function stopSensor() { if (compass) { compass.stop(); compass = null; } reading = null; clearInterval(staleTimer); staleTimer = null; }
  /** تجميع القراءات (حتى 60 في الثانية) في رسمة واحدة لكل إطار */
  function schedulePaint() {
    if (paintReq || typeof requestAnimationFrame !== 'function') { if (!paintReq) paint(); return; }
    paintReq = requestAnimationFrame(() => { paintReq = 0; paint(); });
  }
  const hasGesture = () => !needsPermissionGesture() || !!(navigator.userActivation && navigator.userActivation.isActive);

  /* ---------- المستشعر ---------- */
  async function start() {
    if (sensor === 'starting' || sensor === 'live') return;
    if (!compassSupported()) { sensor = 'unsupported'; paint(); return; }
    const gen = ++generation; sensor = 'starting'; paint();
    try {
      const c = await startCompass((r) => {
        if (gen !== generation) return;
        if (r === null) { stopSensor(); sensor = 'none'; paint(); return; }
        reading = r;
        if (sensor !== 'live') { sensor = 'live'; paint(); } else schedulePaint();
      });
      if (gen !== generation) { c.stop(); return; }
      compass = c;
      // مراقبة التقادم: iOS قد يوقف القراءات بصمت بعد العودة من الخلفية
      clearInterval(staleTimer);
      staleTimer = setInterval(() => { if (gen === generation && sensor === 'live' && reading && Date.now() - reading.at > STALE_MS) { sensor = 'stale'; paint(); } }, 1000);
    } catch (e) {
      if (gen !== generation) return;
      // رفض بلا تفاعل من المستخدم (فتح مباشر للشاشة على iOS) ليس رفضًا حقيقيًا: نعرض زر البدء
      if (e.code === 'denied' && needsPermissionGesture() && !(navigator.userActivation && navigator.userActivation.isActive)) { sensor = 'idle'; paint(); return; }
      sensor = e.code === 'denied' ? 'denied' : e.code === 'insecure' ? 'insecure' : 'unsupported'; paint();
    }
  }
  const trueHeading = () => {
    if (!reading) return null;
    const useDecl = app.settings.compass.declinationMode !== 'off' && decl !== null;
    return useDecl ? magneticToTrue(reading.magneticHeading, decl) : reading.magneticHeading;
  };

  /* ---------- الرسم ---------- */
  function paint() {
    if (!els.rose || !info) return;
    const heading = trueHeading();
    // «حي» = قراءة مطلقة (مرجعها الشمال) والمستشعر يعمل؛ الاتجاه النسبي يُعرض ثابتًا مع التحذير لا كسهم يوهم بالدقة
    const live = heading !== null && sensor === 'live' && !!(reading && reading.absolute);
    const shownHeading = live ? heading : 0;
    roseDeg += signedDifference(-shownHeading, roseDeg);
    els.rose.style.transform = `rotate(${roseDeg.toFixed(2)}deg)`;
    const delta = signedDifference(info.bearing, shownHeading);
    needleDeg += signedDifference(delta, needleDeg);
    els.needle.style.transform = `rotate(${needleDeg.toFixed(2)}deg)`;
    const aligned = live && Math.abs(delta) <= (wasAligned ? ALIGN_EXIT_DEG : ALIGN_DEG);
    const tilt = reading && reading.beta !== null && reading.gamma !== null ? Math.max(Math.abs(reading.beta), Math.abs(reading.gamma)) : 0;
    const tilted = live && tilt > TILT_DEG;
    els.wrap.classList.toggle('aligned', aligned);
    els.wrap.classList.toggle('live', live);
    els.wrap.classList.toggle('static', !live);
    if (aligned && !wasAligned) vibrate([40, 60, 40]);
    wasAligned = aligned;
    // الرقم الكبير والتعليمة الواحدة
    // لا نعيد بناء العقد إلا عند تغيّر النص (القراءات تصل عشرات المرات في الثانية)
    if (live) {
      const bigKey = aligned ? 'ok' : String(Math.round(Math.abs(delta)));
      if (bigKey !== lastBig) { lastBig = bigKey; render(els.big, aligned ? h('span', { class: 'ok-mark', html: icon('check') }) : h('span', {}, `${app.num(Math.abs(delta), 0)}°`)); }
      const hintText = tilted ? 'ضع الهاتف أفقيًا (مستويًا) لقراءة أدق' : aligned ? (uncert > UNCERTAIN_DEG ? `متجه إلى القبلة تقريبًا (±${app.num(Math.ceil(uncert), 0)}°)` : 'أنت متجه إلى القبلة') : `أدر الهاتف ${delta > 0 ? 'يمينًا' : 'يسارًا'} ${app.num(Math.abs(delta), 0)}°`;
      const hintKey = `${tilted}|${aligned}|${hintText}`;
      if (hintKey !== lastHint) { lastHint = hintKey; render(els.hint, h('span', { class: aligned ? 'ok' : tilted ? 'warn' : '' }, hintText)); els.hint.className = `turn-hint ${aligned ? 'ok' : tilted ? 'warn' : ''}`; }
    } else {
      const msg = sensor === 'none' || sensor === 'unsupported' ? 'لا توجد بوصلة في هذا الجهاز — القبلة على هذا الاتجاه من الشمال؛ جرّب وضع «الشمس»' : sensor === 'starting' ? 'جارٍ تشغيل البوصلة…' : sensor === 'stale' ? 'توقفت قراءات المستشعر — أعد تشغيل البوصلة' : sensor === 'denied' ? 'لم يُمنح إذن المستشعرات' : sensor === 'insecure' ? 'تعمل البوصلة على HTTPS فقط' : reading && !reading.absolute ? 'اتجاه القبلة من الشمال الحقيقي (المستشعر نسبي فلا يُعتمد عليه)' : 'اتجاه القبلة من الشمال الحقيقي';
      const key = `static|${msg}`;
      if (key !== lastHint) { lastHint = key; lastBig = ''; render(els.big, h('span', {}, `${app.num(info.bearing, 0)}°`)); render(els.hint, h('span', {}, msg)); els.hint.className = 'turn-hint'; }
    }
    // فقاعة الاستواء
    if (els.level) {
      if (reading && reading.beta !== null && reading.gamma !== null) {
        const clamp = (v) => Math.max(-1, Math.min(1, v / 45));
        els.level.hidden = false; els.level.classList.toggle('flat', tilt <= 12);
        els.levelDot.style.transform = `translate(${(clamp(reading.gamma) * 14).toFixed(1)}px, ${(clamp(reading.beta) * 14).toFixed(1)}px)`;
      } else els.level.hidden = true;
    }
    // المعايرة / القراءة النسبية
    if (els.calib) {
      const acc = reading ? accuracyLabel(reading.accuracy) : null;
      const rel = reading && !reading.absolute;
      const key = `${rel ? 'rel' : ''}|${acc ? acc.level : ''}|${reading && reading.accuracyEstimated ? 'est' : ''}`;
      if (key === calibKey) { /* لا تغيير: لا نعيد رسم الكتلة (وإلا أعاد SVG المعايرة حركته كل إطار) */ }
      else if ((calibKey = key, rel)) render(els.calib, h('div', { class: 'calib danger' }, h('span', { html: icon('warning') }),
        h('span', {}, reading.source === 'relative' && /iP(hone|ad|od)/.test(navigator.userAgent)
          ? 'iPhone يعطي اتجاهًا نسبيًا فقط: البوصلة تحتاج إذن الموقع للتطبيق (الإعدادات ← الخصوصية ← خدمات الموقع ← سكينة) ثم أعد فتح الشاشة، أو استخدم وضع «الشمس».'
          : 'المتصفح يعطي اتجاهًا نسبيًا بلا مرجع للشمال — فعّل الموقع/البوصلة في النظام أو استخدم وضع «الشمس».'),
        h('button', { class: 'btn btn-outline btn-sm', onclick: () => navigator.geolocation && navigator.geolocation.getCurrentPosition(() => { generation++; stopSensor(); sensor = 'idle'; start(); }, () => {}, { timeout: 8000 }) }, 'طلب إذن الموقع')));
      else if (acc && (acc.level === 'bad' || acc.level === 'low')) render(els.calib, h('div', { class: 'calib' }, h('span', { html: FIG8_SVG }), h('span', {}, `دقة البوصلة ${acc.label} (${reading.accuracyEstimated ? 'تقديرًا من تذبذب القراءات' : `±${app.num(reading.accuracy, 0)}°`}) — حرّك الهاتف في الهواء على شكل الرقم 8 بعيدًا عن المعادن والمغناطيس.`)));
      else render(els.calib);
    }
    // زر البدء (iOS) أو إعادة المحاولة
    if (els.overlay) {
      const show = sensor === 'idle' || sensor === 'denied' || sensor === 'insecure' || sensor === 'stale';
      els.overlay.hidden = !show;
      const restart = () => { generation++; stopSensor(); sensor = 'idle'; start(); };
      if (show) render(els.overlay, h('button', { class: 'btn btn-primary', onclick: sensor === 'stale' ? restart : start }, h('span', { html: icon('compass') }), sensor === 'denied' ? ' إعادة طلب الإذن' : sensor === 'stale' ? ' إعادة تشغيل البوصلة' : ' تشغيل البوصلة'),
        sensor === 'denied' ? h('small', {}, 'على iOS: الإعدادات ← Safari ← «الحركة والاتجاه»، ثم أعد المحاولة') : null);
    }
  }

  /* ---------- التفاصيل (i) ---------- */
  function openDetails() {
    const loc = app.location;
    const heading = trueHeading(); const acc = reading ? accuracyLabel(reading.accuracy) : null;
    const declMode = app.settings.compass.declinationMode;
    const declText = decl === null ? 'غير متاح' : `${decl >= 0 ? '+' : '−'}${app.num(Math.abs(decl), 1)}° ${decl >= 0 ? 'شرقًا' : 'غربًا'}`;
    const row = (k, v, rtl = false) => h('div', { class: 'setting-row' }, h('div', { class: 'label' }, k), h('div', { class: rtl ? '' : 'ltr', style: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' } }, v));
    openSheet({ title: 'تفاصيل القبلة', content: h('div', { class: 'stack' },
      row('اتجاه القبلة من الشمال الحقيقي', `${app.num(info.bearing, 2)}° (${info.compassPoint})`),
      row('المسافة إلى الكعبة', distText(info.distanceKm), true),
      row('الموقع المستخدم', `${describeLocation(loc)} — ${locationSourceText(loc)}`, true),
      row('هامش خطأ الاتجاه بسبب الموقع', uncertText(), true),
      row(`الانحراف المغناطيسي${declSource ? ` (${declSource})` : ''}`, declMode === 'off' ? `${declText} — التصحيح متوقف` : declText),
      row('اتجاه القبلة المغناطيسي (لبوصلة يدوية)', decl === null ? '—' : `${app.num(((info.bearing - decl) % 360 + 360) % 360, 1)}°`),
      heading !== null ? row('اتجاه الهاتف الآن (من الشمال الحقيقي)', `${app.num(heading, 1)}°`) : null,
      heading !== null ? row('اتجاه الهاتف الآن (مغناطيسي، كما يقرؤه المستشعر)', `${app.num(reading.magneticHeading, 1)}°`) : null,
      reading ? row('مصدر المستشعر', reading.source === 'ios' ? 'iOS (webkitCompassHeading)' : reading.source === 'android-absolute' ? 'Android (اتجاه مطلق)' : 'اتجاه نسبي') : row('المستشعر', { idle: 'لم يُشغَّل', starting: 'جارٍ التشغيل', none: 'لا قراءات (لا بوصلة)', denied: 'الإذن مرفوض', insecure: 'يلزم HTTPS', unsupported: 'غير مدعوم', live: 'يعمل' }[sensor]),
      acc ? row('دقة المستشعر', `${acc.label}${reading.accuracy !== null ? ` (±${app.num(reading.accuracy, 0)}°)` : ''}`) : null,
      info.antipodal ? h('div', { class: 'notice' }, h('span', { html: icon('warning') }), 'موقعك قريب جدًا من النقطة المقابلة للكعبة؛ اتجاه القبلة هنا غير محدد رياضيًا.') : null,
      declOutOfRange ? h('div', { class: 'notice' }, h('span', { html: icon('warning') }), 'نموذج الانحراف المغناطيسي WMM2025 صالح رسميًا حتى نهاية 2029؛ القيمة الحالية استقراء قد يخطئ بدرجة أو أكثر. يلزم تحديث التطبيق إلى نموذج WMM2030.') : null,
      uncert > UNCERTAIN_DEG ? h('div', { class: 'notice' }, h('span', { html: icon('warning') }), h('span', {}, `الاتجاه يعتمد على موقعك أكثر من البوصلة: على بعد ${distText(info.distanceKm)} من الكعبة يغيّر خطأ موقعٍ قدره ${app.num(locErr, 0)} م الاتجاهَ حتى ${uncertText()}. حدّد موقعك بدقة عالية من زر GPS في الشاشة.`)) : null,
      h('div', { class: 'notice info' }, h('span', { html: icon('info') }), h('span', {}, 'للتحقق: افتح تطبيق البوصلة في هاتفك (مع تفعيل «الشمال الحقيقي» في iPhone) وقارن اتجاه الهاتف الحقيقي أعلاه مع قراءته؛ إن اختلفا فالمستشعر يحتاج معايرة (حركة 8) أو إبعاده عن المعادن والحافظات المغناطيسية. وللتأكد المطلق استخدم وضع «الشمس» فهو لا يعتمد على المغناطيس.')),
      h('details', { class: 'more' }, h('summary', {}, 'بيانات التشخيص (للدعم الفني)'),
        h('pre', { class: 'diag', dir: 'ltr' }, diagnostics()),
        h('button', { class: 'btn btn-outline btn-sm', style: { marginTop: '6px' }, onclick: () => copyText(diagnostics()) }, h('span', { html: icon('copy') }), ' نسخ بيانات التشخيص')),
      h('p', { class: 'tiny', style: { lineHeight: 1.8 } }, `الاتجاه محسوب جيوديسيًا على مجسّم WGS‑84 (Vincenty) من الشمال الحقيقي؛ الفرق عن الحل الكروي ${app.num(Math.abs(info.difference), 3)}°. مستشعرات الهاتف تعطي الشمال المغناطيسي فيُضاف الانحراف المغناطيسي من النموذج العالمي WMM2025 تلقائيًا. يمكن إيقاف التصحيح من الإعدادات.`)) });
  }

  /** بيانات خام للتشخيص عن بُعد: القراءة الأخيرة والمصدر والإعدادات */
  function diagnostics() {
    const loc = app.location || {}; const r = reading || {};
    const f = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : String(v));
    return [
      `sakinah compass diag ${new Date().toISOString()}`,
      `ua: ${navigator.userAgent}`,
      `secure: ${typeof isSecureContext !== 'undefined' ? isSecureContext : '?'} · standalone: ${!!window.SAKINAH_STANDALONE} · capacitor: ${!!window.Capacitor}`,
      `location: ${f(loc.lat, 5)}, ${f(loc.lon, 5)} (${loc.source || '?'}${loc.accuracy ? ` ±${loc.accuracy}m` : ''}; ${loc.name || ''})`,
      `distance: ${info ? f(info.distanceKm * 1000, 0) : '-'} m · locErr: ${locErr} m · uncertainty: ±${f(uncert, 1)}° · nearKaaba: ${nearKaaba}`,
      `bearing(true): ${f(info && info.bearing, 2)} · declination: ${f(decl, 2)} (${declSource || '-'}) · mode: ${app.settings.compass.declinationMode}`,
      `sensor: ${sensor} · source: ${r.source || '-'} · absolute: ${r.absolute}`,
      `webkitCompassHeading: ${f(r.webkit)} · accuracy: ${f(r.accuracy)} · alpha: ${f(r.alpha)} · beta: ${f(r.beta)} · gamma: ${f(r.gamma)}`,
      `screenAngle: ${r.screen} · window.orientation: ${typeof window.orientation === 'number' ? window.orientation : '-'} · screen.orientation: ${screen.orientation ? screen.orientation.type + '/' + screen.orientation.angle : '-'}`,
      `heading raw: ${f(r.raw)} · smoothed magnetic: ${f(r.magneticHeading)} · true: ${f(trueHeading())}`,
    ].join('\n');
  }

  /* ---------- وضع الشمس ---------- */
  function sunPanel(loc) {
    const now = new Date(); const civil = civilDate(now, app.tz);
    const pos = sunPosition(now, loc.lat, loc.lon); const up = pos.altitude > 0;
    const sun = sunQiblaMoments(loc.lat, loc.lon, civil, app.tz);
    const zen = kaabaZenithEvents(civil.year).concat(kaabaZenithEvents(civil.year + 1)).filter((e) => e.time > now).slice(0, 2);
    const delta = signedDifference(info.bearing, pos.azimuth);
    const fmtT = (d) => (d ? app.fmt(d) : '—');
    const dial = h('div', { class: 'sun-dial', 'aria-hidden': 'true' });
    dial.innerHTML = `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="var(--bg-elev)" stroke="var(--line)" stroke-width="2"/>
      <text x="100" y="22" text-anchor="middle" font-size="13" font-weight="900" font-family="Tajawal, sans-serif" fill="var(--danger)">ش</text>
      <g transform="rotate(${info.bearing} 100 100)"><line x1="100" y1="100" x2="100" y2="34" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/><g transform="translate(100 26)"><rect x="-8" y="-8" width="16" height="16" rx="2" fill="#1c1917" stroke="var(--gold)" stroke-width="1.6"/><rect x="-8" y="-2.5" width="16" height="3" fill="var(--gold)"/></g></g>
      ${up ? `<g transform="rotate(${pos.azimuth} 100 100)"><line x1="100" y1="100" x2="100" y2="48" stroke="var(--gold)" stroke-width="2.5" stroke-dasharray="4 3"/><circle cx="100" cy="38" r="10" fill="#f6c453" stroke="#d99a1e" stroke-width="2"/></g>` : ''}
      <circle cx="100" cy="100" r="4" fill="var(--primary)"/></svg>`;
    return h('div', { class: 'sun-mode' },
      dial,
      up ? h('div', { class: 'turn-hint big' }, h('span', {}, `استقبل الشمس ثم استدر ${delta > 0 ? 'يمينًا' : 'يسارًا'} ${app.num(Math.abs(delta), 0)}°`))
        : h('div', { class: 'turn-hint' }, h('span', {}, 'الشمس تحت الأفق الآن — استخدم اللحظتين أدناه نهارًا')),
      h('p', { class: 'tiny', style: { textAlign: 'center' } }, up ? `الشمس الآن في اتجاه ${app.num(pos.azimuth, 0)}° وارتفاعها ${app.num(pos.altitude, 0)}° · القبلة ${app.num(info.bearing, 0)}°` : `القبلة ${app.num(info.bearing, 0)}° من الشمال`),
      h('div', { class: 'kv', style: { gridTemplateColumns: '1fr 1fr' } },
        h('div', {}, h('div', { class: 'v' }, fmtT(sun.sunAtQibla)), h('div', { class: 'k' }, 'الشمس في اتجاه القبلة اليوم')),
        h('div', {}, h('div', { class: 'v' }, fmtT(sun.shadowAtQibla)), h('div', { class: 'k' }, 'ظلّ العمود يشير إلى القبلة'))),
      h('ol', { class: 'steps' },
        h('li', {}, 'في اللحظة الأولى: استقبل الشمس مباشرةً تكن مستقبلًا للقبلة.'),
        h('li', {}, 'في اللحظة الثانية: انصب عودًا رأسيًا؛ يشير ظلّه إلى القبلة تمامًا.'),
        h('li', {}, 'هذه الطريقة لا تتأثر بالمغناطيس وتصلح لمعايرة البوصلة.')),
      zen.length ? h('div', { class: 'notice info', style: { marginTop: '10px' } }, h('span', { html: icon('info') }),
        h('span', {}, 'تعامد الشمس على الكعبة (الظلّ في كل مكان يعاكس القبلة): ', ...zen.map((e, i) => h('b', { class: 'ltr' }, `${i ? ' · ' : ''}${new Intl.DateTimeFormat(`ar-u-nu-${app.numerals}`, { timeZone: app.tz, day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(e.time)}`)), ' بتوقيتك المحلي.')) : null);
  }

  /* ---------- وضع الخريطة ---------- */
  let mapWorld = false;
  function mapPanel(loc) {
    const P = (lat, lon) => [lon + 180, 90 - lat];
    const pts = greatCirclePoints(loc.lat, loc.lon, KAABA.latitude, KAABA.longitude, 96);
    // تقسيم القوس عند خط التاريخ
    const segs = [[]]; for (let i = 0; i < pts.length; i++) { if (i && Math.abs(pts[i][1] - pts[i - 1][1]) > 180) segs.push([]); segs[segs.length - 1].push(P(pts[i][0], pts[i][1])); }
    const arcD = segs.map((sg) => sg.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')).join('');
    const [ux, uy] = P(loc.lat, loc.lon); const [kx, ky] = P(KAABA.latitude, KAABA.longitude);
    // الخط المستقيم على الخريطة (خط الرمب) للمقارنة — يُرسم فقط إن لم يعبر خط التاريخ
    const rhumb = Math.abs(loc.lon - KAABA.longitude) <= 180 ? `M${ux.toFixed(2)} ${uy.toFixed(2)}L${kx.toFixed(2)} ${ky.toFixed(2)}` : '';
    // إطار العرض: المنطقة حول القوس (مع هامش) أو العالم كله
    let vb = '0 0 360 180';
    if (!mapWorld) {
      const xs = segs.flat().map((p) => p[0]), ys = segs.flat().map((p) => p[1]);
      let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const padX = Math.max(12, (x1 - x0) * .18), padY = Math.max(8, (y1 - y0) * .25);
      x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
      let w = Math.max(60, x1 - x0), hgt = Math.max(37.5, y1 - y0);
      if (w / hgt > 1.6) hgt = w / 1.6; else w = hgt * 1.6;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      x0 = Math.max(0, Math.min(360 - w, cx - w / 2)); y0 = Math.max(0, Math.min(180 - hgt, cy - hgt / 2));
      vb = `${x0.toFixed(1)} ${y0.toFixed(1)} ${Math.min(360, w).toFixed(1)} ${Math.min(180, hgt).toFixed(1)}`;
    }
    let grat = ''; for (let lon = -150; lon <= 180; lon += 30) grat += `M${lon + 180} 0V180`; for (let lat = -60; lat <= 60; lat += 30) grat += `M0 ${90 - lat}H360`;
    const map = h('div', { class: 'qmap', role: 'img', 'aria-label': 'خريطة تبيّن أقصر مسار من موقعك إلى الكعبة' });
    map.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice"><path class="land" d="${WORLD_LAND_PATH}"/><path class="grat" d="${grat}"/>
      ${rhumb ? `<path class="rhumb" d="${rhumb}"/>` : ''}<path class="arc-halo" d="${arcD}"/><path class="arc" d="${arcD}"/>
      <g transform="translate(${ux.toFixed(2)} ${uy.toFixed(2)})"><circle r="1.6" fill="var(--primary)" stroke="#fff" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>
      <g transform="translate(${kx.toFixed(2)} ${ky.toFixed(2)})"><circle r="2.4" fill="#fff" stroke="var(--gold)" stroke-width=".5"/><rect x="-1.3" y="-1.3" width="2.6" height="2.6" rx=".3" fill="#1c1917"/><rect x="-1.3" y="-.4" width="2.6" height=".6" fill="var(--gold)"/></g></svg>`;
    return h('div', { class: 'map-mode' }, map,
      h('div', { class: 'legend' }, h('span', {}, h('i'), 'أقصر مسار على الكرة الأرضية (اتجاه القبلة)'), rhumb ? h('span', {}, h('i', { class: 'rh' }), 'الخط المستقيم على الخريطة المسطحة') : null),
      h('div', { class: 'map-toggle' }, h('button', { class: 'chip chip-btn', onclick: () => { mapWorld = !mapWorld; build(); } }, mapWorld ? 'تكبير على المنطقة' : 'عرض العالم كله')),
      h('p', { class: 'tiny', style: { textAlign: 'center', marginTop: '8px', lineHeight: 1.8 } }, `اتجاه القبلة هو اتجاه بداية هذا القوس من موقعك: ${app.num(info.bearing, 1)}° (${info.compassPoint}) · ${distText(info.distanceKm)}. القوس يبدو منحنيًا لأن الخريطة مسطحة، وهذا ما يفسّر مثلًا اتجاه القبلة الشمالي الشرقي من أمريكا الشمالية.`));
  }

  /* ---------- الموقع وهامش خطئه ---------- */
  const distText = (km) => km < 1 ? `${app.num(Math.round(km * 1000), 0)} م` : km < 10 ? `${app.num(km, 1)} كم` : `${app.num(Math.round(km), 0, true)} كم`;
  const uncertText = () => uncert >= 90 ? 'غير محدد' : `±${uncert < 1 ? app.num(uncert, 1) : app.num(Math.ceil(uncert), 0)}°`;
  function locationSourceText(loc) {
    if (!loc) return '';
    if (loc.source === 'gps') return loc.accuracy ? `GPS (دقة ±${app.num(loc.accuracy, 0)} م)` : 'GPS';
    if (loc.source === 'city') return 'مركز المدينة المحفوظ (تقريبي)';
    return 'إحداثيات مُدخلة يدويًا';
  }
  /** زر قراءة جديدة عالية الدقة من GPS؛ إعادة البناء تتم تلقائيًا عند تغيّر الموقع */
  function refineButton(label = 'تحديد موقعي بدقة (GPS)') {
    const btn = h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
      if (refining) return; refining = true; btn.disabled = true; render(btn, h('span', { class: 'spinner' }), ' جارٍ تحديد الموقع بدقة…');
      const loc = await app.detectLocation({ silent: true, fresh: true });
      refining = false;
      if (!loc) { btn.disabled = false; render(btn, h('span', { html: icon('gps') }), ` ${label}`); toast('تعذّر تحديد الموقع — تأكد من تفعيل خدمات الموقع للتطبيق ثم أعد المحاولة', 3800); return; }
      toast(loc.accuracy ? `تم تحديد موقعك (دقة ±${app.num(loc.accuracy, 0)} م)` : 'تم تحديد موقعك');
    } }, h('span', { html: icon('gps') }), ` ${label}`);
    return btn;
  }
  /** قرب الكعبة أو موقع لا يسمح بتحديد اتجاه: لوحة بدل بوصلة عشوائية */
  function nearPanel(loc) {
    const approx = loc.source !== 'gps';
    const d = distText(info.distanceKm);
    const title = approx ? (info.distanceKm < 0.05 ? `موقعك المحفوظ هو ${loc.name} — عند الكعبة نفسها` : `موقعك المحفوظ تقريبي وعلى بعد ${d} من الكعبة`)
      : info.distanceKm * 1000 < NEAR_KAABA_M ? `أنت على بعد ${d} من الكعبة` : `دقة موقعك (±${app.num(locErr, 0)} م) لا تكفي على بعد ${d}`;
    const text = approx ? 'الإحداثيات المحفوظة لمركز المدينة، لا لمكانك الفعلي، ولا يمكن حساب اتجاه دقيق منها على هذا القرب. حدّد موقعك الفعلي بدقة عالية ليُحسب الاتجاه من مكانك.'
      : info.distanceKm * 1000 < NEAR_KAABA_M ? 'أنت في المسجد الحرام أو على مقربة منه: توجّه إلى الكعبة مباشرة. على هذه المسافة تغيّر أمتار قليلة الاتجاهَ كثيرًا، فلا تعتمد على البوصلة هنا.'
      : 'على هذا القرب من الكعبة تغيّر أمتار قليلة الاتجاهَ كثيرًا. أعد تحديد الموقع في مكان مكشوف (بعيدًا عن الأسقف) للحصول على دقة أعلى.';
    return h('div', { class: 'near-kaaba' }, h('span', { class: 'nk-icon', html: icon('kaaba') }), h('h4', {}, title), h('p', {}, text), refineButton());
  }
  /** تنبيه «الاتجاه تقريبي» عندما يغلب خطأ الموقع على دقة البوصلة (قرب مكة أو موقع مدينة قريبة) */
  function uncertaintyNotice(loc) {
    if (nearKaaba || uncert <= UNCERTAIN_DEG) return null;
    const why = loc.source === 'city' ? `موقعك محفوظ كمدينة (${loc.name}) والإحداثيات لمركزها` : loc.source === 'gps' ? `دقة موقعك ±${app.num(locErr, 0)} م` : 'موقعك مُدخل يدويًا';
    return h('div', { class: 'calib uncertain' }, h('span', { html: icon('warning') }),
      h('div', {}, h('span', {}, `الاتجاه تقريبي (${uncertText()}): ${why}، وأنت على بعد ${distText(info.distanceKm)} من الكعبة فتؤثر أمتار قليلة في الاتجاه.`), refineButton()));
  }

  /* ---------- البناء ---------- */
  async function build() {
    const loc = app.location;
    clearInterval(sunTimer); sunTimer = null;
    if (!loc) {
      render(container, h('div', { class: 'card onboard' }, h('h2', {}, 'اتجاه القبلة'), h('p', {}, 'حدّد موقعك أولًا لحساب اتجاه القبلة بدقة.'),
        h('button', { class: 'btn btn-primary', onclick: () => app.openLocationSheet() }, h('span', { html: icon('location') }), ' تحديد الموقع')));
      return;
    }
    info = qiblaInfo(loc.lat, loc.lon);
    locErr = locationErrorM(loc); uncert = bearingUncertainty(info.distanceKm, locErr);
    nearKaaba = info.distanceKm * 1000 < NEAR_KAABA_M || uncert >= 90;
    const gm = await loadGeomag();
    if (gm && gm.magneticField) { try { const mf = gm.magneticField({ lat: loc.lat, lon: loc.lon, altKm: 0, date: new Date() }); decl = mf.declination; declOutOfRange = !!mf.outOfRange; declSource = 'WMM2025'; } catch (e) { decl = null; } } else decl = null;
    els = {};
    const head = h('div', { class: 'qibla-head' },
      h('h3', {}, h('span', { html: icon('kaaba') }), 'اتجاه القبلة'),
      h('div', { class: 'row', style: { gap: '6px' } },
        h('button', { class: 'chip chip-btn', onclick: () => app.openLocationSheet() }, h('span', { html: icon('location') }), describeLocation(loc)),
        h('button', { class: 'icon-btn', 'aria-label': 'تفاصيل', title: 'التفاصيل', onclick: openDetails }, h('span', { html: icon('info') }))));
    const seg = h('div', { class: 'segmented', style: { margin: '6px 0 10px' } },
      h('button', { class: mode === 'compass' ? 'active' : '', onclick: () => { mode = 'compass'; build(); } }, 'البوصلة'),
      h('button', { class: mode === 'sun' ? 'active' : '', onclick: () => { mode = 'sun'; build(); } }, 'الشمس'),
      h('button', { class: mode === 'map' ? 'active' : '', onclick: () => { mode = 'map'; build(); } }, 'الخريطة'));
    if (nearKaaba) { // عند الكعبة أو بموقع لا يسمح بتحديد اتجاه: لا بوصلة ولا شمس ولا خريطة
      generation++; stopSensor(); if (sensor === 'live' || sensor === 'starting') sensor = 'idle';
      render(container, h('div', { class: 'card qibla-card' }, head, nearPanel(loc)));
      return;
    }
    if (mode === 'map') {
      generation++; stopSensor(); if (sensor === 'live' || sensor === 'starting') sensor = 'idle';
      render(container, h('div', { class: 'card qibla-card' }, head, seg, uncertaintyNotice(loc), mapPanel(loc)));
      return;
    }
    if (mode === 'sun') {
      generation++; stopSensor(); if (sensor === 'live' || sensor === 'starting') sensor = 'idle';
      const body = h('div', {});
      const draw = () => render(body, sunPanel(loc));
      draw(); sunTimer = setInterval(draw, 60000);
      render(container, h('div', { class: 'card qibla-card' }, head, seg, uncertaintyNotice(loc), body));
      return;
    }
    els.wrap = h('div', { class: 'compass-wrap' });
    els.wrap.insertAdjacentHTML('beforeend', roseSVG(info.bearing));
    els.rose = els.wrap.querySelector('.compass-rose');
    els.needle = h('div', { class: 'needle', 'aria-hidden': 'true', html: NEEDLE_SVG });
    els.big = h('div', { class: 'big-num' });
    els.levelDot = h('i'); els.level = h('div', { class: 'level', hidden: true, title: 'استواء الهاتف' }, els.levelDot);
    els.overlay = h('div', { class: 'start-overlay', hidden: true });
    els.wrap.append(els.needle, h('div', { class: 'compass-center' }, els.big), els.level, els.overlay);
    els.hint = h('div', { class: 'turn-hint' });
    els.calib = h('div', {});
    const foot = h('div', { class: 'qibla-foot tiny' }, `القبلة ${app.num(info.bearing, 1)}° من الشمال · ${distText(info.distanceKm)} إلى الكعبة${app.settings.compass.declinationMode === 'off' ? ' · تصحيح الانحراف المغناطيسي متوقف' : ''}`);
    render(container, h('div', { class: 'card qibla-card' }, head, seg, uncertaintyNotice(loc), els.wrap, els.hint, els.calib, foot));
    paint();
    // تشغيل تلقائي حيث لا يلزم إذن بإيماءة؛ وإلا زرّ واحد فوق البوصلة
    if (sensor === 'idle' || sensor === 'none') { if (hasGesture()) start(); else paint(); }
  }

  // العودة من الخلفية: إعادة تشغيل المستشعر (يصفّر التنعيم ويكشف توقفه الصامت) حيث لا تلزم إيماءة؛ والإخفاء يوقفه توفيرًا للبطارية
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (compass) { generation++; stopSensor(); if (sensor === 'live' || sensor === 'starting' || sensor === 'stale') sensor = 'idle'; } return; }
    if (app.current === 'qibla' && mode === 'compass' && sensor === 'idle' && !nearKaaba && hasGesture()) start();
  });
  // إعادة البناء فقط عند تغيّر الموقع أو إعدادات البوصلة (لا عند كل تغيير في الإعدادات، كي لا يُعاد تشغيل المستشعر أثناء الاستخدام)
  let snapshot = JSON.stringify([app.location, app.settings.compass]);
  app.on('change', () => {
    const now = JSON.stringify([app.location, app.settings.compass]); if (now === snapshot) return; snapshot = now;
    generation++; stopSensor(); if (sensor === 'live' || sensor === 'starting') sensor = 'idle'; if (app.current === 'qibla') build(); else info = null;
  });
  build();
  return {
    refresh: build,
    show: () => { if (!info) build(); else if (mode === 'compass' && sensor === 'idle' && !nearKaaba && hasGesture()) start(); },
    hide: () => { generation++; stopSensor(); clearInterval(sunTimer); sunTimer = null; if (sensor === 'live' || sensor === 'starting') sensor = 'idle'; wasAligned = false; },
  };
}
