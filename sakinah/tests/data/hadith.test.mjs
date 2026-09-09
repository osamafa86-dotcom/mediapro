/**
 * تحقق آلي من بيانات الأحاديث مقابل نصوص الصحيحين المرجعية.
 * المرجع: fawazahmed0/hadith-api (ara-bukhari, ara-muslim) — ترقيم فتح الباري / عبد الباقي.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HADITHS, HADITH_TOPICS } from '../../js/data/hadith.js';
import { normalizeArabic, containsNormalized, firstMismatch } from '../helpers/arabic.mjs';

// مجلد النصوص المرجعية: متغير البيئة، ثم tests/fixtures/corpus (حمّله بـ node tools/fetch-corpus.mjs)
const CANDIDATES = [process.env.SAKINAH_REF_DIR, new URL('../fixtures/corpus/', import.meta.url).pathname].filter(Boolean);
const REF = CANDIDATES.find(d => fs.existsSync(`${d}/bukhari_ar.json`) && fs.existsSync(`${d}/muslim_ar.json`)) || CANDIDATES[CANDIDATES.length - 1];
const haveCorpus = fs.existsSync(`${REF}/bukhari_ar.json`) && fs.existsSync(`${REF}/muslim_ar.json`);

function loadCorpus(col) {
  const data = JSON.parse(fs.readFileSync(`${REF}/${col}_ar.json`, 'utf8'));
  const byNumber = new Map();
  for (const h of data.hadiths) {
    if (!h.text) continue;
    const key = col === 'bukhari' ? String(h.hadithnumber) : String(h.arabicnumber).split('.')[0];
    if (!byNumber.has(key)) byNumber.set(key, []);
    byNumber.get(key).push(h.text);
  }
  return byNumber;
}

test('بنية بيانات الأحاديث سليمة وفريدة', () => {
  assert.ok(HADITHS.length >= 50, `expected >= 50 hadiths, got ${HADITHS.length}`);
  const ids = new Set(), keys = new Set();
  for (const h of HADITHS) {
    assert.match(h.id, /^h\d{3}$/, `bad id ${h.id}`);
    assert.ok(!ids.has(h.id), `duplicate id ${h.id}`); ids.add(h.id);
    assert.ok(['bukhari', 'muslim'].includes(h.collection), `${h.id} bad collection`);
    assert.ok(Number.isInteger(h.number) && h.number > 0, `${h.id} bad number`);
    const key = `${h.collection}:${h.number}`;
    assert.ok(!keys.has(key), `duplicate hadith ${key}`); keys.add(key);
    assert.ok(['متفق عليه', 'رواه البخاري', 'رواه مسلم'].includes(h.grade), `${h.id} bad grade ${h.grade}`);
    if (h.grade === 'متفق عليه') assert.ok(h.alsoIn && h.alsoIn.collection !== h.collection, `${h.id} متفق عليه needs alsoIn`);
    if (h.alsoIn) assert.ok(Number.isInteger(h.alsoIn.number) && h.alsoIn.number > 0, `${h.id} bad alsoIn`);
    assert.ok(typeof h.narrator === 'string' && h.narrator.length >= 6, `${h.id} narrator`);
    assert.ok(typeof h.text === 'string' && h.text.length >= 20, `${h.id} text too short`);
    assert.ok(HADITH_TOPICS.includes(h.topic), `${h.id} unknown topic ${h.topic}`);
    assert.ok(typeof h.lesson === 'string' && h.lesson.length >= 30 && h.lesson.length <= 600, `${h.id} lesson length ${h.lesson?.length}`);
    assert.ok(!/حدثنا|أخبرنا|حَدَّثَنَا|أَخْبَرَنَا/.test(h.text), `${h.id} text still contains isnad`);
  }
});

test('نص كل حديث مطابق حرفيًا لمتن الصحيح المرجعي', { skip: !haveCorpus && 'reference corpus not available' }, () => {
  const corpora = { bukhari: loadCorpus('bukhari'), muslim: loadCorpus('muslim') };
  const failures = [];
  for (const h of HADITHS) {
    const texts = corpora[h.collection].get(String(h.number));
    if (!texts) { failures.push(`${h.id}: ${h.collection} ${h.number} not found in corpus`); continue; }
    const ok = texts.some(t => containsNormalized(t, h.text));
    if (!ok) {
      const best = texts.map(t => firstMismatch(t, h.text)).sort((a, b) => b - a)[0];
      failures.push(`${h.id}: text not verbatim in ${h.collection} ${h.number}; matched prefix ${best}/${normalizeArabic(h.text).length}: "${normalizeArabic(h.text).slice(Math.max(0, best - 30), best + 30)}"`);
    }
    if (h.alsoIn) {
      const other = corpora[h.alsoIn.collection].get(String(h.alsoIn.number));
      if (!other) failures.push(`${h.id}: alsoIn ${h.alsoIn.collection} ${h.alsoIn.number} not found in corpus`);
      else {
        // الرواية الأخرى قد تختلف ألفاظها (متفق عليه لا يعني تطابق النص)، فالمعيار: نسبة الكلمات المميِّزة للمتن (≥ 3 أحرف، بلا الكلمات الشائعة)
        // الموجودة في الرواية الأخرى ≥ 50%. قياسًا: كل الإحالات الصحيحة 0.56–1.0 (الوسيط 0.94)، ورقم عشوائي خاطئ 0.05 في المتوسط (0.3% فقط تتجاوز 0.5)
        const STOP = new Set(['قال', 'رسول', 'الله', 'ﷺ', 'عن', 'من', 'في', 'ان', 'لا', 'ما', 'الا', 'او', 'ثم', 'على', 'الي', 'عليه', 'له', 'لها', 'بن', 'ابي', 'ابن', 'يا', 'هذا', 'ذلك', 'كان', 'حتي', 'اذا', 'فان', 'ولا', 'وان', 'قد', 'كل', 'الذي', 'التي']);
        const words = normalizeArabic(h.text).split(' ');
        const probeStart = Math.max(0, words.indexOf('ﷺ') + 1);
        const distinctive = [...new Set(words.slice(probeStart).filter((w) => w.length >= 3 && !STOP.has(w)))];
        const otherText = other.map((t) => normalizeArabic(t)).join(' ');
        const hits = distinctive.filter((w) => otherText.includes(w)).length;
        const ratio = distinctive.length ? hits / distinctive.length : 0;
        if (ratio < 0.5) failures.push(`${h.id}: alsoIn ${h.alsoIn.collection} ${h.alsoIn.number} shares only ${(ratio * 100).toFixed(0)}% of distinctive words with the matn — likely a wrong number`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});
