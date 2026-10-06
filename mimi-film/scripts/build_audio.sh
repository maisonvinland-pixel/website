#!/usr/bin/env bash
# Analyse musicale -> repères -> sound design -> mixage/mastering (-16 LUFS, -1 dBTP)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/analyze_music.py
npx tsx scripts/cues.ts
python3 scripts/sfx.py
python3 scripts/mix.py
