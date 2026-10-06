import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
await p.goto('http://localhost:8765/'); await p.setContent(`<style>@font-face{font-family:F;src:url(http://localhost:8765/fonts/Fraunces-full.woff2)}</style>
<span id=a style="font-family:F;font-size:250px;font-weight:900;font-variation-settings:'SOFT' 100,'WONK' 1,'opsz' 144;letter-spacing:-0.05em;line-height:1">mimi</span>`);
await p.waitForTimeout(800);
console.log(await p.evaluate(() => { const r = document.getElementById("a").getBoundingClientRect(); return [r.width, r.height, document.fonts.check("250px F")]; }));
await b.close();
