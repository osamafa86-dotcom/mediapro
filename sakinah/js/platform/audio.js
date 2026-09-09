/**
 * مشغّل التلاوة آية بآية من مصدرين:
 * - quran.com (verses.quran.com): لقرّاء تتوفر لهم توقيتات الكلمات (تظليل الكلمة أثناء التلاوة)، مع CORS يسمح بالتنزيل إلى Cache API.
 * - Islamic Network CDN: ملفات mp3 لكل آية برقمها العالمي 1..6236 بمعدلات بت مُتحقق منها لكل قارئ.
 * يدعم: قائمة تشغيل لمدى من الآيات، تكرار الآية والمدى، السرعة، التحميل المسبق للآية التالية، مؤقت النوم،
 * أزرار شاشة القفل (Media Session)، والبدائل التلقائية عند فشل مصدر.
 */
// bitrates: معدلات البت المتاحة فعلًا على cdn.islamic.network لكل قارئ (HEAD، سبتمبر 2026)؛ qdc: معرّف التلاوة في quran.com (توقيتات الكلمات)
export const RECITERS = [
  { id: 'ar.alafasy', name: 'مشاري راشد العفاسي', bitrates: [128, 64], qdc: 7 },
  { id: 'ar.husary', name: 'محمود خليل الحصري (مرتّل)', bitrates: [128, 64], qdc: 6 },
  { id: 'ar.husarymujawwad', name: 'محمود خليل الحصري (مجوّد)', bitrates: [128, 64] },
  { id: 'qdc.husarymuallim', name: 'محمود خليل الحصري (المعلّم)', bitrates: [], qdc: 12 },
  { id: 'ar.abdulsamad', name: 'عبد الباسط عبد الصمد (مرتّل)', bitrates: [64], qdc: 2 },
  { id: 'qdc.abdulsamadmujawwad', name: 'عبد الباسط عبد الصمد (مجوّد)', bitrates: [], qdc: 1 },
  { id: 'qdc.minshawi', name: 'محمد صديق المنشاوي (مرتّل)', bitrates: [], qdc: 9 },
  { id: 'qdc.minshawimujawwad', name: 'محمد صديق المنشاوي (مجوّد)', bitrates: [], qdc: 8 },
  { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', bitrates: [64, 192], qdc: 3 },
  { id: 'ar.saoodshuraym', name: 'سعود الشريم', bitrates: [64], qdc: 10 },
  { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', bitrates: [128, 64] },
  { id: 'ar.hudhaify', name: 'علي الحذيفي', bitrates: [128, 64, 32] },
  { id: 'ar.ahmedajamy', name: 'أحمد العجمي', bitrates: [128, 64] },
  { id: 'ar.shaatree', name: 'أبو بكر الشاطري', bitrates: [128, 64], qdc: 4 },
  { id: 'ar.abdullahbasfar', name: 'عبد الله بصفر', bitrates: [64, 192, 32] },
  { id: 'ar.muhammadayyoub', name: 'محمد أيوب', bitrates: [128] },
  { id: 'ar.muhammadjibreel', name: 'محمد جبريل', bitrates: [128] },
  { id: 'qdc.tablawi', name: 'محمد الطبلاوي', bitrates: [], qdc: 11 },
  { id: 'ar.aymanswoaid', name: 'أيمن سويد', bitrates: [64] },
  { id: 'ar.ibrahimakhbar', name: 'إبراهيم الأخضر', bitrates: [32] },
  { id: 'ar.hanirifai', name: 'هاني الرفاعي', bitrates: [64, 192], qdc: 5 },
];
export const DEFAULT_RECITER = 'ar.alafasy';
export const QDC_BASE = 'https://verses.quran.com/';
const QDC_API = 'https://api.quran.com/api/v4/recitations/';
const META_CACHE = 'sakinah-audio-meta';
const META_TIMEOUT_MS = 8000; // مهلة جلب بيانات quran.com قبل الرجوع إلى Islamic Network
export function reciterInfo(id) { return RECITERS.find((r) => r.id === id) || RECITERS[0]; }
export function hasWordTiming(id) { return !!reciterInfo(id).qdc; }
/** معدل البت المناسب للقارئ (المفضّل أولًا)؛ attempt > 0 يعطي البدائل بالترتيب */
export function reciterBitrate(id, attempt = 0) { const b = reciterInfo(id).bitrates; if (!b.length) return null; return b[Math.min(attempt, b.length - 1)]; }
export function ayahAudioUrl(reciter, globalAyah, bitrate = reciterBitrate(reciter)) {
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciter}/${globalAyah}.mp3`;
}

/* ---------- بيانات quran.com: رابط كل آية وتوقيتات كلماتها لكل سورة (تُخزَّن في Cache API) ---------- */
const metaMem = new Map();
const hasCaches = () => typeof caches !== 'undefined' && typeof Request !== 'undefined';
/** @returns {Promise<Map<string, {url:string, segments:number[][]}>>} مفتاحها "سورة:آية" */
export async function qdcSurahMeta(recitationId, surah) {
  const key = `${recitationId}:${surah}`;
  if (metaMem.has(key)) return metaMem.get(key);
  const url = `${QDC_API}${recitationId}/by_chapter/${surah}?fields=segments&per_page=300`;
  let json = null;
  if (hasCaches()) { try { const c = await caches.open(META_CACHE); const hit = await c.match(url); if (hit) json = await hit.json(); } catch { /* لا كاش */ } }
  if (!json) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const timer = ctl && setTimeout(() => ctl.abort(), META_TIMEOUT_MS);
    let res; try { res = await fetch(url, { headers: { accept: 'application/json' }, signal: ctl ? ctl.signal : undefined }); } finally { if (timer) clearTimeout(timer); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
    if (hasCaches()) { try { const c = await caches.open(META_CACHE); await c.put(url, new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json' } })); } catch { /* تجاهل */ } }
  }
  const map = new Map();
  for (const f of json.audio_files || []) map.set(f.verse_key, { url: QDC_BASE + f.url, segments: (f.segments || []).map((s) => (s.length >= 4 ? [s[1], s[2], s[3]] : s)) }); // [موضع الكلمة (1..)، بداية ms، نهاية ms]
  metaMem.set(key, map);
  return map;
}
/** موضع الكلمة (1-based) الجارية عند اللحظة t (بالثواني) من قائمة المقاطع، أو null */
export function wordAt(segments, t) {
  if (!segments || !segments.length) return null;
  const ms = t * 1000; let lo = 0, hi = segments.length - 1, best = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; const s = segments[mid]; if (ms < s[1]) hi = mid - 1; else { best = s; lo = mid + 1; } }
  if (!best) return null;
  return ms <= best[2] + 150 ? best[0] : best[0]; // بين المقاطع نُبقي آخر كلمة (لا وميض)
}
/** كل روابط تلاوة سورة (لمدير التنزيلات) بحسب مصدر القارئ */
export async function surahAudioUrls(reciterId, surah, ayahs /* [{n, surah, ayah}] */, { words = true } = {}) {
  const r = reciterInfo(reciterId);
  if (r.qdc && (words || !r.bitrates.length)) { const meta = await qdcSurahMeta(r.qdc, surah); return ayahs.map((a) => ({ n: a.n, url: (meta.get(`${a.surah}:${a.ayah}`) || {}).url })).filter((x) => x.url); }
  return ayahs.map((a) => ({ n: a.n, url: ayahAudioUrl(reciterId, a.n) }));
}

export class AyahPlayer {
  constructor() {
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    this.next = typeof Audio !== 'undefined' ? new Audio() : null; // للتحميل المسبق
    if (this.audio) { this.audio.preload = 'auto'; this.next.preload = 'auto'; }
    this.reciter = DEFAULT_RECITER; this.rate = 1; this._attempt = 0; // _attempt: فهرس المصدر الحالي (يرتفع عند فشل التحميل)
    this.words = true; // تفضيل مصدر quran.com حين تتوفر توقيتات الكلمات
    this.queue = []; this.index = -1; this.playing = false;
    this.repeatAyah = 1; this.repeatRange = false; this._repeatsLeft = 1;
    this.segments = null; this._segAyah = null; this._loadToken = 0;
    this.sleepAt = null; // مؤقت النوم: لحظة الإيقاف (ms) أو null
    this.loading = false; // بين طلب التشغيل وجاهزية المصدر (تُظهر الواجهة «جارٍ التحميل»)
    this.localResolver = null; // (url) => Promise<string|null> لملف محلي (التطبيق الأصلي)
    this.listeners = new Map();
    if (this.audio) { this._rebind(this.audio); this._rebind(this.next); }
  }
  get bitrate() { return reciterBitrate(this.reciter, Math.max(0, this._attempt - (this._usesQdc() ? 1 : 0))); }
  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); return () => this.listeners.get(ev).delete(fn); }
  _emit(ev, data) { (this.listeners.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  get current() { return this.index >= 0 ? this.queue[this.index] : null; }
  _usesQdc() { const r = reciterInfo(this.reciter); return !!r.qdc && (this.words || !r.bitrates.length); }
  /** مصادر الآية بالترتيب: quran.com (إن كان مفضّلًا) ثم معدلات Islamic Network */
  async _sources(n) {
    const r = reciterInfo(this.reciter); const out = [];
    if (this._usesQdc()) {
      try {
        const a = this.meta && this.meta.ayah ? this.meta.ayah(n) : null;
        if (a) { const meta = await qdcSurahMeta(r.qdc, a.surah); const e = meta.get(`${a.surah}:${a.ayah}`); if (e) out.push({ url: e.url, segments: e.segments, provider: 'qdc' }); }
      } catch { /* لا اتصال أو فشل: نتابع بالبدائل */ }
    }
    for (const b of r.bitrates) out.push({ url: ayahAudioUrl(this.reciter, n, b), segments: null, provider: 'islamic' });
    return out;
  }

  /** تشغيل قائمة آيات (أرقام عالمية) بدءًا من فهرس معيّن؛ meta.label(n) للعنوان وmeta.ayah(n) → {surah, ayah} لمصدر quran.com */
  async play(queue, startIndex = 0, meta = {}) {
    if (!this.audio) return;
    this.queue = queue; this.index = startIndex; this.meta = meta; this._repeatsLeft = this.repeatAyah; this._attempt = 0;
    await this._load(this.current, true);
  }
  async _load(n, autoplay) {
    if (!this.audio || !n) return;
    const token = ++this._loadToken; this.loading = true;
    const sources = await this._sources(n);
    if (token !== this._loadToken) return;
    if (!sources.length) { this.loading = false; this._emit('error', { ayah: n, code: 0, kind: 'unavailable', reciter: this.reciter }); return; }
    const src = sources[Math.min(this._attempt, sources.length - 1)];
    let url = src.url;
    if (this.localResolver) { try { url = (await this.localResolver(url)) || url; } catch { /* تجاهل */ } }
    if (token !== this._loadToken) return;
    this.segments = src.segments; this._segAyah = n; this._srcCount = sources.length; this.loading = false;
    if (this.next.src === url && this.next.readyState >= 2) { // استخدام المحمّل مسبقًا
      const tmp = this.audio; this.audio = this.next; this.next = tmp;
    } else if (this.audio.src !== url) this.audio.src = url;
    this.audio.playbackRate = this.rate;
    this._emit('ayah', { ayah: n, index: this.index, total: this.queue.length, words: !!src.segments });
    this._updateMediaSession(n);
    this._wantPlay = !!autoplay;
    if (autoplay) {
      try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); this._syncMediaState(); }
      catch (e) { this.playing = false; this._emit('state', 'paused'); this._emit('error', { ayah: n, code: 'play', message: e && e.message }); }
    }
    this._preload();
  }
  _rebind(a = this.audio) {
    if (!a || a._bound) return; a._bound = true;
    a.addEventListener('ended', () => { if (a === this.audio) this._onEnded(); });
    a.addEventListener('error', () => { if (a === this.audio) this._onError(a); });
    a.addEventListener('timeupdate', () => {
      if (a !== this.audio) return;
      const word = this.segments && this._segAyah === this.current ? wordAt(this.segments, a.currentTime) : null;
      this._emit('time', { ayah: this.current, t: a.currentTime, d: a.duration, word });
      if ((a.currentTime | 0) % 5 === 0) this._syncMediaState();
      if (this.sleepAt && Date.now() >= this.sleepAt) { this.sleepAt = null; this.pause(); this._emit('sleep'); }
    });
    a.addEventListener('waiting', () => { if (a === this.audio) this._emit('buffering', true); });
    a.addEventListener('playing', () => { if (a === this.audio) this._emit('buffering', false); });
  }
  /** فشل تحميل الآية: المصدر التالي (quran.com → Islamic Network بمعدلاته) قبل إعلان الخطأ */
  _onError(a) {
    const code = a.error && a.error.code; const n = this.current;
    if (n && this._attempt + 1 < (this._srcCount || 0) && (code === 4 || code === 2 || code === 3)) { this._attempt++; this._emit('fallback', { ayah: n, attempt: this._attempt }); this._load(n, this.playing || this._wantPlay); return; }
    this._emit('error', { ayah: n, code, kind: code === 2 ? 'network' : code === 4 ? 'unavailable' : code === 3 ? 'decode' : 'unknown', reciter: this.reciter });
  }
  async _preload() {
    const nxt = this.queue[this.index + 1]; if (!nxt || !this.next) return;
    try {
      const sources = await this._sources(nxt); const src = sources[Math.min(this._attempt, sources.length - 1)]; if (!src) return;
      let url = src.url; if (this.localResolver) { try { url = (await this.localResolver(url)) || url; } catch { /* تجاهل */ } }
      if (this.next.src !== url) { this.next.src = url; this.next.load(); }
    } catch { /* تجاهل */ }
  }
  _onEnded() {
    if (this._repeatsLeft > 1) { this._repeatsLeft--; this.audio.currentTime = 0; this.audio.play().catch(() => {}); this._emit('repeat', { ayah: this.current, left: this._repeatsLeft }); return; }
    this._repeatsLeft = this.repeatAyah;
    if (this.index + 1 < this.queue.length) { this.index++; this._load(this.current, true); }
    else if (this.repeatRange && this.queue.length) { this.index = 0; this._load(this.current, true); }
    else { this.playing = false; this._emit('state', 'ended'); }
  }
  pause() { if (this.audio) { this.audio.pause(); this.playing = false; this._emit('state', 'paused'); this._syncMediaState(); } }
  async resume() { if (this.audio && this.current) { try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); this._syncMediaState(); } catch { /* تجاهل */ } } }
  toggle() { this.playing ? this.pause() : this.resume(); }
  stop() { this._loadToken++; this.loading = false; if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } this.playing = false; this.index = -1; this.queue = []; this.segments = null; this.sleepAt = null; this._emit('state', 'stopped'); }
  nextAyah() { if (this.index + 1 < this.queue.length) { this.index++; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } }
  prevAyah() { if (this.index > 0) { this.index--; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } else if (this.audio) this.audio.currentTime = 0; }
  setRate(r) { this.rate = r; if (this.audio) this.audio.playbackRate = r; }
  setReciter(id) { const wasPlaying = this.playing; this.reciter = id; this._attempt = 0; if (this.current) { if (this.next) this.next.removeAttribute('src'); this._load(this.current, wasPlaying); } }
  setWords(on) { const changed = this.words !== !!on; this.words = !!on; if (changed && this.current) { this._attempt = 0; if (this.next) this.next.removeAttribute('src'); this._load(this.current, this.playing); } }
  /** مؤقت النوم بالدقائق (0 = إلغاء) */
  setSleep(minutes) { this.sleepAt = minutes > 0 ? Date.now() + minutes * 60000 : null; this._emit('sleep', this.sleepAt); }
  _updateMediaSession(n) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const label = this.meta && this.meta.label ? this.meta.label(n) : `آية ${n}`;
      navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: reciterInfo(this.reciter).name || '', album: 'سكينة — المصحف' });
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevAyah());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextAyah());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      try { navigator.mediaSession.setActionHandler('seekto', (d) => { if (this.audio && typeof d.seekTime === 'number') this.audio.currentTime = d.seekTime; }); } catch { /* غير مدعوم */ }
    } catch { /* تجاهل */ }
  }
  _syncMediaState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !this.audio) return;
    try {
      navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
      if (this.audio.duration && isFinite(this.audio.duration) && navigator.mediaSession.setPositionState) navigator.mediaSession.setPositionState({ duration: this.audio.duration, playbackRate: this.rate, position: Math.min(this.audio.currentTime, this.audio.duration) });
    } catch { /* تجاهل */ }
  }
}
