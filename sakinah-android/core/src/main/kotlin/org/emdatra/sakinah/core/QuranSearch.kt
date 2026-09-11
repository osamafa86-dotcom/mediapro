package org.emdatra.sakinah.core

/** تطبيع النص العثماني والإملائي للمقارنة والبحث — مطابق لدوال الويب وSwift */
object QuranNormalize {
  private fun isMark(v: Int) = v in 0x0610..0x061A || v in 0x064B..0x065F || v == 0x0670 || v in 0x06D6..0x06ED || v == 0x0640 || v == 0xFEFF || v == 0x200E || v == 0x200F || v == 0x06E5 || v == 0x06E6
  private fun isSearchMark(v: Int) = v in 0x0610..0x061A || v in 0x064B..0x065F || v in 0x06D6..0x06DC || v in 0x06DF..0x06E4 || v in 0x06E8..0x06ED || v == 0x0640
  private fun isArabicLetter(v: Int) = v in 0x0621..0x064A
  private fun cps(s: String): IntArray = s.codePoints().toArray()
  private fun str(cps: List<Int>): String { val sb = StringBuilder(); for (c in cps) sb.appendCodePoint(c); return sb.toString() }

  fun forMatch(s: String): String = forMatch(cps(s).toList())
  internal fun forMatch(input: List<Int>): String {
    val out = ArrayList<Int>(input.size); var pendingSpace = false
    for (v0 in input) {
      if (isMark(v0)) continue
      var v = when (v0) { 0x0671, 0x0623, 0x0625, 0x0622 -> 0x0627; 0x0624 -> 0x0648; 0x0626, 0x0649 -> 0x064A; 0x0629 -> 0x0647; else -> v0 }
      if (Character.isWhitespace(v)) { pendingSpace = out.isNotEmpty(); continue }
      if (!(isArabicLetter(v) || v in 0x0660..0x0669)) continue
      if (pendingSpace) { out.add(0x20); pendingSpace = false }
      out.add(v)
    }
    return str(out)
  }
  fun foldDigits(s: String): String = str(cps(s).map { v -> if (v in 0x0660..0x0669) 0x30 + (v - 0x0660) else if (v in 0x06F0..0x06F9) 0x30 + (v - 0x06F0) else v })
  private fun stripSearchMarks(s: String) = cps(s).filter { !isSearchMark(it) }
  fun forSearchA(s: String): String {
    val a = stripSearchMarks(s); val out = ArrayList<Int>(a.size); var i = 0
    while (i < a.size) {
      val v = a[i]
      if (v == 0x0648 && i + 1 < a.size && a[i + 1] == 0x0670) {
        if (i + 2 < a.size && a[i + 2] == 0x0629) { out.add(0x0627); i += 2; continue }
        if (i + 2 < a.size && a[i + 2] == 0x0627) { out.add(0x0627); i += 3; continue }
      }
      if (v == 0x0649 && i + 1 < a.size && a[i + 1] == 0x0670) { out.add(0x0649); i += 2; continue }
      out.add(v); i++
    }
    val b = out.map { when (it) { 0x0670 -> 0x0627; 0x06E7 -> 0x064A; 0x06E5 -> 0x0648; 0x06E6 -> 0x064A; else -> it } }
    return forMatch(mergeHamzaAlef(b))
  }
  fun forSearchB(s: String) = forMatch(mergeHamzaAlef(stripSearchMarks(s)))
  private fun mergeHamzaAlef(a: List<Int>): List<Int> { val out = ArrayList<Int>(a.size); var i = 0; while (i < a.size) { if (a[i] == 0x0621 && i + 1 < a.size && a[i + 1] == 0x0627) { out.add(0x0627); i += 2; continue }; out.add(a[i]); i++ }; return out }

  data class Token(val raw: String, val norm: String, val spoken: Boolean)
  fun tokenize(text: String): List<Token> = text.split(' ').filter { it.isNotEmpty() }.map { raw -> val norm = forMatch(raw); Token(raw, norm, norm.codePoints().anyMatch { isArabicLetter(it) }) }
  fun levenshtein(a: String, b: String): Int {
    val x = cps(a); val y = cps(b)
    if (x.contentEquals(y)) return 0; if (x.isEmpty()) return y.size; if (y.isEmpty()) return x.size
    var prev = IntArray(y.size + 1) { it }; var cur = IntArray(y.size + 1)
    for (i in 1..x.size) { cur[0] = i; for (j in 1..y.size) cur[j] = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (if (x[i - 1] == y[j - 1]) 0 else 1)); val t = prev; prev = cur; cur = t }
    return prev[y.size]
  }
  fun similarity(a: String, b: String): Double { val m = maxOf(cps(a).size, cps(b).size); return if (m > 0) 1 - levenshtein(a, b).toDouble() / m else 1.0 }
}

data class HifzWord(val n: Int, val k: Int, val norm: String, val raw: String)
/** مُطابِق الحفظ (متسامح، مع تخطي كلمة أو كلمتين) */
// إعادة التزامن: إن أسقط التعرّف أكثر من lookahead كلمة تتابعًا، وقف المطابق إلى الأبد.
// فبعد resyncAfter إخفاقًا متتاليًا نبحث أمامنا في نافذة أوسع، ولا نقفز إلا بتأكيد كلمتين
// متتاليتين — فالكلمة الواحدة تتكرّر في القرآن كثيرًا ولا يُعتمد عليها وحدها.
class HifzMatcher(val words: List<HifzWord>, val threshold: Double = 0.66, val lookahead: Int = 2, val lookaheadThreshold: Double = 0.85, val fuseThreshold: Double = 0.8,
                  val resyncAfter: Int = 2, val resyncWindow: Int = 25, val resyncThreshold: Double = 0.85) {
  var pos = 0; private set
  var matched = 0; private set
  var skipped = 0; private set
  var unmatched = 0; private set
  var resynced = 0; private set
  private var misses = 0
  private var resyncAt = -1
  /** أقرب موضع أمامنا تُطابقه الكلمة المنطوقة بثقة — الأقرب لا الأفضل، فالتلاوة تسير إلى الأمام */
  private fun findResync(w: String): Int {
    val end = minOf(words.size - 1, pos + resyncWindow)
    var j = pos + lookahead + 1
    while (j < end) {
      if (QuranNormalize.similarity(words[j].norm, w) >= resyncThreshold) return j
      j++
    }
    return -1
  }
  companion object {
    fun words(ayahs: List<Ayah>, startingAt: Int = 0): List<HifzWord> { val out = ArrayList<HifzWord>(); for (a in ayahs) { if (a.n < startingAt) continue; var k = 0; for (t in QuranNormalize.tokenize(a.text)) if (t.spoken) { out.add(HifzWord(a.n, k, t.norm, t.raw)); k++ } }; return out }
  }
  /** لقطة حالة المطابق — لتجربة فرضيات التعرّف بلا أثر */
  data class Snapshot(val pos: Int, val matched: Int, val skipped: Int, val unmatched: Int, val resynced: Int, val misses: Int, val resyncAt: Int)
  fun snapshot() = Snapshot(pos, matched, skipped, unmatched, resynced, misses, resyncAt)
  fun restore(s: Snapshot) { pos = s.pos; matched = s.matched; skipped = s.skipped; unmatched = s.unmatched; resynced = s.resynced; misses = s.misses; resyncAt = s.resyncAt }
  /**
   * فرضيات التعرّف للصوت نفسه (الاختيار الأول ثم بدائله): تُجرَّب بلا أثر جانبي، وتُعتمد أولى
   * التي تكشف شيئًا. وإن لم تكشف أيٌّ منها بقيت محاسبة الفرضية الأولى وحدها — وإلا محا
   * ضجيجُ البدائل مرشّحَ إعادة التزامن الذي وجدته الفرضية الصحيحة.
   */
  fun feedBest(hypotheses: List<String>): List<Int> {
    val list = hypotheses.filter { it.isNotEmpty() }
    if (list.isEmpty()) return emptyList()
    val before = snapshot()
    var primary: Snapshot? = null
    for (h in list) {
      if (primary != null) restore(before)
      val r = feed(h)
      if (r.isNotEmpty()) return r
      if (primary == null) primary = snapshot()
    }
    primary?.let { restore(it) }
    return emptyList()
  }
  fun feed(transcript: String): List<Int> {
    val spoken = QuranNormalize.forMatch(transcript).split(' ').filter { it.isNotEmpty() }
    val revealed = ArrayList<Int>()
    var i = 0
    while (i < spoken.size) {
      if (pos >= words.size) break
      val w = spoken[i]
      var hit = -1   // كم كلمة متوقّعة نتخطّاها قبل المطابقة
      var span = 1   // كم كلمة متوقّعة تستهلكها هذه المطابقة
      var take = 1   // كم كلمة منطوقة نستهلكها
      var k = 0
      while (k <= lookahead && pos + k < words.size) {
        val exp = words[pos + k].norm; val th = if (k == 0) threshold else lookaheadThreshold
        val wl = w.codePointCount(0, w.length); val el = exp.codePointCount(0, exp.length)
        if (exp == w || QuranNormalize.similarity(exp, w) >= th || (k == 0 && wl >= 4 && el >= 4 && (exp.startsWith(w) || w.startsWith(exp)))) { hit = k; break }
        k++
      }
      // التعرّف يدمج كلمتين في واحدة («اياك نعبد» ← «اياكنعبد»)
      if (hit < 0 && pos + 1 < words.size && QuranNormalize.similarity(words[pos].norm + words[pos + 1].norm, w) >= fuseThreshold) { hit = 0; span = 2 }
      // أو يقسم الكلمة الواحدة إلى اثنتين («نستعين» ← «نست عين»)
      if (hit < 0 && i + 1 < spoken.size && QuranNormalize.similarity(words[pos].norm, w + spoken[i + 1]) >= fuseThreshold) { hit = 0; take = 2 }
      if (hit < 0) {
        // مرشّح من الكلمة السابقة: إن أكّدته هذه الكلمة فقد وجدنا موضع القارئ الحقيقي
        if (resyncAt >= 0 && QuranNormalize.similarity(words[resyncAt + 1].norm, w) >= resyncThreshold) {
          val j = resyncAt
          for (k in pos..(j + 1)) revealed.add(k)  // ما أسقطه التعرّف يُكشف أيضًا
          skipped += j + 1 - pos; matched++; resynced++
          pos = j + 2; misses = 0; resyncAt = -1
          i++; continue
        }
        unmatched++; misses++
        resyncAt = if (misses >= resyncAfter) findResync(w) else -1
        i++; continue
      }
      misses = 0; resyncAt = -1
      // امتداد الدمج: الكلمة المنطوقة قد تضمّ أكثر من كلمة متوقّعة — نتوسّع ما دام التشابه يتحسّن
      if (span == 1) {
        var acc = words[pos + hit].norm; var best = QuranNormalize.similarity(acc, w)
        while (pos + hit + span < words.size) {
          val next = acc + words[pos + hit + span].norm; val sim = QuranNormalize.similarity(next, w)
          if (sim <= best) break
          acc = next; best = sim; span++
        }
      }
      for (j in 0 until hit) revealed.add(pos + j)
      skipped += hit
      for (j in 0 until span) revealed.add(pos + hit + j)
      matched++
      pos += hit + span
      i += take
    }
    return revealed
  }
  fun hint(): Int? { if (pos >= words.size) return null; return pos++ }
  val done get() = pos >= words.size
  val progress get() = if (words.isEmpty()) 1.0 else pos.toDouble() / words.size
}

/** البحث في نص القرآن ومطابقة أسماء السور والمراجع */
class QuranSearch(private val text: QuranText) {
  companion object {
    val shared: QuranSearch by lazy { QuranSearch(QuranText.shared) }
    fun refLabel(a: Ayah) = "${QuranMeta.surah(a.surah).name}: ${a.ayah}"
    private fun surahKey(s: String) = QuranNormalize.forMatch(s.removePrefix("سورة "))
    fun matchSurahs(s: String): List<Surah> { val k = surahKey(s); if (k.isEmpty()) return emptyList(); val lk = s.lowercase(); return QuranMeta.surahs.filter { surahKey(it.name).contains(k) || surahKey(it.plain).contains(k) || it.en.lowercase().contains(lk) } }
    data class Ref(val surah: Surah, val ayah: Int)
    private val re1 = Regex("^(\\d{1,3})\\s*[:\\s]\\s*(\\d{1,3})$"); private val re2 = Regex("^(.+?)\\s*(?:[:\\s]|آية|اية)\\s*(\\d{1,3})$")
    fun parseRef(s: String): Ref? {
      val t = QuranNormalize.foldDigits(s).trim()
      re1.find(t)?.let { m -> val sn = m.groupValues[1].toInt(); val an = m.groupValues[2].toInt(); return if (sn in 1..114) Ref(QuranMeta.surah(sn), maxOf(1, an)) else null }
      re2.find(t)?.let { m -> val hits = matchSurahs(m.groupValues[1]); val exact = hits.firstOrNull { surahKey(it.name) == surahKey(m.groupValues[1]) } ?: (if (hits.size == 1) hits[0] else null); return exact?.let { Ref(it, maxOf(1, m.groupValues[2].toInt())) } }
      return null
    }
    private fun contains(hay: ByteArray, needle: ByteArray): Boolean {
      if (needle.isEmpty() || hay.size < needle.size) return false
      val last = hay.size - needle.size; var i = 0
      while (i <= last) { if (hay[i] == needle[0]) { var j = 1; while (j < needle.size && hay[i + j] == needle[j]) j++; if (j == needle.size) return true }; i++ }
      return false
    }
  }
  private val index: List<Pair<ByteArray, ByteArray>> by lazy { text.ayahs.map { a -> (" " + QuranNormalize.forSearchA(a.text) + " ").toByteArray() to (" " + QuranNormalize.forSearchB(a.text) + " ").toByteArray() } }
  fun search(q: String, limit: Int = 50): List<Ayah> {
    val nA = QuranNormalize.forSearchA(q); val nB = QuranNormalize.forSearchB(q)
    if (nA.codePointCount(0, nA.length) < 2) return emptyList()
    val wA = " $nA ".toByteArray(); val wB = " $nB ".toByteArray(); val pA = nA.toByteArray(); val pB = nB.toByteArray()
    val whole = ArrayList<Ayah>(); val partial = ArrayList<Ayah>()
    for ((i, e) in index.withIndex()) {
      if (contains(e.first, wA) || contains(e.second, wB)) { whole.add(text.ayahs[i]); if (whole.size >= limit) break }
      else if (partial.size < limit && (contains(e.first, pA) || contains(e.second, pB))) partial.add(text.ayahs[i])
    }
    return (whole + partial).take(limit)
  }
}
