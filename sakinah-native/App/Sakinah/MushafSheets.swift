import SwiftUI
import UIKit
import SakinahCore

enum AyahAction { case tafsir, listen, playFrom, repeat3, bookmark, lastRead, hifz, share, shareImage, copy }

/// قائمة الآية (نقرة على كلمة): التفسير، الاستماع، التشغيل من هنا، التكرار، العلامة، موضع القراءة، المراجعة، المشاركة، النسخ
struct AyahOptionsSheet: View {
  @Environment(AppModel.self) private var model
  let ayah: Ayah
  var onAction: (AyahAction) -> Void
  var body: some View {
    let marked = model.quran.isBookmarked(ayah)
    let cols = [GridItem(.flexible()), GridItem(.flexible())]
    NavigationStack {
      ScrollView {
        VStack(spacing: 14) {
          Text(ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 21)).lineSpacing(10).multilineTextAlignment(.center).padding(.horizontal)
          LazyVGrid(columns: cols, spacing: 10) {
            actionButton("التفسير", "book", primary: true) { onAction(.tafsir) }
            actionButton("استماع (اختيار القارئ)", "mic", primary: true) { onAction(.listen) }
            actionButton("تشغيل من هنا", "play") { onAction(.playFrom) }
            actionButton("تكرار الآية ×٣", "repeat") { onAction(.repeat3) }
            actionButton(marked ? "تعديل العلامة" : "علامة مع ملاحظة", marked ? "bookmark.fill" : "bookmark") { onAction(.bookmark) }
            actionButton("موضع القراءة", "checkmark.circle") { onAction(.lastRead) }
            actionButton("مراجعة الحفظ من هنا", "eye.slash") { onAction(.hifz) }
            actionButton("مشاركة", "square.and.arrow.up") { onAction(.share) }
            actionButton("مشاركة كصورة", "photo") { onAction(.shareImage) }
            actionButton("نسخ", "doc.on.doc") { onAction(.copy) }
          }
          .padding(.horizontal)
        }
        .padding(.vertical)
      }
      .navigationTitle(QuranSearch.refLabel(ayah)).navigationBarTitleDisplayMode(.inline)
    }
  }
  private func actionButton(_ title: String, _ icon: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Label(title, systemImage: icon).font(.arabic(14, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44)
    }
    .buttonStyle(.bordered).tint(primary ? Theme.primary : .secondary)
  }
}

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
      .navigationTitle("علامة — \(QuranSearch.refLabel(ayah))").navigationBarTitleDisplayMode(.inline)
      .onAppear { note = existing?.note ?? ""; color = existing?.color ?? "gold" }
    }
  }
}

/// العرض والألوان: السمات، التعتيم، إبقاء الشاشة، طريقة العرض، التجويد، اتجاه التصفح، خط النص وحجمه وتباعده
struct DisplaySheet: View {
  @Environment(AppModel.self) private var model
  var onLegend: () -> Void
  var body: some View {
    @Bindable var q = model.quran
    let c = Catalog.shared
    NavigationStack {
      Form {
        Section("لون الصفحة") {
          ForEach(c.themeGroups, id: \.id) { g in
            VStack(alignment: .leading, spacing: 6) {
              Text(g.name).font(.arabic(12)).foregroundStyle(.secondary)
              LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(c.themes.filter { $0.group == g.id }) { t in
                  Button { q.setTheme(t.id) } label: {
                    VStack(spacing: 4) {
                      Text("ق").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).foregroundStyle(Color(hex: t.ink)).frame(width: 44, height: 40).background(Color(hex: t.paper), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(q.theme == t.id ? Theme.primary : Color.secondary.opacity(0.3), lineWidth: q.theme == t.id ? 2 : 1))
                      Text(t.name).font(.arabic(10)).lineLimit(1)
                    }
                  }
                  .buttonStyle(.plain)
                }
              }
            }
          }
          Toggle(isOn: $q.themeAuto) { VStack(alignment: .leading) { Text("الوضع الليلي يتبع النظام"); Text("سمة داكنة مع الوضع الليلي للجهاز، وإلا آخر سمة فاتحة اخترتها").font(.arabic(12)).foregroundStyle(.secondary) } }
        }
        Section("الإضاءة") {
          VStack(alignment: .leading) { Text(q.dim > 0 ? "تعتيم الصفحة (\(Fmt.number(Int(q.dim * 100), numerals: model.settings.numerals))٪)" : "تعتيم الصفحة"); Slider(value: $q.dim, in: 0...0.6, step: 0.05) }
          Toggle("إبقاء الشاشة مضاءة", isOn: $q.keepAwake)
        }
        Section("طريقة العرض") {
          Picker("طريقة العرض", selection: $q.view) { Text("صفحات المصحف").tag("pages"); Text("نص متدفق").tag("text") }.pickerStyle(.segmented)
          Text(q.isTextMode ? "نص متدفق بحجم خط وتباعد أسطر قابلين للتغيير" : "صفحات مصحف المدينة كما في المطبوع سطرًا بسطر").font(.arabic(12)).foregroundStyle(.secondary)
          Toggle(isOn: Binding(get: { q.tajweed }, set: { on in q.tajweed = on; if on { q.view = "text" } })) {
            HStack { VStack(alignment: .leading) { Text("التجويد الملوّن"); Text(q.isTextMode ? "تلوين أحكام المدّ والغنّة والقلقلة والإخفاء…" : "يفعّل وضع النص المتدفق (خطوط الصفحات لا تسمح بالتلوين)").font(.arabic(12)).foregroundStyle(.secondary) }; Spacer(); Button { onLegend() } label: { Image(systemName: "info.circle") }.buttonStyle(.borderless) }
          }
          Picker("اتجاه التصفح", selection: $q.scroll) { Text("أفقي (تقليب)").tag("horizontal"); Text("رأسي (متصل)").tag("vertical") }
        }
        if q.isTextMode {
          Section("النص المتدفق") {
            Picker("خط النص", selection: $q.textFont) { Text("أميري قرآن").tag("amiri"); Text("حفص (مجمع الملك فهد)").tag("hafs") }
            Toggle(isOn: $q.fitText) { VStack(alignment: .leading) { Text("ملاءمة الصفحة للشاشة"); Text("تصغير الخط تلقائيًا كي تظهر الصفحة كاملة دون تمرير").font(.arabic(12)).foregroundStyle(.secondary) } }
            Stepper("حجم الخط: \(Fmt.decimal(q.fontScale, digits: 1, numerals: model.settings.numerals))×", value: $q.fontScale, in: 0.7...1.8, step: 0.1)
            Stepper("تباعد الأسطر: \(Fmt.decimal(q.lineHeight, digits: 2, numerals: model.settings.numerals))", value: $q.lineHeight, in: 1.6...2.8, step: 0.15)
          }
        }
      }
      .navigationTitle("العرض والألوان").navigationBarTitleDisplayMode(.inline)
    }
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
      .navigationTitle("خيارات المصحف").navigationBarTitleDisplayMode(.inline)
      .onAppear { surah = QuranText.shared.pageAyahs(currentPage).first?.surah ?? 1; pageText = String(currentPage) }
    }
  }
}

/// التنقل والبحث داخل القارئ: بحث وسور، الأجزاء، الأحزاب، صفحة
struct QuickNavSheet: View {
  @Environment(AppModel.self) private var model
  let currentPage: Int
  var onGo: (Int, Int?) -> Void
  @State private var tab = 0
  @State private var query = ""
  @State private var pageValue: Double
  init(currentPage: Int, onGo: @escaping (Int, Int?) -> Void) { self.currentPage = currentPage; self.onGo = onGo; _pageValue = State(initialValue: Double(currentPage)) }
  var body: some View {
    let numerals = model.settings.numerals
    let cur = QuranText.shared.label(ofPage: currentPage)
    NavigationStack {
      VStack(spacing: 0) {
        Picker("القسم", selection: $tab) { Text("بحث وسور").tag(0); Text("الأجزاء").tag(1); Text("الأحزاب").tag(2); Text("صفحة").tag(3) }.pickerStyle(.segmented).padding(.horizontal).padding(.bottom, 6)
        switch tab {
        case 0: QuranSearchList(query: $query, currentPage: currentPage, onGo: onGo)
        case 1:
          List(QuranMeta.juzStarts, id: \.juz) { j in
            Button { onGo(j.page, nil) } label: { NavRow(num: Fmt.number(j.juz, numerals: numerals), title: "الجزء \(Fmt.number(j.juz, numerals: numerals))", sub: "\(QuranMeta.surah(j.surah).name) · آية \(Fmt.number(j.ayah, numerals: numerals))", page: Fmt.number(j.page, numerals: numerals), current: cur?.juz == j.juz) }.tint(.primary)
          }.listStyle(.plain)
        case 2:
          List(1...60, id: \.self) { hz in
            let p = QuranText.shared.hizbStartPage(hz) ?? 1
            Button { onGo(p, nil) } label: { NavRow(num: Fmt.number(hz, numerals: numerals), title: "الحزب \(Fmt.number(hz, numerals: numerals))", sub: "الجزء \(Fmt.number((hz + 1) / 2, numerals: numerals)) · \(QuranMeta.surah(QuranText.shared.pageAyahs(p).first?.surah ?? 1).name)", page: Fmt.number(p, numerals: numerals), current: cur?.hizb == hz) }.tint(.primary)
          }.listStyle(.plain)
        default:
          Form {
            Section("الصفحة") {
              Slider(value: $pageValue, in: 1...604, step: 1)
              let p = Int(pageValue); let l = QuranText.shared.label(ofPage: p)
              Text("الصفحة \(Fmt.number(p, numerals: numerals)) — \(l.map { "\(QuranMeta.surah($0.surah).name) · الجزء \(Fmt.number($0.juz, numerals: numerals)) · الحزب \(Fmt.number($0.hizb, numerals: numerals))" } ?? "")").font(.arabic(14))
              Button("انتقال") { onGo(p, nil) }.font(.arabic(16, weight: .bold))
            }
          }
        }
      }
      .navigationTitle("التنقل والبحث").navigationBarTitleDisplayMode(.inline)
    }
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

/// بحث موحّد: رقم صفحة، مرجع «الكهف 10»، اسم سورة، أو نص آية
struct QuranSearchList: View {
  @Environment(AppModel.self) private var model
  @Binding var query: String
  var currentPage: Int = 0
  var onGo: (Int, Int?) -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let s = QuranNormalize.foldDigits(query.trimmingCharacters(in: .whitespaces))
    List {
      if let p = Int(s), (1...604).contains(p) {
        Button { onGo(p, nil) } label: { NavRow(num: Fmt.number(p, numerals: numerals), title: "الصفحة \(Fmt.number(p, numerals: numerals))", sub: QuranText.shared.label(ofPage: p).map { "\(QuranMeta.surah($0.surah).name) · الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "", page: Fmt.number(p, numerals: numerals)) }.tint(.primary)
      } else if let ref = QuranSearch.parseRef(s), let a = QuranText.shared.ayah(surah: ref.surah.n, ayah: min(ref.surah.ayahs, ref.ayah)) {
        Button { onGo(a.page, a.n) } label: { NavRow(num: Fmt.number(a.surah, numerals: numerals), title: "سورة \(ref.surah.name) — الآية \(Fmt.number(a.ayah, numerals: numerals))", sub: "الصفحة \(Fmt.number(a.page, numerals: numerals))", page: Fmt.number(a.page, numerals: numerals)) }.tint(.primary)
      } else {
        let surahs = s.count >= 1 ? QuranSearch.matchSurahs(s) : QuranMeta.surahs
        let ayahs = s.count >= 2 ? QuranSearch.shared.search(s, limit: 30) : []
        if !surahs.isEmpty { Section(s.isEmpty ? "السور" : "سور") { ForEach(surahs) { su in Button { onGo(su.page, QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: numerals, current: currentPage >= su.page && currentPage < (su.n < 114 ? QuranMeta.surah(su.n + 1).page : 605)) }.tint(.primary) } } }
        if !ayahs.isEmpty {
          Section("آيات (\(Fmt.number(ayahs.count, numerals: numerals))\(ayahs.count == 30 ? "+" : ""))") {
            ForEach(ayahs) { a in
              Button { onGo(a.page, a.n) } label: {
                HStack { VStack(alignment: .leading, spacing: 3) { Text(a.text.count > 90 ? String(a.text.prefix(90)) + "…" : a.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 15)).lineLimit(2); Text(QuranSearch.refLabel(a)).font(.arabic(12)).foregroundStyle(.secondary) }; Spacer(); Text("ص \(Fmt.number(a.page, numerals: numerals))").font(.arabic(12)).foregroundStyle(.tertiary) }.contentShape(Rectangle())
              }.tint(.primary)
            }
          }
        }
        if surahs.isEmpty && ayahs.isEmpty { Text("لا نتائج").foregroundStyle(.secondary) }
      }
    }
    .listStyle(.plain)
    .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "سورة، آية، نص، أو رقم صفحة…")
  }
}

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
      .navigationTitle("اختيار القارئ").navigationBarTitleDisplayMode(.inline)
    }
  }
}

/// شريط التلاوة: القارئ والموضع، السابق/تشغيل/التالي/إغلاق، شريط التقدّم، وخيارات التكرار والسرعة ومؤقت النوم
struct AudioBarView: View {
  @Environment(AppModel.self) private var model
  var onPickReciter: () -> Void
  var onGoToPage: ((Int) -> Void)? = nil
  var toast: ((String) -> Void)? = nil
  var body: some View {
    let p = model.player; let q = model.quran; let numerals = model.settings.numerals
    if let a = p.currentAyah {
      VStack(spacing: 6) {
        HStack(spacing: 8) {
          VStack(alignment: .leading, spacing: 2) {
            Text(p.reciterInfo.name).font(.arabic(13, weight: .bold)).lineLimit(1)
            Text("\(QuranSearch.refLabel(a)) · \(Fmt.number(p.index + 1, numerals: numerals))/\(Fmt.number(p.queue.count, numerals: numerals))\(p.loading || p.buffering ? " · جارٍ التحميل…" : "")").font(.arabic(11)).foregroundStyle(.secondary).lineLimit(1)
          }
          Spacer()
          Button { p.prevAyah() } label: { Image(systemName: "backward.end.fill") }
          Button { p.toggle() } label: { Image(systemName: p.isPlaying ? "pause.circle.fill" : "play.circle.fill").font(.system(size: 34)) }
          Button { p.nextAyah() } label: { Image(systemName: "forward.end.fill") }
          Button { p.stop() } label: { Image(systemName: "xmark") }.padding(.leading, 4)
        }
        ProgressView(value: p.duration > 0 ? min(1, p.position / p.duration) : 0).tint(Theme.primary)
        ScrollView(.horizontal) {
          HStack(spacing: 6) {
            chip("القارئ", "mic", active: false) { onPickReciter() }
            chip("الآية ×\(Fmt.number(p.repeatAyah, numerals: numerals))", "repeat", active: p.repeatAyah > 1) { let o = [1, 2, 3, 5, 10]; let nx = o[((o.firstIndex(of: p.repeatAyah) ?? 0) + 1) % o.count]; p.repeatAyah = nx; q.repeatAyah = nx }
            chip("تكرار المقطع", "repeat.1", active: p.repeatRange) { p.repeatRange.toggle(); q.repeatRange = p.repeatRange }
            chip("السرعة \(Fmt.decimal(p.rate, digits: 2, numerals: numerals))×", "speedometer", active: p.rate != 1) { let o = [0.75, 1, 1.25, 1.5]; let nx = o[((o.firstIndex(of: p.rate) ?? 1) + 1) % o.count]; p.setRate(nx); q.rate = nx }
            chip(p.sleepMinutesLeft.map { "\(Fmt.number($0, numerals: numerals)) د" } ?? "مؤقت النوم", "moon", active: p.sleepAt != nil) { let o = [0, 15, 30, 45, 60]; let cur = p.sleepMinutesLeft ?? 0; let nx = o[((o.firstIndex { $0 >= cur } ?? 0) + 1) % o.count]; p.setSleep(minutes: nx); toast?(nx > 0 ? "ستتوقف التلاوة بعد \(Fmt.number(nx, numerals: numerals)) دقيقة" : "أُلغي مؤقت النوم") }
            if let go = onGoToPage { chip("الانتقال إلى ص \(Fmt.number(a.page, numerals: numerals))", "arrow.turn.down.left", active: false) { go(a.page) } }
          }
        }
        .scrollIndicators(.hidden)
      }
      .padding(.horizontal, 14).padding(.vertical, 8)
      .background(.regularMaterial)
    }
  }
  private func chip(_ label: String, _ icon: String, active: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) { Label(label, systemImage: icon).font(.arabic(12)).padding(.horizontal, 10).padding(.vertical, 6).background(active ? Theme.primary.opacity(0.18) : Color.secondary.opacity(0.12), in: Capsule()) }.buttonStyle(.plain)
  }
}

/// لوحة مراجعة الحفظ / إخفاء الآيات
struct HifzPanelView: View {
  @Environment(AppModel.self) private var model
  let session: HifzSession
  var onExit: () -> Void
  var onNextPage: () -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let total = QuranText.shared.pageAyahs(session.page).count
    VStack(spacing: 8) {
      HStack {
        Text(session.veil ? "إخفاء الآيات" : "مراجعة الحفظ").font(.arabic(15, weight: .bold))
        Spacer()
        Text(session.veil ? "\(Fmt.number(min(session.revealedAyahs, total), numerals: numerals)) / \(Fmt.number(total, numerals: numerals)) آية" : "\(Fmt.number(session.pos, numerals: numerals)) / \(Fmt.number(session.words.count, numerals: numerals)) كلمة").font(.arabic(12)).foregroundStyle(.secondary)
        Button { onExit() } label: { Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(.secondary) }.accessibilityLabel("إنهاء")
      }
      if !session.veil {
        Group {
          if session.done { Text("✓ أحسنت").font(.arabic(18, weight: .bold)).foregroundStyle(Theme.primary) }
          else if let w = session.lastRevealed { Text(w.raw).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 22)) }
          else { Text(session.listening ? "استمع… ابدأ التلاوة" : "اضغط «ابدأ التسميع» أو انقر الصفحة لكشف كلمة").font(.arabic(13)).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, minHeight: 30)
        if !session.heard.isEmpty { Text(session.heard).font(.arabic(12)).foregroundStyle(.tertiary).lineLimit(1) }
      }
      ProgressView(value: session.progress).tint(Theme.gold)
      HStack(spacing: 8) {
        if session.veil {
          if session.done { Button("الصفحة التالية") { onNextPage() }.buttonStyle(.borderedProminent) } else { Button { session.revealAyah() } label: { Label("كشف الآية التالية", systemImage: "eye") }.buttonStyle(.borderedProminent) }
          Button("كشف الكل") { session.revealAll() }.buttonStyle(.bordered)
        } else {
          if session.done { Button("الصفحة التالية") { onNextPage() }.buttonStyle(.borderedProminent) }
          else {
            Button { session.toggleSpeech() } label: { Label(session.listening ? "إيقاف" : "ابدأ التسميع", systemImage: session.listening ? "mic.slash" : "mic") }.buttonStyle(.borderedProminent).tint(session.listening ? .red : Theme.primary).disabled(!session.speechSupported)
            Button { session.hint() } label: { Label("تلميح", systemImage: "eye") }.buttonStyle(.bordered)
            Button("كشف الآية") { session.revealAyah() }.buttonStyle(.bordered)
          }
        }
      }
      .font(.arabic(14, weight: .semibold))
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .background(.regularMaterial)
  }
}

/// خطة الختمة: المدة، البداية، تذكير يومي
struct KhatmahSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var days = 30
  @State private var fromCurrent = true
  @State private var remind = false
  @State private var time = Date()
  var body: some View {
    let numerals = model.settings.numerals
    let plan = model.quran.khatmah
    NavigationStack {
      Form {
        Section("المدة") {
          HStack { ForEach([30, 60, 90, 120], id: \.self) { d in Button("\(Fmt.number(d, numerals: numerals)) يومًا") { days = d }.buttonStyle(.bordered).tint(days == d ? Theme.primary : .secondary) } }
          Stepper("\(Fmt.number(days, numerals: numerals)) يومًا ≈ \(Fmt.number(Int((604.0 / Double(days)).rounded(.up)), numerals: numerals)) صفحات يوميًا", value: $days, in: 1...604)
        }
        Section("البداية") { Picker("البداية", selection: $fromCurrent) { Text("من موضع قراءتي").tag(true); Text("من الفاتحة").tag(false) }.pickerStyle(.segmented) }
        Section("تذكير يومي (اختياري)") { Toggle("تذكير يومي من النظام", isOn: $remind); if remind { DatePicker("الوقت", selection: $time, displayedComponents: .hourAndMinute) } }
        Section {
          Button(plan == nil ? "ابدأ الخطة" : "حفظ") { save() }.font(.arabic(16, weight: .bold))
          if plan != nil { Button("إنهاء الخطة", role: .destructive) { model.quran.khatmah = nil; model.rescheduleNotifications(); dismiss() } }
        }
      }
      .navigationTitle(plan == nil ? "خطة الختمة" : "تعديل خطة الختمة").navigationBarTitleDisplayMode(.inline)
      .onAppear { if let p = plan { days = p.days; remind = p.reminder != nil; if let r = p.reminder, let hm = parse(r) { time = Calendar.current.date(bySettingHour: hm.0, minute: hm.1, second: 0, of: Date()) ?? Date() } } }
    }
  }
  private func parse(_ s: String) -> (Int, Int)? { let p = s.split(separator: ":").compactMap { Int($0) }; return p.count == 2 ? (p[0], p[1]) : nil }
  private func save() {
    let start = fromCurrent ? (model.settings.lastRead?.page ?? 1) : 1
    let c = Calendar.current.dateComponents([.hour, .minute], from: time)
    let reminder = remind ? String(format: "%02d:%02d", c.hour ?? 9, c.minute ?? 0) : nil
    model.quran.khatmah = KhatmahPlan(startPage: start, startedAt: model.todayKey, days: days, reminder: reminder)
    model.rescheduleNotifications(); dismiss()
  }
}

/// تحدّيات القراءة
struct ChallengesSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    let numerals = model.settings.numerals
    let startPage = model.settings.lastRead?.page ?? 1
    NavigationStack {
      List {
        Text("اختر تحدّيًا؛ تُحتسب الصفحات التي تقرؤها (ثماني ثوانٍ في الصفحة على الأقل) من لحظة البدء. الزمن التقديري بمتوسط دقيقتين للصفحة.").font(.arabic(12)).foregroundStyle(.secondary)
        ForEach(Challenges.all) { c in
          let r = Challenges.resolveRange(c, startPage: startPage); let pages = r.to - r.from + 1
          Button {
            model.quran.challenge = ActiveChallenge(id: c.id, startedAt: model.todayKey, startPage: startPage, from: r.from, to: r.to); dismiss()
          } label: {
            VStack(alignment: .leading, spacing: 3) {
              Text(c.name).font(.arabic(16, weight: .semibold))
              Text("\(c.desc) · ص \(Fmt.number(r.from, numerals: numerals))–\(Fmt.number(r.to, numerals: numerals)) · \(Fmt.number(pages, numerals: numerals)) صفحة ≈ \(Fmt.number(Challenges.estimateMinutes(pages), numerals: numerals)) دقيقة · \(c.days == 1 ? "يوم واحد" : "\(Fmt.number(c.days, numerals: numerals)) أيام")").font(.arabic(12)).foregroundStyle(.secondary)
            }
          }.tint(.primary)
        }
      }
      .navigationTitle("تحدّيات القراءة").navigationBarTitleDisplayMode(.inline)
    }
  }
}
