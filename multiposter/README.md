# Multiposter — Pixels Perspective

Une app auto-hébergée pour écrire un post une fois, puis le programmer ou le publier sur
**YouTube, TikTok, Instagram, Facebook, Threads et X**. Elle remplace Fedica.

- Un seul texte, avec une version adaptée par réseau si besoin. Le nombre de caractères
  de chaque réseau est affiché en direct.
- Images, carrousels et vidéos (jusqu'à 1 Go par défaut), envoyés en streaming.
- Programmation à la minute près, avec des raccourcis (+1 h, demain 9 h, demain 18 h).
- Planning en liste ou en **calendrier mensuel**. Un clic sur un jour crée un post à cette date.
- Brouillons, modification, duplication, et « Réessayer les échecs » réseau par réseau.
- Import direct depuis **Canva**, avec des **brouillons préparés automatiquement** quand ta tâche
  planifiée met à jour tes designs.
- **Alertes Discord / Slack / ntfy** en cas d'échec ou quand un brouillon Canva est prêt.
- Chaque réseau est publié séparément : si X échoue, Instagram part quand même.
- Les tokens sont chiffrés (AES-256-GCM) dans une base SQLite locale et renouvelés tout seuls.
- Accès protégé par mot de passe, avec blocage de 15 min après 5 essais ratés.

Stack : Node 22.18+ (TypeScript exécuté directement, SQLite intégré à Node), Hono, interface
en HTML/JS sans build. Deux dépendances seulement.

## Formats publiés

Les carrousels NEWZ et Good News font 7 pages au format portrait 4:5 (1080 × 1350). Exportés en
JPG depuis Canva, voici ce que chaque réseau en fait :

| Réseau | Carrousel NEWZ (7 images JPG) | Texte | Ce qui doit être en ligne |
| --- | --- | --- | --- |
| Instagram | ✅ carrousel de 7 (10 max, JPEG obligatoire) | 2 200 caractères, 30 hashtags max | les images (Instagram les télécharge) |
| Facebook | ✅ post avec 7 photos | sans limite pratique | rien : l'app envoie les fichiers directement |
| Threads | ✅ carrousel de 7 (20 max) | **500 caractères** : la description de la tâche est prévue pour | les images (Threads les télécharge) |
| X | ❌ 4 images maximum | 280 caractères | — |
| TikTok | ❌ vidéo uniquement dans l'app | — | — |
| YouTube | ❌ vidéo uniquement | — | — |

### Options par réseau dans l'éditeur

Dès que tu coches un compte, une carte d'options apparaît sous les médias. Elle s'adapte au contenu
(import Canva ou glisser-déposer) :

- **Statut** : « Prêt », ou ce qui bloque et comment le régler.
- **Format** proposé selon les médias : post, carrousel, Reel, vidéo… Pour Instagram, tu peux
  choisir **Story** à la place, ou **« Publier aussi la 1re slide en story »**.
- **Médias envoyés** : clique sur une miniature pour l'inclure ou l'exclure sur ce réseau. La
  sélection automatique suit ce que le réseau accepte : les 4 premières images pour X, la vidéo pour
  YouTube et TikTok. « Revenir à la sélection automatique » annule tes choix.
- **YouTube** : titre et visibilité (publique, non répertoriée, privée).
- **TikTok** : qui peut voir la vidéo, et si les commentaires, duos et collages sont autorisés.
- **Texte différent pour ce réseau**, si besoin.

Les limites sont vérifiées avant l'envoi : un post qui ne respecte pas les règles d'un réseau est
bloqué dans l'éditeur, avec le message correspondant.

### App sur ton PC : n'ouvrir que /oauth et /media (Tailscale Funnel, gratuit)

Facebook, Instagram, Threads, YouTube, TikTok et X renvoient la connexion vers une adresse HTTPS,
et Instagram et Threads téléchargent eux-mêmes les images. On ouvre donc **uniquement** ces deux
chemins, et l'interface reste sur `http://127.0.0.1:3210`.

**Automatique** : si Tailscale est installé et connecté, l'app ouvre elle-même `/oauth` et
`/media` au démarrage, et utilise ton adresse `ts.net` sans réglage dans `.env`. La toute première
fois, l'onglet **Comptes** affiche un lien **Activer Funnel** : ouvre-le, accepte, puis clique sur
**Réessayer**. Pour désactiver ce comportement : `TAILSCALE=off` dans `.env`.

**À la main**, si besoin :

1. Installe Tailscale (<https://tailscale.com/download/windows>) et connecte-toi (offre gratuite, usage non commercial).
2. Dans PowerShell :
   ```
   tailscale funnel --bg --set-path /oauth http://127.0.0.1:3210/oauth
   tailscale funnel --bg --set-path /media http://127.0.0.1:3210/media
   tailscale funnel status
   ```
   La première fois, Tailscale affiche un lien pour activer Funnel : ouvre-le, accepte, puis relance la commande.
   `tailscale funnel status` affiche ton adresse, du type `https://ton-pc.tailXXXX.ts.net`.
3. Dans `.env` : `PUBLIC_URL=https://ton-pc.tailXXXX.ts.net` (sans `/` à la fin), puis redémarre l'app.
   L'interface reste sur `http://127.0.0.1:3210` (`APP_URL`), et Canva continue de revenir en local.
4. Dans **Comptes → Accès pour Facebook, Instagram et Threads → Vérifier**, les deux lignes doivent être vertes.

Pour tout refermer : `tailscale funnel reset`.

## Ce que ça coûte

L'app n'utilise aucun prestataire : elle parle directement aux API officielles de chaque réseau.

| Réseau | Coût de l'API | À savoir |
| --- | --- | --- |
| Facebook, Instagram, Threads | gratuit | L'app Meta reste en mode « Développement » pour ton usage perso, sans revue. |
| YouTube | gratuit | Quota d'environ 6 vidéos par jour. Vidéos en privé tant que l'audit Google (gratuit) n'est pas validé. |
| TikTok | gratuit | Vidéos en privé tant que l'audit TikTok (gratuit) n'est pas validé. |
| Canva | gratuit | Intégration perso, sans validation. |
| X | **payant à l'usage** | X n'a plus d'offre gratuite. Il faut acheter des crédits : environ 1,5 centime par post, et nettement plus si le post contient un lien. Vérifie les tarifs sur le portail développeur. |

Il te faut aussi un endroit où l'app tourne en continu : ton propre ordinateur ou NAS (gratuit,
avec un tunnel Cloudflare gratuit pour le HTTPS), ou un petit VPS (quelques euros par mois).

## Importer depuis Canva

Le bouton **Importer depuis Canva** dans l'éditeur affiche tes designs, du plus récemment
modifié au plus ancien. Ceux que ta tâche planifiée vient de mettre à jour (NEWZ, Good News…)
sont donc en haut, avec un badge « Modifié récemment » s'ils ont changé dans les dernières 24 h.
Un clic exporte toutes les pages du design, dans l'ordre, et les ajoute aux médias du post. Choisis :

- **JPG** pour les images et les carrousels (le format qu'Instagram accepte en direct) ;
- **PNG** si tu veux une qualité sans perte ;
- **MP4** pour un design vidéo (vertical 1080p, ou horizontal si le design est en paysage).

La recherche filtre par titre, et « Ouvrir ↗ » ouvre le design dans Canva pour une retouche.

### Brouillons automatiques

Dans **Comptes → Canva**, crée une règle, par exemple : « titre commençant par **NEWZ** → Instagram,
Facebook et Threads, en JPG ». « Commence par » prend NEWZ 1 à 4 et ignore les copies
(« Copie de Good News » ne correspond pas à la règle « Good News »).

Toutes les 10 minutes, l'app regarde tes designs Canva modifiés récemment. Quand un design
correspond à une règle et n'a plus bougé depuis 10 minutes (ta tâche planifiée a fini), l'app
exporte ses pages et crée un **brouillon** avec les comptes de la règle. Tu reçois une alerte si
elle est configurée. Tu n'as plus qu'à relire, ajuster le texte et programmer.

L'app crée **un brouillon par design et par jour**, ce qui convient aux NEWZ réécrits chaque
matin par la tâche planifiée : le brouillon NEWZ 1 du lundi garde les images du lundi, même quand
le design est réécrit le mardi avec un autre sujet. Si le design est modifié de nouveau le même
jour (tâche relancée, retouche), les pages du brouillon du jour sont remplacées. Le brouillon
garde alors son texte, ses comptes et son heure de programmation. Dans le texte de départ,
`{titre}` est remplacé par le titre du design et `{date}` par le jour.

L'app doit tourner au moins une fois entre la fin de la tâche (vers 9 h 15) et la tâche du
lendemain : Canva ne garde que la dernière version d'un design, donc une version écrasée avant
d'avoir été récupérée ne peut plus être exportée.
« Vérifier maintenant » lance la vérification sans attendre.

Mise en place :

1. Sur <https://www.canva.com/developers/integrations>, crée une intégration Connect API.
   Pour ton usage perso, elle n'a pas besoin d'être validée par Canva.
2. Coche les scopes `design:meta:read`, `design:content:read` et `profile:read`.
3. Ajoute l'URL de retour `https://<PUBLIC_URL>/oauth/canva/callback`. En local, Canva refuse
   `localhost` : utilise `http://127.0.0.1:3210/oauth/canva/callback` et mets
   `PUBLIC_URL=http://127.0.0.1:3210`.
4. Mets l'ID client et le secret dans `.env` (`CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`), redémarre,
   puis va dans **Comptes → Connecter Canva**.

## Sur Windows : sans ligne de commande

Après avoir installé Node.js (version LTS sur <https://nodejs.org>), tout se fait en double-cliquant
sur ces fichiers du dossier `multiposter` :

| Fichier | Ce qu'il fait |
| --- | --- |
| **Demarrer Multiposter** | Au premier lancement, installe l'app et te demande un mot de passe. Ensuite, lance l'app et l'ouvre dans le navigateur. Si l'app tourne déjà, ouvre simplement le navigateur. |
| **Arreter Multiposter** | Arrête l'app, y compris quand elle tourne en arrière-plan. |
| **Mettre a jour Multiposter** | Télécharge la dernière version depuis GitHub et remplace les fichiers de l'app. `.env`, `data` et `node_modules` ne sont jamais touchés. Propose ensuite de relancer l'app. |

**Démarrage automatique avec Windows** : désactivé par défaut. L'interrupteur « Lancer
Multiposter au démarrage de Windows », en haut de l'onglet **Comptes**, l'active ou le désactive
en un clic. Une fois activé, l'app démarre en arrière-plan, sans fenêtre, à chaque ouverture de
session, et son journal est dans `data\multiposter.log`. Désactiver ne coupe pas l'app en cours :
utilise « Arreter Multiposter » pour ça.

Pour que les posts partent à l'heure, le PC doit être allumé et ne pas se mettre en veille
(Paramètres → Système → Alimentation → Mise en veille : « Jamais » sur secteur).

## Démarrage rapide

```bash
cd multiposter
cp .env.example .env      # puis remplis PUBLIC_URL, ADMIN_PASSWORD, APP_SECRET
npm install
npm start                 # http://localhost:3210
```

Ou avec Docker :

```bash
docker compose up -d --build
```

### L'app doit être joignable en HTTPS

Deux raisons à ça :

1. **Les connexions OAuth** reviennent sur `PUBLIC_URL/oauth/<réseau>/callback`.
2. **Instagram, Facebook et Threads téléchargent eux-mêmes tes médias** depuis
   `PUBLIC_URL/media/...`. Si ton serveur n'est pas joignable depuis Internet, ces réseaux ne peuvent pas récupérer les fichiers.
   Ces URL sont aléatoires (144 bits), donc impossibles à deviner.

Les solutions simples :

- **Un petit VPS** (Hetzner, OVH, Scaleway…), avec Caddy en reverse proxy pour le HTTPS automatique :
  ```
  post.mondomaine.fr {
      reverse_proxy 127.0.0.1:3210
  }
  ```
- **Chez toi** (NAS, Raspberry Pi), avec un tunnel Cloudflare (`cloudflared tunnel`) qui pointe
  vers `http://localhost:3210`.

L'app doit tourner en continu : c'est elle qui envoie les posts à l'heure prévue. Elle vérifie
les posts à publier toutes les 20 secondes.

## Brancher les réseaux

Pour chaque réseau, tu crées une « app développeur » chez lui. Tu reportes ensuite ses clés dans
`.env`, puis tu redémarres l'app et tu cliques sur **Comptes → Connecter**. Tu n'as besoin que des
réseaux que tu utilises.

L'URL de retour à déclarer est toujours de la forme `https://<PUBLIC_URL>/oauth/<id>/callback` :

| Réseau | id du callback | Variables |
| --- | --- | --- |
| Facebook + Instagram | `meta` | `META_APP_ID`, `META_APP_SECRET` |
| Threads | `threads` | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| X | `x` | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| YouTube | `google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| TikTok | `tiktok` | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |

### Facebook + Instagram (Meta)

1. Sur <https://developers.facebook.com/apps>, crée une app de type **Business**.
2. Ajoute **Facebook Login for Business** et déclare l'URL de retour `…/oauth/meta/callback`.
3. Il te faut les permissions `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `business_management`, `instagram_basic` et `instagram_content_publish`. Tant que l'app est
   en mode « Développement », elles marchent pour les comptes admin de l'app, donc pour toi.
   Tu n'as pas besoin de passer la revue de Meta pour ton usage perso.
4. Ton compte Instagram doit être **Professionnel (Créateur ou Entreprise)** et **relié à ta
   Page Facebook**.
5. Un seul clic sur « Connecter » ajoute toutes tes Pages et les comptes Instagram qui y sont reliés.

Limites : Instagram demande au moins un média et accepte 10 médias max en carrousel, avec des
images en **JPEG** uniquement (exporte en JPG depuis Canva). Une vidéo seule part en Reel.

### Threads

Dans la même app Meta (ou une autre), ajoute le cas d'usage **Threads API**. Ses identifiants
sont différents de ceux de l'app Meta : regarde dans *Cas d'usage → Threads API → Paramètres*.
Déclare l'URL de retour `…/oauth/threads/callback` et ajoute ton compte Threads comme testeur.
Le token dure 60 jours et l'app le renouvelle toute seule.

### X

1. Sur <https://developer.x.com>, crée un projet et une app, puis active **OAuth 2.0**
   (type *Web App, Automated App or Bot*). Coche *Read and write*.
2. Déclare l'URL de retour `…/oauth/x/callback`.
3. L'API X est payante à l'usage : il faut acheter des crédits sur le portail développeur
   avant de pouvoir publier (environ 1,5 centime par post, plus cher avec un lien).
4. Si tu as X Premium, mets `X_MAX_CHARS=25000`.

### YouTube

1. Sur <https://console.cloud.google.com>, crée un projet et active **YouTube Data API v3**.
2. Configure l'écran de consentement OAuth et ajoute-toi comme utilisateur test.
3. Crée un identifiant **OAuth client ID → Application Web** avec l'URL de retour
   `…/oauth/google/callback`.
4. ⚠️ Tant que Google n'a pas validé l'app (audit de l'API YouTube), **les vidéos sont mises en
   ligne en privé**. Il faut demander l'audit pour publier en public. Le quota par défaut permet
   environ 6 uploads par jour.

Le titre vient du champ « Titre YouTube », ou à défaut de la première ligne du texte.
La catégorie est « Jeux vidéo ». YouTube classe tout seul les vidéos verticales courtes en Shorts.

### TikTok

1. Sur <https://developers.tiktok.com>, crée une app et ajoute **Login Kit** et
   **Content Posting API** (en activant *Direct Post*).
2. Ajoute les scopes `user.info.basic` et `video.publish` et l'URL de retour `…/oauth/tiktok/callback`.
3. ⚠️ Tant que TikTok n'a pas audité l'app, **les vidéos sont publiées en privé (« Moi uniquement »)**.
   Il faut demander l'audit pour publier en public.

TikTok n'accepte ici que les vidéos, une par post.

## Règles par réseau (vérifiées avant d'envoyer)

| Réseau | Texte max | Médias acceptés |
| --- | --- | --- |
| X | 280 (ou `X_MAX_CHARS`) | 4 images ou 1 vidéo/GIF, ou texte seul |
| Threads | 500 | texte seul, ou jusqu'à 20 images/vidéos |
| Instagram | 2 200 | 1 à 10 images JPEG/vidéos (obligatoire) |
| Facebook | 63 206 | texte seul, plusieurs photos, ou 1 vidéo |
| YouTube | 5 000 (description) | exactement 1 vidéo |
| TikTok | 2 200 | exactement 1 vidéo |

L'éditeur affiche les erreurs en direct dès que tu sélectionnes un compte.

## En ligne sur alwaysdata (mode serveur)

Quand `APP_URL` est une adresse HTTPS, l'app passe en **mode serveur**, avec une sécurité renforcée
et obligatoire :

- **Pas de mot de passe en clair** : seule son empreinte (`ADMIN_PASSWORD_HASH`) est acceptée.
  Calcule-la sur ton PC avec `node scripts/hash-password.ts` (12 caractères minimum). L'app refuse
  de démarrer si `ADMIN_PASSWORD` est présent.
- **Double authentification obligatoire.** À la première connexion, l'app impose l'activation : QR
  code à scanner avec Google Authenticator, puis **10 codes de secours** affichés une seule fois.
  Ensuite, chaque connexion demande le mot de passe et le code du téléphone. Un code déjà utilisé
  est refusé (anti-rejeu).
- **Cookie `__Host-`, Secure, HttpOnly, sessions de 7 jours**, et en-tête HSTS.
- **Alerte (webhook) à chaque connexion**, à chaque blocage et à l'utilisation d'un code de secours.

Variables d'environnement à définir dans le site Node.js d'alwaysdata :

| Variable | Valeur |
| --- | --- |
| `APP_URL` et `PUBLIC_URL` | `https://ton-compte.alwaysdata.net` |
| `ADMIN_NAME` | ton identifiant de propriétaire (par défaut `admin` ; mieux vaut en choisir un autre) |
| `ADMIN_PASSWORD_HASH` | résultat de `node scripts/hash-password.ts` |
| `APP_SECRET` | 64 caractères aléatoires (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `HOST` | `::` (adresse d'écoute recommandée par alwaysdata ; le port arrive par `PORT`) |
| `TRUST_PROXY` | `1` (pour voir la vraie adresse IP des visiteurs derrière le proxy d'alwaysdata) |
| `TAILSCALE` | `off` |
| `ALERT_WEBHOOK_URL` | ton webhook Discord (fortement recommandé) |
| `MEDIA_RETENTION_DAYS` | par exemple `30`, selon l'espace disque de ton offre |

**Réveil automatique** : alwaysdata peut mettre en veille un site sans visites. Ajoute
`CRON_SECRET` (64 caractères aléatoires) aux variables, puis une **tâche planifiée** alwaysdata
toutes les 5 minutes, de type « Accès à une URL » :
`https://ton-compte.alwaysdata.net/cron/tick?token=<CRON_SECRET>`. Les posts programmés partent
alors à l'heure, et les brouillons Canva sont créés, même sans personne sur le site.

Commande de démarrage : `node --disable-warning=ExperimentalWarning src/server.ts`, dans le
dossier `multiposter`, avec Node.js 22.18 ou plus récent.

**À plusieurs** : chaque personne a son propre accès. Dans **Comptes → Personnes ayant accès**, le
propriétaire ou un administrateur crée un **lien d'invitation** (à usage unique, valable 48 h),
en cochant « Administrateur » pour donner les mêmes droits (inviter, retirer, réinitialiser une 2FA). La personne y choisit son
identifiant et son mot de passe, puis active sa propre double authentification sur son téléphone.
Le journal indique qui a fait quoi. Le propriétaire peut retirer un accès (ses sessions sont
fermées immédiatement) ou réinitialiser la double authentification d'un membre.

**Téléphone perdu et plus de codes de secours ?** Ajoute `TWOFA_RESET=1` aux variables,
redémarre, reconnecte-toi pour réactiver la double authentification, puis retire la variable.
Seul quelqu'un qui a accès à ton compte alwaysdata peut faire ça.

**Ce qui protège le reste de la chaîne** (à activer de ton côté) : double authentification sur
ton compte alwaysdata, sur ton compte GitHub (le code installé vient de là) et sur ton compte
Meta.

## Sécurité

- **Accessible uniquement depuis ton PC.** L'app écoute sur `127.0.0.1` : les autres appareils du
  Wi-Fi ne la voient pas. `HOST=0.0.0.0` est réservé à Docker ou à un serveur.
- **Protection contre les sites malveillants.** Une page web ouverte dans ton navigateur ne peut ni
  appeler l'app (adresses autorisées vérifiées, protection contre le « DNS rebinding ») ni
  déclencher une action à ta place (protection CSRF sur l'API).
- **Politique de sécurité du contenu (CSP)** stricte : aucun script extérieur ne peut s'exécuter dans
  l'app, et l'app ne peut pas être affichée dans une autre page.
- **Mot de passe** : comparaison en temps constant, et blocage de 15 min après 5 essais ratés.
- **Sessions de 30 jours, révocables** : « Déconnecter tous les appareils » (onglet Comptes) les
  ferme toutes. Changer `ADMIN_PASSWORD` dans `.env` les ferme aussi.
- **Tokens des réseaux chiffrés** (AES-256-GCM) dans la base. La clé est dérivée de `APP_SECRET` :
  le fichier `.env` est donc le fichier sensible. Ne le partage pas et ne le mets pas sur un
  cloud public.
- **Images privées** : un fichier de `/media` n'est lisible que connecté, ou via un **lien signé
  valable 24 h** créé au moment de publier, pour Instagram et Threads. Un brouillon n'est donc
  jamais accessible publiquement, même avec son adresse.
- **Vérification du contenu des fichiers envoyés** : un fichier dont le contenu ne correspond pas
  au format annoncé (par exemple un faux PNG) est refusé.
- **Double authentification** (obligatoire en ligne, activable sur ton PC depuis l'onglet
  Comptes), avec codes de secours à usage unique.
- **Journal de sécurité** dans l'onglet Comptes : connexions, échecs et blocages, avec la date,
  l'adresse IP et le navigateur.
- **Contre les attaques par essais répétés** : blocage de l'adresse IP pendant 15 min après 5
  échecs, puis ralentissement de tous les essais au-delà de 20 échecs par heure, sans bloquer le
  vrai propriétaire.

## Fiabilité

- Si l'app redémarre pendant une publication, le post n'est **pas** relancé tout seul, pour
  éviter de le publier deux fois. Il passe en « Échec » avec un message, et tu choisis de
  le réessayer ou non.
- Un post programmé pendant que l'app était éteinte part dès qu'elle redémarre.
- Sauvegarde : il suffit de copier le dossier `data/` (base SQLite et médias), en gardant le même
  `APP_SECRET`, sinon les tokens ne peuvent plus être déchiffrés.
- Nettoyage automatique, une fois par jour :
  - les fichiers envoyés puis jamais utilisés sont supprimés au bout de 2 jours ;
  - les médias des posts publiés sont supprimés après `MEDIA_RETENTION_DAYS` jours (90 par défaut) ;
  - les brouillons et les posts programmés gardent toujours leurs médias.
- Alertes : renseigne `ALERT_WEBHOOK_URL` avec un webhook Discord (gratuit) pour être prévenu
  sur ton téléphone si une publication échoue.

## Développement

```bash
npm run dev        # redémarre à chaque modification
npm run typecheck
```

Organisation du code :

- `src/server.ts` : routes HTTP, authentification, API JSON.
- `src/scheduler.ts` : boucle de publication et statuts.
- `src/providers/*.ts` : un fichier par réseau (OAuth et publication).
- `src/canva.ts` : connexion à Canva, liste des designs, export et brouillons automatiques.
- `src/alerts.ts` : alertes par webhook. `src/cleanup.ts` : nettoyage des médias.
- `public/` : l'interface (HTML, CSS, JS).
