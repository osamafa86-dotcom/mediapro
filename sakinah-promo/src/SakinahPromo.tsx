import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { handoff, pagePush } from "./components/transitions";
import "./theme";
import { Background } from "./components/Background";
import { VerseScene } from "./scenes/VerseScene";
import { LogoScene } from "./scenes/LogoScene";
import { FeatureScene } from "./scenes/FeatureScene";
import { PromiseScene } from "./scenes/PromiseScene";
import { EndScene } from "./scenes/EndScene";
import { SCENE, TRANS, TRANS_KIND } from "./timeline";

export type PromoProps = { withAudio: boolean };

export const SakinahPromo: React.FC<PromoProps> = ({ withAudio }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = (i: number) => linearTiming({ durationInFrames: TRANS[i], easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const p = (i: number) => (TRANS_KIND[i] === "push" ? pagePush() : handoff());
  return (
    <AbsoluteFill style={{ backgroundColor: "#062421" }}>
      <Background glow={interpolate(frame, [durationInFrames - 170, durationInFrames - 120], [1, 1.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="الآية" durationInFrames={SCENE.Verse} premountFor={fps}>
          <VerseScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(0)} timing={t(0)} />
        <TransitionSeries.Sequence name="الشعار" durationInFrames={SCENE.Logo} premountFor={fps}>
          <LogoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(1)} timing={t(1)} />
        <TransitionSeries.Sequence name="الصلاة" durationInFrames={SCENE.Prayer} premountFor={fps}>
          <FeatureScene
            eyebrow="الصلاة"
            title="مواقيت صلاتك بدقة"
            sub="وتنبيه الأذان يصلك حتى والتطبيق مغلق"
            shots={[{ src: "shots/04-home.jpg" }]}
            chips={["طرق الهيئات الرسمية", "تقويم هجري", "تصدير إلى تقويم هاتفك"]}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(2)} timing={t(2)} />
        <TransitionSeries.Sequence name="المصحف" durationInFrames={SCENE.Mushaf} premountFor={fps}>
          <FeatureScene
            eyebrow="القرآن الكريم"
            title="مصحف المدينة كاملًا"
            sub="٦٠٤ صفحات بخطوط مجمع الملك فهد"
            shots={[{ src: "shots/01-mushaf.jpg" }, { src: "shots/03-ayah.jpg", from: 78 }]}
            chips={["تلاوات ٢٠ قارئًا", "تظليل الكلمة أثناء التلاوة", "تفسير الميسر دون اتصال"]}
            focus={{ from: 92, to: 165, x: 0.5, y: 0.18, scale: 1.25 }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(3)} timing={t(3)} />
        <TransitionSeries.Sequence name="القبلة" durationInFrames={SCENE.Qibla} premountFor={fps}>
          <FeatureScene
            eyebrow="القبلة"
            title="القبلة أينما كنت"
            sub="اتجاه دقيق نحو الكعبة مع تصحيح الانحراف المغناطيسي"
            shots={[{ src: "shots/05-qibla.jpg" }]}
            chips={["المسافة إلى الكعبة", "التحقق بالشمس والخريطة"]}
            chipStart={30}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(4)} timing={t(4)} />
        <TransitionSeries.Sequence name="الأذكار" durationInFrames={SCENE.Adhkar} premountFor={fps}>
          <FeatureScene
            eyebrow="الأذكار"
            title="أذكار يومك"
            sub="الصباح والمساء وحصن المسلم كاملًا"
            shots={[{ src: "shots/06-adhkar.jpg" }]}
            chips={["١٣٢ بابًا", "عدّاد يومي وتذكير", "المسبحة الإلكترونية"]}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(5)} timing={t(5)} />
        <TransitionSeries.Sequence name="الوعد" durationInFrames={SCENE.Promise} premountFor={fps}>
          <PromiseScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={p(6)} timing={t(6)} />
        <TransitionSeries.Sequence name="الختام" durationInFrames={SCENE.End} premountFor={fps}>
          <EndScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {withAudio ? <Audio name="المؤثرات الصوتية" src={staticFile("audio/soundtrack.wav")} premountFor={fps} /> : null}
    </AbsoluteFill>
  );
};
