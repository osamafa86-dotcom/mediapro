# R8 لتطبيق سكينة: التصغير يحذف نحو 11 ألف صنف أيقونات (material-icons-extended يُستعمل منه ~100) وأغلب
# Guava/media3 غير المستعمل — dex من ~13 م.ب تنزيلًا إلى بضعة، ومن 47 إلى ~10 على القرص (Android 10+ يخزّنه غير مضغوط).
# kotlinx.serialization وmedia3 وPlay Asset Delivery تحمل قواعدها داخل مكتباتها؛ ما يلي احتياطٌ ومنع تحذيرات.

# المسلسلات المولَّدة بالملحق (كل الحالة المحفوظة في Store/Downloads/Sky/Mosques تمرّ بها)
-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1>$Companion { kotlinx.serialization.KSerializer serializer(...); }
-keep,allowobfuscation @kotlinx.serialization.Serializable class **

# Guava (عبر media3) تشير إلى تعليقات تحقّق غير موجودة على Android
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.lang.model.**
-dontwarn org.checkerframework.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn sun.misc.Unsafe

# أسماء الأصناف تبقى مقروءة في تقارير الأعطال (لا تشويش للأسماء؛ الحذف والتحسين فقط)
-dontobfuscate
