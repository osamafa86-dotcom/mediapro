import Foundation
import CoreGraphics
import CoreText
import Compression

/// خطوط صفحات المصحف (QCF v2 — خطّ طبعة المدينة الأحدث) مضغوطة raw-deflate (4 بايتات حجم أصلي + البيانات):
/// صفحات قليلة مضمّنة في App/Fonts/*.ttf.z، والبقية من الحزمة المنزَّلة بعد التثبيت (MushafPack).
/// تُفكّ وتُسجَّل في CoreText عند الطلب، مع الإبقاء على أقرب 16 خطًا فقط في الذاكرة (كل خط ≈ 150 ك.ب).
final class MushafFonts {
  static let shared = MushafFonts()
  private var registered: [String: CGFont] = [:]
  private var order: [String] = []
  private let lock = NSLock()
  private let keep = 16

  /// اسم PostScript لخط الصفحة كما داخل الملف
  static func pageFontName(_ p: Int) -> String { String(format: "QCF2%03d", p) }
  static let surahNamesFont = "sura_names"
  static let amiriQuranFont = "AmiriQuran"
  /// خط حفص (مجمع الملك فهد، الإصدار 18) لوضع النص — اسم PostScript داخل الملف (مقطوع عند 31 حرفًا)
  static let hafsFont = "KFGQPCHAFSUthmanicScript-Regula"

  @discardableResult
  func ensurePage(_ p: Int) -> Bool { ensure(file: "p\(p)", postScriptName: MushafFonts.pageFontName(p)) }

  /// الصفحات المضمّنة في التطبيق نفسه (تعمل قبل تنزيل الحزمة)
  static let bundledPages: Set<Int> = {
    let urls = (Bundle.main.urls(forResourcesWithExtension: "ttf.z", subdirectory: "Fonts") ?? []) + (Bundle.main.urls(forResourcesWithExtension: "ttf.z", subdirectory: nil) ?? [])
    return Set(urls.compactMap { u -> Int? in
      let n = u.lastPathComponent
      guard n.hasPrefix("p"), let dot = n.firstIndex(of: ".") else { return nil }
      return Int(n[n.index(after: n.startIndex)..<dot])
    })
  }()

  /// إلغاء تسجيل خطوط الصفحات (بعد حذف الحزمة) — تبقى الخطوط المثبّتة كأسماء السور
  func unregisterPages() {
    lock.lock(); defer { lock.unlock() }
    for name in order where !pinned.contains(name) {
      if let f = registered.removeValue(forKey: name) { var err: Unmanaged<CFError>?; CTFontManagerUnregisterGraphicsFont(f, &err) }
    }
    order.removeAll { !pinned.contains($0) }
  }
  @discardableResult
  func ensureSurahNames() -> Bool { ensure(file: "sura_names", postScriptName: MushafFonts.surahNamesFont, pin: true) }
  @discardableResult
  func ensureAmiri() -> Bool { ensure(file: "AmiriQuran", postScriptName: MushafFonts.amiriQuranFont, pin: true) }
  @discardableResult
  func ensureHafs() -> Bool { ensure(file: "hafs", postScriptName: MushafFonts.hafsFont, pin: true) }
  /// اسم خط وضع النص بحسب التفضيل ('hafs' | 'amiri') مع ضمان تسجيله
  func textFontName(_ pref: String) -> String { if pref == "hafs", ensureHafs() { return MushafFonts.hafsFont }; ensureAmiri(); return MushafFonts.amiriQuranFont }

  private var pinned: Set<String> = []
  private let prefetchQueue = DispatchQueue(label: "org.emdatra.sakinah.mushaf-fonts", qos: .userInitiated)

  /// تحميل خطوط الصفحات المجاورة في الخلفية كي يظهر النص فور التقليب
  func prefetch(around p: Int, radius: Int = 3) {
    prefetchQueue.async { [self] in
      for d in 1...radius { for q in [p + d, p - d] where (1...604).contains(q) { ensurePage(q) } }
    }
  }

  private func ensure(file: String, postScriptName: String, pin: Bool = false) -> Bool {
    lock.lock(); defer { lock.unlock() }
    if registered[postScriptName] != nil { touch(postScriptName); return true }
    guard let data = MushafFonts.load(file: file), let provider = CGDataProvider(data: data as CFData), let font = CGFont(provider) else { return false }
    var err: Unmanaged<CFError>?
    if !CTFontManagerRegisterGraphicsFont(font, &err) {
      // قد يكون مسجّلًا من قبل (إعادة تشغيل الواجهة): نعتبره متاحًا
      if let e = err?.takeRetainedValue(), CFErrorGetCode(e) != CTFontManagerError.alreadyRegistered.rawValue { return false }
    }
    registered[postScriptName] = font
    if pin { pinned.insert(postScriptName) } else { touch(postScriptName) }
    evict()
    return true
  }
  private func touch(_ name: String) { order.removeAll { $0 == name }; order.append(name) }
  private func evict() {
    while order.count > keep {
      let victim = order.removeFirst()
      if pinned.contains(victim) { continue }
      if let f = registered.removeValue(forKey: victim) { var err: Unmanaged<CFError>?; CTFontManagerUnregisterGraphicsFont(f, &err) }
    }
  }

  /// فكّ الضغط: الترويسة 4 بايتات (little-endian) بحجم TTF الأصلي ثم raw deflate.
  /// المصدر: الملف المضمّن إن وُجد، وإلا (لخطوط الصفحات) كتلة الصفحة من الحزمة المنزَّلة
  static func load(file: String) -> Data? {
    var source: Data?
    if let url = Bundle.main.url(forResource: file, withExtension: "ttf.z", subdirectory: "Fonts") ?? Bundle.main.url(forResource: file, withExtension: "ttf.z") {
      source = try? Data(contentsOf: url)
    } else if file.hasPrefix("p"), let n = Int(file.dropFirst()) {
      source = MushafPackFile.shared.blob(page: n)
    }
    guard let blob = source, blob.count > 4 else { return nil }
    let b = [UInt8](blob.prefix(4))
    let size = Int(b[0]) | Int(b[1]) << 8 | Int(b[2]) << 16 | Int(b[3]) << 24
    guard size > 0, size < 16 << 20 else { return nil }
    let payload = blob.dropFirst(4)
    var out = Data(count: size)
    let n = out.withUnsafeMutableBytes { dst -> Int in
      payload.withUnsafeBytes { src -> Int in
        compression_decode_buffer(dst.bindMemory(to: UInt8.self).baseAddress!, size, src.bindMemory(to: UInt8.self).baseAddress!, payload.count, nil, COMPRESSION_ZLIB)
      }
    }
    return n == size ? out : nil
  }
}
