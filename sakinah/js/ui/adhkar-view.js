/**
 * شاشة أذكار الصباح والمساء: عدّاد لكل ذكر مع حفظ التقدّم اليومي، اختيار الفترة تلقائيًا حسب مواقيت الصلاة.
 */
import { h, icon, render, toast, vibrate, switchEl } from './components.js';
import { ADHKAR } from '../data/adhkar.js';

export function mount(container, app) {
  let period = null; let hideDone = false;

  function autoPeriod() {
    const tl = app.timeline(); const now = new Date();
    if (tl) return now >= tl.times.fajr && now < tl.times.dhuhr ? 'morning' : (now >= tl.times.asr || now < tl.times.fajr ? 'evening' : 'morning');
    const hr = Number(new Intl.DateTimeFormat('en-US', { timeZone: app.tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
    return hr >= 4 && hr < 12 ? 'morning' : 'evening';
  }
  function progress() {
    const p = app.settings.adhkarProgress; const key = app.todayKey();
    if (p.date !== key) { app.replace('adhkarProgress', { date: key, morning: {}, evening: {} }); return app.settings.adhkarProgress; }
    return p;
  }
  function items() { return ADHKAR.filter((d) => d.period === 'both' || d.period === period); }
  function target(d) { return period === 'evening' && d.repeatEvening ? d.repeatEvening : d.repeat; }
  function textOf(d) { return period === 'evening' && d.textEvening ? d.textEvening : d.text; }
  /** إبراز الآيات داخل ﴿ ﴾ */
  function richText(t) {
    const frag = document.createDocumentFragment();
    const parts = t.split(/(﴿[^﴾]*﴾)/g);
    for (const part of parts) { if (!part) continue; frag.append(part.startsWith('﴿') ? h('span', { class: 'ayah' }, part) : part); }
    return frag;
  }

  function build() {
    if (!period) period = autoPeriod();
    const prog = progress(); const done = prog[period] || {};
    const list = items();
    const completed = list.filter((d) => (done[d.id] || 0) >= target(d)).length;
    const ring = (() => {
      const r = 27, c = 2 * Math.PI * r, pct = list.length ? completed / list.length : 0;
      return h('div', { class: 'ring' }, h('div', { html: `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="${r}"/><circle class="fg" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>` }), h('output', {}, `${app.num(completed)}/${app.num(list.length)}`));
    })();
    const cards = list.filter((d) => !hideDone || (done[d.id] || 0) < target(d)).map((d) => {
      const tgt = target(d); let count = done[d.id] || 0;
      const remaining = () => Math.max(0, tgt - count);
      const btn = h('button', { class: `count-btn ${count >= tgt ? 'done' : ''}`, 'aria-label': 'عدّ' });
      const paintBtn = () => render(btn, count >= tgt ? h('span', { html: icon('check') }) : h('span', {}, app.num(remaining()), h('small', {}, tgt === 1 ? 'مرة' : 'متبقٍ')));
      paintBtn();
      const card = h('article', { class: `card dhikr ${count >= tgt ? 'done' : ''}` },
        h('p', { class: 'text', lang: 'ar' }, richText(textOf(d))),
        d.virtue ? h('div', { class: 'virtue' }, '✦ ', d.virtue) : null,
        h('div', { class: 'dhikr-foot', style: { marginTop: '10px' } },
          h('div', {}, h('div', { class: 'ref' }, d.reference), d.note ? h('div', { class: 'tiny' }, d.note) : null, h('div', { class: 'tiny' }, `يُقال ${tgt === 1 ? 'مرة واحدة' : tgt === 2 ? 'مرتين' : `${app.num(tgt)} مرات`}`)),
          btn));
      const tap = () => {
        if (count >= tgt) return;
        count++; const p = progress(); p[period][d.id] = count; app.update({ adhkarProgress: p });
        vibrate(count >= tgt ? [40, 40, 40] : 15);
        paintBtn();
        if (count >= tgt) { card.classList.add('done'); const nowDone = items().filter((x) => (app.settings.adhkarProgress[period][x.id] || 0) >= target(x)).length; ring.querySelector('output').textContent = `${app.num(nowDone)}/${app.num(list.length)}`; const r = 27, c = 2 * Math.PI * r; ring.querySelector('.fg').setAttribute('stroke-dashoffset', c * (1 - nowDone / list.length)); if (nowDone === list.length) toast('تقبّل الله منك ✦ أتممت أذكار ' + (period === 'morning' ? 'الصباح' : 'المساء'), 4000); if (hideDone) setTimeout(() => card.remove(), 400); }
      };
      btn.addEventListener('click', tap);
      card.addEventListener('click', (e) => { if (e.target === card || e.target.classList.contains('text') || e.target.classList.contains('ayah')) tap(); });
      return card;
    });
    render(container,
      h('div', { class: 'segmented', style: { marginBottom: '12px' } },
        h('button', { class: period === 'morning' ? 'active' : '', onclick: () => { period = 'morning'; build(); } }, '☀️ أذكار الصباح'),
        h('button', { class: period === 'evening' ? 'active' : '', onclick: () => { period = 'evening'; build(); } }, '🌙 أذكار المساء')),
      h('div', { class: 'card' },
        h('div', { class: 'progress-ring' }, ring,
          h('div', { style: { flex: 1 } }, h('b', {}, period === 'morning' ? 'أذكار الصباح' : 'أذكار المساء'), h('div', { class: 'tiny' }, period === 'morning' ? 'من بعد الفجر إلى طلوع الشمس، وتُجزئ إلى الزوال' : 'من بعد العصر إلى الغروب، وتُجزئ إلى منتصف الليل'),
            h('div', { class: 'row wrap', style: { marginTop: '8px', gap: '8px' } },
              h('button', { class: 'btn btn-sm btn-outline', onclick: () => { progress(); app.replace(`adhkarProgress.${period}`, {}); build(); } }, h('span', { html: icon('reset') }), ' إعادة'),
              h('label', { class: 'row tiny', style: { gap: '6px' } }, switchEl(hideDone, (v) => { hideDone = v; build(); }, 'إخفاء المكتمل'), 'إخفاء المكتمل'),
              h('div', { class: 'text-scale-ctl' }, h('button', { onclick: () => scale(-0.1), 'aria-label': 'تصغير الخط' }, 'أ-'), h('button', { onclick: () => scale(0.1), 'aria-label': 'تكبير الخط' }, 'أ+')))))),
      ...cards,
      h('p', { class: 'tiny', style: { textAlign: 'center' } }, 'النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي القحطاني، بترتيبه وتخريجه. اضغط على الذكر أو على العدّاد للعدّ.'));
  }
  function scale(d) {
    const v = Math.min(1.6, Math.max(0.8, +((app.settings.textScale || 1) + d).toFixed(2)));
    app.set('textScale', v); app.applyTextScale();
  }
  app.on('change', () => { if (app.current === 'adhkar') build(); else period = null; });
  build();
  return { refresh: build, show: () => { period = period || autoPeriod(); build(); } };
}
