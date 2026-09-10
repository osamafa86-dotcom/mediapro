import SwiftUI
import UIKit
import SakinahCore

/// شاشة الحديث (تصميم Figma 11): بطاقة حديث اليوم بخلفية الليل، مبدّل المجموعة، شرائط التصنيف، وبطاقات الأحاديث
struct HadithView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var initialBook = "sahih"
  var embedded = false
  @State private var book = 0
  @State private var topic = "all"
  @State private var query = ""
  @State private var searching = false
  @State private var showAll = false
  @State private var shareCard: ShareCardRequest?

  var body: some View {
    let numerals = model.settings.numerals
    let favs = Set(model.content.favorites)
    let daily = HadithLibrary.hadithOfDay(Date(), tz: model.timeZone)
    let sahih = book == 0 ? HadithLibrary.searchSahih(query, topic: topic == "all" || topic == "fav" ? nil : topic, favorites: favs, onlyFavorites: topic == "fav") : []
    let nawawi = book == 1 ? HadithLibrary.searchNawawi(query, favorites: favs, onlyFavorites: topic == "fav") : []
    let count = book == 0 ? sahih.count : nawawi.count
    ScrollView {
      VStack(spacing: DS.Space.s3) {
        if searching { searchField }
        if book == 0 && query.isEmpty && topic == "all" {
          DailyHadithCard(hadith: daily) { shareCard = card(for: daily) }
        }
        DSSegmented(items: ["الأربعون النووية", "مختارات الصحيحين"], selection: Binding(get: { book == 0 ? 1 : 0 }, set: { book = $0 == 1 ? 0 : 1; topic = "all"; showAll = false }))
        topicChips
        Text(book == 0
             ? "\(Fmt.number(count, numerals: numerals)) حديثًا · منقولة حرفيًا من الصحيحين بترقيم فتح الباري وعبد الباقي"
             : "\(Fmt.number(count, numerals: numerals)) حديثًا · الأربعون النووية للإمام النووي بزيادتي ابن رجب، بمتونها وتخريجها")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity, alignment: .trailing)
        if book == 0 {
          ForEach(showAll ? sahih : Array(sahih.prefix(20))) { h in HadithCard(hadith: h) { shareCard = card(for: h) } }
        } else {
          ForEach(showAll ? nawawi : Array(nawawi.prefix(20))) { n in
            NawawiCard(hadith: n) {
              shareCard = ShareCardRequest(title: "الأربعون النووية · \(n.title)", text: n.text, footer: n.takhrij.count > 70 ? String(n.takhrij.prefix(70)) + "…" : n.takhrij, quran: false, shareText: "\(n.text)\n\n\(n.takhrij)\n— الأربعون النووية، \(n.title)", filename: "\(n.id).png")
            }
          }
        }
        if count == 0 {
          Text(topic == "fav" ? "لم تُضف أحاديث إلى المفضلة بعد" : "لا نتائج — جرّب كلمة أخرى")
            .font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary).padding(.top, DS.Space.s6)
        }
        if count > 20 && !showAll {
          DSButton(title: "عرض الكل (\(Fmt.number(count, numerals: numerals)))", kind: .outline) { showAll = true }
        }
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) { navBar }
    .navigationBarHidden(true)
    .onAppear { book = initialBook == "nawawi" ? 1 : 0 }
    .sheet(item: $shareCard) { ShareCardSheet(request: $0).environment(model) }
  }

  private var navBar: some View {
    HStack {
      DSIconButton(systemName: searching ? "xmark" : "magnifyingglass", label: searching ? "إغلاق البحث" : "بحث في الأحاديث") {
        withAnimation(.snappy(duration: 0.2)) { searching.toggle(); if !searching { query = "" } }
      }
      Spacer()
      Text("الحديث").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary)
      Spacer()
      if embedded { DSIconButton(systemName: "chevron.forward", label: "رجوع") { dismiss() } }
      else { Color.clear.frame(width: 42, height: 42) }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .background(DS.C.bgCanvas)
  }

  private var searchField: some View {
    HStack(spacing: DS.Space.s2) {
      Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(DS.C.textTertiary)
      TextField(book == 0 ? "ابحث في نص الحديث أو الراوي…" : "ابحث في الأربعين النووية…", text: $query).font(DS.F.bodyMd).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain) }
    }
    .dsTile(padding: DS.Space.s3)
  }

  private var topicChips: some View {
    ScrollView(.horizontal) {
      HStack(spacing: DS.Space.s2) {
        DSChip(title: "الكل", on: topic == "all") { topic = "all"; showAll = false }
        DSChip(title: "المفضلة", on: topic == "fav", icon: "heart") { topic = "fav"; showAll = false }
        if book == 0 {
          ForEach(HadithLibrary.topics, id: \.self) { t in
            DSChip(title: t, on: topic == t) { topic = t; showAll = false }
          }
        }
      }
      .padding(.horizontal, 2)
    }
    .scrollIndicators(.hidden)
  }

  private func card(for h: Hadith) -> ShareCardRequest {
    ShareCardRequest(title: "حديث شريف · \(h.grade)", text: h.text, footer: "عن \(h.narrator) — \(h.reference)", quran: false, shareText: "\(h.text)\n\nرواه \(h.narrator) — \(h.reference) (\(h.grade))", filename: "hadith-\(h.id).png")
  }
}

/// حديث اليوم: بطاقة بخلفية الليل، النصّ بأميري، والتصنيف والتخريج في الأسفل
struct DailyHadithCard: View {
  @Environment(AppModel.self) private var model
  let hadith: Hadith
  var onShareImage: () -> Void
  @State private var share: ShareItems?
  var body: some View {
    let fav = model.content.favorites.contains(hadith.id)
    let text = "\(hadith.text)\n\nرواه \(hadith.narrator) — \(hadith.reference) (\(hadith.grade))"
    let hijri = model.hijri(now: Date()).formatted
    return VStack(alignment: .trailing, spacing: DS.Space.s4) {
      HStack {
        DSIconButton(systemName: "square.and.arrow.up", style: .glass, size: 34, iconSize: 14, label: "مشاركة") { share = ShareItems(items: [text]) }
        DSIconButton(systemName: fav ? "heart.fill" : "heart", style: .glass, size: 34, iconSize: 14, label: "مفضلة") { model.content.toggleFavorite(hadith.id) }
        Spacer()
        Text("حديث اليوم · \(hijri)").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.7)
      }
      Text("«\(hadith.text)»")
        .font(DS.amiri(18)).lineSpacing(11)
        .foregroundStyle(DS.C.textOnDark)
        .multilineTextAlignment(.center).frame(maxWidth: .infinity)
      HStack {
        Text(hadith.topic).font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted)
        Spacer()
        Text("\(hadith.grade) · \(hadith.reference)").font(DS.F.labelXs).foregroundStyle(DS.C.accentGold)
      }
    }
    .padding(DS.Space.s5)
    .nightCard()
    .onTapGesture { onShareImage() }
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
}

/// بطاقة حديث: النصّ، الراوي، شرائط الدرجة والمصدر والموضوع، وأزرار وفائدة قابلة للطيّ
struct HadithCard: View {
  @Environment(AppModel.self) private var model
  let hadith: Hadith
  var onShareImage: () -> Void
  @State private var showLesson = false
  @State private var share: ShareItems?
  var body: some View {
    let fav = model.content.favorites.contains(hadith.id)
    let scale = model.content.textScale
    let text = "\(hadith.text)\n\nرواه \(hadith.narrator) — \(hadith.reference) (\(hadith.grade))"
    return VStack(alignment: .trailing, spacing: DS.Space.s3) {
      Text("«\(hadith.text)»")
        .font(DS.amiri(17 * scale)).lineSpacing(9 * scale)
        .foregroundStyle(DS.C.textPrimary)
        .multilineTextAlignment(.center).frame(maxWidth: .infinity)
      HStack {
        Text(hadith.topic).font(DS.F.labelXs).foregroundStyle(DS.C.brandPrimary)
          .padding(.vertical, 4).padding(.horizontal, 10).background(DS.C.brandSoft, in: Capsule())
        Spacer()
        Text("\(hadith.reference) · عن \(hadith.narrator)").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.7)
      }
      if showLesson {
        Text(hadith.lesson).font(DS.F.bodySm).foregroundStyle(DS.C.textPrimary)
          .frame(maxWidth: .infinity, alignment: .trailing)
          .padding(DS.Space.s3).background(DS.C.brandSoft.opacity(0.5), in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
      }
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: fav ? "heart.fill" : "heart", style: fav ? .brand : .soft, size: 34, iconSize: 14, label: "مفضلة") { model.content.toggleFavorite(hadith.id) }
        DSIconButton(systemName: "doc.on.doc", style: .soft, size: 34, iconSize: 14, label: "نسخ") { UIPasteboard.general.string = text }
        DSIconButton(systemName: "square.and.arrow.up", style: .soft, size: 34, iconSize: 14, label: "مشاركة") { share = ShareItems(items: [text]) }
        DSIconButton(systemName: "photo", style: .soft, size: 34, iconSize: 14, label: "مشاركة كصورة") { onShareImage() }
        Spacer()
        Button { withAnimation(.snappy(duration: 0.2)) { showLesson.toggle() } } label: {
          DSLinkLabel(title: showLesson ? "إخفاء الفائدة" : "الفائدة")
        }
        .buttonStyle(.plain)
      }
    }
    .dsCard(padding: DS.Space.s4)
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
}

/// بطاقة من الأربعين النووية: العنوان الذهبي، المتن، والتخريج
struct NawawiCard: View {
  @Environment(AppModel.self) private var model
  let hadith: NawawiHadith
  var onShareImage: () -> Void
  @State private var share: ShareItems?
  var body: some View {
    let fav = model.content.favorites.contains(hadith.id)
    let scale = model.content.textScale
    let text = "\(hadith.text)\n\n\(hadith.takhrij)\n— الأربعون النووية، \(hadith.title)"
    return VStack(alignment: .trailing, spacing: DS.Space.s3) {
      Text(hadith.title).font(DS.F.labelSm).foregroundStyle(DS.C.accentGoldStrong)
        .frame(maxWidth: .infinity, alignment: .trailing)
      Text("«\(hadith.text)»")
        .font(DS.amiri(17 * scale)).lineSpacing(9 * scale)
        .foregroundStyle(DS.C.textPrimary)
        .multilineTextAlignment(.center).frame(maxWidth: .infinity)
      Text(hadith.takhrij).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity, alignment: .trailing)
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: fav ? "heart.fill" : "heart", style: fav ? .brand : .soft, size: 34, iconSize: 14, label: "مفضلة") { model.content.toggleFavorite(hadith.id) }
        DSIconButton(systemName: "doc.on.doc", style: .soft, size: 34, iconSize: 14, label: "نسخ") { UIPasteboard.general.string = text }
        DSIconButton(systemName: "square.and.arrow.up", style: .soft, size: 34, iconSize: 14, label: "مشاركة") { share = ShareItems(items: [text]) }
        DSIconButton(systemName: "photo", style: .soft, size: 34, iconSize: 14, label: "مشاركة كصورة") { onShareImage() }
        Spacer()
      }
    }
    .dsCard(padding: DS.Space.s4)
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
}

/// شاشة «المزيد» (تصميم Figma 12): بطاقة هوية التطبيق، ثم مجموعات المحتوى والأدوات والتطبيق
struct MoreView: View {
  @Environment(AppModel.self) private var model
  @State private var showChallenges = false
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s4) {
          brandCard
          group("المحتوى") {
            NavigationLink { HadithView(embedded: true).environment(model) } label: {
              DSRow(icon: "text.book.closed", title: "الحديث", subtitle: "مختارات الصحيحين · حديث اليوم") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { HadithView(initialBook: "nawawi", embedded: true).environment(model) } label: {
              DSRow(icon: "list.bullet.rectangle", title: "الأربعون النووية", subtitle: nil) { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { HisnView().environment(model) } label: {
              DSRow(icon: "book.closed", title: "حصن المسلم", subtitle: "\(Fmt.number(Hisn.chapters.count, numerals: model.settings.numerals)) بابًا") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            Button { showChallenges = true } label: {
              DSRow(icon: "flame", iconStyle: .gold, title: "التحدّيات والختمة", subtitle: streakLabel) { DSChevron() }
            }.buttonStyle(.plain)
          }
          group("الأدوات") {
            NavigationLink { WidgetsHelpView().environment(model) } label: {
              DSRow(icon: "bolt", title: "الودجت والنشاط المباشر", subtitle: "شاشة القفل والجزيرة الديناميكية") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { MonthTableView().environment(model) } label: {
              DSRow(icon: "calendar", title: "الجدول الشهري", subtitle: "تصدير ICS") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { DownloadsView().environment(model) } label: {
              DSRow(icon: "arrow.down.circle", title: "التنزيلات دون اتصال", subtitle: downloadsLabel) { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { BackupView().environment(model) } label: {
              DSRow(icon: "icloud", title: "النسخ الاحتياطي", subtitle: "تصدير واستيراد إعداداتك") { DSChevron() }
            }.buttonStyle(.plain)
          }
          group("التطبيق") {
            NavigationLink { SettingsView().environment(model) } label: {
              DSRow(icon: "gearshape", title: "الإعدادات", subtitle: "الموقع والحساب والتنبيهات والمظهر") { DSChevron() }
            }.buttonStyle(.plain)
            Divider().overlay(DS.C.borderSubtle)
            NavigationLink { TasbihView().environment(model) } label: {
              DSRow(icon: "circle.hexagongrid", title: "المسبحة", subtitle: "عدّاد التسبيح والإحصاء") { DSChevron() }
            }.buttonStyle(.plain)
          }
          Text("سكينة \(version) (بناء \(build)) · تطبيق أصلي بالكامل يعمل دون اتصال. لا حساب ولا تتبّع؛ الشبكة تُستعمل فقط لجلب التلاوات وتلاوة الأذكار عند الطلب.")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      }
      .background(DS.C.bgCanvas)
      .safeAreaInset(edge: .top, spacing: 0) {
        HStack { Spacer(); Text("المزيد").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary) }
          .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).background(DS.C.bgCanvas)
      }
      .navigationBarHidden(true)
      .sheet(isPresented: $showChallenges) { ChallengesSheet().environment(model) }
    }
  }

  private var brandCard: some View {
    HStack(spacing: DS.Space.s4) {
      VStack(alignment: .trailing, spacing: DS.Space.s2) {
        Text("سكينة").font(DS.F.displayMd).foregroundStyle(DS.C.textPrimary)
        Text("مواقيتك ومصحفك وأذكارك · بلا إعلانات ولا تتبّع")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(2).minimumScaleFactor(0.8)
        HStack(spacing: DS.Space.s2) {
          Text("لا يجمع بيانات").font(DS.F.labelXs).foregroundStyle(DS.C.brandPrimary)
            .padding(.vertical, 4).padding(.horizontal, 10).background(DS.C.brandSoft, in: Capsule())
          Text("الإصدار \(version)").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
            .padding(.vertical, 4).padding(.horizontal, 10).background(DS.C.bgSubtle, in: Capsule())
        }
      }
      Spacer(minLength: 0)
      ZStack {
        Circle().fill(DS.C.accentGoldSoft).frame(width: 62, height: 62)
        Image(systemName: "moon.stars.fill").font(.system(size: 26)).foregroundStyle(DS.C.accentGoldStrong)
      }
    }
    .dsCard()
  }

  private var streakLabel: String? {
    let n = Khatmah.streak(model.quran.readLog, today: model.todayKey)
    return n > 0 ? "سلسلة \(Fmt.number(n, numerals: model.settings.numerals)) \(n == 1 ? "يوم" : n == 2 ? "يومان" : n <= 10 ? "أيام" : "يومًا")" : nil
  }
  private var downloadsLabel: String? {
    let n = model.downloads.summary(reciter: model.quran.reciter).count
    return n > 0 ? "\(Fmt.number(n, numerals: model.settings.numerals)) سورة محفوظة" : "لا تنزيلات بعد"
  }

  @ViewBuilder private func group<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .trailing, spacing: DS.Space.s2) {
      Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity, alignment: .trailing).padding(.horizontal, DS.Space.s1)
      VStack(spacing: 0) { content() }.dsCard(padding: DS.Space.s2)
    }
  }
}

/// شرح الودجت والنشاط المباشر مع مفتاح تفعيله
struct WidgetsHelpView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    ScrollView {
      VStack(alignment: .trailing, spacing: DS.Space.s3) {
        DSCardBlock("النشاط المباشر", "عدّ تنازلي للصلاة القادمة على شاشة القفل وفي الجزيرة الديناميكية، يُحدَّث عند فتح التطبيق.") {
          Toggle(isOn: Binding(get: { model.settings.liveActivity }, set: { model.settings.liveActivity = $0; LiveActivityManager.sync(model) })) {
            Text("تفعيل النشاط المباشر").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          }
          .toggleStyle(DSToggleStyle())
        }
        DSCardBlock("ودجت مواقيت الصلاة", "أضف ودجت «مواقيت الصلاة» إلى الشاشة الرئيسية أو شاشة القفل: المس الشاشة مطوّلًا ← زر + ← ابحث عن «سكينة». يعمل بموقع الجهاز أو بمدينة تختارها من إعدادات الودجت.") { EmptyView() }
        DSCardBlock("لماذا لا يتحدّث الودجت كل دقيقة؟", "يمنح النظام الودجت عددًا محدودًا من التحديثات يوميًا؛ لذا نُجدول التحديث عند كل صلاة وعند فتح التطبيق، وهو ما يجعل الوقت المعروض صحيحًا دائمًا.") { EmptyView() }
      }
      .padding(DS.Space.s4)
    }
    .background(DS.C.bgCanvas)
    .navigationTitle("الودجت والنشاط المباشر").navigationBarTitleDisplayMode(.inline)
  }
}

/// النسخ الاحتياطي في شاشة مستقلّة
struct BackupView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    Form { BackupSection().environment(model) }
      .navigationTitle("النسخ الاحتياطي").navigationBarTitleDisplayMode(.inline)
  }
}

/// بطاقة عنوان ونصّ مع محتوى اختياري أسفلها
struct DSCardBlock<Content: View>: View {
  let title: String
  let body_: String
  @ViewBuilder var content: () -> Content
  init(_ title: String, _ body_: String, @ViewBuilder content: @escaping () -> Content) {
    self.title = title; self.body_ = body_; self.content = content
  }
  var body: some View {
    VStack(alignment: .trailing, spacing: DS.Space.s2) {
      Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text(body_).font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
        .frame(maxWidth: .infinity, alignment: .trailing)
      content()
    }
    .dsCard(padding: DS.Space.s4)
  }
}
