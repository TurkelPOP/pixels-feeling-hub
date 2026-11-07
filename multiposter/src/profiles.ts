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
`);

export function listProfiles(ownerId: number) {
  const rows = db.prepare("SELECT id, name FROM profiles WHERE owner_id = ? ORDER BY name COLLATE NOCASE").all(ownerId) as { id: number; name: string }[];
  const links = db.prepare("SELECT account_id FROM profile_accounts WHERE profile_id = ?");
  return rows.map((p) => ({ ...p, accountIds: (links.all(p.id) as { account_id: number }[]).map((l) => l.account_id) }));
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

  api.get("/profiles", (c) => c.json(listProfiles(uid(c))));

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
