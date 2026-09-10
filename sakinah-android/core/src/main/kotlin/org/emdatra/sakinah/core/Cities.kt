package org.emdatra.sakinah.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.*

@Serializable data class City(val id: String, val nameAr: String, val nameEn: String, val countryAr: String, val countryCode: String, val lat: Double, val lon: Double, val tz: String) {
  val coordinates get() = Coordinates(lat, lon)
}
@Serializable data class Country(val code: String, val nameAr: String, val nameEn: String? = null)
@Serializable private data class CitiesFile(val cities: List<City>, val countries: List<Country>)

/** قاعدة المدن دون اتصال (cities.json — المصدر الواحد مع الويب وSwift) */
class CityDatabase(val cities: List<City>, val countries: List<Country>) {
  companion object {
    val bundled: CityDatabase by lazy { val f = Res.json.decodeFromString(CitiesFile.serializer(), Res.text("cities.json")); CityDatabase(f.cities, f.countries) }
    /** تسوية للبحث (عربية أو إنجليزية) — مطابقة لـ location.js */
    fun normalize(s: String): String {
      val sb = StringBuilder()
      for (ch in s.lowercase()) { val v = ch.code; if (v in 0x064B..0x0652) continue; sb.append(when (ch) { 'أ', 'إ', 'آ' -> 'ا'; 'ة' -> 'ه'; 'ى' -> 'ي'; else -> ch }) }
      return sb.toString().trim()
    }
    fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
      val r = 6371.0; val d = Math.PI / 180
      val a = sin(((lat2 - lat1) * d) / 2).pow(2) + cos(lat1 * d) * cos(lat2 * d) * sin(((lon2 - lon1) * d) / 2).pow(2)
      return 2 * r * asin(sqrt(a))
    }
  }
  fun search(q: String, limit: Int = 30): List<City> {
    val s = normalize(q)
    if (s.isEmpty()) return cities.take(limit)
    val scored = ArrayList<Pair<Int, City>>()
    for (c in cities) {
      val a = normalize(c.nameAr); val e = c.nameEn.lowercase(); val k = normalize(c.countryAr)
      val score = if (a.startsWith(s) || e.startsWith(s)) 3 else if (a.contains(s) || e.contains(s)) 2 else if (k.contains(s)) 1 else 0
      if (score > 0) scored.add(score to c)
    }
    return scored.sortedByDescending { it.first }.take(limit).map { it.second }
  }
  fun nearest(lat: Double, lon: Double): Pair<City, Double>? = cities.map { it to haversineKm(lat, lon, it.lat, it.lon) }.minByOrNull { it.second }
  fun city(id: String) = cities.firstOrNull { it.id == id }
}

/** موارد النواة (ملفات JSON المشتركة) */
object Res {
  val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true; explicitNulls = false; encodeDefaults = true }
  fun text(name: String): String = (Res::class.java.classLoader.getResourceAsStream(name) ?: error("missing resource $name")).use { it.readBytes().toString(Charsets.UTF_8) }
  fun exists(name: String) = Res::class.java.classLoader.getResource(name) != null
}
