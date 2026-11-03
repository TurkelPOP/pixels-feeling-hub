import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";

export const db = new DatabaseSync(resolve(config.dataDir, "multiposter.db"));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    INTEGER,
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  UNIQUE (provider, external_id)
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

// Migrations légères (colonnes ajoutées après la v1).
for (const sql of ["ALTER TABLE media ADD COLUMN zernio_url TEXT", "ALTER TABLE media ADD COLUMN zernio_at INTEGER"]) {
  try {
    db.exec(sql);
  } catch {
    /* colonne déjà présente */
  }
}

export type Provider = "youtube" | "tiktok" | "instagram" | "facebook" | "threads" | "x";

export interface Account {
  id: number;
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

export function listAccounts(): Account[] {
  return (db.prepare("SELECT * FROM accounts ORDER BY provider, name").all() as Row[]).map(toAccount);
}

export function getAccount(id: number): Account | undefined {
  const r = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Row | undefined;
  return r ? toAccount(r) : undefined;
}

export type AccountInput = Omit<Account, "id">;

/** Crée ou met à jour (reconnexion) un compte. */
export function upsertAccount(a: AccountInput): void {
  db.prepare(
    `INSERT INTO accounts (provider, external_id, name, avatar_url, access_token, refresh_token, expires_at, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (provider, external_id) DO UPDATE SET
       name = excluded.name, avatar_url = excluded.avatar_url, access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
       expires_at = excluded.expires_at, meta = excluded.meta`,
  ).run(
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

export function deleteAccount(id: number): void {
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}
