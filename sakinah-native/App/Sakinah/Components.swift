import SwiftUI

// MARK: - الأزرار
struct DSButtonLabel: View {
  enum Kind { case primary, gold, soft, outline, ghost }
  let title: String
  var kind: Kind = .primary
  var icon: String? = nil
  var fill: Bool = true
  var body: some View {
    HStack(spacing: 8) {
      Text(title).font(DS.F.labelMd)
      if let icon { Image(systemName: icon).font(.system(size: 14, weight: .semibold)) }
    }
    .foregroundStyle(fg)
    .padding(.vertical, 14).padding(.horizontal, 20)
    .frame(maxWidth: fill ? .infinity : nil)
    .background(bg, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    .overlay { if kind == .outline { RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous).stroke(DS.C.borderStrong, lineWidth: 1.5) } }
    .contentShape(Rectangle())
  }
  private var fg: Color { switch kind { case .primary: return DS.C.textOnBrand; case .gold: return Color(hex: 0x16211F); default: return DS.C.brandPrimary } }
  private var bg: Color { switch kind { case .primary: return DS.C.brandPrimary; case .gold: return DS.C.accentGold; case .soft: return DS.C.brandSoft; default: return .clear } }
}
struct DSButton: View {
  let title: String
  var kind: DSButtonLabel.Kind = .primary
  var icon: String? = nil
  var fill: Bool = true
  let action: () -> Void
  var body: some View { Button(action: action) { DSButtonLabel(title: title, kind: kind, icon: icon, fill: fill) }.buttonStyle(.plain) }
}

// MARK: - زر أيقونة دائري
struct DSIcon: View {
  enum Style { case outlined, soft, gold, glass, brand, plain }
  let systemName: String
  var style: Style = .outlined
  var size: CGFloat = 42
  var iconSize: CGFloat = 18
  var body: some View {
    Image(systemName: systemName).font(.system(size: iconSize, weight: .medium)).foregroundStyle(fg)
      .frame(width: size, height: size)
      .background(bg, in: Circle())
      .overlay { if style == .outlined { Circle().stroke(DS.C.borderSubtle, lineWidth: 1) } }
      .contentShape(Circle())
  }
  private var fg: Color { switch style { case .soft: return DS.C.brandPrimary; case .gold: return DS.C.accentGoldStrong; case .glass: return DS.C.textOnDark; case .brand: return DS.C.textOnBrand; default: return DS.C.textPrimary } }
  private var bg: Color { switch style { case .outlined: return DS.C.bgSurface; case .soft: return DS.C.brandSoft; case .gold: return DS.C.accentGoldSoft; case .glass: return Color.white.opacity(0.12); case .brand: return DS.C.brandPrimary; case .plain: return .clear } }
}
struct DSIconButton: View {
  let systemName: String
  var style: DSIcon.Style = .outlined
  var size: CGFloat = 42
  var iconSize: CGFloat = 18
  var label: String? = nil
  let action: () -> Void
  var body: some View { Button(action: action) { DSIcon(systemName: systemName, style: style, size: size, iconSize: iconSize) }.buttonStyle(.plain).accessibilityLabel(label ?? systemName) }
}

// MARK: - شريحة
struct DSChip: View {
  let title: String
  var on = false
  var icon: String? = nil
  var action: (() -> Void)? = nil
  var body: some View {
    Button { action?() } label: {
      HStack(spacing: 6) { if let icon { Image(systemName: icon).font(.system(size: 12, weight: .semibold)) }; Text(title).font(DS.F.labelSm) }
        .foregroundStyle(on ? DS.C.textOnBrand : DS.C.textSecondary)
        .padding(.vertical, 8).padding(.horizontal, 14)
        .background(on ? DS.C.brandPrimary : DS.C.bgSurface, in: Capsule())
        .overlay { if !on { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) } }
    }.buttonStyle(.plain)
  }
}

// MARK: - البطاقات والأسطح
extension View {
  /// بطاقة سطح بيضاء بزاوية 24 وظلّ خفيف
  func dsCard(padding: CGFloat = 20, radius: CGFloat = DS.Radius.xl) -> some View {
    self.padding(padding)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
      .shadow(color: DS.C.shadowCard, radius: 12, x: 0, y: 4)
  }
  /// بطاقة بحدّ خفيف بلا ظلّ (للبلاطات الصغيرة)
  func dsTile(padding: CGFloat = 14, radius: CGFloat = DS.Radius.lg) -> some View {
    self.padding(padding)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
      .overlay { RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1) }
  }
  /// بطاقة «الليل» المتدرّجة مع حلقات وزخرفة نجوم
  func nightCard(radius: CGFloat = DS.Radius.xxl) -> some View {
    self.background { ZStack { DS.nightGradient; NightDecor() } }
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
      .shadow(color: DS.C.shadowFloat, radius: 20, x: 0, y: 12)
  }
  /// إخفاء شريط التبويبات النظامي (نستخدم DSTabBar)
  func hiddenSystemTabBar() -> some View { self.toolbar(.hidden, for: .tabBar) }
}

/// حلقات ذهبية شفافة ونجوم صغيرة (تُرسم بإحداثيات مطلقة كي لا تنعكس مع الاتجاه)
struct NightDecor: View {
  var body: some View {
    GeometryReader { g in
      ZStack {
        Circle().stroke(DS.C.accentGold.opacity(0.35), lineWidth: 1).frame(width: 300, height: 300).position(x: 30, y: 0)
        Circle().stroke(Color.white.opacity(0.12), lineWidth: 1).frame(width: 220, height: 220).position(x: 30, y: 0)
        ForEach(Array([(40.0, 26.0, 4.0), (92.0, 54.0, 3.0), (64.0, 118.0, 2.0), (150.0, 30.0, 2.0)].enumerated()), id: \.offset) { _, s in
          Circle().fill(DS.C.accentGold.opacity(0.8)).frame(width: s.2, height: s.2).position(x: s.0, y: s.1)
        }
      }
      .frame(width: g.size.width, height: g.size.height)
    }
    .allowsHitTesting(false)
  }
}

// MARK: - رأس قسم
struct DSSectionHead<Link: View>: View {
  let title: String
  @ViewBuilder var link: () -> Link
  init(_ title: String, @ViewBuilder link: @escaping () -> Link) { self.title = title; self.link = link }
  var body: some View { HStack { Text(title).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary); Spacer(); link() } }
}
extension DSSectionHead where Link == EmptyView { init(_ title: String) { self.init(title) { EmptyView() } } }
/// رابط قسم «العنوان ›»
struct DSLinkLabel: View {
  let title: String
  var body: some View { HStack(spacing: 2) { Text(title).font(DS.F.labelSm); Image(systemName: "chevron.forward").font(.system(size: 11, weight: .semibold)) }.foregroundStyle(DS.C.brandPrimary) }
}

// MARK: - شريط تقدّم (يبدأ من جهة البداية: اليمين في العربية)
struct ProgressTrack: View {
  let progress: Double
  var tint: Color = DS.C.accentGold
  var track: Color = Color.white.opacity(0.18)
  var height: CGFloat = 6
  var body: some View {
    GeometryReader { g in
      HStack(spacing: 0) { Capsule().fill(tint).frame(width: max(height, g.size.width * min(1, max(0, progress)))); Spacer(minLength: 0) }
    }
    .frame(height: height)
    .background(track, in: Capsule())
    .animation(.easeInOut(duration: 0.4), value: progress)
  }
}

/// حلقة تقدّم دائرية
struct RingProgress: View {
  let progress: Double
  var tint: Color = DS.C.accentGold
  var track: Color = DS.C.borderSubtle
  var lineWidth: CGFloat = 6
  var body: some View {
    ZStack {
      Circle().stroke(track, lineWidth: lineWidth)
      Circle().trim(from: 0, to: min(1, max(0.001, progress))).stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)).rotationEffect(.degrees(-90))
    }
    .animation(.easeInOut(duration: 0.5), value: progress)
  }
}

// MARK: - صفّ قائمة
struct DSRow<Trailing: View>: View {
  let icon: String
  var iconStyle: DSIcon.Style = .soft
  let title: String
  var subtitle: String? = nil
  @ViewBuilder var trailing: () -> Trailing
  var body: some View {
    HStack(spacing: 12) {
      DSIcon(systemName: icon, style: iconStyle, size: 40, iconSize: 17)
      VStack(alignment: .leading, spacing: 1) {
        Text(title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary)
        if let subtitle { Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
      }
      Spacer(minLength: 8)
      trailing()
    }
    .padding(.vertical, 10).padding(.horizontal, 12)
    .contentShape(Rectangle())
  }
}
extension DSRow where Trailing == DSChevron { init(icon: String, iconStyle: DSIcon.Style = .soft, title: String, subtitle: String? = nil) { self.init(icon: icon, iconStyle: iconStyle, title: title, subtitle: subtitle) { DSChevron() } } }
struct DSChevron: View { var body: some View { Image(systemName: "chevron.forward").font(.system(size: 13, weight: .semibold)).foregroundStyle(DS.C.textTertiary) } }

// MARK: - شريط عنوان مخصّص (عنوان في الوسط، رجوع يمينًا، إجراء يسارًا)
struct DSNavBar<Trailing: View>: View {
  let title: String
  var subtitle: String? = nil
  var back: (() -> Void)? = nil
  @ViewBuilder var trailing: () -> Trailing
  var body: some View {
    HStack(spacing: 8) {
      if let back { DSIconButton(systemName: "chevron.forward", iconSize: 16, label: "رجوع", action: back) } else { Color.clear.frame(width: 42, height: 42) }
      VStack(spacing: 0) {
        Text(title).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary).lineLimit(1)
        if let subtitle { Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1) }
      }.frame(maxWidth: .infinity)
      trailing().frame(minWidth: 42)
    }
    .padding(.horizontal, 20).padding(.vertical, 4)
  }
}
extension DSNavBar where Trailing == EmptyView { init(title: String, subtitle: String? = nil, back: (() -> Void)? = nil) { self.init(title: title, subtitle: subtitle, back: back) { EmptyView() } } }

// MARK: - شريط التبويبات
enum AppTab: Int, CaseIterable, Identifiable {
  case prayer, qibla, mushaf, adhkar, more
  var id: Int { rawValue }
  var title: String { switch self { case .prayer: return "الصلاة"; case .qibla: return "القبلة"; case .mushaf: return "المصحف"; case .adhkar: return "الأذكار"; case .more: return "المزيد" } }
  var icon: String { switch self { case .prayer: return "house"; case .qibla: return "location.north.circle"; case .mushaf: return "book"; case .adhkar: return "circle.hexagongrid"; case .more: return "ellipsis" } }
  var iconSelected: String { switch self { case .prayer: return "house.fill"; case .qibla: return "location.north.circle.fill"; case .mushaf: return "book.fill"; case .adhkar: return "circle.hexagongrid.fill"; case .more: return "ellipsis" } }
}
struct DSTabBar: View {
  @Binding var selection: AppTab
  var body: some View {
    HStack(spacing: 0) {
      ForEach(AppTab.allCases) { tab in
        let on = selection == tab
        Button { withAnimation(.snappy(duration: 0.2)) { selection = tab } } label: {
          VStack(spacing: 4) {
            Image(systemName: on ? tab.iconSelected : tab.icon).font(.system(size: 22, weight: on ? .semibold : .regular)).frame(height: 26)
            Text(tab.title).font(DS.F.labelXs)
          }
          .foregroundStyle(on ? DS.C.brandPrimary : DS.C.textTertiary)
          .frame(maxWidth: .infinity).padding(.top, 8).padding(.bottom, 4)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title).accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .padding(.horizontal, 8)
    .background(DS.C.bgSurface.ignoresSafeArea(edges: .bottom))
    .overlay(alignment: .top) { Rectangle().fill(DS.C.borderSubtle).frame(height: 0.5) }
  }
}

// MARK: - عناصر صغيرة
/// حبّة التاريخ الهجري
struct DSPill: View {
  let icon: String
  let text: String
  var secondary: String? = nil
  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: icon).font(.system(size: 13, weight: .medium)).foregroundStyle(DS.C.accentGoldStrong)
      Text(text).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
      if let secondary { Text("·").foregroundStyle(DS.C.textTertiary); Text(secondary).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary) }
    }
    .padding(.vertical, 8).padding(.horizontal, 14)
    .background(DS.C.bgSubtle, in: Capsule())
  }
}
/// شارة نصّية صغيرة
struct DSBadge: View {
  let text: String
  var fg: Color = DS.C.textOnBrand
  var bg: Color = DS.C.brandPrimary
  var body: some View { Text(text).font(DS.F.labelXs).foregroundStyle(fg).padding(.vertical, 3).padding(.horizontal, 8).background(bg, in: Capsule()) }
}
/// بلاطة إجراء سريع (أيقونة فوق تسمية)
struct DSQuickTile: View {
  let icon: String
  let title: String
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: icon).font(.system(size: 20, weight: .medium)).foregroundStyle(DS.C.brandPrimary)
      Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity).padding(.vertical, 14).padding(.horizontal, 6)
    .dsTile(padding: 0)
  }
}
/// بلاطة إحصاء (رقم فوق تسمية)
struct DSStatTile: View {
  let value: String
  let label: String
  var body: some View {
    VStack(spacing: 2) {
      Text(value).font(DS.F.numericLg).foregroundStyle(DS.C.textPrimary).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
      Text(label).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
    }
    .frame(maxWidth: .infinity).padding(.vertical, 12).padding(.horizontal, 8)
    .dsTile(padding: 0)
  }
}
/// نمط مفتاح التبديل بلون الهوية
struct DSToggleStyle: ToggleStyle {
  func makeBody(configuration: Configuration) -> some View {
    HStack {
      configuration.label
      Spacer()
      ZStack(alignment: configuration.isOn ? .trailing : .leading) {
        Capsule().fill(configuration.isOn ? DS.C.brandPrimary : DS.C.borderStrong).frame(width: 46, height: 28)
        Circle().fill(configuration.isOn ? DS.C.textOnBrand : DS.C.bgSurface).frame(width: 22, height: 22).padding(3)
      }
      .animation(.snappy(duration: 0.2), value: configuration.isOn)
      .onTapGesture { configuration.isOn.toggle() }
    }
  }
}
