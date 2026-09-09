/**
 * جسر Capacitor (iOS/Android) دون تضمين شيفرة الإضافات في حزمة الويب:
 * الإضافات الأصلية تُسجَّل من الجانب الأصلي، ونصل إليها عبر Capacitor.registerPlugin (أو Capacitor.Plugins القديمة).
 * على الويب تعيد كل الدوال null/false فتبقى مسارات المتصفح كما هي.
 */
export function isNative() {
  try { const C = typeof window !== 'undefined' && window.Capacitor; return !!(C && ((C.isNativePlatform && C.isNativePlatform()) || (C.getPlatform && C.getPlatform() !== 'web'))); } catch { return false; }
}
export function platform() { try { return window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'web'; } catch { return 'web'; } }
const cache = new Map();
/** وكيل إضافة أصلية باسمها (LocalNotifications, Haptics, App, Filesystem, Share, StatusBar, SplashScreen) أو null */
export function plugin(name) {
  if (!isNative()) return null;
  if (cache.has(name)) return cache.get(name);
  let p = null;
  try {
    const C = window.Capacitor;
    if (C.isPluginAvailable && !C.isPluginAvailable(name)) p = null;
    else p = (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null);
  } catch { p = null; }
  cache.set(name, p);
  return p;
}
/** اهتزاز: Haptics على iOS (لا navigator.vibrate هناك)؛ true إن نُفّذ أصليًا */
export function haptic(kind = 'light') {
  const H = plugin('Haptics'); if (!H) return false;
  try {
    if (kind === 'success') H.notification({ type: 'SUCCESS' }).catch(() => {});
    else if (kind === 'warning') H.notification({ type: 'WARNING' }).catch(() => {});
    else if (kind === 'medium') H.impact({ style: 'MEDIUM' }).catch(() => {});
    else H.impact({ style: 'LIGHT' }).catch(() => {});
  } catch { return false; }
  return true;
}
/** شريط الحالة بحسب السمة (iOS: لون الأيقونات؛ Android: لون الخلفية أيضًا) */
export function applyStatusBar(dark) {
  const S = plugin('StatusBar'); if (!S) return;
  try { S.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {}); if (platform() === 'android') S.setBackgroundColor({ color: dark ? '#0b1412' : '#0f766e' }).catch(() => {}); } catch { /* تجاهل */ }
}
/** حفظ ملف ومشاركته (بدل رابط التنزيل الذي لا يعمل داخل WKWebView) */
export async function shareFile(filename, content, mime = 'text/plain') {
  const F = plugin('Filesystem'); const Sh = plugin('Share');
  if (!F || !Sh) return false;
  try {
    const r = await F.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
    await Sh.share({ title: filename, url: r.uri, dialogTitle: filename });
    return true;
  } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return true; return false; }
}
/** مستمعو التطبيق (زر الرجوع في Android، العودة إلى الواجهة) */
export function onAppEvents({ onBack, onResume } = {}) {
  const A = plugin('App'); if (!A) return;
  try {
    if (onBack) A.addListener('backButton', (ev) => onBack(ev));
    if (onResume) A.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume(); });
  } catch { /* تجاهل */ }
}
export function exitApp() { const A = plugin('App'); if (A) { try { A.exitApp(); } catch { /* تجاهل */ } } }
export function hideSplash() { const S = plugin('SplashScreen'); if (S) { try { S.hide().catch(() => {}); } catch { /* تجاهل */ } } }
