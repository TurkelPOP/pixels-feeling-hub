import { createServerFn } from "@tanstack/react-start";

const FEED_URL = "https://feeds.acast.com/public/shows/644500d69f1fbe001188cbd6";

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
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  if (raw.includes(":")) {
    const parts = raw.split(":").map((n) => parseInt(n, 10));
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

export const getPodcastFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<PodcastFeed> => {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "PixelsPerspective/1.0" },
    });
    if (!res.ok) throw new Error(`Feed failed: ${res.status}`);
    const xml = await res.text();

    const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
    const channel = channelMatch ? channelMatch[1] : xml;
    const channelHead = channel.split(/<item>/i)[0];

    const showImage =
      pickAttr(channelHead, "itunes:image", "href") ||
      pick(channelHead, "url");

    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    const episodes: Episode[] = [];
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml))) {
      const item = m[1];
      const title = pick(item, "title");
      const desc = stripHtml(
        pick(item, "itunes:summary") || pick(item, "description"),
      );
      const audioUrl = pickAttr(item, "enclosure", "url");
      const duration = formatDuration(pick(item, "itunes:duration"));
      const pubDate = pick(item, "pubDate");
      const image =
        pickAttr(item, "itunes:image", "href") || showImage;
      const link = pick(item, "link");
      const guid = pick(item, "guid") || audioUrl;
      if (title) {
        episodes.push({
          guid,
          title,
          description: desc,
          pubDate,
          duration,
          audioUrl,
          image,
          link,
        });
      }
    }

    return {
      title: pick(channelHead, "title"),
      description: stripHtml(pick(channelHead, "description")),
      image: showImage,
      link: pick(channelHead, "link"),
      episodes,
    };
  },
);
