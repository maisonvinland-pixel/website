# ONX Hiver : mise en ligne et éléments à remplir

## 1. Installer le thème
1. Shopify > Boutique en ligne > Thèmes > **Ajouter un thème > Importer un fichier ZIP** : `ONX-Hiver-Shopify.zip`.
2. Le thème arrive **non publié**. Prévisualisez-le, remplissez les éléments ci-dessous, puis publiez.
3. Applications existantes conservées : Ali Reviews (sections « reviews-importer »), Checkout X (script dans `layout/theme.liquid`), panier coulissant et vue rapide du thème.

## 2. Règle des placeholders
Tout texte ONX contenant des **[crochets]** est un placeholder : il est **surligné en jaune dans l'éditeur** et **masqué automatiquement sur la boutique en ligne**. Une section dont les contenus essentiels sont encore entre crochets ne s'affiche pas. Rien de faux ne peut donc être publié par accident.

## 3. À remplir (par ordre de priorité)

### Indispensable avant publication
| Où | Quoi |
|---|---|
| Accueil > ONX — Hero | Image hero (1600×2000, produit ou lifestyle hiver), sous-titre, 3 bénéfices, offre du moment (ou laisser vide), note réelle (ou laisser vide) |
| Accueil > ONX — Produits à onglets | Collection « Best-sellers » (automatique, triée par meilleures ventes) et « Nouveautés » (triée par date) |
| Accueil > ONX — Collections | 3 collections + images |
| Barre d'annonce | Vos vraies offres (code, seuil de livraison offerte, cadeau) |
| ONX — Réassurance (accueil, fiche produit, collection) | Délai de livraison réel, politique de retour réelle, délai de réponse du SAV |
| Fiche produit > Bloc « ONX — Bénéfices clés » | Bénéfice principal + 3 points (idéalement via métadonnées produit) |
| Fiche produit > « ONX — Réassurance » | Textes 2 à 4 |
| Paramètres > Politiques | Remboursement, expédition, confidentialité, CGV (liens auto dans le footer) |
| Navigation | Menu principal (`main-menu`) + menu `footer` (Suivi de commande, Contact, FAQ, Livraison, Retours) |

### État au 5 octobre 2026 (fait directement sur la boutique)
- Produits Sérénid archivés, articles de blog Sérénid dépubliés, menus principal et pied de page refaits pour ONX.
- 3 ensembles **actifs** à 105 € (prix barré 275 €), photos ajoutées, coloris Black / Light Grey (1977, NBA) et Light Oatmeal / Stretch Limo / Dark Oatmeal (Logo), tailles S à XL, stock non suivi (toujours disponibles à la vente).
- Code **BIENVENUE15** (-15 %, une fois par client, non cumulable avec 3 + 1) + pop-up newsletter (Thème > Pop-up newsletter) + section newsletter sur l'accueil.
- Pages Contact, À propos, Livraison, Retours, FAQ réécrites. CGV et Mentions légales réécrites mais **non publiées** (SIREN à compléter).
- Politiques Shopify : textes prêts dans `ONX-POLITIQUES.md` (à coller, Shopify ne m'autorise pas à les modifier).

### À faire de ton côté
| Où | Quoi |
|---|---|
| Paramètres > Politiques | Coller les textes de `ONX-POLITIQUES.md` |
| Pages > CGV et Mentions légales | Compléter les [crochets] (SIREN, forme juridique, médiateur), publier, puis les remettre dans le menu « footer » |
| Shopify Messaging > Automatisations | Activer l'e-mail « Bienvenue » (nouvel abonné) avec le code BIENVENUE15 |
| Avis clients | Importer de **vrais** avis via Ali Reviews ; la section « Avis clients » est masquée tant qu'il n'y en a pas |
| Thème > Réseaux sociaux | Lien Instagram / TikTok si tu en as un |

### Fiche produit « achat » (packs, stock, livraison)
| Où | Quoi |
|---|---|
| Produits > Ensembles Essentials (Logo, 1977, NBA) | Prix réels, prix barré éventuel (uniquement un vrai ancien prix), stock par taille et coloris, vos photos, puis statut **Actif** |
| Fiche produit > « ONX — Délais livraison » | Vos vrais délais : expédition sous X jours, livraison entre Y et Z jours (la frise Commandé → Expédié → Chez toi reste masquée tant que c'est vide) |
| Paramètres du thème > Panier | Seuil de livraison offerte (alimente aussi la barre de la fiche produit) |
| Fiche produit > « ONX — Stock » | Seuil « Plus que X en stock » (0 = désactivé ; affiche toujours le stock réel) |
| Fiche produit > « ONX — Packs (quantités) » | Quantités et noms des packs (par défaut 1 / 3 + 1 offert / 6 + 2 offerts, calculés depuis la remise automatique « 3 achetés = 1 offert ») |

### Conversion (fortement recommandé)
| Où | Quoi |
|---|---|
| Accueil > ONX — Offres & packs | 3 packs : liez un produit ou un bundle Shopify (prix réel + ajout direct au panier) ou saisissez prix et contenu |
| Paramètres du thème > Panier | Seuil de livraison offerte (`free_shipping_limit`, ex. 60) |
| Paramètres du thème > ONX > Panier | Collection de recommandations panier, seuil et libellé du cadeau (créez la remise automatique correspondante dans Réductions) |
| Produits > Métadonnées | `custom.badge` (BEST-SELLER, TOP VENTE, OFFRE LIMITÉE) ; `theme.upsell` (produit associé dans le panier) |
| ONX — Avis clients | Note globale et volume repris de votre application d'avis, avis réels uniquement (ou bloc d'application) |
| ONX — UGC vidéos | Vidéos verticales 9:16 dont vous avez les droits, pseudo du créateur, produit lié |
| ONX — Transformation | Images avant / après réelles, problèmes et solutions |
| ONX — Pourquoi ONX ? | Vos vraies raisons ; critères de comparaison vérifiables |
| ONX — À propos (mini) | Photo, texte de 2 à 4 lignes, lien vers la page À propos |
| FAQ (accueil, produit, page FAQ) | Réponses exactes : délais, retours, paiement, tailles, garanties |
| Footer > bloc ONX — Marque | Signature, e-mail de contact, horaires |
| Paramètres du thème > Réseaux sociaux | Instagram, TikTok, etc. |

### Optionnel
- ONX — Offre : date de fin **réelle** pour afficher un compte à rebours (jamais sans date réelle).
- Newsletter : incentive (-10 %) seulement si vous l'offrez vraiment (et configurez l'e-mail de bienvenue).
- Tests A/B : champ « Identifiant de variante » dans le hero et l'offre (remonté dans les événements de mesure).

## 4. Mesure
Événements émis vers `dataLayer` (GTM) et `Shopify.analytics` (pixels personnalisés) : `onx_hero_cta_click`, `onx_hero_offer_click`, `onx_quick_add`, `onx_quick_view_open`, `onx_cart_open`, `onx_upsell_add`, `onx_pack_add`, `onx_pack_click`, `onx_checkout_click`, `onx_sticky_atc_click`, `onx_ugc_play`, `onx_ugc_product_click`, `onx_promo_code_copy`, `onx_collection_card_click`, `onx_tab_select`, `onx_offer_cta_click`, `onx_final_cta_click`.
Ajout au panier, début de paiement et achat restent mesurés nativement par Shopify.
Désactivation : Paramètres du thème > ONX > Mesure & tests.

## 5. Charte
- Charte illustrée : `ONX-Charte-Graphique.html`
- Référence code : `snippets/onx-brand-guide.liquid` (palette, typo, composants)
- Tokens : `snippets/onx-head.liquid` · Styles : `assets/onx.css` · Interactions : `assets/onx.js`
