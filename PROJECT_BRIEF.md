# Project Brief

## Stack

- React 19 + TypeScript, Vite 7.
- TanStack Start (SSR), Router, React Query.
- Tailwind CSS 4, Framer Motion, Lucide.
- Nitro build via `@lovable.dev/vite-tanstack-config`; target Cloudflare par défaut.
- Production alwaysdata : `bun run build:node` (preset Nitro `node-server`, dossier `.output/`) lancé par `start.mjs`. Voir `DEPLOY.md`.

## Architecture

- Site vitrine SSR pour Pixels Perspective : une page d'accueil et une page par épisode.
- Routes fichier-based dans `src/routes`; composants métier dans `src/components`.
- Fonctions serveur dans `src/lib/*.functions.ts`; elles appellent services externes via `src/lib/fetch.server.ts` (timeout, taille max, cache mémoire par isolate, validation d'URL).
- `src/server.ts` ajoute les en-têtes de sécurité (HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP).
- `src/server.ts` intercepte erreurs SSR catastrophiques et rend page HTML de secours.
- `src/router.tsx` crée QueryClient par instance de routeur.

## Routes

- `/`: page principale, compose Hero, Podcast, YouTube, Twitch, Footer.
- `/episode/$slug`: page d'un épisode (SSR). Slug = titre simplifié + empreinte du guid (`src/lib/episodes.ts`) ; ancien titre → 301 vers l'adresse à jour, inconnu → 404. Métadonnées, canonical et JSON-LD `PodcastEpisode` par page.
- `/sitemap.xml` et `/robots.txt`: routes serveur. Sans `VITE_SITE_URL`, le sitemap répond 404 et robots n'a pas de ligne `Sitemap`.
- Route racine: shell HTML, métadonnées par défaut, providers (React Query, auth Twitch, lecteur), 404 avec compte à rebours « Continuer ? » et error boundary. Le canonical et `og:url` sont posés par chaque page, pas par la racine.

## Composants importants

- `Hero`: navigation ancrée responsive.
- `PlayerProvider` (`src/lib/PlayerProvider.tsx`): lecteur unique monté à la racine (élément `<audio>` + mini-lecteur). La lecture continue quand on change de page. `usePodcastPlayer` porte la logique (reprise de position, vitesse, historique, Media Session).
- `PlayerCard`: le lecteur rétro affiché sur l'accueil et sur les pages épisode. Il pilote le lecteur commun si son épisode est chargé, sinon son bouton lecture le lance.
- `Podcast`: flux Acast, liste d'épisodes avec recherche et saisons réelles (`itunes:season`), liens vers les pages épisode.
- `YouTubeSection`: vidéos playlist.
- `TwitchSection`: live, VODs et bannière « Prochain live » (planning Twitch, absente si la chaîne n'en publie pas).
- `Footer` (avec l'interrupteur `CrtToggle`), `KonamiCode` (easter egg), `ContinueCountdown` (page 404).

## Conventions

- Alias `@/` pour `src/`.
- Composants React nommés; routes via `createFileRoute`.
- Appels client aux handlers serveur avec `useServerFn` + React Query.
- Secrets seulement dans `process.env` côté serveur; jamais préfixer secrets avec `VITE_`.
- Exception publique : `VITE_SITE_URL` (URL du site, non secrète) alimente og:image, og:url et canonical (`src/lib/site.ts`).
- `routeTree.gen.ts` est généré: ne pas éditer manuellement.

## Design system

- Thème sombre, glassmorphism, gradients magenta/cyan/violet définis dans `src/styles.css`.
- Tailwind utilities; police locale Homebase pour identité, Inter pour texte.
- Animations Framer Motion. Pas de bibliothèque de composants : les composants sont écrits à la main (le dossier `ui/` shadcn a été supprimé).

## Data / API

- Podcast: RSS Acast.
- YouTube: `YOUTUBE_API_KEY` pour Data API, fallback RSS de playlist.
- Twitch: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, optionnel `TWITCH_CHANNEL`; Helix/OAuth, fallback statique.
- Base SQLite (fichier `SYNC_DB_PATH`, module `node:sqlite`, Node 22.13+) uniquement pour la synchronisation entre appareils ; sans elle le site marche, seule la synchro est désactivée.
- localStorage côté navigateur : historique (`pp_history_<id>`), position de lecture par épisode `pp_podcast_positions` (`{guid:{s,t}}`, `t` = date de modification), vitesse `pp_podcast_rate` + `pp_podcast_rate_at`, effet CRT `pp_crt`.
- PWA minimale : `public/manifest.webmanifest` (installable, pas de service worker ni de hors-ligne).

## Auth

- Connexion Twitch facultative (code d'autorisation, secret côté serveur) : affiche le profil et le statut abonné/follower.
- Historique d'écoute/visionnage dans localStorage (`src/lib/userHistory.ts`), synchronisé entre appareils pour les utilisateurs connectés.
- Synchronisation : `SyncEngine` (racine) échange l'état local contre l'état fusionné du serveur (`syncExchange`, `src/lib/sync.functions.ts`) à l'ouverture, à chaque changement (au plus toutes les 20 s) et au changement de visibilité de l'onglet. Fusion dans `src/lib/sync.merge.ts` : le plus récent gagne par entrée, « terminé » est définitif.
- Identité côté serveur : cookie `pp_session` (HttpOnly, SameSite=Lax, signé HMAC avec `SESSION_SECRET`, 30 jours) posé par `handleTwitchCallback`; il ne contient que l'identifiant Twitch. Le serveur lit l'identité uniquement dans ce cookie, jamais dans la requête. Sans `SESSION_SECRET` (32 caractères min.), pas de session ni de synchro.
- `deleteSyncData` (bouton du pied de page) efface les données serveur ; la déconnexion appelle `endSyncSession`.
- OAuth Twitch machine-à-machine pour lire l'API Twitch.

## Commandes utiles

- `npm.cmd run dev`
- `npm.cmd run build`
- `npm.cmd run preview`
- `npm.cmd run lint`

## Règles importantes

- Préserver SSR et wrappers d’erreur dans `src/server.ts` / `src/start.ts`.
- Ne pas ajouter manuellement plugins déjà inclus par configuration Lovable.
- Garder appels API et secrets côté serveur.

## Pièges connus

- `.agents` est exclu du lint; `eslint .` passe (warnings seulement).
- Tests : `bun run test` (vitest, `src/**`) et CI GitHub Actions (typecheck, tests, build).
- Fichiers du dépôt en CRLF : conserver les fins de ligne en éditant.
- Données Twitch fallback (sans identifiants) sont statiques avec dates reconstruites à l'exécution.
- Saisons podcast : réelles si le flux les fournit, sinon lots de 10 épisodes.
- Le planning Twitch renvoie 404 tant que la chaîne n'en a pas publié : ce n'est pas une erreur.
