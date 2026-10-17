import React from "react";
import { AbsoluteFill } from "remotion";
import { B, easeInOut, easeOut, lerp, ramp } from "../core";
import { Phone3D, PhonePose, ScreenScale } from "../Phone3D";
import { Headline, PrayerBar } from "../Type";
import { sunAt, toneAt } from "../World";
import { LockScreen } from "../screens/LockScreen";
import { AdhkarScreen, MushafScreen, QiblaScreen, StaticShot } from "../screens/AppScreens";

// اليوم من الفجر إلى المغرب: هاتف واحد يرافق اليوم، وكل صلاة تفتح ميزة

// المفتاح: [إطار، وضعية، تخفيف المقطع المنتهي عنده (اختياري، الافتراضي دخول وخروج ناعمان)]
type Key = [number, Partial<PhonePose>, ((t: number) => number)?];

const interpPose = (f: number, keys: Key[]): PhonePose => {
  const base: PhonePose = { x: 540, y: 1230, s: 600, rx: 0, ry: 0, rz: 0, z: 0 };
  // املأ القيم الناقصة من المفتاح السابق
  const full: Array<[number, PhonePose, (t: number) => number]> = [];
  let prev = base;
  for (const [fr, p, e] of keys) {
    prev = { ...prev, ...p };
    full.push([fr, prev, e ?? easeInOut]);
  }
  if (f <= full[0][0]) return full[0][1];
  if (f >= full[full.length - 1][0]) return full[full.length - 1][1];
  let i = 0;
  while (f > full[i + 1][0]) i++;
  const [f0, a] = full[i];
  const [f1, b, ease] = full[i + 1];
  const t = ease((f - f0) / (f1 - f0));
  const o = {} as PhonePose;
  (Object.keys(a) as (keyof PhonePose)[]).forEach((k) => (o[k] = lerp(a[k] as number, b[k] as number, t)));
  return o;
};

const F0 = B.fajr[0];
const D0 = B.dhuhr[0];
const A0 = B.asr[0];
const M0 = B.maghrib[0];
const O0 = B.one[0];

const KEYS: Key[] = [
  // يصعد الهاتف من خارج الإطار بعد أن يرتفع الشعار، سريعًا ثم يهدأ في مكانه
  [F0 - 6, { y: 1230 + 1400, rx: 26, ry: -18, rz: 4 }],
  [F0 + 16, { y: 1230, rx: 14, ry: -12, rz: 2 }, easeOut],
  [D0 - 6, { y: 1222, rx: 10, ry: -5, rz: 0.5 }],
  [D0 + 1, { ry: 26, rx: 7, rz: -1, y: 1226 }],
  [D0 + 14, { ry: 8, rx: 6 }],
  [A0 - 6, { ry: 2, rx: 4, rz: -0.4 }],
  [A0 + 1, { ry: -24, rx: 6 }],
  [A0 + 14, { ry: -6, rx: 5, s: 600, y: 1230 }],
  [M0 - 8, { ry: -2, rx: 3, s: 760, y: 1440 }],
  [M0 + 1, { ry: 24, rx: 7, s: 660, y: 1300 }],
  [M0 + 14, { ry: 8, rx: 7, s: 600, y: 1230 }],
  [O0 - 4, { ry: 2, rx: 5, rz: 0 }],
  [O0 + 10, { ry: 0, rx: 0, s: 330, y: 1150 }],
];

const SWAPS = [D0 + 1, A0 + 1, M0 + 1];

/** شاشة كل مرحلة */
const ScreenAt: React.FC<{ f: number; which: number; s: number }> = ({ f, which, s }) => {
  if (which === 0)
    return (
      <ScreenScale s={s} native={440}>
        <LockScreen f={f - (F0 - 6)} notifyAt={16} />
      </ScreenScale>
    );
  if (which === 1)
    return (
      <ScreenScale s={s} native={1320}>
        <QiblaScreen f={f} start={D0 + 6} settle={D0 + 42} />
      </ScreenScale>
    );
  if (which === 2)
    return (
      <ScreenScale s={s} native={1320}>
        <MushafScreen f={f} start={A0 + 12} perWord={5.4} />
      </ScreenScale>
    );
  return (
    <ScreenScale s={s} native={1320}>
      <AdhkarScreen f={f} start={M0 + 12} end={M0 + 50} />
    </ScreenScale>
  );
};

export const phoneShadow = (f: number, x: number, y: number) => {
  const sun = sunAt(f);
  const tone = toneAt(f);
  const vx = x - sun.x;
  const vy = y - sun.y;
  const len = Math.max(1, Math.hypot(vx, vy));
  const reach = lerp(28, 70, tone) * Math.max(0.35, sun.vis);
  return { dx: (vx / len) * reach, dy: (vy / len) * reach + 26, blur: lerp(46, 30, tone), opacity: lerp(0.55, 0.3, tone) };
};

export const DayScene: React.FC<{ f: number }> = ({ f }) => {
  if (f < F0 - 18 || f > O0 + 12) return null;
  const pose = interpPose(f, KEYS);
  const tone = toneAt(f);
  // أي شاشة، وتلاشٍ متقاطع حول نقطة التبديل
  let which = 0;
  SWAPS.forEach((sw, i) => {
    if (f >= sw) which = i + 1;
  });
  const sw = SWAPS[which - 1];
  const fade = which > 0 ? ramp(f, sw - 3, sw + 4, easeInOut) : 1;
  // ومضة خفيفة على الزجاج وقت الدوران
  const turnGlare = SWAPS.reduce((m, s) => Math.max(m, 1 - Math.min(1, Math.abs(f - s) / 8)), 0);
  const shadow = phoneShadow(f, pose.x, pose.y);
  // تقدّم شريط الصلوات
  const active =
    ramp(f, D0 - 2, D0 + 10, easeInOut) + ramp(f, A0 - 2, A0 + 10, easeInOut) + ramp(f, M0 - 2, M0 + 10, easeInOut) + ramp(f, O0 + 4, O0 + 18, easeInOut);
  const barOpacity = ramp(f, F0 + 2, F0 + 16) * (1 - ramp(f, O0 + 34, O0 + 48));
  const handoff = ramp(f, O0 + 8, O0 + 12);
  return (
    <AbsoluteFill>
      <div style={{ opacity: 1 - handoff }}>
        <Phone3D pose={pose} shadow={shadow} glare={1 + turnGlare * 1.6} island={which === 0}>
          {which > 0 && fade < 1 ? <ScreenAt f={f} which={which - 1} s={pose.s} /> : null}
          <div style={{ position: "absolute", inset: 0, opacity: fade }}>
            <ScreenAt f={f} which={which} s={pose.s} />
          </div>
        </Phone3D>
      </div>
      <PrayerBar active={active} tone={tone} y={210} opacity={barOpacity} />
      <Headline f={f} title="الأذان في وقته" sub="حتى والتطبيق مغلق" start={F0 + 8} out={D0 - 8} tone={tone} y={350} />
      <Headline f={f} title="قبلتك أينما كنت" sub="بدقّة نحو الكعبة" start={D0 + 6} out={A0 - 8} tone={tone} y={350} />
      <Headline f={f} title="مصحف المدينة كاملًا" sub="بتلاوات ٢٠ قارئًا" start={A0 + 6} out={M0 - 8} tone={tone} y={350} />
      <Headline f={f} title="أذكار الصباح والمساء" sub="وحصن المسلم كاملًا" start={M0 + 6} out={O0 - 6} tone={tone} y={350} />
    </AbsoluteFill>
  );
};

/* ───────────── في مكانٍ واحد: الشاشات الأربع معًا ───────────── */
// الترتيب من اليمين كما يُقرأ: الصلاة ثم القبلة ثم القرآن ثم الأذكار (الأخيرة فوق، وهي الهاتف الذي يسلّم المشهد)
const FAN = [
  { src: "04-home.jpg", x: 812, y: 1186, rz: 10, ry: -16 },
  { src: "05-qibla.jpg", x: 632, y: 1140, rz: 3.5, ry: -6 },
  { src: "01-mushaf.jpg", x: 448, y: 1140, rz: -3.5, ry: 6 },
  { src: "06-adhkar.jpg", x: 268, y: 1186, rz: -10, ry: 16 },
];

export const OnePlaceScene: React.FC<{ f: number }> = ({ f }) => {
  const a = O0 + 8;
  const b = B.promise[0] + 8;
  if (f < a || f > b) return null;
  const close = ramp(f, b - 16, b, easeInOut);
  const tone = toneAt(f);
  return (
    <AbsoluteFill>
      {FAN.map((p, i) => {
        const k = ramp(f, a + (3 - i) * 2, a + 20 + (3 - i) * 2, easeInOut) * (1 - close);
        const pose: PhonePose = {
          x: lerp(540, p.x, k),
          y: lerp(1150, p.y, k) + close * 80,
          s: 330 * (1 - close * 0.15),
          rx: 4,
          ry: lerp(0, p.ry, k),
          rz: lerp(0, p.rz, k),
          z: 0,
        };
        return (
          <div key={p.src} style={{ opacity: (i === 3 ? 1 : ramp(f, a, a + 6)) * (1 - close) }}>
            <Phone3D pose={pose} shadow={{ ...phoneShadow(f, pose.x, pose.y), opacity: 0.45 }} glare={0.8}>
              <ScreenScale s={pose.s} native={1320}>
                <StaticShot src={p.src} />
              </ScreenScale>
            </Phone3D>
          </div>
        );
      })}
      <Headline f={f} title="في مكانٍ واحد" start={a + 4} out={b - 14} tone={tone} y={420} size={104} />
    </AbsoluteFill>
  );
};
