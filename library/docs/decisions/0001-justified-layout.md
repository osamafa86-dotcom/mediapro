# 0001 — الشبكة المبرَّرة: justified-layout (MIT) بدل @immich/justified-layout-wasm (AGPL)

- **السياق:** وثيقة التصميم §9 سمّت `@immich/justified-layout-wasm`، ونبّهت §10 إلى ترخيصه.
- **ما قسته:** ترخيص الحزمة AGPL-3.0؛ ربطها بتطبيق يُقدَّم عبر الشبكة يُلزم بنشر الشيفرة المصدرية للتطبيق كاملًا لكل مستخدم.
- **البديل:** `justified-layout` من Flickr (MIT، JS خالص بلا WASM). الخوارزمية نفسها (صفوف بارتفاع هدف ونسب الصور)، وأداؤها كافٍ لمئات العناصر في الصفحة مع TanStack Virtual.
- **القرار:** `justified-layout`.
