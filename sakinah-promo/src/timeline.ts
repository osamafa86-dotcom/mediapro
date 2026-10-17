import t from "./timeline.json";

export const FPS = t.fps;
export const SCENE = Object.fromEntries(t.scenes.map((s) => [s.id, s.frames])) as Record<string, number>;
export const TRANS = t.transitions.map((x) => x.frames);
export const TRANS_KIND = t.transitions.map((x) => x.kind);
export const TOTAL = t.scenes.reduce((a, s) => a + s.frames, 0) - TRANS.reduce((a, b) => a + b, 0);
