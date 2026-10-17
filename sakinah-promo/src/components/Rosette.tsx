import React from "react";
import { useCurrentFrame } from "remotion";
import { StarPath } from "./Background";

/** وردة زخرفية ذهبية تدور ببطء خلف الهاتف أو الشعار */
export const Rosette: React.FC<{ size: number; x: number; y: number; opacity?: number; speed?: number }> = ({ size, x, y, opacity = 1, speed = 0.08 }) => {
  const frame = useCurrentFrame();
  const r = size / 2;
  const ticks = new Array(72).fill(0);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", left: x - r, top: y - r, opacity, rotate: `${frame * speed}deg` }}
    >
      <circle cx={r} cy={r} r={r * 0.97} fill="none" stroke="rgba(226,199,122,0.22)" strokeWidth={2} />
      <circle cx={r} cy={r} r={r * 0.9} fill="none" stroke="rgba(226,199,122,0.12)" strokeWidth={1.5} />
      {ticks.map((_, i) => {
        const a = (i / ticks.length) * Math.PI * 2;
        const long = i % 6 === 0;
        const r1 = r * (long ? 0.86 : 0.885);
        const r2 = r * 0.9;
        return (
          <line
            key={i}
            x1={r + r1 * Math.cos(a)}
            y1={r + r1 * Math.sin(a)}
            x2={r + r2 * Math.cos(a)}
            y2={r + r2 * Math.sin(a)}
            stroke="rgba(226,199,122,0.3)"
            strokeWidth={long ? 3 : 1.5}
          />
        );
      })}
      <StarPath cx={r} cy={r} r={r * 0.78} stroke="rgba(226,199,122,0.16)" width={2} />
      <StarPath cx={r} cy={r} r={r * 0.5} stroke="rgba(226,199,122,0.1)" width={2} />
    </svg>
  );
};
