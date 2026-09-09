// تطبيق السمة قبل أول رسم لتفادي الوميض (ملف مستقل بدل شيفرة مضمّنة كي تسمح سياسة أمان المحتوى بـ script-src 'self' فقط)
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('sakinah:v1') || '{}');
    var t = (s && s.theme) || 'auto';
    var dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { /* تخزين غير متاح: تبقى السمة الفاتحة */ }
})();
