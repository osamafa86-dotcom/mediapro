// تنزيل التفسير الميسر (مجمع الملك فهد) من واجهة quran.com v4 إلى data/tafsir/muyassar/{سورة}.json (مصفوفة بترتيب الآيات، HTML منظَّف)
// الاستخدام: node tools/build-tafsir.mjs [--cache DIR]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeTafsirHtml } from '../js/core/tafsir.js';
import { SURAHS } from '../js/data/quran-meta.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2); const i = args.indexOf('--cache');
const cacheDir = path.resolve(root, i >= 0 ? args[i + 1] : '.cache/tafsir-muyassar');
fs.mkdirSync(cacheDir, { recursive: true });
const outDir = path.join(root, 'data/tafsir/muyassar'); fs.mkdirSync(outDir, { recursive: true });

async function fetchChapter(c) {
  const f = path.join(cacheDir, `${c}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`https://api.quran.com/api/v4/tafsirs/16/by_chapter/${c}?per_page=300`, { headers: { accept: 'application/json', 'user-agent': 'sakinah-build/1.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.tafsirs || !json.tafsirs.length) throw new Error('empty');
      if (json.pagination && json.pagination.total_pages > 1) throw new Error('paginated');
      fs.writeFileSync(f, JSON.stringify(json)); return json;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 600 * 2 ** attempt)); }
  }
  throw new Error(`chapter ${c}: ${last.message}`);
}
let total = 0, bytes = 0;
for (const s of SURAHS) {
  const json = await fetchChapter(s.n);
  const arr = new Array(s.ayahs).fill('');
  for (const t of json.tafsirs) { const [, a] = t.verse_key.split(':').map(Number); if (a >= 1 && a <= s.ayahs) arr[a - 1] = sanitizeTafsirHtml(t.text); }
  // quran.com يخزّن تفسير مجموعة آيات متتالية تحت أول آية فيها ويترك البقية فارغة؛ نضع مرجعًا "@رقم" إلى بداية المجموعة
  let grouped = 0;
  for (let k = 1; k < arr.length; k++) if (!arr[k] && arr[k - 1]) { const start = arr[k - 1][0] === '@' ? +arr[k - 1].slice(1) : k; arr[k] = `@${start}`; grouped++; }
  const missing = arr.filter((x) => !x).length;
  if (missing) console.warn(`surah ${s.n}: ${missing} ayah(s) without tafsir`);
  if (grouped && s.n % 20 === 0) console.log(`  surah ${s.n}: ${grouped} grouped ayah(s)`);
  const out = JSON.stringify(arr); fs.writeFileSync(path.join(outDir, `${s.n}.json`), out);
  total += arr.length - missing; bytes += Buffer.byteLength(out);
  if (s.n % 20 === 0) process.stdout.write(`\r  ${s.n}/114`);
}
console.log(`\nwrote data/tafsir/muyassar/*.json — ${total} ayahs, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
