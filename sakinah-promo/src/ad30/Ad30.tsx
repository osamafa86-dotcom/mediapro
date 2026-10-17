import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import "../theme";
import { B } from "./core";
import { Grain, Vignette, World } from "./World";
import { NoiseScene } from "./scenes/Noise";
import { LogoScene, VerseScene } from "./scenes/Intro";
import { DayScene, OnePlaceScene } from "./scenes/Day";
import { EndScene, PromiseScene } from "./scenes/Outro";
import cues from "./cues.json";

// إعلان سكينة — ٣٠ ثانية عمودي (1080×1920)

export const Ad30: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {f >= B.verse[0] - 2 ? <World /> : null}
      <VerseScene f={f} />
      <LogoScene f={f} nameAt={cues.logoName} hitAt={cues.logoHit} />
      <DayScene f={f} />
      <OnePlaceScene f={f} />
      <PromiseScene f={f} cues={cues.promise} />
      <EndScene f={f} />
      {f >= B.verse[0] - 2 ? <Vignette f={f} /> : null}
      <NoiseScene f={f} end={B.noise[1]} />
      <Grain f={f} opacity={f < B.noise[1] ? 0.05 : 0.075} />
      {withAudio && cues.soundtrack ? <Audio src={staticFile(cues.soundtrack)} /> : null}
    </AbsoluteFill>
  );
};
