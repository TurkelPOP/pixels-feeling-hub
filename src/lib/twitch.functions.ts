/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";

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

const FALLBACK_VIDEOS: TwitchVideo[] = [
  {
    id: "2389104128",
    title: "FC SUBWAY : L'épopée commence ! ⚽ Saison 1 - Épisode 1",
    description: "Découverte et début de saison avec le FC Subway sur Football Manager 2026.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    url: "https://www.twitch.tv/turkelpop",
    thumbnailUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
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
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
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

async function getTwitchAppToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

export const getTwitchData = createServerFn({ method: "GET" }).handler(
  async (): Promise<TwitchData> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const channelLogin = (process.env.TWITCH_CHANNEL || FALLBACK_CHANNEL).toLowerCase().trim();

    // Check if valid client secret is provided (ignore placeholders)
    const isSecretValid =
      clientSecret &&
      !clientSecret.includes("le_secret_que_twitch") &&
      clientSecret.length > 5;

    if (clientId && isSecretValid) {
      try {
        const token = await getTwitchAppToken(clientId, clientSecret);
        if (token) {
          const authHeaders = {
            "Client-Id": clientId,
            Authorization: `Bearer ${token}`,
          };

          // 1. Fetch User ID
          const userRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${channelLogin}`,
            { headers: authHeaders },
          );
          if (userRes.ok) {
            const userData = (await userRes.json()) as {
              data?: Array<{
                id: string;
                login: string;
                display_name: string;
                profile_image_url: string;
                description: string;
              }>;
            };

            const user = userData.data?.[0];
            if (user) {
              // 2. Fetch Live Stream status
              let streamInfo: TwitchStreamInfo = { isLive: false };
              try {
                const streamRes = await fetch(
                  `https://api.twitch.tv/helix/streams?user_id=${user.id}`,
                  { headers: authHeaders },
                );
                if (!streamRes.ok) throw new Error("Twitch request failed");
                if (streamRes.ok) {
                  const streamData = (await streamRes.json()) as {
                    data?: Array<{
                      id: string;
                      title: string;
                      game_name: string;
                      viewer_count: number;
                      started_at: string;
                      thumbnail_url: string;
                    }>;
                  };
                  const live = streamData.data?.[0];
                  if (live) {
                    streamInfo = {
                      isLive: true,
                      streamId: live.id,
                      title: live.title,
                      gameName: live.game_name,
                      viewerCount: live.viewer_count,
                      startedAt: live.started_at,
                      thumbnailUrl: live.thumbnail_url
                        .replace("{width}", "1280")
                        .replace("{height}", "720"),
                    };
                  }
                }
              } catch {
                throw new Error("Twitch request failed");
              }

              // 3. Fetch past broadcasts / VODs
              const vodsRes = await fetch(
                `https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=20`,
                { headers: authHeaders },
              );
              if (!vodsRes.ok) throw new Error("Twitch request failed");
              let videos: TwitchVideo[] = [];
              if (vodsRes.ok) {
                const vodsData = (await vodsRes.json()) as {
                  data?: Array<{
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
                  }>;
                };

                videos = (vodsData.data || []).map((v) => ({
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
                    ? v.thumbnail_url
                        .replace("%{width}", "640")
                        .replace("%{height}", "360")
                        .replace("{width}", "640")
                        .replace("{height}", "360")
                    : "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
                  viewCount: v.view_count,
                  duration: formatTwitchDuration(v.duration),
                  type: v.type,
                }));
              }

              return {
                channelName: user.login,
                channelUrl: `https://www.twitch.tv/${user.login}`,
                displayName: user.display_name,
                profileImageUrl: user.profile_image_url,
                stream: streamInfo,
                videos,
                fallback: false,
              };
            }
          }
        }
      } catch {
        throw new Error("Twitch est momentanément indisponible.");
      }
    }

    if (clientId && isSecretValid) {
      throw new Error("Twitch est momentanément indisponible.");
    }

    // Default curated fallback
    return {
      channelName: channelLogin,
      channelUrl: `https://www.twitch.tv/${channelLogin}`,
      displayName: "TurkelPOP",
      stream: { isLive: false },
      videos: FALLBACK_VIDEOS,
      fallback: true,
    };
  },
);
