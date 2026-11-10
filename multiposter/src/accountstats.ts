// Stats de tout le compte : contenus publiés directement dans les applis (hors PTZ Posting) et
// nombre d'abonnés jour par jour. Relevé toutes les 3 h pour chaque compte connecté.
// Ce qui a été publié par l'app est déjà suivi dans post_targets : il n'est pas compté deux fois.
import { db, getAccount, type Account } from "./db.ts";
import { json, postJson } from "./http.ts";
import type { PostStats } from "./providers/types.ts";
import { freshAccount } from "./scheduler.ts";
import { config } from "./config.ts";

db.exec(`CREATE TABLE IF NOT EXISTS external_posts (
  id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, kind TEXT, published_at INTEGER NOT NULL, caption TEXT, permalink TEXT, thumb TEXT,
  stats TEXT, stats_at INTEGER, UNIQUE (account_id, external_id)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS account_daily (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, day TEXT NOT NULL, followers INTEGER,
  PRIMARY KEY (account_id, day)
)`);

const META = "https://graph.facebook.com/v23.0";
const THREADS = "https://graph.threads.net/v1.0";
const H = 3_600_000;
const DAY = 24 * H;
const WINDOW = 90 * DAY;
const enc = encodeURIComponent;
const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());

interface Item { id: string; kind: string; at: number; caption?: string; permalink?: string; thumb?: string; stats?: PostStats; needsInsights?: boolean }

/** Identifiants déjà suivis parce que publiés par l'app (story:a,b et video:x compris). */
function appIds(accountId: number): Set<string> {
  const rows = db.prepare("SELECT external_id FROM post_targets WHERE account_id = ? AND external_id IS NOT NULL").all(accountId) as { external_id: string }[];
  const out = new Set<string>();
  for (const r of rows) for (const id of r.external_id.replace(/^(story|video|publish):/, "").split(",")) out.add(id);
  return out;
}

/** Valeur d'une mesure « insights » (Meta / Threads), une mesure à la fois. */
async function insight(base: string, id: string, metric: string, token: string): Promise<number | undefined> {
  try {
    const r = await json(`${base}/${id}/insights?metric=${metric}&access_token=${enc(token)}`);
    const m = r.data?.[0];
    return num(m?.values?.[0]?.value ?? m?.total_value?.value);
  } catch {
    return undefined;
  }
}

const SOURCES: Record<string, { items(a: Account): Promise<Item[]>; insights?(a: Account, it: Item): Promise<PostStats>; followers(a: Account): Promise<number | undefined> }> = {
  instagram: {
    async items(a) {
      const t = enc(a.accessToken!);
      const out: Item[] = [];
      let url: string | undefined = `${META}/${a.externalId}/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50&access_token=${t}`;
      for (let page = 0; url && page < 4; page++) {
        const r: any = await json(url);
        for (const m of r.data ?? []) {
          const at = Date.parse(m.timestamp);
          if (at < Date.now() - WINDOW) { url = undefined; break; }
          out.push({
            id: m.id, at, caption: m.caption, permalink: m.permalink, thumb: m.thumbnail_url ?? (m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM" ? m.media_url : undefined),
            kind: m.media_product_type === "REELS" || m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carrousel" : "photo",
            stats: { likes: num(m.like_count), comments: num(m.comments_count) }, needsInsights: true,
          });
        }
        url = url && r.paging?.next;
      }
      // Stories en ligne (24 h) : relevées tant qu'elles existent.
      try {
        const s: any = await json(`${META}/${a.externalId}/stories?fields=id,media_type,permalink,thumbnail_url,media_url,timestamp&access_token=${t}`);
        for (const m of s.data ?? []) out.push({ id: m.id, at: Date.parse(m.timestamp), kind: "story", permalink: m.permalink, thumb: m.thumbnail_url ?? m.media_url, needsInsights: true, stats: {} });
      } catch { /* pas de story en cours ou pas d'accès */ }
      return out;
    },
    async insights(a, it) {
      const tok = a.accessToken!;
      if (it.kind === "story") {
        const [views, replies, shares, total] = await Promise.all(["views", "replies", "shares", "total_interactions"].map((m) => insight(META, it.id, m, tok)));
        return { views, comments: replies, shares, likes: total != null ? Math.max(0, total - (replies ?? 0) - (shares ?? 0)) : undefined };
      }
      const [views, shares] = await Promise.all([insight(META, it.id, "views", tok), insight(META, it.id, "shares", tok)]);
      return { ...it.stats, views, shares };
    },
    async followers(a) {
      const r = await json(`${META}/${a.externalId}?fields=followers_count&access_token=${enc(a.accessToken!)}`);
      return num(r.followers_count);
    },
  },

  facebook: {
    async items(a) {
      const t = enc(a.accessToken!);
      const r: any = await json(`${META}/${a.externalId}/published_posts?fields=id,message,created_time,permalink_url,full_picture,attachments{media_type,type,target{id}},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares&limit=50&access_token=${t}`);
      return (r.data ?? []).filter((p: any) => Date.parse(p.created_time) > Date.now() - WINDOW).map((p: any) => {
        const att = p.attachments?.data?.[0];
        const type = String(att?.media_type ?? att?.type ?? "");
        return {
          id: p.id, at: Date.parse(p.created_time), caption: p.message, permalink: p.permalink_url, thumb: p.full_picture,
          kind: /video/.test(type) ? "video" : /album/.test(type) ? "carrousel" : /photo/.test(type) ? "photo" : "texte",
          // Vidéo publiée par l'app : enregistrée sous l'identifiant de la vidéo, pas du post.
          altId: att?.target?.id,
          stats: { likes: num(p.reactions?.summary?.total_count), comments: num(p.comments?.summary?.total_count), shares: num(p.shares?.count ?? 0) },
        } as Item & { altId?: string };
      });
    },
    async followers(a) {
      const r = await json(`${META}/${a.externalId}?fields=followers_count,fan_count&access_token=${enc(a.accessToken!)}`);
      return num(r.followers_count ?? r.fan_count);
    },
  },

  threads: {
    async items(a) {
      const r: any = await json(`${THREADS}/${a.externalId}/threads?fields=id,text,media_type,permalink,timestamp,thumbnail_url,media_url&limit=50&access_token=${enc(a.accessToken!)}`);
      return (r.data ?? []).filter((m: any) => Date.parse(m.timestamp) > Date.now() - WINDOW && m.media_type !== "REPOST_FACADE").map((m: any) => ({
        id: m.id, at: Date.parse(m.timestamp), caption: m.text, permalink: m.permalink, thumb: m.thumbnail_url ?? (m.media_type === "IMAGE" ? m.media_url : undefined),
        kind: m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carrousel" : m.media_type === "IMAGE" ? "photo" : "texte",
        stats: {}, needsInsights: true,
      }));
    },
    async insights(a, it) {
      const tok = a.accessToken!;
      const [views, likes, replies, reposts] = await Promise.all(["views", "likes", "replies", "reposts"].map((m) => insight(THREADS, it.id, m, tok)));
      return { views, likes, comments: replies, shares: reposts };
    },
    async followers(a) {
      const r = await json(`${THREADS}/${a.externalId}/threads_insights?metric=followers_count&access_token=${enc(a.accessToken!)}`);
      return num(r.data?.[0]?.total_value?.value ?? r.data?.[0]?.values?.[0]?.value);
    },
  },

  youtube: {
    async items(a) {
      const auth = { headers: { Authorization: `Bearer ${a.accessToken}` } };
      const ch: any = await json("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", auth);
      const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) return [];
      const pl: any = await json(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${enc(uploads)}`, auth);
      const ids = (pl.items ?? []).map((x: any) => x.contentDetails?.videoId).filter(Boolean);
      if (!ids.length) return [];
      const v: any = await json(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}`, auth);
      return (v.items ?? []).filter((x: any) => Date.parse(x.snippet.publishedAt) > Date.now() - WINDOW).map((x: any) => ({
        id: x.id, at: Date.parse(x.snippet.publishedAt), caption: x.snippet.title, permalink: `https://www.youtube.com/watch?v=${x.id}`,
        thumb: x.snippet.thumbnails?.medium?.url ?? x.snippet.thumbnails?.default?.url, kind: "video",
        stats: { views: num(x.statistics?.viewCount), likes: num(x.statistics?.likeCount), comments: num(x.statistics?.commentCount) },
      }));
    },
    async followers(a) {
      const r: any = await json("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true", { headers: { Authorization: `Bearer ${a.accessToken}` } });
      const s = r.items?.[0]?.statistics;
      return s?.hiddenSubscriberCount ? undefined : num(s?.subscriberCount);
    },
  },

  tiktok: {
    async items(a) {
      const r: any = await json("https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,cover_image_url,share_url,video_description,title,view_count,like_count,comment_count,share_count",
        postJson({ max_count: 20 }, { Authorization: `Bearer ${a.accessToken}` }));
      return (r.data?.videos ?? []).filter((x: any) => x.create_time * 1000 > Date.now() - WINDOW).map((x: any) => ({
        id: String(x.id), at: x.create_time * 1000, caption: x.title || x.video_description, permalink: x.share_url, thumb: x.cover_image_url, kind: "video",
        stats: { views: num(x.view_count), likes: num(x.like_count), comments: num(x.comment_count), shares: num(x.share_count) },
      }));
    },
    async followers(a) {
      // Demande l'autorisation user.info.stats (reconnexion du compte TikTok).
      const r: any = await json("https://open.tiktokapis.com/v2/user/info/?fields=follower_count", { headers: { Authorization: `Bearer ${a.accessToken}` } });
      return num(r.data?.user?.follower_count);
    },
  },
};

/** Plus un contenu est ancien, moins ses stats détaillées sont relevées (économise les appels). */
const insightsEvery = (age: number) => (age < 2 * DAY ? 3 * H : age < 14 * DAY ? 12 * H : 48 * H);

async function syncAccount(acc: Account) {
  const src = SOURCES[acc.provider];
  if (!src || !acc.accessToken) return;
  const a = await freshAccount(acc);
  try {
    const f = await src.followers(a);
    if (f != null) db.prepare("INSERT INTO account_daily (account_id, day, followers) VALUES (?, ?, ?) ON CONFLICT (account_id, day) DO UPDATE SET followers = excluded.followers").run(a.id, today(), f);
  } catch (e) {
    console.error(`[stats compte] abonnés ${acc.provider} ${acc.name} :`, e instanceof Error ? e.message : e);
  }
  let items: (Item & { altId?: string })[];
  try {
    items = await src.items(a);
  } catch (e) {
    return console.error(`[stats compte] contenus ${acc.provider} ${acc.name} :`, e instanceof Error ? e.message : e);
  }
  const mine = appIds(a.id);
  const prev = db.prepare("SELECT stats, stats_at FROM external_posts WHERE account_id = ? AND external_id = ?");
  const save = db.prepare(
    `INSERT INTO external_posts (account_id, external_id, kind, published_at, caption, permalink, thumb, stats, stats_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, external_id) DO UPDATE SET kind = excluded.kind, caption = excluded.caption, permalink = excluded.permalink, thumb = excluded.thumb, stats = excluded.stats, stats_at = excluded.stats_at`,
  );
  let calls = 0;
  for (const it of items) {
    if (mine.has(it.id) || (it.altId && mine.has(it.altId))) continue; // publié par l'app : déjà suivi
    const old = prev.get(a.id, it.id) as { stats: string | null; stats_at: number | null } | undefined;
    let stats: PostStats = { ...(old?.stats ? JSON.parse(old.stats) : {}), ...Object.fromEntries(Object.entries(it.stats ?? {}).filter(([, v]) => v != null)) };
    let at = old?.stats_at ?? null;
    const due = !at || Date.now() - at >= insightsEvery(Date.now() - it.at);
    if (src.insights && it.needsInsights && due && calls < 60) {
      calls++;
      const s = await src.insights(a, it).catch(() => ({}) as PostStats);
      stats = { ...stats, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v != null)) };
    }
    if (due || !old) at = Date.now();
    save.run(a.id, it.id, it.kind, it.at, (it.caption ?? "").slice(0, 300), it.permalink ?? null, it.thumb ?? null, JSON.stringify(stats), at);
  }
}

let syncing = false;
export async function syncAllAccounts() {
  if (syncing) return;
  syncing = true;
  try {
    const accs = db.prepare("SELECT id FROM accounts").all() as { id: number }[];
    for (const { id } of accs) {
      const a = getAccount(id);
      if (a) await syncAccount(a).catch((e) => console.error("[stats compte]", e instanceof Error ? e.message : e));
    }
  } finally {
    syncing = false;
  }
}

export function startAccountStats() {
  setTimeout(() => void syncAllAccounts(), 2 * 60_000).unref?.();
  setInterval(() => void syncAllAccounts(), 3 * H).unref?.();
}

/** Contenus publiés hors de l'app, au format des lignes du tableau de bord. */
export function externalRows(owner: number, from: number, to: number) {
  return db.prepare(
    `SELECT e.id, e.account_id, a.provider, a.name AS account_name, a.avatar_url, e.published_at, e.stats, e.kind, e.caption, e.permalink, e.thumb
     FROM external_posts e JOIN accounts a ON a.id = e.account_id
     WHERE a.owner_id = ? AND e.published_at >= ? AND e.published_at <= ?`,
  ).all(owner, from, to) as { id: number; account_id: number; provider: string; account_name: string; avatar_url: string | null; published_at: number; stats: string | null; kind: string | null; caption: string | null; permalink: string | null; thumb: string | null }[];
}

/** Abonnés jour par jour des comptes d'une personne. */
export function followerRows(owner: number, fromDay: string, toDay: string) {
  return db.prepare(
    `SELECT d.account_id, a.provider, a.name, d.day, d.followers FROM account_daily d JOIN accounts a ON a.id = d.account_id
     WHERE a.owner_id = ? AND d.day >= ? AND d.day <= ? ORDER BY d.day`,
  ).all(owner, fromDay, toDay) as { account_id: number; provider: string; name: string; day: string; followers: number | null }[];
}
