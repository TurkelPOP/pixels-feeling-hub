import { callbackUrl, config } from "../config.ts";
import { form, json, waitFor } from "../http.ts";
import type { MediaFile } from "../media.ts";
import { countChars, type OAuthFlow, type Publisher } from "./types.ts";

const G = "https://graph.threads.net/v1.0";

export const threadsFlow: OAuthFlow = {
  id: "threads",
  label: "Threads",
  providers: ["threads"],
  configured: () => !!(config.threads.appId && config.threads.appSecret),
  authorizeUrl: (state) =>
    "https://threads.net/oauth/authorize?" +
    new URLSearchParams({
      client_id: config.threads.appId!,
      redirect_uri: callbackUrl("threads"),
      scope: "threads_basic,threads_content_publish",
      response_type: "code",
      state,
    }),
  async callback(code) {
    const { appId, appSecret } = config.threads;
    const short = await json(
      "https://graph.threads.net/oauth/access_token",
      form({
        client_id: appId!,
        client_secret: appSecret!,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl("threads"),
        code,
      }),
    );
    const long = await json(
      `https://graph.threads.net/access_token?` +
        new URLSearchParams({ grant_type: "th_exchange_token", client_secret: appSecret!, access_token: short.access_token }),
    );
    const me = await json(
      `${G}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(long.access_token)}`,
    );
    return [
      {
        provider: "threads" as const,
        externalId: me.id,
        name: `@${me.username}`,
        avatarUrl: me.threads_profile_picture_url ?? null,
        accessToken: long.access_token,
        refreshToken: null,
        expiresAt: Date.now() + (long.expires_in ?? 5_184_000) * 1000,
        meta: { username: me.username },
      },
    ];
  },
};

async function container(userId: string, token: string, params: Record<string, string>) {
  const r = await json(`${G}/${userId}/threads`, form({ ...params, access_token: token }));
  return r.id as string;
}

async function waitReady(id: string, token: string) {
  await waitFor(
    async () => {
      const s = await json(`${G}/${id}?fields=status,error_message&access_token=${encodeURIComponent(token)}`);
      if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads : ${s.error_message ?? s.status}`);
      return s.status === "FINISHED";
    },
    { intervalMs: 3_000, what: "traitement Threads" },
  );
}

const itemParams = (m: MediaFile): Record<string, string> =>
  m.kind === "image" ? { media_type: "IMAGE", image_url: m.publicUrl } : { media_type: "VIDEO", video_url: m.publicUrl };

export const threads: Publisher = {
  id: "threads",
  label: "Threads",
  maxText: 500,
  refreshMarginMs: 7 * 24 * 3600_000,
  validate({ text, media }) {
    if (!text.trim() && !media.length) return "Threads : texte ou média requis.";
    if (countChars(text) > 500) return "Threads : 500 caractères maximum.";
    if (media.length > 20) return "Threads : 20 médias maximum.";
    return null;
  },
  async refresh(account) {
    const r = await json(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(account.accessToken!)}`,
    );
    return { accessToken: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
  },
  async publish({ account, text, media }) {
    const uid = account.externalId;
    const token = account.accessToken!;
    let id: string;
    if (media.length === 0) {
      id = await container(uid, token, { media_type: "TEXT", text });
    } else if (media.length === 1) {
      id = await container(uid, token, { ...itemParams(media[0]), text });
    } else {
      const children: string[] = [];
      for (const m of media) {
        const c = await container(uid, token, { ...itemParams(m), is_carousel_item: "true" });
        children.push(c);
      }
      for (const c of children) await waitReady(c, token);
      id = await container(uid, token, { media_type: "CAROUSEL", children: children.join(","), text });
    }
    await waitReady(id, token);
    const pub = await json(`${G}/${uid}/threads_publish`, form({ creation_id: id, access_token: token }));
    const info = await json(`${G}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`).catch(() => ({}));
    return { url: info.permalink };
  },
};
