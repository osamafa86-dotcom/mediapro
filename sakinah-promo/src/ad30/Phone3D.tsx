import React from "react";

// آيفون ثلاثي الأبعاد بالـCSS: جسم بسماكة حقيقية، إطار تيتانيوم، زجاج يلمع مع الدوران، وظلّ على الجدار.
// الشاشة بمقاس منطقي 440×956 (iPhone 6.9″) أو بمقاس اللقطة الأصلية 1320×2868.

export const SCREEN_RATIO = 2868 / 1320;

export type PhonePose = {
  x: number; // مركز الهاتف على اللوحة
  y: number;
  s: number; // عرض الشاشة بالبكسل
  rx?: number;
  ry?: number;
  rz?: number;
  z?: number;
};

export const phoneDims = (s: number) => {
  const bezel = s * 0.036;
  const bw = s + bezel * 2;
  const bh = s * SCREEN_RATIO + bezel * 2;
  const r = bw * 0.165;
  return { bezel, bw, bh, r, sr: r - bezel };
};

export const Phone3D: React.FC<{
  pose: PhonePose;
  children: React.ReactNode; // محتوى الشاشة بمقاس الشاشة نفسه
  island?: boolean;
  shadow?: { dx: number; dy: number; blur: number; opacity: number };
  overlay?: React.ReactNode; // طبقة فوق الشاشة (ظل المشربية مثلًا)
  glare?: number;
  dim?: number; // تعتيم الشاشة (٠..١)
  perspective?: number;
}> = ({ pose, children, island = false, shadow, overlay, glare = 1, dim = 0, perspective = 2600 }) => {
  const { x, y, s, rx = 0, ry = 0, rz = 0, z = 0 } = pose;
  const { bezel, bw, bh, r, sr } = phoneDims(s);
  const layers = 11;
  const step = s * 0.0062;
  // موضع لمعة الزجاج يتبع الدوران
  const glarePos = 50 + ry * 2.2 - rx * 1.2;
  const rimLight = Math.max(0, Math.min(1, 0.5 + ry / 40));

  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      {shadow ? (
        <div
          style={{
            position: "absolute",
            left: -bw / 2 + shadow.dx,
            top: -bh / 2 + shadow.dy,
            width: bw,
            height: bh,
            borderRadius: r,
            background: "rgba(5,14,12,1)",
            opacity: shadow.opacity,
            filter: `blur(${shadow.blur}px)`,
            rotate: `${rz}deg`,
            scale: "0.97",
          }}
        />
      ) : null}
      <div style={{ position: "absolute", left: 0, top: 0, perspective, perspectiveOrigin: "50% 50%" }}>
        <div
          style={{
            position: "absolute",
            left: -bw / 2,
            top: -bh / 2,
            width: bw,
            height: bh,
            transformStyle: "preserve-3d",
            transform: `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
          }}
        >
          {/* سماكة الجسم: طبقات متتالية للخلف */}
          {new Array(layers).fill(0).map((_, i) => {
            const k = i / (layers - 1);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: r,
                  transform: `translateZ(${-(i + 1) * step}px)`,
                  background: `linear-gradient(${120 + ry}deg, rgb(${92 - k * 40},${98 - k * 42},${96 - k * 41}) 0%, rgb(${38 - k * 14},${42 - k * 15},${41 - k * 15}) 45%, rgb(${70 - k * 30},${75 - k * 32},${73 - k * 31}) 100%)`,
                  boxShadow: i === layers - 1 ? "0 0 0 1px rgba(0,0,0,0.5)" : undefined,
                }}
              />
            );
          })}
          {/* الوجه الأمامي: حافة مصقولة ثم إطار أسود ثم الشاشة */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: r,
              background: `linear-gradient(${135 + ry * 1.5}deg, rgba(235,240,238,${0.55 + rimLight * 0.35}) 0%, #5d6462 18%, #1d2120 50%, #6b7270 82%, rgba(220,226,224,${0.4 + (1 - rimLight) * 0.4}) 100%)`,
            }}
          />
          <div style={{ position: "absolute", inset: s * 0.006, borderRadius: r - s * 0.006, background: "#050606" }} />
          <div
            style={{
              position: "absolute",
              left: bezel,
              top: bezel,
              width: s,
              height: s * SCREEN_RATIO,
              borderRadius: sr,
              overflow: "hidden",
              background: "#000",
              transform: "translateZ(0.5px)",
            }}
          >
            {children}
            {overlay ? <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{overlay}</div> : null}
            {dim > 0 ? <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dim }} /> : null}
            {island ? (
              <div
                style={{
                  position: "absolute",
                  left: s / 2 - s * 0.143,
                  top: s * 0.026,
                  width: s * 0.286,
                  height: s * 0.084,
                  borderRadius: s * 0.05,
                  background: "#000",
                }}
              />
            ) : null}
            {/* لمعة الزجاج */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.55 * glare,
                background: `linear-gradient(112deg, rgba(255,255,255,0) ${glarePos - 22}%, rgba(255,255,255,0.16) ${glarePos - 6}%, rgba(255,255,255,0.05) ${glarePos + 4}%, rgba(255,255,255,0) ${glarePos + 18}%)`,
                mixBlendMode: "screen",
              }}
            />
            <div style={{ position: "absolute", inset: 0, borderRadius: sr, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.06)" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** حاوية تعرض لقطة/شاشة بمقاسها الأصلي مصغّرة إلى عرض الشاشة */
export const ScreenScale: React.FC<{ s: number; native: number; children: React.ReactNode }> = ({ s, native, children }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: native, height: native * SCREEN_RATIO, scale: String(s / native), transformOrigin: "0 0" }}>{children}</div>
);
