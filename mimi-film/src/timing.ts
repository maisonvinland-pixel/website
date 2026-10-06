// Grille rythmique du film. `timing.json` est produit par scripts/analyze_music.py
// (tempo, temps, temps forts et drop détectés dans assets/music.mp3).
// Sans musique, le script écrit une grille par défaut à 120 BPM.
import timing from "./timing.json";

export const FPS = 30;
export const DURATION = 30;
export const FRAMES = FPS * DURATION;

type Timing = { bpm: number; beats: number[]; drop: number; hasMusic: boolean; source: string };
export const T = timing as Timing;

const beats = T.beats;
const halfBeats: number[] = [];
for (let i = 0; i < beats.length; i++) {
  halfBeats.push(beats[i]);
  if (i + 1 < beats.length) halfBeats.push((beats[i] + beats[i + 1]) / 2);
}

const nearest = (arr: number[], x: number, maxShift: number) => {
  let best = x;
  let bd = Infinity;
  for (const b of arr) {
    const d = Math.abs(b - x);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return bd <= maxShift ? best : x;
};

/** Cale un repère nominal (en secondes) sur le temps le plus proche. */
export const onBeat = (x: number) => nearest(beats, x, 0.45);
/** Cale un repère sur le temps ou le contretemps le plus proche. */
export const onHalf = (x: number) => nearest(halfBeats, x, 0.3);

const DROP = T.drop;

// Repères du film. Valeurs nominales pour 120 BPM, recalées sur la musique réelle.
export const C = {
  t1: onBeat(0.9),
  t2: onBeat(2.6),
  t3: onBeat(4.1),
  svc: onBeat(5.9),
  chips: [6.4, 7.15, 7.9, 8.65, 9.4].map(onHalf),
  r0: onBeat(10.2),
  r1: onBeat(11.0),
  r2: onBeat(11.9),
  cut: onBeat(13.0),
  acc: onBeat(14.4),
  drop: DROP,
  cut2: DROP + 4 / FPS,
  dec: onHalf(DROP + 0.4),
  regrow: onBeat(DROP + 2.5),
  rev1: onBeat(DROP + 3.0),
  rev2: onBeat(DROP + 4.0),
  title: onBeat(DROP + 5.5),
  offer: onBeat(DROP + 9.0),
  offer2: onBeat(DROP + 10.5),
  end: onBeat(DROP + 12.0),
  END: DURATION,
};
