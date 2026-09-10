import SwiftUI
import SakinahCore

/// شاشة المصحف: متابعة القراءة من آخر صفحة، والأجزاء، وقائمة السور
struct MushafHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var target: ReaderTarget?
  @State private var query = ""

  struct ReaderTarget: Identifiable { let page: Int; var id: Int { page } }

  var body: some View {
    NavigationStack {
      let s = model.settings
      List {
        Section { continueCard.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
        if query.isEmpty {
          Section("الأجزاء") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 8) {
              ForEach(QuranMeta.juzStarts, id: \.juz) { j in
                Button { target = ReaderTarget(page: j.page) } label: {
                  Text(Fmt.number(j.juz, numerals: s.numerals)).font(.arabic(15, weight: .bold)).frame(maxWidth: .infinity).frame(height: 40)
                    .background(Theme.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(QuranMeta.juzName(j.juz, vocalized: false))
              }
            }
            .padding(.vertical, 4)
          }
        }
        Section(query.isEmpty ? "السور" : "النتائج") {
          ForEach(filtered) { su in
            Button { target = ReaderTarget(page: su.page) } label: { SurahRow(surah: su, numerals: s.numerals) }.tint(.primary)
          }
        }
      }
      .searchable(text: $query, prompt: "ابحث عن سورة")
      .navigationTitle("المصحف")
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button { target = ReaderTarget(page: s.lastRead?.page ?? 1) } label: { Image(systemName: "book") }.accessibilityLabel("فتح المصحف")
        }
      }
      .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page).environment(model) }
    }
  }

  private var filtered: [Surah] {
    let q = CityDatabase.normalize(query)
    if q.isEmpty { return QuranMeta.surahs }
    if let n = Int(q), (1...114).contains(n) { return [QuranMeta.surah(n)] }
    return QuranMeta.surahs.filter { CityDatabase.normalize($0.plain).contains(q) || CityDatabase.normalize($0.name).contains(q) || $0.en.lowercased().contains(q) }
  }

  private var continueCard: some View {
    let s = model.settings
    let last = s.lastRead
    return Button { target = ReaderTarget(page: last?.page ?? 1) } label: {
      HStack(spacing: 14) {
        Image(systemName: last == nil ? "book.closed.fill" : "bookmark.fill").font(.system(size: 30)).foregroundStyle(.white).frame(width: 56, height: 56).background(Theme.primary, in: RoundedRectangle(cornerRadius: 14))
        VStack(alignment: .leading, spacing: 3) {
          Text(last == nil ? "ابدأ القراءة" : "متابعة القراءة").font(.arabic(18, weight: .bold))
          if let last {
            Text("سورة \(QuranMeta.surah(last.surah).name) · صفحة \(Fmt.number(last.page, numerals: s.numerals))").font(.arabic(14)).foregroundStyle(.secondary)
            Text(relative(last.at)).font(.arabic(12)).foregroundStyle(.tertiary)
          } else {
            Text("من الفاتحة، بصفحات مصحف المدينة").font(.arabic(14)).foregroundStyle(.secondary)
          }
        }
        Spacer()
        Image(systemName: "chevron.backward").foregroundStyle(.tertiary)
      }
      .padding(16)
      .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 18))
    }
    .buttonStyle(.plain)
    .padding(.horizontal, 16).padding(.vertical, 4)
  }

  private func relative(_ ms: Double) -> String {
    let f = RelativeDateTimeFormatter(); f.locale = Locale(identifier: "ar"); f.unitsStyle = .full
    return f.localizedString(for: Date(timeIntervalSince1970: ms / 1000), relativeTo: Date())
  }
}
