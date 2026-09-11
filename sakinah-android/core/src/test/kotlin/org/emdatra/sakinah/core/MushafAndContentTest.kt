package org.emdatra.sakinah.core

import kotlinx.serialization.json.*
import kotlin.test.*

/** المصحف والبحث والحفظ والختمة والمسبحة والتجويد والحديث — مطابقة لمحرّك الويب على المرجع الذهبي نفسه */
class MushafAndContentTest {
  private val g get() = GoldenTest.g

  @Test fun layoutMatchesWebEngine() {
    val layout = MushafLayout.shared
    val pages = g.getValue("layoutPages").jsonObject
    assertEquals(9, pages.size)
    for ((ps, gp0) in pages) {
      val p = ps.toInt(); val gp = gp0.jsonObject
      assertEquals(gp.getValue("lineCount").jsonPrimitive.int, MushafLayout.lineCount(p), "lineCount p$p")
      assertEquals(gp.getValue("headers").jsonArray.map { it.jsonPrimitive.int }, layout.headers(p), "headers p$p")
      assertEquals(gp.getValue("ayahs").jsonArray.map { it.jsonPrimitive.int }, layout.ayahs(p), "ayahs p$p")
      val lines = layout.lines(p); val gl = gp.getValue("lines").jsonArray
      assertEquals(gl.size, lines.size, "lines p$p")
      for ((i, pair) in lines.zip(gl).withIndex()) {
        val (l, e) = pair; val eo = e.jsonObject; val type = eo.getValue("type").jsonPrimitive.content
        when (l) {
          is MushafLine.Header -> { assertEquals("header", type, "p$p l$i"); assertEquals(eo.getValue("surah").jsonPrimitive.int, l.surah) }
          is MushafLine.Basmala -> assertEquals("basmala", type, "p$p l$i")
          is MushafLine.Words -> {
            assertEquals("words", type, "p$p l$i"); val ws = eo.getValue("words").jsonArray
            assertEquals(ws.size, l.words.size, "p$p l$i count")
            for ((w, gw0) in l.words.zip(ws)) { val gw = gw0.jsonObject; assertEquals(gw.getValue("glyph").jsonPrimitive.content, w.glyph); assertEquals(gw.getValue("n").jsonPrimitive.int, w.n); assertEquals(gw.getValue("k").jsonPrimitive.int, w.k, "p$p l$i n${w.n}"); assertEquals(gw.getValue("end").jsonPrimitive.boolean, w.end); assertEquals(gw.getValue("rub").jsonPrimitive.boolean, w.rub); assertEquals(gw.getValue("sajda").jsonPrimitive.boolean, w.sajda) }
          }
        }
      }
    }
    var total = 0
    for (p in 1..604) { val ls = layout.lines(p); assertEquals(MushafLayout.lineCount(p), ls.size, "p$p"); total += ls.sumOf { l -> l.wordList.count { it.end } } }
    assertEquals(6236, total)
    for ((i, name) in g.getValue("juzNames").jsonArray.withIndex()) assertEquals(name.jsonPrimitive.content, QuranMeta.juzName(i + 1))
    assertEquals("الجزء السادس والعشرون", QuranMeta.juzName(26, false)); assertEquals("٦٠٤", QuranMeta.arabicDigits(604))
    val t = QuranText.shared
    assertEquals(6236, t.ayahs.size); assertEquals(8, t.ayah(2, 1)!!.n); assertEquals(listOf(112, 113, 114), t.surahsStarting(604)); assertEquals(591, t.hizbStartPage(60)); assertEquals(3, t.label(50)!!.surah)
    for (p in listOf(1, 2, 3, 50, 187, 293, 302, 545, 604)) assertEquals(layout.ayahs(p), t.pageAyahs(p).map { it.n }, "p$p")
  }

  @Test fun normalizeSearchHifz() {
    for (n0 in g.getValue("normalize").jsonArray) { val n = n0.jsonObject; val s = n.getValue("s").jsonPrimitive.content; assertEquals(n.getValue("match").jsonPrimitive.content, QuranNormalize.forMatch(s), "match $s"); assertEquals(n.getValue("a").jsonPrimitive.content, QuranNormalize.forSearchA(s), "A $s"); assertEquals(n.getValue("b").jsonPrimitive.content, QuranNormalize.forSearchB(s), "B $s") }
    assertEquals("255 و12", QuranNormalize.foldDigits("٢٥٥ و۱۲"))
    for (q0 in g.getValue("search").jsonArray) { val q = q0.jsonObject; assertEquals(q.getValue("n").jsonArray.map { it.jsonPrimitive.int }, QuranSearch.shared.search(q.getValue("q").jsonPrimitive.content, 30).map { it.n }, "search ${q.getValue("q")}") }
    for (t0 in g.getValue("tokenize").jsonArray) { val t = t0.jsonObject; val n = t.getValue("n").jsonPrimitive.int; val exp = t.getValue("words").jsonArray.map { val w = it.jsonObject; QuranNormalize.Token(w.getValue("raw").jsonPrimitive.content, w.getValue("norm").jsonPrimitive.content, w.getValue("spoken").jsonPrimitive.boolean) }; assertEquals(exp, QuranNormalize.tokenize(QuranText.shared.ayah(n)!!.text), "tokenize $n") }
    for (l0 in g.getValue("lev").jsonArray) { val l = l0.jsonObject; assertEquals(l.getValue("d").jsonPrimitive.int, QuranNormalize.levenshtein(l.getValue("a").jsonPrimitive.content, l.getValue("b").jsonPrimitive.content)); assertEquals(l.getValue("sim").jsonPrimitive.double, QuranNormalize.similarity(l.getValue("a").jsonPrimitive.content, l.getValue("b").jsonPrimitive.content), 1e-12) }
    assertEquals(2, QuranSearch.parseRef("2:255")!!.surah.n); assertEquals(255, QuranSearch.parseRef("٢ ٢٥٥")!!.ayah); assertEquals(18, QuranSearch.parseRef("الكهف 10")!!.surah.n); assertEquals(255, QuranSearch.parseRef("سورة البقرة آية 255")!!.ayah); assertNull(QuranSearch.parseRef("255")); assertNull(QuranSearch.parseRef("999:1"))
    assertEquals(2, QuranSearch.matchSurahs("البقره").first().n); assertEquals("البقرة: 255", QuranSearch.refLabel(QuranText.shared.ayah(262)!!))
    val h = g.getValue("hifz").jsonObject
    val words = HifzMatcher.words(QuranText.shared.pageAyahs(1))
    assertEquals(h.getValue("words").jsonArray.map { val w = it.jsonObject; HifzWord(w.getValue("n").jsonPrimitive.int, w.getValue("k").jsonPrimitive.int, w.getValue("norm").jsonPrimitive.content, w.getValue("raw").jsonPrimitive.content) }, words)
    val m = HifzMatcher(words)
    for (st0 in h.getValue("steps").jsonArray) { val st = st0.jsonObject; assertEquals(st.getValue("revealed").jsonArray.map { it.jsonPrimitive.int }, m.feed(st.getValue("t").jsonPrimitive.content)); assertEquals(st.getValue("pos").jsonPrimitive.int, m.pos); assertEquals(st.getValue("matched").jsonPrimitive.int, m.matched); assertEquals(st.getValue("skipped").jsonPrimitive.int, m.skipped); assertEquals(st.getValue("unmatched").jsonPrimitive.int, m.unmatched); assertEquals(st.getValue("done").jsonPrimitive.boolean, m.done); assertEquals(st.getValue("progress").jsonPrimitive.double, m.progress, 1e-12) }
    val m2 = HifzMatcher(words); val noisy = h.getValue("noisy").jsonArray
    for (st0 in noisy) { val st = st0.jsonObject; val t = st.getValue("t").jsonPrimitive.content; val r = if (t == "hint") listOf(m2.hint()!!) else m2.feed(t); assertEquals(st.getValue("revealed").jsonArray.map { it.jsonPrimitive.int }, r, t) }
    assertEquals(noisy.last().jsonObject.getValue("pos").jsonPrimitive.int, m2.pos)

    // إعادة التزامن — سورة الرحمن، لأن «فبأي آلاء ربكما تكذبان» تتكرّر ٣١ مرة فهي أقسى اختبار للقفز الخاطئ
    val rs = h.getValue("resync").jsonObject
    val rw = HifzMatcher.words(QuranText.shared.surahAyahs(55))
    assertEquals(rs.getValue("words").jsonPrimitive.int, rw.size)
    val spoken = rw.map { it.norm }
    fun run(key: String, seq: List<String>) {
      val m = HifzMatcher(rw); for (w in seq) m.feed(w)
      val e = rs.getValue(key).jsonObject
      assertEquals(e.getValue("pos").jsonPrimitive.int, m.pos, "$key pos")
      assertEquals(e.getValue("matched").jsonPrimitive.int, m.matched, "$key matched")
      assertEquals(e.getValue("skipped").jsonPrimitive.int, m.skipped, "$key skipped")
      assertEquals(e.getValue("unmatched").jsonPrimitive.int, m.unmatched, "$key unmatched")
      assertEquals(e.getValue("resynced").jsonPrimitive.int, m.resynced, "$key resynced")
    }
    run("dropped", spoken.subList(0, 8) + spoken.subList(13, 60))   // التعرّف أسقط ٥ كلمات
    run("clean", spoken.subList(0, 60))                             // تلاوة سليمة كلمةً كلمة
    run("noise", "السلام عليكم كيف حالك اليوم الطقس جميل هنا".split(' '))
    run("single", listOf(spoken[0], "xxxxxxxx", spoken[40]))        // كلمة بعيدة واحدة لا تكفي للقفز

    // feedBest: البدائل فرضيات لصوت واحد، فلا يجوز أن يمحو ضجيجُها مرشّحَ إعادة التزامن
    val bs = h.getValue("best").jsonObject
    fun runBest(key: String, seq: List<String>, alts: List<String>) {
      val m = HifzMatcher(rw); for (w in seq) m.feedBest(listOf(w) + alts)
      val e = bs.getValue(key).jsonObject
      assertEquals(e.getValue("pos").jsonPrimitive.int, m.pos, "$key pos")
      assertEquals(e.getValue("matched").jsonPrimitive.int, m.matched, "$key matched")
      assertEquals(e.getValue("skipped").jsonPrimitive.int, m.skipped, "$key skipped")
      assertEquals(e.getValue("unmatched").jsonPrimitive.int, m.unmatched, "$key unmatched")
      assertEquals(e.getValue("resynced").jsonPrimitive.int, m.resynced, "$key resynced")
    }
    runBest("droppedWithNoisyAlts", spoken.subList(0, 8) + spoken.subList(14, 60), listOf("غرغرة", "اه"))
    runBest("cleanWithFarAlts", spoken.subList(0, 60), listOf("xxxxxxxx"))
    fun runOne(key: String, hyp: List<String>) {
      val m = HifzMatcher(rw); val r = m.feedBest(hyp); val e = bs.getValue(key).jsonObject
      assertEquals(e.getValue("revealed").jsonArray.map { it.jsonPrimitive.int }, r, "$key revealed")
      assertEquals(e.getValue("pos").jsonPrimitive.int, m.pos, "$key pos")
      assertEquals(e.getValue("unmatched").jsonPrimitive.int, m.unmatched, "$key unmatched")
    }
    runOne("emptyHypotheses", listOf("", ""))
    runOne("altWins", listOf("xxxxxxxx", spoken[0]))  // الفرضية الأولى فاشلة والثانية تكشف: لا أثر للأولى

    // التلميح اليدوي يتجاوز المرشّح؛ فلو بقي صالحًا لتراجع pos إلى الخلف
    val stl = h.getValue("stale").jsonObject
    val mS = HifzMatcher(rw)
    mS.feed(spoken[0]); mS.feed("غرغرة"); mS.feed(spoken[20])
    assertEquals(stl.getValue("armed").jsonPrimitive.int, mS.resyncAt, "armed")
    repeat(30) { mS.hint() }
    val ah = stl.getValue("afterHints").jsonObject
    assertEquals(ah.getValue("pos").jsonPrimitive.int, mS.pos, "afterHints pos")
    assertEquals(ah.getValue("resyncAt").jsonPrimitive.int, mS.resyncAt, "afterHints resyncAt")
    assertEquals(stl.getValue("revealed").jsonArray.map { it.jsonPrimitive.int }, mS.feed(spoken[17]), "stale revealed")
    assertEquals(stl.getValue("pos").jsonPrimitive.int, mS.pos, "stale pos")
    assertEquals(stl.getValue("resynced").jsonPrimitive.int, mS.resynced, "stale resynced")
  }

  @Test fun khatmahChallengesTasbihTajweedHadith() {
    val k = g.getValue("khatmah").jsonObject
    val plan = KhatmahPlan.make(1, "2026-09-01", 30, "21:00")
    assertEquals(Json.decodeFromJsonElement(KhatmahPlan.serializer(), k.getValue("plan")), plan)
    val log: ReadLog = mapOf("2026-09-08" to listOf(1, 2, 3), "2026-09-09" to listOf(4, 5), "2026-09-10" to listOf(6), "2026-08-15" to listOf(10, 11))
    assertEquals(Json.decodeFromJsonElement(KhatmahStatus.serializer(), k.getValue("status")), Khatmah.status(plan, 45, log, "2026-09-10"))
    assertEquals(Json.decodeFromJsonElement(KhatmahStatus.serializer(), k.getValue("status2")), Khatmah.status(KhatmahPlan.make(300, "2026-08-01", 60), 20, log, "2026-09-10"))
    assertEquals(k.getValue("streak").jsonPrimitive.int, Khatmah.streak(log, "2026-09-10")); assertEquals(k.getValue("streakYesterday").jsonPrimitive.int, Khatmah.streak(log, "2026-09-11")); assertEquals(k.getValue("streakNone").jsonPrimitive.int, Khatmah.streak(log, "2026-09-13"))
    assertEquals(k.getValue("logged").jsonObject.mapValues { it.value.jsonArray.map { x -> x.jsonPrimitive.int } }, Khatmah.log(log, "2026-09-10", 3))
    assertEquals(Json.decodeFromJsonElement(ReadStats.serializer(), k.getValue("stats")), Khatmah.stats(log, "2026-09-10"))
    assertEquals(k.getValue("daysBetween").jsonPrimitive.int, DayKey.daysBetween("2026-02-27", "2026-03-02")); assertEquals(k.getValue("addDays").jsonPrimitive.content, DayKey.adding("2026-12-30", 5)); assertEquals(k.getValue("pagesDone").jsonPrimitive.int, Khatmah.pagesDone(KhatmahPlan.make(600, "2026-01-01", 30), 5))
    val c = g.getValue("challenges").jsonObject
    val log2: ReadLog = mapOf("2026-09-04" to listOf(582, 583), "2026-09-05" to listOf(582, 583, 584), "2026-09-07" to listOf(585, 586, 587, 600), "2026-09-10" to listOf(588))
    assertEquals(Json.decodeFromJsonElement(ChallengeProgress.serializer(), c.getValue("progress")), Challenges.progress(ActiveChallenge("amma", "2026-09-05", 1, 582, 604), log2, "2026-09-10"))
    assertEquals(Json.decodeFromJsonElement(ChallengeProgress.serializer(), c.getValue("late")), Challenges.progress(ActiveChallenge("kahf", "2026-09-01", 1, 293, 304), log2, "2026-09-10"))
    val rel = c.getValue("relative").jsonObject; assertEquals(rel.getValue("from").jsonPrimitive.int to rel.getValue("to").jsonPrimitive.int, Challenges.resolveRange(Catalog.shared.challenge("juz-3days")!!, 300))
    assertEquals(c.getValue("heatmap").jsonArray.map { Json.decodeFromJsonElement(HeatDay.serializer(), it) }, Challenges.heatmap(log2, "2026-09-10", 7)); assertNull(Challenges.progress(null, log2, "2026-09-10")); assertEquals(8, Challenges.all.size)
    val tb = g.getValue("tasbih").jsonObject
    var ts = TasbihState(target = 3)
    for ((i, st0) in tb.getValue("steps").jsonArray.withIndex()) { val st = st0.jsonObject; if (st["undo"]?.jsonPrimitive?.booleanOrNull == true) ts = Tasbih.undo(ts, "2026-09-10") else { val r = Tasbih.tap(ts, "2026-09-10"); ts = r.first; assertEquals(st.getValue("reached").jsonPrimitive.boolean, r.second, "step $i") }; assertEquals(st.getValue("count").jsonPrimitive.int, ts.count, "step $i"); assertEquals(st.getValue("rounds").jsonPrimitive.int, ts.rounds); assertEquals(st.getValue("today").jsonPrimitive.int, Tasbih.todayCount(ts, "2026-09-10")); assertEquals(st.getValue("total").jsonPrimitive.int, Tasbih.totalCount(ts)) }
    ts = ts.copy(phrase = "hamd"); ts = Tasbih.tap(ts, "2026-09-11").first; ts = Tasbih.tap(ts, "2026-09-11").first
    assertEquals(tb.getValue("grand").jsonPrimitive.int, Tasbih.grandTotal(ts)); assertEquals(tb.getValue("todayHamd").jsonPrimitive.int, Tasbih.todayCount(ts, "2026-09-11")); assertEquals(tb.getValue("phraseText").jsonPrimitive.content, Tasbih.phraseText(ts))
    assertEquals(tb.getValue("custom").jsonPrimitive.content, Tasbih.phraseText(ts.copy(phrase = "custom", custom = " حسبي الله "))); assertEquals(tb.getValue("customEmpty").jsonPrimitive.content, Tasbih.phraseText(ts.copy(phrase = "custom", custom = "")))
    assertEquals(11, Tasbih.phrases.size); assertEquals(listOf(33, 99, 100, 1000, 0), Tasbih.targets)
    for (t0 in g.getValue("tajweed").jsonArray) { val t = t0.jsonObject; val n = t.getValue("n").jsonPrimitive.int; val exp = t["spans"]?.let { if (it is JsonNull) emptyList() else it.jsonArray.map { r -> val a = r.jsonArray; TajweedSpan(a[0].jsonPrimitive.int, a[1].jsonPrimitive.int, a[2].jsonPrimitive.content) } } ?: emptyList(); assertEquals(exp, Tajweed.shared.spans(n), "tajweed $n") }
    assertEquals("ghunnah", Tajweed.group("f")); assertEquals("madd6", Tajweed.group("m"))
    val a1 = QuranText.shared.ayah(1)!!.text; val toks = QuranNormalize.tokenize(a1); val segs = Tajweed.segments(toks[1].raw, a1.codePointCount(0, a1.indexOf(toks[1].raw)), Tajweed.shared.spans(1)); assertEquals(toks[1].raw, segs.joinToString("") { it.first }); assertTrue(segs.any { it.second == "h" })
    for (h0 in g.getValue("hadithOfDay").jsonArray) { val h = h0.jsonObject; assertEquals(h.getValue("id").jsonPrimitive.content, HadithLibrary.hadithOfDay(h.getValue("y").jsonPrimitive.int, h.getValue("m").jsonPrimitive.int, h.getValue("d").jsonPrimitive.int).id) }
    for (r0 in g.getValue("hadithRef").jsonArray) { val r = r0.jsonObject; assertEquals(r.getValue("ref").jsonPrimitive.content, HadithLibrary.hadiths.first { it.id == r.getValue("id").jsonPrimitive.content }.reference) }
    assertEquals(64, HadithLibrary.hadiths.size); assertEquals(42, HadithLibrary.nawawi.size); assertEquals(1, HadithLibrary.searchNawawi("بالنيات").first().n)
    assertEquals(24, Adhkar.all.size); assertTrue(Adhkar.all[2].text("evening").startsWith("أَمْسَيْنَا")); assertEquals(3, Adhkar.all[1].target("morning"))
    assertEquals(12, Hisn.sections.size); assertEquals(132, Hisn.chapters.size); assertEquals(267, Hisn.itemCount); assertTrue(Hisn.search("الاستيقاظ").first.isNotEmpty())
    assertEquals(7, Tafsir.surah(1).size); assertEquals(286, Tafsir.surah(2).size); assertTrue(Tafsir.runs(Tafsir.text(1, 1)!!).any { it.bold && it.text.contains("اللهِ") })
    assertEquals(listOf(Tafsir.Run("أ", false), Tafsir.Run("ب", true), Tafsir.Run("ج\nد ", false)), Tafsir.runs("أ<b>ب</b>ج<br>د&nbsp;"))
    val cat = Catalog.shared; assertEquals(21, cat.reciters.size); assertEquals(16, cat.themes.size); assertTrue(cat.reciter("ar.alafasy").hasWordTiming); assertEquals("dark", cat.migrateTheme(null, true, null)); assertEquals(9, cat.tajweed.legend.size)
  }

  @Test fun remindersAndBackup() {
    val prefs = ExtraReminderPrefs(adhkarMorning = true, adhkarEvening = true, morningAfter = 20, hadithDaily = true, hadithTime = "08:30")
    val zone = java.time.ZoneId.of("Asia/Amman"); val now = java.time.Instant.ofEpochSecond(1_788_912_000); val coords = Coordinates(31.9539, 35.9106); val params = PrayerParams(method = "Jordan")
    val items = Reminders.adhkar(coords, zone, params, prefs, now, 3)
    assertEquals(6, items.size); assertEquals("أذكار الصباح", items.first().title)
    assertEquals(PrayerTimes.compute(coords, CivilDate.of(now, zone), params).fajr!!.plusSeconds(20 * 60), items.first().time)
    val daily = Reminders.daily(prefs, KhatmahPlan.make(1, "2026-09-01", 30, "21:05")); assertEquals(listOf("daily:hadith", "daily:khatmah"), daily.map { it.id }); assertEquals(21, daily[1].hour); assertEquals(5, daily[1].minute)
    val up = Reminders.upcoming(coords, zone, params, ReminderPrefs(enabled = true, preMinutes = 10, prayers = setOf("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")), now, 60, format = { "5:00" })
    assertEquals(60, up.size); assertEquals(60, up.map { it.id }.toSet().size); assertEquals(60, up.map { Reminders.numericId(it) }.toSet().size); assertTrue(up.zipWithNext().all { it.first.time <= it.second.time })
    val json = """{"app":"sakinah","schema":1,"exportedAt":"2026-09-10T01:00:00.000Z","settings":{"location":{"lat":31.95,"lon":35.91,"tz":"Asia/Amman","name":"عمّان","countryCode":"JO","source":"gps"},"method":"Jordan","madhab":"shafi","hijriOffset":0,"hour12":true,"numerals":"arab",
      "notifications":{"enabled":true,"prayers":{"fajr":true,"sunrise":false},"preMinutes":10,"sound":"adhan-fakhry","adhkar":{"morning":true,"evening":false,"morningAfter":30,"eveningAfter":30},"hadithDaily":{"enabled":true,"time":"09:00"}},
      "quran":{"lastRead":{"page":293,"surah":18,"ayah":1,"at":1757466000000},"bookmarks":[{"surah":2,"ayah":255,"page":42,"at":1757466000000,"note":"آية الكرسي","color":"gold"}],"reciter":"ar.husary","khatmah":{"startPage":1,"startedAt":"2026-09-01","days":30,"dailyPages":21,"reminder":"21:00"},"readLog":{"2026-09-09":[1,2,3]},"challenge":{"id":"amma","startedAt":"2026-09-05","startPage":1,"from":582,"to":604},"unknownKey":5},
      "favorites":["h001","nawawi-1"],"tasbih":{"phrase":"hamd","target":99,"custom":"","count":5,"rounds":1,"totals":{"hamd":{"total":104,"today":104,"date":"2026-09-10"}}},"hisnFavorites":[27,1],"shareTheme":"green","extra":true}}"""
    val b = WebBackup.parse(json)
    assertEquals("Asia/Amman", b.settings.location!!.tz); assertEquals(10, b.settings.notifications!!.preMinutes); assertEquals(false, b.settings.notifications!!.prayers!!["sunrise"])
    assertEquals(293, b.settings.quran!!.lastRead!!.page); assertEquals("آية الكرسي", b.settings.quran!!.bookmarks!!.first().note); assertEquals(21, b.settings.quran!!.khatmah!!.dailyPages); assertEquals(604, b.settings.quran!!.challenge!!.to)
    assertEquals(104, b.settings.tasbih!!.totals["hamd"]!!.total); assertEquals(listOf(27, 1), b.settings.hisnFavorites)
    val again = WebBackup.parse(b.encoded()); assertEquals(listOf(1, 2, 3), again.settings.quran!!.readLog!!["2026-09-09"]); assertEquals("sakinah", again.app)
    assertEquals(5, WebBackup.parse("""{"quran":{"lastRead":{"page":5}}}""").settings.quran!!.lastRead!!.page)
    assertFailsWith<IllegalArgumentException> { WebBackup.parse("""{"foo":1}""") }
  }
}
