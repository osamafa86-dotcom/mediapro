/**
 * المسبحة الإلكترونية: زر كبير للعدّ مع حلقة تقدّم، صيغ ذكر جاهزة أو مخصّصة، هدف (33/99/100/1000/بلا حد)، دورات،
 * وإحصاء اليوم والإجمالي لكل صيغة. الحالة تُحفظ صامتة في الإعدادات فيستمر العدّ بعد الإغلاق.
 */
import { h, icon, render, toast, vibrate, openSheet, closeSheet } from './components.js';
import { TASBIH_PHRASES, TASBIH_TARGETS, normalizeTasbih, tap, undo, resetCount, phraseText, todayCount, totalCount, grandTotal } from '../core/tasbih.js';
import * as store from '../platform/storage.js';

export function mount(container, app) {
  let state = normalizeTasbih(app.settings.tasbih);
  const save = () => store.set('tasbih', state); // حفظ صامت (بلا حدث change) كي لا تُعاد بناء الشاشات مع كل نقرة

  function build() {
    state = normalizeTasbih(app.settings.tasbih);
    const key = app.todayKey();
    const roundsText = () => (state.target ? `الدورة ${app.num(state.rounds + 1)}${state.rounds ? ` · اكتملت ${app.num(state.rounds)} ${state.rounds === 1 ? 'دورة' : state.rounds === 2 ? 'دورتان' : state.rounds <= 10 ? 'دورات' : 'دورة'}` : ''}` : `${app.num(state.count)} تسبيحة`);
    const statsText = () => `اليوم ${app.num(todayCount(state, key))} · الإجمالي ${app.num(totalCount(state))} · كل الأذكار ${app.num(grandTotal(state))}`;
    const countEl = h('output', { class: 'tasbih-count', 'aria-live': 'off' }, app.num(state.count));
    const roundsEl = h('div', { class: 'tasbih-rounds' }, roundsText());
    const statsEl = h('div', { class: 'tiny tasbih-stats' }, statsText());
    const phraseEl = h('div', { class: 'tasbih-phrase', lang: 'ar' }, phraseText(state));
    const bigBtn = h('button', { class: 'tasbih-btn', 'aria-label': `عدّ — ${phraseText(state)}`, style: { '--pct': state.target ? state.count / state.target : 0 } }, countEl, h('small', {}, state.target ? `من ${app.num(state.target)}` : 'بلا حدّ'));
    const paint = () => { countEl.textContent = app.num(state.count); bigBtn.style.setProperty('--pct', state.target ? state.count / state.target : 0); roundsEl.textContent = roundsText(); statsEl.textContent = statsText(); };
    const onTap = () => {
      const r = tap(state, app.todayKey()); state = r.state; save();
      if (r.reached) {
        vibrate([60, 40, 60, 40, 60]); bigBtn.classList.add('reached'); countEl.textContent = app.num(state.target); bigBtn.style.setProperty('--pct', 1);
        roundsEl.textContent = roundsText(); statsEl.textContent = statsText();
        setTimeout(() => { bigBtn.classList.remove('reached'); paint(); }, 650);
      } else { vibrate(12); paint(); }
    };
    bigBtn.addEventListener('click', onTap);
    const chip = (label, active, onclick, cls = '') => h('button', { class: `chip chip-btn ${cls} ${active ? 'active' : ''}`, onclick }, label);
    const phrases = h('div', { class: 'chips-scroll' }, ...TASBIH_PHRASES.map((p) => chip(
      p.id === 'custom' ? (state.custom ? state.custom.slice(0, 22) : 'ذكر آخر…') : p.text, state.phrase === p.id,
      () => { if (p.id === 'custom') customSheet(); else { state = { ...state, phrase: p.id, count: 0, rounds: 0 }; save(); build(); } }, 'chip-text')));
    const targets = h('div', { class: 'row', style: { gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } }, h('span', { class: 'tiny' }, 'الهدف:'), ...TASBIH_TARGETS.map((t) => chip(t ? app.num(t) : 'بلا حدّ', state.target === t, () => { state = { ...state, target: t, count: 0, rounds: 0 }; save(); build(); })));
    render(container,
      h('div', { class: 'card tasbih-card' },
        phraseEl,
        bigBtn,
        roundsEl,
        h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '10px' } },
          h('button', { class: 'btn btn-sm btn-outline', onclick: () => { state = undo(state, app.todayKey()); save(); paint(); } }, h('span', { html: icon('back') }), ' تراجع'),
          h('button', { class: 'btn btn-sm btn-outline', onclick: () => { state = resetCount(state); save(); paint(); toast('صُفّر العدّ'); } }, h('span', { html: icon('reset') }), ' تصفير')),
        statsEl),
      h('div', { class: 'card' }, h('div', { class: 'tiny', style: { marginBottom: '8px' } }, 'الذكر'), phrases, h('div', { style: { marginTop: '12px' } }, targets)),
      h('p', { class: 'tiny', style: { textAlign: 'center' } }, 'انقر الدائرة للعدّ؛ عند بلوغ الهدف يهتزّ الهاتف وتبدأ دورة جديدة. الإحصاءات تُحفظ على جهازك فقط.'));
  }
  function customSheet() {
    const input = h('input', { class: 'input', type: 'text', value: state.custom || '', placeholder: 'مثال: حسبي الله ونعم الوكيل', maxlength: 80 });
    const ok = () => { const v = input.value.trim(); if (!v) { toast('اكتب الذكر أولًا'); return; } state = { ...state, phrase: 'custom', custom: v, count: 0, rounds: 0 }; save(); closeSheet(); build(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    openSheet({ title: 'ذكر مخصّص', content: h('div', { class: 'stack' }, input, h('button', { class: 'btn btn-primary btn-block', onclick: ok }, 'اعتماد')) });
    setTimeout(() => input.focus(), 50);
  }
  app.on('change', () => { if (app.current === 'tasbih') { const s = normalizeTasbih(app.settings.tasbih); if (JSON.stringify(s) !== JSON.stringify(state)) build(); } });
  build();
  return { refresh: build, show: build };
}
