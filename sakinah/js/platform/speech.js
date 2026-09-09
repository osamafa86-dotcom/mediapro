/**
 * التعرّف على الكلام (Web Speech API) لوضع مراجعة الحفظ.
 * متاح في Chrome/Edge (أندرويد وسطح المكتب) وSafari (iOS 14.5+)؛ يعتمد على خدمة سحابية فيلزم اتصال بالإنترنت.
 * يُعيد التشغيل تلقائيًا عند التوقف (المتصفحات توقف الجلسة بعد صمت) ما دام المستخدم لم يوقفه.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class SpeechListener {
  constructor({ lang = 'ar-SA', onResult, onState, onError } = {}) {
    this.lang = lang; this.onResult = onResult; this.onState = onState; this.onError = onError;
    this.rec = null; this.active = false; this._restartTimer = null; this._lastInterim = '';
  }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    this.stop(true);
    const rec = new SR();
    rec.lang = this.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onstart = () => { this.active = true; this.onState && this.onState('listening'); };
    rec.onresult = (ev) => {
      let finals = [], interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finals.push([...r].map((alt) => alt.transcript)); else interim += r[0].transcript + ' ';
      }
      this.onResult && this.onResult({ finals, interim: interim.trim() });
    };
    rec.onerror = (ev) => {
      const code = ev.error; // 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'audio-capture' | 'service-not-allowed'
      if (code === 'no-speech' || code === 'aborted') return; // يُعاد التشغيل من onend
      this.onError && this.onError(code);
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture' || code === 'network') { this.active = false; this.rec = null; this.onState && this.onState('stopped'); }
    };
    rec.onend = () => {
      if (this.active && this.rec === rec) { // إعادة تشغيل تلقائي بعد توقف المتصفح، مع تراجع وتوقف بعد ثلاث توقفات سريعة متتالية (حلقة أخطاء)
        const quick = Date.now() - this._startedAt < 1500;
        this._rapid = quick ? (this._rapid || 0) + 1 : 0;
        if (this._rapid >= 3) { this.active = false; this.rec = null; this.onError && this.onError('restart-loop'); this.onState && this.onState('stopped'); return; }
        this._restartTimer = setTimeout(() => { try { this._startedAt = Date.now(); rec.start(); } catch { this.active = false; this.onState && this.onState('stopped'); } }, quick ? 250 * 2 ** this._rapid : 250);
      } else this.onState && this.onState('stopped');
    };
    this.rec = rec;
    try { this._startedAt = Date.now(); this._rapid = 0; rec.start(); } catch (e) { this.active = false; throw Object.assign(new Error('start-failed'), { code: 'start-failed', cause: e }); }
  }
  stop(silent = false) {
    clearTimeout(this._restartTimer);
    this.active = false;
    if (this.rec) { const r = this.rec; this.rec = null; try { r.onend = null; r.stop(); } catch {} try { r.abort(); } catch {} }
    if (!silent) this.onState && this.onState('stopped');
  }
}
