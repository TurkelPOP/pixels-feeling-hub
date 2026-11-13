# Installation et dépannage

## Installer un cadran perso
Le chemin dépend de la version de Huawei Santé, de la région et du modèle ; il évolue souvent. Ordre à proposer :
1. **Theme Studio → appareil de test** : lier le compte développeur, puis pousser le cadran via le mode test (la méthode la plus fiable pour ses propres créations).
2. **Huawei Santé** : Appareils → montre → Cadrans → *Mes cadrans* (certaines versions/régions permettent l'import d'un `.hwt` local ; d'autres non).
3. Publication sur la boutique Huawei Themes (revue Huawei, plusieurs jours) : seule méthode « durable ».

## Ce qu'il ne faut pas promettre
- Un cadran installé hors boutique peut **disparaître** après : réinitialisation de la montre, réassociation (désappairage/réappairage), mise à jour de Huawei Santé ou du firmware. Toujours conserver le `.hwt` et la fiche pour réinstaller.
- Test simple pour l'utilisateur : réassocier la montre et vérifier si le cadran est toujours dans *Mes cadrans* (parfois masqué, pas supprimé).
- Les cadrans payants ne sont pas transférables entre séries de montres, même compte identique.

## Erreurs fréquentes
| Symptôme | Cause probable | Correctif |
|---|---|---|
| « Mémoire insuffisante » / échec d'installation | `.hwt` trop lourd, trop de cadrans installés | `wf_assets.py optimize`, supprimer des cadrans inutilisés, viser < 1,5 Mo |
| « Cadran pour une version plus récente » | version du format dans `description.xml` supérieure au firmware | mettre à jour la montre ; en dernier recours (non officiel), baisser la version dans `description.xml` puis rezipper sans dossier racine |
| Cadran décalé / coupé | mauvaise résolution choisie | recréer le projet avec la résolution du modèle |
| Aiguilles qui tournent « en orbite » | pivot mal défini | image pleine résolution pivot centré, ou corriger les coordonnées |
| Chiffres qui sautent | sprites de largeurs différentes | uniformiser la largeur des sprites |
| Couleurs en bandes | dégradé palettisé | ajouter dither / bruit, ou garder RGBA sur cette image |

## Rezipper un .hwt modifié
Les fichiers doivent être **à la racine** de l'archive (pas dans un sous-dossier) :
```bash
cd cadran_extrait && zip -r -X ../cadran.hwt . && cd ..
```
