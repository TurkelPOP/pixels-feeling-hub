import { createServerFn } from "@tanstack/react-start";

import { cached, fetchWithTimeout, readTextLimited } from "./fetch.server";
import { parsePodcastFeed } from "./podcast.parse";

const FEED_URL = "https://feeds.acast.com/public/shows/644500d69f1fbe001188cbd6";
const CACHE_TTL_MS = 10 * 60_000;
const UNAVAILABLE = "Le podcast est momentanément indisponible.";

export interface Episode {
  guid: string;
  title: string;
  description: string;
  pubDate: string;
  duration: string;
  /** Length in seconds from `itunes:duration`, known before the audio is loaded. */
  durationSec?: number;
  audioUrl: string;
  image: string;
  link: string;
  /** `itunes:season` when the feed provides one. */
  season?: number;
}

export interface PodcastFeed {
  title: string;
  description: string;
  image: string;
  link: string;
  episodes: Episode[];
}

async function fetchPodcastFeed(): Promise<PodcastFeed> {
  let xml: string;
  try {
    const res = await fetchWithTimeout(FEED_URL, {
      headers: { "User-Agent": "PixelsPerspective/1.0" },
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    xml = await readTextLimited(res);
  } catch (error) {
    console.error("[podcast] feed fetch failed", error);
    throw new Error(UNAVAILABLE);
  }

  try {
    return parsePodcastFeed(xml);
  } catch (error) {
    console.error("[podcast] feed parse failed", error);
    throw new Error(UNAVAILABLE);
  }
}

export const getPodcastFeed = createServerFn({ method: "GET" }).handler(
  (): Promise<PodcastFeed> => cached("podcast-feed", CACHE_TTL_MS, fetchPodcastFeed),
);
