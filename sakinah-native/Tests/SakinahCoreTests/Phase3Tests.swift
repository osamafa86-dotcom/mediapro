import XCTest
@testable import SakinahCore

/// المرحلة 3ب–4: البحث والتطبيع والحفظ والختمة والتحدّيات والمسبحة والتجويد والحديث — مطابقة لمحرّك الويب (Fixtures/golden.json)
final class Phase3Tests: XCTestCase {
  private struct GNorm: Decodable { let s: String; let match: String; let a: String; let b: String }
  private struct GSearch: Decodable { let q: String; let n: [Int] }
  private struct GTok: Decodable { let n: Int; let words: [QuranNormalize.Token] }
  private struct GHifzStep: Decodable { let t: String; let revealed: [Int]; let pos: Int; let matched: Int; let skipped: Int; let unmatched: Int; let done: Bool; let progress: Double }
  private struct GHifzNoisy: Decodable { let t: String; let revealed: [Int]; let pos: Int }
  private struct GResyncRun: Decodable, Equatable { let pos: Int; let matched: Int; let skipped: Int; let unmatched: Int; let resynced: Int }
  private struct GResync: Decodable { let words: Int; let dropped: GResyncRun; let clean: GResyncRun; let noise: GResyncRun; let single: GResyncRun }
  private struct GBestOne: Decodable, Equatable { let revealed: [Int]; let pos: Int; let unmatched: Int }
  private struct GBest: Decodable { let droppedWithNoisyAlts: GResyncRun; let cleanWithFarAlts: GResyncRun; let emptyHypotheses: GBestOne; let altWins: GBestOne }
  private struct GHifz: Decodable { let words: [HifzWord]; let steps: [GHifzStep]; let noisy: [GHifzNoisy]; let resync: GResync; let best: GBest }
  private struct GLev: Decodable { let a: String; let b: String; let d: Int; let sim: Double }
  private struct GKhatmah: Decodable { let plan: KhatmahPlan; let status: KhatmahStatus; let status2: KhatmahStatus; let streak: Int; let streakYesterday: Int; let streakNone: Int; let logged: ReadLog; let stats: ReadStats; let daysBetween: Int; let addDays: String; let pagesDone: Int }
  private struct GRange: Decodable { let from: Int; let to: Int }
  private struct GChallenges: Decodable { let progress: ChallengeProgress; let late: ChallengeProgress; let relative: GRange; let relativeEnd: GRange; let heatmap: [HeatDay]; let none: ChallengeProgress? }
  private struct GTasbihStep: Decodable { let reached: Bool?; let undo: Bool?; let count: Int; let rounds: Int; let today: Int; let total: Int }
  private struct GTasbih: Decodable { let steps: [GTasbihStep]; let grand: Int; let todayHamd: Int; let phraseText: String; let custom: String; let customEmpty: String; let reset: TasbihState }
  private struct GTajweed: Decodable { let n: Int; let spans: [[TajweedCode]]? }
  private enum TajweedCode: Decodable, Equatable { case i(Int), s(String)
    init(from d: Decoder) throws { let c = try d.singleValueContainer(); if let i = try? c.decode(Int.self) { self = .i(i) } else { self = .s(try c.decode(String.self)) } } }
  private struct GHod: Decodable { let y: Int; let m: Int; let d: Int; let id: String }
  private struct GRef: Decodable { let id: String; let ref: String }
  private struct Golden: Decodable { let normalize: [GNorm]; let search: [GSearch]; let tokenize: [GTok]; let hifz: GHifz; let lev: [GLev]; let khatmah: GKhatmah; let challenges: GChallenges; let tasbih: GTasbih; let tajweed: [GTajweed]; let hadithOfDay: [GHod]; let hadithRef: [GRef] }
  private static let golden: Golden = {
    let url = Bundle.module.url(forResource: "golden", withExtension: "json", subdirectory: "Fixtures") ?? Bundle.module.url(forResource: "golden", withExtension: "json")!
    return try! JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
  }()

  func testNormalizeAndSearch() {
    let g = Self.golden
    for n in g.normalize {
      XCTAssertEqual(QuranNormalize.forMatch(n.s), n.match, "match: \(n.s)")
      XCTAssertEqual(QuranNormalize.forSearchA(n.s), n.a, "A: \(n.s)")
      XCTAssertEqual(QuranNormalize.forSearchB(n.s), n.b, "B: \(n.s)")
    }
    XCTAssertEqual(QuranNormalize.foldDigits("٢٥٥ و۱۲"), "255 و12")
    let s = QuranSearch.shared
    for q in g.search { XCTAssertEqual(s.search(q.q, limit: 30).map(\.n), q.n, "search: \(q.q)") }
    for t in g.tokenize { XCTAssertEqual(QuranNormalize.tokenize(QuranText.shared.ayah(t.n)!.text), t.words, "tokenize \(t.n)") }
    for l in g.lev { XCTAssertEqual(QuranNormalize.levenshtein(l.a, l.b), l.d); XCTAssertEqual(QuranNormalize.similarity(l.a, l.b), l.sim, accuracy: 1e-12) }
    XCTAssertEqual(QuranSearch.parseRef("2:255")?.surah.n, 2); XCTAssertEqual(QuranSearch.parseRef("٢ ٢٥٥")?.ayah, 255)
    XCTAssertEqual(QuranSearch.parseRef("الكهف 10")?.surah.n, 18); XCTAssertEqual(QuranSearch.parseRef("سورة البقرة آية 255")?.ayah, 255)
    XCTAssertNil(QuranSearch.parseRef("255")); XCTAssertNil(QuranSearch.parseRef("999:1"))
    XCTAssertEqual(QuranSearch.matchSurahs("البقره").first?.n, 2); XCTAssertTrue(QuranSearch.matchSurahs("kahf").isEmpty) // كالويب: المفتاح العربي فارغ فلا نتائج
    XCTAssertEqual(QuranSearch.refLabel(QuranText.shared.ayah(262)!), "البقرة: 255")
  }

  func testHifzMatcher() {
    let g = Self.golden.hifz
    let words = HifzMatcher.words(from: QuranText.shared.pageAyahs(1))
    XCTAssertEqual(words, g.words)
    let m = HifzMatcher(words: words)
    for st in g.steps {
      XCTAssertEqual(m.feed(st.t), st.revealed, st.t)
      XCTAssertEqual(m.pos, st.pos); XCTAssertEqual(m.matched, st.matched); XCTAssertEqual(m.skipped, st.skipped); XCTAssertEqual(m.unmatched, st.unmatched); XCTAssertEqual(m.done, st.done); XCTAssertEqual(m.progress, st.progress, accuracy: 1e-12)
    }
    let m2 = HifzMatcher(words: words)
    for st in g.noisy {
      let r = st.t == "hint" ? [m2.hint()!] : m2.feed(st.t)
      XCTAssertEqual(r, st.revealed, st.t)
    }
    XCTAssertEqual(m2.pos, g.noisy.last!.pos)

    // إعادة التزامن — سورة الرحمن، لأن «فبأي آلاء ربكما تكذبان» تتكرّر ٣١ مرة فهي أقسى اختبار للقفز الخاطئ
    let r = g.resync
    let rw = HifzMatcher.words(from: QuranText.shared.surahAyahs(55))
    XCTAssertEqual(rw.count, r.words)
    let spoken = rw.map(\.norm)
    func run(_ seq: [String]) -> GResyncRun {
      let m = HifzMatcher(words: rw)
      for w in seq { m.feed(w) }
      return GResyncRun(pos: m.pos, matched: m.matched, skipped: m.skipped, unmatched: m.unmatched, resynced: m.resynced)
    }
    XCTAssertEqual(run(Array(spoken[0..<8]) + Array(spoken[13..<60])), r.dropped)  // التعرّف أسقط ٥ كلمات
    XCTAssertEqual(run(Array(spoken[0..<60])), r.clean)                            // تلاوة سليمة كلمةً كلمة
    XCTAssertEqual(run("السلام عليكم كيف حالك اليوم الطقس جميل هنا".split(separator: " ").map(String.init)), r.noise)
    XCTAssertEqual(run([spoken[0], "xxxxxxxx", spoken[40]]), r.single)             // كلمة بعيدة واحدة لا تكفي للقفز

    // feedBest: البدائل فرضيات لصوت واحد، فلا يجوز أن يمحو ضجيجُها مرشّحَ إعادة التزامن
    let b = g.best
    func runBest(_ seq: [String], _ alts: [String]) -> GResyncRun {
      let m = HifzMatcher(words: rw)
      for w in seq { m.feedBest([w] + alts) }
      return GResyncRun(pos: m.pos, matched: m.matched, skipped: m.skipped, unmatched: m.unmatched, resynced: m.resynced)
    }
    XCTAssertEqual(runBest(Array(spoken[0..<8]) + Array(spoken[14..<60]), ["غرغرة", "اه"]), b.droppedWithNoisyAlts)
    XCTAssertEqual(runBest(Array(spoken[0..<60]), ["xxxxxxxx"]), b.cleanWithFarAlts)
    let mEmpty = HifzMatcher(words: rw)
    XCTAssertEqual(GBestOne(revealed: mEmpty.feedBest(["", ""]), pos: mEmpty.pos, unmatched: mEmpty.unmatched), b.emptyHypotheses)
    let mAlt = HifzMatcher(words: rw)  // الفرضية الأولى فاشلة والثانية تكشف: لا أثر للأولى
    XCTAssertEqual(GBestOne(revealed: mAlt.feedBest(["xxxxxxxx", spoken[0]]), pos: mAlt.pos, unmatched: mAlt.unmatched), b.altWins)
  }

  func testKhatmahChallengesTasbih() {
    let g = Self.golden
    let plan = KhatmahPlan(startPage: 1, startedAt: "2026-09-01", days: 30, reminder: "21:00")
    XCTAssertEqual(plan, g.khatmah.plan)
    let log: ReadLog = ["2026-09-08": [1, 2, 3], "2026-09-09": [4, 5], "2026-09-10": [6], "2026-08-15": [10, 11]]
    XCTAssertEqual(Khatmah.status(plan, currentPage: 45, log: log, today: "2026-09-10"), g.khatmah.status)
    XCTAssertEqual(Khatmah.status(KhatmahPlan(startPage: 300, startedAt: "2026-08-01", days: 60), currentPage: 20, log: log, today: "2026-09-10"), g.khatmah.status2)
    XCTAssertEqual(Khatmah.streak(log, today: "2026-09-10"), g.khatmah.streak); XCTAssertEqual(Khatmah.streak(log, today: "2026-09-11"), g.khatmah.streakYesterday); XCTAssertEqual(Khatmah.streak(log, today: "2026-09-13"), g.khatmah.streakNone)
    XCTAssertEqual(Khatmah.log(log, today: "2026-09-10", page: 3), g.khatmah.logged)
    XCTAssertEqual(Khatmah.stats(log, today: "2026-09-10"), g.khatmah.stats)
    XCTAssertEqual(DayKey.daysBetween("2026-02-27", "2026-03-02"), g.khatmah.daysBetween); XCTAssertEqual(DayKey.adding("2026-12-30", days: 5), g.khatmah.addDays)
    XCTAssertEqual(Khatmah.pagesDone(KhatmahPlan(startPage: 600, startedAt: "2026-01-01", days: 30), currentPage: 5), g.khatmah.pagesDone)
    XCTAssertEqual(DayKey.key(Date(timeIntervalSince1970: 1_788_912_000), tz: TimeZone(identifier: "Asia/Amman")!), "2026-09-09")

    let log2: ReadLog = ["2026-09-04": [582, 583], "2026-09-05": [582, 583, 584], "2026-09-07": [585, 586, 587, 600], "2026-09-10": [588]]
    XCTAssertEqual(Challenges.progress(ActiveChallenge(id: "amma", startedAt: "2026-09-05", startPage: 1, from: 582, to: 604), log: log2, today: "2026-09-10"), g.challenges.progress)
    XCTAssertEqual(Challenges.progress(ActiveChallenge(id: "kahf", startedAt: "2026-09-01", startPage: 1, from: 293, to: 304), log: log2, today: "2026-09-10"), g.challenges.late)
    let r = Challenges.resolveRange(Catalog.shared.challenge("juz-3days")!, startPage: 300); XCTAssertEqual(r.from, g.challenges.relative.from); XCTAssertEqual(r.to, g.challenges.relative.to)
    let r2 = Challenges.resolveRange(Catalog.shared.challenge("hizb-daily")!, startPage: 590); XCTAssertEqual(r2.to, g.challenges.relativeEnd.to)
    XCTAssertEqual(Challenges.heatmap(log2, today: "2026-09-10", days: 7), g.challenges.heatmap)
    XCTAssertNil(Challenges.progress(nil, log: log2, today: "2026-09-10"))
    XCTAssertEqual(Challenges.all.count, 8)

    var ts = TasbihState(); ts.target = 3
    for (i, st) in g.tasbih.steps.enumerated() {
      if st.undo == true { ts = Tasbih.undo(ts, today: "2026-09-10") } else { let r = Tasbih.tap(ts, today: "2026-09-10"); ts = r.state; XCTAssertEqual(r.reached, st.reached, "step \(i)") }
      XCTAssertEqual(ts.count, st.count, "step \(i)"); XCTAssertEqual(ts.rounds, st.rounds); XCTAssertEqual(Tasbih.todayCount(ts, today: "2026-09-10"), st.today); XCTAssertEqual(Tasbih.totalCount(ts), st.total)
    }
    ts.phrase = "hamd"; ts = Tasbih.tap(ts, today: "2026-09-11").state; ts = Tasbih.tap(ts, today: "2026-09-11").state
    XCTAssertEqual(Tasbih.grandTotal(ts), g.tasbih.grand); XCTAssertEqual(Tasbih.todayCount(ts, today: "2026-09-11"), g.tasbih.todayHamd); XCTAssertEqual(Tasbih.phraseText(ts), g.tasbih.phraseText)
    var c = ts; c.phrase = "custom"; c.custom = " حسبي الله "; XCTAssertEqual(Tasbih.phraseText(c), g.tasbih.custom); c.custom = ""; XCTAssertEqual(Tasbih.phraseText(c), g.tasbih.customEmpty)
    XCTAssertEqual(Tasbih.reset(ts), g.tasbih.reset)
    XCTAssertEqual(Tasbih.phrases.count, 11); XCTAssertEqual(Tasbih.targets, [33, 99, 100, 1000, 0])
  }

  func testTajweedHadithAdhkarTafsirCatalog() {
    let g = Self.golden
    for t in g.tajweed {
      let sp = Tajweed.shared.spans(t.n)
      let exp = (t.spans ?? []).map { row -> TajweedSpan in
        guard case .i(let a) = row[0], case .i(let b) = row[1], case .s(let c) = row[2] else { fatalError() }
        return TajweedSpan(start: a, length: b, code: c)
      }
      XCTAssertEqual(sp, exp, "tajweed \(t.n)")
    }
    XCTAssertEqual(Tajweed.group(of: "f"), "ghunnah"); XCTAssertEqual(Tajweed.group(of: "m"), "madd6"); XCTAssertEqual(Tajweed.group(of: "zz"), "other")
    // تقسيم كلمة: «ٱللَّهِ» في البسملة: الهمزة موصولة (h) في الموضع 7 واللام الشمسية (l) في 16؟ نتحقق من أن مجموع المقاطع يعيد الكلمة
    let a1 = QuranText.shared.ayah(1)!.text; let toks = QuranNormalize.tokenize(a1)
    let scalars = Array(a1.unicodeScalars); var pos = 0
    for t in toks {
      let start = QuranTextIndex.find(t.raw, in: scalars, from: pos); pos = start + t.raw.unicodeScalars.count
      let segs = Tajweed.segments(word: t.raw, start: start, spans: Tajweed.shared.spans(1))
      XCTAssertEqual(segs.map(\.text).joined(), t.raw)
    }
    XCTAssertTrue(Tajweed.segments(word: toks[1].raw, start: QuranTextIndex.find(toks[1].raw, in: scalars, from: 0), spans: Tajweed.shared.spans(1)).contains { $0.code == "h" })

    for h in g.hadithOfDay { XCTAssertEqual(HadithLibrary.hadithOfDay(year: h.y, month: h.m, day: h.d).id, h.id) }
    for r in g.hadithRef { XCTAssertEqual(HadithLibrary.hadiths.first { $0.id == r.id }!.reference, r.ref) }
    XCTAssertEqual(HadithLibrary.hadiths.count, 64); XCTAssertEqual(HadithLibrary.nawawi.count, 42); XCTAssertEqual(HadithLibrary.topics.count, 9)
    XCTAssertEqual(HadithLibrary.searchNawawi("بالنيات").first?.n, 1); XCTAssertFalse(HadithLibrary.searchSahih("الإسلام").isEmpty)
    XCTAssertEqual(HadithLibrary.searchSahih("", topic: "العقيدة").count, HadithLibrary.hadiths.filter { $0.topic == "العقيدة" }.count)

    XCTAssertEqual(Adhkar.all.count, 24); XCTAssertEqual(Adhkar.items(for: "morning").count + Adhkar.items(for: "evening").count - Adhkar.all.filter { $0.period == "both" }.count, 24)
    XCTAssertTrue(Adhkar.all[2].text(for: "evening").hasPrefix("أَمْسَيْنَا")); XCTAssertEqual(Adhkar.all[1].target(for: "morning"), 3)
    XCTAssertEqual(Hisn.sections.count, 12); XCTAssertEqual(Hisn.chapters.count, 132); XCTAssertEqual(Hisn.itemCount, 267)
    XCTAssertEqual(Hisn.chapter(27)?.title.contains("الصباح"), true)
    let hs = Hisn.search("الاستيقاظ"); XCTAssertFalse(hs.chapters.isEmpty)
    XCTAssertEqual(Hisn.chapters[0].items[0].audioURL.absoluteString, "https://www.hisnmuslim.com/audio/ar/1.mp3")

    XCTAssertEqual(Tafsir.shared.surah(1).count, 7); XCTAssertEqual(Tafsir.shared.surah(2).count, 286); XCTAssertNil(Tafsir.shared.text(surah: 1, ayah: 8))
    let runs = Tafsir.runs(Tafsir.shared.text(surah: 1, ayah: 1)!)
    XCTAssertTrue(runs.contains { $0.bold && $0.text.contains("اللهِ") }); XCTAssertFalse(Tafsir.plain(Tafsir.shared.text(surah: 1, ayah: 1)!).contains("<"))
    XCTAssertEqual(Tafsir.runs("أ<b>ب</b>ج<br>د&nbsp;"), [Tafsir.Run(text: "أ", bold: false), Tafsir.Run(text: "ب", bold: true), Tafsir.Run(text: "ج\nد ", bold: false)])

    let c = Catalog.shared
    XCTAssertEqual(c.reciters.count, 21); XCTAssertEqual(c.defaultReciter, "ar.alafasy"); XCTAssertTrue(c.reciter("ar.alafasy").hasWordTiming); XCTAssertEqual(c.reciter("nope").id, "ar.alafasy")
    XCTAssertEqual(c.themes.count, 16); XCTAssertEqual(c.theme("dusk").isDark, true); XCTAssertEqual(c.migrateTheme(theme: nil, night: true, paper: nil), "dark"); XCTAssertEqual(c.migrateTheme(theme: "sky", night: true, paper: nil), "sky")
    for t in c.themes { XCTAssertGreaterThanOrEqual(HexColor.contrast(HexColor(t.paper)!, HexColor(t.ink)!), 7, t.id) }
    XCTAssertEqual(c.tajweed.legend.count, 9); XCTAssertEqual(c.tajweed.light["madd6"], "#b3001b"); XCTAssertEqual(c.tafsirSources.first?.id, "muyassar")
  }

  func testRemindersExtrasAndBackup() throws {
    var prefs = ExtraReminderPrefs(); prefs.adhkarMorning = true; prefs.adhkarEvening = true; prefs.morningAfter = 20; prefs.hadithDaily = true; prefs.hadithTime = "08:30"
    var params = PrayerParams(); params.method = "Jordan"
    let tz = TimeZone(identifier: "Asia/Amman")!; let now = Date(timeIntervalSince1970: 1_788_912_000)
    let items = Reminders.adhkar(coords: Coordinates(latitude: 31.9539, longitude: 35.9106), tz: tz, params: params, prefs: prefs, now: now, days: 3)
    XCTAssertEqual(items.count, 6); XCTAssertTrue(items.allSatisfy { $0.kind == .adhkar }); XCTAssertEqual(items.first?.title, "أذكار الصباح")
    let day = PrayerTimes.compute(coords: Coordinates(latitude: 31.9539, longitude: 35.9106), date: CivilDate(now, in: tz), params: params)
    XCTAssertEqual(items.first?.time, day.fajr!.addingTimeInterval(20 * 60))
    let daily = Reminders.daily(prefs: prefs, khatmah: KhatmahPlan(startPage: 1, startedAt: "2026-09-01", days: 30, reminder: "21:05"))
    XCTAssertEqual(daily.map(\.id), ["daily:hadith", "daily:khatmah"]); XCTAssertEqual(daily[1].hour, 21); XCTAssertEqual(daily[1].minute, 5); XCTAssertEqual(daily[0].minute, 30)
    XCTAssertTrue(Reminders.daily(prefs: ExtraReminderPrefs(), khatmah: nil).isEmpty)

    // نسخة احتياطية من الويب (مقتطف واقعي) → قراءة، ثم إعادة تصدير وقراءة
    let json = """
    {"app":"sakinah","schema":1,"exportedAt":"2026-09-10T01:00:00.000Z","settings":{"location":{"lat":31.95,"lon":35.91,"tz":"Asia/Amman","name":"عمّان","countryCode":"JO","source":"gps"},"method":"Jordan","madhab":"shafi","hijriOffset":0,"hour12":true,"numerals":"arab",
    "notifications":{"enabled":true,"prayers":{"fajr":true,"sunrise":false,"dhuhr":true,"asr":true,"maghrib":true,"isha":true},"preMinutes":10,"sound":"adhan-fakhry","adhkar":{"morning":true,"evening":false,"morningAfter":30,"eveningAfter":30},"hadithDaily":{"enabled":true,"time":"09:00"}},
    "quran":{"lastRead":{"page":293,"surah":18,"ayah":1,"at":1757466000000},"bookmarks":[{"surah":2,"ayah":255,"page":42,"at":1757466000000,"note":"آية الكرسي","color":"gold"}],"reciter":"ar.husary","repeatAyah":3,"rate":1.25,"theme":"sepia","themeAuto":true,"tajweed":true,"view":"text","fontScale":1.2,"lineHeight":2.3,
    "khatmah":{"startPage":1,"startedAt":"2026-09-01","days":30,"dailyPages":21,"reminder":"21:00"},"readLog":{"2026-09-09":[1,2,3]},"challenge":{"id":"amma","startedAt":"2026-09-05","startPage":1,"from":582,"to":604},"unknownKey":5},
    "adhkarProgress":{"date":"2026-09-10","morning":{"a01":1},"evening":{}},"favorites":["h001","nawawi-1"],"tasbih":{"phrase":"hamd","target":99,"custom":"","count":5,"rounds":1,"totals":{"hamd":{"total":104,"today":104,"date":"2026-09-10"}}},"hisnFavorites":[27,1],"shareTheme":"green","extra":true}}
    """
    let b = try WebBackup.parse(Data(json.utf8))
    XCTAssertEqual(b.settings.location?.tz, "Asia/Amman"); XCTAssertEqual(b.settings.method, "Jordan"); XCTAssertEqual(b.settings.notifications?.preMinutes, 10); XCTAssertEqual(b.settings.notifications?.prayers?["sunrise"], false)
    XCTAssertEqual(b.settings.quran?.lastRead?.page, 293); XCTAssertEqual(b.settings.quran?.bookmarks?.first?.note, "آية الكرسي"); XCTAssertEqual(b.settings.quran?.khatmah?.dailyPages, 21); XCTAssertEqual(b.settings.quran?.challenge?.to, 604)
    XCTAssertEqual(b.settings.tasbih?.totals["hamd"]?.total, 104); XCTAssertEqual(b.settings.hisnFavorites, [27, 1]); XCTAssertEqual(b.settings.favorites?.count, 2)
    let again = try WebBackup.parse(try b.encoded())
    XCTAssertEqual(again.settings.quran?.readLog?["2026-09-09"], [1, 2, 3]); XCTAssertEqual(again.app, "sakinah")
    let bare = try WebBackup.parse(Data("{\"quran\":{\"lastRead\":{\"page\":5}}}".utf8)); XCTAssertEqual(bare.settings.quran?.lastRead?.page, 5)
    XCTAssertThrowsError(try WebBackup.parse(Data("{\"foo\":1}".utf8)))
  }
}

/// موضع نص كلمة داخل مصفوفة رموز الآية (كما يفعل indexOf في الويب)
enum QuranTextIndex {
  static func find(_ word: String, in scalars: [Unicode.Scalar], from: Int) -> Int {
    let w = Array(word.unicodeScalars); guard !w.isEmpty, scalars.count >= w.count else { return from }
    var i = max(0, from)
    while i + w.count <= scalars.count { if Array(scalars[i..<i + w.count]) == w { return i }; i += 1 }
    return from
  }
}
