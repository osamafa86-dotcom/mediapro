import SwiftUI
import SakinahCore

// MARK: - البحث الشامل (المرحلة الثانية — تصميم «البحث — iOS»)
// حقلٌ واحد يجد الآيات والأذكار والأحاديث والأدوات والإعدادات. المطابقة عربيةٌ متسامحة (بلا تشكيل ولا تطويل،
// وتوحيد أ إ آ ٱ ← ا، ة ← ه، ى ← ي)، والقرآن عبر QuranSearch في النواة (يفهم الرسم العثماني والمراجع «البقرة ٢٥٥»).
// البحث يجري خارج الخيط الرئيس بعد سكونٍ قصير في الكتابة (٢٥٠ م.ث).
// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.

/// نطاق البحث (الشرائح)
enum SearchScope: Int, CaseIterable, Identifiable, Sendable {
  case all, quran, adhkar, hadith, tools
  var id: Int { rawValue }
  var title: String {
    switch self { case .all: return "الكل"; case .quran: return "القرآن"; case .adhkar: return "الأذكار"; case .hadith: return "الأحاديث"; case .tools: return "الأدوات" }
  }
}

/// تطبيع عربي للمطابقة: يحذف التشكيل والتطويل وعلامات المصحف ومحارف الاتجاه، ويوحّد الألفات والتاء المربوطة والألف المقصورة
enum SearchText {
  static func fold(_ s: String) -> String {
    var out: [Unicode.Scalar] = []
    out.reserveCapacity(s.unicodeScalars.count)
    for sc in s.unicodeScalars {
      let v = sc.value
      if ignorable(v) { continue }
      switch v {
      case 0x0671, 0x0623, 0x0625, 0x0622: out.append("ا")
      case 0x0629: out.append("ه")
      case 0x0649: out.append("ي")
      default: out.append(sc)
      }
    }
    return String(String.UnicodeScalarView(out)).lowercased()
  }
  /// التشكيل وعلامات المصحف (والألف الخنجرية) والتطويل ومحارف الاتجاه غير المرئية
  private static func ignorable(_ v: UInt32) -> Bool {
    if v >= 0x0610 && v <= 0x061A { return true }
    if v >= 0x064B && v <= 0x065F { return true }
    if v == 0x0670 || v == 0x0640 { return true }
    if v >= 0x06D6 && v <= 0x06ED { return true }
    if v >= 0x200B && v <= 0x200F { return true }
    if v >= 0x2066 && v <= 0x2069 { return true }
    return false
  }
  /// كلمات الاستعلام بعد التطبيع (حرفان فأكثر)
  static func tokens(_ q: String) -> [String] {
    fold(q).split(whereSeparator: { $0 == " " || $0 == "\n" || $0 == "\t" }).map(String.init).filter { $0.count >= 2 }
  }
  /// كل الكلمات موجودةٌ في النصّ المطبَّع
  static func matches(_ folded: String, _ tokens: [String]) -> Bool { !tokens.isEmpty && tokens.allSatisfy { folded.contains($0) } }
}

/// الأدوات والإعدادات التي يجدها البحث بالكلمات المفتاحية وتُفتح مباشرةً
enum SearchTool: String, CaseIterable, Identifiable, Hashable, Sendable {
  case qibla, method, asr, location, monthTable, adhanGuard, notifications, tasbih, mosques, hisn, nawawi, khatmah, reciter, mushafDisplay, downloads, sky, formats, backup, widgets, privacy, settings
  var id: String { rawValue }
  var title: String {
    switch self {
    case .qibla: return "القبلة"
    case .method: return "طريقة الحساب"
    case .asr: return "وقت العصر"
    case .location: return "الموقع"
    case .monthTable: return "الجدول الشهري"
    case .adhanGuard: return "ضمان الأذان"
    case .notifications: return "الأذان والتنبيهات"
    case .tasbih: return "المسبحة"
    case .mosques: return "المساجد القريبة"
    case .hisn: return "حصن المسلم"
    case .nawawi: return "الأربعون النووية"
    case .khatmah: return "الختمة والورد"
    case .reciter: return "القارئ"
    case .mushafDisplay: return "المصحف والخط"
    case .downloads: return "التنزيلات"
    case .sky: return "السماء"
    case .formats: return "الأرقام والوقت والتاريخ"
    case .backup: return "النسخة الاحتياطية"
    case .widgets: return "الودجت والنشاط المباشر"
    case .privacy: return "الخصوصية"
    case .settings: return "الإعدادات"
    }
  }
  var subtitle: String {
    switch self {
    case .qibla: return "البوصلة واتجاه الكعبة"
    case .method: return "هيئة الحساب وخطوط العرض العالية"
    case .asr: return "الجمهور أو الحنفي"
    case .location: return "المدينة أو موقع الجهاز"
    case .monthTable: return "مواقيت الشهر وتصديرها إلى التقويم"
    case .adhanGuard: return "فحص ما قد يحجب الأذان على جهازك"
    case .notifications: return "صوت الأذان والتنبيه قبل الصلاة"
    case .tasbih: return "عدّاد التسبيح والإحصاء"
    case .mosques: return "أقرب مسجد والاتجاهات إليه"
    case .hisn: return "الأبواب كاملةً"
    case .nawawi: return "للإمام النووي بمتونها وتخريجها"
    case .khatmah: return "خطة الختمة وتذكير الورد"
    case .reciter: return "صوت التلاوة"
    case .mushafDisplay: return "السمة وطريقة العرض وسماكة الخط"
    case .downloads: return "التلاوات دون اتصال"
    case .sky: return "خلفية «اليوم» والطقس"
    case .formats: return "الأرقام ونظام الساعة والتاريخ الهجري"
    case .backup: return "تصدير إعداداتك واستيرادها"
    case .widgets: return "شاشة القفل والجزيرة الديناميكية"
    case .privacy: return "ما يبقى على جهازك وما يُرسَل"
    case .settings: return "كل الإعدادات"
    }
  }
  var icon: String {
    switch self {
    case .qibla: return "location.north.line"
    case .method: return "calendar"
    case .asr: return "sun.max"
    case .location: return "mappin.and.ellipse"
    case .monthTable: return "calendar"
    case .adhanGuard: return "checkmark.shield"
    case .notifications: return "bell"
    case .tasbih: return "circle.hexagongrid"
    case .mosques: return "building.columns"
    case .hisn: return "shield"
    case .nawawi: return "list.bullet.rectangle"
    case .khatmah: return "book.closed"
    case .reciter: return "headphones"
    case .mushafDisplay: return "textformat.size"
    case .downloads: return "arrow.down.circle"
    case .sky: return "cloud.sun"
    case .formats: return "textformat.123"
    case .backup: return "externaldrive"
    case .widgets: return "bolt"
    case .privacy: return "hand.raised"
    case .settings: return "slider.horizontal.3"
    }
  }
  /// كلمات تُطابَق بعد التطبيع (العنوان يُضاف إليها تلقائيًا)
  var keywords: [String] {
    switch self {
    case .qibla: return ["قبلة", "بوصلة", "البوصلة", "الكعبة", "اتجاه"]
    case .method: return ["الحساب", "طريقة", "الهيئة", "خطوط العرض", "رابطة العالم الإسلامي", "أم القرى"]
    case .asr: return ["العصر", "المذهب", "مذهب", "الحنفي", "الجمهور"]
    case .location: return ["موقع", "المدينة", "مدينة", "الدولة", "gps"]
    case .monthTable: return ["الجدول", "جدول", "الشهر", "التقويم", "تقويم", "ics"]
    case .adhanGuard: return ["ضمان", "فحص الأذان", "التركيز", "عدم الإزعاج"]
    case .notifications: return ["الأذان", "أذان", "التنبيهات", "تنبيه", "الإشعارات", "إشعار", "صوت الأذان", "المؤذن"]
    case .tasbih: return ["مسبحة", "سبحة", "تسبيح", "عداد"]
    case .mosques: return ["مسجد", "المساجد", "مساجد", "جامع"]
    case .hisn: return ["حصن", "الأدعية", "أدعية"]
    case .nawawi: return ["الأربعون", "الأربعين", "النووية", "النووي"]
    case .khatmah: return ["الختمة", "ختمة", "الورد", "ورد"]
    case .reciter: return ["قارئ", "التلاوة", "تلاوة", "الشيخ"]
    case .mushafDisplay: return ["الخط", "خط المصحف", "المصحف", "السمة", "التجويد", "الوضع الليلي"]
    case .downloads: return ["تنزيل", "تحميل", "دون اتصال", "بدون انترنت"]
    case .sky: return ["سماء", "الطقس", "طقس", "الخلفية", "الحرارة"]
    case .formats: return ["الأرقام", "أرقام", "١٢ ساعة", "12 ساعة", "الساعة", "الهجري", "التاريخ", "الاهتزاز"]
    case .backup: return ["النسخ", "نسخة احتياطية", "احتياطي", "استيراد", "تصدير"]
    case .widgets: return ["الودجت", "ودجت", "النشاط المباشر", "شاشة القفل", "الجزيرة"]
    case .privacy: return ["خصوصية", "تتبع", "البيانات"]
    case .settings: return ["إعدادات", "ضبط", "حجم الخط", "تكبير الخط"]
    }
  }
}

// MARK: - النتائج (قيمٌ تعبر من خيط البحث إلى الواجهة)
struct SearchAyahHit: Identifiable, Sendable {
  let ayah: Ayah
  let words: [String]
  /// مواضع الكلمات المطابقة (تُلوَّن بلون الهوية)
  let hits: Set<Int>
  var id: Int { ayah.n }
}
struct SearchDhikrHit: Identifiable, Sendable {
  enum Target: Hashable, Sendable { case session(String), chapter(Int) }
  let id: String
  let title: String
  let source: String
  let icon: String
  let target: Target
}
struct SearchHadithHit: Identifiable, Sendable {
  let id: String
  /// مقتطفٌ حول أوّل كلمة مطابقة
  let words: [String]
  let hits: Set<Int>
  let leadingEllipsis: Bool
  let trailingEllipsis: Bool
  let source: String
  /// sahih | nawawi
  let book: String
}
struct SearchResults: Sendable {
  var tools: [SearchTool] = []
  var ayat: [SearchAyahHit] = []
  var adhkar: [SearchDhikrHit] = []
  var hadith: [SearchHadithHit] = []
  var isEmpty: Bool { tools.isEmpty && ayat.isEmpty && adhkar.isEmpty && hadith.isEmpty }
  static let empty = SearchResults()
}

/// محرّك البحث: دوالّ خالصة على بيانات النواة (تُستدعى خارج الخيط الرئيس)
enum SearchEngine {
  static func run(_ raw: String) -> SearchResults {
    let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    var r = SearchResults()
    guard !q.isEmpty else { return r }
    let tokens = SearchText.tokens(q)
    r.tools = tools(q)
    r.ayat = ayat(q)
    r.adhkar = adhkar(tokens)
    r.hadith = hadith(tokens)
    return r
  }

  // MARK: القرآن
  static func ayat(_ q: String, limit: Int = 50) -> [SearchAyahHit] {
    var out: [SearchAyahHit] = []
    var seen = Set<Int>()
    // «البقرة ٢٥٥» أو «2:255» → الآية نفسها أولًا
    if let ref = QuranSearch.parseRef(q), let a = QuranText.shared.ayah(surah: ref.surah.n, ayah: min(ref.surah.ayahs, ref.ayah)) {
      out.append(hit(a, tokensA: [], tokensB: []))
      seen.insert(a.n)
    }
    let tA = QuranNormalize.forSearchA(q).split(separator: " ").map(String.init).filter { $0.count >= 2 }
    let tB = QuranNormalize.forSearchB(q).split(separator: " ").map(String.init).filter { $0.count >= 2 }
    for a in QuranSearch.shared.search(q, limit: limit) where !seen.contains(a.n) {
      out.append(hit(a, tokensA: tA, tokensB: tB))
      seen.insert(a.n)
    }
    return out
  }
  private static func hit(_ a: Ayah, tokensA: [String], tokensB: [String]) -> SearchAyahHit {
    let words = a.text.split(separator: " ").map(String.init)
    var hits = Set<Int>()
    if !tokensA.isEmpty || !tokensB.isEmpty {
      for (i, w) in words.enumerated() {
        let wa = QuranNormalize.forSearchA(w), wb = QuranNormalize.forSearchB(w)
        if tokensA.contains(where: { wa.contains($0) }) || tokensB.contains(where: { wb.contains($0) }) { hits.insert(i) }
      }
    }
    return SearchAyahHit(ayah: a, words: words, hits: hits)
  }

  // MARK: الأذكار (جلستا الصباح والمساء، وأبواب حصن المسلم بعناوينها ثم بنصوصها)
  private struct HisnEntry: Sendable { let chapter: HisnChapter; let title: String; let body: String; let section: String? }
  private static let hisnIndex: [HisnEntry] = Hisn.chapters.map { c in
    HisnEntry(chapter: c, title: SearchText.fold(c.title),
              body: c.items.map { SearchText.fold($0.text) }.joined(separator: " "),
              section: Hisn.sections.first(where: { $0.chapters.contains(c.id) })?.title)
  }
  static func adhkar(_ tokens: [String], limit: Int = 30) -> [SearchDhikrHit] {
    guard !tokens.isEmpty else { return [] }
    var out: [SearchDhikrHit] = []
    let sessions: [(period: String, title: String)] = [(period: "morning", title: "أذكار الصباح"), (period: "evening", title: "أذكار المساء")]
    for s in sessions where SearchText.matches(SearchText.fold(s.title), tokens) {
      out.append(SearchDhikrHit(id: "session-\(s.period)", title: s.title, source: "بعدّادٍ يومي في تبويب «الذكر»",
                                icon: s.period == "morning" ? "sunrise" : "moon", target: .session(s.period)))
    }
    let byTitle = hisnIndex.filter { SearchText.matches($0.title, tokens) }
    let byBody = hisnIndex.filter { !SearchText.matches($0.title, tokens) && SearchText.matches($0.body, tokens) }
    for e in byTitle + byBody {
      if out.count >= limit { break }
      out.append(SearchDhikrHit(id: "hisn-\(e.chapter.id)", title: e.chapter.title, source: e.section.map { "حصن المسلم، \($0)" } ?? "حصن المسلم",
                                icon: "shield", target: .chapter(e.chapter.id)))
    }
    return out
  }

  // MARK: الأحاديث (مختارات الصحيحين ثم الأربعون النووية)
  private struct HadithEntry: Sendable { let id: String; let words: [String]; let folded: [String]; let haystack: String; let source: String; let book: String }
  private static let hadithIndex: [HadithEntry] = {
    var out: [HadithEntry] = []
    for h in HadithLibrary.hadiths {
      let words = h.text.split(separator: " ").map(String.init)
      let folded = words.map { SearchText.fold($0) }
      out.append(HadithEntry(id: h.id, words: words, folded: folded, haystack: folded.joined(separator: " ") + " " + SearchText.fold(h.narrator),
                             source: "\(h.grade)، عن \(h.narrator)", book: "sahih"))
    }
    for n in HadithLibrary.nawawi {
      let words = n.text.split(separator: " ").map(String.init)
      let folded = words.map { SearchText.fold($0) }
      out.append(HadithEntry(id: n.id, words: words, folded: folded, haystack: folded.joined(separator: " ") + " " + SearchText.fold(n.title),
                             source: "الأربعون النووية، \(n.title)", book: "nawawi"))
    }
    return out
  }()
  static func hadith(_ tokens: [String], limit: Int = 40) -> [SearchHadithHit] {
    guard !tokens.isEmpty else { return [] }
    var out: [SearchHadithHit] = []
    for e in hadithIndex where SearchText.matches(e.haystack, tokens) {
      if out.count >= limit { break }
      let first = e.folded.firstIndex(where: { w in tokens.contains(where: { w.contains($0) }) }) ?? 0
      let lo = max(0, first - 6)
      let hi = min(e.words.count, lo + 28)
      var hits = Set<Int>()
      var snippet: [String] = []
      if lo < hi {
        snippet = Array(e.words[lo..<hi])
        for j in lo..<hi where tokens.contains(where: { e.folded[j].contains($0) }) { hits.insert(j - lo) }
      }
      out.append(SearchHadithHit(id: e.id, words: snippet, hits: hits, leadingEllipsis: lo > 0, trailingEllipsis: hi < e.words.count, source: e.source, book: e.book))
    }
    return out
  }

  // MARK: الأدوات
  private struct ToolEntry: Sendable { let tool: SearchTool; let keys: [String] }
  private static let toolIndex: [ToolEntry] = SearchTool.allCases.map { t in
    ToolEntry(tool: t, keys: ([t.title] + t.keywords).map { SearchText.fold($0) })
  }
  static func tools(_ q: String) -> [SearchTool] {
    let fq = SearchText.fold(q).trimmingCharacters(in: .whitespaces)
    guard fq.count >= 2 else { return [] }
    return toolIndex.filter { e in
      e.keys.contains { k in k == fq || (fq.count >= 3 && (k.contains(fq) || (k.count >= 3 && fq.contains(k)))) }
    }.map { $0.tool }
  }
}

// MARK: - الشاشة
/// وجهات الدفع داخل البحث
enum SearchRoute: Hashable {
  case tool(SearchTool)
  case hisn(Int)
  case hadith(book: String, query: String)
}

struct SearchView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.colorScheme) private var scheme
  /// نصّ يُفتح به البحث (وضع اللقطات وحده)
  var initialQuery = ""
  /// الانتقال إلى تبويب (يُغلق البحث أولًا) — جلسة الأذكار والمصحف
  var openTab: (AppTab) -> Void = { _ in }
  @State private var query = ""
  @State private var scope: SearchScope = .all
  @State private var results = SearchResults.empty
  @State private var resultsQuery = ""
  @State private var searching = false
  @State private var appliedInitial = false
  @State private var path: [SearchRoute] = []
  @State private var reader: SearchReaderTarget?
  @State private var sheet: SearchSheet?
  @State private var showQibla = false
  @FocusState private var focused: Bool
  /// آخر عمليات البحث (على الجهاز وحده، في UserDefaults)
  @State private var recentRaw = UserDefaults.standard.string(forKey: "search.recent") ?? ""

  struct SearchReaderTarget: Identifiable { let page: Int; let ayah: Int?; var id: String { "\(page)-\(ayah ?? 0)" } }
  enum SearchSheet: Int, Identifiable { case method, khatmah, reciter, display, legend; var id: Int { rawValue } }

  var body: some View {
    NavigationStack(path: $path) {
      VStack(spacing: 0) {
        header
        scopeChips
        ScrollView(showsIndicators: false) {
          VStack(alignment: .leading, spacing: 12) {
            resultsContent
          }
          .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
      }
      .background(DS.C.bgCanvas)
      .toolbar(.hidden, for: .navigationBar)
      .navigationDestination(for: SearchRoute.self) { route in destination(route) }
    }
    .task(id: query) { await runSearch() }
    .onAppear {
      guard !appliedInitial else { return }
      appliedInitial = true
      if !initialQuery.isEmpty { query = initialQuery }
    }
    .task {
      // تركيزٌ تلقائي بعد استقرار الغطاء (من أوّل إطار قد يضيع)؛ لا في وضع اللقطات كي لا تحجب لوحة المفاتيح النتائج
      guard initialQuery.isEmpty else { return }
      try? await Task.sleep(for: .milliseconds(450))
      focused = true
    }
    .fullScreenCover(item: $reader) { r in MushafReaderView(startPage: r.page, ayah: r.ayah).environment(model) }
    .fullScreenCover(isPresented: $showQibla) { QiblaView(presented: true).environment(model) }
    .sheet(item: $sheet) { s in sheetView(s) }
  }

  // MARK: البحث
  private func runSearch() async {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !q.isEmpty else { results = .empty; resultsQuery = ""; searching = false; return }
    try? await Task.sleep(for: .milliseconds(250))
    guard !Task.isCancelled else { return }
    searching = true
    let r = await Task.detached(priority: .userInitiated) { SearchEngine.run(q) }.value
    guard !Task.isCancelled else { return }
    results = r
    resultsQuery = q
    searching = false
  }

  // MARK: الرأس والشرائح
  private var header: some View {
    HStack(spacing: 12) {
      HStack(spacing: 8) {
        Image(systemName: "magnifyingglass").font(.system(size: 15, weight: .medium)).foregroundStyle(DS.C.textTertiary)
          .accessibilityHidden(true)
        TextField("ابحث في القرآن والأذكار والأحاديث", text: $query)
          .font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          .focused($focused)
          .submitLabel(.search)
          .autocorrectionDisabled()
          .onSubmit { remember(query) }
        if !query.isEmpty {
          Button { query = ""; focused = true } label: {
            Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(DS.C.textTertiary)
              .frame(width: 36, height: 36).contentShape(Rectangle())
          }
          .buttonStyle(.plain).accessibilityLabel("مسح البحث")
        }
      }
      .padding(.leading, 14).padding(.trailing, query.isEmpty ? 14 : 6)
      .frame(height: 48)
      .background(DS.C.bgSurface, in: Capsule())
      .overlay(Capsule().stroke(DS.C.borderSubtle, lineWidth: 1))
      Button { dismiss() } label: {
        Text("إلغاء").font(DS.F.labelMd).foregroundStyle(DS.C.brandPrimary)
          .frame(minHeight: 44).contentShape(Rectangle())
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 10)
  }

  private var scopeChips: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(SearchScope.allCases) { s in
          let on = scope == s
          Button { withAnimation(.snappy(duration: 0.2)) { scope = s } } label: {
            Text(s.title).font(DS.F.labelMd).foregroundStyle(on ? DS.C.textOnBrand : DS.C.textSecondary)
              .padding(.horizontal, 22).frame(minHeight: 44)
              .background(on ? DS.C.brandPrimary : DS.C.bgSurface, in: Capsule())
              .overlay(Capsule().stroke(on ? Color.clear : DS.C.borderSubtle, lineWidth: 1))
              .contentShape(Capsule())
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(on ? .isSelected : [])
        }
      }
      .padding(.horizontal, 16)
    }
    .padding(.bottom, 8)
  }

  // MARK: النتائج
  @ViewBuilder private var resultsContent: some View {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
    let r = results
    let all = scope == .all
    if q.isEmpty {
      emptyState
    } else if SearchText.fold(q).count < 2 {
      Text("اكتب حرفين على الأقل").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity).padding(.top, 40)
    } else if resultsQuery.isEmpty {
      ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
    } else if !hasResults(r, in: scope) {
      if searching { ProgressView().frame(maxWidth: .infinity).padding(.top, 40) } else { noResults(resultsQuery) }
    } else {
      if searching { ProgressView().controlSize(.small).frame(maxWidth: .infinity) }
      if all || scope == .tools, !r.tools.isEmpty {
        toolsSection(all ? Array(r.tools.prefix(4)) : r.tools, more: all && r.tools.count > 4)
      }
      if all || scope == .quran, !r.ayat.isEmpty {
        quranSection(all ? Array(r.ayat.prefix(3)) : r.ayat, more: all && r.ayat.count > 3)
      }
      if all || scope == .adhkar, !r.adhkar.isEmpty {
        adhkarSection(all ? Array(r.adhkar.prefix(3)) : r.adhkar, more: all && r.adhkar.count > 3)
      }
      if all || scope == .hadith, !r.hadith.isEmpty {
        hadithSection(all ? Array(r.hadith.prefix(3)) : r.hadith, more: all && r.hadith.count > 3)
      }
      if all { hint }
    }
  }

  private func hasResults(_ r: SearchResults, in s: SearchScope) -> Bool {
    switch s {
    case .all: return !r.isEmpty
    case .quran: return !r.ayat.isEmpty
    case .adhkar: return !r.adhkar.isEmpty
    case .hadith: return !r.hadith.isEmpty
    case .tools: return !r.tools.isEmpty
    }
  }

  private func sectionHead(_ title: String, link: String?, to target: SearchScope) -> some View {
    HStack {
      Text(title).font(DS.readex(18, .bold)).foregroundStyle(DS.C.textPrimary).accessibilityAddTraits(.isHeader)
      Spacer()
      if let link {
        Button { withAnimation(.snappy(duration: 0.2)) { scope = target } } label: {
          DSLinkLabel(title: link).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.top, 8)
  }

  private func toolsSection(_ tools: [SearchTool], more: Bool) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      sectionHead("الأدوات والإعدادات", link: more ? "الكل" : nil, to: .tools)
      ForEach(tools) { t in
        Button { openTool(t) } label: {
          SearchRowLabel(icon: t.icon, title: t.title, subtitle: t.subtitle)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private func quranSection(_ hits: [SearchAyahHit], more: Bool) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      sectionHead("القرآن", link: more ? "كل الآيات" : nil, to: .quran)
      ForEach(hits) { h in ayahCard(h) }
    }
  }

  private func adhkarSection(_ hits: [SearchDhikrHit], more: Bool) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      sectionHead("الأذكار", link: more ? "الكل" : nil, to: .adhkar)
      ForEach(hits) { d in
        Button { openDhikr(d) } label: {
          SearchRowLabel(icon: d.icon, title: d.title, subtitle: d.source)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private func hadithSection(_ hits: [SearchHadithHit], more: Bool) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      sectionHead("الأحاديث", link: more ? "الكل" : nil, to: .hadith)
      ForEach(hits) { h in hadithCard(h) }
    }
  }

  private func ayahCard(_ h: SearchAyahHit) -> some View {
    let name = QuranMeta.surah(h.ayah.surah).name
    let ref = "\(name)، \(num(h.ayah.ayah))"
    return Button {
      remember(query)
      reader = SearchReaderTarget(page: h.ayah.page, ayah: h.ayah.n)
    } label: {
      VStack(alignment: .leading, spacing: 8) {
        Text(highlighted(h.words, hits: h.hits, open: "﴿", close: "﴾"))
          .font(DS.quran(21)).lineSpacing(10)
          .multilineTextAlignment(.leading)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(ref).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
      }
      .searchCard()
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("سورة \(ref): \(h.words.joined(separator: " "))")
    .accessibilityHint("يفتح المصحف على الآية")
  }

  private func hadithCard(_ h: SearchHadithHit) -> some View {
    Button {
      remember(query)
      path.append(.hadith(book: h.book, query: resultsQuery))
    } label: {
      VStack(alignment: .leading, spacing: 8) {
        Text(highlighted(h.words, hits: h.hits, open: h.leadingEllipsis ? "«… " : "«", close: h.trailingEllipsis ? " …»" : "»"))
          .font(DS.amiri(18)).lineSpacing(6)
          .multilineTextAlignment(.leading)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(h.source).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(2)
      }
      .searchCard()
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(h.words.joined(separator: " "))، \(h.source)")
    .accessibilityHint("يفتح الأحاديث المطابقة")
  }

  /// نصٌّ بكلماته، والمطابق منها بلون الهوية
  private func highlighted(_ words: [String], hits: Set<Int>, open: String, close: String) -> AttributedString {
    var head = AttributedString(open)
    head.foregroundColor = DS.C.textPrimary
    var out = head
    for (i, w) in words.enumerated() {
      var piece = AttributedString(i < words.count - 1 ? w + " " : w)
      piece.foregroundColor = hits.contains(i) ? DS.C.brandPrimary : DS.C.textPrimary
      out.append(piece)
    }
    var tail = AttributedString(close)
    tail.foregroundColor = DS.C.textPrimary
    out.append(tail)
    return out
  }

  // MARK: لا استعلام / لا نتائج
  private var emptyState: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !recent.isEmpty {
        HStack {
          Text("عمليات بحث سابقة").font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
          Spacer()
          Button { saveRecent("") } label: {
            Text("مسح").font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary).frame(minHeight: 44).contentShape(Rectangle())
          }
          .buttonStyle(.plain).accessibilityLabel("مسح عمليات البحث السابقة")
        }
        VStack(spacing: 0) {
          ForEach(Array(recent.enumerated()), id: \.offset) { i, r in
            if i > 0 { Divider().overlay(DS.C.borderSubtle) }
            Button { query = r } label: {
              HStack(spacing: 10) {
                Image(systemName: "clock.arrow.circlepath").font(.system(size: 14)).foregroundStyle(DS.C.textTertiary)
                Text(r).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary).lineLimit(1)
                Spacer(minLength: 0)
              }
              .padding(.horizontal, 14).frame(minHeight: 48).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
          }
        }
        .searchCard(padding: 0)
      }
      hint
    }
    .padding(.top, 4)
  }

  private var hint: some View {
    Text("البحث نفسه يجد الأدوات والإعدادات: «القبلة» أو «طريقة الحساب» تفتح موضعها مباشرة.")
      .font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
      .fixedSize(horizontal: false, vertical: true)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.top, 6)
  }

  private func noResults(_ q: String) -> some View {
    VStack(spacing: 8) {
      Image(systemName: "magnifyingglass").font(.system(size: 28, weight: .light)).foregroundStyle(DS.C.textTertiary)
        .accessibilityHidden(true)
      Text("لا نتائج لـ«\(q)»").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).multilineTextAlignment(.center)
      Text(scope == .all ? "جرّب كلمةً أقصر، أو اسم سورة ورقم آية مثل «البقرة \(num(255))»" : "لا شيء في «\(scope.title)» — جرّب «الكل»")
        .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.top, 40)
  }

  // MARK: الفتح
  private func openTool(_ t: SearchTool) {
    remember(query)
    switch t {
    case .qibla: showQibla = true
    case .method, .asr: sheet = .method
    case .khatmah: sheet = .khatmah
    case .reciter: sheet = .reciter
    case .mushafDisplay: sheet = .display
    default: path.append(.tool(t))
    }
  }

  private func openDhikr(_ d: SearchDhikrHit) {
    remember(query)
    switch d.target {
    case .session(let p):
      model.pendingAdhkarPeriod = p
      openTab(.adhkar)
    case .chapter(let id):
      path.append(.hisn(id))
    }
  }

  @ViewBuilder private func destination(_ route: SearchRoute) -> some View {
    switch route {
    case .tool(let t):
      toolView(t)
    case .hisn(let id):
      if let c = Hisn.chapter(id) { HisnChapterView(chapter: c).environment(model) }
    case .hadith(let book, let q):
      HadithView(initialBook: book, embedded: true, initialQuery: q).environment(model)
    }
  }

  @ViewBuilder private func toolView(_ t: SearchTool) -> some View {
    switch t {
    case .location: CityPickerView().environment(model)
    case .monthTable: MonthTableView().environment(model)
    case .adhanGuard: AdhanGuardView().environment(model)
    case .notifications: NotificationSettingsView().environment(model)
    case .tasbih: TasbihView().environment(model)
    case .mosques: MosquesView().environment(model)
    case .hisn: HisnView().environment(model)
    case .nawawi: HadithView(initialBook: "nawawi", embedded: true).environment(model)
    case .downloads: DownloadsView().environment(model)
    case .sky: SkySettingsView().environment(model)
    case .formats: FormatsSettingsView().environment(model)
    case .backup: BackupView().environment(model)
    case .widgets: WidgetsHelpView().environment(model)
    case .privacy: PrivacyAboutView().environment(model)
    case .settings: SettingsView(backTitle: "البحث").environment(model)
    default: EmptyView()
    }
  }

  @ViewBuilder private func sheetView(_ s: SearchSheet) -> some View {
    switch s {
    case .method: MethodPicker().environment(model).environment(\.tabBarInset, 0)
    case .khatmah: KhatmahSheet(onGo: { p in sheet = nil; model.pendingReaderPage = p; openTab(.mushaf) }).environment(model)
    case .reciter: ReciterPickerSheet().environment(model)
    case .display: DisplaySheet(onLegend: { sheet = .legend }).environment(model)
    case .legend: TajweedLegendSheet(dark: scheme == .dark)
    }
  }

  // MARK: آخر عمليات البحث
  private var recent: [String] { recentRaw.split(separator: "\n").map(String.init).filter { !$0.isEmpty } }
  private func remember(_ q: String) {
    let t = q.trimmingCharacters(in: .whitespacesAndNewlines)
    guard t.count >= 2 else { return }
    let list = [t] + recent.filter { $0 != t }
    saveRecent(list.prefix(6).joined(separator: "\n"))
  }
  private func saveRecent(_ raw: String) {
    recentRaw = raw
    UserDefaults.standard.set(raw, forKey: "search.recent")
  }
  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }
}

/// صفّ نتيجة: أيقونة في مربّع ناعم (يمين)، عنوان ومصدر، وسهم (يسار)
private struct SearchRowLabel: View {
  let icon: String
  let title: String
  let subtitle: String
  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(DS.C.brandPrimary)
        .frame(width: 44, height: 44)
        .background(DS.C.brandSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      VStack(alignment: .leading, spacing: 2) {
        Text(title).font(DS.readex(15, .semibold)).foregroundStyle(DS.C.textPrimary).lineLimit(2)
        Text(subtitle).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.85)
      }
      Spacer(minLength: 8)
      DSChevron()
    }
    .padding(.horizontal, 14).padding(.vertical, 12)
    .searchCard(padding: 0)
    .accessibilityElement(children: .combine)
  }
}

/// بطاقة نتيجة: سطحٌ أبيض بحدٍّ خفيف وزاوية ٢٠
private extension View {
  func searchCard(padding: CGFloat = 16) -> some View {
    self.padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
      .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
  }
}
