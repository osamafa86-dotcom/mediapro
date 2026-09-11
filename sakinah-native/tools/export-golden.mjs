// يولّد بيانات المرجع الذهبية من محرك نسخة الويب (المُتحقَّق منه ضد adhan-js وAlAdhan) لاختبار النواة الأصلية
// التشغيل: node sakinah-native/tools/export-golden.mjs  (من جذر المستودع) → Tests/SakinahCoreTests/Fixtures/golden.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../sakinah/js/core');
const { computePrayerTimes, dayTimeline, sunnahTimes, defaultParams } = await import(path.join(web, 'prayer-times.js'));
const { defaultMethodFor } = await import(path.join(web, 'methods.js'));
const { hijriDate } = await import(path.join(web, 'hijri.js'));
const { qiblaInfo, sunQiblaMoments, kaabaZenithEvents } = await import(path.join(web, 'qibla.js'));
const { magneticField } = await import(path.join(web, 'geomag.js'));

const ep = (d) => (d instanceof Date && !isNaN(d) ? Math.round(d.getTime() / 1000) : null);
const places = [
  ['Makkah', 21.4225, 39.8262, 'Asia/Riyadh', 'SA'], ['Riyadh', 24.7136, 46.6753, 'Asia/Riyadh', 'SA'], ['Amman', 31.9539, 35.9106, 'Asia/Amman', 'JO'],
  ['Cairo', 30.0444, 31.2357, 'Africa/Cairo', 'EG'], ['Istanbul', 41.0082, 28.9784, 'Europe/Istanbul', 'TR'], ['London', 51.5074, -0.1278, 'Europe/London', 'GB'],
  ['Oslo', 59.9139, 10.7522, 'Europe/Oslo', 'NO'], ['Tromso', 69.6496, 18.9560, 'Europe/Oslo', 'NO'], ['Reykjavik', 64.1466, -21.9426, 'Atlantic/Reykjavik', 'IS'],
  ['NewYork', 40.7128, -74.0060, 'America/New_York', 'US'], ['Jakarta', -6.2088, 106.8456, 'Asia/Jakarta', 'ID'], ['KualaLumpur', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 'MY'],
  ['Sydney', -33.8688, 151.2093, 'Australia/Sydney', 'AU'], ['Apia', -13.8506, -171.7513, 'Pacific/Apia', 'WS'], ['Kiritimati', 1.8721, -157.4278, 'Pacific/Kiritimati', 'KI'],
  ['Tehran', 35.6892, 51.3890, 'Asia/Tehran', 'IR'], ['Karachi', 24.8607, 67.0011, 'Asia/Karachi', 'PK'], ['Singapore', 1.3521, 103.8198, 'Asia/Singapore', 'SG'],
];
const dates = [[2026, 1, 15], [2026, 3, 20], [2026, 6, 21], [2026, 9, 9], [2026, 12, 21], [2027, 6, 21]];
const paramSets = (cc, tz) => [
  { method: defaultMethodFor({ countryCode: cc, tz }) },
  { method: 'MuslimWorldLeague', madhab: 'hanafi' },
  { method: 'UmmAlQura', isRamadan: true },
  { method: 'MoonsightingCommittee', shafaq: 'ahmer' },
  { method: 'Custom', custom: { fajrAngle: 16, ishaAngle: 14, ishaInterval: 0, maghribAngle: 4 } },
  { method: 'Egyptian', highLatitudeRule: 'seventhofthenight', adjustments: { fajr: 2, isha: -3 } },
  { method: 'Tehran', rounding: 'none' },
];
const prayer = [];
for (const [id, lat, lon, tz, cc] of places) for (const [y, m, d] of dates) for (const ps of paramSets(cc, tz)) {
  const params = defaultParams({ ...ps, tz });
  const r = computePrayerTimes({ latitude: lat, longitude: lon }, { year: y, month: m, day: d }, params);
  prayer.push({ id, lat, lon, tz, date: { year: y, month: m, day: d }, params: { method: params.method, madhab: params.madhab, highLatitudeRule: params.highLatitudeRule, polarResolution: params.polarResolution, isRamadan: params.isRamadan, shafaq: params.shafaq, rounding: params.rounding, custom: params.custom, adjustments: params.adjustments },
    times: { fajr: ep(r.fajr), sunrise: ep(r.sunrise), dhuhr: ep(r.dhuhr), asr: ep(r.asr), sunset: ep(r.sunset), maghrib: ep(r.maghrib), isha: ep(r.isha) },
    resolved: { polarResolved: r.resolved.polarResolved, fajrSafe: r.resolved.fajrSafe, ishaSafe: r.resolved.ishaSafe, usedLatitude: r.resolved.usedLatitude, rule: r.resolved.rule, dayShifted: r.resolved.dayShifted } });
}
const timeline = [];
for (const [id, lat, lon, tz, cc] of places) for (const nowIso of ['2026-09-09T02:30:00Z', '2026-09-09T11:00:00Z', '2026-09-09T20:15:00Z', '2026-06-21T23:30:00Z']) {
  const now = new Date(nowIso); const params = defaultParams({ method: defaultMethodFor({ countryCode: cc, tz }) });
  const t = dayTimeline({ latitude: lat, longitude: lon }, tz, params, now);
  timeline.push({ id, lat, lon, tz, method: params.method, now: ep(now), date: t.date, current: t.current, next: { key: t.next.key, time: ep(t.next.time), isTomorrow: !!t.next.isTomorrow, isYesterday: !!t.next.isYesterday }, sunnah: { middleOfNight: ep(t.sunnah.middleOfNight), lastThird: ep(t.sunnah.lastThird) }, yesterdayIsha: ep(t.yesterdayIsha) });
}
const hijri = [];
for (const tz of ['Asia/Riyadh', 'America/New_York', 'Pacific/Apia', 'UTC']) for (let i = 0; i < 40; i++) {
  const d = new Date(Date.UTC(2025, 0, 1, 20, 30) + i * 23 * 86400000);
  for (const off of [-2, 0, 1]) { const h = hijriDate(d, tz, off); hijri.push({ epoch: ep(d), tz, offset: off, day: h.day, month: h.month, year: h.year, weekday: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].indexOf(h.weekday), source: h.source }); }
}
const qibla = places.map(([id, lat, lon]) => { const q = qiblaInfo(lat, lon); return { id, lat, lon, bearing: q.bearing, bearingSpherical: q.bearingSpherical, distanceKm: q.distanceKm, difference: q.difference, compassPoint: q.compassPoint, antipodal: q.antipodal }; });
qibla.push((() => { const q = qiblaInfo(-21.4225, -140.1738); return { id: 'antipode', lat: -21.4225, lon: -140.1738, bearing: q.bearing, bearingSpherical: q.bearingSpherical, distanceKm: q.distanceKm, difference: q.difference, compassPoint: q.compassPoint, antipodal: q.antipodal }; })());
const sunMoments = [];
for (const [id, lat, lon, tz] of places.slice(0, 8)) for (const [y, m, d] of [[2026, 3, 20], [2026, 7, 15]]) { const s = sunQiblaMoments(lat, lon, { year: y, month: m, day: d }, tz); sunMoments.push({ id, lat, lon, tz, civil: { year: y, month: m, day: d }, bearing: s.bearing, sunAtQibla: ep(s.sunAtQibla), shadowAtQibla: ep(s.shadowAtQibla) }); }
const zenith = { 2026: kaabaZenithEvents(2026).map((e) => ({ time: ep(e.time), altitude: e.altitude })), 2027: kaabaZenithEvents(2027).map((e) => ({ time: ep(e.time), altitude: e.altitude })) };
const geomag = [];
for (const [id, lat, lon] of places) for (const dy of [2025.0, 2026.69, 2029.5, 2031.0]) for (const alt of [0, 1.5]) { const f = magneticField({ lat, lon, altKm: alt, date: dy }); geomag.push({ id, lat, lon, altKm: alt, decimalYear: dy, declination: f.declination, inclination: f.inclination, f: f.f, h: f.h, x: f.x, y: f.y, z: f.z, gridVariation: Number.isNaN(f.gridVariation) ? null : f.gridVariation, outOfRange: f.outOfRange }); }
for (const [lat, lon] of [[89.99, 0], [-89.99, 45], [0, 180], [55, -100], [-60, 120]]) { const f = magneticField({ lat, lon, altKm: 0, date: 2027.25 }); geomag.push({ id: `p${lat}_${lon}`, lat, lon, altKm: 0, decimalYear: 2027.25, declination: f.declination, inclination: f.inclination, f: f.f, h: f.h, x: f.x, y: f.y, z: f.z, gridVariation: Number.isNaN(f.gridVariation) ? null : f.gridVariation, outOfRange: f.outOfRange }); }
const methods = [['SA', 'Asia/Riyadh'], ['JO', null], [null, 'Europe/London'], [null, 'America/Bogota'], ['ZZ', 'Asia/Tokyo'], [null, null]].map(([cc, tz]) => ({ countryCode: cc, tz, method: defaultMethodFor({ countryCode: cc || undefined, tz: tz || undefined }) }));
// تخطيط المصحف: أسطر صفحات مختارة مفكوكة الترميز كما يراها القارئ في نسخة الويب
const mushaf = await import(path.join(web, 'mushaf.js'));
mushaf.setMushafLayout(JSON.parse(fs.readFileSync(path.resolve(here, '../../sakinah/data/mushaf-layout.json'), 'utf8')));
const layoutPages = {};
for (const p of [1, 2, 3, 50, 187, 293, 302, 545, 604]) layoutPages[p] = { lineCount: mushaf.pageLineCount(p), headers: mushaf.headersOnPage(p), ayahs: mushaf.ayahsOnPage(p), lines: mushaf.pageLines(p).map((l) => l.type === 'words' ? { type: 'words', words: l.words.map((w) => ({ glyph: w.glyph, n: w.n, k: w.k, end: w.end, rub: w.rub, sajda: w.sajda })) } : l) };
const juzNames = Array.from({ length: 30 }, (_, i) => mushaf.juzName(i + 1));
// ---------- المرحلة 3ب–4: البحث والتطبيع والحفظ والختمة والتحدّيات والمسبحة والتجويد وحديث اليوم ----------
const quran = await import(path.join(web, 'quran.js'));
quran.setQuranData(JSON.parse(fs.readFileSync(path.resolve(here, '../../sakinah/data/quran.json'), 'utf8')));
const normalize = ['بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'ٱلصَّلَوٰةَ', 'ٱلْكِتَٰبَ', 'إِبْرَٰهِـۧمَ', 'ٱلْقُرْءَانَ', 'دَاوُۥدَ', 'ٱلرِّبَوٰا۟', 'ٱلسَّمَٰوَٰتِ', 'مُوسَىٰ', 'الصلاة', 'إبراهيم', 'أُمُّ القُرى', 'ءَامَنُوا۟', 'ٱلزَّكَوٰةَ', 'يَٰٓأَيُّهَا', 'مِّنۢ بَعْدِ']
  .map((s) => ({ s, match: quran.normalizeForMatch(s), a: quran.normalizeForSearchA(s), b: quran.normalizeForSearchB(s) }));
const search = ['الصلاة', 'الرحمن', 'داود', 'إبراهيم', 'القرآن', 'الحمد لله', 'يس', 'بسم', 'الزكاة', 'موسى', 'ال', 'xyz'].map((q) => ({ q, n: quran.searchText(q, 30).map((a) => a.n) }));
const tokenize = [1, 6, 262, 1001, 6236].map((n) => ({ n, words: quran.tokenize(quran.getAyah(n).text) }));
const hifzWords = quran.pageAyahs(1).flatMap((a) => quran.tokenize(a.text).filter((w) => w.spoken).map((w, k) => ({ n: a.n, k, norm: w.norm, raw: w.raw })));
const hifzFeeds = ['بسم الله الرحمن الرحيم', 'الحمد لله رب العالمين', 'الرحمن', 'ملك يوم الدين', 'اياك نعبد و اياك نستعين', 'اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين'];
const hm = new quran.HifzMatcher(hifzWords); const hifzSteps = hifzFeeds.map((t) => ({ t, revealed: hm.feed(t), pos: hm.pos, matched: hm.matched, skipped: hm.skipped, unmatched: hm.unmatched, done: hm.done, progress: hm.progress }));
const hm2 = new quran.HifzMatcher(hifzWords); const hifzNoisy = [['بسم الله الرحيم', hm2.feed('بسم الله الرحيم')], ['الحمد الحمد لله', hm2.feed('الحمد الحمد لله')], ['رب', hm2.feed('رب')], ['hint', [hm2.hint()]], ['الرحمنالرحيم', hm2.feed('الرحمنالرحيم')], ['م لك', hm2.feed('م لك')]].map(([t, r]) => ({ t, revealed: r, pos: hm2.pos }));
// إعادة التزامن: سورة الرحمن لأن «فبأي آلاء ربكما تكذبان» تتكرّر ٣١ مرة — أقسى اختبار للقفز الخاطئ
const resyncWords = quran.surahAyahs(55).flatMap((a) => quran.tokenize(a.text).filter((w) => w.spoken).map((w, k) => ({ n: a.n, k, norm: w.norm, raw: w.raw })));
const resyncSpoken = resyncWords.map((w) => w.norm);
function resyncRun(seq) { const m = new quran.HifzMatcher(resyncWords); for (const w of seq) m.feed(w); return { pos: m.pos, matched: m.matched, skipped: m.skipped, unmatched: m.unmatched, resynced: m.resynced }; }
const hifzResync = {
  words: resyncWords.length,
  dropped: resyncRun([...resyncSpoken.slice(0, 8), ...resyncSpoken.slice(13, 60)]),   // التعرّف أسقط ٥ كلمات
  clean: resyncRun(resyncSpoken.slice(0, 60)),                                        // تلاوة سليمة كلمةً كلمة
  noise: resyncRun('السلام عليكم كيف حالك اليوم الطقس جميل هنا'.split(' ')),           // ضجيج لا علاقة له
  single: resyncRun([resyncSpoken[0], 'xxxxxxxx', resyncSpoken[40]]),                  // كلمة واحدة بعيدة لا تكفي للقفز
};
// feedBest: البدائل فرضيات لصوت واحد، فلا يجوز أن يمحو ضجيجُها مرشّحَ إعادة التزامن
function bestRun(seq, alts) { const m = new quran.HifzMatcher(resyncWords); for (const w of seq) m.feedBest([w, ...alts]); return { pos: m.pos, matched: m.matched, skipped: m.skipped, unmatched: m.unmatched, resynced: m.resynced }; }
const hifzBest = {
  droppedWithNoisyAlts: bestRun([...resyncSpoken.slice(0, 8), ...resyncSpoken.slice(14, 60)], ['غرغرة', 'اه']),
  cleanWithFarAlts: bestRun(resyncSpoken.slice(0, 60), ['xxxxxxxx']),
  emptyHypotheses: (() => { const m = new quran.HifzMatcher(resyncWords); const r = m.feedBest(['', '']); return { revealed: r, pos: m.pos, unmatched: m.unmatched }; })(),
  altWins: (() => { const m = new quran.HifzMatcher(resyncWords); const r = m.feedBest(['xxxxxxxx', resyncSpoken[0]]); return { revealed: r, pos: m.pos, unmatched: m.unmatched }; })(),
};
const lev = [['كتاب', 'كتب'], ['الرحمن', 'الرحيم'], ['', 'ابج'], ['سلام', 'سلام'], ['نعبد', 'نعبده']].map(([a, b]) => ({ a, b, d: quran.levenshtein(a, b), sim: quran.similarity(a, b) }));
const kh = await import(path.join(web, 'khatmah.js')); const ch = await import(path.join(web, 'challenges.js')); const tb = await import(path.join(web, 'tasbih.js'));
const readLog = { '2026-09-08': [1, 2, 3], '2026-09-09': [4, 5], '2026-09-10': [6], '2026-08-15': [10, 11] };
const plan = kh.makePlan({ startPage: 1, startedAt: '2026-09-01', days: 30, reminder: '21:00' });
const khatmah = { plan, status: kh.planStatus(plan, 45, readLog, '2026-09-10'), status2: kh.planStatus(kh.makePlan({ startPage: 300, startedAt: '2026-08-01', days: 60 }), 20, readLog, '2026-09-10'),
  streak: kh.streak(readLog, '2026-09-10'), streakYesterday: kh.streak(readLog, '2026-09-11'), streakNone: kh.streak(readLog, '2026-09-13'), logged: kh.logPage(readLog, '2026-09-10', 3), stats: kh.stats(readLog, '2026-09-10'),
  daysBetween: kh.daysBetween('2026-02-27', '2026-03-02'), addDays: kh.addDaysKey('2026-12-30', 5), pagesDone: kh.pagesDone(kh.makePlan({ startPage: 600, startedAt: '2026-01-01', days: 30 }), 5) };
const readLog2 = { '2026-09-04': [582, 583], '2026-09-05': [582, 583, 584], '2026-09-07': [585, 586, 587, 600], '2026-09-10': [588] };
const challenges = { progress: ch.challengeProgress({ id: 'amma', startedAt: '2026-09-05', startPage: 1, from: 582, to: 604 }, readLog2, '2026-09-10'),
  late: ch.challengeProgress({ id: 'kahf', startedAt: '2026-09-01', startPage: 1, from: 293, to: 304 }, readLog2, '2026-09-10'),
  relative: ch.resolveRange(ch.challengeById('juz-3days'), 300), relativeEnd: ch.resolveRange(ch.challengeById('hizb-daily'), 590), heatmap: ch.heatmap(readLog2, '2026-09-10', 7), none: ch.challengeProgress(null, readLog2, '2026-09-10') };
let ts = tb.defaultTasbih(); ts = { ...ts, target: 3 }; const tasbihSteps = [];
for (let i = 0; i < 4; i++) { const r = tb.tap(ts, '2026-09-10'); ts = r.state; tasbihSteps.push({ reached: r.reached, count: ts.count, rounds: ts.rounds, today: tb.todayCount(ts, '2026-09-10'), total: tb.totalCount(ts) }); }
ts = tb.undo(ts, '2026-09-10'); tasbihSteps.push({ undo: true, count: ts.count, rounds: ts.rounds, today: tb.todayCount(ts, '2026-09-10'), total: tb.totalCount(ts) });
ts = { ...ts, phrase: 'hamd' }; ts = tb.tap(ts, '2026-09-11').state; ts = tb.tap(ts, '2026-09-11').state;
const tasbih = { steps: tasbihSteps, grand: tb.grandTotal(ts), todayHamd: tb.todayCount(ts, '2026-09-11'), phraseText: tb.phraseText(ts), custom: tb.phraseText({ ...ts, phrase: 'custom', custom: ' حسبي الله ' }), customEmpty: tb.phraseText({ ...ts, phrase: 'custom', custom: '' }), reset: tb.resetCount(ts) };
const tj = await import(path.join(web, 'tajweed.js')); tj.setTajweedData(JSON.parse(fs.readFileSync(path.resolve(here, '../../sakinah/data/tajweed.json'), 'utf8')));
const tajweed = [1, 2, 7, 262, 6236, 3000].map((n) => ({ n, spans: tj.tajweedSpans(n) }));
const hd = await import(path.resolve(here, '../../sakinah/js/data/hadith.js'));
const hadithOfDay = [[2026, 9, 10], [2026, 1, 1], [2027, 3, 15], [2030, 12, 31]].map(([y, m, d]) => ({ y, m, d, id: hd.hadithOfDay(new Date(y, m - 1, d)).id }));
const hadithRef = hd.HADITHS.filter((h) => h.alsoIn).slice(0, 3).map((h) => ({ id: h.id, ref: hd.hadithReference(h) })).concat(hd.HADITHS.filter((h) => !h.alsoIn).slice(0, 2).map((h) => ({ id: h.id, ref: hd.hadithReference(h) })));
const out = { generatedAt: new Date().toISOString(), prayer, timeline, hijri, qibla, sunMoments, zenith, geomag, methods, layoutPages, juzNames,
  normalize, search, tokenize, hifz: { words: hifzWords, steps: hifzSteps, noisy: hifzNoisy, resync: hifzResync, best: hifzBest }, lev, khatmah, challenges, tasbih, tajweed, hadithOfDay, hadithRef };
const dest = path.resolve(here, '../Tests/SakinahCoreTests/Fixtures/golden.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`golden: prayer ${prayer.length}, timeline ${timeline.length}, hijri ${hijri.length}, qibla ${qibla.length}, sunMoments ${sunMoments.length}, geomag ${geomag.length} → ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
