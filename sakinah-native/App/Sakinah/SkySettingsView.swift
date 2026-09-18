import SwiftUI
import SakinahCore

/// «مظهر السماء» (Figma «٧ · نظام السماء والطقس»): معاينة حيّة، ثم تلقائي/ثابت/مخصّص،
/// مفتاح الطقس مع ملاحظة الخصوصية، تقليل الحركة، اختيار طور ثابت، أو لون مخصّص
struct SkySettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss

  private var prefs: SkyPrefs { model.settings.sky }
  private func update(_ f: (inout SkyPrefs) -> Void) { var p = model.settings.sky; f(&p); model.settings.sky = p }
  private var modeIndex: Int { switch prefs.mode { case .auto: 0; case .fixed: 1; case .custom: 2 } }

  var body: some View {
    ScrollView {
      VStack(spacing: DS.Space.s4) {
        preview
        DSSegmented(items: ["تلقائي", "ثابت", "مخصّص"], selection: Binding(get: { modeIndex }, set: { i in update { $0.mode = i == 0 ? .auto : i == 1 ? .fixed : .custom } }))
        autoGroup
        fixedGroup
        customGroup
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) {
      HStack {
        Spacer()
        Text("مظهر السماء").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSIconButton(systemName: "chevron.forward", label: "رجوع") { dismiss() }
      }
      .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).background(DS.C.bgCanvas)
    }
    .navigationBarHidden(true)
  }

  // MARK: معاينة حيّة — الحالة الفعلية الآن بحسب التفضيلات (بلا طقس شبكي هنا)
  private var preview: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      let now = ctx.date
      let t = model.timeline(now: now)
      let state = SkyEngine.state(at: now, inputs: t.map { SkyInputs($0, tz: model.timeZone) }, prefs: prefs, weather: nil)
      let p = state.palette
      let s = model.settings
      ZStack(alignment: .topLeading) {
        SkyBackdrop(state: state, reduceMotion: prefs.reduceMotion)
        VStack(alignment: .leading, spacing: 4) {
          if let t {
            Text(t.next.isTomorrow ? "فجر الغد" : t.next.key.nameAr).font(DS.kufi(30, .bold)).foregroundStyle(p.text)
            Text(Fmt.countdown(t.next.time.timeIntervalSince(now), numerals: s.numerals)).font(DS.readex(18, .medium, fixed: true)).monospacedDigit().foregroundStyle(p.textSoft)
          } else {
            Text("سكينة").font(DS.kufi(30, .bold)).foregroundStyle(p.text)
          }
        }
        .padding(18)
        HStack(spacing: 6) {
          Text(previewLabel(state)).font(DS.readex(11, .medium)).foregroundStyle(p.text)
        }
        .padding(.vertical, 4).padding(.horizontal, 10).background(p.glass, in: Capsule()).overlay(Capsule().stroke(p.glassStroke, lineWidth: 1))
        .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
      }
      .frame(height: 150)
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      .animation(.easeInOut(duration: prefs.reduceMotion ? 0 : 0.6), value: p)
    }
  }
  private func previewLabel(_ st: SkyState) -> String {
    switch prefs.mode {
    case .auto: return "الآن: \(st.dominant.nameAr)" + (prefs.weather ? " · الطقس مفعّل" : "") + (model.location.placeName.map { " · \($0)" } ?? "")
    case .fixed: return "ثابت: \(prefs.fixedPhase.nameAr)"
    case .custom: return "مخصّص: \(prefs.accent.nameAr)"
    }
  }

  // MARK: تلقائي
  private var autoGroup: some View {
    SettingsGroup("تلقائي") {
      row(title: "السماء تتبع الوقت", subtitle: "تسعة أطوار من مواقيت صلاتك: السَّحَر، الفجر، الشروق، الضحى، الظهر، العصر، الغروب، الشفق، الليل",
          on: Binding(get: { prefs.mode == .auto }, set: { on in update { $0.mode = on ? .auto : .fixed } }))
      SettingsDivider()
      row(title: "تتأثّر بالطقس", subtitle: "غيوم ومطر وغبار وثلج فوق السماء. يُرسل موقعك مقرّبًا إلى نحو كيلومتر إلى Open-Meteo مرّةً كل ساعة، بلا حساب ولا مفتاح.",
          on: Binding(get: { prefs.weather }, set: { on in update { $0.weather = on } }))
      SettingsDivider()
      row(title: "تقليل الحركة", subtitle: "يوقف زحف الغيوم ونبض القبلة وتبدّل السماء المتدرّج",
          on: Binding(get: { prefs.reduceMotion }, set: { on in update { $0.reduceMotion = on } }))
    }
  }
  private func row(title: String, subtitle: String, on: Binding<Bool>) -> some View {
    Toggle(isOn: on) {
      VStack(alignment: .leading, spacing: 3) {
        Text(title).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      }
    }
    .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
  }

  // MARK: ثابت
  private var fixedGroup: some View {
    SettingsGroup("ثابت — اختر طورًا يبقى") {
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 10) {
        ForEach(SkyPhase.allCases, id: \.self) { ph in
          let pal = SkyPalette.of(ph)
          let selected = prefs.mode == .fixed && prefs.fixedPhase == ph
          Button { update { $0.mode = .fixed; $0.fixedPhase = ph } } label: {
            VStack(spacing: 5) {
              RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(LinearGradient(colors: [pal.stops[0].color, pal.stops[3].color], startPoint: .top, endPoint: .bottom))
                .frame(height: 40)
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(selected ? DS.C.accentGold : DS.C.borderSubtle, lineWidth: selected ? 2.5 : 1))
              Text(ph.nameAr).font(DS.readex(10.5, .medium)).foregroundStyle(DS.C.textPrimary).lineLimit(1)
            }
          }
          .buttonStyle(.plain).accessibilityLabel(ph.nameAr).accessibilityHint(ph.ruleAr).accessibilityAddTraits(selected ? .isSelected : [])
        }
      }
      .padding(DS.Space.s3)
    }
  }

  // MARK: مخصّص
  private var customGroup: some View {
    SettingsGroup("مخصّص — لونك أنت") {
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 10) {
        ForEach(SkyAccent.allCases, id: \.self) { a in
          let selected = prefs.mode == .custom && prefs.accent == a
          Button { update { $0.mode = .custom; $0.accent = a } } label: {
            VStack(spacing: 5) {
              Circle().fill(LinearGradient(colors: [Color(hex: 0x0A0F14), Color(hex: a.hex)], startPoint: .top, endPoint: .bottom)).frame(width: 40, height: 40)
                .overlay(Circle().stroke(selected ? DS.C.accentGold : DS.C.borderSubtle, lineWidth: selected ? 2.5 : 1))
              Text(a.nameAr).font(DS.readex(10.5, .medium)).foregroundStyle(DS.C.textPrimary).lineLimit(1)
            }
          }
          .buttonStyle(.plain).accessibilityLabel(a.nameAr).accessibilityAddTraits(selected ? .isSelected : [])
        }
      }
      .padding(DS.Space.s3)
      Text("اللون المخصّص يلوّن السماء وبطاقة الأذكار؛ الذهب والنعناع يبقيان كما هما للإشارات.")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).padding(.horizontal, DS.Space.s3).padding(.bottom, DS.Space.s3)
    }
  }
}
