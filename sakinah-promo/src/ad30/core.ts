import { Easing, interpolate } from "remotion";
import tl from "./timeline.json";

// إعلان سكينة ٣٠ ثانية — الثوابت المشتركة

export const W = 1080;
export const H = 1920;
export const FPS = tl.fps;
export const TOTAL = tl.total;

export type Beat = keyof typeof tl.beats;
export const B = tl.beats as Record<Beat, [number, number]>;
export const VERSE_WORDS = tl.verseWords as number[];
/** مواضع عبارات التعليق (للمراجعة؛ الصوت كله في soundtrack.wav الذي يبنيه scripts/ad30_build.py) */
export const VO = tl.vo as Array<{ id: string; at: number; frames: number; text: string }>;

// ألوان التطبيق (DesignSystem.swift) مع درجات الإعلان
export const K = {
  night0: "#03100F",
  night1: "#062421",
  night2: "#0B3733",
  brand: "#0E5C55",
  teal: "#14857C",
  tealLight: "#3FB5A6",
  mint: "#9FD1CA",
  gold: "#C69C3E",
  goldLight: "#E2C77A",
  goldDot: "#E2B04A",
  paper: "#FBF9F4",
  cream: "#F6F1E2",
  ink: "#16211F",
  inkSoft: "#5D6B68",
};

export const FONT = {
  display: "'Reem Kufi', 'Readex Pro', sans-serif",
  ui: "'Readex Pro', sans-serif",
  quran: "'Uthmanic Hafs', 'Amiri Quran', serif",
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** من ٠ إلى ١ بين إطارين مع تخفيف */
export const ramp = (f: number, a: number, b: number, e: (t: number) => number = easeOut) =>
  interpolate(f, [a, b], [0, 1], { ...CL, easing: e });

/** ظهور ثم اختفاء: يصعد بين a وb ويهبط بين c وd */
export const window4 = (f: number, a: number, b: number, c: number, d: number) =>
  Math.min(ramp(f, a, b), 1 - ramp(f, c, d, easeInOut));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** مزج لونين بصيغة hex */
export const mixHex = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(lerp(x, y, t));
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
};

/** المرحلة الحالية من اليوم وتقدّمها */
export const beatAt = (f: number): Beat => {
  const order = Object.keys(B) as Beat[];
  let cur: Beat = order[0];
  for (const k of order) if (f >= B[k][0]) cur = k;
  return cur;
};
