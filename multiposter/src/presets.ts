// Préférences de rédaction de chaque personne :
// - créneaux habituels (ex. « NEWZ » du lundi au vendredi à 8 h 30), pour programmer en un clic ;
// - modèles de légende (ex. la trame des NEWZ avec hashtags et mentions).
import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { db } from "./db.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS time_slots (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, label TEXT NOT NULL, days TEXT NOT NULL,
  time TEXT NOT NULL, profile_id INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS caption_templates (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL,
  profile_id INTEGER, created_at INTEGER NOT NULL
);`);

const ownProfile = (id: unknown, owner: number) =>
  id == null || id === "" ? null : (db.prepare("SELECT id FROM profiles WHERE id = ? AND owner_id = ?").get(Number(id), owner) as { id: number } | undefined)?.id ?? null;

export function registerPresetApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;

  // ---------- créneaux ----------
  api.get("/slots", (c) =>
    c.json((db.prepare("SELECT * FROM time_slots WHERE owner_id = ? ORDER BY time").all(uid(c)) as Record<string, any>[]).map((r) => ({
      id: r.id, label: r.label, days: JSON.parse(r.days), time: r.time, profileId: r.profile_id,
    }))),
  );
  const saveSlot = async (c: Context, id?: number) => {
    const owner = uid(c);
    const b = await c.req.json<{ label?: string; days?: number[]; time?: string; profileId?: number | null }>().catch(() => ({}) as Record<string, any>);
    const label = String(b.label ?? "").trim().slice(0, 40) || "Créneau";
    const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
    const time = String(b.time ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return c.json({ error: "Heure invalide (format 08:30)." }, 400);
    if (!days.length) return c.json({ error: "Choisis au moins un jour." }, 400);
    if (id) {
      const r = db.prepare("UPDATE time_slots SET label = ?, days = ?, time = ?, profile_id = ? WHERE id = ? AND owner_id = ?").run(label, JSON.stringify(days), time, ownProfile(b.profileId, owner), id, owner);
      if (!r.changes) return c.json({ error: "Créneau introuvable" }, 404);
    } else {
      if ((db.prepare("SELECT COUNT(*) AS n FROM time_slots WHERE owner_id = ?").get(owner) as { n: number }).n >= 50) return c.json({ error: "50 créneaux maximum." }, 400);
      db.prepare("INSERT INTO time_slots (owner_id, label, days, time, profile_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(owner, label, JSON.stringify(days), time, ownProfile(b.profileId, owner), Date.now());
    }
    return c.json({ ok: true });
  };
  api.post("/slots", (c) => saveSlot(c));
  api.put("/slots/:id", (c) => saveSlot(c, Number(c.req.param("id"))));
  api.delete("/slots/:id", (c) => {
    const del = db.prepare("DELETE FROM time_slots WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return del.changes ? c.json({ ok: true }) : c.json({ error: "Introuvable" }, 404);
  });

  // ---------- modèles de légende ----------
  api.get("/templates", (c) =>
    c.json((db.prepare("SELECT * FROM caption_templates WHERE owner_id = ? ORDER BY name COLLATE NOCASE").all(uid(c)) as Record<string, any>[]).map((r) => ({
      id: r.id, name: r.name, text: r.text, profileId: r.profile_id,
    }))),
  );
  const saveTpl = async (c: Context, id?: number) => {
    const owner = uid(c);
    const b = await c.req.json<{ name?: string; text?: string; profileId?: number | null }>().catch(() => ({}) as Record<string, any>);
    const name = String(b.name ?? "").trim().slice(0, 60);
    const text = String(b.text ?? "").slice(0, 5000);
    if (!name || !text.trim()) return c.json({ error: "Nom et texte obligatoires." }, 400);
    if (id) {
      const r = db.prepare("UPDATE caption_templates SET name = ?, text = ?, profile_id = ? WHERE id = ? AND owner_id = ?").run(name, text, ownProfile(b.profileId, owner), id, owner);
      if (!r.changes) return c.json({ error: "Modèle introuvable" }, 404);
    } else {
      if ((db.prepare("SELECT COUNT(*) AS n FROM caption_templates WHERE owner_id = ?").get(owner) as { n: number }).n >= 100) return c.json({ error: "100 modèles maximum." }, 400);
      db.prepare("INSERT INTO caption_templates (owner_id, name, text, profile_id, created_at) VALUES (?, ?, ?, ?, ?)").run(owner, name, text, ownProfile(b.profileId, owner), Date.now());
    }
    return c.json({ ok: true });
  };
  api.post("/templates", (c) => saveTpl(c));
  api.put("/templates/:id", (c) => saveTpl(c, Number(c.req.param("id"))));
  api.delete("/templates/:id", (c) => {
    const del = db.prepare("DELETE FROM caption_templates WHERE id = ? AND owner_id = ?").run(Number(c.req.param("id")), uid(c));
    return del.changes ? c.json({ ok: true }) : c.json({ error: "Introuvable" }, 404);
  });
}
