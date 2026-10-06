// Animatique rapide (basse résolution) pour juger mouvement et rythme.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const scale = Number(process.argv[2] ?? 0.5);
const out = process.argv[3] ?? "build/animatic.mp4";
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const chromiumOptions = { gl: "swangle" };
const inputProps = { subtitles: false, typeSamples: 2, dbg: { samples: 1 } };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "MIMI", browserExecutable, chromiumOptions, inputProps });
const t0 = Date.now();
await renderMedia({
  serveUrl, composition, inputProps, codec: "h264", crf: 20, outputLocation: out, scale, concurrency: 1,
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames % 60 === 0) console.log(renderedFrames, ((Date.now() - t0) / 1000 / Math.max(1, renderedFrames)).toFixed(2) + " s/img"); },
});
console.log("ok", ((Date.now() - t0) / 60000).toFixed(1), "min");
