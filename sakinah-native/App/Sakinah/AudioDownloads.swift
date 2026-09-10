import Foundation
import Observation
import SakinahCore

/// التلاوات دون اتصال: سور كاملة لكل قارئ في Application Support/audio/<القارئ>/<رقم الآية>.mp3 (+ .json لتوقيتات الكلمات)
@Observable
final class AudioDownloads {
  struct Entry: Codable, Equatable { var files: Int; var bytes: Int; var at: Double; var words: Bool }
  /// { القارئ: { السورة: Entry } } — الشكل نفسه في نسخة الويب (quran.downloads)
  var state: [String: [String: Entry]] { didSet { Store.save(state, "quran.downloads") } }
  /// تقدّم التنزيلات الجارية: "reciter/surah" → 0..1
  var running: [String: Double] = [:]
  @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]

  static var root: URL {
    let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("audio", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true); return d
  }
  init() { state = Store.load("quran.downloads", [:]) }

  private static func file(_ reciter: String, _ n: Int, ext: String = "mp3") -> URL { root.appendingPathComponent(reciter, isDirectory: true).appendingPathComponent("\(n).\(ext)") }
  /// ملف محلي للآية إن وُجد (مع توقيتات الكلمات إن حُفظت)
  func local(reciter: String, n: Int) -> AyahSource? {
    let f = Self.file(reciter, n); guard FileManager.default.fileExists(atPath: f.path) else { return nil }
    let seg = (try? Data(contentsOf: Self.file(reciter, n, ext: "json"))).flatMap { try? JSONDecoder().decode([[Int]].self, from: $0) }
    return AyahSource(url: f, segments: seg, provider: "local")
  }
  func entry(reciter: String, surah: Int) -> Entry? { state[reciter]?[String(surah)] }
  func isRunning(reciter: String, surah: Int) -> Bool { running["\(reciter)/\(surah)"] != nil }
  func progress(reciter: String, surah: Int) -> Double { running["\(reciter)/\(surah)"] ?? 0 }
  func summary(reciter: String) -> (count: Int, bytes: Int) { let m = state[reciter] ?? [:]; return (m.count, m.values.reduce(0) { $0 + $1.bytes }) }
  func totalBytes() -> Int { state.values.flatMap { $0.values }.reduce(0) { $0 + $1.bytes } }

  /// تنزيل سورة كاملة (آية آية) للقارئ؛ يُلغى بالاستدعاء مرة أخرى
  func download(reciter: String, surah: Int, words: Bool) {
    let key = "\(reciter)/\(surah)"
    if let t = tasks[key] { t.cancel(); tasks[key] = nil; running[key] = nil; return }
    running[key] = 0
    tasks[key] = Task { @MainActor [weak self] in
      guard let self else { return }
      let ayahs = QuranText.shared.surahAyahs(surah)
      var bytes = 0, files = 0
      let dir = Self.root.appendingPathComponent(reciter, isDirectory: true); try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      do {
        for (i, a) in ayahs.enumerated() {
          try Task.checkCancellation()
          let dst = Self.file(reciter, a.n)
          if !FileManager.default.fileExists(atPath: dst.path) {
            let srcs = await AudioSources.sources(reciter: reciter, n: a.n, words: words, local: nil)
            guard let src = srcs.first else { throw URLError(.resourceUnavailable) }
            let (tmp, resp) = try await URLSession.shared.download(from: src.url)
            guard (resp as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true else { throw URLError(.badServerResponse) }
            try? FileManager.default.removeItem(at: dst); try FileManager.default.moveItem(at: tmp, to: dst)
            if let seg = src.segments, let d = try? JSONEncoder().encode(seg) { try? d.write(to: Self.file(reciter, a.n, ext: "json")) }
          }
          bytes += (try? FileManager.default.attributesOfItem(atPath: dst.path)[.size] as? Int) ?? 0; files += 1
          self.running[key] = Double(i + 1) / Double(ayahs.count)
        }
        var m = self.state[reciter] ?? [:]; m[String(surah)] = Entry(files: files, bytes: bytes, at: Date().timeIntervalSince1970 * 1000, words: words); self.state[reciter] = m
      } catch { /* إلغاء أو خطأ شبكة: تبقى الملفات المنزَّلة للمرة القادمة */ }
      self.running[key] = nil; self.tasks[key] = nil
    }
  }
  func delete(reciter: String, surah: Int) {
    for a in QuranText.shared.surahAyahs(surah) { try? FileManager.default.removeItem(at: Self.file(reciter, a.n)); try? FileManager.default.removeItem(at: Self.file(reciter, a.n, ext: "json")) }
    var m = state[reciter] ?? [:]; m.removeValue(forKey: String(surah)); state[reciter] = m
  }
  func deleteAll() {
    for t in tasks.values { t.cancel() }; tasks = [:]; running = [:]
    try? FileManager.default.removeItem(at: Self.root); state = [:]
  }
  static func fmtBytes(_ b: Int, numerals: String) -> String {
    if b >= 1_000_000_000 { return "\(Fmt.decimal(Double(b) / 1e9, digits: 2, numerals: numerals)) ج.ب" }
    if b >= 1_000_000 { return "\(Fmt.decimal(Double(b) / 1e6, digits: 1, numerals: numerals)) م.ب" }
    return "\(Fmt.number(b / 1000, numerals: numerals)) ك.ب"
  }
}
