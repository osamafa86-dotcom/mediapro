import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT } from "../theme";

/** نص تظهر كلماته واحدة تلو الأخرى صعودًا مع تلاشٍ وضبابية (الكلمة وحدة تشكيل كاملة في العربية) */
export const Words: React.FC<{
  text: string;
  start: number;
  stagger?: number;
  dur?: number;
  rise?: number;
  style?: React.CSSProperties;
  wordStyle?: (i: number) => React.CSSProperties;
  justify?: "center" | "flex-start" | "flex-end";
}> = ({ text, start, stagger = 4, dur = 18, rise = 40, style, wordStyle, justify = "center" }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: justify, columnGap: "0.28em", ...style }}>
      {words.map((w, i) => {
        const s = start + i * stagger;
        const t = interpolate(frame, [s, s + dur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: t,
              translate: `0px ${(1 - t) * rise}px`,
              filter: `blur(${(1 - t) * 10}px)`,
              ...(wordStyle ? wordStyle(i) : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** ظهور بسيط (تلاشٍ + صعود) بين إطارين */
export const useReveal = (start: number, dur = 18) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE_OUT),
  });
};
