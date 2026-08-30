# Project Brief

## Stack

- React 19 + TypeScript, Vite 7.
- TanStack Start (SSR), Router, React Query.
- Tailwind CSS 4, Radix UI, Framer Motion, Lucide.
- Nitro build via `@lovable.dev/vite-tanstack-config`; target Cloudflare par défaut.

## Architecture

- Site vitrine SSR à page unique pour Pixels Perspective.
- Routes fichier-based dans `src/routes`; composants métier dans `src/components`.
- Fonctions serveur dans `src/lib/*.functions.ts`; elles appellent services externes.
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
- `routeTree.gen.ts` est généré: ne pas éditer manuellement.

## Design system

- Thème sombre, glassmorphism, gradients magenta/cyan/violet définis dans `src/styles.css`.
- Tailwind utilities; police locale Homebase pour identité, Inter pour texte.
- Animations Framer Motion. Composants Radix/shadcn disponibles dans `src/components/ui`.

## Data / API

- Podcast: RSS Acast.
- YouTube: `YOUTUBE_API_KEY` pour Data API, fallback RSS de playlist.
- Twitch: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, optionnel `TWITCH_CHANNEL`; Helix/OAuth, fallback statique.
- Aucun stockage persistant ni base de données.

## Auth

- Aucune authentification utilisateur.
- OAuth Twitch uniquement machine-à-machine pour lire API Twitch.

## Commandes utiles

- `npm.cmd run dev`
- `npm.cmd run build`
- `npm.cmd run preview`
- `npm.cmd run lint`

## Règles importantes

- Préserver SSR et wrappers d’erreur dans `src/server.ts` / `src/start.ts`.
- Ne pas ajouter manuellement plugins déjà inclus par configuration Lovable.
- Garder appels API et secrets côté serveur.
- Éviter modifications massives dans `src/components/ui` non utilisées.

## Pièges connus

- Lint global échoue actuellement: `.agents` est analysé et Prettier signale de nombreux CRLF.
- Aucun test automatisé configuré.
- Le flux Podcast peut échouer sans état d’erreur visible.
- Données Twitch fallback sont statiques avec dates reconstruites à l’exécution.
- Saisons podcast sont artificielles: lots de 10 épisodes, pas métadonnées source.
