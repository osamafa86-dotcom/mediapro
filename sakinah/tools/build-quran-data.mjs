// توليد بيانات المصحف: data/quran.json (مضغوط) وjs/data/quran-meta.js من نسخة Tanzil (الرسم العثماني، حفص) عبر alquran.cloud
// الاستخدام: node tools/build-quran-data.mjs [path-to-quran-uthmani.json]   (يُحمَّل من api.alquran.cloud/v1/quran/quran-uthmani إن لم يُعطَ)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = process.argv[2];
let dump;
if (src && fs.existsSync(src)) dump = JSON.parse(fs.readFileSync(src, 'utf8'));
else { const r = await fetch('https://api.alquran.cloud/v1/quran/quran-uthmani'); if (!r.ok) throw new Error('download failed ' + r.status); dump = await r.json(); }
const d = dump.data;

const strip = (s) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]|[\uFEFF\u200E\u200F]/g, '').replace(/ٱ/g, 'ا').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const BASMALA = 'بسم الله الرحمن الرحيم';

const ayahs = []; const sajda = []; const surahs = []; const juzStarts = [];
for (const s of d.surahs) {
  let firstPage = null;
  s.ayahs.forEach((a, i) => {
    let text = a.text.replace(/﻿/g, '').trim();
    // البسملة مُلحقة بأول آية في كل سورة (عدا الفاتحة والتوبة): نفصلها عن نص الآية لعرضها ترويسةً
    if (i === 0 && s.number !== 1 && s.number !== 9) {
      const words = text.split(' ');
      if (strip(words.slice(0, 4).join(' ')) === BASMALA) text = words.slice(4).join(' ');
      else throw new Error(`no basmala prefix in surah ${s.number}`);
    }
    if (firstPage === null) firstPage = a.page;
    ayahs.push([s.number, a.numberInSurah, a.page, a.juz, a.hizbQuarter, text]);
    if (a.sajda) sajda.push(ayahs.length);
    if (!juzStarts[a.juz - 1]) juzStarts[a.juz - 1] = { juz: a.juz, surah: s.number, ayah: a.numberInSurah, page: a.page };
  });
  const vocalized = s.name.replace(/^سُورَةُ\s+/, '');
  // تركيب المدّة والهمزة المنفصلتين (ا + ٓ → آ) قبل حذف التشكيل حتى تبقى في اسم العرض
  const composed = vocalized.replace(/ا\u0653/g, 'آ').replace(/ا\u0654/g, 'أ').replace(/ا\u0655/g, 'إ').replace(/و\u0654/g, 'ؤ').replace(/ي\u0654/g, 'ئ');
  // «سبإ» و«النبإ» بالرسم العثماني تُكتب في العناوين «سبأ» و«النبأ»
  const display = composed.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/ٱ/g, 'ا').replace(/إ$/, 'أ');
  surahs.push({ n: s.number, name: display, vocalized, plain: strip(vocalized), en: s.englishName, ayahs: s.ayahs.length, type: s.revelationType === 'Meccan' ? 'مكية' : 'مدنية', page: firstPage });
}
if (ayahs.length !== 6236) throw new Error('ayah count ' + ayahs.length);

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/quran.json'), JSON.stringify({ v: 1, edition: 'quran-uthmani (Tanzil, حفص عن عاصم)', ayahs, sajda }));
const meta = `/**
 * بيانات المصحف الوصفية (مولّدة بـ tools/build-quran-data.mjs من نسخة Tanzil العثمانية، حفص عن عاصم).
 * SURAHS: رقم السورة، اسمها المشكول والمجرّد، عدد آياتها، مكية/مدنية، أول صفحة لها في مصحف المدينة (604 صفحات).
 */
export const SURAHS = ${JSON.stringify(surahs)};
export const JUZ_STARTS = ${JSON.stringify(juzStarts)};
export const TOTAL_AYAHS = 6236;
export const TOTAL_PAGES = 604;
export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
`;
fs.writeFileSync(path.join(root, 'js/data/quran-meta.js'), meta);
console.log('wrote data/quran.json', (fs.statSync(path.join(root, 'data/quran.json')).size / 1024).toFixed(0) + ' KB', '| surahs', surahs.length, '| sajda', sajda.length, '| juz', juzStarts.length);
