package org.emdatra.sakinah.app.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import org.emdatra.sakinah.R
import org.emdatra.sakinah.app.LiveDay
import org.emdatra.sakinah.app.isDark
import org.emdatra.sakinah.core.SkyDisc
import org.emdatra.sakinah.core.SkyPalette
import org.emdatra.sakinah.core.SkyPhase
import kotlin.math.min

/**
 * ويدجت «الصلاة القادمة» (المرحلة الثالثة — widgets.png وandroid-watch.png): سماء الطور الحالي خلفيةً، والصلاة
 * القادمة بوقتها وعدٍّ تنازليّ حيّ (Chronometer يعدّ وحده بلا تجديد)، وفي الحجم المتوسط شريط الصلوات الخمس
 * والقادمة مميّزة، وشريحة أذكار الوقت. كل شيء يُحسب على الجهاز من [LiveDay.model]، ويتجدّد عند حدود الصلوات
 * وأطوار السماء من منبّهات [LiveDay].
 */
class PrayerGlanceWidget : GlanceAppWidget() {
  companion object {
    val SMALL = DpSize(110.dp, 110.dp)
    val MEDIUM = DpSize(240.dp, 110.dp)
    /** يُكتب في حالة الويدجت قبل كل تجديد كي تتغيّر الحالة فيُعاد التركيب ولو كانت الجلسة قائمة */
    val TICK = longPreferencesKey("tick")
  }
  override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    provideContent { WidgetContent() }
  }
}

class PrayerWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = PrayerGlanceWidget()
  // وضعُ ويدجت أو إزالته يضبط منبّهات الحدود وشبكة الأمان أو يلغيها (التجديد نفسه يتولّاه Glance هنا)
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds); LiveDay.refresh(context, widgets = false)
  }
  override fun onDeleted(context: Context, appWidgetIds: IntArray) { super.onDeleted(context, appWidgetIds); LiveDay.refresh(context, widgets = false) }
  override fun onDisabled(context: Context) { super.onDisabled(context); LiveDay.refresh(context, widgets = false) }
}

object PrayerWidget {
  /** يجدّد ويدجت «الصلاة القادمة» وويدجت رمضان (المرحلة الرابعة) معاً */
  suspend fun updateAll(ctx: Context) {
    val mgr = GlanceAppWidgetManager(ctx)
    val widget = PrayerGlanceWidget()
    for (id in mgr.getGlanceIds(PrayerGlanceWidget::class.java)) {
      updateAppWidgetState(ctx, id) { it[PrayerGlanceWidget.TICK] = System.currentTimeMillis() }
      widget.update(ctx, id)
    }
    val ramadan = RamadanGlanceWidget()
    for (id in mgr.getGlanceIds(RamadanGlanceWidget::class.java)) {
      updateAppWidgetState(ctx, id) { it[PrayerGlanceWidget.TICK] = System.currentTimeMillis() }
      ramadan.update(ctx, id)
    }
  }
}

// ---- الألوان فوق السماء: ورق على الداكنة، حبر على الفاتحة
private class Ink(dark: Boolean) {
  val text = if (dark) Color(0xFFFBF9F4) else Color(0xFF16211F)
  val muted = text.copy(alpha = 0.72f)
  val chip = if (dark) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.62f)
  /** شريط الصلوات زجاجٌ داكن في كل الأطوار (كبطاقة المواقيت) */
  val strip = if (dark) Color.White.copy(alpha = 0.10f) else Color(0xFF16211F).copy(alpha = 0.55f)
  val stripOn = Color.White.copy(alpha = 0.22f)
  val stripText = Color(0xFFFBF9F4)
}

private fun style(size: TextUnit, color: Color, weight: FontWeight = FontWeight.Normal, align: TextAlign = TextAlign.Right) =
  TextStyle(color = ColorProvider(color), fontSize = size, fontWeight = weight, textAlign = align)

@Composable private fun WidgetContent() {
  // قراءة الحالة تجعل التركيب يتجدّد مع كل TICK؛ والنموذج يُحسب من الوقت الآن
  currentState<Preferences>()[PrayerGlanceWidget.TICK]
  val ctx = LocalContext.current; val size = LocalSize.current
  val m = runCatching { LiveDay.model() }.getOrNull()
  // الواجهة عربية: النصّ يميناً والسماء يساراً أيّاً كانت لغة الجهاز (Row يتبع اتجاه لغة الجهاز فنعكسه في اليسارية)
  val rtl = ctx.resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL
  val right = if (rtl) Alignment.Start else Alignment.End
  val medium = size.width >= PrayerGlanceWidget.MEDIUM.width
  val palette = m?.palette ?: SkyPalette.of(SkyPhase.SHAFAQ)
  val phase = m?.phase ?: SkyPhase.SHAFAQ
  val ink = Ink(palette.isDark)
  val bg = SkyArt.render(palette, phase, size.width.value, size.height.value, medium)
  Box(GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp).clickable(actionStartActivity(LiveDay.openIntent(ctx, LiveDay.todayUri())))) {
    Image(ImageProvider(bg), null, GlanceModifier.fillMaxSize(), contentScale = ContentScale.Crop)
    when {
      m == null -> Column(GlanceModifier.fillMaxSize().padding(14.dp), verticalAlignment = Alignment.Bottom, horizontalAlignment = right) {
        Text("حدّد موقعك", style = style(16.sp, ink.text, FontWeight.Bold), maxLines = 1)
        Text("لتظهر مواقيت الصلاة", style = style(12.sp, ink.muted), maxLines = 2)
      }
      medium -> Medium(m, ink, rtl, right)
      else -> Small(m, ink, right)
    }
  }
}

/** الصغير: المدينة، ثم اسم الصلاة القادمة ووقتها بأرقام كبيرة، و«بعد …» يعدّ وحده */
@Composable private fun Small(m: LiveDay.Model, ink: Ink, right: Alignment.Horizontal) {
  Column(GlanceModifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp), horizontalAlignment = right) {
    Text(m.city ?: "", style = style(11.sp, ink.muted), maxLines = 1)
    Spacer(GlanceModifier.defaultWeight())
    Text(m.nextName, style = style(16.sp, ink.text, FontWeight.Bold), maxLines = 1)
    Text(LiveDay.clock(m.nextTime), style = style(34.sp, ink.text), maxLines = 1)
    Countdown(m, ink.text, 12f)
  }
}

/** المتوسط: «المغرب ٤:٥٢» و«بعد …» (يمين) وشريحة أذكار الوقت (يسار)، ثم شريط الصلوات الخمس والقادمة مميّزة */
@Composable private fun Medium(m: LiveDay.Model, ink: Ink, rtl: Boolean, right: Alignment.Horizontal) {
  val ctx = LocalContext.current
  Column(GlanceModifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
      val title = @Composable {
        Column(horizontalAlignment = right) {
          Text("${m.nextName} ${LiveDay.clock(m.nextTime)}", style = style(18.sp, ink.text, FontWeight.Bold), maxLines = 1)
          Countdown(m, ink.text, 12f)
        }
      }
      val chip = @Composable {
        val p = m.period
        if (p != null) Box(GlanceModifier.cornerRadius(16.dp).background(ink.chip).padding(horizontal = 12.dp, vertical = 6.dp)
          .clickable(actionStartActivity(LiveDay.openIntent(ctx, LiveDay.adhkarUri(p))))) {
          Text(p.title, style = style(12.sp, ink.text, FontWeight.Medium, TextAlign.Center), maxLines = 1)
        }
      }
      if (rtl) { title(); Spacer(GlanceModifier.defaultWeight()); chip() } else { chip(); Spacer(GlanceModifier.defaultWeight()); title() }
    }
    Spacer(GlanceModifier.defaultWeight())
    val cells = if (rtl) LiveDay.FIVE else LiveDay.FIVE.reversed()
    Row(GlanceModifier.fillMaxWidth().cornerRadius(14.dp).background(ink.strip).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
      for (p in cells) {
        val on = p == m.highlight
        Column(GlanceModifier.defaultWeight().cornerRadius(10.dp).background(if (on) ink.stripOn else Color.Transparent).padding(vertical = 5.dp),
          horizontalAlignment = Alignment.CenterHorizontally) {
          Text(p.nameAr, style = style(11.sp, ink.stripText.copy(alpha = if (on) 1f else 0.72f), if (on) FontWeight.Bold else FontWeight.Medium, TextAlign.Center), maxLines = 1)
          Spacer(GlanceModifier.height(1.dp))
          Text(LiveDay.clock(m.timeOf(p)), style = style(13.sp, ink.stripText, if (on) FontWeight.Bold else FontWeight.Medium, TextAlign.Center), maxLines = 1)
        }
      }
    }
  }
}

/** العدّ التنازليّ إلى الأذان: Chronometer داخل RemoteViews يعدّ وحده كل ثانية، فلا يحتاج الويدجت تجديداً كل دقيقة */
@Composable private fun Countdown(m: LiveDay.Model, color: Color, sizeSp: Float) {
  val ctx = LocalContext.current
  val rv = RemoteViews(ctx.packageName, R.layout.widget_countdown).apply {
    val base = SystemClock.elapsedRealtime() + (m.nextTime.toEpochMilli() - System.currentTimeMillis())
    setChronometer(R.id.countdown, base, "بعد %s", true)
    setChronometerCountDown(R.id.countdown, true)
    setTextColor(R.id.countdown, android.graphics.Color.argb((color.alpha * 255).toInt(), (color.red * 255).toInt(), (color.green * 255).toInt(), (color.blue * 255).toInt()))
    setTextViewTextSize(R.id.countdown, TypedValue.COMPLEX_UNIT_SP, sizeSp)
  }
  AndroidRemoteViews(rv)
}

/**
 * خلفية السماء صورةً صغيرة (Glance لا يرسم التدرّجات): تدرّج لوحة الطور، ووهج الأفق، والنجوم ليلاً، وقرص الشمس أو
 * القمر في جهة اليسار بعيداً عن النصّ. تُرسم بمقاس الويدجت التقريبي (×١٫٥) فتبقى خفيفة في رسالة التحديث.
 */
object SkyArt {
  fun render(p: SkyPalette, phase: SkyPhase, wDp: Float, hDp: Float, wide: Boolean): Bitmap {
    val k = 1.5f
    val w = (wDp * k).toInt().coerceIn(64, 420); val h = (hDp * k).toInt().coerceIn(64, 360)
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val c = Canvas(bmp)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG)
    // قبل أندرويد ١٢ لا يقصّ النظام زوايا الويدجت: تُقصّ في الصورة نفسها
    if (Build.VERSION.SDK_INT < 31) { val r = 18f * k; c.clipPath(Path().apply { addRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), r, r, Path.Direction.CW) }) }
    val stops = p.stops.map { LiveDay.argb(it) }.toIntArray()
    paint.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), stops, floatArrayOf(0f, 1f / 3, 2f / 3, 1f), Shader.TileMode.CLAMP)
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), paint)
    // وهج الأفق (أو وهج الشمس العالية من فوق)
    val gc = LiveDay.argb(p.glow, (p.glowOpacity * 255).toInt().coerceIn(0, 255))
    val gx = w / 2f; val gy = if (p.disc == SkyDisc.SUN_HIGH) -h * 0.05f else h * 0.98f; val gr = maxOf(w, h) * 0.75f
    paint.shader = RadialGradient(gx, gy, gr, gc, gc and 0x00FFFFFF, Shader.TileMode.CLAMP)
    c.drawCircle(gx, gy, gr, paint); paint.shader = null
    // نجوم الليل والسَّحَر والشفق
    if (p.isDark && (phase == SkyPhase.NIGHT || phase == SkyPhase.SAHAR || phase == SkyPhase.SHAFAQ)) {
      val a = if (phase == SkyPhase.SHAFAQ) 0.45f else 0.8f
      for (i in 0 until 22) {
        val x = ((i * 53 + 119) % 397) / 397f * w; val y = ((i * 31 + 49) % 211) / 211f * h * 0.6f
        paint.color = android.graphics.Color.argb(((if (i % 4 == 0) 0.9f else 0.5f) * a * 255).toInt(), 255, 255, 255)
        c.drawCircle(x, y, (0.6f + (i % 3) * 0.45f) * k, paint)
      }
    }
    // القرص: يساراً (النصّ يمين)، أعلى قليلاً في الصغير، وبين الشريحة والعنوان في المتوسط
    val d = 15f * k
    val at = if (wide) floatArrayOf(w * 0.46f, h * 0.20f) else floatArrayOf(w * 0.30f, h * 0.30f)
    when (p.disc) {
      SkyDisc.NONE -> {}
      SkyDisc.MOON -> {
        paint.shader = RadialGradient(at[0], at[1], d * 1.6f, 0x80F3DFA0.toInt(), 0x00F3DFA0, Shader.TileMode.CLAMP); c.drawCircle(at[0], at[1], d * 1.6f, paint); paint.shader = null
        paint.color = 0xFFF3DFA0.toInt(); c.drawCircle(at[0], at[1], d / 2, paint)
        paint.color = LiveDay.argb(p.stops[1]); c.drawCircle(at[0] + d * 0.33f, at[1] - d * 0.16f, d * 0.42f, paint)
      }
      else -> {
        val dd = if (p.disc == SkyDisc.SUN_HIGH) d * 1.1f else d
        paint.shader = RadialGradient(at[0], at[1], dd * 1.9f, 0x8CFFD27A.toInt(), 0x00FFD27A, Shader.TileMode.CLAMP); c.drawCircle(at[0], at[1], dd * 1.9f, paint); paint.shader = null
        paint.color = 0xFFFFF3C4.toInt(); c.drawCircle(at[0], at[1], min(dd / 2, h * 0.2f), paint)
      }
    }
    return bmp
  }
}
