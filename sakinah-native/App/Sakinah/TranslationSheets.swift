import SwiftUI
import SakinahCore

/// ترجمة الآية (quran.com) مع اختيار الترجمة من القائمة الكاملة والتنقل بين الآيات
struct TranslationSheet: View {
  @Environment(AppModel.self) private var model
  @State var ayah: Ayah
  @State private var text: String?
  @State private var error: String?
  @State private var list: [QuranAPI.TranslationInfo] = []
  var body: some View {
    let id = model.quran.translation
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          Text(ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).lineSpacing(9).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            .padding(14).background(Theme.paper, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(Color(hex: "#1d1a14"))
          NavigationLink { TranslationPicker(list: list) } label: {
            HStack { Image(systemName: "globe"); Text(list.first { $0.id == id }.map { "\($0.name) · \($0.languageName)" } ?? "اختيار الترجمة"); Spacer(); Image(systemName: "chevron.backward").foregroundStyle(.tertiary) }.font(.arabic(14))
          }
          if let text { Text(text).font(.system(size: 17)).lineSpacing(6).frame(maxWidth: .infinity, alignment: .leading).environment(\.layoutDirection, .leftToRight) }
          else if let error { Text(error).foregroundStyle(.red).font(.arabic(13)) }
          else { ProgressView().frame(maxWidth: .infinity) }
          Text("المصدر: quran.com — تُجلب الترجمة عند الطلب وتُحفظ على الجهاز").font(.arabic(11)).foregroundStyle(.tertiary)
        }
        .padding()
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("ترجمة \(QuranSearch.refLabel(ayah))").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItemGroup(placement: .bottomBar) {
          Button { move(-1) } label: { Label("السابقة", systemImage: "chevron.forward") }.disabled(ayah.ayah <= 1)
          Spacer()
          Button { move(1) } label: { Label("التالية", systemImage: "chevron.backward") }.disabled(ayah.ayah >= QuranMeta.surah(ayah.surah).ayahs)
        }
      }
      .task(id: "\(id)-\(ayah.n)") { await load(id: id) }
      .task { list = (try? await QuranAPI.translationsList()) ?? [] }
    }
  }
  private func move(_ d: Int) { if let a = QuranText.shared.ayah(surah: ayah.surah, ayah: ayah.ayah + d) { ayah = a } }
  private func load(id: Int) async {
    text = nil; error = nil
    do { text = try await QuranAPI.translation(id: id, surah: ayah.surah, ayah: ayah.ayah) } catch { self.error = "تعذّر جلب الترجمة — تحقق من الاتصال بالإنترنت" }
  }
}

struct TranslationPicker: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let list: [QuranAPI.TranslationInfo]
  @State private var query = ""
  var body: some View {
    let q = query.lowercased()
    let filtered = q.isEmpty ? list : list.filter { $0.name.lowercased().contains(q) || $0.languageName.lowercased().contains(q) || $0.authorName.lowercased().contains(q) }
    let groups = Dictionary(grouping: filtered, by: \.languageName).sorted { $0.key < $1.key }
    List {
      if list.isEmpty { Text("جارٍ تحميل القائمة… يلزم اتصال بالإنترنت").foregroundStyle(.secondary) }
      ForEach(groups, id: \.key) { g in
        Section(g.key) {
          ForEach(g.value) { t in
            Button { model.quran.translation = t.id; dismiss() } label: {
              HStack { VStack(alignment: .leading) { Text(t.name).font(.system(size: 15)); if !t.authorName.isEmpty { Text(t.authorName).font(.system(size: 12)).foregroundStyle(.secondary) } }; Spacer(); if model.quran.translation == t.id { Image(systemName: "checkmark").foregroundStyle(Theme.primary) } }
            }.tint(.primary)
          }
        }
      }
    }
    .searchable(text: $query, prompt: "لغة أو اسم الترجمة")
    .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
    .navigationTitle("الترجمات").navigationBarTitleDisplayMode(.inline)
  }
}

/// معاني الكلمات كلمةً كلمة بلغة مختارة (quran.com)
struct WordMeaningsSheet: View {
  @Environment(AppModel.self) private var model
  @State var ayah: Ayah
  @State private var words: [QuranAPI.Word]?
  @State private var error: String?
  var body: some View {
    @Bindable var q = model.quran
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          Picker("اللغة", selection: $q.wbwLanguage) { ForEach(QuranAPI.wbwLanguages, id: \.code) { l in Text(l.name).tag(l.code) } }.pickerStyle(.menu)
          if let words {
            FlowLayout(spacing: 8, lineHeight: 74, justify: false) {
              ForEach(words) { w in
                VStack(spacing: 4) {
                  Text(w.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: w.isEnd ? 16 : 22)).foregroundStyle(w.isEnd ? Theme.gold : .primary)
                  Text(w.meaning).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.center).frame(maxWidth: 110)
                }
                .padding(.horizontal, 8).padding(.vertical, 6).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 10))
              }
            }
            .environment(\.layoutDirection, .leftToRight)
          } else if let error { Text(error).foregroundStyle(.red).font(.arabic(13)) } else { ProgressView().frame(maxWidth: .infinity) }
          Text("المصدر: quran.com — تُجلب المعاني عند الطلب وتُحفظ على الجهاز").font(.arabic(11)).foregroundStyle(.tertiary)
        }
        .padding()
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("معاني الكلمات · \(QuranSearch.refLabel(ayah))").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItemGroup(placement: .bottomBar) {
          Button { move(-1) } label: { Label("السابقة", systemImage: "chevron.forward") }.disabled(ayah.ayah <= 1)
          Spacer()
          Button { move(1) } label: { Label("التالية", systemImage: "chevron.backward") }.disabled(ayah.ayah >= QuranMeta.surah(ayah.surah).ayahs)
        }
      }
      .task(id: "\(q.wbwLanguage)-\(ayah.n)") { await load(lang: q.wbwLanguage) }
    }
  }
  private func move(_ d: Int) { if let a = QuranText.shared.ayah(surah: ayah.surah, ayah: ayah.ayah + d) { ayah = a } }
  private func load(lang: String) async {
    words = nil; error = nil
    do { words = try await QuranAPI.words(surah: ayah.surah, ayah: ayah.ayah, lang: lang) } catch { self.error = "تعذّر جلب معاني الكلمات — تحقق من الاتصال بالإنترنت" }
  }
}
