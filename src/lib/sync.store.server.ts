// Stockage serveur de la synchronisation : un fichier SQLite (module intégré à Node, aucun service externe).
// L'interface `SyncStore` est volontairement minimale pour pouvoir passer à PostgreSQL plus tard.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { clampFuture, emptyPayload, mergeSync, syncPayloadSchema, type SyncPayload } from "./sync.merge";

export interface SyncStore {
  /** Fusionne l'état reçu avec l'état stocké (le plus récent gagne), l'enregistre et le renvoie. */
  exchange(userId: string, incoming: SyncPayload): SyncPayload;
  /** Supprime toutes les données d'un utilisateur. */
  remove(userId: string): void;
  close(): void;
}

export async function createSqliteStore(path: string): Promise<SyncStore> {
  const { DatabaseSync } = await import("node:sqlite");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const select = db.prepare("SELECT data FROM sync WHERE user_id = ?");
  const upsert = db.prepare(
    "INSERT INTO sync (user_id, data, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
  );
  const deleteRow = db.prepare("DELETE FROM sync WHERE user_id = ?");

  return {
    // Lecture, fusion et écriture sans `await` entre elles : pas d'entrelacement possible entre deux requêtes.
    exchange(userId, incoming) {
      let stored = emptyPayload();
      const row = select.get(userId) as { data: string } | undefined;
      if (row) {
        try {
          const parsed = syncPayloadSchema.safeParse(JSON.parse(row.data));
          if (parsed.success) stored = parsed.data;
        } catch {
          // Ligne illisible : on repart de l'état reçu plutôt que de bloquer la synchronisation.
        }
      }
      const merged = mergeSync(stored, clampFuture(incoming));
      upsert.run(userId, JSON.stringify(merged), Date.now());
      return merged;
    },
    remove(userId) {
      deleteRow.run(userId);
    },
    close() {
      db.close();
    },
  };
}

let shared: Promise<SyncStore | null> | undefined;

/** Le store du processus, ou null si la base ne s'ouvre pas (hébergeur sans `node:sqlite`, disque en lecture seule…). */
export function getSyncStore(): Promise<SyncStore | null> {
  shared ??= createSqliteStore(process.env.SYNC_DB_PATH || "./data/sync.sqlite").catch((error) => {
    console.error("[sync] database unavailable, synchronisation désactivée", error);
    return null;
  });
  return shared;
}
