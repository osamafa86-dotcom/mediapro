import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

/** نجمة ثمانية (مربّعان متراكبان) — زخرفة رأس الشاشة الرئيسية في التطبيق */
export const StarPath: React.FC<{ cx: number; cy: number; r: number; stroke: string; width: number; fill?: string }> = ({ cx, cy, r, stroke, width, fill = "none" }) => {
  const pts = (rot: number) =>
    [0, 1, 2, 3]
      .map((i) => {
        const a = rot + (i * Math.PI) / 2;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(" ");
  return (
    <g fill={fill} stroke={stroke} strokeWidth={width} strokeLinejoin="round">
      <polygon points={pts(Math.PI / 4)} />
      <polygon points={pts(0)} />
    </g>
  );
};

type Props = { glow?: number };

export const Background: React.FC<Props> = ({ glow = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, -120]);
  const tile = 180;
  const dots = new Array(70).fill(0).map((_, i) => ({
    x: random(`x${i}`) * width,
    y: random(`y${i}`) * height,
    r: 1.2 + random(`r${i}`) * 2.4,
    s: 0.03 + random(`s${i}`) * 0.06,
    p: random(`p${i}`) * Math.PI * 2,
  }));
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.nightTop} 0%, ${C.brandDeep} 48%, ${C.nightBottom} 100%)` }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="girih" width={tile} height={tile} patternUnits="userSpaceOnUse" patternTransform={`translate(${drift * 0.4} ${drift})`}>
            <StarPath cx={tile / 2} cy={tile / 2} r={tile * 0.3} stroke="rgba(159,209,202,0.075)" width={2} />
            <StarPath cx={0} cy={0} r={tile * 0.18} stroke="rgba(159,209,202,0.05)" width={2} />
            <StarPath cx={tile} cy={0} r={tile * 0.18} stroke="rgba(159,209,202,0.05)" width={2} />
            <StarPath cx={0} cy={tile} r={tile * 0.18} stroke="rgba(159,209,202,0.05)" width={2} />
            <StarPath cx={tile} cy={tile} r={tile * 0.18} stroke="rgba(159,209,202,0.05)" width={2} />
          </pattern>
          <radialGradient id="fadeMask" cx="50%" cy="40%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
          </radialGradient>
          <mask id="m">
            <rect width={width} height={height} fill="url(#fadeMask)" />
          </mask>
        </defs>
        <rect width={width} height={height} fill="url(#girih)" mask="url(#m)" />
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y + drift * 0.25}
            r={d.r}
            fill={i % 9 === 0 ? C.goldLight : "#FBF9F4"}
            opacity={0.12 + 0.5 * Math.max(0, Math.sin(frame * d.s + d.p))}
          />
        ))}
      </svg>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 52%, rgba(63,181,166,${0.22 * glow}) 0%, rgba(63,181,166,0) 70%)`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)" }} />
    </AbsoluteFill>
  );
};
