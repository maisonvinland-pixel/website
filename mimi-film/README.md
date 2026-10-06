# MIMI · Film de marque 30 s (9:16)

Film publicitaire pour Snapchat et Instagram, réalisé en code :
Remotion pour le montage et le rendu, Three.js via `@remotion/three` pour la 3D, `postprocessing` pour les effets de caméra.

## Livrables

| Fichier | Contenu |
|---|---|
| `out/MIMI_film_30s_9x16.mp4` | 1080×1920, 30 i/s, H.264 High, yuv420p, CRF 14, +faststart. Son AAC 48 kHz stéréo 320 kbps, -16 LUFS, true peak ≤ -1 dBTP |
| `out/MIMI_film_30s_9x16_soustitre.mp4` | le même film avec sous-titres incrustés |
| `VOIX-OFF.md` | texte de la voix off, calé sur le montage |

## Comment c'est fabriqué

- **3D physique** (`src/three/`) : la bulle est un `MeshPhysicalMaterial` avec clearcoat, sheen, iridescence très légère et translucidité en bord de silhouette. Elle est éclairée par un `RoomEnvironment` avec trois lumières de studio et des ombres VSM douces. Un shader de bruit la déforme. Des ressorts pré-calculés pilotent l'écrasement, la gélatine et l'étirement du chewing-gum (`src/world.ts`).
- **Langage de caméra** : trajectoires en splines par plan, une coupe franche à 13 s et une autre sur le drop. Mise au point qui bascule, caméra « à l'épaule » qui s'énerve dans la montée.
- **Flou de mouvement réel** : chaque image est la moyenne de N rendus décalés dans le temps (obturateur à 180°), avec N adapté au mouvement réel (2 à 24 sous-images, 8 en moyenne quand ça bouge). La typo est floutée de la même façon, par accumulation additive (`plus-lighter`).
- **Finition** : profondeur de champ, bloom sur les reflets, aberration chromatique radiale quasi invisible, épaule douce sur les hautes lumières qui garde les couleurs de marque exactes, grain animé. Rendu interne en 2160×3840 puis réduction lanczos en 1080×1920.
- **Typo cinétique** : Fraunces variable avec les axes wght, SOFT et WONK animés lettre par lettre, apparitions masquées, mots clés en italique framboise. Schibsted Grotesk pour le texte, JetBrains Mono pour les étiquettes. Jamais plus de 6 mots à l'écran.
- **Rythme** : tous les repères du montage (`src/timing.ts`) sont calés sur la grille rythmique de `src/timing.json`.
- **Son** : sound design synthétisé (`scripts/sfx.py`), calé à l'image près, puis mixé et masterisé par `scripts/mix.py`.

## Musique et voix

`assets/music.mp3` et `assets/voice.mp3` ne sont pas encore fournis. Sans eux :

- le film est calé sur une grille de 120 BPM ;
- la bande-son est un sound design complet, sans musique (rien n'a été synthétisé comme musique).

Quand les fichiers arrivent :

```bash
cp ta_musique.mp3 assets/music.mp3   # et, si besoin, assets/voice.mp3
scripts/build_audio.sh               # tempo, temps, drop -> src/timing.json ; sound design ; mixage
node scripts/render.mjs MIMI-3D 0-899 2 1     # environ 3 h (CPU, SwiftShader)
node scripts/render.mjs MIMI-TYPE 0-899 2 1   # environ 35 min
node scripts/render.mjs MIMI-SUBS 0-899 1 1   # environ 5 min
scripts/finish.sh && scripts/finish.sh soustitre
```

Le drop se cale sur la plus forte montée d'énergie grave entre 14,8 s et 16,8 s, et chaque repère se recale sur le temps ou le contretemps le plus proche. Le rendu reprend là où il s'est arrêté si on le relance.

## Aperçus

```bash
npx remotion studio src/index.ts                   # studio interactif
node scripts/animatic.mjs 0.5 build/animatic.mp4   # animatique rapide 540×960
DBG='{"samples":2}' node scripts/still.mjs 0,450,890 1   # images de contrôle
```

## Licence Remotion

Remotion est gratuit pour les particuliers et les entreprises de 3 salariés au maximum.
Au-delà, une **Company License** payante est obligatoire (voir remotion.pro).
