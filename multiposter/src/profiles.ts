// Profils : des groupes de comptes de réseaux sociaux par identité (ex. « Pixels Perspective » =
// Instagram + Facebook + Threads). Chaque personne gère ses propres profils, dans son espace.
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db, getOwnedAccount } from "./db.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profile_accounts (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, account_id)
);
CREATE INDEX IF NOT EXISTS profiles_owner ON profiles (owner_id);
-- Profil partagé : la personne invitée peut préparer des posts pour ces comptes, qui partent
-- en validation chez le propriétaire du profil. Elle ne voit jamais les accès des comptes.
CREATE TABLE IF NOT EXISTS profile_shares (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, user_id)
);
`);

/** Comptes accessibles à une personne via les profils partagés avec elle : id du compte → propriétaire. */
export function sharedAccountsFor(userId: number): Map<number, number> {
  const rows = db.prepare(
    `SELECT pa.account_id, p.owner_id FROM profile_shares s JOIN profiles p ON p.id = s.profile_id
     JOIN profile_accounts pa ON pa.profile_id = p.id WHERE s.user_id = ? AND p.owner_id <> ?`,
  ).all(userId, userId) as { account_id: number; owner_id: number }[];
  return new Map(rows.map((r) => [r.account_id, r.owner_id]));
}

/** Profils partagés AVEC cette personne (par d'autres). */
function sharedWithMe(userId: number) {
  const rows = db.prepare(
    `SELECT p.id, p.name, p.owner_id, u.name AS owner_name FROM profile_shares s JOIN profiles p ON p.id = s.profile_id
     JOIN users u ON u.id = p.owner_id WHERE s.user_id = ? ORDER BY p.name COLLATE NOCASE`,
  ).all(userId) as { id: number; name: string; owner_id: number; owner_name: string }[];
  const links = db.prepare("SELECT account_id FROM profile_accounts WHERE profile_id = ?");
  return rows.map((p) => ({ id: p.id, name: p.name, shared: true, ownerId: p.owner_id, ownerName: p.owner_name,
    accountIds: (links.all(p.id) as { account_id: number }[]).map((l) => l.account_id) }));
}

export function listProfiles(ownerId: number) {
  const rows = db.prepare("SELECT id, name FROM profiles WHERE owner_id = ? ORDER BY name COLLATE NOCASE").all(ownerId) as { id: number; name: string }[];
  const links = db.prepare("SELECT account_id FROM profile_accounts WHERE profile_id = ?");
  const shares = db.prepare("SELECT user_id FROM profile_shares WHERE profile_id = ?");
  return rows.map((p) => ({ ...p, accountIds: (links.all(p.id) as { account_id: number }[]).map((l) => l.account_id),
    sharedWith: (shares.all(p.id) as { user_id: number }[]).map((s) => s.user_id) }));
}

const cleanName = (n: unknown) => String(n ?? "").trim().replace(/\s+/g, " ").slice(0, 60);

function setAccounts(profileId: number, ownerId: number, accountIds: unknown) {
  db.prepare("DELETE FROM profile_accounts WHERE profile_id = ?").run(profileId);
  const ins = db.prepare("INSERT OR IGNORE INTO profile_accounts (profile_id, account_id) VALUES (?, ?)");
  for (const id of Array.isArray(accountIds) ? accountIds : []) {
    // Uniquement les comptes de cette personne.
    if (getOwnedAccount(Number(id), ownerId)) ins.run(profileId, Number(id));
  }
}

export function removeUserProfiles(ownerId: number) {
  db.prepare("DELETE FROM profiles WHERE owner_id = ?").run(ownerId);
}

export function registerProfileApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;
  const own = (c: Context, id: number) => db.prepare("SELECT id FROM profiles WHERE id = ? AND owner_id = ?").get(id, uid(c));

  api.get("/profiles", (c) => c.json([...listProfiles(uid(c)), ...sharedWithMe(uid(c))]));

  /** Les autres personnes de l'app (pour partager un profil avec elles). */
  api.get("/people", (c) =>
    c.json(db.prepare("SELECT id, name FROM users WHERE id <> ? ORDER BY name COLLATE NOCASE").all(uid(c)) as { id: number; name: string }[]),
  );

  /** Choisir avec qui un profil est partagé (propriétaire du profil uniquement). */
  api.put("/profiles/:id/shares", async (c) => {
    const id = Number(c.req.param("id"));
    if (!own(c, id)) return c.json({ error: "Profil introuvable" }, 404);
    const b = await c.req.json<{ userIds?: number[] }>().catch(() => ({}) as { userIds?: number[] });
    const ids = [...new Set((Array.isArray(b.userIds) ? b.userIds : []).map(Number))]
      .filter((u) => u !== uid(c) && db.prepare("SELECT 1 FROM users WHERE id = ?").get(u));
    db.prepare("DELETE FROM profile_shares WHERE profile_id = ?").run(id);
    for (const u of ids) db.prepare("INSERT INTO profile_shares (profile_id, user_id, created_at) VALUES (?, ?, ?)").run(id, u, Date.now());
    return c.json({ ok: true, sharedWith: ids });
  });

  api.post("/profiles", async (c) => {
    const b = await c.req.json<{ name?: string; accountIds?: number[] }>();
    const name = cleanName(b.name);
    if (!name) return c.json({ error: "Donne un nom au profil." }, 400);
    const id = Number(db.prepare("INSERT INTO profiles (owner_id, name, created_at) VALUES (?, ?, ?)").run(uid(c), name, Date.now()).lastInsertRowid);
    setAccounts(id, uid(c), b.accountIds);
    return c.json({ id });
  });

  api.put("/profiles/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!own(c, id)) return c.json({ error: "Profil introuvable" }, 404);
    const b = await c.req.json<{ name?: string; accountIds?: number[] }>();
    if (b.name !== undefined) {
      const name = cleanName(b.name);
      if (!name) return c.json({ error: "Donne un nom au profil." }, 400);
      db.prepare("UPDATE profiles SET name = ? WHERE id = ?").run(name, id);
    }
    if (b.accountIds !== undefined) setAccounts(id, uid(c), b.accountIds);
    return c.json({ ok: true });
  });

  api.delete("/profiles/:id", (c) => {
    db.prepare("DELETE FROM profiles WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return c.json({ ok: true });
  });
}
