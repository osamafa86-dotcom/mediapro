import Foundation
import CoreGraphics
import CoreText
import Compression
import SwiftUI

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
  /// خطّ الصفحة الأولى مثبّتاً: منه تُرسم البسملة برسم المدينة في كلّ رأس سورة، فلا يُخلى من الذاكرة
  @discardableResult
  func ensureBasmala() -> Bool { ensure(file: "p1", postScriptName: MushafFonts.pageFontName(1), pin: true) }
  @discardableResult
  func ensureSurahNames() -> Bool { ensure(file: "sura_names", postScriptName: MushafFonts.surahNamesFont, pin: true) }
  @discardableResult
  func ensureAmiri() -> Bool { ensure(file: "AmiriQuran", postScriptName: MushafFonts.amiriQuranFont, pin: true) }
  @discardableResult
  func ensureHafs() -> Bool { ensure(file: "hafs", postScriptName: MushafFonts.hafsFont, pin: true) }
  /// اسم خط وضع النص بحسب التفضيل ('hafs' | 'amiri') مع ضمان تسجيله
  func textFontName(_ pref: String) -> String { if pref == "hafs", ensureHafs() { return MushafFonts.hafsFont }; ensureAmiri(); return MushafFonts.amiriQuranFont }

  /// خطّ CoreText مبنيّ من الـCGFont المحمَّل نفسه، لا من البحث بالاسم في سجلّ الخطوط.
  /// بناء ٦٢ (٥٫٢٫٠) على جهاز المالك: الخطّ محمَّل (الصفحة بعتامة كاملة) لكن CTFontCreateWithName
  /// لم يجده فسقط إلى خطّ النظام بصمت — حروف لاتينية مكان كلمات الفاتحة والبقرة، و«001 surah» في الرأس.
  /// وأميري لم يُطابق اسمُه قطّ (الاسم الداخليّ AmiriQuran-Regular). المرجع المباشر لا يمرّ بالسجلّ أصلاً.
  func ctFont(_ postScriptName: String, size: CGFloat) -> CTFont {
    lock.lock(); let cg = registered[postScriptName]; lock.unlock()
    if let cg { return CTFontCreateWithGraphicsFont(cg, size, nil, nil) }
    return CTFontCreateWithName(postScriptName as CFString, size, nil)
  }
  func isLoaded(_ postScriptName: String) -> Bool { lock.lock(); defer { lock.unlock() }; return registered[postScriptName] != nil }
  /// خطّ SwiftUI من المرجع المباشر (بديل .custom(name) الذي يعتمد على البحث بالاسم)
  static func font(_ postScriptName: String, size: CGFloat) -> Font {
    // الخطوط الثابتة تُحمَّل عند أوّل طلب، فلا يُرسم نصٌّ بخطٍّ بديل قبل اكتمال التحميل المسبق في الخلفية
    switch postScriptName {
    case amiriQuranFont: shared.ensureAmiri()
    case hafsFont: shared.ensureHafs()
    case surahNamesFont: shared.ensureSurahNames()
    default: break
    }
    return Font(shared.ctFont(postScriptName, size: size))
  }

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
    if registered[postScriptName] != nil { if pin { pinned.insert(postScriptName) } else { touch(postScriptName) }; return true }
    guard let data = MushafFonts.load(file: file), let provider = CGDataProvider(data: data as CFData), let font = CGFont(provider) else { return false }
    // التسجيل بالاسم احتياطٌ فقط (الرسم يأخذ CGFont مباشرةً عبر ctFont)، ففشله لا يُسقط الخطّ
    var err: Unmanaged<CFError>?
    _ = CTFontManagerRegisterGraphicsFont(font, &err)
    _ = err?.takeRetainedValue()
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
