import SwiftUI
import UIKit
import SakinahCore

enum AyahAction { case tafsir, translation, wordMeanings, listen, playFrom, repeat3, bookmark, lastRead, hifz, share, shareImage, copy }

/// التفسير الميسّر للآية مع التنقل بين آيات السورة
struct TafsirSheet: View {
  @Environment(AppModel.self) private var model
  @State var ayah: Ayah
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          Text(ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).lineSpacing(9).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            .padding(14).background(Theme.paper, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(Color(hex: "#1d1a14"))
          if let html = Tafsir.shared.text(surah: ayah.surah, ayah: ayah.ayah) {
            Text(attributed(html)).font(.arabic(16)).lineSpacing(6)
          } else { Text("لا تفسير لهذه الآية في المصدر المضمّن.").foregroundStyle(.secondary) }
          Text("التفسير الميسّر — مجمع الملك فهد لطباعة المصحف الشريف").font(.arabic(12)).foregroundStyle(.tertiary)
        }
        .padding()
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("تفسير \(QuranSearch.refLabel(ayah))").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItemGroup(placement: .bottomBar) {
          Button { move(-1) } label: { Label("الآية السابقة", systemImage: "chevron.forward") }.disabled(ayah.ayah <= 1)
          Spacer()
          Text("الآية \(Fmt.number(ayah.ayah, numerals: model.settings.numerals))").font(.arabic(13)).foregroundStyle(.secondary)
          Spacer()
          Button { move(1) } label: { Label("الآية التالية", systemImage: "chevron.backward") }.disabled(ayah.ayah >= QuranMeta.surah(ayah.surah).ayahs)
        }
      }
    }
  }
  private func move(_ d: Int) { if let a = QuranText.shared.ayah(surah: ayah.surah, ayah: ayah.ayah + d) { ayah = a } }
  private func attributed(_ html: String) -> AttributedString {
    var out = AttributedString()
    for r in Tafsir.runs(html) { var a = AttributedString(r.text); if r.bold { a.font = .arabic(16, weight: .bold); a.foregroundColor = Theme.primary }; out.append(a) }
    return out
  }
}

/// علامة مع ملاحظة ولون
struct BookmarkSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let ayah: Ayah
  var onDone: (String) -> Void
  @State private var note = ""
  @State private var color = "gold"
  private let colors: [(String, Color)] = [("gold", Theme.gold), ("green", Color(red: 0.16, green: 0.62, blue: 0.35)), ("red", Color(red: 0.86, green: 0.2, blue: 0.2)), ("blue", Color(red: 0.15, green: 0.39, blue: 0.92))]
  var body: some View {
    let existing = model.quran.bookmark(for: ayah)
    NavigationStack {
      Form {
        Section { Text(ayah.text.count > 160 ? String(ayah.text.prefix(160)) + "…" : ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 17)).lineSpacing(8) }
        Section("ملاحظة (اختياري)") { TextField("تدبّر، فائدة، تذكير…", text: $note, axis: .vertical).lineLimit(3...6) }
        Section("اللون") {
          HStack(spacing: 14) {
            ForEach(colors, id: \.0) { pair in
              let (k, c) = pair
              Button { color = k } label: { Circle().fill(c).frame(width: 34, height: 34).overlay { if color == k { Image(systemName: "checkmark").foregroundStyle(.white).font(.system(size: 14, weight: .bold)) } } }.buttonStyle(.plain).accessibilityLabel("لون \(k)")
            }
          }
        }
        Section {
          Button(existing == nil ? "حفظ العلامة" : "تحديث العلامة") { model.quran.setBookmark(ayah, note: note, color: color); onDone(existing == nil ? "أُضيفت علامة عند \(QuranSearch.refLabel(ayah))" : "حُدّثت العلامة"); dismiss() }.font(.arabic(16, weight: .bold))
          if existing != nil { Button("إزالة العلامة", role: .destructive) { model.quran.removeBookmark(ayah); onDone("أُزيلت العلامة"); dismiss() } }
        }
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("علامة — \(QuranSearch.refLabel(ayah))").navigationBarTitleDisplayMode(.inline)
      .onAppear { note = existing?.note ?? ""; color = existing?.color ?? "gold" }
    }
  }
}

/// العرض والألوان: معاينة حيّة لآيةٍ من المتن على ورق السمة، ثم مجموعات السمات، الإضاءة، طريقة العرض، والنصّ المتدفّق
struct DisplaySheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.colorScheme) private var scheme
  var onLegend: () -> Void
  var body: some View {
    @Bindable var q = model.quran
    let c = Catalog.shared; let numerals = model.settings.numerals
    let theme = q.effectiveTheme(systemDark: scheme == .dark)
    NavigationStack {
      Form {
        Section {
          preview(theme, q)
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0)).listRowBackground(Color.clear)
        } footer: {
          Text("السمة الحالية: \(theme.name)\(q.themeAuto ? " · الليلي يتبع النظام" : "")\(q.dim > 0 ? " · تعتيم \(Fmt.number(Int(q.dim * 100), numerals: numerals))٪" : "")").font(.arabic(12))
        }
        Section("لون الصفحة") {
          ForEach(c.themeGroups, id: \.id) { g in
            VStack(alignment: .leading, spacing: 6) {
              Text(g.name).font(.arabic(12)).foregroundStyle(.secondary)
              LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(c.themes.filter { $0.group == g.id }) { t in
                  Button { q.setTheme(t.id) } label: {
                    VStack(spacing: 4) {
                      Text("ق").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).foregroundStyle(Color(hex: t.ink)).frame(width: 44, height: 40).background(Color(hex: t.paper), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(q.theme == t.id ? DS.C.brandPrimary : Color.secondary.opacity(0.3), lineWidth: q.theme == t.id ? 2 : 1))
                      Text(t.name).font(.arabic(10)).lineLimit(1)
                    }
                  }
                  .buttonStyle(.plain)
                  .accessibilityLabel("\(g.name): \(t.name)").accessibilityAddTraits(q.theme == t.id ? .isSelected : [])
                }
              }
            }
          }
          Toggle(isOn: $q.themeAuto) { VStack(alignment: .leading) { Text("الوضع الليلي يتبع النظام"); Text("سمة داكنة مع الوضع الليلي للجهاز، وإلا آخر سمة فاتحة اخترتها").font(.arabic(12)).foregroundStyle(.secondary) } }
        }
        Section("الإضاءة") {
          VStack(alignment: .leading) { Text(q.dim > 0 ? "تعتيم الصفحة (\(Fmt.number(Int(q.dim * 100), numerals: numerals))٪)" : "تعتيم الصفحة"); Slider(value: $q.dim, in: 0...0.4, step: 0.05) { Text("تعتيم الصفحة") } }
          Toggle("إبقاء الشاشة مضاءة", isOn: $q.keepAwake)
        }
        Section("طريقة العرض") {
          Picker("طريقة العرض", selection: $q.view) { Text("صفحات المصحف").tag("pages"); Text("نص متدفق").tag("text") }.pickerStyle(.segmented)
          Text(q.isTextMode ? "نص متدفق بحجم خط وتباعد أسطر قابلين للتغيير" : "صفحات مصحف المدينة كما في المطبوع سطرًا بسطر؛ لتكبير الخطّ اختر «نص متدفق»").font(.arabic(12)).foregroundStyle(.secondary)
          Toggle(isOn: Binding(get: { q.tajweed }, set: { on in q.tajweed = on; if on { q.view = "text" } })) {
            HStack { VStack(alignment: .leading) { Text("التجويد الملوّن"); Text(q.isTextMode ? "تلوين أحكام المدّ والغنّة والقلقلة والإخفاء…" : "يفعّل وضع النص المتدفق (خطوط الصفحات لا تسمح بالتلوين)").font(.arabic(12)).foregroundStyle(.secondary) }; Spacer(); Button { onLegend() } label: { Image(systemName: "info.circle") }.buttonStyle(.borderless).accessibilityLabel("مفتاح ألوان التجويد") }
          }
          Picker("اتجاه التصفح", selection: $q.scroll) { Text("أفقي (تقليب)").tag("horizontal"); Text("رأسي (متصل)").tag("vertical") }
        }
        if q.isTextMode {
          Section("النص المتدفق") {
            Picker("خط النص", selection: $q.textFont) { Text("أميري قرآن").tag("amiri"); Text("حفص (مجمع الملك فهد)").tag("hafs") }
            Toggle(isOn: $q.fitText) { VStack(alignment: .leading) { Text("ملاءمة الصفحة للشاشة"); Text("تصغير الخط تلقائيًا كي تظهر الصفحة كاملة دون تمرير").font(.arabic(12)).foregroundStyle(.secondary) } }
            Stepper("حجم الخط: \(Fmt.decimal(q.fontScale, digits: 1, numerals: numerals))×", value: $q.fontScale, in: 0.7...1.8, step: 0.1)
            Stepper("تباعد الأسطر: \(Fmt.decimal(q.lineHeight, digits: 2, numerals: numerals))", value: $q.lineHeight, in: 1.6...2.8, step: 0.15)
          }
        }
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("العرض والألوان").navigationBarTitleDisplayMode(.inline)
    }
  }
  /// معاينة حيّة: آية من المتن (الفاتحة ٢) على ورق السمة، بحجم الخطّ وتعتيم الإضاءة الحاليين
  private func preview(_ t: MushafTheme, _ q: QuranPrefs) -> some View {
    let a = QuranText.shared.ayah(surah: 1, ayah: 2)
    let shape = RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous)
    return ZStack {
      shape.fill(MushafPalette.background(for: t))
      VStack(spacing: 6) {
        Text((a?.text ?? "") + " ﴿٢﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20 * (q.isTextMode ? q.fontScale : 1))).foregroundStyle(Color(hex: t.ink)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.6)
        Text("سورة الفاتحة · \(t.name)").font(DS.F.labelXs).foregroundStyle(Color(hex: t.ink).opacity(0.6))
      }
      .padding(16)
      Color.black.opacity(min(0.4, q.dim)).clipShape(shape).allowsHitTesting(false)
    }
    .frame(height: 112)
    .overlay { shape.stroke(DS.C.borderSubtle, lineWidth: 1) }
    .accessibilityElement(children: .ignore).accessibilityLabel("معاينة السمة \(t.name)")
  }
}

struct TajweedLegendSheet: View {
  let dark: Bool
  var body: some View {
    let t = Catalog.shared.tajweed
    NavigationStack {
      List {
        ForEach(t.legend, id: \.code) { l in HStack(spacing: 10) { RoundedRectangle(cornerRadius: 4).fill(Color(hex: (dark ? t.dark[l.key] : t.light[l.key]) ?? "#888888")).frame(width: 16, height: 16); Text(l.name).font(.arabic(15)) } }
        Text("الأحكام من طبعة «القرآن المجوّد» (alquran.cloud) مُسقطةً على رسم مصحف المدينة؛ تظهر في وضع النص المتدفق لأن خطوط الصفحات المطبوعة لا تسمح بتلوين جزء من الكلمة.").font(.arabic(12)).foregroundStyle(.secondary)
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("ألوان التجويد").navigationBarTitleDisplayMode(.inline)
    }
  }
}

/// خيارات المصحف: الانتقال، تشغيل الصفحة، المتابعة، الكلمة الحالية في المراجعة، تظليل الكلمة، التنزيلات، الختمة
struct ReaderOptionsSheet: View {
  @Environment(AppModel.self) private var model
  let currentPage: Int
  var onGo: (Int, Int?) -> Void
  var onPlayPage: () -> Void
  var onOpen: (ReaderSheet) -> Void
  @State private var surah: Int = 1
  @State private var ayahText = "1"
  @State private var pageText = ""
  var body: some View {
    @Bindable var q = model.quran
    let numerals = model.settings.numerals
    NavigationStack {
      Form {
        Section("الانتقال إلى سورة وآية") {
          Picker("السورة", selection: $surah) { ForEach(QuranMeta.surahs) { s in Text("\(Fmt.number(s.n, numerals: numerals)). \(s.name)").tag(s.n) } }
          HStack { TextField("آية", text: $ayahText).keyboardType(.numberPad); Button("انتقال") { let n = Int(QuranNormalize.foldDigits(ayahText)) ?? 1; if let a = QuranText.shared.ayah(surah: surah, ayah: max(1, min(QuranMeta.surah(surah).ayahs, n))) { onGo(a.page, a.n) } } }
        }
        Section("الانتقال إلى صفحة") {
          HStack { TextField("1 – 604", text: $pageText).keyboardType(.numberPad); Button("انتقال") { if let p = Int(QuranNormalize.foldDigits(pageText)), (1...604).contains(p) { onGo(p, nil) } } }
        }
        Section {
          Button { onPlayPage() } label: { Label("تشغيل تلاوة الصفحة من أول آية فيها", systemImage: "play.circle") }
          Button { onOpen(.display) } label: { Label("العرض والألوان (السمات، التعتيم، حجم الخط)", systemImage: "sun.max") }
          Toggle(isOn: $q.follow) { VStack(alignment: .leading) { Text("متابعة التلاوة بقلب الصفحات"); Text("الانتقال تلقائيًا إلى صفحة الآية الجارية").font(.arabic(12)).foregroundStyle(.secondary) } }
          Toggle(isOn: $q.hifzOnlyCurrent) { VStack(alignment: .leading) { Text("في المراجعة: إظهار الكلمة الحالية فقط"); Text("الكلمات السابقة تبقى مخفية كما في تطبيقات الحفظ").font(.arabic(12)).foregroundStyle(.secondary) } }
          Toggle(isOn: Binding(get: { q.wordHighlight }, set: { q.wordHighlight = $0; model.player.setWords($0) })) { VStack(alignment: .leading) { Text("تظليل الكلمة أثناء التلاوة"); Text("كلمةً كلمة مع القرّاء الذين تتوفر توقيتاتهم (مصدر quran.com)").font(.arabic(12)).foregroundStyle(.secondary) } }
          Button { onOpen(.downloads) } label: { Label("التلاوات دون اتصال", systemImage: "arrow.down.circle") }
          Button { onOpen(.khatmah) } label: { Label(q.khatmah.map { "خطة الختمة: \(Fmt.number($0.dailyPages, numerals: numerals)) صفحات يوميًا" } ?? "خطة الختمة: هدف يومي وتذكير ومتابعة التقدّم", systemImage: "calendar.badge.clock") }
        }
        Section { Text("الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر، والخطوط كلها مضمّنة في التطبيق فيعمل دون اتصال. النص: Tanzil. التلاوات: Islamic Network وquran.com.").font(.arabic(12)).foregroundStyle(.secondary) }
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("خيارات المصحف").navigationBarTitleDisplayMode(.inline)
      .onAppear { surah = QuranText.shared.pageAyahs(currentPage).first?.surah ?? 1; pageText = String(currentPage) }
    }
  }
}

/// التنقّل والبحث الموحّد: حقل بحث، آخر المواضع، ومقسّم رباعي — السور، الأجزاء في شبكة بأوائلها من المتن، الأحزاب بأرباعها، العلامات
struct QuickNavSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.dynamicTypeSize) private var dts
  let currentPage: Int
  var onGo: (Int, Int?) -> Void
  @State private var tab = 0
  @State private var query = ""
  @FocusState private var focused: Bool
  init(currentPage: Int, onGo: @escaping (Int, Int?) -> Void) { self.currentPage = currentPage; self.onGo = onGo }
  var body: some View {
    let numerals = model.settings.numerals; let q = model.quran
    let cur = QuranText.shared.label(ofPage: currentPage)
    NavigationStack {
      VStack(spacing: 0) {
        searchField
        if !query.isEmpty {
          List { QuranSearchRows(query: query, onGo: onGo) }.listStyle(.insetGrouped).scrollContentBackground(.hidden)
        } else {
          ScrollView(showsIndicators: false) {
            // عمود كسول واحد وصفوفه عناصره مباشرةً (لا عمود كسول داخل آخر)
            LazyVStack(alignment: .leading, spacing: 0) {
              if !q.recent.isEmpty { recentRow(q.recent, numerals).padding(.bottom, 12) }
              DSSegmented(items: ["السور", "الأجزاء", "الأحزاب", "العلامات"], selection: $tab).padding(.bottom, 12)
              let items = navItems
              ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                switch item {
                case .surah(let su):
                  IndexRow(first: i == 0, last: i == items.count - 1, top: i == 0) {
                    Button { onGo(su.page, QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: numerals, current: currentPage >= su.page && currentPage < (su.n < 114 ? QuranMeta.surah(su.n + 1).page : 605)) }.buttonStyle(.plain)
                  }
                case .juzRow(let row, let cols):
                  HStack(spacing: 8) {
                    ForEach(row, id: \.juz) { j in juzCell(j, current: cur?.juz == j.juz, numerals) }
                    ForEach(0..<max(0, cols - row.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity).frame(height: 58) }
                  }
                  .padding(.bottom, 8)
                case .hizb(let h):
                  IndexRow(first: i == 0, last: i == items.count - 1, top: i == 0) { HizbRow(hizb: h, numerals: numerals) { onGo($0, nil) } }
                case .bookmark(let b, let a):
                  IndexRow(first: i == 0, last: i == items.count - 1, top: i == 0) {
                    Button { onGo(a.page, a.n) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: numerals).padding(.horizontal, 4).padding(.vertical, 8) }.buttonStyle(.plain)
                  }
                case .empty:
                  IndexRow(first: true, last: true, top: true) { Text("لا علامات بعد — انقر كلمة ثم «علامة» في رصيف الآية").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).frame(maxWidth: .infinity, alignment: .leading).padding(12) }
                }
              }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
          }
        }
      }
      .background(DS.C.bgCanvas)
      .navigationTitle("التنقّل والبحث").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.font(DS.F.labelMd) } }
    }
  }
  private var searchField: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass").foregroundStyle(DS.C.textTertiary)
      TextField("سورة، آية، نص، أو رقم صفحة…", text: $query).font(DS.F.bodyMd).focused($focused).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain).accessibilityLabel("مسح") }
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .background(DS.C.bgSurface, in: Capsule()).overlay { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) }
    .padding(.horizontal, 16).padding(.vertical, 8)
  }
  /// آخر المواضع: موضع لكل سورة، أربعة على الأكثر
  private func recentRow(_ recent: [LastRead], _ numerals: String) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("آخر المواضع").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(Array(recent.enumerated()), id: \.offset) { _, r in
            Button { onGo(r.page, QuranText.shared.ayah(surah: r.surah, ayah: r.ayah)?.n) } label: {
              VStack(alignment: .leading, spacing: 2) {
                Text(QuranMeta.surah(r.surah).name).font(DS.amiri(16)).foregroundStyle(DS.C.textPrimary)
                Text("آية \(Fmt.number(r.ayah, numerals: numerals)) · ص \(Fmt.number(r.page, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
              }
              .padding(.vertical, 8).padding(.horizontal, 12)
              .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
              .overlay { RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1) }
            }.buttonStyle(.plain)
          }
        }
      }
    }
  }
  /// عناصر الورقة نموذجًا واحدًا: ForEach واحد تتبدّل بياناته مع التبويب
  private enum NavItem: Identifiable {
    case surah(Surah), juzRow([JuzStart], Int), hizb(Int), bookmark(WebSettings.Bookmark, Ayah), empty
    var id: String { switch self { case .surah(let s): return "s\(s.n)"; case .juzRow(let r, _): return "jr\(r.first?.juz ?? 0)"; case .hizb(let h): return "h\(h)"; case .bookmark(_, let a): return "b\(a.n)"; case .empty: return "empty" } }
  }
  private var navItems: [NavItem] {
    switch tab {
    case 0: return QuranMeta.surahs.map { .surah($0) }
    case 1:
      let cols = dts.isAccessibilitySize ? 3 : 5; let all = QuranMeta.juzStarts
      return stride(from: 0, to: all.count, by: cols).map { .juzRow(Array(all[$0..<min($0 + cols, all.count)]), cols) }
    case 2: return (1...60).map { .hizb($0) }
    default:
      let items: [NavItem] = model.quran.bookmarks.reversed().compactMap { b in QuranText.shared.ayah(surah: b.surah, ayah: b.ayah).map { .bookmark(b, $0) } }
      return items.isEmpty ? [.empty] : items
    }
  }
  /// خليّة جزء في الشبكة: رقمه وأوّله من المتن، والجزء الحالي معبّأ
  private func juzCell(_ j: JuzStart, current on: Bool, _ numerals: String) -> some View {
    let phrase = QuranText.shared.juzStartPhrase(j.juz)
    return Button { onGo(j.page, nil) } label: {
      VStack(spacing: 3) {
        Text(Fmt.number(j.juz, numerals: numerals)).font(DS.kufi(15, .semibold)).foregroundStyle(on ? DS.C.textOnBrand : DS.C.textPrimary)
        Text(phrase).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 11)).foregroundStyle(on ? DS.C.textOnBrand.opacity(0.85) : DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.6)
      }
      .frame(maxWidth: .infinity).frame(height: 58)
      .background(on ? DS.C.brandPrimary : DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
      .overlay { RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous).stroke(on ? Color.clear : DS.C.borderSubtle, lineWidth: 1) }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel("الجزء \(j.juz)، \(phrase)، صفحة \(j.page)").accessibilityAddTraits(on ? .isSelected : [])
  }
}
struct NavRow: View {
  let num: String; let title: String; let sub: String; let page: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      Text(num).font(.arabic(14, weight: .bold)).frame(width: 34, height: 34).background((current ? Theme.gold : Theme.primary).opacity(0.14), in: Circle())
      VStack(alignment: .leading, spacing: 2) { Text(title).font(.arabic(16)); Text(sub).font(.arabic(12)).foregroundStyle(.secondary) }
      Spacer()
      Text("ص \(page)").font(.arabic(12)).foregroundStyle(.tertiary)
    }
    .contentShape(Rectangle())
  }
}

/// صفوف نتائج البحث تعيش في MushafHomeView (QuranSearchRows) وتُستعمل هنا وهناك

struct ReciterPickerSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      List(Catalog.shared.reciters) { r in
        Button { model.quran.reciter = r.id; model.player.setReciter(r.id); dismiss() } label: {
          HStack { Image(systemName: model.quran.reciter == r.id ? "checkmark.circle.fill" : "mic").foregroundStyle(Theme.primary).frame(width: 28); VStack(alignment: .leading, spacing: 2) { Text(r.name).font(.arabic(16)); if r.hasWordTiming { Text("كلمة بكلمة").font(.arabic(11)).foregroundStyle(.secondary) } } }
        }.tint(.primary)
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("اختيار القارئ").navigationBarTitleDisplayMode(.inline)
    }
  }
}

/// الختمة والورد: بطاقة الخطة (حلقة الصفحات ونسبتها، ورد اليوم، الموعد، الحال)، إحصاءات، إعداد الخطة
/// (الوحدة صفحة/حزب/جزء، المدة أو «حتى آخر رمضان»، البداية، تذكير بوقت أو بعد صلاة)، والأوراد المسنونة بلا مؤقّت ولا سلسلة
struct KhatmahSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var onGo: ((Int) -> Void)? = nil
  @State private var unit = "page"
  @State private var days = 30
  @State private var fromCurrent = true
  @State private var reminderMode = 0
  @State private var time = Date()
  @State private var afterPrayer: Prayer = .isha
  /// الأيام المتبقية عند فتح الورقة: إن لم تتغيّر بقيت الخطة كما هي، وإلا بدأ العدّ من الموضع الحالي بالمدة الجديدة
  @State private var remainingAtLoad = 0
  private let reminderPrayers: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

  var body: some View {
    let numerals = model.settings.numerals; let q = model.quran; let today = model.todayKey
    let plan = q.khatmah
    let stt = plan.map { Khatmah.status($0, wird: q.wird, today: today) }
    let stats = Khatmah.stats(q.readLog, today: today)
    NavigationStack {
      ScrollView(showsIndicators: false) {
        VStack(spacing: 14) {
          if let plan, let stt { planCard(plan, stt, numerals) }
          statsRow(stats, numerals)
          setupCard(plan, numerals)
          awradCard(q, today, numerals)
        }
        .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
      }
      .background(DS.C.bgCanvas)
      .navigationTitle("الختمة والورد").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.font(DS.F.labelMd) } }
      .onAppear(perform: load)
    }
  }

  // MARK: بطاقة الخطة
  private func planCard(_ plan: KhatmahPlan, _ stt: KhatmahStatus, _ numerals: String) -> some View {
    let pct = Double(stt.percent) / 100
    let target = max(1, stt.todayTarget)
    let nextPage = ((plan.startPage - 1 + stt.done) % Khatmah.total) + 1
    let gold = Color(hex: 0xE2C77A)
    return HStack(alignment: .center, spacing: 16) {
      ZStack {
        Circle().stroke(Color.white.opacity(0.14), lineWidth: 8)
        Circle().trim(from: 0, to: max(0.01, pct)).stroke(DS.C.accentGold, style: StrokeStyle(lineWidth: 8, lineCap: .round)).rotationEffect(.degrees(-90))
        VStack(spacing: 0) {
          Text("\(Fmt.number(stt.percent, numerals: numerals))٪").font(DS.F.numericLg).foregroundStyle(gold)
          Text("من المصحف").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted)
        }
      }
      .frame(width: 100, height: 100)
      .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 6) {
        Text(stt.finished ? "تقبّل الله ✦ أتممت الختمة" : "ورد اليوم \(Fmt.number(min(stt.todayPages, target), numerals: numerals)) من \(Fmt.number(target, numerals: numerals)) صفحة").font(DS.F.headingSm).foregroundStyle(DS.C.textOnDark).lineLimit(2).minimumScaleFactor(0.8)
        Text("اليوم \(Fmt.number(stt.dayIndex + 1, numerals: numerals)) من \(Fmt.number(plan.days, numerals: numerals)) · الإتمام المتوقّع \(Fmt.shortDate(key: stt.etaKey, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(2)
        Text(stt.finished ? "" : (stt.behind > 0 ? "متأخّر \(Fmt.number(stt.behind, numerals: numerals)) صفحة — تُوزَّع على الأيام الباقية (\(Fmt.number(stt.neededPerDay, numerals: numerals)) يوميًا)" : "على الجدول ✓")).font(DS.readex(12, .medium)).foregroundStyle(gold).lineLimit(2).minimumScaleFactor(0.8)
        if !stt.finished, let onGo {
          Button { dismiss(); onGo(nextPage) } label: {
            HStack(spacing: 6) { Text("تابع الورد · ص \(Fmt.number(nextPage, numerals: numerals))").font(DS.readex(13, .semibold)); Image(systemName: "chevron.forward").font(.system(size: 10, weight: .bold)) }
              .foregroundStyle(Color(hex: 0x16211F)).padding(.vertical, 9).padding(.horizontal, 14).background(DS.C.accentGold, in: Capsule())
          }.buttonStyle(.plain).padding(.top, 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(18)
    .nightCard()
    .accessibilityElement(children: .combine)
    .accessibilityLabel("الختمة \(stt.percent) بالمئة. ورد اليوم \(min(stt.todayPages, target)) من \(target) صفحة. \(stt.behind > 0 ? "متأخّر \(stt.behind) صفحة" : "على الجدول")")
  }

  // MARK: إحصاءات صادقة من سجلّ القراءة
  private func statsRow(_ st: ReadStats, _ numerals: String) -> some View {
    HStack(spacing: 10) {
      stat("هذا الأسبوع", Fmt.number(st.week, numerals: numerals), "صفحة")
      stat("هذا الشهر", Fmt.number(st.month, numerals: numerals), "صفحة")
      stat("متوسط اليوم", Fmt.decimal(st.avgDay, digits: 1, numerals: numerals), "صفحة")
    }
  }
  private func stat(_ title: String, _ value: String, _ unit: String) -> some View {
    VStack(spacing: 2) {
      Text(value).font(DS.F.numericMd).foregroundStyle(DS.C.textPrimary)
      Text(unit).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      Text(title).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
    }
    .frame(maxWidth: .infinity).padding(.vertical, 12)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    .accessibilityElement(children: .combine).accessibilityLabel("\(title): \(value) \(unit)")
  }

  // MARK: إعداد الخطة
  private var ramadanDays: Int { Hijri.daysUntilEndOfRamadan(from: Date(), tz: model.timeZone, offsetDays: model.settings.hijriOffset) }
  private func setupCard(_ plan: KhatmahPlan?, _ numerals: String) -> some View {
    let perDay = Int((Double(Khatmah.total) / Double(max(1, days))).rounded(.up))
    return VStack(alignment: .leading, spacing: 12) {
      Text(plan == nil ? "خطة ختمة جديدة" : "تعديل الخطة").font(DS.kufi(16, .semibold)).foregroundStyle(DS.C.textPrimary)
      if let plan, days != remainingAtLoad {
        Text("تغيير المدة يبدأ العدّ من موضعك الحالي (ص \(Fmt.number(((plan.startPage - 1 + Wird.done(model.quran.wird)) % Khatmah.total) + 1, numerals: numerals))) بالمدة الجديدة").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      VStack(alignment: .leading, spacing: 6) {
        Text("وحدة الورد").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        DSSegmented(items: ["صفحات", "حزب يوميًا", "جزء يوميًا"], selection: Binding(get: { unit == "hizb" ? 1 : unit == "juz" ? 2 : 0 }, set: { i in unit = i == 1 ? "hizb" : i == 2 ? "juz" : "page"; days = Khatmah.days(forUnit: unit, fallback: days) }))
      }
      if unit == "page" {
        VStack(alignment: .leading, spacing: 8) {
          Text(plan == nil ? "المدة" : "المدة المتبقية").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
              ForEach([30, 60, 90, 120], id: \.self) { d in chip("\(Fmt.number(d, numerals: numerals)) يومًا", on: days == d) { days = d } }
              if ramadanDays > 0 { chip("حتى آخر رمضان (\(Fmt.number(ramadanDays, numerals: numerals)) يومًا)", on: days == ramadanDays) { days = ramadanDays } }
            }
          }
          Stepper(value: $days, in: 1...604) { Text("\(Fmt.number(days, numerals: numerals)) يومًا ≈ \(Fmt.number(perDay, numerals: numerals)) صفحات يوميًا").font(DS.F.bodySm).foregroundStyle(DS.C.textPrimary) }
        }
      } else {
        Text("\(unit == "hizb" ? "حزب كل يوم (التحزيب التقليدي)" : "جزء كل يوم"): \(Fmt.number(Khatmah.days(forUnit: unit), numerals: numerals)) يومًا ≈ \(Fmt.number(Int((Double(Khatmah.total) / Double(Khatmah.days(forUnit: unit))).rounded(.up)), numerals: numerals)) صفحة يوميًا").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
      }
      if plan == nil {
        VStack(alignment: .leading, spacing: 6) {
          Text("البداية").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
          DSSegmented(items: ["من موضع قراءتي", "من الفاتحة"], selection: Binding(get: { fromCurrent ? 0 : 1 }, set: { fromCurrent = $0 == 0 }))
        }
      }
      VStack(alignment: .leading, spacing: 6) {
        Text("التذكير").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        DSSegmented(items: ["بلا", "في وقت", "بعد صلاة"], selection: $reminderMode)
        if reminderMode == 1 { DatePicker("الوقت", selection: $time, displayedComponents: .hourAndMinute).font(DS.F.bodySm) }
        if reminderMode == 2 {
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) { ForEach(reminderPrayers, id: \.self) { pr in chip(pr.nameAr, on: afterPrayer == pr) { afterPrayer = pr } } }
          }
          Text("يصلك بعد أذان \(afterPrayer.nameAr) بعشرين دقيقة حسب مواقيت موقعك").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        }
      }
      HStack(spacing: 10) {
        DSButton(title: plan == nil ? "ابدأ الخطة" : "حفظ التعديلات", kind: .primary, action: save)
        if plan != nil { DSButton(title: "إنهاء", kind: .outline, fill: false) { model.quran.khatmah = nil; model.quran.wird = [:]; model.rescheduleNotifications(); dismiss() } }
      }
    }
    .dsCard(padding: 16)
  }
  private func chip(_ label: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(label).font(DS.F.labelSm).foregroundStyle(on ? DS.C.textOnBrand : DS.C.textPrimary)
        .padding(.vertical, 8).padding(.horizontal, 12).background(on ? DS.C.brandPrimary : DS.C.bgSubtle, in: Capsule())
    }.buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
  }

  // MARK: الأوراد المسنونة
  private func awradCard(_ q: QuranPrefs, _ today: String, _ numerals: String) -> some View {
    let weekday = CivilDate.weekdayIndex(of: Date(), in: model.timeZone)
    let maghribPassed = model.timeline(now: Date()).flatMap { t in t.times[.maghrib].map { Date() >= $0 } } ?? false
    return VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text("أوراد مسنونة").font(DS.kufi(16, .semibold)).foregroundStyle(DS.C.textPrimary)
        Text("بلا مؤقّت ولا سلسلة — تُحتسب صفحات الورد التي تقرؤها في نافذتها").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      ForEach(Awrad.all) { w in
        let days = Awrad.days(for: w, today: today, weekdayIndex: weekday, maghribPassed: maghribPassed)
        let pr = Awrad.progress(w, log: q.readLog, days: days)
        let window: String = w.window == .fridayEve ? (days.isEmpty ? "تُفتح النافذة مغرب الخميس" : "النافذة مفتوحة الآن") : w.desc
        HStack(spacing: 12) {
          DSIcon(systemName: w.id == "kahf" ? "sun.max" : w.id == "mulk" ? "moon.stars" : "book", style: pr.done >= pr.total ? .gold : .soft, size: 40, iconSize: 16)
          VStack(alignment: .leading, spacing: 4) {
            Text(w.name).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
            Text("\(window) · ص \(Fmt.number(w.from, numerals: numerals))–\(Fmt.number(w.to, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
            ProgressTrack(progress: pr.total > 0 ? Double(pr.done) / Double(pr.total) : 0, tint: DS.C.accentGold, track: DS.C.bgSubtle, height: 4)
          }
          Spacer(minLength: 4)
          VStack(spacing: 4) {
            Text("\(Fmt.number(pr.done, numerals: numerals))/\(Fmt.number(pr.total, numerals: numerals))").font(DS.F.numericSm).foregroundStyle(DS.C.textSecondary)
            if let onGo { Button { dismiss(); onGo(w.from) } label: { Text("اقرأ").font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary).padding(.vertical, 6).padding(.horizontal, 12).background(DS.C.brandSoft, in: Capsule()) }.buttonStyle(.plain).accessibilityLabel("اقرأ \(w.name)") }
          }
        }
        .accessibilityElement(children: .combine)
      }
    }
    .dsCard(padding: 16)
  }

  // MARK: تحميل وحفظ
  private func load() {
    guard let p = model.quran.khatmah else { unit = model.quran.khatmahUnit; days = Khatmah.days(forUnit: unit, fallback: 30); return }
    unit = model.quran.khatmahUnit
    days = max(1, p.days - max(0, DayKey.daysBetween(p.startedAt, model.todayKey))); remainingAtLoad = days
    if let pr = Reminders.afterPrayer(p.reminder) { reminderMode = 2; afterPrayer = pr }
    else if let r = p.reminder, let hm = parse(r) { reminderMode = 1; time = Calendar.current.date(bySettingHour: hm.0, minute: hm.1, second: 0, of: Date()) ?? Date() }
    else { reminderMode = 0 }
  }
  private func parse(_ s: String) -> (Int, Int)? { let p = s.split(separator: ":").compactMap { Int($0) }; return p.count == 2 ? (p[0], p[1]) : nil }
  private func save() {
    let c = Calendar.current.dateComponents([.hour, .minute], from: time)
    let reminder: String? = reminderMode == 1 ? String(format: "%02d:%02d", c.hour ?? 9, c.minute ?? 0) : (reminderMode == 2 ? "after:\(afterPrayer.rawValue)" : nil)
    let q = model.quran
    q.khatmahUnit = unit
    if let p = q.khatmah, days == remainingAtLoad {
      // التذكير وحده تغيّر: تبقى البداية وتاريخ البدء والتقدّم
      q.khatmah = KhatmahPlan(startPage: p.startPage, startedAt: p.startedAt, days: p.days, reminder: reminder)
    } else if let p = q.khatmah {
      // مدة جديدة: خطة تبدأ اليوم من الموضع الحالي (ما قُرئ يبقى مقروءًا، والعدّ يبدأ منه)
      let done = Wird.done(q.wird); q.wird = [:]
      q.khatmah = KhatmahPlan(startPage: ((p.startPage - 1 + done) % Khatmah.total) + 1, startedAt: model.todayKey, days: days, reminder: reminder)
    } else {
      let start = fromCurrent ? (model.settings.lastRead?.page ?? 1) : 1
      q.wird = [:]
      q.khatmah = KhatmahPlan(startPage: start, startedAt: model.todayKey, days: days, reminder: reminder)
    }
    model.rescheduleNotifications(); dismiss()
  }
}
