package org.emdatra.sakinah.app

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import org.emdatra.sakinah.core.Catalog
import org.emdatra.sakinah.core.QuranText
import org.emdatra.sakinah.core.Reciter
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** مصدر صوت آية: quran.com (بتوقيتات الكلمات) أو Islamic Network بمعدل بت، أو ملف محلي منزَّل */
data class AyahSource(val url: String, val segments: List<List<Int>>?, val provider: String)

/** بيانات quran.com لكل سورة: رابط كل آية وتوقيتات كلماتها [موضع الكلمة (1..)، بداية ms، نهاية ms] — تُخزَّن على القرص */
object QdcMeta {
  @Serializable data class Entry(val url: String, val segments: List<List<Int>>)
  @Serializable private data class AF(val verse_key: String, val url: String, val segments: List<List<Int>>? = null)
  @Serializable private data class Resp(val audio_files: List<AF> = emptyList())
  private val json = Json { ignoreUnknownKeys = true }
  private val ser = MapSerializer(String.serializer(), Entry.serializer())
  private val mem = HashMap<String, Map<String, Entry>>()
  private var dir: File? = null
  fun init(ctx: Context) { dir = File(ctx.cacheDir, "qdc").apply { mkdirs() } }
  /** يُستدعى من خيط الخلفية */
  fun surah(recitation: Int, surah: Int): Map<String, Entry>? {
    val key = "$recitation:$surah"
    synchronized(mem) { mem[key]?.let { return it } }
    val f = dir?.let { File(it, "$recitation-$surah.json") }
    if (f != null && f.exists()) runCatching { json.decodeFromString(ser, f.readText()) }.getOrNull()?.let { synchronized(mem) { mem[key] = it }; return it }
    val text = runCatching { fetch("https://api.quran.com/api/v4/recitations/$recitation/by_chapter/$surah?fields=segments&per_page=300") }.getOrNull() ?: return null
    val r = runCatching { json.decodeFromString(Resp.serializer(), text) }.getOrNull() ?: return null
    val m = r.audio_files.associate { it.verse_key to Entry(Catalog.shared.qdcBase + it.url, (it.segments ?: emptyList()).map { s -> if (s.size >= 4) listOf(s[1], s[2], s[3]) else s }) }
    if (f != null) runCatching { f.writeText(json.encodeToString(ser, m)) }
    synchronized(mem) { mem[key] = m }
    return m
  }
  fun fetch(url: String): String {
    val c = URL(url).openConnection() as HttpURLConnection
    c.connectTimeout = 8000; c.readTimeout = 8000; c.setRequestProperty("accept", "application/json")
    try { if (c.responseCode !in 200..299) throw java.io.IOException("HTTP ${c.responseCode}"); return c.inputStream.bufferedReader().readText() } finally { c.disconnect() }
  }
  /** موضع الكلمة (1..) الجارية عند اللحظة t بالثواني */
  fun wordAt(t: Double, segments: List<List<Int>>?): Int? {
    if (segments.isNullOrEmpty()) return null
    val ms = (t * 1000).toInt(); var lo = 0; var hi = segments.size - 1; var best: List<Int>? = null
    while (lo <= hi) { val mid = (lo + hi) / 2; if (ms < segments[mid][1]) hi = mid - 1 else { best = segments[mid]; lo = mid + 1 } }
    return best?.getOrNull(0)
  }
}

object AudioSources {
  fun islamicUrl(reciter: String, n: Int, bitrate: Int) = "https://cdn.islamic.network/quran/audio/$bitrate/$reciter/$n.mp3"
  fun usesQdc(r: Reciter, words: Boolean) = r.qdc != null && (words || r.bitrates.isEmpty())
  /** مصادر الآية بالترتيب (من خيط الخلفية): الملف المحلي، ثم quran.com إن كان مفضّلًا، ثم معدلات Islamic Network */
  fun sources(reciter: String, n: Int, words: Boolean, local: Boolean = true): List<AyahSource> {
    val r = Catalog.shared.reciter(reciter); val out = ArrayList<AyahSource>()
    if (local) AudioDownloads.local(reciter, n)?.let { out.add(it) }
    val q = r.qdc
    if (q != null && usesQdc(r, words)) { val a = QuranText.shared.ayah(n); if (a != null) QdcMeta.surah(q, a.surah)?.get("${a.surah}:${a.ayah}")?.let { out.add(AyahSource(it.url, it.segments, "qdc")) } }
    for (b in r.bitrates) out.add(AyahSource(islamicUrl(reciter, n, b), null, "islamic"))
    return out
  }
}
