import React from "react";
import { Img, staticFile } from "remotion";
import { FONT, easeOut, lerp, ramp } from "../core";

// شاشة القفل وقت الفجر: يصل إشعار التطبيق الحقيقي «حان الآن موعد صلاة الفجر»
// المقاس المنطقي 440×956 (iPhone 6.9″)

const LockIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2.2" fill="#fff" stroke="none" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const StatusIcons: React.FC = () => (
  <div style={{ position: "absolute", right: 30, top: 21, display: "flex", gap: 6, alignItems: "center", direction: "ltr" }}>
    <svg width="19" height="12" viewBox="0 0 19 12">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 5} y={9 - i * 3} width="3.4" height={3 + i * 3} rx="1" fill="#fff" />
      ))}
    </svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="#fff">
      <path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.4l1.2-1.3A10.6 10.6 0 0 0 8.5.4 10.6 10.6 0 0 0 1.1 3.3l1.2 1.3a8.8 8.8 0 0 1 6.2-2.4Zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3a7.2 7.2 0 0 0-9.8 0l1.2 1.3c1-.9 2.3-1.4 3.7-1.4Zm0 3.5c.5 0 1 .2 1.3.5L8.5 11.3 7.2 9.8c.3-.3.8-.5 1.3-.5Z" />
    </svg>
    <div style={{ width: 25, height: 12, borderRadius: 4, border: "1.3px solid rgba(255,255,255,0.55)", padding: 1.5, boxSizing: "border-box" }}>
      <div style={{ width: "78%", height: "100%", borderRadius: 2, background: "#fff" }} />
    </div>
  </div>
);

export const LockScreen: React.FC<{ f: number; notifyAt: number }> = ({ f, notifyAt }) => {
  const n = ramp(f, notifyAt, notifyAt + 16);
  const wake = ramp(f, notifyAt - 2, notifyAt + 8);
  const dawn = ramp(f, 0, 70, (t) => t);
  return (
    <div style={{ position: "absolute", inset: 0, width: 440, height: 956, overflow: "hidden", direction: "rtl" }}>
      {/* خلفية: سماء ما قبل الفجر مع نقش خفيف */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 45% at 50% 108%, rgba(226,150,110,${0.55 + dawn * 0.25}) 0%, rgba(226,150,110,0) 70%), linear-gradient(180deg, #071822 0%, #0B2A33 45%, #17414A 75%, #4F5A5C 100%)`,
        }}
      />
      <svg width={440} height={956} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {new Array(26).fill(0).map((_, i) => (
          <circle key={i} cx={(i * 97) % 440} cy={(i * 53) % 520} r={i % 5 === 0 ? 1.4 : 0.9} fill="#fff" opacity={0.25 + ((i * 37) % 10) / 20} />
        ))}
      </svg>
      <StatusIcons />
      <div style={{ position: "absolute", left: 0, right: 0, top: 54, display: "flex", justifyContent: "center", opacity: 0.9 }}>
        <LockIcon size={20} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 86, textAlign: "center", fontFamily: FONT.ui, fontWeight: 500, fontSize: 21, color: "rgba(255,255,255,0.86)" }}>
        الأحد ١٨ أكتوبر
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 104,
          textAlign: "center",
          fontFamily: FONT.ui,
          fontWeight: 600,
          fontSize: 118,
          lineHeight: 1.1,
          color: "rgba(255,255,255,0.94)",
          letterSpacing: -1,
        }}
      >
        ٥:٢٠
      </div>

      {/* الإشعار */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: 668,
          height: 84,
          borderRadius: 24,
          background: "rgba(246,246,244,0.80)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          opacity: n,
          translate: `0px ${lerp(46, 0, n)}px`,
          scale: String(lerp(0.94, 1, n)),
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 12,
          boxSizing: "border-box",
        }}
      >
        <Img src={staticFile("ad30/brand/icon-180.png")} style={{ width: 40, height: 40, borderRadius: 10, flex: "none" }} />
        <div style={{ flex: 1, fontFamily: FONT.ui, color: "#111", lineHeight: 1.28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 600, fontSize: 15.5 }}>حان الآن موعد صلاة الفجر</span>
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", fontWeight: 400 }}>الآن</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 400, color: "rgba(0,0,0,0.78)" }}>الفجر — ٥:٢٠ ص</div>
        </div>
      </div>

      {/* أزرار المصباح والكاميرا وشريط الرئيسية */}
      {[46, 394].map((cx, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cx - 25,
            top: 860,
            width: 50,
            height: 50,
            borderRadius: 25,
            background: "rgba(255,255,255,0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {i === 0 ? (
            <svg width="16" height="22" viewBox="0 0 16 22" fill="#fff">
              <path d="M3 1h10v4l-2 4v11H5V9L3 5Z" />
            </svg>
          ) : (
            <svg width="22" height="18" viewBox="0 0 22 18" fill="#fff">
              <path d="M7 1h8l1.6 2.5H20a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h3.4Z" />
              <circle cx="11" cy="10.5" r="4" fill="#3a4a4c" />
            </svg>
          )}
        </div>
      ))}
      <div style={{ position: "absolute", left: 150, top: 940, width: 140, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.85)" }} />
      {/* الشاشة تستيقظ عند وصول الإشعار */}
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: lerp(0.55, 0, wake) }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 30% at 50% 74%, rgba(255,255,255,0.10), rgba(255,255,255,0))", opacity: n * (1 - ramp(f, notifyAt + 10, notifyAt + 40, easeOut)) }} />
    </div>
  );
};
