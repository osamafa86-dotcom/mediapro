# النشر — media.emdatra.org

المكتبة موقع جديد على الخادم المشترك (`37.148.202.122`)، لا نقلَ من استضافة قديمة. تعمل بجانب wilt ونيوز فيد
والمحفظة، ولا تشترك معها إلا في Caddy.

## ما يعمل

| | |
|---|---|
| `media-db` | Postgres 16 خاصّة بالمكتبة، بيانات على `/srv/sites/data/media/pg`، بلا منفذ مكشوف |
| `media-app` | الخادم (Next.js standalone)، يصله Caddy باسم `media-app:3000` على `deploy_default` |
| `media-worker` | المعالجة: ffmpeg (H.264 + SVT-AV1) وsharp وexiftool وLibRaw. معالج ونصف وذاكرة 1 GB، ويعالج ملفًا واحدًا في كل مرة |
| R2 | الأصول والنسخ كلها. لا ملف وسائط على قرص الخادم |
| Caddy | `/srv/sites/caddy/media.caddy` مرسوم من `deploy/vps/media.caddy.tmpl` |

الملفات كلها في `library/deploy/vps/`:
- `Dockerfile`، وفيه هدفان: `app` و`worker`.
- `docker-compose.yml`، وفيه حدود الذاكرة والمعالج.
- `media.caddy.tmpl`.
- `env.example`، وفيه أسماء المتغيّرات فقط.
- `r2-cors.json`.

تُبنى الصورتان على الخادم من نسخة المستودع في `/opt/sites/media/repo`، فلا سجلّ صور ولا رموز وصول إليه. ويتحقّق
CI من بناء الصورتين على كل طلب دمج يمسّ `library/`.

## ما يلزم المالك — مرة واحدة

1. **دلو R2:**
   - من Cloudflare ← R2، أنشئ دلوًا (مثلًا `emdatra-media`).
   - أنشئ له **API token** بصلاحية «Object Read & Write» على هذا الدلو وحده، وانسخ:
     - Access Key ID
     - Secret Access Key
     - رابط S3 API: `https://<account-id>.r2.cloudflarestorage.com`
   - **CORS:** تضبطه مهمة التركيب آليًا من `r2-cors.json`، وفيه `ExposeHeaders: ETag`. بدون هذه الترويسة يرفع
     المتصفح الملف كله ثم يفشل في آخر خطوة. إن رفض المفتاح ضبطها، الصق الملف نفسه في إعدادات الدلو ← CORS
     policy.
2. **البريد:** حساب SMTP لإرسال روابط الدخول والتنبيهات وردود الملاحظات، في صيغة
   `smtps://user:pass@host:465`.
3. **أسرار مستودع mahfazapay** (Settings ← Secrets ← Actions):

   | السرّ | |
   |---|---|
   | `MEDIA_S3_ENDPOINT` | رابط S3 API |
   | `MEDIA_S3_BUCKET` | اسم الدلو |
   | `MEDIA_S3_ACCESS_KEY_ID` | معرّف المفتاح |
   | `MEDIA_S3_SECRET_ACCESS_KEY` | سرّ المفتاح |
   | `MEDIA_SMTP_URL` | عنوان SMTP |
   | `MEDIA_ADMIN_EMAIL` و`MEDIA_ADMIN_PASSWORD` | أول مدير (12 حرفًا على الأقل). يُنشأ مرة واحدة ولا تُغيَّر كلمة مروره بعدها |
   | `MEDIA_GOOGLE_CLIENT_ID` و`MEDIA_GOOGLE_CLIENT_SECRET` | اختياريان، للاستيراد من Drive (`docs/drive.md`) |

   أما `DB_PASSWORD` و`SESSION_SECRET` و`LINK_SIGNING_SECRET` فتولّدها المهمة على الخادم مرة واحدة، ولا تغادره.
4. **دمج طلب الدمج على mahfazapay** الذي يحمل مهمة التركيب (`deploy/ops/task.sh`). الدمج هو التشغيل، فلا يُدمج
   قبل الأسرار.

## ما تفعله المهمة

ترتيبها هكذا، وكل خطوة تتوقّف بسبب واضح إن فشلت:

1. **حارس الذاكرة:** لا تبدأ إن كانت الذاكرة المتاحة أقل من 900 MiB. وإن هبطت بعد التشغيل تحت 250 MiB، توقف
   مشروع المكتبة وحده.
2. **الشيفرة:** تسحب `main` من `osamafa86-dotcom/mediapro` إلى `/opt/sites/media/repo`.
3. **ملف البيئة:** `/opt/sites/media/.env` بصلاحية 600.
   - تولّد الأسرار الداخلية مرة واحدة فقط.
   - تكتب أسرار R2 والبريد وGoogle في كل تشغيل من أسرار المستودع.
   - لا تطبع أي سرّ.
4. **البناء والتشغيل:** `docker compose -p media … up -d --build`، ثم تنتظر `healthy` للحاويات الثلاث.
5. **الترحيل:** `node ops/migrate.mjs` داخل العامل، ويشمل مخطّط `graphile_worker`. ثم أول مدير إن لم يوجد.
6. **R2:** تضبط CORS للدلو، وتتحقّق منه برفع ملف صغير وقراءته وحذفه.
7. **Caddy:**
   - ترسم `media.caddy` وتتحقّق منه بـ `caddy validate` قبل أي تبديل، ثم `caddy reload`.
   - إن فشل التحقّق تحذف الملف وتترك Caddy كما كان.
   - لا تعيد إنشاء حاوية Caddy.
8. **DNS:**
   - سجلّ `A` لـ `media.emdatra.org` عبر كلاودفلير، **غير مُمرَّر (رمادي)** حتى يستصدر Caddy الشهادة ويُثبَت
     وجودها.
   - بعدها يُقلب إلى برتقالي.
   - **لا يُضبط وضع `Full` في كلاودفلير قبل إثبات الشهادة على الأصل لهذا الاسم بعينه.** هذا درس الخطأ 525 في
     wilt.
9. **التحقّق من هوية المُجيب، لا من الرمز:** يُطلب
   `curl --resolve media.emdatra.org:443:127.0.0.1 https://media.emdatra.org/api/health` فيُنتظر
   `{"ok":true,"db":true}`، وغياب ترويسة `Server`، وحجب `/api/download/zip/<أي شيء>` بلا جلسة (401). ثم تُطبع
   الأرقام.

**التراجع:**
- `docker compose -p media down`، ثم `rm /srv/sites/caddy/media.caddy`، ثم `caddy reload`، ثم حذف سجلّ DNS.
- القاعدة تبقى على القرص، وR2 لا يُمسّ.

## بعد التشغيل

- **الدخول:** `https://media.emdatra.org/login` بحساب المدير الأول.
- **التحديث:** إعادة تشغيل المهمة نفسها تسحب آخر `main` وتعيد البناء. لا تمسّ الأسرار ولا البيانات.
- **النسخ الاحتياطي:**
  - `pg_dump` يوميًا من `media-db` إلى `/srv/sites/data/media/backups`، مع الاحتفاظ بآخر 14 نسخة. تضيفه
    المهمة مؤقّتًا لـ systemd.
  - R2 يحمل الملفات نفسها. وتفعيل «Object versioning» على الدلو قرار للمالك لأنه يضاعف التكلفة.
- **المراقبة:** يجب أن تبقى `/api/health` بالردّ 200. والعامل له فحص صحة داخلي في الحاوية (`WORKER_HEALTH_PORT`).

## المرحلة الثانية: الدخول الموحّد

`docs/sso.md`. يبقى مطفأً (`EMDATRA_SSO_ENABLED=false`) حتى يصدر الموقع الأم الرموز.
