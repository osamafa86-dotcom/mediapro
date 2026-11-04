import Foundation
import AppIntents

/// زرّ «صلّيتُ …» في النشاط المباشر (iOS 17): نيّة تفاعلية يشغّلها النظام في عملية التطبيق لا في الامتداد
/// (LiveActivityIntent)، فتكتب في UserDefaults التطبيق نفسه بلا App Group.
/// الملف مشترك بين الهدفين كما تشترط آبل؛ والتنفيذ الفعلي `record` معرَّف مرّتين:
/// في التطبيق (Sakinah/LiveActivityManager.swift) يسجّل ويحدّث النشاط، وفي الامتداد (Widget/MarkPrayedIntent+Widget.swift) لا يفعل شيئًا.
struct MarkPrayedIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "صلّيتُ"
  static var description = IntentDescription("يسجّل الصلاة الحالية مؤدّاةً في سجلّ خاص على هذا الجهاز")
  static var isDiscoverable: Bool = false

  @Parameter(title: "الصلاة") var prayer: String
  @Parameter(title: "اليوم") var day: String

  init() {}
  init(prayer: String, day: String) {
    self.prayer = prayer
    self.day = day
  }

  func perform() async throws -> some IntentResult {
    await Self.record(prayer: prayer, day: day)
    return .result()
  }
}
