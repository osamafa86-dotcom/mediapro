package org.emdatra.sakinah.app

import android.content.Context
import android.graphics.Typeface
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import java.util.LinkedHashMap

/** الخطوط المولَّدة بـ build-fonts.py --android: خطوط الواجهة (ui/) وأسماء السور وحفص وأميري قرآن في assets/fonts،
 *  وخطوط صفحات المصحف الـ604 في حزمة أصول Play ([MushafFontPack]) تُقرأ من ملفاتها بعد تنزيلها، مع إبقاء أقرب 24 خط صفحة */
object Fonts {
  private val cache = object : LinkedHashMap<String, FontFamily>(32, 0.75f, true) { override fun removeEldestEntry(e: MutableMap.MutableEntry<String, FontFamily>?) = size > 24 }
  private var assets: android.content.res.AssetManager? = null
  fun init(ctx: Context) { assets = ctx.applicationContext.assets }
  @Synchronized fun family(name: String): FontFamily? {
    cache[name]?.let { return it }
    val a = assets ?: return null
    val tf = runCatching { Typeface.createFromAsset(a, "fonts/$name.ttf") }.getOrNull() ?: return null
    val f = FontFamily(androidx.compose.ui.text.font.Typeface(tf)); cache[name] = f; return f
  }
  /** خط صفحة المصحف: من حزمة الأصول إن نُزِّلت، وإلا من assets (نسخة -PfontsInBase)، وإلا null فيُعرض النص المتدفق */
  @Synchronized fun page(p: Int): FontFamily? {
    val name = "p$p"
    cache[name]?.let { return it }
    val dir = MushafFontPack.dir
    if (dir != null) {
      val f = java.io.File(dir, "$name.ttf")
      val tf = if (f.exists()) runCatching { Typeface.createFromFile(f) }.getOrNull() else null
      if (tf != null) { val fam = FontFamily(androidx.compose.ui.text.font.Typeface(tf)); cache[name] = fam; return fam }
    }
    return family(name)
  }
  val surahNames get() = family("sura_names")
  val amiri get() = family("AmiriQuran")
  val hafs get() = family("hafs")
  fun text(pref: String) = (if (pref == "hafs") hafs else null) ?: amiri

  // ---- خطوط الواجهة (نظام التصميم) — تُحمَّل بأوزانها الثابتة؛ إن غابت الملفات يُستخدم الخط الافتراضي
  private val hasUi: Boolean by lazy { assets?.let { a -> runCatching { a.open("fonts/ui/ReadexPro-Regular.ttf").close(); true }.getOrDefault(false) } ?: false }
  private fun ui(vararg faces: Pair<String, FontWeight>): FontFamily {
    val a = assets; if (!hasUi || a == null) return FontFamily.Default
    return FontFamily(faces.map { (n, w) -> Font("fonts/ui/$n.ttf", a, w) })
  }
  /** Readex Pro: الواجهة والأرقام */
  val readex: FontFamily by lazy { ui("ReadexPro-Light" to FontWeight.Light, "ReadexPro-Regular" to FontWeight.Normal, "ReadexPro-Medium" to FontWeight.Medium, "ReadexPro-SemiBold" to FontWeight.SemiBold, "ReadexPro-Bold" to FontWeight.Bold) }
  /** Reem Kufi: العناوين والشعار */
  val kufi: FontFamily by lazy { ui("ReemKufi-Regular" to FontWeight.Normal, "ReemKufi-SemiBold" to FontWeight.SemiBold, "ReemKufi-Bold" to FontWeight.Bold) }
  /** Amiri: نصوص الأذكار والحديث */
  val amiriText: FontFamily by lazy { ui("Amiri-Regular" to FontWeight.Normal, "Amiri-Bold" to FontWeight.Bold) }
}
