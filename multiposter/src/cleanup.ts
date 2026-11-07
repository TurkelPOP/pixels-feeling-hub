// Nettoyage quotidien des médias : fichiers envoyés puis jamais utilisés, et médias des posts
// publiés depuis longtemps. Les brouillons et posts programmés ne perdent jamais leurs médias.
import { unlink } from "node:fs/promises";

import { db } from "./db.ts";
import { mediaPath } from "./media.ts";

const DAY = 86_400_000;
const RETENTION_DAYS = Number(process.env.MEDIA_RETENTION_DAYS ?? 90);

export async function cleanupMedia(): Promise<number> {
  const rows = db.prepare("SELECT id, mime, created_at FROM media").all() as { id: string; mime: string; created_at: number }[];
  const posts = db.prepare("SELECT media_ids, status, updated_at FROM posts").all() as {
    media_ids: string;
    status: string;
    updated_at: number;
  }[];

  const keep = new Set<string>();
  const usedByOldDone = new Set<string>();
  const cutoff = Date.now() - RETENTION_DAYS * DAY;
  for (const p of posts) {
    const ids: string[] = JSON.parse(p.media_ids);
    const finished = p.status === "done" || p.status === "partial" || p.status === "failed";
    for (const id of ids) (finished && p.updated_at < cutoff ? usedByOldDone : keep).add(id);
  }

  let removed = 0;
  for (const m of rows) {
    if (keep.has(m.id)) continue;
    const orphan = !usedByOldDone.has(m.id);
    // Fichier envoyé puis abandonné (onglet fermé sans enregistrer) : il peut encore être dans un
    // éditeur ouvert, on attend 12 h avant de le supprimer.
    if (orphan && m.created_at > Date.now() - 12 * 3_600_000) continue;
    await unlink(mediaPath(m.id, m.mime)).catch(() => {});
    db.prepare("DELETE FROM media WHERE id = ?").run(m.id);
    removed++;
  }
  if (removed) console.log(`[nettoyage] ${removed} média(s) supprimé(s)`);
  return removed;
}

export function startCleanup() {
  const run = () => cleanupMedia().catch((e) => console.error("[nettoyage]", e));
  setTimeout(run, 60_000).unref?.();
  setInterval(run, 3_600_000).unref?.(); // toutes les heures
}
