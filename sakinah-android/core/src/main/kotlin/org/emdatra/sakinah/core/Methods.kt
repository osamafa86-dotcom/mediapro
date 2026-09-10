package org.emdatra.sakinah.core

enum class Rounding(val id: String) { NEAREST("nearest"), UP("up"), NONE("none"); companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } } }
enum class Prayer(val id: String, val nameAr: String) {
  FAJR("fajr", "الفجر"), SUNRISE("sunrise", "الشروق"), DHUHR("dhuhr", "الظهر"), ASR("asr", "العصر"), MAGHRIB("maghrib", "المغرب"), ISHA("isha", "العشاء");
  companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } }
}
data class PrayerAdjustments(val fajr: Double = 0.0, val sunrise: Double = 0.0, val dhuhr: Double = 0.0, val asr: Double = 0.0, val maghrib: Double = 0.0, val isha: Double = 0.0) {
  operator fun get(p: Prayer) = when (p) { Prayer.FAJR -> fajr; Prayer.SUNRISE -> sunrise; Prayer.DHUHR -> dhuhr; Prayer.ASR -> asr; Prayer.MAGHRIB -> maghrib; Prayer.ISHA -> isha }
  companion object { val ZERO = PrayerAdjustments() }
}
/** طريقة حساب مواقيت الصلاة — مطابقة لـ methods.js */
data class CalculationMethod(val id: String, val nameAr: String, val nameEn: String, val fajrAngle: Double, val ishaAngle: Double, val ishaInterval: Double = 0.0, val ishaIntervalRamadan: Double? = null,
  val maghribAngle: Double = 0.0, val maghribInterval: Double = 0.0, val adjustments: PrayerAdjustments = PrayerAdjustments.ZERO, val rounding: Rounding = Rounding.NEAREST, val aladhanId: Int? = null, val region: String? = null, val seasonal: Boolean = false)

object Methods {
  private fun m(id: String, nameAr: String, nameEn: String, fajr: Double, isha: Double, ishaInterval: Double = 0.0, ishaIntervalRamadan: Double? = null, maghribAngle: Double = 0.0, maghribInterval: Double = 0.0,
                adjustments: PrayerAdjustments = PrayerAdjustments.ZERO, rounding: Rounding = Rounding.NEAREST, aladhanId: Int? = null, region: String? = null, seasonal: Boolean = false) =
    CalculationMethod(id, nameAr, nameEn, fajr, isha, ishaInterval, ishaIntervalRamadan, maghribAngle, maghribInterval, adjustments, rounding, aladhanId, region, seasonal)
  val all: Map<String, CalculationMethod> = listOf(
    m("UmmAlQura", "جامعة أم القرى (السعودية)", "Umm al-Qura University, Makkah", 18.5, 0.0, ishaInterval = 90.0, ishaIntervalRamadan = 120.0, aladhanId = 4, region = "SA"),
    m("MuslimWorldLeague", "رابطة العالم الإسلامي", "Muslim World League", 18.0, 17.0, adjustments = PrayerAdjustments(dhuhr = 1.0), aladhanId = 3),
    m("Egyptian", "الهيئة المصرية العامة للمساحة", "Egyptian General Authority of Survey", 19.5, 17.5, adjustments = PrayerAdjustments(dhuhr = 1.0), aladhanId = 5, region = "EG"),
    m("Karachi", "جامعة العلوم الإسلامية (كراتشي)", "University of Islamic Sciences, Karachi", 18.0, 18.0, adjustments = PrayerAdjustments(dhuhr = 1.0), aladhanId = 1, region = "PK"),
    m("NorthAmerica", "الجمعية الإسلامية لأمريكا الشمالية (ISNA)", "Islamic Society of North America", 15.0, 15.0, adjustments = PrayerAdjustments(dhuhr = 1.0), aladhanId = 2, region = "US"),
    m("Dubai", "دبي (الإمارات)", "Dubai", 18.2, 18.2, adjustments = PrayerAdjustments(sunrise = -3.0, dhuhr = 3.0, asr = 3.0, maghrib = 3.0), aladhanId = 16, region = "AE"),
    m("Gulf", "منطقة الخليج", "Gulf Region", 19.5, 0.0, ishaInterval = 90.0, aladhanId = 8),
    m("Kuwait", "الكويت", "Kuwait", 18.0, 17.5, aladhanId = 9, region = "KW"),
    m("Qatar", "قطر", "Qatar", 18.0, 0.0, ishaInterval = 90.0, aladhanId = 10, region = "QA"),
    m("Jordan", "وزارة الأوقاف الأردنية", "Ministry of Awqaf, Jordan", 18.0, 18.0, maghribInterval = 5.0, aladhanId = 23, region = "JO"),
    m("Turkey", "رئاسة الشؤون الدينية (تركيا)", "Diyanet İşleri Başkanlığı", 18.0, 17.0, adjustments = PrayerAdjustments(sunrise = -7.0, dhuhr = 5.0, asr = 4.0, maghrib = 7.0), aladhanId = 13, region = "TR"),
    m("Tehran", "معهد الجيوفيزياء – جامعة طهران", "Institute of Geophysics, University of Tehran", 17.7, 14.0, maghribAngle = 4.5, aladhanId = 7, region = "IR"),
    m("Jafari", "الطريقة الجعفرية (قم)", "Shia Ithna-Ashari, Leva Institute, Qum", 16.0, 14.0, maghribAngle = 4.0, aladhanId = 0),
    m("Singapore", "المجلس الإسلامي بسنغافورة (MUIS)", "Majlis Ugama Islam Singapura", 20.0, 18.0, adjustments = PrayerAdjustments(dhuhr = 1.0), rounding = Rounding.UP, aladhanId = 11, region = "SG"),
    m("JAKIM", "دائرة التقدم الإسلامي الماليزية (JAKIM)", "Jabatan Kemajuan Islam Malaysia", 20.0, 18.0, aladhanId = 17, region = "MY"),
    m("Indonesia", "وزارة الشؤون الدينية الإندونيسية", "Kementerian Agama Republik Indonesia", 20.0, 18.0, aladhanId = 20, region = "ID"),
    m("MoonsightingCommittee", "لجنة رؤية الهلال العالمية", "Moonsighting Committee Worldwide", 18.0, 18.0, adjustments = PrayerAdjustments(dhuhr = 5.0, maghrib = 3.0), aladhanId = 15, seasonal = true),
    m("France", "اتحاد المنظمات الإسلامية في فرنسا", "Union des Organisations Islamiques de France", 12.0, 12.0, aladhanId = 12, region = "FR"),
    m("Russia", "الإدارة الدينية لمسلمي روسيا", "Spiritual Administration of Muslims of Russia", 16.0, 15.0, aladhanId = 14, region = "RU"),
    m("Tunisia", "تونس", "Tunisia", 18.0, 18.0, aladhanId = 18, region = "TN"),
    m("Algeria", "وزارة الشؤون الدينية الجزائرية", "Algeria", 18.0, 17.0, aladhanId = 19, region = "DZ"),
    m("Morocco", "وزارة الأوقاف المغربية", "Morocco", 19.0, 17.0, aladhanId = 21, region = "MA"),
    m("Portugal", "الجالية الإسلامية في لشبونة", "Comunidade Islâmica de Lisboa", 18.0, 0.0, ishaInterval = 77.0, maghribInterval = 3.0, aladhanId = 22, region = "PT"),
    m("Custom", "مخصّص", "Custom", 18.0, 17.0),
  ).associateBy { it.id }
  val order = listOf("UmmAlQura", "MuslimWorldLeague", "Egyptian", "Jordan", "Kuwait", "Qatar", "Dubai", "Gulf", "Karachi", "NorthAmerica", "Turkey", "Tunisia", "Algeria", "Morocco", "Singapore", "JAKIM", "Indonesia", "MoonsightingCommittee", "Tehran", "Jafari", "France", "Russia", "Portugal", "Custom")
  val countryMethod = mapOf("SA" to "UmmAlQura", "YE" to "UmmAlQura", "AE" to "Dubai", "QA" to "Qatar", "KW" to "Kuwait", "BH" to "Gulf", "OM" to "Gulf", "JO" to "Jordan", "PS" to "Jordan",
    "EG" to "Egyptian", "SD" to "Egyptian", "LY" to "Egyptian", "LB" to "Egyptian", "SY" to "Egyptian", "IQ" to "Egyptian", "SS" to "Egyptian", "ER" to "Egyptian", "ET" to "Egyptian", "SO" to "Egyptian", "DJ" to "Egyptian", "KM" to "Egyptian",
    "TN" to "Tunisia", "DZ" to "Algeria", "MA" to "Morocco", "MR" to "Morocco", "EH" to "Morocco", "TR" to "Turkey", "CY" to "Turkey", "AZ" to "Turkey", "IR" to "Tehran",
    "PK" to "Karachi", "IN" to "Karachi", "BD" to "Karachi", "AF" to "Karachi", "LK" to "Karachi", "NP" to "Karachi", "MV" to "Karachi", "ID" to "Indonesia", "MY" to "JAKIM", "SG" to "Singapore", "BN" to "Singapore",
    "US" to "NorthAmerica", "CA" to "NorthAmerica", "MX" to "NorthAmerica", "FR" to "France", "RU" to "Russia", "PT" to "Portugal", "GB" to "MoonsightingCommittee", "IE" to "MoonsightingCommittee")
  val tzMethod = mapOf("Asia/Riyadh" to "UmmAlQura", "Asia/Aden" to "UmmAlQura", "Asia/Dubai" to "Dubai", "Asia/Qatar" to "Qatar", "Asia/Kuwait" to "Kuwait", "Asia/Bahrain" to "Gulf", "Asia/Muscat" to "Gulf",
    "Asia/Amman" to "Jordan", "Asia/Hebron" to "Jordan", "Asia/Gaza" to "Jordan", "Africa/Cairo" to "Egyptian", "Africa/Khartoum" to "Egyptian", "Africa/Tripoli" to "Egyptian", "Asia/Beirut" to "Egyptian",
    "Asia/Damascus" to "Egyptian", "Asia/Baghdad" to "Egyptian", "Africa/Juba" to "Egyptian", "Africa/Asmara" to "Egyptian", "Africa/Addis_Ababa" to "Egyptian", "Africa/Mogadishu" to "Egyptian", "Africa/Djibouti" to "Egyptian", "Indian/Comoro" to "Egyptian",
    "Africa/Tunis" to "Tunisia", "Africa/Algiers" to "Algeria", "Africa/Casablanca" to "Morocco", "Africa/El_Aaiun" to "Morocco", "Africa/Nouakchott" to "Morocco", "Europe/Istanbul" to "Turkey", "Asia/Nicosia" to "Turkey", "Asia/Baku" to "Turkey", "Asia/Tehran" to "Tehran",
    "Asia/Karachi" to "Karachi", "Asia/Kolkata" to "Karachi", "Asia/Dhaka" to "Karachi", "Asia/Kabul" to "Karachi", "Asia/Colombo" to "Karachi", "Asia/Kathmandu" to "Karachi", "Indian/Maldives" to "Karachi",
    "Asia/Jakarta" to "Indonesia", "Asia/Makassar" to "Indonesia", "Asia/Jayapura" to "Indonesia", "Asia/Pontianak" to "Indonesia", "Asia/Kuala_Lumpur" to "JAKIM", "Asia/Kuching" to "JAKIM", "Asia/Singapore" to "Singapore", "Asia/Brunei" to "Singapore",
    "Europe/Paris" to "France", "Europe/Moscow" to "Russia", "Europe/Lisbon" to "Portugal", "Europe/London" to "MoonsightingCommittee", "Europe/Dublin" to "MoonsightingCommittee")
  fun defaultMethod(countryCode: String? = null, tz: String? = null): String {
    countryCode?.uppercase()?.let { countryMethod[it] }?.let { return it }
    if (tz != null) { tzMethod[tz]?.let { return it }; if (tz.startsWith("America/")) return "NorthAmerica" }
    return "MuslimWorldLeague"
  }
  fun method(id: String) = all[id] ?: all.getValue("MuslimWorldLeague")
}
