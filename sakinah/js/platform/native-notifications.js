/**
 * إشعارات محلية أصلية (iOS/Android) عبر @capacitor/local-notifications: تُجدوَل مواعيد الصلاة لأيام قادمة
 * فتصل والتطبيق مغلق، بخلاف الويب الذي يعتمد على مؤقّت داخل الصفحة.
 * حدود النظام: iOS يسمح بـ 64 إشعارًا معلّقًا لكل تطبيق، لذا نجدول أقرب 60 موعدًا (نحو 5–7 أيام) ونعيد الجدولة عند كل فتح/عودة/تغيير.
 */
import { plugin, platform } from './native.js';

export const MAX_PENDING = 60;
export const CHANNEL_ADHAN = 'sakinah-adhan';
export const CHANNEL_QUIET = 'sakinah-quiet';
const SOUND_FILE = 'adhan_short.wav'; // في حزمة iOS وفي res/raw على Android (يُضاف في سير البناء)

export function available() { return !!plugin('LocalNotifications'); }
export async function permission() {
  const LN = plugin('LocalNotifications'); if (!LN) return 'unsupported';
  try { const r = await LN.checkPermissions(); return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; } catch { return 'default'; }
}
export async function requestPermission() {
  const LN = plugin('LocalNotifications'); if (!LN) return 'unsupported';
  try { const r = await LN.requestPermissions(); return r.display === 'granted' ? 'granted' : 'denied'; } catch { return 'denied'; }
}
/** معرّف عددي ثابت لكل تذكير: أيام منذ 2020-01-01 × 100 + ترتيب الصلاة × 10 + النوع */
const PRAYER_IDX = { fajr: 1, sunrise: 2, dhuhr: 3, asr: 4, maghrib: 5, isha: 6 };
export function numericId(item) {
  const day = Math.floor((item.time.getTime() - Date.UTC(2020, 0, 1)) / 86400000);
  return day * 100 + (PRAYER_IDX[item.prayer] || 9) * 10 + (item.kind === 'pre' ? 1 : item.kind === 'sunrise' ? 2 : 0);
}
let channelsReady = false;
async function ensureChannels(LN) {
  if (channelsReady || platform() !== 'android') return;
  try {
    await LN.createChannel({ id: CHANNEL_ADHAN, name: 'الأذان', description: 'إشعار دخول وقت الصلاة بصوت الأذان', importance: 5, visibility: 1, sound: SOUND_FILE, vibration: true });
    await LN.createChannel({ id: CHANNEL_QUIET, name: 'تذكير هادئ', description: 'تذكير قبل الأذان وطلوع الشمس', importance: 4, visibility: 1, vibration: true });
  } catch { /* قد تكون موجودة */ }
  channelsReady = true;
}
/**
 * مزامنة الجدول: إلغاء كل المعلّق ثم جدولة أقرب MAX_PENDING موعدًا مستقبليًا.
 * @param {Array<{id:string,time:Date,kind:string,prayer?:string,title:string,body:string}>} items
 * @param {{sound:string, vibrate:boolean}} prefs  sound: 'none' | 'chime' | 'adhan-…'
 */
export async function syncSchedule(items, prefs = {}) {
  const LN = plugin('LocalNotifications'); if (!LN) return { scheduled: 0 };
  await ensureChannels(LN);
  try { const pending = await LN.getPending(); if (pending && pending.notifications && pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) }); } catch { /* تجاهل */ }
  const now = Date.now();
  const upcoming = items.filter((it) => it.time instanceof Date && it.time.getTime() > now + 15000).sort((a, b) => a.time - b.time).slice(0, MAX_PENDING);
  if (!upcoming.length) return { scheduled: 0 };
  const useAdhan = prefs.sound && prefs.sound !== 'none' && prefs.sound !== 'chime';
  const notifications = upcoming.map((it) => {
    const adhan = it.kind === 'adhan' && useAdhan;
    const n = { id: numericId(it), title: it.title, body: it.body, schedule: { at: it.time, allowWhileIdle: true }, extra: { kind: it.kind, prayer: it.prayer || null, url: './index.html#/prayer' } };
    if (adhan) n.sound = SOUND_FILE;
    if (platform() === 'android') n.channelId = adhan ? CHANNEL_ADHAN : CHANNEL_QUIET;
    return n;
  });
  try { await LN.schedule({ notifications }); return { scheduled: notifications.length, until: upcoming[upcoming.length - 1].time }; }
  catch (e) { console.warn('local notifications schedule failed', e); return { scheduled: 0, error: e }; }
}
export async function cancelAll() {
  const LN = plugin('LocalNotifications'); if (!LN) return;
  try { const pending = await LN.getPending(); if (pending && pending.notifications && pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) }); } catch { /* تجاهل */ }
}
/** النقر على إشعار: يفتح شاشة الصلاة (وقد يُشغّل الأذان الكامل إن كان الإعداد كذلك) */
export function onTap(handler) {
  const LN = plugin('LocalNotifications'); if (!LN) return;
  try { LN.addListener('localNotificationActionPerformed', (ev) => { try { handler(ev && ev.notification ? ev.notification : ev); } catch { /* تجاهل */ } }); } catch { /* تجاهل */ }
}
