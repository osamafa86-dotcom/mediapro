package org.emdatra.sakinah.app.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
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
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.LiveDay
import org.emdatra.sakinah.app.Ramadan
import org.emdatra.sakinah.app.text
import org.emdatra.sakinah.core.SkyPalette
import org.emdatra.sakinah.core.SkyPhase
import java.time.Instant

/**
 * ويدجت رمضان الصغير (المرحلة الرابعة — ramadan-widget.png): «١٢ رمضان»، «السحور حتى ٤:٤٠»، «الإفطار ٥:٢٢»، ثم «بعد …»
 * يعدّ وحده (Chronometer) إلى الإفطار طوال الصوم وإلى الإمساك ليلاً — والسطر الذي يُعدّ إليه بارز. سماء الطور الحالي
 * خلفيته كويدجت «الصلاة القادمة». خارج رمضان يقول كم بقي على رمضان والصلاة القادمة، فلا يبقى فارغاً.
 * كل شيء من [LiveDay.model] (الذي يحسب رمضان بتعديل المستخدم الهجريّ نفسه)، ويتجدّد مع منبّهات الحدود ومنها الإمساك.
 */
class RamadanGlanceWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact
  override suspend fun provideGlance(context: Context, id: GlanceId) { provideContent { RamadanContent() } }
}

class RamadanWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = RamadanGlanceWidget()
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds); LiveDay.refresh(context, widgets = false)
  }
  override fun onDeleted(context: Context, appWidgetIds: IntArray) { super.onDeleted(context, appWidgetIds); LiveDay.refresh(context, widgets = false) }
  override fun onDisabled(context: Context) { super.onDisabled(context); LiveDay.refresh(context, widgets = false) }
}

private fun style(size: TextUnit, color: Color, weight: FontWeight = FontWeight.Normal, align: TextAlign = TextAlign.Right) =
  TextStyle(color = ColorProvider(color), fontSize = size, fontWeight = weight, textAlign = align)

@Composable private fun RamadanContent() {
  currentState<Preferences>()[PrayerGlanceWidget.TICK]
  val ctx = LocalContext.current; val size = LocalSize.current
  val m = runCatching { LiveDay.model() }.getOrNull()
  val rtl = ctx.resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL
  val right = if (rtl) Alignment.Start else Alignment.End
  val palette = m?.palette ?: SkyPalette.of(SkyPhase.SHAFAQ)
  // ورقٌ على السماء الداكنة وحبرٌ على الفاتحة (ألوان السماء نفسها)
  val text = palette.text; val muted = text.copy(alpha = 0.74f)
  val bg = SkyArt.render(palette, m?.phase ?: SkyPhase.SHAFAQ, size.width.value, size.height.value, false)
  Box(GlanceModifier.fillMaxSize().appWidgetBackground().cornerRadius(22.dp).clickable(actionStartActivity(LiveDay.openIntent(ctx, LiveDay.todayUri())))) {
    Image(ImageProvider(bg), null, GlanceModifier.fillMaxSize(), contentScale = ContentScale.Crop)
    Column(GlanceModifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp), horizontalAlignment = right) {
      when {
        m == null -> {
          Spacer(GlanceModifier.defaultWeight())
          Text("حدّد موقعك", style = style(15.sp, text, FontWeight.Bold), maxLines = 1)
          Text("لتظهر مواقيت الإفطار والسحور", style = style(11.sp, muted), maxLines = 2)
        }
        m.ramadanDay == null -> {
          // خارج رمضان: كم بقي عليه، والصلاة القادمة
          val days = Ramadan.daysUntilStart(m.now, m.zone)
          Text("رمضان", style = style(13.sp, text, FontWeight.Bold), maxLines = 1)
          Spacer(GlanceModifier.defaultWeight())
          Text(when { days == 1 -> "غداً بإذن الله"; days == 2 -> "بعد يومين"; days in 3..10 -> "بعد ${Fmt.number(days)} أيام"; else -> "بعد ${Fmt.number(days)} يوماً" }, style = style(18.sp, text, FontWeight.Bold), maxLines = 1)
          Text("${m.nextName} ${LiveDay.clock(m.nextTime)}", style = style(12.sp, muted), maxLines = 1)
        }
        else -> {
          // الإفطار القادم (مغرب الغد بعد أن يمضي مغرب اليوم)، والإمساك القادم؛ والعدّ إلى الإفطار في الصوم، وإلى الإمساك قبله، وإلا إلى الفجر
          val iftar = m.iftar ?: Ramadan.nextIftar(m.tl, m.now)
          val imsak = m.imsak
          val target: Instant? = when { m.iftar != null -> m.iftar; imsak != null && m.now.isBefore(imsak) -> imsak; else -> m.nextTime }
          Text("${Fmt.number(m.ramadanDay)} رمضان", style = style(13.sp, text, FontWeight.Bold), maxLines = 1)
          Spacer(GlanceModifier.defaultWeight())
          Line("السحور حتى", LiveDay.clock(imsak), on = target == imsak && imsak != null, text, muted, rtl)
          Spacer(GlanceModifier.height(2.dp))
          Line("الإفطار", LiveDay.clock(iftar), on = target == iftar && iftar != null, text, muted, rtl)
          if (target != null) Countdown(target, text)
        }
      }
    }
  }
}

/** سطرٌ بطرفين: الاسم في البداية والوقت في النهاية؛ البارز أكبر وأثقل */
@Composable private fun Line(label: String, time: String, on: Boolean, text: Color, muted: Color, rtl: Boolean) {
  val l = @Composable { Text(label, style = style(if (on) 13.sp else 12.sp, if (on) text else muted, if (on) FontWeight.Bold else FontWeight.Medium), maxLines = 1) }
  val t = @Composable { Text(time, style = style(if (on) 22.sp else 15.sp, if (on) text else muted, if (on) FontWeight.Bold else FontWeight.Medium), maxLines = 1) }
  Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    if (rtl) { l(); Spacer(GlanceModifier.defaultWeight()); t() } else { t(); Spacer(GlanceModifier.defaultWeight()); l() }
  }
}

/** «بعد ٢٣:٠٤» يعدّ وحده داخل RemoteViews (المخطّط نفسه في ويدجت «الصلاة القادمة») */
@Composable private fun Countdown(target: Instant, color: Color) {
  val ctx = LocalContext.current
  val rv = RemoteViews(ctx.packageName, R.layout.widget_countdown).apply {
    val base = SystemClock.elapsedRealtime() + (target.toEpochMilli() - System.currentTimeMillis())
    setChronometer(R.id.countdown, base, "بعد %s", true)
    setChronometerCountDown(R.id.countdown, true)
    setTextColor(R.id.countdown, android.graphics.Color.argb((color.alpha * 255).toInt(), (color.red * 255).toInt(), (color.green * 255).toInt(), (color.blue * 255).toInt()))
    setTextViewTextSize(R.id.countdown, TypedValue.COMPLEX_UNIT_SP, 12f)
  }
  AndroidRemoteViews(rv)
}
