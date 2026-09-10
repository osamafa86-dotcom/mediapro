package org.emdatra.sakinah.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri

class SakinahApp : Application() {
  override fun onCreate() {
    super.onCreate()
    val nm = getSystemService(NotificationManager::class.java)
    val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
    val adhan = NotificationChannel(CH_ADHAN, "الأذان", NotificationManager.IMPORTANCE_HIGH).apply { description = "مواعيد الصلاة بصوت الأذان"; setSound(Uri.parse("android.resource://$packageName/raw/adhan_short"), attrs); enableVibration(true) }
    val chime = NotificationChannel(CH_CHIME, "تذكيرات الصلاة", NotificationManager.IMPORTANCE_HIGH).apply { description = "مواعيد الصلاة بنغمة النظام" }
    val other = NotificationChannel(CH_OTHER, "الأذكار وحديث اليوم والختمة", NotificationManager.IMPORTANCE_DEFAULT)
    nm.createNotificationChannels(listOf(adhan, chime, other))
    Store.init(this)
  }
  companion object { const val CH_ADHAN = "adhan"; const val CH_CHIME = "chime"; const val CH_OTHER = "other" }
}
