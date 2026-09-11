/**
 * نواة المصحف: تحميل النص، الفهارس (سورة/صفحة/جزء)، تطبيع النص للمطابقة، تجزئة الكلمات،
 * ومُطابِق تسلسلي متسامح لوضع مراجعة الحفظ (يقارن الكلمات المنطوقة بالكلمات المتوقعة).
 * النص: Tanzil (الرسم العثماني، حفص عن عاصم). الصفحات: مصحف المدينة النبوية (604 صفحات).
 */
import { SURAHS, JUZ_STARTS, TOTAL_PAGES, TOTAL_AYAHS, BASMALA } from '../data/quran-meta.js';
export { SURAHS, JUZ_STARTS, TOTAL_PAGES, TOTAL_AYAHS, BASMALA };

let quran = null; let loading = null;
const byPage = new Map(); const bySurah = new Map();

/** تحميل النص (مرة واحدة). في النسخة أحادية الملف يكون مضمّنًا في window.SAKINAH_QURAN */
export async function loadQuran(url = 'data/quran.json') {
  if (quran) return quran;
  if (loading) return loading;
  loading = (async () => {
    let raw;
    if (typeof window !== 'undefined' && window.SAKINAH_QURAN) raw = window.SAKINAH_QURAN;
    else { const res = await fetch(url); if (!res.ok) throw new Error('quran load failed ' + res.status); raw = await res.json(); }
    setQuranData(raw);
    return quran;
  })().catch((e) => { loading = null; throw e; }); // فشل التحميل لا يُخزَّن: تعمل «إعادة المحاولة»
  return loading;
}
/** إدخال البيانات مباشرة (للاختبارات والنسخة المضمّنة) */
export function setQuranData(raw) {
  const sajda = new Set(raw.sajda || []);
  quran = { edition: raw.edition, ayahs: raw.ayahs.map((r, i) => ({ n: i + 1, surah: r[0], ayah: r[1], page: r[2], juz: r[3], hizbQuarter: r[4], text: r[5], sajda: sajda.has(i + 1) })) };
  byPage.clear(); bySurah.clear(); searchIdx = null; hizbPages = null;
  for (const a of quran.ayahs) {
    if (!byPage.has(a.page)) byPage.set(a.page, []); byPage.get(a.page).push(a);
    if (!bySurah.has(a.surah)) bySurah.set(a.surah, []); bySurah.get(a.surah).push(a);
  }
  return quran;
}
export function isLoaded() { return !!quran; }
export function getAyah(n) { return quran ? quran.ayahs[n - 1] : null; }
export function getAyahBySurah(surah, ayah) { const list = bySurah.get(surah); return list ? list[ayah - 1] : null; }
export function pageAyahs(page) { return byPage.get(page) || []; }
export function surahAyahs(surah) { return bySurah.get(surah) || []; }
export function surahInfo(surah) { return SURAHS[surah - 1]; }
export function pageOf(surah, ayah) { const a = getAyahBySurah(surah, ayah); return a ? a.page : null; }
export function juzOfPage(page) { const list = byPage.get(page); return list && list.length ? list[0].juz : null; }
/** السور التي تبدأ في هذه الصفحة (لعرض ترويستها) */
export function surahsStartingOn(page) { return pageAyahs(page).filter((a) => a.ayah === 1).map((a) => a.surah); }
/** الجزء والحزب والربع لصفحة (للعنوان) */
export function pageLabel(page) {
  const list = pageAyahs(page); if (!list.length) return { juz: null, hizb: null, quarter: null };
  const hq = list[0].hizbQuarter; return { juz: list[0].juz, hizb: Math.ceil(hq / 4), quarter: ((hq - 1) % 4) + 1 };
}

/** تطبيع نص عثماني/إملائي إلى صورة مقارنة بسيطة: بلا تشكيل، بلا ألف خنجرية أو وصل، توحيد الهمزات والتاء المربوطة والألف المقصورة */
export function normalizeForMatch(s) {
  return String(s || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]|[\uFEFF\u200E\u200F\u06E5\u06E6]/g, '')
    .replace(/[ٱأإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^ء-ي٠-٩\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}
/** الأرقام العربية المشرقية والفارسية → أرقام ASCII (لمدخلات التنقل والبحث) */
export function foldDigits(s) { return String(s || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0)); }

/**
 * صورتان للبحث في الرسم العثماني، لأن كلمات شائعة تُكتب بألف خنجرية أو حروف صغيرة تختلف عن الإملاء الحديث:
 * - الصورة A تُظهر الحروف الصغيرة كحروف كاملة: ٱلصَّلَوٰةَ → الصلاه، ٱلْكِتَٰبَ → الكتاب، إِبْرَٰهِـۧمَ → ابراهيم، ٱلْقُرْءَانَ → القران.
 * - الصورة B تحذفها (كالإملاء الذي يُسقط الألف الصغيرة): ٱلرَّحْمَٰنِ → الرحمن، دَاوُۥدَ → داود.
 * تُطابَق كلمة البحث مع أيٍّ من الصورتين، فتُوجد «الصلاة» و«الرحمن» و«داود» و«إبراهيم» جميعًا.
 */
const SEARCH_MARKS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E8-\u06ED\u0640]/g; // الحركات والعلامات، دون الألف الخنجرية والحروف الصغيرة (تُعالج بعدها)
export function normalizeForSearchA(s) {
  return normalizeForMatch(String(s || '').replace(SEARCH_MARKS, '')
    .replace(/\u0648\u0670(?=\u0629)/g, 'ا')  // وٰة (الصلوٰة، الزكوٰة، الحيوٰة، مشكوٰة): الواو صامتة → ا
    .replace(/\u0648\u0670\u0627/g, 'ا')       // وٰا (الربوٰا) → ا؛ أما السمٰوٰت فالواو منطوقة فتبقى (→ السماوات)
    .replace(/\u0649\u0670/g, 'ى')   // ىٰ → ى (تصبح ي بعد التطبيع)
    .replace(/\u0670/g, 'ا').replace(/\u06E7/g, 'ي').replace(/\u06E5/g, 'و').replace(/\u06E6/g, 'ي')
    .replace(/\u0621\u0627/g, 'ا'));  // ءا (القرءان، ءامنوا) → ا كما تُكتب آ
}
export function normalizeForSearchB(s) { return normalizeForMatch(String(s || '').replace(SEARCH_MARKS, '').replace(/\u0621\u0627/g, 'ا')); }
let searchIdx = null;
function buildSearchIndex() {
  if (!quran) return null;
  searchIdx = quran.ayahs.map((a) => ({ a: ` ${normalizeForSearchA(a.text)} `, b: ` ${normalizeForSearchB(a.text)} ` }));
  return searchIdx;
}

/** تجزئة آية إلى كلمات؛ الرموز المنفردة (علامات الوقف) تبقى للعرض لكنها ليست كلمات تُنطق */
export function tokenize(text) {
  return text.split(' ').filter(Boolean).map((t) => ({ raw: t, norm: normalizeForMatch(t), spoken: /[ء-ي]/.test(normalizeForMatch(t)) }));
}

/** مسافة ليفنشتاين (للمطابقة المتسامحة) */
export function levenshtein(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function similarity(a, b) { const m = Math.max(a.length, b.length); return m ? 1 - levenshtein(a, b) / m : 1; }

/**
 * مُطابِق الحفظ: يتتبع موضع الكلمة المتوقعة داخل قائمة كلمات (كلمات عدة آيات متتالية).
 * يقبل الكلمة إن طابقت المتوقعة (تشابه ≥ threshold) أو إحدى الكلمتين التاليتين (تخطي كلمة أو كلمتين)،
 * ويتجاهل الكلمات غير المطابقة (تكرار، تلعثم) بدل أن يتعطل.
 */
export class HifzMatcher {
  constructor(words, { threshold = 0.66, lookahead = 2, lookaheadThreshold = 0.85, fuseThreshold = 0.8,
                       resyncAfter = 2, resyncWindow = 25, resyncThreshold = 0.85 } = {}) {
    this.words = words; // [{norm, ...}] الكلمات المنطوقة فقط
    this.pos = 0; this.threshold = threshold; this.lookahead = lookahead; this.lookaheadThreshold = lookaheadThreshold; // القفز فوق كلمة يتطلب تطابقًا أوثق
    this.fuseThreshold = fuseThreshold; // دمج/تقسيم التعرّف (كلمة منطوقة ↔ كلمتان متوقّعتان) يتطلب تطابقًا أوثق
    // إعادة التزامن: إن أسقط التعرّف أكثر من lookahead كلمة تتابعًا، وقف المطابق إلى الأبد.
    // فبعد resyncAfter إخفاقًا متتاليًا نبحث أمامنا في نافذة أوسع، ولا نقفز إلا بتأكيد كلمتين
    // متتاليتين — فالكلمة الواحدة تتكرّر في القرآن كثيرًا ولا يُعتمد عليها وحدها.
    this.resyncAfter = resyncAfter; this.resyncWindow = resyncWindow; this.resyncThreshold = resyncThreshold;
    this.misses = 0; this.resyncAt = -1;
    this.matched = 0; this.skipped = 0; this.unmatched = 0; this.resynced = 0;
  }
  /** أقرب موضع أمامنا تُطابقه الكلمة المنطوقة بثقة — الأقرب لا الأفضل، فالتلاوة تسير إلى الأمام */
  findResync(w) {
    const end = Math.min(this.words.length - 1, this.pos + this.resyncWindow);
    for (let j = this.pos + this.lookahead + 1; j < end; j++) {
      if (similarity(this.words[j].norm, w) >= this.resyncThreshold) return j;
    }
    return -1;
  }
  /** يعالج نصًا منطوقًا (كلمة أو أكثر) ويعيد قائمة فهارس الكلمات التي كُشفت الآن */
  feed(transcript) {
    const spoken = normalizeForMatch(transcript).split(' ').filter(Boolean);
    const revealed = [];
    let i = 0;
    while (i < spoken.length) {
      if (this.pos >= this.words.length) break;
      const w = spoken[i];
      let hit = -1; // كم كلمة متوقّعة نتخطّاها قبل المطابقة
      let span = 1; // كم كلمة متوقّعة تستهلكها هذه المطابقة
      let take = 1; // كم كلمة منطوقة نستهلكها
      for (let k = 0; k <= this.lookahead && this.pos + k < this.words.length; k++) {
        const exp = this.words[this.pos + k].norm; const th = k === 0 ? this.threshold : this.lookaheadThreshold;
        if (exp === w || similarity(exp, w) >= th || (k === 0 && w.length >= 4 && exp.length >= 4 && (exp.startsWith(w) || w.startsWith(exp)))) { hit = k; break; }
      }
      // التعرّف يدمج كلمتين في واحدة («اياك نعبد» ← «اياكنعبد»)
      if (hit < 0 && this.pos + 1 < this.words.length && similarity(this.words[this.pos].norm + this.words[this.pos + 1].norm, w) >= this.fuseThreshold) { hit = 0; span = 2; }
      // أو يقسم الكلمة الواحدة إلى اثنتين («نستعين» ← «نست عين»)
      if (hit < 0 && i + 1 < spoken.length && similarity(this.words[this.pos].norm, w + spoken[i + 1]) >= this.fuseThreshold) { hit = 0; take = 2; }
      if (hit < 0) {
        // مرشّح من الكلمة السابقة: إن أكّدته هذه الكلمة فقد وجدنا موضع القارئ الحقيقي
        // المرشّح لا يُقبل إلا وهو أمامنا: التلميح اليدوي قد يكون تجاوزه، والقفز إلى الخلف يُنقص pos
        if (this.resyncAt >= this.pos && similarity(this.words[this.resyncAt + 1].norm, w) >= this.resyncThreshold) {
          const j = this.resyncAt;
          for (let k = this.pos; k <= j + 1; k++) revealed.push(k); // ما أسقطه التعرّف يُكشف أيضًا
          this.skipped += j + 1 - this.pos; this.matched++; this.resynced++;
          this.pos = j + 2; this.misses = 0; this.resyncAt = -1;
          i++; continue;
        }
        this.unmatched++; this.misses++;
        this.resyncAt = this.misses >= this.resyncAfter ? this.findResync(w) : -1;
        i++; continue;
      }
      this.misses = 0; this.resyncAt = -1;
      // امتداد الدمج: الكلمة المنطوقة قد تضمّ أكثر من كلمة متوقّعة — نتوسّع ما دام التشابه يتحسّن
      if (span === 1) {
        let acc = this.words[this.pos + hit].norm; let best = similarity(acc, w);
        while (this.pos + hit + span < this.words.length) {
          const next = acc + this.words[this.pos + hit + span].norm; const sim = similarity(next, w);
          if (sim <= best) break;
          acc = next; best = sim; span++;
        }
      }
      for (let k = 0; k < hit; k++) revealed.push(this.pos + k); // كلمات متخطّاة تُكشف أيضًا
      this.skipped += hit;
      for (let j = 0; j < span; j++) revealed.push(this.pos + hit + j);
      this.matched++;
      this.pos += hit + span;
      i += take;
    }
    return revealed;
  }
  /**
   * فرضيات التعرّف للصوت نفسه (الاختيار الأول ثم بدائله): تُجرَّب بلا أثر جانبي،
   * وتُعتمد أولى التي تكشف شيئًا. وإن لم تكشف أيٌّ منها بقيت محاسبة الفرضية الأولى وحدها —
   * وإلا محا ضجيجُ البدائل مرشّحَ إعادة التزامن الذي وجدته الفرضية الصحيحة.
   */
  feedBest(hypotheses) {
    const list = (hypotheses || []).filter(Boolean);
    if (!list.length) return [];
    const before = this.snapshot();
    let primary = null;
    for (const h of list) {
      if (primary) this.restore(before);
      const r = this.feed(h);
      if (r.length) return r;
      if (!primary) primary = this.snapshot();
    }
    this.restore(primary);
    return [];
  }
  snapshot() { return { pos: this.pos, matched: this.matched, skipped: this.skipped, unmatched: this.unmatched, resynced: this.resynced, misses: this.misses, resyncAt: this.resyncAt }; }
  restore(s) { this.pos = s.pos; this.matched = s.matched; this.skipped = s.skipped; this.unmatched = s.unmatched; this.resynced = s.resynced; this.misses = s.misses; this.resyncAt = s.resyncAt; }
  /** كشف الكلمة التالية يدويًا (تلميح) */
  hint() { if (this.pos >= this.words.length) return null; this.misses = 0; this.resyncAt = -1; return this.pos++; }
  get done() { return this.pos >= this.words.length; }
  get progress() { return this.words.length ? this.pos / this.words.length : 1; }
}

/**
 * بحث نصي (بلا تشكيل، يتعامل مع الرسم العثماني) — يعيد حتى limit نتيجة.
 * الترتيب: مطابقة الكلمة الكاملة أولًا ثم المطابقة الجزئية، وداخل كل مجموعة بترتيب المصحف. الفهرس يُبنى مرة عند أول بحث.
 */
export function searchText(q, limit = 50) {
  if (!quran) return [];
  const nA = normalizeForSearchA(q), nB = normalizeForSearchB(q);
  if (nA.length < 2) return [];
  const idx = searchIdx || buildSearchIndex();
  const wA = ` ${nA} `, wB = ` ${nB} `;
  const whole = [], partial = [];
  for (let i = 0; i < idx.length; i++) {
    const e = idx[i];
    if (e.a.includes(wA) || e.b.includes(wB)) { whole.push(quran.ayahs[i]); if (whole.length >= limit) break; }
    else if (partial.length < limit && (e.a.includes(nA) || e.b.includes(nB))) partial.push(quran.ayahs[i]);
  }
  return whole.concat(partial).slice(0, limit);
}

/** تحويل رقم آية عالمي إلى نص مرجعي "البقرة: 255" */
export function refLabel(a) { return `${surahInfo(a.surah).name}: ${a.ayah}`; }

/** رقم الآية بالأرقام العربية المشرقية داخل علامة نهاية الآية */
export function ayahMarker(n, numerals = 'arab') {
  const s = String(n); return numerals === 'arab' ? s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : s;
}

/** أول صفحة يبدأ فيها الحزب (1..60)، أو null */
let hizbPages = null;
export function hizbStartPage(hizb) {
  if (!quran) return null;
  if (!hizbPages) { hizbPages = new Map(); for (const a of quran.ayahs) { const q = a.hizbQuarter; if ((q - 1) % 4 === 0 && !hizbPages.has(Math.ceil(q / 4))) hizbPages.set(Math.ceil(q / 4), a.page); } }
  return hizbPages.get(Number(hizb)) || null;
}
