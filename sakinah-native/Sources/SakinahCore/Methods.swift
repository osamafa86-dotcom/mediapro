import Foundation

/// طريقة حساب مواقيت الصلاة (زوايا الهيئات الرسمية وتعديلاتها) — مطابقة لـ methods.js
public struct CalculationMethod: Sendable, Hashable, Codable {
  public let id: String
  public let nameAr: String
  public let nameEn: String
  public let fajrAngle: Double
  public let ishaAngle: Double
  /// دقائق بعد المغرب بدل الزاوية (أم القرى، قطر، الخليج، لشبونة)
  public var ishaInterval: Double
  /// بديل رمضاني (أم القرى: 120 دقيقة)
  public let ishaIntervalRamadan: Double?
  /// زاوية للمغرب بدل الغروب (الطرق الجعفرية)
  public var maghribAngle: Double
  public let maghribInterval: Double
  /// تعديلات بالدقائق تفرضها الهيئة نفسها
  public let adjustments: PrayerAdjustments
  public var rounding: Rounding
  public let aladhanId: Int?
  public let region: String?
  public let seasonal: Bool
}

public enum Rounding: String, Sendable, Codable { case nearest, up, none }

public struct PrayerAdjustments: Sendable, Hashable, Codable {
  public var fajr = 0.0, sunrise = 0.0, dhuhr = 0.0, asr = 0.0, maghrib = 0.0, isha = 0.0
  public init(fajr: Double = 0, sunrise: Double = 0, dhuhr: Double = 0, asr: Double = 0, maghrib: Double = 0, isha: Double = 0) {
    self.fajr = fajr; self.sunrise = sunrise; self.dhuhr = dhuhr; self.asr = asr; self.maghrib = maghrib; self.isha = isha
  }
  public static let zero = PrayerAdjustments()
  public subscript(_ prayer: Prayer) -> Double {
    switch prayer { case .fajr: fajr; case .sunrise: sunrise; case .dhuhr: dhuhr; case .asr: asr; case .maghrib: maghrib; case .isha: isha }
  }
}

public enum Prayer: String, Sendable, Codable, CaseIterable, Hashable {
  case fajr, sunrise, dhuhr, asr, maghrib, isha
  public var nameAr: String {
    switch self { case .fajr: "الفجر"; case .sunrise: "الشروق"; case .dhuhr: "الظهر"; case .asr: "العصر"; case .maghrib: "المغرب"; case .isha: "العشاء" }
  }
}

public enum Methods {
  private static func m(_ id: String, _ nameAr: String, _ nameEn: String, _ fajr: Double, _ isha: Double,
                        ishaInterval: Double = 0, ishaIntervalRamadan: Double? = nil, maghribAngle: Double = 0, maghribInterval: Double = 0,
                        adjustments: PrayerAdjustments = .zero, rounding: Rounding = .nearest, aladhanId: Int? = nil, region: String? = nil, seasonal: Bool = false) -> CalculationMethod {
    CalculationMethod(id: id, nameAr: nameAr, nameEn: nameEn, fajrAngle: fajr, ishaAngle: isha, ishaInterval: ishaInterval, ishaIntervalRamadan: ishaIntervalRamadan,
                      maghribAngle: maghribAngle, maghribInterval: maghribInterval, adjustments: adjustments, rounding: rounding, aladhanId: aladhanId, region: region, seasonal: seasonal)
  }

  public static let all: [String: CalculationMethod] = [
    "UmmAlQura": m("UmmAlQura", "جامعة أم القرى (السعودية)", "Umm al-Qura University, Makkah", 18.5, 0, ishaInterval: 90, ishaIntervalRamadan: 120, aladhanId: 4, region: "SA"),
    "MuslimWorldLeague": m("MuslimWorldLeague", "رابطة العالم الإسلامي", "Muslim World League", 18, 17, adjustments: PrayerAdjustments(dhuhr: 1), aladhanId: 3),
    "Egyptian": m("Egyptian", "الهيئة المصرية العامة للمساحة", "Egyptian General Authority of Survey", 19.5, 17.5, adjustments: PrayerAdjustments(dhuhr: 1), aladhanId: 5, region: "EG"),
    "Karachi": m("Karachi", "جامعة العلوم الإسلامية (كراتشي)", "University of Islamic Sciences, Karachi", 18, 18, adjustments: PrayerAdjustments(dhuhr: 1), aladhanId: 1, region: "PK"),
    "NorthAmerica": m("NorthAmerica", "الجمعية الإسلامية لأمريكا الشمالية (ISNA)", "Islamic Society of North America", 15, 15, adjustments: PrayerAdjustments(dhuhr: 1), aladhanId: 2, region: "US"),
    "Dubai": m("Dubai", "دبي (الإمارات)", "Dubai", 18.2, 18.2, adjustments: PrayerAdjustments(sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3), aladhanId: 16, region: "AE"),
    "Gulf": m("Gulf", "منطقة الخليج", "Gulf Region", 19.5, 0, ishaInterval: 90, aladhanId: 8),
    "Kuwait": m("Kuwait", "الكويت", "Kuwait", 18, 17.5, aladhanId: 9, region: "KW"),
    "Qatar": m("Qatar", "قطر", "Qatar", 18, 0, ishaInterval: 90, aladhanId: 10, region: "QA"),
    "Jordan": m("Jordan", "وزارة الأوقاف الأردنية", "Ministry of Awqaf, Jordan", 18, 18, maghribInterval: 5, aladhanId: 23, region: "JO"),
    "Turkey": m("Turkey", "رئاسة الشؤون الدينية (تركيا)", "Diyanet İşleri Başkanlığı", 18, 17, adjustments: PrayerAdjustments(sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7), aladhanId: 13, region: "TR"),
    "Tehran": m("Tehran", "معهد الجيوفيزياء – جامعة طهران", "Institute of Geophysics, University of Tehran", 17.7, 14, maghribAngle: 4.5, aladhanId: 7, region: "IR"),
    "Jafari": m("Jafari", "الطريقة الجعفرية (قم)", "Shia Ithna-Ashari, Leva Institute, Qum", 16, 14, maghribAngle: 4, aladhanId: 0),
    "Singapore": m("Singapore", "المجلس الإسلامي بسنغافورة (MUIS)", "Majlis Ugama Islam Singapura", 20, 18, adjustments: PrayerAdjustments(dhuhr: 1), rounding: .up, aladhanId: 11, region: "SG"),
    "JAKIM": m("JAKIM", "دائرة التقدم الإسلامي الماليزية (JAKIM)", "Jabatan Kemajuan Islam Malaysia", 20, 18, aladhanId: 17, region: "MY"),
    "Indonesia": m("Indonesia", "وزارة الشؤون الدينية الإندونيسية", "Kementerian Agama Republik Indonesia", 20, 18, aladhanId: 20, region: "ID"),
    "MoonsightingCommittee": m("MoonsightingCommittee", "لجنة رؤية الهلال العالمية", "Moonsighting Committee Worldwide", 18, 18, adjustments: PrayerAdjustments(dhuhr: 5, maghrib: 3), aladhanId: 15, seasonal: true),
    "France": m("France", "اتحاد المنظمات الإسلامية في فرنسا", "Union des Organisations Islamiques de France", 12, 12, aladhanId: 12, region: "FR"),
    "Russia": m("Russia", "الإدارة الدينية لمسلمي روسيا", "Spiritual Administration of Muslims of Russia", 16, 15, aladhanId: 14, region: "RU"),
    "Tunisia": m("Tunisia", "تونس", "Tunisia", 18, 18, aladhanId: 18, region: "TN"),
    "Algeria": m("Algeria", "وزارة الشؤون الدينية الجزائرية", "Algeria", 18, 17, aladhanId: 19, region: "DZ"),
    "Morocco": m("Morocco", "وزارة الأوقاف المغربية", "Morocco", 19, 17, aladhanId: 21, region: "MA"),
    "Portugal": m("Portugal", "الجالية الإسلامية في لشبونة", "Comunidade Islâmica de Lisboa", 18, 0, ishaInterval: 77, maghribInterval: 3, aladhanId: 22, region: "PT"),
    "Custom": m("Custom", "مخصّص", "Custom", 18, 17),
  ]

  /// ترتيب العرض في الإعدادات
  public static let order = [
    "UmmAlQura", "MuslimWorldLeague", "Egyptian", "Jordan", "Kuwait", "Qatar", "Dubai", "Gulf",
    "Karachi", "NorthAmerica", "Turkey", "Tunisia", "Algeria", "Morocco", "Singapore", "JAKIM", "Indonesia",
    "MoonsightingCommittee", "Tehran", "Jafari", "France", "Russia", "Portugal", "Custom",
  ]

  /// الطريقة الافتراضية حسب الدولة (ISO 3166-1 alpha-2)
  public static let countryMethod: [String: String] = [
    "SA": "UmmAlQura", "YE": "UmmAlQura",
    "AE": "Dubai", "QA": "Qatar", "KW": "Kuwait", "BH": "Gulf", "OM": "Gulf",
    "JO": "Jordan", "PS": "Jordan",
    "EG": "Egyptian", "SD": "Egyptian", "LY": "Egyptian", "LB": "Egyptian", "SY": "Egyptian", "IQ": "Egyptian",
    "SS": "Egyptian", "ER": "Egyptian", "ET": "Egyptian", "SO": "Egyptian", "DJ": "Egyptian", "KM": "Egyptian",
    "TN": "Tunisia", "DZ": "Algeria", "MA": "Morocco", "MR": "Morocco", "EH": "Morocco",
    "TR": "Turkey", "CY": "Turkey", "AZ": "Turkey",
    "IR": "Tehran",
    "PK": "Karachi", "IN": "Karachi", "BD": "Karachi", "AF": "Karachi", "LK": "Karachi", "NP": "Karachi", "MV": "Karachi",
    "ID": "Indonesia", "MY": "JAKIM", "SG": "Singapore", "BN": "Singapore",
    "US": "NorthAmerica", "CA": "NorthAmerica", "MX": "NorthAmerica",
    "FR": "France", "RU": "Russia", "PT": "Portugal",
    "GB": "MoonsightingCommittee", "IE": "MoonsightingCommittee",
  ]

  /// الطريقة الافتراضية حسب المنطقة الزمنية (احتياط عند جهل الدولة)
  public static let tzMethod: [String: String] = [
    "Asia/Riyadh": "UmmAlQura", "Asia/Aden": "UmmAlQura",
    "Asia/Dubai": "Dubai", "Asia/Qatar": "Qatar", "Asia/Kuwait": "Kuwait", "Asia/Bahrain": "Gulf", "Asia/Muscat": "Gulf",
    "Asia/Amman": "Jordan", "Asia/Hebron": "Jordan", "Asia/Gaza": "Jordan",
    "Africa/Cairo": "Egyptian", "Africa/Khartoum": "Egyptian", "Africa/Tripoli": "Egyptian", "Asia/Beirut": "Egyptian",
    "Asia/Damascus": "Egyptian", "Asia/Baghdad": "Egyptian", "Africa/Juba": "Egyptian", "Africa/Asmara": "Egyptian",
    "Africa/Addis_Ababa": "Egyptian", "Africa/Mogadishu": "Egyptian", "Africa/Djibouti": "Egyptian", "Indian/Comoro": "Egyptian",
    "Africa/Tunis": "Tunisia", "Africa/Algiers": "Algeria", "Africa/Casablanca": "Morocco", "Africa/El_Aaiun": "Morocco", "Africa/Nouakchott": "Morocco",
    "Europe/Istanbul": "Turkey", "Asia/Nicosia": "Turkey", "Asia/Baku": "Turkey",
    "Asia/Tehran": "Tehran",
    "Asia/Karachi": "Karachi", "Asia/Kolkata": "Karachi", "Asia/Dhaka": "Karachi", "Asia/Kabul": "Karachi", "Asia/Colombo": "Karachi", "Asia/Kathmandu": "Karachi", "Indian/Maldives": "Karachi",
    "Asia/Jakarta": "Indonesia", "Asia/Makassar": "Indonesia", "Asia/Jayapura": "Indonesia", "Asia/Pontianak": "Indonesia",
    "Asia/Kuala_Lumpur": "JAKIM", "Asia/Kuching": "JAKIM", "Asia/Singapore": "Singapore", "Asia/Brunei": "Singapore",
    "Europe/Paris": "France", "Europe/Moscow": "Russia", "Europe/Lisbon": "Portugal",
    "Europe/London": "MoonsightingCommittee", "Europe/Dublin": "MoonsightingCommittee",
  ]

  /// اختيار الطريقة الافتراضية من الدولة ثم المنطقة الزمنية
  public static func defaultMethod(countryCode: String? = nil, tz: String? = nil) -> String {
    if let cc = countryCode?.uppercased(), let m = countryMethod[cc] { return m }
    if let tz, let m = tzMethod[tz] { return m }
    if let tz, tz.hasPrefix("America/") { return "NorthAmerica" }
    return "MuslimWorldLeague"
  }
  public static func method(_ id: String) -> CalculationMethod { all[id] ?? all["MuslimWorldLeague"]! }
}
