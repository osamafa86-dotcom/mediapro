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

/// مشغّل التلاوة آية بآية (AVPlayer): قائمة آيات، تكرار الآية والمدى، السرعة، مؤقت النوم، تظليل الكلمة بتوقيتات quran.com، أزرار شاشة القفل، والبدائل عند فشل مصدر
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
  var repeatRange = false
  var rate: Double = 1
  var words = true
  var sleepAt: Date?
  var lastError: String?
  var errorVersion = 0
  @ObservationIgnored var downloads: AudioDownloads?
  @ObservationIgnored var onAyah: ((Int) -> Void)?
  @ObservationIgnored var onSleep: (() -> Void)?

  @ObservationIgnored private var player: AVPlayer?
  @ObservationIgnored private var timeObserver: Any?
  @ObservationIgnored private var itemObservers: [NSObjectProtocol] = []
  @ObservationIgnored private var statusObserver: NSKeyValueObservation?
  @ObservationIgnored private var segments: [[Int]]?
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var sourceCount = 0
  @ObservationIgnored private var repeatsLeft = 1
  @ObservationIgnored private var loadToken = 0
  @ObservationIgnored private var wantPlay = false
  @ObservationIgnored private var commandsReady = false

  var current: Int? { index >= 0 && index < queue.count ? queue[index] : nil }
  var currentAyah: Ayah? { current.flatMap { QuranText.shared.ayah($0) } }
  var reciterInfo: Reciter { Catalog.shared.reciter(reciter) }
  var hasWords: Bool { segments != nil }

  /// تشغيل قائمة آيات (أرقام عامة) بدءًا من فهرس
  func play(queue q: [Int], startIndex: Int = 0) {
    queue = q; index = min(max(0, startIndex), max(0, q.count - 1)); repeatsLeft = repeatAyah; attempt = 0
    guard let n = current else { return }
    activateSession(); setupRemoteCommands()
    load(n, autoplay: true)
  }
  private func activateSession() {
    let s = AVAudioSession.sharedInstance()
    try? s.setCategory(.playback, mode: .spokenAudio, options: []); try? s.setActive(true)
  }
  private func load(_ n: Int, autoplay: Bool) {
    loadToken += 1; let token = loadToken; loading = true; wantPlay = autoplay
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
  private func attach(url: URL, ayah n: Int, autoplay: Bool) {
    teardownItem()
    let item = AVPlayerItem(url: url)
    item.preferredForwardBufferDuration = 4
    let p = player ?? AVPlayer(); player = p
    p.automaticallyWaitsToMinimizeStalling = true
    p.replaceCurrentItem(with: item)
    statusObserver = item.observe(\.status, options: [.new]) { [weak self] it, _ in
      DispatchQueue.main.async { guard let self else { return }; if it.status == .failed { self.onItemFailed() } else if it.status == .readyToPlay { self.duration = it.duration.seconds.isFinite ? it.duration.seconds : 0; self.buffering = false; self.syncNowPlaying() } }
    }
    let nc = NotificationCenter.default
    itemObservers = [
      nc.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in self?.onEnded() },
      nc.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self] _ in self?.onItemFailed() },
      nc.addObserver(forName: .AVPlayerItemPlaybackStalled, object: item, queue: .main) { [weak self] _ in self?.buffering = true },
    ]
    if timeObserver == nil {
      timeObserver = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.08, preferredTimescale: 600), queue: .main) { [weak self] t in self?.tick(t.seconds) }
    }
    onAyah?(n)
    updateNowPlaying(n)
    if autoplay { p.rate = Float(rate); isPlaying = true } else { isPlaying = false }
    syncNowPlaying()
  }
  private func teardownItem() {
    statusObserver = nil
    for o in itemObservers { NotificationCenter.default.removeObserver(o) }; itemObservers = []
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
  private func onEnded() {
    if repeatsLeft > 1 { repeatsLeft -= 1; player?.seek(to: .zero); player?.rate = Float(rate); return }
    repeatsLeft = repeatAyah
    if index + 1 < queue.count { index += 1; attempt = 0; load(queue[index], autoplay: true) }
    else if repeatRange, !queue.isEmpty { index = 0; attempt = 0; load(queue[0], autoplay: true) }
    else { isPlaying = false; syncNowPlaying() }
  }
  func pause() { player?.pause(); isPlaying = false; syncNowPlaying() }
  func resume() { guard current != nil else { return }; activateSession(); player?.rate = Float(rate); isPlaying = true; syncNowPlaying() }
  func toggle() { isPlaying ? pause() : resume() }
  func stop() {
    loadToken += 1; loading = false; teardownItem()
    player?.pause(); player?.replaceCurrentItem(with: nil)
    isPlaying = false; index = -1; queue = []; segments = nil; currentWord = nil; sleepAt = nil; position = 0; duration = 0
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
