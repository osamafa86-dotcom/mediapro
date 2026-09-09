/**
 * مشغّل التلاوة آية بآية (Islamic Network CDN — ملفات mp3 لكل آية برقمها العالمي 1..6236).
 * يدعم: قائمة تشغيل لمدى من الآيات، تكرار الآية، تكرار المدى، سرعة التشغيل، التحميل المسبق للآية التالية،
 * وأزرار شاشة القفل (Media Session API).
 */
// bitrate: معدلات البت المتاحة فعلًا على الخادم لكل قارئ (مُتحقق منها بطلبات HEAD في سبتمبر 2026)؛ الأول هو المفضّل والبقية بدائل عند فشل التحميل
export const RECITERS = [
  { id: 'ar.alafasy', name: 'مشاري راشد العفاسي', bitrates: [128, 64] },
  { id: 'ar.husary', name: 'محمود خليل الحصري (مرتّل)', bitrates: [128, 64] },
  { id: 'ar.husarymujawwad', name: 'محمود خليل الحصري (مجوّد)', bitrates: [128, 64] },
  { id: 'ar.abdulsamad', name: 'عبد الباسط عبد الصمد', bitrates: [64] },
  { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', bitrates: [64, 192] },
  { id: 'ar.saoodshuraym', name: 'سعود الشريم', bitrates: [64] },
  { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', bitrates: [128, 64] },
  { id: 'ar.hudhaify', name: 'علي الحذيفي', bitrates: [128, 64, 32] },
  { id: 'ar.ahmedajamy', name: 'أحمد العجمي', bitrates: [128, 64] },
  { id: 'ar.shaatree', name: 'أبو بكر الشاطري', bitrates: [128, 64] },
  { id: 'ar.abdullahbasfar', name: 'عبد الله بصفر', bitrates: [64, 192, 32] },
  { id: 'ar.muhammadayyoub', name: 'محمد أيوب', bitrates: [128] },
  { id: 'ar.muhammadjibreel', name: 'محمد جبريل', bitrates: [128] },
  { id: 'ar.aymanswoaid', name: 'أيمن سويد', bitrates: [64] },
  { id: 'ar.ibrahimakhbar', name: 'إبراهيم الأخضر', bitrates: [32] },
  { id: 'ar.hanirifai', name: 'هاني الرفاعي', bitrates: [64, 192] },
];
export const DEFAULT_RECITER = 'ar.alafasy';
export function reciterInfo(id) { return RECITERS.find((r) => r.id === id) || RECITERS[0]; }
/** معدل البت المناسب للقارئ (المفضّل أولًا)؛ attempt > 0 يعطي البدائل بالترتيب */
export function reciterBitrate(id, attempt = 0) { const b = reciterInfo(id).bitrates; return b[Math.min(attempt, b.length - 1)]; }
export function ayahAudioUrl(reciter, globalAyah, bitrate = reciterBitrate(reciter)) {
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciter}/${globalAyah}.mp3`;
}

export class AyahPlayer {
  constructor() {
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    this.next = typeof Audio !== 'undefined' ? new Audio() : null; // للتحميل المسبق
    if (this.audio) { this.audio.preload = 'auto'; this.next.preload = 'auto'; }
    this.reciter = DEFAULT_RECITER; this.rate = 1; this._attempt = 0; // _attempt: فهرس معدل البت الحالي (يرتفع عند فشل التحميل)
    this.queue = []; this.index = -1; this.playing = false;
    this.repeatAyah = 1; this.repeatRange = false; this._repeatsLeft = 1;
    this.listeners = new Map();
    // كلا العنصرين يُربطان بحارس هوية العنصر النشط؛ وإلا أطلق فشلُ التحميل المسبق تنبيه خطأ أثناء تشغيل صحيح
    if (this.audio) { this._rebind(this.audio); this._rebind(this.next); }
  }
  get bitrate() { return reciterBitrate(this.reciter, this._attempt); }
  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); return () => this.listeners.get(ev).delete(fn); }
  _emit(ev, data) { (this.listeners.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  get current() { return this.index >= 0 ? this.queue[this.index] : null; }

  /** تشغيل قائمة آيات (أرقام عالمية) بدءًا من فهرس معيّن */
  async play(queue, startIndex = 0, meta = {}) {
    if (!this.audio) return;
    this.queue = queue; this.index = startIndex; this.meta = meta; this._repeatsLeft = this.repeatAyah;
    await this._load(this.current, true);
  }
  async _load(n, autoplay) {
    if (!this.audio || !n) return;
    const url = ayahAudioUrl(this.reciter, n, this.bitrate);
    if (this.next.src === url && this.next.readyState >= 2) { // استخدام المحمّل مسبقًا
      const tmp = this.audio; this.audio = this.next; this.next = tmp;
    } else this.audio.src = url;
    this.audio.playbackRate = this.rate;
    this._emit('ayah', { ayah: n, index: this.index, total: this.queue.length });
    this._updateMediaSession(n);
    this._wantPlay = !!autoplay;
    if (autoplay) {
      try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); this._syncMediaState(); }
      catch (e) { this.playing = false; this._emit('state', 'paused'); this._emit('error', { ayah: n, code: 'play', message: e && e.message }); }
    }
    this._preload();
  }
  _rebind(a = this.audio) {
    // ربط أحداث عنصر صوت مرة واحدة، مع حارس: لا يُعتد بالحدث إلا إن كان العنصر هو النشط وقت وقوعه
    if (!a || a._bound) return; a._bound = true;
    a.addEventListener('ended', () => { if (a === this.audio) this._onEnded(); });
    a.addEventListener('error', () => { if (a === this.audio) this._onError(a); });
    a.addEventListener('timeupdate', () => { if (a === this.audio) { this._emit('time', { ayah: this.current, t: a.currentTime, d: a.duration }); if ((a.currentTime | 0) % 5 === 0) this._syncMediaState(); } });
    a.addEventListener('waiting', () => { if (a === this.audio) this._emit('buffering', true); });
    a.addEventListener('playing', () => { if (a === this.audio) this._emit('buffering', false); });
  }
  /** فشل تحميل الآية: جرّب معدل بت بديلًا للقارئ نفسه (مرة لكل بديل) قبل إعلان الخطأ، مع تمييز خطأ الشبكة عن ملف غير متاح */
  _onError(a) {
    const code = a.error && a.error.code; const n = this.current;
    const alts = reciterInfo(this.reciter).bitrates.length;
    if (n && this._attempt + 1 < alts && (code === 4 || code === 2)) { this._attempt++; this._emit('fallback', { ayah: n, bitrate: this.bitrate }); this._load(n, this.playing || this._wantPlay); return; }
    this._emit('error', { ayah: n, code, kind: code === 2 ? 'network' : code === 4 ? 'unavailable' : code === 3 ? 'decode' : 'unknown', reciter: this.reciter });
  }
  _preload() {
    const nxt = this.queue[this.index + 1];
    if (nxt && this.next) { const url = ayahAudioUrl(this.reciter, nxt, this.bitrate); if (this.next.src !== url) { this.next.src = url; this.next.load(); } }
  }
  _onEnded() {
    if (this._repeatsLeft > 1) { this._repeatsLeft--; this.audio.currentTime = 0; this.audio.play().catch(() => {}); this._emit('repeat', { ayah: this.current, left: this._repeatsLeft }); return; }
    this._repeatsLeft = this.repeatAyah;
    if (this.index + 1 < this.queue.length) { this.index++; this._load(this.current, true); }
    else if (this.repeatRange && this.queue.length) { this.index = 0; this._load(this.current, true); }
    else { this.playing = false; this._emit('state', 'ended'); }
  }
  pause() { if (this.audio) { this.audio.pause(); this.playing = false; this._emit('state', 'paused'); this._syncMediaState(); } }
  async resume() { if (this.audio && this.current) { try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); this._syncMediaState(); } catch {} } }
  toggle() { this.playing ? this.pause() : this.resume(); }
  stop() { if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } this.playing = false; this.index = -1; this.queue = []; this._emit('state', 'stopped'); }
  nextAyah() { if (this.index + 1 < this.queue.length) { this.index++; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } }
  prevAyah() { if (this.index > 0) { this.index--; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } else if (this.audio) this.audio.currentTime = 0; }
  setRate(r) { this.rate = r; if (this.audio) this.audio.playbackRate = r; }
  setReciter(id) { const wasPlaying = this.playing; this.reciter = id; this._attempt = 0; if (this.current) { if (this.next) this.next.removeAttribute('src'); this._load(this.current, wasPlaying); } }
  _updateMediaSession(n) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const label = this.meta && this.meta.label ? this.meta.label(n) : `آية ${n}`;
      navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: (RECITERS.find((r) => r.id === this.reciter) || {}).name || '', album: 'سكينة — المصحف' });
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevAyah());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextAyah());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      try { navigator.mediaSession.setActionHandler('seekto', (d) => { if (this.audio && typeof d.seekTime === 'number') this.audio.currentTime = d.seekTime; }); } catch { /* غير مدعوم */ }
    } catch {}
  }
  /** تحديث حالة الجلسة الإعلامية (شاشة القفل) عند التشغيل/الإيقاف وموضع التقدم */
  _syncMediaState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !this.audio) return;
    try {
      navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
      if (this.audio.duration && isFinite(this.audio.duration) && navigator.mediaSession.setPositionState) navigator.mediaSession.setPositionState({ duration: this.audio.duration, playbackRate: this.rate, position: Math.min(this.audio.currentTime, this.audio.duration) });
    } catch { /* تجاهل */ }
  }
}
