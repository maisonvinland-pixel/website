"""Mixage et mastering : -16 LUFS intégré, true peak -1 dBTP, 48 kHz stéréo.

Entrées : build/sfx.wav (sound design), assets/music.mp3 et assets/voice.mp3 s'ils existent.
La musique est atténuée automatiquement sous la voix (ducking). Sortie : build/mix.wav
"""
import os
import subprocess
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

SR = 48000
DUR = 30.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_LUFS = -16.0
TARGET_TP = -1.3  # marge pour l'encodage AAC (vérifié ensuite : doit rester <= -1 dBTP)


def load(path):
    """décode n'importe quel format en 48 kHz stéréo float via ffmpeg"""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-t", str(DUR), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    out = np.zeros((N, 2), np.float32)
    out[: min(N, len(x))] = x[:N]
    return out


def env_follow(x, att=0.01, rel=0.25):
    mono = np.abs(x).max(axis=1)
    a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    e = np.zeros_like(mono)
    v = 0.0
    for i, s in enumerate(mono):
        v = a * v + (1 - a) * s if s > v else r * v + (1 - r) * s
        e[i] = v
    return e


def compress(x, thr_db=-18, ratio=2.5, att=0.008, rel=0.18, makeup_db=0.0):
    e = env_follow(x, att, rel)
    lvl = 20 * np.log10(e + 1e-9)
    over = np.maximum(lvl - thr_db, 0)
    gain_db = -over * (1 - 1 / ratio) + makeup_db
    return x * (10 ** (gain_db / 20))[:, None]


def true_peak_limit(x, ceiling_db, look=0.003, rel=0.08):
    """limiteur à anticipation sur signal suréchantillonné x4 (true peak)"""
    ceil = 10 ** (ceiling_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(axis=1).reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1.0, ceil / (pk + 1e-12))
    # anticipation : on applique la réduction un peu avant le pic
    la = int(look * SR)
    g = np.lib.stride_tricks.sliding_window_view(np.pad(need, (0, la), constant_values=1), la + 1).min(axis=1) if la > 0 else need
    r = np.exp(-1 / (rel * SR))
    out = np.empty_like(g)
    v = 1.0
    for i, s in enumerate(g):
        v = s if s < v else r * v + (1 - r) * s
        out[i] = v
    return x * out[:, None]


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def main():
    sfx = load(os.path.join(ROOT, "build", "sfx.wav"))
    music_p = os.path.join(ROOT, "assets", "music.mp3")
    voice_p = os.path.join(ROOT, "assets", "voice.mp3")
    has_music, has_voice = os.path.exists(music_p), os.path.exists(voice_p)
    mix = np.zeros((N, 2), np.float32)
    if has_music:
        music = load(music_p)
        if has_voice:
            voice = load(voice_p)
            ve = env_follow(voice, 0.02, 0.35)
            duck = 10 ** (-7 * np.clip(ve / (ve.max() + 1e-9) * 3, 0, 1) / 20)
            music = music * duck[:, None]
        # fondu de sortie sur la dernière seconde
        fade = np.ones(N)
        fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)) ** 1.5
        mix += music * fade[:, None]
        mix += sfx * 10 ** (-5 / 20)  # avec musique, le sound design passe en soutien
    else:
        mix += sfx
    if has_voice:
        voice = load(voice_p)
        sos = signal.butter(2, 80 / (SR / 2), btype="high", output="sos")
        voice = signal.sosfilt(sos, voice, axis=0)
        voice = compress(voice, -22, 3, 0.005, 0.12, 4)
        mix += voice * 1.2

    mix = compress(mix, -14, 2.0, 0.01, 0.2)
    meter = pyln.Meter(SR)
    for _ in range(4):
        lufs = meter.integrated_loudness(mix)
        mix = mix * 10 ** ((TARGET_LUFS - lufs) / 20)
        mix = true_peak_limit(mix, TARGET_TP)
    lufs = meter.integrated_loudness(mix)
    tp = true_peak_db(mix)
    # le dernier passage peut laisser la sonie à quelques centièmes de la cible
    sf.write(os.path.join(ROOT, "build", "mix.wav"), mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"mix : {lufs:.2f} LUFS, true peak {tp:.2f} dBTP (musique : {has_music}, voix : {has_voice})")


if __name__ == "__main__":
    sys.exit(main())
