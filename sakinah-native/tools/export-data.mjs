// يصدّر بيانات المدن (المصدر الواحد: sakinah/js/data/cities.js) إلى JSON داخل النواة الأصلية
// التشغيل: node sakinah-native/tools/export-data.mjs (من جذر المستودع)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { CITIES, COUNTRIES } = await import(path.resolve(here, '../../sakinah/js/data/cities.js'));
const out = { v: 1, countries: COUNTRIES, cities: CITIES.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, countryAr: c.countryAr, countryCode: c.countryCode, lat: c.lat, lon: c.lon, tz: c.tz })) };
const res = path.resolve(here, '../Sources/SakinahCore/Resources');
const dest = path.join(res, 'cities.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`cities: ${out.cities.length} مدينة، ${out.countries.length} دولة → ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
// بيانات المصحف: وصف السور والأجزاء، وتخطيط الصفحات (خطوط QCF v1)، ونص تنزيل العثماني — الملفات نفسها في نسخة الويب
const meta = await import(path.resolve(here, '../../sakinah/js/data/quran-meta.js'));
fs.writeFileSync(path.join(res, 'quran-meta.json'), JSON.stringify({ surahs: meta.SURAHS, juzStarts: meta.JUZ_STARTS, totalAyahs: meta.TOTAL_AYAHS, totalPages: meta.TOTAL_PAGES, basmala: meta.BASMALA }));
for (const f of ['mushaf-layout.json', 'quran.json']) fs.copyFileSync(path.resolve(here, '../../sakinah/data', f), path.join(res, f));
console.log(`quran-meta: ${meta.SURAHS.length} سورة؛ mushaf-layout.json و quran.json نُسخا إلى ${path.relative(process.cwd(), res)}`);

// ---------- المرحلتان 3ب–5: التجويد، التفسير الميسّر، الأذكار وحصن المسلم، الأحاديث والأربعون النووية، والكتالوج (القرّاء، السمات، التحدّيات، المسبحة) ----------
const web = path.resolve(here, '../../sakinah');
fs.copyFileSync(path.join(web, 'data/tajweed.json'), path.join(res, 'tajweed.json'));
const tafDir = path.join(res, 'tafsir-muyassar'); fs.mkdirSync(tafDir, { recursive: true });
let tafBytes = 0; for (let s = 1; s <= 114; s++) { const src = path.join(web, 'data/tafsir/muyassar', `${s}.json`); fs.copyFileSync(src, path.join(tafDir, `${s}.json`)); tafBytes += fs.statSync(src).size; }
const { ADHKAR } = await import(path.join(web, 'js/data/adhkar.js'));
const { HISN_SECTIONS, HISN_CHAPTERS } = await import(path.join(web, 'js/data/hisn.js'));
const { NAWAWI } = await import(path.join(web, 'js/data/nawawi.js'));
const { HADITHS, HADITH_TOPICS } = await import(path.join(web, 'js/data/hadith.js'));
fs.writeFileSync(path.join(res, 'adhkar.json'), JSON.stringify({ v: 1, adhkar: ADHKAR }));
fs.writeFileSync(path.join(res, 'hisn.json'), JSON.stringify({ v: 1, sections: HISN_SECTIONS, chapters: HISN_CHAPTERS }));
fs.writeFileSync(path.join(res, 'hadith.json'), JSON.stringify({ v: 1, topics: HADITH_TOPICS, hadiths: HADITHS, nawawi: NAWAWI }));
const { RECITERS, DEFAULT_RECITER, QDC_BASE } = await import(path.join(web, 'js/platform/audio.js'));
const { MUSHAF_THEMES, THEME_GROUPS } = await import(path.join(web, 'js/core/mushaf-themes.js'));
const { CHALLENGES, MINUTES_PER_PAGE } = await import(path.join(web, 'js/core/challenges.js'));
const { TASBIH_PHRASES, TASBIH_TARGETS } = await import(path.join(web, 'js/core/tasbih.js'));
const { TAJWEED_LEGEND } = await import(path.join(web, 'js/core/tajweed.js'));
const { TAFSIR_SOURCES } = await import(path.join(web, 'js/core/tafsir.js'));
const catalog = {
  v: 1,
  reciters: RECITERS.map((r) => ({ id: r.id, name: r.name, bitrates: r.bitrates, qdc: r.qdc || null })), defaultReciter: DEFAULT_RECITER, qdcBase: QDC_BASE,
  themes: MUSHAF_THEMES, themeGroups: THEME_GROUPS.map(([id, name]) => ({ id, name })),
  // ألوان التجويد (الفاتحة والداكنة) ومجموعات الرموز كما في css/app.css
  tajweed: { legend: TAJWEED_LEGEND.map(([code, name, cssVar]) => ({ code, name, key: cssVar.replace('--tj-', '') })),
    groups: { madd6: ['m'], madd45: ['o'], madd246: ['p'], madd2: ['n'], ghunnah: ['g', 'f', 'c', 'i', 'a', 'w'], qalqala: ['q'], silent: ['h', 's', 'l'], idgham: ['u'], other: ['d', 'b'] },
    light: { madd6: '#b3001b', madd45: '#d32f2f', madd246: '#e65100', madd2: '#c98a00', ghunnah: '#2e7d32', qalqala: '#1565c0', silent: '#8a8a8a', idgham: '#5c6bc0', other: '#6a1b9a' },
    dark: { madd6: '#ff5c6c', madd45: '#ff7b7b', madd246: '#ffa14d', madd2: '#ffc94d', ghunnah: '#66d97a', qalqala: '#64b5f6', silent: '#8d8d8d', idgham: '#9fa8ff', other: '#ce93d8' } },
  challenges: CHALLENGES, minutesPerPage: MINUTES_PER_PAGE,
  tasbih: { phrases: TASBIH_PHRASES, targets: TASBIH_TARGETS },
  tafsirSources: TAFSIR_SOURCES,
};
fs.writeFileSync(path.join(res, 'catalog.json'), JSON.stringify(catalog));
console.log(`tajweed.json، التفسير الميسّر (${(tafBytes / 1024).toFixed(0)} KB)، adhkar ${ADHKAR.length}، hisn ${HISN_CHAPTERS.length} بابًا، hadith ${HADITHS.length} + nawawi ${NAWAWI.length}، catalog (${RECITERS.length} قارئًا، ${MUSHAF_THEMES.length} سمة) → Resources`);
