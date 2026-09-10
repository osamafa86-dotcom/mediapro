import SwiftUI
import SakinahCore

/// شاشة المصحف: متابعة القراءة، خطة الختمة، تحدّيات القراءة وخريطتها، بحث، والسور والأجزاء والعلامات
struct MushafHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var target: ReaderTarget?
  @State private var query = ""
  @State private var tab = 0
  @State private var sheet: HomeSheet?
  @State private var editBookmark: Ayah?

  struct ReaderTarget: Identifiable { let page: Int; var ayah: Int? = nil; var id: String { "\(page)-\(ayah ?? 0)" } }
  enum HomeSheet: Identifiable { case khatmah, challenges, reciter; var id: Int { switch self { case .khatmah: return 1; case .challenges: return 2; case .reciter: return 3 } } }

  var body: some View {
    NavigationStack {
      let s = model.settings; let q = model.quran
      List {
        Section { resumeCard.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
        if query.isEmpty {
          if let card = khatmahCard { Section { card.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) } }
          Section { readingCard.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
          Section {
            Picker("القسم", selection: $tab) { Text("السور").tag(0); Text("الأجزاء").tag(1); Text("العلامات").tag(2) }.pickerStyle(.segmented).listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16)).listRowBackground(Color.clear)
          }
          switch tab {
          case 0: Section { ForEach(QuranMeta.surahs) { su in Button { target = ReaderTarget(page: su.page, ayah: QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: s.numerals) }.tint(.primary) } }
          case 1: Section { ForEach(QuranMeta.juzStarts, id: \.juz) { j in Button { target = ReaderTarget(page: j.page) } label: { NavRow(num: Fmt.number(j.juz, numerals: s.numerals), title: QuranMeta.juzName(j.juz, vocalized: false), sub: "يبدأ من \(QuranMeta.surah(j.surah).name): \(Fmt.number(j.ayah, numerals: s.numerals))", page: Fmt.number(j.page, numerals: s.numerals)) }.tint(.primary) } }
          default:
            Section {
              if q.bookmarks.isEmpty { Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة مع ملاحظة»، أو زر العلامة في شريط القارئ").font(.arabic(13)).foregroundStyle(.secondary) }
              ForEach(q.bookmarks.reversed(), id: \.self) { b in
                if let a = QuranText.shared.ayah(surah: b.surah, ayah: b.ayah) {
                  Button { target = ReaderTarget(page: a.page, ayah: a.n) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: s.numerals) }.tint(.primary)
                    .swipeActions { Button(role: .destructive) { q.removeBookmark(a) } label: { Label("حذف", systemImage: "trash") }; Button { editBookmark = a } label: { Label("تعديل", systemImage: "pencil") }.tint(Theme.primary) }
                }
              }
            }
          }
        } else {
          QuranSearchRows(query: query) { p, n in target = ReaderTarget(page: p, ayah: n) }
        }
      }
      .searchable(text: $query, prompt: "ابحث عن سورة أو آية أو رقم صفحة…")
      .navigationTitle("المصحف")
      .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { target = ReaderTarget(page: s.lastRead?.page ?? 1) } label: { Image(systemName: "book") }.accessibilityLabel("فتح المصحف") } }
      .safeAreaInset(edge: .bottom) { if model.player.current != nil { AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { target = ReaderTarget(page: $0) }) } }
      .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page, ayah: t.ayah).environment(model) }
      .sheet(item: $sheet) { sh in
        switch sh { case .khatmah: KhatmahSheet().environment(model); case .challenges: ChallengesSheet().environment(model); case .reciter: ReciterPickerSheet().environment(model) }
      }
      .sheet(item: $editBookmark) { a in BookmarkSheet(ayah: a, onDone: { _ in }).environment(model).presentationDetents([.medium]) }
    }
  }

  private var resumeCard: some View {
    let s = model.settings; let last = s.lastRead
    return Button { target = ReaderTarget(page: last?.page ?? 1, ayah: last.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n }) } label: {
      HStack(spacing: 14) {
        Image(systemName: last == nil ? "book.closed.fill" : "bookmark.fill").font(.system(size: 30)).foregroundStyle(.white).frame(width: 56, height: 56).background(Theme.primary, in: RoundedRectangle(cornerRadius: 14))
        VStack(alignment: .leading, spacing: 3) {
          Text(last == nil ? "ابدأ القراءة" : "متابعة القراءة").font(.arabic(18, weight: .bold))
          if let last {
            Text("\(QuranMeta.surah(last.surah).name) · آية \(Fmt.number(last.ayah, numerals: s.numerals)) · صفحة \(Fmt.number(last.page, numerals: s.numerals)) · الجزء \(Fmt.number(QuranMeta.juz(ofPage: last.page), numerals: s.numerals))").font(.arabic(13)).foregroundStyle(.secondary)
            Text(relative(last.at)).font(.arabic(12)).foregroundStyle(.tertiary)
          } else { Text("مصحف المدينة النبوية · حفص عن عاصم · ٦٠٤ صفحات").font(.arabic(13)).foregroundStyle(.secondary) }
        }
        Spacer()
        Image(systemName: "chevron.backward").foregroundStyle(.tertiary)
      }
      .padding(16).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 18))
    }
    .buttonStyle(.plain).padding(.horizontal, 16).padding(.vertical, 4)
  }

  private var khatmahCard: AnyView? {
    let q = model.quran; let s = model.settings; let today = model.todayKey; let numerals = s.numerals
    let streak = Khatmah.streak(q.readLog, today: today)
    guard let plan = q.khatmah else {
      let st = Khatmah.stats(q.readLog, today: today)
      if st.month == 0 && streak == 0 { return nil }
      return AnyView(card {
        HStack { Text("قراءتك").font(.arabic(16, weight: .bold)); Spacer(); Button("خطة ختمة") { sheet = .khatmah }.buttonStyle(.bordered).font(.arabic(13)) }
        HStack(spacing: 14) { stat("سلسلة الأيام", Fmt.number(streak, numerals: numerals)); stat("هذا الأسبوع", "\(Fmt.number(st.week, numerals: numerals)) صفحة"); stat("هذا الشهر", "\(Fmt.number(st.month, numerals: numerals)) صفحة") }
      })
    }
    let cur = s.lastRead?.page ?? plan.startPage
    let stt = Khatmah.status(plan, currentPage: cur, log: q.readLog, today: today)
    return AnyView(card {
      HStack { Text(stt.finished ? "تقبّل الله ✦ أتممت الختمة" : "خطة الختمة · \(Fmt.number(plan.days, numerals: numerals)) يومًا").font(.arabic(16, weight: .bold)); Spacer(); Button("تعديل") { sheet = .khatmah }.buttonStyle(.bordered).font(.arabic(13)) }
      ProgressView(value: Double(stt.percent) / 100).tint(Theme.gold)
      HStack(spacing: 12) {
        stat("\(Fmt.number(stt.percent, numerals: numerals))٪", "\(Fmt.number(stt.done, numerals: numerals)) من \(Fmt.number(604, numerals: numerals))")
        stat("اليوم", "\(Fmt.number(stt.todayPages, numerals: numerals)) / \(Fmt.number(stt.todayTarget, numerals: numerals))")
        stat("سلسلة", "\(Fmt.number(streak, numerals: numerals)) يوم")
      }
      HStack { Text(stt.behind > 0 ? "متأخّر \(Fmt.number(stt.behind, numerals: numerals)) صفحة" : "على الجدول ✓").font(.arabic(12)).foregroundStyle(stt.behind > 0 ? .red : Theme.primary); Spacer(); Text("الإتمام المتوقع: \(Fmt.shortDate(key: stt.etaKey, numerals: numerals))").font(.arabic(12)).foregroundStyle(.secondary) }
      Button { target = ReaderTarget(page: cur, ayah: s.lastRead.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n }) } label: { Label(stt.todayPages >= stt.todayTarget ? "أكملت ورد اليوم — تابع" : "اقرأ ورد اليوم", systemImage: "play.fill").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent)
    })
  }

  private var readingCard: some View {
    let q = model.quran; let numerals = model.settings.numerals; let today = model.todayKey
    let pr = Challenges.progress(q.challenge, log: q.readLog, today: today)
    let hasLog = !q.readLog.isEmpty
    return card {
      if let pr {
        HStack { Text(pr.finished ? "✓ أتممت: \(pr.name)" : pr.name).font(.arabic(16, weight: .bold)); Spacer(); Text(pr.finished ? "" : pr.late ? "انتهت المدة" : "اليوم \(Fmt.number(pr.dayIndex + 1, numerals: numerals)) من \(Fmt.number(Catalog.shared.challenge(pr.id)?.days ?? 1, numerals: numerals))").font(.arabic(12)).foregroundStyle(.secondary) }
        ProgressView(value: Double(pr.pct) / 100).tint(pr.late ? .red : Theme.primary)
        HStack {
          Text("\(Fmt.number(pr.done, numerals: numerals)) / \(Fmt.number(pr.total, numerals: numerals)) صفحة\(pr.finished ? "" : " · يتبقى نحو \(Fmt.number(pr.minutesLeft, numerals: numerals)) دقيقة")").font(.arabic(12)).foregroundStyle(.secondary)
          Spacer()
          if pr.finished { Button("تحدٍّ جديد") { sheet = .challenges }.buttonStyle(.borderedProminent).font(.arabic(13)) }
          else { Button { var done = Set<Int>(); for (k, pages) in q.readLog where k >= (q.challenge?.startedAt ?? "") { done.formUnion(pages) }; var p = pr.from; while p < pr.to && done.contains(p) { p += 1 }; target = ReaderTarget(page: p) } label: { Label("اقرأ", systemImage: "play.fill") }.buttonStyle(.borderedProminent).font(.arabic(13)) }
          Button("إنهاء") { q.challenge = nil }.buttonStyle(.bordered).font(.arabic(13))
        }
      } else {
        HStack { Text(hasLog ? "قراءتك في 90 يومًا" : "تحدّيات القراءة").font(.arabic(16, weight: .bold)); Spacer(); Button("ابدأ تحدّيًا") { sheet = .challenges }.buttonStyle(.bordered).font(.arabic(13)) }
        if !hasLog { Text("سورة الكهف يوم الجمعة، جزء عمّ في أسبوع، الملك كل ليلة… بمدة تقديرية وتقدّم يومي.").font(.arabic(12)).foregroundStyle(.secondary) }
      }
      if hasLog || pr != nil { HeatmapView(days: Challenges.heatmap(q.readLog, today: today, days: 90), numerals: numerals) }
    }
  }
  private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 10) { content() }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 18)).padding(.horizontal, 16).padding(.vertical, 4)
  }
  private func stat(_ label: String, _ value: String) -> some View { VStack(alignment: .leading, spacing: 2) { Text(label).font(.arabic(11)).foregroundStyle(.secondary); Text(value).font(.arabic(14, weight: .bold)) } }
  private func relative(_ ms: Double) -> String { let f = RelativeDateTimeFormatter(); f.locale = Locale(identifier: "ar"); f.unitsStyle = .full; return f.localizedString(for: Date(timeIntervalSince1970: ms / 1000), relativeTo: Date()) }
}

/// خريطة حرارة القراءة (90 يومًا): مربعات أسبوعية
struct HeatmapView: View {
  let days: [HeatDay]; let numerals: String
  var body: some View {
    let mx = max(1, days.map(\.count).max() ?? 1)
    let total = days.reduce(0) { $0 + $1.count }; let active = days.filter { $0.count > 0 }.count
    VStack(alignment: .leading, spacing: 6) {
      Canvas { ctx, size in
        let cols = Int((Double(days.count) / 7).rounded(.up)); let cell = min(size.width / CGFloat(cols), size.height / 7); let gap: CGFloat = 2
        for (i, d) in days.enumerated() {
          let col = i / 7, row = i % 7
          let x = size.width - CGFloat(col + 1) * cell + gap / 2, y = CGFloat(row) * cell + gap / 2
          let lvl = d.count == 0 ? 0.0 : d.count >= Int(Double(mx) * 0.75) ? 1.0 : d.count >= Int(Double(mx) * 0.5) ? 0.75 : d.count >= Int(Double(mx) * 0.25) ? 0.5 : 0.3
          ctx.fill(Path(roundedRect: CGRect(x: x, y: y, width: cell - gap, height: cell - gap), cornerRadius: 2), with: .color(lvl == 0 ? Color.secondary.opacity(0.15) : Theme.primary.opacity(lvl)))
        }
      }
      .frame(height: 7 * 11)
      HStack { Text("قبل ٩٠ يومًا").font(.arabic(10)).foregroundStyle(.tertiary); Spacer(); Text("\(Fmt.number(total, numerals: numerals)) صفحة · \(Fmt.number(active, numerals: numerals)) يوم قراءة").font(.arabic(11)).foregroundStyle(.secondary); Spacer(); Text("اليوم").font(.arabic(10)).foregroundStyle(.tertiary) }
    }
    .accessibilityLabel("خريطة القراءة لآخر 90 يومًا: \(total) صفحة في \(active) يومًا")
  }
}

struct BookmarkRow: View {
  let bookmark: WebSettings.Bookmark; let ayah: Ayah; let numerals: String
  var body: some View {
    let c: Color = bookmark.color == "green" ? Color(red: 0.16, green: 0.62, blue: 0.35) : bookmark.color == "red" ? Color(red: 0.86, green: 0.2, blue: 0.2) : bookmark.color == "blue" ? Color(red: 0.15, green: 0.39, blue: 0.92) : Theme.gold
    HStack(spacing: 12) {
      Image(systemName: "bookmark.fill").foregroundStyle(c).frame(width: 34)
      VStack(alignment: .leading, spacing: 2) {
        Text("\(QuranMeta.surah(ayah.surah).name): \(Fmt.number(ayah.ayah, numerals: numerals))").font(.arabic(16))
        if let n = bookmark.note, !n.isEmpty { Text(n).font(.arabic(12)).foregroundStyle(.secondary).lineLimit(2) }
        else { Text(ayah.text.count > 70 ? String(ayah.text.prefix(70)) + "…" : ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 13)).foregroundStyle(.secondary).lineLimit(1) }
      }
      Spacer()
      Text("ص \(Fmt.number(ayah.page, numerals: numerals))").font(.arabic(12)).foregroundStyle(.tertiary)
    }
    .contentShape(Rectangle())
  }
}

/// صفوف نتائج البحث داخل قائمة الشاشة الرئيسية
struct QuranSearchRows: View {
  @Environment(AppModel.self) private var model
  let query: String
  var onGo: (Int, Int?) -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let s = QuranNormalize.foldDigits(query.trimmingCharacters(in: .whitespaces))
    if let p = Int(s), (1...604).contains(p) {
      Section { Button { onGo(p, nil) } label: { NavRow(num: Fmt.number(p, numerals: numerals), title: "الانتقال إلى الصفحة \(Fmt.number(p, numerals: numerals))", sub: QuranText.shared.label(ofPage: p).map { "\(QuranMeta.surah($0.surah).name) · الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "", page: Fmt.number(p, numerals: numerals)) }.tint(.primary) }
    } else if let ref = QuranSearch.parseRef(s), let a = QuranText.shared.ayah(surah: ref.surah.n, ayah: min(ref.surah.ayahs, ref.ayah)) {
      Section { Button { onGo(a.page, a.n) } label: { NavRow(num: Fmt.number(a.surah, numerals: numerals), title: "سورة \(ref.surah.name) — الآية \(Fmt.number(a.ayah, numerals: numerals))", sub: "الصفحة \(Fmt.number(a.page, numerals: numerals))", page: Fmt.number(a.page, numerals: numerals)) }.tint(.primary) }
    } else {
      let surahs = QuranSearch.matchSurahs(s)
      let ayahs = s.count >= 2 ? QuranSearch.shared.search(s, limit: 30) : []
      if !surahs.isEmpty { Section("سور") { ForEach(surahs) { su in Button { onGo(su.page, QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: numerals) }.tint(.primary) } } }
      if !ayahs.isEmpty {
        Section("آيات (\(Fmt.number(ayahs.count, numerals: numerals))\(ayahs.count == 30 ? "+" : ""))") {
          ForEach(ayahs) { a in Button { onGo(a.page, a.n) } label: { HStack { VStack(alignment: .leading, spacing: 3) { Text(a.text.count > 90 ? String(a.text.prefix(90)) + "…" : a.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 15)).lineLimit(2); Text(QuranSearch.refLabel(a)).font(.arabic(12)).foregroundStyle(.secondary) }; Spacer(); Text("ص \(Fmt.number(a.page, numerals: numerals))").font(.arabic(12)).foregroundStyle(.tertiary) }.contentShape(Rectangle()) }.tint(.primary) }
        }
      }
      if surahs.isEmpty && ayahs.isEmpty { Section { Text("لا نتائج").foregroundStyle(.secondary) } }
    }
  }
}

/// فهرس المصحف داخل القارئ: السور (مع بحث)، الأجزاء، والانتقال إلى صفحة
struct MushafIndexView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let currentPage: Int
  var onSelect: (Int) -> Void
  @State private var tab = 0
  @State private var query = ""
  var body: some View {
    let numerals = model.settings.numerals
    NavigationStack {
      VStack(spacing: 0) {
        Picker("القسم", selection: $tab) { Text("السور").tag(0); Text("الأجزاء").tag(1); Text("العلامات").tag(2) }.pickerStyle(.segmented).padding(.horizontal).padding(.bottom, 8)
        switch tab {
        case 0: SurahListView(query: $query, currentPage: currentPage) { onSelect($0) }
        case 1:
          List(QuranMeta.juzStarts, id: \.juz) { j in Button { onSelect(j.page) } label: { NavRow(num: Fmt.number(j.juz, numerals: numerals), title: QuranMeta.juzName(j.juz, vocalized: false), sub: "\(QuranMeta.surah(j.surah).name) · الآية \(Fmt.number(j.ayah, numerals: numerals))", page: Fmt.number(j.page, numerals: numerals), current: QuranMeta.juz(ofPage: currentPage) == j.juz) }.tint(.primary) }.listStyle(.plain)
        default:
          List {
            if model.quran.bookmarks.isEmpty { Text("لا علامات بعد").foregroundStyle(.secondary) }
            ForEach(model.quran.bookmarks.reversed(), id: \.self) { b in if let a = QuranText.shared.ayah(surah: b.surah, ayah: b.ayah) { Button { onSelect(a.page) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: numerals) }.tint(.primary) } }
          }.listStyle(.plain)
        }
      }
      .navigationTitle("الفهرس").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() } } }
    }
  }
}

/// قائمة السور مع بحث بالاسم (تطبيع الهمزات والتاء المربوطة والتشكيل)
struct SurahListView: View {
  @Environment(AppModel.self) private var model
  @Binding var query: String
  var currentPage: Int = 0
  var onSelect: (Int) -> Void
  private var filtered: [Surah] {
    let q = CityDatabase.normalize(query)
    if q.isEmpty { return QuranMeta.surahs }
    if let n = Int(QuranNormalize.foldDigits(q)), (1...114).contains(n) { return [QuranMeta.surah(n)] }
    return QuranMeta.surahs.filter { CityDatabase.normalize($0.plain).contains(q) || CityDatabase.normalize($0.name).contains(q) || $0.en.lowercased().contains(q) }
  }
  var body: some View {
    let s = model.settings
    List(filtered) { su in
      Button { onSelect(su.page) } label: { SurahRow(surah: su, numerals: s.numerals, current: currentPage >= su.page && currentPage < (su.n < 114 ? QuranMeta.surah(su.n + 1).page : 605)) }.tint(.primary)
    }
    .listStyle(.plain)
    .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "ابحث عن سورة")
  }
}

struct SurahRow: View {
  let surah: Surah; let numerals: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      ZStack { Image(systemName: "seal").font(.system(size: 34, weight: .ultraLight)).foregroundStyle(Theme.gold); Text(Fmt.number(surah.n, numerals: numerals)).font(.arabic(13, weight: .bold)) }.frame(width: 38)
      VStack(alignment: .leading, spacing: 2) {
        Text(surah.name).font(.arabic(17, weight: .semibold))
        Text("\(surah.type) · \(Fmt.number(surah.ayahs, numerals: numerals)) آية · صفحة \(Fmt.number(surah.page, numerals: numerals))").font(.arabic(12)).foregroundStyle(.secondary)
      }
      Spacer()
      if current { Image(systemName: "bookmark.fill").foregroundStyle(Theme.gold) }
      Text(surah.en).font(.system(size: 12)).foregroundStyle(.tertiary)
    }
    .contentShape(Rectangle())
  }
}
