/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";

import { cached, fetchWithTimeout } from "./fetch.server";

export interface TwitchVideo {
  id: string;
  streamId?: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  createdAt: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string;
  viewCount: number;
  duration: string;
  type: string;
  gameName?: string;
}

export interface TwitchStreamInfo {
  isLive: boolean;
  streamId?: string;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
}

export interface TwitchData {
  channelName: string;
  channelUrl: string;
  displayName: string;
  profileImageUrl?: string;
  stream: TwitchStreamInfo;
  videos: TwitchVideo[];
  fallback: boolean;
}

function formatTwitchDuration(raw: string): string {
  if (!raw) return "";
  const hoursMatch = raw.match(/(\d+)h/);
  const minutesMatch = raw.match(/(\d+)m/);
  const secondsMatch = raw.match(/(\d+)s/);

  const hours = hoursMatch ? hoursMatch[1] : null;
  const minutes = minutesMatch ? minutesMatch[1] : (hours ? "00" : "0");
  const seconds = secondsMatch ? secondsMatch[1] : "00";

  if (hours) {
    return `${hours}h ${minutes.padStart(2, "0")}m`;
  }
  if (minutes !== "0") {
    return `${minutes}m ${seconds.padStart(2, "0")}s`;
  }
  return raw;
}

const FALLBACK_CHANNEL = "turkelpop";
const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80";
const CACHE_TTL_MS = 2 * 60_000;
const UNAVAILABLE = "Twitch est momentanément indisponible.";
// Twitch logins: letters, digits and underscores, at most 25 chars.
const LOGIN_RE = /^[a-z0-9_]{3,25}$/;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const fallbackVideos = (): TwitchVideo[] => [
  {
    id: "2389104128",
    title: "FC SUBWAY : L'épopée commence ! ⚽ Saison 1 - Épisode 1",
    description: "Découverte et début de saison avec le FC Subway sur Football Manager 2026.",
    createdAt: daysAgo(2),
    publishedAt: daysAgo(2),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: FALLBACK_THUMBNAIL,
    viewCount: 142,
    duration: "2h 45m",
    type: "archive",
    gameName: "Football Manager 2026",
    userName: "TurkelPOP",
    userId: "123456",
  },
  {
    id: "2387519283",
    title: "Pixels Perspective Live #14 : Les jeux qui nous ont brisé le cœur 💔",
    description: "Émission live & discussions avec le chat sur les moments les plus émouvants du jeu vidéo.",
    createdAt: daysAgo(5),
    publishedAt: daysAgo(5),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80",
    viewCount: 230,
    duration: "1h 58m",
    type: "archive",
    gameName: "Talk Shows & Podcasts",
    userName: "TurkelPOP",
    userId: "123456",
  },
  {
    id: "2385109382",
    title: "FC SUBWAY : Derby sous haute tension & Mercato d'hiver ! ⚡",
    description: "Session intense sur FM26 : gestion tactique et ambiance vestiaire.",
    createdAt: daysAgo(8),
    publishedAt: daysAgo(8),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
    viewCount: 188,
    duration: "3h 12m",
    type: "archive",
    gameName: "Football Manager 2026",
    userName: "TurkelPOP",
    userId: "123456",
  },
  {
    id: "2382948174",
    title: "Découverte Indés : Les pépites narratives de l'année 🎮✨",
    description: "Session chill où on teste 4 jeux indépendants avec une narration forte.",
    createdAt: daysAgo(12),
    publishedAt: daysAgo(12),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=800&q=80",
    viewCount: 165,
    duration: "2h 15m",
    type: "archive",
    gameName: "Games + Demos",
    userName: "TurkelPOP",
    userId: "123456",
  },
  {
    id: "2380129481",
    title: "FC SUBWAY : La finale de Coupe ! On joue le titre 🏆",
    description: "Dernière ligne droite de la saison, supporters au rendez-vous !",
    createdAt: daysAgo(16),
    publishedAt: daysAgo(16),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=800&q=80",
    viewCount: 310,
    duration: "3h 30m",
    type: "archive",
    gameName: "Football Manager 2026",
    userName: "TurkelPOP",
    userId: "123456",
  },
];

let appToken: { value: string; expires: number } | undefined;

async function getTwitchAppToken(clientId: string, clientSecret: string): Promise<string> {
  // App access tokens live ~60 days: reuse it instead of minting one per request.
  if (appToken && appToken.expires > Date.now()) return appToken.value;

  const res = await fetchWithTimeout("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch token HTTP ${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Twitch token missing");
  const ttlMs = Math.max(60, (data.expires_in ?? 3600) - 300) * 1000;
  appToken = { value: data.access_token, expires: Date.now() + ttlMs };
  return appToken.value;
}

async function helix<T>(
  path: string,
  params: Record<string, string>,
  clientId: string,
  token: string,
): Promise<T> {
  const url = `https://api.twitch.tv/helix/${path}?${new URLSearchParams(params)}`;
  const res = await fetchWithTimeout(url, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) appToken = undefined;
  if (!res.ok) throw new Error(`Twitch ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

type HelixUser = { id: string; login: string; display_name: string; profile_image_url: string };
type HelixStream = {
  id: string;
  title: string;
  game_name: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
};
type HelixVideo = {
  id: string;
  stream_id?: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  view_count: number;
  duration: string;
  type: string;
};

async function fetchTwitchData(
  clientId: string,
  clientSecret: string,
  channelLogin: string,
): Promise<TwitchData> {
  const token = await getTwitchAppToken(clientId, clientSecret);

  const users = await helix<{ data?: HelixUser[] }>("users", { login: channelLogin }, clientId, token);
  const user = users.data?.[0];
  if (!user) throw new Error(`Twitch user "${channelLogin}" not found`);

  const [streams, vods] = await Promise.all([
    helix<{ data?: HelixStream[] }>("streams", { user_id: user.id }, clientId, token),
    helix<{ data?: HelixVideo[] }>(
      "videos",
      { user_id: user.id, type: "archive", first: "20" },
      clientId,
      token,
    ),
  ]);

  const live = streams.data?.[0];
  const stream: TwitchStreamInfo = live
    ? {
        isLive: true,
        streamId: live.id,
        title: live.title,
        gameName: live.game_name,
        viewerCount: live.viewer_count,
        startedAt: live.started_at,
        thumbnailUrl: live.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"),
      }
    : { isLive: false };

  const videos: TwitchVideo[] = (vods.data ?? []).map((v) => ({
    id: v.id,
    streamId: v.stream_id,
    userId: v.user_id,
    userName: v.user_name,
    title: v.title,
    description: v.description,
    createdAt: v.created_at,
    publishedAt: v.published_at,
    url: v.url,
    thumbnailUrl: v.thumbnail_url
      ? v.thumbnail_url.replace(/%?\{width\}/, "640").replace(/%?\{height\}/, "360")
      : FALLBACK_THUMBNAIL,
    viewCount: v.view_count,
    duration: formatTwitchDuration(v.duration),
    type: v.type,
  }));

  return {
    channelName: user.login,
    channelUrl: `https://www.twitch.tv/${user.login}`,
    displayName: user.display_name,
    profileImageUrl: user.profile_image_url,
    stream,
    videos,
    fallback: false,
  };
}

export const getTwitchData = createServerFn({ method: "GET" }).handler(
  async (): Promise<TwitchData> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const configured = (process.env.TWITCH_CHANNEL || FALLBACK_CHANNEL).toLowerCase().trim();
    const channelLogin = LOGIN_RE.test(configured) ? configured : FALLBACK_CHANNEL;

    // Ignore missing or placeholder secrets and serve the curated fallback.
    const hasCredentials =
      !!clientId &&
      !!clientSecret &&
      !clientSecret.includes("le_secret_que_twitch") &&
      clientSecret.length > 5;

    if (!hasCredentials) {
      return {
        channelName: channelLogin,
        channelUrl: `https://www.twitch.tv/${channelLogin}`,
        displayName: "TurkelPOP",
        stream: { isLive: false },
        videos: fallbackVideos(),
        fallback: true,
      };
    }

    try {
      return await cached(`twitch:${channelLogin}`, CACHE_TTL_MS, () =>
        fetchTwitchData(clientId, clientSecret, channelLogin),
      );
    } catch (error) {
      console.error("[twitch] fetch failed", error);
      throw new Error(UNAVAILABLE);
    }
  },
);
