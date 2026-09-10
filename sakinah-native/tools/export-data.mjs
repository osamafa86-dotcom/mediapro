// يصدّر بيانات المدن (المصدر الواحد: sakinah/js/data/cities.js) إلى JSON داخل النواة الأصلية
// التشغيل: node sakinah-native/tools/export-data.mjs (من جذر المستودع)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { CITIES, COUNTRIES } = await import(path.resolve(here, '../../sakinah/js/data/cities.js'));
const out = { v: 1, countries: COUNTRIES, cities: CITIES.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, countryAr: c.countryAr, countryCode: c.countryCode, lat: c.lat, lon: c.lon, tz: c.tz })) };
const dest = path.resolve(here, '../Sources/SakinahCore/Resources/cities.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`cities: ${out.cities.length} مدينة، ${out.countries.length} دولة → ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
