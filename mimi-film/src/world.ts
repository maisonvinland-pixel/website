// Le film comme fonction pure du temps : world(t) décrit caméra, bulle, gouttes, pastilles.
// Le moteur 3D l'échantillonne 8 fois par image (flou de mouvement réel), la typo aussi.
import * as THREE from "three";
import { C, DURATION } from "./timing";

export const W = 1080;
export const H = 1920;

// ---------- outils ----------
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeIn = (x: number) => x * x * x;
export const elastic = (p: number) =>
  p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -9 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
/** courbe « ressort » : dépasse, revient, se pose */
export const springOut = (p: number, k = 7, z = 0.32) =>
  p <= 0 ? 0 : p >= 1.6 ? 1 : 1 - Math.exp(-z * k * p) * Math.cos(k * Math.sqrt(1 - z * z) * p);

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// bruit lisse 1D déterministe (somme de sinus incommensurables)
const n1 = (t: number, s: number) =>
  Math.sin(t * 1.31 + s) * 0.5 + Math.sin(t * 2.17 + s * 1.7) * 0.3 + Math.sin(t * 3.93 + s * 2.3) * 0.2;

// ---------- physique de ressort (pré-calculée, 600 Hz) ----------
const DT = 1 / 600;
const N = Math.ceil((DURATION + 1) / DT);

type Impulse = { t: number; v: number };
function simulate(
  k: number,
  c: number,
  target: (t: number) => number,
  impulses: Impulse[],
  resets: number[] = []
) {
  const out = new Float32Array(N);
  let x = target(0);
  let v = 0;
  let ii = 0;
  let ri = 0;
  const imps = [...impulses].sort((a, b) => a.t - b.t);
  const rs = [...resets].sort((a, b) => a - b);
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    while (ii < imps.length && imps[ii].t <= t) v += imps[ii++].v;
    while (ri < rs.length && rs[ri] <= t) {
      x = target(t);
      v = 0;
      ri++;
    }
    const a = -k * (x - target(t)) - c * v;
    v += a * DT;
    x += v * DT;
    out[i] = x;
  }
  return out;
}
const sample = (arr: Float32Array, t: number) => {
  const f = clamp(t / DT, 0, N - 1.001);
  const i = Math.floor(f);
  return lerp(arr[i], arr[i + 1], f - i);
};

// gélatine : amplitude du bruit de surface
const wobTarget = (t: number) => {
  let w = 0.32;
  if (t > C.cut && t < C.drop) w += 1.1 * easeIn(inv(C.cut, C.drop, t));
  return w;
};
const WOB = simulate(
  40,
  5.5,
  wobTarget,
  [
    ...C.chips.map((t) => ({ t, v: 2.6 })),
    { t: C.regrow + 0.25, v: 6 },
    { t: C.title + 2.25, v: 4 },
    { t: C.end + 0.9, v: 3 },
  ],
  [C.regrow - 0.2]
);

// écrasement vertical (squash & stretch)
const SQ = simulate(
  210,
  8.5,
  () => 0,
  [
    ...C.chips.map((t) => ({ t, v: 3.2 })),
    { t: C.t1, v: 1.6 },
    { t: C.svc, v: 1.4 },
    { t: C.acc, v: -2.2 },
    { t: C.regrow + 0.32, v: 4.5 },
    { t: C.title, v: 1.8 },
    { t: C.offer, v: 2.2 },
    { t: C.end + 0.95, v: 3.5 },
  ],
  [C.cut]
);

// étirement du chewing-gum : la pointe est tirée, puis relâchée
const TIP_DIR = new THREE.Vector3(0.62, 0.72, 0.31).normalize();
const TIP2_DIR = new THREE.Vector3(-0.66, 0.68, 0.32).normalize();
const tipTarget = (t: number) => {
  if (t >= C.r0 - 0.15 && t < C.cut) {
    if (t < C.r1) return 0.55;
    if (t < C.r2) return 1.05;
    return 1.6;
  }
  if (t >= C.title + 1.05 && t < C.title + 2.2) return 1.25;
  return 0;
};
const TIP = simulate(70, 6.2, tipTarget, [], [C.cut, C.drop]);

// ---------- bulle ----------
export const BUBBLE_R = 1;

export type BubbleState = {
  pos: THREE.Vector3;
  scale: number;
  yaw: number;
  wob: number;
  squash: THREE.Vector3;
  tip: THREE.Vector3; // espace objet (rayon 1)
  visible: boolean;
};

function bubbleScale(t: number) {
  if (t < C.cut) return 0.9 + 0.1 * easeOutExpo(clamp(t / 1.6));
  if (t < C.drop) return 1 + 0.78 * easeInOut(inv(C.cut, C.drop, t));
  if (t < C.drop + 0.07) return 1.78 * (1 + 0.1 * inv(C.drop, C.drop + 0.07, t));
  if (t < C.regrow - 0.12) return 0;
  return elastic(inv(C.regrow - 0.12, C.regrow + 1.25, t));
}

// ---------- caméra ----------
type Key = {
  t: number;
  az: number; // degrés autour de la bulle
  el: number;
  dist: number;
  look: [number, number, number];
  fov: number;
  roll: number;
  focus: number; // distance de mise au point (unités monde)
  bokeh: number;
};
const K = (
  t: number,
  az: number,
  el: number,
  dist: number,
  look: [number, number, number],
  fov: number,
  roll: number,
  focus: number,
  bokeh: number
): Key => ({ t, az, el, dist, look, fov, roll, focus, bokeh });

// trois segments séparés par deux coupes franches (C.cut et C.cut2, sur le drop)
const SEGMENTS: Key[][] = [
  [
    K(0, 56, 2, 2.6, [-0.4, 0.25, 0], 26, -7, 1.5, 4.5),
    K(1.25, 36, 6, 5.2, [0, 0.3, 0], 26, -3, 4.4, 3.2),
    K(2.5, 14, 8, 12.4, [0, 0.62, 0], 26, -0.5, 11.3, 2.2),
    K(C.svc, -16, 10, 12.6, [0, 0.55, 0], 26, 0, 11.5, 2.2),
    K(C.r0, -64, 6, 11.2, [0.2, 0.42, 0], 26, 0.8, 10.2, 2.2),
    K(C.cut, -82, 3, 9.0, [0.45, 0.66, 0], 26, 2.2, 8.0, 2.6),
  ],
  [
    K(C.cut, 24, -15, 10.4, [0, 1.25, 0], 30, 5, 9.3, 2.8),
    K(C.drop, 9, -10, 8.3, [0, 1.05, 0], 30, 1.5, 6.6, 2.8),
  ],
  [
    K(C.cut2, -34, 33, 17.0, [0, -0.35, 0], 30, -3, 15.6, 2.0),
    K(C.regrow, -20, 21, 14.6, [0, 0.05, 0], 30, -1.2, 13.4, 2.0),
    K(C.rev2 + 1.0, 0, 11, 12.4, [0, 0.55, 0], 27, 0, 11.3, 2.0),
    K(C.title, 10, 9, 12.4, [-0.62, 0.92, 0], 27, 0, 11.3, 2.0),
    K(C.title + 3.3, 33, 4, 11.4, [-0.72, 0.86, 0], 27, -0.8, 10.4, 2.0),
    K(C.offer, 40, 6, 11.2, [-0.78, 0.62, 0], 27, -1, 10.1, 2.0),
    K(C.end, 24, 6, 12.0, [0, 0.42, 0], 27, 0, 11.0, 1.8),
    K(DURATION + 0.5, 16, 5, 12.4, [0, 0.42, 0], 27, 0, 11.4, 1.8),
  ],
];
const SEG_START = [0, C.cut, C.cut2];

// Catmull-Rom centripète simplifiée sur chaque paramètre (vitesse continue entre les clés)
function cr(p0: number, p1: number, p2: number, p3: number, u: number, t0: number, t1: number, t2: number, t3: number) {
  const m1 = ((p2 - p0) / (t2 - t0)) * (t2 - t1);
  const m2 = ((p3 - p1) / (t3 - t1)) * (t2 - t1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
}
function keyAt(keys: Key[], t: number): Key {
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
  let i = 0;
  while (keys[i + 1].t < t) i++;
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k0 = keys[i - 1] ?? { ...k1, t: k1.t - (k2.t - k1.t) };
  const k3 = keys[i + 2] ?? { ...k2, t: k2.t + (k2.t - k1.t) };
  // départ et arrivée de segment : vitesse nulle pour les clés de bord (on garde l'élan entre les clés internes)
  const u = (t - k1.t) / (k2.t - k1.t);
  const f = (g: (k: Key) => number) => {
    const a = keys[i - 1] ? g(k0) : g(k1) - (g(k2) - g(k1));
    const d = keys[i + 2] ? g(k3) : g(k2) + (g(k2) - g(k1));
    return cr(a, g(k1), g(k2), d, u, k0.t, k1.t, k2.t, k3.t);
  };
  return {
    t,
    az: f((k) => k.az),
    el: f((k) => k.el),
    dist: f((k) => k.dist),
    look: [f((k) => k.look[0]), f((k) => k.look[1]), f((k) => k.look[2])],
    fov: f((k) => k.fov),
    roll: f((k) => k.roll),
    focus: f((k) => k.focus),
    bokeh: f((k) => k.bokeh),
  };
}

export type CamState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
  focus: number;
  bokeh: number;
  seg: number;
};

export function cameraAt(t: number): CamState {
  const seg = t < C.cut ? 0 : t < C.cut2 ? 1 : 2;
  const k = keyAt(SEGMENTS[seg], t);
  const az = THREE.MathUtils.degToRad(k.az);
  const el = THREE.MathUtils.degToRad(k.el);
  const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(k.dist);
  const target = new THREE.Vector3(...k.look);
  // caméra « à l'épaule » très légère, plus nerveuse dans la montée vers le drop
  let shake = 0.012;
  if (t > C.cut && t < C.drop) shake += 0.05 * easeIn(inv(C.cut, C.drop, t));
  if (t >= C.drop && t < C.drop + 0.6) shake += 0.12 * Math.exp(-(t - C.drop) * 7);
  const sh = new THREE.Vector3(n1(t * 1.7, 1), n1(t * 1.9, 7), n1(t * 1.3, 13)).multiplyScalar(shake * k.dist * 0.12);
  pos.add(sh);
  target.add(sh.clone().multiplyScalar(0.6));
  const fwd = target.clone().sub(pos).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(fwd, THREE.MathUtils.degToRad(k.roll + n1(t, 3) * 0.25));
  let focus = k.focus;
  // bascule de point : premier plan -> bulle sur le titre
  if (t >= C.title - 0.3 && t < C.title + 1.2) {
    const u = easeInOut(inv(C.title - 0.3, C.title + 1.0, t));
    focus = lerp(3.4, k.focus, u);
  }
  void SEG_START;
  return { pos, target, up, fov: k.fov, focus, bokeh: k.bokeh, seg };
}

// ---------- logo final : la bulle devient le point du « mimi » ----------
export const LOGO = { x: 811, y: 760, r: 45, font: 250, textLeft: 224, top: 700 }; // position écran (px) du point du logo
const _cam = new THREE.PerspectiveCamera(26, W / H, 0.05, 200);
export function setupCamera(cam: THREE.PerspectiveCamera, c: CamState) {
  cam.fov = c.fov;
  cam.aspect = W / H;
  cam.position.copy(c.pos);
  cam.up.copy(c.up);
  cam.lookAt(c.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}
/** point monde dont la projection est (x, y) px, à la distance d de la caméra */
function unproject(c: CamState, x: number, y: number, d: number) {
  setupCamera(_cam, c);
  const ndc = new THREE.Vector3((x / W) * 2 - 1, -(y / H) * 2 + 1, 0.5).unproject(_cam);
  return ndc.sub(c.pos).normalize().multiplyScalar(d).add(c.pos);
}

export function bubbleAt(t: number): BubbleState {
  const bob = 0.06 * Math.sin(t * 1.15) + 0.025 * Math.sin(t * 2.3 + 1);
  const pos = new THREE.Vector3(0.02 * Math.sin(t * 0.7), bob, 0);
  let scale = bubbleScale(t);
  const sq = sample(SQ, t);
  const squash = new THREE.Vector3(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  const tipAmt = sample(TIP, t);
  const tipDir = t > C.title ? TIP2_DIR : TIP_DIR;
  const tip = tipDir.clone().multiplyScalar(tipAmt);
  if (t >= C.end) {
    // trajectoire en courbe vers le point du logo, en rétrécissant
    const u = easeInOut(inv(C.end, C.end + 0.95, t));
    const c = cameraAt(t);
    const d0 = c.pos.distanceTo(pos);
    const fovr = THREE.MathUtils.degToRad(c.fov / 2);
    const sEnd = (LOGO.r * d0 * Math.tan(fovr)) / (BUBBLE_R * (H / 2));
    const endPos = unproject(c, LOGO.x, LOGO.y, d0);
    const arc = new THREE.Vector3(0, Math.sin(u * Math.PI) * 0.9, 0);
    pos.lerp(endPos, u).add(arc);
    scale = lerp(scale, sEnd, easeIn(u) * 0.35 + u * 0.65);
  }
  const yaw = t * 0.2 + 0.15 * Math.sin(t * 0.4);
  return { pos, scale, yaw, wob: clamp(sample(WOB, t), 0, 1.1), squash, tip, visible: scale > 0.002 };
}

// ---------- gouttes de l'éclatement ----------
export const DROPS = (() => {
  const r = rng(7);
  const out: { dir: THREE.Vector3; speed: number; size: number; spin: THREE.Vector3; color: number }[] = [];
  for (let i = 0; i < 56; i++) {
    const z = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    // davantage de gouttes vers la caméra du plan 2 (avant), pour l'impact
    const dir = new THREE.Vector3(Math.cos(a) * s, z * 0.85 + 0.15, Math.sin(a) * s + 0.25).normalize();
    out.push({
      dir,
      speed: 5 + r() * 11,
      size: 0.05 + Math.pow(r(), 2.2) * 0.26,
      spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(8),
      color: i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
    });
  }
  return out;
})();

export function dropAt(i: number, t: number) {
  const d = DROPS[i];
  if (t < C.drop + 0.035 || t > C.regrow + 0.5) return null;
  const tau = t - C.drop;
  const k = 2.6; // frottement : les gouttes ralentissent et flottent (effet ralenti)
  const g = -1.1;
  const R0 = 1.78;
  const travel = (d.speed * (1 - Math.exp(-k * tau))) / k;
  const grav = g * (tau / k - (1 - Math.exp(-k * tau)) / (k * k));
  const p = d.dir.clone().multiplyScalar(R0 + travel);
  p.y += grav;
  let size = d.size * easeOutExpo(clamp(tau / 0.08));
  // retour : « elle revient toujours »
  const back0 = C.regrow - 0.4;
  if (t > back0) {
    const u = easeIn(inv(back0, C.regrow + 0.45, t));
    p.lerp(d.dir.clone().multiplyScalar(0.55), u);
    size *= 1 - u;
  }
  const rot = d.spin.clone().multiplyScalar(tau);
  return { p, size, rot };
}

// ---------- pastilles « services » collées à la bulle ----------
// côté écran visé au moment de l'impact (x : droite, y : haut), converti en direction locale de la bulle
const CHIP_DEF = [
  { label: "Pubs Meta & TikTok", icon: "send", side: [-0.62, 0.5], from: [-1, -0.2] },
  { label: "Contenus", icon: "insta", side: [0.66, 0.42], from: [1, -0.4] },
  { label: "Sites qui vendent", icon: "site", side: [-0.6, -0.42], from: [-1, 0.5] },
  { label: "Google & avis", icon: "pin", side: [0.64, -0.36], from: [1, 0.3] },
  { label: "Automatisation IA", icon: "ia", side: [0.08, 0.7], from: [0, -1] },
];
export const CHIPS = CHIP_DEF.map((c, i) => {
  const t = C.chips[i];
  const cam = cameraAt(t);
  const b = bubbleAt(t);
  const fwd = cam.pos.clone().sub(b.pos).normalize(); // de la bulle vers la caméra
  const right = new THREE.Vector3().crossVectors(cam.up, fwd).normalize();
  const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const z = Math.sqrt(Math.max(0.05, 1 - c.side[0] ** 2 - c.side[1] ** 2));
  const world = right.multiplyScalar(c.side[0]).add(up.multiplyScalar(c.side[1])).add(fwd.multiplyScalar(z)).normalize();
  const local = world.applyAxisAngle(new THREE.Vector3(0, 1, 0), -b.yaw);
  return { ...c, dir: [local.x, local.y, local.z] };
});

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
/** projette un point de la surface de la bulle (direction en espace objet) à l'écran */
export function projectOnBubble(t: number, dir: readonly number[] | THREE.Vector3, lift = 1.02) {
  const b = bubbleAt(t);
  const c = cameraAt(t);
  setupCamera(_cam, c);
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw);
  _m.compose(b.pos, _q, new THREE.Vector3(b.scale, b.scale, b.scale).multiply(b.squash));
  const local = Array.isArray(dir) ? new THREE.Vector3(...(dir as number[])) : (dir as THREE.Vector3).clone();
  local.normalize().multiplyScalar(lift);
  const wp = local.clone().applyMatrix4(_m);
  const nrm = local.clone().applyQuaternion(_q).normalize();
  const view = c.pos.clone().sub(wp).normalize();
  const facing = nrm.dot(view);
  _v.copy(wp).project(_cam);
  return { x: ((_v.x + 1) / 2) * W, y: ((1 - _v.y) / 2) * H, facing, scale: b.scale };
}

export function projectPoint(t: number, p: THREE.Vector3) {
  setupCamera(_cam, cameraAt(t));
  _v.copy(p).project(_cam);
  return { x: ((_v.x + 1) / 2) * W, y: ((1 - _v.y) / 2) * H };
}

/** rayon apparent de la bulle à l'écran (px) */
export function bubbleScreen(t: number) {
  const b = bubbleAt(t);
  const c = cameraAt(t);
  const d = c.pos.distanceTo(b.pos);
  const r = (BUBBLE_R * b.scale) / d / Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) * (H / 2);
  const p = projectPoint(t, b.pos);
  return { ...p, r };
}

// ---------- flash et souffle du drop ----------
export function flashAt(t: number) {
  if (t < C.drop) return 0;
  return Math.exp(-(t - C.drop) * 9);
}

// ---------- flou de mouvement adaptatif ----------
/** déplacement écran maximal (px, échelle 1) des éléments 3D pendant l'obturation de l'image à t */
/** garde un instant d'obturation dans le même plan que l'instant central (pas de flou à travers une coupe) */
export function sameShot(center: number, t: number) {
  for (const cut of [C.cut, C.cut2]) {
    if (center >= cut && t < cut) return cut;
    if (center < cut && t >= cut) return cut - 1e-4;
  }
  return t;
}

export function motionPx(t: number, shutter: number) {
  const a = sameShot(t, t - shutter / 2);
  const b = sameShot(t, t + shutter / 2);
  let m = 0;
  const pts = (tt: number) => {
    const out: { x: number; y: number }[] = [];
    const bs = bubbleScreen(tt);
    if (bs.r > 0.5) {
      out.push({ x: bs.x, y: bs.y }, { x: bs.x + bs.r, y: bs.y }, { x: bs.x, y: bs.y - bs.r }, { x: bs.x - bs.r, y: bs.y + bs.r * 0.3 });
      const b = bubbleAt(tt);
      const tipLen = b.tip.length();
      out.push(projectPoint(tt, b.pos.clone().add(b.tip.clone().normalize().multiplyScalar((1 + tipLen) * b.scale))));
    } else out.push({ x: NaN, y: NaN }, { x: NaN, y: NaN }, { x: NaN, y: NaN }, { x: NaN, y: NaN }, { x: NaN, y: NaN });
    for (let i = 0; i < DROPS.length; i += 3) {
      const d = dropAt(i, tt);
      out.push(d ? projectPoint(tt, d.p) : { x: NaN, y: NaN });
    }
    return out;
  };
  const pa = pts(a);
  const pb = pts(b);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const d = Math.hypot(pa[i].x - pb[i].x, pa[i].y - pb[i].y);
    if (Number.isFinite(d)) m = Math.max(m, d);
  }
  // les billes flottantes et le décor bougent avec la caméra : on mesure un point de référence éloigné
  const fa = projectPoint(a, new THREE.Vector3(3.6, -0.6, -6));
  const fb = projectPoint(b, new THREE.Vector3(3.6, -0.6, -6));
  if (Math.abs(fa.x) < W * 2) m = Math.max(m, Math.hypot(fa.x - fb.x, fa.y - fb.y) * 0.6);
  return m;
}
