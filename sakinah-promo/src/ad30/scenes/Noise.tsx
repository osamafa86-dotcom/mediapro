import React from "react";
import { AbsoluteFill, random } from "remotion";
import { FONT, lerp, ramp } from "../core";

// الضجيج: إشعارات وإعلانات ونوافذ إذن تتراكم وتتسارع… ثم انقطاع تام

type Kind = "notif" | "ad" | "badge" | "dialog";
type Item = { kind: Kind; title?: string; body?: string; app?: string; color?: string; ink?: string; text?: string };

const ITEMS: Item[] = [
  { kind: "notif", app: "الرسائل", title: "لديك ١٢ رسالة جديدة", body: "اضغط للعرض", color: "#34C759" },
  { kind: "ad", text: "خصم ٧٠٪ — ينتهي اليوم!", color: "#E53935", ink: "#fff" },
  { kind: "badge", text: "٩٩+" },
  { kind: "notif", app: "الشبكة", title: "أُعجب ٢٣ شخصًا بمنشورك", body: "شاهد من تفاعل معك", color: "#2962FF" },
  { kind: "dialog", title: "هل تسمح بتتبّع نشاطك عبر التطبيقات والمواقع؟" },
  { kind: "ad", text: "اشترك الآن — آخر فرصة", color: "#FFD600", ink: "#111" },
  { kind: "notif", app: "البريد", title: "٤٨ رسالة غير مقروءة", body: "عروض · تحديثات · تذكيرات", color: "#0A84FF" },
  { kind: "badge", text: "١٢" },
  { kind: "notif", app: "المتجر", title: "سلّتك بانتظارك!", body: "أكمل الشراء قبل نفاد الكمية", color: "#FF9500" },
  { kind: "ad", text: "حمّل اللعبة واربح جوائز", color: "#D500F9", ink: "#fff" },
  { kind: "notif", app: "التحديثات", title: "تحديث متاح — أعد التشغيل الآن", body: "", color: "#8E8E93" },
  { kind: "badge", text: "٣٤" },
  { kind: "notif", app: "تنبيه", title: "تم تحديث شروط الاستخدام", body: "راجع سياسة الخصوصية الجديدة", color: "#FF3B30" },
  { kind: "ad", text: "عرض لفترة محدودة", color: "#00C853", ink: "#fff" },
  { kind: "notif", app: "البنك", title: "تذكير: موعد الدفع غدًا", body: "", color: "#5856D6" },
  { kind: "badge", text: "٧" },
  { kind: "notif", app: "الأخبار", title: "١٥ قصة لم تقرأها بعد", body: "", color: "#FF2D55" },
  { kind: "ad", text: "اضغط هنا!", color: "#2962FF", ink: "#fff" },
  { kind: "notif", app: "الفيديو", title: "بثّ مباشر الآن — لا تفوّته", body: "", color: "#FF3B30" },
  { kind: "badge", text: "٢٠٠" },
  { kind: "notif", app: "الرسائل", title: "٥ رسائل صوتية جديدة", body: "", color: "#34C759" },
  { kind: "ad", text: "خصم إضافي ٢٠٪", color: "#FF6D00", ink: "#fff" },
  { kind: "notif", app: "الألعاب", title: "مكافأتك اليومية بانتظارك", body: "", color: "#AF52DE" },
  { kind: "badge", text: "٥" },
];

const Card: React.FC<{ it: Item }> = ({ it }) => {
  if (it.kind === "badge") {
    return (
      <div style={{ minWidth: 96, height: 96, padding: "0 22px", boxSizing: "border-box", borderRadius: 48, background: "#FF3B30", color: "#fff", fontFamily: FONT.ui, fontWeight: 700, fontSize: 46, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(255,59,48,0.45)" }}>
        {it.text}
      </div>
    );
  }
  if (it.kind === "ad") {
    return (
      <div style={{ width: 560, height: 150, borderRadius: 20, background: it.color, color: it.ink, fontFamily: FONT.ui, fontWeight: 800, fontSize: 48, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 40px rgba(0,0,0,0.5)", position: "relative", direction: "rtl" }}>
        {it.text}
        <div style={{ position: "absolute", top: 10, left: 12, width: 34, height: 34, borderRadius: 17, background: "rgba(0,0,0,0.25)", color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</div>
        <div style={{ position: "absolute", bottom: 8, right: 14, fontSize: 18, fontWeight: 600, opacity: 0.7 }}>إعلان</div>
      </div>
    );
  }
  if (it.kind === "dialog") {
    return (
      <div style={{ width: 600, borderRadius: 34, background: "rgba(242,242,247,0.96)", fontFamily: FONT.ui, color: "#111", direction: "rtl", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div style={{ padding: "34px 40px 26px", fontWeight: 600, fontSize: 34, textAlign: "center", lineHeight: 1.35 }}>{it.title}</div>
        <div style={{ display: "flex", borderTop: "1.5px solid rgba(0,0,0,0.12)" }}>
          <div style={{ flex: 1, padding: 22, textAlign: "center", fontSize: 32, color: "#0A84FF", fontWeight: 600, borderLeft: "1.5px solid rgba(0,0,0,0.12)" }}>السماح</div>
          <div style={{ flex: 1, padding: 22, textAlign: "center", fontSize: 32, color: "#0A84FF" }}>عدم السماح</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: 660, borderRadius: 34, background: "rgba(245,245,247,0.94)", padding: "22px 26px", boxSizing: "border-box", display: "flex", gap: 20, alignItems: "center", fontFamily: FONT.ui, direction: "rtl", boxShadow: "0 18px 44px rgba(0,0,0,0.5)" }}>
      <div style={{ width: 70, height: 70, borderRadius: 17, background: it.color, flex: "none" }} />
      <div style={{ flex: 1, color: "#111", lineHeight: 1.3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(0,0,0,0.5)" }}>
          <span>{it.app}</span>
          <span>الآن</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 32 }}>{it.title}</div>
        {it.body ? <div style={{ fontSize: 26, color: "rgba(0,0,0,0.7)" }}>{it.body}</div> : null}
      </div>
    </div>
  );
};

export const NoiseScene: React.FC<{ f: number; end: number }> = ({ f, end }) => {
  if (f >= end) return null;
  const k = f / end; // شدة الفوضى
  const shake = (s: string) => (random(`${s}${f}`) - 0.5) * 2;
  const camScale = lerp(1.0, 1.14, k * k);
  const flash = f >= end - 5 ? (f % 2 === 0 ? 1 : 0.4) : 0;
  return (
    <AbsoluteFill style={{ background: "#0B0B0E", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(70% 50% at 50% 50%, rgba(255,40,60,${0.08 + 0.18 * k * Math.abs(Math.sin(f * 0.9))}) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill style={{ scale: String(camScale), translate: `${shake("cx") * 14 * k}px ${shake("cy") * 14 * k}px` }}>
        {ITEMS.map((it, i) => {
          const spawn = Math.floor(i * (end - 8) / ITEMS.length) - (i < 2 ? 2 : 0);
          if (f < spawn) return null;
          const t = ramp(f, spawn, spawn + 7, (x) => 1 - Math.pow(1 - x, 3) * Math.cos(x * 6) );
          const x = 80 + random(`nx${i}`) * 920;
          const y = 150 + random(`ny${i}`) * 1620;
          const rot = (random(`nr${i}`) - 0.5) * 18;
          const jit = 3 + k * 10;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                translate: `-50% -50%`,
                rotate: `${rot + shake(`r${i}`) * k * 2}deg`,
                scale: String(lerp(0.55, 1, Math.min(1.08, t)) * (it.kind === "badge" ? 1.1 : 0.92)),
                opacity: Math.min(1, ramp(f, spawn, spawn + 3)),
                marginLeft: shake(`x${i}`) * jit,
                marginTop: shake(`y${i}`) * jit,
                filter: k > 0.6 ? `drop-shadow(${4 * k}px 0 0 rgba(255,0,60,0.55)) drop-shadow(${-4 * k}px 0 0 rgba(0,160,255,0.55))` : undefined,
              }}
            >
              <Card it={it} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.12 }} />
    </AbsoluteFill>
  );
};
