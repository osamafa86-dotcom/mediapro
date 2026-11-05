import SwiftUI
import SakinahCore

/// «المكتبة» (المرحلة الخامسة — library.png): رأسٌ بعنوانه ووصفه وزرّ الإعدادات، «حديث اليوم» ببطاقة «اليوم» نفسها،
/// «المحتوى» شبكة بطاقاتٍ أربع، «الأدوات» (القبلة كاملةً، المسبحة، المساجد، الجدول الشهري)، و«التطبيق»؛
/// والإصدار في السطر الأخير (وفي الإعدادات). لا بطاقة هوية بعد اليوم.
/// ملاحظة اتجاه: البيئة RTL، فـ`.leading` هو اليمين و`.trailing` هو اليسار.
struct LibraryView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.switchTab) private var switchTab
  @State private var showChallenges = false
  @State private var showQibla = false
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 22) {
          header
          hadithSection
          contentSection
          toolsSection
          appSection
          Text("سكينة \u{2066}\(version)\u{2069}، يعمل دون اتصال، بلا إعلانات ولا تتبّع")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
        .readableWidth()
      }
      .background(DS.C.bgCanvas)
      .tabBarClearance()
      .navigationBarHidden(true)
      .sheet(isPresented: $showChallenges) { KhatmahSheet(onGo: { p in showChallenges = false; model.pendingReaderPage = p; switchTab(.mushaf) }).environment(model) }
      // القبلة الكاملة (البوصلة، والشمس، والخريطة) كما تُفتح من ميدالية «اليوم»
      .fullScreenCover(isPresented: $showQibla) { QiblaView(presented: true).environment(model) }
    }
  }

  /// العنوان ووصفه يمينًا وزرّ الإعدادات يسارًا
  private var header: some View {
    SectionScreenHeader(title: "المكتبة", subtitle: "الحديث، والأوراد، والأدوات") {
      NavigationLink { SettingsView(backTitle: "المكتبة").environment(model).tabBarClearance() } label: {
        DSIcon(systemName: "slider.horizontal.3", size: 44, iconSize: 18)
      }
      .buttonStyle(.plain).accessibilityLabel("الإعدادات")
    }
    .padding(.top, DS.Space.s2)
  }

  // MARK: حديث اليوم — بطاقة «اليوم» نفسها
  private var hadithSection: some View {
    VStack(spacing: 10) {
      DSSectionHead("حديث اليوم") {
        NavigationLink { HadithView(embedded: true).environment(model).tabBarClearance() } label: {
          DSLinkLabel(title: "الحديث").frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel("الحديث")
      }
      TodayHadithCard()
    }
  }

  // MARK: المحتوى — شبكة ٢×٢
  private var contentSection: some View {
    let n = model.settings.numerals
    let sahih = ArabicCount.phrase(HadithLibrary.hadiths.count, one: "حديث واحد", two: "حديثان", few: "أحاديث", many: "حديثًا", numerals: n)
    let nawawi = ArabicCount.phrase(HadithLibrary.nawawi.count, one: "حديث واحد", two: "حديثان", few: "أحاديث", many: "حديثًا", numerals: n)
    let chapters = ArabicCount.phrase(Hisn.chapters.count, one: "باب واحد", two: "بابان", few: "أبواب", many: "بابًا", numerals: n)
    return VStack(spacing: 10) {
      DSSectionHead("المحتوى")
      LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
        NavigationLink { HadithView(embedded: true).environment(model).tabBarClearance() } label: {
          contentCard("text.book.closed", "الحديث", "مختارات الصحيحين، \(sahih)")
        }
        .buttonStyle(.plain)
        NavigationLink { HadithView(initialBook: "nawawi", embedded: true).environment(model).tabBarClearance() } label: {
          contentCard("list.bullet.rectangle", "الأربعون النووية", "\(nawawi) بمتونها وتخريجها")
        }
        .buttonStyle(.plain)
        NavigationLink { HisnView().environment(model).tabBarClearance() } label: {
          contentCard("shield", "حصن المسلم", "\(chapters)، والمفضّلة")
        }
        .buttonStyle(.plain)
        Button { showChallenges = true } label: {
          contentCard("book", "الختمة والأوراد", "الكهف يوم الجمعة، والملك ليلًا")
        }
        .buttonStyle(.plain)
      }
    }
  }
  private func contentCard(_ icon: String, _ title: String, _ sub: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      DSSquareIcon(systemName: icon)
      Spacer(minLength: 6)
      Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
      Text(sub).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(2).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, minHeight: 124, alignment: .topLeading)
    .padding(14)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
    .contentShape(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .accessibilityElement(children: .combine)
  }

  // MARK: الأدوات
  private var toolsSection: some View {
    VStack(spacing: 10) {
      DSSectionHead("الأدوات")
      VStack(spacing: 0) {
        Button { showQibla = true } label: {
          SectionListRow(icon: "safari", title: "القبلة", subtitle: "البوصلة، والشمس، والخريطة")
        }
        .buttonStyle(.plain)
        SectionRowDivider()
        NavigationLink { TasbihView(backTitle: "المكتبة").environment(model).tabBarClearance() } label: {
          SectionListRow(icon: "circle.hexagongrid", title: "المسبحة", subtitle: "عدّاد، وهدف، وسجلّ الأسبوع")
        }
        .buttonStyle(.plain)
        SectionRowDivider()
        NavigationLink { MosquesView().environment(model).tabBarClearance() } label: {
          SectionListRow(icon: "building.columns", title: "المساجد القريبة", subtitle: "أقرب مسجد والاتجاه إليه")
        }
        .buttonStyle(.plain)
        SectionRowDivider()
        NavigationLink { MonthTableView().environment(model).tabBarClearance() } label: {
          SectionListRow(icon: "calendar", title: "الجدول الشهري", subtitle: "مواقيت الشهر، وتصديرها إلى التقويم")
        }
        .buttonStyle(.plain)
      }
      .todayCard(padding: 4)
    }
  }

  // MARK: التطبيق
  private var appSection: some View {
    VStack(spacing: 10) {
      DSSectionHead("التطبيق")
      VStack(spacing: 0) {
        NavigationLink { WidgetsHelpView().environment(model).tabBarClearance() } label: {
          SectionListRow(icon: "sun.horizon", title: "الودجت والنشاط الحيّ", subtitle: "على الشاشة الرئيسة وشاشة القفل")
        }
        .buttonStyle(.plain)
        SectionRowDivider()
        NavigationLink { DownloadsView().environment(model) } label: {
          SectionListRow(icon: "arrow.down.circle", title: "التنزيلات دون اتصال", subtitle: downloadsLabel)
        }
        .buttonStyle(.plain)
        SectionRowDivider()
        NavigationLink { BackupView().environment(model).tabBarClearance() } label: {
          SectionListRow(icon: "square.and.arrow.up", title: "النسخ الاحتياطي", subtitle: "تصدير إعداداتك واستيرادها")
        }
        .buttonStyle(.plain)
      }
      .todayCard(padding: 4)
    }
  }

  private var downloadsLabel: String {
    let n = model.downloads.summary(reciter: model.quran.reciter).count
    let surahs = n > 0 ? ArabicCount.phrase(n, one: "سورة واحدة محفوظة", two: "سورتان محفوظتان", few: "سور محفوظة", many: "سورة محفوظة", numerals: model.settings.numerals) : "لا تلاوات محفوظة بعد"
    return "\(surahs)، وخطّ المصحف"
  }
}
