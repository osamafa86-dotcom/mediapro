/**
 * شاشة أذكار الصباح والمساء: عدّاد لكل ذكر مع حفظ التقدّم اليومي، اختيار الفترة تلقائيًا حسب مواقيت الصلاة.
 */
import { h, icon, render, toast, vibrate, switchEl, copyText, shareText } from './components.js';
import { ADHKAR } from '../data/adhkar.js';
import { openShareCardSheet } from './share-sheet.js';

export function mount(container, app) {
  let period = null; let hideDone = false; let selfUpdate = false; // selfUpdate: حفظ تقدّم من هذه الشاشة لا يستدعي إعادة بنائها

  function autoPeriod() {
    const tl = app.timeline(); const now = new Date();
    if (tl) return now >= tl.times.fajr && now < tl.times.dhuhr ? 'morning' : (now >= tl.times.asr || now < tl.times.fajr ? 'evening' : 'morning');
    const hr = Number(new Intl.DateTimeFormat('en-US', { timeZone: app.tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
    return hr >= 4 && hr < 12 ? 'morning' : 'evening';
  }
  /**
   * تقدّم اليوم: أذكار الصباح تُصفَّر مع اليوم المدني، أما أذكار المساء فتمتد إلى فجر اليوم التالي
   * (من قرأها بعد منتصف الليل لا يفقدها)، فتُصفَّر عند أول فتح بعد الفجر.
   */
  function progress() {
    let p = app.settings.adhkarProgress; const key = app.todayKey();
    const tl = app.timeline(); const afterFajr = !tl || new Date() >= tl.times.fajr;
    if (p.date !== key) {
      p = { date: key, morning: {}, evening: afterFajr ? {} : (p.evening || {}), eveningDate: afterFajr ? key : (p.eveningDate || p.date || key) };
      selfUpdate = true; app.replace('adhkarProgress', p); selfUpdate = false; return app.settings.adhkarProgress;
    }
    if (afterFajr && p.eveningDate && p.eveningDate !== key) {
      p = { ...p, evening: {}, eveningDate: key };
      selfUpdate = true; app.replace('adhkarProgress', p); selfUpdate = false; return app.settings.adhkarProgress;
    }
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

  function actionsRow(d) {
    const txt = `${textOf(d)}\n\n${d.reference}`;
    return h('div', { class: 'dhikr-actions' },
      h('button', { class: 'icon-btn', 'aria-label': 'نسخ', title: 'نسخ', onclick: (e) => { e.stopPropagation(); copyText(txt); } }, h('span', { html: icon('copy') })),
      h('button', { class: 'icon-btn', 'aria-label': 'مشاركة', title: 'مشاركة', onclick: (e) => { e.stopPropagation(); shareText('من أذكار ' + (period === 'morning' ? 'الصباح' : 'المساء'), txt); } }, h('span', { html: icon('share') })),
      h('button', { class: 'icon-btn', 'aria-label': 'مشاركة كصورة', title: 'مشاركة كصورة', onclick: (e) => { e.stopPropagation(); openShareCardSheet({ title: period === 'morning' ? 'أذكار الصباح' : 'أذكار المساء', text: textOf(d), footer: d.reference, filename: `dhikr-${d.id}.png`, shareText: txt }); } }, h('span', { html: icon('image') })));
  }
  const tile = (label, sub, ic, onclick) => h('button', { class: 'more-tile sm', onclick }, h('span', { html: icon(ic) }), label, h('small', {}, sub));
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
          h('div', {}, h('div', { class: 'ref' }, d.reference), d.note ? h('div', { class: 'tiny' }, d.note) : null, h('div', { class: 'tiny' }, `يُقال ${tgt === 1 ? 'مرة واحدة' : tgt === 2 ? 'مرتين' : `${app.num(tgt)} مرات`}`), actionsRow(d)),
          btn));
      const tap = () => {
        if (count >= tgt) return;
        count++; const p = progress(); p[period][d.id] = count; selfUpdate = true; app.update({ adhkarProgress: p }); selfUpdate = false;
        vibrate(count >= tgt ? [40, 40, 40] : 15);
        paintBtn();
        if (count >= tgt) { card.classList.add('done'); const nowDone = items().filter((x) => (app.settings.adhkarProgress[period][x.id] || 0) >= target(x)).length; ring.querySelector('output').textContent = `${app.num(nowDone)}/${app.num(list.length)}`; const r = 27, c = 2 * Math.PI * r; ring.querySelector('.fg').setAttribute('stroke-dashoffset', c * (1 - nowDone / list.length)); if (nowDone === list.length) toast('تقبّل الله منك ✦ أتممت أذكار ' + (period === 'morning' ? 'الصباح' : 'المساء'), 4000); if (hideDone) setTimeout(() => card.remove(), 400); }
      };
      btn.addEventListener('click', tap);
      card.addEventListener('click', (e) => { if (e.target === card || e.target.classList.contains('text') || e.target.classList.contains('ayah')) tap(); });
      return card;
    });
    render(container,
      h('div', { class: 'more-grid', style: { marginBottom: '12px' } },
        tile('حصن المسلم', 'الكتاب كاملًا: 132 بابًا', 'book', () => app.navigate('hisn')),
        tile('المسبحة', 'عدّاد التسبيح', 'tasbih', () => app.navigate('tasbih'))),
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
  app.on('change', () => { if (selfUpdate) return; if (app.current === 'adhkar') build(); else period = null; });
  build();
  return { refresh: build, show: () => { period = period || autoPeriod(); build(); } };
}
