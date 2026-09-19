import Foundation
import AVFoundation
import MediaPlayer
import Observation
import SakinahCore

/// بيانات quran.com لكل سورة: رابط كل آية وتوقيتات كلماتها [موضع الكلمة (1..)، بداية ms، نهاية ms] — تُخزَّن على القرص
enum QDCMeta {
  struct Entry: Codable { let url: String; let segments: [[Int]] }
  private static var mem: [String: [String: Entry]] = [:]
  private static let memQueue = DispatchQueue(label: "org.emdatra.sakinah.qdc-meta")
  private static func cached(_ key: String) -> [String: Entry]? { memQueue.sync { mem[key] } }
  private static func store(_ key: String, _ m: [String: Entry]) { memQueue.sync { mem[key] = m } }
  private static var cacheDir: URL {
    let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("qdc", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true); return d
  }
  static func surah(recitation: Int, surah: Int) async throws -> [String: Entry] {
    let key = "\(recitation):\(surah)"
    if let m = cached(key) { return m }
    let file = cacheDir.appendingPathComponent("\(recitation)-\(surah).json")
    if let data = try? Data(contentsOf: file), let m = try? JSONDecoder().decode([String: Entry].self, from: data) { store(key, m); return m }
    var req = URLRequest(url: URL(string: "https://api.quran.com/api/v4/recitations/\(recitation)/by_chapter/\(surah)?fields=segments&per_page=300")!)
    req.setValue("application/json", forHTTPHeaderField: "accept"); req.timeoutInterval = 8
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard (resp as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true else { throw URLError(.badServerResponse) }
    struct File: Decodable { struct AF: Decodable { let verse_key: String; let url: String; let segments: [[Int]]? }; let audio_files: [AF] }
    let f = try JSONDecoder().decode(File.self, from: data)
    var m: [String: Entry] = [:]
    for a in f.audio_files { m[a.verse_key] = Entry(url: Catalog.shared.qdcBase + a.url, segments: (a.segments ?? []).map { $0.count >= 4 ? [$0[1], $0[2], $0[3]] : $0 }) }
    if let enc = try? JSONEncoder().encode(m) { try? enc.write(to: file) }
    store(key, m)
    return m
  }
  /// موضع الكلمة (1..) الجارية عند اللحظة t بالثواني
  static func word(at t: Double, segments: [[Int]]?) -> Int? {
    guard let s = segments, !s.isEmpty else { return nil }
    let ms = Int(t * 1000); var lo = 0, hi = s.count - 1; var best: [Int]? = nil
    while lo <= hi { let mid = (lo + hi) / 2; if ms < s[mid][1] { hi = mid - 1 } else { best = s[mid]; lo = mid + 1 } }
    return best?[0]
  }
}

/// مصدر صوت آية: quran.com (بتوقيتات) أو Islamic Network بمعدل بت، أو ملف محلي منزَّل
struct AyahSource { let url: URL; let segments: [[Int]]?; let provider: String }

enum AudioSources {
  static func islamicURL(reciter: String, n: Int, bitrate: Int) -> URL { URL(string: "https://cdn.islamic.network/quran/audio/\(bitrate)/\(reciter)/\(n).mp3")! }
  static func usesQDC(_ r: Reciter, words: Bool) -> Bool { r.qdc != nil && (words || r.bitrates.isEmpty) }
  /// مصادر الآية بالترتيب: الملف المحلي، ثم quran.com (إن كان مفضّلًا)، ثم معدلات Islamic Network
  static func sources(reciter id: String, n: Int, words: Bool, local: AudioDownloads?) async -> [AyahSource] {
    let r = Catalog.shared.reciter(id); var out: [AyahSource] = []
    if let l = local?.local(reciter: id, n: n) { out.append(l) }
    if usesQDC(r, words: words), let q = r.qdc, let a = QuranText.shared.ayah(n) {
      if let meta = try? await QDCMeta.surah(recitation: q, surah: a.surah), let e = meta["\(a.surah):\(a.ayah)"], let u = URL(string: e.url) { out.append(AyahSource(url: u, segments: e.segments, provider: "qdc")) }
    }
    for b in r.bitrates { out.append(AyahSource(url: islamicURL(reciter: id, n: n, bitrate: b), segments: nil, provider: "islamic")) }
    return out
  }
}

/// مشغّل التلاوة آية بآية بلا سكتة (AVQueuePlayer): الآية التالية تُحلّ مصادرها وتُدرَج خلف الجارية أثناء تشغيلها
/// فيبدأ تحميلها مسبقًا وينتقل إليها المشغّل بنفسه لحظة انتهاء الجارية — لا انتظار شبكةٍ بين الآيتين.
/// قائمة آيات، تكرار الآية والمدى، السرعة، مؤقت النوم، تظليل الكلمة بتوقيتات quran.com، أزرار شاشة القفل، والبدائل عند فشل مصدر
@Observable
final class RecitationPlayer: NSObject {
  var queue: [Int] = []
  var index = -1
  var isPlaying = false
  var loading = false
  var buffering = false
  /// موضع الكلمة الجارية (1..) من توقيتات quran.com
  var currentWord: Int?
  var position: Double = 0
  var duration: Double = 0
  var reciter: String = Catalog.shared.defaultReciter
  var repeatAyah = 1
  /// تكرار القائمة كلها من أوّلها عند انتهائها (يُغيَّر أثناء التشغيل بـ setRepeatRange كي تُعاد تهيئة «التالية»)
  var repeatRange = false
  /// تكرار «أ–ب»: فهرسا البداية والنهاية داخل القائمة؛ عند بلوغ ب يعود إلى أ
  var rangeA: Int?
  var rangeB: Int?
  var rate: Double = 1
  var words = true
  var sleepAt: Date?
  var lastError: String?
  var errorVersion = 0
  @ObservationIgnored var downloads: AudioDownloads?
  @ObservationIgnored var onAyah: ((Int) -> Void)?
  @ObservationIgnored var onSleep: (() -> Void)?

  /// الآية التالية المجهّزة خلف الجارية في قائمة المشغّل
  private struct Prepared { let index: Int; let n: Int; let item: AVPlayerItem; let segments: [[Int]]?; let sourceCount: Int }

  @ObservationIgnored private var player: AVQueuePlayer?
  @ObservationIgnored private var currentItem: AVPlayerItem?
  @ObservationIgnored private var prepared: Prepared?
  @ObservationIgnored private var timeObserver: Any?
  @ObservationIgnored private var itemObservers: [NSObjectProtocol] = []
  @ObservationIgnored private var statusObserver: NSKeyValueObservation?
  @ObservationIgnored private var currentItemObserver: NSKeyValueObservation?
  @ObservationIgnored private var segments: [[Int]]?
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var sourceCount = 0
  @ObservationIgnored private var repeatsLeft = 1
  @ObservationIgnored private var loadToken = 0
  @ObservationIgnored private var prepareToken = 0
  @ObservationIgnored private var wantPlay = false
  @ObservationIgnored private var commandsReady = false

  var current: Int? { index >= 0 && index < queue.count ? queue[index] : nil }
  var currentAyah: Ayah? { current.flatMap { QuranText.shared.ayah($0) } }
  var reciterInfo: Reciter { Catalog.shared.reciter(reciter) }
  var hasWords: Bool { segments != nil }
  var hasRange: Bool { rangeA != nil && rangeB != nil }
  func setRange(a: Int?, b: Int?) {
    if let a, let b { rangeA = min(a, b); rangeB = max(a, b) } else { rangeA = a; rangeB = b }
    if currentItem != nil { prepareNext() }
  }
  func clearRange() { let had = hasRange; rangeA = nil; rangeB = nil; if had, currentItem != nil { prepareNext() } }
  func setRepeatRange(_ on: Bool) { let changed = repeatRange != on; repeatRange = on; if changed, currentItem != nil { prepareNext() } }
  /// الانتقال داخل الآية الجارية (بالثواني)
  func seek(to seconds: Double) {
    let t = max(0, min(seconds, duration > 0 ? duration : seconds))
    player?.seek(to: CMTime(seconds: t, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    position = t
  }

  /// تشغيل قائمة آيات (أرقام عامة) بدءًا من فهرس
  func play(queue q: [Int], startIndex: Int = 0) {
    queue = q; index = min(max(0, startIndex), max(0, q.count - 1)); repeatsLeft = repeatAyah; attempt = 0; rangeA = nil; rangeB = nil
    guard let n = current else { return }
    activateSession(); setupRemoteCommands()
    load(n, autoplay: true)
  }
  private func activateSession() {
    let s = AVAudioSession.sharedInstance()
    try? s.setCategory(.playback, mode: .spokenAudio, options: []); try? s.setActive(true)
  }
  /// الفهرس الذي يلي الجاري في القائمة (مع «أ–ب» وتكرار القائمة)، أو nil عند نهايتها
  private func followingIndex() -> Int? {
    if let a = rangeA, let b = rangeB, index >= b, a < queue.count { return a }
    if index + 1 < queue.count { return index + 1 }
    if repeatRange, !queue.isEmpty { return 0 }
    return nil
  }
  private func load(_ n: Int, autoplay: Bool) {
    loadToken += 1; let token = loadToken; loading = true; wantPlay = autoplay
    discardPrepared()
    Task { @MainActor [weak self] in
      guard let self else { return }
      let srcs = await AudioSources.sources(reciter: self.reciter, n: n, words: self.words, local: self.downloads)
      guard token == self.loadToken else { return }
      guard !srcs.isEmpty else { self.loading = false; self.fail("unavailable"); return }
      let src = srcs[min(self.attempt, srcs.count - 1)]
      self.sourceCount = srcs.count; self.segments = src.segments; self.loading = false; self.currentWord = nil; self.position = 0; self.duration = 0
      self.attach(url: src.url, ayah: n, autoplay: autoplay)
    }
  }
  private func makeItem(_ url: URL) -> AVPlayerItem {
    let item = AVPlayerItem(url: url)
    item.preferredForwardBufferDuration = 4
    return item
  }
  private func makePlayer() -> AVQueuePlayer {
    let p = AVQueuePlayer()
    p.automaticallyWaitsToMinimizeStalling = true
    timeObserver = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.08, preferredTimescale: 600), queue: .main) { [weak self] t in self?.tick(t.seconds) }
    // انتقال المشغّل بنفسه إلى الآية المجهّزة: تُعتمد حالتُها (الفهرس والتوقيتات) لحظة صيرورتها الجارية
    currentItemObserver = p.observe(\.currentItem, options: [.new]) { [weak self] _, _ in
      DispatchQueue.main.async { guard let self, let pr = self.prepared, self.player?.currentItem === pr.item else { return }; self.adopt(pr) }
    }
    return p
  }
  private func attach(url: URL, ayah n: Int, autoplay: Bool) {
    teardownItem(); discardPrepared()
    let item = makeItem(url)
    let p = player ?? makePlayer(); player = p
    p.removeAllItems(); p.insert(item, after: nil)
    currentItem = item
    observe(item)
    p.actionAtItemEnd = repeatsLeft > 1 ? .pause : .advance
    onAyah?(n)
    updateNowPlaying(n)
    if autoplay { p.rate = Float(rate); isPlaying = true } else { isPlaying = false }
    syncNowPlaying()
    if repeatsLeft <= 1 { prepareNext() }
  }
  /// مراقبة العنصر الجاري: الجاهزية والفشل والانتهاء والتوقّف للتخزين
  private func observe(_ item: AVPlayerItem) {
    statusObserver = item.observe(\.status, options: [.initial, .new]) { [weak self] it, _ in
      DispatchQueue.main.async {
        guard let self, it === self.currentItem else { return }
        if it.status == .failed { self.onItemFailed() }
        else if it.status == .readyToPlay { self.duration = it.duration.seconds.isFinite ? it.duration.seconds : 0; self.buffering = false; self.syncNowPlaying() }
      }
    }
    let nc = NotificationCenter.default
    itemObservers = [
      nc.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self, weak item] _ in if let item { self?.onEnded(item) } },
      nc.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self, weak item] _ in if let self, let item, item === self.currentItem { self.onItemFailed() } },
      nc.addObserver(forName: .AVPlayerItemPlaybackStalled, object: item, queue: .main) { [weak self] _ in self?.buffering = true },
    ]
  }
  private func teardownItem() {
    statusObserver = nil
    for o in itemObservers { NotificationCenter.default.removeObserver(o) }; itemObservers = []
  }
  private func discardPrepared() {
    prepareToken += 1
    if let it = prepared?.item, let p = player, p.items().contains(where: { $0 === it }) { p.remove(it) }
    prepared = nil
  }
  /// تجهيز الآية التالية خلف الجارية كي يحمّلها المشغّل أثناء التلاوة وينتقل إليها بلا فجوة
  private func prepareNext() {
    discardPrepared()
    guard let cur = currentItem, repeatsLeft <= 1, let i = followingIndex(), i < queue.count else { return }
    let n = queue[i]; let token = prepareToken
    Task { @MainActor [weak self] in
      guard let self else { return }
      let srcs = await AudioSources.sources(reciter: self.reciter, n: n, words: self.words, local: self.downloads)
      guard token == self.prepareToken, let src = srcs.first, let p = self.player, self.currentItem === cur else { return }
      let item = self.makeItem(src.url)
      guard p.items().contains(where: { $0 === cur }), p.canInsert(item, after: cur) else { return }
      p.insert(item, after: cur)
      self.prepared = Prepared(index: i, n: n, item: item, segments: src.segments, sourceCount: srcs.count)
    }
  }
  /// اعتماد الآية المجهّزة بعد انتقال المشغّل إليها بنفسه
  private func adopt(_ pr: Prepared) {
    prepared = nil
    teardownItem()
    currentItem = pr.item
    index = pr.index; attempt = 0; repeatsLeft = repeatAyah
    segments = pr.segments; sourceCount = pr.sourceCount
    currentWord = nil; position = 0
    duration = pr.item.duration.seconds.isFinite ? pr.item.duration.seconds : 0
    observe(pr.item)
    player?.actionAtItemEnd = repeatsLeft > 1 ? .pause : .advance
    isPlaying = (player?.rate ?? 0) > 0 || wantPlay
    onAyah?(pr.n); updateNowPlaying(pr.n); syncNowPlaying()
    if repeatsLeft <= 1 { prepareNext() }
  }
  private func tick(_ t: Double) {
    position = t
    if let d = player?.currentItem?.duration.seconds, d.isFinite, d > 0 { duration = d }
    let w = QDCMeta.word(at: t, segments: segments)
    if w != currentWord { currentWord = w }
    if buffering, player?.timeControlStatus == .playing { buffering = false }
    if let s = sleepAt, Date() >= s { sleepAt = nil; pause(); onSleep?() }
  }
  private func onItemFailed() {
    guard let n = current else { return }
    if attempt + 1 < sourceCount { attempt += 1; load(n, autoplay: isPlaying || wantPlay); return }
    isPlaying = false; fail("network")
  }
  private func fail(_ kind: String) { lastError = kind; errorVersion += 1 }
  private func onEnded(_ item: AVPlayerItem) {
    guard item === currentItem else { return }
    if repeatsLeft > 1 {
      repeatsLeft -= 1
      player?.actionAtItemEnd = repeatsLeft > 1 ? .pause : .advance
      if repeatsLeft == 1 { prepareNext() }
      player?.seek(to: .zero); player?.rate = Float(rate)
      return
    }
    // آخر مرّة لهذه الآية: إن كانت التالية مجهّزة فالمشغّل ينتقل إليها بنفسه (تُعتمد عند تغيّر العنصر الجاري)
    if let pr = prepared, let p = player, p.currentItem === pr.item || p.items().contains(where: { $0 === pr.item }) { return }
    repeatsLeft = repeatAyah
    if let i = followingIndex() { index = i; attempt = 0; load(queue[i], autoplay: true) }
    else { isPlaying = false; syncNowPlaying() }
  }
  func pause() { player?.pause(); isPlaying = false; syncNowPlaying() }
  func resume() {
    guard let n = current else { return }
    activateSession()
    // انتهت القائمة (لا عنصر جارٍ): تُعاد الآية الأخيرة من أوّلها
    if player?.currentItem == nil { repeatsLeft = repeatAyah; attempt = 0; load(n, autoplay: true); return }
    player?.rate = Float(rate); isPlaying = true; syncNowPlaying()
  }
  func toggle() { isPlaying ? pause() : resume() }
  func stop() {
    loadToken += 1; loading = false; teardownItem(); discardPrepared()
    player?.pause(); player?.removeAllItems(); currentItem = nil
    isPlaying = false; index = -1; queue = []; segments = nil; currentWord = nil; sleepAt = nil; position = 0; duration = 0; rangeA = nil; rangeB = nil
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }
  func nextAyah() { guard index + 1 < queue.count else { return }; index += 1; repeatsLeft = repeatAyah; attempt = 0; load(queue[index], autoplay: true) }
  func prevAyah() { if index > 0 { index -= 1; repeatsLeft = repeatAyah; attempt = 0; load(queue[index], autoplay: true) } else { player?.seek(to: .zero) } }
  func setRate(_ r: Double) { rate = r; if isPlaying { player?.rate = Float(r) } }
  func setReciter(_ id: String) { let was = isPlaying; reciter = id; attempt = 0; if let n = current { load(n, autoplay: was) } }
  func setWords(_ on: Bool) { let changed = words != on; words = on; if changed, let n = current { attempt = 0; load(n, autoplay: isPlaying) } }
  /// مؤقت النوم بالدقائق (0 = إلغاء)
  func setSleep(minutes: Int) { sleepAt = minutes > 0 ? Date().addingTimeInterval(Double(minutes) * 60) : nil }
  var sleepMinutesLeft: Int? { sleepAt.map { max(1, Int(($0.timeIntervalSinceNow / 60).rounded())) } }

  // MARK: - شاشة القفل
  private func updateNowPlaying(_ n: Int) {
    guard let a = QuranText.shared.ayah(n) else { return }
    var info: [String: Any] = [MPMediaItemPropertyTitle: QuranSearch.refLabel(a), MPMediaItemPropertyArtist: reciterInfo.name, MPMediaItemPropertyAlbumTitle: "سكينة — المصحف"]
    info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? rate : 0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
  private func syncNowPlaying() {
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? rate : 0
    if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration; info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = min(position, duration) }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
  private func setupRemoteCommands() {
    guard !commandsReady else { return }; commandsReady = true
    let c = MPRemoteCommandCenter.shared()
    c.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
    c.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
    c.togglePlayPauseCommand.addTarget { [weak self] _ in self?.toggle(); return .success }
    c.nextTrackCommand.addTarget { [weak self] _ in self?.nextAyah(); return .success }
    c.previousTrackCommand.addTarget { [weak self] _ in self?.prevAyah(); return .success }
    c.stopCommand.addTarget { [weak self] _ in self?.stop(); return .success }
  }
}
