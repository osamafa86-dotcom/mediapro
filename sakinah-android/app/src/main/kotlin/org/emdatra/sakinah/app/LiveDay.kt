package org.emdatra.sakinah.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.emdatra.sakinah.R
import org.emdatra.sakinah.app.widget.PrayerWidget
import org.emdatra.sakinah.app.widget.PrayerWidgetReceiver
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.ZoneId

/**
 * «اليوم الحيّ» على أندرويد (المرحلة الثالثة): نموذجٌ واحد لليوم يُحسب على الجهاز وحده (المواقيت ومحرّك السماء
 * وقواعد بطاقة «الآن»)، يغذّي ويدجت الشاشة الرئيسية والإشعار الحيّ معاً، ومنبّهاتٌ تجدّدهما عند حدّ كل صلاة
 * وكل طور سماء ومنتصف الليل — بلا شبكة ولا خادم.
 *
 * التجديد: [refresh] يُنادى من طريق المنبّهات القائم ([Notify.schedule] — فتح التطبيق، وتغيير الإعدادات،
 * وكل تذكير، والإقلاع وتغيير الوقت والمنطقة) ومن منبّهاته هو: منبّه الحدّ التالي (يوقظ الجهاز إن كان الإشعار
 * الحيّ مفعّلاً، وإلا يُسلَّم عند أول استيقاظ)، ونبضة كل دقيقة لنصّ الإشعار ما دام ظاهراً (لا توقظ الجهاز)،
 * وشبكة أمانٍ كل نصف ساعة ما دام في الشاشة ويدجت (لا توقظ الجهاز كذلك).
 */
object LiveDay {
  /** فترة أذكار الوقت بقواعد بطاقة «الآن» نفسها: الصباح من الفجر إلى الظهر، والمساء من العصر إلى العشاء، والنوم بعد العشاء */
  enum class Period(val id: String, val title: String) { MORNING("morning", "أذكار الصباح"), EVENING("evening", "أذكار المساء"), SLEEP("sleep", "أذكار النوم") }

  class Model(
    val now: Instant, val zone: ZoneId, val tl: PrayerTimes.DayTimeline,
    val nextName: String, val nextTime: Instant,
    /** الوقت الحالي («الضحى» بعد الشروق) وبدايته */
    val currentName: String, val currentStart: Instant?,
    /** الصلاة الحالية لزرّ «صلّيتُ» (لا زرّ في الضحى) ويومها — عشاء ما بعد منتصف الليل ليوم أمس */
    val prayer: Prayer?, val prayerDay: String?,
    val period: Period?, val phase: SkyPhase, val palette: SkyPalette,
    val city: String?, val temperature: Double?,
  ) {
    /** العمود المميّز في شريط الصلوات الخمس (كبطاقة المواقيت في «اليوم») — ولا عمود للشروق */
    val highlight: Prayer? get() = when { tl.next.isTomorrow -> Prayer.FAJR; tl.next.isYesterday -> Prayer.ISHA; tl.next.key == Prayer.SUNRISE -> null; else -> tl.next.key }
    fun timeOf(p: Prayer): Instant? = if (p == highlight) nextTime else tl.times[p]
    val secondsLeft: Long get() = nextTime.epochSecond - now.epochSecond
    val prayed: Boolean get() { val p = prayer ?: return false; val d = prayerDay ?: return false; return Store.hasPrayed(d, p) }
  }
  val FIVE = listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

  fun model(now: Instant = Instant.now()): Model? {
    val coords = Store.coords ?: return null; val zone = Store.zone
    val tl = PrayerTimes.dayTimeline(coords, zone, Store.params(), now)
    val t = tl.times
    fun after(x: Instant?) = x != null && !now.isBefore(x)
    fun before(x: Instant?) = x != null && now.isBefore(x)
    val period = when {
      after(t[Prayer.FAJR]) && before(t[Prayer.DHUHR]) -> Period.MORNING
      after(t[Prayer.ASR]) && !after(t[Prayer.ISHA]) -> Period.EVENING
      after(t[Prayer.ISHA]) || before(t[Prayer.FAJR]) -> Period.SLEEP
      else -> null
    }
    val start = t[tl.current]?.takeIf { !it.isAfter(now) } ?: tl.yesterdayIsha
    val reading = SkyWeatherService.cachedReading()
    val (phase, palette) = sky(now, tl, zone, reading?.first)
    return Model(now, zone, tl, if (tl.next.key == Prayer.SUNRISE) "الشروق" else tl.next.key.nameAr, tl.next.time,
      if (tl.current == Prayer.SUNRISE) "الضحى" else tl.current.nameAr, start,
      tl.current.takeIf { it != Prayer.SUNRISE }, start?.let { DayKey.key(it, zone) },
      period, phase, palette, Store.locName, reading?.second)
  }

  /** طور السماء الغالب الآن بلوحته (بلا مزجٍ: تتبدّل السماء عند حدود الأطوار وحدها) — ويحترم وضع السماء في الإعدادات */
  fun sky(now: Instant, tl: PrayerTimes.DayTimeline, zone: ZoneId, weather: SkyWeather?): Pair<SkyPhase, SkyPalette> {
    val prefs = Store.skyPrefs
    return when (prefs.mode) {
      SkyMode.CUSTOM -> SkyPhase.SHAFAQ to SkyPalette.custom(prefs.accent)
      SkyMode.FIXED -> prefs.fixedPhase to SkyPalette.of(prefs.fixedPhase)
      SkyMode.AUTO -> {
        val r = SkyEngine.phase(now, SkyInputs.of(tl, zone))
        val d = r.blendTo?.takeIf { r.t >= 0.5 } ?: r.phase
        d to SkyPalette.of(d).weathered(weather ?: SkyWeather.CLEAR)
      }
    }
  }

  // ---- نصوص
  /** وقت الأذان بلا «ص/م» (كبطاقة المواقيت) */
  fun clock(t: Instant?): String = Fmt.time(t).substringBefore(' ')
  /** «بعد ٤٢ دقيقة» / «بعد ساعتين و١٠ دقائق» — المعدود بعد «بعد» مجرور */
  fun afterLabel(secs: Long): String {
    val mins = ((secs + 59) / 60).toInt()
    if (mins <= 0) return "الآن"
    fun minutes(n: Int) = when { n == 1 -> "دقيقة"; n == 2 -> "دقيقتين"; n in 3..10 -> "${Fmt.number(n)} دقائق"; else -> "${Fmt.number(n)} دقيقة" }
    fun hours(n: Int) = when { n == 1 -> "ساعة"; n == 2 -> "ساعتين"; n in 3..10 -> "${Fmt.number(n)} ساعات"; else -> "${Fmt.number(n)} ساعة" }
    if (mins < 60) return "بعد ${minutes(mins)}"
    val h = mins / 60; val m = mins % 60
    return "بعد ${hours(h)}" + (if (m > 0) " و${minutes(m)}" else "")
  }
  /** شريحة شريط الحالة (أقصر من سبعة محارف): «٤٢د» أو «٢س١٠د» */
  fun chipLabel(secs: Long): String {
    val mins = maxOf(0, ((secs + 59) / 60).toInt())
    return if (mins < 60) "${Fmt.number(mins)}د" else "${Fmt.number(mins / 60)}س" + (if (mins % 60 > 0) "${Fmt.number(mins % 60)}د" else "")
  }
  /** «٤:٥٢ م، الخليل ١٨°» — الحرارة إن حُفظت قراءتها فقط، وفي عزلٍ من اليسار إلى اليمين */
  fun placeLine(m: Model): String {
    val temp = m.temperature?.let { "⁦${Fmt.number(Math.round(it).toInt())}°⁩" }
    val place = listOfNotNull(m.city, temp).joinToString(" ").ifEmpty { null }
    return listOfNotNull(Fmt.time(m.nextTime), place).joinToString("، ")
  }

  // ---- فتح التطبيق: «اليوم» أو جلسة أذكار الوقت (MainActivity تقرأ الرابط وتوجّه التبويب)
  fun openIntent(ctx: Context, uri: String): Intent =
    Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(uri))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
  fun todayUri() = "sakinah://today"
  fun adhkarUri(p: Period) = "sakinah://adhkar/${p.id}"

  // ---- التجديد والمنبّهات
  const val ACTION_BOUNDARY = "org.emdatra.sakinah.LIVE_BOUNDARY"
  const val ACTION_TICK = "org.emdatra.sakinah.LIVE_TICK"
  const val ACTION_REPEAT = "org.emdatra.sakinah.LIVE_REPEAT"
  const val ACTION_PRAYED = "org.emdatra.sakinah.LIVE_PRAYED"
  const val ACTION_DISMISS = "org.emdatra.sakinah.LIVE_DISMISS"
  private const val LIVE_ID = 0x5A_4C_01
  private const val RC_BOUNDARY = 0x5A_4C_10; private const val RC_TICK = 0x5A_4C_11; private const val RC_REPEAT = 0x5A_4C_12
  private const val RC_PRAYED = 0x5A_4C_13; private const val RC_DISMISS = 0x5A_4C_14; private const val RC_OPEN = 0x5A_4C_15; private const val RC_ADHKAR = 0x5A_4C_16
  private const val BRAND = 0xFF0E5C55.toInt()
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

  fun hasWidgets(ctx: Context): Boolean =
    runCatching { AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, PrayerWidgetReceiver::class.java)).isNotEmpty() }.getOrDefault(false)

  /**
   * يجدّد ما يعرض اليوم خارج التطبيق: الإشعار الحيّ (يُنشر أو يُزال)، والويدجت (إن طُلب وكان منها شيء في الشاشة)،
   * ومنبّه الحدّ التالي. [done] يُنادى بعد انتهاء العمل غير المتزامن (لـ goAsync في المستقبِل).
   */
  fun refresh(ctx: Context, widgets: Boolean = true, done: (() -> Unit)? = null) {
    val app = ctx.applicationContext
    val m = runCatching { model() }.getOrNull()
    val shown = runCatching { updateLive(app, m) }.getOrDefault(false)
    val w = hasWidgets(app)
    runCatching { schedule(app, m, shown, w) }
    if (widgets && w) scope.launch {
      try { PrayerWidget.updateAll(app) } catch (e: Throwable) { /* يبقى آخر ما رُسم حتى الحدّ التالي */ } finally { done?.invoke() }
    } else done?.invoke()
  }

  private fun broadcast(ctx: Context, rc: Int, action: String, flags: Int = PendingIntent.FLAG_UPDATE_CURRENT): PendingIntent? =
    PendingIntent.getBroadcast(ctx, rc, Intent(ctx, LiveDayReceiver::class.java).setAction(action), flags or PendingIntent.FLAG_IMMUTABLE)

  private fun schedule(ctx: Context, m: Model?, shown: Boolean, widgets: Boolean) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val boundary = broadcast(ctx, RC_BOUNDARY, ACTION_BOUNDARY)!!; val tick = broadcast(ctx, RC_TICK, ACTION_TICK)!!
    val live = Store.liveUpdate
    if (m == null || (!live && !widgets)) {
      am.cancel(boundary); am.cancel(tick); cancelRepeat(ctx, am); return
    }
    // الحدّ التالي: أذان الصلاة القادمة، أو تبدّل طور السماء، أو منتصف الليل (تتجدّد مواقيت الشريط)، أو انتهاء إخفاء الإشعار
    val now = m.now
    val c = arrayListOf(m.nextTime, m.now.atZone(m.zone).toLocalDate().plusDays(1).atStartOfDay(m.zone).toInstant())
    SkyEngine.schedule(SkyInputs.of(m.tl, m.zone))?.map { it.second }?.firstOrNull { it.isAfter(now) }?.let { c.add(it) }
    if (Store.liveHiddenUntil > now.toEpochMilli()) c.add(Instant.ofEpochMilli(Store.liveHiddenUntil))
    val at = c.filter { it.isAfter(now) }.minOrNull() ?: now.plusSeconds(1800)
    // يوقظ الجهاز عند الحدّ متى كان الإشعار الحيّ مفعّلاً (يُرى على شاشة القفل)؛ أمّا الويدجت وحده فيكفيه أول استيقاظ
    setAlarm(ctx, am, if (live) AlarmManager.RTC_WAKEUP else AlarmManager.RTC, at.toEpochMilli() + 1000, boundary)
    // نبضة الدقيقة لعنوان الإشعار («بعد ٤٢ دقيقة») وشريحته ومؤشّر الشريط — عند تبدّل الدقيقة الباقية، ولا توقظ الجهاز
    if (shown) {
      val r = m.secondsLeft % 60
      val delay = (if (r < 5) r + 60 else r) + 1
      setAlarm(ctx, am, AlarmManager.RTC, System.currentTimeMillis() + delay * 1000, tick)
    } else am.cancel(tick)
    // شبكة أمان الويدجت: كل نصف ساعة غير دقيقة ولا توقظ الجهاز، ما دام في الشاشة ويدجت — تُضبط مرّة لا مع كل تجديد
    if (widgets) {
      if (broadcast(ctx, RC_REPEAT, ACTION_REPEAT, PendingIntent.FLAG_NO_CREATE) == null)
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + AlarmManager.INTERVAL_HALF_HOUR, AlarmManager.INTERVAL_HALF_HOUR, broadcast(ctx, RC_REPEAT, ACTION_REPEAT)!!)
    } else cancelRepeat(ctx, am)
  }
  private fun cancelRepeat(ctx: Context, am: AlarmManager) { broadcast(ctx, RC_REPEAT, ACTION_REPEAT, PendingIntent.FLAG_NO_CREATE)?.let { am.cancel(it); it.cancel() } }

  private fun setAlarm(ctx: Context, am: AlarmManager, type: Int, at: Long, pi: PendingIntent) {
    try {
      if (Notify.exactAllowed(ctx)) { if (type == AlarmManager.RTC_WAKEUP) am.setExactAndAllowWhileIdle(type, at, pi) else am.setExact(type, at, pi) }
      else { if (type == AlarmManager.RTC_WAKEUP) am.setAndAllowWhileIdle(type, at, pi) else am.set(type, at, pi) }
    } catch (e: SecurityException) { am.set(type, at, pi) }
  }

  // ---- الإشعار الحيّ
  /** يُنشر الإشعار أو يُزال؛ يعيد true إن كان ظاهراً (فتُضبط نبضة الدقيقة) */
  private fun updateLive(ctx: Context, m: Model?): Boolean {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val blocked = !NotificationManagerCompat.from(ctx).areNotificationsEnabled() ||
      nm.getNotificationChannel(SakinahApp.CH_LIVE)?.importance == NotificationManager.IMPORTANCE_NONE
    val hidden = System.currentTimeMillis() < Store.liveHiddenUntil
    if (!Store.liveUpdate || m == null || blocked || hidden) { nm.cancel(LIVE_ID); return false }
    val n = if (Build.VERSION.SDK_INT >= 36) buildPromoted(ctx, m) else buildCompat(ctx, m)
    return runCatching { nm.notify(LIVE_ID, n); true }.getOrDefault(false)
  }
  fun cancelLive(ctx: Context) { ctx.getSystemService(NotificationManager::class.java).cancel(LIVE_ID) }

  private fun title(m: Model) = "${m.nextName} ${afterLabel(m.secondsLeft)}"
  private fun prayedLabel(m: Model): String? = m.prayer?.let { if (m.prayed) "✓ صلّيتَ ${it.nameAr}" else "صلّيتُ ${it.nameAr}" }

  private fun openPI(ctx: Context) = PendingIntent.getActivity(ctx, RC_OPEN, openIntent(ctx, todayUri()), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun adhkarPI(ctx: Context, p: Period) = PendingIntent.getActivity(ctx, RC_ADHKAR, openIntent(ctx, adhkarUri(p)), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun prayedPI(ctx: Context, m: Model) = PendingIntent.getBroadcast(ctx, RC_PRAYED,
    Intent(ctx, LiveDayReceiver::class.java).setAction(ACTION_PRAYED).putExtra("day", m.prayerDay).putExtra("prayer", m.prayer?.id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  /** إزاحة الإشعار تُخفيه حتى أذان الصلاة القادمة، ثم يعود */
  private fun dismissPI(ctx: Context, m: Model) = PendingIntent.getBroadcast(ctx, RC_DISMISS,
    Intent(ctx, LiveDayReceiver::class.java).setAction(ACTION_DISMISS).putExtra("until", m.nextTime.toEpochMilli()), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  /** أندرويد ١٦ فما فوق: تحديثٌ حيّ مُرقّى (Live Update) بشريط تقدّمٍ مقسوم بألوان أطوار السماء ونقطةٍ عند الآن */
  private fun buildPromoted(ctx: Context, m: Model): Notification {
    val icon = Icon.createWithResource(ctx, R.drawable.ic_stat_sakinah)
    val b = Notification.Builder(ctx, SakinahApp.CH_LIVE)
      .setSmallIcon(R.drawable.ic_stat_sakinah).setColor(BRAND)
      .setContentTitle(title(m)).setContentText(placeLine(m)).setSubText("وقت ${m.currentName}")
      .setWhen(m.nextTime.toEpochMilli()).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true)
      .setShortCriticalText(chipLabel(m.secondsLeft))
      .setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_PROGRESS).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(openPI(ctx)).setDeleteIntent(dismissPI(ctx, m))
      // EXTRA_REQUEST_PROMOTED_ONGOING (لا ثابت له في android.jar للمستوى ٣٦ — القيمة نفسها التي يضعها NotificationCompat)
      .addExtras(Bundle().apply { putBoolean("android.requestPromotedOngoing", true) })
    dayBar(m)?.let { bar ->
      b.setStyle(Notification.ProgressStyle().setStyledByProgress(false)
        .setProgressSegments(bar.segments.map { (ph, len) -> Notification.ProgressStyle.Segment(len).setColor(segmentColor(ph)) })
        .setProgressPoints(bar.points.map { Notification.ProgressStyle.Point(it).setColor(0xFFFBF9F4.toInt()) })
        .setProgress(bar.progress)
        .setProgressTrackerIcon(Icon.createWithBitmap(tracker())))
    }
    m.period?.let { b.addAction(Notification.Action.Builder(icon, it.title, adhkarPI(ctx, it)).build()) }
    prayedLabel(m)?.let { b.addAction(Notification.Action.Builder(icon, it, prayedPI(ctx, m)).build()) }
    return b.build()
  }

  /** ما قبل أندرويد ١٦: الإشعار المستمرّ نفسه بعدّاده التنازلي وزرّيه، بلا شريط الأطوار */
  private fun buildCompat(ctx: Context, m: Model): Notification {
    val b = NotificationCompat.Builder(ctx, SakinahApp.CH_LIVE)
      .setSmallIcon(R.drawable.ic_stat_sakinah).setColor(BRAND)
      .setContentTitle(title(m)).setContentText(placeLine(m)).setSubText("وقت ${m.currentName}")
      .setWhen(m.nextTime.toEpochMilli()).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true)
      .setOngoing(true).setOnlyAlertOnce(true).setSilent(true).setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openPI(ctx)).setDeleteIntent(dismissPI(ctx, m))
    m.period?.let { b.addAction(R.drawable.ic_stat_sakinah, it.title, adhkarPI(ctx, it)) }
    prayedLabel(m)?.let { b.addAction(R.drawable.ic_stat_sakinah, it, prayedPI(ctx, m)) }
    return b.build()
  }

  /** شريط اليوم من فجره إلى فجر الغد بالدقائق: مقاطع أطوار السماء، ونقاط الظهر والعصر والمغرب والعشاء، وموضع الآن */
  private class DayBar(val segments: List<Pair<SkyPhase, Int>>, val points: List<Int>, val progress: Int)
  private fun dayBar(m: Model): DayBar? {
    val coords = Store.coords ?: return null; val zone = m.zone; val p = Store.params().copy(tz = zone.id)
    var d = CivilDate.of(m.now, zone); var t = PrayerTimes.compute(coords, d, p)
    if (t.fajr?.let { m.now.isBefore(it) } == true) { d = d.adding(-1); t = PrayerTimes.compute(coords, d, p) }
    val prev = PrayerTimes.compute(coords, d.adding(-1), p); val next = PrayerTimes.compute(coords, d.adding(1), p)
    val start = t.fajr ?: return null; val end = next.fajr ?: return null
    fun min(i: Instant) = ((i.epochSecond - start.epochSecond) / 60).toInt()
    val total = min(end); if (total <= 0) return null
    val sch = SkyEngine.schedule(SkyInputs(t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha, prev.isha, next.fajr, zone)) ?: return null
    val segs = ArrayList<Pair<SkyPhase, Int>>()
    for ((i, e) in sch.withIndex()) {
      val a = min(e.second).coerceIn(0, total); val b = (if (i + 1 < sch.size) min(sch[i + 1].second) else total).coerceIn(0, total)
      if (b > a) segs.add(e.first to (b - a))
    }
    if (segs.isEmpty()) return null
    val points = listOf(Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA).mapNotNull { k -> t[k]?.let { min(it) }?.takeIf { it in 1 until total } }
    return DayBar(segs, points, min(m.now).coerceIn(0, total))
  }
  /** لون المقطع: درجةٌ تمثّل الطور وتُقرأ على خلفية الإشعار (الأطوار الداكنة جداً تُفتَّح قليلاً) */
  private fun segmentColor(ph: SkyPhase): Int {
    val s = SkyPalette.of(ph).stops
    var c = if (ph == SkyPhase.ASR) s[3] else s[2]
    if (c.luminance < 0.04) c = s[3]
    if (c.luminance < 0.04) c = c.lighten(0.25)
    return argb(c)
  }
  fun argb(c: SkyRGB, alpha: Int = 0xFF): Int = (alpha shl 24) or c.hex.toInt()
  /** مقبض «الآن»: قرص ذهبي بحلقة ورقية وحدٍّ داكن */
  private fun tracker(): Bitmap {
    val s = 48; val bmp = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888); val c = Canvas(bmp); val p = Paint(Paint.ANTI_ALIAS_FLAG); val r = s / 2f
    p.color = 0xFF16211F.toInt(); c.drawCircle(r, r, r, p)
    p.color = 0xFFFBF9F4.toInt(); c.drawCircle(r, r, r - 3f, p)
    p.color = 0xFFE2C77A.toInt(); c.drawCircle(r, r, r - 9f, p)
    return bmp
  }
}

/** منبّهات «اليوم الحيّ» وزرّا الإشعار: الحدّ ونبضة الدقيقة وشبكة الأمان، و«صلّيتُ»، وإزاحة الإشعار */
class LiveDayReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    when (intent.action) {
      LiveDay.ACTION_PRAYED -> {
        val day = intent.getStringExtra("day"); val p = Prayer.of(intent.getStringExtra("prayer"))
        if (day != null && p != null) Store.markPrayed(day, p)
        LiveDay.refresh(ctx, widgets = false)
      }
      LiveDay.ACTION_DISMISS -> { Store.hideLiveUntil(intent.getLongExtra("until", 0L)); LiveDay.refresh(ctx, widgets = false) }
      LiveDay.ACTION_TICK -> LiveDay.refresh(ctx, widgets = false)
      else -> { val pending = goAsync(); LiveDay.refresh(ctx) { pending.finish() } }
    }
  }
}
