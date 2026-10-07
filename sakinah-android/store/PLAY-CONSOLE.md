# Google Play Console — إعداد سكينة وإجابات النماذج

ما لا تصل إليه الواجهة البرمجية يُملأ مرة واحدة يدويًا في Play Console، وهذه إجاباته
مأخوذة من سلوك التطبيق الفعلي (الشبكة والأذونات في `app/src/main`)، لا افتراضًا.
النصوص والصور ولقطات صفحة المتجر يرفعها سير `play-*` في مستودع `appstore-release` من
`metadata/android/`؛ فلا تُكتب يدويًا.

## ٠. نوع الحساب

حساب سكينة **مؤسسة (شركة)**: لا شرط اختبارٍ مغلق، فالرفع إلى الإنتاج مباشرةً بعد إكمال النماذج
(`play-production/sakinah`). الحسابات الشخصية المُنشأة بعد 13 نوفمبر 2023 وحدها تحتاج اختبارًا
مغلقًا بـ12 مختبِرًا لـ14 يومًا قبل «Apply for production».

## ١. إنشاء التطبيق (Home ← Create app)

| الحقل | القيمة |
| --- | --- |
| App name | سكينة: الصلاة والقرآن والأذكار |
| Default language | Arabic – ar |
| App or game | App |
| Free or paid | Free |
| Declarations | ✓ Developer Program Policies · ✓ US export laws |

## ٢. أول AAB — يدويًا مرة واحدة إن لزم

السير يحاول الرفع الآلي أولًا؛ فإن ردّت Google «Package not found» (تطبيقٌ لم يُرفع له شيء قط)
يُرفع AAB الأثر يدويًا مرة واحدة، وبعدها كل شيء آلي.

1. AAB من أثر تشغيل `play-build/sakinah` في `appstore-release` (ملف zip: فكّه فيظهر ‎`.aab`).
2. Test and release ← Testing ← Internal testing ← Create new release.
3. App signing: **Use Google-generated key** (الافتراضي) — مفتاح التوقيع الحقيقي يحفظه Google،
   ومفتاحنا للرفع فقط.
4. App bundles: ارفع ملف ‎`.aab` ← Next ← **Save** (مسودة تكفي لتسجيل الحزمة).

## ٣. حساب الخدمة (للرفع الآلي بعد ذلك)

1. console.cloud.google.com ← مشروع جديد (مثل `sakinah-play`).
2. APIs & Services ← Library ← **Google Play Android Developer API** ← Enable.
3. IAM & Admin ← Service accounts ← Create service account (مثل `play-release`) ← Done، بلا أدوار.
4. افتحه ← Keys ← Add key ← Create new key ← **JSON** ← يُنزَّل ملف.
5. Play Console (مستوى الحساب) ← Users and permissions ← Invite new users:
   - البريد: بريد حساب الخدمة (`…@….iam.gserviceaccount.com`).
   - App permissions ← Add app ← سكينة، ثم فعّل: View app information (read-only) ·
     Release apps to testing tracks · Release to production, exclude devices, and use Play App Signing ·
     Manage testing tracks and edit tester lists · Manage store presence ← Apply ← Invite user.
   - الصلاحيات قد تتأخر حتى 24 ساعة قبل أن تقبلها الواجهة البرمجية («The caller does not have permission»).
   - إن رفض Google Cloud إنشاء المفتاح («Service account key creation is disabled»)، فتلك سياسة مؤسسة
     Google Cloud (`iam.disableServiceAccountKeyCreation`) يرفعها مدير المؤسسة للمشروع وحده.
6. GitHub ← `appstore-release` ← Settings ← Secrets and variables ← Actions ← New repository secret:
   الاسم `PLAY_SERVICE_ACCOUNT_JSON`، والقيمة محتوى ملف JSON كاملًا. ثم احذف الملف من جهازك.

## ٤. App content (Policy and programs ← App content)

| النموذج | الإجابة |
| --- | --- |
| Privacy policy | `https://osamafa86-dotcom.github.io/mediapro/privacy.html` |
| App access | All functionality is available without any access restrictions (لا تسجيل دخول) |
| Ads | No, my app does not contain ads |
| Advertising ID | No — لا مكتبة إعلانات ولا إذن `AD_ID` |
| Government apps | No |
| Financial features | My app doesn't provide any financial features |
| Health | لا ميزات صحية |
| News apps | No |
| Target audience | 13–15 · 16–17 · 18+ — وتحت 13 **لا**: يُخضع التطبيق لسياسة العائلات وقيودها على الموقع والميكروفون |
| Appeal to children (إن سُئل) | No |

### تصنيف المحتوى (IARC)

- Category: **Reference, News, or Educational**.
- كل الأسئلة **No**: العنف، المحتوى الجنسي، الألفاظ، المخدّرات والكحول، القمار، محتوى ينشره
  المستخدمون أو تواصل بينهم، مشاركة الموقع مع مستخدمين آخرين، الشراء الرقمي، متصفّح ويب مفتوح.
- المتوقَّع: Everyone / PEGI 3.

### أمان البيانات (Data safety)

| السؤال | الإجابة |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (كل الطلبات HTTPS) |
| Account creation | لا حسابات في التطبيق |
| Data deletion request | **No** — لا حسابات ولا خوادم لنا؛ حذف التطبيق يحذف بياناته |

أنواع البيانات — اثنان فقط، وغيرهما لا شيء:

| النوع | Collected | Shared | Processed ephemerally | Required/Optional | Purpose |
| --- | --- | --- | --- | --- | --- |
| Location ← **Approximate location** | Yes | No | No | Optional | App functionality |
| Audio ← **Voice or sound recordings** | Yes | No | No | Optional | App functionality |

- **الموقع**: إحداثيات مقرّبة إلى منزلتين (نحو كيلومتر) تُرسل لتسمية المدينة (Geocoder النظام)،
  و«أقرب مسجد» (OpenStreetMap Overpass)، وطبقة الطقس المطفأة افتراضيًا (Open-Meteo). اختيارية:
  يمكن اختيار المدينة يدويًا.
- **الصوت**: مراجعة الحفظ تتعرّف على الكلام على الجهاز إن توفّر، وإلا بخدمة التعرّف في النظام
  بعد إذن المستخدم. لا تسجيل ولا حفظ. الإفصاح هنا احتياطٌ للحالة الثانية.
- «Processed ephemerally = No» إجابة متحفّظة: نحن لا نحفظ شيئًا، لكن احتفاظ الجهات الخارجية خارج يدنا.

### إعدادات المتجر (Store settings)

- App category: **Lifestyle** (كفئة آبل الأساسية).
- Contact details: بريد تواصل عام (إلزامي)، والموقع `https://osamafa86-dotcom.github.io/mediapro/` (اختياري).

## ٥. أذونات لا تحتاج تصريحًا

- `SCHEDULE_EXACT_ALARM` وحده (حُذف `USE_EXACT_ALARM` المقيّد في Google Play بتطبيقات المنبّه
  والتقويم)؛ على Android 14+ يطلبه التطبيق من صفّ «الأذان في وقته بالضبط» في الإعدادات.
- لا خدمة واجهة أمامية (foreground service)، ولا موقع في الخلفية، ولا صور أو ملفات.

## ٦. أول إصدار إنتاج (مرة واحدة)

1. `play-production/sakinah` يرفع AAB والنصوص والصور واللقطات. التطبيق لم يُنشر بعد، فتقبل Google
   الإصدار **مسودة** فقط (السير يكتشف ذلك فيرفعه مسودة).
2. Play Console ← Test and release ← Production ← Countries/regions ← Add countries/regions ← كل الدول ← Save.
3. Production ← الإصدار المسودة ← Edit release ← Next ← Save، ثم Publishing overview ← **Send changes for review**.
4. بعد قبول Google ونشر أول نسخة: كل تحديثٍ لاحق يُرسل للمراجعة آليًا من `play-production/sakinah`.
