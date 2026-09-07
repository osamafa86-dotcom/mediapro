import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../js/platform/storage.js';

test('update يدمج عميقًا، وreplace يستبدل دون دمج (تصفير تقدّم الأذكار عند تغيّر اليوم)', () => {
  store.update({ adhkarProgress: { date: '2026-09-06', morning: { a01: 3 }, evening: { a02: 7 } } });
  store.update({ adhkarProgress: { date: '2026-09-07', morning: {}, evening: {} } });
  assert.deepEqual(store.get('adhkarProgress.morning'), { a01: 3 }, 'الدمج العميق يُبقي المفاتيح القديمة (سلوك متوقع من update)');
  store.replace('adhkarProgress', { date: '2026-09-07', morning: {}, evening: {} });
  assert.deepEqual(store.get('adhkarProgress'), { date: '2026-09-07', morning: {}, evening: {} });
  store.update({ adhkarProgress: { morning: { a05: 1 } } });
  store.replace('adhkarProgress.morning', {});
  assert.deepEqual(store.get('adhkarProgress.morning'), {});
  assert.equal(store.get('adhkarProgress.date'), '2026-09-07');
});

test('resetAll لا يشارك كائنات الافتراضيات بالمرجع، والمصفوفات تُستبدل لا تُدمج', () => {
  store.update({ favorites: ['h001', 'h002'], notifications: { prayers: { fajr: false } } });
  store.update({ favorites: ['h003'] });
  assert.deepEqual(store.get('favorites'), ['h003']);
  store.resetAll();
  assert.notEqual(store.getSettings().adhkarProgress, store.DEFAULT_SETTINGS.adhkarProgress);
  assert.notEqual(store.getSettings().notifications.prayers, store.DEFAULT_SETTINGS.notifications.prayers);
  assert.equal(store.get('notifications.prayers.fajr'), true);
  store.set('notifications.prayers.fajr', false);
  assert.equal(store.DEFAULT_SETTINGS.notifications.prayers.fajr, true, 'الافتراضيات لم تتلوث');
  const calls = []; const off = store.subscribe((s, patch) => calls.push(patch));
  store.set('hour12', false); off();
  assert.equal(calls.length, 1); assert.equal(store.get('hour12'), false);
});
