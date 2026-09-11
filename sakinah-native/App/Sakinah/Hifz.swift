import Foundation
import AVFoundation
import Speech
import Observation
import UIKit
import SakinahCore

/// التعرّف على الكلام لمراجعة الحفظ.
///
/// محرّك الصوت والمِجَسّ يبقيان يعملان طوال الجلسة؛ لا يُعاد إنشاء إلا طلب التعرّف ومهمّته،
/// فلا تنقطع الأذن بين الدورات. ويُصدِر الذيل الجديد من النصّ فقط، ويضبط عدّاد الاستهلاك
/// داخليًا مع كل دورة — فلا يمكن أن يختلّ التزامن كما كان يحدث.
final class SpeechListener {
  /// النصّ الجديد فقط منذ آخر نداء (ليس النصّ التراكمي)
  var onTail: ((_ tail: String, _ alternatives: [String]) -> Void)?
  /// النصّ التراكمي للعرض
  var onTranscript: ((String) -> Void)?
  var onState: ((Bool) -> Void)?
  var onError: ((String) -> Void)?
  /// الكلمات المتوقّعة الآن — تُمرَّر إلى المُعرِّف لترجيحها (أكبر مكسب في الدقّة)
  var context: (() -> [String])?

  private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ar-SA"))
  private let engine = AVAudioEngine()
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private(set) var active = false
  /// كم كلمة استُهلكت من نصّ الدورة الحالية — يعود صفرًا مع كل دورة جديدة
  private var consumed = 0
  private var backoff: Double = 0.15
  /// أعطال حقيقية متتابعة (الصمت لا يُحسب) — تمنع دورانًا أبديًا عند عطب فعلي
  private var failures = 0
  private var rotate: DispatchWorkItem?
  /// رقم الدورة الحالية — نداءات الدورات الملغاة تُتجاهل (وإلا أشعل إلغاؤنا دورةً تلغي التي بعدها بلا نهاية)
  private var generation = 0
  private var cycling = false
  /// مستوى الصوت الداخل (0…1) لمؤشّر حيّ يُظهر أن الأذن تعمل
  var onLevel: ((Double) -> Void)?
  private var lastLevelAt = Date.distantPast

  /// الخادم يقطع بعد نحو دقيقة؛ ندوّر قبلها بأمان. التعرّف على الجهاز بلا حدّ فنطيل الدورة
  private var rotateAfter: TimeInterval { onDevice ? 240 : 45 }
  private var onDevice: Bool { recognizer?.supportsOnDeviceRecognition ?? false }

  static var isSupported: Bool { SFSpeechRecognizer(locale: Locale(identifier: "ar-SA")) != nil }
  static func requestAuthorization() async -> Bool {
    let speech = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) } }
    guard speech else { return false }
    return await withCheckedContinuation { c in AVAudioSession.sharedInstance().requestRecordPermission { c.resume(returning: $0) } }
  }

  // MARK: - البدء والإيقاف

  func start() throws {
    guard let recognizer, recognizer.isAvailable else {
      throw NSError(domain: "speech", code: 1, userInfo: [NSLocalizedDescriptionKey: "unsupported"])
    }
    let s = AVAudioSession.sharedInstance()
    try s.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
    try s.setActive(true, options: .notifyOthersOnDeactivation)

    let input = engine.inputNode
    let fmt = input.outputFormat(forBus: 0)
    guard fmt.sampleRate > 0, fmt.channelCount > 0 else {
      throw NSError(domain: "speech", code: 2, userInfo: [NSLocalizedDescriptionKey: "no-input"])
    }
    input.removeTap(onBus: 0)
    // المِجَسّ يقرأ request في كل نبضة، فتنتقل الدورة الجديدة تلقائيًا بلا انقطاع
    input.installTap(onBus: 0, bufferSize: 2048, format: fmt) { [weak self] buf, _ in
      guard let self else { return }
      self.request?.append(buf)
      self.publishLevel(buf)
    }
    engine.prepare()
    try engine.start()

    active = true
    backoff = 0.15
    failures = 0
    cycling = false
    onState?(true)
    beginTask()
  }

  func stop(silent: Bool = false) {
    let wasActive = active
    active = false
    generation &+= 1
    cycling = false
    rotate?.cancel(); rotate = nil
    task?.cancel(); task = nil
    request?.endAudio(); request = nil
    consumed = 0
    if engine.isRunning { engine.stop() }
    engine.inputNode.removeTap(onBus: 0)
    if wasActive {
      try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
      if !silent { onState?(false) }
    }
  }

  // MARK: - دورة تعرّف واحدة

  private func beginTask() {
    guard active, let recognizer else { return }
    generation &+= 1
    let gen = generation
    let oldTask = task
    let oldRequest = request

    let req = SFSpeechAudioBufferRecognitionRequest()
    req.shouldReportPartialResults = true
    req.taskHint = .dictation
    // على الجهاز حين يتوفّر: يعمل دون اتصال، وبلا حدّ زمني، وبلا خنق من الخادم
    req.requiresOnDeviceRecognition = onDevice
    if #available(iOS 16.0, *) { req.addsPunctuation = false }
    // ترجيح الكلمات المتوقّعة: أهمّ رافعة لدقّة التعرّف على النصّ القرآني
    req.contextualStrings = Array((context?() ?? []).prefix(60))
    // يُركَّب قبل إنهاء القديم كي ينتقل المِجَسّ إليه بلا فجوة صامتة
    request = req
    consumed = 0

    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      // النداءات تصل على خيط عشوائي؛ كل ما يلي يمسّ حالة الواجهة فيلزم الخيط الرئيسي
      let best = result?.bestTranscription.formattedString
      let alts = result.map { Array($0.transcriptions.dropFirst().prefix(2).map(\.formattedString)) } ?? []
      let isFinal = result?.isFinal ?? false
      let code = (error as NSError?)?.code
      let message = error?.localizedDescription
      DispatchQueue.main.async {
        // دورة قديمة أُلغيت: نتجاهلها تمامًا — إلغاؤنا لها ليس سببًا لبدء دورة أخرى
        guard let self, self.active, gen == self.generation else { return }
        if let best { self.emit(best, alternatives: alts) }
        if let code {
          // 1110 لا كلام، 216/301/203/1101/209 إلغاء أو انتهاء دورة: كلّها طبيعية أثناء التلاوة المتقطّعة
          let benign = [1110, 216, 301, 203, 1101, 209].contains(code)
          if benign { self.failures = 0 } else {
            self.failures += 1
            if self.failures >= 8 { self.onError?(message ?? "تعذّر التعرّف على الكلام"); self.stop(); return }
          }
          self.cycle()
        } else if isFinal {
          self.failures = 0
          self.cycle()
        }
      }
    }

    oldRequest?.endAudio()
    oldTask?.cancel()

    // تدوير استباقي قبل أن يقطع النظام الدورة من تلقائه
    let work = DispatchWorkItem { [weak self] in self?.cycle(immediate: true) }
    rotate = work
    DispatchQueue.main.asyncAfter(deadline: .now() + rotateAfter, execute: work)
  }

  /// يبدأ دورة جديدة دون أن يمسّ محرّك الصوت — لا صمت ولا فقدان كلمات
  private func cycle(immediate: Bool = false) {
    guard active, !cycling else { return }
    cycling = true
    rotate?.cancel(); rotate = nil
    let delay = immediate ? 0 : backoff
    backoff = min(backoff * 1.6, 0.6)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
      guard let self else { return }
      self.cycling = false
      guard self.active else { return }
      self.backoff = 0.15
      self.beginTask()
    }
  }

  /// مستوى الصوت الداخل، عشر مرات في الثانية — مؤشّر حيّ يقول إن الميكروفون يعمل
  private func publishLevel(_ buf: AVAudioPCMBuffer) {
    let now = Date()
    guard now.timeIntervalSince(lastLevelAt) > 0.1, let ch = buf.floatChannelData?[0] else { return }
    lastLevelAt = now
    let n = Int(buf.frameLength)
    guard n > 0 else { return }
    var sum: Float = 0
    for i in stride(from: 0, to: n, by: 8) { sum += ch[i] * ch[i] }
    let rms = (sum / Float(max(1, n / 8))).squareRoot()
    let level = min(1, Double(rms) * 12)
    DispatchQueue.main.async { [weak self] in self?.onLevel?(level) }
  }

  /// يمرّر الذيل الجديد فقط؛ لا يعيد ما استُهلك ولو تراجع النصّ
  private func emit(_ transcript: String, alternatives: [String]) {
    let ws = transcript.split(separator: " ").map(String.init)
    onTranscript?(transcript)
    guard ws.count > consumed else { return }
    let tail = ws[consumed...].joined(separator: " ")
    let altTails = alternatives.compactMap { alt -> String? in
      let a = alt.split(separator: " ").map(String.init)
      return a.count > consumed ? a[consumed...].joined(separator: " ") : nil
    }
    consumed = ws.count
    failures = 0
    onTail?(tail, altTails)
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
  /// آخر لحظة تقدّم فيها المطابق — لإظهار «لم أسمعك» بلطف
  var lastProgressAt = Date()
  /// مستوى الصوت الداخل (0…1) — هالة الميكروفون تنبض به فيرى القارئ أن الأذن تعمل
  var level: Double = 0
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
    lastProgressAt = Date()
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

  /// الكلمات المتوقّعة الآن بصيغتها المكتوبة — تُرجَّح في المُعرِّف
  private func upcomingContext() -> [String] {
    guard matcher.pos < words.count else { return [] }
    let end = min(words.count, matcher.pos + 40)
    var out = words[matcher.pos..<end].map(\.raw)
    // أزواج متجاورة أيضًا: التعرّف يميل إلى دمج الكلمات القصيرة
    if end - matcher.pos >= 2 {
      for i in matcher.pos..<(end - 1) { out.append(words[i].raw + " " + words[i + 1].raw) }
    }
    return out
  }

  // MARK: - الصوت
  var speechSupported: Bool { SpeechListener.isSupported }
  func toggleSpeech() {
    if listening { stopSpeech(); return }
    Task { @MainActor in
      guard await SpeechListener.requestAuthorization() else {
        self.error = "لم يُمنح إذن الميكروفون أو التعرّف على الكلام"; return
      }
      let s = SpeechListener()
      s.context = { [weak self] in self?.upcomingContext() ?? [] }
      s.onTail = { [weak self] tail, alts in
        guard let self, !tail.isEmpty else { return }
        var r = self.matcher.feed(tail)
        // إن لم يُطابق الاختيار الأول، نجرّب البدائل التي يعرضها المُعرِّف
        if r.isEmpty { for alt in alts where !alt.isEmpty { r = self.matcher.feed(alt); if !r.isEmpty { break } } }
        self.reveal(r)
      }
      s.onTranscript = { [weak self] t in self?.heard = t }
      s.onLevel = { [weak self] v in self?.level = v }
      s.onState = { [weak self] on in self?.listening = on }
      s.onError = { [weak self] msg in self?.error = msg }
      do {
        try s.start(); self.speech = s; self.listening = true; self.lastProgressAt = Date()
      } catch {
        self.error = "تعذّر تشغيل التعرّف على الكلام على هذا الجهاز"
      }
    }
  }
  func stopSpeech() { speech?.stop(silent: true); speech = nil; listening = false; level = 0 }
}
