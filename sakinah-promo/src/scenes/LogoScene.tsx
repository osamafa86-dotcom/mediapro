import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE_OUT, F } from "../theme";
import { Words, useReveal } from "../components/Words";
import { Rosette } from "../components/Rosette";

// مسارات أيقونة التطبيق (sakinah/assets/icons/icon.svg) تُرسم خطًّا خطًّا
const PATHS = [
  "M256 92c-30 52-50 86-50 130a50 50 0 0 0 100 0c0-44-20-78-50-130Z",
  "M118 400v-92a138 138 0 0 1 276 0v92",
  "M86 400h340",
  "M206 400v-52a50 50 0 0 1 100 0v52",
];

export const AppMark: React.FC<{ size: number; draw: number; dot: number; tile: number }> = ({ size, draw, dot, tile }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" style={{ overflow: "visible" }}>
    <defs>
      <linearGradient id="markG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#14857c" />
        <stop offset="1" stopColor="#0a4a46" />
      </linearGradient>
    </defs>
    <g style={{ scale: String(tile), transformOrigin: "256px 256px", opacity: Math.min(1, tile * 1.4) }}>
      <rect width={512} height={512} rx={112} fill="url(#markG)" />
      <rect x={1.5} y={1.5} width={509} height={509} rx={111} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={3} />
    </g>
    <g fill="none" stroke="#fff" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round">
      {PATHS.map((d, i) => {
        const t = Math.max(0, Math.min(1, draw * PATHS.length - i * 0.75));
        return <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - t} />;
      })}
    </g>
    <circle cx={392} cy={120} r={14 * dot} fill={C.goldDot} />
    <circle cx={392} cy={120} r={14 + 40 * dot} fill="none" stroke={C.goldDot} strokeWidth={3} opacity={dot > 0 && dot < 1.2 ? (1 - Math.min(1, dot)) * 0.9 : 0} />
  </svg>
);

export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const tile = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const draw = interpolate(frame, [6, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const dot = spring({ frame: frame - 44, fps, config: { damping: 9, stiffness: 160 } });
  const lift = interpolate(frame, [50, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(...EASE_OUT) });
  const line = useReveal(70, 26);
  const markSize = wide ? 250 : 300;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <Rosette size={wide ? 820 : 980} x={width / 2} y={height / 2 - (wide ? 70 : 120)} opacity={interpolate(frame, [0, 40], [0, 0.9], { extrapolateRight: "clamp" })} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", translate: `0px ${(1 - lift) * 150}px` }}>
        <div style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.45))" }}>
          <AppMark size={markSize} draw={draw} dot={dot} tile={tile} />
        </div>
        <div style={{ height: wide ? 30 : 50 }} />
        <Words
          text="سكينة"
          start={54}
          dur={24}
          rise={50}
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: wide ? 170 : 190, color: C.paper, lineHeight: 1.2 }}
        />
        <div
          style={{
            marginTop: 26,
            opacity: line,
            translate: `0px ${(1 - line) * 24}px`,
            fontFamily: F.ui,
            fontWeight: 400,
            fontSize: wide ? 48 : 50,
            color: C.mint,
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.5,
          }}
        >
          صلاتك وقرآنك وأذكارك
          <span style={{ color: C.goldLight }}> في مكان واحد</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
