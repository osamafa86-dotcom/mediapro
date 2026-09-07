// تحميل نصوص الصحيحين المرجعية (fawazahmed0/hadith-api عبر jsDelivr) إلى tests/fixtures/corpus/
// لتشغيل اختبار مطابقة الأحاديث حرفيًا: node tools/fetch-corpus.mjs && npm run test:data
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(new URL('../tests/fixtures/corpus', import.meta.url).pathname);
fs.mkdirSync(dir, { recursive: true });
for (const [name, url] of [
  ['bukhari_ar.json', 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari.min.json'],
  ['muslim_ar.json', 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-muslim.min.json'],
]) {
  const out = path.join(dir, name);
  if (fs.existsSync(out)) { console.log('exists', name); continue; }
  process.stdout.write(`downloading ${name} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log('ok', (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
}
