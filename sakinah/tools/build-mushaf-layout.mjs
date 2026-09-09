/**
 * توليد تخطيط صفحات مصحف المدينة النبوية (604 صفحات × 15 سطرًا) إلى data/mushaf-layout.json
 * المصدر: واجهة quran.com v4 (بيانات مجمع الملك فهد لطباعة المصحف الشريف: رموز خطوط QCF v1 لكل صفحة، ورقم السطر لكل كلمة).
 * لكل كلمة رمز (حرف واحد في منطقة الاستخدام الخاص) يُرسم بخط الصفحة p{n}.woff2 فتظهر الصفحة مطابقة تمامًا للمصحف المطبوع.
 *
 * الاستخدام: node tools/build-mushaf-layout.mjs [--cache DIR] [--from N] [--to N]
 *   --cache: مجلد لحفظ استجابات الواجهة الخام (افتراضي: .cache/qcf في جذر التطبيق) لتفادي إعادة التنزيل.
 *
 * صيغة الملف الناتج (مضغوطة):
 *   { v, font, source, pages: [ [line, ...] × 604 ], maps: { [ayahN]: [k...] } }
 *   line = [0, glyphs, runs]  سطر كلمات: glyphs رموزُ الكلمات مفصولةً بـ '|' (لكل كلمة رمز أو رمزان: الكلمة وعلامة الوقف/الحزب؛ وعلامة نهاية الآية كلمةٌ مستقلة)
 *                             runs = [[n, k0, cnt, e], ...] : n رقم الآية العام، k0 فهرس أول كلمة منطوقة من الآية في هذا المقطع،
 *                             cnt عدد الكلمات، e=1 إن كانت آخر كلمة في المقطع هي علامة نهاية الآية (رقمها).
 *        = [1, surah]         سطر ترويسة السورة
 *        = [2]                سطر البسملة
 *   maps: لآيات يختلف فيها تقسيم كلمات مجمع الملك فهد عن تقسيم نص Tanzil: لكل رمز كلمة فهرسُ الكلمة المنطوقة المقابلة (أو -1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setQuranData, getAyahBySurah, pageAyahs, tokenize, normalizeForMatch, similarity, TOTAL_PAGES } from '../js/core/quran.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const cacheDir = path.resolve(root, opt('--cache', '.cache/qcf'));
const from = +opt('--from', 1); const to = +opt('--to', TOTAL_PAGES);
fs.mkdirSync(cacheDir, { recursive: true });

setQuranData(JSON.parse(fs.readFileSync(path.join(root, 'data/quran.json'), 'utf8')));

const API = 'https://api.quran.com/api/v4/verses/by_page/';
const FIELDS = 'words=true&word_fields=code_v1,line_number,text_uthmani,char_type_name&per_page=50';

async function fetchPage(p) {
  const file = path.join(cacheDir, `p${p}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${API}${p}?${FIELDS}`, { headers: { accept: 'application/json', 'user-agent': 'sakinah-build/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.verses || !json.verses.length) throw new Error('empty page');
      if (json.pagination && json.pagination.total_pages > 1) throw new Error('paginated response (per_page too small)');
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); }
  }
  throw new Error(`page ${p}: ${lastErr.message}`);
}

/** محاذاة كلمات مجمع الملك فهد مع كلمات Tanzil المنطوقة (برمجة ديناميكية على التشابه)؛ تعيد خريطة i→k أو null إن تطابقت واحدًا لواحد */
function alignWords(qcfWords, tokens) {
  const A0 = qcfWords.map((w) => normalizeForMatch(w)); const B = tokens.map((t) => t.norm);
  if (A0.length === B.length && A0.every((a, i) => similarity(a, B[i]) >= 0.6)) return null;
  // كلمة المجمع قد تضم كلمتين بينهما مسافة (مثل «إِلْ يَاسِينَ»): نحاذي أجزاءها ثم نُسند الكلمة إلى أول جزء مطابق
  const owner = []; const A = [];
  A0.forEach((a, i) => { for (const part of a.split(' ').filter(Boolean)) { A.push(part); owner.push(i); } });
  const sub = alignSeq(A, B); const map = new Array(A0.length).fill(-1);
  sub.forEach((k, j) => { if (k >= 0 && map[owner[j]] < 0) map[owner[j]] = k; });
  return map;
}
function alignSeq(A, B) {
  // مصفوفة تكلفة: مطابقة (1-sim) أو حذف/إدراج بتكلفة 1
  const n = A.length, m = B.length; const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) D[i][0] = i; for (let j = 1; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (1 - similarity(A[i - 1], B[j - 1])), D[i - 1][j] + 1, D[i][j - 1] + 1);
  const map = new Array(n).fill(-1); let i = n, j = m;
  while (i > 0 && j > 0) {
    const sub = D[i - 1][j - 1] + (1 - similarity(A[i - 1], B[j - 1]));
    if (Math.abs(D[i][j] - sub) < 1e-9 && similarity(A[i - 1], B[j - 1]) >= 0.4) { map[i - 1] = j - 1; i--; j--; }
    else if (Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) i--; else j--;
  }
  return map;
}

const pages = []; const maps = {}; const report = { mismatched: [], lineCounts: {}, orphanHeaders: [] };
const queue = []; for (let p = from; p <= to; p++) queue.push(p);
const raw = new Map();
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) { const p = queue.shift(); raw.set(p, await fetchPage(p)); if (raw.size % 50 === 0) process.stdout.write(`\r  fetched ${raw.size}`); } }));
process.stdout.write('\n');

// المرحلة الأولى: كلمات كل سطر في كل صفحة، وبدايات السور
const pageWords = new Map(); // p -> { byLine: Map(line -> items), starts: [{surah, firstLine}], totalLines }
for (let p = from; p <= to; p++) {
  const json = raw.get(p);
  const expected = pageAyahs(p);
  const verses = json.verses.slice().sort((a, b) => a.id - b.id);
  if (verses.length !== expected.length || verses.some((v, i) => v.verse_key !== `${expected[i].surah}:${expected[i].ayah}`)) throw new Error(`page ${p}: ayah list differs from data/quran.json`);
  const byLine = new Map(); const starts = [];
  const totalLines = p <= 2 ? 8 : 15;
  for (const v of verses) {
    const [surah] = v.verse_key.split(':').map(Number); const a = getAyahBySurah(surah, v.verse_number); if (!a) throw new Error(`page ${p}: unknown verse ${v.verse_key}`);
    const words = v.words.slice().sort((x, y) => x.position - y.position);
    const qcf = words.filter((w) => w.char_type_name === 'word');
    const ends = words.filter((w) => w.char_type_name === 'end');
    const other = words.filter((w) => w.char_type_name !== 'word' && w.char_type_name !== 'end');
    if (other.length) throw new Error(`page ${p} ${v.verse_key}: unexpected char types ${other.map((w) => w.char_type_name).join(',')}`);
    if (ends.length !== 1 || words[words.length - 1].char_type_name !== 'end') throw new Error(`page ${p} ${v.verse_key}: expected one trailing end marker`);
    // البسملة سطر مستقل في بيانات المجمع (عدا الفاتحة حيث هي الآية الأولى)؛ ونص Tanzil لدينا يفصلها أيضًا عن الآية الأولى
    const tokens = tokenize(a.text).filter((t) => t.spoken);
    const map = alignWords(qcf.map((w) => w.text_uthmani), tokens);
    if (map) { maps[a.n] = map; report.mismatched.push({ n: a.n, key: v.verse_key, qcf: qcf.map((w) => w.text_uthmani), tanzil: tokens.map((t) => t.raw), map }); }
    let wi = 0;
    for (const w of words) {
      if (typeof w.line_number !== 'number' || w.line_number < 1 || w.line_number > totalLines) throw new Error(`page ${p} ${v.verse_key}: bad line_number ${w.line_number}`);
      // رموز خطوط QCF v1 تقع في نطاق U+FB50–U+FDFF (وقد تحوي مسافة بين رمز الكلمة ورمز علامة الوقف)
      if (!w.code_v1 || !/^[ﭐ-﷿](?: ?[ﭐ-﷿]){0,3}$/.test(w.code_v1)) throw new Error(`page ${p} ${v.verse_key}: unexpected glyph string ${JSON.stringify(w.code_v1)}`);
      if (!byLine.has(w.line_number)) byLine.set(w.line_number, []);
      const k = w.char_type_name === 'word' ? (map ? map[wi] : wi) : null;
      byLine.get(w.line_number).push({ glyph: w.code_v1, n: a.n, end: w.char_type_name === 'end', k });
      if (w.char_type_name === 'word') wi++;
    }
    if (v.verse_number === 1) starts.push({ surah, firstLine: Math.min(...words.map((w) => w.line_number)) });
  }
  pageWords.set(p, { byLine, starts, totalLines, special: new Map() });
}

// المرحلة الثانية: مواضع ترويسات السور وأسطر البسملة.
// القاعدة في مصحف المدينة: الترويسة ثم البسملة فوق أول كلمات السورة مباشرة؛ وإن لم يتسع لهما أعلى الصفحة (أول الكلمات في السطر 2)
// وُضعت الترويسة في آخر سطر من الصفحة السابقة والبسملة في السطر الأول (كما في النساء ص76/77 ويونس ص207/208 وغيرها).
const claim = (p, line, entry, why) => {
  const pg = pageWords.get(p); if (!pg) throw new Error(`page ${p} not loaded (${why})`);
  if (line < 1 || line > pg.totalLines || pg.byLine.has(line) || pg.special.has(line)) throw new Error(`page ${p}: cannot place ${why} at line ${line}`);
  pg.special.set(line, entry);
};
for (let p = from; p <= to; p++) {
  const pg = pageWords.get(p);
  for (const { surah, firstLine } of pg.starts) {
    const hasBasmala = surah !== 1 && surah !== 9;
    if (!hasBasmala) { claim(p, firstLine - 1, [1, surah], `header of surah ${surah}`); continue; }
    if (firstLine >= 3) { claim(p, firstLine - 2, [1, surah], `header of surah ${surah}`); claim(p, firstLine - 1, [2], `basmala of surah ${surah}`); }
    else if (firstLine === 2) { claim(p, 1, [2], `basmala of surah ${surah}`); claim(p - 1, pageWords.get(p - 1).totalLines, [1, surah], `header of surah ${surah}`); report.orphanHeaders.push({ surah, page: p - 1 }); }
    else throw new Error(`page ${p}: surah ${surah} starts on line 1 without room for its header`);
  }
}

// المرحلة الثالثة: بناء الأسطر
for (let p = from; p <= to; p++) {
  const pg = pageWords.get(p); const lines = [];
  for (let L = 1; L <= pg.totalLines; L++) {
    if (pg.special.has(L)) { lines.push(pg.special.get(L)); continue; }
    const items = pg.byLine.get(L);
    if (!items) throw new Error(`page ${p}: line ${L} is empty`);
    const runs = []; const glyphs = [];
    for (const it of items) {
      glyphs.push(it.glyph);
      const last = runs[runs.length - 1];
      if (last && last[0] === it.n) { last[2]++; if (it.end) last[3] = 1; }
      else runs.push([it.n, 0, 1, it.end ? 1 : 0]);
    }
    // k0 للمقطع: فهرس أول كلمة منطوقة فيه (إن كان المقطع علامة نهاية فقط فهو صفر ولا أثر له)
    for (const r of runs) { const first = items.find((it) => it.n === r[0] && !it.end && it.k !== null && it.k >= 0); if (first) r[1] = first.k; }
    lines.push([0, glyphs.join('|'), runs]);
  }
  report.lineCounts[pg.totalLines] = (report.lineCounts[pg.totalLines] || 0) + 1;
  pages[p - 1] = lines;
}

if (from === 1 && to === TOTAL_PAGES) {
  const out = { v: 1, font: 'qcf-v1', source: 'quran.com API v4 — King Fahd Glorious Quran Printing Complex (Madinah Mushaf, Hafs)', pages, maps };
  fs.writeFileSync(path.join(root, 'data/mushaf-layout.json'), JSON.stringify(out));
  console.log('wrote data/mushaf-layout.json', (fs.statSync(path.join(root, 'data/mushaf-layout.json')).size / 1024).toFixed(0) + ' KB');
}
fs.writeFileSync(path.join(cacheDir, 'report.json'), JSON.stringify(report, null, 1));
console.log('pages', pages.filter(Boolean).length, '| line counts', JSON.stringify(report.lineCounts), '| headers placed at the foot of the previous page', report.orphanHeaders.length, '| ayahs with word-split overrides', report.mismatched.length);
for (const m of report.mismatched.slice(0, 40)) console.log(' ', m.key, 'qcf:', m.qcf.join(' '), '| tanzil:', m.tanzil.join(' '), '| map', JSON.stringify(m.map));
