'use client';
import { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import s from './media.module.css';

/**
 * A silent preview over a video tile while the mouse rests on it (the owner's ask, 2026-10-30): no click, no
 * player window. It starts after a short pause (passing over the grid loads nothing), streams the lowest rung
 * of the same HLS the player uses, loops muted, and is torn down the moment the mouse leaves. Mouse only —
 * on touch a tap still opens the player.
 */
export function HoverVideo({ assetId, active, fit = 'cover' }: { assetId: string; active: boolean; fit?: 'cover' | 'contain' }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!active || !v) return;
    let dead = false;
    let h: Hls | null = null;
    const timer = window.setTimeout(() => {
      void import('hls.js').then(({ default: H }) => {
        if (dead) return;
        const src = `/m/${assetId}/hls/master.m3u8`;
        if (H.isSupported()) {
          h = new H({ startLevel: 0, capLevelToPlayerSize: true, maxBufferLength: 6, maxMaxBufferLength: 10 });
          h.loadSource(src);
          h.attachMedia(v);
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = src;
        else return;
        v.play().catch(() => {});
      });
    }, 180);
    return () => { dead = true; window.clearTimeout(timer); h?.destroy(); v.removeAttribute('src'); v.load(); };
  }, [active, assetId]);
  if (!active) return null;
  return (
    <video ref={ref} className={s.hoverVideo} data-fit={fit} muted playsInline loop preload="none" aria-hidden tabIndex={-1} data-testid="hover-preview"
      onPlaying={(e) => { e.currentTarget.dataset.on = 'true'; }} />
  );
}

/** Pointer events that turn a hover preview on and off — the mouse only (a finger's touch is a tap). */
export function hoverHandlers(id: string, set: (id: string | null) => void) {
  return {
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') set(id); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') set(null); },
  };
}
