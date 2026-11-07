import type { Provider } from "../db.ts";
import { facebook, instagram, metaFlow } from "./meta.ts";
import { threads, threadsFlow } from "./threads.ts";
import { tiktok, tiktokFlow } from "./tiktok.ts";
import type { OAuthFlow, Publisher } from "./types.ts";
import { x, xFlow } from "./x.ts";
import { youtube, youtubeFlow } from "./youtube.ts";

export const publishers: Record<Provider, Publisher> = { youtube, tiktok, instagram, facebook, threads, x };

export const flows: Record<string, OAuthFlow> = Object.fromEntries(
  [youtubeFlow, tiktokFlow, metaFlow, threadsFlow, xFlow].map((f) => [f.id, f]),
);
