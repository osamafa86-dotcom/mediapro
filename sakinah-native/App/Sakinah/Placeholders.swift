import SwiftUI

/// الأقسام قيد النقل إلى الأصلي (المرحلة 4 في خارطة الطريق) — واجهة مؤقتة صادقة لا فارغة
private struct RoadmapCard: View {
  let icon: String; let title: String; let lines: [String]
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack { Image(systemName: icon).font(.system(size: 28)).foregroundStyle(Theme.primary); Text(title).font(.arabic(20, weight: .bold)) }
      ForEach(lines, id: \.self) { l in Label(l, systemImage: "circle.dashed").font(.arabic(14)).foregroundStyle(.secondary) }
      Text("قيد النقل من نسخة الويب إلى الأصلي — يصل في بناء قادم على TestFlight").font(.arabic(12)).foregroundStyle(.tertiary)
    }
    .padding(18).frame(maxWidth: .infinity, alignment: .leading).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16)).padding()
  }
}

struct AdhkarPlaceholderView: View {
  var body: some View {
    NavigationStack {
      ScrollView { RoadmapCard(icon: "hands.sparkles", title: "الأذكار والحديث", lines: ["أذكار الصباح والمساء وحصن المسلم", "الأحاديث والأربعون النووية وحديث اليوم", "المسبحة وبطاقات المشاركة", "تذكيرات الأذكار"]) }
        .background(Theme.background).navigationTitle("الأذكار")
    }
  }
}
