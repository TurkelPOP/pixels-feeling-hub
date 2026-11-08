// Statistiques des posts publiés : vues, j'aime, commentaires, partages, récupérés chez chaque
// réseau pendant les 14 jours qui suivent la publication (toutes les 3 h), ou à la demande.
// Chaque réseau ne donne pas tout : ce qui manque n'est simplement pas affiché.
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db, getAccount, type Account } from "./db.ts";
import { json, postJson } from "./http.ts";
import type { PostStats } from "./providers/types.ts";
import { freshAccount } from "./scheduler.ts";

const META = "https://graph.facebook.com/v23.0";
const THREADS = "https://graph.threads.net/v1.0";
const enc = encodeURIComponent;
const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export const FETCHERS: Record<string, (a: Account, id: string) => Promise<PostStats>> = {
  async instagram(a, id) {
    const t = enc(a.accessToken!);
    const base = await json(`${META}/${id}?fields=like_count,comments_count&access_token=${t}`);
    const out: PostStats = { likes: num(base.like_count), comments: num(base.comments_count) };
    // Vues et partages : demande l'autorisation « insights » (reconnexion) ; sinon on s'en passe.
    try {
      const ins = await json(`${META}/${id}/insights?metric=views,shares&access_token=${t}`);
      for (const m of ins.data ?? []) {
        if (m.name === "views") out.views = num(m.values?.[0]?.value ?? m.total_value?.value);
        if (m.name === "shares") out.shares = num(m.values?.[0]?.value ?? m.total_value?.value);
      }
    } catch { /* pas d'accès aux statistiques détaillées */ }
    return out;
  },
  async facebook(a, id) {
    const r = await json(`${META}/${id}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares&access_token=${enc(a.accessToken!)}`);
    return { likes: num(r.reactions?.summary?.total_count), comments: num(r.comments?.summary?.total_count), shares: num(r.shares?.count ?? 0) };
  },
  async threads(a, id) {
    const r = await json(`${THREADS}/${id}/insights?metric=views,likes,replies,reposts&access_token=${enc(a.accessToken!)}`);
    const get = (n: string) => { const m = (r.data ?? []).find((x: any) => x.name === n); return num(m?.values?.[0]?.value ?? m?.total_value?.value); };
    return { views: get("views"), likes: get("likes"), comments: get("replies"), shares: get("reposts") };
  },
  async x(a, id) {
    const r = await json(`https://api.x.com/2/tweets/${enc(id)}?tweet.fields=public_metrics`, { headers: { Authorization: `Bearer ${a.accessToken}` } });
    const m = r.data?.public_metrics ?? {};
    return { views: num(m.impression_count), likes: num(m.like_count), comments: num(m.reply_count), shares: num((m.retweet_count ?? 0) + (m.quote_count ?? 0)) };
  },
  async youtube(a, id) {
    const r = await json(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${enc(id)}`, { headers: { Authorization: `Bearer ${a.accessToken}` } });
    const s = r.items?.[0]?.statistics ?? {};
    return { views: num(s.viewCount), likes: num(s.likeCount), comments: num(s.commentCount) };
  },
  async tiktok(a, id) {
    const r = await json("https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count",
      postJson({ filters: { video_ids: [id] } }, { Authorization: `Bearer ${a.accessToken}` }));
    const v = r.data?.videos?.[0] ?? {};
    return { views: num(v.view_count), likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count) };
  },
};

/** Met à jour les chiffres d'une cible publiée. */
async function refreshTarget(t: { id: number; account_id: number; external_id: string }) {
  const acc = getAccount(t.account_id);
  const fetcher = acc && FETCHERS[acc.provider];
  if (!acc || !fetcher) return;
  try {
    const s = await fetcher(await freshAccount(acc), t.external_id);
    db.prepare("UPDATE post_targets SET stats = ?, stats_at = ? WHERE id = ?").run(JSON.stringify(s), Date.now(), t.id);
  } catch (e) {
    // On note la tentative pour ne pas réessayer en boucle ; l'erreur n'est pas affichée (pas grave).
    db.prepare("UPDATE post_targets SET stats_at = ? WHERE id = ?").run(Date.now(), t.id);
    console.error(`[statistiques] cible ${t.id} :`, e instanceof Error ? e.message : e);
  }
}

const WINDOW = 14 * 86_400_000;
const EVERY = 3 * 3_600_000;

/** Collecte régulière : posts publiés depuis moins de 14 jours, au plus toutes les 3 h. */
export async function collectStats() {
  const due = db.prepare(
    `SELECT id, account_id, external_id FROM post_targets
     WHERE status = 'done' AND external_id IS NOT NULL AND published_at > ? AND COALESCE(stats_at, 0) < ? LIMIT 40`,
  ).all(Date.now() - WINDOW, Date.now() - EVERY) as { id: number; account_id: number; external_id: string }[];
  for (const t of due) await refreshTarget(t);
}

export function startStats() {
  setTimeout(() => void collectStats().catch(() => {}), 3 * 60_000).unref?.();
  setInterval(() => void collectStats().catch(() => {}), 30 * 60_000).unref?.();
}

export function registerStatsApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;
  /** Actualiser les chiffres d'un post (au plus toutes les 10 minutes). */
  api.post("/posts/:id/stats", async (c) => {
    const id = Number(c.req.param("id"));
    const own = db.prepare("SELECT id FROM posts WHERE id = ? AND owner_id = ?").get(id, uid(c));
    if (!own) return c.json({ error: "Post introuvable" }, 404);
    const targets = db.prepare(
      "SELECT id, account_id, external_id, stats_at FROM post_targets WHERE post_id = ? AND status = 'done' AND external_id IS NOT NULL",
    ).all(id) as { id: number; account_id: number; external_id: string; stats_at: number | null }[];
    for (const t of targets) if (!t.stats_at || Date.now() - t.stats_at > 10 * 60_000) await refreshTarget(t);
    return c.json({ ok: true });
  });

  /** Meilleurs posts sur une période (somme des interactions, tous réseaux). */
  api.get("/stats/top", (c) => {
    const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30)));
    const rows = db.prepare(
      `SELECT p.id, p.text, p.title, p.source, MAX(t.published_at) AS at, a.provider, t.stats
       FROM posts p JOIN post_targets t ON t.post_id = p.id JOIN accounts a ON a.id = t.account_id
       WHERE p.owner_id = ? AND t.status = 'done' AND t.stats IS NOT NULL AND t.published_at > ?
       GROUP BY t.id`,
    ).all(uid(c), Date.now() - days * 86_400_000) as { id: number; text: string; title: string; source: string | null; at: number; provider: string; stats: string }[];
    const byPost = new Map<number, { id: number; label: string; at: number; views: number; likes: number; comments: number; shares: number; providers: string[] }>();
    for (const r of rows) {
      const s = JSON.parse(r.stats) as PostStats;
      const e = byPost.get(r.id) ?? { id: r.id, label: (r.title || r.source || r.text.split("\n")[0] || "(sans texte)").slice(0, 80), at: r.at, views: 0, likes: 0, comments: 0, shares: 0, providers: [] };
      e.views += s.views ?? 0; e.likes += s.likes ?? 0; e.comments += s.comments ?? 0; e.shares += s.shares ?? 0;
      e.providers.push(r.provider);
      e.at = Math.max(e.at, r.at);
      byPost.set(r.id, e);
    }
    const list = [...byPost.values()].sort((a, b) => (b.likes + b.comments * 2 + b.shares * 3) - (a.likes + a.comments * 2 + a.shares * 3));
    const total = list.reduce((t, p) => ({ views: t.views + p.views, likes: t.likes + p.likes, comments: t.comments + p.comments, shares: t.shares + p.shares, posts: t.posts + 1 }), { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 });
    return c.json({ days, total, top: list.slice(0, 10) });
  });
}
