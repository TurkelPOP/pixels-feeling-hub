import { createServerFn } from "@tanstack/react-start";

const CHANNEL_ID = "UC7eDkZaMYbiURgdv042M2pg";

export interface Playlist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
}

const FALLBACK: Playlist[] = [
  {
    id: "fallback-1",
    title: "Game Reviews",
    description: "Deep dives into the games that shaped us.",
    thumbnail: "",
    itemCount: 12,
  },
  {
    id: "fallback-2",
    title: "Emotional Moments",
    description: "The scenes that made us cry, laugh, and rage.",
    thumbnail: "",
    itemCount: 8,
  },
  {
    id: "fallback-3",
    title: "Behind the Pixels",
    description: "Conversations with developers and creators.",
    thumbnail: "",
    itemCount: 5,
  },
  {
    id: "fallback-4",
    title: "Live Replays",
    description: "Best moments from past Twitch streams.",
    thumbnail: "",
    itemCount: 20,
  },
];

export const getPlaylists = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ playlists: Playlist[]; fallback: boolean }> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { playlists: FALLBACK, fallback: true };
    }
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${CHANNEL_ID}&maxResults=12&key=${apiKey}`,
      );
      if (!res.ok) return { playlists: FALLBACK, fallback: true };
      const json = (await res.json()) as {
        items?: Array<{
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; high?: { url: string } };
          };
          contentDetails: { itemCount: number };
        }>;
      };
      const playlists: Playlist[] =
        json.items?.map((it) => ({
          id: it.id,
          title: it.snippet.title,
          description: it.snippet.description,
          thumbnail:
            it.snippet.thumbnails.high?.url ??
            it.snippet.thumbnails.medium?.url ??
            "",
          itemCount: it.contentDetails.itemCount,
        })) ?? [];
      return { playlists, fallback: false };
    } catch {
      return { playlists: FALLBACK, fallback: true };
    }
  },
);
