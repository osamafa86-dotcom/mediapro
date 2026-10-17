import React from "react";
import { AbsoluteFill, random } from "remotion";
import { B, FONT, K, easeInOut, lerp, ramp } from "../core";
import { Rosette, SakinahIcon } from "./Intro";
import { RevealWords } from "../Type";

// الوعد ثم الختام

export const Crescent: React.FC<{ x: number; y: number; r: number; opacity: number }> = ({ x, y, r, opacity }) => (
  <div style={{ position: "absolute", left: x, top: y, opacity }}>
    <div style={{ position: "absolute", left: -r * 4, top: -r * 4, width: r * 8, height: r * 8, borderRadius: "50%", background: "radial-gradient(circle, rgba(242,210,140,0.28) 0%, rgba(242,210,140,0) 65%)" }} />
    <svg width={r * 2} height={r * 2} viewBox="-1 -1 2 2" style={{ position: "absolute", left: -r, top: -r, rotate: "-28deg" }}>
      <defs>
        <mask id="cres">
          <rect x="-1" y="-1" width="2" height="2" fill="#fff" />
          <circle cx="0.42" cy="-0.12" r="0.86" fill="#000" />
        </mask>
      </defs>
      <circle cx="0" cy="0" r="0.98" fill="#F3D68E" mask="url(#cres)" />
    </svg>
  </div>
);

/** عنصر ضجيج صغير يدخل ثم يتبدّد غبارًا ذهبيًا */
const Intruder: React.FC<{ f: number; from: [number, number]; to: [number, number]; startF: number; burstF: number; seed: string; children: React.ReactNode }> = ({ f, from, to, startF, burstF, seed, children }) => {
  if (f < startF) return null;
  const mv = ramp(f, startF, burstF, easeInOut);
  const x = lerp(from[0], to[0], mv);
  const y = lerp(from[1], to[1], mv);
  const gone = ramp(f, burstF, burstF + 6);
  const parts = new Array(46).fill(0);
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", opacity: (1 - gone) * ramp(f, startF, startF + 5), scale: String(1 - gone * 0.2), filter: `blur(${gone * 6}px)` }}>{children}</div>
      {f >= burstF
        ? parts.map((_, i) => {
            const t = ramp(f, burstF, burstF + 30, (q) => 1 - Math.pow(1 - q, 2));
            const a = random(`${seed}a${i}`) * Math.PI * 2;
            const d = 60 + random(`${seed}d${i}`) * 260;
            const px = x + Math.cos(a) * d * t + (random(`${seed}x${i}`) - 0.5) * 140;
            const py = y + Math.sin(a) * d * t - t * 120 * random(`${seed}u${i}`) + (random(`${seed}y${i}`) - 0.5) * 60;
            const s = 2 + random(`${seed}s${i}`) * 5;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: px,
                  top: py,
                  width: s,
                  height: s,
                  borderRadius: "50%",
                  background: i % 3 === 0 ? "#FFF0C8" : K.goldDot,
                  opacity: (1 - t) * 0.95,
                  boxShadow: "0 0 10px rgba(226,176,74,0.8)",
                }}
              />
            );
          })
        : null}
    </>
  );
};

export const PromiseScene: React.FC<{ f: number; cues: { ads: number; track: number; only: number } }> = ({ f, cues }) => {
  const [a, b] = B.promise;
  if (f < a - 10 || f > b + 12) return null;
  // يخرج الوعد صاعدًا مع الضربة الأخيرة فيتسلّم الختام مكانه دون تراكب
  const out = ramp(f, b - 3, b + 6, easeInOut);
  const dimFirst = ramp(f, cues.only - 6, cues.only + 10, easeInOut);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, translate: `0px ${-out * 60}px`, filter: out > 0 ? `blur(${out * 8}px)` : undefined }}>
      <Crescent x={540} y={520} r={46} opacity={ramp(f, a, a + 24)} />
      <Intruder f={f} from={[-300, 760]} to={[300, 800]} startF={a - 6} burstF={cues.ads - 2} seed="ad">
        <div style={{ width: 380, height: 110, borderRadius: 16, background: "#E53935", color: "#fff", fontFamily: FONT.ui, fontWeight: 800, fontSize: 38, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          خصم ٧٠٪ — اضغط هنا
        </div>
      </Intruder>
      <Intruder f={f} from={[1380, 900]} to={[780, 920]} startF={a + 4} burstF={cues.track - 2} seed="tr">
        <div style={{ width: 420, borderRadius: 26, background: "rgba(242,242,247,0.96)", color: "#111", fontFamily: FONT.ui, fontWeight: 600, fontSize: 28, padding: "24px 26px", textAlign: "center", direction: "rtl", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          هل تسمح بتتبّع نشاطك؟
          <div style={{ marginTop: 14, fontSize: 26, color: "#0A84FF", fontWeight: 600 }}>السماح · عدم السماح</div>
        </div>
      </Intruder>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, opacity: 1 - dimFirst * 0.55, scale: String(1 - dimFirst * 0.12), transformOrigin: "50% 0%" }}>
        <RevealWords f={f} text="بلا إعلانات" start={cues.ads} style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 104, color: "#fff", lineHeight: 1.25 }} />
        <RevealWords f={f} text="بلا تتبّع" start={cues.track} style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 104, color: "#fff", lineHeight: 1.25 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1010 }}>
        <RevealWords
          f={f}
          text="أنتَ وذِكرُ اللهِ فقط"
          start={cues.only}
          stagger={6}
          dur={22}
          style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 112, lineHeight: 1.3 }}
          wordStyle={() => ({
            backgroundImage: "linear-gradient(180deg, #FFF1C9 0%, #E9C77D 60%, #C69C3E 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            padding: "0 6px",
          })}
        />
        <div style={{ marginTop: 40, textAlign: "center", fontFamily: FONT.ui, fontSize: 36, color: K.mint, opacity: ramp(f, cues.only + 18, cues.only + 36) * 0.85, direction: "rtl" }}>
          بلا حساب، ويعمل دون اتصال
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── الختام ───────────── */
const StorePill: React.FC<{ small: string; big: string }> = ({ small, big }) => (
  <div
    style={{
      height: 104,
      padding: "0 34px",
      borderRadius: 26,
      background: "#0B0D0D",
      border: "2px solid rgba(255,255,255,0.28)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      color: "#fff",
      fontFamily: FONT.ui,
      boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
    }}
  >
    <div style={{ fontSize: 24, opacity: 0.75, lineHeight: 1.2, direction: "rtl" }}>{small}</div>
    <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, direction: "ltr" }}>{big}</div>
  </div>
);

export const EndScene: React.FC<{ f: number }> = ({ f }) => {
  const [a] = B.end;
  if (f < a - 8) return null;
  const icon = ramp(f, a - 1, a + 16);
  const name = ramp(f, a + 4, a + 22);
  const sub = ramp(f, a + 14, a + 32);
  const stores = ramp(f, a + 24, a + 42);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 540, top: 700 }}>
        <Rosette size={780} rot={(f - a) * 0.1} opacity={icon * 0.85} />
        <div style={{ position: "absolute", left: -240, top: -240, width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, rgba(63,181,166,${0.32 * icon}) 0%, rgba(63,181,166,0) 65%)` }} />
        <div style={{ position: "absolute", left: 0, top: 0, opacity: icon, scale: String(lerp(0.86, 1, icon)), filter: "drop-shadow(0 28px 44px rgba(0,0,0,0.45))" }}>
          <SakinahIcon draw={[1, 1, 1, 1]} tile={1} size={280} dot />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontFamily: FONT.display, fontWeight: 700, fontSize: 150, color: "#fff", opacity: name, translate: `0px ${(1 - name) * 24}px`, filter: `blur(${(1 - name) * 10}px)` }}>
        سكينة
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1078, textAlign: "center", fontFamily: FONT.ui, fontWeight: 400, fontSize: 46, color: K.mint, opacity: sub, translate: `0px ${(1 - sub) * 16}px`, direction: "rtl" }}>
        الصلاة والقرآن والأذكار
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1196, opacity: stores, translate: `0px ${(1 - stores) * 20}px` }}>
        <div style={{ textAlign: "center", fontFamily: FONT.ui, fontSize: 34, fontWeight: 500, color: K.goldLight, direction: "rtl", marginBottom: 22 }}>مجانًا على</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 26 }}>
          <StorePill small="متوفر على" big="App Store" />
          <StorePill small="احصل عليه من" big="Google Play" />
        </div>
      </div>
    </AbsoluteFill>
  );
};
