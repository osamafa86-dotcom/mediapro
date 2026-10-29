'use client';
import { Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type Hls from 'hls.js';
import s from './player.module.css';

const noop = () => () => {};

interface Cue { start: number; end: number; url: string; x: number; y: number; w: number; h: number }

const fmt = (sec: number) => {
  const x = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + `:${String(r).padStart(2, '0')}`;
};

function parseVtt(text: string): Cue[] {
  const t = (s: string) => { const p = s.trim().split(':').map(Number); return p.length === 3 ? p[0]! * 3600 + p[1]! * 60 + p[2]! : p[0]! * 60 + p[1]!; };
  const out: Cue[] = [];
  for (const block of text.split(/\n\n+/)) {
    const lines = block.trim().split('\n');
    const time = lines.find((l) => l.includes('-->'));
    const ref = lines.find((l) => l.includes('#xywh='));
    if (!time || !ref) continue;
    const [a, b] = time.split('-->');
    const [url, frag] = ref.trim().split('#xywh=');
    const [x, y, w, h] = frag!.split(',').map(Number);
    out.push({ start: t(a!), end: t(b!), url: url!, x: x!, y: y!, w: w!, h: h! });
  }
  return out;
}

/**
 * Adaptive streaming player (hls.js; native HLS only where MSE is missing). Our own controls so the time bar never flips
 * in RTL, the shortcuts follow DESIGN §6.6, and the scrub preview comes from the WebVTT sprite.
 */
export function VideoPlayer({ assetId, poster, duration, rungs }: { assetId: string; poster: string; duration: number; rungs: number[] }) {
  const t = useTranslations('portal.player');
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const hls = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [error, setError] = useState(false);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [current, setCurrent] = useState<number | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [hover, setHover] = useState<{ x: number; t: number; w: number } | null>(null);
  const [dur, setDur] = useState(0);
  const [chrome, setChrome] = useState(true);
  const idle = useRef<number | undefined>(undefined);
  const src = `/m/${assetId}/hls/master.m3u8`;
  const pipOk = useSyncExternalStore(noop, () => !!document.pictureInPictureEnabled, () => false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let destroyed = false;
    // hls.js wherever MSE exists (quality choice, capped to the player size); native HLS otherwise (older iOS)
    void import('hls.js').then(({ default: H }) => {
      if (destroyed) return;
      if (!H.isSupported()) {
        if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = src; else setError(true);
        return;
      }
      const h = new H({ capLevelToPlayerSize: true, startLevel: -1 });
      hls.current = h;
      h.loadSource(src);
      h.attachMedia(v);
      h.on(H.Events.MANIFEST_PARSED, (_e, d) => setLevels(d.levels.map((l, index) => ({ index, height: l.height })).sort((a, b) => b.height - a.height)));
      h.on(H.Events.LEVEL_SWITCHED, (_e, d) => setCurrent(h.levels[d.level]?.height ?? null));
      h.on(H.Events.ERROR, (_e, d) => { if (d.fatal) setError(true); });
    });
    void fetch(`/m/${assetId}/sprite.vtt`).then((r) => (r.ok ? r.text() : '')).then((txt) => { if (!destroyed && txt) setCues(parseVtt(txt)); }).catch(() => {});
    return () => { destroyed = true; hls.current?.destroy(); hls.current = null; };
  }, [assetId, src]);

  const toggle = useCallback(() => { const v = video.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }, []);
  const seekBy = useCallback((d: number) => { const v = video.current; if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || duration); }, [duration]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.();
  }, []);
  const poke = useCallback(() => {
    setChrome(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => { if (!video.current?.paused) setChrome(false); }, 2500);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // keyboard: Space/K play-pause · J/L ±10 · ←/→ ±5 (time never mirrors) · F fullscreen · M mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { if (el.tagName === 'BUTTON' && k === ' ') return; e.preventDefault(); toggle(); }
      else if (k === 'j') seekBy(-10);
      else if (k === 'l') seekBy(10);
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
      else if (k === 'f') fullscreen();
      else if (k === 'm' && video.current) video.current.muted = !video.current.muted;
      else return;
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seekBy, fullscreen, poke]);

  const total = dur || duration || 0;
  const pct = total ? (time / total) * 100 : 0;
  const cue = hover ? cues.find((c) => hover.t >= c.start && hover.t < c.end) ?? cues.at(-1) : undefined;
  const top = levels[0]?.height ?? Math.max(0, ...rungs);
  const label = (h: number) => (h >= 2160 ? '4K' : `${h}p`);

  return (
    <div ref={box} className={s.player} data-chrome={chrome || !playing} dir="ltr" onMouseMove={poke} onMouseLeave={() => playing && setChrome(false)} data-testid="player">
      <video
        ref={video} className={s.video} poster={poster} playsInline preload="metadata" crossOrigin="anonymous"
        onClick={toggle}
        onPlay={() => { setPlaying(true); poke(); }} onPause={() => { setPlaying(false); setChrome(true); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setBuffered(b.end(b.length - 1)); }}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onError={() => setError(true)}
      />
      {error ? <p className={s.error} role="alert">{t('error')}</p> : null}
      <div className={s.chrome}>
        <div className={s.track}
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = Math.min(Math.max(0, e.clientX - r.left), r.width); setHover({ x, t: (x / r.width) * total, w: r.width }); }}
          onPointerLeave={() => setHover(null)}>
          {hover && cue ? (
            <div className={s.preview} style={{ left: Math.min(Math.max(hover.x - 90, 0), hover.w - 186) }}>
              <div className={s.previewImg} style={{ backgroundImage: `url(/m/${assetId}/sprite.jpg)`, backgroundPosition: `-${cue.x * (180 / cue.w)}px -${cue.y * (180 / cue.w)}px`, backgroundSize: `${(180 / cue.w) * cue.w * 10}px auto`, height: Math.round(cue.h * (180 / cue.w)) }} />
              <span className={s.previewTime}>{fmt(hover.t)}</span>
            </div>
          ) : null}
          <div className={s.buffered} style={{ width: `${total ? (buffered / total) * 100 : 0}%` }} />
          <div className={s.played} style={{ width: `${pct}%` }} />
          <input type="range" className={s.seek} min={0} max={total || 1} step={0.1} value={time} aria-label={t('seek')} aria-valuetext={`${fmt(time)} / ${fmt(total)}`}
            onChange={(e) => { const v = video.current; if (v) v.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} />
        </div>
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={toggle} aria-label={playing ? t('pause') : t('play')} data-testid="play">
            {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          </button>
          <button type="button" className={`${s.btn} ${s.wide}`} onClick={() => seekBy(-10)} aria-label={t('back')}><RotateCcw size={18} aria-hidden /></button>
          <button type="button" className={s.btn} onClick={() => { if (video.current) video.current.muted = !video.current.muted; }} aria-label={muted ? t('unmute') : t('mute')}>
            {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
          </button>
          <span className={s.time} data-testid="time">{fmt(time)} / {fmt(total)}</span>
          <span className={s.grow} />
          {levels.length > 1 ? (
            <select className={s.quality} aria-label={t('quality')} value={level} data-testid="quality"
              onChange={(e) => { const n = Number(e.target.value); setLevel(n); if (hls.current) hls.current.currentLevel = n; }}>
              <option value={-1}>{t('auto')}{level === -1 && current ? ` · ${label(current)}` : ''}</option>
              {levels.map((l) => <option key={l.index} value={l.index}>{label(l.height)}</option>)}
            </select>
          ) : top ? <span className={s.badge}>{label(top)}</span> : null}
          {pipOk ? (
            <button type="button" className={`${s.btn} ${s.wide}`} aria-label={t('pip')} onClick={() => { const v = video.current; if (!v) return; if (document.pictureInPictureElement) void document.exitPictureInPicture(); else void v.requestPictureInPicture(); }}>
              <PictureInPicture2 size={18} aria-hidden />
            </button>
          ) : null}
          <button type="button" className={s.btn} onClick={fullscreen} aria-label={full ? t('exitFullscreen') : t('fullscreen')}>
            {full ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
