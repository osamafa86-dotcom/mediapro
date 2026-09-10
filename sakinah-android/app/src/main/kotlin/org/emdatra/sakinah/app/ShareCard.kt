package org.emdatra.sakinah.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.text.TextUtils
import androidx.core.content.FileProvider
import java.io.File

/** بطاقات المشاركة صورةً (1080 بكسل عرضًا) للآيات والأذكار والأحاديث، بأربع سمات */
object ShareCard {
  enum class Theme(val label: String, val bg0: Int, val bg1: Int, val fg: Int, val accent: Int) {
    GREEN("أخضر", 0xFF0F766E.toInt(), 0xFF134E4A.toInt(), 0xFFF6F1E2.toInt(), 0xFFCFB46F.toInt()),
    GOLD("ذهبي", 0xFFF6F1E2.toInt(), 0xFFEADBB9.toInt(), 0xFF1D1A14.toInt(), 0xFFA98A3A.toInt()),
    NIGHT("ليلي", 0xFF1A1E2A.toInt(), 0xFF0F1119.toInt(), 0xFFF6F1E2.toInt(), 0xFFC9A851.toInt()),
    PAPER("ورقي", 0xFFFBFAF6.toInt(), 0xFFEFE7D1.toInt(), 0xFF1D1A14.toInt(), 0xFF0F766E.toInt());
    companion object { fun of(id: String) = entries.firstOrNull { it.name.equals(id, true) } ?: GREEN }
  }
  private fun alpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a shl 24)
  fun render(ctx: Context, title: String, text: String, footer: String, quran: Boolean, theme: Theme = Theme.of(Store.shareTheme)): Bitmap {
    val w = 1080; val pad = 80f
    val quranTf = runCatching { Typeface.createFromAsset(ctx.assets, "fonts/AmiriQuran.ttf") }.getOrNull() ?: Typeface.SERIF
    val len = text.length
    val size = when { len > 900 -> 30f; len > 600 -> 34f; len > 350 -> 38f; len > 180 -> 44f; len > 80 -> 50f; else -> 56f }
    val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = theme.fg; textSize = size; typeface = if (quran) quranTf else Typeface.DEFAULT }
    val body = StaticLayout.Builder.obtain(text, 0, text.length, bodyPaint, (w - 2 * pad).toInt()).setAlignment(Layout.Alignment.ALIGN_CENTER).setLineSpacing(size * 0.75f, 1f).setTextDirection(TextDirectionHeuristics.RTL).build()
    val footPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = alpha(theme.fg, 0xBF); textSize = 28f }
    val foot = if (footer.isEmpty()) null else StaticLayout.Builder.obtain(footer, 0, footer.length, footPaint, (w - 2 * pad).toInt()).setAlignment(Layout.Alignment.ALIGN_CENTER).setTextDirection(TextDirectionHeuristics.RTL).build()
    val h = (pad + 74 + 40 + body.height + (foot?.let { it.height + 40 } ?: 0) + pad).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val c = Canvas(bmp)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), Paint().apply { shader = LinearGradient(w.toFloat(), 0f, 0f, h.toFloat(), theme.bg0, theme.bg1, Shader.TileMode.CLAMP) })
    val brand = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = theme.accent; textSize = 30f; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.RIGHT }
    c.drawText("سكينة", w - pad, pad + 30, brand)
    val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = alpha(theme.fg, 0xD9); textSize = 28f; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.LEFT }
    c.drawText(TextUtils.ellipsize(title, titlePaint, w - 2 * pad - 140, TextUtils.TruncateAt.END).toString(), pad, pad + 30, titlePaint)
    c.drawRect(w / 2f - 70, pad + 70, w / 2f + 70, pad + 74, Paint().apply { color = theme.accent })
    var y = pad + 74 + 40
    c.save(); c.translate(pad, y); body.draw(c); c.restore(); y += body.height + 40
    foot?.let { c.save(); c.translate(pad, y); it.draw(c); c.restore() }
    return bmp
  }
  /** مشاركة الصورة عبر FileProvider (ملف مؤقت في cache/share) */
  fun share(ctx: Context, bmp: Bitmap, name: String, text: String? = null) {
    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }; val f = File(dir, name)
    f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", f)
    val i = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    if (text != null) i.putExtra(Intent.EXTRA_TEXT, text)
    ctx.startActivity(Intent.createChooser(i, "مشاركة كصورة"))
  }
}
