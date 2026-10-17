import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export type Shot = { src: string; from?: number };

const RATIO = 2390 / 1100;

/**
 * هاتف بإطار رفيع يعرض لقطات التطبيق الحقيقية؛ اللقطة التالية تظهر بتلاشٍ متقاطع عند `from`.
 * `focus` يكبّر داخل الشاشة نحو نقطة (0..1) لإبراز تفصيل.
 */
export const Phone: React.FC<{
  width: number;
  shots: Shot[];
  style?: React.CSSProperties;
  focus?: { from: number; to: number; x: number; y: number; scale: number };
}> = ({ width, shots, style, focus }) => {
  const frame = useCurrentFrame();
  const bezel = Math.round(width * 0.028);
  const h = width * RATIO;
  const rOuter = width * 0.15;
  const rInner = rOuter - bezel;
  const zoom = focus
    ? interpolate(frame, [focus.from, focus.to], [1, focus.scale], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t) => 1 - Math.pow(1 - t, 3),
      })
    : 1;
  return (
    <div
      style={{
        position: "absolute",
        width: width + bezel * 2,
        height: h + bezel * 2,
        borderRadius: rOuter,
        background: "linear-gradient(145deg, #2b3533 0%, #0b0f0e 35%, #0b0f0e 70%, #2b3533 100%)",
        boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(255,255,255,0.06)",
        ...style,
      }}
    >
      {/* أزرار جانبية */}
      <div style={{ position: "absolute", left: -5, top: h * 0.2, width: 5, height: h * 0.06, borderRadius: 3, background: "#1d2624" }} />
      <div style={{ position: "absolute", left: -5, top: h * 0.29, width: 5, height: h * 0.1, borderRadius: 3, background: "#1d2624" }} />
      <div style={{ position: "absolute", right: -5, top: h * 0.26, width: 5, height: h * 0.14, borderRadius: 3, background: "#1d2624" }} />
      <div
        style={{
          position: "absolute",
          left: bezel,
          top: bezel,
          width,
          height: h,
          borderRadius: rInner,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {shots.map((s, i) => {
          const start = s.from ?? 0;
          const opacity = i === 0 ? 1 : interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <Img
              key={s.src}
              src={staticFile(s.src)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity,
                transformOrigin: focus ? `${focus.x * 100}% ${focus.y * 100}%` : "50% 50%",
                scale: String(zoom),
              }}
            />
          );
        })}
        {/* لمعة زجاج خفيفة */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export const phoneHeight = (width: number) => width * RATIO + Math.round(width * 0.028) * 2;
export const phoneWidth = (width: number) => width + Math.round(width * 0.028) * 2;
