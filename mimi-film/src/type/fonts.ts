import { continueRender, delayRender, staticFile } from "remotion";

export const COLORS = {
  blush: "#FDF0F4",
  bubble: "#F3A2BE",
  bubble2: "#EC88AC",
  rasp: "#B23A66",
  floss: "#F0F9F8",
  sky: "#007599",
  skyDeep: "#005C78",
  ink: "#24121C",
  ink2: "#6B4A5A",
  line: "#EFC6D5",
  paper: "#FFFFFF",
};

export const DISPLAY = "MimiFraunces";
export const BODY = "MimiSchibsted";
export const MONO = "MimiMono";

let loaded = false;
export function loadFonts() {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Chargement des polices");
  const faces = [
    new FontFace(DISPLAY, `url(${staticFile("fonts/Fraunces-full.woff2")})`, { style: "normal", weight: "100 900" }),
    new FontFace(DISPLAY, `url(${staticFile("fonts/Fraunces-full-italic.woff2")})`, { style: "italic", weight: "100 900" }),
    new FontFace(BODY, `url(${staticFile("fonts/Schibsted-wght.woff2")})`, { weight: "400 900" }),
    new FontFace(MONO, `url(${staticFile("fonts/jetbrains-mono-latin-500-normal.woff2")})`, { weight: "500" }),
    new FontFace(MONO, `url(${staticFile("fonts/jetbrains-mono-latin-700-normal.woff2")})`, { weight: "700" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((fs) => {
      fs.forEach((f) => document.fonts.add(f));
      return document.fonts.ready;
    })
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
}
