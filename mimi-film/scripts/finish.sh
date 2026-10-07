#!/usr/bin/env bash
# Assemblage final : 3D (2160×3840) + typo (PNG alpha) [+ sous-titres] -> réduction 1080×1920, grain, encodage.
# usage : scripts/finish.sh [soustitre]
set -euo pipefail
cd "$(dirname "$0")/.."
SUBS="${1:-}"
mkdir -p out
# noms d'images normalisés sur 3 chiffres (Remotion adapte le remplissage à la plage rendue)
python3 - <<'PY'
import os, re
for d in ["build/frames_MIMI-3D", "build/frames_MIMI-TYPE", "build/frames_MIMI-SUBS"]:
    if not os.path.isdir(d):
        continue
    for f in os.listdir(d):
        m = re.match(r"element-(\d+)\.(\w+)$", f)
        if m and len(m.group(1)) != 3:
            os.rename(os.path.join(d, f), os.path.join(d, f"element-{int(m.group(1)):03d}.{m.group(2)}"))
PY
F3D="build/frames_MIMI-3D/element-%03d.jpeg"
FTY="build/frames_MIMI-TYPE/element-%03d.png"
FST="build/frames_MIMI-SUBS/element-%03d.png"
OUT="out/MIMI_film_30s_9x16.mp4"
INPUTS=(-framerate 30 -i "$F3D" -framerate 30 -i "$FTY")
GRAPH="[0:v]format=rgb24[bg];[1:v]format=rgba[ty];[bg][ty]overlay=format=rgb:shortest=1[c]"
if [[ "$SUBS" == "soustitre" ]]; then
  OUT="out/MIMI_film_30s_9x16_soustitre.mp4"
  INPUTS+=(-framerate 30 -i "$FST")
  GRAPH="$GRAPH;[2:v]format=rgba,scale=2160:3840:flags=lanczos[st];[c][st]overlay=format=rgb:shortest=1[c2]"
  LAST="[c2]"
else
  LAST="[c]"
fi
AIDX=$(( ${#INPUTS[@]} / 4 ))  # nombre d'entrées vidéo (4 arguments chacune) = index de l'audio
# réduction 2x -> 1x (lanczos) en BT.709, puis grain de pellicule : bruit animé généré en 540×960,
# agrandi (grain d'environ 2 px, organique et compressible) et fondu en « overlay » à faible opacité
GRAPH="$GRAPH;${LAST}scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p[base]"
GRAPH="$GRAPH;color=c=0x808080:s=540x960:r=30:d=30,format=yuv420p,noise=c0s=60:c0f=t,scale=1080:1920:flags=bicubic[grain]"
GRAPH="$GRAPH;[base][grain]blend=c0_mode=overlay:c0_opacity=0.075:c1_mode=normal:c1_opacity=1:c2_mode=normal:c2_opacity=1,format=yuv420p[v]"
ffmpeg -y -v warning -nostats "${INPUTS[@]}" -i build/mix.wav \
  -filter_complex "$GRAPH" -map "[v]" -map "${AIDX}:a" \
  -c:v libx264 -preset slow -crf 14 -maxrate 45M -bufsize 75M -profile:v high -level:v 4.2 -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -x264-params "aq-mode=3:aq-strength=0.9:deblock=-1,-1" \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart -shortest "$OUT"
echo "$OUT"
