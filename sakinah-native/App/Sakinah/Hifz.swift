import Foundation
import AVFoundation
import Speech
import Observation
import UIKit
import SakinahCore

/// التعرّف على الكلام (Speech) لمراجعة الحفظ: جلسات متتابعة (النظام ينهي الجلسة بعد نحو دقيقة أو صمت) مع إعادة تشغيل تلقائي
final class SpeechListener {
  var onResult: ((_ cumulative: String, _ alternatives: [String], _ isFinal: Bool) -> Void)?
  var onState: ((Bool) -> Void)?
  var onError: ((String) -> Void)?
  private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ar-SA"))
  private let engine = AVAudioEngine()
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private(set) var active = false
  private var startedAt = Date(); private var rapid = 0

  static var isSupported: Bool { SFSpeechRecognizer(locale: Locale(identifier: "ar-SA"))?.isAvailable ?? false }
  static func requestAuthorization() async -> Bool {
    let speech = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) } }
    guard speech else { return false }
    return await withCheckedContinuation { c in AVAudioSession.sharedInstance().requestRecordPermission { c.resume(returning: $0) } }
  }

  func start() throws {
    guard let recognizer, recognizer.isAvailable else { throw NSError(domain: "speech", code: 1, userInfo: [NSLocalizedDescriptionKey: "unsupported"]) }
    stop(silent: true)
    let s = AVAudioSession.sharedInstance()
    try s.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
    try s.setActive(true, options: .notifyOthersOnDeactivation)
    let req = SFSpeechAudioBufferRecognitionRequest(); req.shouldReportPartialResults = true; req.taskHint = .dictation
    if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = false }
    request = req
    let input = engine.inputNode; let fmt = input.outputFormat(forBus: 0)
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in self?.request?.append(buf) }
    engine.prepare(); try engine.start()
    active = true; startedAt = Date(); onState?(true)
    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      guard let self else { return }
      if let r = result {
        let alts = r.transcriptions.dropFirst().prefix(2).map(\.formattedString)
        self.onResult?(r.bestTranscription.formattedString, Array(alts), r.isFinal)
        if r.isFinal { self.restartIfActive() }
      }
      if let e = error as NSError? {
        // 1110 = no speech، 216/301 = إلغاء: تُعاد الجلسة؛ سوى ذلك يُبلَّغ
        let benign = [1110, 216, 301, 203].contains(e.code)
        if !benign { self.onError?(e.localizedDescription) }
        if benign || e.code == 1101 { self.restartIfActive() } else { self.stop() }
      }
    }
  }
  private func restartIfActive() {
    guard active else { return }
    let quick = Date().timeIntervalSince(startedAt) < 1.5
    rapid = quick ? rapid + 1 : 0
    if rapid >= 3 { stop(); onError?("restart-loop"); return }
    let delay = quick ? 0.25 * pow(2, Double(rapid)) : 0.25
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in guard let self, self.active else { return }; try? self.start() }
  }
  func stop(silent: Bool = false) {
    let wasActive = active; active = false
    task?.cancel(); task = nil; request?.endAudio(); request = nil
    if engine.isRunning { engine.stop() }; engine.inputNode.removeTap(onBus: 0)
    if wasActive { try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio); if !silent { onState?(false) } }
  }
}

/// جلسة مراجعة حفظ لصفحة: الكلمات المنطوقة من آية البداية، المطابق، الكشف بالصوت أو بالنقر، ووضع الإخفاء آيةً آية
@Observable
final class HifzSession {
  let page: Int
  let from: Int
  let words: [HifzWord]
  let matcher: HifzMatcher
  @ObservationIgnored private var indexOf: [Int: Int] = [:]  // n*1000+k → فهرس الكلمة
  var veil: Bool
  var listening = false
  var heard = ""
  var hints = 0
  var version = 0
  var finished = false
  var error: String?
  @ObservationIgnored private var fed = 0
  @ObservationIgnored private var speech: SpeechListener?

  init(page: Int, from: Int, veil: Bool = false) {
    self.page = page; self.from = from; self.veil = veil
    let ws = HifzMatcher.words(from: QuranText.shared.pageAyahs(page), startingAt: from)
    var idx: [Int: Int] = [:]; for (i, w) in ws.enumerated() { idx[w.n * 1000 + w.k] = i }
    words = ws; matcher = HifzMatcher(words: ws); indexOf = idx
  }
  var pos: Int { _ = version; return matcher.pos }
  var progress: Double { _ = version; return matcher.progress }
  var done: Bool { _ = version; return matcher.done }
  var lastRevealed: HifzWord? { _ = version; return matcher.pos > 0 ? words[matcher.pos - 1] : nil }
  var currentWord: HifzWord? { _ = version; return matcher.done ? nil : words[matcher.pos] }
  /// هل الكلمة مخفية؟ الآيات قبل البداية ظاهرة؛ مع «الكلمة الحالية فقط» تبقى آخر كلمة مكشوفة فقط
  func isHidden(n: Int, k: Int, onlyCurrent: Bool) -> Bool {
    _ = version
    guard n >= from, let i = indexOf[n * 1000 + k] else { return false }
    if i >= matcher.pos { return true }
    if onlyCurrent && !veil && i < matcher.pos - 1 { return true }
    return false
  }
  func isCurrent(n: Int, k: Int) -> Bool { _ = version; guard !matcher.done, let i = indexOf[n * 1000 + k] else { return false }; return i == matcher.pos }
  /// عدد آيات الصفحة المكشوفة كاملةً (وضع الإخفاء)
  var revealedAyahs: Int { _ = version; var shown = Set<Int>(); for i in 0..<matcher.pos { shown.insert(words[i].n) }; if let c = currentWord { shown.remove(c.n) }; return shown.count }
  func reveal(_ idx: [Int]) {
    guard !idx.isEmpty else { return }
    version += 1
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    if matcher.done { finish() }
  }
  func hint() { if let i = matcher.hint() { hints += 1; reveal([i]) } }
  func revealAyah() {
    guard let cur = currentWord else { return }
    var idx: [Int] = []
    while !matcher.done, words[matcher.pos].n == cur.n, let i = matcher.hint() { idx.append(i) }
    hints += idx.count; reveal(idx)
  }
  func revealAll() { var idx: [Int] = []; while let i = matcher.hint() { idx.append(i) }; reveal(idx) }
  private func finish() { finished = true; stopSpeech() }

  // MARK: - الصوت
  var speechSupported: Bool { SpeechListener.isSupported }
  func toggleSpeech() {
    if listening { stopSpeech(); return }
    Task { @MainActor in
      guard await SpeechListener.requestAuthorization() else { self.error = "لم يُمنح إذن الميكروفون أو التعرّف على الكلام"; return }
      let s = SpeechListener()
      s.onResult = { [weak self] cumulative, alts, isFinal in
        guard let self else { return }
        // النتائج المؤقتة تراكمية: نغذّي المطابق بالكلمات الجديدة فقط
        let ws = cumulative.split(separator: " ").map(String.init)
        let fresh = ws.dropFirst(self.fed).joined(separator: " ")
        if !fresh.isEmpty {
          var r = self.matcher.feed(fresh)
          if r.isEmpty, let alt = alts.first { r = self.matcher.feed(alt.split(separator: " ").dropFirst(self.fed).joined(separator: " ")) }
          self.reveal(r)
        }
        self.heard = cumulative
        self.fed = isFinal ? 0 : ws.count
      }
      s.onState = { [weak self] on in self?.listening = on; if !on { self?.fed = 0 } }
      s.onError = { [weak self] msg in self?.error = msg == "restart-loop" ? "توقف التعرّف على الكلام — أعد المحاولة" : msg }
      do { try s.start(); self.speech = s; self.listening = true; self.fed = 0 } catch { self.error = "تعذّر تشغيل التعرّف على الكلام على هذا الجهاز" }
    }
  }
  func stopSpeech() { speech?.stop(silent: true); speech = nil; listening = false; fed = 0 }
}
