import { alert, appLink } from "./alerts.ts";
import { resolveMentions } from "./mentions.ts";
import { notify } from "./push.ts";
import { db, getAccount, updateTokens, type Account } from "./db.ts";
import { getMediaList } from "./media.ts";
import { publishers } from "./providers/index.ts";
import { effectiveMedia, sanitizeOptions } from "./providers/types.ts";

const TICK_MS = 20_000;
let running = false;

export type PostStatus = "draft" | "scheduled" | "publishing" | "done" | "partial" | "failed";

export async function freshAccount(account: Account): Promise<Account> {
  const pub = publishers[account.provider];
  const margin = pub.refreshMarginMs ?? 5 * 60_000;
  if (!pub.refresh || !account.expiresAt || account.expiresAt - Date.now() > margin) return account;
  const t = await pub.refresh(account);
  updateTokens(account.id, t);
  return getAccount(account.id)!;
}

/** Recalcule le statut global d'un post à partir de ses cibles. */
export function rollupStatus(postId: number): void {
  const rows = db.prepare("SELECT status FROM post_targets WHERE post_id = ?").all(postId) as { status: string }[];
  if (!rows.length) return;
  const s = rows.map((r) => r.status);
  let status: PostStatus;
  if (s.some((x) => x === "pending" || x === "publishing")) return;
  else if (s.every((x) => x === "done")) status = "done";
  else if (s.every((x) => x === "failed")) status = "failed";
  else status = "partial";
  db.prepare("UPDATE posts SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), postId);
}

/** Avancement des publications en cours (en mémoire : perdu au redémarrage, comme la publication). */
const live = new Map<number, { from: number; to: number; at: number; label: string }>();

/** Pourcentage affiché : avance doucement dans l'étape en cours, sans jamais l'atteindre avant qu'elle finisse. */
export function targetProgress(targetId: number): { pct: number; label: string } | null {
  const p = live.get(targetId);
  if (!p) return { pct: 0, label: "En attente" };
  const f = p.from + (p.to - p.from) * (1 - Math.exp(-(Date.now() - p.at) / 20_000));
  return { pct: Math.min(99, Math.floor(f * 100)), label: p.label };
}

async function publishTarget(targetId: number): Promise<void> {
  // Verrou optimiste : une seule exécution par cible, même en cas de double tick.
  const claimed = db
    .prepare("UPDATE post_targets SET status = 'publishing', attempts = attempts + 1 WHERE id = ? AND status = 'pending'")
    .run(targetId);
  if (claimed.changes === 0) return;

  const t = db
    .prepare(
      `SELECT t.id, t.post_id, t.account_id, t.text_override, t.options, p.text, p.title, p.media_ids, p.owner_id, COALESCE(p.author_id, p.owner_id) AS mention_owner
       FROM post_targets t JOIN posts p ON p.id = t.post_id WHERE t.id = ?`,
    )
    .get(targetId) as Record<string, any>;

  const step = (from: number, to: number, label: string) => live.set(targetId, { from, to, at: Date.now(), label });
  step(0, 0.04, "Préparation");
  try {
    const account = getAccount(t.account_id);
    if (!account) throw new Error("Compte déconnecté");
    const pub = publishers[account.provider];
    // Mentions @[Nom] → le bon compte selon le réseau.
    const text = resolveMentions((t.text_override ?? t.text) as string, account.provider, t.mention_owner);
    const options = sanitizeOptions(JSON.parse(t.options || "{}"));
    const media = effectiveMedia(getMediaList(JSON.parse(t.media_ids)), options);
    const invalid = pub.validate({ text, media, options });
    if (invalid) throw new Error(invalid);
    const acc = await freshAccount(account);
    // L'envoi au réseau occupe 4 → 96 % ; le premier commentaire, la fin.
    const progress = (from: number, to: number, label: string) => step(0.04 + from * 0.92, 0.04 + to * 0.92, label);
    const result = await pub.publish({ account: acc, text, title: t.title, media, options, progress });
    // Premier commentaire : le post est déjà en ligne, un échec ici ne doit jamais le republier.
    let note: string | null = null;
    if (options.firstComment && pub.comment && result.id && !result.id.startsWith("story:")) {
      try {
        step(0.96, 1, "1er commentaire");
        await pub.comment({ account: acc, postId: result.id, text: resolveMentions(options.firstComment, account.provider, t.mention_owner) });
      } catch (e) {
        note = `Publié, mais le premier commentaire a échoué : ${e instanceof Error ? e.message : e}. Reconnecte le compte (nouvelles autorisations) puis commente à la main.`;
      }
    }
    // Format publié, gardé pour les stats (les médias, eux, sont supprimés au bout de 3 jours).
    const kind = options.format === "story" ? "story" : !media.length ? "texte" : media.length > 1 ? "carrousel" : media[0].kind === "video" ? "video" : "photo";
    db.prepare(
      "UPDATE post_targets SET status = 'done', external_url = ?, external_id = ?, error = ?, published_at = ?, kind = ? WHERE id = ?",
    ).run(result.url ?? null, result.id ?? null, note, Date.now(), kind, targetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[publish] cible ${targetId} :`, msg);
    const acc = getAccount(t.account_id);
    const excerpt = String(t.text_override ?? t.text).split("\n")[0].slice(0, 80);
    void alert(`⚠️ Échec de publication${acc ? ` sur ${publishers[acc.provider].label} (${acc.name})` : ""}\n« ${excerpt} »\n${msg}\n${appLink("queue")}`);
    db.prepare("UPDATE post_targets SET status = 'failed', error = ? WHERE id = ?").run(msg.slice(0, 1000), targetId);
  } finally {
    live.delete(targetId);
    rollupStatus(t.post_id);
  }
}

/** Publie toutes les cibles d'un post en parallèle (un réseau en échec n'en bloque pas un autre). */
export async function publishPost(postId: number): Promise<void> {
  db.prepare("UPDATE posts SET status = 'publishing', updated_at = ? WHERE id = ?").run(Date.now(), postId);
  const targets = db
    .prepare("SELECT id FROM post_targets WHERE post_id = ? AND status = 'pending'")
    .all(postId) as { id: number }[];
  await Promise.all(targets.map((x) => publishTarget(x.id)));
  rollupStatus(postId);
  if (targets.length) void notifyResult(postId);
}

/** Notification sur les appareils de la personne : publié, ou ce qui a échoué. */
async function notifyResult(postId: number) {
  const p = db.prepare("SELECT owner_id, text, status FROM posts WHERE id = ?").get(postId) as { owner_id: number; text: string; status: string } | undefined;
  if (!p || !["done", "partial", "failed"].includes(p.status)) return;
  const rows = db.prepare(
    `SELECT a.provider, t.status FROM post_targets t JOIN accounts a ON a.id = t.account_id WHERE t.post_id = ?`,
  ).all(postId) as { provider: string; status: string }[];
  const label = (s: string) => [...new Set(rows.filter((r) => r.status === s).map((r) => (publishers as Record<string, { label: string }>)[r.provider]?.label ?? r.provider))].join(", ");
  const excerpt = (p.text.split("\n")[0] || "Post sans texte").slice(0, 60);
  await notify(p.owner_id, p.status === "done"
    ? { title: `✅ Publié sur ${label("done")}`, body: excerpt, url: "/#queue", tag: `post-${postId}` }
    : { title: `⚠️ Échec sur ${label("failed")}`, body: `${excerpt}${label("done") ? ` · publié sur ${label("done")}` : ""}`, url: "/#queue", tag: `post-${postId}` });
}

export async function tick() {
  if (running) return;
  running = true;
  try {
    const due = db
      .prepare("SELECT id FROM posts WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at")
      .all(Date.now()) as { id: number }[];
    for (const p of due) await publishPost(p.id);
  } catch (e) {
    console.error("[scheduler]", e);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  // Une publication interrompue par un redémarrage n'est pas relancée automatiquement :
  // elle a pu partir côté réseau, on évite donc le doublon et on laisse "Réessayer" à l'humain.
  const stuck = db
    .prepare(
      "UPDATE post_targets SET status = 'failed', error = 'Interrompu par un redémarrage : vérifie le réseau avant de réessayer.' WHERE status = 'publishing' RETURNING post_id",
    )
    .all() as { post_id: number }[];
  for (const id of new Set(stuck.map((s) => s.post_id))) rollupStatus(id);
  db.prepare(
    "UPDATE posts SET status = 'scheduled' WHERE status = 'publishing' AND id IN (SELECT post_id FROM post_targets WHERE status = 'pending')",
  ).run();

  setInterval(tick, TICK_MS).unref?.();
  void tick();
}
