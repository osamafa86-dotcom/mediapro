# دليل تثبيت ميديا برو على cPanel

## المتطلبات
- PHP 7.4+ (يفضل PHP 8.0+)
- MySQL 5.7+ أو MariaDB 10.3+
- Apache مع mod_rewrite

---

## خطوات التثبيت

### 1. رفع الملفات
- ادخل إلى **cPanel → File Manager**
- انتقل إلى مجلد `public_html` (أو أنشئ مجلداً فرعياً مثل `public_html/mediapro`)
- ارفع جميع ملفات المشروع:
  - `config.php`
  - `login.php`
  - `index.php`
  - `api.php`
  - `logout.php`
  - `.htaccess`
  - `database.sql`
  - مجلد `uploads/` (مع ملف .htaccess بداخله)

### 2. إنشاء قاعدة البيانات
- ادخل **cPanel → MySQL Databases**
- أنشئ قاعدة بيانات جديدة (مثال: `username_mediapro`)
- أنشئ مستخدم جديد لقاعدة البيانات
- اربط المستخدم بقاعدة البيانات مع **All Privileges**
- ادخل **cPanel → phpMyAdmin**
- اختر قاعدة البيانات الجديدة
- اضغط **Import** وارفع ملف `database.sql`

### 3. تعديل ملف الإعدادات
- افتح `config.php` من File Manager
- عدّل هذه الأسطر:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'username_mediapro');  // اسم قاعدة البيانات
define('DB_USER', 'username_dbuser');     // اسم المستخدم
define('DB_PASS', 'your_password');       // كلمة المرور
define('APP_URL', 'https://yourdomain.com/mediapro');
```

### 4. صلاحيات المجلدات
- تأكد أن مجلد `uploads` له صلاحيات `755`
- تأكد أن مجلد `uploads/media` له صلاحيات `755`

### 5. اختبار النظام
- افتح الرابط: `https://yourdomain.com/mediapro/login.php`
- سجل الدخول بالحساب التجريبي:
  - **البريد:** `admin@mediapro.com`
  - **كلمة المرور:** `123456`

---

## ملاحظات مهمة

- **غيّر كلمة المرور** الافتراضية فوراً بعد أول تسجيل دخول
- **ملف database.sql** احذفه من السيرفر بعد استيراده
- تأكد من تفعيل **HTTPS** عبر SSL في cPanel
- لتفعيل إرسال البريد الإلكتروني، أضف إعدادات SMTP في config.php

---

## هيكل الملفات

```
mediapro/
├── config.php          ← إعدادات النظام واتصال قاعدة البيانات
├── login.php           ← صفحة تسجيل الدخول
├── index.php           ← التطبيق الرئيسي (18 صفحة)
├── api.php             ← واجهة API لجميع العمليات
├── logout.php          ← تسجيل الخروج
├── database.sql        ← ملف قاعدة البيانات (احذفه بعد الاستيراد)
├── .htaccess           ← إعدادات Apache والحماية
├── INSTALL.md          ← دليل التثبيت (هذا الملف)
└── uploads/
    ├── .htaccess       ← حماية مجلد الرفع
    └── media/          ← ملفات الوسائط المرفوعة
```

## الحسابات الافتراضية

| الاسم | البريد | الدور | كلمة المرور |
|-------|--------|-------|-------------|
| محمد أحمد | admin@mediapro.com | مدير عام | 123456 |
| أحمد العلي | ahmed@mediapro.com | موظف | 123456 |
| لينا محمود | lina@mediapro.com | موظف | 123456 |
| عمر القاسم | omar@mediapro.com | موظف | 123456 |
| سارة الخالدي | sara@mediapro.com | موظف | 123456 |
| نور الدين | nour@mediapro.com | موظف | 123456 |
| ماجد حسن | majed@mediapro.com | موظف | 123456 |
| رنا العبدالله | rana@mediapro.com | موظف | 123456 |
