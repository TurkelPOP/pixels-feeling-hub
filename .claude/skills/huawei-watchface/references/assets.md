# Assets à produire

Arborescence conseillée (noms ASCII, minuscules, sans espaces) :

```
assets/
  bg/background.png            # résolution pleine, opaque
  hands/hour.png               # aiguilles : image pleine résolution, pointant vers 12 h,
  hands/minute.png             #   pivot exactement au centre de l'image → rotation sans réglage
  hands/second.png
  hands/cap.png                # cache-pivot (optionnel)
  digits/time_0.png … time_9.png, time_colon.png
  digits/date_0.png … date_9.png
  digits/small_0.png … small_9.png, small_percent.png   # pas, BPM, batterie
  week/week_1.png … week_7.png  # lun → dim (Theme Studio : ordre à vérifier, souvent dim=0 ou 7)
  icons/steps.png, heart.png, battery.png, kcal.png
  battery/bat_0.png … bat_10.png # jauge par paliers de 10 %
  aod/aod_background.png, aod/aod_time_0..9.png
  preview/cover.png             # aperçu affiché dans Huawei Santé
```

## Règles

- **Sprites de chiffres** : tous les chiffres d'un même jeu ont **la même largeur et hauteur** (chiffres à chasse fixe) — sinon l'heure « danse ».
- **Aiguilles** : deux options supportées par Theme Studio : (a) image pleine résolution avec pivot au centre (le plus simple et le plus robuste) ; (b) image recadrée + coordonnées de pivot saisies dans l'outil (plus léger, mais source d'erreurs). Par défaut : (b) uniquement si le poids pose problème.
- **Fond** : pas de transparence. Si le fond contient des index d'heure, les intégrer au fond plutôt qu'en calques séparés.
- **Couleurs** : sRGB, pas de profil ICC exotique. Éviter les dégradés très fins (banding après palettisation) → ajouter un léger bruit/dither.
- **AOD** : jeu séparé, fond noir #000000, éléments fins, une seule couleur idéalement.
- **Aperçu** (`cover`) : rendu rond réaliste à 10:08 (convention horlogère), avec données plausibles.
