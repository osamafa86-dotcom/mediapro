/**
 * شاشة مواقيت الصلاة: البطاقة الرئيسية (الصلاة التالية والعدّ التنازلي)، الجدول اليومي، منتصف الليل والثلث الأخير،
 * الجدول الشهري، تصدير التقويم.
 */
import { h, icon, render, openSheet, closeSheet, toast, fmtCountdown, fmtDurationWords } from './components.js';
import { PRAYERS, PRAYER_NAMES_AR, civilDate, addDays } from '../core/prayer-times.js';
import { buildICS, downloadFile } from '../platform/notifications.js';
import { describeLocation } from '../platform/location.js';

const PRAYER_ICON = { fajr: 'dawn', sunrise: 'sunrise', dhuhr: 'noon', asr: 'sun', maghrib: 'sunset', isha: 'moon' };
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function mount(container, app) {
  let tl = null; let els = {};

  function onboarding() {
    render(container,
      h('div', { class: 'card onboard' },
        h('div', { class: 'art', html: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>` }),
        h('h2', {}, 'أهلًا بك في سكينة'),
        h('p', {}, 'لحساب مواقيت الصلاة واتجاه القبلة بدقة نحتاج إلى موقعك. تُحفظ إحداثياتك على جهازك، ولا يُرسل منها إلا نسخة مقرّبة (نحو كيلومتر) لتسمية مدينتك، ويمكن إيقاف ذلك من الإعدادات.'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn btn-primary btn-block', onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true; render(b, h('span', { class: 'spinner' }), ' جارٍ تحديد الموقع…');
            const ok = await app.detectLocation();
            if (!ok) { b.disabled = false; render(b, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا'); }
          } }, h('span', { html: icon('gps') }), ' تحديد موقعي تلقائيًا'),
          h('button', { class: 'btn btn-outline btn-block', onclick: () => app.openLocationSheet() }, h('span', { html: icon('search') }), ' اختيار مدينة من القائمة'))),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('h3', {}, h('span', { html: icon('info') }), 'ماذا يقدّم التطبيق؟')),
        h('ul', { class: 'muted', style: { paddingRight: '18px', margin: 0, fontSize: '14px', lineHeight: '1.9' } },
          h('li', {}, 'مواقيت الصلاة بحساب فلكي دقيق وطرق الحساب الرسمية لكل بلد'),
          h('li', {}, 'اتجاه القبلة الجيوديسي مع تصحيح الانحراف المغناطيسي والتحقق بالشمس'),
          h('li', {}, 'أذكار الصباح والمساء من حصن المسلم مع عدّاد'),
          h('li', {}, 'أحاديث مختارة من صحيحي البخاري ومسلم'),
          h('li', {}, 'تذكير بمواعيد الصلاة وتصدير المواقيت إلى تقويم هاتفك'))));
  }

  function build() {
    const loc = app.location;
    if (!loc) { onboarding(); return; }
    tl = app.timeline();
    const s = app.settings;
    const hj = app.hijri();
    els = {};
    const bell = (key) => {
      const on = s.notifications.enabled && s.notifications.prayers[key];
      return h('button', { class: `bell ${on ? 'on' : ''}`, 'aria-label': `تنبيه ${PRAYER_NAMES_AR[key]}`, title: on ? 'التنبيه مفعّل' : 'التنبيه متوقف', onclick: async () => {
        if (!app.settings.notifications.enabled) {
          // أول تفعيل: نطلب الإذن ونفعّل هذه الصلاة تحديدًا
          const ok = await app.enableNotifications(true); if (!ok) return;
          app.set(`notifications.prayers.${key}`, true);
          return;
        }
        app.set(`notifications.prayers.${key}`, !app.settings.notifications.prayers[key]);
      } }, h('span', { html: icon(on ? 'bell' : 'bellOff') }));
    };
    const rows = PRAYERS.map((key) => {
      const t = tl.times[key];
      const row = h('div', { class: `time-row ${key === 'sunrise' ? 'sunrise' : ''} ${tl.current === key ? 'current' : ''} ${tl.next.key === key && !tl.next.isTomorrow ? 'next' : ''}` },
        h('div', { class: 'name' }, h('span', { html: icon(PRAYER_ICON[key]) }), PRAYER_NAMES_AR[key]),
        h('div', { class: 'row' }, bell(key), tl.next.key === key && !tl.next.isTomorrow ? h('span', { class: 'next-badge' }, 'التالية') : null, h('span', { class: 'time' }, app.fmt(t))));
      return row;
    });
    els.prayerName = h('div', { class: 'hero-prayer' }); els.prayerTime = h('div', { class: 'hero-time' });
    els.count = h('span', { class: 'count' }); els.countLbl = h('span', { class: 'lbl' }); els.bar = h('i');
    els.words = h('span');
    render(container,
      h('div', { class: 'hero' },
        h('div', { class: 'hero-top' },
          h('div', {}, h('div', { class: 'hero-label' }, 'الصلاة التالية'), els.prayerName, els.prayerTime),
          h('button', { class: 'chip loc-chip chip-btn', onclick: () => app.openLocationSheet(), title: 'تغيير الموقع' }, h('span', { html: icon('location') }), describeLocation(loc))),
        h('div', { class: 'hero-countdown' }, els.count, els.countLbl),
        h('div', { class: 'hero-progress' }, els.bar),
        h('div', { class: 'hero-meta' }, h('span', {}, `${hj.weekday}، ${app.num(hj.day)} ${hj.monthName} ${app.num(hj.year)}هـ`), h('span', {}, app.gregorian()))),
      h('div', { class: 'card', style: { padding: '8px' } }, h('div', { class: 'times' }, rows)),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('h3', {}, h('span', { html: icon('moon') }), 'قيام الليل'), h('span', { class: 'tiny' }, 'من المغرب إلى فجر الغد')),
        h('div', { class: 'extras' },
          h('div', { class: 'extra' }, h('div', { class: 'v' }, app.fmt(tl.sunnah.middleOfNight)), h('div', { class: 'k' }, 'منتصف الليل')),
          h('div', { class: 'extra' }, h('div', { class: 'v' }, app.fmt(tl.sunnah.lastThird)), h('div', { class: 'k' }, 'بداية الثلث الأخير')))),
      h('div', { class: 'grid-2' },
        h('button', { class: 'btn btn-outline', onclick: openMonth }, h('span', { html: icon('calendar') }), ' جدول الشهر'),
        h('button', { class: 'btn btn-outline', onclick: exportICS }, h('span', { html: icon('download') }), ' تصدير للتقويم')),
      h('p', { class: 'tiny', style: { textAlign: 'center', marginTop: '12px' } },
        `طريقة الحساب: ${app.methodName()}${s.madhab === 'hanafi' ? ' · العصر: حنفي' : ''}${tl.times.resolved.polarResolved ? ' · حُسبت بأقرب خط عرض (منطقة قطبية)' : ''} · `,
        h('a', { href: '#/settings', onclick: (e) => { e.preventDefault(); app.navigate('settings'); } }, 'تغيير')));
    tick();
  }

  function tick() {
    if (!tl || !els.count) return;
    const now = new Date();
    if (now >= tl.next.time) { build(); return; }
    const remaining = tl.next.time - now;
    els.prayerName.textContent = PRAYER_NAMES_AR[tl.next.key] + (tl.next.isTomorrow ? ' (غدًا)' : tl.next.isYesterday ? ' (ليلة الأمس)' : '');
    els.prayerTime.textContent = app.fmt(tl.next.time);
    els.count.textContent = fmtCountdown(remaining, app.numerals);
    els.countLbl.textContent = `متبقٍ (${fmtDurationWords(remaining, app.numerals)})`;
    // شريط التقدّم بين الصلاة الحالية والتالية
    const curKey = tl.current; const curTime = tl.times[curKey];
    let start = curTime && curTime < tl.next.time ? curTime.getTime() : tl.next.time.getTime() - 6 * 3600e3;
    if (tl.current === 'isha' && tl.next.key === 'fajr' && !tl.next.isTomorrow) start = tl.next.time.getTime() - 8 * 3600e3;
    const pct = Math.min(100, Math.max(0, ((now - start) / (tl.next.time - start)) * 100));
    els.bar.style.width = `${pct}%`;
  }

  function openMonth() {
    const now = new Date(); let civil = civilDate(now, app.tz); let y = civil.year, m = civil.month;
    const wrap = h('div', { class: 'table-wrap' }); const title = h('h3', {});
    const draw = () => {
      // معاملات كل يوم على حدة (رمضان قد يبدأ أو ينتهي وسط الشهر الميلادي)
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const rows = []; for (let d = 1; d <= days; d++) rows.push(app.timesFor({ year: y, month: m, day: d }));
      title.textContent = `${MONTHS_AR[m - 1]} ${app.num(y)}`;
      const today = civilDate(new Date(), app.tz);
      render(wrap, h('table', { class: 'month' },
        h('thead', {}, h('tr', {}, h('th', {}, 'اليوم'), ...PRAYERS.map((k) => h('th', {}, PRAYER_NAMES_AR[k])))),
        h('tbody', {}, rows.map((r) => h('tr', { class: today.year === y && today.month === m && today.day === r.date.day ? 'today' : '' },
          h('td', {}, `${app.num(r.date.day)} ${['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][new Date(Date.UTC(y, m - 1, r.date.day)).getUTCDay()]}`),
          ...PRAYERS.map((k) => h('td', { class: 'ltr' }, app.fmt(r[k]))))))));
    };
    const nav = (d) => { m += d; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } draw(); };
    draw();
    openSheet({ title: 'الجدول الشهري', content: h('div', {},
      h('div', { class: 'row between', style: { marginBottom: '10px' } },
        h('button', { class: 'btn btn-sm btn-outline', onclick: () => nav(-1) }, 'الشهر السابق'), title,
        h('button', { class: 'btn btn-sm btn-outline', onclick: () => nav(1) }, 'الشهر التالي')),
      wrap,
      h('p', { class: 'tiny', style: { marginTop: '10px' } }, `الموقع: ${describeLocation(app.location)} · الطريقة: ${app.methodName()}`)) });
  }

  function exportICS() {
    const c = app.coords(); if (!c) return;
    const start = civilDate(new Date(), app.tz); const days = [];
    for (let i = 0; i < 30; i++) { const d = addDays(start, i); days.push(app.timesFor(d)); }
    const prefs = app.settings.notifications;
    const ics = buildICS(days, { locationName: describeLocation(app.location), prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, preMinutes: prefs.preMinutes || 0, includeSunrise: false });
    downloadFile(`sakinah-prayer-times-${start.year}-${String(start.month).padStart(2, '0')}.ics`, ics);
    toast('تم إنشاء ملف التقويم لـ 30 يومًا مع منبّهات — افتحه لإضافته إلى تقويم هاتفك', 5000);
  }

  // إعادة البناء فقط عند تغيّر مدخلات الحساب أو اليوم (لا مع كل حفظ في التطبيق كنقرة ذكر)، وعند الإخفاء نؤجّلها إلى العودة
  const signature = () => { const s = app.settings; return JSON.stringify([app.location, s.method, s.madhab, s.highLatitudeRule, s.shafaq, s.adjustments, s.custom, s.hijriOffset, s.hour12, s.numerals, s.notifications, s.textScale, app.todayKey()]); };
  let lastSig = signature(); let dirty = false;
  app.on('change', () => { const sig = signature(); if (sig === lastSig) return; lastSig = sig; if (app.current === 'prayer') build(); else dirty = true; });
  app.on('tick', () => { if (app.current === 'prayer') tick(); });
  build();
  return { refresh: build, show: () => { if (dirty) { dirty = false; build(); } tick(); } };
}
