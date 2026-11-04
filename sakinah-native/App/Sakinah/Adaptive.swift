import SwiftUI

// MARK: - فئات العرض (المرحلة الرابعة — rules.png)
/// التخطيط يتبع عرض النافذة لا نوع الجهاز: الآيباد في Split View قد يكون «مضغوطًا» كالهاتف.
/// مضغوط < ٦٠٠ نقطة (الهاتف، وثلث Split View): عمودٌ واحد وشريطٌ عائم أسفل الشاشة — كما كان تمامًا.
/// متوسط ٦٠٠–٨٣٩ (الآيباد عموديًا، ونصف Split View): السماء بعرضٍ كامل وتحتها شبكة عمودين، والشريط أسفل الشاشة.
/// موسّع ≥ ٨٤٠ (الآيباد أفقيًا، وStage Manager): شريطٌ جانبيّ في بداية الشاشة (يمينًا) والسماء عمودٌ ثابت بجانب البطاقات.
enum WidthClass: Int, Comparable {
  case compact, medium, expanded
  static func of(_ width: CGFloat) -> WidthClass { width >= 840 ? .expanded : (width >= 600 ? .medium : .compact) }
  static func < (a: WidthClass, b: WidthClass) -> Bool { a.rawValue < b.rawValue }
}

/// فئة عرض النافذة كما يقيسها RootView (لا عرض الشاشة الفرعية: «اليوم» في الوضع الموسّع أضيق بعرض الشريط الجانبي)
struct WidthClassKey: EnvironmentKey { static let defaultValue: WidthClass = .compact }
extension EnvironmentValues {
  var widthClass: WidthClass { get { self[WidthClassKey.self] } set { self[WidthClassKey.self] = newValue } }
}

extension View {
  /// عرضٌ مقروء على الشاشات الواسعة: يتوسّط المحتوى بحدٍّ أقصى. لا أثر له على الهاتف (أعرض هاتف أضيق من الحدّ)،
  /// فالتخطيط المضغوط يبقى كما هو حرفيًّا.
  func readableWidth(_ limit: CGFloat = 720) -> some View {
    self.frame(maxWidth: limit).frame(maxWidth: .infinity)
  }
}

// MARK: - الشريط الجانبي (الوضع الموسّع)
/// شريطٌ جانبيّ بالتبويبات الأربعة بدل الشريط العائم (ipad-landscape.png): شارة التطبيق أعلاه، والتبويبات،
/// ثم البحث والإعدادات في أسفله (هيرو «اليوم» الموسّع بلا زرّيهما — لا ميزة تختفي).
/// يقع في بداية الشاشة: أوّل عنصر في HStack يقع يمينًا في البيئة العربية.
struct DSSideRail: View {
  @Binding var selection: AppTab
  var onSearch: () -> Void
  var onSettings: () -> Void

  var body: some View {
    // نافذة Stage Manager قد تكون قصيرة: الشريط يتمرّر عندها بدل أن يُقصّ، والفاصل يملأ ما زاد من الارتفاع
    GeometryReader { g in
      ScrollView(.vertical, showsIndicators: false) {
        VStack(spacing: 8) {
          mark.padding(.bottom, 10)
          ForEach(AppTab.allCases) { tab in item(tab) }
          Spacer(minLength: 16)
          railButton("magnifyingglass", "البحث", action: onSearch)
          railButton("slider.horizontal.3", "الإعدادات", action: onSettings)
        }
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, minHeight: g.size.height)
      }
    }
    .frame(width: 88)
    .background(DS.C.bgSurface)
    // الحدّ الفاصل في جهة المحتوى (يسار الشريط في العربية)
    .overlay(alignment: .trailing) { Rectangle().fill(DS.C.borderSubtle).frame(width: 1).ignoresSafeArea() }
  }

  private var mark: some View {
    ZStack {
      Circle().fill(DS.C.accentGoldSoft)
      Image(systemName: "moon.stars.fill").font(.system(size: 18)).foregroundStyle(DS.C.accentGoldStrong)
    }
    .frame(width: 44, height: 44)
    .accessibilityHidden(true)
  }

  private func item(_ tab: AppTab) -> some View {
    let on = selection == tab
    return Button { withAnimation(.snappy(duration: 0.2)) { selection = tab } } label: {
      VStack(spacing: 4) {
        Image(systemName: on ? tab.iconSelected : tab.icon).font(.system(size: 21, weight: on ? .semibold : .regular)).frame(height: 24)
        Text(tab.title).font(DS.readex(11, on ? .semibold : .medium)).lineLimit(1).minimumScaleFactor(0.8)
      }
      .foregroundStyle(on ? DS.C.brandStrong : DS.C.textTertiary)
      .frame(width: 68, height: 60)
      .background(on ? DS.C.brandSoft.opacity(0.85) : Color.clear, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(tab.title).accessibilityAddTraits(on ? .isSelected : [])
  }

  private func railButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(DS.C.textPrimary)
        .frame(width: 46, height: 46)
        .background(DS.C.bgSubtle, in: Circle())
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }
}
