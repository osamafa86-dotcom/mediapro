import Foundation
import CoreGraphics
import CoreText
import Compression

/// خطوط صفحات المصحف (QCF v1) المضمّنة مضغوطة raw-deflate في App/Fonts/*.ttf.z (4 بايتات حجم أصلي + البيانات).
/// تُفكّ وتُسجَّل في CoreText عند الطلب، مع الإبقاء على أقرب 16 خطًا فقط في الذاكرة (كل خط ≈ 150 ك.ب).
final class MushafFonts {
  static let shared = MushafFonts()
  private var registered: [String: CGFont] = [:]
  private var order: [String] = []
  private let lock = NSLock()
  private let keep = 16

  /// اسم PostScript لخط الصفحة كما داخل الملف
  static func pageFontName(_ p: Int) -> String { String(format: "QCF_P%03d", p) }
  static let surahNamesFont = "sura_names"
  static let amiriQuranFont = "AmiriQuran"

  @discardableResult
  func ensurePage(_ p: Int) -> Bool { ensure(file: "p\(p)", postScriptName: MushafFonts.pageFontName(p)) }
  @discardableResult
  func ensureSurahNames() -> Bool { ensure(file: "sura_names", postScriptName: MushafFonts.surahNamesFont, pin: true) }
  @discardableResult
  func ensureAmiri() -> Bool { ensure(file: "AmiriQuran", postScriptName: MushafFonts.amiriQuranFont, pin: true) }

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

  /// فكّ الضغط: الترويسة 4 بايتات (little-endian) بحجم TTF الأصلي ثم raw deflate
  static func load(file: String) -> Data? {
    guard let url = Bundle.main.url(forResource: file, withExtension: "ttf.z", subdirectory: "Fonts") ?? Bundle.main.url(forResource: file, withExtension: "ttf.z"),
          let blob = try? Data(contentsOf: url), blob.count > 4 else { return nil }
    let size = Int(blob.prefix(4).withUnsafeBytes { $0.load(as: UInt32.self).littleEndian })
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
