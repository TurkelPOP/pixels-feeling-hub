// Statistiques des posts publiés : vues, j'aime, commentaires, partages, récupérés chez chaque
// réseau pendant les 90 jours qui suivent la publication (souvent au début, puis espacé), ou à la demande.
// Chaque relevé est gardé (historique) ; /stats/overview alimente l'onglet Stats.
// Chaque réseau ne donne pas tout : ce qui manque n'est simplement pas affiché.
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { config } from "./config.ts";
import { db, getAccount, type Account } from "./db.ts";
import { getMediaList } from "./media.ts";
import { json, postJson } from "./http.ts";
import type { PostStats } from "./providers/types.ts";
import { freshAccount } from "./scheduler.ts";

const META = "https://graph.facebook.com/v23.0";
const THREADS = "https://graph.threads.net/v1.0";
const enc = encodeURIComponent;
const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

// Historique : un relevé par passage, pour suivre la vie d'un post (vues sur ses premiers jours…).
db.exec(`CREATE TABLE IF NOT EXISTS stats_history (
  target_id INTEGER NOT NULL REFERENCES post_targets(id) ON DELETE CASCADE, at INTEGER NOT NULL,
  views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER
)`);
db.exec("CREATE INDEX IF NOT EXISTS stats_history_target ON stats_history (target_id, at)");

export const FETCHERS: Record<string, (a: Account, id: string) => Promise<PostStats>> = {
  async instagram(a, id) {
    const t = enc(a.accessToken!);
    // Stories : statistiques à part (vues, réponses, partages), disponibles environ 24 h après la fin.
    if (id.startsWith("story:")) {
      const out: PostStats = { views: 0, likes: 0, comments: 0, shares: 0 };
      for (const sid of id.slice(6).split(",").filter(Boolean)) {
        const vals: Record<string, number> = {};
        for (const metric of ["views", "replies", "shares", "total_interactions"]) {
          try {
            const ins = await json(`${META}/${sid}/insights?metric=${metric}&access_token=${t}`);
            const m = ins.data?.[0];
            vals[metric] = num(m?.values?.[0]?.value ?? m?.total_value?.value) ?? 0;
          } catch { /* story expirée ou mesure indisponible */ }
        }
        const get = (n: string) => vals[n] ?? 0;
        out.views! += get("views");
        out.comments! += get("replies");
        out.shares! += get("shares");
        // Interactions = réponses + partages + autres réactions (j'aime de story…).
        out.likes! += Math.max(0, get("total_interactions") - get("replies") - get("shares"));
      }
      return out;
    }
    const base = await json(`${META}/${id}?fields=like_count,comments_count&access_token=${t}`);
    const out: PostStats = { likes: num(base.like_count), comments: num(base.comments_count) };
    // Vues et partages : demande l'autorisation « insights » (reconnexion) ; sinon on s'en passe.
    // Une mesure à la fois : selon le format (carrousel, Reel, photo), Instagram n'accepte pas toutes les mesures.
    for (const metric of ["views", "shares"] as const) {
      try {
        const ins = await json(`${META}/${id}/insights?metric=${metric}&access_token=${t}`);
        const m = ins.data?.[0];
        out[metric] = num(m?.values?.[0]?.value ?? m?.total_value?.value);
      } catch { /* pas d'accès à cette mesure pour ce format */ }
    }
    return out;
  },
  async facebook(a, id) {
    const t = enc(a.accessToken!);
    const video = async (vid: string): Promise<PostStats> => {
      const r = await json(`${META}/${vid}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&access_token=${t}`);
      const out: PostStats = { likes: num(r.reactions?.summary?.total_count), comments: num(r.comments?.summary?.total_count) };
      try {
        const ins = await json(`${META}/${vid}/video_insights?metric=total_video_views&period=lifetime&access_token=${t}`);
        out.views = num(ins.data?.[0]?.values?.[0]?.value);
      } catch { /* vues : autorisation « statistiques » de la Page nécessaire */ }
      return out;
    };
    if (id.startsWith("video:")) return video(id.slice(6));
    try {
      const r = await json(`${META}/${id}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares&access_token=${t}`);
      return { likes: num(r.reactions?.summary?.total_count), comments: num(r.comments?.summary?.total_count), shares: num(r.shares?.count ?? 0) };
    } catch (e) {
      // Vidéos publiées avant la 1.2.2 : enregistrées sans « video: ».
      if (!/^\d+$/.test(id)) throw e;
      return video(id);
    }
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
    if (id.startsWith("publish:")) {
      // Vidéo pas encore publique au moment de la publication : on retrouve son identifiant.
      const s = await json(`https://open.tiktokapis.com/v2/post/publish/status/fetch/`, postJson({ publish_id: id.slice(8) }, { Authorization: `Bearer ${a.accessToken}` }));
      const vid = s.data?.publicaly_available_post_id?.[0];
      if (!vid) return {};
      id = String(vid);
    }
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
    db.prepare("INSERT INTO stats_history (target_id, at, views, likes, comments, shares) VALUES (?, ?, ?, ?, ?, ?)").run(
      t.id, Date.now(), s.views ?? null, s.likes ?? null, s.comments ?? null, s.shares ?? null,
    );
  } catch (e) {
    // On note la tentative pour ne pas réessayer en boucle ; l'erreur n'est pas affichée (pas grave).
    db.prepare("UPDATE post_targets SET stats_at = ? WHERE id = ?").run(Date.now(), t.id);
    console.error(`[statistiques] cible ${t.id} :`, e instanceof Error ? e.message : e);
  }
}

const H = 3_600_000;
const WINDOW = 90 * 24 * H;
/** Plus le post est ancien, moins on relève souvent : 3 h les 2 premiers jours, 12 h jusqu'à 14 jours, puis 2 jours. */
const everyFor = (age: number) => (age < 48 * H ? 3 * H : age < 14 * 24 * H ? 12 * H : 48 * H);

/** Collecte régulière : posts publiés depuis moins de 90 jours. */
export async function collectStats() {
  const now = Date.now();
  const rows = db.prepare(
    `SELECT id, account_id, external_id, published_at, stats_at FROM post_targets
     WHERE status = 'done' AND external_id IS NOT NULL AND published_at > ? AND COALESCE(stats_at, 0) < ?
     ORDER BY COALESCE(stats_at, 0) LIMIT 300`,
  ).all(now - WINDOW, now - 3 * H) as { id: number; account_id: number; external_id: string; published_at: number; stats_at: number | null }[];
  const due = rows.filter((t) => now - (t.stats_at ?? 0) >= everyFor(now - t.published_at)).slice(0, 40);
  for (const t of due) await refreshTarget(t);
}

// ---------- Tableau de bord ----------

const DAY = 24 * H;
const dayKey = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const localParts = (t: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(t).map((x) => [x.type, x.value]));
  return { wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday), hour: Number(p.hour) % 24 };
};

interface Row { id: number; post_id: number; provider: string; account_name: string; avatar_url: string | null; published_at: number; stats: string | null; kind: string | null;
  media_ids: string; text: string; title: string; source: string | null; external_url: string | null; options: string | null }
type Totals = { posts: number; views: number; likes: number; comments: number; shares: number; interactions: number; engagement: number | null };

function totals(rows: Row[]): Totals {
  const t = { posts: new Set(rows.map((r) => r.post_id)).size, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0, engagement: null as number | null };
  let viewsWithEng = 0, interWithViews = 0;
  for (const r of rows) {
    const s: PostStats = r.stats ? JSON.parse(r.stats) : {};
    const inter = (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0);
    t.views += s.views ?? 0; t.likes += s.likes ?? 0; t.comments += s.comments ?? 0; t.shares += s.shares ?? 0; t.interactions += inter;
    // Engagement = interactions / vues, seulement là où le réseau donne les vues.
    if (s.views) { viewsWithEng += s.views; interWithViews += inter; }
  }
  t.engagement = viewsWithEng ? Math.round((interWithViews / viewsWithEng) * 1000) / 10 : null;
  return t;
}

/** Format d'une publication : enregistré à la publication, sinon deviné d'après ses médias. */
function kindOf(r: Row): string {
  if (r.kind) return r.kind;
  const o = r.options ? JSON.parse(r.options) : {};
  if (o.format === "story") return "story";
  const ids: string[] = o.media ?? JSON.parse(r.media_ids);
  if (!ids.length) return "texte";
  if (ids.length > 1) return "carrousel";
  const m = getMediaList(ids)[0];
  return m ? (m.kind === "video" ? "video" : "photo") : "photo";
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

  /**
   * Tableau de bord d'une période (from → to, en ms) comparée à la période précédente de même durée.
   * Filtres : réseaux (providers=a,b), profil, format. Les posts sont comptés au jour de leur publication.
   */
  api.get("/stats/overview", (c) => {
    const owner = uid(c);
    const to = Math.min(Date.now(), Number(c.req.query("to")) || Date.now());
    const from = Math.max(to - 3 * 365 * DAY, Number(c.req.query("from")) || to - 30 * DAY);
    const len = Math.max(DAY, to - from);
    const providers = new Set((c.req.query("providers") ?? "").split(",").filter(Boolean));
    const format = c.req.query("format") ?? "";
    const profile = Number(c.req.query("profile")) || 0;
    const profileAccs = profile
      ? new Set((db.prepare("SELECT pa.account_id AS id FROM profile_accounts pa JOIN profiles p ON p.id = pa.profile_id WHERE p.id = ? AND p.owner_id = ?").all(profile, owner) as { id: number }[]).map((r) => r.id))
      : null;
    const all = db.prepare(
      `SELECT t.id, t.post_id, a.provider, a.name AS account_name, a.avatar_url, a.id AS account_id, t.published_at, t.stats, t.kind, t.external_url, t.options,
              p.media_ids, p.text, p.title, p.source
       FROM post_targets t JOIN posts p ON p.id = t.post_id JOIN accounts a ON a.id = t.account_id
       WHERE p.owner_id = ? AND t.status = 'done' AND t.published_at >= ? AND t.published_at <= ?`,
    ).all(owner, from - len, to) as unknown as (Row & { account_id: number })[];
    const rows = all.filter((r) => (!providers.size || providers.has(r.provider)) && (!profileAccs || profileAccs.has(r.account_id)) && (!format || kindOf(r) === format));
    const cur = rows.filter((r) => r.published_at >= from);
    const prev = rows.filter((r) => r.published_at < from);

    // Courbe : par jour (≤ 92 jours), par semaine (≤ 1 an), sinon par mois.
    const step = len <= 92 * DAY ? "day" : len <= 400 * DAY ? "week" : "month";
    const bucketOf = (t: number) => {
      const k = dayKey(t);
      if (step === "day") return k;
      if (step === "month") return k.slice(0, 7);
      const d = new Date(`${k}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // lundi de la semaine
      return d.toISOString().slice(0, 10);
    };
    const buckets: string[] = [];
    for (let t = from; t <= to + DAY; t += DAY) { const b = bucketOf(Math.min(t, to)); if (!buckets.includes(b)) buckets.push(b); }
    const nets = [...new Set(cur.map((r) => r.provider))].sort();
    const series = Object.fromEntries(nets.map((n) => [n, buckets.map(() => ({ views: 0, interactions: 0, posts: 0 }))]));
    for (const r of cur) {
      const i = buckets.indexOf(bucketOf(r.published_at));
      if (i < 0) continue;
      const s: PostStats = r.stats ? JSON.parse(r.stats) : {};
      const e = series[r.provider][i];
      e.views += s.views ?? 0; e.interactions += (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0); e.posts++;
    }

    const byProvider = [...new Set([...cur, ...prev].map((r) => r.provider))].map((p) => ({
      provider: p, cur: totals(cur.filter((r) => r.provider === p)), prev: totals(prev.filter((r) => r.provider === p)),
    }));
    const byFormat = [...new Set(cur.map(kindOf))].map((k) => {
      const list = cur.filter((r) => kindOf(r) === k);
      const t = totals(list);
      return { format: k, count: list.length, avgInteractions: list.length ? Math.round(t.interactions / list.length) : 0, avgViews: list.length ? Math.round(t.views / list.length) : 0 };
    });

    // Meilleurs créneaux : interactions moyennes par jour de la semaine × heure de publication.
    const heat = new Map<string, { n: number; sum: number }>();
    for (const r of cur) {
      const { wd, hour } = localParts(r.published_at);
      const s: PostStats = r.stats ? JSON.parse(r.stats) : {};
      const k = `${wd}:${hour}`;
      const e = heat.get(k) ?? { n: 0, sum: 0 };
      e.n++; e.sum += (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0);
      heat.set(k, e);
    }
    const heatmap = [...heat.entries()].map(([k, v]) => { const [wd, hour] = k.split(":").map(Number); return { wd, hour, posts: v.n, avg: Math.round(v.sum / v.n) }; });

    // Classement des posts (tous réseaux additionnés).
    const posts = new Map<number, any>();
    for (const r of cur) {
      const s: PostStats = r.stats ? JSON.parse(r.stats) : {};
      const e = posts.get(r.post_id) ?? {
        id: r.post_id, label: (r.title || r.text.split("\n")[0] || r.source || "(sans texte)").slice(0, 90), at: r.published_at, kind: kindOf(r),
        thumb: getMediaList(JSON.parse(r.media_ids))[0]?.localUrl ?? null, targets: [], views: 0, likes: 0, comments: 0, shares: 0,
      };
      e.targets.push({ provider: r.provider, account: r.account_name, url: r.external_url, stats: s });
      e.views += s.views ?? 0; e.likes += s.likes ?? 0; e.comments += s.comments ?? 0; e.shares += s.shares ?? 0;
      e.at = Math.min(e.at, r.published_at);
      posts.set(r.post_id, e);
    }
    const ranking = [...posts.values()].map((p) => ({ ...p, interactions: p.likes + p.comments + p.shares, engagement: p.views ? Math.round(((p.likes + p.comments + p.shares) / p.views) * 1000) / 10 : null }))
      .sort((a, b) => b.interactions - a.interactions || b.views - a.views).slice(0, 100);

    return c.json({ from, to, step, buckets, series, total: totals(cur), previous: totals(prev), byProvider, byFormat, heatmap, ranking });
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
