/**
 * المسبحة الإلكترونية: منطق العدّ (نقي، بلا واجهة) — صيغ الذكر، الهدف، الدورات، وإحصاء اليوم والإجمالي لكل صيغة.
 * الحالة تُحفظ في الإعدادات (tasbih) فيستمر العدّ بعد إغلاق التطبيق.
 */
export const TASBIH_PHRASES = [
  { id: 'subhan', text: 'سُبْحَانَ اللهِ' },
  { id: 'hamd', text: 'الْحَمْدُ لِلهِ' },
  { id: 'akbar', text: 'اللهُ أَكْبَرُ' },
  { id: 'tahlil', text: 'لَا إِلَهَ إِلَّا اللهُ' },
  { id: 'istighfar', text: 'أَسْتَغْفِرُ اللهَ' },
  { id: 'hawqala', text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ' },
  { id: 'subhanbihamd', text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ' },
  { id: 'subhanazim', text: 'سُبْحَانَ اللهِ الْعَظِيمِ' },
  { id: 'salawat', text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ' },
  { id: 'baqiyat', text: 'سُبْحَانَ اللهِ، وَالْحَمْدُ لِلهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ' },
  { id: 'custom', text: '' },
];
export const TASBIH_TARGETS = [33, 99, 100, 1000, 0]; // 0 = بلا حدّ

export function defaultTasbih() { return { phrase: 'subhan', target: 33, custom: '', count: 0, rounds: 0, totals: {} }; }
export function normalizeTasbih(s) { const d = defaultTasbih(); return s && typeof s === 'object' ? { ...d, ...s, totals: s.totals && typeof s.totals === 'object' ? s.totals : {} } : d; }
export function phraseText(state) {
  const p = TASBIH_PHRASES.find((x) => x.id === state.phrase) || TASBIH_PHRASES[0];
  return p.id === 'custom' ? (state.custom || '').trim() || 'ذكر' : p.text;
}
/** نقرة واحدة: تزيد العدّ وإحصاءات الصيغة؛ عند بلوغ الهدف تكتمل دورة ويعود العدّ إلى الصفر. تعيد الحالة الجديدة وهل اكتملت دورة */
export function tap(state, todayKey) {
  const s = { ...state, totals: { ...state.totals } };
  const key = s.phrase;
  const t = { ...(s.totals[key] || { total: 0, today: 0, date: todayKey }) };
  if (t.date !== todayKey) { t.today = 0; t.date = todayKey; }
  t.total += 1; t.today += 1; s.totals[key] = t;
  s.count += 1;
  let reached = false;
  if (s.target > 0 && s.count >= s.target) { reached = true; s.rounds += 1; s.count = 0; }
  return { state: s, reached };
}
/** تراجع عن نقرة (خطأ) */
export function undo(state, todayKey) {
  if (state.count <= 0 && state.rounds <= 0) return state;
  const s = { ...state, totals: { ...state.totals } };
  const t = s.totals[s.phrase]; if (t && t.total > 0) { const nt = { ...t }; nt.total -= 1; if (nt.date === todayKey && nt.today > 0) nt.today -= 1; s.totals[s.phrase] = nt; }
  if (s.count > 0) s.count -= 1; else { s.rounds -= 1; s.count = s.target > 0 ? s.target - 1 : 0; }
  return s;
}
export function resetCount(state) { return { ...state, count: 0, rounds: 0 }; }
export function todayCount(state, todayKey) { const t = state.totals[state.phrase]; return t && t.date === todayKey ? t.today : 0; }
export function totalCount(state) { const t = state.totals[state.phrase]; return t ? t.total : 0; }
/** إجمالي كل الصيغ (لبطاقة الإحصاءات) */
export function grandTotal(state) { return Object.values(state.totals || {}).reduce((n, t) => n + (t.total || 0), 0); }
