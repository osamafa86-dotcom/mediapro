import SwiftUI
import SakinahCore

// MARK: - أدوات مشتركة لشاشات الأقسام (المرحلة الخامسة: القرآن، الذكر، المسبحة، المكتبة، القبلة)
// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.

/// العدد والمعدود بالعربية: ١ و٢ بلفظهما، ٣–١٠ بالجمع، وما فوقها (والصفر) بالمفرد المنصوب
enum ArabicCount {
  static func phrase(_ v: Int, one: String, two: String, few: String, many: String, numerals: String) -> String {
    switch v {
    case 1: return one
    case 2: return two
    case 3...10: return "\(Fmt.number(v, numerals: numerals)) \(few)"
    default: return "\(Fmt.number(v, numerals: numerals)) \(many)"
    }
  }
}

/// أيام الأسبوع المدني كما يُعرض في سكينة: من السبت إلى الجمعة (السبت يمينًا)
enum WeekKeys {
  /// مفاتيح «YYYY-MM-DD» للأسبوع الذي يقع فيه اليوم المعطى
  static func saturdayWeek(containing today: String) -> [String] {
    guard let p = DayKey.parse(today) else { return [today] }
    // ١٩٧٠-٠١-٠١ خميس: الفهرس ٠ = الأحد … ٦ = السبت
    let weekday = ((DayKey.daysFromCivil(p.year, p.month, p.day) + 4) % 7 + 7) % 7
    let start = DayKey.adding(today, days: -((weekday + 1) % 7))
    return (0..<7).map { DayKey.adding(start, days: $0) }
  }
}

/// رأس شاشة قسم (quran.png · dhikr.png · library.png): سطرٌ وصفيّ صغير فوق عنوانٍ كوفيّ كبير يمينًا، وأزرار الإجراء يسارًا
struct SectionScreenHeader<Actions: View>: View {
  let title: String
  let subtitle: String
  @ViewBuilder var actions: () -> Actions
  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        Text(subtitle).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
        Text(title).font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary).lineLimit(1).accessibilityAddTraits(.isHeader)
      }
      Spacer(minLength: 8)
      actions()
    }
  }
}

/// أيقونة في مربّعٍ ناعم الزوايا (بطاقات المحتوى وصفوف القوائم في التصاميم الجديدة)
struct DSSquareIcon: View {
  let systemName: String
  var size: CGFloat = 40
  var iconSize: CGFloat = 17
  var tint: Color = DS.C.brandPrimary
  var fill: Color = DS.C.brandSoft
  var body: some View {
    Image(systemName: systemName).font(.system(size: iconSize, weight: .medium)).foregroundStyle(tint)
      .frame(width: size, height: size)
      .background(fill, in: RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
      .accessibilityHidden(true)
  }
}

/// صفّ قائمة: أيقونة مربّعة يمينًا، عنوان ووصف، وسهمٌ يسارًا
struct SectionListRow: View {
  let icon: String
  let title: String
  var subtitle: String? = nil
  var body: some View {
    HStack(spacing: 12) {
      DSSquareIcon(systemName: icon)
      VStack(alignment: .leading, spacing: 2) {
        Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.85)
        if let subtitle { Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(2) }
      }
      Spacer(minLength: 8)
      DSChevron()
    }
    .padding(.vertical, 10).padding(.horizontal, 12)
    .frame(minHeight: 58)
    .contentShape(Rectangle())
  }
}

/// فاصلٌ بين صفوف القائمة يبدأ بعد الأيقونة
struct SectionRowDivider: View {
  var body: some View { Divider().overlay(DS.C.borderSubtle).padding(.leading, 64) }
}

extension Hisn {
  /// الذكر بمعرّفه في الكتاب (معرّفات الأذكار متسلسلة عبر الأبواب كلّها — ليست أرقام أبواب)
  static func item(id: Int) -> HisnItem? {
    for c in chapters { if let it = c.items.first(where: { $0.id == id }) { return it } }
    return nil
  }
  /// الباب الذي يضمّ ذكرًا بعينه
  static func chapter(containingItem id: Int) -> HisnChapter? {
    chapters.first { c in c.items.contains { $0.id == id } }
  }
  /// عنوان القسم الذي يضمّ الباب
  static func sectionTitle(ofChapter id: Int) -> String? {
    sections.first { $0.chapters.contains(id) }?.title
  }
}
