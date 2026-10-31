# Project Brief

## Stack

- React 19 + TypeScript, Vite 7.
- TanStack Start (SSR), Router, React Query.
- Tailwind CSS 4, Radix UI, Framer Motion, Lucide.
- Nitro build via `@lovable.dev/vite-tanstack-config`; target Cloudflare par défaut.

## Architecture

- Site vitrine SSR à page unique pour Pixels Perspective.
- Routes fichier-based dans `src/routes`; composants métier dans `src/components`.
- Fonctions serveur dans `src/lib/*.functions.ts`; elles appellent services externes via `src/lib/fetch.server.ts` (timeout, taille max, cache mémoire par isolate, validation d'URL).
- `src/server.ts` ajoute les en-têtes de sécurité (HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP).
- `src/server.ts` intercepte erreurs SSR catastrophiques et rend page HTML de secours.
- `src/router.tsx` crée QueryClient par instance de routeur.

## Routes

- `/`: page principale, compose Hero, Podcast, YouTube, Twitch, Footer.
- Route racine: shell HTML, métadonnées, QueryClientProvider, 404 et error boundary.

## Composants importants

- `Hero`: navigation ancrée responsive.
- `Podcast`: flux Acast, sélection épisodes, lecture HTML audio, mini-player fixe.
- `YouTubeSection`: vidéos playlist.
- `TwitchSection`: live et VODs Twitch.
- `ScrollProgress`, `Footer`; `FCSubwayButton` existe comme CTA externe.

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
- Aucune base de données (seul localStorage côté navigateur).

## Auth

- Connexion Twitch facultative (code d'autorisation, secret côté serveur) : affiche le profil et le statut abonné/follower.
- Historique d'écoute/visionnage stocké uniquement en localStorage (`src/lib/userHistory.ts`).
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
- Aucun test automatisé configuré.
- Le flux Podcast peut échouer sans état d’erreur visible.
- Données Twitch fallback sont statiques avec dates reconstruites à l’exécution.
- Saisons podcast sont artificielles: lots de 10 épisodes, pas métadonnées source.
