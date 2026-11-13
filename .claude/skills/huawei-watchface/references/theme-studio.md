# Fiche Theme Studio (modèle à remplir)

Theme Studio : https://developer.huawei.com/consumer/en/huawei-theme/ (connexion avec un compte Huawei ID développeur). Codelab officiel : https://developer.huawei.com/consumer/en/codelab/theme-Watchface

Les intitulés de menus changent selon les versions : décrire l'intention, pas seulement le libellé.

## 1. Projet
- New → **Watch face** → WatchType **Smart Watch** → Resolution **<466*466>** → nom `<nom_cadran>`.

## 2. Fond
- Calque Background → importer `bg/background.png`. Position (0, 0).

## 3. Heure
- Analogique : composant *Pointer / Hands* → hour/minute/second → importer l'image → centre de rotation (233, 233) [si option (a) des assets].
- Numérique : composant *Time / Digital* → format HH:MM (12/24 h suivant le réglage du téléphone) → jeu `digits/time_*` → position x,y du coin haut-gauche → séparateur `time_colon.png`.

## 4. Date et jour
- *Date* → jeu `digits/date_*`, format DD ou DD/MM → position.
- *Week* → `week/week_1..7`.

## 5. Complications (données)
Pour chaque : composant de données → type (Steps / Heart rate / Battery / Calories) → jeu de chiffres `small_*` → icône → position → alignement (gauche/centre/droite). Tableau à remplir :

| Donnée | Type | Jeu | x | y | Alignement | Icône |
|---|---|---|---|---|---|---|
| Pas | Steps | small | | | centre | icons/steps.png |
| BPM | Heart rate | small | | | centre | icons/heart.png |
| Batterie | Battery (level) | battery/bat_* | | | — | — |

Zones de tap (raccourcis vers une app) : à ajouter sur chaque complication si proposé.

## 6. AOD
- Onglet AOD / Always-on → fond `aod/aod_background.png` + heure `aod/aod_time_*`.

## 7. Aperçu et métadonnées
- Cover = `preview/cover.png`. Titre, auteur, version, description (FR + EN).

## 8. Export
- Simuler dans l'outil (vérifier 00:00, 12:59, 23:59, 1/1, 31/12, 100 % batterie, 0 pas, 99999 pas).
- Export → `.hwt`. Contrôler avec `wf_assets.py inspect`.
