// Rendu de la séquence d'images (interne 2x = 2160×3840) puis assemblage par scripts/finish.sh.
// node scripts/render.mjs [MIMI|MIMI-ST] [from-to] [scale] [concurrency]
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const id = process.argv[2] ?? "MIMI";
const [from, to] = (process.argv[3] ?? "0-899").split("-").map(Number);
const scale = Number(process.argv[4] ?? 2);
const concurrency = Number(process.argv[5] ?? 2);
const dbg = process.env.DBG ? JSON.parse(process.env.DBG) : undefined;
const outDir = path.resolve(process.env.OUTDIR ?? `build/frames_${id}`);
fs.mkdirSync(outDir, { recursive: true });

// reprise : on saute les images déjà rendues
const ext = id === "MIMI-TYPE" || id === "MIMI-SUBS" ? "png" : "jpeg";
const done = new Set(fs.readdirSync(outDir).filter((f) => f.endsWith("." + ext)).map((f) => Number(f.match(/(\d+)/)[1])));
let start = from;
while (start <= to && done.has(start)) start++;
if (start > to) {
  console.log("déjà rendu");
  process.exit(0);
}

const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps: dbg ? { dbg } : {} });
const t0 = Date.now();
await renderFrames({
  serveUrl,
  composition,
  inputProps: dbg ? { dbg } : {},
  frameRange: [start, to],
  outputDir: outDir,
  imageFormat: ext,
  jpegQuality: ext === "jpeg" ? 96 : undefined,
  scale,
  concurrency,
  browserExecutable,
  chromiumOptions,
  timeoutInMilliseconds: 900000,
  onStart: () => console.log(`rendu ${id} ${start}-${to} à l'échelle ${scale}`),
  onFrameUpdate: (n) => {
    if (n % 5 === 0) {
      const s = (Date.now() - t0) / 1000;
      console.log(`${n}/${to - start + 1} images, ${(s / n).toFixed(1)} s/image`);
    }
  },
});
console.log(`terminé en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
