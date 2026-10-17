import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";
import { Words } from "../components/Words";

const ROWS = [
  { t: "بلا إعلانات", d: "لا شيء يقطع خلوتك" },
  { t: "بلا حساب ولا تتبّع", d: "كل الحسابات على جهازك" },
  { t: "يعمل دون اتصال", d: "المصحف والأذكار والمواقيت معك دائمًا" },
];

export const PromiseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: wide ? 1100 : 900 }}>
        <Words
          text="سكينة بلا مشتّتات"
          start={0}
          stagger={5}
          dur={22}
          rise={50}
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: wide ? 100 : 100, color: C.paper, lineHeight: 1.3 }}
          wordStyle={(i) => (i === 0 ? { color: C.goldLight } : {})}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: wide ? 26 : 34, marginTop: wide ? 50 : 80, alignSelf: "stretch" }}>
          {ROWS.map((r, i) => {
            const s = spring({ frame: frame - (20 + i * 14), fps, config: { damping: 16, stiffness: 120 } });
            const draw = interpolate(frame, [28 + i * 14, 44 + i * 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={r.t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 30,
                  padding: wide ? "24px 36px" : "30px 38px",
                  borderRadius: 34,
                  background: "rgba(251,249,244,0.06)",
                  border: "1.5px solid rgba(159,209,202,0.18)",
                  opacity: Math.min(1, s),
                  translate: `${(1 - Math.min(1, s)) * -120}px 0px`,
                }}
              >
                <svg width={84} height={84} viewBox="0 0 84 84" style={{ flex: "none" }}>
                  <circle cx={42} cy={42} r={40} fill="rgba(198,156,62,0.16)" stroke={C.goldLight} strokeWidth={2.5} />
                  <path
                    d="M26 43l11 11 21-23"
                    fill="none"
                    stroke={C.goldLight}
                    strokeWidth={5.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - draw}
                  />
                </svg>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontFamily: F.ui, fontWeight: 600, fontSize: wide ? 54 : 58, color: C.paper, lineHeight: 1.35 }}>{r.t}</div>
                  <div style={{ fontFamily: F.ui, fontWeight: 300, fontSize: wide ? 36 : 38, color: C.mint, lineHeight: 1.4 }}>{r.d}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
