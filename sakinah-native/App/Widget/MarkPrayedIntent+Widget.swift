import Foundation

/// نسخة الامتداد من تنفيذ «صلّيتُ»: لا تُستدعى عمليًّا لأن LiveActivityIntent يُنفَّذ في عملية التطبيق
/// (التنفيذ الحقيقي في Sakinah/LiveActivityManager.swift). وجودها شرطٌ كي يُبنى الملف المشترك في الامتداد.
extension MarkPrayedIntent {
  static func record(prayer: String, day: String) async {}
}
