/**
 * بوصلة الجهاز: تجريد موحّد لاتجاه رأس الهاتف بالنسبة للشمال.
 * ---------------------------------------------------------------
 * الحقائق المعتمدة (من مصدر WebKit وChromium وتوثيق أندرويد):
 * - iOS Safari: DeviceOrientationEvent.webkitCompassHeading = CLHeading.magneticHeading (الشمال المغناطيسي دائمًا)،
 *   نسبةً إلى رأس الجهاز في وضعه الطبيعي (يلزم تعويض دوران الشاشة)، وwebkitCompassAccuracy بالدرجات (-1 = غير صالح).
 * - Android Chrome: 'deviceorientationabsolute' يعطي alpha بمرجع الشمال المغناطيسي (متجه الدوران الجيومغناطيسي)،
 *   ولا يطبّق Chromium أي تصحيح للانحراف المغناطيسي. الاتجاه = (360 - alpha) مع تعويض دوران الشاشة.
 * لذلك يجب في الحالتين إضافة الانحراف المغناطيسي (WMM) للحصول على الشمال الحقيقي: true = magnetic + declination.
 * - iOS 13+: يلزم DeviceOrientationEvent.requestPermission() من داخل إيماءة مستخدم وعلى HTTPS.
 */

const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** تعويض دوران الشاشة (بالدرجات) */
function screenAngle() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  if (typeof window !== 'undefined' && typeof window.orientation === 'number') return window.orientation;
  return 0;
}

/**
 * حساب اتجاه رأس الجهاز من زوايا أويلر المطلقة (alpha, beta, gamma) — W3C DeviceOrientation.
 * يحسب متجه اتجاه الجهاز في إطار الأرض (شرق-شمال-أعلى) ليبقى صحيحًا حتى مع إمالة الجهاز.
 */
export function headingFromEuler(alpha, beta, gamma, screenAngleDeg = 0) {
  const d = Math.PI / 180;
  const a = alpha * d, b = beta * d, g = gamma * d;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  // مصفوفة الدوران R = Rz(α)·Rx(β)·Ry(γ) (W3C)؛ نأخذ العمود الثاني (محور y للجهاز = رأس الهاتف) في إطار الأرض (شرق، شمال، أعلى)
  // اشتقاق دقيق: R = Rz(α)·Rx(β)·Ry(γ)؛ العمود y = R·[0,1,0]^T = [ -sinα·cosβ , cosα·cosβ , sinβ ]
  const ex = -sA * cB, ny = cA * cB;
  const headY = Math.atan2(ex, ny); // اتجاه رأس الجهاز من الشمال باتجاه الشرق (راديان)
  // عند رفع الجهاز رأسيًا (beta → ±90°) يصير المحور y عموديًا فلا يصلح؛ نستخدم اتجاه ظهر الجهاز (-z):
  // العمود z = R·[0,0,1]^T = [ cosα·sinγ + sinα·sinβ·cosγ , sinα·sinγ - cosα·sinβ·cosγ , cosβ·cosγ ]
  const zx = cA * sG + sA * sB * cG, zy = sA * sG - cA * sB * cG;
  const headZ = Math.atan2(-zx, -zy);
  // مزج دائري سلس بين التقديرين بحسب المركبة الأفقية لمحور y لتفادي القفز عند نقطة التبديل
  const horizontal = Math.hypot(ex, ny);
  const w = Math.min(1, Math.max(0, (horizontal - 0.15) / 0.25)); // 1 = جهاز مستوٍ، 0 = رأسي
  const vx = w * Math.cos(headY) + (1 - w) * Math.cos(headZ), vy = w * Math.sin(headY) + (1 - w) * Math.sin(headZ);
  let heading = (Math.hypot(vx, vy) < 1e-9 ? headY : Math.atan2(vy, vx)) / d;
  heading = (heading + screenAngleDeg) % 360; // تعويض دوران الشاشة (الزاوية تُقاس عكس عقارب الساعة من الوضع الطبيعي)
  return (heading + 360) % 360;
}

/** مرشّح تنعيم دائري (متوسط أسّي على متجه الوحدة) لتفادي القفز عند 0/360 */
export class HeadingSmoother {
  constructor(alpha = 0.25) { this.alpha = alpha; this.x = null; this.y = null; }
  push(deg) {
    const r = deg * Math.PI / 180, x = Math.cos(r), y = Math.sin(r);
    if (this.x === null) { this.x = x; this.y = y; }
    else {
      // تنعيم تكيّفي: دوران كبير يُتبع فورًا (لا تأخّر يُحسّ به انحرافًا)، والرجفة الصغيرة تُنعَّم
      const cur = Math.atan2(this.y, this.x) * 180 / Math.PI; let d = Math.abs(((deg - cur) % 360 + 540) % 360 - 180);
      const a = d > 25 ? 0.85 : d > 8 ? 0.5 : this.alpha;
      this.x += a * (x - this.x); this.y += a * (y - this.y);
    }
    return (Math.atan2(this.y, this.x) * 180 / Math.PI + 360) % 360;
  }
  reset() { this.x = this.y = null; }
}

/**
 * بدء الاستماع للبوصلة.
 * @param {(reading:{magneticHeading:number, accuracy:number|null, source:string, absolute:boolean}|null)=>void} onReading  تُستدعى بـ null إن لم تصل أي قراءة خلال المهلة
 * @returns {Promise<{stop:()=>void, source:string}>}
 * @throws {Error} code: 'denied' | 'unsupported' | 'insecure'
 */
export async function startCompass(onReading, { noReadingTimeoutMs = 4000 } = {}) {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) throw Object.assign(new Error('insecure'), { code: 'insecure' });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    let res;
    try { res = await DeviceOrientationEvent.requestPermission(); } catch (e) { throw Object.assign(new Error('denied'), { code: 'denied', cause: e }); }
    if (res !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  }
  const smoother = new HeadingSmoother(0.3);
  let source = 'none', gotAbsolute = false, gotAny = false;
  // مهلة: بعض الأجهزة (حواسيب، أجهزة بلا مقياس مغناطيسي) تعرّف الحدث ولا ترسل قراءات
  const timer = setTimeout(() => { if (!gotAny) onReading(null); }, noReadingTimeoutMs);
  const handler = (ev) => {
    let heading = null, accuracy = null, absolute = false;
    if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) {
      heading = (((ev.webkitCompassHeading + screenAngle()) % 360) + 360) % 360; // iOS: مغناطيسي، نسبةً إلى رأس الجهاز في الوضع الطبيعي
      accuracy = typeof ev.webkitCompassAccuracy === 'number' && ev.webkitCompassAccuracy >= 0 ? ev.webkitCompassAccuracy : null;
      absolute = true; source = 'ios';
    } else if (ev.alpha !== null && ev.alpha !== undefined && (ev.absolute || ev.type === 'deviceorientationabsolute')) {
      heading = headingFromEuler(ev.alpha, ev.beta || 0, ev.gamma || 0, screenAngle());
      absolute = true; source = 'android-absolute';
    } else if (ev.alpha !== null && ev.alpha !== undefined && !gotAbsolute) {
      // اتجاه نسبي فقط (لا مرجع للشمال) — نبلّغ به مع absolute=false ليعرض التطبيق تحذيرًا
      heading = headingFromEuler(ev.alpha, ev.beta || 0, ev.gamma || 0, screenAngle());
      absolute = false; source = 'relative';
    }
    if (heading === null || Number.isNaN(heading)) return;
    gotAny = true; clearTimeout(timer);
    if (absolute) gotAbsolute = true;
    onReading({ magneticHeading: smoother.push(heading), raw: heading, accuracy, source, absolute, beta: typeof ev.beta === 'number' ? ev.beta : null, gamma: typeof ev.gamma === 'number' ? ev.gamma : null });
  };
  const absSupported = 'ondeviceorientationabsolute' in window && !isIOS();
  if (absSupported) window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
  return {
    source: absSupported ? 'android-absolute' : (isIOS() ? 'ios' : 'unknown'),
    stop() {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
      clearTimeout(timer);
    },
  };
}

/** هل يلزم إيماءة مستخدم لطلب إذن المستشعرات (iOS 13+)؟ */
export function needsPermissionGesture() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission === 'function'; }
/** هل يتوفر الحدث أصلًا في هذا المتصفح؟ */
export function compassSupported() { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window; }

/** تحويل الاتجاه المغناطيسي إلى حقيقي وبالعكس */
export const magneticToTrue = (m, decl) => ((m + decl) % 360 + 360) % 360;
export const trueToMagnetic = (t, decl) => ((t - decl) % 360 + 360) % 360;

/** وصف جودة الدقة بالعربية */
export function accuracyLabel(acc) {
  if (acc === null || acc === undefined) return { label: 'غير معروفة', level: 'unknown' };
  if (acc <= 5) return { label: 'ممتازة', level: 'high' };
  if (acc <= 12) return { label: 'جيدة', level: 'medium' };
  if (acc <= 20) return { label: 'متوسطة', level: 'low' };
  return { label: 'ضعيفة — حرّك الهاتف على شكل 8', level: 'bad' };
}
