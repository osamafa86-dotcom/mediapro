/**
 * شاشة القبلة: بوصلة حيّة مع تصحيح الانحراف المغناطيسي (WMM2025)، الاتجاه الجيوديسي والمسافة،
 * التحقق بالشمس (الشمس/الظل في اتجاه القبلة)، وحادثتا تعامد الشمس على الكعبة.
 */
import { h, icon, render, toast, vibrate } from './components.js';
import { qiblaInfo, sunQiblaMoments, kaabaZenithEvents, signedDifference } from '../core/qibla.js';
import { startCompass, accuracyLabel, magneticToTrue } from '../platform/compass.js';
import { civilDate } from '../core/prayer-times.js';
import { describeLocation } from '../platform/location.js';

let geomagMod = null;
async function loadGeomag() {
  if (geomagMod) return geomagMod;
  try { geomagMod = await import('../core/geomag.js'); } catch (e) { console.warn('geomag unavailable', e); geomagMod = false; }
  return geomagMod;
}

function roseSVG(bearing) {
  const ticks = [];
  for (let a = 0; a < 360; a += 5) {
    const major = a % 90 === 0, mid = a % 30 === 0;
    const r1 = major ? 78 : mid ? 82 : 86, r2 = 92;
    const rad = (a - 90) * Math.PI / 180;
    ticks.push(`<line x1="${(100 + r1 * Math.cos(rad)).toFixed(2)}" y1="${(100 + r1 * Math.sin(rad)).toFixed(2)}" x2="${(100 + r2 * Math.cos(rad)).toFixed(2)}" y2="${(100 + r2 * Math.sin(rad)).toFixed(2)}" stroke="currentColor" stroke-opacity="${major ? 1 : mid ? .6 : .3}" stroke-width="${major ? 2.2 : 1.2}" />`);
  }
  const labels = [['ش', 0], ['ق', 90], ['ج', 180], ['غ', 270]].map(([t, a]) => {
    const rad = (a - 90) * Math.PI / 180; return `<text x="${100 + 66 * Math.cos(rad)}" y="${100 + 66 * Math.sin(rad) + 6}" text-anchor="middle" font-size="17" font-weight="900" font-family="Tajawal, sans-serif" fill="${a === 0 ? 'var(--danger)' : 'currentColor'}">${t}</text>`;
  }).join('');
  return `<svg class="compass-rose" viewBox="0 0 200 200" style="color:var(--text)">
    <circle cx="100" cy="100" r="96" fill="var(--bg-elev)" stroke="var(--line)" stroke-width="2"/>
    <circle cx="100" cy="100" r="58" fill="none" stroke="var(--line)" stroke-width="1"/>
    ${ticks.join('')}${labels}
    <g class="qibla-marker" transform="rotate(${bearing} 100 100)">
      <line x1="100" y1="100" x2="100" y2="26" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 3"/>
      <g transform="translate(100 18)">
        <rect x="-11" y="-11" width="22" height="22" rx="3" fill="#1c1917" stroke="var(--gold)" stroke-width="2"/>
        <rect x="-11" y="-4" width="22" height="4" fill="var(--gold)"/>
      </g>
    </g>
    <circle cx="100" cy="100" r="4" fill="var(--primary)"/>
  </svg>`;
}

export function mount(container, app) {
  let compass = null; let decl = null; let declSource = ''; let reading = null; let els = {}; let info = null; let lastVib = 0;

  function stop() { if (compass) { compass.stop(); compass = null; } reading = null; }

  async function start(btn) {
    try {
      btn.disabled = true;
      compass = await startCompass((r) => { reading = r; paint(); });
      render(btn, h('span', { html: icon('close') }), ' إيقاف البوصلة');
      btn.disabled = false; btn.onclick = () => { stop(); build(); };
      if (els.status) render(els.status, h('div', { class: 'notice info' }, h('span', { html: icon('info') }), 'أمسك الهاتف أفقيًا بعيدًا عن المعادن والمغناطيس. إن كانت القراءة غير مستقرة حرّكه على شكل الرقم 8.'));
    } catch (e) {
      btn.disabled = false;
      const msg = e.code === 'denied' ? 'لم يُمنح إذن الوصول إلى مستشعرات الحركة. على iOS: الإعدادات ← Safari ← الحركة والاتجاه.' : e.code === 'insecure' ? 'تعمل البوصلة على HTTPS فقط.' : 'هذا الجهاز/المتصفح لا يوفّر بوصلة. استخدم الاتجاه بالدرجات مع بوصلة يدوية أو طريقة الشمس.';
      if (els.status) render(els.status, h('div', { class: 'notice danger' }, h('span', { html: icon('warning') }), msg));
    }
  }

  function paint() {
    if (!els.rose || !info) return;
    const noSensor = !reading;
    const useDecl = app.settings.compass.declinationMode !== 'off' && decl !== null;
    const trueHeading = noSensor ? 0 : (useDecl ? magneticToTrue(reading.magneticHeading, decl) : reading.magneticHeading);
    els.rose.style.transform = `rotate(${-trueHeading}deg)`;
    const delta = signedDifference(info.bearing, trueHeading);
    const aligned = !noSensor && Math.abs(delta) <= 3;
    els.wrap.classList.toggle('aligned', aligned);
    if (noSensor) {
      els.deg.textContent = `${app.num(info.bearing, 1)}°`; els.sub.textContent = 'من الشمال الحقيقي';
      els.hint.textContent = ''; els.hint.className = 'turn-hint';
    } else {
      els.deg.textContent = `${app.num(trueHeading, 0)}°`; els.sub.textContent = 'اتجاه الهاتف';
      if (aligned) { els.hint.textContent = '✓ أنت متجه إلى القبلة'; els.hint.className = 'turn-hint ok'; if (Date.now() - lastVib > 2500) { vibrate(60); lastVib = Date.now(); } }
      else { els.hint.textContent = `أدر الهاتف ${delta > 0 ? 'يمينًا' : 'يسارًا'} ${app.num(Math.abs(delta), 0)}°`; els.hint.className = 'turn-hint'; }
      if (els.acc) {
        const a = accuracyLabel(reading.accuracy);
        const rel = !reading.absolute;
        render(els.acc, h('span', { class: `chip ${rel ? 'danger' : a.level === 'high' ? 'ok' : a.level === 'bad' ? 'danger' : ''}` }, rel ? 'قراءة نسبية — لا مرجع للشمال!' : `دقة المستشعر: ${a.label}${reading.accuracy !== null ? ` (±${app.num(reading.accuracy, 0)}°)` : ''}`));
      }
    }
  }

  async function build() {
    const loc = app.location;
    if (!loc) {
      render(container, h('div', { class: 'card onboard' }, h('h2', {}, 'اتجاه القبلة'), h('p', {}, 'حدّد موقعك أولًا لحساب اتجاه القبلة بدقة.'),
        h('button', { class: 'btn btn-primary', onclick: () => app.openLocationSheet() }, h('span', { html: icon('location') }), ' تحديد الموقع')));
      return;
    }
    info = qiblaInfo(loc.lat, loc.lon);
    const gm = await loadGeomag();
    if (gm && gm.declination) {
      try { decl = gm.declination(loc.lat, loc.lon, 0, new Date()); declSource = 'WMM2025'; } catch (e) { decl = null; }
    } else decl = null;
    els = {};
    els.wrap = h('div', { class: 'compass-wrap' }, h('div', { class: 'compass-pointer', 'aria-hidden': 'true' }));
    els.wrap.insertAdjacentHTML('beforeend', roseSVG(info.bearing));
    els.rose = els.wrap.querySelector('.compass-rose');
    els.deg = h('div', { class: 'deg' }); els.sub = h('div', { class: 'sub' });
    els.wrap.append(h('div', { class: 'compass-center' }, h('div', {}, els.deg, els.sub)));
    els.hint = h('div', { class: 'turn-hint' });
    els.status = h('div', {});
    els.acc = h('div', { class: 'row', style: { justifyContent: 'center', minHeight: '30px' } });
    const startBtn = h('button', { class: 'btn btn-primary btn-block' }, h('span', { html: icon('compass') }), ' تشغيل البوصلة');
    startBtn.onclick = () => start(startBtn);

    const now = new Date(); const civil = civilDate(now, app.tz);
    const sun = sunQiblaMoments(loc.lat, loc.lon, civil, app.tz);
    const zen = kaabaZenithEvents(civil.year).concat(kaabaZenithEvents(civil.year + 1)).filter((e) => e.time > now).slice(0, 2);
    const declMode = app.settings.compass.declinationMode;
    const declText = decl === null ? 'غير متاح' : `${decl >= 0 ? '+' : '−'}${app.num(Math.abs(decl), 1)}° ${decl >= 0 ? 'شرقًا' : 'غربًا'}`;

    render(container,
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('h3', {}, h('span', { html: icon('kaaba') }), 'اتجاه القبلة'), h('span', { class: 'chip' }, h('span', { html: icon('location') }), describeLocation(loc))),
        els.wrap, els.hint, els.acc,
        h('div', { class: 'kv', style: { marginBottom: '12px' } },
          h('div', {}, h('div', { class: 'v' }, `${app.num(info.bearing, 2)}°`), h('div', { class: 'k' }, `القبلة (${info.compassPoint})`)),
          h('div', {}, h('div', { class: 'v' }, `${app.num(Math.round(info.distanceKm), 0, true)} كم`), h('div', { class: 'k' }, 'المسافة إلى الكعبة')),
          h('div', {}, h('div', { class: 'v' }, declText), h('div', { class: 'k' }, `الانحراف المغناطيسي${declSource ? ` (${declSource})` : ''}`))),
        startBtn, h('div', { style: { marginTop: '10px' } }, els.status),
        declMode === 'off' ? h('div', { class: 'notice', style: { marginTop: '10px' } }, h('span', { html: icon('warning') }), 'تصحيح الانحراف المغناطيسي متوقف من الإعدادات؛ تُعرض الاتجاهات بالنسبة للشمال المغناطيسي.') : null,
        h('p', { class: 'tiny', style: { marginTop: '10px', lineHeight: '1.8' } },
          `الاتجاه محسوب جيوديسيًا على مجسّم WGS‑84 (Vincenty) من الشمال الحقيقي. الفرق عن الحل الكروي هنا ${app.num(Math.abs(info.difference), 3)}°. `,
          'مستشعرات الهاتف تعطي الشمال المغناطيسي، لذا يُضاف الانحراف المغناطيسي تلقائيًا من النموذج المغناطيسي العالمي WMM2025.')),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('h3', {}, h('span', { html: icon('sun') }), 'التحقق بالشمس (بلا بوصلة)')),
        h('div', { class: 'kv', style: { gridTemplateColumns: '1fr 1fr' } },
          h('div', {}, h('div', { class: 'v' }, sun.sunAtQibla ? app.fmt(sun.sunAtQibla) : '—'), h('div', { class: 'k' }, 'الشمس في اتجاه القبلة اليوم')),
          h('div', {}, h('div', { class: 'v' }, sun.shadowAtQibla ? app.fmt(sun.shadowAtQibla) : '—'), h('div', { class: 'k' }, 'ظلّ العمود يشير إلى القبلة'))),
        h('ol', { class: 'steps' },
          h('li', {}, 'في اللحظة الأولى: استقبل الشمس مباشرةً تكن مستقبلًا للقبلة.'),
          h('li', {}, 'في اللحظة الثانية: انصب عودًا رأسيًا؛ يشير ظلّه إلى القبلة تمامًا.'),
          h('li', {}, 'هذه الطريقة لا تتأثر بالمغناطيس وتُستخدم لمعايرة البوصلة.')),
        zen.length ? h('div', { class: 'notice info', style: { marginTop: '12px' } }, h('span', { html: icon('info') }),
          h('span', {}, 'تعامد الشمس على الكعبة (الظلّ في كل مكان يعاكس القبلة): ', ...zen.map((e, i) => h('b', { class: 'ltr' }, `${i ? ' · ' : ''}${new Intl.DateTimeFormat(`ar-u-nu-${app.numerals}`, { timeZone: app.tz, day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(e.time)}`)), ' بتوقيتك المحلي.')) : null));
    paint();
  }

  app.on('change', () => { stop(); if (app.current === 'qibla') build(); else info = null; });
  build();
  return { refresh: build, show: () => { if (!info) build(); }, hide: () => { stop(); if (els.acc) render(els.acc); if (app.location) build(); } };
}
