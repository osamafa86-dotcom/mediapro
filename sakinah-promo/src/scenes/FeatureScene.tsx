import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";
import { Phone, Shot, phoneHeight, phoneWidth } from "../components/Phone";
import { Words, useReveal } from "../components/Words";
import { Rosette } from "../components/Rosette";

export type FeatureProps = {
  eyebrow: string;
  title: string;
  sub: string;
  shots: Shot[];
  chips: string[];
  chipStart?: number;
  chipGap?: number;
  focus?: { from: number; to: number; x: number; y: number; scale: number };
};

const Check: React.FC<{ size: number; color: string; bg: string }> = ({ size, color, bg }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ flex: "none" }}>
    <circle cx={20} cy={20} r={20} fill={bg} />
    <path d="M12 20.5l5.5 5.5L28.5 15" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Eyebrow: React.FC<{ text: string; t: number }> = ({ text, t }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "10px 26px",
      borderRadius: 999,
      border: `2px solid rgba(226,199,122,0.55)`,
      background: "rgba(198,156,62,0.12)",
      color: C.goldLight,
      fontFamily: F.ui,
      fontWeight: 500,
      fontSize: 34,
      opacity: t,
      translate: `0px ${(1 - t) * 20}px`,
    }}
  >
    <span style={{ width: 10, height: 10, borderRadius: 5, background: C.goldDot }} />
    {text}
  </div>
);

export const FeatureScene: React.FC<FeatureProps> = ({ eyebrow, title, sub, shots, chips, chipStart = 34, chipGap = 13, focus }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;

  const screenW = wide ? 400 : 570;
  const pW = phoneWidth(screenW);
  const pH = phoneHeight(screenW);
  const pX = wide ? 600 - pW / 2 : width / 2 - pW / 2;
  const pY = wide ? (height - pH) / 2 : 525;

  const enter = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90, mass: 1.1 } });
  const float = Math.sin(frame / 38) * 8;
  const eyebrowT = useReveal(0, 16);
  const subT = useReveal(16, 20);

  const chipEls = chips.map((c, i) => {
    const s = spring({ frame: frame - (chipStart + i * chipGap), fps, config: { damping: 13, stiffness: 140 } });
    return { c, s };
  });

  const titleBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: wide ? "flex-start" : "center", gap: 0 }}>
      <Eyebrow text={eyebrow} t={eyebrowT} />
      <Words
        text={title}
        start={4}
        stagger={4}
        dur={20}
        rise={46}
        justify={wide ? "flex-start" : "center"}
        style={{ fontFamily: F.display, fontWeight: 700, fontSize: wide ? 104 : 96, color: C.paper, lineHeight: 1.3, marginTop: 26 }}
      />
      <div
        style={{
          fontFamily: F.ui,
          fontWeight: 300,
          fontSize: wide ? 46 : 44,
          color: C.mint,
          lineHeight: 1.5,
          marginTop: 10,
          opacity: subT,
          translate: `0px ${(1 - subT) * 20}px`,
          textAlign: wide ? "right" : "center",
          maxWidth: wide ? 820 : 900,
        }}
      >
        {sub}
      </div>
      {wide ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 50 }}>
          {chipEls.map(({ c, s }) => (
            <div
              key={c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: Math.min(1, s),
                translate: `${(1 - Math.min(1, s)) * -40}px 0px`,
                fontFamily: F.ui,
                fontWeight: 500,
                fontSize: 40,
                color: C.paper,
              }}
            >
              <Check size={44} color={C.brandDeep} bg={C.goldLight} />
              {c}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill style={{ direction: "rtl" }}>
      <Rosette
        size={wide ? 900 : 1040}
        x={pX + pW / 2}
        y={pY + pH / 2}
        opacity={interpolate(frame, [0, 30], [0, 0.85], { extrapolateRight: "clamp" })}
      />
      {wide ? (
        <div style={{ position: "absolute", right: 150, top: 0, bottom: 0, width: 860, display: "flex", alignItems: "center" }}>{titleBlock}</div>
      ) : (
        <div style={{ position: "absolute", top: 120, left: 80, right: 80, display: "flex", justifyContent: "center" }}>{titleBlock}</div>
      )}
      <Phone
        width={screenW}
        shots={shots}
        focus={focus}
        style={{
          left: pX,
          top: pY,
          translate: `0px ${(1 - enter) * (wide ? 700 : 800) + float}px`,
          rotate: `${(1 - enter) * (wide ? -10 : 6)}deg`,
        }}
      />
      {!wide
        ? chipEls.map(({ c, s }, i) => {
            const offsets = [-120, 130, -90, 110];
            const y = pY + pH * (0.5 + i * 0.13);
            return (
              <div
                key={c}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: y,
                  display: "flex",
                  justifyContent: "center",
                  translate: `${offsets[i % offsets.length]}px ${(1 - Math.min(1, s)) * 40 + float * 0.6}px`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "20px 34px 20px 30px",
                    borderRadius: 999,
                    background: "rgba(251,249,244,0.97)",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(198,156,62,0.25)",
                    fontFamily: F.ui,
                    fontWeight: 600,
                    fontSize: 38,
                    color: C.ink,
                    opacity: Math.min(1, s * 1.5),
                    scale: String(0.6 + 0.4 * s),
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={44} color="#fff" bg={C.brand} />
                  {c}
                </div>
              </div>
            );
          })
        : null}
    </AbsoluteFill>
  );
};
