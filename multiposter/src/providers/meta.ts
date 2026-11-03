// Facebook Pages + Instagram professionnel, via la Graph API et Facebook Login.
import { callbackUrl, config } from "../config.ts";
import { form, json, waitFor } from "../http.ts";
import type { MediaFile } from "../media.ts";
import { countChars, images, videos, type OAuthFlow, type Publisher } from "./types.ts";

const V = "v23.0";
const G = `https://graph.facebook.com/${V}`;

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export const metaFlow: OAuthFlow = {
  id: "meta",
  label: "Facebook + Instagram",
  providers: ["facebook", "instagram"],
  configured: () => !!(config.meta.appId && config.meta.appSecret),
  authorizeUrl: (state) =>
    `https://www.facebook.com/${V}/dialog/oauth?` +
    new URLSearchParams({
      client_id: config.meta.appId!,
      redirect_uri: callbackUrl("meta"),
      state,
      scope: SCOPES,
      response_type: "code",
    }),
  async callback(code) {
    const { appId, appSecret } = config.meta;
    const short = await json(
      `${G}/oauth/access_token?` +
        new URLSearchParams({ client_id: appId!, client_secret: appSecret!, redirect_uri: callbackUrl("meta"), code }),
    );
    // Token utilisateur longue durée → les tokens de Page qui en dérivent n'expirent pas.
    const long = await json(
      `${G}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId!,
          client_secret: appSecret!,
          fb_exchange_token: short.access_token,
        }),
    );
    const pages = await json(
      `${G}/me/accounts?` +
        new URLSearchParams({
          fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
          limit: "100",
          access_token: long.access_token,
        }),
    );
    const out = [];
    for (const p of pages.data ?? []) {
      out.push({
        provider: "facebook" as const,
        externalId: p.id,
        name: p.name,
        avatarUrl: p.picture?.data?.url ?? null,
        accessToken: p.access_token,
        refreshToken: null,
        expiresAt: null,
        meta: {},
      });
      const ig = p.instagram_business_account;
      if (ig) {
        out.push({
          provider: "instagram" as const,
          externalId: ig.id,
          name: `@${ig.username}`,
          avatarUrl: ig.profile_picture_url ?? null,
          accessToken: p.access_token,
          refreshToken: null,
          expiresAt: null,
          meta: { pageId: p.id, username: ig.username },
        });
      }
    }
    if (!out.length) throw new Error("Aucune Page Facebook trouvée (vérifie les permissions accordées).");
    return out;
  },
};

export const facebook: Publisher = {
  id: "facebook",
  label: "Facebook",
  maxText: 63_206,
  validate({ media }) {
    if (videos(media).length > 1) return "Facebook : une seule vidéo par post.";
    if (videos(media).length && images(media).length) return "Facebook : pas de mélange photos + vidéo.";
    return null;
  },
  async publish({ account, text, media }) {
    const page = account.externalId;
    const token = account.accessToken!;
    const vids = videos(media);
    if (vids.length) {
      const r = await json(
        `${G}/${page}/videos`,
        form({ file_url: vids[0].publicUrl, description: text, access_token: token }),
        10 * 60_000,
      );
      return { url: `https://www.facebook.com/${page}/videos/${r.id}` };
    }
    const attached: string[] = [];
    for (const img of images(media)) {
      const r = await json(`${G}/${page}/photos`, form({ url: img.publicUrl, published: "false", access_token: token }));
      attached.push(r.id);
    }
    const body: Record<string, string> = { message: text, access_token: token };
    attached.forEach((id, i) => (body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
    const r = await json(`${G}/${page}/feed`, form(body));
    return { url: `https://www.facebook.com/${r.id}` };
  },
};

async function igContainer(igId: string, token: string, params: Record<string, string>): Promise<string> {
  const r = await json(`${G}/${igId}/media`, form({ ...params, access_token: token }));
  return r.id;
}

async function igWaitReady(containerId: string, token: string) {
  await waitFor(
    async () => {
      const s = await json(`${G}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
        throw new Error(`Instagram a refusé le média : ${s.status ?? s.status_code}`);
      }
      return s.status_code === "FINISHED";
    },
    { what: "traitement Instagram" },
  );
}

function igItemParams(m: MediaFile, carousel: boolean): Record<string, string> {
  if (m.kind === "image") return { image_url: m.publicUrl, ...(carousel ? { is_carousel_item: "true" } : {}) };
  return carousel
    ? { media_type: "VIDEO", video_url: m.publicUrl, is_carousel_item: "true" }
    : { media_type: "REELS", video_url: m.publicUrl };
}

export const instagram: Publisher = {
  id: "instagram",
  label: "Instagram",
  maxText: 2_200,
  validate({ text, media }) {
    if (!media.length) return "Instagram : au moins une image ou une vidéo est obligatoire.";
    if (media.length > 10) return "Instagram : 10 médias maximum par carrousel.";
    if (media.some((m) => m.kind === "image" && m.mime !== "image/jpeg"))
      return "Instagram : les images doivent être en JPEG (exporte en JPG depuis Canva).";
    if (countChars(text) > 2_200) return "Instagram : légende limitée à 2 200 caractères.";
    return null;
  },
  async publish({ account, text, media }) {
    const igId = account.externalId;
    const token = account.accessToken!;
    let creationId: string;
    if (media.length === 1) {
      creationId = await igContainer(igId, token, { ...igItemParams(media[0], false), caption: text });
      await igWaitReady(creationId, token);
    } else {
      const children: string[] = [];
      for (const m of media) {
        const id = await igContainer(igId, token, igItemParams(m, true));
        await igWaitReady(id, token);
        children.push(id);
      }
      creationId = await igContainer(igId, token, { media_type: "CAROUSEL", children: children.join(","), caption: text });
      await igWaitReady(creationId, token);
    }
    const pub = await json(`${G}/${igId}/media_publish`, form({ creation_id: creationId, access_token: token }));
    const info = await json(`${G}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`).catch(() => ({}));
    return { url: info.permalink };
  },
};
