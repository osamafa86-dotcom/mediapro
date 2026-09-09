import { test } from 'node:test';
import assert from 'node:assert/strict';

// محاكاة جسر Capacitor بإضافة إشعارات محلية وهمية قبل استيراد الوحدات
const calls = { cancel: [], schedule: [], channels: [] };
const fakeLN = {
  checkPermissions: async () => ({ display: 'granted' }),
  requestPermissions: async () => ({ display: 'granted' }),
  getPending: async () => ({ notifications: [{ id: 1 }, { id: 2 }] }),
  cancel: async (o) => { calls.cancel.push(o); },
  schedule: async (o) => { calls.schedule.push(o); },
  createChannel: async (o) => { calls.channels.push(o); },
  addListener: () => {},
};
globalThis.window = globalThis.window || {};
globalThis.window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (n) => n === 'LocalNotifications', registerPlugin: (n) => (n === 'LocalNotifications' ? fakeLN : null), Plugins: {} };
const native = await import('../../js/platform/native.js');
const nn = await import('../../js/platform/native-notifications.js');

test('الجسر: التعرّف على المنصة الأصلية والوصول إلى الإضافة المتاحة فقط', () => {
  assert.equal(native.isNative(), true); assert.equal(native.platform(), 'android');
  assert.ok(native.plugin('LocalNotifications')); assert.equal(native.plugin('Haptics'), null);
  assert.equal(native.haptic('light'), false, 'لا Haptics → false ليعود المتصفح إلى navigator.vibrate');
});
test('المعرّف العددي ثابت وفريد لكل (يوم، صلاة، نوع)', () => {
  const t = new Date('2026-09-10T02:00:00Z');
  const a = nn.numericId({ time: t, prayer: 'fajr', kind: 'adhan' }), b = nn.numericId({ time: t, prayer: 'fajr', kind: 'pre' }), c = nn.numericId({ time: t, prayer: 'isha', kind: 'adhan' });
  assert.ok(Number.isInteger(a) && a > 0 && a < 2 ** 31);
  assert.ok(new Set([a, b, c]).size === 3);
  assert.equal(nn.numericId({ time: t, prayer: 'fajr', kind: 'adhan' }), a);
});
test('المزامنة تلغي المعلّق ثم تجدول أقرب 60 موعدًا مستقبليًا بصوت الأذان وقناة Android', async () => {
  const now = Date.now(); const items = [];
  for (let d = 0; d < 10; d++) for (const [i, p] of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].entries()) {
    const time = new Date(now + d * 86400000 + (i + 1) * 3600000 * 3 - 5 * 3600000); // بعضها في الماضي
    items.push({ id: `${d}:${p}`, time, kind: 'adhan', prayer: p, title: p, body: '' });
    items.push({ id: `${d}:${p}:pre`, time: new Date(time.getTime() - 600000), kind: 'pre', prayer: p, title: 'pre', body: '' });
  }
  const r = await nn.syncSchedule(items, { sound: 'adhan-fakhry', vibrate: true });
  assert.equal(calls.cancel.length, 1); assert.deepEqual(calls.cancel[0].notifications.map((n) => n.id), [1, 2]);
  assert.equal(r.scheduled, nn.MAX_PENDING);
  const list = calls.schedule[0].notifications;
  assert.equal(list.length, nn.MAX_PENDING);
  assert.ok(list.every((n) => n.schedule.at.getTime() > now), 'لا مواعيد ماضية');
  assert.ok(list.every((n, i) => i === 0 || n.schedule.at >= list[i - 1].schedule.at), 'مرتبة زمنيًا');
  assert.ok(list.filter((n) => n.extra.kind === 'adhan').every((n) => n.sound === 'adhan_short.wav' && n.channelId === nn.CHANNEL_ADHAN));
  assert.ok(list.filter((n) => n.extra.kind === 'pre').every((n) => !n.sound && n.channelId === nn.CHANNEL_QUIET));
  assert.equal(calls.channels.length, 2);
  const r2 = await nn.syncSchedule(items, { sound: 'none' });
  assert.ok(calls.schedule[1].notifications.every((n) => !n.sound), 'بلا صوت → لا ملف صوت');
  assert.equal(r2.scheduled, nn.MAX_PENDING);
});
