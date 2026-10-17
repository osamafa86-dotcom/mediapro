// يرندر لقطات ثابتة لإطارات محددة للمراجعة: node scripts/stills.mjs <composition> <outDir> f1 f2 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [comp, outDir, ...frames] = process.argv.slice(2);
const browserExecutable = process.env.REMOTION_BROWSER || null;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const inputProps = { withAudio: false };
const composition = await selectComposition({ serveUrl, id: comp, inputProps, browserExecutable });
for (const f of frames) {
  const output = path.join(outDir, `${comp}-${f}.png`);
  await renderStill({ composition, serveUrl, output, frame: Number(f), inputProps, browserExecutable });
  console.log(output);
}
