import Foundation

/// تطبيع النص العثماني والإملائي للمقارنة والبحث (مطابق لدوال نسخة الويب في core/quran.js)
public enum QuranNormalize {
  @inline(__always) private static func isMark(_ v: UInt32) -> Bool {
    (0x0610...0x061A).contains(v) || (0x064B...0x065F).contains(v) || v == 0x0670 || (0x06D6...0x06ED).contains(v) || v == 0x0640 || v == 0xFEFF || v == 0x200E || v == 0x200F || v == 0x06E5 || v == 0x06E6
  }
  /// الحركات والعلامات دون الألف الخنجرية والحروف الصغيرة (تُعالج بعدها في صورة البحث A)
  @inline(__always) private static func isSearchMark(_ v: UInt32) -> Bool {
    (0x0610...0x061A).contains(v) || (0x064B...0x065F).contains(v) || (0x06D6...0x06DC).contains(v) || (0x06DF...0x06E4).contains(v) || (0x06E8...0x06ED).contains(v) || v == 0x0640
  }
  @inline(__always) private static func isArabicLetter(_ v: UInt32) -> Bool { (0x0621...0x064A).contains(v) }
  @inline(__always) private static func isSpace(_ s: Unicode.Scalar) -> Bool { s.properties.isWhitespace }

  /// صورة مقارنة بسيطة: بلا تشكيل، بلا ألف خنجرية أو وصل، توحيد الهمزات والتاء المربوطة والألف المقصورة
  public static func forMatch(_ s: String) -> String { forMatch(Array(s.unicodeScalars)) }
  static func forMatch(_ input: [Unicode.Scalar]) -> String {
    var out: [Unicode.Scalar] = []; out.reserveCapacity(input.count)
    var pendingSpace = false
    for sc in input {
      let v = sc.value
      if isMark(v) { continue }
      var c = sc
      switch v {
      case 0x0671, 0x0623, 0x0625, 0x0622: c = "ا"
      case 0x0624: c = "و"
      case 0x0626, 0x0649: c = "ي"
      case 0x0629: c = "ه"
      default: break
      }
      if isSpace(c) { pendingSpace = !out.isEmpty; continue }
      if !(isArabicLetter(c.value) || (0x0660...0x0669).contains(c.value)) { continue }
      if pendingSpace { out.append(" "); pendingSpace = false }
      out.append(c)
    }
    return String(String.UnicodeScalarView(out))
  }
  /// الأرقام العربية المشرقية والفارسية → ASCII
  public static func foldDigits(_ s: String) -> String {
    String(String.UnicodeScalarView(s.unicodeScalars.map { sc -> Unicode.Scalar in
      let v = sc.value
      if (0x0660...0x0669).contains(v) { return Unicode.Scalar(0x30 + (v - 0x0660))! }
      if (0x06F0...0x06F9).contains(v) { return Unicode.Scalar(0x30 + (v - 0x06F0))! }
      return sc
    }))
  }
  private static func stripSearchMarks(_ s: String) -> [Unicode.Scalar] { s.unicodeScalars.filter { !isSearchMark($0.value) } }
  /// الصورة A: الحروف الصغيرة والألف الخنجرية حروفًا كاملة (ٱلصَّلَوٰةَ → الصلاه، ٱلرَّحْمَٰنِ → الرحمان)
  public static func forSearchA(_ s: String) -> String {
    var a = stripSearchMarks(s)
    // وٰة → اة ؛ وٰا → ا ؛ ىٰ → ى
    var out: [Unicode.Scalar] = []; out.reserveCapacity(a.count)
    var i = 0
    while i < a.count {
      let v = a[i].value
      if v == 0x0648, i + 1 < a.count, a[i + 1].value == 0x0670 {
        if i + 2 < a.count, a[i + 2].value == 0x0629 { out.append("ا"); i += 2; continue }
        if i + 2 < a.count, a[i + 2].value == 0x0627 { out.append("ا"); i += 3; continue }
      }
      if v == 0x0649, i + 1 < a.count, a[i + 1].value == 0x0670 { out.append("ى"); i += 2; continue }
      out.append(a[i]); i += 1
    }
    a = out.map { sc -> Unicode.Scalar in
      switch sc.value { case 0x0670: return "ا"; case 0x06E7: return "ي"; case 0x06E5: return "و"; case 0x06E6: return "ي"; default: return sc }
    }
    return forMatch(mergeHamzaAlef(a))
  }
  /// الصورة B: تُحذف الحروف الصغيرة (ٱلرَّحْمَٰنِ → الرحمن، دَاوُۥدَ → داود)
  public static func forSearchB(_ s: String) -> String { forMatch(mergeHamzaAlef(stripSearchMarks(s))) }
  /// ءا (القرءان، ءامنوا) → ا كما تُكتب آ
  private static func mergeHamzaAlef(_ a: [Unicode.Scalar]) -> [Unicode.Scalar] {
    var out: [Unicode.Scalar] = []; out.reserveCapacity(a.count)
    var i = 0
    while i < a.count {
      if a[i].value == 0x0621, i + 1 < a.count, a[i + 1].value == 0x0627 { out.append("ا"); i += 2; continue }
      out.append(a[i]); i += 1
    }
    return out
  }

  /// كلمة من آية: النص الخام، صورته المطبَّعة، وهل تُنطق (الرموز المنفردة كعلامات الوقف لا تُنطق)
  public struct Token: Sendable, Hashable, Codable { public let raw: String; public let norm: String; public let spoken: Bool }
  public static func tokenize(_ text: String) -> [Token] {
    // التقسيم على المسافة (U+0020) بالرموز لا بالمحارف: المسافة قبل علامة وقف تندمج معها في محرف واحد
    text.unicodeScalars.split(separator: " ", omittingEmptySubsequences: true).map { t in
      let raw = String(String.UnicodeScalarView(t)); let norm = forMatch(raw)
      return Token(raw: raw, norm: norm, spoken: norm.unicodeScalars.contains { isArabicLetter($0.value) })
    }
  }
  /// مسافة ليفنشتاين على الرموز
  public static func levenshtein(_ a: String, _ b: String) -> Int {
    let x = Array(a.unicodeScalars), y = Array(b.unicodeScalars)
    if x == y { return 0 }; if x.isEmpty { return y.count }; if y.isEmpty { return x.count }
    var prev = Array(0...y.count), cur = [Int](repeating: 0, count: y.count + 1)
    for i in 1...x.count {
      cur[0] = i
      for j in 1...y.count { cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] == y[j - 1] ? 0 : 1)) }
      swap(&prev, &cur)
    }
    return prev[y.count]
  }
  public static func similarity(_ a: String, _ b: String) -> Double {
    let m = max(a.unicodeScalars.count, b.unicodeScalars.count)
    return m > 0 ? 1 - Double(levenshtein(a, b)) / Double(m) : 1
  }
}

/// كلمة منطوقة في قائمة كلمات المراجعة: رقم الآية العام وفهرس الكلمة المنطوقة
public struct HifzWord: Sendable, Hashable, Codable { public let n: Int; public let k: Int; public let norm: String; public let raw: String
  public init(n: Int, k: Int, norm: String, raw: String) { self.n = n; self.k = k; self.norm = norm; self.raw = raw } }

/// مُطابِق الحفظ: يتتبع الكلمة المتوقعة؛ يقبل الكلمة إن طابقت المتوقعة (تشابه ≥ threshold) أو إحدى الكلمتين التاليتين، ويتجاهل غير المطابقة
public final class HifzMatcher {
  public let words: [HifzWord]
  public private(set) var pos = 0
  public private(set) var matched = 0, skipped = 0, unmatched = 0, resynced = 0
  public let threshold: Double, lookahead: Int, lookaheadThreshold: Double, fuseThreshold: Double
  /// إعادة التزامن: إن أسقط التعرّف أكثر من lookahead كلمة تتابعًا، وقف المطابق إلى الأبد.
  /// فبعد resyncAfter إخفاقًا متتاليًا نبحث أمامنا في نافذة أوسع، ولا نقفز إلا بتأكيد كلمتين
  /// متتاليتين — فالكلمة الواحدة تتكرّر في القرآن كثيرًا ولا يُعتمد عليها وحدها.
  public let resyncAfter: Int, resyncWindow: Int, resyncThreshold: Double
  private var misses = 0
  /// موضع المرشّح الحالي لإعادة التزامن (‑١ إن لم يوجد) — مكشوف للاختبارات وحدها
  public private(set) var resyncAt = -1
  public init(words: [HifzWord], threshold: Double = 0.66, lookahead: Int = 2, lookaheadThreshold: Double = 0.85, fuseThreshold: Double = 0.8,
              resyncAfter: Int = 2, resyncWindow: Int = 25, resyncThreshold: Double = 0.85) {
    self.words = words; self.threshold = threshold; self.lookahead = lookahead; self.lookaheadThreshold = lookaheadThreshold; self.fuseThreshold = fuseThreshold
    self.resyncAfter = resyncAfter; self.resyncWindow = resyncWindow; self.resyncThreshold = resyncThreshold
  }
  /// أقرب موضع أمامنا تُطابقه الكلمة المنطوقة بثقة — الأقرب لا الأفضل، فالتلاوة تسير إلى الأمام
  private func findResync(_ w: String) -> Int {
    let end = min(words.count - 1, pos + resyncWindow)
    var j = pos + lookahead + 1
    while j < end {
      if QuranNormalize.similarity(words[j].norm, w) >= resyncThreshold { return j }
      j += 1
    }
    return -1
  }
  /// كلمات المراجعة من آيات (المنطوقة فقط) بدءًا من آية معيّنة
  public static func words(from ayahs: [Ayah], startingAt n: Int = 0) -> [HifzWord] {
    var out: [HifzWord] = []
    for a in ayahs where a.n >= n {
      var k = 0
      for t in QuranNormalize.tokenize(a.text) where t.spoken { out.append(HifzWord(n: a.n, k: k, norm: t.norm, raw: t.raw)); k += 1 }
    }
    return out
  }
  /// يعالج نصًا منطوقًا ويعيد فهارس الكلمات التي كُشفت الآن
  @discardableResult
  public func feed(_ transcript: String) -> [Int] {
    let spoken = QuranNormalize.forMatch(transcript).split(separator: " ").map(String.init)
    var revealed: [Int] = []
    var i = 0
    while i < spoken.count {
      if pos >= words.count { break }
      let w = spoken[i]
      var hit = -1   // كم كلمة متوقّعة نتخطّاها قبل المطابقة
      var span = 1   // كم كلمة متوقّعة تستهلكها هذه المطابقة
      var take = 1   // كم كلمة منطوقة نستهلكها
      var k = 0
      while k <= lookahead && pos + k < words.count {
        let exp = words[pos + k].norm; let th = k == 0 ? threshold : lookaheadThreshold
        let wl = w.unicodeScalars.count, el = exp.unicodeScalars.count
        if exp == w || QuranNormalize.similarity(exp, w) >= th || (k == 0 && wl >= 4 && el >= 4 && (exp.hasPrefix(w) || w.hasPrefix(exp))) { hit = k; break }
        k += 1
      }
      // التعرّف يدمج كلمتين في واحدة («اياك نعبد» ← «اياكنعبد»)
      if hit < 0, pos + 1 < words.count, QuranNormalize.similarity(words[pos].norm + words[pos + 1].norm, w) >= fuseThreshold { hit = 0; span = 2 }
      // أو يقسم الكلمة الواحدة إلى اثنتين («نستعين» ← «نست عين»)
      if hit < 0, i + 1 < spoken.count, QuranNormalize.similarity(words[pos].norm, w + spoken[i + 1]) >= fuseThreshold { hit = 0; take = 2 }
      if hit < 0 {
        // مرشّح من الكلمة السابقة: إن أكّدته هذه الكلمة فقد وجدنا موضع القارئ الحقيقي
        // المرشّح لا يُقبل إلا وهو أمامنا: التلميح اليدوي قد يكون تجاوزه، والقفز إلى الخلف يُنقص pos
        if resyncAt >= pos, QuranNormalize.similarity(words[resyncAt + 1].norm, w) >= resyncThreshold {
          let j = resyncAt
          for k in pos...(j + 1) { revealed.append(k) }  // ما أسقطه التعرّف يُكشف أيضًا
          skipped += j + 1 - pos; matched += 1; resynced += 1
          pos = j + 2; misses = 0; resyncAt = -1
          i += 1; continue
        }
        unmatched += 1; misses += 1
        resyncAt = misses >= resyncAfter ? findResync(w) : -1
        i += 1; continue
      }
      misses = 0; resyncAt = -1
      // امتداد الدمج: الكلمة المنطوقة قد تضمّ أكثر من كلمة متوقّعة — نتوسّع ما دام التشابه يتحسّن
      if span == 1 {
        var acc = words[pos + hit].norm; var best = QuranNormalize.similarity(acc, w)
        while pos + hit + span < words.count {
          let next = acc + words[pos + hit + span].norm; let sim = QuranNormalize.similarity(next, w)
          if sim <= best { break }
          acc = next; best = sim; span += 1
        }
      }
      for j in 0..<hit { revealed.append(pos + j) }
      skipped += hit
      for j in 0..<span { revealed.append(pos + hit + j) }
      matched += 1
      pos += hit + span
      i += take
    }
    return revealed
  }
  /// لقطة حالة المطابق — لتجربة فرضيات التعرّف بلا أثر
  public struct Snapshot: Sendable, Equatable { let pos, matched, skipped, unmatched, resynced, misses, resyncAt: Int }
  public func snapshot() -> Snapshot { Snapshot(pos: pos, matched: matched, skipped: skipped, unmatched: unmatched, resynced: resynced, misses: misses, resyncAt: resyncAt) }
  public func restore(_ s: Snapshot) { pos = s.pos; matched = s.matched; skipped = s.skipped; unmatched = s.unmatched; resynced = s.resynced; misses = s.misses; resyncAt = s.resyncAt }
  /// فرضيات التعرّف للصوت نفسه (الاختيار الأول ثم بدائله): تُجرَّب بلا أثر جانبي، وتُعتمد أولى
  /// التي تكشف شيئًا. وإن لم تكشف أيٌّ منها بقيت محاسبة الفرضية الأولى وحدها — وإلا محا
  /// ضجيجُ البدائل مرشّحَ إعادة التزامن الذي وجدته الفرضية الصحيحة.
  @discardableResult
  public func feedBest(_ hypotheses: [String]) -> [Int] {
    let list = hypotheses.filter { !$0.isEmpty }
    guard !list.isEmpty else { return [] }
    let before = snapshot()
    var primary: Snapshot?
    for h in list {
      if primary != nil { restore(before) }
      let r = feed(h)
      if !r.isEmpty { return r }
      if primary == nil { primary = snapshot() }
    }
    if let primary { restore(primary) }
    return []
  }
  /// كشف الكلمة التالية يدويًا (تلميح)
  @discardableResult
  public func hint() -> Int? { guard pos < words.count else { return nil }; misses = 0; resyncAt = -1; defer { pos += 1 }; return pos }
  public var done: Bool { pos >= words.count }
  public var progress: Double { words.isEmpty ? 1 : Double(pos) / Double(words.count) }
}

/// البحث في نص القرآن ومطابقة أسماء السور والمراجع («البقرة 255»، «2:255»)
public final class QuranSearch: @unchecked Sendable {
  public static let shared = QuranSearch(text: QuranText.shared)
  private let text: QuranText
  private var index: [(a: [UInt8], b: [UInt8])]?
  private let lock = NSLock()
  public init(text: QuranText) { self.text = text }

  private func buildIndex() -> [(a: [UInt8], b: [UInt8])] {
    lock.lock(); defer { lock.unlock() }
    if let i = index { return i }
    let idx = text.ayahs.map { a in (a: Array((" " + QuranNormalize.forSearchA(a.text) + " ").utf8), b: Array((" " + QuranNormalize.forSearchB(a.text) + " ").utf8)) }
    index = idx; return idx
  }
  /// بحث نصي (بلا تشكيل، يتعامل مع الرسم العثماني): مطابقة الكلمة الكاملة أولًا ثم الجزئية، بترتيب المصحف
  public func search(_ q: String, limit: Int = 50) -> [Ayah] {
    let nA = QuranNormalize.forSearchA(q), nB = QuranNormalize.forSearchB(q)
    if nA.unicodeScalars.count < 2 { return [] }
    let idx = buildIndex()
    let wA = Array((" " + nA + " ").utf8), wB = Array((" " + nB + " ").utf8), pA = Array(nA.utf8), pB = Array(nB.utf8)
    var whole: [Ayah] = [], partial: [Ayah] = []
    for (i, e) in idx.enumerated() {
      if QuranSearch.contains(e.a, wA) || QuranSearch.contains(e.b, wB) { whole.append(text.ayahs[i]); if whole.count >= limit { break } }
      else if partial.count < limit && (QuranSearch.contains(e.a, pA) || QuranSearch.contains(e.b, pB)) { partial.append(text.ayahs[i]) }
    }
    return Array((whole + partial).prefix(limit))
  }
  static func contains(_ hay: [UInt8], _ needle: [UInt8]) -> Bool {
    guard !needle.isEmpty, hay.count >= needle.count else { return false }
    let first = needle[0]
    var i = 0; let last = hay.count - needle.count
    while i <= last {
      if hay[i] == first {
        var j = 1; while j < needle.count && hay[i + j] == needle[j] { j += 1 }
        if j == needle.count { return true }
      }
      i += 1
    }
    return false
  }

  /// مرجع الآية «البقرة: 255»
  public static func refLabel(_ a: Ayah) -> String { "\(QuranMeta.surah(a.surah).name): \(a.ayah)" }
  private static func surahKey(_ s: String) -> String {
    var t = s; if t.hasPrefix("سورة ") { t = String(t.dropFirst(5)) }
    return QuranNormalize.forMatch(t)
  }
  /// مطابقة اسم سورة بتطبيع موحّد أو بالاسم الإنجليزي
  public static func matchSurahs(_ s: String) -> [Surah] {
    let k = surahKey(s); if k.isEmpty { return [] }
    let lk = s.lowercased()
    return QuranMeta.surahs.filter { surahKey($0.name).contains(k) || surahKey($0.plain).contains(k) || $0.en.lowercased().contains(lk) }
  }
  public struct Ref: Sendable, Equatable { public let surah: Surah; public let ayah: Int }
  /// «الكهف 10»، «2:255»، «2 255»، «سورة البقرة آية 255» → سورة وآية؛ رقم وحده → nil (صفحة يعالجها المستدعي)
  public static func parseRef(_ s: String) -> Ref? {
    let t = QuranNormalize.foldDigits(s).trimmingCharacters(in: .whitespaces)
    if let m = firstMatch(#"^(\d{1,3})\s*[:\s]\s*(\d{1,3})$"#, t), let sn = Int(m[1]), let an = Int(m[2]) {
      guard (1...114).contains(sn) else { return nil }
      return Ref(surah: QuranMeta.surah(sn), ayah: max(1, an))
    }
    if let m = firstMatch(#"^(.+?)\s*(?:[:\s]|آية|اية)\s*(\d{1,3})$"#, t), let an = Int(m[2]) {
      let hits = matchSurahs(m[1])
      let exact = hits.first { surahKey($0.name) == surahKey(m[1]) } ?? (hits.count == 1 ? hits[0] : nil)
      return exact.map { Ref(surah: $0, ayah: max(1, an)) }
    }
    return nil
  }
  static func firstMatch(_ pattern: String, _ s: String) -> [String]? {
    guard let re = try? NSRegularExpression(pattern: pattern), let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
    return (0..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } ?? "" }
  }
}
