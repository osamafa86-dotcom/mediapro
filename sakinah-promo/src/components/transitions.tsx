import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type Empty = Record<string, never>;

/**
 * تسليم هادئ: المشهد الخارج يتلاشى ويصعد قليلًا أولًا، ثم يدخل التالي — بلا تراكب نصّين.
 * الخلفية مشتركة خارج السلسلة فلا يظهر سواد بينهما.
 */
const Handoff: React.FC<TransitionPresentationComponentProps<Empty>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const style: React.CSSProperties = entering
    ? {
        opacity: interpolate(p, [0.45, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(p, [0.45, 1], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`,
      }
    : {
        opacity: interpolate(p, [0, 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(p, [0, 0.5], [0, -50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`,
        scale: String(interpolate(p, [0, 0.5], [1, 0.97], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
      };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/** دفع صفحة باتجاه القراءة العربية: الخارج يمضي يمينًا والتالي يدخل من اليسار، كتقليب مصحف */
const PagePush: React.FC<TransitionPresentationComponentProps<Empty>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const style: React.CSSProperties = entering
    ? { translate: `${(p - 1) * 100}% 0%` }
    : { translate: `${p * 100}% 0%`, opacity: interpolate(p, [0.4, 1], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const handoff = (): TransitionPresentation<Empty> => ({ component: Handoff, props: {} });
export const pagePush = (): TransitionPresentation<Empty> => ({ component: PagePush, props: {} });
