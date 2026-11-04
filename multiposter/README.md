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

Dans **Comptes → Canva**, crée une règle, par exemple : « titre contenant **NEWZ** → Instagram et
Facebook, en JPG, avec le texte `📰 {titre} : les actus de la semaine` ».

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
| **Lancement automatique - activer** | Démarre l'app en arrière-plan, sans fenêtre, à chaque ouverture de session Windows. Le journal est dans `data\multiposter.log`. |
| **Lancement automatique - desactiver** | Retire ce démarrage automatique. |

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
