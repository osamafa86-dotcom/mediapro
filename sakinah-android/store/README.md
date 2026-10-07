# Google Play — بيانات سكينة وسجلّ النشر

`metadata/android/` بتخطيط `fastlane supply`: لكلّ لغةٍ (`ar` الأساسية، و`en-US`)
`title.txt` (30 حرفاً) و`short_description.txt` (80) و`full_description.txt` (4000)
و`changelogs/default.txt` (500) و`images/`: `icon.png` (512×512) و`featureGraphic.png`
(1024×500 بلا شفافية — إلزامي) و`phoneScreenshots/` (اثنتان على الأقلّ)
و`tenInchScreenshots/`.

النشر يجري من مستودع `appstore-release` (قسم `android:` في `apps/sakinah.yml`)، واللقطات من `wilt`.
إعداد Play Console وإجابات نماذجه في [`PLAY-CONSOLE.md`](PLAY-CONSOLE.md).

| الفرع المدفوع | المستودع | ما يجري |
|---|---|---|
| `sakinah-android-screenshots` | wilt | لقطات من التطبيق نفسه على محاكي هاتف ولوح (أثرٌ يُودَع هنا) |
| `play-keygen/sakinah` | appstore-release | مرة واحدة: مفتاح الرفع يُنشأ ويُحفظ سرَّين (يحتاج `SECRETS_PAT` مؤقتًا) |
| `play-build/sakinah` | appstore-release | بناء AAB موقّع بمفتاح الرفع — أثرٌ للرفع اليدويّ الأوّل |
| `play-internal/sakinah` | appstore-release | رفع AAB والبيانات واللقطات إلى Internal testing |
| `play-closed/sakinah` | appstore-release | رفع إلى Closed testing (alpha) — شرط الحساب الشخصي قبل الإنتاج |
| `play-production/sakinah` | appstore-release | رفع إلى Production (يُرسل لمراجعة Google) |

## ما قِيس ويُوفَّر عليك تكراره

- **لقطات الهاتف 9:16**: Google ترفض لقطةً بُعدها الأطول أكثر من ضعف الأقصر،
  وهواتف اليوم 1080×2400 (2.22) تُرفض؛ فالسير يثبّت 1080×1920 بـ`wm size`
  ولوح 1440×2560، لا بملفّ تعريف الجهاز.
- **لقطات اللوح مؤجّلة**: محاكي اللوح (API 34) يعرض شريط مهام أندرويد بأيقونات
  Gmail وChrome أسفل الشاشة فتبدو اللقطة مشوّشة؛ الهاتف يكفي للنشر، واللوح اختياري.
- **أوّل AAB يُرفع يدوياً** في Play Console (شرط `supply` الموثّق)؛ بعدها الرفع آليّ.
- **`versionCode` = 1000 + رقم تشغيل سير play**: يزيد ولا يعود، وGoogle ترفض المساواة.
- **مفتاح الرفع** (`SAKINAH_UPLOAD_KEYSTORE_B64` + `SAKINAH_KEYSTORE_PASSWORD` في أسرار
  `appstore-release`) لا يسكن المستودع؛ Play App Signing يحتفظ بمفتاح التوقيع الحقيقي، ومفتاح الرفع قابلٌ لإعادة
  الضبط إن ضاع. بلا مفتاحٍ يُوقَّع البناء بمفتاح debug: صالحٌ للفحص لا للمتجر.
- **حسابات المطوّرين الشخصية المُنشأة بعد 13 نوفمبر 2023** تحتاج اختباراً مغلقاً
  بـ12 مختبِراً لـ14 يوماً متّصلة قبل طلب الإنتاج (سياسة Google).
- **استبيانات Play Console لا تصل من الواجهة البرمجية**: تصنيف المحتوى، أمان
  البيانات، الجمهور المستهدف، الإعلانات، الوصول إلى التطبيق — تُملأ مرّةً يدوياً (`PLAY-CONSOLE.md`).
- **مستوى API**: منذ 31 أغسطس 2026 تشترط Google Play استهداف Android 16 (API 36) للتطبيقات
  الجديدة، فالمشروع على `compileSdk`/`targetSdk` 36 مع AGP 8.11.1.
- **`USE_EXACT_ALARM` محذوف**: Google Play تقصره على تطبيقات المنبّه والتقويم؛ يبقى
  `SCHEDULE_EXACT_ALARM` ويُطلب من الإعدادات على Android 14+ (بلا منحه يتأخّر الإشعار دقائق).

## سجلّ النشر

| التاريخ | النسخة | versionCode | المسار | الحالة |
|---|---|---|---|---|
| — | 5.0.0 | — | — | بانتظار حساب Play Console ومفاتيحه |
| 2026-10-07 | 5.1.0 | — | — | الحساب جاهز؛ خطّ النشر في appstore-release، والمشروع على API 36 — بانتظار مفتاح الرفع وأول رفع يدوي |
