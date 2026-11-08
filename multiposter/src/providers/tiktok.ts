import { callbackUrl, config } from "../config.ts";
import { form, json, postJson, request, waitFor } from "../http.ts";
import { readChunk } from "../media.ts";
import { countChars, images, videos, type OAuthFlow, type Publisher } from "./types.ts";

const API = "https://open.tiktokapis.com/v2";

const token = (params: Record<string, string>) =>
  json(
    `${API}/oauth/token/`,
    form({ ...params, client_key: config.tiktok.clientKey!, client_secret: config.tiktok.clientSecret! }),
  );

export const tiktokFlow: OAuthFlow = {
  id: "tiktok",
  label: "TikTok",
  providers: ["tiktok"],
  configured: () => !!(config.tiktok.clientKey && config.tiktok.clientSecret),
  authorizeUrl: (state) =>
    "https://www.tiktok.com/v2/auth/authorize/?" +
    new URLSearchParams({
      client_key: config.tiktok.clientKey!,
      scope: "user.info.basic,video.publish,video.list",
      response_type: "code",
      redirect_uri: callbackUrl("tiktok"),
      state,
    }),
  async callback(code) {
    const t = await token({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("tiktok") });
    const me = await json(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    const u = me.data.user;
    return [
      {
        provider: "tiktok" as const,
        externalId: u.open_id,
        name: u.display_name,
        avatarUrl: u.avatar_url ?? null,
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: Date.now() + t.expires_in * 1000,
        meta: {},
      },
    ];
  },
};

const MB = 1024 * 1024;

/** Règles TikTok : < 64 Mo en un seul morceau, sinon morceaux de 10 Mo (le dernier absorbe le reste). */
function chunking(size: number) {
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

export const tiktok: Publisher = {
  id: "tiktok",
  label: "TikTok",
  maxText: 2_200,
  refreshMarginMs: 60 * 60_000,
  validate({ text, media }) {
    if (!videos(media).length) return "TikTok n'accepte que les vidéos : ajoute une vidéo ou décoche TikTok.";
    if (videos(media).length > 1 || images(media).length) return "TikTok : une seule vidéo, sans image (choisis-la dans « Médias envoyés »).";
    if (countChars(text) > 2_200) return "TikTok : 2 200 caractères maximum.";
    return null;
  },
  async refresh(account) {
    const t = await token({ grant_type: "refresh_token", refresh_token: account.refreshToken! });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
  },
  async publish({ account, text, media, options }) {
    const v = videos(media)[0];
    const auth = { Authorization: `Bearer ${account.accessToken}` };

    const creator = await json(`${API}/post/publish/creator_info/query/`, postJson({}, auth));
    const allowed: string[] = creator.data.privacy_level_options ?? [];
    const wanted = options.privacy?.includes("_") ? options.privacy : (process.env.TIKTOK_PRIVACY ?? "PUBLIC_TO_EVERYONE");
    // Une app non auditée par TikTok ne peut publier qu'en privé (SELF_ONLY).
    const privacy = allowed.includes(wanted) ? wanted : (allowed[0] ?? "SELF_ONLY");

    const { chunkSize, count } = chunking(v.size);
    const init = await json(
      `${API}/post/publish/video/init/`,
      postJson(
        {
          post_info: {
            title: text,
            privacy_level: privacy,
            disable_comment: options.allowComment === false || !!creator.data.comment_disabled,
            disable_duet: options.allowDuet === false || !!creator.data.duet_disabled,
            disable_stitch: options.allowStitch === false || !!creator.data.stitch_disabled,
            ...(options.coverMs != null ? { video_cover_timestamp_ms: options.coverMs } : {}),
          },
          source_info: { source: "FILE_UPLOAD", video_size: v.size, chunk_size: chunkSize, total_chunk_count: count },
        },
        auth,
      ),
    );
    const { publish_id, upload_url } = init.data;

    for (let i = 0; i < count; i++) {
      const start = i * chunkSize;
      const end = i === count - 1 ? v.size : start + chunkSize;
      const chunk = await readChunk(v.path, start, end - start);
      await request(
        upload_url,
        {
          method: "PUT",
          headers: {
            "Content-Type": v.mime,
            "Content-Length": String(chunk.length),
            "Content-Range": `bytes ${start}-${end - 1}/${v.size}`,
          },
          body: chunk,
        },
        10 * 60_000,
      );
    }

    let postId: string | undefined;
    await waitFor(
      async () => {
        const s = await json(`${API}/post/publish/status/fetch/`, postJson({ publish_id }, auth));
        if (s.data.status === "FAILED") throw new Error(`TikTok : ${s.data.fail_reason ?? "échec"}`);
        postId = s.data.publicaly_available_post_id?.[0];
        return s.data.status === "PUBLISH_COMPLETE" || s.data.status === "SEND_TO_USER_INBOX";
      },
      { what: "traitement TikTok" },
    );
    return { url: postId ? `https://www.tiktok.com/@/video/${postId}` : undefined, id: postId ? String(postId) : undefined };
  },
};
