import { motionPx } from "../src/world";
const out: number[] = [];
let tot = 0;
for (let f = 0; f < 900; f++) {
  const m = motionPx(f / 30, 0.5 / 30);
  const s = Math.min(24, Math.max(3, Math.ceil(m / 1.6)));
  out.push(s);
  tot += s;
}
console.log("moyenne", (tot / 900).toFixed(2));
for (let s = 0; s < 30; s++) console.log(`${s}s:`, out.slice(s * 30, s * 30 + 30).join(" "));
