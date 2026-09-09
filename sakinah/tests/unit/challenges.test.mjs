/** تحدّيات القراءة وخريطة الحرارة. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES, challengeProgress, resolveRange, heatmap, estimateMinutes } from '../../js/core/challenges.js';

test('كل تحدٍّ بمدى صفحات صالح ومدة', () => {
  assert.ok(CHALLENGES.length >= 6); assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, CHALLENGES.length);
  for (const c of CHALLENGES) { assert.ok(c.days >= 1); if (c.from) assert.ok(c.from >= 1 && c.to <= 604 && c.to >= c.from, c.id); else assert.ok(c.span > 0, c.id); }
  assert.deepEqual(resolveRange(CHALLENGES.find((c) => c.id === 'juz-3days'), 300), { from: 300, to: 319 });
  assert.deepEqual(resolveRange(CHALLENGES.find((c) => c.id === 'hizb-daily'), 600), { from: 600, to: 604 });
  assert.equal(estimateMinutes(12), 24);
});
test('التقدّم يُحسب من الصفحات المقروءة داخل المدى ومنذ بداية التحدّي', () => {
  const log = { '2026-09-01': [293, 294], '2026-09-09': [295, 296, 297, 100], '2026-09-10': [298] };
  const p = challengeProgress({ id: 'kahf', startedAt: '2026-09-09' }, log, '2026-09-10');
  assert.equal(p.total, 12); assert.equal(p.done, 4); assert.equal(p.pct, 33); assert.equal(p.dayIndex, 1); assert.equal(p.daysLeft, 0); assert.equal(p.late, true); assert.equal(p.finished, false); assert.equal(p.minutesLeft, 16);
  const full = challengeProgress({ id: 'mulk', startedAt: '2026-09-09' }, { '2026-09-09': [562, 563, 564] }, '2026-09-09');
  assert.equal(full.finished, true); assert.equal(full.pct, 100); assert.equal(full.late, false);
  const rel = challengeProgress({ id: 'juz-3days', startedAt: '2026-09-09', startPage: 300 }, { '2026-09-09': [300, 301, 350] }, '2026-09-09');
  assert.equal(rel.total, 20); assert.equal(rel.done, 2); assert.equal(rel.daysLeft, 2);
  assert.equal(challengeProgress(null, {}, '2026-09-09'), null); assert.equal(challengeProgress({ id: 'nope', startedAt: '2026-09-09' }, {}, '2026-09-09'), null);
});
test('خريطة الحرارة: 90 يومًا بترتيب زمني وعدّ الصفحات', () => {
  const hm = heatmap({ '2026-09-09': [1, 2, 3], '2026-07-01': [5] }, '2026-09-09');
  assert.equal(hm.length, 90); assert.equal(hm[89].key, '2026-09-09'); assert.equal(hm[89].count, 3); assert.equal(hm[0].key, '2026-06-12');
  assert.equal(hm.find((d) => d.key === '2026-07-01').count, 1); assert.equal(hm.reduce((n, d) => n + d.count, 0), 4);
});
