import { chromium } from "playwright";
const url = "file://" + process.cwd() + "/site/index.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
for (const [name, vp, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await p.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `ref/${name}_hero.png` });
  await p.screenshot({ path: `ref/${name}_full.png`, fullPage: true });
  await p.close();
}
await b.close();
