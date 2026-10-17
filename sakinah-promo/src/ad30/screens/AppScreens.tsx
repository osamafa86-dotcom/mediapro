import React from "react";
import { Img, staticFile } from "remotion";
import { FONT, K, easeInOut, easeOut, lerp, ramp } from "../core";

// شاشات التطبيق الحقيقية (لقطات المتجر 1320×2868) مع عناصر حيّة فوقها بالإحداثيات الأصلية

const NW = 1320;
const NH = 2868;

const Shot: React.FC<{ src: string }> = ({ src }) => (
  <Img src={staticFile(`ad30/shots/${src}`)} style={{ position: "absolute", left: 0, top: 0, width: NW, height: NH }} />
);

const toArabic = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/* ───────────── القبلة: القرص يدور حتى يستقر على الكعبة ───────────── */
const QC = { x: 660, y: 1026, r: 512 };

export const QiblaScreen: React.FC<{ f: number; start: number; settle: number }> = ({ f, start, settle }) => {
  // دوران متخامد: من ٣٨° إلى ٠ مع ارتداد خفيف
  const p = ramp(f, start, settle, (t) => t);
  const ang = 38 * Math.exp(-4.2 * p) * Math.cos(p * Math.PI * 1.6);
  const textOut = ramp(f, settle - 6, settle - 1);
  const done = ramp(f, settle - 1, settle + 6);
  const glow = ramp(f, settle - 2, settle + 6) * (1 - ramp(f, settle + 14, settle + 40, easeInOut) * 0.55);
  const deg = Math.max(0, Math.round(Math.abs(ang)));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: NW, height: NH, direction: "rtl" }}>
      <Shot src="05-qibla.jpg" />
      {/* القرص الدوّار مقصوص من اللقطة نفسها */}
      <div
        style={{
          position: "absolute",
          left: QC.x - QC.r,
          top: QC.y - QC.r,
          width: QC.r * 2,
          height: QC.r * 2,
          borderRadius: "50%",
          overflow: "hidden",
          rotate: `${ang}deg`,
        }}
      >
        <Img src={staticFile("ad30/shots/05-qibla.jpg")} style={{ position: "absolute", left: -(QC.x - QC.r), top: -(QC.y - QC.r), width: NW, height: NH }} />
      </div>
      {/* وهج ذهبي عند الاستقامة */}
      <div
        style={{
          position: "absolute",
          left: QC.x - 600,
          top: QC.y - 600,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          boxShadow: `0 0 0 10px rgba(198,156,62,${0.85 * glow}), 0 0 90px 30px rgba(226,176,74,${0.45 * glow})`,
          pointerEvents: "none",
        }}
      />
      {/* شريط الحالة: تعليمة الدوران ثم «متجه نحو القبلة» من اللقطة */}
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 372,
          width: 1224,
          height: 150,
          borderRadius: 75,
          background: "#F6F4EE",
          opacity: 1 - done,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: 60,
            background: "#ECE8DF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.ui,
            fontWeight: 500,
            fontSize: 50,
            color: K.ink,
            opacity: 1 - textOut,
          }}
        >
          أدر الهاتف يسارًا {toArabic(deg)}°
        </div>
      </div>
    </div>
  );
};

/* ───────────── المصحف: تظليل الكلمة مع التلاوة (سطر «إن الله عليم…») ───────────── */
const LINE_A = { y0: 1046, y1: 1182 };
// حدود الكلمات من اليمين إلى اليسار (مقيسة من اللقطة)
const WORDS_A: Array<[number, number]> = [
  [1202, 1263],
  [1116, 1189],
  [992, 1107],
  [901, 986],
  [799, 893],
  [612, 790],
  [351, 534],
  [218, 338],
  [58, 208],
];

export const MushafScreen: React.FC<{ f: number; start: number; perWord: number }> = ({ f, start, perWord }) => {
  const t = (f - start) / perWord;
  const i = Math.max(0, Math.min(WORDS_A.length - 1, Math.floor(t)));
  const frac = Math.max(0, Math.min(1, t - Math.floor(t)));
  const k = easeInOut(Math.min(1, frac * 2.2));
  const a = WORDS_A[Math.max(0, i - 1)];
  const b = WORDS_A[i];
  const x0 = t < 1 ? b[0] : lerp(a[0], b[0], k);
  const x1 = t < 1 ? b[1] : lerp(a[1], b[1], k);
  const on = ramp(f, start - 4, start + 6) * (1 - ramp(f, start + perWord * WORDS_A.length + 6, start + perWord * WORDS_A.length + 16));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: NW, height: NH }}>
      <Shot src="01-mushaf.jpg" />
      <div
        style={{
          position: "absolute",
          left: x0 - 12,
          top: LINE_A.y0,
          width: x1 - x0 + 24,
          height: LINE_A.y1 - LINE_A.y0,
          borderRadius: 26,
          background: "rgba(214,168,62,0.32)",
          mixBlendMode: "multiply",
          opacity: on,
        }}
      />
    </div>
  );
};

/* ───────────── الأذكار: بطاقة أذكار المساء تكتمل ───────────── */
const RING = { x: 796, y: 524, r: 69 };

export const AdhkarScreen: React.FC<{ f: number; start: number; end: number }> = ({ f, start, end }) => {
  const p = ramp(f, start, end, easeInOut);
  const count = Math.round(p * 21);
  const pct = Math.round(p * 100);
  const done = ramp(f, end, end + 8);
  const C = 2 * Math.PI * RING.r;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: NW, height: NH, direction: "rtl" }}>
      <Shot src="06-adhkar.jpg" />
      <svg width={NW} height={NH} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle
          cx={RING.x}
          cy={RING.y}
          r={RING.r}
          fill="none"
          stroke={K.brand}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${C * p} ${C}`}
          transform={`rotate(-90 ${RING.x} ${RING.y}) scale(-1 1) translate(${-2 * RING.x} 0)`}
        />
        <circle cx={RING.x} cy={RING.y} r={RING.r + 16} fill="none" stroke={K.goldDot} strokeWidth={4} opacity={done * (1 - ramp(f, end + 8, end + 26))} />
      </svg>
      {/* النسبة والعدّاد يحلّان محل «٠٪» و«٠ من ٢١» */}
      <div style={{ position: "absolute", left: 1120, top: 452, width: 140, height: 70, background: "#FFFFFF" }} />
      <div
        style={{
          position: "absolute",
          left: 1060,
          top: 446,
          width: 196,
          textAlign: "left",
          fontFamily: FONT.ui,
          fontWeight: 600,
          fontSize: 40,
          color: K.brand,
          direction: "ltr",
        }}
      >
        ٪{toArabic(pct)}
      </div>
      <div style={{ position: "absolute", left: 720, top: 690, width: 330, height: 62, background: "#FFFFFF" }} />
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 688,
          width: 350,
          textAlign: "right",
          fontFamily: FONT.ui,
          fontWeight: 400,
          fontSize: 38,
          color: "#8A908D",
        }}
      >
        {toArabic(count)} من ٢١ · بدأت ٣:٤٤ م
      </div>
    </div>
  );
};

/** لقطة ثابتة لأي شاشة */
export const StaticShot: React.FC<{ src: string; zoom?: number; ox?: number; oy?: number }> = ({ src, zoom = 1, ox = 0.5, oy = 0.5 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: NW, height: NH, scale: String(zoom), transformOrigin: `${ox * 100}% ${oy * 100}%` }}>
    <Shot src={src} />
  </div>
);

export { NW as SHOT_W, toArabic, easeOut };
