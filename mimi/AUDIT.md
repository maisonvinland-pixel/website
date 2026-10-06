# Audit MIMI : ancien site → nouveau site

## Le brief (reprompt)
Refaire le site de MIMI en vraie agence marketing haut de gamme : forte valeur perçue, très vendeur, épuré, concret.
Hero original et surprenant, un seul gros effet « waouh », tout le reste calme et orienté prise de rendez-vous.
Garder l'identité (rose Bubble Gum, bleu Clear Blue Sky, Fraunces, concept chewing-gum, univers 100 % clair).

## Ce qui n'allait pas dans l'ancienne version
| Problème | Impact | Correction |
|---|---|---|
| Hero en SVG 2D, bulle « dessin » | Effet sympa mais pas premium | Bulle 3D en WebGL : brillante, on l'étire comme un vrai chewing-gum, elle éclate et se reforme, les étiquettes de services restent collées |
| Aucune preuve ni chiffre visible au-dessus de la ligne de flottaison | Valeur perçue faible | Bande de preuves : 0 € (au lieu de 490 €), 24 h, 1 interlocuteur, 100 % à votre nom |
| Offres floues (listes génériques, aucun livrable chiffré) | Le prospect ne sait pas ce qu'il achète | Livrables concrets : « Site jusqu'à 5 pages », « 12 publications / mois », « 4 créas pub testées / mois »… |
| Pas d'urgence | Pas de raison de réserver maintenant | Places restantes du mois (bandeau, hero, offres, formulaire) |
| Aucun aperçu du travail | Promesse abstraite | Comparateur avant / après glissable d'une fiche commerce |
| « Des chiffres chaque mois » sans montrer quoi | Promesse non incarnée | Exemple de rapport mensuel avec KPI et courbe (marqué « données fictives ») |
| Audit offert sans contenu précis | Peu engageant | « Fiche Google, réseaux, site, 3 concurrents → 3 actions chiffrées » |
| Formulaire envoyé par mailto | Beaucoup de demandes perdues | Envoi vers un endpoint (Formspree, Make, Zapier) + champ budget pour qualifier |
| Manifeste, textes longs | Lecture lente | Supprimés ou réduits à une phrase |
| Pas de nav active, header plat | Moins fluide | Header flouté au scroll, section active surlignée |

## Sections supprimées (jugées inutiles)
Manifeste, tableau comparatif, second ruban, encart « Pas sûr de ce qu'il vous faut ? », listes d'avantages du diagnostic, 3 questions de FAQ.

## À faire avant la mise en ligne (en haut du `<script>`, objet `MIMI`)
1. `formEndpoint` (ou `email`) : sinon le formulaire n'envoie rien.
2. `phone`, `bookingUrl` (Calendly) : s'affichent automatiquement dans le contact.
3. `auditValue` (490 €) et `slotsLeft` (3) : à mettre à vos vrais chiffres. Une fausse rareté se voit et détruit la confiance.
4. `prices` : « Sur devis » par défaut, ou « À partir de … € ».
5. **Vérifier les livrables des offres** (`OFFERS`) et le délai « 4 à 6 semaines » : je les ai rendus concrets, à ajuster à ce que vous vendez réellement.
6. `testimonials` : ajoutez de vrais avis clients, la section apparaît toute seule.
7. Pages Mentions légales et Confidentialité (obligatoires en France), et un domaine.

## Ce qui ferait encore monter la valeur perçue
- 2 ou 3 vraies études de cas (avant / après, chiffres réels).
- Une vraie photo de l'équipe ou du fondateur.
- Logos de clients réels.
