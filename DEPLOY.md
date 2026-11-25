# Déployer Pixels Perspective sur alwaysdata

Le site tourne comme une application **Node.js**. On le construit sur votre ordinateur, puis on envoie le résultat sur alwaysdata : rien à installer ni à compiler là-bas.

Les libellés exacts de l'administration alwaysdata peuvent différer légèrement de ceux ci-dessous ; l'aide officielle est sur <https://help.alwaysdata.com>.

## 1. Construire le site

Dans le dossier du projet, avec `VITE_SITE_URL` défini dans `.env` (voir `.env.example`) :

```
bun run build:node
```

Cela crée le dossier `.output/`. Le fichier `start.mjs`, à la racine du projet, est le point de démarrage.

> `VITE_SITE_URL` est intégrée au code au moment du build. Si vous la changez (nouveau domaine), reconstruisez le site.

## 2. Préparer alwaysdata

1. **Accès SSH/SFTP** : dans l'administration, activez l'accès distant de votre compte (SSH) pour pouvoir envoyer des fichiers.
2. **Version de Node** : *Environnement > Node.js*, choisissez **Node 24** (22.13 au minimum). Le stockage de la synchronisation utilise le module `node:sqlite`, absent des versions plus anciennes.
3. **Domaine** : ajoutez votre domaine dans *Domaines* (et ses enregistrements DNS chez votre registrar). alwaysdata délivre le certificat HTTPS (Let's Encrypt) pour un domaine configuré. Sans domaine, vous pouvez commencer avec l'adresse `votre-compte.alwaysdata.net`.

## 3. Envoyer les fichiers

Avec WinSCP, FileZilla ou `scp`, envoyez dans un dossier de votre compte, par exemple `pixels-perspective/` :

- le dossier `.output/` ;
- le fichier `start.mjs`.

Exemple en ligne de commande (remplacez `compte` par votre identifiant alwaysdata) :

```
scp -r .output start.mjs compte@ssh-compte.alwaysdata.net:pixels-perspective/
```

**Sans mot de passe, avec une clé dédiée** (la clé privée ne quitte jamais votre ordinateur) :

1. `ssh-keygen -t ed25519 -f ~/.ssh/alwaysdata_pp -N ""`
2. Collez le contenu de `~/.ssh/alwaysdata_pp.pub` dans *Accès distant > SSH/SFTP > Clés SSH* de l'administration, et vérifiez que l'utilisateur SSH est activé.
3. Ajoutez `-i ~/.ssh/alwaysdata_pp` aux commandes `ssh` et `scp`.

Pour révoquer l'accès, supprimez la clé publique dans l'administration.

## 4. Créer le site dans l'administration

*Web > Sites > Ajouter un site* :

| Champ | Valeur |
|---|---|
| Type | Node.js |
| Adresses | votre domaine (ou `compte.alwaysdata.net`) |
| Commande | `node start.mjs` |
| Répertoire de travail | `pixels-perspective` (le dossier de l'étape 3) |
| Variables d'environnement | voir l'étape 5 |

`start.mjs` reprend lui-même l'adresse et le port imposés par alwaysdata : la commande n'a pas besoin de les mentionner.

## 5. Variables d'environnement

À renseigner dans la configuration du site (jamais dans le code ni dans Git). Le modèle est dans `.env.example`.

| Variable | Rôle |
|---|---|
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | connexion Twitch, diffusions, planning |
| `TWITCH_CHANNEL` | chaîne affichée (facultatif, défaut `turkelpop`) |
| `YOUTUBE_API_KEY` | facultatif |
| `SESSION_SECRET` | **32 caractères minimum** ; signe le cookie de synchronisation. Générer : `node -e "console.log(require('crypto').randomBytes(36).toString('hex'))"` |
| `SYNC_DB_PATH` | par exemple `/home/compte/pixels-perspective-data/sync.sqlite`, **hors** du dossier envoyé à l'étape 3 pour qu'un redéploiement ne l'efface pas |
| `SITE_URL` | l'adresse publique, par exemple `https://pixelsperspective.fr` |

Sans `SESSION_SECRET`, le site fonctionne normalement mais la synchronisation entre appareils est désactivée.

## 6. Twitch

Dans la console développeur Twitch, ajoutez comme **URL de redirection OAuth** : `https://votre-domaine/auth/twitch/callback`.

Les visiteurs déjà connectés avant l'activation de la synchronisation voient « Activer la synchro » à côté de leur nom : un clic les reconnecte et crée leur session.

## 7. Mettre à jour le site

1. `VITE_SITE_URL=https://votre-domaine bun run build:node` (l'adresse est intégrée au code : sans elle, canonical, sitemap et `robots.txt` perdent leurs URLs absolues).
2. Renvoyer `.output/` (et `start.mjs` s'il a changé).
3. Redémarrer le site depuis l'administration (*Web > Sites*).

La base de synchronisation (`SYNC_DB_PATH`) n'est pas touchée.

> Le serveur lit la liste de ses fichiers statiques **au démarrage**. Tout fichier ajouté dans `public/` (image, fichier de validation Google…) exige donc un nouveau build, un renvoi **et** un redémarrage ; sans cela il répond 404. Les pages d'épisodes, elles, se mettent à jour seules avec le flux Acast.

## 8. HTTPS et référencement

- Onglet **SSL** du site : activez « Forcer HTTPS ». Sans cela l'adresse `http://` répond au lieu de rediriger, et le cookie de session n'est `Secure` qu'en HTTPS.
- **Google Search Console** : choisissez la propriété « **Préfixe de l'URL** » (`https://votre-domaine/`). Le type « Domaine » exige un accès aux DNS, impossible sur une adresse `*.alwaysdata.net`. Validez par **fichier HTML** : placez le fichier `googleXXXX.html` fourni par Google dans `public/`, reconstruisez, renvoyez et redémarrez (voir ci-dessus), puis cliquez sur « Valider ». Ne le supprimez pas : Google le revérifie.
- Dans *Sitemaps*, envoyez `sitemap.xml`. L'état « Impossible de récupérer le sitemap » est fréquent juste après l'envoi sur une propriété neuve ; réessayez après 24 à 48 heures.

## Données personnelles de la synchronisation

Pour un visiteur connecté avec Twitch, le serveur conserve : son **identifiant Twitch numérique**, les **positions d'écoute** par épisode, les **épisodes écoutés ou en cours** et sa **vitesse de lecture**. Rien d'autre (ni jeton Twitch, ni e-mail, ni pseudo). Le cookie de session (`pp_session`) est `HttpOnly`, signé, valable 30 jours, et ne contient que l'identifiant Twitch.

Le bouton « Supprimer mes données synchronisées » du pied de page efface les données du serveur. Pensez à ajouter une mention sur ces traitements dans une page de confidentialité, et à sauvegarder le fichier `SYNC_DB_PATH` si vous tenez à ces données.
