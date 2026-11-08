import { existsSync, mkdirSync, renameSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";

export const DB_PATH = resolve(config.dataDir, "multiposter.db");

// Restauration demandée depuis l'app : appliquée ici, au démarrage, avant d'ouvrir la base.
// La base actuelle est gardée de côté (backups/avant-restauration-…), jamais effacée.
{
  const pending = resolve(config.dataDir, "restore-pending.db");
  if (existsSync(pending)) {
    const dir = resolve(config.dataDir, "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (existsSync(DB_PATH)) renameSync(DB_PATH, resolve(dir, `avant-restauration-${stamp}.db`));
    for (const ext of ["-wal", "-shm"]) if (existsSync(DB_PATH + ext)) renameSync(DB_PATH + ext, resolve(dir, `avant-restauration-${stamp}.db${ext}`));
    renameSync(pending, DB_PATH);
    console.log("[sauvegarde] restauration appliquée");
  }
}

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY,
  owner_id      INTEGER NOT NULL,
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    INTEGER,
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  UNIQUE (owner_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY,
  text          TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  media_ids     TEXT NOT NULL DEFAULT '[]',
  scheduled_at  INTEGER,
  status        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS post_targets (
  id            INTEGER PRIMARY KEY,
  post_id       INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  text_override TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  external_url  TEXT,
  error         TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  published_at  INTEGER,
  UNIQUE (post_id, account_id)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  verifier    TEXT,
  created_at  INTEGER NOT NULL
);
`);

// Migrations légères (colonnes ajoutées après la première version).
for (const sql of [
  "ALTER TABLE posts ADD COLUMN source TEXT",
  "ALTER TABLE post_targets ADD COLUMN options TEXT",
  // Statistiques : identifiant du post chez le réseau, derniers chiffres et leur date.
  "ALTER TABLE post_targets ADD COLUMN external_id TEXT",
  "ALTER TABLE post_targets ADD COLUMN stats TEXT",
  "ALTER TABLE post_targets ADD COLUMN stats_at INTEGER",
  // Post proposé par une autre personne (profil partagé) : son auteur. NULL = le propriétaire.
  "ALTER TABLE posts ADD COLUMN author_id INTEGER",
]) {
  try {
    db.exec(sql);
  } catch {
    /* colonne déjà présente */
  }
}

export type Provider = "youtube" | "tiktok" | "instagram" | "facebook" | "threads" | "x";

export interface Account {
  id: number;
  /** Personne à qui appartient ce compte (espace personnel). */
  ownerId: number;
  provider: Provider;
  externalId: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  meta: Record<string, unknown>;
}

type Row = Record<string, unknown>;

function toAccount(r: Row): Account {
  return {
    id: r.id as number,
    ownerId: r.owner_id as number,
    provider: r.provider as Provider,
    externalId: r.external_id as string,
    name: r.name as string,
    avatarUrl: (r.avatar_url as string) ?? null,
    accessToken: unseal(r.access_token as string),
    refreshToken: unseal(r.refresh_token as string),
    expiresAt: (r.expires_at as number) ?? null,
    meta: JSON.parse((r.meta as string) || "{}"),
  };
}

export function listAccounts(ownerId: number): Account[] {
  return (db.prepare("SELECT * FROM accounts WHERE owner_id = ? ORDER BY provider, name").all(ownerId) as Row[]).map(toAccount);
}

export function getAccount(id: number): Account | undefined {
  const r = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Row | undefined;
  return r ? toAccount(r) : undefined;
}

/** Compte uniquement s'il appartient à cette personne. */
export function getOwnedAccount(id: number, ownerId: number): Account | undefined {
  const a = getAccount(id);
  return a && a.ownerId === ownerId ? a : undefined;
}

export type AccountInput = Omit<Account, "id" | "ownerId">;

/** Crée ou met à jour (reconnexion) un compte dans l'espace de cette personne. */
export function upsertAccount(a: AccountInput, ownerId: number): void {
  db.prepare(
    `INSERT INTO accounts (owner_id, provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (owner_id, provider, external_id) DO UPDATE SET
       name = excluded.name, avatar_url = excluded.avatar_url, access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
       expires_at = excluded.expires_at, meta = excluded.meta`,
  ).run(
    ownerId,
    a.provider,
    a.externalId,
    a.name,
    a.avatarUrl,
    seal(a.accessToken),
    seal(a.refreshToken),
    a.expiresAt,
    JSON.stringify(a.meta),
    Date.now(),
  );
}

export function updateTokens(
  id: number,
  t: { accessToken: string; refreshToken?: string | null; expiresAt: number | null },
): void {
  db.prepare(
    `UPDATE accounts SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ? WHERE id = ?`,
  ).run(seal(t.accessToken), seal(t.refreshToken ?? null), t.expiresAt, id);
}

export function deleteAccount(id: number, ownerId: number): boolean {
  return db.prepare("DELETE FROM accounts WHERE id = ? AND owner_id = ?").run(id, ownerId).changes > 0;
}
