// Contacts de mention : une personne (ou une marque) enregistrée une fois, avec son nom de compte
// sur chaque réseau. Dans le texte, elle s'écrit @[Nom] ; au moment de publier, l'app la remplace
// par le bon @ selon le réseau (ou par le nom tout court si elle n'y a pas de compte).
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS mention_contacts (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, handles TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL, UNIQUE (owner_id, name)
)`);

export const MENTION_NETWORKS = ["instagram", "threads", "x", "tiktok", "youtube", "facebook"] as const;
/** Réseaux où une mention s'écrit « @compte » (Facebook : le nom de la Page, en texte). */
const AT_NETWORKS = new Set(["instagram", "threads", "x", "tiktok", "youtube"]);
const TOKEN = /@\[([^\]\n]{1,60})\]/g;

type Handles = Partial<Record<(typeof MENTION_NETWORKS)[number], string>>;

function contactsOf(owner: number): Map<string, Handles> {
  const rows = db.prepare("SELECT name, handles FROM mention_contacts WHERE owner_id = ?").all(owner) as { name: string; handles: string }[];
  return new Map(rows.map((r) => [r.name.toLowerCase(), JSON.parse(r.handles) as Handles]));
}

/** Remplace les @[Nom] par le compte de cette personne sur ce réseau (ou son nom, à défaut). */
export function resolveMentions(text: string, provider: string, owner: number): string {
  if (!text.includes("@[")) return text;
  const contacts = contactsOf(owner);
  return text.replace(TOKEN, (_all, name: string) => {
    const h = contacts.get(name.trim().toLowerCase())?.[provider as keyof Handles]?.trim();
    if (!h) return name.trim();
    return AT_NETWORKS.has(provider) ? `@${h.replace(/^@+/, "")}` : h;
  });
}

function cleanHandles(raw: unknown): Handles {
  const out: Handles = {};
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const n of MENTION_NETWORKS) {
    let v = String(src[n] ?? "").trim();
    if (!v) continue;
    // Accepte aussi un lien de profil collé (instagram.com/xxx, x.com/xxx, tiktok.com/@xxx…).
    const m = v.match(/^https?:\/\/(?:www\.)?[^/]+\/(?:@)?([^/?#]+)/i);
    if (m && n !== "facebook") v = m[1];
    out[n] = v.replace(/[\n\r]/g, " ").slice(0, 80);
  }
  return out;
}

export function registerMentionApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;

  api.get("/mentions", (c) =>
    c.json((db.prepare("SELECT * FROM mention_contacts WHERE owner_id = ? ORDER BY name COLLATE NOCASE").all(uid(c)) as Record<string, any>[]).map((r) => ({
      id: r.id, name: r.name, handles: JSON.parse(r.handles),
    }))),
  );

  const save = async (c: Context, id?: number) => {
    const owner = uid(c);
    const b = await c.req.json<{ name?: string; handles?: Handles }>().catch(() => ({}) as { name?: string; handles?: Handles });
    const name = String(b.name ?? "").replace(/[\[\]\n]/g, "").trim().slice(0, 60);
    if (!name) return c.json({ error: "Donne un nom à ce contact (ex. Nintendo France)." }, 400);
    const handles = cleanHandles(b.handles);
    try {
      if (id) {
        const r = db.prepare("UPDATE mention_contacts SET name = ?, handles = ? WHERE id = ? AND owner_id = ?").run(name, JSON.stringify(handles), id, owner);
        if (!r.changes) return c.json({ error: "Contact introuvable" }, 404);
      } else {
        const n = (db.prepare("SELECT COUNT(*) AS n FROM mention_contacts WHERE owner_id = ?").get(owner) as { n: number }).n;
        if (n >= 300) return c.json({ error: "300 contacts maximum." }, 400);
        db.prepare("INSERT INTO mention_contacts (owner_id, name, handles, created_at) VALUES (?, ?, ?, ?)").run(owner, name, JSON.stringify(handles), Date.now());
      }
    } catch {
      return c.json({ error: `Tu as déjà un contact « ${name} ».` }, 400);
    }
    return c.json({ ok: true });
  };
  api.post("/mentions", (c) => save(c));
  api.put("/mentions/:id", (c) => save(c, Number(c.req.param("id"))));
  api.delete("/mentions/:id", (c) => {
    db.prepare("DELETE FROM mention_contacts WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return c.json({ ok: true });
  });
}
