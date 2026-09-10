package org.emdatra.sakinah.app

import android.content.Context
import android.graphics.Typeface
import androidx.compose.ui.text.font.FontFamily
import java.util.LinkedHashMap

/** خطوط المصحف من assets/fonts (المولَّدة بـ build-fonts.py --android): خطوط الصفحات الـ604 وأسماء السور وحفص وأميري قرآن، مع إبقاء أقرب 24 خطًا */
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
  fun page(p: Int) = family("p$p")
  val surahNames get() = family("sura_names")
  val amiri get() = family("AmiriQuran")
  val hafs get() = family("hafs")
  fun text(pref: String) = (if (pref == "hafs") hafs else null) ?: amiri
}
