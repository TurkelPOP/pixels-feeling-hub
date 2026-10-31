// Pure RSS parsing for the Acast feed: no server-only imports so it can be unit-tested.
import { XMLParser } from "fast-xml-parser";

import { decodeEntities, safeHttpUrl } from "./fetch.server";
import type { Episode, PodcastFeed } from "./podcast.functions";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Keep guids, durations and season numbers as the strings the feed carries.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "item",
});

type XmlNode = string | { "#text"?: string; [key: string]: unknown } | undefined;

/** Text content of a node, whether the tag had attributes or not. */
function text(node: unknown): string {
  if (typeof node === "string") return node.trim();
  if (node && typeof node === "object") {
    const t = (node as { "#text"?: unknown })["#text"];
    if (typeof t === "string") return t.trim();
  }
  return "";
}

function attr(node: unknown, name: string): string {
  if (node && typeof node === "object") {
    const v = (node as Record<string, unknown>)[`@_${name}`];
    if (typeof v === "string") return v;
  }
  return "";
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

export function formatDuration(raw: string): string {
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

/** `itunes:duration` is either seconds ("3760") or [HH:]MM:SS. */
export function parseDurationSeconds(raw: string): number | undefined {
  if (!raw) return undefined;
  const parts = raw.split(":").map((n) => Number(n));
  if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  const secs = parts.reduce((total, n) => total * 60 + n, 0);
  return secs > 0 ? Math.round(secs) : undefined;
}

function positiveInt(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parsePodcastFeed(xml: string): PodcastFeed {
  const doc = parser.parse(xml) as { rss?: { channel?: Record<string, XmlNode | XmlNode[]> } };
  const channel = doc.rss?.channel;
  if (!channel) throw new Error("Feed has no <channel>");

  // Every URL below comes from a third-party feed and ends up in src/href
  // attributes or the clipboard: only keep absolute http(s) URLs.
  const channelImage = channel["itunes:image"] as unknown;
  const showImage = safeHttpUrl(
    attr(channelImage, "href") || text((channel["image"] as { url?: unknown } | undefined)?.url),
  );

  const items = (channel["item"] as unknown as Array<Record<string, unknown>> | undefined) ?? [];
  const episodes: Episode[] = [];
  for (const item of items) {
    const title = stripHtml(text(item["title"]));
    if (!title) continue;
    const audioUrl = safeHttpUrl(attr(item["enclosure"], "url"));
    episodes.push({
      guid: text(item["guid"]) || audioUrl || title,
      title,
      description: stripHtml(text(item["itunes:summary"]) || text(item["description"])),
      pubDate: text(item["pubDate"]),
      duration: formatDuration(text(item["itunes:duration"])),
      durationSec: parseDurationSeconds(text(item["itunes:duration"])),
      audioUrl,
      image: safeHttpUrl(attr(item["itunes:image"], "href")) || showImage,
      link: safeHttpUrl(text(item["link"])),
      season: positiveInt(text(item["itunes:season"])),
    });
  }

  return {
    title: stripHtml(text(channel["title"])),
    description: stripHtml(text(channel["description"])),
    image: showImage,
    link: safeHttpUrl(text(channel["link"])),
    episodes,
  };
}
