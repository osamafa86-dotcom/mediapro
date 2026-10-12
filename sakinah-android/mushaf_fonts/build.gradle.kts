// حزمة أصول Google Play (Play Asset Delivery): خطوط صفحات المصحف الـ604 (p1…p604.ttf، نحو 150 م.ب خامًا)
// تُنزَّل تلقائيًا بعد التثبيت (fast-follow) ولا تُحتسب في حجم التطبيق المعروض في المتجر.
// الملفات تولَّد في src/main/assets/fonts بـ sakinah-native/tools/build-fonts.py --android (غير مودَعة في git).
plugins { id("com.android.asset-pack") }

assetPack {
  packName = "mushaf_fonts"                       // حروف وأرقام وشرطات سفلية فقط
  dynamicDelivery { deliveryType = "fast-follow" }
}
