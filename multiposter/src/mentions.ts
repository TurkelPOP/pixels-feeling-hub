// Contacts de mention : une personne (ou une marque) enregistrée une fois, avec son nom de compte
// sur chaque réseau. Dans le texte, elle s'écrit @[Nom] ; au moment de publier, l'app la remplace
// par le bon @ selon le réseau (ou par le nom tout court si elle n'y a pas de compte).
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db, listAccounts } from "./db.ts";
import { request } from "./http.ts";
import { freshAccount } from "./scheduler.ts";

db.exec(`CREATE TABLE IF NOT EXISTS mention_contacts (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, handles TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL, UNIQUE (owner_id, name)
)`);
try { db.exec("ALTER TABLE mention_contacts ADD COLUMN avatar TEXT"); } catch { /* déjà là */ }

// ---------- Photo du contact ----------
// Gardée en petite image dans la base (data:…) : pas de lien vers un réseau qui expire.
const MAX_AVATAR = 300 * 1024;
const AVATAR_HOSTS = /(^|\.)(fbcdn\.net|cdninstagram\.com|ggpht\.com|googleusercontent\.com|ytimg\.com)$/i;

function imageMime(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}
const asDataUrl = (b: Buffer) => {
  const mime = imageMime(b);
  return mime && b.length <= MAX_AVATAR ? `data:${mime};base64,${b.toString("base64")}` : null;
};

async function download(url: string): Promise<string | null> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !AVATAR_HOSTS.test(u.hostname)) return null;
  // Pas de redirection (elle pourrait sortir des sites autorisés), et lecture plafonnée même
  // si le serveur n'annonce pas la taille.
  const res = await request(url, { redirect: "error" }, 15_000);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_AVATAR || !res.body) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > MAX_AVATAR) return null;
    chunks.push(Buffer.from(chunk));
  }
  return asDataUrl(Buffer.concat(chunks));
}

/** Cherche la photo de profil : Instagram (comptes pro/créateur), sinon YouTube. */
async function findAvatar(owner: number, handles: Handles): Promise<string | null> {
  const accs = listAccounts(owner);
  const ig = accs.find((a) => a.provider === "instagram" && a.accessToken);
  const igName = handles.instagram?.replace(/^@+/, "");
  if (ig && igName && /^[\w.]{1,30}$/.test(igName)) {
    try {
      const a = await freshAccount(ig);
      const r = await request(`https://graph.facebook.com/v23.0/${a.externalId}?${new URLSearchParams({ fields: `business_discovery.username(${igName}){profile_picture_url}`, access_token: a.accessToken! })}`, {}, 15_000);
      const url = (await r.json())?.business_discovery?.profile_picture_url;
      const img = url ? await download(url) : null;
      if (img) return img;
    } catch { /* compte perso ou introuvable : on essaie ailleurs */ }
  }
  const yt = accs.find((a) => a.provider === "youtube" && a.accessToken);
  const ytName = handles.youtube?.replace(/^@+/, "");
  if (yt && ytName && /^[\w.-]{1,100}$/.test(ytName)) {
    try {
      const a = await freshAccount(yt);
      const r = await request(`https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: "snippet", forHandle: `@${ytName}` })}`, { headers: { Authorization: `Bearer ${a.accessToken}` } }, 15_000);
      const t = (await r.json())?.items?.[0]?.snippet?.thumbnails;
      const url = t?.medium?.url ?? t?.default?.url;
      const img = url ? await download(url) : null;
      if (img) return img;
    } catch { /* rien trouvé */ }
  }
  return null;
}

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
      id: r.id, name: r.name, handles: JSON.parse(r.handles), avatar: r.avatar ?? null,
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
        id = Number(db.prepare("INSERT INTO mention_contacts (owner_id, name, handles, created_at) VALUES (?, ?, ?, ?)").run(owner, name, JSON.stringify(handles), Date.now()).lastInsertRowid);
      }
    } catch {
      return c.json({ error: `Tu as déjà un contact « ${name} ».` }, 400);
    }
    // Pas encore de photo : on essaie de la récupérer sur ses réseaux.
    const row = db.prepare("SELECT avatar FROM mention_contacts WHERE id = ?").get(id) as { avatar: string | null };
    let avatar = row.avatar;
    if (!avatar) {
      avatar = await findAvatar(owner, handles).catch(() => null);
      if (avatar) db.prepare("UPDATE mention_contacts SET avatar = ? WHERE id = ? AND owner_id = ?").run(avatar, id, owner);
    }
    return c.json({ ok: true, id, avatar });
  };
  api.post("/mentions", (c) => save(c));
  api.put("/mentions/:id", (c) => save(c, Number(c.req.param("id"))));
  /** Photo choisie à la main (image déjà réduite par le navigateur), ou retirée. */
  api.put("/mentions/:id/avatar", async (c) => {
    const owner = uid(c);
    const id = Number(c.req.param("id"));
    const b = await c.req.json<{ dataUrl?: string | null }>().catch(() => ({}) as { dataUrl?: string | null });
    let avatar: string | null = null;
    if (b.dataUrl) {
      const m = String(b.dataUrl).match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      avatar = m ? asDataUrl(Buffer.from(m[1], "base64")) : null;
      if (!avatar) return c.json({ error: "Image invalide (JPG, PNG ou WebP, 300 Ko max)." }, 400);
    }
    const r = db.prepare("UPDATE mention_contacts SET avatar = ? WHERE id = ? AND owner_id = ?").run(avatar, id, owner);
    return r.changes ? c.json({ ok: true, avatar }) : c.json({ error: "Contact introuvable" }, 404);
  });

  /** Relance la recherche de la photo sur Instagram / YouTube. */
  api.post("/mentions/:id/avatar/fetch", async (c) => {
    const owner = uid(c);
    const id = Number(c.req.param("id"));
    const r = db.prepare("SELECT handles FROM mention_contacts WHERE id = ? AND owner_id = ?").get(id, owner) as { handles: string } | undefined;
    if (!r) return c.json({ error: "Contact introuvable" }, 404);
    const avatar = await findAvatar(owner, JSON.parse(r.handles)).catch(() => null);
    if (!avatar) return c.json({ error: "Photo introuvable : compte Instagram perso ou non renseigné. Ajoute une image à la main." }, 404);
    db.prepare("UPDATE mention_contacts SET avatar = ? WHERE id = ? AND owner_id = ?").run(avatar, id, owner);
    return c.json({ ok: true, avatar });
  });

  api.delete("/mentions/:id", (c) => {
    const del = db.prepare("DELETE FROM mention_contacts WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return del.changes ? c.json({ ok: true }) : c.json({ error: "Introuvable" }, 404);
  });
}
