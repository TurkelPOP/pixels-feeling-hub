// Espaces personnels : chaque personne a ses propres réseaux, médias, posts, connexion Canva et
// règles. Ce module migre les données de l'ancienne version (partagée) vers le propriétaire, et
// supprime les données d'une personne quand son accès est retiré.
import { db } from "./db.ts";

const columns = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);

export function migrateWorkspaces(ownerId: number): void {
  // Recréer une table avec SQLite impose de couper les clés étrangères le temps de la copie
  // (sinon supprimer l'ancienne table « accounts » effacerait les cibles des posts).
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    if (!columns("accounts").includes("owner_id")) {
      db.exec(`
CREATE TABLE accounts_ws (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, provider TEXT NOT NULL, external_id TEXT NOT NULL,
  name TEXT NOT NULL, avatar_url TEXT, access_token TEXT, refresh_token TEXT, expires_at INTEGER,
  meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, UNIQUE (owner_id, provider, external_id)
);
INSERT INTO accounts_ws (id, owner_id, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, meta, created_at)
  SELECT id, ${Number(ownerId)}, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, meta, created_at FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_ws RENAME TO accounts;`);
    }
    for (const table of ["posts", "media", "oauth_states", "canva_rules"]) {
      if (!columns(table).includes("owner_id")) db.exec(`ALTER TABLE ${table} ADD COLUMN owner_id INTEGER`);
      db.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id IS NULL`).run(ownerId);
    }
    if (!columns("canva_daily_drafts").includes("owner_id")) {
      db.exec(`
CREATE TABLE canva_daily_drafts_ws (
  owner_id INTEGER NOT NULL, design_id TEXT NOT NULL, day TEXT NOT NULL, updated_at INTEGER NOT NULL, post_id INTEGER,
  PRIMARY KEY (owner_id, design_id, day)
);
INSERT INTO canva_daily_drafts_ws SELECT ${Number(ownerId)}, design_id, day, updated_at, post_id FROM canva_daily_drafts;
DROP TABLE canva_daily_drafts;
ALTER TABLE canva_daily_drafts_ws RENAME TO canva_daily_drafts;`);
    }
    db.prepare("UPDATE integrations SET id = ? WHERE id = 'canva'").run(`canva:${ownerId}`);
    db.exec(`
CREATE INDEX IF NOT EXISTS posts_owner ON posts (owner_id);
CREATE INDEX IF NOT EXISTS media_owner ON media (owner_id);
CREATE INDEX IF NOT EXISTS accounts_owner ON accounts (owner_id);`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/** Supprime tout l'espace d'une personne (ses posts, réseaux, Canva, règles). Ses médias sont
 *  ensuite effacés par le nettoyage quotidien, puisque plus aucun post ne les utilise. */
export function removeUserData(userId: number): void {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM posts WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM accounts WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM profiles WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM profile_shares WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM settings WHERE key LIKE ?").run(`user_app:${userId}:%`);
    db.prepare("DELETE FROM hashtag_sets WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM mention_contacts WHERE owner_id = ?").run(userId);
    for (const t of ["time_slots", "caption_templates", "push_subs"]) db.prepare(`DELETE FROM ${t} WHERE owner_id = ?`).run(userId);
    db.prepare("DELETE FROM canva_rules WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM canva_daily_drafts WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM integrations WHERE id IN (?, ?)").run(`canva:${userId}`, `gdrive:${userId}`);
    db.prepare("DELETE FROM oauth_states WHERE owner_id = ?").run(userId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
