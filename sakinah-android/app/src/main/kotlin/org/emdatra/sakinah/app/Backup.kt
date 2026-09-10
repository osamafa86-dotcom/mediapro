package org.emdatra.sakinah.app

import org.emdatra.sakinah.core.*

/** تصدير/استيراد الحالة بصيغة نسخة الويب (WebBackup) */
object Backup {
  fun export(): WebBackup {
    val s = WebSettings(
      location = Store.coords?.let { WebSettings.Location(it.latitude, it.longitude, Store.zone.id, Store.locName, Store.locCountry, Store.locCityId, if (Store.locMode == "gps") "gps" else "city") },
      method = if (Store.methodAuto) "auto" else Store.methodId, madhab = Store.madhab, highLatitudeRule = Store.highLat, hijriOffset = Store.hijriOffset, hour12 = Store.hour12, numerals = Store.numerals,
      notifications = WebSettings.Notifications(Store.reminders.enabled, Prayer.entries.associate { it.id to (it.id in Store.reminders.prayers) }, Store.reminders.preMinutes, Store.reminders.sound, null,
        WebSettings.AdhkarPrefs(Store.extras.adhkarMorning, Store.extras.adhkarEvening, Store.extras.morningAfter, Store.extras.eveningAfter), WebSettings.HadithDaily(Store.extras.hadithDaily, Store.extras.hadithTime)),
      quran = WebSettings.Quran(lastRead = Store.lastRead?.let { WebSettings.LastRead(it.page, it.surah, it.ayah, it.at) }, bookmarks = Store.bookmarks, reciter = Store.reciter, repeatAyah = Store.repeatAyah, rate = Store.rate, follow = Store.follow,
        fontScale = Store.fontScale, theme = Store.theme, themeAuto = Store.themeAuto, keepAwake = Store.keepAwake, tajweed = Store.tajweed, textFont = Store.textFont, challenge = Store.challenge, view = Store.view, khatmah = Store.khatmah, readLog = Store.readLog),
      adhkarProgress = Store.adhkarProgress, favorites = Store.favorites, tasbih = Store.tasbih, hisnFavorites = Store.hisnFavorites, textScale = Store.textScale)
    return WebBackup.create(s)
  }
  fun apply(b: WebBackup) {
    val s = b.settings
    s.location?.let { l -> l.cityId?.let { id -> CityDatabase.bundled.city(id) }?.let { Store.useCity(it) } ?: run { val la = l.lat; val lo = l.lon; if (la != null && lo != null && l.source != "gps") CityDatabase.bundled.nearest(la, lo)?.let { Store.useCity(it.first) } } }
    s.method?.let { if (it == "auto") Store.methodAuto = true else { Store.methodAuto = false; Store.methodId = it } }
    s.madhab?.let { Store.madhab = it }; s.highLatitudeRule?.let { Store.highLat = it }; s.hijriOffset?.let { Store.hijriOffset = it }; s.hour12?.let { Store.hour12 = it }; s.numerals?.let { Store.numerals = it }
    s.notifications?.let { n -> var r = Store.reminders; n.enabled?.let { r = r.copy(enabled = it) }; n.prayers?.let { p -> r = r.copy(prayers = p.filter { it.value }.keys) }; n.preMinutes?.let { r = r.copy(preMinutes = it) }; n.sound?.let { r = r.copy(sound = it) }; Store.reminders = r
      var x = Store.extras; n.adhkar?.let { a -> x = x.copy(adhkarMorning = a.morning ?: x.adhkarMorning, adhkarEvening = a.evening ?: x.adhkarEvening, morningAfter = a.morningAfter ?: x.morningAfter, eveningAfter = a.eveningAfter ?: x.eveningAfter) }; n.hadithDaily?.let { h -> x = x.copy(hadithDaily = h.enabled ?: x.hadithDaily, hadithTime = h.time ?: x.hadithTime) }; Store.extras = x }
    s.quran?.let { q ->
      q.lastRead?.let { lr -> QuranText.shared.pageAyahs(lr.page).firstOrNull()?.let { a -> Store.lastRead = LastRead(lr.page, lr.surah ?: a.surah, lr.ayah ?: a.ayah, lr.at ?: System.currentTimeMillis().toDouble()) } }
      q.bookmarks?.let { Store.bookmarks = it }; q.reciter?.let { if (Catalog.shared.reciters.any { r -> r.id == it }) Store.reciter = it }; q.repeatAyah?.let { Store.repeatAyah = it }; q.rate?.let { Store.rate = it }; q.follow?.let { Store.follow = it }
      q.fontScale?.let { Store.fontScale = it }; Store.theme = Catalog.shared.migrateTheme(q.theme, q.night ?: false, q.paper); q.themeAuto?.let { Store.themeAuto = it }; q.keepAwake?.let { Store.keepAwake = it }; q.tajweed?.let { Store.tajweed = it }; q.textFont?.let { Store.textFont = it }; q.view?.let { Store.view = it }
      Store.challenge = q.challenge; Store.khatmah = q.khatmah; q.readLog?.let { Store.readLog = it }
    }
    s.adhkarProgress?.let { Store.adhkarProgress = it }; s.favorites?.let { Store.favorites = it }; s.tasbih?.let { Store.tasbih = it }; s.hisnFavorites?.let { Store.hisnFavorites = it }; s.textScale?.let { Store.textScale = it }
    Store.applyAutoMethod(); Store.save()
  }
}
