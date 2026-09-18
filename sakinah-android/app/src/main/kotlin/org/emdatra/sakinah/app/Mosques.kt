package org.emdatra.sakinah.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
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
  /**
   * طلبات «محوّطة» على عدّة خوادم: العام فورًا، ومرآة OSM France بعد ٤ ث (قِيست ١٫٥ ث حيث سقط العام)،
   * وmail.ru بعد ٩ ث — أوّل نجاح يفوز وتُلغى البقية.
   */
  private val ENDPOINTS = listOf("https://overpass-api.de/api/interpreter" to 0L, "https://overpass.openstreetmap.fr/api/interpreter" to 4000L, "https://maps.mail.ru/osm/tools/overpass/api/interpreter" to 9000L)
  private val net = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private const val UA = "Sakinah/5.1 (+https://github.com/osamafa86-dotcom/mediapro)"
  @Serializable private data class Cache(val key: String, val at: Long, val items: List<Mosque>)

  /** v2: نسخة الاستعلام القديمة قد تُسقط الأقرب (حدّ إخراج اعتباطي) فلا يُعاد استخدام مخزونها */
  fun cellKey(lat: Double, lon: Double): String = String.format(java.util.Locale.US, "v2:%.2f,%.2f", lat, lon)

  fun cached(lat: Double, lon: Double): List<Mosque>? {
    val c = Store.mosquesCache?.let { runCatching { Res.json.decodeFromString(Cache.serializer(), it) }.getOrNull() } ?: return null
    if (c.key != cellKey(lat, lon) || System.currentTimeMillis() - c.at > 86_400_000L) return null
    return c.items.map { rerank(it, lat, lon) }.sortedBy { it.distanceKm }
  }

  suspend fun nearby(lat: Double, lon: Double, query: String? = null): Result<List<Mosque>> = withContext(Dispatchers.IO) {
    runCatching {
      val q = query?.trim().orEmpty().replace("\"", "").replace("\\", "")
      // ⚠️ `around` لا يرتّب بالقرب وحدّ الإخراج يقطع اعتباطًا (قِيس في إسطنبول: «السلطان أحمد» أقرب مسجد) —
      // فطلب واحد بثلاث دوائر: ١٫٢ كم بلا حدٍّ عمليًّا (المركز مقرّب ~٠٫٧ كم فلا بدّ أن تغطّي الموقع الحقيقي)، ثم ٣ و١٠ كم للمناطق القليلة.
      var out = if (q.isEmpty()) hedged(lat, lon, listOf(1200 to 200, 3000 to 120), "") else hedged(lat, lon, listOf(15000 to 80), q)
      if (q.isEmpty() && out.size < 5) runCatching { hedged(lat, lon, listOf(10000 to 80), "") }.getOrNull()?.let { far -> val ids = out.map { it.id }.toHashSet(); out = out + far.filter { it.id !in ids } }
      if (q.isEmpty()) { Store.mosquesCache = Res.json.encodeToString(Cache.serializer(), Cache(cellKey(lat, lon), System.currentTimeMillis(), out)); Store.save() }
      out
    }
  }

  /** أوّل خادم ينجح يفوز؛ الخاسرون يُلغَون (والاتصال المعلّق يُقطع)؛ الفشل الكامل يرمي آخر خطأ */
  private suspend fun hedged(lat: Double, lon: Double, tiers: List<Pair<Int, Int>>, q: String): List<Mosque> {
    val winner = CompletableDeferred<List<Mosque>>()
    val failures = java.util.concurrent.atomic.AtomicInteger(0)
    var last: Throwable? = null
    val jobs = ENDPOINTS.map { (ep, wait) ->
      net.launch {
        try { if (wait > 0) delay(wait); winner.complete(fetch(ep, lat, lon, tiers, q)) }
        catch (e: CancellationException) { throw e }
        catch (e: Throwable) { last = e; if (failures.incrementAndGet() == ENDPOINTS.size) winner.completeExceptionally(e) }
      }
    }
    try { return winner.await() } finally { jobs.forEach { it.cancel() } }
  }

  private suspend fun fetch(endpoint: String, lat: Double, lon: Double, tiers: List<Pair<Int, Int>>, q: String): List<Mosque> {
    val rl = Math.round(lat * 100) / 100.0; val ro = Math.round(lon * 100) / 100.0
    val nameFilter = if (q.isEmpty()) "" else "[\"name\"~\"$q\",i]"
    // nw لا nwr: العلاقات نادرة للمساجد وحساب مراكزها أثقل
    val ql = "[out:json][timeout:15];" + tiers.joinToString("") { (radius, limit) -> "nw[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]$nameFilter(around:$radius,$rl,$ro);out center tags $limit;" }
    val c = URL(endpoint).openConnection() as HttpURLConnection
    currentCoroutineContext()[Job]?.invokeOnCompletion { if (it is CancellationException) runCatching { c.disconnect() } }
    c.requestMethod = "POST"; c.connectTimeout = 10_000; c.readTimeout = 18_000; c.doOutput = true
    c.setRequestProperty("User-Agent", UA); c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
    c.outputStream.use { it.write(("data=" + URLEncoder.encode(ql, "UTF-8")).toByteArray()) }
    if (c.responseCode !in 200..299) error("HTTP ${c.responseCode}")
    val body = c.inputStream.bufferedReader().readText()
    val els = Res.json.parseToJsonElement(body).jsonObject["elements"]?.jsonArray ?: JsonArray(emptyList())
    val seen = HashSet<String>()
    return els.mapNotNull { e ->
      val o = e.jsonObject; val tags = o["tags"]?.jsonObject ?: JsonObject(emptyMap())
      val id = "${o["type"]?.jsonPrimitive?.contentOrNull}/${o["id"]?.jsonPrimitive?.contentOrNull}"
      if (!seen.add(id)) return@mapNotNull null
      val center = o["center"]?.jsonObject
      val la = (center?.get("lat") ?: o["lat"])?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
      val lo = (center?.get("lon") ?: o["lon"])?.jsonPrimitive?.doubleOrNull ?: return@mapNotNull null
      val name = tags["name:ar"]?.jsonPrimitive?.contentOrNull ?: tags["name"]?.jsonPrimitive?.contentOrNull ?: "مسجد (بلا اسم)"
      val addr = listOfNotNull(tags["addr:street"]?.jsonPrimitive?.contentOrNull, tags["addr:city"]?.jsonPrimitive?.contentOrNull).joinToString("، ").ifBlank { null }
      rerank(Mosque(id, name, la, lo, addr), lat, lon)
    }.sortedBy { it.distanceKm }.take(60)
  }

  private fun rerank(m: Mosque, lat: Double, lon: Double) = m.copy(
    distanceKm = Qibla.distanceSphericalKm(lat, lon, m.latitude, m.longitude),
    bearing = Qibla.vincentyInverse(lat, lon, m.latitude, m.longitude).initialBearing)

  /** الاتجاهات سيرًا: خرائط غوغل إن كانت مثبّتة (طلب المالك)، وإلا أيّ تطبيق خرائط، وإلا المتصفّح */
  fun openDirections(ctx: Context, m: Mosque) {
    val dest = String.format(java.util.Locale.US, "%.6f,%.6f", m.latitude, m.longitude)
    val web = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$dest&travelmode=walking")
    val candidates = listOf(
      Intent(Intent.ACTION_VIEW, web).setPackage("com.google.android.apps.maps"),
      Intent(Intent.ACTION_VIEW, Uri.parse("geo:${m.latitude},${m.longitude}?q=$dest(${Uri.encode(m.name)})")),
      Intent(Intent.ACTION_VIEW, web))
    for (i in candidates) { try { ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return } catch (e: ActivityNotFoundException) { /* جرّب التالي */ } catch (e: SecurityException) { /* جرّب التالي */ } }
  }
  /** بحث «مسجد» حول المستخدم في تطبيق الخرائط — يعمل بلا خادمنا ولا OpenStreetMap */
  fun searchIntent() = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode("مسجد")))

  fun distanceLabel(km: Double) = if (km < 1) "${Fmt.number(Math.round(km * 100).toInt() * 10)} م" else "${Fmt.decimal(km, 1)} كم"
  fun walkLabel(km: Double) = "${Fmt.number(maxOf(1, Math.round(km / 5 * 60).toInt()))} د سيرًا"
}
