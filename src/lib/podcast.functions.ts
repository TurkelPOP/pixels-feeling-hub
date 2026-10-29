/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";

import {
  cached,
  decodeEntities,
  fetchWithTimeout,
  readTextLimited,
  safeHttpUrl,
} from "./fetch.server";

const FEED_URL = "https://feeds.acast.com/public/shows/644500d69f1fbe001188cbd6";
const CACHE_TTL_MS = 10 * 60_000;
const UNAVAILABLE = "Le podcast est momentanément indisponible.";

export interface Episode {
  guid: string;
  title: string;
  description: string;
  pubDate: string;
  duration: string;
  audioUrl: string;
  image: string;
  link: string;
}

export interface PodcastFeed {
  title: string;
  description: string;
  image: string;
  link: string;
  episodes: Episode[];
}

function pick(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function pickAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  if (raw.includes(":")) {
    const parts = raw.split(":").map((n) => parseInt(n, 10));
    if (parts.some(isNaN)) return "";
    let h = 0,
      m = 0,
      s = 0;
    if (parts.length === 3) [h, m, s] = parts;
    else if (parts.length === 2) [m, s] = parts;
    else [s] = parts;
    const total = h * 60 + m + (s >= 30 ? 1 : 0);
    return `${total} min`;
  }
  const secs = parseInt(raw, 10);
  if (!isNaN(secs)) return `${Math.round(secs / 60)} min`;
  return raw;
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

  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  const channel = channelMatch ? channelMatch[1] : xml;
  const channelHead = channel.split(/<item>/i)[0];

  // Every URL below comes from a third-party feed and ends up in src/href
  // attributes or the clipboard: only keep absolute http(s) URLs.
  const showImage = safeHttpUrl(
    pickAttr(channelHead, "itunes:image", "href") || pick(channelHead, "url"),
  );

  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  const episodes: Episode[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(channel))) {
    const item = m[1];
    const title = stripHtml(pick(item, "title"));
    if (!title) continue;
    const audioUrl = safeHttpUrl(decodeEntities(pickAttr(item, "enclosure", "url")));
    episodes.push({
      guid: pick(item, "guid") || audioUrl || title,
      title,
      description: stripHtml(pick(item, "itunes:summary") || pick(item, "description")),
      pubDate: pick(item, "pubDate"),
      duration: formatDuration(pick(item, "itunes:duration")),
      audioUrl,
      image: safeHttpUrl(decodeEntities(pickAttr(item, "itunes:image", "href"))) || showImage,
      link: safeHttpUrl(pick(item, "link")),
    });
  }

  return {
    title: stripHtml(pick(channelHead, "title")),
    description: stripHtml(pick(channelHead, "description")),
    image: showImage,
    link: safeHttpUrl(pick(channelHead, "link")),
    episodes,
  };
}

export const getPodcastFeed = createServerFn({ method: "GET" }).handler(
  (): Promise<PodcastFeed> => cached("podcast-feed", CACHE_TTL_MS, fetchPodcastFeed),
);
