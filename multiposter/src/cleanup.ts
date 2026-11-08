// Nettoyage automatique (toutes les heures) :
// - brouillons non modifiés depuis DRAFT_DAYS jours (7) : supprimés, avec leurs médias ;
// - médias des posts publiés (ou en échec) depuis MEDIA_RETENTION_DAYS jours (3) : supprimés ;
// - fichiers envoyés puis abandonnés sans enregistrer le post : supprimés au bout de 12 h.
// Les posts programmés ne perdent jamais leurs médias.
import { readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";

import { config } from "./config.ts";

import { db } from "./db.ts";
import { mediaPath, purgeUnused } from "./media.ts";

const DAY = 86_400_000;
export const RETENTION_DAYS = Number(process.env.MEDIA_RETENTION_DAYS ?? 3);
export const DRAFT_DAYS = Number(process.env.DRAFT_RETENTION_DAYS ?? 7);

export async function cleanupMedia(): Promise<number> {
  // Brouillons oubliés : supprimés (leurs médias deviennent orphelins et partent juste après).
  const oldDrafts = db
    .prepare("SELECT id, media_ids, owner_id FROM posts WHERE status = 'draft' AND updated_at < ?")
    .all(Date.now() - DRAFT_DAYS * DAY) as { id: number; media_ids: string; owner_id: number }[];
  for (const d of oldDrafts) {
    db.prepare("DELETE FROM posts WHERE id = ?").run(d.id);
    await purgeUnused(JSON.parse(d.media_ids), d.owner_id);
  }
  if (oldDrafts.length) console.log(`[nettoyage] ${oldDrafts.length} brouillon(s) de plus de ${DRAFT_DAYS} jours supprimé(s)`);
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
  // Fichiers temporaires (vidéos musique) laissés par un arrêt brutal.
  const tmp = resolve(config.dataDir, "tmp");
  for (const f of await readdir(tmp).catch(() => [] as string[])) {
    const p = resolve(tmp, f);
    const age = Date.now() - ((await stat(p).catch(() => null))?.mtimeMs ?? Date.now());
    if (age > 3_600_000) await unlink(p).catch(() => {});
  }
  return removed;
}

export function startCleanup() {
  const run = () => cleanupMedia().catch((e) => console.error("[nettoyage]", e));
  setTimeout(run, 60_000).unref?.();
  setInterval(run, 3_600_000).unref?.(); // toutes les heures
}
