// Mode "API unifiée" : Zernio (ex-Late, getlate.dev) publie à notre place sur chaque réseau.
// Les comptes se connectent une fois sur zernio.com ; l'app les importe puis publie via
// POST /v1/posts. La programmation, les brouillons et les relances restent gérés ici.
import { config } from "../config.ts";
import type { Account, AccountInput, Provider } from "../db.ts";
import { db } from "../db.ts";
import { json, postJson, request, sleep } from "../http.ts";
import { fileStream, type MediaFile } from "../media.ts";
import type { PublishInput, PublishResult } from "./types.ts";

const TO_ZERNIO: Record<Provider, string> = {
  youtube: "youtube",
  tiktok: "tiktok",
  instagram: "instagram",
  facebook: "facebook",
  threads: "threads",
  x: "twitter",
};
const FROM_ZERNIO: Record<string, Provider> = Object.fromEntries(
  Object.entries(TO_ZERNIO).map(([k, v]) => [v, k as Provider]),
);

export const zernioConfigured = () => !!config.zernio.apiKey;
export const isZernio = (a: Account) => a.meta.via === "zernio";

const api = (path: string) => `${config.zernio.baseUrl}${path}`;
const auth = () => ({ Authorization: `Bearer ${config.zernio.apiKey}` });

/** Importe (ou met à jour) les comptes connectés sur Zernio. */
export async function syncZernioAccounts(): Promise<AccountInput[]> {
  const r = await json(api("/v1/accounts?excludeHidden=true"), { headers: auth() });
  const out: AccountInput[] = [];
  for (const a of r.accounts ?? []) {
    const provider = FROM_ZERNIO[a.platform];
    if (!provider || a.isActive === false) continue;
    out.push({
      provider,
      externalId: `zernio:${a._id}`,
      name: a.username ? `@${String(a.username).replace(/^@/, "")}` : (a.displayName ?? a.platform),
      avatarUrl: a.profilePicture ?? null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      meta: { via: "zernio", zernioId: a._id, needsReconnection: !!a.needsReconnection },
    });
  }
  return out;
}

// Une URL Zernio reste valable 7 jours tant qu'aucun post ne l'utilise (ensuite elle est
// copiée en stockage permanent). On la réutilise donc pendant 6 jours pour tous les réseaux.
const REUSE_MS = 6 * 24 * 3600_000;
const inflight = new Map<string, Promise<string>>();

async function uploadToZernio(m: MediaFile): Promise<string> {
  const row = db.prepare("SELECT zernio_url, zernio_at FROM media WHERE id = ?").get(m.id) as
    | { zernio_url: string | null; zernio_at: number | null }
    | undefined;
  if (row?.zernio_url && row.zernio_at && Date.now() - row.zernio_at < REUSE_MS) return row.zernio_url;

  const pending = inflight.get(m.id);
  if (pending) return pending;
  const p = (async () => {
    const pre = await json(
      api("/v1/media/presign"),
      postJson({ filename: m.filename, contentType: m.mime, size: m.size }, auth()),
    );
    await request(
      pre.uploadUrl,
      {
        method: "PUT",
        headers: { "Content-Type": m.mime, "Content-Length": String(m.size) },
        body: fileStream(m.path),
        duplex: "half",
      } as RequestInit,
      30 * 60_000,
    );
    db.prepare("UPDATE media SET zernio_url = ?, zernio_at = ? WHERE id = ?").run(pre.publicUrl, Date.now(), m.id);
    return pre.publicUrl as string;
  })().finally(() => inflight.delete(m.id));
  inflight.set(m.id, p);
  return p;
}

function platformData(provider: Provider, title: string, text: string): Record<string, unknown> | undefined {
  if (provider === "youtube") {
    return {
      title: (title.trim() || text.split("\n")[0].trim() || "Nouvelle vidéo").slice(0, 100),
      visibility: process.env.YOUTUBE_PRIVACY ?? "public",
      categoryId: process.env.YOUTUBE_CATEGORY_ID ?? "20",
      madeForKids: false,
    };
  }
  if (provider === "tiktok") {
    return {
      privacyLevel: process.env.TIKTOK_PRIVACY ?? "PUBLIC_TO_EVERYONE",
      allowComment: true,
      allowDuet: true,
      allowStitch: true,
      contentPreviewConfirmed: true,
      expressConsentGiven: true,
    };
  }
  return undefined;
}

type ZTarget = { status?: string; platformPostUrl?: string | null; errorMessage?: string };

function targetOf(post: any): ZTarget {
  return (post?.platforms ?? [])[0] ?? {};
}

export async function publishViaZernio({ account, text, title, media }: PublishInput): Promise<PublishResult> {
  const mediaItems = [];
  for (const m of media) mediaItems.push({ type: m.mime === "image/gif" ? "gif" : m.kind, url: await uploadToZernio(m) });

  const created = await json(
    api("/v1/posts"),
    postJson(
      {
        content: text,
        title: title || undefined,
        mediaItems,
        platforms: [
          {
            platform: TO_ZERNIO[account.provider],
            accountId: account.meta.zernioId,
            platformSpecificData: platformData(account.provider, title, text),
          },
        ],
        publishNow: true,
        metadata: { source: "pixels-multiposter" },
      },
      auth(),
    ),
    15 * 60_000,
  );

  const postId = created.post?._id;
  let t = targetOf(created.post);
  // Les vidéos (YouTube, TikTok, Reels) peuvent encore être en traitement : on suit le statut.
  const deadline = Date.now() + 20 * 60_000;
  while (postId && !["published", "failed", "cancelled"].includes(t.status ?? "")) {
    if (Date.now() > deadline) throw new Error("Zernio : publication toujours en cours après 20 min, vérifie sur zernio.com");
    await sleep(10_000);
    t = targetOf((await json(api(`/v1/posts/${postId}`), { headers: auth() })).post);
  }
  if (t.status !== "published") {
    throw new Error(`Zernio : ${t.errorMessage ?? created.error ?? `statut ${t.status ?? "inconnu"}`}`);
  }
  return { url: t.platformPostUrl ?? undefined };
}
