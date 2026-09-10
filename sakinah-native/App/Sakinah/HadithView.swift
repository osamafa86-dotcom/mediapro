import SwiftUI
import UIKit
import SakinahCore

/// الأحاديث: مختارات من الصحيحين (حديث اليوم، بحث، تصنيفات، مفضلة) والأربعون النووية
struct HadithView: View {
  @Environment(AppModel.self) private var model
  var initialBook = "sahih"
  @State private var book = "sahih"
  @State private var topic = "all"
  @State private var query = ""
  @State private var showAll = false
  @State private var shareCard: ShareCardRequest?
  var body: some View {
    let numerals = model.settings.numerals
    let favs = Set(model.content.favorites)
    let daily = HadithLibrary.hadithOfDay(Date(), tz: model.timeZone)
    let sahih = book == "sahih" ? HadithLibrary.searchSahih(query, topic: topic == "all" || topic == "fav" ? nil : topic, favorites: favs, onlyFavorites: topic == "fav") : []
    let nawawi = book == "nawawi" ? HadithLibrary.searchNawawi(query, favorites: favs, onlyFavorites: topic == "fav") : []
    let count = book == "sahih" ? sahih.count : nawawi.count
    ScrollView {
      VStack(spacing: 12) {
        Picker("المجموعة", selection: $book) { Text("مختارات من الصحيحين").tag("sahih"); Text("الأربعون النووية").tag("nawawi") }.pickerStyle(.segmented)
        if book == "sahih" && query.isEmpty && topic == "all" { HadithCard(hadith: daily, daily: true, onShareImage: { shareCard = card(for: daily) }) }
        ScrollView(.horizontal) {
          HStack(spacing: 6) {
            chip("الكل", "all"); chip("♥ المفضلة", "fav")
            if book == "sahih" { ForEach(HadithLibrary.topics, id: \.self) { t in chip(t, t) } }
          }
        }
        .scrollIndicators(.hidden)
        Text(book == "sahih" ? "\(Fmt.number(count, numerals: numerals)) حديثًا · النصوص منقولة حرفيًا من الصحيحين بترقيم فتح الباري وعبد الباقي" : "\(Fmt.number(count, numerals: numerals)) حديثًا · الأربعون النووية للإمام النووي بزيادتي ابن رجب، بمتونها وتخريجها").font(.arabic(11)).foregroundStyle(.tertiary).frame(maxWidth: .infinity, alignment: .leading)
        if book == "sahih" {
          ForEach(showAll ? sahih : Array(sahih.prefix(20))) { h in HadithCard(hadith: h, onShareImage: { shareCard = card(for: h) }) }
        } else {
          ForEach(showAll ? nawawi : Array(nawawi.prefix(20))) { n in NawawiCard(hadith: n, onShareImage: { shareCard = ShareCardRequest(title: "الأربعون النووية · \(n.title)", text: n.text, footer: n.takhrij.count > 70 ? String(n.takhrij.prefix(70)) + "…" : n.takhrij, quran: false, shareText: "\(n.text)\n\n\(n.takhrij)\n— الأربعون النووية، \(n.title)", filename: "\(n.id).png") }) }
        }
        if count == 0 { Text(topic == "fav" ? "لم تُضف أحاديث إلى المفضلة بعد" : "لا نتائج").foregroundStyle(.secondary).padding() }
        if count > 20 && !showAll { Button("عرض الكل (\(Fmt.number(count, numerals: numerals)))") { showAll = true }.buttonStyle(.bordered) }
      }
      .padding()
    }
    .background(Theme.background)
    .searchable(text: $query, prompt: book == "sahih" ? "ابحث في نص الحديث أو الراوي…" : "ابحث في الأربعين النووية…")
    .navigationTitle("الأحاديث").navigationBarTitleDisplayMode(.inline)
    .onAppear { book = initialBook }
    .onChange(of: book) { topic = "all"; showAll = false }
    .sheet(item: $shareCard) { ShareCardSheet(request: $0).environment(model) }
  }
  private func chip(_ label: String, _ id: String) -> some View {
    Button(label) { topic = id; showAll = false }.buttonStyle(.bordered).tint(topic == id ? Theme.primary : .secondary).font(.arabic(12))
  }
  private func card(for h: Hadith) -> ShareCardRequest {
    ShareCardRequest(title: "حديث شريف · \(h.grade)", text: h.text, footer: "عن \(h.narrator) — \(h.reference)", quran: false, shareText: "\(h.text)\n\nرواه \(h.narrator) — \(h.reference) (\(h.grade))", filename: "hadith-\(h.id).png")
  }
}

struct HadithCard: View {
  @Environment(AppModel.self) private var model
  let hadith: Hadith
  var daily = false
  var onShareImage: () -> Void
  @State private var showLesson = false
  @State private var share: ShareItems?
  var body: some View {
    let fav = model.content.favorites.contains(hadith.id)
    let scale = model.content.textScale
    let text = "\(hadith.text)\n\nرواه \(hadith.narrator) — \(hadith.reference) (\(hadith.grade))"
    VStack(alignment: .leading, spacing: 10) {
      if daily { Text("✦ حديث اليوم").font(.arabic(12, weight: .bold)).foregroundStyle(Theme.gold) }
      Text(hadith.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 17 * scale)).lineSpacing(9 * scale)
      Text("عن \(hadith.narrator)").font(.arabic(12)).foregroundStyle(.secondary)
      HStack { chipText(hadith.grade, strong: hadith.grade == "متفق عليه"); chipText(hadith.reference); chipText(hadith.topic) }.font(.arabic(10))
      HStack(spacing: 4) {
        Button { model.content.toggleFavorite(hadith.id) } label: { Image(systemName: fav ? "heart.fill" : "heart").foregroundStyle(fav ? .red : .secondary) }
        Button { UIPasteboard.general.string = text } label: { Image(systemName: "doc.on.doc") }
        Button { share = ShareItems(items: [text]) } label: { Image(systemName: "square.and.arrow.up") }
        Button { onShareImage() } label: { Image(systemName: "photo") }
        Spacer()
        Button(showLesson ? "إخفاء الفائدة" : "الفائدة من الحديث") { withAnimation { showLesson.toggle() } }.font(.arabic(12))
      }
      .buttonStyle(.plain).foregroundStyle(.secondary)
      if showLesson { Text(hadith.lesson).font(.arabic(14 * scale)).foregroundStyle(.primary).padding(10).background(Theme.primary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10)) }
    }
    .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
    .overlay(RoundedRectangle(cornerRadius: 16).stroke(daily ? Theme.gold.opacity(0.5) : .clear, lineWidth: 1))
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
  private func chipText(_ t: String, strong: Bool = false) -> some View { Text(t).padding(.horizontal, 8).padding(.vertical, 3).background((strong ? Theme.primary : Color.secondary).opacity(0.12), in: Capsule()).lineLimit(1) }
}

struct NawawiCard: View {
  @Environment(AppModel.self) private var model
  let hadith: NawawiHadith
  var onShareImage: () -> Void
  @State private var share: ShareItems?
  var body: some View {
    let fav = model.content.favorites.contains(hadith.id)
    let scale = model.content.textScale
    let text = "\(hadith.text)\n\n\(hadith.takhrij)\n— الأربعون النووية، \(hadith.title)"
    VStack(alignment: .leading, spacing: 10) {
      Text(hadith.title).font(.arabic(12, weight: .bold)).foregroundStyle(Theme.gold)
      Text(hadith.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 17 * scale)).lineSpacing(9 * scale)
      Text(hadith.takhrij).font(.arabic(12)).foregroundStyle(.secondary)
      HStack(spacing: 4) {
        Button { model.content.toggleFavorite(hadith.id) } label: { Image(systemName: fav ? "heart.fill" : "heart").foregroundStyle(fav ? .red : .secondary) }
        Button { UIPasteboard.general.string = text } label: { Image(systemName: "doc.on.doc") }
        Button { share = ShareItems(items: [text]) } label: { Image(systemName: "square.and.arrow.up") }
        Button { onShareImage() } label: { Image(systemName: "photo") }
      }
      .buttonStyle(.plain).foregroundStyle(.secondary)
    }
    .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
}

/// شاشة «المزيد»: الأحاديث وحصن المسلم والمسبحة والإعدادات، وحديث اليوم
struct MoreView: View {
  @Environment(AppModel.self) private var model
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }
  var body: some View {
    NavigationStack {
      let hd = HadithLibrary.hadithOfDay(Date(), tz: model.timeZone)
      ScrollView {
        VStack(spacing: 12) {
          LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            NavigationLink { HadithView() } label: { tile("الأحاديث", "الصحيحان والأربعون النووية", "text.book.closed") }
            NavigationLink { HisnView() } label: { tile("حصن المسلم", "الكتاب كاملًا: ١٣٢ بابًا", "book.closed") }
            NavigationLink { TasbihView() } label: { tile("المسبحة", "عدّاد التسبيح والإحصاء", "circle.grid.3x3") }
            NavigationLink { SettingsView() } label: { tile("الإعدادات", "الموقع والحساب والتنبيهات والنسخ", "gearshape") }
          }
          NavigationLink { HadithView() } label: {
            VStack(alignment: .leading, spacing: 8) {
              Text("✦ حديث اليوم").font(.arabic(12, weight: .bold)).foregroundStyle(Theme.gold)
              Text(hd.text.count > 220 ? String(hd.text.prefix(220)) + "…" : hd.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 16)).lineSpacing(8).foregroundStyle(.primary)
              Text("عن \(hd.narrator) — \(hd.reference)").font(.arabic(12)).foregroundStyle(.secondary)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
          }
          .buttonStyle(.plain)
          Text("سكينة \(version) (بناء \(build)) · تطبيق أصلي بالكامل يعمل دون اتصال · لا حساب ولا تتبّع؛ الشبكة تُستخدم فقط لجلب التلاوات وتلاوة أذكار حصن المسلم عند الطلب.").font(.arabic(11)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
        }
        .padding()
      }
      .background(Theme.background)
      .navigationTitle("المزيد")
    }
  }
  private func tile(_ title: String, _ sub: String, _ icon: String) -> some View {
    VStack(spacing: 6) { Image(systemName: icon).font(.system(size: 26)).foregroundStyle(Theme.primary); Text(title).font(.arabic(15, weight: .bold)); Text(sub).font(.arabic(11)).foregroundStyle(.secondary).multilineTextAlignment(.center) }
      .frame(maxWidth: .infinity).padding(.vertical, 16).padding(.horizontal, 8).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.primary)
  }
}
