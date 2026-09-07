/**
 * مشغّل التلاوة آية بآية (Islamic Network CDN — ملفات mp3 لكل آية برقمها العالمي 1..6236).
 * يدعم: قائمة تشغيل لمدى من الآيات، تكرار الآية، تكرار المدى، سرعة التشغيل، التحميل المسبق للآية التالية،
 * وأزرار شاشة القفل (Media Session API).
 */
export const RECITERS = [
  { id: 'ar.alafasy', name: 'مشاري راشد العفاسي' },
  { id: 'ar.husary', name: 'محمود خليل الحصري (مرتّل)' },
  { id: 'ar.husarymujawwad', name: 'محمود خليل الحصري (مجوّد)' },
  { id: 'ar.abdulsamad', name: 'عبد الباسط عبد الصمد' },
  { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس' },
  { id: 'ar.saoodshuraym', name: 'سعود الشريم' },
  { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي' },
  { id: 'ar.hudhaify', name: 'علي الحذيفي' },
  { id: 'ar.ahmedajamy', name: 'أحمد العجمي' },
  { id: 'ar.shaatree', name: 'أبو بكر الشاطري' },
  { id: 'ar.abdullahbasfar', name: 'عبد الله بصفر' },
  { id: 'ar.muhammadayyoub', name: 'محمد أيوب' },
  { id: 'ar.muhammadjibreel', name: 'محمد جبريل' },
  { id: 'ar.aymanswoaid', name: 'أيمن سويد' },
  { id: 'ar.ibrahimakhbar', name: 'إبراهيم الأخضر' },
  { id: 'ar.hanirifai', name: 'هاني الرفاعي' },
];
export const DEFAULT_RECITER = 'ar.alafasy';
export function ayahAudioUrl(reciter, globalAyah, bitrate = 128) {
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciter}/${globalAyah}.mp3`;
}

export class AyahPlayer {
  constructor() {
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    this.next = typeof Audio !== 'undefined' ? new Audio() : null; // للتحميل المسبق
    if (this.audio) { this.audio.preload = 'auto'; this.next.preload = 'auto'; }
    this.reciter = DEFAULT_RECITER; this.bitrate = 128; this.rate = 1;
    this.queue = []; this.index = -1; this.playing = false;
    this.repeatAyah = 1; this.repeatRange = false; this._repeatsLeft = 1;
    this.listeners = new Map();
    if (this.audio) {
      this.audio.addEventListener('ended', () => this._onEnded());
      this.audio.addEventListener('error', () => this._emit('error', { ayah: this.current, code: this.audio.error && this.audio.error.code }));
      this.audio.addEventListener('timeupdate', () => this._emit('time', { ayah: this.current, t: this.audio.currentTime, d: this.audio.duration }));
      this.audio.addEventListener('waiting', () => this._emit('buffering', true));
      this.audio.addEventListener('playing', () => this._emit('buffering', false));
    }
  }
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
      const tmp = this.audio; this.audio = this.next; this.next = tmp; this._rebind();
    } else this.audio.src = url;
    this.audio.playbackRate = this.rate;
    this._emit('ayah', { ayah: n, index: this.index, total: this.queue.length });
    this._updateMediaSession(n);
    if (autoplay) {
      try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); }
      catch (e) { this.playing = false; this._emit('state', 'paused'); this._emit('error', { ayah: n, code: 'play', message: e && e.message }); }
    }
    this._preload();
  }
  _rebind() {
    // إعادة ربط الأحداث بعد تبديل عنصري الصوت
    const a = this.audio;
    if (a._bound) return; a._bound = true;
    a.addEventListener('ended', () => { if (a === this.audio) this._onEnded(); });
    a.addEventListener('error', () => { if (a === this.audio) this._emit('error', { ayah: this.current, code: a.error && a.error.code }); });
    a.addEventListener('timeupdate', () => { if (a === this.audio) this._emit('time', { ayah: this.current, t: a.currentTime, d: a.duration }); });
    a.addEventListener('waiting', () => { if (a === this.audio) this._emit('buffering', true); });
    a.addEventListener('playing', () => { if (a === this.audio) this._emit('buffering', false); });
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
  pause() { if (this.audio) { this.audio.pause(); this.playing = false; this._emit('state', 'paused'); } }
  async resume() { if (this.audio && this.current) { try { await this.audio.play(); this.playing = true; this._emit('state', 'playing'); } catch {} } }
  toggle() { this.playing ? this.pause() : this.resume(); }
  stop() { if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); } this.playing = false; this.index = -1; this.queue = []; this._emit('state', 'stopped'); }
  nextAyah() { if (this.index + 1 < this.queue.length) { this.index++; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } }
  prevAyah() { if (this.index > 0) { this.index--; this._repeatsLeft = this.repeatAyah; this._load(this.current, true); } else if (this.audio) this.audio.currentTime = 0; }
  setRate(r) { this.rate = r; if (this.audio) this.audio.playbackRate = r; }
  setReciter(id) { const wasPlaying = this.playing; this.reciter = id; if (this.current) { if (this.next) this.next.removeAttribute('src'); this._load(this.current, wasPlaying); } }
  _updateMediaSession(n) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const label = this.meta && this.meta.label ? this.meta.label(n) : `آية ${n}`;
      navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: (RECITERS.find((r) => r.id === this.reciter) || {}).name || '', album: 'سكينة — المصحف' });
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevAyah());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextAyah());
    } catch {}
  }
}
