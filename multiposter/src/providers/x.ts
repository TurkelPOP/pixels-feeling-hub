import { callbackUrl, config } from "../config.ts";
import { form, json, postJson, request, sleep } from "../http.ts";
import { readChunk, type MediaFile } from "../media.ts";
import { countChars, hasWebm, images, videos, type OAuthFlow, type Publisher } from "./types.ts";

const API = "https://api.x.com/2";
const SCOPES = "tweet.read tweet.write users.read media.write offline.access";
const MAX_CHARS = Number(process.env.X_MAX_CHARS ?? 280);

const basic = () =>
  "Basic " + Buffer.from(`${config.x.clientId}:${config.x.clientSecret}`).toString("base64");

async function token(params: Record<string, string>) {
  const init = form({ ...params, client_id: config.x.clientId! });
  (init.headers as Record<string, string>).Authorization = basic();
  return json(`${API}/oauth2/token`, init);
}

export const xFlow: OAuthFlow = {
  id: "x",
  label: "X",
  providers: ["x"],
  usesPkce: true,
  configured: () => !!(config.x.clientId && config.x.clientSecret),
  authorizeUrl: (state, challenge) =>
    "https://x.com/i/oauth2/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: config.x.clientId!,
      redirect_uri: callbackUrl("x"),
      scope: SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }),
  async callback(code, verifier) {
    const t = await token({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl("x"),
      code_verifier: verifier!,
    });
    const me = await json(`${API}/users/me?user.fields=profile_image_url`, {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    return [
      {
        provider: "x" as const,
        externalId: me.data.id,
        name: `@${me.data.username}`,
        avatarUrl: me.data.profile_image_url ?? null,
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt: Date.now() + t.expires_in * 1000,
        meta: { username: me.data.username },
      },
    ];
  },
};

const CHUNK = 4 * 1024 * 1024;

async function uploadMedia(m: MediaFile, auth: string): Promise<string> {
  const category = m.kind === "video" ? "tweet_video" : m.mime === "image/gif" ? "tweet_gif" : "tweet_image";
  const init = await json(
    `${API}/media/upload/initialize`,
    postJson({ media_type: m.mime, total_bytes: m.size, media_category: category }, { Authorization: auth }),
  );
  const id: string = init.data.id;
  for (let i = 0, off = 0; off < m.size; i++, off += CHUNK) {
    const fd = new FormData();
    fd.append("segment_index", String(i));
    fd.append("media", new Blob([await readChunk(m.path, off, CHUNK)]), "chunk");
    await request(`${API}/media/upload/${id}/append`, { method: "POST", headers: { Authorization: auth }, body: fd });
  }
  let info = (await json(`${API}/media/upload/${id}/finalize`, { method: "POST", headers: { Authorization: auth } }))
    .data?.processing_info;
  const deadline = Date.now() + 10 * 60_000;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    if (Date.now() > deadline) throw new Error("X : délai de traitement vidéo dépassé");
    await sleep((info.check_after_secs ?? 5) * 1000);
    info = (await json(`${API}/media/upload?command=STATUS&media_id=${id}`, { headers: { Authorization: auth } })).data
      ?.processing_info;
  }
  if (info?.state === "failed") throw new Error(`X : média refusé (${info.error?.message ?? "échec du traitement"})`);
  return id;
}

export const x: Publisher = {
  id: "x",
  label: "X",
  maxText: MAX_CHARS,
  refreshMarginMs: 5 * 60_000,
  validate({ text, media }) {
    if (!text.trim() && !media.length) return "X : texte ou média requis.";
    if (hasWebm(media)) return "X n'accepte que les vidéos MP4 ou MOV (cette vidéo est en WebM).";
    if (countChars(text) > MAX_CHARS) return `X : ${MAX_CHARS} caractères maximum.`;
    if (videos(media).length > 1 || (videos(media).length && images(media).length))
      return "X : une seule vidéo, sans images.";
    if (images(media).length > 4) return "X : 4 images maximum.";
    return null;
  },
  async refresh(account) {
    const t = await token({ grant_type: "refresh_token", refresh_token: account.refreshToken! });
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
  },
  async publish({ account, text, media }) {
    const auth = `Bearer ${account.accessToken}`;
    const mediaIds: string[] = [];
    for (const m of media) mediaIds.push(await uploadMedia(m, auth));
    const body: Record<string, unknown> = { text };
    if (mediaIds.length) body.media = { media_ids: mediaIds };
    const r = await json(`${API}/tweets`, postJson(body, { Authorization: auth }));
    const user = (account.meta.username as string) ?? "i";
    return { url: `https://x.com/${user}/status/${r.data.id}`, id: r.data.id };
  },
  async comment({ account, postId, text }) {
    await json(`${API}/tweets`, postJson({ text, reply: { in_reply_to_tweet_id: postId } }, { Authorization: `Bearer ${account.accessToken}` }));
  },
};
