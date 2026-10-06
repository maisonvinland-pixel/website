# MIMI · Voix off du film 30 s (9:16)

Tout le texte vient du site (`site/index.html` et la première version du site fournie). Rien n'est inventé.
Il compte 62 mots, soit environ 24 s de voix à débit posé. Le reste du temps, l'image et le sound design respirent seuls.
Les repères ci-dessous correspondent au montage actuel, sur une grille de 120 BPM. Ils se recaleront automatiquement sur `assets/music.mp3`.

| Repère | Voix off | À l'écran |
|---|---|---|
| 0,0 s | *(rien : la caméra recule depuis la surface de la gomme)* | AGENCE MARKETING |
| 1,0 s | Votre marque mérite mieux que des posts qu'on oublie en trois secondes. | Votre marque / mérite mieux, puis que des posts / qu'on oublie, puis en *trois* *secondes.* |
| 6,0 s | MIMI conçoit vos publicités, vos contenus et votre site, | les pastilles de services se collent à la bulle |
| 10,0 s | pour qu'on vous remarque, qu'on vous retienne, et qu'on vous achète. | qu'on vous *remarque. / retienne. / achète.* |
| 13,0 s (coupe) | Le principe du chewing-gum : ça accroche, | Le principe du / chewing-gum : puis ça *accroche,* |
| 16,0 s (drop) | *(éclatement : silence de voix)* | la bulle éclate |
| 16,1 s | et ça ne se décolle plus. | et ça ne se / *décolle* plus. |
| 18,5 s | Elle revient toujours. Comme vos clients. | la bulle se reforme |
| 21,5 s | MIMI. Des marques qui collent. | Des marques / qui *collent.* |
| 25,0 s | Audit offert, sans engagement. Réponse sous 24 heures ouvrées. | Audit *offert.* puis Réponse sous / *24 h ouvrées.* |
| 28,0 s | *(rien : la bulle devient le point du logo)* | mimi + « Réserver mon audit offert » |

## Texte brut (pour un comédien ou une synthèse vocale)

Votre marque mérite mieux que des posts qu'on oublie en trois secondes.
MIMI conçoit vos publicités, vos contenus et votre site, pour qu'on vous remarque, qu'on vous retienne, et qu'on vous achète.
Le principe du chewing-gum : ça accroche… et ça ne se décolle plus.
Elle revient toujours. Comme vos clients.
MIMI. Des marques qui collent.
Audit offert, sans engagement. Réponse sous 24 heures ouvrées.

## Direction de voix

Voix française chaleureuse et complice, avec un sourire dans la voix et sans ton « pub radio ».
Laisser un vrai silence sur le drop, entre « ça accroche » et « et ça ne se décolle plus ».
« MIMI » se prononce « mi-mi ».

## Intégration

Déposer `assets/voice.mp3` (30 s, calé sur les repères ci-dessus), puis lancer `scripts/build_audio.sh`.
La voix est mixée automatiquement, et la musique, si elle est présente, baisse sous la voix.
