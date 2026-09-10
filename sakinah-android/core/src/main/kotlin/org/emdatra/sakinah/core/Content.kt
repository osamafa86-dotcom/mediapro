package org.emdatra.sakinah.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

data class TajweedSpan(val start: Int, val length: Int, val code: String)
/** التجويد الملوّن (tajweed.json) */
class Tajweed(json: String) {
  val source: String; val rules: Map<String, String>; private val raw: Map<String, String>
  private val cache = HashMap<Int, List<TajweedSpan>>()
  init { val root = Res.json.parseToJsonElement(json).jsonObject; source = root.getValue("source").jsonPrimitive.content; rules = root.getValue("rules").jsonObject.mapValues { it.value.jsonPrimitive.content }; raw = root.getValue("ayahs").jsonObject.mapValues { it.value.jsonPrimitive.content } }
  companion object {
    val shared: Tajweed by lazy { Tajweed(Res.text("tajweed.json")) }
    fun group(code: String): String { for ((g, codes) in Catalog.shared.tajweed.groups) if (code in codes) return g; return "other" }
    /** تقسيم كلمة إلى مقاطع (نص، رمز الحكم أو null) بحسب موضع الكلمة في نص الآية */
    fun segments(word: String, start: Int, spans: List<TajweedSpan>): List<Pair<String, String?>> {
      val out = ArrayList<Pair<String, String?>>(); val buf = StringBuilder(); var cur: String? = null
      fun flush() { if (buf.isNotEmpty()) { out.add(buf.toString() to cur); buf.setLength(0) } }
      var i = 0
      for (cp in word.codePoints().toArray()) { val pos = start + i; var code: String? = null; for (s in spans) { if (pos >= s.start && pos < s.start + s.length) { code = s.code; break }; if (s.start > pos) break }; if (code != cur) { flush(); cur = code }; buf.appendCodePoint(cp); i++ }
      flush(); return out
    }
  }
  @Synchronized fun spans(n: Int): List<TajweedSpan> = cache.getOrPut(n) { (raw[n.toString()] ?: "").split(';').filter { it.isNotEmpty() }.mapNotNull { p -> val f = p.split(','); if (f.size == 3) TajweedSpan(f[0].toInt(), f[1].toInt(), f[2]) else null } }
}

@Serializable data class Reciter(val id: String, val name: String, val bitrates: List<Int>, val qdc: Int? = null) { val hasWordTiming get() = qdc != null }
@Serializable data class MushafTheme(val id: String, val name: String, val group: String, val paper: String, val paper2: String, val ink: String, val gradient: String? = null) { val isDark get() = group == "dark" }
@Serializable data class ThemeGroup(val id: String, val name: String)
@Serializable data class TajweedLegendItem(val code: String, val name: String, val key: String)
@Serializable data class TajweedCatalog(val legend: List<TajweedLegendItem>, val groups: Map<String, List<String>>, val light: Map<String, String>, val dark: Map<String, String>)
@Serializable data class Challenge(val id: String, val name: String, val desc: String, val from: Int? = null, val to: Int? = null, val days: Int, val span: Int? = null)
@Serializable data class TasbihPhrase(val id: String, val text: String)
@Serializable data class TasbihCatalog(val phrases: List<TasbihPhrase>, val targets: List<Int>)
@Serializable data class TafsirSource(val id: String, val name: String, val author: String? = null, val short: String? = null, val bundled: Boolean? = null)
/** الكتالوج المشترك (catalog.json) */
@Serializable data class Catalog(val reciters: List<Reciter>, val defaultReciter: String, val qdcBase: String, val themes: List<MushafTheme>, val themeGroups: List<ThemeGroup>, val tajweed: TajweedCatalog, val challenges: List<Challenge>, val minutesPerPage: Int, val tasbih: TasbihCatalog, val tafsirSources: List<TafsirSource>) {
  companion object { val shared: Catalog by lazy { Res.json.decodeFromString(serializer(), Res.text("catalog.json")) } }
  fun reciter(id: String) = reciters.firstOrNull { it.id == id } ?: reciters[0]
  fun theme(id: String) = themes.firstOrNull { it.id == id } ?: themes[0]
  fun challenge(id: String) = challenges.firstOrNull { it.id == id }
  fun migrateTheme(theme: String?, night: Boolean, paper: String?): String { if (theme != null && themes.any { it.id == theme }) return theme; if (night) return "dark"; return if (paper == "white") "white" else "cream" }
}

@Serializable data class Dhikr(val id: String, val hisnId: Int, val period: String, val text: String, val textEvening: String? = null, @SerialName("repeat") val repeatCount: Int, val repeatEvening: Int? = null, val reference: String, val virtue: String? = null, val note: String? = null) {
  fun text(period: String) = if (period == "evening") (textEvening ?: text) else text
  fun target(period: String) = if (period == "evening") (repeatEvening ?: repeatCount) else repeatCount
}
@Serializable private data class AdhkarFile(val adhkar: List<Dhikr>)
object Adhkar {
  val all: List<Dhikr> by lazy { Res.json.decodeFromString(AdhkarFile.serializer(), Res.text("adhkar.json")).adhkar }
  fun items(period: String) = all.filter { it.period == "both" || it.period == period }
  /** الفترة التلقائية: صباح من الفجر إلى الظهر، مساء من العصر إلى الفجر، وإلا صباح؛ وبلا مواقيت: 4–12 صباحًا */
  fun autoPeriod(now: java.time.Instant, fajr: java.time.Instant?, dhuhr: java.time.Instant?, asr: java.time.Instant?, zone: java.time.ZoneId): String {
    if (fajr != null && dhuhr != null && asr != null) return if (!now.isBefore(fajr) && now.isBefore(dhuhr)) "morning" else if (!now.isBefore(asr) || now.isBefore(fajr)) "evening" else "morning"
    val hr = now.atZone(zone).hour; return if (hr in 4..11) "morning" else "evening"
  }
}
@Serializable data class HisnItem(val id: Int, val text: String, @SerialName("repeat") val repeatCount: Int, val audio: Boolean? = null) { val hasAudio get() = audio != false; val audioUrl get() = "https://www.hisnmuslim.com/audio/ar/$id.mp3" }
@Serializable data class HisnChapter(val id: Int, val title: String, val items: List<HisnItem>)
@Serializable data class HisnSection(val title: String, val chapters: List<Int>)
@Serializable private data class HisnFile(val sections: List<HisnSection>, val chapters: List<HisnChapter>)
object Hisn {
  private val file by lazy { Res.json.decodeFromString(HisnFile.serializer(), Res.text("hisn.json")) }
  val sections get() = file.sections
  val chapters get() = file.chapters
  val itemCount get() = file.chapters.sumOf { it.items.size }
  fun chapter(id: Int) = file.chapters.firstOrNull { it.id == id }
  fun search(q: String, limit: Int = 60): Pair<List<HisnChapter>, List<Pair<HisnItem, HisnChapter>>> {
    val nq = CityDatabase.normalize(q); if (nq.length < 2) return emptyList<HisnChapter>() to emptyList()
    val ch = file.chapters.filter { CityDatabase.normalize(it.title).contains(nq) }
    val items = ArrayList<Pair<HisnItem, HisnChapter>>()
    outer@ for (c in file.chapters) for (it in c.items) { if (items.size >= limit) break@outer; if (CityDatabase.normalize(it.text).contains(nq)) items.add(it to c) }
    return ch to items
  }
}
@Serializable data class Hadith(val id: String, val collection: String, val number: Int, val grade: String, val narrator: String, val text: String, val topic: String, val lesson: String, val alsoIn: AlsoIn? = null) {
  @Serializable data class AlsoIn(val collection: String, val number: Int)
  val reference: String get() { val col = if (collection == "bukhari") "صحيح البخاري" else "صحيح مسلم"; var ref = "$col ($number)"; alsoIn?.let { ref += " و${if (it.collection == "bukhari") "صحيح البخاري" else "صحيح مسلم"} (${it.number})" }; return ref }
}
@Serializable data class NawawiHadith(val n: Int, val title: String, val text: String, val takhrij: String) { val id get() = "nawawi-$n" }
@Serializable private data class HadithFile(val topics: List<String>, val hadiths: List<Hadith>, val nawawi: List<NawawiHadith>)
object HadithLibrary {
  private val file by lazy { Res.json.decodeFromString(HadithFile.serializer(), Res.text("hadith.json")) }
  val topics get() = file.topics
  val hadiths get() = file.hadiths
  val nawawi get() = file.nawawi
  fun hadithOfDay(year: Int, month: Int, day: Int): Hadith { val idx = DayKey.daysFromCivil(year, month, day); val n = file.hadiths.size; return file.hadiths[((idx % n) + n) % n] }
  private fun strip(s: String) = CityDatabase.normalize(s).lowercase()
  fun searchSahih(q: String, topic: String? = null, favorites: Set<String> = emptySet(), onlyFavorites: Boolean = false): List<Hadith> { val qq = strip(q); return file.hadiths.filter { h -> (topic == null || h.topic == topic) && (!onlyFavorites || h.id in favorites) && (qq.isEmpty() || strip(h.text).contains(qq) || strip(h.narrator).contains(qq) || strip(h.lesson).contains(qq)) } }
  fun searchNawawi(q: String, favorites: Set<String> = emptySet(), onlyFavorites: Boolean = false): List<NawawiHadith> { val qq = strip(q); return file.nawawi.filter { n -> (!onlyFavorites || n.id in favorites) && (qq.isEmpty() || strip(n.text).contains(qq) || strip(n.takhrij).contains(qq) || strip(n.title).contains(qq)) } }
}
/** التفسير الميسّر: ملف لكل سورة */
object Tafsir {
  private val cache = HashMap<Int, List<String>>()
  @Synchronized fun surah(s: Int): List<String> = cache.getOrPut(s) { if (Res.exists("tafsir-muyassar/$s.json")) Res.json.parseToJsonElement(Res.text("tafsir-muyassar/$s.json")).jsonArray.map { it.jsonPrimitive.content } else emptyList() }
  fun text(surah: Int, ayah: Int): String? { val arr = surah(surah); return if (ayah in 1..arr.size) arr[ayah - 1] else null }
  data class Run(val text: String, val bold: Boolean)
  fun runs(html: String): List<Run> {
    val out = ArrayList<Run>(); val buf = StringBuilder(); var bold = false; var i = 0
    fun flush() { if (buf.isNotEmpty()) { out.add(Run(decode(buf.toString()), bold)); buf.setLength(0) } }
    while (i < html.length) {
      if (html[i] == '<') { val close = html.indexOf('>', i); if (close > i) { val tag = html.substring(i + 1, close).lowercase().trim(); when { tag == "b" || tag == "strong" -> { flush(); bold = true }; tag == "/b" || tag == "/strong" -> { flush(); bold = false }; tag == "br" || tag == "br/" || tag.startsWith("/p") -> buf.append('\n') }; i = close + 1; continue } }
      buf.append(html[i]); i++
    }
    flush(); return out
  }
  fun plain(html: String) = runs(html).joinToString("") { it.text }
  private fun decode(s: String) = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
}

/** سجل إتمام الأذكار: مفتاح اليوم ← الفترات المكتملة («morning» / «evening») */
typealias AdhkarLog = Map<String, List<String>>

/** يوم في شريط السلسلة: مفتاحه، حرف اليوم، وهل اكتملت فيه فترة واحدة على الأقل */
data class AdhkarDay(val key: String, val letter: String, val done: Boolean, val isToday: Boolean)

/** سلسلة أيام الأذكار: تسجيل الإتمام، طول السلسلة الحالية وأطولها، وشريط آخر سبعة أيام */
object AdhkarStreak {
  private val letters = listOf("ح", "ن", "ث", "ر", "خ", "ج", "س")
  /** حرف اليوم من مفتاحه (الأحد = ح … السبت = س) */
  fun letter(key: String): String {
    val p = DayKey.parse(key) ?: return ""
    val idx = ((DayKey.daysFromCivil(p.first, p.second, p.third) + 4) % 7 + 7) % 7  // 1970-01-01 خميس
    return letters[idx]
  }
  /** تسجيل إتمام فترة في يوم، مع تقليم السجل إلى 400 يوم */
  fun mark(log: AdhkarLog, day: String, period: String): AdhkarLog {
    val periods = log[day] ?: emptyList()
    if (period in periods) return log
    var out = log + (day to periods + period)
    if (out.size > 400) out = out.toSortedMap().entries.drop(out.size - 400).associate { it.key to it.value }
    return out
  }
  /** طول السلسلة المنتهية باليوم (أو بأمسه إن لم يُتمّ اليوم بعد) */
  fun current(log: AdhkarLog, today: String): Int {
    var n = 0; var key = today
    if (log[key].isNullOrEmpty()) key = DayKey.adding(key, -1)
    while (!log[key].isNullOrEmpty()) { n++; key = DayKey.adding(key, -1) }
    return n
  }
  /** أطول سلسلة في السجل كلّه */
  fun longest(log: AdhkarLog): Int {
    val keys = log.filterValues { it.isNotEmpty() }.keys.sorted()
    var best = 0; var run = 0; var prev: String? = null
    for (k in keys) {
      run = if (prev != null && DayKey.daysBetween(prev, k) == 1) run + 1 else 1
      if (run > best) best = run
      prev = k
    }
    return best
  }
  /** آخر «count» يومًا منتهية باليوم، من الأقدم إلى الأحدث */
  fun lastDays(log: AdhkarLog, today: String, count: Int = 7): List<AdhkarDay> =
    (count - 1 downTo 0).map { i ->
      val k = DayKey.adding(today, -i)
      AdhkarDay(k, letter(k), !log[k].isNullOrEmpty(), i == 0)
    }
}
