/**
 * تحقق آلي من بيانات أذكار الصباح والمساء مقابل البيانات الرسمية لكتاب «حصن المسلم»
 * (باب أذكار الصباح والمساء، الأرقام 75–98، ملف hisn_27.json).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADHKAR } from '../../js/data/adhkar.js';
import { normalizeArabic, firstMismatch } from '../helpers/arabic.mjs';

// نص حصن المسلم الرسمي (hisnmuslim.com/api/ar/27.json) محفوظ في tests/fixtures
const REF = process.env.SAKINAH_REF_DIR || new URL('../fixtures', import.meta.url).pathname;
const HISN_FILE = `${REF}/hisn_27.json`;
const haveHisn = fs.existsSync(HISN_FILE);

const PERIODS = ['both', 'morning', 'evening'];
const ALLOWED_KEYS = new Set(['id', 'hisnId', 'period', 'text', 'textEvening', 'repeat', 'repeatEvening', 'reference', 'virtue', 'note']);

function loadHisn() {
  const raw = fs.readFileSync(HISN_FILE, 'utf8').replace(/^﻿/, ''); // BOM
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : Object.values(data)[0];
  return items.map(it => ({ ...it, ID: Number(it.ID), REPEAT: Number(it.REPEAT) }));
}

/** ملاحظة التكرار الختامية في النص الرسمي، مثل (ثلاثَ مرَّاتٍ إذا أمسى) — تأتي بعد )) أو في آخر النص */
function trailingNote(src) {
  const after = src.includes('))') ? src.slice(src.lastIndexOf('))') + 2) : src;
  return after.replace(/\[[^\]]*\]/g, '').trim();
}

/** عدد التكرار المذكور في ملاحظة التكرار (إن وُجد) */
function repeatFromNote(note) {
  const n = normalizeArabic(note);
  if (!n) return undefined;
  if (/(^|\s)مايه (مره|مرات)/.test(n)) return 100; // مائة → مايه بعد التطبيع
  if (/(^|\s)عشر (مره|مرات)/.test(n)) return 10;
  if (/(^|\s)سبع (مره|مرات)/.test(n)) return 7;
  if (/(^|\s)اربع (مره|مرات)/.test(n)) return 4;
  if (/(^|\s)ثلاث (مره|مرات)/.test(n)) return 3;
  return undefined;
}

/** الفترة المستنتجة من ملاحظة الكتاب: «إذا أمسى» مساءً فقط، «إذا أصبح» صباحًا فقط، وإلا صباحًا ومساءً */
function periodFromNote(note) {
  const n = normalizeArabic(note);
  if (/اذا امسي/.test(n)) return 'evening';
  if (/اذا اصبح/.test(n)) return 'morning';
  return 'both';
}

// جدول التبديل صباح↔مساء (على النص المطبَّع)، يُطبَّق دفعة واحدة كي لا يتداخل أصبحنا↔أمسينا
const SWAP_PAIRS = [
  ['اصبحنا', 'امسينا'], ['اصبحت', 'امسيت'], ['اصبح', 'امسي'],
  ['هذا اليوم', 'هذه الليله'], ['النشور', 'المصير'],
  ['بعده', 'بعدها'], ['فيه', 'فيها'],
  ['فتحه', 'فتحها'], ['نصره', 'نصرها'], ['نوره', 'نورها'], ['بركته', 'بركتها'], ['هداه', 'هداها'],
];
const SWAP = new Map();
for (const [m, e] of SWAP_PAIRS) { SWAP.set(m, e); SWAP.set(e, m); }
const SWAP_RE = new RegExp(
  `(?<=^|\\s)(و?)(${[...SWAP.keys()].sort((a, b) => b.length - a.length).join('|')})(?=\\s|$)`, 'g');
/** يحوّل نص المساء المطبَّع إلى صيغة الصباح (والعكس) */
const swapNormalized = s => s.replace(SWAP_RE, (_, waw, w) => waw + SWAP.get(w));

test('بنية بيانات الأذكار سليمة: 24 ذكرًا بمعرّفات متسلسلة وفترات صحيحة', () => {
  assert.equal(ADHKAR.length, 24);
  const ids = new Set(), hisnIds = new Set();
  ADHKAR.forEach((a, i) => {
    const expectedId = 'a' + String(i + 1).padStart(2, '0');
    assert.equal(a.id, expectedId, `id at index ${i}`);
    assert.ok(!ids.has(a.id), `duplicate id ${a.id}`); ids.add(a.id);
    assert.ok(Number.isInteger(a.hisnId) && a.hisnId > 0, `${a.id} hisnId`);
    assert.ok(!hisnIds.has(a.hisnId), `duplicate hisnId ${a.hisnId}`); hisnIds.add(a.hisnId);
    assert.ok(PERIODS.includes(a.period), `${a.id} bad period ${a.period}`);
    assert.ok(typeof a.text === 'string' && a.text.trim().length >= 10, `${a.id} text`);
    assert.ok(!/\(\(|\)\)|[\[\]]/.test(a.text), `${a.id} text still has (( )) or [ ] markers`);
    assert.ok(!/\((?:[^()]*)م[َّ]*ر[َّ]*(?:ات|ة)/.test(a.text), `${a.id} text still has repetition note`);
    assert.ok(!/\s{2,}|ـ/.test(a.text), `${a.id} text has double spaces or tatweel`);
    assert.ok(Number.isInteger(a.repeat) && a.repeat >= 1, `${a.id} repeat`);
    if (a.repeatEvening !== undefined) {
      assert.ok(Number.isInteger(a.repeatEvening) && a.repeatEvening >= 1 && a.repeatEvening !== a.repeat, `${a.id} repeatEvening`);
      assert.equal(a.period, 'both', `${a.id} repeatEvening only makes sense for period both`);
    }
    if (a.textEvening !== undefined) {
      assert.ok(typeof a.textEvening === 'string' && a.textEvening.trim().length >= 10, `${a.id} textEvening`);
      assert.equal(a.period, 'both', `${a.id} textEvening only makes sense for period both`);
      assert.notEqual(normalizeArabic(a.textEvening), normalizeArabic(a.text), `${a.id} textEvening identical to text`);
      assert.ok(!/\(\(|\)\)|[\[\]]/.test(a.textEvening), `${a.id} textEvening has markers`);
    }
    assert.ok(typeof a.reference === 'string' && a.reference.trim().length >= 8, `${a.id} reference empty`);
    if (a.virtue !== undefined) assert.ok(typeof a.virtue === 'string' && a.virtue.trim().length >= 10, `${a.id} virtue`);
    if (a.note !== undefined) assert.ok(typeof a.note === 'string' && a.note.trim().length >= 3, `${a.id} note`);
    for (const k of Object.keys(a)) assert.ok(ALLOWED_KEYS.has(k), `${a.id} unexpected key ${k}`);
  });
  // من كان نصّه صباحيًا (أصبحنا/أصبحت/ما أصبح) وجبت له صيغة مساء
  for (const a of ADHKAR) {
    const n = normalizeArabic(a.text);
    if (/(^|\s)و?(اصبحنا|اصبحت)(\s|$)|(^|\s)ما اصبح(\s|$)/.test(n) && a.period === 'both') {
      assert.ok(a.textEvening, `${a.id} morning-specific wording needs textEvening`);
    }
  }
});

test('كل ذكر مطابق حرفيًا لنص حصن المسلم الرسمي (بالترتيب، بالمعرّف، بالتكرار، بالفترة)',
  { skip: !haveHisn && 'hisn_27.json not available' }, () => {
    const items = loadHisn();
    assert.equal(items.length, 24);
    const failures = [];
    ADHKAR.forEach((a, i) => {
      const it = items[i];
      if (a.hisnId !== it.ID) { failures.push(`${a.id}: hisnId ${a.hisnId} != Hisn ID ${it.ID} (order)`); return; }
      const src = it.ARABIC_TEXT;
      // المقارنة بلا مسافات (تجاوز اختلافات المسافات الطباعية في المصدر)، مع الاحتفاظ بنسخة بمسافات لجدول الاستبدال
      const nTextSpaced = normalizeArabic(a.text);
      const nSrc = normalizeArabic(src).replace(/\s+/g, ''), nText = nTextSpaced.replace(/\s+/g, '');

      if (!nSrc.includes(nText)) {
        const p = firstMismatch(src, a.text);
        failures.push(`${a.id}: text not in Hisn ${it.ID}; matched prefix ${p}/${nText.length}: "${nText.slice(Math.max(0, p - 25), p + 25)}"`);
      }

      if (a.textEvening) {
        const nEveSpaced = normalizeArabic(a.textEvening), nEve = nEveSpaced.replace(/\s+/g, '');
        const inSource = nSrc.includes(nEve);
        const mapsBack = swapNormalized(nEveSpaced) === nTextSpaced;
        if (!inSource && !mapsBack) {
          failures.push(`${a.id}: textEvening neither in Hisn ${it.ID} nor maps back to text via swap table:\n   swapped: ${swapNormalized(nEveSpaced)}\n   text   : ${nTextSpaced}`);
        }
      } else if (/وإذا أمسى قال/.test(src) && a.period === 'both') {
        failures.push(`${a.id}: Hisn ${it.ID} has an evening variant but textEvening is missing`);
      }

      const note = trailingNote(src);
      const noted = repeatFromNote(note);
      const expectedRepeat = noted ?? it.REPEAT;
      if (a.repeat !== expectedRepeat) failures.push(`${a.id}: repeat ${a.repeat} != expected ${expectedRepeat} (REPEAT=${it.REPEAT}, note="${note}")`);

      const expectedPeriod = periodFromNote(note);
      if (a.period !== expectedPeriod) failures.push(`${a.id}: period ${a.period} != ${expectedPeriod} derived from note "${note}"`);
    });
    assert.deepEqual(failures, [], failures.join('\n'));
  });

test('حقل REPEAT في ملف حصن المسلم يخالف ملاحظة النص في موضع واحد معروف فقط (83: سبع مرات)',
  { skip: !haveHisn && 'hisn_27.json not available' }, () => {
    const items = loadHisn();
    const discrepancies = items
      .map(it => ({ id: it.ID, REPEAT: it.REPEAT, noted: repeatFromNote(trailingNote(it.ARABIC_TEXT)) }))
      .filter(d => d.noted !== undefined && d.noted !== d.REPEAT);
    assert.deepEqual(discrepancies, [{ id: 83, REPEAT: 1, noted: 7 }]);
    assert.equal(ADHKAR.find(a => a.hisnId === 83)?.repeat, 7);
  });
