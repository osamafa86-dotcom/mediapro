import SwiftUI
import SakinahCore

/// التلاوات دون اتصال: تنزيل سور كاملة لقارئ وحذفها، ومجموع المخزّن
struct DownloadsView: View {
  @Environment(AppModel.self) private var model
  var focusSurah: Int? = nil
  @State private var reciter = ""
  var body: some View {
    let dl = model.downloads; let numerals = model.settings.numerals
    let words = model.quran.wordHighlight
    let ordered = focusSurah.map { f in [QuranMeta.surah(f)] + QuranMeta.surahs.filter { $0.n != f } } ?? QuranMeta.surahs
    let sum = dl.summary(reciter: reciter)
    NavigationStack {
      List {
        Section {
          Picker("القارئ", selection: $reciter) { ForEach(Catalog.shared.reciters) { r in Text(r.name + (r.hasWordTiming ? " — كلمة بكلمة" : "")).tag(r.id) } }
          Text(sum.count > 0 ? "\(Fmt.number(sum.count, numerals: numerals)) سورة محفوظة لهذا القارئ · \(AudioDownloads.fmtBytes(sum.bytes, numerals: numerals)) · إجمالي المخزّن \(AudioDownloads.fmtBytes(dl.totalBytes(), numerals: numerals))" : "لا سور محفوظة لهذا القارئ بعد").font(.arabic(12)).foregroundStyle(.secondary)
          HStack {
            Button("تنزيل سور الجزء الحالي") { if let f = focusSurah, let p = QuranMeta.surahs.first(where: { $0.n == f })?.page { let j = QuranMeta.juz(ofPage: p); for su in QuranMeta.surahs where QuranText.shared.surahAyahs(su.n).contains(where: { $0.juz == j }) && dl.entry(reciter: reciter, surah: su.n) == nil && !dl.isRunning(reciter: reciter, surah: su.n) { dl.download(reciter: reciter, surah: su.n, words: words) } } }.buttonStyle(.bordered)
            Spacer()
            Button("حذف الكل", role: .destructive) { dl.deleteAll() }.buttonStyle(.bordered)
          }
        }
        Section("السور") {
          ForEach(ordered) { su in
            let e = dl.entry(reciter: reciter, surah: su.n); let running = dl.isRunning(reciter: reciter, surah: su.n)
            HStack {
              VStack(alignment: .leading, spacing: 2) {
                Text("\(Fmt.number(su.n, numerals: numerals)). \(su.name)").font(.arabic(16))
                Text(e.map { "محفوظة · \(AudioDownloads.fmtBytes($0.bytes, numerals: numerals))\($0.words ? " · كلمة بكلمة" : "")" } ?? "\(Fmt.number(su.ayahs, numerals: numerals)) آية").font(.arabic(12)).foregroundStyle(.secondary)
              }
              Spacer()
              if running { Text("\(Fmt.number(Int(dl.progress(reciter: reciter, surah: su.n) * 100), numerals: numerals))٪").font(.arabic(12)).foregroundStyle(.secondary) }
              Button(running ? "إيقاف" : (e != nil ? "حذف" : "تنزيل")) { if running { dl.download(reciter: reciter, surah: su.n, words: words) } else if e != nil { dl.delete(reciter: reciter, surah: su.n) } else { dl.download(reciter: reciter, surah: su.n, words: words) } }
                .buttonStyle(.bordered).tint(e != nil && !running ? .red : Theme.primary).font(.arabic(13))
            }
          }
        }
        Section { Text("تُحفظ الملفات داخل التطبيق وتُشغَّل تلقائيًا دون اتصال. الحجم التقريبي للسورة الطويلة نحو 50 م.ب بجودة 128k.").font(.arabic(12)).foregroundStyle(.secondary) }
      }
      .navigationTitle("التلاوات دون اتصال").navigationBarTitleDisplayMode(.inline)
      .onAppear { if reciter.isEmpty { reciter = model.quran.reciter } }
    }
  }
}
