# Journal des versions

Numéro MAJEUR.MINEUR.CORRECTIF :
- MAJEUR : 0 tant que l'app est en développement ; 1.0.0 = première version stable (apps des réseaux validées, tout testé en vrai). Ensuite, un gros changement (à lire avant d'installer, peut demander une action de ta part) ;
- MINEUR : nouvelles fonctions ;
- CORRECTIF : corrections, sans nouveauté.

Une section par version, la plus récente en haut. L'app affiche ces lignes avant d'installer une mise à jour.

## 0.3.1 — 10/11/2026
- Sécurité : taille des requêtes limitée à 1 Mo (hors envoi de fichiers), y compris avant connexion.
- Sécurité : limite de débit par personne (600 requêtes/min, 20/min pour les opérations coûteuses, 120 envois de fichiers/min).
- Sécurité : règle du navigateur (CSP) durcie, plus aucun style écrit dans le HTML ; infobulles des graphiques dessinées dans le graphique.
- Sécurité : photos des contacts téléchargées sans redirection et avec une taille plafonnée ; pages de stats Instagram suivies seulement chez Meta.

## 0.3.0 — 10/11/2026
- Stats de tout le compte : posts, carrousels, Reels, stories et vidéos publiés directement dans les applis (Instagram, Facebook, Threads, YouTube, TikTok), marqués « hors app ».
- Abonnés relevés chaque jour : tuile (total + gain sur la période) et courbe par compte.
- Case « Publié hors app » pour les inclure ou non.
- TikTok : reconnecte le compte (nouvelle autorisation pour les abonnés).

## 0.2.2 — 10/11/2026
- Stats des vidéos Facebook (réactions, commentaires, vues) : elles n'étaient pas relevées.
- Stats TikTok des vidéos pas encore publiques à la publication : retrouvées dès que TikTok les rend disponibles.
- Instagram : vues et partages relevés séparément (un format qui refuse l'un ne bloque plus l'autre).

## 0.2.1 — 10/11/2026
- Stats des stories Instagram : vues, réponses, partages et réactions (relevés dans les 24 h, Instagram ne les garde pas plus longtemps).
- Filtre « Stories » : message explicatif quand il n'y a rien.

## 0.2.0 — 10/11/2026
- Nouvel onglet Stats : périodes (7 j, 30 j, 90 j, 12 mois, ce mois, mois dernier, perso), comparées à la période précédente.
- Filtres par réseau, profil et format.
- Chiffres clés (vues, interactions, engagement, posts, j'aime, commentaires, partages) avec leur évolution.
- Graphiques : évolution par réseau, comparaison des réseaux, formats qui marchent le mieux, meilleurs créneaux (jour × heure).
- Classement des posts (vues, interactions, engagement), avec liens vers chaque publication.
- Chiffres relevés pendant 90 jours (au lieu de 14) et historique conservé.

## 0.1.0 — 10/11/2026
- Nouveau post : comptes en avatars, outils dans le champ (photo, galerie, #, @, sondage, modèles).
- « Même texte » ou « Par réseau » : un texte par réseau, avec ses options (format, médias, 1er commentaire) dans son bloc.
- Hashtags suggérés d'après le texte, jeux de hashtags en un clic.
- Contacts de mention avec photo (récupérée sur Instagram/YouTube ou choisie).
- Sondage Threads.
- Planning : aperçu des médias en grand, bouton « Publier », progression en % pendant la publication.
- Comptes : cartes simplifiées (logos, état, photos des comptes connectés).
- Sécurité : code exigé pour les clés d'apps, connexions OAuth liées à ta session, fichiers privés, limites d'espace disque (1 Go).
- Mises à jour : repo privé possible (SSH), numéro de version et nouveautés affichés.

## 0.0.1
- Première version : publication multi-réseaux, programmation, Planning, comptes, sauvegardes, mises à jour depuis l'app.
