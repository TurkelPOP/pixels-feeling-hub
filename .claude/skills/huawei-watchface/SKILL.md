---
name: huawei-watchface
description: Conçoit et prépare des cadrans de montre Huawei Watch GT (GT, GT 2/3/4/5/6, Pro, Runner) au format .hwt via Huawei Theme Studio — maquette, découpe des assets PNG à la bonne résolution, configuration des composants (heure, date, pas, BPM, batterie), AOD, packaging, installation via Huawei Santé et dépannage. À utiliser dès que l'utilisateur veut créer, modifier, optimiser, installer ou dépanner un cadran (watch face) pour une montre Huawei.
---

# Cadrans Huawei Watch GT

Objectif : livrer un cadran **installable du premier coup** et léger, pas juste une jolie image.

## Ce qu'il faut savoir avant de commencer (à dire à l'utilisateur si besoin)

- Les GT tournent sous **LiteOS / HarmonyOS lite** : pas de code libre (pas de JS/Java arbitraire). Un cadran = **images PNG + description XML** assemblées par **Huawei Theme Studio** (outil Windows/macOS gratuit, compte développeur Huawei requis) → fichier `.hwt` (un ZIP renommé).
- Claude ne peut pas lancer Theme Studio. Le rôle de Claude : concevoir, **générer les assets aux bonnes dimensions**, rédiger la config pas-à-pas pour Theme Studio, inspecter/corriger le `.hwt` exporté, guider l'installation.
- Installation hors boutique : possible pour son usage perso (mode testeur / import dans Huawei Santé selon la version de l'app et la région). **Ne jamais promettre** qu'un cadran chargé ainsi survit à une réinitialisation, une réassociation de la montre ou une mise à jour de Huawei Santé : garder le `.hwt` source pour le réinstaller.

## Workflow

1. **Identifier la montre** (modèle + taille de boîtier) → résolution dans `references/specs.md`. Si incertain, demander ; si l'utilisateur ne sait pas : *Huawei Santé → Appareils → nom de la montre → À propos*.
2. **Brief court** : style (analogique / numérique / hybride), complications voulues (max 4–5, lisibilité au poignet), palette, AOD oui/non. Ne pas multiplier les questions : proposer des défauts.
3. **Maquette** : produire un aperçu PNG/SVG rond à la résolution exacte (masque circulaire) pour validation avant de découper quoi que ce soit.
4. **Assets** : générer les calques séparés selon `references/assets.md` (fond, aiguilles avec pivot centré, chiffres 0-9 en sprites, icônes, AOD). Valider avec :
   ```bash
   python3 .claude/skills/huawei-watchface/scripts/wf_assets.py check <dossier_assets> --res 466
   ```
   puis optimiser :
   ```bash
   python3 .claude/skills/huawei-watchface/scripts/wf_assets.py optimize <dossier_assets>
   ```
5. **Fiche Theme Studio** : écrire la procédure exacte (projet *Smart Watch*, résolution, chaque composant avec sa position x/y, son jeu d'images, son type de données). Modèle dans `references/theme-studio.md`.
6. **Contrôle du .hwt exporté** (si l'utilisateur le fournit) :
   ```bash
   python3 .claude/skills/huawei-watchface/scripts/wf_assets.py inspect cadran.hwt
   ```
   Vérifie structure, `description.xml`, poids total, images hors format.
7. **Installation + dépannage** : `references/install-troubleshoot.md`.

## Règles d'optimisation (non négociables)

- **Dimensions exactes** de la résolution cible ; aucune image plus grande que nécessaire. Les éléments hors du cercle sont inutiles (l'écran est rond).
- **PNG 8 bits palettisé** dès que possible (pngquant), RGBA seulement pour les aiguilles/ombres anti-aliasées. Fond en **JPG/PNG opaque** sans alpha.
- **Poids cible : < 1,5 Mo** pour le `.hwt` (au-delà : échecs d'installation « mémoire insuffisante » fréquents sur GT 2/GT 3). Animations : peu de frames, petites zones.
- **AOD** : fond noir pur, < 15 % de pixels allumés, pas de grands aplats clairs (OLED → autonomie).
- **Lisibilité** : heure ≥ 18 % du diamètre en numérique ; contraste élevé ; complications loin du bord (marge ≥ 8 % du rayon, le verre bombé déforme).
- Polices : convertir le texte en sprites PNG (chiffres 0-9, `:`, `%`, jours) — ne pas compter sur les polices système.
- Garder un dossier source versionné (maquette + calques + fiche) : c'est la seule sauvegarde fiable du cadran.

## Livrables attendus

- `preview.png` (rond, résolution cible) + `preview_aod.png` si AOD.
- `assets/` prêt à importer, nommé selon `references/assets.md`.
- `THEME_STUDIO.md` : la fiche pas-à-pas.
- Rappel d'installation adapté au modèle de l'utilisateur.
