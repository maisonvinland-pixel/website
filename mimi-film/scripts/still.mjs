// Rendu de quelques images de contrôle : node scripts/still.mjs 0,90,480 [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const frames = (process.argv[2] ?? "0").split(",").map(Number);
const scale = Number(process.argv[3] ?? 1);
const comp = process.argv[4] ?? "MIMI";
const dbg = process.env.DBG ? JSON.parse(process.env.DBG) : undefined;
const inputProps = dbg ? { dbg } : {};
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const chromiumOptions = { gl: "swangle" };
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions, inputProps });
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: f, output: `build/still_${comp}_${f}.png`, scale, browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 600000 });
  console.log(`frame ${f} : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
