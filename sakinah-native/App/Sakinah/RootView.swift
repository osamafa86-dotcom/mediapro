import SwiftUI
import SakinahCore

/// تبديل التبويب من داخل الشاشات (بلاطات الوصول السريع)
struct SwitchTabKey: EnvironmentKey { static let defaultValue: (AppTab) -> Void = { _ in } }
extension EnvironmentValues { var switchTab: (AppTab) -> Void { get { self[SwitchTabKey.self] } set { self[SwitchTabKey.self] = newValue } } }

/// غلافٌ معرَّف كي يقبله `fullScreenCover(item:)` — لقطات المتجر وحدها
private struct ShotPage: Identifiable { let page: Int; var id: Int { page } }

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var scenePhase
  @State private var showOnboarding = false
  @State private var tab: AppTab = ScreenshotMode.tab ?? .home
  /// صفحة المصحف التي يُفتح عليها القارئ في وضع اللقطات وحده
  @State private var shotPage: Int?
  /// ارتفاع الشريط العائم يُقاس ويُمرَّر لكل تبويب كمنطقة آمنة سفلية
  @State private var barHeight: CGFloat = 84
  /// البحث والإعدادات من الشريط الجانبي (الوضع الموسّع وحده — هيرو «اليوم» الموسّع بلا زرّيهما)
  @State private var railSearch = false
  @State private var railSettings = false
  /// باب حصن المسلم من رابط «دعاء الإفطار» في النشاط المباشر (sakinah://dua/<باب>)
  @State private var duaChapter: HisnChapter?

  var body: some View {
    // فئة العرض من عرض النافذة نفسها (Split View وStage Manager) لا من نوع الجهاز — GeometryReader يعطيها من أوّل إطار
    GeometryReader { geo in shell(WidthClass.of(geo.size.width)) }
    .background(DS.C.bgCanvas)
    .fullScreenCover(isPresented: $showOnboarding) { OnboardingView().environment(model) }
    // لقطات المتجر وحدها: يُفتح القارئ على صفحةٍ بعينها بلا قيادة واجهة
    .fullScreenCover(item: Binding(get: { shotPage.map(ShotPage.init) }, set: { shotPage = $0?.page })) { p in
      MushafReaderView(startPage: p.page).environment(model)
    }
    .onAppear {
      ScreenshotMode.seed(model)
      // القارئ في وضع اللقطات يُقدَّم بعد استقرار النافذة (تقديمه من أوّل إطار سقط صامتًا عند إقلاعٍ بطيء)
      if let p = ScreenshotMode.readerPage { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { shotPage = p } }
      if !model.settings.seenIntro && model.location.coordinate == nil { showOnboarding = true }
      Task.detached(priority: .utility) { _ = QuranText.shared; _ = MushafLayout.shared; _ = QuranSearch.shared; MushafFonts.shared.ensureAmiri(); MushafFonts.shared.ensureSurahNames() }
      model.location.onLocationResolved = { model.applyAutomaticMethodIfNeeded(); model.rescheduleNotifications() }
      if model.location.mode == .gps, model.location.authorization == .authorizedWhenInUse || model.location.authorization == .authorizedAlways { model.location.requestLocation() }
      model.rescheduleNotifications()
      LiveActivityManager.sync(model)
    }
    .onChange(of: scenePhase) { _, phase in
      // كل عودة للتطبيق: تحديث حالة الإشعارات وإعادة جدولة الأيام القادمة (حدّ النظام 64 إشعارًا معلّقًا)
      if phase == .active { model.notifications.refreshStatus(); model.rescheduleNotifications(); BackupService.autoSnapshot(model); LiveActivityManager.sync(model) }
    }
    // روابط الودجت والنشاط المباشر (المخطّط في project.yml): sakinah://today و sakinah://adhkar/<morning|evening|sleep>
    .onOpenURL { url in
      guard let route = SakinahURL.route(url) else { return }
      switch route {
      case .today:
        tab = .home
      case .adhkar(let p):
        if !p.isEmpty { model.pendingAdhkarPeriod = p }
        tab = .adhkar
      case .quran(let p):
        // «اقرأ حصّتك» من النشاط المباشر: الصفحة المرسلة، أو آخر موضع قراءة
        let page = p > 0 ? p : (model.settings.lastRead?.page ?? 1)
        model.pendingReaderPage = min(max(page, 1), 604)
        tab = .mushaf
      case .dua(let id):
        if let ch = Hisn.chapter(id) { duaChapter = ch }
      }
    }
    // الوضع الموسّع: البحث الشامل والإعدادات من الشريط الجانبي (على الهاتف والمتوسّط يفتحهما رأس «اليوم» كما كان)
    .fullScreenCover(isPresented: $railSearch) {
      SearchView(openTab: { t in
        railSearch = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { withAnimation(.snappy(duration: 0.2)) { tab = t } }
      })
      .environment(model)
      .environment(\.tabBarInset, 0)
      .environment(\.layoutDirection, .rightToLeft)
    }
    .sheet(isPresented: $railSettings) {
      NavigationStack { SettingsView(backTitle: "إغلاق").environment(model) }
        .environment(\.tabBarInset, 0)
        .environment(\.layoutDirection, .rightToLeft)
    }
    .sheet(item: $duaChapter) { ch in
      NavigationStack {
        HisnChapterView(chapter: ch).environment(model)
          .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { duaChapter = nil } } }
      }
      .environment(\.tabBarInset, 0)
      .environment(\.layoutDirection, .rightToLeft)
    }
  }

  /// الحاوية: التبويبات الأربعة وشريطها — عائمٌ أسفل الشاشة في المضغوط والمتوسّط، وجانبيٌّ في بداية الشاشة في الموسّع.
  /// TabView في الموضع البنيويّ نفسه في الحالين كي لا تُفقد حالة التبويبات (والتنقّل داخلها) حين يتغيّر عرض النافذة.
  private func shell(_ widthClass: WidthClass) -> some View {
    let wide = widthClass == .expanded
    // ⚠️ safeAreaInset على TabView (بناء ٣٩) أو على كل تبويب خارج NavigationStack (بناء ٤٠–٤٢) لم يصل إلى
    // ScrollView: كلاهما UIKit خلف الستار. فالشريط طبقة فوق الحاوية، وارتفاعه يُمرَّر بالبيئة، وكل شاشة
    // داخل التبويب (الجذر ووجهات الدفع) تطبّق `.tabBarClearance()` على محتواها مباشرة.
    return HStack(spacing: 0) {
      if wide {
        DSSideRail(selection: $tab, onSearch: { railSearch = true }, onSettings: { railSettings = true })
      }
      TabView(selection: $tab) {
        HomeView().hiddenSystemTabBar().tag(AppTab.home)
        MushafHomeView().hiddenSystemTabBar().tag(AppTab.mushaf)
        AdhkarHomeView().hiddenSystemTabBar().tag(AppTab.adhkar)
        LibraryView().hiddenSystemTabBar().tag(AppTab.library)
      }
      .environment(\.tabBarInset, wide ? 0 : barHeight)
      .overlay(alignment: .bottom) {
        if !wide {
          DSTabBar(selection: $tab)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { barHeight = $0 }
        }
      }
    }
    .environment(\.widthClass, widthClass)
    .environment(\.switchTab, { t in withAnimation(.snappy(duration: 0.2)) { tab = t } })
  }
}
