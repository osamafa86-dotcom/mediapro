package org.emdatra.sakinah.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.LocalTime
import java.time.ZonedDateTime

/** جدولة إشعارات الصلاة والأذكار وحديث اليوم بمنبّهات النظام (AlarmManager)؛ كل منبّه يعرض إشعاره ويعيد الجدولة */
object Notify {
  private const val MAX = 24
  private data class Item(val id: String, val time: Instant, val kind: ReminderKind, val title: String, val body: String)
  private var lastIds: List<Int> = emptyList()

  fun schedule(ctx: Context) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    for (id in lastIds) am.cancel(pending(ctx, id, null))
    val items = ArrayList<Item>()
    val coords = Store.coords; val zone = Store.zone; val params = Store.params(); val now = Instant.now()
    if (coords != null) {
      Reminders.upcoming(coords, zone, params, Store.reminders, now, MAX, format = { Fmt.time(it) }, number = { Fmt.number(it) }).forEach { items.add(Item(it.id, it.time, it.kind, it.title, it.body)) }
      Reminders.adhkar(coords, zone, params, Store.extras, now, 7).forEach { items.add(Item(it.id, it.time, it.kind, it.title, it.body)) }
    }
    for (d in Reminders.daily(Store.extras, Store.khatmah, number = { Fmt.number(it) })) {
      var t = ZonedDateTime.now(zone).with(LocalTime.of(d.hour, d.minute)); if (!t.toInstant().isAfter(now)) t = t.plusDays(1)
      for (i in 0 until 3) items.add(Item("${d.id}:${t.plusDays(i.toLong()).toLocalDate()}", t.plusDays(i.toLong()).toInstant(), d.kind, d.title, d.body))
    }
    val chosen = items.filter { it.time.isAfter(now) }.sortedBy { it.time }.take(MAX)
    val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
    val ids = ArrayList<Int>()
    for (it in chosen) {
      val id = it.id.hashCode(); ids.add(id)
      val pi = pending(ctx, id, it)
      val at = it.time.toEpochMilli()
      if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
    lastIds = ids
  }
  private fun pending(ctx: Context, id: Int, it: Item?): PendingIntent {
    val i = Intent(ctx, ReminderReceiver::class.java).setAction("org.emdatra.sakinah.REMINDER").putExtra("id", id)
    if (it != null) i.putExtra("kind", it.kind.id).putExtra("title", it.title).putExtra("body", it.body)
    return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  fun show(ctx: Context, kind: String, title: String, body: String, id: Int) {
    val prefs = Store.reminders
    if (kind == "adhan" && prefs.sound == "none") { /* صامت */ }
    val channel = when { kind == "adhan" && prefs.usesAdhanSound -> SakinahApp.CH_ADHAN; kind == "adhan" || kind == "pre" || kind == "sunrise" -> SakinahApp.CH_CHIME; else -> SakinahApp.CH_OTHER }
    val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val n = NotificationCompat.Builder(ctx, channel).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(title).setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(Notification.CATEGORY_REMINDER).setAutoCancel(true).setContentIntent(open).build()
    runCatching { ctx.getSystemService(NotificationManager::class.java).notify(id, n) }
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val kind = intent.getStringExtra("kind") ?: return
    val enabledPrayers = Store.reminders.enabled
    if ((kind == "adhan" || kind == "pre" || kind == "sunrise") && !enabledPrayers) return
    Notify.show(ctx, kind, intent.getStringExtra("title") ?: "سكينة", intent.getStringExtra("body") ?: "", intent.getIntExtra("id", 1))
    Notify.schedule(ctx)
  }
}
class BootReceiver : BroadcastReceiver() { override fun onReceive(ctx: Context, intent: Intent) { Notify.schedule(ctx) } }
