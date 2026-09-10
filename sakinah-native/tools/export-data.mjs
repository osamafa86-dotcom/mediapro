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
