package org.emdatra.sakinah.app

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.LocalDate

/**
 * «ضمان الأذان»: فحوصٌ تجري على الجهاز وحده لما يمنع وصول الأذان في وقته على أندرويد —
 * الإذن، والمنبّهات الدقيقة، وتوفير البطارية، وعدم الإزعاج، وقناة الأذان — ثم تحقّقٌ من أن
 * الأذانات القادمة مجدولةٌ فعلاً عند النظام (PendingIntent موجود)، لا أنها «يُفترض» أنها مجدولة.
 */
object AdhanGuard {
  enum class Check { NOTIFICATIONS, EXACT, BATTERY, DND, SOUND }
  data class Status(val check: Check, val ok: Boolean, val title: String, val detail: String, val fix: Intent? = null, val advice: String? = null)
  data class Upcoming(val prayer: Prayer, val time: Instant, val scheduled: Boolean)

  private const val TEST_ID = 0x5A_4B_01
  private const val SP = "adhan-guard"

  fun checks(ctx: Context): List<Status> {
    val prefs = Store.reminders
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val out = ArrayList<Status>()

    // ١. الإشعارات: إذن التطبيق + تفعيلها في سكينة
    val allowed = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
    out += when {
      !allowed -> Status(Check.NOTIFICATIONS, false, "الإشعارات", "مرفوضة في إعدادات النظام", appNotificationSettings(ctx))
      !prefs.enabled -> Status(Check.NOTIFICATIONS, false, "الإشعارات", "إشعارات الصلاة مطفأة في سكينة")
      else -> Status(Check.NOTIFICATIONS, true, "الإشعارات", "مسموحة")
    }

    // ٢. المنبّهات الدقيقة: بدونها يُجدوَل المنبّه غير دقيق فقد يتأخر الأذان دقائق
    out += if (Notify.exactAllowed(ctx)) Status(Check.EXACT, true, "المنبّهات الدقيقة", "مسموحة، فيُضبط الأذان بالدقيقة")
    else Status(Check.EXACT, false, "المنبّهات الدقيقة", "غير مسموحة، فقد يتأخر الأذان دقائق", Notify.exactSettingsIntent(ctx))

    // ٣. توفير البطارية والتقييد في الخلفية
    val pm = ctx.getSystemService(PowerManager::class.java)
    val exempt = pm.isIgnoringBatteryOptimizations(ctx.packageName)
    val restricted = Build.VERSION.SDK_INT >= 28 && ctx.getSystemService(ActivityManager::class.java).isBackgroundRestricted
    out += when {
      restricted -> Status(Check.BATTERY, false, "توفير البطارية", "سكينة مقيَّدة في الخلفية", appDetails(ctx), manufacturerAdvice())
      !exempt && manufacturerAdvice() != null -> Status(Check.BATTERY, false, "توفير البطارية", "قد يوقف سكينة في الخلفية", Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), manufacturerAdvice())
      else -> Status(Check.BATTERY, true, "توفير البطارية", if (exempt) "سكينة مستثنى منه" else "لا يقيّد المنبّهات على هذا الجهاز")
    }

    // ٤. عدم الإزعاج وقناة الأذان نفسها
    val channelId = if (prefs.usesAdhanSound) SakinahApp.CH_ADHAN else SakinahApp.CH_CHIME
    val channel = if (Build.VERSION.SDK_INT >= 26) nm.getNotificationChannel(channelId) else null
    val channelBlocked = channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE
    val dndOn = nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL
    val bypass = channel?.canBypassDnd() == true
    out += when {
      channelBlocked -> Status(Check.DND, false, "قناة الأذان", "مطفأة في إعدادات الإشعارات", channelSettings(ctx, channelId))
      dndOn && !bypass -> Status(Check.DND, false, "عدم الإزعاج", "مفعّل الآن ويحجب الأذان", channelSettings(ctx, channelId), "افتح الإعداد ثم فعّل «تجاوز عدم الإزعاج» لقناة الأذان.")
      bypass -> Status(Check.DND, true, "عدم الإزعاج", "الأذان مستثنى منه")
      else -> Status(Check.DND, true, "عدم الإزعاج", "غير مفعّل الآن")
    }

    // ٥. الصوت: الأذان مضمَّن في التطبيق، فلا يحتاج شبكة
    out += Status(Check.SOUND, true, "صوت الأذان", when {
      prefs.sound == "none" -> "صامت: يصلك الإشعار بلا صوت"
      prefs.usesAdhanSound -> "أذانٌ مضمَّن في التطبيق، يعمل بلا شبكة"
      else -> "نغمة النظام"
    })
    return out
  }

  /** البنود التي تحتاج تدخّلاً — بعد إسقاط ما أجّله المستخدم بـ«ذكّرني لاحقاً» */
  fun issues(ctx: Context, includeSnoozed: Boolean = false): List<Status> =
    checks(ctx).filter { !it.ok && (includeSnoozed || !snoozed(ctx, it.check)) }

  /** الأذانات القادمة (لا التنبيهات قبلها ولا الشروق) مع تحقّقٍ من وجود منبّهها فعلاً عند النظام */
  fun upcoming(ctx: Context, count: Int = 4, now: Instant = Instant.now()): List<Upcoming> {
    val coords = Store.coords ?: return emptyList()
    return Reminders.upcoming(coords, Store.zone, Store.params(), Store.reminders, now, 24, format = { Fmt.time(it) })
      .filter { it.kind == ReminderKind.ADHAN && it.prayer != null }.take(count)
      .map { Upcoming(it.prayer!!, it.time, Notify.isScheduled(ctx, it.id.hashCode())) }
  }

  fun dayLabel(t: Instant): String {
    val d = t.atZone(Store.zone).toLocalDate(); val today = LocalDate.now(Store.zone)
    return when (d) { today -> "اليوم"; today.plusDays(1) -> "غداً"; else -> Hijri.weekdaysAr[d.dayOfWeek.value % 7] }
  }

  /** اختبارٌ بالطريق نفسه الذي يسلكه الأذان: منبّه نظامٍ بعد ١٠ ثوانٍ يعرض إشعار الأذان */
  fun test(ctx: Context) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val i = Intent(ctx, ReminderReceiver::class.java).setAction("org.emdatra.sakinah.REMINDER")
      .putExtra("id", TEST_ID).putExtra("kind", "adhan").putExtra("test", true)
      .putExtra("title", "اختبار الأذان").putExtra("body", "إن وصلك هذا في وقته فأذانك مضمون بإذن الله")
    val pi = PendingIntent.getBroadcast(ctx, TEST_ID, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val at = System.currentTimeMillis() + 10_000
    if (Notify.exactAllowed(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
  }

  // «ذكّرني لاحقاً»: يُخفي البند من الرئيسية ثلاثة أيام، ويبقى ظاهراً في شاشة الفحص
  fun snooze(ctx: Context, c: Check) { ctx.getSharedPreferences(SP, Context.MODE_PRIVATE).edit().putLong(c.name, System.currentTimeMillis() + 3 * 86_400_000L).apply() }
  fun snoozed(ctx: Context, c: Check): Boolean = ctx.getSharedPreferences(SP, Context.MODE_PRIVATE).getLong(c.name, 0) > System.currentTimeMillis()

  /** «الأذان وحده»: لا تذكيرات أخرى تزاحم نداء الصلاة (تذكير الختمة يُضبط من خطتها ولا يُمسّ هنا) */
  val adhanOnly: Boolean get() = !Store.extras.any
  fun setAdhanOnly(ctx: Context, only: Boolean) {
    Store.extras = if (only) Store.extras.copy(adhkarMorning = false, adhkarEvening = false, hadithDaily = false) else Store.extras.copy(adhkarMorning = true, adhkarEvening = true)
    Store.save(); Notify.schedule(ctx)
  }

  /** إرشاد الصانعين الذين يوقفون التطبيقات في الخلفية فوق ما يفعله أندرويد نفسه (dontkillmyapp.com) */
  fun manufacturerAdvice(): String? = when (Build.MANUFACTURER.lowercase()) {
    "samsung" -> "على سامسونج: الإعدادات ← البطارية ← حدود الاستخدام في الخلفية ← «تطبيقات لا تخلد أبداً» ← أضِف سكينة."
    "xiaomi", "redmi", "poco" -> "على شاومي: الإعدادات ← التطبيقات ← سكينة ← توفير البطارية ← «بلا قيود»، وفعّل «التشغيل التلقائي»."
    "huawei", "honor" -> "على هواوي: الإعدادات ← البطارية ← تشغيل التطبيقات ← سكينة ← «الإدارة يدوياً» وفعّل الخيارات الثلاثة."
    "oppo", "realme", "oneplus" -> "على أوبو وريلمي ووان بلس: الإعدادات ← البطارية ← سكينة ← «السماح بالنشاط في الخلفية»."
    "vivo", "iqoo" -> "على فيفو: الإعدادات ← البطارية ← استهلاك الطاقة في الخلفية ← سكينة ← «السماح»."
    else -> null
  }

  private fun appNotificationSettings(ctx: Context): Intent =
    if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName) else appDetails(ctx)
  private fun channelSettings(ctx: Context, id: String): Intent =
    if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName).putExtra(Settings.EXTRA_CHANNEL_ID, id) else appDetails(ctx)
  private fun appDetails(ctx: Context): Intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
}
