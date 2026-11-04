import { alert, appLink } from "./alerts.ts";
import { db, getAccount, updateTokens, type Account } from "./db.ts";
import { getMediaList } from "./media.ts";
import { publishers } from "./providers/index.ts";

const TICK_MS = 20_000;
let running = false;

export type PostStatus = "draft" | "scheduled" | "publishing" | "done" | "partial" | "failed";

async function freshAccount(account: Account): Promise<Account> {
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

async function publishTarget(targetId: number): Promise<void> {
  // Verrou optimiste : une seule exécution par cible, même en cas de double tick.
  const claimed = db
    .prepare("UPDATE post_targets SET status = 'publishing', attempts = attempts + 1 WHERE id = ? AND status = 'pending'")
    .run(targetId);
  if (claimed.changes === 0) return;

  const t = db
    .prepare(
      `SELECT t.id, t.post_id, t.account_id, t.text_override, p.text, p.title, p.media_ids
       FROM post_targets t JOIN posts p ON p.id = t.post_id WHERE t.id = ?`,
    )
    .get(targetId) as Record<string, any>;

  try {
    const account = getAccount(t.account_id);
    if (!account) throw new Error("Compte déconnecté");
    const pub = publishers[account.provider];
    const text = (t.text_override ?? t.text) as string;
    const media = getMediaList(JSON.parse(t.media_ids));
    const invalid = pub.validate({ text, media });
    if (invalid) throw new Error(invalid);
    const result = await pub.publish({ account: await freshAccount(account), text, title: t.title, media });
    db.prepare(
      "UPDATE post_targets SET status = 'done', external_url = ?, error = NULL, published_at = ? WHERE id = ?",
    ).run(result.url ?? null, Date.now(), targetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[publish] cible ${targetId} :`, msg);
    const acc = getAccount(t.account_id);
    const excerpt = String(t.text_override ?? t.text).split("\n")[0].slice(0, 80);
    void alert(`⚠️ Échec de publication${acc ? ` sur ${publishers[acc.provider].label} (${acc.name})` : ""}\n« ${excerpt} »\n${msg}\n${appLink("queue")}`);
    db.prepare("UPDATE post_targets SET status = 'failed', error = ? WHERE id = ?").run(msg.slice(0, 1000), targetId);
  } finally {
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
}

async function tick() {
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
