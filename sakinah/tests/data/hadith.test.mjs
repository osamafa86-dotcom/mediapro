/**
 * تحقق آلي من بيانات الأحاديث مقابل نصوص الصحيحين المرجعية.
 * المرجع: fawazahmed0/hadith-api (ara-bukhari, ara-muslim) — ترقيم فتح الباري / عبد الباقي.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HADITHS, HADITH_TOPICS } from '../../js/data/hadith.js';
import { normalizeArabic, containsNormalized, firstMismatch } from '../helpers/arabic.mjs';

const REF = process.env.SAKINAH_REF_DIR || '/tmp/claude-0/-home-user-mediapro/c000bffe-65d6-581c-b6a2-d2d633ac7018/scratchpad/ref';
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
        // تحقق مرن: أي أربع كلمات متتالية من المتن (بعد ﷺ) موجودة في الرواية الأخرى (قد يختلف اللفظ يسيرًا)
        const words = normalizeArabic(h.text).split(' ');
        const probeStart = Math.max(0, words.indexOf('ﷺ') + 1);
        const body = words.slice(probeStart);
        const others = other.map(t => normalizeArabic(t));
        let okOther = false;
        const win = Math.min(4, body.length);
        for (let i = 0; i + win <= body.length && !okOther; i++) { const probe = body.slice(i, i + win).join(' '); okOther = others.some(t => t.includes(probe)); }
        if (!okOther) failures.push(`${h.id}: alsoIn ${h.alsoIn.collection} ${h.alsoIn.number} shares no 4-word window with the matn (may be a different wording — verify manually)`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});
