import { C } from "../src/timing";
import { bubbleScreen } from "../src/world";
const ts = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12.9, 13.1, 14, 15, 15.9, 16.2, 17, 18.5, 19, 20, 21, 21.5, 22, 23, 24, 25, 26, 27, 28, 28.5, 29, 29.9];
console.log(JSON.stringify(C));
for (const t of ts) { const b = bubbleScreen(t); console.log(t.toFixed(1), Math.round(b.x), Math.round(b.y), "r", Math.round(b.r)); }
