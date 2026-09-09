/** منسّقات Intl مخزّنة: إنشاء Intl.DateTimeFormat مكلف (عشرات المللي ثوانٍ في الجدول الشهري)، فنعيد استخدامها بمفتاح اللغة والخيارات */
const cache = new Map();
export function cachedFormatter(locale, options) {
  const key = locale + '|' + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, options); cache.set(key, f); }
  return f;
}
