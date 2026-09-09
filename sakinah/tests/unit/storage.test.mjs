import { test } from 'node:test';
import assert from 'node:assert/strict';
// محاكاة localStorage قبل استيراد الوحدة كي تُختبر الكتابة الفعلية (وبلا ضجيج ReferenceError)
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); }, clear: () => mem.clear() };
const store = await import('../../js/platform/storage.js');

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

test('التخزين: حمولة تالفة (مصفوفة) تُهمل وتُحفظ نسخة تشخيصية، والتصدير/الاستيراد يعيدان الحالة', async () => {
  const exported = store.exportJSON();
  const parsed = JSON.parse(exported); assert.equal(parsed.app, 'sakinah'); assert.equal(parsed.schema, store.SCHEMA); assert.ok(parsed.settings && parsed.settings.quran);
  store.set('hijriOffset', 2);
  const r = store.importJSON(exported); assert.equal(r.ok, true); assert.equal(store.get('hijriOffset'), parsed.settings.hijriOffset);
  assert.equal(store.importJSON('[1,2,3]').ok, false); assert.equal(store.importJSON('{"foo":1}').ok, false); assert.equal(store.importJSON('not json').ok, false);
  // حمولة تالفة عند التحميل
  mem.set('sakinah:v1', '[1,2]');
  const fresh = await import(`../../js/platform/storage.js?corrupt=${Date.now()}`);
  assert.equal(typeof fresh.getSettings().quran, 'object', 'الافتراضيات تُستخدم بدل المصفوفة');
  assert.equal(mem.get('sakinah:v1.corrupt'), '[1,2]', 'النسخة التشخيصية محفوظة');
});
test('فشل الحفظ (امتلاء التخزين) يُبلَّغ للمستمعين ولا يرمي', () => {
  const orig = globalThis.localStorage.setItem; let seen = null;
  globalThis.localStorage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
  const off = store.onPersistError((e) => { seen = e; });
  store.set('hour12', false);
  assert.ok(seen && seen.name === 'QuotaExceededError'); assert.equal(store.get('hour12'), false, 'الحالة في الذاكرة تتغيّر رغم فشل الحفظ');
  off(); globalThis.localStorage.setItem = orig;
});
