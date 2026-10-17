import React from "react";
import { AbsoluteFill, Composition, Folder } from "remotion";
import "./theme";
import { SakinahPromo } from "./SakinahPromo";
import { Background } from "./components/Background";
import { VerseScene } from "./scenes/VerseScene";
import { LogoScene } from "./scenes/LogoScene";
import { FeatureScene, FeatureProps } from "./scenes/FeatureScene";
import { PromiseScene } from "./scenes/PromiseScene";
import { EndScene } from "./scenes/EndScene";
import { FPS, SCENE, TOTAL } from "./timeline";
import { Ad30 } from "./ad30/Ad30";
import { FPS as AD_FPS, TOTAL as AD_TOTAL } from "./ad30/core";

const withBg = (C: React.FC) => () => (
  <AbsoluteFill>
    <Background />
    <C />
  </AbsoluteFill>
);
const FeatureWithBg: React.FC<FeatureProps> = (p) => (
  <AbsoluteFill>
    <Background />
    <FeatureScene {...p} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SakinahPromo"
        component={SakinahPromo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="SakinahPromoWide"
        component={SakinahPromo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="SakinahAd30"
        component={Ad30}
        durationInFrames={AD_TOTAL}
        fps={AD_FPS}
        width={1080}
        height={1920}
        defaultProps={{ withAudio: true }}
      />
      <Folder name="Scenes">
        <Composition id="Verse" component={withBg(VerseScene)} durationInFrames={SCENE.Verse} fps={FPS} width={1080} height={1920} />
        <Composition id="Logo" component={withBg(LogoScene)} durationInFrames={SCENE.Logo} fps={FPS} width={1080} height={1920} />
        <Composition
          id="Feature"
          component={FeatureWithBg}
          durationInFrames={SCENE.Mushaf}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{
            eyebrow: "القرآن الكريم",
            title: "مصحف المدينة كاملًا",
            sub: "٦٠٤ صفحات بخطوط مجمع الملك فهد",
            shots: [{ src: "shots/01-mushaf.jpg" }, { src: "shots/03-ayah.jpg", from: 78 }],
            chips: ["تلاوات ٢٠ قارئًا", "تظليل الكلمة أثناء التلاوة", "تفسير الميسر دون اتصال"],
          }}
        />
        <Composition id="Promise" component={withBg(PromiseScene)} durationInFrames={SCENE.Promise} fps={FPS} width={1080} height={1920} />
        <Composition id="End" component={withBg(EndScene)} durationInFrames={SCENE.End} fps={FPS} width={1080} height={1920} />
      </Folder>
    </>
  );
};
