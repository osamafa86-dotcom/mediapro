package org.emdatra.sakinah.app

import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.emdatra.sakinah.core.Qibla
import org.emdatra.sakinah.core.Res
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** مسجد قريب مع بعده واتجاهه من موقع المستخدم */
@Serializable data class Mosque(val id: String, val name: String, val latitude: Double, val longitude: Double, val address: String? = null, val distanceKm: Double = 0.0, val bearing: Double = 0.0)

/**
 * المساجد القريبة من OpenStreetMap عبر Overpass — بلا مفتاح ولا خادم لنا.
 * ⚠️ الخادم العام بطيء ويسقط أحيانًا (قِيس: ١٢ ث لاستعلام ٢٫٥ كم حول عمّان، و504 مرّةً من ثلاث):
 * المهلة طويلة، ونتائج الخلية (~١ كم) تُخزَّن يومًا، والبديل الدائم فتح تطبيق الخرائط بالبحث.
 * المركز المرسل مقرّب إلى ~١ كم كي يبقى ما يغادر الجهاز «موقعًا تقريبيًّا»، والمسافات تُحسب هنا من الموقع الدقيق.
 */
object MosqueFinder {
  private const val ENDPOINT = "https://overpass-api.de/api/interpreter"
  private const val UA = "Sakinah/5.1 (+https://github.com/osamafa86-dotcom/mediapro)"
  @Serializable private data class Cache(val key: String, val at: Long, val items: List<Mosque>)

  fun cellKey(lat: Double, lon: Double): String = String.format(java.util.Locale.US, "%.2f,%.2f", lat, lon)

  fun cached(lat: Double, lon: Double): List<Mosque>? {
    val c = Store.mosquesCache?.let { runCatching { Res.json.decodeFromString(Cache.serializer(), it) }.getOrNull() } ?: return null
    if (c.key != cellKey(lat, lon) || System.currentTimeMillis() - c.at > 86_400_000L) return null
    return c.items.map { rerank(it, lat, lon) }.sortedBy { it.distanceKm }
  }

  suspend fun nearby(lat: Double, lon: Double, query: String? = null): Result<List<Mosque>> = withContext(Dispatchers.IO) {
    runCatching {
      val rl = Math.round(lat * 100) / 100.0; val ro = Math.round(lon * 100) / 100.0
      val q = query?.trim().orEmpty().replace("\"", "").replace("\\", "")
      val radius = if (q.isEmpty()) 4000 else 15000
      val nameFilter = if (q.isEmpty()) "" else "[\"name\"~\"$q\",i]"
      val ql = "[out:json][timeout:20];nwr[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$nameFilter(around:$radius,$rl,$ro);out center tags 60;"
      val c = URL(ENDPOINT).openConnection() as HttpURLConnection
      c.requestMethod = "POST"; c.connectTimeout = 15_000; c.readTimeout = 25_000; c.doOutput = true
      c.setRequestProperty("User-Agent", UA); c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
      c.outputStream.use { it.write(("data=" + URLEncoder.encode(ql, "UTF-8")).toByteArray()) }
      if (c.responseCode !in 200..299) error("HTTP ${c.responseCode}")
      val body = c.inputStream.bufferedReader().readText()
      val els = Res.json.parseToJsonElement(body).jsonObject["elements"]?.jsonArray ?: JsonArray(emptyList())
      val items = els.mapNotNull { e ->
        val o = e.jsonObject; val tags = o["tags"]?.jsonObject ?: JsonObject(emptyMap())
        val center = o["center"]?.jsonObject
        val la = (center?.get("lat") ?: o["lat"])?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
        val lo = (center?.get("lon") ?: o["lon"])?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
        val name = tags["name:ar"]?.jsonPrimitive?.contentOrNull ?: tags["name"]?.jsonPrimitive?.contentOrNull ?: "مسجد (بلا اسم)"
        val addr = listOfNotNull(tags["addr:street"]?.jsonPrimitive?.contentOrNull, tags["addr:city"]?.jsonPrimitive?.contentOrNull).joinToString("، ").ifBlank { null }
        rerank(Mosque("${o["type"]?.jsonPrimitive?.contentOrNull}/${o["id"]?.jsonPrimitive?.contentOrNull}", name, la, lo, addr), lat, lon)
      }.sortedBy { it.distanceKm }.take(40)
      if (q.isEmpty()) { Store.mosquesCache = Res.json.encodeToString(Cache.serializer(), Cache(cellKey(lat, lon), System.currentTimeMillis(), items)); Store.save() }
      items
    }
  }

  private fun rerank(m: Mosque, lat: Double, lon: Double) = m.copy(
    distanceKm = Qibla.distanceSphericalKm(lat, lon, m.latitude, m.longitude),
    bearing = Qibla.vincentyInverse(lat, lon, m.latitude, m.longitude).initialBearing)

  /** الاتجاهات في تطبيق الخرائط المثبّت (Google Maps أو غيره) */
  fun directionsIntent(m: Mosque) = Intent(Intent.ACTION_VIEW, Uri.parse("geo:${m.latitude},${m.longitude}?q=${m.latitude},${m.longitude}(${Uri.encode(m.name)})"))
  /** بحث «مسجد» حول المستخدم في تطبيق الخرائط — يعمل بلا خادمنا ولا OpenStreetMap */
  fun searchIntent() = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode("مسجد")))

  fun distanceLabel(km: Double) = if (km < 1) "${Fmt.number(Math.round(km * 100).toInt() * 10)} م" else "${Fmt.decimal(km, 1)} كم"
  fun walkLabel(km: Double) = "${Fmt.number(maxOf(1, Math.round(km / 5 * 60).toInt()))} د سيرًا"
}
