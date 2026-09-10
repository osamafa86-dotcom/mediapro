import Foundation
import ActivityKit

/// نشاط مباشر للصلاة القادمة (شاشة القفل والجزيرة الديناميكية) — الملف مشترك بين التطبيق وامتداد الودجت
struct PrayerActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var prayer: String
    var prayerName: String
    var time: Date
    var followingName: String?
    var followingTime: Date?
  }
  var placeName: String
}
