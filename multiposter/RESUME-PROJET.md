# PTZ Posting : résumé complet du projet

Document de passation pour une repasse **sécurité** et **visuelle**.
État : version **0.3.1** (0.3.0 installée), installée sur `https://ptzcorp.alwaysdata.net`, branche `ccr-174b691b-7a3vf3`.

---

## 1. Le produit

- **But** : application web auto-hébergée de **publication multi-réseaux** (remplace Fedica) pour PTZ Corp / Pixels Perspective.
- **Utilisateurs** : le propriétaire (rôle `owner`) et un admin (Papa Subway, rôle `admin`) ; d'autres membres possibles (rôle `member`), invités par lien.
- **Réseaux** : Facebook (Pages), Instagram (pro/créateur), Threads, YouTube, TikTok. X a été retiré (API payante) ; `src/providers/x.ts` existe encore mais n'est plus branché.
- **Préférences du propriétaire** : interface en français, **très concise** (libellés courts, logos plutôt que noms), bleu **#023197** dominant, thème sombre, utilisation fréquente **sur mobile**.

---

## 2. Technique

| Élément | Choix |
|---|---|
| Serveur | Node 24, TypeScript exécuté directement (`node src/server.ts`, sans build) |
| Framework HTTP | Hono + `@hono/node-server` |
| Base de données | `node:sqlite` (DatabaseSync, WAL), fichier `data/multiposter.db` |
| Front | HTML + JS « vanilla » en module (`public/app.js`, ~3 800 lignes), CSS unique (`public/styles.css`) |
| Graphiques | ECharts 6.0.0 hébergé localement (`public/echarts.js` + `.gz`, licence Apache 2.0), chargé seulement dans l'onglet Stats |
| Dépendances d'exécution | `hono`, `@hono/node-server`, `qrcode-generator` (npm audit : 0 vulnérabilité) |
| Vidéo | ffmpeg / ffprobe du serveur (musique sur les slides) |
| Hébergement | alwaysdata (1 Go disque), derrière un proxy (`TRUST_PROXY=1`) |
| Mise à jour | depuis l'app (Maintenance) : `git fetch` puis `merge --ff-only`, `npm ci --omit=dev --ignore-scripts`, redémarrage |

### Arborescence (dossier `multiposter/`)

```
src/
  server.ts        routes, en-têtes de sécurité, posts, médias, OAuth générique, assets
  auth.ts          connexion, 2FA TOTP, sessions, utilisateurs, invitations, confirmIdentity()
  crypto.ts        seal/unseal (AES-256-GCM), randomId, PKCE
  config.ts        variables d'environnement, umask 077
  db.ts            schéma, migrations légères, comptes, restauration de sauvegarde
  scheduler.ts     publication (programmée / immédiate), progression en %, notifications
  media.ts         upload en streaming, vérification du contenu, quotas, liens signés 24 h
  cleanup.ts       suppression auto (brouillons 7 j, médias publiés 3 j, orphelins 12 h, tmp 1 h)
  stats.ts         stats des posts publiés par l'app, historique, /stats/overview
  accountstats.ts  stats « hors app » (contenus publiés dans les applis) + abonnés quotidiens
  maintenance.ts   sauvegardes, mise à jour, versions/CHANGELOG
  appsettings.ts   clés des apps réseaux saisies dans l'interface (chiffrées)
  mentions.ts      contacts de mention (@[Nom] → bon compte par réseau) + photos
  hashtags.ts      jeux de hashtags, hashtags les plus utilisés
  profiles.ts      profils (groupes de comptes), partage à un autre utilisateur
  push.ts          notifications Web Push (VAPID / aes128gcm, implémentation maison)
  gdrive.ts        import Google Drive (OAuth + lien public)
  canva.ts         import Canva (OAuth, exports)
  music.ts         bibliothèque musicale, slides en vidéos (ffmpeg)
  presets.ts       créneaux et modèles de texte
  recap.ts, alerts.ts, autostart.ts, tailscale.ts, workspace.ts
  providers/       meta.ts (Facebook + Instagram), threads.ts, tiktok.ts, youtube.ts, types.ts, index.ts
public/
  index.html, app.js, styles.css, help.js, help-content.js, login.html, login.js, pages.js, sw.js,
  echarts.js(.gz), icônes PWA, connexion.mp3
CHANGELOG.md       journal des versions (affiché avant d'installer une mise à jour)
A-FAIRE.md         points restants
```

---

## 3. Fonctionnalités

### 3.1 Nouveau post (éditeur)
- **Choix des comptes** : avatars ronds avec pastille du réseau. Allumé avec un contour couleur réseau = coché ; grisé = non coché. Le bouton **+** mène à Comptes. La liste des comptes cochés s'affiche en dessous (logo + nom).
- **Profils** : des puces qui cochent tous les comptes d'un profil.
- **Texte** : un bouton à deux choix, **« Même texte »** ou **« Par réseau »**, visible dès 2 comptes cochés.
  - *Par réseau* : un bloc par compte, avec une **bande à la couleur du réseau** contenant la **photo du compte et sa pastille**. Dans le bloc : le texte prérempli et modifiable, un compteur de caractères et « Copier depuis… ».
  - En *Par réseau*, les **options du réseau sont rangées dans son bloc** (format, médias envoyés, premier commentaire) ; la section « Options par réseau » disparaît.
  - Revenir à « Même texte » demande confirmation ; le texte du premier réseau est gardé.
- **Barre d'outils dans le champ** (style Fedica) : 📷 photo/vidéo, 🖼 galerie, **#** hashtags, **@** mentions, 📊 sondage, 📄 modèles. Un bouton est allumé tant que son panneau est ouvert.
- **Hashtags** :
  - suggestions **calculées à partir du texte** : tes hashtags habituels présents dans le texte, et les noms propres (« Mass Effect » → #MassEffect, « GTA VI » → #GTAVI), avec « Tout ajouter » ;
  - **jeux de hashtags** insérés en un clic ;
  - avertissements par réseau (Instagram 30 max, Threads 1 sujet, YouTube 15).
- **Mentions** : contacts `@[Nom]` remplacés à la publication par le bon @ selon le réseau ; photo du contact, récupérée automatiquement ou choisie.
- **Sondage** : Threads uniquement, 2 à 4 réponses de 25 caractères, post sans média.
- **Médias** : galerie et appareil photo mobile, Canva, Google Drive, recadrage (canvas), couverture vidéo (Instagram `thumb_offset`, TikTok), musique sur les slides (ffmpeg), « Finir dans Instagram » pour ajouter la musique dans l'appli.
- **Options par réseau** :
  - Instagram : format Publication/Story, « + 1re slide en story ».
  - YouTube : titre et visibilité.
  - TikTok : confidentialité et interactions.
  - Premier commentaire ou réponse automatique.
  - Choix des médias envoyés, réseau par réseau.
- **Actions** : Aperçu, Programmer, Publier maintenant, Brouillon, Vider. Validation en direct (erreurs par réseau).

### 3.2 Planning
- Vue liste et calendrier (glisser-déposer pour reprogrammer), filtres À venir / Brouillons / Publiés / Échecs / Tout, recherche.
- Brouillon : bouton **« Publier »** (ouvre l'éditeur), Dupliquer, Supprimer, compte à rebours avant suppression.
- **Aperçu des médias en grand** au clic (plein écran, flèches, glisser sur mobile, Échap).
- **Programmation en lot** active seulement à partir de 2 brouillons, chacun sur un créneau différent.
- **Progression en %** par réseau pendant la publication (barre + étape, rafraîchie toutes les 1,5 s).
- Validation des posts proposés (profil partagé), commentaires internes, relance d'un réseau en échec, « marquer publié à la main ».

### 3.3 Stats (onglet dédié, ECharts)
- **Périodes** : 7 j · 30 j · 90 j · 12 mois · Ce mois · Mois dernier · Perso (du/au). Chaque chiffre est **comparé à la période précédente** de même durée.
- **Filtres** :
  - réseaux (logos à cocher) ;
  - profil ;
  - format : carrousel, vidéo/Reel, photo, texte, story ;
  - case **« Publié hors app »**.
- **Tuiles** : vues, interactions, engagement (interactions ÷ vues, seulement quand le réseau donne les vues), **abonnés** (total + gain sur la période), posts, j'aime, commentaires, partages.
- **Graphiques** :
  - Évolution : aires empilées par réseau, au choix Vues / Interactions / Posts, zoom sur les longues périodes.
  - Par réseau : période contre période précédente.
  - Par format : interactions moyennes.
  - Abonnés : courbe par compte.
  - Meilleurs créneaux : carte de chaleur jour × heure.
- **Classement des posts** : tri par interactions, vues, engagement ou date ; miniature ; liens vers chaque publication ; étiquette « hors app ».
- **Collecte des chiffres** :
  - Posts publiés par l'app : relevés pendant 90 jours (toutes les 3 h pendant 2 jours, puis toutes les 12 h jusqu'à 14 jours, puis tous les 2 jours), avec un historique de chaque relevé (`stats_history`).
  - Contenus « hors app » : relevés toutes les 3 h (`external_posts`), sans doublon avec ceux publiés par l'app.
  - Abonnés : un relevé par jour (`account_daily`).
  - Cas particuliers gérés : stories Instagram (`story:id1,id2`), vidéos Facebook (`video:id`), TikTok pas encore public (`publish:id`, résolu plus tard).

### 3.4 Comptes
- **Cartes de connexion** : gros logos, état (« ✓ Connecté » / « Pas connecté » / « À activer »), photos des comptes connectés, bouton « Connecter » ou « Reconnecter / ajouter », tuto intégré, panneau « Clés de l'app » (propriétaire).
- Canva et Google Drive (« Se connecter avec Google »).
- Utilisateurs : invitations, rôles, réinitialisation de mot de passe ou de 2FA.
- Sécurité : journal des événements, déconnexion de partout.
- Maintenance (propriétaire) : version installée, mises à jour avec nouveautés, sauvegardes (créer, télécharger, restaurer), redémarrage.
- Alertes (webhook Discord / Slack / ntfy), notifications push, appareil.

### 3.5 Divers
- **Aide** intégrée en volet latéral ouvert par les « ? », avec des tutos par réseau.
- **PWA** installable (manifeste, service worker sans cache, page hors ligne).
- Son à la connexion.
- Récapitulatif, profils partagés, posts proposés à validation.

---

## 4. Sécurité : ce qui est en place (repasse étapes 1 à 7 faite)

### Authentification et sessions (`src/auth.ts`)
- En mode serveur (`APP_URL` en https), la **2FA TOTP est obligatoire** ; il y a des codes de secours.
- Mots de passe hachés en **scrypt** ; comparaisons à temps constant ; codes de secours en HMAC avec `APP_SECRET`.
- Cookie de session `__Host-mp_session` : signé, `HttpOnly`, `Secure`, `SameSite=Lax`.
- L'empreinte de session inclut un `session_epoch` par utilisateur. « Déconnexion de partout » l'incrémente.
- **Blocage après 5 échecs** par IP (dernière entrée `X-Forwarded-For` si `TRUST_PROXY=1`), plus un ralentissement global en cas d'attaque massive.
- **Code redemandé (`confirmIdentity`)** pour les actions sensibles. Anti-rejeu TOTP ; 5 échecs entraînent 15 min de blocage et une alerte. Actions concernées :
  - supprimer un utilisateur, réinitialiser un mot de passe ou une 2FA ;
  - mettre à jour l'app, télécharger ou restaurer une sauvegarde ;
  - **modifier les clés d'apps et le webhook**.
- **Droits** : le propriétaire gère tout le monde sauf lui-même ; un admin ne gère que les membres ; seul le propriétaire invite un admin ; un membre ne voit que lui.

### Requêtes et navigateur (`src/server.ts`)
- **Hôtes autorisés** : `APP_URL`, `MEDIA_PUBLIC_URL`, `ALLOWED_HOSTS`. Autre hôte → 421.
- **Anti-CSRF** :
  - en-tête `X-Requested-With: multiposter` exigé sur l'API ;
  - middleware **Origin** : refus si l'origine est un autre site, appliqué avant les routes de connexion.
- **En-têtes** :
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin` ;
  - `Permissions-Policy` : caméra et micro pour le site seulement ; HSTS 1 an.
- **CSP** (pages HTML) :
  ```
  default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self';
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
  ```
- **XSS** :
  - le helper `h()` crée les éléments et ne met que du texte (`textContent`) ;
  - attributs `href` et `src` limités à http(s), chemins internes, `data:image`, `blob:` ;
  - `innerHTML` seulement pour du contenu statique (icônes SVG, aide) ;
  - pages serveur échappées avec `esc()`.

### OAuth
- `state` aléatoire, à usage unique, valable 15 min, lié au compte ; PKCE pour les flux qui le prennent en charge.
- **Retour accepté seulement dans le navigateur connecté de la personne qui l'a lancé** (`oauthCallerOk`, mode serveur) : empêche de récupérer les comptes d'un autre via un lien piégé.
- Drive réutilise l'adresse de retour YouTube : le `state` indique de quel service il s'agit.

### Secrets
- Tokens des réseaux, Canva et Drive, secrets TOTP, clés d'apps, webhook, clé VAPID : **chiffrés AES-256-GCM** en base, avec une clé dérivée d'`APP_SECRET` (`seal/unseal`). Ils ne sont jamais renvoyés au navigateur.
- Erreurs et logs : seulement le nom du site appelé, jamais l'URL complète (qui contient parfois `access_token`).
- `umask 077` : base, médias et sauvegardes lisibles par l'app seule ; `.env` en 600 ; dossier `data` en 700.

### Fichiers et uploads (`src/media.ts`, `music.ts`, `gdrive.ts`, `canva.ts`, `mentions.ts`)
- **Formats autorisés** : JPG, PNG, WebP, GIF, MP4, MOV, WebM, et audio MP3, M4A, AAC, WAV. Le contenu réel est vérifié par sa signature binaire, pas seulement le nom.
- **Stockage** : noms de fichiers aléatoires, routes limitées par expression régulière (pas de sortie du dossier).
- **Quotas** :
  - 300 Mo par fichier, 600 Mo pour tout le site, 400 Mo par personne (musiques comprises) ;
  - musiques : 20 Mo et 20 morceaux maximum ;
  - variables `MAX_UPLOAD_MB`, `STORAGE_TOTAL_MB`, `MEDIA_QUOTA_MB`.
- **Accès aux médias** : seul le propriétaire connecté, ou un réseau via un **lien signé HMAC valable 24 h**. Brouillons jamais publics.
- ffmpeg et ffprobe : `-protocol_whitelist file`.
- **Imports et téléchargements externes** :
  - Drive par lien : téléchargement uniquement depuis Google ;
  - export Canva : https, vrai nom de domaine, sans redirection ;
  - photos des contacts : seulement depuis fbcdn, cdninstagram, ggpht, googleusercontent, ytimg (300 Ko max).
- **Notifications push** : liste blanche des hôtes de destination.

### Mises à jour (`src/maintenance.ts`)
- **Source acceptée** : GitHub en https, ou en SSH avec l'**empreinte de GitHub figée** (`StrictHostKeyChecking=yes`, `BatchMode`, clé via `UPDATE_SSH_KEY`), ou exactement `UPDATE_REMOTE`.
- **Contrôles** :
  - vérification pour une version précise, puis installation de cette même version (`merge-base --is-ancestor`, puis `merge --ff-only`) ;
  - `npm ci --ignore-scripts` ;
  - sauvegarde automatique avant ;
  - code 2FA exigé ;
  - réservé au propriétaire.
- **Sauvegardes** : `VACUUM INTO`, 14 gardées, noms strictement vérifiés, restauration appliquée au démarrage (l'ancienne base est gardée de côté).

### Dépendances
- 3 paquets d'exécution, `npm audit` sans vulnérabilité, aucun script chargé depuis un autre site.

### Hébergement (étape 8, faite par le propriétaire)
- Double authentification alwaysdata et GitHub ; variables d'environnement (`APP_URL`, `TRUST_PROXY=1`, `APP_SECRET` sauvegardé, `ADMIN_PASSWORD_HASH`) ; site de type Node.js avec « Forcer HTTPS » ; sauvegardes ; webhook d'alertes. **Le repo est encore public** : passage en privé en cours (clé de déploiement SSH sur le serveur, puis changement de visibilité).

---

## 5. Points à examiner lors de la repasse

### Sécurité (pistes non traitées ou à confirmer)
1. **CSP** : `img-src https:` reste large (avatars et miniatures viennent des CDN des réseaux, dont les domaines changent) : risque accepté. `'unsafe-inline'` a été retiré des styles en 0.3.1.
2. **Limite de débit** : faite en 0.3.1 (par personne, en mémoire), avec la limite de taille des requêtes à 1 Mo.
3. **Photos des contacts** stockées en `data:` URL dans `mention_contacts.avatar`, renvoyées en entier par `GET /mentions`.
4. **Tokens dans les URL** des appels Graph et Threads (`access_token=` en query, pratique standard de Meta) : vérifier qu'aucun log tiers ne les capte.
5. **Retour OAuth lié à la session** : en local, ou quand `PUBLIC_URL` ≠ `APP_URL`, la protection repose seulement sur le `state`.
6. **Relevé « hors app »** (`accountstats.ts`) : jusqu'à 60 appels « insights » par compte toutes les 3 h. Vérifier les quotas Meta.
7. `src/providers/x.ts` est gardé volontairement (anciens comptes X éventuels), mais on ne peut plus en connecter.
8. Revoir `app.js` (monolithe) pour toute insertion `innerHTML` future.

### Visuel
1. **Dette CSS** :
   - beaucoup de règles ajoutées en fin de `styles.css` avec des couleurs en dur (#023197, #3b6cff, #0b1230…) au lieu des variables (`--turquin`, `--bg`, `--card`…) ;
   - quelques `!important` ;
   - aucun thème clair.
2. **Cohérence** :
   - cohabitation de plusieurs styles de boutons et de puces (`chip`, `seg`, `cbtn`, `btn ghost small`) ;
   - plusieurs systèmes de logos (`badge`, `netLogo`, `accAvatar`, `netIcon`) ;
   - cartes Canva et Drive pas encore alignées sur le nouveau style des cartes réseaux.
3. **Mobile** :
   - navigation du haut qui déborde sur petit écran (« Comptes » coupé à 390 px) ;
   - classement Stats serré.
4. **Couleur Threads** (gris clair) : peu lisible en bande ou en texte ; un traitement spécial a été ajouté.
5. **Accessibilité** : contrastes des textes « muted », focus visible, libellés ARIA des boutons-icônes (en partie faits).
6. **Densité de l'éditeur** : beaucoup d'informations ; le propriétaire veut **moins de texte, des libellés courts, des logos**.

---

## 6. Ce qui n'a pas été testé en conditions réelles
Testé en local avec des données ou réponses factices, à valider en vrai :
- sondage Threads (`poll_attachment`) ;
- stats des stories Instagram et des vidéos Facebook (`video_insights`) ;
- résolution TikTok `publish:` ;
- relevé « hors app » de chaque réseau, abonnés (TikTok : reconnexion nécessaire pour `user.info.stats`) ;
- photo automatique des contacts (Instagram `business_discovery`, YouTube `forHandle`) ;
- mise à jour par SSH depuis l'app avec un repo privé.

---

## 7. Variables d'environnement utiles
`APP_URL`, `PUBLIC_URL`, `MEDIA_PUBLIC_URL`, `ALLOWED_HOSTS`, `APP_SECRET` (≥ 32 caractères), `ADMIN_NAME`, `ADMIN_PASSWORD_HASH`, `TRUST_PROXY`, `DATA_DIR`, `PORT`, `TZ_DISPLAY`,
`META_APP_ID/SECRET`, `THREADS_APP_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`, `CANVA_CLIENT_ID/SECRET` (ou saisis dans l'app, chiffrés),
`ALERT_WEBHOOK_URL`, `MAX_UPLOAD_MB`, `STORAGE_TOTAL_MB`, `MEDIA_QUOTA_MB`, `DRAFT_RETENTION_DAYS`, `BACKUP_KEEP`, `UPDATE_REMOTE`, `UPDATE_SSH_KEY`, `FFMPEG_PATH`, `FFPROBE_PATH`, `GOOGLE_SITE_VERIFICATION`, `TIKTOK_PRIVACY`, `YOUTUBE_PRIVACY`, `YOUTUBE_CATEGORY_ID`.

---

## 8. Versions
Numérotation MAJEUR.MINEUR.CORRECTIF, en **0.x** tant que l'app est en développement. La **1.0.0** viendra quand les apps des réseaux seront validées et que tout aura été testé en vrai. Détail dans `CHANGELOG.md`.

| Version | Contenu |
|---|---|
| 0.0.1 | Première version installée |
| 0.1.0 | Nouvel éditeur (avatars, outils, Par réseau), hashtags suggérés, contacts avec photo, sondage Threads, Planning amélioré, progression %, durcissement sécurité, versions/CHANGELOG |
| 0.2.0 | Onglet Stats (ECharts) : périodes, comparaison, filtres, graphiques, classement |
| 0.2.1 | Stats des stories Instagram |
| 0.2.2 | Stats des vidéos Facebook et des vidéos TikTok pas encore publiques ; mesures Instagram une à une |
| 0.3.0 | Stats « hors app » (tout le compte) et abonnés jour par jour |

---

## 9. Reste à faire (voir `A-FAIRE.md`)
- **Espace disque** : si les 1 Go ne suffisent plus, stockage des médias sur Cloudflare R2 (10 Go gratuits), ou Backblaze B2 en solution de repli.
- **Vers la 1.0.0** :
  - validation des apps par Meta (Facebook/Instagram et Threads), TikTok et Google, pour sortir du mode testeur ;
  - tests réels des points de la section 6.
