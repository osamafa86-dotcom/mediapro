import Foundation
import CryptoKit
import Observation

/// حزمة خطوط صفحات المصحف (604 صفحة في ملف واحد) تُنزَّل بعد التثبيت بدل تضمينها في التطبيق (كانت 110 م.ب من 129).
/// التطبيق يضمّ صفحات قليلة فقط (الفاتحة وأول البقرة وجزء عمّ — انظر BUNDLED_PAGES في tools/build-fonts.py)،
/// وما سواها يُعرض بوضع النص حتى تكتمل الحزمة. المصدر: إصدار GitHub ينشره سير .github/workflows/mushaf-fonts.yml،
/// ويُتحقَّق من الملف ببصمة SHA-256 مثبّتة هنا قبل استعماله (الخطوط تُحلَّل في CoreText فلا يُقبل ملف معدَّل).
@Observable
final class MushafPack: NSObject {
  static let shared = MushafPack()

  // نسخة الحزمة المنشورة — أي تغيير في الخطوط يحتاج إصدارًا جديدًا (mushaf-pack.version) وبصمة جديدة هنا
  static let version = "v1"
  static let remote = URL(string: "https://github.com/osamafa86-dotcom/mediapro/releases/download/sakinah-mushaf-fonts-v1/mushaf-pages-v1.pack")!
  static let expectedSize: Int64 = 109_631_695
  static let sha256 = "5b6aebffd33c1bfe89fc9270c5a099e86df29db6232105e2ea428a7429033d92"
  static let sessionID = "org.emdatra.sakinah.native.mushaf-pack"

  enum Phase: Equatable { case missing, downloading, verifying, ready, failed }
  private(set) var phase: Phase = .missing
  /// 0…1 أثناء التنزيل
  private(set) var progress: Double = 0
  private(set) var received: Int64 = 0

  /// يضعه AppDelegate حين يوقظ النظام التطبيق لإتمام تنزيل جرى في الخلفية
  @ObservationIgnored var backgroundCompletion: (() -> Void)?
  @ObservationIgnored private var session: URLSession!
  @ObservationIgnored private var task: URLSessionDownloadTask?

  static var dir: URL {
    let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MushafFonts", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true); return d
  }
  static var file: URL { dir.appendingPathComponent("mushaf-pages-\(version).pack") }
  private static var partFile: URL { dir.appendingPathComponent("download.part") }
  private static var resumeFile: URL { dir.appendingPathComponent("resume.data") }

  private override init() {
    super.init()
    let cfg = URLSessionConfiguration.background(withIdentifier: Self.sessionID)
    cfg.sessionSendsLaunchEvents = true
    cfg.isDiscretionary = false
    cfg.allowsCellularAccess = true
    session = URLSession(configuration: cfg, delegate: self, delegateQueue: .main)
    // حزم نسخ سابقة تُحذف كي لا تشغل المساحة مرتين
    for f in (try? FileManager.default.contentsOfDirectory(at: Self.dir, includingPropertiesForKeys: nil)) ?? []
    where f.pathExtension == "pack" && f.lastPathComponent != Self.file.lastPathComponent { try? FileManager.default.removeItem(at: f) }
    if MushafPackFile.shared.open(Self.file) { phase = .ready; progress = 1 }
    // تنزيل بدأ قبل أن يُغلق التطبيق يواصل في الخلفية: نعيد ربطه بالواجهة
    session.getAllTasks { [weak self] tasks in
      DispatchQueue.main.async {
        guard let self, self.phase != .ready, let t = tasks.compactMap({ $0 as? URLSessionDownloadTask }).first(where: { $0.state == .running }) else { return }
        self.task = t; self.phase = .downloading
      }
    }
  }

  /// هل خط هذه الصفحة متاح (مضمّن أو من الحزمة)؟ يقرأ `phase` فتُعاد رسم الواجهة حين تكتمل الحزمة
  func hasPage(_ p: Int) -> Bool { phase == .ready || MushafFonts.bundledPages.contains(p) }

  /// المجموع للعرض قبل أن يعرفه الخادم
  var totalBytes: Int64 { Self.expectedSize }

  func download() {
    guard phase == .missing || phase == .failed else { return }
    phase = .downloading; progress = 0; received = 0
    if let rd = try? Data(contentsOf: Self.resumeFile) {
      try? FileManager.default.removeItem(at: Self.resumeFile)
      task = session.downloadTask(withResumeData: rd)
    } else {
      task = session.downloadTask(with: Self.remote)
    }
    task?.countOfBytesClientExpectsToReceive = Self.expectedSize
    task?.resume()
  }

  /// إيقاف مع حفظ ما نُزِّل لاستئنافه لاحقًا
  func cancel() {
    guard phase == .downloading else { return }
    task?.cancel(byProducingResumeData: { data in if let data { try? data.write(to: MushafPack.resumeFile) } })
    task = nil; phase = .missing
  }

  /// حذف الحزمة (من شاشة التنزيلات): يعود المصحف إلى الصفحات المضمّنة ووضع النص
  func delete() {
    cancel()
    MushafPackFile.shared.close()
    MushafFonts.shared.unregisterPages()
    try? FileManager.default.removeItem(at: Self.file)
    try? FileManager.default.removeItem(at: Self.resumeFile)
    phase = .missing; progress = 0; received = 0
  }

  /// يُستدعى من الخلفية: حجم مطابق، بصمة مطابقة، وفهرس سليم
  static func verify(_ url: URL) -> Bool {
    guard let h = try? FileHandle(forReadingFrom: url) else { return false }
    defer { try? h.close() }
    var hasher = SHA256()
    var total: Int64 = 0
    while let chunk = try? h.read(upToCount: 1 << 20), !chunk.isEmpty {
      hasher.update(data: chunk); total += Int64(chunk.count)
    }
    let hex = hasher.finalize().map { String(format: "%02x", $0) }.joined()
    guard total == expectedSize, hex == sha256 else { return false }
    guard let mapped = try? Data(contentsOf: url, options: .alwaysMapped) else { return false }
    return MushafPackFile.parse(mapped) != nil
  }

  private func finish(_ part: URL) {
    phase = .verifying
    DispatchQueue.global(qos: .userInitiated).async {
      let ok = MushafPack.verify(part)
      DispatchQueue.main.async {
        guard ok else { try? FileManager.default.removeItem(at: part); self.phase = .failed; return }
        try? FileManager.default.removeItem(at: Self.file)
        do { try FileManager.default.moveItem(at: part, to: Self.file) } catch { self.phase = .failed; return }
        var url = Self.file
        var rv = URLResourceValues(); rv.isExcludedFromBackup = true
        try? url.setResourceValues(rv)
        if MushafPackFile.shared.open(Self.file) { self.phase = .ready; self.progress = 1 } else { self.phase = .failed }
      }
    }
  }
}

extension MushafPack: URLSessionDownloadDelegate {
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    if phase != .downloading { phase = .downloading; task = downloadTask }
    received = totalBytesWritten
    let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : Self.expectedSize
    if total > 0 { progress = min(1, Double(totalBytesWritten) / Double(total)) }
  }

  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    // الملف المؤقت يُحذف بعد عودة هذه الدالة: يُنقل الآن، ويُتحقَّق منه في الخلفية
    guard let http = downloadTask.response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { phase = .failed; return }
    try? FileManager.default.removeItem(at: Self.partFile)
    do { try FileManager.default.moveItem(at: location, to: Self.partFile) } catch { phase = .failed; return }
    task = nil
    finish(Self.partFile)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let error = error as NSError? else { return }
    if let rd = error.userInfo[NSURLSessionDownloadTaskResumeData] as? Data { try? rd.write(to: Self.resumeFile) }
    self.task = nil
    // الإيقاف من المستخدم ضبط الحالة سلفًا؛ غيره (انقطاع الشبكة…) يُعرض مع إعادة المحاولة
    if error.code != NSURLErrorCancelled { phase = .failed }
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    let done = backgroundCompletion; backgroundCompletion = nil; done?()
  }
}

/// قراءة الحزمة: ملف مفهرس (انظر tools/build-fonts.py) يُقرأ بالذاكرة المعيّنة دون فكّ أرشيف؛ آمن من أي خيط
final class MushafPackFile {
  static let shared = MushafPackFile()
  static let pages = 604
  private let lock = NSLock()
  private var data: Data?
  private var index: [(offset: Int, length: Int)] = []

  var isOpen: Bool { lock.lock(); defer { lock.unlock() }; return data != nil }

  @discardableResult
  func open(_ url: URL) -> Bool {
    guard FileManager.default.fileExists(atPath: url.path),
          let d = try? Data(contentsOf: url, options: .alwaysMapped), let idx = Self.parse(d) else { return false }
    lock.lock(); data = d; index = idx; lock.unlock()
    return true
  }

  func close() { lock.lock(); data = nil; index = []; lock.unlock() }

  /// محتوى p<N>.ttf.z (4 بايتات الحجم الأصلي + raw deflate) كما في الحزمة
  func blob(page: Int) -> Data? {
    lock.lock(); defer { lock.unlock() }
    guard let d = data, page >= 1, page <= index.count else { return nil }
    let e = index[page - 1]
    return d.subdata(in: (d.startIndex + e.offset)..<(d.startIndex + e.offset + e.length))
  }

  /// "SKMP" | u16 الإصدار=1 | u16 العدد=604 | العدد × (u32 الإزاحة، u32 الطول) — little-endian
  static func parse(_ d: Data) -> [(offset: Int, length: Int)]? {
    func u8(_ o: Int) -> Int { Int(d[d.startIndex + o]) }
    func u16(_ o: Int) -> Int { u8(o) | u8(o + 1) << 8 }
    func u32(_ o: Int) -> Int { u16(o) | u16(o + 2) << 16 }
    guard d.count >= 8, d.prefix(4).elementsEqual("SKMP".utf8), u16(4) == 1, u16(6) == pages else { return nil }
    let head = 8 + 8 * pages
    guard d.count >= head else { return nil }
    var out: [(offset: Int, length: Int)] = []
    out.reserveCapacity(pages)
    for i in 0..<pages {
      let off = u32(8 + 8 * i), len = u32(12 + 8 * i)
      guard off >= head, len > 4, off + len <= d.count else { return nil }
      out.append((off, len))
    }
    return out
  }
}
