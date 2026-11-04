import SwiftUI
import SakinahCore

/// «المكتبة» (المرحلة الثانية — كانت «المزيد»): بطاقة هوية التطبيق، ثم المحتوى والأدوات.
/// الإعدادات لم تعد صفًّا هنا: تُفتح من رأس «اليوم»، ومن زرّ الترس في رأس هذه الشاشة.
/// ملاحظة اتجاه: البيئة RTL، فـ`.leading` هو اليمين و`.trailing` هو اليسار.
struct LibraryView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.switchTab) private var switchTab
  @State private var showChallenges = false
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s4) {
          header
          brandCard
          group("المحتوى") {
            NavigationLink { HadithView(embedded: true).environment(model).tabBarClearance() } label: {
              DSRow(icon: "text.book.closed", title: "الحديث", subtitle: "مختارات الصحيحين، وحديث اليوم") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { HadithView(initialBook: "nawawi", embedded: true).environment(model).tabBarClearance() } label: {
              DSRow(icon: "list.bullet.rectangle", title: "الأربعون النووية", subtitle: nil) { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { HisnView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "book.closed", title: "حصن المسلم", subtitle: "\(Fmt.number(Hisn.chapters.count, numerals: model.settings.numerals)) بابًا") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            Button { showChallenges = true } label: {
              DSRow(icon: "book.closed", iconStyle: .gold, title: "الختمة والأوراد المسنونة", subtitle: streakLabel) { DSChevron() }
            }.buttonStyle(.plain)
          }
          group("الأدوات") {
            NavigationLink { TasbihView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "circle.hexagongrid", title: "المسبحة", subtitle: "عدّاد التسبيح والإحصاء") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { MosquesView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "building.columns", title: "المساجد القريبة", subtitle: "أقرب مسجد والاتجاهات إليه") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { MonthTableView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "calendar", title: "الجدول الشهري", subtitle: "تصدير ICS") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { WidgetsHelpView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "bolt", title: "الودجت والنشاط المباشر", subtitle: "شاشة القفل والجزيرة الديناميكية") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { DownloadsView().environment(model) } label: {
              DSRow(icon: "arrow.down.circle", title: "التنزيلات دون اتصال", subtitle: downloadsLabel) { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { BackupView().environment(model).tabBarClearance() } label: {
              DSRow(icon: "icloud", title: "النسخ الاحتياطي", subtitle: "تصدير واستيراد إعداداتك") { DSChevron() }
            }.buttonStyle(.plain)
          }
          Text("سكينة \u{2066}\(version)\u{2069} (بناء \u{2066}\(build)\u{2069}) — تطبيق أصلي بالكامل يعمل دون اتصال. لا حساب ولا تتبّع؛ الشبكة تُستعمل فقط لجلب التلاوات وتلاوة الأذكار والمساجد القريبة عند الطلب.")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      }
      .background(DS.C.bgCanvas)
      .tabBarClearance()
      .navigationBarHidden(true)
      .sheet(isPresented: $showChallenges) { KhatmahSheet(onGo: { p in showChallenges = false; model.pendingReaderPage = p; switchTab(.mushaf) }).environment(model) }
    }
  }

  /// العنوان يمينًا وزرّ الإعدادات يسارًا
  private var header: some View {
    HStack(spacing: DS.Space.s3) {
      Text("المكتبة").font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary)
      Spacer(minLength: 0)
      NavigationLink { SettingsView(backTitle: "المكتبة").environment(model).tabBarClearance() } label: {
        DSIcon(systemName: "slider.horizontal.3", size: 44, iconSize: 18)
      }
      .buttonStyle(.plain).accessibilityLabel("الإعدادات")
    }
    .padding(.top, DS.Space.s2)
  }

  private var brandCard: some View {
    HStack(spacing: DS.Space.s4) {
      VStack(alignment: .leading, spacing: DS.Space.s2) {
        Text("سكينة").font(DS.F.displayMd).foregroundStyle(DS.C.textPrimary)
        Text("مواقيتك ومصحفك وأذكارك، بلا إعلانات ولا تتبّع")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(2).minimumScaleFactor(0.8)
        HStack(spacing: DS.Space.s2) {
          Text("لا يجمع بيانات").font(DS.F.labelXs).foregroundStyle(DS.C.brandPrimary)
            .padding(.vertical, 4).padding(.horizontal, 10).background(DS.C.brandSoft, in: Capsule())
          Text("الإصدار \u{2066}\(version)\u{2069}").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
            .padding(.vertical, 4).padding(.horizontal, 10).background(DS.C.bgSubtle, in: Capsule())
        }
      }
      Spacer(minLength: 0)
      ZStack {
        Circle().fill(DS.C.accentGoldSoft).frame(width: 62, height: 62)
        Image(systemName: "moon.stars.fill").font(.system(size: 26)).foregroundStyle(DS.C.accentGoldStrong)
      }
      .accessibilityHidden(true)
    }
    .dsCard()
  }

  /// لا سلسلة تنكسر: التزامك بالورد في الأسبوعين الأخيرين إن كانت ثمّة خطة
  private var streakLabel: String? {
    guard let plan = model.quran.khatmah else { return nil }
    let c = Wird.commitment(model.quran.wird, today: model.todayKey, target: plan.dailyPages, days: 14)
    return "التزامك \(Fmt.number(c.done, numerals: model.settings.numerals)) من \(Fmt.number(c.total, numerals: model.settings.numerals)) يومًا"
  }
  private var downloadsLabel: String? {
    let n = model.downloads.summary(reciter: model.quran.reciter).count
    return n > 0 ? "\(Fmt.number(n, numerals: model.settings.numerals)) سورة محفوظة" : "لا تنزيلات بعد"
  }

  @ViewBuilder private func group<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: DS.Space.s2) {
      Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, DS.Space.s1)
      VStack(spacing: 0) { content() }.dsCard(padding: DS.Space.s2)
    }
  }
}
