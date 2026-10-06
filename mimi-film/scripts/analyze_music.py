"""Analyse de la musique : tempo, temps, drop. Écrit src/timing.json.

Usage : python3 scripts/analyze_music.py [assets/music.mp3]
Sans fichier musique, écrit une grille par défaut à 120 BPM (le film reste calé
sur une pulsation régulière, et sera recalé dès que la vraie musique est fournie).
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "timing.json")
DUR = 30.0
DROP_NOMINAL, DROP_MIN, DROP_MAX = 16.0, 14.8, 16.8


def default_grid():
    bpm = 120.0
    beats = [round(i * 60 / bpm, 4) for i in range(int(DUR * bpm / 60) + 1)]
    return {"bpm": bpm, "beats": beats, "drop": DROP_NOMINAL, "hasMusic": False,
            "source": "grille par défaut 120 BPM (aucune musique fournie)"}


def analyze(path):
    import librosa

    y, sr = librosa.load(path, sr=22050, mono=True, duration=DUR + 2)
    hop = 512
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, units="frames")
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    bpm = float(np.atleast_1d(tempo)[0])
    # régularise la grille : extrapole avant le premier temps et après le dernier
    period = 60.0 / bpm
    if len(beats) < 8:
        g = default_grid()
        g["source"] = f"{os.path.basename(path)} : tempo non détecté, grille 120 BPM"
        return g
    first, last = beats[0], beats[-1]
    pre = list(np.arange(first - period, -1e-6, -period))[::-1]
    post = list(np.arange(last + period, DUR + period, period))
    beats = [b for b in pre + list(beats) + post if 0 <= b <= DUR + 0.01]

    # drop : plus forte montée d'énergie basse fréquence entre 14,8 s et 16,8 s, calée sur un temps
    S = np.abs(librosa.stft(y, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr)
    low = S[freqs < 180].sum(axis=0)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    n = min(len(low), len(rms))
    energy = (low[:n] / (low.max() + 1e-9)) + (rms[:n] / (rms.max() + 1e-9))
    times = librosa.frames_to_time(np.arange(n), sr=sr, hop_length=hop)
    win = int(0.5 * sr / hop)
    best, best_score = DROP_NOMINAL, -1.0
    for b in beats:
        if not (DROP_MIN <= b <= DROP_MAX):
            continue
        i = int(np.searchsorted(times, b))
        if i - win < 0 or i + win >= n:
            continue
        score = energy[i:i + win].mean() - energy[i - win:i].mean()
        if score > best_score:
            best, best_score = b, score
    return {"bpm": round(bpm, 2), "beats": [round(float(b), 4) for b in beats], "drop": round(float(best), 4),
            "hasMusic": True, "source": os.path.basename(path)}


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "music.mp3")
    data = analyze(path) if os.path.exists(path) else default_grid()
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print(f"tempo {data['bpm']} BPM, drop {data['drop']} s, {len(data['beats'])} temps ({data['source']})")


if __name__ == "__main__":
    main()
