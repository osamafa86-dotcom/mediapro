package org.emdatra.sakinah.app

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.ZoneId

@Serializable data class LastRead(val page: Int, val surah: Int, val ayah: Int, val at: Double)

/** الحالة المحفوظة (SharedPreferences) كحالة Compose قابلة للمراقبة — المفاتيح بمعاني نسخة الويب */
object Store {
  private lateinit var sp: SharedPreferences
  private val json = Res.json
  fun init(ctx: Context) { sp = ctx.getSharedPreferences("sakinah", Context.MODE_PRIVATE); load() }

  var methodId by mutableStateOf("MuslimWorldLeague"); var methodAuto by mutableStateOf(true)
  var madhab by mutableStateOf("shafi"); var highLat by mutableStateOf("auto")
  var hour12 by mutableStateOf(true); var numerals by mutableStateOf("latn"); var hijriOffset by mutableStateOf(0)
  var locLat by mutableStateOf(Double.NaN); var locLon by mutableStateOf(Double.NaN); var locTz by mutableStateOf<String?>(null); var locName by mutableStateOf<String?>(null); var locCountry by mutableStateOf<String?>(null); var locCityId by mutableStateOf<String?>(null); var locMode by mutableStateOf("gps")
  var reminders by mutableStateOf(ReminderPrefs()); var extras by mutableStateOf(ExtraReminderPrefs())
  var lastRead by mutableStateOf<LastRead?>(null)
  var seenIntro by mutableStateOf(false)
  var bookmarks by mutableStateOf<List<WebSettings.Bookmark>>(emptyList())
  var reciter by mutableStateOf(Catalog.shared.defaultReciter); var repeatAyah by mutableStateOf(1); var rate by mutableStateOf(1.0); var follow by mutableStateOf(true); var wordHighlight by mutableStateOf(true); var repeatRange by mutableStateOf(false); var hifzOnlyCurrent by mutableStateOf(true); var shareTheme by mutableStateOf("green")
  var theme by mutableStateOf("cream"); var themeAuto by mutableStateOf(false); var keepAwake by mutableStateOf(true); var view by mutableStateOf("pages"); var tajweed by mutableStateOf(false); var fontScale by mutableStateOf(1.0); var textFont by mutableStateOf("amiri")
  var khatmah by mutableStateOf<KhatmahPlan?>(null); var readLog by mutableStateOf<Map<String, List<Int>>>(emptyMap()); var challenge by mutableStateOf<ActiveChallenge?>(null)
  var adhkarProgress by mutableStateOf(WebSettings.AdhkarProgress()); var favorites by mutableStateOf<List<String>>(emptyList()); var tasbih by mutableStateOf(TasbihState()); var hisnFavorites by mutableStateOf<List<Int>>(emptyList()); var textScale by mutableStateOf(1.0)
  var adhkarLog by mutableStateOf<AdhkarLog>(emptyMap()); var haptics by mutableStateOf(true); var tasbihSound by mutableStateOf(false)

  private fun <T> get(key: String, ser: KSerializer<T>): T? = sp.getString(key, null)?.let { runCatching { json.decodeFromString(ser, it) }.getOrNull() }
  private fun <T> put(key: String, ser: KSerializer<T>, v: T?) { sp.edit().apply { if (v == null) remove(key) else putString(key, json.encodeToString(ser, v)) }.apply() }
  private fun load() {
    methodId = sp.getString("prayer.method", methodId)!!; methodAuto = sp.getBoolean("prayer.methodAuto", true); madhab = sp.getString("prayer.madhab", "shafi")!!; highLat = sp.getString("prayer.highLat", "auto")!!
    hour12 = sp.getBoolean("ui.hour12", true); seenIntro = sp.getBoolean("seenIntro", false); numerals = sp.getString("ui.numerals", "latn")!!; hijriOffset = sp.getInt("hijri.offset", 0)
    locLat = sp.getFloat("loc.lat", Float.NaN).toDouble(); locLon = sp.getFloat("loc.lon", Float.NaN).toDouble(); locTz = sp.getString("loc.tz", null); locName = sp.getString("loc.name", null); locCountry = sp.getString("loc.cc", null); locCityId = sp.getString("loc.city", null); locMode = sp.getString("loc.mode", "gps")!!
    reminders = get("notifications.prefs", ReminderPrefs.serializer()) ?: ReminderPrefs(); extras = get("notifications.extras", ExtraReminderPrefs.serializer()) ?: ExtraReminderPrefs()
    lastRead = get("quran.lastRead", LastRead.serializer()); bookmarks = get("quran.bookmarks", ListSerializer(WebSettings.Bookmark.serializer())) ?: emptyList()
    reciter = sp.getString("quran.reciter", reciter)!!; repeatAyah = sp.getInt("quran.repeatAyah", 1); rate = sp.getFloat("quran.rate", 1f).toDouble(); follow = sp.getBoolean("quran.follow", true); wordHighlight = sp.getBoolean("quran.wordHighlight", true); repeatRange = sp.getBoolean("quran.repeatRange", false); hifzOnlyCurrent = sp.getBoolean("quran.hifzOnlyCurrent", true); shareTheme = sp.getString("shareTheme", "green")!!
    theme = sp.getString("quran.theme", "cream")!!; themeAuto = sp.getBoolean("quran.themeAuto", false); keepAwake = sp.getBoolean("quran.keepAwake", true); view = sp.getString("quran.view", "pages")!!; tajweed = sp.getBoolean("quran.tajweed", false); fontScale = sp.getFloat("quran.fontScale", 1f).toDouble(); textFont = sp.getString("quran.textFont", "amiri")!!
    khatmah = get("quran.khatmah", KhatmahPlan.serializer()); readLog = get("quran.readLog", MapSerializer(String.serializer(), ListSerializer(Int.serializer()))) ?: emptyMap(); challenge = get("quran.challenge", ActiveChallenge.serializer())
    adhkarProgress = get("adhkarProgress", WebSettings.AdhkarProgress.serializer()) ?: WebSettings.AdhkarProgress(); favorites = get("favorites", ListSerializer(String.serializer())) ?: emptyList(); tasbih = get("tasbih", TasbihState.serializer()) ?: TasbihState(); hisnFavorites = get("hisnFavorites", ListSerializer(Int.serializer())) ?: emptyList(); textScale = sp.getFloat("textScale", 1f).toDouble()
    adhkarLog = get("adhkarLog", MapSerializer(String.serializer(), ListSerializer(String.serializer()))) ?: emptyMap(); haptics = sp.getBoolean("ui.haptics", true); tasbihSound = sp.getBoolean("ui.tasbihSound", false)
  }
  /** حفظ كل الحالة (تُستدعى بعد أي تغيير) */
  fun save() {
    sp.edit().putString("prayer.method", methodId).putBoolean("prayer.methodAuto", methodAuto).putString("prayer.madhab", madhab).putString("prayer.highLat", highLat)
      .putBoolean("ui.hour12", hour12).putBoolean("seenIntro", seenIntro).putString("ui.numerals", numerals).putInt("hijri.offset", hijriOffset)
      .putFloat("loc.lat", locLat.toFloat()).putFloat("loc.lon", locLon.toFloat()).putString("loc.tz", locTz).putString("loc.name", locName).putString("loc.cc", locCountry).putString("loc.city", locCityId).putString("loc.mode", locMode)
      .putString("quran.reciter", reciter).putInt("quran.repeatAyah", repeatAyah).putFloat("quran.rate", rate.toFloat()).putBoolean("quran.follow", follow).putBoolean("quran.wordHighlight", wordHighlight).putBoolean("quran.repeatRange", repeatRange).putBoolean("quran.hifzOnlyCurrent", hifzOnlyCurrent).putString("shareTheme", shareTheme)
      .putString("quran.theme", theme).putBoolean("quran.themeAuto", themeAuto).putBoolean("quran.keepAwake", keepAwake).putString("quran.view", view).putBoolean("quran.tajweed", tajweed).putFloat("quran.fontScale", fontScale.toFloat()).putString("quran.textFont", textFont).putFloat("textScale", textScale.toFloat()).putBoolean("ui.haptics", haptics).putBoolean("ui.tasbihSound", tasbihSound).apply()
    put("notifications.prefs", ReminderPrefs.serializer(), reminders); put("notifications.extras", ExtraReminderPrefs.serializer(), extras)
    put("quran.lastRead", LastRead.serializer(), lastRead); put("quran.bookmarks", ListSerializer(WebSettings.Bookmark.serializer()), bookmarks)
    put("quran.khatmah", KhatmahPlan.serializer(), khatmah); put("quran.readLog", MapSerializer(String.serializer(), ListSerializer(Int.serializer())), readLog); put("quran.challenge", ActiveChallenge.serializer(), challenge)
    put("adhkarProgress", WebSettings.AdhkarProgress.serializer(), adhkarProgress); put("favorites", ListSerializer(String.serializer()), favorites); put("tasbih", TasbihState.serializer(), tasbih); put("hisnFavorites", ListSerializer(Int.serializer()), hisnFavorites); put("adhkarLog", MapSerializer(String.serializer(), ListSerializer(String.serializer())), adhkarLog)
  }

  // ---- مشتقات ----
  val coords: Coordinates? get() = if (locLat.isNaN() || locLon.isNaN()) null else Coordinates(locLat, locLon)
  val zone: ZoneId get() = locTz?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
  val todayKey: String get() = DayKey.key(Instant.now(), zone)
  fun params(): PrayerParams = PrayerParams(method = methodId, madhab = Madhab.of(madhab), highLatitudeRule = HighLatitudeRule.of(highLat), isRamadan = Hijri.isRamadan(Instant.now(), zone, hijriOffset), tz = zone.id)
  fun timeline(now: Instant = Instant.now()) = coords?.let { PrayerTimes.dayTimeline(it, zone, params(), now) }
  fun useCity(c: City) { locMode = "manual"; locLat = c.lat; locLon = c.lon; locTz = c.tz; locName = c.nameAr; locCountry = c.countryCode; locCityId = c.id; applyAutoMethod(); save() }
  fun applyAutoMethod() { if (methodAuto) methodId = Methods.defaultMethod(locCountry, zone.id) }
  fun isBookmarked(a: Ayah) = bookmarks.any { it.surah == a.surah && it.ayah == a.ayah }
  fun toggleBookmark(a: Ayah, note: String? = null, color: String = "gold") { bookmarks = if (isBookmarked(a)) bookmarks.filter { !(it.surah == a.surah && it.ayah == a.ayah) } else bookmarks + WebSettings.Bookmark(a.surah, a.ayah, a.page, System.currentTimeMillis().toDouble(), note, color); save() }
  fun remember(a: Ayah) { lastRead = LastRead(a.page, a.surah, a.ayah, System.currentTimeMillis().toDouble()); save() }
  fun effectiveTheme(systemDark: Boolean): MushafTheme = Catalog.shared.theme(if (themeAuto) (if (systemDark) "dark" else theme.takeIf { !Catalog.shared.theme(it).isDark } ?: "cream") else theme)
}

/** تنسيقات عربية للأرقام والأوقات */
object Fmt {
  private val arabic = "٠١٢٣٤٥٦٧٨٩"
  fun number(n: Int, numerals: String = Store.numerals): String = if (numerals == "arab") n.toString().map { if (it.isDigit()) arabic[it - '0'] else it }.joinToString("") else n.toString()
  fun decimal(v: Double, digits: Int, numerals: String = Store.numerals): String { val s = String.format(java.util.Locale.US, "%.${digits}f", v).trimEnd('0').trimEnd('.'); return if (numerals == "arab") s.map { if (it.isDigit()) arabic[it - '0'] else it }.joinToString("") else s }
  fun time(i: Instant?, zone: ZoneId = Store.zone, hour12: Boolean = Store.hour12, numerals: String = Store.numerals): String {
    if (i == null) return "—"
    val t = i.atZone(zone); val h = t.hour; val m = t.minute
    val s = if (hour12) { val hh = if (h % 12 == 0) 12 else h % 12; "$hh:${"%02d".format(m)} ${if (h < 12) "ص" else "م"}" } else "%02d:%02d".format(h, m)
    return if (numerals == "arab") s.map { if (it.isDigit()) arabic[it - '0'] else it }.joinToString("") else s
  }
  fun countdown(seconds: Long, numerals: String = Store.numerals): String { val s = maxOf(0, seconds); val h = s / 3600; val m = (s % 3600) / 60; val sec = s % 60; val two = { v: Long -> if (v < 10) "0$v" else "$v" }; val t = if (h > 0) "$h:${two(m)}:${two(sec)}" else "${two(m)}:${two(sec)}"; return if (numerals == "arab") t.map { if (it.isDigit()) arabic[it - '0'] else it }.joinToString("") else t }
  fun gregorian(i: Instant, zone: ZoneId = Store.zone): String { val d = i.atZone(zone); val months = listOf("يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"); val wd = Hijri.weekdaysAr[d.dayOfWeek.value % 7]; return "$wd، ${number(d.dayOfMonth)} ${months[d.monthValue - 1]} ${number(d.year)}" }
}
