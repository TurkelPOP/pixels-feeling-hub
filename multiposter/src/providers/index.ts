import type { Provider } from "../db.ts";
import { facebook, instagram, metaFlow } from "./meta.ts";
import { threads, threadsFlow } from "./threads.ts";
import { tiktok, tiktokFlow } from "./tiktok.ts";
import type { OAuthFlow, Publisher } from "./types.ts";
// X n'est plus proposé (API payante) : la publication reste définie pour d'éventuels anciens
// comptes, mais on ne peut plus connecter de compte X.
import { x } from "./x.ts";
import { youtube, youtubeFlow } from "./youtube.ts";

export const publishers: Record<Provider, Publisher> = { youtube, tiktok, instagram, facebook, threads, x };

export const flows: Record<string, OAuthFlow> = Object.fromEntries(
  [youtubeFlow, tiktokFlow, metaFlow, threadsFlow].map((f) => [f.id, f]),
);
