import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";
import { Words, useReveal } from "../components/Words";
import { StarPath } from "../components/Background";

// الرعد ٢٨ — نصّ Tanzil العثماني كما في بيانات التطبيق
const LINE1 = "أَلَا بِذِكْرِ ٱللَّهِ";
const LINE2 = "تَطْمَئِنُّ ٱلْقُلُوبُ";

export const VerseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const size = wide ? 118 : 112;
  const ornament = useReveal(4, 24);
  const ref = useReveal(78, 22);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", scale: String(push) }}>
        <svg width={90} height={90} style={{ opacity: ornament, rotate: `${ornament * 45}deg`, marginBottom: 40 }}>
          <StarPath cx={45} cy={45} r={36} stroke={C.goldLight} width={2.5} />
          <circle cx={45} cy={45} r={6} fill={C.goldDot} />
        </svg>
        <div style={{ fontFamily: F.quran, color: C.paper, fontSize: size, lineHeight: 1.75, textAlign: "center" }}>
          <Words text={LINE1} start={14} stagger={9} dur={26} rise={30} />
          <Words text={LINE2} start={41} stagger={9} dur={26} rise={30} />
        </div>
        <div
          style={{
            marginTop: 44,
            opacity: ref,
            translate: `0px ${(1 - ref) * 20}px`,
            fontFamily: F.ui,
            fontSize: 40,
            color: C.mint,
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <span style={{ width: 70 * ref, height: 2, background: C.gold, opacity: 0.8 }} />
          <span>سورة الرعد، الآية ٢٨</span>
          <span style={{ width: 70 * ref, height: 2, background: C.gold, opacity: 0.8 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
