import { callbackUrl, config } from "../config.ts";
import { form, json, postJson, request } from "../http.ts";
import { readChunk } from "../media.ts";
import { images, videos, type OAuthFlow, type Publisher } from "./types.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const token = (params: Record<string, string>) =>
  json(
    "https://oauth2.googleapis.com/token",
    form({ ...params, client_id: config.google.clientId!, client_secret: config.google.clientSecret! }),
  );

export const youtubeFlow: OAuthFlow = {
  id: "google",
  label: "YouTube",
  providers: ["youtube"],
  configured: () => !!(config.google.clientId && config.google.clientSecret),
  authorizeUrl: (state) =>
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: config.google.clientId!,
      redirect_uri: callbackUrl("google"),
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }),
  async callback(code) {
    const t = await token({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("google") });
    const ch = await json("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    const items = ch.items ?? [];
    if (!items.length) throw new Error("Aucune chaîne YouTube sur ce compte Google.");
    return items.map((c: any) => ({
      provider: "youtube" as const,
      externalId: c.id,
      name: c.snippet.title,
      avatarUrl: c.snippet.thumbnails?.default?.url ?? null,
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: Date.now() + t.expires_in * 1000,
      meta: {},
    }));
  },
};

const CHUNK = 16 * 1024 * 1024; // multiple de 256 Kio
const PRIVACY = process.env.YOUTUBE_PRIVACY ?? "public";
const CATEGORY = process.env.YOUTUBE_CATEGORY_ID ?? "20"; // 20 = Jeux vidéo

export const youtube: Publisher = {
  id: "youtube",
  label: "YouTube",
  maxText: 5_000,
  refreshMarginMs: 5 * 60_000,
  validate({ media }) {
    if (!videos(media).length) return "YouTube n'accepte que les vidéos : ajoute une vidéo ou décoche YouTube.";
    if (videos(media).length > 1 || images(media).length) return "YouTube : une seule vidéo, sans image (choisis-la dans « Médias envoyés »).";
    return null;
  },
  async refresh(account) {
    const t = await token({ grant_type: "refresh_token", refresh_token: account.refreshToken! });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
  },
  async publish({ account, text, title, media, options }) {
    const v = videos(media)[0];
    const auth = `Bearer ${account.accessToken}`;
    const finalTitle = (options.title || title.trim() || text.split("\n")[0].trim() || v.filename).replace(/[<>]/g, "").slice(0, 100);
    const init = await request(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      postJson(
        {
          snippet: { title: finalTitle, description: text.replace(/[<>]/g, "").slice(0, 5_000), categoryId: CATEGORY },
          status: { privacyStatus: options.privacy && !options.privacy.includes("_") ? options.privacy : PRIVACY, selfDeclaredMadeForKids: false },
        },
        { Authorization: auth, "X-Upload-Content-Type": v.mime, "X-Upload-Content-Length": String(v.size) },
      ),
    );
    const location = init.headers.get("location");
    if (!location) throw new Error("YouTube : URL d'upload manquante");

    let result: any;
    for (let off = 0; off < v.size; off += CHUNK) {
      const chunk = await readChunk(v.path, off, CHUNK);
      const res = await fetch(location, {
        method: "PUT",
        headers: {
          Authorization: auth,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${off}-${off + chunk.length - 1}/${v.size}`,
        },
        body: chunk,
        signal: AbortSignal.timeout(10 * 60_000),
      });
      if (res.status === 308) continue;
      if (!res.ok) throw new Error(`YouTube upload HTTP ${res.status} : ${(await res.text()).slice(0, 300)}`);
      result = await res.json();
    }
    if (!result?.id) throw new Error("YouTube : upload incomplet");
    return { url: `https://www.youtube.com/watch?v=${result.id}`, id: result.id };
  },
};
