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
  let heading = Math.atan2(ex, ny) / d; // زاوية اتجاه رأس الجهاز من الشمال باتجاه الشرق
  // عند إمالة الجهاز نحو الوجه (beta ~ 90°) يصير المحور y عموديًا؛ نستخدم حينها المحور -z (ظهر الكاميرا)
  const horizontal = Math.hypot(ex, ny);
  if (horizontal < 0.2) {
    // العمود z = R·[0,0,1]^T = [ cosα·sinγ + sinα·sinβ·cosγ , sinα·sinγ - cosα·sinβ·cosγ , cosβ·cosγ ] ؛ الاتجاه = -z
    const zx = cA * sG + sA * sB * cG, zy = sA * sG - cA * sB * cG;
    heading = Math.atan2(-zx, -zy) / d;
  }
  heading = (heading + screenAngleDeg) % 360; // تعويض دوران الشاشة (الزاوية تُقاس عكس عقارب الساعة من الوضع الطبيعي)
  return (heading + 360) % 360;
}

/** مرشّح تنعيم دائري (متوسط أسّي على متجه الوحدة) لتفادي القفز عند 0/360 */
export class HeadingSmoother {
  constructor(alpha = 0.25) { this.alpha = alpha; this.x = null; this.y = null; }
  push(deg) {
    const r = deg * Math.PI / 180, x = Math.cos(r), y = Math.sin(r);
    if (this.x === null) { this.x = x; this.y = y; }
    else { this.x += this.alpha * (x - this.x); this.y += this.alpha * (y - this.y); }
    return (Math.atan2(this.y, this.x) * 180 / Math.PI + 360) % 360;
  }
  reset() { this.x = this.y = null; }
}

/**
 * بدء الاستماع للبوصلة.
 * @param {(reading:{magneticHeading:number, accuracy:number|null, source:string, absolute:boolean})=>void} onReading
 * @returns {Promise<{stop:()=>void, source:string}>}
 * @throws {Error} code: 'denied' | 'unsupported' | 'insecure'
 */
export async function startCompass(onReading) {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) throw Object.assign(new Error('insecure'), { code: 'insecure' });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    let res;
    try { res = await DeviceOrientationEvent.requestPermission(); } catch (e) { throw Object.assign(new Error('denied'), { code: 'denied', cause: e }); }
    if (res !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  }
  const smoother = new HeadingSmoother(0.3);
  let source = 'none', gotAbsolute = false, timer = null;
  const handler = (ev) => {
    let heading = null, accuracy = null, absolute = false;
    if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) {
      heading = (ev.webkitCompassHeading + screenAngle()) % 360; // iOS: مغناطيسي، نسبةً إلى رأس الجهاز في الوضع الطبيعي
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
    if (absolute) gotAbsolute = true;
    onReading({ magneticHeading: smoother.push(heading), raw: heading, accuracy, source, absolute });
  };
  const absSupported = 'ondeviceorientationabsolute' in window && !isIOS();
  if (absSupported) window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
  return {
    source: absSupported ? 'android-absolute' : (isIOS() ? 'ios' : 'unknown'),
    stop() {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
      if (timer) clearTimeout(timer);
    },
  };
}

/** تحويل الاتجاه المغناطيسي إلى حقيقي وبالعكس */
export const magneticToTrue = (m, decl) => ((m + decl) % 360 + 360) % 360;
export const trueToMagnetic = (t, decl) => ((t - decl) % 360 + 360) % 360;

/** وصف جودة الدقة بالعربية */
export function accuracyLabel(acc) {
  if (acc === null || acc === undefined) return { label: 'غير معروفة', level: 'unknown' };
  if (acc <= 5) return { label: 'ممتازة', level: 'high' };
  if (acc <= 15) return { label: 'جيدة', level: 'medium' };
  if (acc <= 30) return { label: 'متوسطة', level: 'low' };
  return { label: 'ضعيفة — حرّك الهاتف على شكل 8', level: 'bad' };
}
