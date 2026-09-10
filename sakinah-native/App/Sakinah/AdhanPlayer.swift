import Foundation
import AVFoundation
import Observation

/// تشغيل الأذان الكامل داخل التطبيق (والتطبيق في المقدمة أو الخلفية بفضل وضع الصوت الخلفي)
@Observable
final class AdhanPlayer: NSObject, AVAudioPlayerDelegate {
  private var player: AVAudioPlayer?
  var isPlaying = false

  /// `sound`: adhan-fakhry | adhan-azeez (الملفات في حزمة التطبيق)
  func play(sound: String) {
    stop()
    let name = sound.hasPrefix("adhan") ? sound : "adhan-fakhry"
    guard let url = Bundle.main.url(forResource: name, withExtension: "mp3") else { return }
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
      try AVAudioSession.sharedInstance().setActive(true)
      player = try AVAudioPlayer(contentsOf: url)
      player?.delegate = self
      player?.play()
      isPlaying = true
    } catch { isPlaying = false }
  }
  func stop() {
    player?.stop(); player = nil; isPlaying = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { stop() }
}
