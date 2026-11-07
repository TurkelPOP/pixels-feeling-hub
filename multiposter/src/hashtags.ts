// Hashtags : jeux de hashtags enregistrés (par profil ou pour tout) et hashtags les plus utilisés.
// Chaque personne ne voit que les siens (espace personnel).
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db } from "./db.ts";
import { extractHashtags } from "./providers/types.ts";

db.exec(`CREATE TABLE IF NOT EXISTS hashtag_sets (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, profile_id INTEGER, name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL
)`);

const uid = (c: Context) => currentUser(c)!.id;

/** Nettoie une liste de hashtags saisie librement (« #a, b #c » → ["#a", "#b", "#c"]). */
function cleanTags(raw: unknown): string[] {
  const words = String(raw ?? "").split(/[\s,;]+/).map((w) => w.replace(/^#+/, "")).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const tag = `#${w.replace(/[^\p{L}\p{N}_]/gu, "")}`;
    if (tag.length < 2 || tag.length > 100 || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out.slice(0, 30);
}

const ownProfile = (id: unknown, owner: number) =>
  id == null || id === "" ? null : (db.prepare("SELECT id FROM profiles WHERE id = ? AND owner_id = ?").get(Number(id), owner) as { id: number } | undefined)?.id ?? null;

export function registerHashtagApi(api: Hono) {
  api.get("/hashtags", (c) => {
    const owner = uid(c);
    const sets = (db.prepare("SELECT * FROM hashtag_sets WHERE owner_id = ? ORDER BY name").all(owner) as Record<string, any>[]).map((s) => ({
      id: s.id, name: s.name, profileId: s.profile_id, tags: JSON.parse(s.tags),
    }));
    // Hashtags les plus utilisés dans tes 300 derniers posts (texte commun + textes par réseau).
    const texts = db.prepare(
      `SELECT p.text AS t FROM posts p WHERE p.owner_id = ? ORDER BY p.id DESC LIMIT 300`,
    ).all(owner) as { t: string }[];
    const overrides = db.prepare(
      `SELECT pt.text_override AS t FROM post_targets pt JOIN posts p ON p.id = pt.post_id
       WHERE p.owner_id = ? AND pt.text_override IS NOT NULL ORDER BY p.id DESC LIMIT 600`,
    ).all(owner) as { t: string }[];
    const count = new Map<string, { tag: string; n: number }>();
    for (const { t } of [...texts, ...overrides])
      for (const tag of new Set(extractHashtags(t ?? ""))) {
        const k = tag.toLowerCase();
        const e = count.get(k) ?? { tag, n: 0 };
        e.n++;
        count.set(k, e);
      }
    const top = [...count.values()].sort((a, b) => b.n - a.n).slice(0, 20);
    return c.json({ sets, top });
  });

  api.post("/hashtags/sets", async (c) => {
    const owner = uid(c);
    const b = await c.req.json<{ name?: string; tags?: string; profileId?: number | null }>().catch(() => ({}) as Record<string, any>);
    const name = String(b.name ?? "").trim().slice(0, 60);
    const tags = cleanTags(b.tags);
    if (!name) return c.json({ error: "Donne un nom à ce jeu de hashtags." }, 400);
    if (!tags.length) return c.json({ error: "Ajoute au moins un hashtag." }, 400);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM hashtag_sets WHERE owner_id = ?").get(owner) as { n: number }).n;
    if (n >= 100) return c.json({ error: "100 jeux maximum." }, 400);
    db.prepare("INSERT INTO hashtag_sets (owner_id, profile_id, name, tags, created_at) VALUES (?, ?, ?, ?, ?)").run(
      owner, ownProfile(b.profileId, owner), name, JSON.stringify(tags), Date.now(),
    );
    return c.json({ ok: true });
  });

  api.put("/hashtags/sets/:id", async (c) => {
    const owner = uid(c);
    const b = await c.req.json<{ name?: string; tags?: string; profileId?: number | null }>().catch(() => ({}) as Record<string, any>);
    const name = String(b.name ?? "").trim().slice(0, 60);
    const tags = cleanTags(b.tags);
    if (!name || !tags.length) return c.json({ error: "Nom et hashtags obligatoires." }, 400);
    const r = db.prepare("UPDATE hashtag_sets SET name = ?, tags = ?, profile_id = ? WHERE id = ? AND owner_id = ?").run(
      name, JSON.stringify(tags), ownProfile(b.profileId, owner), Number(c.req.param("id")), owner,
    );
    return r.changes ? c.json({ ok: true }) : c.json({ error: "Jeu introuvable" }, 404);
  });

  api.delete("/hashtags/sets/:id", (c) => {
    db.prepare("DELETE FROM hashtag_sets WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return c.json({ ok: true });
  });
}
