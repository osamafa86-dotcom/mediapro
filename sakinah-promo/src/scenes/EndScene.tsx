import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";
import { Words, useReveal } from "../components/Words";
import { Rosette } from "../components/Rosette";

const StoreBadge: React.FC<{ top: string; name: string; t: number }> = ({ top, name, t }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: 380,
      height: 128,
      borderRadius: 30,
      background: C.paper,
      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      opacity: t,
      translate: `0px ${(1 - t) * 40}px`,
      scale: String(0.85 + 0.15 * t),
    }}
  >
    <div style={{ fontFamily: F.ui, fontWeight: 400, fontSize: 28, color: C.inkSoft, lineHeight: 1.2 }}>{top}</div>
    <div style={{ fontFamily: F.ui, fontWeight: 600, fontSize: 46, color: C.ink, lineHeight: 1.25, direction: "ltr" }}>{name}</div>
  </div>
);

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const icon = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 110 } });
  const tag = useReveal(26, 22);
  const cta = useReveal(40, 22);
  const b1 = spring({ frame: frame - 52, fps, config: { damping: 14, stiffness: 130 } });
  const b2 = spring({ frame: frame - 60, fps, config: { damping: 14, stiffness: 130 } });
  const glint = interpolate(frame, [70, 100], [-1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const k = wide ? 0.78 : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <Rosette size={wide ? 900 : 1100} x={width / 2} y={height / 2 - (wide ? 150 : 260)} opacity={0.9} speed={0.1} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", scale: String(k) }}>
        <div
          style={{
            position: "relative",
            width: 260,
            height: 260,
            borderRadius: 58,
            overflow: "hidden",
            boxShadow: "0 40px 90px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.12)",
            scale: String(icon),
            rotate: `${(1 - icon) * -12}deg`,
          }}
        >
          <Img src={staticFile("brand/icon-1024.png")} style={{ width: "100%", height: "100%" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(110deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 65%)",
              translate: `${glint * 260}px 0px`,
            }}
          />
        </div>
        <Words
          text="سكينة"
          start={12}
          dur={22}
          rise={40}
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: 170, color: C.paper, lineHeight: 1.25, marginTop: 40 }}
        />
        <div style={{ opacity: tag, translate: `0px ${(1 - tag) * 20}px`, fontFamily: F.ui, fontWeight: 300, fontSize: 46, color: C.mint, marginTop: 6 }}>
          صلاتك وقرآنك وأذكارك في مكان واحد
        </div>
        <div
          style={{
            opacity: cta,
            translate: `0px ${(1 - cta) * 20}px`,
            fontFamily: F.ui,
            fontWeight: 600,
            fontSize: 58,
            color: C.goldLight,
            marginTop: 70,
          }}
        >
          حمّله مجانًا الآن
        </div>
        <div style={{ display: "flex", gap: 36, marginTop: 40, direction: "ltr" }}>
          <StoreBadge top="متوفر على" name="App Store" t={Math.min(1, b1)} />
          <StoreBadge top="احصل عليه من" name="Google Play" t={Math.min(1, b2)} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
