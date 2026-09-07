/**
 * طرق حساب مواقيت الصلاة المعتمدة عالميًا، مع الطريقة الافتراضية لكل دولة/منطقة زمنية.
 * المراجع: زوايا الهيئات الرسمية كما توثّقها PrayTimes.org وAlAdhan (api.aladhan.com/v1/methods)
 * وadhan-js (Batoul Apps) لتعديلات الدقائق الخاصة ببعض الطرق (تركيا، دبي، لجنة رؤية الهلال).
 *
 * fajrAngle / ishaAngle : زاوية انخفاض الشمس تحت الأفق (درجات)
 * ishaInterval          : دقائق بعد المغرب بدل الزاوية (أم القرى، قطر، الخليج، لشبونة)
 * ishaIntervalRamadan   : بديل رمضاني (أم القرى: 120 دقيقة)
 * maghribAngle          : زاوية للمغرب بدل الغروب (الطرق الجعفرية)
 * adjustments           : تعديلات بالدقائق تفرضها الهيئة نفسها
 */

const ZERO = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
const m = (id, nameAr, nameEn, fajrAngle, ishaAngle, extra = {}) => ({
  id, nameAr, nameEn, fajrAngle, ishaAngle,
  ishaInterval: 0, maghribAngle: 0, maghribInterval: 0,
  rounding: 'nearest',
  ...extra,
  adjustments: { ...ZERO, ...(extra.adjustments || {}) },
});

export const METHODS = {
  UmmAlQura: m('UmmAlQura', 'جامعة أم القرى (السعودية)', 'Umm al-Qura University, Makkah', 18.5, 0,
    { ishaInterval: 90, ishaIntervalRamadan: 120, aladhanId: 4, region: 'SA' }),
  MuslimWorldLeague: m('MuslimWorldLeague', 'رابطة العالم الإسلامي', 'Muslim World League', 18, 17,
    { adjustments: { dhuhr: 1 }, aladhanId: 3 }),
  Egyptian: m('Egyptian', 'الهيئة المصرية العامة للمساحة', 'Egyptian General Authority of Survey', 19.5, 17.5,
    { adjustments: { dhuhr: 1 }, aladhanId: 5, region: 'EG' }),
  Karachi: m('Karachi', 'جامعة العلوم الإسلامية (كراتشي)', 'University of Islamic Sciences, Karachi', 18, 18,
    { adjustments: { dhuhr: 1 }, aladhanId: 1, region: 'PK' }),
  NorthAmerica: m('NorthAmerica', 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)', 'Islamic Society of North America', 15, 15,
    { adjustments: { dhuhr: 1 }, aladhanId: 2, region: 'US' }),
  Dubai: m('Dubai', 'دبي (الإمارات)', 'Dubai', 18.2, 18.2,
    { adjustments: { sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3 }, aladhanId: 16, region: 'AE' }),
  Gulf: m('Gulf', 'منطقة الخليج', 'Gulf Region', 19.5, 0, { ishaInterval: 90, aladhanId: 8 }),
  Kuwait: m('Kuwait', 'الكويت', 'Kuwait', 18, 17.5, { aladhanId: 9, region: 'KW' }),
  Qatar: m('Qatar', 'قطر', 'Qatar', 18, 0, { ishaInterval: 90, aladhanId: 10, region: 'QA' }),
  Jordan: m('Jordan', 'وزارة الأوقاف الأردنية', 'Ministry of Awqaf, Jordan', 18, 18,
    { maghribInterval: 5, aladhanId: 23, region: 'JO' }),
  Turkey: m('Turkey', 'رئاسة الشؤون الدينية (تركيا)', 'Diyanet İşleri Başkanlığı', 18, 17,
    { adjustments: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 }, aladhanId: 13, region: 'TR' }),
  Tehran: m('Tehran', 'معهد الجيوفيزياء – جامعة طهران', 'Institute of Geophysics, University of Tehran', 17.7, 14,
    { maghribAngle: 4.5, aladhanId: 7, region: 'IR' }),
  Jafari: m('Jafari', 'الطريقة الجعفرية (قم)', 'Shia Ithna-Ashari, Leva Institute, Qum', 16, 14,
    { maghribAngle: 4, aladhanId: 0 }),
  Singapore: m('Singapore', 'المجلس الإسلامي بسنغافورة (MUIS)', 'Majlis Ugama Islam Singapura', 20, 18,
    { adjustments: { dhuhr: 1 }, rounding: 'up', aladhanId: 11, region: 'SG' }),
  JAKIM: m('JAKIM', 'دائرة التقدم الإسلامي الماليزية (JAKIM)', 'Jabatan Kemajuan Islam Malaysia', 20, 18, { aladhanId: 17, region: 'MY' }),
  Indonesia: m('Indonesia', 'وزارة الشؤون الدينية الإندونيسية', 'Kementerian Agama Republik Indonesia', 20, 18, { aladhanId: 20, region: 'ID' }),
  MoonsightingCommittee: m('MoonsightingCommittee', 'لجنة رؤية الهلال العالمية', 'Moonsighting Committee Worldwide', 18, 18,
    { adjustments: { dhuhr: 5, maghrib: 3 }, aladhanId: 15, seasonal: true }),
  France: m('France', 'اتحاد المنظمات الإسلامية في فرنسا', 'Union des Organisations Islamiques de France', 12, 12, { aladhanId: 12, region: 'FR' }),
  Russia: m('Russia', 'الإدارة الدينية لمسلمي روسيا', 'Spiritual Administration of Muslims of Russia', 16, 15, { aladhanId: 14, region: 'RU' }),
  Tunisia: m('Tunisia', 'تونس', 'Tunisia', 18, 18, { aladhanId: 18, region: 'TN' }),
  Algeria: m('Algeria', 'وزارة الشؤون الدينية الجزائرية', 'Algeria', 18, 17, { aladhanId: 19, region: 'DZ' }),
  Morocco: m('Morocco', 'وزارة الأوقاف المغربية', 'Morocco', 19, 17, { aladhanId: 21, region: 'MA' }),
  Portugal: m('Portugal', 'الجالية الإسلامية في لشبونة', 'Comunidade Islâmica de Lisboa', 18, 0,
    { ishaInterval: 77, maghribInterval: 3, aladhanId: 22, region: 'PT' }),
  Custom: m('Custom', 'مخصّص', 'Custom', 18, 17, {}),
};

/** ترتيب العرض في الإعدادات */
export const METHOD_ORDER = [
  'UmmAlQura', 'MuslimWorldLeague', 'Egyptian', 'Jordan', 'Kuwait', 'Qatar', 'Dubai', 'Gulf',
  'Karachi', 'NorthAmerica', 'Turkey', 'Tunisia', 'Algeria', 'Morocco', 'Singapore', 'JAKIM', 'Indonesia',
  'MoonsightingCommittee', 'Tehran', 'Jafari', 'France', 'Russia', 'Portugal', 'Custom',
];

/** الطريقة الافتراضية حسب الدولة (ISO 3166-1 alpha-2) */
export const COUNTRY_METHOD = {
  SA: 'UmmAlQura', YE: 'UmmAlQura',
  AE: 'Dubai', QA: 'Qatar', KW: 'Kuwait', BH: 'Gulf', OM: 'Gulf',
  JO: 'Jordan', PS: 'Jordan',
  EG: 'Egyptian', SD: 'Egyptian', LY: 'Egyptian', LB: 'Egyptian', SY: 'Egyptian', IQ: 'Egyptian',
  SS: 'Egyptian', ER: 'Egyptian', ET: 'Egyptian', SO: 'Egyptian', DJ: 'Egyptian', KM: 'Egyptian',
  TN: 'Tunisia', DZ: 'Algeria', MA: 'Morocco', MR: 'Morocco', EH: 'Morocco',
  TR: 'Turkey', CY: 'Turkey', AZ: 'Turkey',
  IR: 'Tehran',
  PK: 'Karachi', IN: 'Karachi', BD: 'Karachi', AF: 'Karachi', LK: 'Karachi', NP: 'Karachi', MV: 'Karachi',
  ID: 'Indonesia', MY: 'JAKIM', SG: 'Singapore', BN: 'Singapore',
  US: 'NorthAmerica', CA: 'NorthAmerica', MX: 'NorthAmerica',
  FR: 'France', RU: 'Russia', PT: 'Portugal',
  GB: 'MoonsightingCommittee', IE: 'MoonsightingCommittee',
};

/** الطريقة الافتراضية حسب المنطقة الزمنية (احتياط عند جهل الدولة) */
export const TZ_METHOD = {
  'Asia/Riyadh': 'UmmAlQura', 'Asia/Aden': 'UmmAlQura',
  'Asia/Dubai': 'Dubai', 'Asia/Qatar': 'Qatar', 'Asia/Kuwait': 'Kuwait', 'Asia/Bahrain': 'Gulf', 'Asia/Muscat': 'Gulf',
  'Asia/Amman': 'Jordan', 'Asia/Hebron': 'Jordan', 'Asia/Gaza': 'Jordan',
  'Africa/Cairo': 'Egyptian', 'Africa/Khartoum': 'Egyptian', 'Africa/Tripoli': 'Egyptian', 'Asia/Beirut': 'Egyptian',
  'Asia/Damascus': 'Egyptian', 'Asia/Baghdad': 'Egyptian', 'Africa/Juba': 'Egyptian', 'Africa/Asmara': 'Egyptian',
  'Africa/Addis_Ababa': 'Egyptian', 'Africa/Mogadishu': 'Egyptian', 'Africa/Djibouti': 'Egyptian', 'Indian/Comoro': 'Egyptian',
  'Africa/Tunis': 'Tunisia', 'Africa/Algiers': 'Algeria', 'Africa/Casablanca': 'Morocco', 'Africa/El_Aaiun': 'Morocco', 'Africa/Nouakchott': 'Morocco',
  'Europe/Istanbul': 'Turkey', 'Asia/Nicosia': 'Turkey', 'Asia/Baku': 'Turkey',
  'Asia/Tehran': 'Tehran',
  'Asia/Karachi': 'Karachi', 'Asia/Kolkata': 'Karachi', 'Asia/Dhaka': 'Karachi', 'Asia/Kabul': 'Karachi', 'Asia/Colombo': 'Karachi', 'Asia/Kathmandu': 'Karachi', 'Indian/Maldives': 'Karachi',
  'Asia/Jakarta': 'Indonesia', 'Asia/Makassar': 'Indonesia', 'Asia/Jayapura': 'Indonesia', 'Asia/Pontianak': 'Indonesia',
  'Asia/Kuala_Lumpur': 'JAKIM', 'Asia/Kuching': 'JAKIM', 'Asia/Singapore': 'Singapore', 'Asia/Brunei': 'Singapore',
  'Europe/Paris': 'France', 'Europe/Moscow': 'Russia', 'Europe/Lisbon': 'Portugal',
  'Europe/London': 'MoonsightingCommittee', 'Europe/Dublin': 'MoonsightingCommittee',
};

/**
 * اختيار الطريقة الافتراضية.
 * @param {{countryCode?:string, tz?:string}} ctx
 * @returns {string} معرّف الطريقة
 */
export function defaultMethodFor({ countryCode, tz } = {}) {
  if (countryCode && COUNTRY_METHOD[countryCode.toUpperCase()]) return COUNTRY_METHOD[countryCode.toUpperCase()];
  if (tz && TZ_METHOD[tz]) return TZ_METHOD[tz];
  if (tz && /^America\//.test(tz)) return 'NorthAmerica';
  return 'MuslimWorldLeague';
}

export function getMethod(id) {
  return METHODS[id] || METHODS.MuslimWorldLeague;
}
