/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";

import { cached, decodeEntities, fetchWithTimeout, readTextLimited } from "./fetch.server";

// Official Pixels Perspective Playlist ID
const PIXELS_PERSPECTIVE_PLAYLIST_ID = "PLf7hoWB9RRm6L2_2u7hVvoDcfFvsO9mwg";
const PLAYLIST_RSS_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PIXELS_PERSPECTIVE_PLAYLIST_ID}`;
const CACHE_TTL_MS = 10 * 60_000;
const UNAVAILABLE = "YouTube est momentanément indisponible.";
// Video IDs are interpolated into iframe/thumbnail URLs: only accept the canonical shape.
const VIDEO_ID_RE = /^[\w-]{11}$/;
// Placeholders the Data API returns for videos that can't be played.
const HIDDEN_TITLES = new Set(["Private video", "Deleted video"]);

export interface Playlist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number | string;
  type?: "video" | "playlist";
  pubDate?: string;
}

function pick(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

async function fetchFromApi(apiKey: string): Promise<Playlist[]> {
  const params = new URLSearchParams({
    part: "snippet",
    playlistId: PIXELS_PERSPECTIVE_PLAYLIST_ID,
    maxResults: "15",
    key: apiKey,
  });
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
  );
  if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
  const json = (await res.json()) as {
    items?: Array<{
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        resourceId: { videoId: string };
        thumbnails: { medium?: { url: string }; high?: { url: string } };
      };
    }>;
  };

  return (json.items ?? [])
    .filter(
      (it) => VIDEO_ID_RE.test(it.snippet.resourceId.videoId) && !HIDDEN_TITLES.has(it.snippet.title),
    )
    .map((it) => ({
      id: it.snippet.resourceId.videoId,
      title: it.snippet.title,
      description: it.snippet.description || "Pixels Perspective",
      thumbnail:
        it.snippet.thumbnails.high?.url ??
        it.snippet.thumbnails.medium?.url ??
        `https://i.ytimg.com/vi/${it.snippet.resourceId.videoId}/hqdefault.jpg`,
      itemCount: "HD",
      type: "video",
      pubDate: it.snippet.publishedAt,
    }));
}

async function fetchFromRss(): Promise<Playlist[]> {
  const res = await fetchWithTimeout(PLAYLIST_RSS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`YouTube RSS HTTP ${res.status}`);
  const xml = await readTextLimited(res);

  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  const items: Array<Playlist & { timestamp: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(xml))) {
    const entry = m[1];
    const videoId = pick(entry, "yt:videoId");
    const title = decodeEntities(pick(entry, "title"));
    const published = pick(entry, "published");
    const timestamp = published ? new Date(published).getTime() : 0;
    const dateStr = published
      ? new Date(published).toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

    if (VIDEO_ID_RE.test(videoId) && title) {
      items.push({
        id: videoId,
        title,
        description: dateStr ? `Pixels Perspective · ${dateStr}` : "Pixels Perspective",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        itemCount: "HD",
        type: "video",
        pubDate: published,
        timestamp,
      });
    }
  }

  // Sort descending by publication timestamp so the newest video is always FIRST
  items.sort((a, b) => b.timestamp - a.timestamp);

  return items.map(({ timestamp: _timestamp, ...rest }) => rest);
}

async function fetchPlaylists(): Promise<{ playlists: Playlist[]; fallback: boolean }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const videos = await fetchFromApi(apiKey);
      if (videos.length > 0) return { playlists: videos, fallback: false };
    } catch (error) {
      // Never log the request URL: it carries the API key.
      console.error("[youtube] Data API failed, falling back to RSS", (error as Error).message);
    }
  }

  // Free YouTube Playlist RSS Feed fallback (No API key needed!)
  try {
    return { playlists: await fetchFromRss(), fallback: true };
  } catch (error) {
    console.error("[youtube] RSS failed", error);
    throw new Error(UNAVAILABLE);
  }
}

// The first entry is the latest video (API: playlist order, RSS: sorted by date).
export const getPlaylists = createServerFn({ method: "GET" }).handler(() =>
  cached("youtube-playlists", CACHE_TTL_MS, fetchPlaylists),
);
