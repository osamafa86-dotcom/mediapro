# سكينة — التطبيق الأصلي (Swift / SwiftUI)

إعادة بناء «سكينة» تطبيقًا أصليًا ١٠٠٪ لنظام iOS (ثم Android بـ Kotlin بالبنية نفسها)، مع إبقاء النسخة الهجينة الحالية على TestFlight حتى يبلغ الأصلي التكافؤ.

## البنية
- `Sources/SakinahCore/` — النواة: منطق خالص بلا واجهة (Foundation فقط)، يُبنى ويُختبر على Linux وmacOS ويُستخدم من iOS وwatchOS:
  - `Astro.swift` (فلك Meeus)، `PrayerTimes.swift` + `Methods.swift` (المواقيت وطرق الهيئات، خطوط العرض العالية، الحل القطبي، رمضان)، `Hijri.swift` (أم القرى عبر ICU + بديل جدولي)، `Qibla.swift` (دائرة عظمى + Vincenty + التحقق بالشمس)، `Geomag.swift` (WMM2025).
- `Tests/SakinahCoreTests/` — اختبارات **المرجع الذهبي**: `Fixtures/golden.json` مولَّد من محرك نسخة الويب (المُتحقَّق منه ضد adhan-js وAlAdhan) بـ `node sakinah-native/tools/export-golden.mjs`؛ النواة الأصلية تُطابقه رقمًا برقم (756 حالة مواقيت، 480 هجري، قبلة، مغناطيسية…).
- `App/` — تطبيق iOS بـ SwiftUI (iOS 17+). المشروع يُولَّد من `project.yml` بـ XcodeGen ولا يُلتزَم `.xcodeproj`.

## البناء
```sh
cd sakinah-native && swift test                 # النواة (Linux/macOS)
cd App && xcodegen generate && open Sakinah.xcodeproj   # التطبيق (macOS/Xcode 16)
```
TestFlight: الدفع إلى فرع `sakinah-native-ios` في مستودع wilt يشغّل `sakinah-native-ios.yml` (معرّف الحزمة `org.emdatra.sakinah.native`).

## خارطة الطريق
1. **الأساس** (هذه المرحلة): النواة + المرجع الذهبي + المواقيت والقبلة والإعدادات + CI وTestFlight.
2. **الصلاة كاملة**: إشعارات النظام وصوت الأذان، اختيار المدن دون اتصال، الجدول الشهري، Live Activity وودجت شاشة القفل.
3. **المصحف**: صفحات المدينة بخطوط الصفحات المضمّنة (CoreText)، الفهرس والبحث، وضع النص والتجويد والسمات، التلاوة بتوقيت الكلمات، الختمة والعلامات.
4. **الأذكار والحديث**: حصن المسلم، الأربعون النووية، المسبحة، بطاقات المشاركة، التذكيرات.
5. **الحفظ والمراجعة**: التعرّف على التلاوة (Speech)، الإخفاء، الخطة والتكرار المتباعد؛ استيراد النسخة الاحتياطية من التطبيق الهجيني؛ ثم إحلاله محلّ الهجين على TestFlight.
6. **Android** بـ Kotlin/Compose بالبنية نفسها والمرجع الذهبي نفسه.
