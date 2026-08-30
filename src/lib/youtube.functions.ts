/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";

const CHANNEL_ID = "UC7eDkZaMYbiURgdv042M2pg";
// Official Pixels Perspective Playlist ID
const PIXELS_PERSPECTIVE_PLAYLIST_ID = "PLf7hoWB9RRm6L2_2u7hVvoDcfFvsO9mwg";
const PLAYLIST_RSS_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PIXELS_PERSPECTIVE_PLAYLIST_ID}`;

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

async function fetchPixelsPerspectiveVideos(): Promise<Playlist[]> {
  try {
    const res = await fetch(PLAYLIST_RSS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error("YouTube est momentanément indisponible.");
    const xml = await res.text();

    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
    const items: Array<Playlist & { timestamp: number }> = [];
    let m: RegExpExecArray | null;

    while ((m = entryRe.exec(xml))) {
      const entry = m[1];
      const videoId = pick(entry, "yt:videoId");
      const title = pick(entry, "title");
      const published = pick(entry, "published");
      const timestamp = published ? new Date(published).getTime() : 0;
      const dateStr = published
        ? new Date(published).toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";

      if (videoId && title) {
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

    return items.map(({ timestamp, ...rest }) => rest);
  } catch {
    throw new Error("YouTube est momentanément indisponible.");
  }
}

export const getPlaylists = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ playlists: Playlist[]; fallback: boolean }> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${PIXELS_PERSPECTIVE_PLAYLIST_ID}&maxResults=15&key=${apiKey}`,
        );
        if (res.ok) {
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
          const videos: Playlist[] =
            json.items?.map((it) => ({
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
            })) ?? [];
          if (videos.length > 0) {
            return { playlists: videos, fallback: false };
          }
        }
      } catch {
        // Fallback to RSS below
      }
    }

    // Free YouTube Playlist RSS Feed fallback (No API key needed!)
    const rssVideos = await fetchPixelsPerspectiveVideos();
    if (rssVideos.length > 0) {
      return { playlists: rssVideos, fallback: true };
    }

    return { playlists: [], fallback: true };
  },
);

export const getLatestVideo = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ videoId: string | null; error: string | null }> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${PIXELS_PERSPECTIVE_PLAYLIST_ID}&maxResults=1&key=${apiKey}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            items?: Array<{ snippet?: { resourceId?: { videoId?: string } } }>;
          };
          const videoId = json.items?.[0]?.snippet?.resourceId?.videoId ?? null;
          if (videoId) {
            return { videoId, error: null };
          }
        }
      } catch {
        // Fallback to RSS below
      }
    }

    // Free YouTube Playlist RSS Feed fallback (No API key needed!)
    const rssVideos = await fetchPixelsPerspectiveVideos();
    if (rssVideos.length > 0) {
      return { videoId: rssVideos[0].id, error: null };
    }

    return { videoId: null, error: null };
  },
);
