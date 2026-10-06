// Exporte les repères du film (et la position écran des pastilles) pour le sound design.
import fs from "node:fs";
import { C, T } from "../src/timing";
import { CHIPS, projectOnBubble } from "../src/world";
const chips = CHIPS.map((c, i) => ({ t: C.chips[i], x: projectOnBubble(C.chips[i], c.dir as unknown as number[]).x, from: c.from[0] }));
fs.writeFileSync("build/cues.json", JSON.stringify({ ...C, chipsInfo: chips, bpm: T.bpm, beats: T.beats }, null, 1));
console.log("build/cues.json");
