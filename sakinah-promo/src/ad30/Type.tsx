import React from "react";
import { FONT, K, easeInOut, lerp, mixHex, ramp } from "./core";

// طباعة حركية عربية: الكلمات تظهر من اليمين إلى اليسار بصعود وضبابية تنقشع

export const RevealWords: React.FC<{
  f: number;
  text: string;
  start: number;
  stagger?: number;
  dur?: number;
  rise?: number;
  out?: number; // إطار بدء الخروج
  style?: React.CSSProperties;
  wordStyle?: (i: number, n: number) => React.CSSProperties;
}> = ({ f, text, start, stagger = 4, dur = 18, rise = 34, out, style, wordStyle }) => {
  const words = text.split(" ");
  const o = out === undefined ? 0 : ramp(f, out, out + 10, easeInOut);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.26em", direction: "rtl", ...style }}>
      {words.map((w, i) => {
        const t = ramp(f, start + i * stagger, start + i * stagger + dur);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: t * (1 - o),
              translate: `0px ${(1 - t) * rise - o * 18}px`,
              filter: `blur(${(1 - t) * 12 + o * 6}px)`,
              ...(wordStyle ? wordStyle(i, words.length) : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** عنوان المشهد: سطر رئيسي وسطر فرعي — اللون يتبع إضاءة الخلفية */
export const Headline: React.FC<{
  f: number;
  title: string;
  sub?: string;
  start: number;
  out?: number;
  tone: number; // ٠ داكنة، ١ فاتحة
  y: number;
  size?: number;
}> = ({ f, title, sub, start, out, tone, y, size = 92 }) => {
  const main = mixHex("#FFFFFF", K.ink, tone);
  const soft = mixHex("#CFE3DF", K.inkSoft, tone);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: y, textAlign: "center" }}>
      <RevealWords
        f={f}
        text={title}
        start={start}
        out={out}
        style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: size, lineHeight: 1.18, color: main }}
      />
      {sub ? (
        <RevealWords
          f={f}
          text={sub}
          start={start + 8}
          out={out}
          stagger={3}
          rise={22}
          style={{ marginTop: 18, fontFamily: FONT.ui, fontWeight: 400, fontSize: 40, lineHeight: 1.3, color: soft }}
        />
      ) : null}
    </div>
  );
};

/** شريط الصلوات من واجهة التطبيق: فهرس الفيلم */
const PRAYERS = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
const TIMES = ["٥:٢٠ ص", "١٢:٢٢ م", "٣:٣٤ م", "٦:٠٦ م", "٧:٢٢ م"];

export const PrayerBar: React.FC<{ active: number; tone: number; y: number; opacity: number }> = ({ active, tone, y, opacity }) => {
  const w = 860;
  const left = (1080 - w) / 2;
  const step = w / (PRAYERS.length - 1);
  // الترتيب من اليمين: الفجر أقصى اليمين
  const xs = PRAYERS.map((_, i) => w - i * step);
  const ink = mixHex("#FFFFFF", K.ink, tone);
  const line = tone > 0.5 ? "rgba(22,33,31,0.18)" : "rgba(255,255,255,0.22)";
  const gold = tone > 0.5 ? K.gold : K.goldLight;
  const pos = lerp(xs[0], xs[xs.length - 1], Math.max(0, active) / (PRAYERS.length - 1));
  return (
    <div style={{ position: "absolute", left, top: y, width: w, height: 110, opacity }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 18, height: 3, borderRadius: 2, background: line }} />
      <div style={{ position: "absolute", left: pos, right: 0, top: 18, height: 3, borderRadius: 2, background: gold, opacity: 0.85 }} />
      {PRAYERS.map((p, i) => {
        const near = Math.max(0, 1 - Math.abs(active - i));
        return (
          <div key={p} style={{ position: "absolute", left: xs[i], top: 0 }}>
            <div
              style={{
                position: "absolute",
                left: -9 - near * 5,
                top: 10 - near * 5,
                width: 18 + near * 10,
                height: 18 + near * 10,
                borderRadius: "50%",
                background: active >= i - 0.01 ? gold : tone > 0.5 ? "#D9D4C8" : "rgba(255,255,255,0.35)",
                boxShadow: near > 0.05 ? `0 0 ${24 * near}px ${8 * near}px rgba(226,176,74,${0.45 * near})` : undefined,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -120,
                width: 240,
                top: 44,
                textAlign: "center",
                fontFamily: FONT.ui,
                fontWeight: near > 0.5 ? 600 : 400,
                fontSize: 30 + near * 4,
                color: ink,
                opacity: 0.45 + near * 0.55,
                direction: "rtl",
              }}
            >
              {p}
              <div style={{ fontSize: 24, fontWeight: 400, opacity: near, marginTop: 2, color: gold }}>{TIMES[i]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

