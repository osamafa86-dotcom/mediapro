import SwiftUI
import UniformTypeIdentifiers
import SakinahCore

/// النسخة الاحتياطية بصيغة نسخة الويب نفسها: تصدير كل الإعدادات والعلامات والتقدّم، واستيرادها (من الويب أو من التطبيق)
enum BackupService {
  static func export(_ model: AppModel) -> WebBackup {
    var s = WebSettings()
    let st = model.settings; let q = model.quran; let c = model.content; let loc = model.location
    if let co = loc.coordinate { s.location = WebSettings.Location(lat: co.latitude, lon: co.longitude, tz: loc.timeZone.identifier, name: loc.placeName, countryCode: loc.countryCode, cityId: loc.cityId, source: loc.mode == .gps ? "gps" : "city") }
    s.method = st.methodIsAutomatic ? "auto" : st.methodId; s.madhab = st.madhab.rawValue; s.highLatitudeRule = st.highLatitudeRule.rawValue
    s.hijriOffset = st.hijriOffset; s.hour12 = st.hour12; s.numerals = st.numerals
    var n = WebSettings.Notifications(); let r = st.reminders; let x = c.extraReminders
    n.enabled = r.enabled; n.prayers = Dictionary(uniqueKeysWithValues: Prayer.allCases.map { ($0.rawValue, r.prayers.contains($0)) }); n.preMinutes = r.preMinutes; n.sound = r.sound
    n.adhkar = WebSettings.Notifications.AdhkarPrefs(morning: x.adhkarMorning, evening: x.adhkarEvening, morningAfter: x.morningAfter, eveningAfter: x.eveningAfter)
    n.hadithDaily = WebSettings.Notifications.HadithDaily(enabled: x.hadithDaily, time: x.hadithTime)
    s.notifications = n
    var qq = WebSettings.Quran()
    qq.lastRead = st.lastRead.map { WebSettings.LastRead(page: $0.page, surah: $0.surah, ayah: $0.ayah, at: $0.at) }
    qq.bookmarks = q.bookmarks; qq.reciter = q.reciter; qq.repeatAyah = q.repeatAyah; qq.repeatRange = q.repeatRange; qq.rate = q.rate; qq.follow = q.follow
    qq.fontScale = q.fontScale; qq.hifzOnlyCurrent = q.hifzOnlyCurrent; qq.theme = q.theme; qq.themeLight = q.themeLight; qq.themeDark = q.themeDark; qq.themeAuto = q.themeAuto
    qq.dim = q.dim; qq.keepAwake = q.keepAwake; qq.lineHeight = q.lineHeight; qq.tajweed = q.tajweed; qq.scroll = q.scroll; qq.textFont = q.textFont; qq.fitText = q.fitText
    qq.challenge = q.challenge; qq.tafsir = q.tafsir; qq.view = q.view; qq.wordHighlight = q.wordHighlight; qq.khatmah = q.khatmah; qq.readLog = q.readLog
    s.quran = qq
    s.adhkarProgress = c.adhkarProgress; s.favorites = c.favorites; s.tasbih = c.tasbih; s.hisnFavorites = c.hisnFavorites; s.shareTheme = c.shareTheme; s.textScale = c.textScale
    return WebBackup(settings: s)
  }

  /// تطبيق نسخة: القيم الموجودة فقط تُستبدل (الغائبة تبقى)
  static func apply(_ b: WebBackup, to model: AppModel) {
    let s = b.settings; let st = model.settings; let q = model.quran; let c = model.content
    if let l = s.location {
      if let id = l.cityId, let city = CityDatabase.bundled.cities.first(where: { $0.id == id }) { model.location.useCity(city) }
      else if let lat = l.lat, let lon = l.lon, l.source != "gps", let near = CityDatabase.bundled.nearest(lat: lat, lon: lon) { model.location.useCity(near.city) }
    }
    if let m = s.method { if m == "auto" { st.methodIsAutomatic = true } else { st.methodIsAutomatic = false; st.methodId = m } }
    if let v = s.madhab, let m = Madhab(rawValue: v) { st.madhab = m }
    if let v = s.highLatitudeRule, let h = HighLatitudeRule(rawValue: v) { st.highLatitudeRule = h }
    if let v = s.hijriOffset { st.hijriOffset = v }; if let v = s.hour12 { st.hour12 = v }; if let v = s.numerals { st.numerals = v }
    if let n = s.notifications {
      var r = st.reminders
      if let e = n.enabled { r.enabled = e }
      if let p = n.prayers { r.prayers = Set(p.filter { $0.value }.compactMap { Prayer(rawValue: $0.key) }) }
      if let v = n.preMinutes { r.preMinutes = v }; if let v = n.sound { r.sound = v }
      st.reminders = r
      var x = c.extraReminders
      if let a = n.adhkar { x.adhkarMorning = a.morning ?? x.adhkarMorning; x.adhkarEvening = a.evening ?? x.adhkarEvening; x.morningAfter = a.morningAfter ?? x.morningAfter; x.eveningAfter = a.eveningAfter ?? x.eveningAfter }
      if let h = n.hadithDaily { x.hadithDaily = h.enabled ?? x.hadithDaily; x.hadithTime = h.time ?? x.hadithTime }
      c.extraReminders = x
    }
    if let qq = s.quran {
      if let lr = qq.lastRead, let a = QuranText.shared.pageAyahs(lr.page).first { st.lastRead = LastRead(page: lr.page, surah: lr.surah ?? a.surah, ayah: lr.ayah ?? a.ayah, at: lr.at ?? Date().timeIntervalSince1970 * 1000) }
      if let v = qq.bookmarks { q.bookmarks = v.map { b in WebSettings.Bookmark(surah: b.surah, ayah: b.ayah, page: b.page ?? QuranText.shared.ayah(surah: b.surah, ayah: b.ayah)?.page, at: b.at, note: b.note, color: b.color ?? "gold") } }
      if let v = qq.reciter, Catalog.shared.reciters.contains(where: { $0.id == v }) { q.reciter = v }
      if let v = qq.repeatAyah { q.repeatAyah = v }; if let v = qq.repeatRange { q.repeatRange = v }; if let v = qq.rate { q.rate = v }; if let v = qq.follow { q.follow = v }
      if let v = qq.fontScale { q.fontScale = v }; if let v = qq.hifzOnlyCurrent { q.hifzOnlyCurrent = v }
      q.theme = Catalog.shared.migrateTheme(theme: qq.theme, night: qq.night ?? false, paper: qq.paper)
      if let v = qq.themeLight { q.themeLight = v }; if let v = qq.themeDark { q.themeDark = v }; if let v = qq.themeAuto { q.themeAuto = v }
      if let v = qq.dim { q.dim = v }; if let v = qq.keepAwake { q.keepAwake = v }; if let v = qq.lineHeight { q.lineHeight = v }; if let v = qq.tajweed { q.tajweed = v }
      if let v = qq.scroll { q.scroll = v }; if let v = qq.textFont { q.textFont = v }; if let v = qq.fitText { q.fitText = v }; if let v = qq.view { q.view = v }; if let v = qq.wordHighlight { q.wordHighlight = v }
      if let v = qq.tafsir { q.tafsir = v }
      q.challenge = qq.challenge; q.khatmah = qq.khatmah
      if let v = qq.readLog { q.readLog = v }
    }
    if let v = s.adhkarProgress { c.adhkarProgress = v }; if let v = s.favorites { c.favorites = v }; if let v = s.tasbih { c.tasbih = v }
    if let v = s.hisnFavorites { c.hisnFavorites = v }; if let v = s.shareTheme { c.shareTheme = v }; if let v = s.textScale { c.textScale = v }
    model.applyAutomaticMethodIfNeeded(); model.rescheduleNotifications()
  }

  // MARK: - لقطات يومية في مجلد المستندات (تظهر في تطبيق «الملفات»)
  static var dir: URL { let d = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("sakinah-backups", isDirectory: true); try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true); return d }
  static func snapshots() -> [URL] { ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []).filter { $0.lastPathComponent.hasPrefix("sakinah-") && $0.pathExtension == "json" }.sorted { $0.lastPathComponent > $1.lastPathComponent } }
  @discardableResult
  static func autoSnapshot(_ model: AppModel, keep: Int = 7) -> Bool {
    let name = "sakinah-\(model.todayKey).json"; let dst = dir.appendingPathComponent(name)
    if FileManager.default.fileExists(atPath: dst.path) { return false }
    guard let data = try? export(model).encoded() else { return false }
    try? data.write(to: dst)
    for old in snapshots().dropFirst(keep) { try? FileManager.default.removeItem(at: old) }
    return true
  }
}

/// ملف النسخة الاحتياطية لمشاركة/تصدير SwiftUI
struct BackupDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.json] }
  var data: Data
  init(data: Data) { self.data = data }
  init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

/// قسم النسخة الاحتياطية في الإعدادات: تصدير/استيراد ملف، لقطات يومية، مشاركة
struct BackupSection: View {
  @Environment(AppModel.self) private var model
  @State private var exporting = false
  @State private var importing = false
  @State private var doc = BackupDocument(data: Data())
  @State private var message: String?
  @State private var share: ShareItems?
  var body: some View {
    Section {
      Button { if let d = try? BackupService.export(model).encoded() { doc = BackupDocument(data: d); exporting = true } } label: { Label("تصدير نسخة احتياطية (ملف JSON)", systemImage: "square.and.arrow.up") }
      Button { importing = true } label: { Label("استيراد نسخة (من الويب أو من هذا التطبيق)", systemImage: "square.and.arrow.down") }
      Button { let ok = BackupService.autoSnapshot(model); message = ok ? "أُخذت لقطة اليوم" : "لقطة اليوم موجودة" } label: { Label("لقطة الآن في «الملفات ← سكينة ← sakinah-backups»", systemImage: "camera") }
      let snaps = BackupService.snapshots()
      if !snaps.isEmpty {
        ForEach(snaps.prefix(7), id: \.self) { u in
          HStack { Text(u.lastPathComponent.replacingOccurrences(of: "sakinah-", with: "").replacingOccurrences(of: ".json", with: "")).font(.system(size: 13, design: .monospaced)); Spacer(); Button("استعادة") { restore(u) }.font(.arabic(13)); Button { share = ShareItems(items: [u]) } label: { Image(systemName: "square.and.arrow.up") } }
        }
      }
      if let message { Text(message).font(.arabic(12)).foregroundStyle(Theme.primary) }
    } header: { Text("النسخة الاحتياطية") } footer: { Text("الصيغة نفسها في نسخة الويب من سكينة: يمكن نقل الإعدادات والعلامات والختمة والمسبحة بين النسختين. تُحفظ آخر 7 لقطات يومية تلقائيًا في مجلد المستندات.").font(.arabic(11)) }
    .fileExporter(isPresented: $exporting, document: doc, contentType: .json, defaultFilename: "sakinah-backup-\(model.todayKey)") { r in message = (try? r.get()) != nil ? "صُدّرت النسخة" : "لم يُصدَّر الملف" }
    .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { r in
      guard let u = try? r.get() else { return }
      let ok = u.startAccessingSecurityScopedResource(); defer { if ok { u.stopAccessingSecurityScopedResource() } }
      restore(u)
    }
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
  private func restore(_ u: URL) {
    guard let data = try? Data(contentsOf: u), let b = try? WebBackup.parse(data) else { message = "الملف ليس نسخة احتياطية من سكينة"; return }
    BackupService.apply(b, to: model); message = "استُعيدت النسخة" + (b.exportedAt.map { " (\($0.prefix(10)))" } ?? "")
  }
}

/// تذكيرات الأذكار وحديث اليوم
struct ExtraRemindersSection: View {
  @Environment(AppModel.self) private var model
  private var prefs: Binding<ExtraReminderPrefs> { Binding(get: { model.content.extraReminders }, set: { model.content.extraReminders = $0; model.rescheduleNotifications() }) }
  var body: some View {
    let numerals = model.settings.numerals
    Section {
      Toggle("أذكار الصباح بعد الفجر", isOn: prefs.adhkarMorning)
      if prefs.wrappedValue.adhkarMorning { Stepper("بعد الفجر بـ \(Fmt.number(prefs.wrappedValue.morningAfter, numerals: numerals)) دقيقة", value: prefs.morningAfter, in: 0...180, step: 5) }
      Toggle("أذكار المساء بعد العصر", isOn: prefs.adhkarEvening)
      if prefs.wrappedValue.adhkarEvening { Stepper("بعد العصر بـ \(Fmt.number(prefs.wrappedValue.eveningAfter, numerals: numerals)) دقيقة", value: prefs.eveningAfter, in: 0...180, step: 5) }
      Toggle("حديث اليوم", isOn: prefs.hadithDaily)
      if prefs.wrappedValue.hadithDaily {
        DatePicker("الوقت", selection: Binding(get: { time(prefs.wrappedValue.hadithTime) }, set: { d in let c = Calendar.current.dateComponents([.hour, .minute], from: d); prefs.wrappedValue.hadithTime = String(format: "%02d:%02d", c.hour ?? 9, c.minute ?? 0) }), displayedComponents: .hourAndMinute)
      }
    } header: { Text("تذكيرات الأذكار والحديث") } footer: { Text("تُجدوَل أذكار الصباح والمساء لسبعة أيام من مواقيت موقعك، وحديث اليوم يوميًا في الوقت المحدد.").font(.arabic(11)) }
  }
  private func time(_ s: String) -> Date { let p = s.split(separator: ":").compactMap { Int($0) }; return Calendar.current.date(bySettingHour: p.first ?? 9, minute: p.count > 1 ? p[1] : 0, second: 0, of: Date()) ?? Date() }
}
