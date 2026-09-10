package org.emdatra.sakinah.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.time.Instant

/** النسخة الاحتياطية بصيغة نسخة الويب نفسها ({ app, schema, exportedAt, settings }) — كل الحقول اختيارية */
@Serializable data class WebBackup(val app: String = "sakinah", val schema: Int = 1, val exportedAt: String? = null, val settings: WebSettings) {
  companion object {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true; explicitNulls = false; encodeDefaults = true; prettyPrint = true }
    fun parse(text: String): WebBackup {
      val el = json.parseToJsonElement(text).jsonObject
      if (el["app"]?.jsonPrimitive?.contentOrNull == "sakinah" && el["settings"] is JsonObject) return json.decodeFromJsonElement(serializer(), el)
      if (el.containsKey("location") || el.containsKey("quran") || el.containsKey("method")) return WebBackup(settings = json.decodeFromJsonElement(WebSettings.serializer(), el))
      throw IllegalArgumentException("not-sakinah")
    }
    fun create(settings: WebSettings, at: Instant = Instant.now()) = WebBackup(exportedAt = at.toString(), settings = settings)
  }
  fun encoded(): String = json.encodeToString(serializer(), this)
}
@Serializable data class WebSettings(
  val location: Location? = null, val method: String? = null, val madhab: String? = null, val highLatitudeRule: String? = null, val hijriOffset: Int? = null, val hour12: Boolean? = null, val numerals: String? = null, val theme: String? = null,
  val notifications: Notifications? = null, val quran: Quran? = null, val adhkarProgress: AdhkarProgress? = null, val favorites: List<String>? = null, val tasbih: TasbihState? = null, val hisnFavorites: List<Int>? = null, val shareTheme: String? = null, val textScale: Double? = null) {
  @Serializable data class Location(val lat: Double? = null, val lon: Double? = null, val tz: String? = null, val name: String? = null, val countryCode: String? = null, val cityId: String? = null, val source: String? = null)
  @Serializable data class AdhkarPrefs(val morning: Boolean? = null, val evening: Boolean? = null, val morningAfter: Int? = null, val eveningAfter: Int? = null)
  @Serializable data class HadithDaily(val enabled: Boolean? = null, val time: String? = null)
  @Serializable data class Notifications(val enabled: Boolean? = null, val prayers: Map<String, Boolean>? = null, val preMinutes: Int? = null, val sound: String? = null, val vibrate: Boolean? = null, val adhkar: AdhkarPrefs? = null, val hadithDaily: HadithDaily? = null)
  @Serializable data class LastRead(val page: Int, val surah: Int? = null, val ayah: Int? = null, val at: Double? = null)
  @Serializable data class Bookmark(val surah: Int, val ayah: Int, val page: Int? = null, val at: Double? = null, val note: String? = null, val color: String? = null)
  @Serializable data class Quran(val lastRead: LastRead? = null, val bookmarks: List<Bookmark>? = null, val reciter: String? = null, val repeatAyah: Int? = null, val repeatRange: Boolean? = null, val rate: Double? = null, val follow: Boolean? = null,
    val fontScale: Double? = null, val hifzOnlyCurrent: Boolean? = null, val theme: String? = null, val themeLight: String? = null, val themeDark: String? = null, val themeAuto: Boolean? = null, val night: Boolean? = null, val paper: String? = null,
    val dim: Double? = null, val keepAwake: Boolean? = null, val lineHeight: Double? = null, val tajweed: Boolean? = null, val scroll: String? = null, val textFont: String? = null, val fitText: Boolean? = null,
    val challenge: ActiveChallenge? = null, val tafsir: String? = null, val view: String? = null, val wordHighlight: Boolean? = null, val khatmah: KhatmahPlan? = null, val readLog: Map<String, List<Int>>? = null)
  @Serializable data class AdhkarProgress(val date: String? = null, val morning: Map<String, Int>? = null, val evening: Map<String, Int>? = null, val eveningDate: String? = null)
}
