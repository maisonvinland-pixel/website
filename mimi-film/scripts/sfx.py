"""Sound design du film MIMI (bruitages uniquement, aucune musique).

Tout est synthétisé et calé sur les repères de l'image (build/cues.json) :
souffles des mouvements de caméra, apparitions de texte, pastilles qui se collent,
gomme qui s'étire, montée avant le drop, éclatement, retour de la bulle, logo.
Sortie : build/sfx.wav (48 kHz, stéréo, 32 bits flottants, non normalisé).
"""
import json
import os

import numpy as np
from scipy import signal
import soundfile as sf

SR = 48000
DUR = 30.0
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cues = json.load(open(os.path.join(ROOT, "build", "cues.json")))
rng = np.random.default_rng(11)

N = int(SR * DUR)
dry = np.zeros((N, 2), np.float32)
wet_send = np.zeros((N, 2), np.float32)


def t_arr(d):
    return np.arange(int(d * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.1, sus_len=0.0):
    a_n, d_n, s_n, r_n = int(a * SR), int(d * SR), int(sus_len * SR), int(r * SR)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1), endpoint=False),
        np.linspace(1, s, max(d_n, 1), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], btype="band", output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, min(f / (SR / 2), 0.99), btype="low", output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype="high", output="sos")
    return signal.sosfilt(sos, x)


def sweep_filter(x, f0, f1, q=2.0, curve=1.0):
    """filtre passe-bande dont la fréquence glisse de f0 à f1 (par blocs)"""
    out = np.zeros_like(x)
    blk = 256
    nb = int(np.ceil(len(x) / blk))
    zi = None
    for b in range(nb):
        u = (b / max(nb - 1, 1)) ** curve
        f = f0 * (f1 / f0) ** u
        lo, hi = f / (1 + 1 / q), f * (1 + 1 / q)
        sos = signal.butter(2, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], btype="band", output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg = x[b * blk:(b + 1) * blk]
        y, zi = signal.sosfilt(sos, seg, zi=zi)
        out[b * blk:(b + 1) * blk] = y
    return out


def place(sig, t0, gain=1.0, pan=0.0, wet=0.25):
    """pan : -1 gauche, +1 droite (loi à puissance constante)"""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1) * np.sqrt(2)
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    dry[i0:i0 + n] += sig[:n] * gain
    wet_send[i0:i0 + n] += sig[:n] * gain * wet


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------- bruitages élémentaires ----------------
def whoosh(d=0.6, f0=300, f1=4000, peak=0.6, q=1.6, bright=1.0):
    n = noise(d)
    x = sweep_filter(n, f0, f1, q=q)
    tt = np.linspace(0, 1, len(x))
    e = np.where(tt < peak, (tt / peak) ** 2, ((1 - tt) / (1 - peak)) ** 1.6)
    x = x * e
    if bright < 1:
        x = lp(x, 2500 + 6000 * bright)
    return x / (np.abs(x).max() + 1e-9)


def soft_pop(f=520, d=0.18, body=0.6):
    """petit « pop » doux de lettre / bulle"""
    tt = t_arr(d)
    pitch = f * (1 + 1.2 * np.exp(-tt * 60))
    ph = 2 * np.pi * np.cumsum(pitch) / SR
    s = np.sin(ph) * np.exp(-tt * 28) * body
    c = hp(noise(d), 2500) * np.exp(-tt * 260) * 0.5
    x = s + c
    return x / (np.abs(x).max() + 1e-9)


def sticky_thwop(d=0.35, f0=330, f1=110):
    """la pastille se colle : choc mat + petite succion humide"""
    tt = t_arr(d)
    pitch = f1 + (f0 - f1) * np.exp(-tt * 30)
    ph = 2 * np.pi * np.cumsum(pitch) / SR
    body = np.sin(ph) * np.exp(-tt * 16)
    sq = bp(noise(d), 900, 3200) * np.exp(-((tt - 0.03) ** 2) / 0.0006) * 0.6
    click = hp(noise(d), 4000) * np.exp(-tt * 400) * 0.4
    x = body + sq + click
    return x / (np.abs(x).max() + 1e-9)


def rubber_stretch(d=0.6, f0=260, f1=520, grit=0.5):
    """gomme qui s'étire : couinement caoutchouteux, légère rugosité"""
    tt = t_arr(d)
    u = tt / d
    pitch = f0 * (f1 / f0) ** (u ** 0.8)
    vib = 1 + 0.03 * np.sin(2 * np.pi * 23 * tt) + 0.02 * np.sin(2 * np.pi * 61 * tt)
    ph = 2 * np.pi * np.cumsum(pitch * vib) / SR
    tone = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph + 0.4)
    # rugosité : modulation d'amplitude granuleuse
    gr = 1 + grit * (lp(noise(d), 90) * 3)
    e = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7
    x = tone * gr * e
    x = bp(x, 180, 3500)
    return x / (np.abs(x).max() + 1e-9)


def sub_hit(d=1.4, f0=95, f1=36, decay=3.2):
    tt = t_arr(d)
    pitch = f1 + (f0 - f1) * np.exp(-tt * 6)
    ph = 2 * np.pi * np.cumsum(pitch) / SR
    x = np.sin(ph) * np.exp(-tt * decay)
    x = np.tanh(x * 1.6)
    return x / (np.abs(x).max() + 1e-9)


def impact(d=1.2):
    tt = t_arr(d)
    tr = hp(noise(d), 1500) * np.exp(-tt * 90)
    mid = bp(noise(d), 120, 900) * np.exp(-tt * 18)
    x = 0.7 * tr + 0.8 * mid + 1.2 * sub_hit(d, 80, 34, 3.5)
    return x / (np.abs(x).max() + 1e-9)


def big_pop(d=0.5):
    """l'éclatement de la bulle : claquement net, souffle, corps grave"""
    tt = t_arr(d)
    snap = hp(noise(d), 2000) * np.exp(-tt * 140)
    crack = bp(noise(d), 600, 5000) * np.exp(-tt * 45) * 0.8
    pitch = 180 * np.exp(-tt * 14) + 60
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-tt * 9) * 0.9
    x = snap * 1.2 + crack + body
    return x / (np.abs(x).max() + 1e-9)


def riser(d, f0=250, f1=7000):
    n = noise(d)
    x = sweep_filter(n, f0, f1, q=3.0, curve=1.6)
    tt = np.linspace(0, 1, len(x))
    tone_p = 120 * (8 ** (tt ** 1.5))
    tone = np.sin(2 * np.pi * np.cumsum(tone_p) / SR) * 0.25
    tone += 0.12 * np.sin(2 * np.pi * np.cumsum(tone_p * 1.505) / SR)
    e = tt ** 2.2
    x = (x / (np.abs(x).max() + 1e-9) + tone) * e
    return x / (np.abs(x).max() + 1e-9)


def reverse_swell(d=0.7, f0=6000, f1=400):
    x = whoosh(d, f1, f0, peak=0.95, q=1.4)
    return x


def boing(d=0.9, f=210):
    tt = t_arr(d)
    pitch = f * (1 + 0.35 * np.exp(-tt * 5) * np.sin(2 * np.pi * 9 * tt))
    ph = 2 * np.pi * np.cumsum(pitch) / SR
    x = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-tt * 5.5)
    x[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return x / (np.abs(x).max() + 1e-9)


def tick(d=0.03, f=5200):
    tt = t_arr(d)
    x = bp(noise(d), f * 0.7, f * 1.3) * np.exp(-tt * 500)
    return x / (np.abs(x).max() + 1e-9)


def marker(d=0.75):
    """trait de feutre (soulignement)"""
    n = noise(d)
    x = bp(n, 1800, 7000)
    tt = np.linspace(0, 1, len(x))
    gr = 0.6 + 0.4 * np.abs(lp(noise(d), 40)) * 4
    e = np.sin(np.pi * tt) ** 0.6
    x = x * gr * e
    return x / (np.abs(x).max() + 1e-9)


def air_bed(d):
    """nappe d'air du studio, très discrète"""
    n = noise(d)
    x = bp(n, 200, 2400) * 0.5 + bp(noise(d), 4000, 9000) * 0.12
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t_arr(d))
    return x * lfo / (np.abs(x).max() + 1e-9)


C = cues
pan_of = lambda x: float(np.clip((x - 540) / 540, -1, 1))

# ---------------- la piste ----------------
# nappe d'air continue (coupée net sur la coupe franche, revient après)
bed = air_bed(DUR) * 0.035
bed[int(C["cut"] * SR): int((C["cut"] + 0.05) * SR)] *= np.linspace(1, 0.25, int(0.05 * SR))
place(np.stack([bed, np.roll(bed, 211)], 1), 0, wet=0.1)

# ouverture : la caméra recule depuis la surface de la gomme
place(whoosh(2.4, 160, 2200, peak=0.35, q=1.2, bright=0.6), 0.05, 0.42, pan=-0.2, wet=0.35)
place(sub_hit(1.6, 70, 38, 2.2), 0.0, 0.3, wet=0.1)
for i in range(len("Agence marketing")):
    place(tick(0.025, 5200 + 300 * (i % 3)), 0.2 + i * 0.035, 0.12, pan=-0.5 + i * 0.03, wet=0.1)

# apparitions de texte
for key, g in [("t1", 0.32), ("t2", 0.3), ("t3", 0.34), ("svc", 0.22), ("r0", 0.3), ("rev1", 0.0), ("title", 0.38), ("offer", 0.36), ("offer2", 0.3)]:
    if g == 0:
        continue
    place(whoosh(0.42, 500, 5200, peak=0.55, q=1.8), C[key] - 0.22, g * 0.6, pan=-0.35, wet=0.3)
    place(soft_pop(560 + 40 * (sum(map(ord, key)) % 5), 0.16), C[key] + 0.02, g, pan=-0.3, wet=0.25)
place(whoosh(0.42, 500, 5200, peak=0.55, q=1.8), C["regrow"] + 0.1 - 0.2, 0.2, pan=-0.35)
place(soft_pop(600, 0.16), C["regrow"] + 0.12, 0.26, pan=-0.3)
place(soft_pop(640, 0.16), C["rev2"] + 0.02, 0.28, pan=-0.3)
place(whoosh(0.5, 400, 3500, peak=0.5), C["rev2"] - 0.25, 0.18, pan=-0.3)
# « secondes » qui s'oublient
place(reverse_swell(0.9, 7000, 1500)[::-1] * 0.8, C["t3"] + 1.05, 0.12, pan=-0.2, wet=0.6)

# pastilles : vol, collage, réduction en point
for ch in C["chipsInfo"]:
    p = pan_of(ch["x"])
    place(whoosh(0.45, 700, 6500, peak=0.8, q=2.2), ch["t"] - 0.42, 0.34, pan=float(np.clip(ch["from"] * 0.8, -1, 1)), wet=0.25)
    place(sticky_thwop(), ch["t"], 0.62, pan=p, wet=0.22)
    place(soft_pop(900, 0.1, 0.4), ch["t"] + 0.64, 0.16, pan=p, wet=0.3)

# la gomme qu'on tire : trois étirements, chacun plus aigu
for k, (key, f0, f1) in enumerate([("r0", 230, 380), ("r1", 300, 520), ("r2", 380, 700)]):
    place(rubber_stretch(0.55 + 0.1 * k, f0, f1, 0.5), C[key] - 0.1, 0.17 + 0.04 * k, pan=0.35, wet=0.3)
    place(tick(0.03, 3800), C[key] + 0.1, 0.25, pan=-0.3)

# coupe franche
place(impact(1.3), C["cut"], 0.85, wet=0.35)
place(whoosh(0.35, 3000, 600, peak=0.1, q=1.5), C["cut"], 0.3, wet=0.3)

# montée vers le drop : souffle qui monte, pulsations graves sur les temps, gomme qui gonfle
build = C["drop"] - C["cut"]
rs = riser(build - 0.2)
rs[-int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))
place(rs, C["cut"] + 0.05, 0.5, wet=0.4)
for b in C["beats"]:
    if C["cut"] + 0.4 < b < C["drop"] - 0.2:
        u = (b - C["cut"]) / build
        place(sub_hit(0.35, 85, 45, 12), b, 0.18 + 0.4 * u, wet=0.05)
place(rubber_stretch(build * 0.8, 150, 420, 0.8), C["cut"] + 0.3, 0.12, pan=0.1, wet=0.35)
place(whoosh(0.5, 400, 4000, peak=0.6, q=1.6), C["acc"] - 0.3, 0.38, pan=-0.3, wet=0.3)
place(soft_pop(480, 0.2), C["acc"] + 0.02, 0.4, pan=-0.3)
# silence aspiré juste avant le drop
rv = reverse_swell(0.4, 8000, 800)
rv[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
place(rv, C["drop"] - 0.55, 0.3, wet=0.5)

# DROP : éclatement, sous-basse, pluie de gouttes
place(big_pop(), C["drop"], 1.4, wet=0.4)
place(sub_hit(1.8, 110, 32, 2.2), C["drop"], 1.3, wet=0.1)
place(whoosh(1.0, 6000, 300, peak=0.08, q=1.2), C["drop"] + 0.02, 0.5, wet=0.5)
r2 = np.random.default_rng(5)
for i in range(26):
    dt = 0.06 + r2.random() ** 1.8 * 1.6
    place(soft_pop(700 + r2.random() * 1600, 0.09, 0.5), C["drop"] + dt, 0.07 + 0.08 * r2.random(), pan=r2.uniform(-0.9, 0.9), wet=0.45)
# « et ça ne se décolle plus » : la gomme s'étire avec les lettres
place(rubber_stretch(0.7, 420, 210, 0.6), C["cut2"] + 0.05, 0.16, pan=-0.3, wet=0.3)

# retour de la bulle : aspiration, gouttes qui se rejoignent, rebond élastique
place(reverse_swell(0.95, 5000, 300), C["regrow"] - 0.85, 0.55, wet=0.4)
for i in range(14):
    place(tick(0.03, 2500 + 200 * i), C["regrow"] - 0.4 + i * 0.055, 0.1 + 0.012 * i, pan=r2.uniform(-0.7, 0.7), wet=0.3)
place(boing(1.0, 190), C["regrow"] + 0.05, 0.5, wet=0.3)
place(sub_hit(0.8, 90, 50, 5), C["regrow"] + 0.05, 0.4, wet=0.1)

# signature : soulignement, la gomme se tend vers « collent » puis claque
place(marker(0.75), C["title"] + 0.85, 0.22, pan=-0.2, wet=0.15)
place(rubber_stretch(1.0, 260, 470, 0.5), C["title"] + 1.05, 0.14, pan=-0.1, wet=0.3)
place(soft_pop(380, 0.22, 0.8), C["title"] + 2.2, 0.36, wet=0.3)
place(boing(0.8, 240), C["title"] + 2.22, 0.3, wet=0.3)

# fin : la bulle vole vers le logo et devient son point
place(whoosh(1.0, 300, 5000, peak=0.75, q=1.6), C["end"] - 0.05, 0.5, pan=0.3, wet=0.4)
place(soft_pop(700, 0.2), C["end"] + 0.95, 0.55, pan=0.5, wet=0.35)
place(boing(0.6, 330), C["end"] + 0.95, 0.22, pan=0.5, wet=0.3)
for i in range(4):
    place(soft_pop(520 + 60 * i, 0.12, 0.6), C["end"] + 0.62 + i * 0.05, 0.16, pan=-0.2 + 0.12 * i, wet=0.25)
place(whoosh(0.4, 600, 4000, peak=0.6), C["end"] + 0.85, 0.22)
place(sticky_thwop(0.3, 420, 160), C["end"] + 1.08, 0.3, wet=0.3)
place(sub_hit(1.5, 70, 40, 2.4), C["end"] + 0.95, 0.35, wet=0.1)

# ---------------- réverbération (pièce claire, courte) ----------------
def make_ir(d=1.1):
    tt = t_arr(d)
    ir = np.stack([rng.standard_normal(len(tt)), rng.standard_normal(len(tt))], 1)
    ir *= np.exp(-tt * 5.2)[:, None]
    ir[:, 0] = lp(hp(ir[:, 0], 250), 7000)
    ir[:, 1] = lp(hp(ir[:, 1], 250), 7000)
    ir[: int(0.012 * SR)] = 0  # pré-délai
    return ir / np.abs(ir).sum(0).max() * 6


ir = make_ir()
wet = np.stack([signal.fftconvolve(wet_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = dry + wet * 0.9
mix = hp(mix.T, 25).T
sf.write(os.path.join(ROOT, "build", "sfx.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
print("build/sfx.wav", mix.shape, float(np.abs(mix).max()))
