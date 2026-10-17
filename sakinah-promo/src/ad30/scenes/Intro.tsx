import React from "react";
import { AbsoluteFill } from "remotion";
import { B, FONT, K, VERSE_WORDS, easeInOut, lerp, ramp } from "../core";

// الآية بخط مصحف المدينة، ثم النقطة الذهبية تصير نقطة أيقونة سكينة ويُرسم الشعار

const VERSE: string[][] = [
  ["أَلَا", "بِذِكْرِ", "ٱللَّهِ"],
  ["تَطْمَئِنُّ", "ٱلْقُلُوبُ"],
];

export const DOT_START = { x: 540, y: 740 };

/** وردة ذهبية ثمانية خلف الشعار */
export const Rosette: React.FC<{ size: number; rot: number; opacity: number }> = ({ size, rot, opacity }) => {
  const r = size / 2;
  const sq = (rr: number, a0: number) =>
    [0, 1, 2, 3]
      .map((i) => {
        const a = a0 + (i * Math.PI) / 2;
        return `${r + rr * Math.cos(a)},${r + rr * Math.sin(a)}`;
      })
      .join(" ");
  return (
    <svg width={size} height={size} style={{ position: "absolute", left: -r, top: -r, opacity, rotate: `${rot}deg` }}>
      <circle cx={r} cy={r} r={r * 0.97} fill="none" stroke="rgba(226,199,122,0.30)" strokeWidth={1.6} />
      <circle cx={r} cy={r} r={r * 0.93} fill="none" stroke="rgba(226,199,122,0.16)" strokeWidth={1.2} strokeDasharray="1.5 9" />
      <g fill="none" stroke="rgba(226,199,122,0.17)" strokeWidth={1.6} strokeLinejoin="round">
        <polygon points={sq(r * 0.86, Math.PI / 4)} />
        <polygon points={sq(r * 0.86, 0)} />
      </g>
      <g fill="none" stroke="rgba(226,199,122,0.10)" strokeWidth={1.4}>
        <polygon points={sq(r * 0.6, Math.PI / 4 + Math.PI / 8)} />
        <polygon points={sq(r * 0.6, Math.PI / 8)} />
        <circle cx={r} cy={r} r={r * 0.6} />
      </g>
    </svg>
  );
};

export const GoldDot: React.FC<{ x: number; y: number; r: number; glow: number }> = ({ x, y, r, glow }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <div
      style={{
        position: "absolute",
        left: -r * 9,
        top: -r * 9,
        width: r * 18,
        height: r * 18,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(242,200,110,${0.55 * glow}) 0%, rgba(226,176,74,${0.18 * glow}) 30%, rgba(226,176,74,0) 70%)`,
      }}
    />
    <div style={{ position: "absolute", left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FFE7A8, #E2B04A 60%, #B8862C)" }} />
  </div>
);

export const VerseScene: React.FC<{ f: number }> = ({ f }) => {
  const [a, b] = B.verse;
  if (f < a - 2 || f > b + 4) return null;
  const emerge = 1 - ramp(f, a, a + 40, easeInOut) * 0.7; // يخرج من السواد
  const out = ramp(f, b - 22, b - 4, easeInOut);
  const dotIn = ramp(f, a + 2, a + 14);
  const breathe = 0.85 + 0.15 * Math.sin((f - a) * 0.12);
  const push = lerp(1, 1.05, ramp(f, a, b, (t) => t));
  let wi = 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: emerge }} />
      <GoldDot x={DOT_START.x} y={DOT_START.y} r={13 * dotIn} glow={dotIn * breathe} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 830, scale: String(push), direction: "rtl" }}>
        {VERSE.map((line, li) => (
          <div key={li} style={{ display: "flex", justifyContent: "center", columnGap: "0.3em", fontFamily: FONT.quran, fontSize: 112, lineHeight: 1.8 }}>
            {line.map((w) => {
              const s = VERSE_WORDS[wi++];
              const t = ramp(f, s, s + 22);
              return (
                <span
                  key={w}
                  style={{
                    display: "inline-block",
                    opacity: t * (1 - out),
                    translate: `0px ${(1 - t) * 26 - out * 20}px`,
                    filter: `blur(${(1 - t) * 14 + out * 10}px)`,
                    backgroundImage: "linear-gradient(180deg, #FFF3D2 0%, #EBCB86 55%, #C69C3E 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    textShadow: "0 0 30px rgba(226,176,74,0.18)",
                    padding: "0 4px",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        ))}
        <div
          style={{
            marginTop: 26,
            textAlign: "center",
            fontFamily: FONT.ui,
            fontWeight: 300,
            fontSize: 36,
            color: K.mint,
            opacity: ramp(f, VERSE_WORDS[4] + 10, VERSE_WORDS[4] + 30) * 0.8 * (1 - out),
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 22,
          }}
        >
          <span style={{ width: 60, height: 1.5, background: K.gold, opacity: 0.7 }} />
          سورة الرعد، الآية ٢٨
          <span style={{ width: 60, height: 1.5, background: K.gold, opacity: 0.7 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── الشعار ───────────── */
const ICON = { cx: 540, cy: 900, size: 380 };
const sc = ICON.size / 512;
export const ICON_DOT = { x: ICON.cx - ICON.size / 2 + 392 * sc, y: ICON.cy - ICON.size / 2 + 120 * sc };

const PATHS = [
  "M256 92c-30 52-50 86-50 130a50 50 0 0 0 100 0c0-44-20-78-50-130Z",
  "M118 400v-92a138 138 0 0 1 276 0v92",
  "M86 400h340",
  "M206 400v-52a50 50 0 0 1 100 0v52",
];

export const SakinahIcon: React.FC<{ draw: number[]; tile: number; size: number; dot: boolean; stroke?: string }> = ({ draw, tile, size, dot, stroke = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" style={{ position: "absolute", left: -size / 2, top: -size / 2, overflow: "visible" }}>
    <defs>
      <linearGradient id="tileG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#14857c" />
        <stop offset="1" stopColor="#0a4a46" />
      </linearGradient>
    </defs>
    <g opacity={tile} transform={`translate(256 256) scale(${0.86 + 0.14 * tile}) translate(-256 -256)`}>
      <rect width="512" height="512" rx="112" fill="url(#tileG)" />
      <rect x="1.5" y="1.5" width="509" height="509" rx="111" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
    </g>
    <g fill="none" stroke={stroke} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
      {PATHS.map((d, i) => (
        <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw[i]} opacity={draw[i] > 0.001 ? 1 : 0} />
      ))}
    </g>
    {dot ? <circle cx="392" cy="120" r="14" fill="#e2b04a" /> : null}
  </svg>
);

export const LogoScene: React.FC<{ f: number; nameAt: number; hitAt: number }> = ({ f, nameAt, hitAt }) => {
  const [a, b] = B.logo;
  if (f < a - 4 || f > b + 20) return null;
  // النقطة تنتقل من مكانها في الآية إلى مكانها في الأيقونة
  const m = ramp(f, a - 2, a + 22, easeInOut);
  const dx = lerp(DOT_START.x, ICON_DOT.x, m);
  const dy = lerp(DOT_START.y, ICON_DOT.y, m);
  const draws = [0, 1, 2, 3].map((i) => ramp(f, a + 10 + i * 7, a + 40 + i * 7, easeInOut));
  // البلاطة تكتمل مع الضربة المنخفضة، ونبضة خفيفة لحظتها
  const tile = ramp(f, hitAt - 12, hitAt + 1);
  const pulse = ramp(f, hitAt - 1, hitAt + 3) * (1 - ramp(f, hitAt + 3, hitAt + 16, easeInOut));
  const name = ramp(f, nameAt - 4, nameAt + 14);
  // بعد نطق الاسم يرتفع الشعار ويتلاشى بينما يصعد الهاتف من الأسفل، فلا يتراكبان
  const exit = ramp(f, b - 14, b + 6, easeInOut);
  const rose = ramp(f, a + 20, a + 70);
  return (
    <AbsoluteFill style={{ opacity: 1 - exit, translate: `0px ${-exit * 360}px`, scale: String(1 - exit * 0.06) }}>
      <div style={{ position: "absolute", left: ICON.cx, top: ICON.cy }}>
        <Rosette size={860} rot={(f - a) * 0.12} opacity={rose * 0.9} />
        <div
          style={{
            position: "absolute",
            left: -260,
            top: -260,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(63,181,166,${0.35 * tile + 0.25 * pulse}) 0%, rgba(63,181,166,0) 65%)`,
          }}
        />
        <div style={{ position: "absolute", left: 0, top: 0, scale: String(1 + pulse * 0.035), filter: `drop-shadow(0 30px 50px rgba(0,0,0,${0.45 * tile}))` }}>
          <SakinahIcon draw={draws} tile={tile} size={ICON.size} dot={false} />
        </div>
      </div>
      <GoldDot x={dx} y={dy} r={lerp(13, 14 * sc, m)} glow={lerp(1, 0.55, m) * (1 - tile * 0.4)} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: ICON.cy + ICON.size / 2 + 50,
          textAlign: "center",
          fontFamily: FONT.display,
          fontWeight: 700,
          fontSize: 170,
          lineHeight: 1.1,
          color: "#fff",
          opacity: name,
          translate: `0px ${(1 - name) * 30}px`,
          filter: `blur(${(1 - name) * 14}px)`,
          letterSpacing: 2,
        }}
      >
        سكينة
      </div>
      <div
        style={{
          position: "absolute",
          left: 540 - 130 * ramp(f, nameAt + 6, nameAt + 26),
          width: 260 * ramp(f, nameAt + 6, nameAt + 26),
          top: ICON.cy + ICON.size / 2 + 270,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, rgba(226,176,74,0), ${K.goldDot}, rgba(226,176,74,0))`,
        }}
      />
    </AbsoluteFill>
  );
};
