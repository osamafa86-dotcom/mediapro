package org.emdatra.sakinah.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

@Serializable data class Surah(val n: Int, val name: String, val vocalized: String, val plain: String, val en: String, val ayahs: Int, val type: String, val page: Int)
@Serializable data class JuzStart(val juz: Int, val surah: Int, val ayah: Int, val page: Int)
@Serializable private data class MetaFile(val surahs: List<Surah>, val juzStarts: List<JuzStart>, val totalAyahs: Int, val totalPages: Int, val basmala: String)

/** وصف السور والأجزاء (quran-meta.json) */
object QuranMeta {
  private val file by lazy { Res.json.decodeFromString(MetaFile.serializer(), Res.text("quran-meta.json")) }
  val surahs get() = file.surahs
  val juzStarts get() = file.juzStarts
  val totalAyahs get() = file.totalAyahs
  val totalPages get() = file.totalPages
  val basmala get() = file.basmala
  fun surah(n: Int) = file.surahs[n - 1]
  fun juzOfPage(p: Int) = file.juzStarts.lastOrNull { it.page <= p }?.juz ?: 1
  fun juzStartPage(j: Int) = file.juzStarts[j - 1].page
  private val juzOrdinals = listOf("الأَوَّلُ", "الثَّانِي", "الثَّالِثُ", "الرَّابِعُ", "الخَامِسُ", "السَّادِسُ", "السَّابِعُ", "الثَّامِنُ", "التَّاسِعُ", "العَاشِرُ",
    "الحَادِيَ عَشَرَ", "الثَّانِيَ عَشَرَ", "الثَّالِثَ عَشَرَ", "الرَّابِعَ عَشَرَ", "الخَامِسَ عَشَرَ", "السَّادِسَ عَشَرَ", "السَّابِعَ عَشَرَ", "الثَّامِنَ عَشَرَ", "التَّاسِعَ عَشَرَ", "العِشْرُونَ",
    "الحَادِي وَالعِشْرُونَ", "الثَّانِي وَالعِشْرُونَ", "الثَّالِثُ وَالعِشْرُونَ", "الرَّابِعُ وَالعِشْرُونَ", "الخَامِسُ وَالعِشْرُونَ", "السَّادِسُ وَالعِشْرُونَ", "السَّابِعُ وَالعِشْرُونَ", "الثَّامِنُ وَالعِشْرُونَ", "التَّاسِعُ وَالعِشْرُونَ", "الثَّلَاثُونَ")
  fun juzName(j: Int, vocalized: Boolean = true): String {
    if (j !in 1..30) return ""
    val s = "الجُزْءُ ${juzOrdinals[j - 1]}"
    if (vocalized) return s
    val sb = StringBuilder(); for (ch in s) { val v = ch.code; if (v in 0x0610..0x061A || v in 0x064B..0x065F || v == 0x0670 || v in 0x06D6..0x06ED) continue; sb.append(ch) }
    return sb.toString()
  }
  fun arabicDigits(n: Int): String = n.toString().map { if (it.isDigit()) "٠١٢٣٤٥٦٧٨٩"[it - '0'] else it }.joinToString("")
}

data class Ayah(val n: Int, val surah: Int, val ayah: Int, val page: Int, val juz: Int, val hizbQuarter: Int, val text: String)
data class PageLabel(val juz: Int, val hizb: Int, val quarter: Int, val surah: Int)

/** نص القرآن (quran.json) مع فهارس الصفحات والسور */
class QuranText(json: String) {
  val ayahs: List<Ayah>
  private val byPage: Map<Int, List<Ayah>>; private val bySurah: Map<Int, List<Ayah>>; private val hizbPages = HashMap<Int, Int>()
  init {
    val root = Res.json.parseToJsonElement(json).jsonObject
    ayahs = root.getValue("ayahs").jsonArray.mapIndexed { i, e -> val r = e.jsonArray; Ayah(i + 1, r[0].jsonPrimitive.int, r[1].jsonPrimitive.int, r[2].jsonPrimitive.int, r[3].jsonPrimitive.int, r[4].jsonPrimitive.int, r[5].jsonPrimitive.content) }
    byPage = ayahs.groupBy { it.page }; bySurah = ayahs.groupBy { it.surah }
    for (a in ayahs) if ((a.hizbQuarter - 1) % 4 == 0) hizbPages.putIfAbsent((a.hizbQuarter + 3) / 4, a.page)
  }
  companion object { val shared: QuranText by lazy { QuranText(Res.text("quran.json")) } }
  fun ayah(n: Int) = if (n in 1..ayahs.size) ayahs[n - 1] else null
  fun ayah(surah: Int, ayah: Int) = bySurah[surah]?.let { if (ayah in 1..it.size) it[ayah - 1] else null }
  fun pageAyahs(page: Int) = byPage[page] ?: emptyList()
  fun surahAyahs(surah: Int) = bySurah[surah] ?: emptyList()
  fun surahsStarting(page: Int) = pageAyahs(page).filter { it.ayah == 1 }.map { it.surah }
  fun label(page: Int): PageLabel? { val a = pageAyahs(page).firstOrNull() ?: return null; return PageLabel(a.juz, (a.hizbQuarter + 3) / 4, ((a.hizbQuarter - 1) % 4) + 1, a.surah) }
  fun hizbStartPage(h: Int) = hizbPages[h]
}

data class MushafWord(val glyph: String, val n: Int, val k: Int, val end: Boolean, val rub: Boolean, val sajda: Boolean)
sealed class MushafLine {
  data class Header(val surah: Int) : MushafLine()
  data object Basmala : MushafLine()
  data class Words(val words: List<MushafWord>) : MushafLine()
  val wordList get() = (this as? Words)?.words ?: emptyList()
}
/** تخطيط صفحات مصحف المدينة (mushaf-layout.json) */
class MushafLayout(json: String) {
  val font: String; val source: String
  private val raw: List<JsonArray>; private val maps: Map<Int, List<Int>>
  private val cache = HashMap<Int, List<MushafLine>>()
  init {
    val root = Res.json.parseToJsonElement(json).jsonObject
    font = root.getValue("font").jsonPrimitive.content; source = root.getValue("source").jsonPrimitive.content
    raw = root.getValue("pages").jsonArray.map { it.jsonArray }
    require(raw.size == TOTAL_PAGES) { "bad mushaf layout" }
    maps = root["maps"]?.jsonObject?.entries?.associate { (k, v) -> k.toInt() to v.jsonArray.map { it.jsonPrimitive.int } } ?: emptyMap()
  }
  companion object { const val TOTAL_PAGES = 604; val shared: MushafLayout by lazy { MushafLayout(Res.text("mushaf-layout.json")) }; fun lineCount(page: Int) = if (page <= 2) 8 else 15 }
  @Synchronized fun lines(page: Int): List<MushafLine> {
    if (page !in 1..TOTAL_PAGES) return emptyList()
    return cache.getOrPut(page) { raw[page - 1].map { decode(it.jsonArray) } }
  }
  private fun decode(line: JsonArray): MushafLine {
    val kind = line[0].jsonPrimitive.int
    if (kind == 1) return MushafLine.Header(line[1].jsonPrimitive.int)
    if (kind == 2) return MushafLine.Basmala
    val glyphs = line[1].jsonPrimitive.content.let { if (it.isEmpty()) emptyList() else it.split("|") }
    val runs = line[2].jsonArray.map { r -> r.jsonArray.map { it.jsonPrimitive.int } }
    val rub = if (line.size > 3) line[3].jsonArray.map { it.jsonPrimitive.int }.toSet() else emptySet()
    val saj = if (line.size > 4) line[4].jsonArray.map { it.jsonPrimitive.int }.toSet() else emptySet()
    val words = ArrayList<MushafWord>(); var gi = 0
    for (run in runs) {
      if (run.size < 4) continue
      val (n, k0, cnt, e) = run
      for (j in 0 until cnt) {
        val isEnd = e == 1 && j == cnt - 1
        var k = -1
        if (!isEnd) { val map = maps[n]; k = if (map != null) (if (k0 + j in map.indices) map[k0 + j] else -1) else k0 + j }
        words.add(MushafWord(if (gi < glyphs.size) glyphs[gi] else "", n, k, isEnd, gi in rub, gi in saj)); gi++
      }
    }
    return MushafLine.Words(words)
  }
  fun headers(page: Int) = lines(page).mapNotNull { (it as? MushafLine.Header)?.surah }
  fun ayahs(page: Int): List<Int> { val seen = ArrayList<Int>(); for (l in lines(page)) for (w in l.wordList) if (seen.lastOrNull() != w.n) seen.add(w.n); return seen }
}
