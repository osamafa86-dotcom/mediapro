import React from "react";
import { AbsoluteFill, Img, random, staticFile, useCurrentFrame } from "remotion";
import { B, H, K, W, easeInOut, lerp, mixHex, ramp } from "./core";

// السماء تتبدّل مع أوقات الصلاة، وضوء المشربية يتحرك مع الشمس

type SkyKey = "night" | "fajr" | "dhuhr" | "asr" | "maghrib";

const SKY: Record<SkyKey, string> = {
  night:
    "radial-gradient(110% 60% at 50% 105%, rgba(20,133,124,0.45) 0%, rgba(20,133,124,0) 65%), linear-gradient(180deg, #020C0B 0%, #062421 55%, #0B3733 100%)",
  fajr:
    "radial-gradient(95% 42% at 72% 106%, rgba(236,164,122,0.9) 0%, rgba(236,164,122,0) 72%), linear-gradient(180deg, #061620 0%, #0D2C38 46%, #29434D 76%, #7C6763 100%)",
  dhuhr:
    "radial-gradient(85% 40% at 58% -6%, #FFFFFF 0%, rgba(255,255,255,0) 72%), linear-gradient(180deg, #E3EAE6 0%, #E7E3D7 50%, #DDD5C3 100%)",
  asr:
    "radial-gradient(80% 45% at 10% 12%, rgba(255,236,196,0.95) 0%, rgba(255,236,196,0) 66%), linear-gradient(180deg, #EAD8B6 0%, #E2C597 58%, #D3A876 100%)",
  maghrib:
    "radial-gradient(105% 52% at 14% 102%, rgba(255,166,86,0.95) 0%, rgba(255,166,86,0) 72%), linear-gradient(180deg, #161B30 0%, #3E2E4A 34%, #9A5248 70%, #E4904F 100%)",
};

/** جدول السماء: [إطار، سماء] والانتقال بين كل اثنين متتاليين */
const SCHEDULE: Array<[number, SkyKey]> = [
  [0, "night"],
  [B.fajr[0] - 10, "night"],
  [B.fajr[0] + 14, "fajr"],
  [B.dhuhr[0] - 8, "fajr"],
  [B.dhuhr[0] + 12, "dhuhr"],
  [B.asr[0] - 8, "dhuhr"],
  [B.asr[0] + 12, "asr"],
  [B.maghrib[0] - 8, "asr"],
  [B.maghrib[0] + 12, "maghrib"],
  [B.one[0] + 8, "maghrib"],
  [B.one[0] + 46, "night"],
  [100000, "night"],
];

export const skyAt = (f: number) => {
  let i = 0;
  while (i < SCHEDULE.length - 2 && f >= SCHEDULE[i + 1][0]) i++;
  const [f0, k0] = SCHEDULE[i];
  const [f1, k1] = SCHEDULE[i + 1];
  const t = k0 === k1 ? 0 : ramp(f, f0, f1, easeInOut);
  return { k0, k1, t };
};

const TONE: Record<SkyKey, number> = { night: 0, fajr: 0, dhuhr: 1, asr: 1, maghrib: 0 };

/** ٠ = خلفية داكنة (نص فاتح)، ١ = خلفية فاتحة (نص داكن) */
export const toneAt = (f: number) => {
  const { k0, k1, t } = skyAt(f);
  return lerp(TONE[k0], TONE[k1], t);
};

export const inkFor = (f: number, light = "#FFFFFF", dark: string = K.ink) => mixHex(light.length === 7 ? light : "#FFFFFF", dark, toneAt(f));

type Win = { light: number; bars: number; x: number; y: number; w: number; h: number; rot: number; skew: number; blur: number; r: number; g: number; b: number };
// نافذة مشربية مقوّسة (قوس كقبة الشعار) يسقط ضوؤها على الجدار ويتحرك مع الشمس
const WIN: Record<SkyKey, Win> = {
  night: { light: 0, bars: 0, x: 540, y: 1300, w: 860, h: 1500, rot: 0, skew: 0, blur: 8, r: 160, g: 220, b: 210 },
  fajr: { light: 0.16, bars: 0.4, x: 700, y: 1400, w: 820, h: 1400, rot: -4, skew: -12, blur: 10, r: 150, g: 196, b: 214 },
  dhuhr: { light: 0.9, bars: 0.42, x: 560, y: 1330, w: 900, h: 1540, rot: 0, skew: -4, blur: 4.5, r: 255, g: 252, b: 240 },
  asr: { light: 0.85, bars: 0.4, x: 640, y: 1300, w: 900, h: 1500, rot: 3, skew: 16, blur: 6, r: 255, g: 232, b: 186 },
  maghrib: { light: 0.42, bars: 0.45, x: 700, y: 1350, w: 900, h: 1400, rot: 6, skew: 28, blur: 7, r: 255, g: 170, b: 104 },
};

export const windowAt = (f: number): Win => {
  const { k0, k1, t } = skyAt(f);
  const a = WIN[k0];
  const b = WIN[k1];
  const o = {} as Win;
  (Object.keys(a) as (keyof Win)[]).forEach((k) => (o[k] = lerp(a[k], b[k], t)));
  return o;
};

const TILE = 150;

/** قضبان المشربية: نجمة ثمانية في كل خلية مع وصلاتها */
const LatticeBars: React.FC<{ w: number; h: number; color: string; id: string }> = ({ w, h, color, id }) => {
  const c = TILE / 2;
  const R = TILE * 0.36;
  const star = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? R : R * 0.64;
      return `${c + rr * Math.cos(a)},${c + rr * Math.sin(a)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse" x={(w % TILE) / 2} y={0}>
          <g fill="none" stroke={color} strokeWidth={TILE * 0.07} strokeLinejoin="round">
            <polygon points={star} />
            <line x1={0} y1={c} x2={c - R * 0.92} y2={c} />
            <line x1={c + R * 0.92} y1={c} x2={TILE} y2={c} />
            <line x1={c} y1={0} x2={c} y2={c - R * 0.92} />
            <line x1={c} y1={c + R * 0.92} x2={c} y2={TILE} />
            <rect x={0} y={0} width={TILE} height={TILE} strokeWidth={TILE * 0.05} />
          </g>
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${id})`} />
    </svg>
  );
};

/** ضوء النافذة المقوّسة على الجدار */
export const WindowLight: React.FC<{ f: number }> = ({ f }) => {
  const L = windowAt(f);
  if (L.light < 0.004) return null;
  const { w, h } = L;
  const arch = `path("M0 ${h} V${w * 0.5} A${w * 0.5} ${w * 0.5} 0 0 1 ${w} ${w * 0.5} V${h} Z")`;
  const drift = Math.sin(f * 0.01) * 6;
  const col = `rgb(${L.r},${L.g},${L.b})`;
  return (
    <div
      style={{
        position: "absolute",
        left: L.x - w / 2 + drift,
        top: L.y - h / 2,
        width: w,
        height: h,
        rotate: `${L.rot}deg`,
        transform: `skewX(${L.skew}deg)`,
        filter: `blur(${L.blur}px)`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, clipPath: arch, opacity: L.light, mixBlendMode: "screen", background: `radial-gradient(70% 60% at 50% 40%, ${col} 0%, ${col} 55%, rgba(${L.r},${L.g},${L.b},0.55) 100%)` }} />
      <div style={{ position: "absolute", inset: 0, clipPath: arch, opacity: L.bars * L.light, mixBlendMode: "multiply" }}>
        <LatticeBars w={w} h={h} color="#3A3426" id="winBars" />
      </div>
    </div>
  );
};

/** موضع الشمس على قوس من الفجر (يمين أسفل) إلى المغرب (يسار أسفل) */
export const sunAt = (f: number) => {
  const u = lerp(0, 1, ramp(f, B.fajr[0] - 10, B.maghrib[1], (t) => t));
  const x = lerp(1000, 70, u);
  const y = 1780 - Math.sin(Math.min(1, u * 1.04) * Math.PI) * 1640;
  const vis = Math.min(ramp(f, B.fajr[1] - 20, B.dhuhr[0] + 10), 1 - ramp(f, B.maghrib[1] - 4, B.one[0] + 30));
  return { x, y, vis };
};

const Sun: React.FC<{ f: number }> = ({ f }) => {
  const s = sunAt(f);
  if (s.vis <= 0.001) return null;
  const warm = ramp(f, B.asr[0], B.maghrib[0] + 30, (t) => t);
  const core = mixHex("#FFF8E8", "#FFC07A", warm);
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, opacity: s.vis }}>
      <div
        style={{
          position: "absolute",
          left: -520,
          top: -520,
          width: 1040,
          height: 1040,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${core} 0%, rgba(255,226,170,0.35) 12%, rgba(255,226,170,0.12) 32%, rgba(255,226,170,0) 62%)`,
          mixBlendMode: "screen",
        }}
      />
      <div style={{ position: "absolute", left: -58, top: -58, width: 116, height: 116, borderRadius: "50%", background: core, boxShadow: `0 0 80px 30px ${core}` }} />
    </div>
  );
};

const Stars: React.FC<{ f: number; amount: number }> = ({ f, amount }) => {
  if (amount <= 0.01) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: amount }}>
      {new Array(70).fill(0).map((_, i) => {
        const x = random(`sx${i}`) * W;
        const y = random(`sy${i}`) * H * 0.75;
        const r = 0.9 + random(`sr${i}`) * 2.1;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(f * (0.02 + random(`st${i}`) * 0.05) + random(`sp${i}`) * 6));
        return <circle key={i} cx={x} cy={y} r={r} fill={i % 7 === 0 ? K.goldLight : "#FFFFFF"} opacity={tw * 0.75} />;
      })}
    </svg>
  );
};

/** حبيبات فيلم متحركة: بلاطات 512 تُرصف بعناصر Img حتى ينتظر Remotion تحميلها في كل إطار */
export const Grain: React.FC<{ f: number; opacity?: number }> = ({ f, opacity = 0.075 }) => {
  const src = staticFile(`ad30/grain/g${Math.floor(f / 2) % 8}.png`);
  const ox = ((f * 37) % 512) - 512;
  const oy = ((f * 61) % 512) - 512;
  const tiles: Array<[number, number]> = [];
  for (let y = oy; y < H; y += 512) for (let x = ox; x < W; x += 512) tiles.push([x, y]);
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none", overflow: "hidden" }}>
      {tiles.map(([x, y]) => (
        <Img key={`${x}_${y}`} src={src} style={{ position: "absolute", left: x, top: y, width: 512, height: 512 }} />
      ))}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ f: number; strength?: number }> = ({ f, strength = 1 }) => {
  const v = lerp(0.42, 0.16, toneAt(f)) * strength;
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 75% at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,${v}) 100%)` }} />;
};

/** الخلفية الكاملة: سماء + شمس + نجوم + ضوء المشربية */
export const World: React.FC<{ lattice?: boolean }> = ({ lattice = true }) => {
  const f = useCurrentFrame();
  const { k0, k1, t } = skyAt(f);
  const starAmt = (k: SkyKey) => (k === "night" ? 1 : k === "fajr" ? 0.45 : 0);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ background: SKY[k0] }} />
      {t > 0 ? <AbsoluteFill style={{ background: SKY[k1], opacity: t }} /> : null}
      <Stars f={f} amount={lerp(starAmt(k0), starAmt(k1), t)} />
      <Sun f={f} />
      {lattice ? <WindowLight f={f} /> : null}
    </AbsoluteFill>
  );
};
