import SwiftUI
import SakinahCore

/// «للمراجعة» (المرحلة الخامسة): الآيات التي وُسمت «ضعيفة» (quran.weakAyahs) بترتيب المصحف — تُفتح في القارئ عند موضعها،
/// وتُسمَّع من قائمة السياق، وتُزال بالسحب حين تُتقَن. الوسم من خيارات الآية في المصحف أو من لوحة التسميع
struct ReviewAyahsView: View {
  @Environment(AppModel.self) private var model
  @State private var target: MushafHomeView.ReaderTarget?

  var body: some View {
    let ayahs = model.quran.weakAyahs.sorted().compactMap { QuranText.shared.ayah($0) }
    Group {
      if ayahs.isEmpty { emptyState } else { list(ayahs) }
    }
    .background(DS.C.bgCanvas)
    .navigationTitle("للمراجعة").navigationBarTitleDisplayMode(.inline)
    .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page, ayah: t.ayah, autoplay: t.autoplay, hifz: t.hifz).environment(model) }
  }

  private var numerals: String { model.settings.numerals }

  private func list(_ ayahs: [Ayah]) -> some View {
    let count = ArabicCount.phrase(ayahs.count, one: "آية واحدة", two: "آيتان", few: "آيات", many: "آية", numerals: numerals)
    return List {
      Section {
        VStack(alignment: .leading, spacing: 10) {
          Text("\(count) للمراجعة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
          Text("انقر الآية لتقرأها في موضعها، أو اضغطها مطوّلًا لتسمّعها. وحين تُتقنها اسحبها لتزيلها من هنا.").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
          if let first = ayahs.first {
            DSButton(title: "سمِّع من أوّلها", kind: .soft, icon: "mic", fill: false) { target = MushafHomeView.ReaderTarget(page: first.page, ayah: first.n, hifz: true) }
          }
        }
        .padding(.vertical, 6)
        .listRowBackground(DS.C.bgSurface)
      }
      Section {
        ForEach(ayahs) { a in
          Button { target = MushafHomeView.ReaderTarget(page: a.page, ayah: a.n) } label: { row(a) }
            .buttonStyle(.plain)
            .listRowBackground(DS.C.bgSurface)
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
              Button(role: .destructive) { remove(a) } label: { Label("أتقنتُها", systemImage: "checkmark.circle") }
            }
            .contextMenu {
              Button { target = MushafHomeView.ReaderTarget(page: a.page, ayah: a.n) } label: { Label("اقرأها في موضعها", systemImage: "book") }
              Button { target = MushafHomeView.ReaderTarget(page: a.page, ayah: a.n, hifz: true) } label: { Label("سمِّعها", systemImage: "mic") }
              Button(role: .destructive) { remove(a) } label: { Label("أتقنتُها، أزِلها من المراجعة", systemImage: "checkmark.circle") }
            }
        }
      } footer: {
        Text("الوسم على جهازك وحده، ويُضاف من خيارات الآية في المصحف أو بزرّ «ضعيفة» في مراجعة الحفظ.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
  }

  private func row(_ a: Ayah) -> some View {
    let text = a.text.count > 120 ? String(a.text.prefix(120)) + "…" : a.text
    return HStack(alignment: .top, spacing: 12) {
      StarNumber(text: Fmt.number(a.ayah, numerals: numerals))
      VStack(alignment: .leading, spacing: 4) {
        Text("سورة \(QuranMeta.surah(a.surah).name)، الآية \(Fmt.number(a.ayah, numerals: numerals))").font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary)
        Text(text).font(MushafFonts.font(MushafFonts.amiriQuranFont, size: 16)).foregroundStyle(DS.C.textSecondary).lineLimit(2).multilineTextAlignment(.leading)
      }
      Spacer(minLength: 6)
      PagePill(text: "صفحة \(Fmt.number(a.page, numerals: numerals))")
    }
    .padding(.vertical, 6)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityLabel("سورة \(QuranMeta.surah(a.surah).name)، الآية \(a.ayah)، صفحة \(a.page)")
    .accessibilityHint("يفتح الآية في المصحف")
  }

  private func remove(_ a: Ayah) {
    withAnimation(.snappy(duration: 0.2)) { model.quran.weakAyahs.removeAll { $0 == a.n } }
  }

  private var emptyState: some View {
    ScrollView {
      VStack(spacing: 14) {
        DSIcon(systemName: "bookmark", style: .soft, size: 64, iconSize: 26)
        Text("لا آيات للمراجعة").font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary)
        Text("علِّم الآية ضعيفة من خيارات الآية في المصحف (اضغط الآية مطوّلًا)، أو بزرّ «ضعيفة» في مراجعة الحفظ، فتظهر هنا لتعود إليها.")
          .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        DSButton(title: "افتح مراجعة الحفظ", kind: .soft, icon: "mic", fill: false) {
          target = MushafHomeView.ReaderTarget(page: model.settings.lastRead?.page ?? 1, hifz: true)
        }
      }
      .frame(maxWidth: .infinity)
      .dsCard(padding: 24)
      .padding(20)
      .readableWidth(560)
    }
  }
}
